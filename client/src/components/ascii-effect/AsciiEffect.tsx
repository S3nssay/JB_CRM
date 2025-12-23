import { useMemo, useEffect, useState, useRef, forwardRef, useImperativeHandle } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector2, WebGLRenderTarget, LinearFilter, Mesh, PlaneGeometry, ShaderMaterial } from 'three';

// ASCII Characters from dark to light
const ASCII_CHARS = ' .:-=+*#%@';

interface AsciiEffectProps {
    fontSize?: number;
    cellSize?: number;
    color?: string;
    backgroundColor?: string;
    invert?: boolean;
    mouseGlowEnabled?: boolean;
    mouseGlowRadius?: number;
    mouseGlowIntensity?: number;
    distortionEnabled?: boolean;
    distortionStrength?: number;
}

// Custom ASCII post-processing using render targets
export const AsciiEffect = forwardRef<any, AsciiEffectProps>(({
    fontSize = 12,
    cellSize = 8,
    color = '#00ff00',
    backgroundColor = '#000000',
    invert = false,
    mouseGlowEnabled = true,
    mouseGlowRadius = 150,
    mouseGlowIntensity = 2.0,
    distortionEnabled = true,
    distortionStrength = 0.05,
}, ref) => {
    const { gl, size, scene, camera } = useThree();
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
    const renderTargetRef = useRef<WebGLRenderTarget | null>(null);
    const mousePos = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });
    const timeRef = useRef(0);

    // Expose mouse position for external distortion effects
    useImperativeHandle(ref, () => ({
        getMousePosition: () => mousePos.current,
        setMousePosition: (x: number, y: number) => {
            mousePos.current.targetX = x;
            mousePos.current.targetY = y;
        }
    }));

    // Create ASCII overlay canvas
    useEffect(() => {
        const canvas = document.createElement('canvas');
        canvas.style.position = 'absolute';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.pointerEvents = 'none';
        canvas.style.zIndex = '10';

        const container = gl.domElement.parentElement;
        if (container) {
            container.appendChild(canvas);
            container.style.position = 'relative';

            // Track mouse movement for distortion effect
            const handleMouseMove = (e: MouseEvent) => {
                const rect = container.getBoundingClientRect();
                mousePos.current.targetX = e.clientX - rect.left;
                mousePos.current.targetY = e.clientY - rect.top;
            };

            container.addEventListener('mousemove', handleMouseMove);

            canvasRef.current = canvas;
            ctxRef.current = canvas.getContext('2d');

            return () => {
                container.removeEventListener('mousemove', handleMouseMove);
                container.removeChild(canvas);
            };
        }
    }, [gl]);

    // Create render target for capturing scene
    useEffect(() => {
        renderTargetRef.current = new WebGLRenderTarget(size.width, size.height, {
            minFilter: LinearFilter,
            magFilter: LinearFilter,
        });

        return () => {
            renderTargetRef.current?.dispose();
        };
    }, [size]);

    // Update canvas size
    useEffect(() => {
        if (canvasRef.current) {
            canvasRef.current.width = size.width;
            canvasRef.current.height = size.height;
        }
        if (renderTargetRef.current) {
            renderTargetRef.current.setSize(size.width, size.height);
        }
    }, [size]);

    // Convert brightness to ASCII character
    const brightnessToChar = (brightness: number) => {
        const index = Math.floor(brightness * (ASCII_CHARS.length - 1));
        return ASCII_CHARS[invert ? ASCII_CHARS.length - 1 - index : index];
    };

    // Frame loop - render ASCII effect
    useFrame((state, delta) => {
        if (!canvasRef.current || !ctxRef.current || !renderTargetRef.current) return;

        const ctx = ctxRef.current;
        const canvas = canvasRef.current;
        const renderTarget = renderTargetRef.current;

        timeRef.current += delta;

        // Smooth mouse position interpolation
        mousePos.current.x += (mousePos.current.targetX - mousePos.current.x) * 0.1;
        mousePos.current.y += (mousePos.current.targetY - mousePos.current.y) * 0.1;

        // Render scene to offscreen buffer
        gl.setRenderTarget(renderTarget);
        gl.render(scene, camera);
        gl.setRenderTarget(null);

        // Read pixels from render target
        const pixels = new Uint8Array(size.width * size.height * 4);
        gl.readRenderTargetPixels(renderTarget, 0, 0, size.width, size.height, pixels);

        // Clear canvas
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Set font
        ctx.font = `${fontSize}px "Courier New", monospace`;
        ctx.textBaseline = 'top';

        const cols = Math.ceil(canvas.width / cellSize);
        const rows = Math.ceil(canvas.height / cellSize);

        // Render ASCII characters
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                let x = col * cellSize;
                let y = row * cellSize;

                // Apply mouse distortion effect
                if (distortionEnabled && mouseGlowEnabled) {
                    const dx = x - mousePos.current.x;
                    const dy = y - mousePos.current.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < mouseGlowRadius * 2) {
                        const distortFactor = Math.max(0, 1 - dist / (mouseGlowRadius * 2));
                        const wave = Math.sin(timeRef.current * 5 + dist * 0.02) * distortionStrength * 100;
                        const pushX = (dx / (dist || 1)) * distortFactor * wave;
                        const pushY = (dy / (dist || 1)) * distortFactor * wave;
                        x += pushX;
                        y += pushY;
                    }
                }

                // Sample pixel (flip Y because WebGL is bottom-up)
                const sampleX = Math.min(Math.max(0, Math.floor(x)), size.width - 1);
                const sampleY = Math.min(Math.max(0, size.height - 1 - Math.floor(y)), size.height - 1);
                const i = (sampleY * size.width + sampleX) * 4;

                const r = pixels[i] / 255;
                const g = pixels[i + 1] / 255;
                const b = pixels[i + 2] / 255;

                // Calculate brightness
                const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
                const char = brightnessToChar(brightness);

                if (char !== ' ') {
                    // Calculate glow effect near mouse
                    let charColor = color;
                    let alpha = 1;

                    if (mouseGlowEnabled) {
                        const dx = (col * cellSize) - mousePos.current.x;
                        const dy = (row * cellSize) - mousePos.current.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);

                        if (dist < mouseGlowRadius) {
                            const glowFactor = 1 - (dist / mouseGlowRadius);
                            const glowIntensity = glowFactor * mouseGlowIntensity;

                            // Parse color and increase brightness
                            const baseR = parseInt(color.slice(1, 3), 16);
                            const baseG = parseInt(color.slice(3, 5), 16);
                            const baseB = parseInt(color.slice(5, 7), 16);

                            const newR = Math.min(255, Math.floor(baseR + (255 - baseR) * glowIntensity * 0.5));
                            const newG = Math.min(255, Math.floor(baseG + (255 - baseG) * glowIntensity * 0.5));
                            const newB = Math.min(255, Math.floor(baseB + (255 - baseB) * glowIntensity * 0.5));

                            charColor = `rgb(${newR}, ${newG}, ${newB})`;
                            alpha = Math.min(1, 0.8 + glowIntensity * 0.2);
                        }
                    }

                    ctx.fillStyle = charColor;
                    ctx.globalAlpha = alpha;
                    ctx.fillText(char, col * cellSize, row * cellSize);
                }
            }
        }

        ctx.globalAlpha = 1;
    });

    return null;
});

AsciiEffect.displayName = 'AsciiEffect';

export default AsciiEffect;
