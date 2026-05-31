# Locustracer Frontend

This is the React-based frontend for the **Locustracer** monitoring application. It provides real-time visualization of high-frequency audio streams, system telemetry, and a high-fidelity 3D spatial map of the deployment environment.

## Key Features

- **Real-time Telemetry & Audio Visualization**: Displays live waveforms, system statistics (bandwidth, jitter, packet loss), and node states.
- **3D Room Visualization**: Uses React Three Fiber to render a scale model of the deployment room (Alfa Room). It visualizes sound sources, TDOA signals, and node positions dynamically.
- **Hardware Identification & Selection**: Features a Node Position Editor that allows users to map physical nodes to 3D virtual coordinates. When a node is selected in the UI, it pulses white in the 3D map, and the frontend repeatedly sends an `identify` WebSocket command to blink the physical node's LED, aiding in physical setup.
- **Simulation Control**: Toggle and configure the Python-based Digital Twin simulation directly from the UI.

## Development

This template is built with React + Vite.

### Running the Dev Server
```bash
npm install
npm run dev
```

### Building for Production
```bash
npm run build
```

---
*Note: This frontend connects to the unified Node.js backend (default port `8009`) via HTTP and WebSockets for telemetry and stream data.*
