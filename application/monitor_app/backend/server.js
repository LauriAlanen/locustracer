import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import dgram from 'dgram';
import http from 'http';
import { URL } from 'url';

const UDP_PORT = 5008;
const HTTP_PORT = 8009; // Consolidated port

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

// ----------------------------------------------------
// State Management (Replaces api_server.py globals)
// ----------------------------------------------------

// Node Data Buffer: IP -> [samples]
const nodeData = {};

// Telemetry State
const latestTelemetry = {
    master: {},
    listener: {},
    unknown: {}
};

// Config State
const currentConfigs = {};
const defaultConfig = {
    buzzer_state: false,
    buzzer_pitch: false,
    buzzer_volume: 1,
    poll_interval_ms: 5000
};

// ESP32 Active WebSocket Connections: node_id -> ws
const esp32Connections = new Map();

// UI WebSocket Connections: Set<ws>
const uiConnections = new Set();

// ----------------------------------------------------
// Express REST Endpoints
// ----------------------------------------------------

app.post('/telemetry', (req, res) => {
    const data = req.body;
    const nodeId = data.node_id || 'unknown';
    const nodeType = data.node_type || 'unknown';

    if (!latestTelemetry[nodeType]) {
        latestTelemetry[nodeType] = {};
    }

    console.log(`==== Received ${nodeType} Telemetry from ${nodeId} ====
Temp: ${data.temperature}
Hum:  ${data.humidity}
CPU:  ${data.cpu_temp}
`);

    latestTelemetry[nodeType][nodeId] = data;
    res.json({ status: 'success' });
});

app.get('/telemetry', (req, res) => {
    res.json(latestTelemetry);
});

app.get('/config', (req, res) => {
    const nodeId = req.query.node_id;
    if (nodeId) {
        const config = currentConfigs[nodeId] || { ...defaultConfig };
        console.log(`==== Sent Config for ${nodeId} ====\n${JSON.stringify(config)}\n`);
        return res.json(config);
    }
    console.log(`==== Sent All Configs ====\n${JSON.stringify(currentConfigs)}\n`);
    res.json(currentConfigs);
});

app.post('/config', (req, res) => {
    const data = req.body;
    const nodeId = data.node_id;
    if (!nodeId) return res.status(400).json({ error: "node_id is required" });

    // Pydantic-like default handling
    const newConfig = {
        buzzer_state: data.buzzer_state !== undefined ? data.buzzer_state : false,
        buzzer_pitch: data.buzzer_pitch !== undefined ? data.buzzer_pitch : false,
        buzzer_volume: data.buzzer_volume !== undefined ? data.buzzer_volume : 1,
        poll_interval_ms: data.poll_interval_ms !== undefined ? data.poll_interval_ms : 5000
    };

    // Store config but DO NOT persist 'buzzer_pitch' as true for future reconnects.
    const storedConfig = { ...newConfig, buzzer_pitch: false };
    currentConfigs[nodeId] = storedConfig;

    console.log(`==== Updated Config for ${nodeId} ====\n${JSON.stringify(newConfig)}\n`);
    
    // Push immediately to ESP32 WebSocket
    const ws = esp32Connections.get(nodeId);
    if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify(newConfig));
    }

    res.json({ status: 'success', node_id: nodeId, new_config: storedConfig });
});


// ----------------------------------------------------
// UDP Listener (Receives from cpp_server on 5008)
// ----------------------------------------------------
const udpServer = dgram.createSocket('udp4');

udpServer.on('error', (err) => {
    console.error(`UDP Server error:\n${err.stack}`);
    udpServer.close();
});

udpServer.on('message', (msg, rinfo) => {
    if (msg.length < 28) return;

    const ipBytes = msg.subarray(0, 16);
    let ip = '';
    for (let i = 0; i < 16; i++) {
        if (ipBytes[i] === 0) break;
        ip += String.fromCharCode(ipBytes[i]);
    }

    const audioBytes = msg.subarray(28);
    const numSamples = Math.floor(audioBytes.length / 4);
    
    if (numSamples > 0) {
        if (!nodeData[ip]) nodeData[ip] = [];
        
        for (let i = 0; i < numSamples; i++) {
            const sample = audioBytes.readInt32LE(i * 4);
            nodeData[ip].push(sample);
        }

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
// WebSocket Upgrade Handler (Routing)
// ----------------------------------------------------

server.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;

    if (pathname === '/ws') {
        // ESP32 Websocket
        wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit('connection', ws, request, 'esp32');
        });
    } else if (pathname === '/ui-ws') {
        // React UI Websocket
        wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit('connection', ws, request, 'ui');
        });
    } else {
        socket.destroy();
    }
});


wss.on('connection', (ws, request, type) => {
    if (type === 'esp32') {
        let assignedNodeId = null;
        
        ws.on('message', (message) => {
            try {
                const telemetry = JSON.parse(message);
                const nodeId = telemetry.node_id || 'unknown';
                const nodeType = telemetry.node_type || 'unknown';
                
                if (!assignedNodeId) {
                    assignedNodeId = nodeId;
                    esp32Connections.set(nodeId, ws);
                    // Send initial config
                    const config = currentConfigs[nodeId] || { ...defaultConfig };
                    ws.send(JSON.stringify(config));
                }
                
                if (!latestTelemetry[nodeType]) {
                    latestTelemetry[nodeType] = {};
                }
                
                if (telemetry.temperature !== undefined || telemetry.cpu_temp !== undefined) {
                    console.log(`==== Received WS ${nodeType} Telemetry from ${nodeId} ====`);
                    latestTelemetry[nodeType][nodeId] = telemetry;
                }
            } catch (error) {
                // Ignore parse errors
            }
        });

        ws.on('close', () => {
            if (assignedNodeId) {
                esp32Connections.delete(assignedNodeId);
            }
        });

    } else if (type === 'ui') {
        console.log('React UI connected to WebSocket');
        uiConnections.add(ws);

        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message);
                const nodeId = data.node_id;
                if (!nodeId) return;

                // Handle commands natively instead of making HTTP requests!
                const currentConfig = currentConfigs[nodeId] || { ...defaultConfig };

                if (data.action === 'beep') {
                    console.log(`UI requested Beep for ${nodeId}`);
                    // Push beep command to ESP32
                    const newConfig = { ...currentConfig, buzzer_pitch: true };
                    
                    const espWs = esp32Connections.get(nodeId);
                    if (espWs && espWs.readyState === 1) {
                        espWs.send(JSON.stringify(newConfig));
                    }
                } 
                else if (data.action === 'set_volume' && data.volume !== undefined) {
                    console.log(`UI requested Volume ${data.volume} for ${nodeId}`);
                    // Persist new volume
                    currentConfig.buzzer_volume = parseInt(data.volume);
                    currentConfigs[nodeId] = currentConfig;
                    
                    const newConfig = { ...currentConfig, buzzer_pitch: false };
                    
                    const espWs = esp32Connections.get(nodeId);
                    if (espWs && espWs.readyState === 1) {
                        espWs.send(JSON.stringify(newConfig));
                    }
                }
            } catch (error) {
                console.error('Failed to parse UI WS message:', error);
            }
        });

        ws.on('close', () => {
            uiConnections.delete(ws);
            console.log('React UI disconnected');
        });
    }
});

// Broadcast UDP Audio to UI loops at ~30FPS
setInterval(() => {
    if (uiConnections.size > 0) {
        const payload = JSON.stringify(nodeData);
        uiConnections.forEach(client => {
            if (client.readyState === 1) {
                client.send(payload);
            }
        });
    }
}, 1000 / 30);


// ----------------------------------------------------
// Start Server
// ----------------------------------------------------
server.listen(HTTP_PORT, '0.0.0.0', () => {
    console.log(`Node.js Unified API & Stream Server running on port ${HTTP_PORT}`);
});
