import socket
import struct
import time
import numpy as np
from config import MIC_IPS, FS, PACKET_SIZE, TARGET_IP, TARGET_PORT
from tsf import TSFClock

class UDPStreamer:
    def __init__(self):
        self.running = False

    def stream_loop(self, signals):
        self.running = True
        sockets = []
        for ip in MIC_IPS:
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            sock.bind((ip, 0))
            sockets.append(sock)
            
        num_mics = len(MIC_IPS)
        num_samples = signals.shape[1]
        
        seq_ids = [0] * num_mics
        # Give each microphone its own clock (they might have slight offset in reality, here starting at 0)
        tsf_clocks = [TSFClock() for _ in range(num_mics)]
        sample_idx = 0
        
        max_val = np.max(np.abs(signals))
        if max_val > 0:
            signals = signals / max_val * (2**31 - 1) * 0.5
        signals_int32 = signals.astype(np.int32)
        
        start_real_time = time.time()
        total_packets_sent = 0
        
        print(f"Starting UDP streaming to {TARGET_IP}:{TARGET_PORT} from {MIC_IPS}")
        
        while self.running:
            if sample_idx + PACKET_SIZE > num_samples:
                sample_idx = 0
                
            for i in range(num_mics):
                audio_chunk = signals_int32[i, sample_idx : sample_idx + PACKET_SIZE]
                if len(audio_chunk) < PACKET_SIZE:
                    audio_chunk = np.pad(audio_chunk, (0, PACKET_SIZE - len(audio_chunk)))
                    
                current_tsf = tsf_clocks[i].get_time_for_packet()
                packet = struct.pack('<IQ256i', seq_ids[i], current_tsf, *audio_chunk)
                try:
                    sockets[i].sendto(packet, (TARGET_IP, TARGET_PORT))
                except Exception:
                    pass
                seq_ids[i] += 1
                
            sample_idx += PACKET_SIZE
            total_packets_sent += 1
            
            elapsed_real_time = time.time() - start_real_time
            expected_real_time = total_packets_sent * (PACKET_SIZE / FS)
            sleep_time = expected_real_time - elapsed_real_time
            if sleep_time > 0:
                time.sleep(sleep_time)

        for sock in sockets:
            sock.close()
        print("UDP streaming stopped.")

    def stop(self):
        self.running = False
