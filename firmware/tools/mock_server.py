from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from typing import List
import uvicorn
import json

app = FastAPI(
    title="Locus API Mock Server",
    description="A simple mock server for testing the ESP32 REST API Client."
)

# Define the expected JSON payload structure for telemetry


class TelemetryData(BaseModel):
    temperature: float
    humidity: float
    cpu_temp: float


class ConfigData(BaseModel):
    trigger_buzzer: bool
    poll_interval_ms: int


# Store the latest telemetry
latest_telemetry = None


@app.post("/telemetry")
def push_telemetry(data: TelemetryData):
    global latest_telemetry
    print(
        f"==== Received Telemetry ====\nTemp: {data.temperature}\nHum:  {data.humidity}\nCPU:  {data.cpu_temp}\n")
    # Save only the most recent entry
    latest_telemetry = data
    return {"status": "success"}


@app.get("/telemetry")
def get_telemetry():
    """
    Use this endpoint to see the most recent values pushed by the ESP32 node.
    """
    return latest_telemetry or {}


# Store the current config
current_config = {
    "trigger_buzzer": False,
    "poll_interval_ms": 5000
}


class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        # Send current config on connect
        await websocket.send_json(current_config)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast_config(self):
        for connection in self.active_connections:
            try:
                await connection.send_json(current_config)
            except Exception:
                pass


manager = ConnectionManager()


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    global latest_telemetry
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                telemetry = json.loads(data)
                if "temperature" in telemetry:
                    print(f"==== Received WS Telemetry ====\n{telemetry}\n")
                    latest_telemetry = telemetry
            except Exception:
                pass
    except WebSocketDisconnect:
        manager.disconnect(websocket)


@app.get("/config")
def pull_config():
    print(f"==== Sent Config ====\n{current_config}\n")
    return current_config


@app.post("/config")
async def push_config(data: ConfigData):
    """
    Use this endpoint to update the configuration that the ESP32 node pulls.
    """
    global current_config
    current_config = data.dict()
    print(f"==== Updated Config ====\n{current_config}\n")
    # Broadcast to all connected WebSockets immediately
    await manager.broadcast_config()
    return {"status": "success", "new_config": current_config}


if __name__ == "__main__":
    # Run on all interfaces on port 8009
    uvicorn.run(app, host="0.0.0.0", port=8009)
