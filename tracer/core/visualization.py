import os
import matplotlib.pyplot as plt
import numpy as np

class Visualizer:
    def __init__(self, output_dir):
        self.output_dir = output_dir
        if not os.path.exists(self.output_dir):
            os.makedirs(self.output_dir)

    def plot_active_segments(self, signal, sr, segments, filename="active_segments.png"):
        plt.figure(figsize=(12, 6))
        
        # Determine time axis
        duration = len(signal) / sr
        time = np.linspace(0, duration, len(signal))
        
        plt.plot(time, signal, label='Signal (Mic 0)', alpha=0.7)
        
        # Highlight segments
        for i, seg in enumerate(segments):
            start_t = seg['start_sample'] / sr
            end_t = seg['end_sample'] / sr
            plt.axvspan(start_t, end_t, color='green', alpha=0.3, label='Active' if i == 0 else "")
            
        plt.title('Active Audio Segments')
        plt.xlabel('Time (s)')
        plt.ylabel('Amplitude')
        plt.legend()
        plt.grid(True, alpha=0.3)
        
        output_path = os.path.join(self.output_dir, filename)
        plt.tight_layout()
        plt.savefig(output_path)
        plt.close()
        print(f"[Visualizer] Saved active segments plot to {output_path}")

    def plot_gcc_phat(self, cc, shift, mic_idx, segment_idx, filename=None):
        if filename is None:
            filename = f"gcc_phat_seg{segment_idx}_mic{mic_idx}.png"
            
        plt.figure(figsize=(10, 4))
        
        # X-axis centered around 0
        n = len(cc)
        max_shift = n // 2
        lags = np.arange(-max_shift, max_shift + 1)
        if len(lags) > len(cc):
            lags = lags[:len(cc)] # Handle potential off-by-one from concatenation logic
            
        plt.plot(lags, np.abs(cc))
        plt.axvline(shift, color='r', linestyle='--', label=f'Peak Delay: {shift}')
        
        plt.title(f'GCC-PHAT Cross-Correlation (Segment {segment_idx}, Mic {mic_idx})')
        plt.xlabel('Lag (samples)')
        plt.ylabel('Correlation Magnitude')
        plt.legend()
        plt.grid(True, alpha=0.3)
        
        output_path = os.path.join(self.output_dir, filename)
        plt.tight_layout()
        plt.savefig(output_path)
        plt.close()
        print(f"[Visualizer] Saved GCC-PHAT plot to {output_path}")

    def plot_location(self, mic_coords, estimated_pos, room_dims, segment_idx, filename=None):
        if filename is None:
            filename = f"location_seg{segment_idx}.png"
            
        plt.figure(figsize=(8, 8))
        
        # Plot Mics
        plt.scatter(mic_coords[:, 0], mic_coords[:, 1], c='blue', marker='s', s=100, label='Microphones')
        for i, (x, y) in enumerate(mic_coords):
            plt.text(x, y + 0.1, f'Mic {i}', ha='center')
            
        # Plot Estimated Position
        plt.scatter(estimated_pos[0], estimated_pos[1], c='red', marker='x', s=100, label='Estimated Source')
        
        plt.xlim(0, room_dims[0])
        plt.ylim(0, room_dims[1])
        plt.gca().set_aspect('equal', adjustable='box')
        
        plt.title(f'Estimated Source Location (Segment {segment_idx})')
        plt.xlabel('X (m)')
        plt.ylabel('Y (m)')
        plt.legend()
        plt.grid(True, alpha=0.3)
        
        output_path = os.path.join(self.output_dir, filename)
        plt.tight_layout()
        plt.savefig(output_path)
        plt.close()
        print(f"[Visualizer] Saved location plot to {output_path}")
