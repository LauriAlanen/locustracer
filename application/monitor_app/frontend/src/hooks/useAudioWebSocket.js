import { useState, useEffect, useRef, useCallback } from 'react';

export function useAudioWebSocket(url = 'ws://127.0.0.1:8010') {
    const [status, setStatus] = useState('disconnected');
    const wsRef = useRef(null);
    
    // Store latest audio data outside of react state to prevent re-renders on every frame (30fps)
    // Components will use requestAnimationFrame to poll this ref
    const audioDataRef = useRef({});

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
                audioDataRef.current = payload;
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

    const sendBeep = useCallback((nodeId) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                action: 'beep',
                node_id: nodeId
            }));
            return true;
        }
        return false;
    }, []);

    return { status, audioDataRef, sendBeep };
}
