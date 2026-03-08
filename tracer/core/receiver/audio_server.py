import socket
import struct
import time
from collections import defaultdict

UDP_IP = "0.0.0.0"
# Port 5006 matches the ESP32 AUDIO_UDP_PORT
UDP_PORT = 5006

# Constants matching the C struct
# uint32_t sequence_id (4 bytes)
# uint64_t tsf_time    (8 bytes)
# int32_t audio_data[256] (1024 bytes)
# Total: 1036 bytes
EXPECTED_PACKET_SIZE = 1036
MAX_SAMPLES = 256

# Struct format string: '<' for little-endian, 'I' for uint32, 'Q' for uint64, '256i' for 256 int32s
PACKET_FORMAT = '<IQ256i'

# State tracking for reporting
# Structure: {ip_address: {"last_seq": int, "packets_rcv": int, "drops": int}}
node_stats = defaultdict(lambda: {"last_seq": None, "packets_rcv": 0, "drops": 0, "last_tsf": 0})

def main():
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.bind((UDP_IP, UDP_PORT))
    
    # We use a relatively large buffer as high-rate audio UDP can easily fill standard buffers
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_RCVBUF, 1024 * 1024)
    # Use non-blocking mode to keep stats ticking evenly
    sock.setblocking(False)

    print(f"[*] Audio Server listening for INMP441 UDP packets on {UDP_IP}:{UDP_PORT}...")
    print(f"[*] Expected packet size: {EXPECTED_PACKET_SIZE} bytes")
    
    last_print = time.time()
    
    while True:
        while True:
            try:
                data, addr = sock.recvfrom(2048)
                ip = addr[0]
                
                if len(data) != EXPECTED_PACKET_SIZE:
                    print(f"[!] Warning: Received bad packet length {len(data)} from {ip}")
                    continue
                    
                # Unpack the struct
                unpacked = struct.unpack(PACKET_FORMAT, data)
                seq_id = unpacked[0]
                tsf_time = unpacked[1]
                audio_samples = unpacked[2:] # Tuple of 256 integers
                
                # Update statistics
                stats = node_stats[ip]
                stats["packets_rcv"] += 1
                
                if stats["last_seq"] is not None:
                    diff = seq_id - stats["last_seq"]
                    if diff > 1:
                        # Packets were dropped
                        stats["drops"] += (diff - 1)
                        
                stats["last_seq"] = seq_id
                stats["last_tsf"] = tsf_time
                
                # At this point, depending on the application structure,
                # you would place `audio_samples` into a thread-safe Queue or ring buffer
                # grouped by `tsf_time` in order to synchronize the multi-channel streams.
                
            except BlockingIOError:
                break
                
        now = time.time()
        if now - last_print >= 1.0:
            # Print a neat dashboard once a second
            print("\n" + "="*50)
            print(f"Timestamp: {now:.2f}")
            for ip, stats in node_stats.items():
                print(f"Node {ip}:")
                print(f"  Packets Recv: {stats['packets_rcv']} (Total since start)")
                print(f"  Drops:        {stats['drops']}")
                print(f"  Current Seq:  {stats['last_seq']}")
                print(f"  Current TSF:  {stats['last_tsf']}")
                
                # Reset counters that make sense per-second if you want rate (optional)
                # But here we show lifetime totals for simplicity
            print("="*50)
            last_print = now
            
        time.sleep(0.001)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n[*] Shutting down audio server.")
