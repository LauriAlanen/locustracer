import React from 'react';
import { Activity, Clock, Wifi, HardDrive, AlertTriangle } from 'lucide-react';
import styles from './SystemOverviewCard.module.css';

export function SystemOverviewCard({ systemData }) {
    if (!systemData) return null;

    const { tsf_variance_us, bandwidth_mbps, packet_loss, active_nodes } = systemData;

    // Logic for visual indicators
    const isHighVariance = tsf_variance_us > 2000; // > 2ms variance is a warning for acoustic localization
    const hasPacketLoss = packet_loss > 0;

    return (
        <div className={`glass-panel ${styles.card}`}>
            <div className={styles.header}>
                <div className={styles.title}>
                    <HardDrive size={20} className={styles.iconPrimary} />
                    System Overview
                </div>
            </div>

            <div className={styles.grid}>
                {/* Active Nodes */}
                <div className={styles.statItem}>
                    <div className={styles.label}>
                        <Activity size={14} /> Active Mic Nodes
                    </div>
                    <div className={styles.value}>
                        {active_nodes}
                        <span className={styles.unit}>online</span>
                    </div>
                </div>

                {/* TSF Variance */}
                <div className={styles.statItem}>
                    <div className={styles.label}>
                        <Clock size={14} /> Hardware Sync Variance
                    </div>
                    <div className={`${styles.value} ${isHighVariance ? styles.warning : styles.good}`}>
                        {tsf_variance_us}
                        <span className={styles.unit}>µs</span>
                        {isHighVariance && <AlertTriangle size={16} className={styles.warning} />}
                    </div>
                </div>

                {/* Bandwidth */}
                <div className={styles.statItem}>
                    <div className={styles.label}>
                        <Wifi size={14} /> Audio Network Ingress
                    </div>
                    <div className={styles.value}>
                        {bandwidth_mbps}
                        <span className={styles.unit}>Mbps</span>
                    </div>
                </div>

                {/* Packet Loss */}
                <div className={styles.statItem}>
                    <div className={styles.label}>
                        <AlertTriangle size={14} /> UDP Packet Loss (1s)
                    </div>
                    <div className={`${styles.value} ${hasPacketLoss ? styles.warning : styles.good}`}>
                        {packet_loss}
                        <span className={styles.unit}>pkts</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
