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

        return new THREE.BufferGeometry().setFromPoints(points);
    }, [width, depth, height]);

    // Floor grid — use polygonOffset to avoid z-fighting with floor plane
    const gridLines = useMemo(() => {
        const points = [];
        const step = 0.5;

        for (let z = 0; z <= depth; z += step) {
            points.push(new THREE.Vector3(0, 0, z), new THREE.Vector3(width, 0, z));
        }
        for (let x = 0; x <= width; x += step) {
            points.push(new THREE.Vector3(x, 0, 0), new THREE.Vector3(x, 0, depth));
        }

        return new THREE.BufferGeometry().setFromPoints(points);
    }, [width, depth]);

    // Meter marker grid
    const meterLines = useMemo(() => {
        const pts = [];
        for (let z = 0; z <= depth; z += 1) {
            pts.push(new THREE.Vector3(0, 0, z), new THREE.Vector3(width, 0, z));
        }
        for (let x = 0; x <= width; x += 1) {
            pts.push(new THREE.Vector3(x, 0, 0), new THREE.Vector3(x, 0, depth));
        }
        return new THREE.BufferGeometry().setFromPoints(pts);
    }, [width, depth]);

    return (
        <group>
            {/* Semi-transparent floor — rendered first, uses polygonOffset to push behind grid lines */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[width / 2, 0, depth / 2]} renderOrder={0}>
                <planeGeometry args={[width, depth]} />
                <meshStandardMaterial
                    color="#0e0e1a"
                    transparent
                    opacity={0.7}
                    roughness={0.9}
                    metalness={0.1}
                    depthWrite={false}
                    polygonOffset
                    polygonOffsetFactor={4}
                    polygonOffsetUnits={4}
                />
            </mesh>

            {/* Floor grid — rendered above floor via polygonOffset */}
            <lineSegments geometry={gridLines} renderOrder={1}>
                <lineBasicMaterial color="#1e1e3a" transparent opacity={0.8} depthWrite={false} />
            </lineSegments>

            {/* Meter markers — slightly brighter, on top of sub-grid */}
            <lineSegments renderOrder={2}>
                <primitive object={meterLines} attach="geometry" />
                <lineBasicMaterial color="#2a2a50" transparent opacity={1} depthWrite={false} />
            </lineSegments>

            {/* Room edges — depthWrite off so floor plane doesn't hide them */}
            <lineSegments geometry={edgeGeometry} renderOrder={3}>
                <lineBasicMaterial color="#4da6ff" transparent opacity={0.5} depthWrite={false} />
            </lineSegments>

            {/* Semi-transparent walls — single-sided, no depth write */}
            <mesh position={[width / 2, height / 2, 0]} renderOrder={0}>
                <planeGeometry args={[width, height]} />
                <meshStandardMaterial
                    color="#0a0a15"
                    transparent
                    opacity={0.15}
                    roughness={1}
                    depthWrite={false}
                    side={THREE.FrontSide}
                />
            </mesh>

            <mesh position={[0, height / 2, depth / 2]} rotation={[0, Math.PI / 2, 0]} renderOrder={0}>
                <planeGeometry args={[depth, height]} />
                <meshStandardMaterial
                    color="#0a0a15"
                    transparent
                    opacity={0.15}
                    roughness={1}
                    depthWrite={false}
                    side={THREE.FrontSide}
                />
            </mesh>

            {/* Axis labels — use meshBasicMaterial to bypass lighting flicker */}
            {[0, 1, 2, 3, 4, 5].map((v) => (
                <Text
                    key={`x-${v}`}
                    position={[v, 0.01, -0.3]}
                    rotation={[-Math.PI / 2, 0, 0]}
                    fontSize={0.18}
                    anchorX="center"
                    anchorY="middle"
                    renderOrder={15}
                >
                    {`${v}m`}
                    <meshBasicMaterial
                        attach="material"
                        color="#6a6a8a"
                        transparent
                        opacity={0.8}
                        depthWrite={false}
                        depthTest={false}
                        toneMapped={false}
                    />
                </Text>
            ))}
            {[0, 1, 2, 3, 4, 5].map((v) => (
                <Text
                    key={`z-${v}`}
                    position={[-0.35, 0.01, v]}
                    rotation={[-Math.PI / 2, 0, 0]}
                    fontSize={0.18}
                    anchorX="center"
                    anchorY="middle"
                    renderOrder={15}
                >
                    {`${v}m`}
                    <meshBasicMaterial
                        attach="material"
                        color="#6a6a8a"
                        transparent
                        opacity={0.8}
                        depthWrite={false}
                        depthTest={false}
                        toneMapped={false}
                    />
                </Text>
            ))}

            {/* Axis names */}
            <Text
                position={[width / 2, 0.01, -0.7]}
                rotation={[-Math.PI / 2, 0, 0]}
                fontSize={0.22}
                anchorX="center"
                renderOrder={15}
            >
                X (meters)
                <meshBasicMaterial
                    attach="material"
                    color="#4da6ff"
                    transparent
                    opacity={0.9}
                    depthWrite={false}
                    depthTest={false}
                    toneMapped={false}
                />
            </Text>
            <Text
                position={[-0.8, 0.01, depth / 2]}
                rotation={[-Math.PI / 2, 0, Math.PI / 2]}
                fontSize={0.22}
                anchorX="center"
                renderOrder={15}
            >
                Y (meters)
                <meshBasicMaterial
                    attach="material"
                    color="#4da6ff"
                    transparent
                    opacity={0.9}
                    depthWrite={false}
                    depthTest={false}
                    toneMapped={false}
                />
            </Text>
        </group>
    );
}
