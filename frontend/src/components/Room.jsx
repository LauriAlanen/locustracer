import { useMemo } from 'react';
import * as THREE from 'three';
import { Text } from '@react-three/drei';

export default function Room({ width = 5, depth = 5, height = 3 }) {
    // Room edge lines
    const edgeGeometry = useMemo(() => {
        const points = [];

        // Floor rectangle
        points.push(new THREE.Vector3(0, 0, 0), new THREE.Vector3(width, 0, 0));
        points.push(new THREE.Vector3(width, 0, 0), new THREE.Vector3(width, 0, depth));
        points.push(new THREE.Vector3(width, 0, depth), new THREE.Vector3(0, 0, depth));
        points.push(new THREE.Vector3(0, 0, depth), new THREE.Vector3(0, 0, 0));

        // Ceiling rectangle
        points.push(new THREE.Vector3(0, height, 0), new THREE.Vector3(width, height, 0));
        points.push(new THREE.Vector3(width, height, 0), new THREE.Vector3(width, height, depth));
        points.push(new THREE.Vector3(width, height, depth), new THREE.Vector3(0, height, depth));
        points.push(new THREE.Vector3(0, height, depth), new THREE.Vector3(0, height, 0));

        // Vertical pillars
        points.push(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, height, 0));
        points.push(new THREE.Vector3(width, 0, 0), new THREE.Vector3(width, height, 0));
        points.push(new THREE.Vector3(width, 0, depth), new THREE.Vector3(width, height, depth));
        points.push(new THREE.Vector3(0, 0, depth), new THREE.Vector3(0, height, depth));

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        return geometry;
    }, [width, depth, height]);

    // Floor grid
    const gridLines = useMemo(() => {
        const points = [];
        const step = 0.5;

        // Lines along X
        for (let z = 0; z <= depth; z += step) {
            points.push(new THREE.Vector3(0, 0.001, z), new THREE.Vector3(width, 0.001, z));
        }
        // Lines along Z
        for (let x = 0; x <= width; x += step) {
            points.push(new THREE.Vector3(x, 0.001, 0), new THREE.Vector3(x, 0.001, depth));
        }

        return new THREE.BufferGeometry().setFromPoints(points);
    }, [width, depth]);

    return (
        <group>
            {/* Floor grid */}
            <lineSegments geometry={gridLines}>
                <lineBasicMaterial color="#1e1e3a" transparent opacity={0.8} />
            </lineSegments>

            {/* Meter markers on grid */}
            <lineSegments>
                <bufferGeometry>
                    {(() => {
                        const pts = [];
                        for (let z = 0; z <= depth; z += 1) {
                            pts.push(new THREE.Vector3(0, 0.002, z), new THREE.Vector3(width, 0.002, z));
                        }
                        for (let x = 0; x <= width; x += 1) {
                            pts.push(new THREE.Vector3(x, 0.002, 0), new THREE.Vector3(x, 0.002, depth));
                        }
                        const geo = new THREE.BufferGeometry().setFromPoints(pts);
                        return <bufferAttribute attach="attributes-position" {...geo.attributes.position} />;
                    })()}
                </bufferGeometry>
                <lineBasicMaterial color="#2a2a50" transparent opacity={1} />
            </lineSegments>

            {/* Room edges */}
            <lineSegments geometry={edgeGeometry}>
                <lineBasicMaterial color="#4da6ff" transparent opacity={0.5} />
            </lineSegments>

            {/* Semi-transparent floor */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[width / 2, -0.001, depth / 2]}>
                <planeGeometry args={[width, depth]} />
                <meshStandardMaterial
                    color="#0e0e1a"
                    transparent
                    opacity={0.7}
                    roughness={0.9}
                    metalness={0.1}
                />
            </mesh>

            {/* Semi-transparent walls */}
            {/* Back wall (z=0) */}
            <mesh position={[width / 2, height / 2, 0]}>
                <planeGeometry args={[width, height]} />
                <meshStandardMaterial
                    color="#0a0a15"
                    transparent
                    opacity={0.15}
                    side={THREE.DoubleSide}
                    roughness={1}
                />
            </mesh>

            {/* Left wall (x=0) */}
            <mesh position={[0, height / 2, depth / 2]} rotation={[0, Math.PI / 2, 0]}>
                <planeGeometry args={[depth, height]} />
                <meshStandardMaterial
                    color="#0a0a15"
                    transparent
                    opacity={0.15}
                    side={THREE.DoubleSide}
                    roughness={1}
                />
            </mesh>

            {/* Axis labels - no custom font prop, use drei default */}
            {[0, 1, 2, 3, 4, 5].map((v) => (
                <Text
                    key={`x-${v}`}
                    position={[v, 0, -0.3]}
                    rotation={[-Math.PI / 2, 0, 0]}
                    fontSize={0.18}
                    color="#6a6a8a"
                    anchorX="center"
                    anchorY="middle"
                >
                    {`${v}m`}
                </Text>
            ))}
            {[0, 1, 2, 3, 4, 5].map((v) => (
                <Text
                    key={`z-${v}`}
                    position={[-0.35, 0, v]}
                    rotation={[-Math.PI / 2, 0, 0]}
                    fontSize={0.18}
                    color="#6a6a8a"
                    anchorX="center"
                    anchorY="middle"
                >
                    {`${v}m`}
                </Text>
            ))}

            {/* Axis names */}
            <Text
                position={[width / 2, 0, -0.7]}
                rotation={[-Math.PI / 2, 0, 0]}
                fontSize={0.22}
                color="#4da6ff"
                anchorX="center"
            >
                X (meters)
            </Text>
            <Text
                position={[-0.8, 0, depth / 2]}
                rotation={[-Math.PI / 2, 0, Math.PI / 2]}
                fontSize={0.22}
                color="#4da6ff"
                anchorX="center"
            >
                Y (meters)
            </Text>
        </group>
    );
}
