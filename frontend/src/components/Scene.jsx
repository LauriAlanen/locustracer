import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import Room from './Room';
import Microphone from './Microphone';
import ParticleSource from './ParticleSource';

export default function Scene({ config, results }) {
    const room = config.room;
    const mics = config.microphones;

    // Get the first source location from results
    const source = results.locations[0];
    // Convert 2D (x, y) → 3D (x, height, z). Place source at y=1.2m above floor
    const sourcePos = [source.position[0], 1.2, source.position[1]];

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
                toneMapping: 3, // ACESFilmicToneMapping
                toneMappingExposure: 1.5,
            }}
            style={{ background: '#06060c' }}
        >
            {/* Atmosphere */}
            <fog attach="fog" args={['#06060c', 15, 35]} />

            {/* Lighting */}
            <ambientLight intensity={0.3} color="#8890a4" />
            <pointLight position={[room.width / 2, 5, room.depth / 2]} intensity={0.8} color="#4da6ff" distance={20} decay={2} />
            <pointLight position={[source.position[0], 3, source.position[1]]} intensity={1.0} color="#ff8c42" distance={12} decay={2} />
            <pointLight position={[0, 2, 0]} intensity={0.3} color="#4da6ff" distance={10} decay={2} />
            <pointLight position={[room.width, 2, room.depth]} intensity={0.3} color="#4da6ff" distance={10} decay={2} />

            {/* Room */}
            <Room width={room.width} depth={room.depth} height={room.height} />

            {/* Microphones */}
            {mics.map((mic) => (
                <Microphone
                    key={mic.id}
                    position={mic.position}
                    label={mic.label}
                    color={mic.color}
                />
            ))}

            {/* Sound Source */}
            <ParticleSource position={sourcePos} />

            {/* Connection lines from source to each mic */}
            {mics.map((mic) => {
                const points = [
                    sourcePos[0], sourcePos[1], sourcePos[2],
                    mic.position[0], 0.15, mic.position[1],
                ];
                return (
                    <line key={`line-${mic.id}`}>
                        <bufferGeometry>
                            <bufferAttribute
                                attach="attributes-position"
                                count={2}
                                array={new Float32Array(points)}
                                itemSize={3}
                            />
                        </bufferGeometry>
                        <lineBasicMaterial color="#ff8c42" transparent opacity={0.12} />
                    </line>
                );
            })}

            {/* Camera Controls */}
            <OrbitControls
                target={[room.width / 2, 0.8, room.depth / 2]}
                enableDamping
                dampingFactor={0.05}
                minDistance={3}
                maxDistance={20}
                maxPolarAngle={Math.PI / 2 + 0.1}
            />

            {/* Bloom post-processing */}
            <EffectComposer>
                <Bloom
                    luminanceThreshold={0.2}
                    luminanceSmoothing={0.9}
                    intensity={1.0}
                    mipmapBlur
                />
            </EffectComposer>
        </Canvas>
    );
}
