import React from 'react';
import { Cpu, Thermometer, Droplets, Microchip, Crown } from 'lucide-react';
import styles from './Telemetry.module.css';

export function TelemetryCard({ nodeId, isMaster, data }) {
    return (
        <div className={`glass-panel ${styles.card}`}>
            <div className={styles.header}>
                <div className={styles.title}>
                    <Microchip size={18} />
                    {nodeId}
                </div>
                <div className={`${styles.badge} ${isMaster ? styles.badgeMaster : ''}`}>
                    {isMaster ? <><Crown size={12} /> Master</> : 'Listener'}
                </div>
            </div>
            
            <div className={styles.dataGrid}>
                {isMaster && (
                    <>
                        <div className={styles.dataItem}>
                            <span className={styles.label}><Thermometer size={14} /> Env Temp</span>
                            <span className={styles.value}>
                                {data.temperature != null ? `${data.temperature.toFixed(1)}°C` : 'N/A'}
                            </span>
                        </div>
                        <div className={styles.dataItem}>
                            <span className={styles.label}><Droplets size={14} /> Humidity</span>
                            <span className={styles.value}>
                                {data.humidity != null ? `${data.humidity.toFixed(1)}%` : 'N/A'}
                            </span>
                        </div>
                    </>
                )}
                <div className={`${styles.dataItem} ${styles.fullWidth}`}>
                    <span className={styles.label}><Cpu size={14} /> CPU Temp</span>
                    <span className={styles.value}>
                        {data.cpu_temp != null ? `${data.cpu_temp.toFixed(1)}°C` : 'N/A'}
                    </span>
                </div>
            </div>
        </div>
    );
}
