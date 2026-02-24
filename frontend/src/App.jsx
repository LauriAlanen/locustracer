import { useState, useEffect, useCallback, useRef } from 'react';
import Scene from './components/Scene';
import InfoPanel from './components/InfoPanel';
import DevLog, { createLogEntry } from './components/DevLog';
import { fetchResults, fetchConfig, runPipeline, streamSimulation } from './data/api';
import './index.css';

const SIM_SHAPES = ['circle', 'figure8', 'linear', 'random_walk'];

function App() {
  const [config, setConfig] = useState(null);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Simulation state
  const [simActive, setSimActive] = useState(false);
  const [simShape, setSimShape] = useState('circle');
  const [sourcePosition, setSourcePosition] = useState(null);
  const abortRef = useRef(null);

  // Dev log
  const [logs, setLogs] = useState([]);
  const [logOpen, setLogOpen] = useState(true);

  const addLog = useCallback((level, message) => {
    setLogs((prev) => [...prev.slice(-200), createLogEntry(level, message)]);
  }, []);

  // Initial data load
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        addLog('INFO', 'Connecting to Tracer API...');

        const [configData, resultsData] = await Promise.all([
          fetchConfig(),
          fetchResults(),
        ]);

        setConfig(configData);
        addLog('OK', `Config loaded: ${configData.room.width}×${configData.room.depth}m room, ${configData.microphones.length} mics`);

        if (resultsData) {
          setResults(resultsData);
          const loc = resultsData.locations[0];
          setSourcePosition([loc.position[0], 1.2, loc.position[1]]);
          addLog('OK', `Results loaded: source at (${loc.position[0].toFixed(3)}, ${loc.position[1].toFixed(3)})`);
        } else {
          addLog('WARN', 'No cached results, running pipeline...');
          const pipelineData = await runPipeline();
          setResults(pipelineData);
          const loc = pipelineData.locations[0];
          setSourcePosition([loc.position[0], 1.2, loc.position[1]]);
          addLog('OK', `Pipeline done: source at (${loc.position[0].toFixed(3)}, ${loc.position[1].toFixed(3)})`);
        }
      } catch (err) {
        setError(err.message);
        addLog('ERR', `Connection failed: ${err.message}`);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [addLog]);

  // Start/stop simulation
  const toggleSimulation = useCallback(() => {
    if (simActive) {
      // Stop
      if (abortRef.current) {
        abortRef.current();
        abortRef.current = null;
      }
      setSimActive(false);
      addLog('INFO', 'Simulation stopped');
      return;
    }

    // Start
    setSimActive(true);
    addLog('INFO', `Starting simulation: shape=${simShape}, steps=100`);

    const abort = streamSimulation({
      options: { shape: simShape, steps: 100, speed: 0.5, interval_ms: 200 },
      onStart: (info) => {
        addLog('OK', `SSE stream started: ${info.total_steps} steps, shape=${info.shape}`);
      },
      onFrame: (frame) => {
        const [x, y] = frame.true_position;
        const [sx, sy] = frame.solved_position;
        setSourcePosition([x, 1.2, y]);

        // Update results for InfoPanel
        setResults((prev) => prev ? {
          ...prev,
          locations: [{ segment_idx: frame.step, position: frame.true_position, cost: frame.residual }],
          processed_segments: [{ start_sample: 0, end_sample: 0, delays: frame.delays }],
        } : prev);

        // Log every 5th frame to avoid spam
        if (frame.step % 5 === 0) {
          addLog('DATA', `#${String(frame.step).padStart(3, '0')} pos=(${x.toFixed(2)}, ${y.toFixed(2)}) solved=(${sx.toFixed(2)}, ${sy.toFixed(2)}) err=${frame.residual.toExponential(1)} delays=[${frame.delays}]`);
        }
      },
      onEnd: () => {
        setSimActive(false);
        addLog('OK', 'Simulation completed');
      },
      onError: (e) => {
        setSimActive(false);
        addLog('ERR', 'SSE stream error');
      },
    });

    abortRef.current = abort;
  }, [simActive, simShape, addLog]);

  if (loading) {
    return (
      <div className="app-container">
        <div className="loading-screen">
          <div className="loading-spinner" />
          <p>Connecting to Tracer API...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-container">
        <div className="loading-screen">
          <p className="error-text">⚠ {error}</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            Make sure the API is running: <code>uvicorn tracer.api.main:app --reload</code>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Canvas + overlays wrapper — fills remaining space */}
      <div className="canvas-wrapper">
        {/* Header */}
        <div className="header">
          <div className="header-logo">L</div>
          <span className="header-title">Locus</span>
          <span className="header-subtitle">Sound Source Localization</span>
        </div>

        {/* Simulation Controls */}
        <div className="sim-controls">
          <select
            value={simShape}
            onChange={(e) => setSimShape(e.target.value)}
            disabled={simActive}
            className="sim-select"
          >
            {SIM_SHAPES.map((s) => (
              <option key={s} value={s}>{s.replace('_', ' ')}</option>
            ))}
          </select>
          <button
            className={`sim-btn ${simActive ? 'sim-btn--active' : ''}`}
            onClick={toggleSimulation}
          >
            {simActive ? '■ Stop' : '▶ Simulate'}
          </button>
        </div>

        {/* Controls hint */}
        <div className="controls-hint">
          <kbd>Drag</kbd> Rotate<br />
          <kbd>Scroll</kbd> Zoom<br />
          <kbd>Right-click</kbd> Pan
        </div>

        {/* 3D Canvas */}
        <div className="canvas-container">
          <Scene config={config} results={results} sourcePosition={sourcePosition} />
        </div>

        {/* UI Overlays */}
        <InfoPanel config={config} results={results} simActive={simActive} />
      </div>

      {/* Dev Log — sits below canvas-wrapper in document flow */}
      <DevLog logs={logs} isOpen={logOpen} onToggle={() => setLogOpen((o) => !o)} />
    </div>
  );
}

export default App;
