import numpy as np
import librosa
import os
import json
try:
    from .visualization import Visualizer
except ImportError:
    from visualization import Visualizer

# Path Configuration
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SAMPLES_FOLDER = os.path.join(BASE_DIR, "..", "files", "samples", "generated")
INPUT_FILE = os.path.join(SAMPLES_FOLDER, 'simulation_4ch_room.wav')
OUTPUT_METADATA = os.path.join(SAMPLES_FOLDER, 'activity_metadata.json')


def extract_active_segments(file_path: str, threshold_db: int = -30, frame_length: int = 2048):
    """
    Analyzes a multi-channel file to find segments where sound is active.

    Args:
        file_path: Path to the 4-channel WAV.
        threshold_db: Energy threshold in decibels relative to peak.
        frame_length: Size of the analysis window.

    Returns:
        List of dicts containing active window sample indices.
    """
    if not os.path.exists(file_path):
        print(f"[!] File not found: {file_path}")
        return []

    data, sr = librosa.load(file_path, sr=None, mono=False)

    # Use Mic 0 as the reference for activity detection
    ref_mic = data[0]

    # Calculate Short-Time RMS Energy
    # This divides the audio into frames and calculates the loudness of each
    rms = librosa.feature.rms(
        y=ref_mic, frame_length=frame_length, hop_length=frame_length//2)[0]

    # Convert to decibels for easier thresholding
    rms_db = librosa.amplitude_to_db(rms, ref=np.max)

    # Identify frames above the threshold
    active_frames = np.where(rms_db > threshold_db)[0]

    if len(active_frames) == 0:
        print("[!] No active segments found. Try lowering the threshold_db.")
        return []

    # Group continuous frames into segments
    segments = []
    if len(active_frames) > 0:
        start_f = active_frames[0]
        for i in range(1, len(active_frames)):
            # If there is a gap between frames, close the current segment and start a new one
            if active_frames[i] > active_frames[i-1] + 1:
                segments.append({
                    "start_sample": int(start_f * (frame_length // 2)),
                    "end_sample": int(active_frames[i-1] * (frame_length // 2))
                })
                start_f = active_frames[i]

        segments.append({
            "start_sample": int(start_f * (frame_length // 2)),
            "end_sample": int(active_frames[-1] * (frame_length // 2))
        })

    # Visualize results
    viz_dir = os.path.join(SAMPLES_FOLDER, 'visualizations')
    viz = Visualizer(viz_dir)
    viz.plot_active_segments(ref_mic, sr, segments)

    # Save metadata for the GCC-PHAT Solver
    # Note that the sample indices are relative to the original audio file
    # So sample / base_rate gives time in seconds
    metadata = {
        "source_file": file_path,
        "sample_rate": sr,
        "active_segments": segments
    }

    with open(OUTPUT_METADATA, 'w') as f:
        json.dump(metadata, f, indent=4)

    print(f"[*] Found {len(segments)} active segments.")
    print(f"[*] Metadata saved to: {OUTPUT_METADATA}")
    return segments


if __name__ == "__main__":
    extract_active_segments(INPUT_FILE)
