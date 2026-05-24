const streamGrid = document.getElementById('stream-grid');
const telemetryGrid = document.getElementById('telemetry-grid');
const wsStatusDot = document.querySelector('#ws-status .dot');
const wsStatusText = document.querySelector('#ws-status span');
const beepBtn = document.getElementById('beep-btn');

const audioNodes = new Map();
let currentMasterNodeId = null;
let ws = null;

// Modern vibrant color palette
const colors = [
    '#00f0ff', // Cyan
    '#00e676', // Green
    '#ff00aa', // Magenta
    '#7000ff', // Purple
    '#ffaa00', // Orange
    '#ffff00'  // Yellow
];
let colorIndex = 0;

// --- AUDIO STREAM WEBSOCKET ---

function createAudioCard(ip) {
    const card = document.createElement('div');
    card.className = 'node-card glass-panel';
    
    const header = document.createElement('div');
    header.className = 'node-header';
    
    const title = document.createElement('div');
    title.className = 'node-ip';
    title.innerHTML = `<i class="fa-solid fa-network-wired"></i> ${ip}`;
    
    const badge = document.createElement('div');
    badge.className = 'node-badge';
    badge.innerHTML = '<i class="fa-solid fa-circle-dot" style="font-size:0.6rem; margin-right:4px;"></i> Live';
    
    const canvas = document.createElement('canvas');
    canvas.width = 800; // High DPI support
    canvas.height = 360;
    
    header.appendChild(title);
    header.appendChild(badge);
    card.appendChild(header);
    card.appendChild(canvas);
    streamGrid.appendChild(card);
    
    const ctx = canvas.getContext('2d');
    const color = colors[colorIndex % colors.length];
    colorIndex++;
    
    audioNodes.set(ip, { card, canvas, ctx, color, data: [] });
}

function drawWaveform(nodeInfo) {
    const { ctx, canvas, color, data } = nodeInfo;
    const width = canvas.width;
    const height = canvas.height;
    
    // Phosphor fade effect
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillRect(0, 0, width, height);
    
    if (!data || data.length === 0) return;
    
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    
    let maxVal = 0;
    for (let i = 0; i < data.length; i++) {
        const val = Math.abs(data[i]);
        if (val > maxVal) maxVal = val;
    }
    maxVal = maxVal * 1.2;
    if (maxVal < 100) maxVal = 100;
    
    const stepX = width / data.length;
    const centerY = height / 2;
    
    for (let i = 0; i < data.length; i++) {
        const x = i * stepX;
        const normalized = data[i] / maxVal;
        const y = centerY - (normalized * (height / 2 - 20));
        
        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
    
    // Outer glow
    ctx.shadowBlur = 15;
    ctx.shadowColor = color;
    ctx.stroke();
    
    // Core line
    ctx.shadowBlur = 0;
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
}

function connectAudioWS() {
    // Connect to monitor_server.py (port 8010)
    ws = new WebSocket(`ws://${window.location.host}/ws`);
    
    ws.onopen = () => {
        wsStatusDot.className = 'dot pulse-green';
        wsStatusText.textContent = 'Stream Connected';
    };
    
    ws.onclose = () => {
        wsStatusDot.className = 'dot pulse-red';
        wsStatusText.textContent = 'Stream Disconnected (Retrying...)';
        setTimeout(connectAudioWS, 2000);
    };
    
    ws.onmessage = (event) => {
        try {
            const payload = JSON.parse(event.data);
            for (const [ip, samples] of Object.entries(payload)) {
                if (!audioNodes.has(ip)) {
                    createAudioCard(ip);
                }
                const nodeInfo = audioNodes.get(ip);
                nodeInfo.data = samples;
            }
        } catch (e) {
            console.error("Failed to parse WS message", e);
        }
    };
}

// Global render loop to decouple drawing from network events
function renderLoop() {
    for (const nodeInfo of audioNodes.values()) {
        if (nodeInfo.data && nodeInfo.data.length > 0) {
            drawWaveform(nodeInfo);
        }
    }
    requestAnimationFrame(renderLoop);
}
requestAnimationFrame(renderLoop);

// --- TELEMETRY FETCHING ---

function renderTelemetryCard(nodeType, nodeId, data) {
    let card = document.getElementById(`tel-${nodeId}`);
    if (!card) {
        card = document.createElement('div');
        card.id = `tel-${nodeId}`;
        card.className = 'telemetry-card glass-panel';
        telemetryGrid.appendChild(card);
    }
    
    const isMaster = nodeType === 'master';
    
    card.innerHTML = `
        <div class="t-header">
            <div class="t-title"><i class="fa-solid fa-microchip"></i> ${nodeId}</div>
            <div class="t-badge ${isMaster ? 'master' : ''}">${isMaster ? '<i class="fa-solid fa-crown"></i> Master' : 'Listener'}</div>
        </div>
        <div class="t-data">
            <div class="data-item">
                <span class="d-label"><i class="fa-solid fa-temperature-half"></i> Env Temp</span>
                <span class="d-value">${data.temperature !== null ? data.temperature.toFixed(1) + '°C' : 'N/A'}</span>
            </div>
            <div class="data-item">
                <span class="d-label"><i class="fa-solid fa-droplet"></i> Humidity</span>
                <span class="d-value">${data.humidity !== null ? data.humidity.toFixed(1) + '%' : 'N/A'}</span>
            </div>
            <div class="data-item" style="grid-column: 1 / -1; margin-top: 0.5rem;">
                <span class="d-label"><i class="fa-solid fa-fire"></i> CPU Temp</span>
                <span class="d-value">${data.cpu_temp !== null ? data.cpu_temp.toFixed(1) + '°C' : 'N/A'}</span>
            </div>
        </div>
    `;
}

async function fetchTelemetry() {
    try {
        const url = `http://${window.location.hostname}:8009/telemetry`;
        const res = await fetch(url);
        const data = await res.json();
        
        // Remove empty state if present
        const emptyState = telemetryGrid.querySelector('.empty-state');
        
        let foundMaster = null;
        let hasData = false;

        for (const [nodeType, nodes] of Object.entries(data)) {
            for (const [nodeId, telemetry] of Object.entries(nodes)) {
                hasData = true;
                if (emptyState) emptyState.remove();
                
                renderTelemetryCard(nodeType, nodeId, telemetry);
                if (nodeType === 'master') {
                    foundMaster = nodeId;
                }
            }
        }
        
        currentMasterNodeId = foundMaster;
        
        // Button state
        if (currentMasterNodeId) {
            beepBtn.style.opacity = '1';
            beepBtn.style.cursor = 'pointer';
        } else {
            beepBtn.style.opacity = '0.5';
            beepBtn.style.cursor = 'not-allowed';
        }

    } catch (e) {
        console.warn("Could not fetch telemetry:", e);
    }
}

// --- BEEP BUTTON ---

beepBtn.addEventListener('click', () => {
    if (!currentMasterNodeId) {
        alert("Master node not detected yet. Waiting for telemetry...");
        return;
    }
    
    if (ws && ws.readyState === WebSocket.OPEN) {
        // Add a quick visual feedback
        const originalText = beepBtn.innerHTML;
        beepBtn.innerHTML = '<i class="fa-solid fa-check"></i> Command Sent!';
        beepBtn.style.background = 'var(--success)';
        beepBtn.style.color = '#000';
        
        ws.send(JSON.stringify({
            action: "beep",
            node_id: currentMasterNodeId
        }));
        
        setTimeout(() => {
            beepBtn.innerHTML = originalText;
            beepBtn.style.background = '';
            beepBtn.style.color = '';
        }, 1500);
    } else {
        alert("WebSocket is not connected.");
    }
});


// Start
connectAudioWS();
fetchTelemetry();
setInterval(fetchTelemetry, 2000); // Poll telemetry every 2 seconds
