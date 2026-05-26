# Locustracer Skills & Runbook

This document provides instructions and standard operating procedures (SOPs) for interacting with the Locustracer codebase. Agents should reference this file before attempting to build, test, or run any component of the system.

## 1. System Architecture Overview

Before making changes, understand how data flows through the system:
1. **Nodes (Firmware)**: Listen to audio via I2S, sync clocks via Wi-Fi TSF, and blast UDP packets to the PC (Audio on Port `5006`, TSF heartbeats on Port `5005`). Nodes also run a local WebSocket client to talk to the Node.js backend.
2. **Buffer Server (C++)**: Listens on `5006`, buffers incoming audio, accounts for dropped packets by injecting silence (JitterBuffer), and forwards perfect streams to `5008`.
3. **API/Stream Server (Node.js)**: Listens on `5008` for the audio, tracks packet loss and jitter, handles REST/WebSocket telemetry from nodes, and broadcasts everything via WebSockets to the UI at ~60fps.
4. **UI (React)**: Connects to the Node.js server to visualize waveforms and control the system.

---

## 2. Firmware Commands

The firmware is managed using PlatformIO.

**Location**: `/home/lauala-unix/Projects/locustracer/firmware`

- **Build all environments**:
  ```bash
  pio run
  ```
- **Build a specific environment** (e.g., `lolin_s2_mini`):
  ```bash
  pio run -e lolin_s2_mini
  ```
- **Upload to a connected device**:
  ```bash
  pio run -e <env_name> -t upload
  ```
- **Monitor serial output**:
  ```bash
  pio device monitor -e <env_name>
  ```
  *(Note: Agents should not use `pio` commands directly, leave that to developers. Instead, ask developers to run these commands as needed.)*

---

## 3. C++ Server Commands

The C++ Server uses CMake for its build system.

**Location**: `/home/lauala-unix/Projects/locustracer/application/cpp_server`

- **Build the server**:
  ```bash
  mkdir -p build
  cd build
  cmake ..
  make
  ```
- **Run the server**:
  ```bash
  ./locustracer_server
  ```
  *(Note: The server listens on port 5006 and forwards to 5008. It must be running for the Node.js backend to receive audio).*

---

## 4. Web Application Commands

The Web Application consists of a Node.js backend and a React/Vite frontend.

### Backend

**Location**: `/home/lauala-unix/Projects/locustracer/application/monitor_app/backend`

- **Install dependencies**:
  ```bash
  npm install
  ```
- **Run the backend server**:
  ```bash
  npm start
  ```
  *(Or run `node server.js` directly. The server runs on port `8009` and listens for UDP on `5008`)*

### Frontend

**Location**: `/home/lauala-unix/Projects/locustracer/application/monitor_app/frontend`

- **Install dependencies**:
  ```bash
  npm install
  ```
- **Run the development server**:
  ```bash
  npm run dev
  ```
  *(The Vite dev server usually runs on port `5173`. Open this in a browser to view the UI.)*

---

## 5. Typical Development Workflow

If you are asked to "start the application" or "test the stack", follow this sequence in separate terminal panes or background tasks:
1. Start the C++ Server (`./locustracer_server`).
2. Start the Node.js Backend (`node server.js`).
3. Start the React Frontend (`npm run dev`).

---

## 6. Coding Standards & Best Practices

When contributing to this codebase, strict adherence to quality is expected:
- **Modularity**: Code must be separated into logical, bite-sized components. (e.g., separate files for individual hardware peripherals, separate React components for distinct UI elements).
- **Maintainability**: Write code that is easy for humans (and other agents) to read and upkeep. Comment complex logic, especially the TSF synchronization and JitterBuffer algorithms.
- **Best Practices**:
  - **Firmware**: Avoid blocking the FreeRTOS scheduler, handle memory properly, and use ESP-IDF logging frameworks.
  - **C++**: Utilize smart pointers, prevent memory leaks, and use lock-free or highly optimized concurrent structures where possible to handle the 60fps packet rates.
  - **Node.js/React**: Use functional components, avoid deeply nested callbacks, and ensure the event loop is never blocked so that WebSocket telemetry stays snappy.

---

## 7. Documentation Workflows

When the Documentation Agent is invoked at the end of a task, it MUST adhere to the following checklist:
1. **Inline Comments**: Ensure JSDoc/Doxygen comments are updated for any modified functions.
2. **Architecture Sync**: If a port number, WebSocket payload, or UDP packet structure is changed, update Section 1 of this file and the main `README.md`.
3. **Dependency Check**: If a new `npm` package or CMake library was added during the session, ensure it is documented in the respective component's `README.md`.
4. **No Placeholders**: Never commit generic placeholder text. Infer the technical details from the code diff.