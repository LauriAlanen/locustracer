"""
Simulation service — generates moving source trajectories and verifies
the solver can reconstruct positions from theoretical delays.

No audio files needed: delays are calculated mathematically from
position → mic distances → speed of sound.
"""

import math
import numpy as np
from typing import List, Tuple

from tracer.core.location_solver import MIC_COORDS, C, triangulate_xy


# Room boundaries with margin to keep source inside
ROOM_W = float(np.max(MIC_COORDS[:, 0]))
ROOM_D = float(np.max(MIC_COORDS[:, 1]))
MARGIN = 0.3


def compute_theoretical_delays(
    position: Tuple[float, float],
    mic_coords: np.ndarray,
    speed_of_sound: float,
    sample_rate: int,
) -> List[int]:
    """
    Calculate the sample delays that WOULD be measured if a source
    were at the given position, relative to Mic 0 (reference).

    Returns delays for [Mic1, Mic2, Mic3] in samples.
    """
    pos = np.array(position)
    distances = np.sqrt(np.sum((mic_coords - pos) ** 2, axis=1))
    travel_times = distances / speed_of_sound

    # TDOAs relative to Mic 0
    tdoas = travel_times[1:] - travel_times[0]

    # Convert to samples
    sample_delays = np.round(tdoas * sample_rate).astype(int)
    return sample_delays.tolist()


def solve_and_verify(
    delays: List[int], sample_rate: int
) -> Tuple[List[float], float]:
    """
    Run the location solver on the given delays and return
    the solved position and residual error.
    """
    pos, cost = triangulate_xy(delays, sample_rate)
    return pos.tolist(), float(cost)


# ── Trajectory generators ───────────────────────────────────────────

def _clamp(val: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, val))


def generate_circle(steps: int, speed: float) -> List[Tuple[float, float]]:
    """Circular trajectory around room center."""
    cx, cy = ROOM_W / 2, ROOM_D / 2
    radius = min(cx, cy) - MARGIN
    points = []
    for i in range(steps):
        angle = (2 * math.pi * i / steps) * speed
        x = cx + radius * math.cos(angle)
        y = cy + radius * math.sin(angle)
        points.append((x, y))
    return points


def generate_figure8(steps: int, speed: float) -> List[Tuple[float, float]]:
    """Figure-8 (lemniscate) trajectory."""
    cx, cy = ROOM_W / 2, ROOM_D / 2
    scale_x = (ROOM_W / 2) - MARGIN
    scale_y = (ROOM_D / 2) - MARGIN
    points = []
    for i in range(steps):
        t = (2 * math.pi * i / steps) * speed
        x = cx + scale_x * math.sin(t)
        y = cy + scale_y * math.sin(t) * math.cos(t)
        points.append((
            _clamp(x, MARGIN, ROOM_W - MARGIN),
            _clamp(y, MARGIN, ROOM_D - MARGIN),
        ))
    return points


def generate_linear(steps: int, speed: float) -> List[Tuple[float, float]]:
    """Linear back-and-forth diagonal trajectory."""
    points = []
    for i in range(steps):
        t = (i / steps) * speed
        # Ping-pong between corners
        frac = t % 1.0
        if int(t) % 2 == 1:
            frac = 1.0 - frac
        x = MARGIN + frac * (ROOM_W - 2 * MARGIN)
        y = MARGIN + frac * (ROOM_D - 2 * MARGIN)
        points.append((x, y))
    return points


def generate_random_walk(steps: int, speed: float) -> List[Tuple[float, float]]:
    """Smooth random walk using cumulative sine waves."""
    rng = np.random.RandomState(42)  # Deterministic for reproducibility
    freqs_x = rng.uniform(0.5, 3.0, size=4)
    freqs_y = rng.uniform(0.5, 3.0, size=4)
    phases_x = rng.uniform(0, 2 * math.pi, size=4)
    phases_y = rng.uniform(0, 2 * math.pi, size=4)

    points = []
    for i in range(steps):
        t = (i / steps) * 2 * math.pi * speed
        x = sum(math.sin(f * t + p) for f, p in zip(freqs_x, phases_x)) / 4
        y = sum(math.sin(f * t + p) for f, p in zip(freqs_y, phases_y)) / 4
        # Normalize to room bounds
        x = ROOM_W / 2 + x * (ROOM_W / 2 - MARGIN)
        y = ROOM_D / 2 + y * (ROOM_D / 2 - MARGIN)
        points.append((
            _clamp(x, MARGIN, ROOM_W - MARGIN),
            _clamp(y, MARGIN, ROOM_D - MARGIN),
        ))
    return points


TRAJECTORY_GENERATORS = {
    "circle": generate_circle,
    "figure8": generate_figure8,
    "linear": generate_linear,
    "random_walk": generate_random_walk,
}


def generate_trajectory(
    shape: str = "circle",
    steps: int = 100,
    speed: float = 0.5,
    sample_rate: int = 44100,
    interval_ms: int = 200,
) -> list:
    """
    Generate a full trajectory with solver verification at each step.

    Returns list of SimulationFrame dicts.
    """
    generator = TRAJECTORY_GENERATORS.get(shape, generate_circle)
    positions = generator(steps, speed)

    frames = []
    for i, (x, y) in enumerate(positions):
        timestamp = i * (interval_ms / 1000.0)

        # Compute theoretical delays
        delays = compute_theoretical_delays(
            (x, y), MIC_COORDS, C, sample_rate
        )

        # Run solver to verify
        solved_pos, residual = solve_and_verify(delays, sample_rate)

        frames.append({
            "step": i,
            "timestamp": round(timestamp, 3),
            "true_position": [round(x, 4), round(y, 4)],
            "delays": delays,
            "solved_position": [round(solved_pos[0], 4), round(solved_pos[1], 4)],
            "residual": residual,
        })

    return frames
