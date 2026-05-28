import { useState, useEffect, useRef, useCallback } from 'react';

const DEFAULT_WS_URL = import.meta.env.VITE_WS_URL || `ws://${window.location.hostname}:8009/ui-ws`;

export function useAudioWebSocket(url = DEFAULT_WS_URL) {
    const [status, setStatus] = useState('disconnected');
    const wsRef = useRef(null);
    
    // Store latest audio data outside of react state to prevent re-renders on every frame (30fps)
    // Components will use requestAnimationFrame to poll this ref
    const audioDataRef = useRef({});
    const tsfDataRef = useRef({});

    const connect = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) return;
        
        setStatus('connecting');
        const ws = new WebSocket(url);

        ws.onopen = () => {
            setStatus('connected');
        };

        ws.onclose = () => {
            setStatus('disconnected');
            // Auto reconnect after 2 seconds
            setTimeout(connect, 2000);
        };

        ws.onmessage = (event) => {
            try {
                const payload = JSON.parse(event.data);
                if (payload.audio) {
                    audioDataRef.current = payload.audio;
                } else {
                    audioDataRef.current = payload; // Fallback for old payloads
                }
                if (payload.tsfs) {
                    tsfDataRef.current = payload.tsfs;
                }
            } catch (e) {
                console.error("Failed to parse WS message", e);
            }
        };

        wsRef.current = ws;
    }, [url]);

    useEffect(() => {
        connect();
        return () => {
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, [connect]);

    const sendBeep = useCallback((nodeId, mode = 'pitch') => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                action: 'beep',
                node_id: nodeId,
                mode: mode
            }));
            return true;
        }
        return false;
    }, []);
    const sendVolume = useCallback((nodeId, volume) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                action: 'set_volume',
                node_id: nodeId,
                volume: volume
            }));
            return true;
        }
        return false;
    }, []);

    const sendIdentify = useCallback((nodeId) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                action: 'identify',
                node_id: nodeId
            }));
            return true;
        }
        return false;
    }, []);

    return { status, audioDataRef, tsfDataRef, sendBeep, sendVolume, sendIdentify };
}
