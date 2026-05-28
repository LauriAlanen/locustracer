import React, { useState, useEffect, useCallback } from 'react';
import { Save, Star, Wifi } from 'lucide-react';

const ROOM_W = 4.0;
const ROOM_H = 3.5;

const CORNERS = [
    { id: 'top-left',     label: 'Top Left',     x: 0.0,    y: 0.0,    gridRow: 1, gridCol: 1 },
    { id: 'top-right',    label: 'Top Right',    x: ROOM_W, y: 0.0,    gridRow: 1, gridCol: 2 },
    { id: 'bottom-left',  label: 'Bottom Left',  x: 0.0,    y: ROOM_H, gridRow: 2, gridCol: 1 },
    { id: 'bottom-right', label: 'Bottom Right', x: ROOM_W, y: ROOM_H, gridRow: 2, gridCol: 2 },
];

const HOST = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8009`;

export function NodePositionEditor({ telemetryData, onSaved }) {
    const [cornerAssignments, setCornerAssignments] = useState({
        'top-left': '', 'top-right': '', 'bottom-left': '', 'bottom-right': '',
    });
    const [referenceCorner, setReferenceCorner] = useState('top-left');
    const [saveStatus, setSaveStatus] = useState(null);
    const [statusMsg, setStatusMsg] = useState('');

    const allNodeIps = (() => {
        if (!telemetryData) return [];
        const ips = new Set();
        Object.values(telemetryData.master || {}).forEach(n => ips.add(n.node_id));
        Object.values(telemetryData.listener || {}).forEach(n => ips.add(n.node_id));
        Object.values(telemetryData.unknown || {}).forEach(n => ips.add(n.node_id));
        return [...ips].filter(Boolean);
    })();

    useEffect(() => {
        fetch(`${HOST}/nodes/config`)
            .then(r => r.json())
            .then(data => {
                if (!Array.isArray(data.nodes) || data.nodes.length === 0) return;
                const newAssignments = { 'top-left': '', 'top-right': '', 'bottom-left': '', 'bottom-right': '' };
                data.nodes.forEach(node => {
                    let bestCorner = null, bestDist = Infinity;
                    CORNERS.forEach(c => {
                        const d = Math.hypot(c.x - node.x, c.y - node.y);
                        if (d < bestDist) { bestDist = d; bestCorner = c.id; }
                    });
                    if (bestCorner && bestDist < 1.0) newAssignments[bestCorner] = node.ip;
                });
                setCornerAssignments(newAssignments);
                if (data.reference_node) {
                    const refEntry = data.nodes.find(n => n.ip === data.reference_node);
                    if (refEntry) {
                        let bestCorner = null, bestDist = Infinity;
                        CORNERS.forEach(c => {
                            const d = Math.hypot(c.x - refEntry.x, c.y - refEntry.y);
                            if (d < bestDist) { bestDist = d; bestCorner = c.id; }
                        });
                        if (bestCorner) setReferenceCorner(bestCorner);
                    }
                }
            })
            .catch(() => {});
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleCornerChange = useCallback((cornerId, ip) => {
        setCornerAssignments(prev => {
            const updated = { ...prev };
            if (ip) Object.keys(updated).forEach(k => { if (k !== cornerId && updated[k] === ip) updated[k] = ''; });
            updated[cornerId] = ip;
            return updated;
        });
    }, []);

    const handleSave = useCallback(async () => {
        const nodes = CORNERS
            .filter(c => cornerAssignments[c.id])
            .map(c => ({ ip: cornerAssignments[c.id], x: c.x, y: c.y }));

        if (nodes.length === 0) { setStatusMsg('Assign at least one node.'); setSaveStatus('error'); return; }

        const referenceIp = cornerAssignments[referenceCorner];
        const payload = { nodes };
        if (referenceIp) payload.reference_node = referenceIp;

        setSaveStatus('saving'); setStatusMsg('');
        try {
            const res = await fetch(`${HOST}/nodes/config`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
            });
            const json = await res.json();
            if (json.status === 'success') {
                setSaveStatus('ok');
                setStatusMsg('Saved & forwarded to C++ server!');
                // Notify parent with enriched config (mark reference node)
                if (onSaved) {
                    const enriched = nodes.map(n => ({
                        ...n,
                        isReference: n.ip === referenceIp,
                    }));
                    onSaved(enriched);
                }
            } else { setSaveStatus('error'); setStatusMsg(json.error || 'Unknown error.'); }
        } catch (err) { setSaveStatus('error'); setStatusMsg(`Network error: ${err.message}`); }
        setTimeout(() => setSaveStatus(null), 4000);
    }, [cornerAssignments, referenceCorner, onSaved]);

    const takenIps = new Set(Object.values(cornerAssignments).filter(Boolean));

    // Corner grid labels
    const cornerArrows = {
        'top-left':     '↖ Top Left',
        'top-right':    '↗ Top Right',
        'bottom-left':  '↙ Bottom Left',
        'bottom-right': '↘ Bottom Right',
    };

    return (
        <div style={panelStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <Wifi size={18} style={{ color: '#00f0ff' }} />
                <span style={{ color: '#e0e8ff', fontWeight: 700, fontSize: '0.95rem' }}>Node Position Config</span>
                <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.78rem', marginLeft: 'auto' }}>
                    {ROOM_W} m × {ROOM_H} m — assign each corner node
                </span>
            </div>

            {/* 2×2 corner grid */}
            <div style={gridStyle}>
                {CORNERS.map(corner => {
                    const isRef = referenceCorner === corner.id;
                    const assignedIp = cornerAssignments[corner.id];
                    return (
                        <div key={corner.id} style={cornerCardStyle(isRef)}>
                            {/* Glowing corner dot */}
                            <div style={dotStyle(isRef)} />

                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: isRef ? '#ffd700' : '#8ab4d4' }}>
                                    {cornerArrows[corner.id]}
                                </span>
                                {isRef && <Star size={12} fill="#ffd700" stroke="#ffd700" />}
                            </div>

                            <div style={{ fontSize: '0.66rem', color: 'rgba(255,255,255,0.3)', marginBottom: '8px' }}>
                                ({corner.x} m, {corner.y} m)
                            </div>

                            <select
                                value={assignedIp}
                                onChange={e => handleCornerChange(corner.id, e.target.value)}
                                style={selectStyle(isRef)}
                            >
                                <option value="">— unassigned —</option>
                                {allNodeIps.map(ip => (
                                    <option key={ip} value={ip} disabled={takenIps.has(ip) && ip !== assignedIp}>
                                        {ip}
                                    </option>
                                ))}
                            </select>

                            {assignedIp && (
                                <button
                                    onClick={() => setReferenceCorner(corner.id)}
                                    style={refBtnStyle(isRef)}
                                    title="Set as TDOA origin (reference node)"
                                >
                                    <Star size={10} />
                                    {isRef ? 'TDOA Origin ⭐' : 'Set as origin'}
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>

            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', margin: '12px 0 14px', lineHeight: 1.6 }}>
                ⭐ <strong style={{ color: 'rgba(255,255,255,0.55)' }}>Origin:</strong> TDOA positions are calculated relative to this corner.
                {cornerAssignments[referenceCorner]
                    ? <> &nbsp;<span style={{ color: '#ffd700' }}>{cornerAssignments[referenceCorner]}</span></>
                    : <span style={{ color: '#ff6b6b' }}> ⚠ No node at origin corner!</span>
                }
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <button onClick={handleSave} disabled={saveStatus === 'saving'} style={saveBtnStyle}>
                    <Save size={15} />
                    {saveStatus === 'saving' ? 'Saving…' : 'Save Positions'}
                </button>
                {statusMsg && (
                    <span style={{ fontSize: '0.8rem', color: saveStatus === 'ok' ? '#00f0b4' : '#ff6b6b' }}>
                        {statusMsg}
                    </span>
                )}
            </div>
        </div>
    );
}

// ---- Styles ----

const panelStyle = {
    background: 'rgba(10, 15, 40, 0.9)',
    border: '1px solid rgba(0, 240, 255, 0.18)',
    borderRadius: '12px',
    padding: '20px 24px',
    backdropFilter: 'blur(12px)',
    marginBottom: '16px',
};

const gridStyle = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px',
};

const cornerCardStyle = (isRef) => ({
    background: isRef ? 'rgba(255,215,0,0.09)' : 'rgba(255,255,255,0.04)',
    border: `1.5px solid ${isRef ? 'rgba(255,215,0,0.5)' : 'rgba(255,255,255,0.1)'}`,
    borderRadius: '8px',
    padding: '14px',
    position: 'relative',
    transition: 'border-color 0.2s, background 0.2s',
});

const dotStyle = (isRef) => ({
    width: '9px',
    height: '9px',
    borderRadius: '50%',
    background: isRef ? '#ffd700' : 'rgba(0,240,255,0.8)',
    boxShadow: isRef ? '0 0 10px #ffd700' : '0 0 7px rgba(0,240,255,0.6)',
    marginBottom: '10px',
});

const selectStyle = (isRef) => ({
    width: '100%',
    background: 'rgba(0,0,0,0.5)',
    border: `1px solid ${isRef ? 'rgba(255,215,0,0.5)' : 'rgba(255,255,255,0.15)'}`,
    borderRadius: '5px',
    color: '#e0e8ff',
    fontSize: '0.77rem',
    padding: '5px 6px',
    cursor: 'pointer',
    outline: 'none',
});

const refBtnStyle = (isRef) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '5px',
    marginTop: '8px',
    padding: '4px 0',
    width: '100%',
    fontSize: '0.7rem',
    background: isRef ? 'rgba(255,215,0,0.18)' : 'rgba(255,255,255,0.06)',
    border: `1px solid ${isRef ? 'rgba(255,215,0,0.5)' : 'rgba(255,255,255,0.12)'}`,
    color: isRef ? '#ffd700' : 'rgba(255,255,255,0.55)',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 600,
    transition: 'all 0.15s',
});

const saveBtnStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '7px',
    padding: '8px 18px',
    background: 'linear-gradient(135deg, rgba(0,240,255,0.18), rgba(100,80,255,0.18))',
    border: '1px solid rgba(0,240,255,0.4)',
    borderRadius: '6px',
    color: '#00f0ff',
    fontSize: '0.85rem',
    fontWeight: 700,
    cursor: 'pointer',
};
