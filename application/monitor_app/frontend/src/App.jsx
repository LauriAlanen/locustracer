import React from 'react';
import { Header } from './components/Header/Header';
import { TelemetryGrid } from './components/Telemetry/TelemetryGrid';
import { AudioStreamGrid } from './components/AudioStream/AudioStreamGrid';
import { useTelemetry } from './hooks/useTelemetry';
import { useAudioWebSocket } from './hooks/useAudioWebSocket';
import { Microchip, Activity } from 'lucide-react';

function App() {
    const { telemetryData, masterNodeId } = useTelemetry();
    const { status: wsStatus, audioDataRef, sendBeep, sendVolume, sendIdentify } = useAudioWebSocket();

    return (
        <>
            <div className="background-effects">
                <div className="glow-orb orb-1"></div>
                <div className="glow-orb orb-2"></div>
                <div className="glow-orb orb-3"></div>
            </div>

            <div className="dashboard-container">
                <Header
                    wsStatus={wsStatus}
                    masterNodeId={masterNodeId}
                    onBeep={sendBeep}
                    onSetVolume={sendVolume}
                />

                <main>
                    <section className="section">
                        <div className="section-header">
                            <h2><Microchip size={24} /> Telemetry Overview</h2>
                            <span className="subtitle">Live data from Locus API</span>
                        </div>
                        <TelemetryGrid telemetryData={telemetryData} onIdentify={sendIdentify} />
                    </section>

                    <section className="section">
                        <div className="section-header">
                            <h2><Activity size={24} /> Live Audio Streams</h2>
                            <span className="subtitle">Real-time audio feeds</span>
                        </div>
                        <AudioStreamGrid audioDataRef={audioDataRef} />
                    </section>
                </main>
            </div>
        </>
    );
}

export default App;
