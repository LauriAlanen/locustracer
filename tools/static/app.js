const grid = document.getElementById('grid');
const connectionDot = document.getElementById('connection-dot');
const connectionStatus = document.getElementById('connection-status');

const nodes = new Map();

// Color palette for nodes
const colors = [
    '#00f0ff', // Cyan
    '#ff0055', // Pink
    '#bb00ff', // Purple
    '#00ffaa', // Green
    '#ffaa00', // Orange
    '#ffff00'  // Yellow
];
let colorIndex = 0;

function createNodeCard(ip) {
    const card = document.createElement('div');
    card.className = 'node-card';
    
    const header = document.createElement('div');
    header.className = 'node-header';
    
    const title = document.createElement('div');
    title.className = 'node-ip';
    title.textContent = `Node: ${ip}`;
    
    const badge = document.createElement('div');
    badge.className = 'node-badge';
    badge.textContent = 'Active';
    
    const canvas = document.createElement('canvas');
    // High DPI support
    canvas.width = 800;
    canvas.height = 400;
    
    header.appendChild(title);
    header.appendChild(badge);
    card.appendChild(header);
    card.appendChild(canvas);
    grid.appendChild(card);
    
    const ctx = canvas.getContext('2d');
    const color = colors[colorIndex % colors.length];
    colorIndex++;
    
    nodes.set(ip, { card, canvas, ctx, color, data: [] });
}

function drawWaveform(nodeInfo) {
    const { ctx, canvas, color, data } = nodeInfo;
    const width = canvas.width;
    const height = canvas.height;
    
    // Phosphor trail effect
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fillRect(0, 0, width, height);
    
    if (!data || data.length === 0) return;
    
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    
    // Find max value for auto-scaling
    let maxVal = 0;
    for (let i = 0; i < data.length; i++) {
        const val = Math.abs(data[i]);
        if (val > maxVal) maxVal = val;
    }
    
    // Add some headroom and prevent div-by-zero
    maxVal = maxVal * 1.2;
    if (maxVal < 100) maxVal = 100;
    
    const stepX = width / data.length;
    const centerY = height / 2;
    
    for (let i = 0; i < data.length; i++) {
        const x = i * stepX;
        const normalized = data[i] / maxVal;
        const y = centerY - (normalized * (height / 2 - 20)); // 20px padding
        
        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
    
    // Add glow
    ctx.shadowBlur = 15;
    ctx.shadowColor = color;
    ctx.stroke();
    
    // Draw twice for stronger core line
    ctx.shadowBlur = 0;
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
}

function connect() {
    const ws = new WebSocket(`ws://${window.location.host}/ws`);
    
    ws.onopen = () => {
        connectionDot.className = 'dot green';
        connectionStatus.textContent = 'Connected';
    };
    
    ws.onclose = () => {
        connectionDot.className = 'dot red';
        connectionStatus.textContent = 'Disconnected (Retrying...)';
        setTimeout(connect, 2000);
    };
    
    ws.onmessage = (event) => {
        const payload = JSON.parse(event.data);
        
        for (const [ip, samples] of Object.entries(payload)) {
            if (!nodes.has(ip)) {
                createNodeCard(ip);
            }
            
            const nodeInfo = nodes.get(ip);
            nodeInfo.data = samples;
            
            requestAnimationFrame(() => drawWaveform(nodeInfo));
        }
    };
}

// Start connection
connect();
