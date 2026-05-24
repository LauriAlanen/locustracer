import asyncio
import struct
import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from contextlib import asynccontextmanager
import json
import copy
import urllib.request


@asynccontextmanager
async def lifespan(app: FastAPI):
    loop = asyncio.get_running_loop()
    # Start UDP Server
    transport, protocol = await loop.create_datagram_endpoint(
        lambda: UDPProtocol(),
        local_addr=('127.0.0.1', 5008)
    )
    print("Python UDP Monitor listening on 127.0.0.1:5008")

    # Start broadcast loop
    task = asyncio.create_task(broadcast_loop())
    
    yield
    
    # Cleanup
    task.cancel()
    transport.close()

app = FastAPI(lifespan=lifespan)

# Mount static files
app.mount("/static", StaticFiles(directory="tools/static"), name="static")

# Store the latest audio samples for each node
# Format: {"192.168.3.10": [sample1, sample2, ...], ...}
node_data = {}
# Lock for thread-safe access to node_data if needed, but asyncio handles this in single thread.


class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception:
                pass


manager = ConnectionManager()


class UDPProtocol(asyncio.DatagramProtocol):
    def datagram_received(self, data, addr):
        # 16 bytes IP + 4 bytes seq + 8 bytes tsf + up to 256*4 bytes audio
        if len(data) < 28:
            return

        # Extract IP address
        ip_bytes = data[:16]
        ip_str = ip_bytes.split(b'\x00')[0].decode('utf-8')

        # Extract metadata
        seq_id, tsf_time = struct.unpack('<I Q', data[16:28])

        # Extract audio payload
        audio_data_bytes = data[28:]
        num_samples = len(audio_data_bytes) // 4
        if num_samples > 0:
            format_str = f'<{num_samples}i'
            samples = struct.unpack(format_str, audio_data_bytes)

            if ip_str not in node_data:
                node_data[ip_str] = []

            # Keep the last 1500 samples for visualization
            node_data[ip_str].extend(samples)
            if len(node_data[ip_str]) > 1500:
                node_data[ip_str] = node_data[ip_str][-1500:]


@app.get("/")
async def get():
    with open("tools/static/index.html") as f:
        return HTMLResponse(f.read())


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                payload = json.loads(data)
                if payload.get("action") == "beep":
                    node_id = payload.get("node_id", "master")
                    def relay_beep():
                        url = "http://127.0.0.1:8009/config"
                        req_data = json.dumps({
                            "node_id": node_id,
                            "buzzer_pitch": True
                        }).encode('utf-8')
                        req = urllib.request.Request(url, data=req_data, headers={'Content-Type': 'application/json'})
                        try:
                            urllib.request.urlopen(req, timeout=2)
                        except Exception as e:
                            print(f"Failed to relay beep: {e}")
                    await asyncio.to_thread(relay_beep)
            except Exception as e:
                pass
    except WebSocketDisconnect:
        manager.disconnect(websocket)


async def broadcast_loop():
    while True:
        await asyncio.sleep(1/30)  # ~30 FPS broadcast
        if manager.active_connections:
            # Send current snapshot of node data
            payload = json.dumps(node_data)
            await manager.broadcast(payload)




if __name__ == "__main__":
    uvicorn.run("monitor_server:app", host="0.0.0.0",
                port=8010, reload=True, reload_dirs=["tools"])

