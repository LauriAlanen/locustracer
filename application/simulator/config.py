import os

# Server config
TARGET_IP = os.environ.get("TARGET_IP", "127.0.0.1")
TARGET_PORT = int(os.environ.get("TARGET_PORT", 5006))
PORT = int(os.environ.get("PORT", 8010))
BACKEND_URL = os.environ.get("BACKEND_URL", "http://127.0.0.1:8009")

# Audio config
FS = 48000
PACKET_SIZE = 256

# Room config
ROOM_DIM = [4.0, 3.5, 3.4]
SOURCE_LOC = [2.0, 1.75, 1.5]
SOURCE_FREQ = 440
DURATION = 5.0

# Microphone config
MIC_IPS = ['127.0.0.2', '127.0.0.3', '127.0.0.4', '127.0.0.5']
MIC_LOCS = [
    [0.01, 0.01, 1.5],
    [3.99, 0.01, 1.5],
    [3.99, 3.49, 1.5],
    [0.01, 3.49, 1.5]
]
