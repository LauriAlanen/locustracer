import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Edges } from '@react-three/drei';
import { OrbitControls, Html, Stars, Sphere, Line, MeshWobbleMaterial, Text, Box } from '@react-three/drei';
import * as THREE from 'three';

// Convert API corner coords (origin at corner, 0–4m x, 0–3.5m y) to 3D world coords (origin at center)
const cornerToWorld = (cx, cy) => [cx - 2.0, 0, cy - 1.75];

// The 4 physical room corners (matches NodePositionEditor)
const ROOM_CORNERS = [
    { id: 'top-left', label: 'Top Left', x: 0.0, y: 0.0 },
    { id: 'top-right', label: 'Top Right', x: 4.0, y: 0.0 },
    { id: 'bottom-left', label: 'Bottom Left', x: 0.0, y: 3.5 },
    { id: 'bottom-right', label: 'Bottom Right', x: 4.0, y: 3.5 },
];

function CornerLabel({ position, label, ip, isReference }) {
    const worldPos = cornerToWorld(position.x, position.y);
    return (
        <group position={[worldPos[0], 0.15, worldPos[2]]}>
            {/* Corner pillar */}
            <mesh>
                <cylinderGeometry args={[0.04, 0.04, 0.3, 8]} />
                <meshStandardMaterial
                    color={isReference ? '#ffd700' : '#00f0ff'}
                    emissive={isReference ? '#ffd700' : '#00f0ff'}
                    emissiveIntensity={0.6}
                />
            </mesh>
            {/* Corner name */}
            <Text
                position={[0, 0.35, 0]}
                fontSize={0.18}
                color={isReference ? '#ffd700' : '#00d4ff'}
                anchorX="center"
                anchorY="bottom"
                outlineWidth={0.012}
                outlineColor="#000000"
            >
                {label}{isReference ? ' ⭐' : ''}
            </Text>
            {/* IP address */}
            {ip && (
                <Text
                    position={[0, 0.18, 0]}
                    fontSize={0.11}
                    color="rgba(255,255,255,0.7)"
                    anchorX="center"
                    anchorY="bottom"
                    outlineWidth={0.008}
                    outlineColor="#000000"
                >
                    {ip}
                </Text>
            )}
        </group>
    );
}

const SMOOTHING = 0.85;

function AudioNode({ id, position, type, audioDataRef, smoothedRmsRef, currentRms }) {
    const meshRef = useRef();
    const materialRef = useRef();

    useFrame(() => {
        const rms = currentRms[id] || 0;

        if (meshRef.current) {
            const scale = 1 + rms * 1.5;
            meshRef.current.scale.set(scale, scale, scale);
            meshRef.current.position.y = 0.86 + (Math.sin(Date.now() / 200 + position[0]) * rms * 0.5);
        }

        if (materialRef.current) {
            materialRef.current.emissiveIntensity = 0.5 + rms * 3.0;
        }
    });

    const isMaster = type === 'master';
    const color = isMaster ? '#00f0ff' : '#b400ff';

    return (
        <group position={position}>
            {/* The main glowing node core */}
            <mesh ref={meshRef} position={[0, 0.86, 0]}>
                <sphereGeometry args={[0.15, 32, 32]} />
                <meshStandardMaterial
                    ref={materialRef}
                    color={color}
                    emissive={color}
                    emissiveIntensity={0.5}
                    roughness={0.2}
                    metalness={0.8}
                />
            </mesh>

            {/* Node Stand/Base */}
            <Box args={[0.2, 0.05, 0.2]} position={[0, 0.025, 0]}>
                <meshStandardMaterial color="#333" metalness={0.8} roughness={0.2} />
            </Box>

            <Html position={[0, 1.2, 0]} center style={{ pointerEvents: 'none' }}>
                <div style={{
                    color: '#fff',
                    background: 'rgba(0,0,0,0.8)',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontFamily: 'Inter, sans-serif',
                    whiteSpace: 'nowrap',
                    border: `1px solid ${color}`,
                    textAlign: 'center'
                }}>
                    <div>{id}</div>
                    <div style={{ fontSize: '9px', opacity: 0.7 }}>{isMaster ? 'Master' : 'Listener'}</div>
                </div>
            </Html>
        </group>
    );
}

function SoundSource({ sourcePosition, intensity, connections }) {
    const meshRef = useRef();

    useFrame(({ clock }) => {
        if (meshRef.current) {
            meshRef.current.position.lerp(new THREE.Vector3(...sourcePosition), 0.1);

            const t = clock.getElapsedTime();
            const scale = 0.8 + (Math.sin(t * 10) * 0.2) + intensity * 2;
            meshRef.current.scale.set(scale, scale, scale);
        }
    });

    return (
        <group>
            <mesh ref={meshRef} position={sourcePosition}>
                <sphereGeometry args={[0.2, 32, 32]} />
                <MeshWobbleMaterial
                    color="#ff0055"
                    emissive="#ff0055"
                    emissiveIntensity={2 + intensity * 5}
                    factor={1}
                    speed={2}
                />
                <pointLight color="#ff0055" intensity={1 + intensity * 5} distance={6} />
            </mesh>

            {connections.map((conn, idx) => {
                if (conn.intensity < 0.05) return null;
                // Lift lines slightly so they don't clip through the floor
                const start = [conn.start[0], conn.start[1] + 0.86, conn.start[2]];
                const points = [new THREE.Vector3(...start), new THREE.Vector3(...sourcePosition)];
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

function CustomGrid({ roomW, roomD }) {
    const lines = [];
    // Z lines (parallel to X axis)
    for (let z = -roomD / 2; z <= roomD / 2 + 0.01; z += 0.25) {
        const isSection = Math.abs((z - (-roomD / 2)) % 1.0) < 0.01;
        lines.push(<Box key={`z-${z.toFixed(2)}`} args={[roomW, 0.001, isSection ? 0.015 : 0.005]} position={[0, 0, z]} material-color="#ffffff" material-transparent material-opacity={isSection ? 0.6 : 0.15} />);
    }
    // X lines (parallel to Z axis)
    for (let x = -roomW / 2; x <= roomW / 2 + 0.01; x += 0.25) {
        const isSection = Math.abs((x - (-roomW / 2)) % 1.0) < 0.01;
        lines.push(<Box key={`x-${x.toFixed(2)}`} args={[isSection ? 0.015 : 0.005, 0.001, roomD]} position={[x, 0, 0]} material-color="#ffffff" material-transparent material-opacity={isSection ? 0.6 : 0.15} />);
    }
    return <group position={[0, 0.002, 0]}>{lines}</group>;
}

function CeilingGrid({ roomW, roomD, yPos }) {
    const lines = [];
    const spacing = 0.6; // 60cm standard
    // Z lines
    for (let z = -roomD / 2; z <= roomD / 2 + 0.01; z += spacing) {
        lines.push(
            <Box key={`ceil-z-${z.toFixed(2)}`} args={[roomW, 0.01, 0.03]} position={[0, yPos, z]} receiveShadow castShadow>
                <meshStandardMaterial color="#999999" roughness={0.9} />
            </Box>
        );
    }
    // X lines
    for (let x = -roomW / 2; x <= roomW / 2 + 0.01; x += spacing) {
        lines.push(
            <Box key={`ceil-x-${x.toFixed(2)}`} args={[0.03, 0.01, roomD]} position={[x, yPos, 0]} receiveShadow castShadow>
                <meshStandardMaterial color="#999999" roughness={0.9} />
            </Box>
        );
    }
    return <group>{lines}</group>;
}

function HideWhenOutside({ children, side }) {
    const groupRef = useRef();
    useFrame(({ camera }) => {
        if (!groupRef.current) return;
        let hide = false;
        if (side === 'left' && camera.position.x < -2.0) hide = true;
        if (side === 'right' && camera.position.x > 2.0) hide = true;
        if (side === 'back' && camera.position.z < -1.75) hide = true;
        if (side === 'front' && camera.position.z > 1.75) hide = true;
        groupRef.current.visible = !hide;
    });
    return <group ref={groupRef}>{children}</group>;
}

function SimsRoom({ showAxes, showGrid, showInfo }) {
    const wallHeight = 3.40;
    const wallThickness = 0.1;
    const roomW = 4.0;
    const roomD = 3.5;

    return (
        <group position={[0, 0, 0]}>
            {/* Floor exactly 4.0m x 3.5m */}
            <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                <planeGeometry args={[roomW, roomD]} />
                {/* Bluish-gray mottled marble-like tone */}
                <meshStandardMaterial color="#94a1b0" roughness={0.3} metalness={0.1} />
                <Edges color="#788594" />
            </mesh>

            {/* Custom Grid aligned exactly to the corner */}
            {showGrid && <CustomGrid roomW={roomW} roomD={roomD} />}

            {/* Ceiling Grid at 2.70m */}
            <CeilingGrid roomW={roomW} roomD={roomD} yPos={2.70} />

            {showAxes && (
                <group position={[-3.0, 0.05, -2.75]}>
                    <axesHelper args={[2.5]} />
                    {/* Add labels to axes */}
                    <Text position={[2.6, 0.1, 0]} color="#ff4444" fontSize={0.2} anchorX="left">+X</Text>
                    <Text position={[0, 0.1, 2.6]} color="#4444ff" fontSize={0.2} anchorX="center">+Z</Text>
                    <Text position={[0, 2.6, 0]} color="#44ff44" fontSize={0.2} anchorY="bottom">+Y</Text>

                </group>
            )}

            {showInfo && (
                <group position={[-3.3, 0.01, -2.5]} rotation={[-Math.PI / 2, 0, -Math.PI / 2]}>
                    <Text position={[0, -0.3, 0]} color="#ffffff" fontSize={0.25} anchorX="left" anchorY="bottom" material-opacity={0.8} material-transparent>
                        Wapice HQ - Alfa
                    </Text>
                    <Text position={[0, -0.6, 0]} color="#aaaaaa" fontSize={0.15} anchorX="left" anchorY="bottom" material-opacity={0.6} material-transparent>
                        Yliopistonranta 5, 65200 Vaasa
                    </Text>
                </group>
            )}

            {/* Back Wall (4m) with Door */}
            {/* Left segment */}
            <mesh position={[-1.635, wallHeight / 2, -roomD / 2]}>
                <planeGeometry args={[0.73, wallHeight]} />
                <meshStandardMaterial color="#f0f4f8" side={THREE.FrontSide} transparent opacity={0.95} roughness={0.8} />
                <Edges color="#ffffff" />
            </mesh>
            {/* Right segment (Wall with 2 frosted windows) */}
            <group position={[0, 0, -roomD / 2]}>
                {/* Top strip of right segment (above windows/door, 2.1m to 3.4m) */}
                <mesh position={[0.815, 2.75, 0]}>
                    <planeGeometry args={[2.37, 1.3]} />
                    <meshStandardMaterial color="#f0f4f8" side={THREE.FrontSide} transparent opacity={0.95} roughness={0.8} />
                    <Edges color="#ffffff" />
                </mesh>

                {/* Far right strip of wall (between window 2 and corner, 0 to 2.1m) */}
                <mesh position={[1.915, 1.05, 0]}>
                    <planeGeometry args={[0.17, 2.1]} />
                    <meshStandardMaterial color="#f0f4f8" side={THREE.FrontSide} transparent opacity={0.95} roughness={0.8} />
                    <Edges color="#ffffff" />
                </mesh>

                {/* Frosted Glass Window 1 */}
                <mesh position={[0.18, 1.05, 0.01]}>
                    <planeGeometry args={[1.1, 2.1]} />
                    <meshStandardMaterial color="#ffffff" side={THREE.FrontSide} transparent opacity={0.85} roughness={0.7} metalness={0.2} />
                </mesh>
                {/* Frosted Glass Window 2 */}
                <mesh position={[1.28, 1.05, 0.01]}>
                    <planeGeometry args={[1.1, 2.1]} />
                    <meshStandardMaterial color="#ffffff" side={THREE.FrontSide} transparent opacity={0.85} roughness={0.7} metalness={0.2} />
                </mesh>

                {/* Frames for Window 1 */}
                <HideWhenOutside side="back">
                    <group position={[0.18, 1.05, 0.01]}>
                        <Box args={[1.1, 0.06, 0.04]} position={[0, 1.02, 0]}><meshStandardMaterial color="#dcb883" roughness={0.9} /></Box>
                        <Box args={[1.1, 0.06, 0.04]} position={[0, -1.02, 0]}><meshStandardMaterial color="#dcb883" roughness={0.9} /></Box>
                        <Box args={[0.06, 2.1 - 0.12, 0.04]} position={[-0.52, 0, 0]}><meshStandardMaterial color="#dcb883" roughness={0.9} /></Box>
                        <Box args={[0.06, 2.1 - 0.12, 0.04]} position={[0.52, 0, 0]}><meshStandardMaterial color="#dcb883" roughness={0.9} /></Box>
                    </group>
                </HideWhenOutside>

                {/* Frames for Window 2 */}
                <HideWhenOutside side="back">
                    <group position={[1.28, 1.05, 0.01]}>
                        <Box args={[1.1, 0.06, 0.04]} position={[0, 1.02, 0]}><meshStandardMaterial color="#dcb883" roughness={0.9} /></Box>
                        <Box args={[1.1, 0.06, 0.04]} position={[0, -1.02, 0]}><meshStandardMaterial color="#dcb883" roughness={0.9} /></Box>
                        <Box args={[0.06, 2.1 - 0.12, 0.04]} position={[-0.52, 0, 0]}><meshStandardMaterial color="#dcb883" roughness={0.9} /></Box>
                        <Box args={[0.06, 2.1 - 0.12, 0.04]} position={[0.52, 0, 0]}><meshStandardMaterial color="#dcb883" roughness={0.9} /></Box>
                    </group>
                </HideWhenOutside>
            </group>
            {/* Lintel */}
            <mesh position={[-0.82, 2.1 + (wallHeight - 2.1) / 2, -roomD / 2]}>
                <planeGeometry args={[0.90, wallHeight - 2.1]} />
                <meshStandardMaterial color="#f0f4f8" side={THREE.FrontSide} transparent opacity={0.95} roughness={0.8} />
                <Edges color="#ffffff" />
            </mesh>

            {/* Door Frames (Wood) */}
            <HideWhenOutside side="back">
                <group position={[0, 0, -roomD / 2 + 0.01]}>
                    {/* Top Frame */}
                    <Box args={[0.90, 0.06, 0.04]} position={[-0.82, 2.1 - 0.03, 0]}>
                        <meshStandardMaterial color="#dcb883" roughness={0.9} />
                    </Box>
                    {/* Left Frame (30cm wide towards the corner) */}
                    <Box args={[0.30, 2.1, 0.04]} position={[-1.42, 2.1 / 2, 0]}>
                        <meshStandardMaterial color="#dcb883" roughness={0.9} />
                    </Box>
                    {/* Right Frame */}
                    <Box args={[0.06, 2.1 - 0.06, 0.04]} position={[-0.37 - 0.03, (2.1 - 0.06) / 2, 0]}>
                        <meshStandardMaterial color="#dcb883" roughness={0.9} />
                    </Box>
                </group>
            </HideWhenOutside>

            {/* The Wooden Door (Rotated Open) */}
            {/* Pivot at the hinges: X = -0.43 (right side of the door opening) */}
            <HideWhenOutside side="back">
                <group position={[-0.43, 1.02, -roomD / 2 + 0.01]} rotation={[0, -Math.PI / 5, 0]}>
                    {/* Shift door so its right edge is at X=0 */}
                    <mesh position={[-0.42, 0, 0]}>
                        <planeGeometry args={[0.84, 2.04]} />
                        <meshStandardMaterial color="#dcb883" side={THREE.DoubleSide} roughness={0.9} />
                        <Edges color="#c09d6c" />

                        {/* Door Handle (Gray) on the left side (large frame side) */}
                        <group position={[-0.34, -0.02, 0]}>
                            {/* Front handle */}
                            <group position={[0, 0, 0.005]}>
                                <Box args={[0.04, 0.12, 0.01]} position={[0, 0, 0]}><meshStandardMaterial color="#888888" roughness={0.4} metalness={0.6} /></Box>
                                <Box args={[0.10, 0.02, 0.02]} position={[0.04, 0, 0.015]}><meshStandardMaterial color="#888888" roughness={0.4} metalness={0.6} /></Box>
                            </group>
                            {/* Back handle (mirrored Z) */}
                            <group position={[0, 0, -0.005]}>
                                <Box args={[0.04, 0.12, 0.01]} position={[0, 0, 0]}><meshStandardMaterial color="#888888" roughness={0.4} metalness={0.6} /></Box>
                                <Box args={[0.10, 0.02, 0.02]} position={[0.04, 0, -0.015]}><meshStandardMaterial color="#888888" roughness={0.4} metalness={0.6} /></Box>
                            </group>
                        </group>
                    </mesh>
                </group>
            </HideWhenOutside>

            {/* Front Wall (4m) with Windows spanning the whole width */}
            <group position={[0, wallHeight / 2, roomD / 2]} rotation={[0, Math.PI, 0]}>
                {/* Bottom Wall Strip (0 to 0.8m) */}
                <mesh position={[0, -1.3, 0]}>
                    <planeGeometry args={[roomW, 0.8]} />
                    <meshStandardMaterial color="#f0f4f8" side={THREE.FrontSide} transparent opacity={0.95} roughness={0.8} />
                    <Edges color="#ffffff" />
                </mesh>

                {/* Top Wall Strip (2.6m to 3.4m) */}
                <mesh position={[0, 1.3, 0]}>
                    <planeGeometry args={[roomW, 0.8]} />
                    <meshStandardMaterial color="#f0f4f8" side={THREE.FrontSide} transparent opacity={0.95} roughness={0.8} />
                    <Edges color="#ffffff" />
                </mesh>

                <group position={[0, 0, 0.01]}>
                    {/* 4 Window Panes taking up the full 4.0m width (1m wide each) */}
                    {[-1.5, -0.5, 0.5, 1.5].map((x, idx) => (
                        <mesh key={`pane-${idx}`} position={[x, 0, 0]}>
                            <planeGeometry args={[1.0, 1.8]} />
                            <meshStandardMaterial color="#0a1526" side={THREE.FrontSide} transparent opacity={0.2} metalness={0.9} roughness={0.1} />
                            <Edges color="#445566" />
                        </mesh>
                    ))}

                    {/* 3 Green Curtains (Left, Center, Right) */}
                    {/* Left Curtain */}
                    <mesh position={[-1.8, 0, 0.01]}>
                        <planeGeometry args={[0.4, 1.8]} />
                        <meshStandardMaterial color="#2a7a40" side={THREE.FrontSide} roughness={0.9} />
                    </mesh>

                    {/* Center Curtain */}
                    <mesh position={[0, 0, 0.01]}>
                        <planeGeometry args={[0.4, 1.8]} />
                        <meshStandardMaterial color="#2a7a40" side={THREE.FrontSide} roughness={0.9} />
                    </mesh>

                    {/* Right Curtain */}
                    <mesh position={[1.8, 0, 0.01]}>
                        <planeGeometry args={[0.4, 1.8]} />
                        <meshStandardMaterial color="#2a7a40" side={THREE.FrontSide} roughness={0.9} />
                    </mesh>
                </group>
            </group>

            {/* Left Wall (3.5m) */}
            <mesh position={[-roomW / 2, wallHeight / 2, 0]} rotation={[0, Math.PI / 2, 0]}>
                <planeGeometry args={[roomD, wallHeight]} />
                <meshStandardMaterial color="#f0f4f8" side={THREE.FrontSide} transparent opacity={0.95} roughness={0.8} />
                <Edges color="#ffffff" />
            </mesh>

            {/* Right Wall (3.5m) */}
            <group position={[roomW / 2, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
                {/* Wood lower section (0 to 2.6m) */}
                <mesh position={[0, 2.6 / 2, 0]}>
                    <planeGeometry args={[roomD, 2.6]} />
                    <meshStandardMaterial color="#dcb883" side={THREE.FrontSide} transparent opacity={0.95} roughness={0.9} />
                    <Edges color="#c09d6c" />
                </mesh>

                {/* Normal white wall upper section (2.6 to 3.4m) */}
                <mesh position={[0, 3.0, 0]}>
                    <planeGeometry args={[roomD, 0.8]} />
                    <meshStandardMaterial color="#f0f4f8" side={THREE.FrontSide} transparent opacity={0.95} roughness={0.8} />
                    <Edges color="#ffffff" />
                </mesh>
            </group>

            {/* TV (130cm wide) attached to the Left Wall, exactly in the middle */}
            <Box args={[0.05, 0.75, 1.3]} position={[-roomW / 2 + 0.025, 1.3, 0]}>
                <meshStandardMaterial color="#050505" roughness={0.2} metalness={0.8} />
                <Edges color="#333333" />
                {/* Glowing TV Screen */}
                <mesh position={[0.026, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
                    <planeGeometry args={[1.25, 0.70]} />
                    <meshBasicMaterial color="#001133" />
                </mesh>
            </Box>



            {/* Dimension Texts */}
            <Text position={[0, 0.05, roomD / 2 + 0.4]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.35} color="#00f0ff" outlineWidth={0.03} outlineColor="#000">
                4.0m
            </Text>
            <Text position={[0, 0.05, -roomD / 2 - 0.4]} rotation={[-Math.PI / 2, 0, Math.PI]} fontSize={0.35} color="#00f0ff" outlineWidth={0.03} outlineColor="#000">
                4.0m
            </Text>
            <Text position={[-roomW / 2 - 0.4, 0.05, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]} fontSize={0.35} color="#00f0ff" outlineWidth={0.03} outlineColor="#000">
                3.5m
            </Text>
            <Text position={[roomW / 2 + 0.4, 0.05, 0]} rotation={[-Math.PI / 2, 0, -Math.PI / 2]} fontSize={0.35} color="#00f0ff" outlineWidth={0.03} outlineColor="#000">
                3.5m
            </Text>
        </group>
    );
}

function ChestOfDrawers() {
    return (
        <group position={[-1.80, 0.75 / 2, 1.35]}>
            {/* Main body (0.4m deep, 0.75m high, 0.8m wide) */}
            <Box args={[0.40, 0.75, 0.80]} castShadow receiveShadow>
                <meshStandardMaterial color="#ffffff" roughness={0.7} />
                <Edges color="#cccccc" />
            </Box>
            {/* Sliding doors on the front face (positive X side) */}
            <group position={[0.20, 0, 0]}>
                {/* Left sliding door (back track) */}
                <Box args={[0.01, 0.72, 0.39]} position={[0, 0, -0.195]}>
                    <meshStandardMaterial color="#f8f8f8" roughness={0.7} />
                    <Edges color="#dddddd" />
                </Box>
                {/* Right sliding door (front track) */}
                <Box args={[0.01, 0.72, 0.39]} position={[0.015, 0, 0.195]}>
                    <meshStandardMaterial color="#f8f8f8" roughness={0.7} />
                    <Edges color="#dddddd" />
                </Box>
            </group>
        </group>
    );
}

function ConferenceTable() {
    return (
        <group position={[0, 0, 0]}>
            {/* Tabletop (Oval shape: length 2m along X, width 1m along Z) */}
            <mesh position={[0, 0.75, 0]} scale={[2.0, 1, 1.0]} receiveShadow castShadow>
                <cylinderGeometry args={[0.5, 0.5, 0.05, 64]} />
                <meshStandardMaterial color="#ffffff" roughness={0.2} />
                <Edges color="#cccccc" />
            </mesh>

            {/* Table Legs */}
            {[-0.5, 0.5].map((x, i) =>
                [-0.2, 0.2].map((z, j) => (
                    <Box key={`leg-${i}-${j}`} args={[0.05, 0.75, 0.05]} position={[x, 0.75 / 2, z]} receiveShadow castShadow>
                        <meshStandardMaterial color="#eeeeee" />
                    </Box>
                ))
            )}

            {/* Chairs (3 on back, 3 on front) */}
            {[-0.6, 0, 0.6].map((x, idx) => {
                return (
                    <React.Fragment key={`chairs-${idx}`}>
                        {/* Back Chair (facing table, Z=-0.65) */}
                        <group position={[x, 0, -0.65]}>
                            <Box args={[0.4, 0.05, 0.4]} position={[0, 0.45, 0]} receiveShadow castShadow>
                                <meshStandardMaterial color="#22aa44" roughness={0.6} />
                                <Edges color="#115522" />
                            </Box>
                            {/* Backrest (at the back of the seat, Z=-0.175) */}
                            <Box args={[0.4, 0.4, 0.05]} position={[0, 0.65, -0.175]} receiveShadow castShadow>
                                <meshStandardMaterial color="#22aa44" roughness={0.6} />
                                <Edges color="#115522" />
                            </Box>
                            {/* Chair Leg (Pedestal) */}
                            <Box args={[0.05, 0.45, 0.05]} position={[0, 0.45 / 2, 0]} receiveShadow castShadow>
                                <meshStandardMaterial color="#333333" />
                            </Box>
                        </group>

                        {/* Front Chair (facing table, Z=0.65) */}
                        <group position={[x, 0, 0.65]}>
                            <Box args={[0.4, 0.05, 0.4]} position={[0, 0.45, 0]} receiveShadow castShadow>
                                <meshStandardMaterial color="#22aa44" roughness={0.6} />
                                <Edges color="#115522" />
                            </Box>
                            {/* Backrest (at the front of the seat, Z=0.175) */}
                            <Box args={[0.4, 0.4, 0.05]} position={[0, 0.65, 0.175]} receiveShadow castShadow>
                                <meshStandardMaterial color="#22aa44" roughness={0.6} />
                                <Edges color="#115522" />
                            </Box>
                            {/* Chair Leg (Pedestal) */}
                            <Box args={[0.05, 0.45, 0.05]} position={[0, 0.45 / 2, 0]} receiveShadow castShadow>
                                <meshStandardMaterial color="#333333" />
                            </Box>
                        </group>
                    </React.Fragment>
                );
            })}
        </group>
    );
}

function Scene({ telemetryData, audioDataRef, positionDataRef, masterNodeId, showAxes, showGrid, showInfo, nodeConfig, showCornerLabels, positionMode }) {
    const smoothedRmsRef = useRef({});
    const [currentRms, setCurrentRms] = useState({});
    const [sourceTarget, setSourceTarget] = useState([0, 0.2, 0]);
    const [sourceIntensity, setSourceIntensity] = useState(0);
    const [connections, setConnections] = useState([]);

    const nodeLayout = useMemo(() => {
        if (!telemetryData) return { nodes: [] };

        const nodes = [];

        // If we have corner config from NodePositionEditor, use those real positions
        if (nodeConfig && nodeConfig.length > 0) {
            const allKnownIds = [
                ...Object.keys(telemetryData.master || {}),
                ...Object.keys(telemetryData.listener || {}),
                ...Object.keys(telemetryData.unknown || {}),
            ];
            nodeConfig.forEach(({ ip, x, y }) => {
                if (!allKnownIds.includes(ip)) return;
                const type = telemetryData.master?.[ip] ? 'master'
                    : telemetryData.listener?.[ip] ? 'listener' : 'unknown';
                // Convert from API coords (corner origin) to 3D world coords (center origin)
                nodes.push({ id: ip, type, position: [x - 2.0, 0, y - 1.75] });
            });
            return { nodes };
        }

        // Fallback: arrange nodes around the room perimeter
        const w = 4.0 - 0.4;
        const d = 3.5 - 0.4;
        const perimeter = 2 * w + 2 * d;

        if (masterNodeId) {
            nodes.push({ id: masterNodeId, type: 'master', position: [0, 0, 0] });
        }

        const listeners = Object.keys(telemetryData.listener || {});
        const unknowns = Object.keys(telemetryData.unknown || {});
        const peripheralNodes = [...listeners.map(id => ({ id, type: 'listener' })), ...unknowns.map(id => ({ id, type: 'unknown' }))];

        peripheralNodes.forEach((node, index) => {
            const t = index / peripheralNodes.length;
            let p = t * perimeter;
            let x = 0, z = 0;

            if (p < w) { x = -w / 2 + p; z = d / 2; }
            else if (p < w + d) { x = w / 2; z = d / 2 - (p - w); }
            else if (p < w + d + w) { x = w / 2 - (p - (w + d)); z = -d / 2; }
            else { x = -w / 2; z = -d / 2 + (p - (w + d + w)); }

            nodes.push({ id: node.id, type: node.type, position: [x, 0, z] });
        });

        return { nodes };
    }, [telemetryData, masterNodeId, nodeConfig]);

    useFrame(() => {
        const audioData = audioDataRef.current || {};
        let totalWeightedX = 0;
        let totalWeightedZ = 0;
        let totalWeight = 0;
        let maxRms = 0;

        const newCurrentRms = {};
        const newConnections = [];

        // Määritetään kynnysarvo (Threshold)
        // Esim. 0.05 tarkoittaa, että RMS-voimakkuuden pitää ylittää tämä, 
        // jotta mitään visualisoidaan.
        const RMS_THRESHOLD = 0.2;

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

        // TÄSTÄ ALKAA MUUTOS: 
        // Tarkistetaan ylittääkö huoneen kovin ääni (maxRms) asetetun kynnysarvon
        if (maxRms >= RMS_THRESHOLD && totalWeight > 0.001) {
            let sourceX, sourceZ;

            // Prefer true TDOA position from backend if available
            if (positionMode === 'cpp' && positionDataRef && positionDataRef.current && positionDataRef.current.x !== null && positionDataRef.current.y !== null) {
                // TDOA API coords: origin at reference corner (0–4m x, 0–3.5m y)
                // 3D world coords: origin at room center (-2–+2m x, -1.75–+1.75m z)
                // Offset: subtract half room dimensions to convert
                sourceX = positionDataRef.current.x - 2.0;
                sourceZ = positionDataRef.current.y - 1.75; // TDOA Y → 3D Z

                console.log("X", positionDataRef.current.x)
                console.log("Y", positionDataRef.current.y)
            } else {
                // Fallback: RMS-weighted average across nodes
                sourceX = totalWeightedX / totalWeight;
                sourceZ = totalWeightedZ / totalWeight;
            }

            // Constrain to room boundaries
            sourceX = Math.max(-2.0, Math.min(2.0, sourceX));
            sourceZ = Math.max(-1.75, Math.min(1.75, sourceZ));

            setSourceTarget([sourceX, 0.86, sourceZ]);
            setSourceIntensity(maxRms);
            setConnections(newConnections);
        } else {
            // Jos ääni alittaa kynnysarvon, nollataan visualisointi (taustahälyä ei näytetä)
            setSourceIntensity(0);
            setConnections([]);
        }
    });

    // Build corner labels from nodeConfig
    const cornerLabels = useMemo(() => {
        return ROOM_CORNERS.map(corner => {
            const assigned = nodeConfig?.find(n => {
                // Find which nodeConfig entry corresponds to this corner by coordinates
                return Math.abs(n.x - corner.x) < 0.1 && Math.abs(n.y - corner.y) < 0.1;
            });
            return { ...corner, ip: assigned?.ip || null };
        });
    }, [nodeConfig]);

    const referenceIp = nodeConfig?.find(n => n.isReference)?.ip || null;

    return (
        <>
            <ambientLight intensity={0.5} />
            <directionalLight position={[5, 10, 5]} intensity={0.3} />
            <pointLight position={[0, 2.65, 0]} intensity={1.0} color="#ffffff" castShadow shadow-mapSize={[1024, 1024]} />

            <SimsRoom showAxes={showAxes} showGrid={showGrid} showInfo={showInfo} />
            <ConferenceTable />
            <ChestOfDrawers />

            {/* Corner labels — only when node config editor is open */}
            {showCornerLabels && cornerLabels.map(corner => (
                <CornerLabel
                    key={corner.id}
                    position={corner}
                    label={corner.label}
                    ip={corner.ip}
                    isReference={corner.ip !== null && corner.ip === referenceIp}
                />
            ))}

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
                autoRotateSpeed={0.2}
                maxPolarAngle={Math.PI / 2 - 0.05}
                minDistance={3}
                maxDistance={15}
                target={[0, 0, 0]}
            />
            <Stars radius={50} depth={50} count={500} factor={4} saturation={0} fade speed={1} />
        </>
    );
}

export function AudioLocationMap({ telemetryData, audioDataRef, positionDataRef, masterNodeId, showAxes, showGrid, showInfo, nodeConfig, showCornerLabels, positionMode }) {
    const containerRef = useRef();
    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
        const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', onFsChange);
        return () => document.removeEventListener('fullscreenchange', onFsChange);
    }, []);

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            containerRef.current?.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    };

    return (
        <div ref={containerRef} className="audio-map-wrapper" style={{ position: 'relative' }}>
            <Canvas camera={{ position: [0, 5, 6], fov: 50 }} shadows>
                <color attach="background" args={['#050810']} />
                <Scene
                    telemetryData={telemetryData}
                    audioDataRef={audioDataRef}
                    positionDataRef={positionDataRef}
                    masterNodeId={masterNodeId}
                    showAxes={showAxes}
                    showGrid={showGrid}
                    showInfo={showInfo}
                    nodeConfig={nodeConfig}
                    showCornerLabels={showCornerLabels}
                    positionMode={positionMode}
                />
            </Canvas>

            {/* Fullscreen toggle button */}
            <button
                onClick={toggleFullscreen}
                title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    width: '36px',
                    height: '36px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(10, 15, 40, 0.75)',
                    border: '1px solid rgba(0, 240, 255, 0.3)',
                    borderRadius: '6px',
                    color: '#00f0ff',
                    cursor: 'pointer',
                    backdropFilter: 'blur(8px)',
                    zIndex: 10,
                    transition: 'background 0.15s, border-color 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,240,255,0.15)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(10,15,40,0.75)'}
            >
                {isFullscreen ? (
                    /* Compress icon */
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="4 14 10 14 10 20" />
                        <polyline points="20 10 14 10 14 4" />
                        <line x1="10" y1="14" x2="3" y2="21" />
                        <line x1="21" y1="3" x2="14" y2="10" />
                    </svg>
                ) : (
                    /* Expand icon */
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 3 21 3 21 9" />
                        <polyline points="9 21 3 21 3 15" />
                        <line x1="21" y1="3" x2="14" y2="10" />
                        <line x1="3" y1="21" x2="10" y2="14" />
                    </svg>
                )}
            </button>
        </div>
    );
}

