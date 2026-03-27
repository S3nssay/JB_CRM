import { useEffect, useRef } from 'react';

interface HolographicBackgroundProps {
  className?: string;
}

export function HolographicBackground({ className = '' }: HolographicBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0.5, y: 0.5 });
  const targetMouseRef = useRef({ x: 0.5, y: 0.5 });
  const animationRef = useRef<number>();
  const timeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let canvasWidth = 0;
    let canvasHeight = 0;

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvasWidth = rect.width;
      canvasHeight = rect.height;
      ctx.scale(dpr, dpr);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      targetMouseRef.current = {
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height
      };
    };

    window.addEventListener('mousemove', handleMouseMove);

    const drawWave = (
      ctx: CanvasRenderingContext2D,
      width: number,
      height: number,
      time: number,
      mouseX: number,
      mouseY: number,
      waveConfig: {
        baseY: number;
        amplitude: number;
        frequency: number;
        speed: number;
        color1: string;
        color2: string;
        color3: string;
        mouseInfluence: number;
      }
    ) => {
      const { baseY, amplitude, frequency, speed, color1, color2, color3, mouseInfluence } = waveConfig;
      
      ctx.beginPath();
      ctx.moveTo(0, height);

      for (let x = 0; x <= width; x += 2) {
        const normalizedX = x / width;
        const distFromMouse = Math.sqrt(
          Math.pow(normalizedX - mouseX, 2) + 
          Math.pow(baseY - mouseY, 2)
        );
        
        const mouseWave = Math.sin(distFromMouse * 8 - time * 2) * mouseInfluence * (1 - distFromMouse);
        
        const y = height * baseY + 
          Math.sin(normalizedX * frequency + time * speed) * amplitude * height +
          Math.sin(normalizedX * frequency * 0.5 + time * speed * 1.3) * amplitude * height * 0.5 +
          Math.cos(normalizedX * frequency * 2 - time * speed * 0.7) * amplitude * height * 0.3 +
          mouseWave * height * 0.15;
        
        ctx.lineTo(x, y);
      }

      ctx.lineTo(width, height);
      ctx.closePath();

      const gradient = ctx.createLinearGradient(0, 0, width, height);
      const colorShift = (mouseX - 0.5) * 0.2;
      gradient.addColorStop(0, color1);
      gradient.addColorStop(0.3 + colorShift, color2);
      gradient.addColorStop(0.7 + colorShift, color3);
      gradient.addColorStop(1, color1);
      
      ctx.fillStyle = gradient;
      ctx.fill();
    };

    const drawHighlight = (
      ctx: CanvasRenderingContext2D,
      width: number,
      height: number,
      time: number,
      mouseX: number,
      mouseY: number,
      config: {
        baseY: number;
        amplitude: number;
        frequency: number;
        speed: number;
        opacity: number;
      }
    ) => {
      const { baseY, amplitude, frequency, speed, opacity } = config;
      
      ctx.beginPath();
      
      for (let x = 0; x <= width; x += 3) {
        const normalizedX = x / width;
        const distFromMouse = Math.abs(normalizedX - mouseX) + Math.abs(baseY - mouseY);
        
        const y = height * baseY + 
          Math.sin(normalizedX * frequency + time * speed) * amplitude * height +
          Math.sin((normalizedX - mouseX) * 10 - time * 3) * 20 * (1 - distFromMouse * 0.5);
        
        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.strokeStyle = `rgba(255, 255, 255, ${opacity * (0.3 + mouseY * 0.4)})`;
      ctx.lineWidth = 2 + Math.sin(time * 2) * 0.5;
      ctx.stroke();
    };

    const animate = () => {
      timeRef.current += 0.012;
      const time = timeRef.current;
      
      mouseRef.current.x += (targetMouseRef.current.x - mouseRef.current.x) * 0.08;
      mouseRef.current.y += (targetMouseRef.current.y - mouseRef.current.y) * 0.08;
      
      const { x: mouseX, y: mouseY } = mouseRef.current;
      
      const width = canvasWidth;
      const height = canvasHeight;

      ctx.fillStyle = '#050510';
      ctx.fillRect(0, 0, width, height);

      drawWave(ctx, width, height, time, mouseX, mouseY, {
        baseY: 0.9 - mouseY * 0.15,
        amplitude: 0.1,
        frequency: 3,
        speed: 0.3,
        color1: 'rgba(20, 10, 60, 0.95)',
        color2: 'rgba(60, 20, 100, 0.9)',
        color3: 'rgba(30, 50, 120, 0.95)',
        mouseInfluence: 1.5
      });

      drawWave(ctx, width, height, time + 1, mouseX, mouseY, {
        baseY: 0.75 - mouseY * 0.12,
        amplitude: 0.12,
        frequency: 2.5,
        speed: 0.4,
        color1: 'rgba(100, 20, 120, 0.85)',
        color2: 'rgba(180, 40, 100, 0.8)',
        color3: 'rgba(80, 30, 150, 0.85)',
        mouseInfluence: 2.0
      });

      drawWave(ctx, width, height, time + 2, mouseX, mouseY, {
        baseY: 0.6 - mouseY * 0.1,
        amplitude: 0.14,
        frequency: 2,
        speed: 0.5,
        color1: 'rgba(30, 60, 150, 0.75)',
        color2: 'rgba(80, 100, 200, 0.7)',
        color3: 'rgba(150, 50, 180, 0.75)',
        mouseInfluence: 2.5
      });

      drawWave(ctx, width, height, time + 3, mouseX, mouseY, {
        baseY: 0.45 - mouseY * 0.08,
        amplitude: 0.12,
        frequency: 3.5,
        speed: 0.35,
        color1: 'rgba(180, 30, 120, 0.65)',
        color2: 'rgba(100, 60, 180, 0.6)',
        color3: 'rgba(50, 80, 160, 0.65)',
        mouseInfluence: 2.0
      });

      drawWave(ctx, width, height, time + 4, mouseX, mouseY, {
        baseY: 0.3 - mouseY * 0.05,
        amplitude: 0.1,
        frequency: 4,
        speed: 0.25,
        color1: 'rgba(60, 30, 120, 0.55)',
        color2: 'rgba(120, 40, 160, 0.5)',
        color3: 'rgba(40, 60, 140, 0.55)',
        mouseInfluence: 1.5
      });

      drawHighlight(ctx, width, height, time, mouseX, mouseY, {
        baseY: 0.7 - mouseY * 0.1,
        amplitude: 0.08,
        frequency: 2.5,
        speed: 0.5,
        opacity: 0.4
      });

      drawHighlight(ctx, width, height, time + 1.5, mouseX, mouseY, {
        baseY: 0.5 - mouseY * 0.08,
        amplitude: 0.1,
        frequency: 3,
        speed: 0.4,
        opacity: 0.3
      });

      drawHighlight(ctx, width, height, time + 3, mouseX, mouseY, {
        baseY: 0.35 - mouseY * 0.05,
        amplitude: 0.06,
        frequency: 3.5,
        speed: 0.6,
        opacity: 0.25
      });

      const glowGradient = ctx.createRadialGradient(
        mouseX * width, mouseY * height, 0,
        mouseX * width, mouseY * height, 400
      );
      glowGradient.addColorStop(0, 'rgba(180, 120, 255, 0.5)');
      glowGradient.addColorStop(0.2, 'rgba(120, 180, 255, 0.35)');
      glowGradient.addColorStop(0.4, 'rgba(220, 100, 200, 0.2)');
      glowGradient.addColorStop(0.7, 'rgba(100, 50, 150, 0.1)');
      glowGradient.addColorStop(1, 'transparent');
      
      ctx.fillStyle = glowGradient;
      ctx.fillRect(0, 0, width, height);
      
      const secondaryGlow = ctx.createRadialGradient(
        (1 - mouseX) * width, (1 - mouseY) * height, 0,
        (1 - mouseX) * width, (1 - mouseY) * height, 350
      );
      secondaryGlow.addColorStop(0, 'rgba(100, 80, 200, 0.25)');
      secondaryGlow.addColorStop(0.5, 'rgba(80, 60, 180, 0.1)');
      secondaryGlow.addColorStop(1, 'transparent');
      
      ctx.fillStyle = secondaryGlow;
      ctx.fillRect(0, 0, width, height);

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('mousemove', handleMouseMove);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 w-full h-full ${className}`}
      style={{ zIndex: 0 }}
    />
  );
}
