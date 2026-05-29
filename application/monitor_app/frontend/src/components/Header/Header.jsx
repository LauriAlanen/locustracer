import React, { useState, useEffect } from 'react';
import { SatelliteDish, Volume2, Check } from 'lucide-react';
import styles from './Header.module.css';

export function Header({ wsStatus, masterNodeId, onBeep, onSetVolume }) {
    const [justBeeped, setJustBeeped] = useState(false);
    const [volume, setVolume] = useState(10); // default
    const [buzzMode, setBuzzMode] = useState('pitch');
    const [digitalTwin, setDigitalTwin] = useState(false);

    useEffect(() => {
        fetch(`http://${window.location.hostname}:8009/digital-twin`)
            .then(res => res.json())
            .then(data => {
                if (data && data.active !== undefined) {
                    setDigitalTwin(data.active);
                }
            })
            .catch(err => console.error("Failed to fetch digital twin status", err));
    }, []);

    const toggleDigitalTwin = async () => {
        const newState = !digitalTwin;
        setDigitalTwin(newState);
        try {
            await fetch(`http://${window.location.hostname}:8009/digital-twin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ active: newState })
            });
        } catch (err) {
            console.error("Failed to set digital twin status", err);
            // Revert on error
            setDigitalTwin(!newState);
        }
    };


    const handleBeep = () => {
        if (!masterNodeId) {
            alert("Master node not detected yet. Waiting for telemetry...");
            return;
        }

        if (wsStatus === 'connected') {
            const success = onBeep(masterNodeId, buzzMode);
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
                {masterNodeId ? (
                    <div className={styles.masterControls}>
                        <div className={styles.volumeControl}>
                            <Volume2 size={16} />
                            <input 
                                type="range" 
                                min="0" max="100" 
                                value={volume} 
                                onChange={(e) => {
                                    setVolume(e.target.value);
                                    if(onSetVolume) onSetVolume(masterNodeId, e.target.value);
                                }}
                            />
                        </div>
                        <select 
                            className={styles.modeSelect}
                            value={buzzMode}
                            onChange={(e) => setBuzzMode(e.target.value)}
                        >
                            <option value="pitch">Pitch Sweep</option>
                            <option value="single_beep">Single Beep</option>
                            <option value="chirp">Chirp</option>
                            <option value="fast_beeps">Fast Beeps</option>
                            <option value="siren">Siren</option>
                            <option value="rumble">Rumble</option>
                        </select>
                        <button
                            onClick={handleBeep}
                            className={`${styles.actionBtn} ${justBeeped ? styles.btnSuccess : ''}`}
                        >
                            {justBeeped ? <Check size={20} /> : <Volume2 size={20} />}
                            {justBeeped ? 'Command Sent!' : 'Beep Master Node'}
                        </button>
                    </div>
                ) : null}

                <div className={styles.statusIndicators}>
                    <button 
                        onClick={toggleDigitalTwin}
                        className={`${styles.twinToggleBtn} ${digitalTwin ? styles.twinActive : ''}`}
                    >
                        <div className={styles.twinToggleIcon}>
                            {digitalTwin ? <Check size={14} /> : null}
                        </div>
                        Digital Twin
                    </button>
                    <div className={styles.statusPill}>
                        <div className={`${styles.dot} ${wsStatus === 'connected' ? styles.pulseGreen : styles.pulseRed}`}></div>
                        <span>{wsStatus === 'connected' ? 'Stream Connected' : 'Stream Disconnected'}</span>
                    </div>
                </div>
            </div>
        </header>
    );
}
