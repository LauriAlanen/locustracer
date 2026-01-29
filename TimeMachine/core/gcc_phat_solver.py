import numpy as np
import librosa
import json
import os
from scipy.fftpack import fft, ifft

# Path Configuration
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SAMPLES_FOLDER = os.path.join(BASE_DIR, "..", "files", "samples", "generated")
INPUT_FILE = os.path.join(SAMPLES_FOLDER, 'simulation_4ch_linear.wav')
METADATA_FILE = os.path.join(SAMPLES_FOLDER, 'activity_metadata.json')


def gcc_phat(sig, refsig, fs=1, interpolation=1):
    """
    Generalized Cross-Correlation with Phase Transform.
    Returns the delay in samples between sig and refsig.
    """
    n = sig.shape[0] + refsig.shape[0]

    # Frequency domain cross-correlation
    SIG = fft(sig, n=n)
    REFSIG = fft(refsig, n=n)
    R = SIG * np.conj(REFSIG)

    # Phase Transform (Normalization)
    # We add a tiny epsilon to avoid division by zero in silence
    cc = ifft(R / (np.abs(R) + 1e-10))

    # Shift result to center 0-delay
    max_shift = int(n / 2)
    cc = np.concatenate((cc[-max_shift:], cc[:max_shift+1]))

    # Find the peak which represents the time delay
    shift = np.argmax(np.abs(cc)) - max_shift
    return shift


def run_solver():
    if not os.path.exists(METADATA_FILE):
        print("[!] No metadata found. Run the Feature Extractor first.")
        return

    with open(METADATA_FILE, 'r') as f:
        meta = json.load(f)

    data, sr = librosa.load(INPUT_FILE, sr=None, mono=False)

    print(f"[*] Solving TDOA for: {os.path.basename(INPUT_FILE)}")
    print("-" * 40)

    for i, segment in enumerate(meta['active_segments']):
        start = segment['start_sample']
        end = segment['end_sample']

        chunk = data[:, start:end]
        ref_mic = chunk[0]  # Mic 0 is our reference

        print(f"Segment {i} ({start} to {end} samples):")

        # Compare each mic to the reference
        for m in range(1, chunk.shape[0]):
            delay = gcc_phat(chunk[m], ref_mic, fs=sr)
            print(f"  -> Mic {m} Delay: {delay} samples")

    print("-" * 40)


if __name__ == "__main__":
    run_solver()
