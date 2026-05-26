# Welcome to Locustracer Documentation

This is the central documentation hub for the **Locustracer** acoustic tracking system. This system is designed for high-frequency audio capture and real-time visualization, utilizing ESP32 firmware, a C++ processing server, and a Node.js/React full-stack application.

## Documentation Structure

Here you will find detailed information about the system's inner workings, data flow, and interfaces:

* [**Architecture Overview** (`ARCHITECTURE.md`)](ARCHITECTURE.md)  
  Explains the Master/Listener node topology and details the data flow across the system. It covers the high-frequency UDP audio path, the WebSocket telemetry flow, and provides sequence diagrams for Time Synchronization Function (TSF) and audio transmission.

* [**API Reference** (`API.md`)](API.md)  
  Describes the REST HTTP endpoints and WebSocket payloads used by the Locustracer system. This includes schemas for bidirectional telemetry, configuration updates, and the real-time ~60FPS data broadcasted to the React UI.

## Getting Started

This documentation site is automatically deployed via GitHub Actions whenever changes are pushed to the main branch. 

To edit this documentation:
1. Edit the markdown files inside the `docs/` directory.
2. Commit and push your changes.
3. The GitHub Action will automatically build and publish your updates to GitHub Pages!
