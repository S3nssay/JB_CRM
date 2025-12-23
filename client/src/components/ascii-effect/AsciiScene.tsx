import { useRef, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Float, TorusKnot, Sphere, Box } from '@react-three/drei';
import { AsciiEffect } from './AsciiEffect';
import * as THREE from 'three';

interface AsciiSceneProps {
    // Appearance
    color?: string;
    backgroundColor?: string;
    fontSize?: number;
    cellSize?: number;

    // Mouse Effects
    mouseGlowEnabled?: boolean;
    mouseGlowRadius?: number;
    mouseGlowIntensity?: number;
    distortionEnabled?: boolean;
    distortionStrength?: number;

    // Layout
    width?: string | number;
    height?: string | number;
    className?: string;
    style?: React.CSSProperties;

    // Scene Configuration
    variant?: 'torus' | 'spheres' | 'boxes' | 'abstract';
    animationSpeed?: number;
}

// Animated torus knot component
function AnimatedTorusKnot({ speed = 1 }: { speed?: number }) {
    const meshRef = useRef<THREE.Mesh>(null);

    return (
        <Float speed={speed} rotationIntensity={2} floatIntensity={1}>
            <TorusKnot ref={meshRef} args={[1, 0.4, 128, 32]}>
                <meshStandardMaterial color="white" wireframe={false} />
            </TorusKnot>
        </Float>
    );
}

// Floating spheres component
function FloatingSpheres({ count = 15, speed = 1 }: { count?: number; speed?: number }) {
    const spheres = useMemo(() => {
        return Array.from({ length: count }, (_, i) => ({
            position: [
                (Math.random() - 0.5) * 8,
                (Math.random() - 0.5) * 6,
                (Math.random() - 0.5) * 4,
            ] as [number, number, number],
            scale: 0.2 + Math.random() * 0.5,
            speed: 0.5 + Math.random() * 1.5,
        }));
    }, [count]);

    return (
        <>
            {spheres.map((sphere, i) => (
                <Float
                    key={i}
                    speed={sphere.speed * speed}
                    rotationIntensity={1}
                    floatIntensity={2}
                    position={sphere.position}
                >
                    <Sphere args={[sphere.scale, 32, 32]}>
                        <meshStandardMaterial color="white" />
                    </Sphere>
                </Float>
            ))}
        </>
    );
}

// Rotating boxes component
function RotatingBoxes({ count = 10, speed = 1 }: { count?: number; speed?: number }) {
    const boxes = useMemo(() => {
        return Array.from({ length: count }, (_, i) => ({
            position: [
                (Math.random() - 0.5) * 8,
                (Math.random() - 0.5) * 6,
                (Math.random() - 0.5) * 4,
            ] as [number, number, number],
            scale: 0.3 + Math.random() * 0.6,
            rotation: [Math.random() * Math.PI, Math.random() * Math.PI, 0] as [number, number, number],
        }));
    }, [count]);

    return (
        <>
            {boxes.map((box, i) => (
                <Float
                    key={i}
                    speed={0.5 + Math.random() * speed}
                    rotationIntensity={2}
                    floatIntensity={1}
                    position={box.position}
                >
                    <Box args={[box.scale, box.scale, box.scale]} rotation={box.rotation}>
                        <meshStandardMaterial color="white" />
                    </Box>
                </Float>
            ))}
        </>
    );
}

// Abstract scene with multiple shapes
function AbstractScene({ speed = 1 }: { speed?: number }) {
    return (
        <>
            <Float speed={speed * 0.5} rotationIntensity={1.5} floatIntensity={0.5} position={[0, 0, 0]}>
                <TorusKnot args={[1.2, 0.35, 128, 32]}>
                    <meshStandardMaterial color="white" />
                </TorusKnot>
            </Float>
            <FloatingSpheres count={8} speed={speed} />
            <RotatingBoxes count={5} speed={speed} />
        </>
    );
}

export function AsciiScene({
    color = '#00ff00',
    backgroundColor = '#0a0a0a',
    fontSize = 10,
    cellSize = 6,
    mouseGlowEnabled = true,
    mouseGlowRadius = 120,
    mouseGlowIntensity = 1.5,
    distortionEnabled = true,
    distortionStrength = 0.03,
    width = '100%',
    height = '100%',
    className = '',
    style = {},
    variant = 'torus',
    animationSpeed = 1,
}: AsciiSceneProps) {
    return (
        <div
            className={className}
            style={{
                width,
                height,
                position: 'relative',
                overflow: 'hidden',
                backgroundColor,
                ...style,
            }}
        >
            <Canvas
                camera={{ position: [0, 0, 5], fov: 50 }}
                style={{ background: 'transparent' }}
                gl={{ antialias: true }}
            >
                {/* Lighting */}
                <ambientLight intensity={0.3} />
                <directionalLight position={[5, 5, 5]} intensity={1} />
                <pointLight position={[-5, -5, 5]} intensity={0.5} />

                {/* Scene Content based on variant */}
                {variant === 'torus' && <AnimatedTorusKnot speed={animationSpeed} />}
                {variant === 'spheres' && <FloatingSpheres speed={animationSpeed} />}
                {variant === 'boxes' && <RotatingBoxes speed={animationSpeed} />}
                {variant === 'abstract' && <AbstractScene speed={animationSpeed} />}

                {/* ASCII Post-processing Effect with Mouse Distortion */}
                <AsciiEffect
                    fontSize={fontSize}
                    cellSize={cellSize}
                    color={color}
                    backgroundColor={backgroundColor}
                    mouseGlowEnabled={mouseGlowEnabled}
                    mouseGlowRadius={mouseGlowRadius}
                    mouseGlowIntensity={mouseGlowIntensity}
                    distortionEnabled={distortionEnabled}
                    distortionStrength={distortionStrength}
                />

                {/* Optional orbit controls for development */}
                {/* <OrbitControls enableZoom={false} enablePan={false} /> */}
            </Canvas>
        </div>
    );
}

export default AsciiScene;
