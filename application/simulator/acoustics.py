import numpy as np
import pyroomacoustics as pra
from config import ROOM_DIM, MIC_LOCS, FS, DURATION, SOURCE_FREQ, SOURCE_LOC

def generate_signals():
    # 1. Create a room
    room = pra.ShoeBox(ROOM_DIM, fs=FS, max_order=10)
    
    # 2. Add microphones
    mics = np.array(MIC_LOCS).T # Shape (3, 4)
    room.add_microphone_array(mics)
    
    # 3. Add a source
    n_samples = int(FS * DURATION)
    t = np.arange(n_samples) / FS
    signal = 0.5 * np.sin(2 * np.pi * SOURCE_FREQ * t) + 0.1 * np.random.randn(n_samples)
    room.add_source(SOURCE_LOC, signal=signal)
    
    # 4. Simulate
    print("Simulating room acoustics (this might take a moment)...")
    room.simulate()
    print("Simulation complete.")
    
    return room.mic_array.signals
