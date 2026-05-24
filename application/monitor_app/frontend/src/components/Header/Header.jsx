import React, { useState } from 'react';
import { SatelliteDish, Volume2, Check } from 'lucide-react';
import styles from './Header.module.css';

export function Header({ wsStatus, masterNodeId, onBeep }) {
    const [justBeeped, setJustBeeped] = useState(false);

    const handleBeep = () => {
        if (!masterNodeId) {
            alert("Master node not detected yet. Waiting for telemetry...");
            return;
        }

        if (wsStatus === 'connected') {
            const success = onBeep(masterNodeId);
            if (success) {
                setJustBeeped(true);
                setTimeout(() => setJustBeeped(false), 1500);
            }
        } else {
            alert("WebSocket is not connected.");
        }
    };

    return (
        <header className={`glass-panel ${styles.header}`}>
            <div className={styles.brand}>
                <div className={styles.logoIcon}>
                    <SatelliteDish size={32} />
                </div>
                <h1>Locustracer <span>Local UI</span></h1>
            </div>

            <div className={styles.controls}>
                <button
                    onClick={handleBeep}
                    className={`${styles.actionBtn} ${justBeeped ? styles.btnSuccess : ''}`}
                    disabled={!masterNodeId}
                    style={{ opacity: masterNodeId ? 1 : 0.5, cursor: masterNodeId ? 'pointer' : 'not-allowed' }}
                >
                    {justBeeped ? <Check size={20} /> : <Volume2 size={20} />}
                    {justBeeped ? 'Command Sent!' : 'Beep Master Node'}
                </button>

                <div className={styles.statusIndicators}>
                    <div className={styles.statusPill}>
                        <div className={`${styles.dot} ${wsStatus === 'connected' ? styles.pulseGreen : styles.pulseRed}`}></div>
                        <span>{wsStatus === 'connected' ? 'Stream Connected' : 'Stream Disconnected'}</span>
                    </div>
                </div>
            </div>
        </header>
    );
}
