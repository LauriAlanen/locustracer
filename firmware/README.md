# Firmware README

This folder contains the PlatformIO project for the ESP32 and ESP32-S3 nodes in the Locustracer system.
The firmware is written in C using the ESP-IDF framework.

## Hardware Setup
The firmware supports multiple node configurations (Master vs. Listener) based on board definitions (`BOARD_LOLIN_S2_MINI`, `BOARD_ESP32_S3_DEVKITC_1`, etc.). See `include/pin_config.h` for specific pin definitions per board.

### General Mappings
- **I2S Microphone (ICS43434)** (Listener Nodes):
  - Requires `SCK`, `WS`, and `SD` pins. Captures audio at 48KHz, 24-bit.
- **SHTC3 Temp/Humidity Sensor** (Master Nodes):
  - Communicates over I2C (`SDA`, `SCL`). Address `0x70`.
- **Buzzer** (Master Nodes):
  - Driven by an LEDC PWM channel for audio feedback and effects.
- **Status LED**:
  - Used as a heartbeat indicator or a visual identifier (`led_identify`).

## FreeRTOS Tasks

The firmware operates on a multi-tasking architecture leveraging FreeRTOS to ensure real-time audio constraints:

1. **`i2s_mic_reader_task`**: (Priority 10)
   - Reads 256 samples from the I2S DMA buffer.
   - Grabs the raw WiFi TSF time and applies an Exponential Moving Average filter to smooth OS jitter while tracking crystal oscillator drift.
   - Pushes the audio frame to the transmitter.

2. **`audio_transmitter_task`**:
   - Sends the UDP `AudioPacket` (SeqID, TSF, 256 samples) to the C++ server on port `5006`.
   
3. **`api_client_task`**: (Priority 5)
   - Manages the WebSocket connection to the Node.js backend.
   - Gathers telemetry (Temperature, Humidity, CPU Temp, Mac Address) and sends it periodically.
   - Listens for incoming JSON commands (e.g., `buzzer_mode`, `buzzer_volume`, `led_identify`) and dispatches them to respective hardware modules.

4. **`tsf_sender_task`**:
   - Periodically broadcasts precise timing packets for time synchronization across the network.
