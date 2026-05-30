import numpy as np
import matplotlib.pyplot as plt
import pyroomacoustics as pra

def main():
    # 1. Create a 2D room (2x2 meters)
    room_dim = [2.0, 2.0]
    # We use a standard Shoebox room model with a sampling frequency of 16kHz
    # and some absorption (using materials) to prevent infinite reverberations
    room = pra.ShoeBox(room_dim, fs=16000, max_order=15, materials=pra.Material(0.2))

    # 2. Add microphones at each corner
    # Note: Microphones are placed slightly inwards from the walls (0.05m) 
    # as placing them exactly on the boundary can cause simulation issues.
    # The array shape for pra is (n_dim, n_mics)
    mics = np.array([
        [0.05, 1.95, 1.95, 0.05], # x coordinates
        [0.05, 0.05, 1.95, 1.95]  # y coordinates
    ])
    mic_array = pra.MicrophoneArray(mics, room.fs)
    room.add_microphone_array(mic_array)

    # 3. Add an audio source close to the center
    # The absolute center is (1.0, 1.0), so we place it at (1.1, 0.9)
    source_location = [0.2, 0.1]

    # Create a simple test signal: a decaying 440 Hz tone (0.5 seconds)
    duration = 0.5 
    t = np.arange(0, int(room.fs * duration)) / room.fs
    signal = np.sin(2 * np.pi * 440 * t) * np.exp(-10 * t)

    room.add_source(source_location, signal=signal)

    # 4. Run the image source model simulation
    print("Running room acoustics simulation...")
    room.simulate()

    # 5. Visualize the room setup and microphone signals
    fig, axes = plt.subplots(2, 1, figsize=(10, 10))

    # Plot the room
    room.plot(ax=axes[0])
    axes[0].set_title("Room Setup (2m x 2m) with Mic Array and Source")
    axes[0].set_xlabel("X (meters)")
    axes[0].set_ylabel("Y (meters)")
    axes[0].set_aspect('equal')

    # Plot the microphone outputs
    ax2 = axes[1]
    # The signals are stored in room.mic_array.signals
    signals = room.mic_array.signals
    time_axis = np.arange(signals.shape[1]) / room.fs
    
    for i in range(signals.shape[0]):
        # Offset each microphone signal so they don't overlap entirely on the plot
        offset = i * 1.5 
        ax2.plot(time_axis, signals[i, :] + offset, label=f"Mic {i+1} (Corner)")

    ax2.set_title("Simulated Microphone Outputs")
    ax2.set_xlabel("Time (s)")
    ax2.set_ylabel("Amplitude (offset for clarity)")
    ax2.legend(loc="upper right")
    
    fig.tight_layout()
    
    # Save the output to an image
    output_img = "simulation_results.png"
    fig.savefig(output_img)
    print(f"Simulation completed! Plot saved to '{output_img}'")

if __name__ == "__main__":
    main()
