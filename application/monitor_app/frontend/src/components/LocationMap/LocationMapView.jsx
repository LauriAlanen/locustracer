import React from 'react';
import { Compass } from 'lucide-react';
import { AudioLocationMap } from './AudioLocationMap';
import './LocationMap.css';

export function LocationMapView({ telemetryData, audioDataRef, masterNodeId }) {
    return (
        <main>
            <section className="section map-section">
                <div className="section-header">
                    <h2><Compass size={24} /> Live Audio Radar</h2>
                    <span className="subtitle">Real-time localized sound source estimation</span>
                </div>
                
                <div className="map-container">
                    <AudioLocationMap 
                        telemetryData={telemetryData} 
                        audioDataRef={audioDataRef} 
                        masterNodeId={masterNodeId} 
                    />
                </div>
            </section>
        </main>
    );
}
