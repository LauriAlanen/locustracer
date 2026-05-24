from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import uvicorn
import json

app = FastAPI(
    title="Locustracer API Server",
    description="Backend API and Websocket server for Locustracer."
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Define the expected JSON payload structure for telemetry


class TelemetryData(BaseModel):
    node_id: str = "unknown"
    node_type: str = "unknown"
    temperature: Optional[float] = None
    humidity: Optional[float] = None
    cpu_temp: Optional[float] = None


class ConfigData(BaseModel):
    node_id: str
    buzzer_state: bool = False
    buzzer_pitch: bool = False
    buzzer_volume: int = 1
    poll_interval_ms: int = 5000


# Store the latest telemetry categorized by node type
latest_telemetry: dict = {
    "master": {},
    "listener": {},
    "unknown": {}
}


@app.post("/telemetry")
def push_telemetry(data: TelemetryData):
    global latest_telemetry
    node_id = data.node_id
    node_type = data.node_type
    
    # Ensure category exists
    if node_type not in latest_telemetry:
        latest_telemetry[node_type] = {}
        
    print(
        f"==== Received {node_type} Telemetry from {node_id} ====\nTemp: {data.temperature}\nHum:  {data.humidity}\nCPU:  {data.cpu_temp}\n")
    # Save only the most recent entry per node
    latest_telemetry[node_type][node_id] = data
    return {"status": "success"}


@app.get("/telemetry")
def get_telemetry():
    """
    Use this endpoint to see the most recent values pushed by the ESP32 nodes.
    """
    return latest_telemetry


# Store the current config per node
current_configs: dict = {}
default_config = {
    "buzzer_state": False,
    "buzzer_pitch": False,
    "buzzer_volume": 1,
    "poll_interval_ms": 5000
}


class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket):
        await websocket.accept()

    async def register_node(self, websocket: WebSocket, node_id: str):
        # Register the websocket under the specific node_id
        self.active_connections[node_id] = websocket
        # Send current config on registration
        config = current_configs.get(node_id, default_config)
        try:
            await websocket.send_json(config)
        except Exception:
            pass

    def disconnect(self, websocket: WebSocket):
        for node_id, conn in list(self.active_connections.items()):
            if conn == websocket:
                del self.active_connections[node_id]

    async def send_config_to_node(self, node_id: str, config: dict):
        if node_id in self.active_connections:
            try:
                await self.active_connections[node_id].send_json(config)
            except Exception:
                pass


manager = ConnectionManager()


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    global latest_telemetry
    await manager.connect(websocket)
    registered = False
    try:
        while True:
            data = await websocket.receive_text()
            try:
                telemetry = json.loads(data)
                node_id = telemetry.get("node_id", "unknown")
                node_type = telemetry.get("node_type", "unknown")
                
                if not registered:
                    await manager.register_node(websocket, node_id)
                    registered = True
                
                if node_type not in latest_telemetry:
                    latest_telemetry[node_type] = {}
                    
                if "temperature" in telemetry or "cpu_temp" in telemetry:
                    print(f"==== Received WS {node_type} Telemetry from {node_id} ====\n{telemetry}\n")
                    latest_telemetry[node_type][node_id] = telemetry
            except Exception:
                pass
    except WebSocketDisconnect:
        manager.disconnect(websocket)


@app.get("/config")
def pull_config(node_id: Optional[str] = None):
    if node_id:
        config = current_configs.get(node_id, default_config)
        print(f"==== Sent Config for {node_id} ====\n{config}\n")
        return config
    print(f"==== Sent All Configs ====\n{current_configs}\n")
    return current_configs


@app.post("/config")
async def push_config(data: ConfigData):
    """
    Use this endpoint to update the configuration that the ESP32 node pulls.
    """
    global current_configs
    node_id = data.node_id
    config_dict = data.dict(exclude={"node_id"})
    
    # Store config but DO NOT persist 'buzzer_pitch' as True for future reconnects.
    stored_config = dict(config_dict)
    stored_config["buzzer_pitch"] = False
    current_configs[node_id] = stored_config
    
    print(f"==== Updated Config for {node_id} ====\n{config_dict}\n")
    # Send the original requested config (which may contain buzzer_pitch: True) to the specific connected WebSocket immediately
    await manager.send_config_to_node(node_id, config_dict)
    return {"status": "success", "node_id": node_id, "new_config": stored_config}


if __name__ == "__main__":
    # Run on all interfaces on port 8009
    uvicorn.run(app, host="0.0.0.0", port=8009)
