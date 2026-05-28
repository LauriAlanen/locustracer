import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html, Stars, Sphere, Line, MeshWobbleMaterial } from '@react-three/drei';
import * as THREE from 'three';

const SMOOTHING = 0.85;

function AudioNode({ id, position, type, audioDataRef, smoothedRmsRef, currentRms }) {
    const meshRef = useRef();
    const materialRef = useRef();

    useFrame(() => {
        // Fallback smoothing if not computed by parent
        const rms = currentRms[id] || 0;

        if (meshRef.current) {
            // Pulse size based on audio
            const scale = 1 + rms * 2.0;
            meshRef.current.scale.set(scale, scale, scale);
            
            // Adjust position slightly to simulate wobble based on volume
            meshRef.current.position.y = (Math.sin(Date.now() / 200 + position[0]) * rms);
        }
        
        if (materialRef.current) {
            // Increase emission based on volume
            materialRef.current.emissiveIntensity = 0.5 + rms * 3.0;
        }
    });

    const isMaster = type === 'master';
    const color = isMaster ? '#00f0ff' : '#b400ff';

    return (
        <group position={position}>
            <mesh ref={meshRef}>
                <sphereGeometry args={[0.5, 32, 32]} />
                <meshStandardMaterial 
                    ref={materialRef}
                    color={color} 
                    emissive={color}
                    emissiveIntensity={0.5}
                    roughness={0.2}
                    metalness={0.8}
                />
            </mesh>
            
            {/* Outline/Glow Ring */}
            <Sphere args={[0.6, 16, 16]}>
                <meshBasicMaterial color={color} transparent opacity={0.1} wireframe />
            </Sphere>

            {/* Floating HTML Label */}
            <Html position={[0, -1.2, 0]} center style={{ pointerEvents: 'none' }}>
                <div style={{
                    color: '#fff',
                    background: 'rgba(0,0,0,0.6)',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontFamily: 'Inter, sans-serif',
                    whiteSpace: 'nowrap',
                    border: `1px solid ${color}`,
                    textAlign: 'center'
                }}>
                    <div>{id}</div>
                    <div style={{ fontSize: '10px', opacity: 0.7 }}>{isMaster ? 'Master' : 'Listener'}</div>
                </div>
            </Html>
        </group>
    );
}

function SoundSource({ sourcePosition, intensity, connections }) {
    const meshRef = useRef();
    
    useFrame(({ clock }) => {
        if (meshRef.current) {
            // Smoothly move source point to the new calculated target
            meshRef.current.position.lerp(new THREE.Vector3(...sourcePosition), 0.1);
            
            // Dynamic scaling and wobbling
            const t = clock.getElapsedTime();
            const scale = 0.8 + (Math.sin(t * 10) * 0.2) + intensity * 2;
            meshRef.current.scale.set(scale, scale, scale);
        }
    });

    return (
        <group>
            {/* The Sound Origin Blip */}
            <mesh ref={meshRef} position={sourcePosition}>
                <sphereGeometry args={[0.4, 32, 32]} />
                <MeshWobbleMaterial 
                    color="#ff0055" 
                    emissive="#ff0055" 
                    emissiveIntensity={2 + intensity * 5}
                    factor={1} 
                    speed={2} 
                />
                <pointLight color="#ff0055" intensity={2 + intensity * 10} distance={10} />
            </mesh>
            
            {/* Rays connecting nodes to source */}
            {connections.map((conn, idx) => {
                if (conn.intensity < 0.05) return null;
                const points = [new THREE.Vector3(...conn.start), new THREE.Vector3(...sourcePosition)];
                return (
                    <Line 
                        key={`line-${idx}`}
                        points={points}
                        color="#ff0055"
                        lineWidth={1 + conn.intensity * 3}
                        transparent
                        opacity={conn.intensity}
                    />
                );
            })}
        </group>
    );
}

function Scene({ telemetryData, audioDataRef, masterNodeId }) {
    const smoothedRmsRef = useRef({});
    const [currentRms, setCurrentRms] = useState({});
    const [sourceTarget, setSourceTarget] = useState([0, 0, 0]);
    const [sourceIntensity, setSourceIntensity] = useState(0);
    const [connections, setConnections] = useState([]);

    const nodeLayout = useMemo(() => {
        if (!telemetryData) return { nodes: [], radius: 5 };

        const nodes = [];
        const radius = 5; // 3D units

        if (masterNodeId) {
            nodes.push({ id: masterNodeId, type: 'master', position: [0, 0, 0] });
        }

        const listeners = Object.keys(telemetryData.listener || {});
        listeners.forEach((listenerId, index) => {
            const angle = (index / listeners.length) * 2 * Math.PI;
            nodes.push({
                id: listenerId,
                type: 'listener',
                position: [radius * Math.cos(angle), 0, radius * Math.sin(angle)]
            });
        });

        const unknowns = Object.keys(telemetryData.unknown || {});
        unknowns.forEach((unknownId, index) => {
            const angle = ((index + listeners.length) / (listeners.length + unknowns.length)) * 2 * Math.PI;
            nodes.push({
                id: unknownId,
                type: 'unknown',
                position: [radius * Math.cos(angle), 0, radius * Math.sin(angle)]
            });
        });

        return { nodes, radius };
    }, [telemetryData, masterNodeId]);

    useFrame(() => {
        const audioData = audioDataRef.current || {};
        let totalWeightedX = 0;
        let totalWeightedZ = 0;
        let totalWeight = 0;
        let maxRms = 0;

        const newCurrentRms = {};
        const newConnections = [];

        nodeLayout.nodes.forEach(node => {
            const samples = audioData[node.id];
            let rms = 0;
            
            if (samples && samples.length > 0) {
                const chunk = samples.slice(-500);
                let sumSquares = 0;
                for (let i = 0; i < chunk.length; i++) {
                    const val = chunk[i] / 8388608.0; 
                    sumSquares += val * val;
                }
                rms = Math.sqrt(sumSquares / chunk.length);
                rms = Math.min(Math.max(rms, 0), 2.0);
            }

            const prevRms = smoothedRmsRef.current[node.id] || 0;
            const smoothed = prevRms * SMOOTHING + rms * (1 - SMOOTHING);
            smoothedRmsRef.current[node.id] = smoothed;
            newCurrentRms[node.id] = smoothed;

            if (smoothed > maxRms) maxRms = smoothed;

            if (smoothed > 0.01) {
                const weight = Math.pow(smoothed, 2); 
                totalWeightedX += node.position[0] * weight;
                totalWeightedZ += node.position[2] * weight;
                totalWeight += weight;
            }

            newConnections.push({
                start: node.position,
                intensity: smoothed
            });
        });

        setCurrentRms(newCurrentRms);

        if (totalWeight > 0.001) {
            const sourceX = totalWeightedX / totalWeight;
            const sourceZ = totalWeightedZ / totalWeight;
            setSourceTarget([sourceX, 0, sourceZ]);
            setSourceIntensity(maxRms);
            setConnections(newConnections);
        } else {
            setSourceIntensity(0);
            setConnections([]);
        }
    });

    // Radar grid floor
    const GridFloor = () => (
        <group position={[0, -1, 0]}>
            <gridHelper args={[20, 20, '#00f0ff', '#00f0ff']} position={[0, 0, 0]}>
                <meshBasicMaterial transparent opacity={0.15} />
            </gridHelper>
            {/* Concentric rings */}
            {[5, 10, 15].map((r, i) => (
                <mesh key={i} rotation={[-Math.PI / 2, 0, 0]}>
                    <ringGeometry args={[r - 0.05, r + 0.05, 64]} />
                    <meshBasicMaterial color="#00f0ff" transparent opacity={0.2} />
                </mesh>
            ))}
        </group>
    );

    return (
        <>
            <ambientLight intensity={0.2} />
            <pointLight position={[10, 10, 10]} intensity={0.5} color="#ffffff" />
            
            <GridFloor />
            
            {nodeLayout.nodes.map(node => (
                <AudioNode 
                    key={node.id}
                    id={node.id}
                    type={node.type}
                    position={node.position}
                    audioDataRef={audioDataRef}
                    smoothedRmsRef={smoothedRmsRef}
                    currentRms={currentRms}
                />
            ))}

            <SoundSource 
                sourcePosition={sourceTarget} 
                intensity={sourceIntensity} 
                connections={connections} 
            />

            <OrbitControls 
                makeDefault 
                autoRotate 
                autoRotateSpeed={0.5} 
                maxPolarAngle={Math.PI / 2 - 0.1} // Prevent going below the grid
                minDistance={5}
                maxDistance={25}
            />
            <Stars radius={50} depth={50} count={1000} factor={4} saturation={0} fade speed={1} />
        </>
    );
}

export function AudioLocationMap({ telemetryData, audioDataRef, masterNodeId }) {
    return (
        <div className="audio-map-wrapper">
            <Canvas camera={{ position: [0, 8, 12], fov: 60 }}>
                <color attach="background" args={['#050810']} />
                <Scene 
                    telemetryData={telemetryData} 
                    audioDataRef={audioDataRef} 
                    masterNodeId={masterNodeId} 
                />
            </Canvas>
        </div>
    );
}
