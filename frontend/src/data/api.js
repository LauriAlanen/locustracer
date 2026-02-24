/**
 * API client for the Locus Tracer backend.
 *
 * All endpoints go through the Vite dev proxy (/api → localhost:8000).
 */

const API_BASE = '/api';

/**
 * Fetch the latest pipeline results.
 * @returns {Promise<Object>} Pipeline results with locations and segments.
 */
export async function fetchResults() {
  const res = await fetch(`${API_BASE}/tracer/results`);
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`Failed to fetch results: ${res.statusText}`);
  }
  return res.json();
}

/**
 * Trigger pipeline execution and return results.
 * @param {Object} options
 * @param {string} [options.input_file] - Custom input WAV path.
 * @param {boolean} [options.visualize=false] - Generate visualization plots.
 * @returns {Promise<Object>} Pipeline results.
 */
export async function runPipeline(options = {}) {
  const res = await fetch(`${API_BASE}/tracer/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || `Pipeline error: ${res.statusText}`);
  }
  return res.json();
}

/**
 * Fetch system configuration (room, microphones, constants).
 * @returns {Promise<Object>} System config.
 */
export async function fetchConfig() {
  const res = await fetch(`${API_BASE}/system/config`);
  if (!res.ok) throw new Error(`Failed to fetch config: ${res.statusText}`);
  return res.json();
}

/**
 * Health check.
 * @returns {Promise<Object>} { status: "ok", version: "0.1.0" }
 */
export async function checkHealth() {
  const res = await fetch(`${API_BASE}/system/health`);
  if (!res.ok) throw new Error(`Health check failed: ${res.statusText}`);
  return res.json();
}
