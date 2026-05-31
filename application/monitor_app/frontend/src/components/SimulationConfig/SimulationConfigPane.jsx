import React, { useState, useEffect, useCallback } from 'react';
import { Settings } from 'lucide-react';

export function SimulationConfigPane() {
    const [config, setConfig] = useState({
        volume: 300000000,
        gain: 1.0,
        max_jitter_us: 200,
        source_speed: 2.0,
        source_radius: 0.8
    });

    const [isLoading, setIsLoading] = useState(true);
    const [saveStatus, setSaveStatus] = useState('');

    useEffect(() => {
        fetch('http://localhost:8009/simulation/config')
            .then(res => res.json())
            .then(data => {
                setConfig(data);
                setIsLoading(false);
            })
            .catch(err => {
                console.error('Failed to fetch config', err);
                setIsLoading(false);
            });
    }, []);

    const sendConfigUpdate = useCallback((newConfig) => {
        setSaveStatus('Saving...');
        fetch('http://localhost:8009/simulation/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newConfig)
        })
        .then(res => {
            if (res.ok) {
                setSaveStatus('Saved');
                setTimeout(() => setSaveStatus(''), 2000);
            } else {
                setSaveStatus('Failed to save');
            }
        })
        .catch(err => {
            console.error('Failed to save config', err);
            setSaveStatus('Failed to save');
        });
    }, []);

    // Debounce timer ref
    const timeoutRef = React.useRef(null);

    const handleChange = (field, value) => {
        const numValue = Number(value);
        const newConfig = { ...config, [field]: numValue };
        setConfig(newConfig);

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        
        timeoutRef.current = setTimeout(() => {
            sendConfigUpdate(newConfig);
        }, 500);
    };

    if (isLoading) {
        return <div className="card">Loading configuration...</div>;
    }

    return (
        <div className="card" style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                    <Settings size={20} />
                    Simulation Parameters
                </h3>
                {saveStatus && <span style={{ color: saveStatus === 'Failed to save' ? '#ff4444' : '#00f0ff', fontSize: '0.9rem' }}>{saveStatus}</span>}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* Volume */}
                <div className="slider-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <label>Snap Volume</label>
                        <span>{config.volume?.toLocaleString()}</span>
                    </div>
                    <input 
                        type="range" 
                        min="0" 
                        max="2000000000" 
                        step="100000"
                        value={config.volume}
                        onChange={(e) => handleChange('volume', e.target.value)}
                        style={{ width: '100%' }}
                    />
                </div>

                {/* Gain */}
                <div className="slider-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <label>Room Gain (Distortion)</label>
                        <span>{config.gain?.toLocaleString()}x</span>
                    </div>
                    <input 
                        type="range" 
                        min="0" 
                        max="20.0" 
                        step="0.1"
                        value={config.gain}
                        onChange={(e) => handleChange('gain', e.target.value)}
                        style={{ width: '100%' }}
                    />
                </div>

                {/* Max Jitter */}
                <div className="slider-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <label>Max Jitter (μs)</label>
                        <span>{config.max_jitter_us.toLocaleString()}</span>
                    </div>
                    <input 
                        type="range" 
                        min="0" 
                        max="50000" 
                        step="100"
                        value={config.max_jitter_us}
                        onChange={(e) => handleChange('max_jitter_us', e.target.value)}
                        style={{ width: '100%' }}
                    />
                </div>

                {/* Source Speed */}
                <div className="slider-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <label>Source Speed</label>
                        <span>{config.source_speed.toFixed(1)}</span>
                    </div>
                    <input 
                        type="range" 
                        min="0.0" 
                        max="10.0" 
                        step="0.1"
                        value={config.source_speed}
                        onChange={(e) => handleChange('source_speed', e.target.value)}
                        style={{ width: '100%' }}
                    />
                </div>

                {/* Source Radius */}
                <div className="slider-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <label>Source Radius</label>
                        <span>{config.source_radius.toFixed(1)}</span>
                    </div>
                    <input 
                        type="range" 
                        min="0.0" 
                        max="2.0" 
                        step="0.1"
                        value={config.source_radius}
                        onChange={(e) => handleChange('source_radius', e.target.value)}
                        style={{ width: '100%' }}
                    />
                </div>
            </div>
        </div>
    );
}
