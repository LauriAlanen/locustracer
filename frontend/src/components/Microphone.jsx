import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';

export default function Microphone({ position, label, color = '#4da6ff' }) {
    const glowRef = useRef();
    const ringRef = useRef();

    useFrame(({ clock }) => {
        const t = clock.getElapsedTime();

        // Subtle glow pulsation
        if (glowRef.current) {
            glowRef.current.material.opacity = 0.2 + Math.sin(t * 1.5) * 0.1;
        }

        // Ring pulse
        if (ringRef.current) {
            const scale = 1 + Math.sin(t * 2) * 0.15;
            ringRef.current.scale.set(scale, scale, scale);
            ringRef.current.material.opacity = 0.4 - Math.sin(t * 2) * 0.2;
        }
    });

    // Convert 2D position (x, y) to 3D (x, heightAboveFloor, z)
    const pos3D = [position[0], 0.15, position[1]];

    return (
        <group position={pos3D}>
            {/* Main mic body */}
            <mesh>
                <boxGeometry args={[0.14, 0.14, 0.14]} />
                <meshStandardMaterial
                    color={color}
                    emissive={color}
                    emissiveIntensity={0.8}
                    roughness={0.3}
                    metalness={0.7}
                />
            </mesh>

            {/* Glow sphere */}
            <mesh ref={glowRef}>
                <sphereGeometry args={[0.25, 16, 16]} />
                <meshBasicMaterial
                    color={color}
                    transparent
                    opacity={0.2}
                    blending={THREE.AdditiveBlending}
                    depthWrite={false}
                />
            </mesh>

            {/* Pulse ring on floor */}
            <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.14, 0]}>
                <ringGeometry args={[0.18, 0.24, 32]} />
                <meshBasicMaterial
                    color={color}
                    transparent
                    opacity={0.4}
                    side={THREE.DoubleSide}
                    blending={THREE.AdditiveBlending}
                    depthWrite={false}
                />
            </mesh>

            {/* Label */}
            <Text
                position={[0, 0.4, 0]}
                fontSize={0.16}
                color="#a0a8c0"
                anchorX="center"
                anchorY="bottom"
            >
                {label}
            </Text>
        </group>
    );
}
