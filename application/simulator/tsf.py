import random
from config import FS, PACKET_SIZE

class TSFClock:
    def __init__(self, start_time=0):
        self.tsf_time = start_time

    def get_time_for_packet(self):
        current_time = self.tsf_time
        
        # Add ~200us jitter to simulate real Wi-Fi network variation
        jitter = random.randint(-200, 200)
        jittered_time = current_time + jitter
        
        # Advance the ideal clock by exactly 256 samples (5333 microseconds)
        self.tsf_time += int((PACKET_SIZE / FS) * 1e6)
        
        # Ensure it doesn't go negative just in case
        return max(0, jittered_time)
