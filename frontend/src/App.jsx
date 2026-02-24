import { useState, useEffect } from 'react';
import Scene from './components/Scene';
import InfoPanel from './components/InfoPanel';
import { fetchResults, fetchConfig, runPipeline } from './data/api';
import './index.css';

function App() {
  const [config, setConfig] = useState(null);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);

        // Fetch system config and results in parallel
        const [configData, resultsData] = await Promise.all([
          fetchConfig(),
          fetchResults(),
        ]);

        setConfig(configData);

        if (resultsData) {
          setResults(resultsData);
        } else {
          // No results yet — run the pipeline
          console.log('[Locus] No results found, running pipeline...');
          const pipelineData = await runPipeline();
          setResults(pipelineData);
        }
      } catch (err) {
        console.error('[Locus] Failed to load data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

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
      {/* Header */}
      <div className="header">
        <div className="header-logo">L</div>
        <span className="header-title">Locus</span>
        <span className="header-subtitle">Sound Source Localization</span>
      </div>

      {/* Controls hint */}
      <div className="controls-hint">
        <kbd>Drag</kbd> Rotate<br />
        <kbd>Scroll</kbd> Zoom<br />
        <kbd>Right-click</kbd> Pan
      </div>

      {/* 3D Canvas */}
      <div className="canvas-container">
        <Scene config={config} results={results} />
      </div>

      {/* UI Overlays */}
      <InfoPanel config={config} results={results} />
    </div>
  );
}

export default App;
