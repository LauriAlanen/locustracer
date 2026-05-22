from fastapi import FastAPI
from pydantic import BaseModel
import uvicorn

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

@app.get("/config")
def pull_config():
    print(f"==== Sent Config ====\n{current_config}\n")
    return current_config

@app.post("/config")
def push_config(data: ConfigData):
    """
    Use this endpoint to update the configuration that the ESP32 node pulls.
    """
    global current_config
    current_config = data.dict()
    print(f"==== Updated Config ====\n{current_config}\n")
    return {"status": "success", "new_config": current_config}


if __name__ == "__main__":
    # Run on all interfaces on port 8009
    uvicorn.run(app, host="0.0.0.0", port=8009)
