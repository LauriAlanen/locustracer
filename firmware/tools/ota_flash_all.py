import sys
import os
import http.client
import concurrent.futures

def upload_to_ip(ip, firmware_path):
    url = "/update"
    file_size = os.path.getsize(firmware_path)
    print(f"[{ip}] Connecting and starting upload ({file_size} bytes)...")
    
    try:
        # Increased timeout to 120s because OTA writing to flash is slow
        conn = http.client.HTTPConnection(ip, timeout=120)
        conn.putrequest("POST", url)
        conn.putheader("Content-Type", "application/octet-stream")
        conn.putheader("Content-Length", str(file_size))
        conn.endheaders()
        
        chunk_size = 16384
        uploaded = 0
        last_percent = -1
        
        with open(firmware_path, 'rb') as f:
            while True:
                chunk = f.read(chunk_size)
                if not chunk:
                    break
                conn.send(chunk)
                uploaded += len(chunk)
                
                percent = int((uploaded / file_size) * 100)
                # Print progress every 10% to keep verbosity manageable
                if percent % 10 == 0 and percent != last_percent:
                    print(f"[{ip}] Uploading: {percent}%")
                    last_percent = percent
                    
        print(f"[{ip}] Stream complete. Waiting for ESP32 to finish flashing and verify...")
        response = conn.getresponse()
        status = response.status
        body = response.read().decode('utf-8').strip()
        conn.close()
        
        if status == 200:
            print(f"[SUCCESS] {ip}: {body}")
            return True
        else:
            print(f"[FAILED] {ip}: HTTP {status} - {body}")
            return False
            
    except Exception as e:
        print(f"[ERROR] {ip}: {e}")
        return False

def main():
    if len(sys.argv) < 2:
        print("Usage: python ota_flash_all.py <firmware.bin>")
        sys.exit(1)

    firmware_path = sys.argv[1]
    if not os.path.exists(firmware_path):
        print(f"Error: Firmware file not found at {firmware_path}")
        sys.exit(1)

    ips_file = "ota_ips.txt"
    if not os.path.exists(ips_file):
        print(f"Error: '{ips_file}' not found in the current directory.")
        print("Please create it and add the IP addresses of your nodes, one per line.")
        sys.exit(1)

    ips = []
    with open(ips_file, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#'):
                ips.append(line)

    if not ips:
        print(f"Error: No valid IP addresses found in {ips_file}")
        sys.exit(1)

    print(f"Found {len(ips)} nodes to update. Initiating parallel OTA flash...")
    
    success_count = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=len(ips)) as executor:
        # Submit all tasks
        future_to_ip = {executor.submit(upload_to_ip, ip, firmware_path): ip for ip in ips}
        
        for future in concurrent.futures.as_completed(future_to_ip):
            ip = future_to_ip[future]
            try:
                if future.result():
                    success_count += 1
            except Exception as exc:
                print(f"[CRITICAL ERROR] {ip} generated an exception: {exc}")

    print("-" * 40)
    print(f"OTA Update Complete: {success_count}/{len(ips)} nodes successfully updated.")
    
    if success_count < len(ips):
        sys.exit(1)
    sys.exit(0)

if __name__ == "__main__":
    main()
