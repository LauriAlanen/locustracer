import Scene from './components/Scene';
import InfoPanel from './components/InfoPanel';
import './index.css';

function App() {
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
        <Scene />
      </div>

      {/* UI Overlays */}
      <InfoPanel />
    </div>
  );
}

export default App;
