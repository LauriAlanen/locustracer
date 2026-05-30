import asyncio
import struct
import time
import socket
import json
import logging
import math
import random
import numpy as np
import pyroomacoustics as pra
from aiohttp import web
import websockets

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("DigitalTwin")

class DigitalTwinServer:
    def __init__(self):
        self.active = False
        self.sim_task = None
        self.telemetry_tasks = []
        
        # Room parameters
        self.fs = 48000
        self.room_dim = [4.0, 3.5]
        self.chunk_samples = 256
        self.chunk_duration = self.chunk_samples / self.fs
        
        # 4 microphones at the corners
        self.mics = np.array([
            [0.05, 3.95, 3.95, 0.05], # x
            [0.05, 0.05, 3.45, 3.45]  # y
        ])
        
        # Target node IPs
        self.node_ips = ['127.0.0.2', '127.0.0.3', '127.0.0.4', '127.0.0.5']
        
        # Set up 4 UDP sockets bound to specific local IPs
        self.udp_sockets = []
        for ip in self.node_ips:
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            try:
                sock.bind((ip, 0))
                self.udp_sockets.append(sock)
                logger.info(f"Bound UDP socket to {ip}")
            except Exception as e:
                logger.error(f"Failed to bind to {ip}: {e}")
                
        self.cpp_server_addr = ('127.0.0.1', 5006)
        self.ws_server_url = 'ws://127.0.0.1:8009/ws'
        self.seq_id = 0

        # Dynamic Configuration
        self.gain = 300000000.0
        self.noise_amplitude = 3000000.0
        self.max_jitter_us = 200
        self.source_speed = 2.0
        self.source_radius = 0.8

    async def handle_toggle(self, request):
        try:
            data = await request.json()
            new_active = data.get('active', False)
            
            if new_active and not self.active:
                self.active = True
                self.sim_task = asyncio.create_task(self.simulation_loop())
                self.start_telemetry()
                logger.info("Simulation activated")
            elif not new_active and self.active:
                self.active = False
                if self.sim_task:
                    self.sim_task.cancel()
                    self.sim_task = None
                self.stop_telemetry()
                logger.info("Simulation deactivated")
                
            return web.json_response({"status": "ok", "active": self.active})
        except Exception as e:
            logger.error(f"Error handling toggle: {e}")
            return web.json_response({"status": "error", "message": str(e)}, status=400)

    async def handle_get_config(self, request):
        return web.json_response({
            "gain": self.gain,
            "noise_amplitude": self.noise_amplitude,
            "max_jitter_us": self.max_jitter_us,
            "source_speed": self.source_speed,
            "source_radius": self.source_radius
        })

    async def handle_post_config(self, request):
        try:
            data = await request.json()
            if 'gain' in data:
                self.gain = float(data['gain'])
            if 'noise_amplitude' in data:
                self.noise_amplitude = float(data['noise_amplitude'])
            if 'max_jitter_us' in data:
                self.max_jitter_us = int(data['max_jitter_us'])
            if 'source_speed' in data:
                self.source_speed = float(data['source_speed'])
            if 'source_radius' in data:
                self.source_radius = float(data['source_radius'])
            return web.json_response({"status": "ok"})
        except Exception as e:
            logger.error(f"Error handling config update: {e}")
            return web.json_response({"status": "error", "message": str(e)}, status=400)

    def start_telemetry(self):
        for ip in self.node_ips:
            task = asyncio.create_task(self.telemetry_loop(ip))
            self.telemetry_tasks.append(task)

    def stop_telemetry(self):
        for task in self.telemetry_tasks:
            task.cancel()
        self.telemetry_tasks = []

    async def telemetry_loop(self, local_ip):
        while self.active:
            try:
                # Bind local address for websocket connection
                async with websockets.connect(self.ws_server_url, local_addr=(local_ip, 0)) as ws:
                    logger.info(f"Connected to WS server from {local_ip}")
                    while self.active:
                        payload = {
                            "node_type": "listener",
                            "cpu_temp": 40.0
                        }
                        await ws.send(json.dumps(payload))
                        await asyncio.sleep(5)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"WS telemetry error for {local_ip}: {e}")
                await asyncio.sleep(2) # retry delay

    async def simulation_loop(self):
        t_sim = 0.0
        center = [2.0, 1.75]
        
        while self.active:
            loop_start = time.time()
            
            # 1. Update source position
            src_x = center[0] + self.source_radius * math.cos(self.source_speed * t_sim)
            src_y = center[1] + self.source_radius * math.sin(self.source_speed * t_sim)
            
            # 2. Setup room for this chunk
            room = pra.ShoeBox(self.room_dim, fs=self.fs, max_order=2, materials=pra.Material(0.2))
            room.add_microphone_array(self.mics)
            
            # 3. Generate audio chunk
            t_chunk = np.arange(self.chunk_samples) / self.fs + t_sim
            chunk_signal = np.sin(2 * np.pi * 440 * t_chunk) * (0.5 + 0.5 * np.sin(2 * np.pi * 10 * t_chunk))
            
            # Make sure to scale it up so it's visible as int32
            # Increase scaling to ~300,000,000 so the UI dBFS calculates around 60dB
            chunk_signal = chunk_signal * self.gain
            
            room.add_source([src_x, src_y], signal=chunk_signal)
            
            # 4. Simulate
            try:
                room.simulate()
            except Exception as e:
                logger.error(f"Simulation error: {e}")
                await asyncio.sleep(0.01)
                continue
                
            sim_out = room.mic_array.signals
            
            out_chunk = np.zeros((4, self.chunk_samples), dtype=np.int32)
            valid_len = min(self.chunk_samples, sim_out.shape[1])
            out_chunk[:, :valid_len] = sim_out[:, :valid_len].astype(np.int32)
            
            # Inject realistic independent microphone self-noise (approx -40dB relative to the 300M signal peak)
            noise = np.random.uniform(-self.noise_amplitude, self.noise_amplitude, out_chunk.shape)
            out_chunk = np.clip(out_chunk + noise, -2147483648, 2147483647).astype(np.int32)
            
            # 5. Pack and send UDP packets
            ideal_tsf = int(self.seq_id * (256 * 1_000_000 / self.fs))
            
            for i, sock in enumerate(self.udp_sockets):
                # Calculate independent jitter for each mock hardware clock
                jitter = random.randint(-self.max_jitter_us, self.max_jitter_us)
                tsf_time = max(0, ideal_tsf + jitter)
                
                samples = out_chunk[i].tolist()
                packet = struct.pack(f'<IQ{self.chunk_samples}i', self.seq_id, tsf_time, *samples)
                try:
                    sock.sendto(packet, self.cpp_server_addr)
                except Exception as e:
                    logger.error(f"UDP send error on {self.node_ips[i]}: {e}")
                    
            self.seq_id += 1
            t_sim += self.chunk_duration
            
            # Pace it to real-time
            elapsed = time.time() - loop_start
            sleep_time = self.chunk_duration - elapsed
            if sleep_time > 0:
                await asyncio.sleep(sleep_time)
            else:
                await asyncio.sleep(0) # yield control

if __name__ == '__main__':
    server = DigitalTwinServer()
    app = web.Application()
    app.router.add_post('/toggle', server.handle_toggle)
    app.router.add_get('/config', server.handle_get_config)
    app.router.add_post('/config', server.handle_post_config)
    web.run_app(app, port=8010)
