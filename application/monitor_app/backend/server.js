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
    unknown: {},
    system: {
        tsf_variance_us: 0,
        bandwidth_mbps: "0.00",
        packet_loss: 0,
        active_nodes: 0
    }
};

// Global System Statistics State
const sysStats = {
    bytesSinceLastCheck: 0,
    packetsLostSinceLastCheck: 0,
    lastSeqIds: {},
    latestTsfs: {},
    activeNodes: new Set()
};

// Config State
const currentConfigs = {};
const defaultConfig = {
    buzzer_state: false,
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
    let ip = req.socket.remoteAddress;
    if (ip && ip.startsWith('::ffff:')) {
        ip = ip.substring(7);
    }
    const nodeId = ip || 'unknown';
    data.node_id = nodeId; // Override MAC with IP for UI
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

// Periodic System Stats Calculator (Runs every 1s)
setInterval(() => {
    const mbps = (sysStats.bytesSinceLastCheck * 8) / 1000000;
    
    let minOffset = null;
    let maxOffset = null;
    for (const ip in sysStats.latestTsfs) {
        const offset = sysStats.latestTsfs[ip];
        if (minOffset === null || offset < minOffset) minOffset = offset;
        if (maxOffset === null || offset > maxOffset) maxOffset = offset;
    }
    const variance = (minOffset !== null && maxOffset !== null) ? Math.round(Math.abs(maxOffset - minOffset)) : 0;

    latestTelemetry.system = {
        tsf_variance_us: variance,
        bandwidth_mbps: mbps.toFixed(2),
        packet_loss: sysStats.packetsLostSinceLastCheck,
        active_nodes: sysStats.activeNodes.size
    };

    sysStats.bytesSinceLastCheck = 0;
    sysStats.packetsLostSinceLastCheck = 0;
    sysStats.activeNodes.clear(); // Reset to only count actively streaming nodes
}, 1000);

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
        buzzer_volume: data.buzzer_volume !== undefined ? data.buzzer_volume : 1,
        poll_interval_ms: data.poll_interval_ms !== undefined ? data.poll_interval_ms : 5000
    };

    // Store config 
    const storedConfig = { ...newConfig };
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

    // Process network statistics
    sysStats.bytesSinceLastCheck += msg.length;
    sysStats.activeNodes.add(ip);

    const seqId = msg.readUInt32LE(16);
    const tsfTime = msg.readBigUInt64LE(20);

    // Calculate true TSF timer stability (drift) against the ideal I2S sample clock
    if (!sysStats.lastRawTsfs) sysStats.lastRawTsfs = {};
    if (!sysStats.lastRawSeqs) sysStats.lastRawSeqs = {};

    if (sysStats.latestTsfs[ip] === undefined || sysStats.lastRawTsfs[ip] === undefined) {
        sysStats.latestTsfs[ip] = 0; // Cumulative drift baseline
        sysStats.lastRawTsfs[ip] = Number(tsfTime);
        sysStats.lastRawSeqs[ip] = seqId;
    } else {
        const seqDiff = seqId - sysStats.lastRawSeqs[ip];
        if (seqDiff > 0 && seqDiff < 1000) {
            // 256 samples @ 48000Hz = 5333.333... microseconds
            const expectedTimeElapsed = seqDiff * (256 * 1000000 / 48000);
            const actualTimeElapsed = Number(tsfTime) - sysStats.lastRawTsfs[ip];
            
            // The difference between actual TSF elapsed and expected ideal time elapsed
            const driftDelta = actualTimeElapsed - expectedTimeElapsed;
            
            // Accumulate the drift
            sysStats.latestTsfs[ip] += driftDelta;
        }
        sysStats.lastRawTsfs[ip] = Number(tsfTime);
        sysStats.lastRawSeqs[ip] = seqId;
    }

    if (sysStats.lastSeqIds[ip] !== undefined) {
        const expected = sysStats.lastSeqIds[ip] + 1;
        if (seqId > expected) {
            sysStats.packetsLostSinceLastCheck += (seqId - expected);
        }
    }
    sysStats.lastSeqIds[ip] = seqId;

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

udpServer.bind(UDP_PORT, '0.0.0.0');

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
        let ip = request.socket.remoteAddress;
        if (ip && ip.startsWith('::ffff:')) {
            ip = ip.substring(7);
        }
        const nodeId = ip || 'unknown';
        let isConfigSent = false;
        
        ws.on('message', (message) => {
            try {
                const telemetry = JSON.parse(message);
                const originalMac = telemetry.node_id;
                telemetry.node_id = nodeId; // Override MAC with IP
                telemetry.mac_address = originalMac || 'unknown'; // Keep MAC in a separate field just in case
                
                const nodeType = telemetry.node_type || 'unknown';
                
                if (!isConfigSent) {
                    isConfigSent = true;
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
            if (nodeId && esp32Connections.get(nodeId) === ws) {
                esp32Connections.delete(nodeId);
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

                const currentConfig = currentConfigs[nodeId] || { ...defaultConfig };

                if (data.action === 'beep') {
                    const mode = data.mode || 'pitch';
                    console.log(`UI requested Beep (${mode}) for ${nodeId}`);
                    
                    // Add buzzer_mode as a transient event trigger (not persisted to currentConfigs)
                    const newConfig = { ...currentConfig, buzzer_mode: mode };
                    
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
                    
                    const newConfig = { ...currentConfig };
                    
                    const espWs = esp32Connections.get(nodeId);
                    if (espWs && espWs.readyState === 1) {
                        espWs.send(JSON.stringify(newConfig));
                    }
                }
                else if (data.action === 'identify') {
                    console.log(`UI requested Identify for ${nodeId}`);
                    // Transient event trigger
                    const newConfig = { ...currentConfig, led_identify: true };
                    
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

// Broadcast UDP Audio to UI loops at ~60FPS
setInterval(() => {
    if (uiConnections.size > 0) {
        const payload = JSON.stringify({ audio: nodeData, tsfs: sysStats.latestTsfs });
        uiConnections.forEach(client => {
            if (client.readyState === 1) {
                client.send(payload);
            }
        });
    }
}, 1000 / 60);


// ----------------------------------------------------
// Start Server
// ----------------------------------------------------
server.listen(HTTP_PORT, '0.0.0.0', () => {
    console.log(`Node.js Unified API & Stream Server running on port ${HTTP_PORT}`);
});
