import numpy as np
import librosa
import json
import os
from scipy.fftpack import fft, ifft
try:
    from .visualization import Visualizer
except ImportError:
    from visualization import Visualizer

# Path Configuration
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SAMPLES_FOLDER = os.path.join(BASE_DIR, "..", "files", "samples", "generated")
INPUT_FILE = os.path.join(SAMPLES_FOLDER, 'simulation_4ch_room.wav')
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
    return int(shift), cc


def compute_delays(data, active_segments, visualizer=None):
    """
    Computes time delays for each active segment using GCC-PHAT.
    
    Args:
        data: Multi-channel audio data (numpy array).
        active_segments: List of segment dictionaries.
        visualizer: Optional Visualizer instance.
        
    Returns:
        List of active segments with 'delays' added.
    """
    print(f"[*] Analyzing delays for {len(active_segments)} segments...")

    # Process segments and update metadata
    for i, segment in enumerate(active_segments):
        start = segment['start_sample']
        end = segment['end_sample']

        # Extract the segment across all 4 channels
        chunk = data[:, start:end]
        ref_mic = chunk[0]  # Mic 0 is our reference point

        # We store delays in a list: [delay_mic1, delay_mic2, delay_mic3]
        delays = []

        # Compare Mics 1, 2, and 3 to Mic 0
        for m in range(1, chunk.shape[0]):
            delay, cc_val = gcc_phat(chunk[m], ref_mic)
            delays.append(delay)
            
            # Visualize GCC-PHAT
            if visualizer and i < 5: # Limit visualizations to first 5 segments
                visualizer.plot_gcc_phat(cc_val, delay, m, i)

        # Append the new data to the current segment object
        segment['delays'] = delays
    
    return active_segments


def run_solver():
    if not os.path.exists(METADATA_FILE):
        print("[!] No metadata found. Run the Feature Extractor first.")
        return

    with open(METADATA_FILE, 'r') as f:
        meta = json.load(f)

    if not os.path.exists(INPUT_FILE):
        print(f"[!] Audio file not found: {INPUT_FILE}")
        return

    data, sr = librosa.load(INPUT_FILE, sr=None, mono=False)

    print(f"[*] Analyzing delays in: {os.path.basename(INPUT_FILE)}")
    print("-" * 40)

    viz_dir = os.path.join(SAMPLES_FOLDER, 'visualizations')
    viz = Visualizer(viz_dir)

    # Compute delays
    compute_delays(data, meta['active_segments'], viz)

    with open(METADATA_FILE, 'w') as f:
        json.dump(meta, f, indent=4)

    print("-" * 40)
    print(f"[*] Metadata updated with delays: {METADATA_FILE}")


if __name__ == "__main__":
    run_solver()
