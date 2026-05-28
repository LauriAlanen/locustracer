import React, { useState, useEffect } from 'react';
import { Compass, BoxSelect, Info, Settings2 } from 'lucide-react';
import { AudioLocationMap } from './AudioLocationMap';
import { NodePositionEditor } from './NodePositionEditor';
import styles from '../AudioStream/AudioStream.module.css';
import './LocationMap.css';

const HOST = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8009`;

export function LocationMapView({ telemetryData, audioDataRef, positionDataRef, masterNodeId }) {
    const [showAxes, setShowAxes] = useState(false);
    const [showGrid, setShowGrid] = useState(true);
    const [showInfo, setShowInfo] = useState(true);
    const [showNodeEditor, setShowNodeEditor] = useState(false);
    // nodeConfig: array of { ip, x, y, isReference } from NodePositionEditor after save
    const [nodeConfig, setNodeConfig] = useState([]);

    // On mount, fetch stored node positions from the backend
    useEffect(() => {
        fetch(`${HOST}/nodes/config`)
            .then(r => r.json())
            .then(data => {
                if (!Array.isArray(data.nodes) || data.nodes.length === 0) return;
                const enriched = data.nodes.map(n => ({
                    ...n,
                    isReference: n.ip === data.reference_node,
                }));
                setNodeConfig(enriched);
            })
            .catch(() => {});
    }, []);

    const btnStyle = {
        padding: '6px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        background: 'rgba(255,255,255,0.1)',
        border: '1px solid rgba(255,255,255,0.2)',
        color: '#fff',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '0.85rem',
        fontWeight: 500,
    };

    const activeBtnStyle = {
        ...btnStyle,
        background: 'rgba(0,240,255,0.15)',
        border: '1px solid rgba(0,240,255,0.4)',
        color: '#00f0ff',
    };

    return (
        <main>
            <section className="section">
                <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h2><Compass size={24} /> Live Audio Radar</h2>
                        <span className="subtitle">Real-time localized sound source estimation</span>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <button
                            className="control-btn"
                            onClick={() => setShowNodeEditor(!showNodeEditor)}
                            style={showNodeEditor ? activeBtnStyle : btnStyle}
                        >
                            <Settings2 size={16} />
                            {showNodeEditor ? 'Hide Node Config' : 'Node Positions'}
                        </button>
                        <button className="control-btn" onClick={() => setShowInfo(!showInfo)} style={btnStyle}>
                            <Info size={16} />
                            {showInfo ? 'Hide Info' : 'Show Info'}
                        </button>
                        <button className="control-btn" onClick={() => setShowGrid(!showGrid)} style={btnStyle}>
                            <BoxSelect size={16} />
                            {showGrid ? 'Hide Grid' : 'Show Grid'}
                        </button>
                        <button className="control-btn" onClick={() => setShowAxes(!showAxes)} style={btnStyle}>
                            <BoxSelect size={16} />
                            {showAxes ? 'Hide Axes' : 'Show Axes'}
                        </button>
                    </div>
                </div>

                {showNodeEditor && (
                    <NodePositionEditor
                        telemetryData={telemetryData}
                        onSaved={setNodeConfig}
                    />
                )}

                <div className={`glass-panel ${styles.combinedCard} map-container`}>
                    <AudioLocationMap
                        telemetryData={telemetryData}
                        audioDataRef={audioDataRef}
                        positionDataRef={positionDataRef}
                        masterNodeId={masterNodeId}
                        showAxes={showAxes}
                        showGrid={showGrid}
                        showInfo={showInfo}
                        nodeConfig={nodeConfig}
                        showCornerLabels={showNodeEditor}
                    />
                </div>
            </section>
        </main>
    );
}
