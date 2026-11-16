import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface IndustrialPort3DProps {
  className?: string;
  onSceneReady?: () => void;
}

export default function IndustrialPort3D({ className = '', onSceneReady }: IndustrialPort3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [webGLSupported, setWebGLSupported] = useState<boolean>(true);
  const [isLowPower, setIsLowPower] = useState<boolean>(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Detect WebGL capability
    try {
      const testCanvas = document.createElement('canvas');
      const gl = testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl');
      if (!gl) {
        setWebGLSupported(false);
        return;
      }
    } catch (e) {
      setWebGLSupported(false);
      return;
    }

    // Check device performance
    const isMobile = window.innerWidth < 768;
    setIsLowPower(isMobile);

    let animationFrameId: number;
    let renderer: THREE.WebGLRenderer | null = null;

    try {
      // 1. Scene, Camera, Renderer
      const scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0x070b12, 0.015);

      const width = container.clientWidth || window.innerWidth;
      const height = container.clientHeight || window.innerHeight;

      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
      camera.position.set(0, 14, 38);
      camera.lookAt(0, 8, 0);

      renderer = new THREE.WebGLRenderer({
        antialias: !isMobile,
        alpha: true,
        powerPreference: 'high-performance',
        stencil: false,
        depth: true
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
      container.appendChild(renderer.domElement);

      // 2. Lighting Setup
      const ambientLight = new THREE.AmbientLight(0x242424, 1.4);
      scene.add(ambientLight);

      const moonLight = new THREE.DirectionalLight(0xec6116, 2.0);
      moonLight.position.set(30, 45, 20);
      scene.add(moonLight);

      // Industrial Orange Floodlights
      const orangeCraneLight = new THREE.PointLight(0xff5a1f, 3.5, 40, 1.2);
      orangeCraneLight.position.set(2, 22, 6);
      scene.add(orangeCraneLight);

      const dockWarmLight = new THREE.PointLight(0xffaa44, 2.5, 50, 1.2);
      dockWarmLight.position.set(-18, 12, 10);
      scene.add(dockWarmLight);

      const shipCyanLight = new THREE.PointLight(0xff5900, 2.2, 60, 1.2);
      shipCyanLight.position.set(28, 10, -10);
      scene.add(shipCyanLight);

      // 3. Realistic Water Plane with Shimmer
      const waterGeo = new THREE.PlaneGeometry(300, 300, 32, 32);
      const waterMat = new THREE.MeshStandardMaterial({
        color: 0x050d18,
        roughness: 0.15,
        metalness: 0.85,
        wireframe: false
      });
      const water = new THREE.Mesh(waterGeo, waterMat);
      water.rotation.x = -Math.PI / 2;
      water.position.y = -1.5;
      scene.add(water);

      // 4. Harbor Concrete Pier / Wharf
      const pierGeo = new THREE.BoxGeometry(90, 3, 50);
      const pierMat = new THREE.MeshStandardMaterial({
        color: 0x1a1a1a,
        roughness: 0.8,
        metalness: 0.2
      });
      const pier = new THREE.Mesh(pierGeo, pierMat);
      pier.position.set(-12, 0, 10);
      scene.add(pier);

      // Quay Edge Safety Strip
      const curbGeo = new THREE.BoxGeometry(90, 0.4, 0.8);
      const curbMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
      const curb = new THREE.Mesh(curbGeo, curbMat);
      curb.position.set(-12, 1.6, -14.6);
      scene.add(curb);

      // 5. Texture Generator for Branded BulkSkart Shipping Container
      function createBulkSkartContainerTexture(): THREE.CanvasTexture {
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 512;
        const ctx = canvas.getContext('2d')!;

        // Base container safety orange
        ctx.fillStyle = '#ff5a1f';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Corrugated vertical ribs shading
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        for (let x = 0; x < canvas.width; x += 16) {
          ctx.fillRect(x, 0, 8, canvas.height);
        }

        // Metal top & bottom rails
        ctx.fillStyle = '#cc410f';
        ctx.fillRect(0, 0, canvas.width, 30);
        ctx.fillRect(0, canvas.height - 30, canvas.width, 30);

        // Corner castings
        ctx.fillStyle = '#2c2c2c';
        ctx.fillRect(0, 0, 60, 60);
        ctx.fillRect(canvas.width - 60, 0, 60, 60);
        ctx.fillRect(0, canvas.height - 60, 60, 60);
        ctx.fillRect(canvas.width - 60, canvas.height - 60, 60, 60);

        // Hexagon Logo Icon
        ctx.save();
        ctx.translate(180, 256);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = (i * Math.PI) / 3;
          const px = 55 * Math.cos(angle);
          const py = 55 * Math.sin(angle);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.lineWidth = 14;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();

        // Inner cube mark
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 32px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('BS', 0, 0);
        ctx.restore();

        // BulkSkart Brand Text
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 92px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('BulkSkart', 270, 240);

        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.font = 'bold 26px sans-serif';
        ctx.letterSpacing = '6px';
        ctx.fillText('GLOBAL B2B BULK MARKETPLACE', 274, 305);

        // Container Spec Stencils
        ctx.font = 'bold 22px monospace';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('BSKU 894102 7', 720, 90);
        ctx.fillText('MAX GROSS: 32,500 KG', 720, 125);
        ctx.fillText('PAYLOAD:   28,600 KG', 720, 155);

        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = THREE.ClampToEdgeWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        return tex;
      }

      const containerTexture = createBulkSkartContainerTexture();

      // Suspended Container Group
      const suspendedContainerGroup = new THREE.Group();
      suspendedContainerGroup.position.set(0, 11, 4);
      scene.add(suspendedContainerGroup);

      // Container Box
      const containerBoxGeo = new THREE.BoxGeometry(16, 6.2, 6.2);
      const containerSideMat = new THREE.MeshStandardMaterial({
        map: containerTexture,
        roughness: 0.35,
        metalness: 0.4
      });
      const containerDoorMat = new THREE.MeshStandardMaterial({
        color: 0xcc410f,
        roughness: 0.5,
        metalness: 0.3
      });

      const containerMaterials = [
        containerDoorMat,
        containerDoorMat,
        containerDoorMat, // top
        containerDoorMat, // bottom
        containerSideMat, // front (branded)
        containerSideMat  // back (branded)
      ];

      const suspendedBox = new THREE.Mesh(containerBoxGeo, containerMaterials);
      suspendedContainerGroup.add(suspendedBox);

      // Container Spreader Frame & Twistlocks
      const spreaderGeo = new THREE.BoxGeometry(16.4, 0.6, 6.4);
      const spreaderMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, metalness: 0.7, roughness: 0.3 });
      const spreader = new THREE.Mesh(spreaderGeo, spreaderMat);
      spreader.position.y = 3.6;
      suspendedContainerGroup.add(spreader);

      // Steel Hoist Cables from Crane Trolley
      const cableMat = new THREE.LineBasicMaterial({ color: 0xf07f42 });
      const cablePositions = [
        [-7.8, 3.8, -3],
        [7.8, 3.8, -3],
        [-7.8, 3.8, 3],
        [7.8, 3.8, 3]
      ];

      cablePositions.forEach(([cx, cy, cz]) => {
        const points = [
          new THREE.Vector3(cx, cy, cz),
          new THREE.Vector3(cx * 0.4, cy + 18, cz * 0.4)
        ];
        const cableGeo = new THREE.BufferGeometry().setFromPoints(points);
        const cableLine = new THREE.Line(cableGeo, cableMat);
        suspendedContainerGroup.add(cableLine);
      });

      // 6. Massive Harbor Container Gantry Crane Structure
      const craneGroup = new THREE.Group();
      craneGroup.position.set(4, 0, -2);
      scene.add(craneGroup);

      const steelMat = new THREE.MeshStandardMaterial({
        color: 0x2c2c2c,
        metalness: 0.8,
        roughness: 0.3
      });
      const orangeSteelMat = new THREE.MeshStandardMaterial({
        color: 0xff5a1f,
        metalness: 0.7,
        roughness: 0.35
      });

      // Vertical Gantry Legs
      const legGeo = new THREE.CylinderGeometry(0.5, 0.7, 36, 8);
      const leg1 = new THREE.Mesh(legGeo, steelMat);
      leg1.position.set(-12, 18, -14);
      craneGroup.add(leg1);

      const leg2 = new THREE.Mesh(legGeo, steelMat);
      leg2.position.set(12, 18, -14);
      craneGroup.add(leg2);

      const leg3 = new THREE.Mesh(legGeo, steelMat);
      leg3.position.set(-10, 18, 14);
      craneGroup.add(leg3);

      const leg4 = new THREE.Mesh(legGeo, steelMat);
      leg4.position.set(10, 18, 14);
      craneGroup.add(leg4);

      // Horizontal Overhead Boom Truss
      const boomGeo = new THREE.BoxGeometry(60, 2.2, 3);
      const boom = new THREE.Mesh(boomGeo, orangeSteelMat);
      boom.position.set(4, 34, 0);
      craneGroup.add(boom);

      // Machinery House on top of crane
      const cabGeo = new THREE.BoxGeometry(10, 5, 6);
      const cab = new THREE.Mesh(cabGeo, steelMat);
      cab.position.set(-4, 37, 0);
      craneGroup.add(cab);

      // Aircraft Warning Red Beacons
      const beaconGeo = new THREE.SphereGeometry(0.35, 8, 8);
      const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff1133 });
      const beacon = new THREE.Mesh(beaconGeo, beaconMat);
      beacon.position.set(32, 35.5, 0);
      craneGroup.add(beacon);

      // 7. Stacked Containers on the Wharf
      const stackGroup = new THREE.Group();
      scene.add(stackGroup);

      const containerColors = [0xc24400, 0xc24400, 0x882222, 0x303030, 0xcc5500, 0xb3480f];
      const standardContainerGeo = new THREE.BoxGeometry(12, 5, 5);

      const stackPositions = [
        // Left Stacks
        [-28, 2.5, 8, 0],
        [-28, 7.5, 8, 1],
        [-28, 12.5, 8, 2],
        [-28, 2.5, 14, 3],
        [-28, 7.5, 14, 4],
        [-41, 2.5, 10, 5],
        [-41, 7.5, 10, 0],
        // Right Background Stacks
        [24, 2.5, 16, 2],
        [24, 7.5, 16, 3],
        [37, 2.5, 14, 1]
      ];

      stackPositions.forEach(([x, y, z, colorIdx]) => {
        const mat = new THREE.MeshStandardMaterial({
          color: containerColors[colorIdx],
          roughness: 0.5,
          metalness: 0.4
        });
        const cMesh = new THREE.Mesh(standardContainerGeo, mat);
        cMesh.position.set(x, y, z);
        stackGroup.add(cMesh);
      });

      // 8. Distant Container Ship Silhouette in the Harbor
      const shipGroup = new THREE.Group();
      shipGroup.position.set(35, 0, -32);
      scene.add(shipGroup);

      // Hull
      const hullGeo = new THREE.BoxGeometry(75, 9, 18);
      const hullMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.6, metalness: 0.5 });
      const hull = new THREE.Mesh(hullGeo, hullMat);
      hull.position.y = 3;
      shipGroup.add(hull);

      // Superstructure Bridge
      const bridgeGeo = new THREE.BoxGeometry(14, 16, 12);
      const bridgeMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.4 });
      const bridge = new THREE.Mesh(bridgeGeo, bridgeMat);
      bridge.position.set(-24, 14, 0);
      shipGroup.add(bridge);

      // 9. Floating Atmospheric Night Dust Particles
      const particleCount = isMobile ? 80 : 180;
      const particleGeo = new THREE.BufferGeometry();
      const particlePositions = new Float32Array(particleCount * 3);
      const particleVelocities = new Float32Array(particleCount * 3);

      for (let i = 0; i < particleCount; i++) {
        particlePositions[i * 3] = (Math.random() - 0.5) * 80;
        particlePositions[i * 3 + 1] = Math.random() * 35;
        particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 50;

        particleVelocities[i * 3] = (Math.random() - 0.5) * 0.02;
        particleVelocities[i * 3 + 1] = 0.01 + Math.random() * 0.02;
        particleVelocities[i * 3 + 2] = (Math.random() - 0.5) * 0.02;
      }

      particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

      const particleMat = new THREE.PointsMaterial({
        color: 0xffaa55,
        size: isMobile ? 0.35 : 0.45,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending
      });

      const particleSystem = new THREE.Points(particleGeo, particleMat);
      scene.add(particleSystem);

      // 10. 3D Global Trade Route Vector Arcs in the Sky
      const tradeRoutesGroup = new THREE.Group();
      tradeRoutesGroup.position.set(0, 20, -25);
      scene.add(tradeRoutesGroup);

      // Curved trade route arcs
      const tradeHubs = [
        [-28, 6, 0], // Mumbai / India
        [-14, 10, -5], // Dubai
        [18, 12, -2], // Shanghai / Ningbo
        [32, 14, 6], // Singapore
        [-38, 16, -10], // Rotterdam
        [-48, 8, 4]  // New York
      ];

      const arcMat = new THREE.LineBasicMaterial({
        color: 0xf87b38,
        transparent: true,
        opacity: 0.45,
        blending: THREE.AdditiveBlending
      });

      for (let i = 0; i < tradeHubs.length - 1; i++) {
        const p1 = new THREE.Vector3(...tradeHubs[i]);
        const p2 = new THREE.Vector3(...tradeHubs[i + 1]);
        const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
        mid.y += 8; // arc upwards

        const curve = new THREE.QuadraticBezierCurve3(p1, mid, p2);
        const curvePoints = curve.getPoints(24);
        const curveGeo = new THREE.BufferGeometry().setFromPoints(curvePoints);
        const arcLine = new THREE.Line(curveGeo, arcMat);
        tradeRoutesGroup.add(arcLine);

        // Glowing Hub Point
        const hubGeo = new THREE.SphereGeometry(0.6, 8, 8);
        const hubMat = new THREE.MeshBasicMaterial({ color: 0xff5a1f });
        const hub = new THREE.Mesh(hubGeo, hubMat);
        hub.position.copy(p1);
        tradeRoutesGroup.add(hub);
      }

      // 11. Mouse / Touch Parallax Tracking
      let targetMouseX = 0;
      let targetMouseY = 0;
      let currentMouseX = 0;
      let currentMouseY = 0;

      const handlePointerMove = (e: MouseEvent) => {
        targetMouseX = (e.clientX / window.innerWidth) * 2 - 1;
        targetMouseY = -(e.clientY / window.innerHeight) * 2 + 1;
      };

      window.addEventListener('mousemove', handlePointerMove, { passive: true });

      // 12. Handle Resize
      const handleResize = () => {
        if (!container || !renderer) return;
        const newW = container.clientWidth;
        const newH = container.clientHeight;
        camera.aspect = newW / newH;
        camera.updateProjectionMatrix();
        renderer.setSize(newW, newH);
      };

      window.addEventListener('resize', handleResize);

      // Signal ready
      if (onSceneReady) onSceneReady();

      // 13. Render Loop with Performance Throttling (Caps at 30 FPS & pauses when scrolled out of view)
      let clock = new THREE.Clock();
      let lastRenderTime = 0;
      const FRAME_INTERVAL = 1000 / 30; // 30 FPS cap saves 50%+ GPU/CPU
      let isVisible = true;

      const observer = new IntersectionObserver(([entry]) => {
        isVisible = entry.isIntersecting;
      }, { threshold: 0.05 });
      observer.observe(container);

      const animate = (timestamp: number) => {
        animationFrameId = requestAnimationFrame(animate);

        // Pause completely when scrolled out of hero view
        if (!isVisible) return;

        // Throttle to 30 FPS
        if (timestamp - lastRenderTime < FRAME_INTERVAL) return;
        lastRenderTime = timestamp;

        const elapsedTime = clock.getElapsedTime();

        // Gentle swaying of the suspended BulkSkart container on crane hoist
        suspendedContainerGroup.rotation.y = Math.sin(elapsedTime * 0.8) * 0.04;
        suspendedContainerGroup.rotation.z = Math.cos(elapsedTime * 0.6) * 0.015;
        suspendedContainerGroup.position.y = 11 + Math.sin(elapsedTime * 1.2) * 0.35;

        // Animate beacon flash
        beacon.material.color.setHex(Math.sin(elapsedTime * 4) > 0 ? 0xff2222 : 0x550000);

        // Animate atmospheric particles
        const posAttr = particleGeo.attributes.position as THREE.BufferAttribute;
        const positions = posAttr.array as Float32Array;

        for (let i = 0; i < particleCount; i++) {
          positions[i * 3 + 1] += particleVelocities[i * 3 + 1];
          positions[i * 3] += particleVelocities[i * 3];

          // Wrap around top
          if (positions[i * 3 + 1] > 35) {
            positions[i * 3 + 1] = 0;
          }
        }
        posAttr.needsUpdate = true;

        // Smooth camera parallax
        currentMouseX += (targetMouseX - currentMouseX) * 0.04;
        currentMouseY += (targetMouseY - currentMouseY) * 0.04;

        camera.position.x = currentMouseX * 5;
        camera.position.y = 14 + currentMouseY * 2.5;
        camera.lookAt(0, 8, 0);

        // Water specular highlight modulation
        water.material.roughness = 0.15 + Math.sin(elapsedTime * 0.5) * 0.03;

        if (renderer) {
          renderer.render(scene, camera);
        }
      };

      animationFrameId = requestAnimationFrame(animate);

      // Cleanup
      return () => {
        observer.disconnect();
        window.removeEventListener('mousemove', handlePointerMove);
        window.removeEventListener('resize', handleResize);
        cancelAnimationFrame(animationFrameId);

        if (renderer && renderer.domElement && container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement);
          renderer.dispose();
        }
      };
    } catch (err) {
      console.error('WebGL init error:', err);
      setWebGLSupported(false);
    }
  }, []);

  return (
    <div className={`relative w-full h-full overflow-hidden ${className}`}>
      {/* 3D WebGL Canvas Layer */}
      {webGLSupported ? (
        <div ref={containerRef} className="absolute inset-0 w-full h-full pointer-events-auto" />
      ) : (
        /* Lightweight Fallback Image & Ambient Glow when WebGL is unavailable */
        <div className="absolute inset-0 w-full h-full bg-[#070B12] overflow-hidden">
          <div
            className="absolute inset-0 bg-cover bg-center opacity-60"
            style={{
              backgroundImage: 'url("/brand/port-banner.png")'
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#111111] via-[#111111]/60 to-transparent" />
        </div>
      )}

      {/* Atmospheric Depth Gradients */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-[#111111] via-transparent to-[#111111]/70" />
      <div className="absolute inset-0 pointer-events-none bg-radial-at-c from-transparent via-[#111111]/30 to-[#111111]/85" />
    </div>
  );
}
