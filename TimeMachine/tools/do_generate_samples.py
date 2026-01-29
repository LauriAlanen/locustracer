import numpy as np
import librosa
import soundfile as sf
import os
from typing import List

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SAMPLES_FOLDER = os.path.join(BASE_DIR, 'files', 'samples')
OUTPUT_FOLDER = os.path.join(SAMPLES_FOLDER, 'generated')


def generate_simulated_array(input_path: str, output_prefix: str, sample_delays: List[int]):
    """
    Generates time-shifted audio files to simulate a multi-microphone array setup.

    This function takes a mono source and creates N shifted versions based on the
    provided delays. This is used to test Time Difference of Arrival (TDOA) 
    algorithms like GCC-PHAT in a controlled digital environment.

    Args:
        input_path (str): Path to the source mono .wav or .mkv file.
        output_prefix (str): Filename prefix for the generated outputs.
        sample_delays (List[int]): List of delays in samples for each microphone.
            Example: [0, 12, 24, 36] for a 4-mic linear array.

    Raises:
        FileNotFoundError: If the input_path does not exist.
    """
    y, sr = librosa.load(input_path, sr=None, mono=True)

    # This prevents the 'digital click' that can mess up GCC-PHAT correlation
    fade_len = min(100, len(y))
    fade_in = np.linspace(0, 1, fade_len)
    y[:fade_len] *= fade_in

    max_delay = max(sample_delays)
    print(f"[*] Processing: {os.path.basename(input_path)}")
    print(f"[*] Sampling Rate: {sr} Hz")

    mics = []

    for i, delay in enumerate(sample_delays):
        # We pad the front with 'delay' zeros.
        # We pad the back with 'max_delay - delay' to keep all files equal length.
        # Length consistency is vital for synchronized buffer simulation.
        shifted = np.pad(y, (delay, max_delay - delay), mode='constant')
        mics.append(shifted)

        chan_filename = os.path.join(
            OUTPUT_FOLDER, f"{output_prefix}_mic_{i}.wav")
        sf.write(chan_filename, shifted, sr)
        print(f"    -> Mic {i}: {delay} sample delay saved.")

    # Shape transformation: (Channel, Samples) -> (Samples, Channel) for WAV format
    multi_channel = np.array(mics).T
    master_filename = os.path.join(
        OUTPUT_FOLDER, f"{output_prefix}_4ch_linear.wav")
    sf.write(master_filename, multi_channel, sr)
    print(f"[*] Master 4-channel file saved: {master_filename}")


if __name__ == "__main__":
    os.makedirs(OUTPUT_FOLDER, exist_ok=True)

    # Configuration: Simulation of 4 microphones
    # At 48kHz, a 12-sample delay is ~0.25ms (approx 8.5cm spacing)
    TARGET_DELAYS = [0, 12, 24, 36]
    INPUT_FILE = os.path.join(SAMPLES_FOLDER, 'user', 'reference_audio.wav')

    if os.path.exists(INPUT_FILE):
        generate_simulated_array(INPUT_FILE, 'simulation', TARGET_DELAYS)
    else:
        print(f"[!] Error: Reference file not found at {INPUT_FILE}")
