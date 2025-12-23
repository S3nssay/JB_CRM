"use client"

import { useEffect, useRef, useState } from "react"
import * as THREE from "three"

export function ShaderAnimation() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [webglError, setWebglError] = useState(false)
  const sceneRef = useRef<{
    camera: THREE.Camera
    scene: THREE.Scene
    renderer: THREE.WebGLRenderer
    uniforms: any
    animationId: number
  } | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const container = containerRef.current

    // Check for WebGL support
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    if (!gl) {
      setWebglError(true)
      return
    }

    try {
      // Vertex shader
      const vertexShader = `
        void main() {
          gl_Position = vec4( position, 1.0 );
        }
      `

      // Fragment shader - Purple color scheme
      const fragmentShader = `
        #define TWO_PI 6.2831853072
        #define PI 3.14159265359

        precision highp float;
        uniform vec2 resolution;
        uniform float time;

        void main(void) {
          vec2 uv = (gl_FragCoord.xy * 2.0 - resolution.xy) / min(resolution.x, resolution.y);
          float t = time*0.05;
          float lineWidth = 0.002;

          float intensity = 0.0;
          for(int i=0; i < 5; i++){
            intensity += lineWidth*float(i*i) / abs(fract(t + float(i)*0.01)*5.0 - length(uv) + mod(uv.x+uv.y, 0.2));
          }
          
          // Purple color palette: deep purple to magenta
          vec3 purple1 = vec3(0.47, 0.12, 0.46); // #791E75
          vec3 purple2 = vec3(0.58, 0.15, 0.56); // Lighter purple
          vec3 purple3 = vec3(0.83, 0.63, 0.31); // Gold accent #D4A04F
          
          vec3 color = mix(purple1, purple2, intensity * 0.5);
          color += purple3 * intensity * 0.3;
          
          gl_FragColor = vec4(color, 1.0);
        }
      `

      // Initialize Three.js scene
      const camera = new THREE.Camera()
      camera.position.z = 1

      const scene = new THREE.Scene()
      const geometry = new THREE.PlaneGeometry(2, 2)

      const uniforms = {
        time: { type: "f", value: 1.0 },
        resolution: { type: "v2", value: new THREE.Vector2() },
      }

      const material = new THREE.ShaderMaterial({
        uniforms: uniforms,
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
      })

      const mesh = new THREE.Mesh(geometry, material)
      scene.add(mesh)

      const renderer = new THREE.WebGLRenderer({ antialias: true })
      renderer.setPixelRatio(window.devicePixelRatio)

      container.appendChild(renderer.domElement)

      // Handle window resize
      const onWindowResize = () => {
        const width = container.clientWidth
        const height = container.clientHeight
        renderer.setSize(width, height)
        uniforms.resolution.value.x = renderer.domElement.width
        uniforms.resolution.value.y = renderer.domElement.height
      }

      // Initial resize
      onWindowResize()
      window.addEventListener("resize", onWindowResize, false)

      // Animation loop
      const animate = () => {
        const animationId = requestAnimationFrame(animate)
        uniforms.time.value += 0.05
        renderer.render(scene, camera)

        if (sceneRef.current) {
          sceneRef.current.animationId = animationId
        }
      }

      // Store scene references for cleanup
      sceneRef.current = {
        camera,
        scene,
        renderer,
        uniforms,
        animationId: 0,
      }

      // Start animation
      animate()

      // Cleanup function
      return () => {
        window.removeEventListener("resize", onWindowResize)

        if (sceneRef.current) {
          cancelAnimationFrame(sceneRef.current.animationId)

          if (container && sceneRef.current.renderer.domElement) {
            container.removeChild(sceneRef.current.renderer.domElement)
          }

          sceneRef.current.renderer.dispose()
          geometry.dispose()
          material.dispose()
        }
      }
    } catch (error) {
      console.error('WebGL initialization error:', error)
      setWebglError(true)
    }
  }, [])

  // Fallback gradient background when WebGL is not available
  if (webglError) {
    return (
      <div
        className="w-full h-full"
        style={{
          background: "radial-gradient(ellipse at center, #3a1a4a 0%, #2A0A2A 50%, #1a0520 100%)",
          overflow: "hidden",
        }}
      />
    )
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{
        background: "#000",
        overflow: "hidden",
      }}
    />
  )
}
