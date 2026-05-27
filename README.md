# Locustracer

Locustracer is a Time Difference of Arrival (TDOA) acoustic tracking system. The project features a distributed hardware-software architecture designed to precisely synchronize audio streams across multiple devices and accurately estimate the location of acoustic sources.

## System Overview

Locustracer consists of several core components working in tandem:

```mermaid
flowchart LR
    subgraph ESP ["ESP32 Nodes (firmware/)"]
        direction TB
        Master["Master Node<br/>(TSF Sync)"] -. "Wi-Fi TSF" .-> Listener1["Listener Node 1"]
        Master -. "Wi-Fi TSF" .-> Listener2["Listener Node 2"]
    end

    subgraph Server ["C++ Server (application/cpp_server/)"]
        CPP["C++ UDP Server<br/>(JitterBuffer)"]
    end

    subgraph Monitor ["Monitor App (application/monitor_app/)"]
        NodeJS["Node.js Backend"]
        ReactUI["React Frontend"]
    end

    Listener1 == "UDP Packets<br/>Port 5006" ==> CPP
    Listener2 == "UDP Packets<br/>Port 5006" ==> CPP
    CPP == "Forwarding<br/>Port 5008" ==> NodeJS
    NodeJS == "WebSockets<br/>& HTTP" ==> ReactUI
```

- **Master/Listener ESP32 Nodes (`firmware/`)**: ESP32 microcontrollers that capture audio. A master node coordinates the synchronization via Wi-Fi Time Synchronization Function (TSF), while listener nodes transmit timestamped UDP audio packets.
- **C++ UDP Server (`application/cpp_server/`)**: A high-performance, real-time networking component. It implements a JitterBuffer that aligns incoming audio streams perfectly in time, intelligently injecting silence for any dropped packets to maintain phase alignment.
- **Monitor App (`application/monitor_app/`)**: A Node.js backend and React frontend. It provides a unified API and WebSocket stream server to visualize real-time telemetry, track system statistics (bandwidth, jitter, packet loss), and render high-speed audio waveforms and TSF drift.

For a comprehensive view of the system design, please see the [Architecture Overview](docs/ARCHITECTURE.md) and [API Documentation](docs/API.md). Hardware specifics and firmware configuration can be found in the [Firmware Directory](firmware/).

## Running the System

You can run the Locustracer software stack (C++ server, Node.js backend, and React frontend) either natively or via Docker.

### Running Natively

To start the system natively, run:

```bash
./locustracer.sh start
```

### Running via Docker

To start the system using Docker, run:

```bash
./locustracer.sh start --docker
```

### Stopping the System

To cleanly stop all running processes and Docker containers, run:

```bash
./locustracer.sh stop
```

This will run the `cpp_server`, Node.js backend, and frontend inside a single Docker container. The container is configured to use `network_mode: "host"`.

> [!IMPORTANT]
> **Note for Mac Users:** Because the Docker container relies on host networking (to ensure that the node IP addresses are correctly visible in the UI), Mac users **MUST** enable "Host Networking" in their Docker Desktop settings. This feature is supported in Docker Desktop version 4.31 and later. If you cannot enable this, you may need to stick to native execution.
>
> Linux and Windows (via WSL2 mirrored networking mode) support this out-of-the-box.

## Agentic Workflow

This project is actively maintained and evolved using an Agentic Workflow. Development tasks are delegated to specialized AI subagents, ensuring modularity, code quality, and accurate documentation.

If you are an agent or a human contributor, please familiarize yourself with the following guidelines before making changes:

- **[AGENTS.md](AGENTS.md)**: Defines the roles, responsibilities, and system prompts of the various specialized agents (Firmware Engineer, Systems Engineer, Web Developer, Documentation Agent) contributing to this project.
- **[SKILL.md](SKILL.md)**: Details the capabilities, development lifecycle, and workflow instructions for agents maintaining the codebase.

Following these documents ensures that updates, especially cross-domain handoffs (e.g., updating a UDP packet structure), are consistently documented and effectively communicated across the ecosystem.
