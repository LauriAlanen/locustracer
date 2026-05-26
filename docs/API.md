# Locustracer API Documentation

This document describes the REST endpoints and WebSocket payloads used by the Locustracer system.

## HTTP Endpoints (Port 8009)

### `POST /telemetry`
**Description**: Receives telemetry data from a node. Note: Usually handled via WebSockets, but available over REST.
- **Request Body**:
  ```json
  {
    "temperature": 25.4,
    "humidity": 45.2,
    "cpu_temp": 50.1,
    "node_type": "master",
    "node_id": "DE:AD:BE:EF:00:11"
  }
  ```
- **Response**: `{"status": "success"}` (Note: The server overrides `node_id` with the connection IP for display).

### `GET /telemetry`
**Description**: Returns the latest telemetry states for all connected nodes and global system stats.
- **Response**:
  ```json
  {
    "master": {
      "192.168.1.10": { "temperature": 25.4, "humidity": 45.2, "cpu_temp": 48.0, "node_id": "192.168.1.10", "mac_address": "..." }
    },
    "listener": {
      "192.168.1.11": { "cpu_temp": 48.0, "node_id": "192.168.1.11", "mac_address": "..." }
    },
    "unknown": {},
    "system": {
      "tsf_variance_us": 12,
      "bandwidth_mbps": "1.45",
      "packet_loss": 0,
      "active_nodes": 2
    }
  }
  ```

### `GET /config`
**Description**: Retrieves the active configuration. Pass `?node_id=IP` to get a specific node's config.

### `POST /config`
**Description**: Updates the configuration for a specific node and pushes it via WebSockets.
- **Request Body**:
  ```json
  {
    "node_id": "192.168.1.10",
    "buzzer_state": false,
    "buzzer_volume": 50,
    "poll_interval_ms": 5000
  }
  ```

## WebSocket Payloads

### 1. ESP32 -> Node.js (`ws://.../ws`)
Used for bidirectional telemetry and configuration.

**Payload Sent to Node.js (Every 5s):**
```json
{
  "temperature": 24.5,
  "humidity": 50.1,
  "cpu_temp": 48.5,
  "node_id": "DE:AD:BE:EF:00:11",
  "node_type": "master"
}
```

**Payload Sent to ESP32 (On connect or config update):**
```json
{
  "buzzer_state": false,
  "buzzer_volume": 50,
  "poll_interval_ms": 5000,
  "buzzer_mode": "pitch", 
  "led_identify": true   
}
```
*Note: `buzzer_mode` and `led_identify` are optional transient event triggers.*

### 2. Node.js -> React UI (`ws://.../ui-ws`)
Broadcasted at ~60FPS for real-time visualization.
```json
{
  "audio": {
    "192.168.1.11": [1024, -512, 0]
  },
  "tsfs": {
    "192.168.1.11": 15
  }
}
```

### 3. React UI -> Node.js (`ws://.../ui-ws`)
Used to send commands from the UI to the nodes.

**Action: Beep**
```json
{
  "action": "beep",
  "node_id": "192.168.1.10",
  "mode": "pitch" 
}
```
*(Available modes: `pitch`, `chirp`, `fast_beeps`, `single_beep`, `siren`, `rumble`)*

**Action: Set Volume**
```json
{
  "action": "set_volume",
  "node_id": "192.168.1.10",
  "volume": 80
}
```

**Action: Identify**
```json
{
  "action": "identify",
  "node_id": "192.168.1.11"
}
```
