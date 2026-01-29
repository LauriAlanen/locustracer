import numpy as np
import librosa
import soundfile as sf
import os
from typing import List, Tuple

# --- PATH CONFIGURATION ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SAMPLES_FOLDER = os.path.join(BASE_DIR, "..", "files", "samples", "user")
OUTPUT_FOLDER = os.path.join(BASE_DIR, "..", "files", "samples", "generated")

# --- ROOM CONFIGURATION ---
C = 343.0  # Speed of sound (m/s)
# Mic coordinates: [Mic0(0,0), Mic1(5,0), Mic2(5,5), Mic3(0,5)]
MIC_COORDS = np.array([[0, 0], [5, 0], [5, 5], [0, 5]])


def calculate_delays_from_pos(source_xy: Tuple[float, float], sr: int) -> List[int]:
    """
    Calculates sample delays for 4 corner mics based on a source (x, y) position.
    """
    distances = np.sqrt(np.sum((MIC_COORDS - source_xy)**2, axis=1))
    times = distances / C

    # We want delays relative to the FIRST mic that hears the sound
    min_time = np.min(times)
    relative_times = times - min_time

    # Convert to integer samples
    sample_delays = [int(t * sr) for t in relative_times]
    return sample_delays


def generate_room_simulation(input_path: str, output_prefix: str, source_pos: Tuple[float, float]):
    """
    Generates 4-channel audio representing a sound source at a specific (x, y) 
    coordinate in a square room.
    """
    if not os.path.exists(input_path):
        raise FileNotFoundError(f"Source file not found: {input_path}")

    y, sr = librosa.load(input_path, sr=None, mono=True)

    # Prevent digital clicks
    fade_len = min(100, len(y))
    y[:fade_len] *= np.linspace(0, 1, fade_len)

    # Calculate geometry-based delays
    sample_delays = calculate_delays_from_pos(source_pos, sr)
    max_delay = max(sample_delays)

    print(f"[*] Simulating source at: {source_pos}")
    print(f"[*] Calculated Delays: {sample_delays} samples")

    mics = []
    for i, delay in enumerate(sample_delays):
        # Time-shift using zero-padding
        shifted = np.pad(y, (delay, max_delay - delay), mode='constant')
        mics.append(shifted)

        # Save individual mic files (simulating separate ESP32-S3 nodes)
        chan_filename = os.path.join(
            OUTPUT_FOLDER, f"{output_prefix}_mic_{i}.wav")
        sf.write(chan_filename, shifted, sr)

    # Save master file for visualization/testing
    multi_channel = np.array(mics).T
    master_filename = os.path.join(
        OUTPUT_FOLDER, f"{output_prefix}_4ch_room.wav")
    sf.write(master_filename, multi_channel, sr)
    print(f"[*] Master file saved: {master_filename}")


if __name__ == "__main__":
    os.makedirs(OUTPUT_FOLDER, exist_ok=True)

    INPUT_FILE = os.path.join(SAMPLES_FOLDER, 'reference_audio.wav')
    TARGET_POS = (1.2, 3.8)

    generate_room_simulation(INPUT_FILE, 'simulation', TARGET_POS)
