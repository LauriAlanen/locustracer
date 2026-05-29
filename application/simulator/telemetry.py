import time
import random
import requests
from requests_toolbelt.adapters.source import SourceAddressAdapter
from config import MIC_IPS, BACKEND_URL

class TelemetrySimulator:
    def __init__(self):
        self.running = False

    def loop(self):
        self.running = True
        sessions = {}
        for ip in MIC_IPS:
            s = requests.Session()
            # Bind each session to the respective virtual loopback IP
            s.mount('http://', SourceAddressAdapter(ip))
            sessions[ip] = s

        print(f"Starting telemetry simulation to {BACKEND_URL}")

        while self.running:
            for i, ip in enumerate(MIC_IPS):
                data = {
                    "temperature": round(20.0 + random.uniform(0, 5), 1),
                    "humidity": round(40.0 + random.uniform(0, 10), 1),
                    "cpu_temp": round(45.0 + random.uniform(0, 10), 1),
                    "node_id": ip,
                    "node_type": "master" if i == 0 else "listener"
                }
                try:
                    sessions[ip].post(f"{BACKEND_URL}/telemetry", json=data, timeout=1)
                except Exception:
                    pass
            
            # Sleep 5 seconds in small increments to allow quick shutdown
            for _ in range(50):
                if not self.running:
                    break
                time.sleep(0.1)

        print("Telemetry simulation stopped.")

    def stop(self):
        self.running = False
