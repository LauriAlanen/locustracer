import { useState, useEffect } from 'react';

const API_SERVER_URL = import.meta.env.VITE_API_SERVER_URL || 'http://127.0.0.1:8009';

export function useTelemetry(pollingIntervalMs = 2000) {
    const [telemetryData, setTelemetryData] = useState(null);
    const [masterNodeId, setMasterNodeId] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchTelemetry = async () => {
            try {
                const response = await fetch(`${API_SERVER_URL}/telemetry`);
                if (!response.ok) throw new Error('Network response was not ok');
                const data = await response.json();
                
                setTelemetryData(data);
                setError(null);

                // Find master node ID
                let foundMaster = null;
                if (data.master) {
                    const masterKeys = Object.keys(data.master);
                    if (masterKeys.length > 0) {
                        foundMaster = masterKeys[0];
                    }
                }
                setMasterNodeId(foundMaster);

            } catch (err) {
                console.error("Could not fetch telemetry:", err);
                setError(err);
            }
        };

        fetchTelemetry();
        const intervalId = setInterval(fetchTelemetry, pollingIntervalMs);

        return () => clearInterval(intervalId);
    }, [pollingIntervalMs]);

    return { telemetryData, masterNodeId, error };
}
