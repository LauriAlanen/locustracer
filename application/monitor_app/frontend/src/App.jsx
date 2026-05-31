import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Header } from './components/Header/Header';
import { TelemetryGrid } from './components/Telemetry/TelemetryGrid';
import { AudioStreamGrid } from './components/AudioStream/AudioStreamGrid';
import { CombinedAudioStreamChart } from './components/AudioStream/CombinedAudioStreamChart';
import { JitterChart } from './components/AudioStream/JitterChart';
import { SystemOverviewCard } from './components/Telemetry/SystemOverviewCard';
import { LocationMapView } from './components/LocationMap/LocationMapView';
import { useTelemetry } from './hooks/useTelemetry';
import { useAudioWebSocket } from './hooks/useAudioWebSocket';
import { SimulationConfigPane } from './components/SimulationConfig/SimulationConfigPane';
import { Microchip, Activity, Layers, BarChart2, LayoutDashboard, Compass, Settings } from 'lucide-react';

function Navigation() {
    const location = useLocation();
    return (
        <nav className="nav-tabs" style={{ display: 'flex', gap: '1rem', padding: '0 2rem', marginBottom: '1rem' }}>
            <Link 
                to="/" 
                className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}
                style={{
                    padding: '0.5rem 1rem',
                    color: location.pathname === '/' ? '#fff' : 'rgba(255,255,255,0.6)',
                    borderBottom: location.pathname === '/' ? '2px solid #00f0ff' : 'none',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontWeight: 600
                }}
            >
                <LayoutDashboard size={18} /> Dashboard
            </Link>
            <Link 
                to="/map" 
                className={`nav-link ${location.pathname === '/map' ? 'active' : ''}`}
                style={{
                    padding: '0.5rem 1rem',
                    color: location.pathname === '/map' ? '#fff' : 'rgba(255,255,255,0.6)',
                    borderBottom: location.pathname === '/map' ? '2px solid #00f0ff' : 'none',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontWeight: 600
                }}
            >
                <Compass size={18} /> Location Map
            </Link>
            <Link 
                to="/statistics" 
                className={`nav-link ${location.pathname === '/statistics' ? 'active' : ''}`}
                style={{
                    padding: '0.5rem 1rem',
                    color: location.pathname === '/statistics' ? '#fff' : 'rgba(255,255,255,0.6)',
                    borderBottom: location.pathname === '/statistics' ? '2px solid #00f0ff' : 'none',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontWeight: 600
                }}
            >
                <BarChart2 size={18} /> Statistics
            </Link>
            <Link 
                to="/simulation" 
                className={`nav-link ${location.pathname === '/simulation' ? 'active' : ''}`}
                style={{
                    padding: '0.5rem 1rem',
                    color: location.pathname === '/simulation' ? '#fff' : 'rgba(255,255,255,0.6)',
                    borderBottom: location.pathname === '/simulation' ? '2px solid #00f0ff' : 'none',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontWeight: 600
                }}
            >
                <Settings size={18} /> Simulation Config
            </Link>
        </nav>
    );
}

function DashboardView({ telemetryData, audioDataRef, sendIdentify }) {
    return (
        <main>
            <section className="section">
                <SystemOverviewCard systemData={telemetryData?.system} />
                <div className="section-header">
                    <h2><Microchip size={24} /> Telemetry Overview</h2>
                    <span className="subtitle">Live data from Locus API</span>
                </div>
                <TelemetryGrid telemetryData={telemetryData} onIdentify={sendIdentify} />
            </section>

            <section className="section">
                <div className="section-header">
                    <h2><Layers size={24} /> Combined Audio Analysis</h2>
                    <span className="subtitle">Interactive timeline</span>
                </div>
                <CombinedAudioStreamChart audioDataRef={audioDataRef} />
            </section>

            <section className="section">
                <div className="section-header">
                    <h2><Activity size={24} /> Live Audio Streams</h2>
                    <span className="subtitle">Real-time audio feeds</span>
                </div>
                <AudioStreamGrid audioDataRef={audioDataRef} />
            </section>
        </main>
    );
}

function StatisticsView({ tsfDataRef }) {
    return (
        <main>
            <section className="section">
                <div className="section-header">
                    <h2><BarChart2 size={24} /> Timer Jitter Analysis</h2>
                    <span className="subtitle">Relative TSF Drift Monitoring</span>
                </div>
                <JitterChart tsfDataRef={tsfDataRef} />
            </section>
        </main>
    );
}

function SimulationConfigView() {
    return (
        <main>
            <section className="section">
                <div className="section-header" style={{ marginBottom: '2rem' }}>
                    <h2><Settings size={24} /> Simulation Configuration</h2>
                    <span className="subtitle">Adjust UDP simulation parameters in real-time</span>
                </div>
                <SimulationConfigPane />
            </section>
        </main>
    );
}

function App() {
    const { telemetryData, masterNodeId } = useTelemetry();
    const { status: wsStatus, audioDataRef, tsfDataRef, positionDataRef, sendBeep, sendVolume, sendIdentify } = useAudioWebSocket();

    return (
        <Router>
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
                
                <Navigation />

                <Routes>
                    <Route path="/" element={
                        <DashboardView 
                            telemetryData={telemetryData} 
                            audioDataRef={audioDataRef} 
                            sendIdentify={sendIdentify} 
                        />
                    } />
                    <Route path="/map" element={
                        <LocationMapView 
                            telemetryData={telemetryData} 
                            audioDataRef={audioDataRef} 
                            positionDataRef={positionDataRef}
                            masterNodeId={masterNodeId} 
                        />
                    } />
                    <Route path="/statistics" element={
                        <StatisticsView 
                            tsfDataRef={tsfDataRef} 
                        />
                    } />
                    <Route path="/simulation" element={
                        <SimulationConfigView />
                    } />
                </Routes>
            </div>
        </Router>
    );
}

export default App;
