import React from 'react';
import { TelemetryCard } from './TelemetryCard';
import styles from './Telemetry.module.css';

export function TelemetryGrid({ telemetryData, onIdentify }) {
    let hasData = false;
    const cards = [];

    if (telemetryData) {
        Object.entries(telemetryData).forEach(([nodeType, nodes]) => {
            Object.entries(nodes).forEach(([nodeId, data]) => {
                hasData = true;
                cards.push(
                    <TelemetryCard 
                        key={nodeId} 
                        nodeId={nodeId} 
                        isMaster={nodeType === 'master'} 
                        data={data} 
                        onIdentify={onIdentify}
                    />
                );
            });
        });
    }

    return (
        <div className={styles.grid}>
            {hasData ? (
                cards
            ) : (
                <div className={styles.emptyState}>
                    Waiting for telemetry data...
                </div>
            )}
        </div>
    );
}
