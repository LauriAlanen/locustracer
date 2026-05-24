import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import dgram from 'dgram';
import http from 'http';

const API_SERVER_URL = process.env.API_SERVER_URL || 'http://127.0.0.1:8009';
const UDP_PORT = 5008;
const HTTP_PORT = 8010;

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Node Data Buffer: IP -> [samples]
const nodeData = {};

// ----------------------------------------------------
// UDP Listener (Receives from cpp_server on 5008)
// ----------------------------------------------------
const udpServer = dgram.createSocket('udp4');

udpServer.on('error', (err) => {
    console.error(`UDP Server error:\n${err.stack}`);
    udpServer.close();
});

udpServer.on('message', (msg, rinfo) => {
    // Packet structure from cpp_server:
    // 16 bytes IP + 4 bytes seq + 8 bytes tsf + audio samples
    if (msg.length < 28) return;

    // Extract IP (Null terminated)
    const ipBytes = msg.subarray(0, 16);
    let ip = '';
    for (let i = 0; i < 16; i++) {
        if (ipBytes[i] === 0) break;
        ip += String.fromCharCode(ipBytes[i]);
    }

    // Extract samples (32-bit integers)
    const audioBytes = msg.subarray(28);
    const numSamples = Math.floor(audioBytes.length / 4);
    
    if (numSamples > 0) {
        if (!nodeData[ip]) {
            nodeData[ip] = [];
        }
        
        // Read 32-bit signed little-endian integers
        for (let i = 0; i < numSamples; i++) {
            const sample = audioBytes.readInt32LE(i * 4);
            nodeData[ip].push(sample);
        }

        // Keep buffer size to last 1500 samples
        if (nodeData[ip].length > 1500) {
            nodeData[ip] = nodeData[ip].slice(nodeData[ip].length - 1500);
        }
    }
});

udpServer.on('listening', () => {
    const address = udpServer.address();
    console.log(`Node.js UDP server listening on ${address.address}:${address.port}`);
});

udpServer.bind(UDP_PORT, '127.0.0.1');

// ----------------------------------------------------
// WebSocket Server
// ----------------------------------------------------
wss.on('connection', (ws) => {
    console.log('Client connected to WebSocket');

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            if (data.action === 'beep' && data.node_id) {
                console.log(`Relaying beep command for node ${data.node_id}`);
                // Fetch current config to avoid overwriting volume/settings with defaults
                let currentConfig = {};
                try {
                    const getResp = await fetch(`${API_SERVER_URL}/config?node_id=${data.node_id}`);
                    if (getResp.ok) currentConfig = await getResp.json();
                } catch (e) {
                    console.error("Failed to fetch current config", e);
                }

                const response = await fetch(`${API_SERVER_URL}/config`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ...currentConfig,
                        node_id: data.node_id,
                        buzzer_pitch: true
                    })
                });
                
                if (!response.ok) {
                    console.error('Failed to relay beep command', await response.text());
                }
            } else if (data.action === 'set_volume' && data.node_id && data.volume !== undefined) {
                console.log(`Relaying volume ${data.volume} command for node ${data.node_id}`);
                
                // Fetch current config
                let currentConfig = {};
                try {
                    const getResp = await fetch(`${API_SERVER_URL}/config?node_id=${data.node_id}`);
                    if (getResp.ok) currentConfig = await getResp.json();
                } catch (e) {
                    console.error("Failed to fetch current config", e);
                }

                const response = await fetch(`${API_SERVER_URL}/config`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ...currentConfig,
                        node_id: data.node_id,
                        buzzer_volume: parseInt(data.volume)
                    })
                });
                
                if (!response.ok) {
                    console.error('Failed to relay set_volume command', await response.text());
                }
            }
        } catch (error) {
            console.error('Failed to parse WS message or relay command:', error);
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
    });
});

// Broadcast loop at ~30FPS
setInterval(() => {
    if (wss.clients.size > 0) {
        const payload = JSON.stringify(nodeData);
        wss.clients.forEach(client => {
            if (client.readyState === 1) { // WebSocket.OPEN
                client.send(payload);
            }
        });
    }
}, 1000 / 30);


// ----------------------------------------------------
// Start Server
// ----------------------------------------------------
server.listen(HTTP_PORT, '0.0.0.0', () => {
    console.log(`Node.js WebSocket/HTTP Server running on port ${HTTP_PORT}`);
});
