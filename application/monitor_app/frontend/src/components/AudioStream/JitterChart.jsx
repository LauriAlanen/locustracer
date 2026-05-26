import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Play, CircleDot, Clock } from 'lucide-react';
import styles from './AudioStream.module.css';

const COLORS = ['#4dabf7', '#69db7c', '#ff8787', '#b197fc', '#ffd43b', '#38d9a9'];
const MAX_HISTORY_S = 60;
const RENDER_INTERVAL_MS = 16; 
const MAX_HISTORY_POINTS = (1000 / RENDER_INTERVAL_MS) * MAX_HISTORY_S;

export function JitterChart({ tsfDataRef }) {
    const canvasRef = useRef(null);
    const historyRef = useRef([]);
    const [isLive, setIsLive] = useState(true);
    const [showDots, setShowDots] = useState(false);
    
    const isLiveRef = useRef(true);
    const showDotsRef = useRef(false);
    const viewEndTimeRef = useRef(0);
    const viewDurationRef = useRef(5000); 
    const latestTimeRef = useRef(0);
    
    const isDraggingRef = useRef(false);
    const lastMouseXRef = useRef(0);

    const ipsRef = useRef([]); 
    const baseOffsetsRef = useRef({});

    useEffect(() => {
        isLiveRef.current = isLive;
    }, [isLive]);

    useEffect(() => {
        showDotsRef.current = showDots;
    }, [showDots]);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        let animationFrameId;
        let lastRenderTime = 0;
        let startTime = performance.now();

        const render = (timestamp) => {
            animationFrameId = requestAnimationFrame(render);
            
            if (timestamp - lastRenderTime < RENDER_INTERVAL_MS) return;
            lastRenderTime = timestamp;

            const width = canvas.width;
            const height = canvas.height;
            
            const now = performance.now();
            const elapsedMs = now - startTime;

            // Process current TSF data
            const allData = tsfDataRef.current || {};
            const currentIps = Object.keys(allData);
            
            currentIps.forEach(ip => {
                if (!ipsRef.current.includes(ip)) {
                    ipsRef.current.push(ip);
                }
            });

            const point = { time: elapsedMs, ips: {} };
            
            for (const ip of currentIps) {
                const offset = allData[ip] || 0;
                if (baseOffsetsRef.current[ip] === undefined && offset !== 0) {
                    baseOffsetsRef.current[ip] = offset;
                }
                
                const base = baseOffsetsRef.current[ip] || 0;
                point.ips[ip] = offset - base;
            }
            
            historyRef.current.push(point);
            if (historyRef.current.length > MAX_HISTORY_POINTS) {
                historyRef.current.shift();
            }

            // Draw
            ctx.clearRect(0, 0, width, height);
            
            // Subtle background
            ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            ctx.fillRect(0, 0, width, height);

            const history = historyRef.current;
            if (history.length === 0) return;

            const latestTime = history[history.length - 1].time;
            latestTimeRef.current = latestTime;
            
            if (isLiveRef.current) {
                viewEndTimeRef.current = latestTime;
            }
            
            // Time range to display
            const viewDuration = viewDurationRef.current;
            const endTime = viewEndTimeRef.current;
            const startTimeView = endTime - viewDuration;

            // X-axis mapping
            const mapX = (t) => {
                return ((t - startTimeView) / viewDuration) * width;
            };

            // Calculate min/max value for dynamic scaling
            let minVal = 0;
            let maxVal = 0;
            let hasData = false;
            for (const p of history) {
                if (p.time >= startTimeView && p.time <= endTime) {
                    for (const ip in p.ips) {
                        const val = p.ips[ip];
                        if (!hasData) {
                            minVal = val;
                            maxVal = val;
                            hasData = true;
                        } else {
                            if (val > maxVal) maxVal = val;
                            if (val < minVal) minVal = val;
                        }
                    }
                }
            }
            
            // Add margin to Y axis
            const range = maxVal - minVal;
            const margin = Math.max(range * 0.1, 100); // at least 100us margin
            maxVal += margin;
            minVal -= margin;

            const baseline = height - 30;
            const graphHeight = height - 40;
            const mapY = (val) => baseline - ((val - minVal) / (maxVal - minVal)) * graphHeight;

            // Draw Grids
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.lineWidth = 1;
            
            const totalRange = maxVal - minVal;
            const roughStep = totalRange / 5;
            const power = Math.floor(Math.log10(roughStep || 1));
            const magnitude = Math.pow(10, power);
            const normalized = roughStep / magnitude;
            
            let yStep;
            if (normalized < 1.5) yStep = 1 * magnitude;
            else if (normalized < 3.5) yStep = 2 * magnitude;
            else if (normalized < 7.5) yStep = 5 * magnitude;
            else yStep = 10 * magnitude;
            
            if (yStep < 10) yStep = 10;

            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.font = '10px "SF Mono", Consolas, monospace';

            let lineCount = 0;
            const firstY = Math.ceil(minVal / yStep) * yStep;
            for (let yVal = firstY; yVal <= maxVal; yVal += yStep) {
                if (lineCount++ > 50) break; // Hard safety limit
                
                const y = mapY(yVal);
                if (y < 15) continue; 
                if (y > height - 15) continue;
                
                ctx.moveTo(0, y);
                ctx.lineTo(width, y);
                ctx.fillText(Math.round(yVal).toString() + " µs", 10, y - 5);
            }
            
            // X-axis grid & labels
            ctx.font = '12px "SF Mono", Consolas, monospace';
            
            let gridStep = 1000;
            if (viewDuration > 20000) gridStep = 5000;
            if (viewDuration > 40000) gridStep = 10000;

            const firstGrid = Math.ceil(startTimeView / gridStep) * gridStep;
            for (let t = firstGrid; t <= endTime; t += gridStep) {
                const x = mapX(t);
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
                
                const timeAgo = ((latestTime - t) / 1000).toFixed(1);
                ctx.fillText(`-${timeAgo}s`, x + 5, height - 10);
            }
            ctx.stroke();

            // Draw lines for each IP
            ipsRef.current.forEach((ip, index) => {
                const color = COLORS[index % COLORS.length];
                
                ctx.beginPath();
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;
                ctx.lineJoin = 'round';
                
                let started = false;
                for (const p of history) {
                    if (p.time < startTimeView - RENDER_INTERVAL_MS * 2) continue; 
                    if (p.time > endTime + RENDER_INTERVAL_MS * 2) break;

                    const val = p.ips[ip] !== undefined ? p.ips[ip] : null;
                    if (val === null) continue;

                    const x = mapX(p.time);
                    const y = mapY(val);

                    if (!started) {
                        ctx.moveTo(x, y);
                        started = true;
                    } else {
                        ctx.lineTo(x, y);
                    }
                }
                ctx.stroke();

                // Draw dots if enabled
                if (showDotsRef.current) {
                    ctx.fillStyle = color;
                    for (const p of history) {
                        if (p.time < startTimeView - RENDER_INTERVAL_MS * 2) continue;
                        if (p.time > endTime + RENDER_INTERVAL_MS * 2) break;

                        const val = p.ips[ip] !== undefined ? p.ips[ip] : null;
                        if (val === null) continue;

                        const x = mapX(p.time);
                        const y = mapY(val);

                        ctx.beginPath();
                        ctx.arc(x, y, 2, 0, 2 * Math.PI);
                        ctx.fill();
                    }
                }
            });
        };

        animationFrameId = requestAnimationFrame(render);

        return () => {
            cancelAnimationFrame(animationFrameId);
        };
    }, [tsfDataRef]);

    const handleWheel = useCallback((e) => {
        e.preventDefault();
        setIsLive(false);
        isLiveRef.current = false;
        
        const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
        
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const ratio = mouseX / rect.width;
        
        const viewDuration = viewDurationRef.current;
        const newDuration = Math.min(Math.max(viewDuration * zoomFactor, 1000), MAX_HISTORY_S * 1000); 
        
        const mouseTime = viewEndTimeRef.current - (1 - ratio) * viewDuration;
        let newEndTime = mouseTime + (1 - ratio) * newDuration;
        
        if (newEndTime > latestTimeRef.current) {
            newEndTime = latestTimeRef.current;
        }

        viewDurationRef.current = newDuration;
        viewEndTimeRef.current = newEndTime;
    }, []);

    const handleMouseDown = (e) => {
        isDraggingRef.current = true;
        lastMouseXRef.current = e.clientX;
    };

    const handleMouseMove = (e) => {
        if (!isDraggingRef.current) return;
        setIsLive(false);
        isLiveRef.current = false;
        
        const deltaX = e.clientX - lastMouseXRef.current;
        lastMouseXRef.current = e.clientX;
        
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        
        const timeShift = (deltaX / rect.width) * viewDurationRef.current;
        
        let newEndTime = viewEndTimeRef.current - timeShift;
        if (newEndTime > latestTimeRef.current) {
            newEndTime = latestTimeRef.current;
        }

        viewEndTimeRef.current = newEndTime;
    };

    const handleMouseUp = () => {
        isDraggingRef.current = false;
    };
    
    useEffect(() => {
        const canvas = canvasRef.current;
        if (canvas) {
            canvas.addEventListener('wheel', handleWheel, { passive: false });
            return () => canvas.removeEventListener('wheel', handleWheel);
        }
    }, [handleWheel]);

    const goLive = () => {
        setIsLive(true);
        isLiveRef.current = true;
    };

    return (
        <div className={`glass-panel ${styles.combinedCard}`}>
            <div className={styles.header}>
                <div className={styles.ip}>
                    <Clock size={20} className={styles.iconPrimary} /> TSF Jitter Analysis
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <button 
                        className={styles.liveButton} 
                        onClick={() => setShowDots(!showDots)}
                        style={{ opacity: showDots ? 1 : 0.5, borderColor: showDots ? 'rgba(0, 240, 255, 0.5)' : 'rgba(255, 255, 255, 0.2)' }}
                    >
                        <CircleDot size={14} /> {showDots ? 'Hide Dots' : 'Show Dots'}
                    </button>
                    {!isLive && (
                        <button className={styles.liveButton} onClick={goLive}>
                            <Play size={14} /> Go Live
                        </button>
                    )}
                    {isLive && (
                        <div className={styles.badge}>
                            <CircleDot size={10} /> Live Tracking
                        </div>
                    )}
                </div>
            </div>
            <div className={styles.canvasContainer}>
                <canvas 
                    ref={canvasRef} 
                    width={1000} 
                    height={300} 
                    className={styles.combinedCanvas}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                />
            </div>
        </div>
    );
}
