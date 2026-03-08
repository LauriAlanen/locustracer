import socket
import struct
import threading
import time
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.animation as animation

# --- CONFIGURATION ---
UDP_IP = "0.0.0.0"
UDP_PORT = 5006
EXPECTED_PACKET_SIZE = 1036
PACKET_FORMAT = '<IQ256i'
SAMPLES_PER_PACKET = 256
SAMPLE_RATE = 48000
BUFFER_DURATION_SEC = 1.0  # Show 1 second of audio History
BUFFER_SIZE = int(SAMPLE_RATE * BUFFER_DURATION_SEC)
REFRESH_RATE_MS = 30  # ~33 FPS

# --- GLOBALS & STATE ---
# Dictionary to hold circular buffers for each IP: { "ip": np.array(BUFFER_SIZE) }
audio_buffers = {}
# Dictionary to track the write index for each circular buffer
buffer_indices = {}
# Lock for thread-safe access to the buffer
data_lock = threading.Lock()

# Matplotlib objects
fig = None
axs = {}
lines = {}


def udp_listener_thread():
    """Background thread to receive UDP packets and populate numpy circular buffers."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.bind((UDP_IP, UDP_PORT))
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_RCVBUF, 1024 * 1024)
    # blocking is fine for a dedicated background thread, reduces CPU load vs spinloop
    
    print(f"[*] Background UDP Listener Thread started on {UDP_IP}:{UDP_PORT}")
    
    while True:
        try:
            data, addr = sock.recvfrom(2048)
            ip = addr[0]
            
            if len(data) != EXPECTED_PACKET_SIZE:
                continue
                
            unpacked = struct.unpack(PACKET_FORMAT, data)
            audio_samples = np.array(unpacked[2:], dtype=np.int32)
            
            # Since the data is in the MSB of a 32-bit word, divide to normalize
            # the raw 24-bit representation to something more manageable, or just plot as is.
            # Let's shift it so it represents actual 24-bit bounds (-8388608 to 8388607)
            # ESP32 left-aligns 24-bit data into 32-bit slot, so shift right by 8
            audio_samples = audio_samples >> 8
            
            with data_lock:
                if ip not in audio_buffers:
                    # Initialize a new buffer for this IP
                    audio_buffers[ip] = np.zeros(BUFFER_SIZE, dtype=np.int32)
                    buffer_indices[ip] = 0
                    print(f"[*] Discovered new node: {ip}")
                    
                # Insert the chunk into the circular buffer
                idx = buffer_indices[ip]
                space_left = BUFFER_SIZE - idx
                
                if SAMPLES_PER_PACKET <= space_left:
                    # Normal insert
                    audio_buffers[ip][idx:idx+SAMPLES_PER_PACKET] = audio_samples
                    buffer_indices[ip] = (idx + SAMPLES_PER_PACKET) % BUFFER_SIZE
                else:
                    # Wrap around insert
                    audio_buffers[ip][idx:BUFFER_SIZE] = audio_samples[:space_left]
                    audio_buffers[ip][0:SAMPLES_PER_PACKET-space_left] = audio_samples[space_left:]
                    buffer_indices[ip] = SAMPLES_PER_PACKET - space_left
                    
        except Exception as e:
            print(f"[!] UDP thread error: {e}")
            break


def animate(frame):
    """Matplotlib animation callback called every REFRESH_RATE_MS."""
    global fig, axs, lines
    
    with data_lock:
        active_ips = list(audio_buffers.keys())
        
        # If new IPs appeared, we need to rebuild the subplots
        if len(active_ips) != len(axs) and len(active_ips) > 0:
            fig.clf() # Clear current figure
            # Create N subplots
            fig, ax_list = plt.subplots(len(active_ips), 1, num=fig.number, squeeze=False)
            ax_list = ax_list.flatten()
            
            axs.clear()
            lines.clear()
            
            for i, ip_addr in enumerate(active_ips):
                ax = ax_list[i]
                axs[ip_addr] = ax
                
                # We'll rely on dynamic Y-limits during update 
                # ax.set_ylim(-8388608, 8388608) 
                ax.set_xlim(0, BUFFER_SIZE)
                ax.set_title(f"ESP32 Node: {ip_addr}")
                ax.set_ylabel("Amplitude")
                ax.grid(True, alpha=0.3)
                
                # Create empty line
                line, = ax.plot(np.zeros(BUFFER_SIZE), color='#00d2ff', lw=0.8)
                lines[ip_addr] = line
                
            fig.tight_layout()
            
        # Update data for all existing lines
        for ip_addr in active_ips:
            if ip_addr in lines:
                # We want to unroll the circular buffer to display it chronologically
                # from oldest to newest
                idx = buffer_indices[ip_addr]
                buffer_data = audio_buffers[ip_addr]
                
                # Reorder so newest data is on the right
                chronological_data = np.concatenate((buffer_data[idx:], buffer_data[:idx]))
                lines[ip_addr].set_ydata(chronological_data)
                
                # Dynamic Y-axis scaling
                current_max = np.max(np.abs(chronological_data))
                # Add a minimum threshold so it doesn't zoom in infinitely on the noise floor
                envelope = max(current_max * 1.2, 50000) 
                axs[ip_addr].set_ylim(-envelope, envelope)

    # Return the updated artists
    return list(lines.values())


def main():
    global fig
    
    print("[*] Starting Live Audio Plotter...")
    
    # Start background UDP listener
    listener = threading.Thread(target=udp_listener_thread, daemon=True)
    listener.start()
    
    # Wait briefly to let background thread discover initial nodes before plotting
    print("[*] Listening for 2 seconds to discover nodes before launching GUI...")
    time.sleep(2)
    
    # Initialize Matplotlib Figure
    # We use a dark background style for a nicer aesthetic
    plt.style.use('dark_background')
    fig = plt.figure(figsize=(12, 6))
    
    ani = animation.FuncAnimation(
        fig, 
        animate, 
        interval=REFRESH_RATE_MS,
        cache_frame_data=False,
        blit=False # Disable blitting since we dynamically change axes
    )
    
    print("[*] Launching Graphical Interface...")
    plt.show() # This blocks the main thread


if __name__ == "__main__":
    main()
