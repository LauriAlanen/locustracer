import { useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import Room from './Room';
import Microphone from './Microphone';
import ParticleSource from './ParticleSource';

const LERP_SMOOTHING = 0.0015;

/**
 * Wrapper that manages interpolated position for both the
 * ParticleSource and ConnectionLines, keeping them in sync.
 */
function InterpolatedSource({ targetPosition, mics }) {
    const groupRef = useRef();
    const linesGroupRef = useRef();
    const targetPos = useRef(new THREE.Vector3(...targetPosition));
    const currentPos = useRef(new THREE.Vector3(...targetPosition));

    // Store mic 3D positions for line updates
    const micPositions3D = mics.map((m) => new THREE.Vector3(m.position[0], 0.15, m.position[1]));

    useEffect(() => {
        targetPos.current.set(targetPosition[0], targetPosition[1], targetPosition[2]);
    }, [targetPosition]);

    useFrame((_, delta) => {
        const lerpFactor = 1 - Math.pow(LERP_SMOOTHING, delta);
        currentPos.current.lerp(targetPos.current, lerpFactor);

        // Update lines to follow interpolated position
        if (linesGroupRef.current) {
            const children = linesGroupRef.current.children;
            for (let i = 0; i < children.length; i++) {
                const line = children[i];
                if (line.geometry) {
                    const posAttr = line.geometry.attributes.position;
                    // Update source end (first vertex)
                    posAttr.array[0] = currentPos.current.x;
                    posAttr.array[1] = currentPos.current.y;
                    posAttr.array[2] = currentPos.current.z;
                    posAttr.needsUpdate = true;
                }
            }
        }
    });

    return (
        <>
            {/* Particle source — manages its own lerp internally */}
            <ParticleSource position={targetPosition} />

            {/* Connection lines — updated each frame to follow interpolated pos */}
            <group ref={linesGroupRef}>
                {mics.map((mic) => {
                    const points = new Float32Array([
                        targetPosition[0], targetPosition[1], targetPosition[2],
                        mic.position[0], 0.15, mic.position[1],
                    ]);
                    return (
                        <line key={`line-${mic.id}`}>
                            <bufferGeometry>
                                <bufferAttribute
                                    attach="attributes-position"
                                    count={2}
                                    array={points}
                                    itemSize={3}
                                />
                            </bufferGeometry>
                            <lineBasicMaterial color="#ff8c42" transparent opacity={0.12} />
                        </line>
                    );
                })}
            </group>
        </>
    );
}

export default function Scene({ config, results, sourcePosition }) {
    const room = config.room;
    const mics = config.microphones;

    const source = results.locations[0];
    const sourcePos = sourcePosition || [source.position[0], 1.2, source.position[1]];

    return (
        <Canvas
            camera={{
                position: [6, 5, 8],
                fov: 50,
                near: 0.1,
                far: 100,
            }}
            gl={{
                antialias: true,
                toneMapping: 3,
                toneMappingExposure: 1.5,
                powerPreference: 'high-performance',
            }}
            frameloop="always"
            style={{ background: '#06060c' }}
        >
            <fog attach="fog" args={['#06060c', 15, 35]} />

            <ambientLight intensity={0.3} color="#8890a4" />
            <pointLight position={[room.width / 2, 5, room.depth / 2]} intensity={0.8} color="#4da6ff" distance={20} decay={2} />
            <pointLight position={[sourcePos[0], 3, sourcePos[2]]} intensity={1.0} color="#ff8c42" distance={12} decay={2} />
            <pointLight position={[0, 2, 0]} intensity={0.3} color="#4da6ff" distance={10} decay={2} />
            <pointLight position={[room.width, 2, room.depth]} intensity={0.3} color="#4da6ff" distance={10} decay={2} />

            <Room width={room.width} depth={room.depth} height={room.height} />

            {mics.map((mic) => (
                <Microphone key={mic.id} position={mic.position} label={mic.label} color={mic.color} />
            ))}

            {/* Single component handles both particle + lines with shared interpolation */}
            <InterpolatedSource targetPosition={sourcePos} mics={mics} />

            <OrbitControls
                target={[room.width / 2, 0.8, room.depth / 2]}
                enableDamping
                dampingFactor={0.05}
                minDistance={3}
                maxDistance={20}
                maxPolarAngle={Math.PI / 2 + 0.1}
            />

            <EffectComposer>
                <Bloom luminanceThreshold={0.2} luminanceSmoothing={0.9} intensity={1.0} mipmapBlur />
            </EffectComposer>
        </Canvas>
    );
}
