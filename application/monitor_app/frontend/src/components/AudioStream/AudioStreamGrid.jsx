import React, { useState, useEffect } from 'react';
import { AudioStreamCard } from './AudioStreamCard';
import styles from './AudioStream.module.css';

export function AudioStreamGrid({ audioDataRef }) {
    const [ips, setIps] = useState([]);

    // We periodically check if new IPs have appeared in the audioDataRef
    // to render new cards, without triggering renders on every audio frame
    useEffect(() => {
        const interval = setInterval(() => {
            if (audioDataRef.current) {
                const currentIps = Object.keys(audioDataRef.current);
                setIps(prev => {
                    if (prev.length !== currentIps.length || !prev.every((ip, i) => ip === currentIps[i])) {
                        return currentIps;
                    }
                    return prev;
                });
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [audioDataRef]);

    return (
        <div className={styles.grid}>
            {ips.length > 0 ? (
                ips.map((ip, index) => (
                    <AudioStreamCard 
                        key={ip} 
                        ip={ip} 
                        colorIndex={index} 
                        audioDataRef={audioDataRef} 
                    />
                ))
            ) : (
                <div className={styles.emptyState}>
                    Waiting for audio streams...
                </div>
            )}
        </div>
    );
}
