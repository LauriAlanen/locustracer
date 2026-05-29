import os
import socket
import struct
import time
import threading
import numpy as np
import pyroomacoustics as pra
from flask import Flask, jsonify

app = Flask(__name__)

SIMULATION_RUNNING = False
SIMULATION_THREAD = None

# Config
FS = 48000
PACKET_SIZE = 256
TARGET_IP = os.environ.get("TARGET_IP", "127.0.0.1")
TARGET_PORT = int(os.environ.get("TARGET_PORT", 5006))
MIC_IPS = ['127.0.0.2', '127.0.0.3', '127.0.0.4', '127.0.0.5']
ROOM_DIM = [4.0, 3.5, 3.4]
# Using slightly offset corners at height 1.5m
MIC_LOCS = [
    [0.01, 0.01, 1.5],
    [3.99, 0.01, 1.5],
    [3.99, 3.49, 1.5],
    [0.01, 3.49, 1.5]
]

def generate_signals():
    # 1. Create a room
    room = pra.ShoeBox(ROOM_DIM, fs=FS, max_order=10)
    
    # 2. Add microphones
    mics = np.array(MIC_LOCS).T # Shape (2, 4)
    room.add_microphone_array(mics)
    
    # 3. Add a source (a stationary beep/noise)
    # 5 seconds of audio
    duration = 5.0
    n_samples = int(FS * duration)
    t = np.arange(n_samples) / FS
    
    # Generate a mix of sine wave (440Hz) and some noise
    signal = 0.5 * np.sin(2 * np.pi * 440 * t) + 0.1 * np.random.randn(n_samples)
    
    room.add_source([2.0, 1.75, 1.5], signal=signal)
    
    # 4. Simulate
    print("Simulating room acoustics (this might take a moment)...")
    room.simulate()
    print("Simulation complete.")
    
    # signals shape: (4, N)
    return room.mic_array.signals

def simulation_loop(signals):
    global SIMULATION_RUNNING
    
    # Sockets for each mic
    sockets = []
    for ip in MIC_IPS:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        # Bind to the specific loopback IP to fake different sources
        sock.bind((ip, 0))
        sockets.append(sock)
        
    num_mics = len(MIC_IPS)
    num_samples = signals.shape[1]
    
    seq_ids = [0] * num_mics
    tsf_time = 0
    sample_idx = 0
    
    # Convert float signals to int32 range for the packet
    max_val = np.max(np.abs(signals))
    if max_val > 0:
        signals = signals / max_val * (2**31 - 1) * 0.5 # 50% volume
    signals_int32 = signals.astype(np.int32)
    
    start_real_time = time.time()
    total_packets_sent = 0
    
    print(f"Starting UDP streaming to {TARGET_IP}:{TARGET_PORT} from {MIC_IPS}")
    
    while SIMULATION_RUNNING:
        if sample_idx + PACKET_SIZE > num_samples:
            sample_idx = 0
            
        for i in range(num_mics):
            audio_chunk = signals_int32[i, sample_idx : sample_idx + PACKET_SIZE]
            
            if len(audio_chunk) < PACKET_SIZE:
                audio_chunk = np.pad(audio_chunk, (0, PACKET_SIZE - len(audio_chunk)))
                
            # Pack format: Little-endian, uint32 seq_id, uint64 tsf_time, 256 * int32 audio
            packet = struct.pack('<IQ256i', seq_ids[i], tsf_time, *audio_chunk)
            
            try:
                sockets[i].sendto(packet, (TARGET_IP, TARGET_PORT))
            except Exception as e:
                pass # Ignore occasional send errors
            
            seq_ids[i] += 1
            
        # Update tsf_time (microseconds)
        tsf_time += int((PACKET_SIZE / FS) * 1e6)
        sample_idx += PACKET_SIZE
        total_packets_sent += 1
        
        # Sleep to maintain actual 48kHz streaming rate
        elapsed_real_time = time.time() - start_real_time
        expected_real_time = total_packets_sent * (PACKET_SIZE / FS)
        
        sleep_time = expected_real_time - elapsed_real_time
        if sleep_time > 0:
            time.sleep(sleep_time)

    for sock in sockets:
        sock.close()
    print("UDP streaming stopped.")

@app.route('/start', methods=['POST'])
def start_sim():
    global SIMULATION_RUNNING, SIMULATION_THREAD
    if SIMULATION_RUNNING:
        return jsonify({"status": "already running"})
    
    signals = generate_signals()
    SIMULATION_RUNNING = True
    SIMULATION_THREAD = threading.Thread(target=simulation_loop, args=(signals,))
    SIMULATION_THREAD.daemon = True
    SIMULATION_THREAD.start()
    
    return jsonify({"status": "started"})

@app.route('/stop', methods=['POST'])
def stop_sim():
    global SIMULATION_RUNNING, SIMULATION_THREAD
    if not SIMULATION_RUNNING:
        return jsonify({"status": "not running"})
        
    SIMULATION_RUNNING = False
    SIMULATION_THREAD.join()
    return jsonify({"status": "stopped"})

from flask import request

@app.route('/toggle', methods=['POST'])
def toggle_sim():
    data = request.get_json() or {}
    active = data.get("active", False)
    
    if active:
        return start_sim()
    else:
        return stop_sim()

@app.route('/status', methods=['GET'])
def status_sim():
    return jsonify({"status": "running" if SIMULATION_RUNNING else "stopped"})

if __name__ == '__main__':
    # When running in docker, exposing on 0.0.0.0 is needed
    port = int(os.environ.get("PORT", 8010))
    app.run(host='0.0.0.0', port=port)
