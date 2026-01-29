import numpy as np
import librosa
import matplotlib.pyplot as plt
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SAMPLES_FOLDER = os.path.join(BASE_DIR, "..", "files", "samples", "generated")
INPUT_FILE = os.path.join(SAMPLES_FOLDER, 'simulation_4ch_room.wav')


def visualize_raw(file_path: str, start_sec: float = 0.0, duration_sec: float = 1.0):
    """
    Visualizes multi-channel audio over a long duration using stacked subplots.

    Args:
        file_path (str): Path to the 4-channel WAV.
        start_sec (float): Start time in seconds.
        duration_sec (float): Total length to display in seconds.
    """
    if not os.path.exists(file_path):
        print(f"[!] File not found: {file_path}")
        return

    # sr=None preserves original sampling rate
    data, sr = librosa.load(file_path, sr=None, mono=False)

    # Slice the requested time window
    start_sample = int(start_sec * sr)
    end_sample = start_sample + int(duration_sec * sr)
    time_slice = data[:, start_sample:end_sample]

    t = np.linspace(start_sec, start_sec + duration_sec, time_slice.shape[1])

    # Create Figure with Stacked Subplots
    fig, axes = plt.subplots(4, 1, figsize=(14, 10), sharex=True)
    fig.suptitle(
        f"Multi-Channel Array View: {duration_sec}s Duration", fontsize=16)

    colors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728']

    for i in range(4):
        axes[i].plot(t, time_slice[i], color=colors[i], linewidth=0.5)
        axes[i].set_ylabel(f"Mic {i}")
        axes[i].grid(True, alpha=0.3)
        axes[i].set_ylim(-1, 1)

    axes[3].set_xlabel("Time (seconds)")

    plt.tight_layout(rect=[0, 0.03, 1, 0.95])
    plt.show()


if __name__ == "__main__":
    visualize_raw(INPUT_FILE, start_sec=1.2, duration_sec=0.5)
