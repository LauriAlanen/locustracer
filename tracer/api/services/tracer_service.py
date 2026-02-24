"""
Tracer service — business logic layer wrapping TimeMachine core modules.

This service sits between the API routers and the core processing modules,
providing a clean interface for pipeline operations.
"""

import os
import json
import numpy as np
from typing import Optional

from tracer.core.time_machine import TimeMachine
from tracer.core.location_solver import MIC_COORDS, C


# ── Path configuration ──────────────────────────────────────────────

# Resolve paths from the tracer package root (tracer/) using core module location
import tracer.core as _core_module
TRACER_DIR = os.path.dirname(os.path.dirname(os.path.abspath(_core_module.__file__)))
FILES_DIR = os.path.join(TRACER_DIR, "files", "samples")
GENERATED_DIR = os.path.join(FILES_DIR, "generated")
DEFAULT_INPUT = os.path.join(GENERATED_DIR, "simulation_4ch_room.wav")
DEFAULT_OUTPUT = os.path.join(GENERATED_DIR, "pipeline_output")
RESULTS_FILE = os.path.join(DEFAULT_OUTPUT, "timemachine_results.json")


# ── System configuration ────────────────────────────────────────────

ROOM_DIMS = {
    "width": float(np.max(MIC_COORDS[:, 0])),
    "depth": float(np.max(MIC_COORDS[:, 1])),
    "height": 3.0,
}

MICROPHONES = [
    {
        "id": i,
        "label": f"Mic {i}",
        "position": MIC_COORDS[i].tolist(),
        "color": "#4da6ff",
    }
    for i in range(len(MIC_COORDS))
]


def get_system_config() -> dict:
    """Returns the current system configuration (room, mics, constants)."""
    return {
        "room": ROOM_DIMS,
        "microphones": MICROPHONES,
        "speed_of_sound": C,
    }


# ── Pipeline operations ─────────────────────────────────────────────

def get_latest_results() -> Optional[dict]:
    """
    Reads and returns the latest pipeline results from disk.

    Returns:
        Pipeline results dict, or None if no results exist.
    """
    if not os.path.exists(RESULTS_FILE):
        return None

    with open(RESULTS_FILE, "r") as f:
        return json.load(f)


def run_pipeline(input_file: Optional[str] = None, visualize: bool = False) -> dict:
    """
    Executes the full TimeMachine pipeline.

    Args:
        input_file: Path to input WAV file. Defaults to the simulation file.
        visualize: Whether to generate visualization plots.

    Returns:
        Pipeline results dict.

    Raises:
        FileNotFoundError: If the input file doesn't exist.
        RuntimeError: If the pipeline fails to produce results.
    """
    if input_file is None:
        input_file = DEFAULT_INPUT

    if not os.path.exists(input_file):
        raise FileNotFoundError(f"Input file not found: {input_file}")

    # Run the pipeline
    tm = TimeMachine(input_file, DEFAULT_OUTPUT, visualize=visualize)
    tm.run()

    # Read and return the results
    results = get_latest_results()
    if results is None:
        raise RuntimeError("Pipeline completed but no results file was generated.")

    return results
