import { useState, useRef, useEffect } from 'react';

const LOG_LEVELS = {
    INFO: { color: '#4da6ff', prefix: 'INFO' },
    DATA: { color: '#ff8c42', prefix: 'DATA' },
    WARN: { color: '#f59e0b', prefix: 'WARN' },
    OK: { color: '#34d399', prefix: ' OK ' },
    ERR: { color: '#f87171', prefix: ' ERR' },
};

export default function DevLog({ logs, isOpen, onToggle }) {
    const logEndRef = useRef(null);

    useEffect(() => {
        if (isOpen && logEndRef.current) {
            logEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs, isOpen]);

    return (
        <div className={`dev-log ${isOpen ? 'dev-log--open' : ''}`}>
            {/* Toggle bar */}
            <button className="dev-log__toggle" onClick={onToggle}>
                <span className="dev-log__icon">{'>'}_</span>
                <span>Dev Log</span>
                <span className="dev-log__count">{logs.length}</span>
                <span className="dev-log__chevron">{isOpen ? '▼' : '▲'}</span>
            </button>

            {/* Log entries */}
            {isOpen && (
                <div className="dev-log__entries">
                    {logs.length === 0 && (
                        <div className="dev-log__empty">No log entries yet</div>
                    )}
                    {logs.map((entry, i) => {
                        const level = LOG_LEVELS[entry.level] || LOG_LEVELS.INFO;
                        return (
                            <div key={i} className="dev-log__entry">
                                <span className="dev-log__time">{entry.time}</span>
                                <span className="dev-log__level" style={{ color: level.color }}>
                                    [{level.prefix}]
                                </span>
                                <span className="dev-log__msg">{entry.message}</span>
                            </div>
                        );
                    })}
                    <div ref={logEndRef} />
                </div>
            )}
        </div>
    );
}

/**
 * Create a timestamped log entry.
 */
export function createLogEntry(level, message) {
    const now = new Date();
    const time = now.toLocaleTimeString('en-US', { hour12: false }) +
        '.' + String(now.getMilliseconds()).padStart(3, '0');
    return { time, level, message };
}
