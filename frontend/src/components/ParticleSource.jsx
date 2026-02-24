import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const PARTICLE_COUNT = 600;
const SPHERE_RADIUS = 0.25;

export default function ParticleSource({ position = [0, 0, 0] }) {
    const pointsRef = useRef();
    const materialRef = useRef();

    // Generate particle positions in a sphere + random velocities
    const { positions, velocities, basePositions, colors, sizes } = useMemo(() => {
        const positions = new Float32Array(PARTICLE_COUNT * 3);
        const basePositions = new Float32Array(PARTICLE_COUNT * 3);
        const velocities = new Float32Array(PARTICLE_COUNT * 3);
        const colors = new Float32Array(PARTICLE_COUNT * 3);
        const sizes = new Float32Array(PARTICLE_COUNT);

        const colorInner = new THREE.Color('#ff8c42');   // warm orange
        const colorMid = new THREE.Color('#ff6b9d');     // pink
        const colorOuter = new THREE.Color('#4da6ff');   // cool blue

        for (let i = 0; i < PARTICLE_COUNT; i++) {
            // Fibonacci sphere distribution for even spacing
            const phi = Math.acos(1 - 2 * (i + 0.5) / PARTICLE_COUNT);
            const theta = Math.PI * (1 + Math.sqrt(5)) * i;

            // Random radius within sphere (weighted toward surface)
            const r = SPHERE_RADIUS * Math.pow(Math.random(), 0.4);

            const x = r * Math.sin(phi) * Math.cos(theta);
            const y = r * Math.sin(phi) * Math.sin(theta);
            const z = r * Math.cos(phi);

            const idx = i * 3;
            positions[idx] = x;
            positions[idx + 1] = y;
            positions[idx + 2] = z;

            basePositions[idx] = x;
            basePositions[idx + 1] = y;
            basePositions[idx + 2] = z;

            // Random outward velocity for pulsing
            const speed = 0.3 + Math.random() * 0.7;
            velocities[idx] = (x / (r || 0.01)) * speed;
            velocities[idx + 1] = (y / (r || 0.01)) * speed;
            velocities[idx + 2] = (z / (r || 0.01)) * speed;

            // Color based on distance from center
            const t = r / SPHERE_RADIUS;
            const color = new THREE.Color();
            if (t < 0.5) {
                color.lerpColors(colorInner, colorMid, t * 2);
            } else {
                color.lerpColors(colorMid, colorOuter, (t - 0.5) * 2);
            }
            colors[idx] = color.r;
            colors[idx + 1] = color.g;
            colors[idx + 2] = color.b;

            // Size variation
            sizes[i] = 0.02 + Math.random() * 0.04;
        }

        return { positions, velocities, basePositions, colors, sizes };
    }, []);

    useFrame(({ clock }) => {
        if (!pointsRef.current) return;

        const time = clock.getElapsedTime();
        const posArray = pointsRef.current.geometry.attributes.position.array;
        const sizeArray = pointsRef.current.geometry.attributes.size.array;

        // Multiple frequency pulsation
        const pulse1 = Math.sin(time * 2.0) * 0.5 + 0.5;       // slow pulse
        const pulse2 = Math.sin(time * 4.5) * 0.3 + 0.5;       // faster pulse
        const pulse3 = Math.sin(time * 1.2) * 0.2 + 0.5;       // very slow breathe
        const combinedPulse = (pulse1 * 0.5 + pulse2 * 0.3 + pulse3 * 0.2);

        const expansion = 0.6 + combinedPulse * 0.8;  // scale range: 0.6 - 1.4

        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const idx = i * 3;

            // Pulsing: expand/contract from base position
            posArray[idx] = basePositions[idx] * expansion + Math.sin(time * 1.5 + i * 0.1) * 0.008;
            posArray[idx + 1] = basePositions[idx + 1] * expansion + Math.cos(time * 1.8 + i * 0.15) * 0.008;
            posArray[idx + 2] = basePositions[idx + 2] * expansion + Math.sin(time * 2.1 + i * 0.12) * 0.008;

            // Pulsing size
            sizeArray[i] = sizes[i] * (0.7 + combinedPulse * 0.6);
        }

        pointsRef.current.geometry.attributes.position.needsUpdate = true;
        pointsRef.current.geometry.attributes.size.needsUpdate = true;

        // Slow rotation
        pointsRef.current.rotation.y = time * 0.15;
        pointsRef.current.rotation.x = Math.sin(time * 0.1) * 0.1;

        // Material opacity pulse
        if (materialRef.current) {
            materialRef.current.opacity = 0.6 + combinedPulse * 0.4;
        }
    });

    return (
        <group position={position}>
            {/* Core glow sphere */}
            <mesh>
                <sphereGeometry args={[0.06, 16, 16]} />
                <meshBasicMaterial
                    color="#ff8c42"
                    transparent
                    opacity={0.9}
                />
            </mesh>

            {/* Inner glow */}
            <mesh>
                <sphereGeometry args={[0.12, 16, 16]} />
                <meshBasicMaterial
                    color="#ff6b3d"
                    transparent
                    opacity={0.25}
                />
            </mesh>

            {/* Particle system */}
            <points ref={pointsRef}>
                <bufferGeometry>
                    <bufferAttribute
                        attach="attributes-position"
                        count={PARTICLE_COUNT}
                        array={positions}
                        itemSize={3}
                    />
                    <bufferAttribute
                        attach="attributes-color"
                        count={PARTICLE_COUNT}
                        array={colors}
                        itemSize={3}
                    />
                    <bufferAttribute
                        attach="attributes-size"
                        count={PARTICLE_COUNT}
                        array={sizes}
                        itemSize={1}
                    />
                </bufferGeometry>
                <pointsMaterial
                    ref={materialRef}
                    size={0.04}
                    vertexColors
                    transparent
                    opacity={0.8}
                    sizeAttenuation
                    blending={THREE.AdditiveBlending}
                    depthWrite={false}
                />
            </points>

            {/* Ground shadow / glow */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -position[1] + 0.01, 0]}>
                <circleGeometry args={[0.4, 32]} />
                <meshBasicMaterial
                    color="#ff8c42"
                    transparent
                    opacity={0.08}
                    side={THREE.DoubleSide}
                />
            </mesh>
        </group>
    );
}
