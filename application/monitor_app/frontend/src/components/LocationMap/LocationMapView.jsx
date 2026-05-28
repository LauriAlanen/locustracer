import React, { useState } from 'react';
import { Compass, BoxSelect, Info } from 'lucide-react';
import { AudioLocationMap } from './AudioLocationMap';
import styles from '../AudioStream/AudioStream.module.css';
import './LocationMap.css';

export function LocationMapView({ telemetryData, audioDataRef, masterNodeId }) {
    const [showAxes, setShowAxes] = useState(false);
    const [showGrid, setShowGrid] = useState(true);
    const [showInfo, setShowInfo] = useState(true);

    return (
        <main>
            <section className="section">
                <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h2><Compass size={24} /> Live Audio Radar</h2>
                        <span className="subtitle">Real-time localized sound source estimation</span>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button
                            className="control-btn"
                            onClick={() => setShowInfo(!showInfo)}
                            style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: '4px', cursor: 'pointer' }}
                        >
                            <Info size={16} />
                            {showInfo ? 'Hide Info' : 'Show Info'}
                        </button>
                        <button
                            className="control-btn"
                            onClick={() => setShowGrid(!showGrid)}
                            style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: '4px', cursor: 'pointer' }}
                        >
                            <BoxSelect size={16} />
                            {showGrid ? 'Hide Grids' : 'Show Grids'}
                        </button>
                        <button
                            className="control-btn"
                            onClick={() => setShowAxes(!showAxes)}
                            style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: '4px', cursor: 'pointer' }}
                        >
                            <BoxSelect size={16} />
                            {showAxes ? 'Hide Axes' : 'Show Axes'}
                        </button>
                    </div>
                </div>

                <div className={`glass-panel ${styles.combinedCard} map-container`}>
                    <AudioLocationMap
                        telemetryData={telemetryData}
                        audioDataRef={audioDataRef}
                        masterNodeId={masterNodeId}
                        showAxes={showAxes}
                        showGrid={showGrid}
                        showInfo={showInfo}
                    />
                </div>
            </section>
        </main>
    );
}
