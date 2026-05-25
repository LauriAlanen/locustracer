import React, { useRef, useEffect } from 'react';
import { Network, CircleDot } from 'lucide-react';
import styles from './AudioStream.module.css';

const COLORS = ['#4dabf7', '#69db7c', '#ff8787', '#b197fc', '#ffd43b', '#38d9a9'];

export function AudioStreamCard({ ip, colorIndex, audioDataRef }) {
    const canvasRef = useRef(null);
    const color = COLORS[colorIndex % COLORS.length];
    
    // History buffer for the rolling window
    const historyRef = useRef([]);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        let animationFrameId;
        let lastRenderTime = 0;
        
        // Settings for the rolling window
        const RENDER_INTERVAL_MS = 16; // 60 updates per second
        const TIME_WINDOW_S = 5; // 5 seconds of history
        const MAX_HISTORY = (1000 / RENDER_INTERVAL_MS) * TIME_WINDOW_S;

        const render = (timestamp) => {
            animationFrameId = requestAnimationFrame(render);
            
            if (timestamp - lastRenderTime < RENDER_INTERVAL_MS) return;
            lastRenderTime = timestamp;

            const width = canvas.width;
            const height = canvas.height;
            
            ctx.clearRect(0, 0, width, height);

            // Draw subtle background grid and time labels
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            
            // Horizontal lines
            for (let i = 0; i < height; i += 50) {
                ctx.moveTo(0, i);
                ctx.lineTo(width, i);
            }
            
            // Vertical lines for seconds
            const pixelsPerSecond = width / TIME_WINDOW_S;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'; // Brighter text
            ctx.font = 'bold 12px "SF Mono", Consolas, monospace'; // Larger font
            for (let i = 0; i <= TIME_WINDOW_S; i++) {
                const x = width - (i * pixelsPerSecond);
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
                if (i > 0) {
                    ctx.fillText(`-${i}s`, x + 5, height - 8);
                } else {
                    ctx.fillText(`0s`, x - 25, height - 8);
                }
            }
            ctx.stroke();

            // Process current audio data
            const allData = audioDataRef.current;
            const data = allData ? allData[ip] : null;
            
            let currentMax = 0;
            if (data && data.length > 0) {
                for (let i = 0; i < data.length; i++) {
                    let val = Math.abs(data[i]);
                    val = val >> 8;
                    val = Math.max(1, val);
                    
                    let db = 20 * Math.log10(val / 8388607) + 100;
                    db = Math.max(0, db);
                    
                    if (db > currentMax) currentMax = db;
                }
            }
            
            // Update history
            historyRef.current.push(currentMax);
            if (historyRef.current.length > MAX_HISTORY) {
                historyRef.current.shift();
            }
            
            const history = historyRef.current;
            
            const baseline = height - 25; // padding for labels
            const graphHeight = height - 50; // padding top and bottom

            // Calculate max value for dynamic scaling
            let maxHistoryVal = 100;
            for (let i = 0; i < history.length; i++) {
                if (history[i] > maxHistoryVal) maxHistoryVal = history[i];
            }
            maxHistoryVal *= 1.2; // Add some headroom

            if (history.length > 0) {
                const stepX = width / MAX_HISTORY;
                const startX = width - (history.length * stepX);
                
                // Draw Analog Envelope
                ctx.beginPath();
                ctx.strokeStyle = color;
                ctx.lineWidth = 3;
                ctx.lineJoin = 'round';
                ctx.moveTo(startX, baseline);
                
                for (let i = 0; i < history.length; i++) {
                    const x = startX + (i * stepX);
                    const val = history[i];
                    const y = baseline - (val / maxHistoryVal) * graphHeight;
                    
                    if (i === 0) {
                        ctx.moveTo(x, y);
                    } else {
                        ctx.lineTo(x, y);
                    }
                }
                ctx.stroke();

                // Fill area to the bottom
                const gradient = ctx.createLinearGradient(0, baseline - graphHeight, 0, baseline);
                gradient.addColorStop(0, `${color}40`);
                gradient.addColorStop(1, `${color}00`);
                
                ctx.lineTo(startX + (history.length - 1) * stepX, baseline);
                ctx.lineTo(startX, baseline);
                ctx.closePath();
                ctx.fillStyle = gradient;
                ctx.fill();
            }
        };

        animationFrameId = requestAnimationFrame(render);

        return () => {
            cancelAnimationFrame(animationFrameId);
        };
    }, [ip, color, audioDataRef]);

    return (
        <div className={`glass-panel ${styles.card}`}>
            <div className={styles.header}>
                <div className={styles.ip}>
                    <Network size={16} className={styles.iconMuted} /> {ip}
                </div>
                <div className={styles.badge}>
                    <CircleDot size={10} /> Live
                </div>
            </div>
            <canvas 
                ref={canvasRef} 
                width={800} 
                height={360} 
                className={styles.canvas}
            />
        </div>
    );
}
