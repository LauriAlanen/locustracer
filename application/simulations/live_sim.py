import numpy as np
import matplotlib
matplotlib.use('Qt5Agg')
import matplotlib.pyplot as plt
import pyroomacoustics as pra
import time

def main():
    fs = 16000
    room_dim = [2.0, 2.0]
    
    # 4 microphones at the corners
    mics = np.array([
        [0.05, 1.95, 1.95, 0.05], # x
        [0.05, 0.05, 1.95, 1.95]  # y
    ])
    
    # Setup interactive plot
    plt.ion()
    fig, axes = plt.subplots(2, 1, figsize=(8, 8))
    
    ax_room = axes[0]
    ax_waves = axes[1]
    
    # --- Setup Room Plot ---
    ax_room.set_xlim(-0.2, 2.2)
    ax_room.set_ylim(-0.2, 2.2)
    ax_room.set_aspect('equal')
    ax_room.set_title("Live Room Layout (Moving Source)")
    ax_room.set_xlabel("X (m)")
    ax_room.set_ylabel("Y (m)")
    
    # Draw microphones
    ax_room.scatter(mics[0], mics[1], c='b', marker='o', label="Microphones")
    
    # Placeholder for the source
    source_plot, = ax_room.plot([], [], 'ro', markersize=10, label="Moving Source")
    ax_room.legend(loc="upper right")
    
    # --- Setup Waveform Plot ---
    chunk_duration = 0.1  # Simulate in 100ms blocks
    chunk_samples = int(fs * chunk_duration)
    
    # We will maintain a scrolling window of the last 1.0 second
    history_duration = 1.0
    history_samples = int(fs * history_duration)
    time_axis = np.arange(history_samples) / fs
    
    wave_lines = []
    for i in range(4):
        # Initial flat lines with offsets
        line, = ax_waves.plot(time_axis, np.zeros(history_samples) + i * 2.0, label=f"Mic {i+1}")
        wave_lines.append(line)
        
    ax_waves.set_ylim(-1, 8)
    ax_waves.set_xlim(0, history_duration)
    ax_waves.set_title("Live Microphone Outputs")
    ax_waves.set_xlabel("Time (s)")
    ax_waves.set_ylabel("Amplitude (Offset)")
    ax_waves.legend(loc="upper right")
    
    fig.tight_layout()
    
    # Buffer to hold historical data for smooth scrolling
    signal_history = np.zeros((4, history_samples))
    
    print("Starting live simulation. Close the plot window or press Ctrl+C to stop.")
    
    # Simulation loop variables
    t_sim = 0.0
    
    try:
        while plt.fignum_exists(fig.number):
            loop_start = time.time()
            
            # 1. Update source position (circular trajectory)
            radius = 0.8
            center = [1.0, 1.0]
            speed = 2.0 # radians per second
            
            src_x = center[0] + radius * np.cos(speed * t_sim)
            src_y = center[1] + radius * np.sin(speed * t_sim)
            
            source_plot.set_data([src_x], [src_y])
            
            # 2. Create room for this specific chunk
            # We use a very low max_order (e.g. 2) to ensure the simulation computes quickly
            room = pra.ShoeBox(room_dim, fs=fs, max_order=2, materials=pra.Material(0.2))
            room.add_microphone_array(mics)
            
            # 3. Generate audio chunk (a pulsing 440hz tone so we can see the movement clearly)
            t_chunk = np.arange(chunk_samples) / fs + t_sim
            chunk_signal = np.sin(2 * np.pi * 440 * t_chunk) * (0.5 + 0.5 * np.sin(2 * np.pi * 10 * t_chunk))
            
            room.add_source([src_x, src_y], signal=chunk_signal)
            
            # 4. Simulate the block
            room.simulate()
            
            # 5. Extract mic signals
            # The simulator generates the chunk + the reverb tail. We only take the chunk length 
            # to maintain continuous time without overlapping the tails for this simple visualizer.
            sim_out = room.mic_array.signals
            
            out_chunk = np.zeros((4, chunk_samples))
            valid_len = min(chunk_samples, sim_out.shape[1])
            out_chunk[:, :valid_len] = sim_out[:, :valid_len]
            
            # 6. Update history buffer by shifting left and adding new chunk at the end
            signal_history = np.roll(signal_history, -chunk_samples, axis=1)
            signal_history[:, -chunk_samples:] = out_chunk
            
            # 7. Update wave plots
            for i in range(4):
                wave_lines[i].set_ydata(signal_history[i, :] + i * 2.0)
                
            # Flush UI events to render the new frame
            fig.canvas.draw()
            fig.canvas.flush_events()
            
            # Advance simulation time
            t_sim += chunk_duration
            
            # Try to pace it to run semi real-time
            elapsed = time.time() - loop_start
            sleep_time = chunk_duration - elapsed
            if sleep_time > 0:
                plt.pause(sleep_time)
            else:
                # If we're lagging behind real-time, just yield to the GUI briefly
                plt.pause(0.01)
                
    except KeyboardInterrupt:
        print("Simulation stopped by user.")

if __name__ == "__main__":
    main()
