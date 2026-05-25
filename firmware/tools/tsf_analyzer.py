import socket
import struct
import time
import csv
import os
from collections import defaultdict

UDP_IP = "0.0.0.0"
UDP_PORT = 5005
CSV_FILENAME = "tsf_drift_log.csv"

# Minimum number of nodes required to calculate a delta
EXPECTED_NODES = 2

# Buffer to hold incoming packets by sequence ID
# Format: { sequence_id: { 'ip_address': tsf_value } }
packets_by_seq = defaultdict(dict)

# Baseline to zero-out the constant offset
baseline_offset = None

def main():
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.bind((UDP_IP, UDP_PORT))
    sock.setblocking(False)

    print(f"Listening for TSF UDP packets on {UDP_IP}:{UDP_PORT}...")

    # Initialize CSV file
    write_header = not os.path.exists(CSV_FILENAME)
    with open(CSV_FILENAME, mode='a', newline='') as f:
        writer = csv.writer(f)
        if write_header:
            writer.writerow(['PC_Local_Time', 'Sequence_ID', 'Node_A_IP', 'Node_A_TSF', 'Node_B_IP', 'Node_B_TSF', 'Relative_Drift_us'])
    
    last_print_time = time.time()
    
    while True:
        # Drain the socket buffer completely
        while True:
            try:
                data, addr = sock.recvfrom(1024)
                ip = addr[0]
                
                # The payload is now a 32-bit sequence_id followed by a 64-bit TSF time
                if len(data) == 12: # 4 bytes uint32 + 8 bytes uint64
                    seq_id, tsf_val = struct.unpack('<IQ', data)
                    packets_by_seq[seq_id][ip] = tsf_val
            except BlockingIOError:
                break # No more data available right now

        current_time = time.time()
        
        # Process and calculate drift continuously across our buffer
        if current_time - last_print_time >= 0.1:
            last_print_time = current_time
            
            # Find sequence IDs where we have reports from all expected nodes
            ready_seqs = [seq for seq, nodes in packets_by_seq.items() if len(nodes) >= EXPECTED_NODES]
            
            if ready_seqs:
                # Sort to process chronologically
                ready_seqs.sort()
                
                for seq in ready_seqs:
                    nodes = packets_by_seq[seq]
                    ips = list(nodes.keys())
                    ips.sort() # Guarantee that IP ordering is deterministic!
                    
                    node_a_ip = ips[0]
                    node_b_ip = ips[1]
                    
                    tsf_a = nodes[node_a_ip]
                    tsf_b = nodes[node_b_ip]
                    
                    # Calculate true synchronized delta in microseconds
                    raw_delta_us = int(tsf_b) - int(tsf_a)
                    
                    # Capture the initial offset as our baseline for plotting
                    global baseline_offset
                    if baseline_offset is None:
                        baseline_offset = raw_delta_us
                    
                    calibrated_delta_us = raw_delta_us - baseline_offset
                    
                    # Write to CSV
                    with open(CSV_FILENAME, mode='a', newline='') as f:
                        writer = csv.writer(f)
                        writer.writerow([current_time, seq, node_a_ip, tsf_a, node_b_ip, tsf_b, calibrated_delta_us])
                    
                    # Terminal Dashboard
                    print(f"[{current_time:.2f}] Seq: {seq:<6} | {node_a_ip}: {tsf_a:15} | {node_b_ip}: {tsf_b:15} | Drift: {calibrated_delta_us:+6} us")
                    
                    # Cleanup processed sequence
                    del packets_by_seq[seq]
                    
                # Grooming: clean up old stale sequences to prevent memory leak if packets drop
                max_seq = ready_seqs[-1]
                stale_seqs = [seq for seq in packets_by_seq.keys() if seq < max_seq - 10]
                for s in stale_seqs:
                    del packets_by_seq[s]
            else:
                print("Waiting for full node synchronization barrier...", end='\r')

        time.sleep(0.005) # Small sleep to prevent 100% CPU usage

if __name__ == "__main__":
    main()
