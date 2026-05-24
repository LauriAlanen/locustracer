import React, { useRef, useEffect, useState } from 'react';
import { Network, CircleDot } from 'lucide-react';
import styles from './AudioStream.module.css';

const COLORS = ['#4dabf7', '#69db7c', '#ff8787', '#b197fc', '#ffd43b', '#38d9a9'];

export function AudioStreamCard({ ip, colorIndex, audioDataRef }) {
    const canvasRef = useRef(null);
    const color = COLORS[colorIndex % COLORS.length];

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        let animationFrameId;
        let lastRenderTime = 0;
        const RENDER_INTERVAL_MS = 80; // Slow down to ~12.5 FPS for a calmer look

        const render = (timestamp) => {
            animationFrameId = requestAnimationFrame(render);
            
            if (timestamp - lastRenderTime < RENDER_INTERVAL_MS) return;
            lastRenderTime = timestamp;

            const width = canvas.width;
            const height = canvas.height;
            
            ctx.clearRect(0, 0, width, height);

            // Draw subtle background grid
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let i = 0; i < height; i += 50) {
                ctx.moveTo(0, i);
                ctx.lineTo(width, i);
            }
            for (let i = 0; i < width; i += 100) {
                ctx.moveTo(i, 0);
                ctx.lineTo(i, height);
            }
            ctx.stroke();

            const allData = audioDataRef.current;
            const data = allData ? allData[ip] : null;
            
            if (data && data.length > 0) {
                let maxVal = 0;
                for (let i = 0; i < data.length; i++) {
                    const val = Math.abs(data[i]);
                    if (val > maxVal) maxVal = val;
                }
                maxVal = maxVal * 1.2;
                if (maxVal < 100) maxVal = 100;
                
                const stepX = width / data.length;
                const centerY = height / 2;

                // Create gradient for the area under the curve
                const gradient = ctx.createLinearGradient(0, centerY - (height / 3), 0, centerY + (height / 3));
                gradient.addColorStop(0, `${color}40`);
                gradient.addColorStop(0.5, `${color}10`);
                gradient.addColorStop(1, `${color}40`);
                
                ctx.beginPath();
                ctx.strokeStyle = color;
                ctx.lineWidth = 3;
                ctx.lineJoin = 'round';
                
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
                
                ctx.stroke();

                // Fill area to the center
                ctx.lineTo(width, centerY);
                ctx.lineTo(0, centerY);
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
