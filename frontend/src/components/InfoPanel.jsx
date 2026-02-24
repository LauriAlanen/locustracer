export default function InfoPanel({ config, results }) {
    const source = results.locations[0];
    const segment = results.processed_segments[0];
    const mics = config.microphones;

    return (
        <>
            {/* Source Position Info */}
            <div className="info-panel">
                <h3>Sound Source</h3>
                <div className="info-row">
                    <span className="info-label">Status</span>
                    <span className="status-badge">
                        <span className="status-dot" />
                        Detected
                    </span>
                </div>
                <div className="info-row">
                    <span className="info-label">X Position</span>
                    <span className="info-value highlight">{source.position[0].toFixed(3)} m</span>
                </div>
                <div className="info-row">
                    <span className="info-label">Y Position</span>
                    <span className="info-value highlight">{source.position[1].toFixed(3)} m</span>
                </div>
                <div className="info-row">
                    <span className="info-label">Residual Error</span>
                    <span className="info-value success">{source.cost.toExponential(2)}</span>
                </div>
                <div className="info-row">
                    <span className="info-label">Sample Rate</span>
                    <span className="info-value">{(results.sample_rate / 1000).toFixed(1)} kHz</span>
                </div>
                <div className="info-row">
                    <span className="info-label">Delays (samples)</span>
                    <span className="info-value">[{segment.delays.join(', ')}]</span>
                </div>
            </div>

            {/* Microphone Legend */}
            <div className="mic-legend">
                <h3>Microphones</h3>
                {mics.map((mic) => (
                    <div key={mic.id} className="mic-item">
                        <span className="mic-dot" />
                        <span>{mic.label}</span>
                        <span className="mic-coords">({mic.position[0]}, {mic.position[1]})</span>
                    </div>
                ))}
            </div>
        </>
    );
}
