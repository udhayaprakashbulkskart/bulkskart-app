/**
 * HeroNetworkBackground — "Trade Network Horizon" animated backdrop for the homepage hero.
 *
 * Concept: a glowing perspective grid floor where light pulses roll toward the viewer, above which a
 * constellation of trading nodes links up. Order "packets" travel along the links. Calm, data-driven,
 * no photography.
 *
 * - Background only: aria-hidden, pointer-events-none, sits under the hero copy and gradient overlays.
 * - three.js is loaded with a dynamic import; the grid pulses run in a shader on the GPU.
 * - Performance: capped pixel ratio, fewer objects on mobile, 30 fps cap on mobile,
 *   paused while off-screen or in a background tab.
 * - Fallbacks: no WebGL or a failed load keeps the static CSS gradient. prefers-reduced-motion
 *   renders one still frame and does not animate.
 */
import { useEffect, useRef, useState } from 'react';

type THREEModule = typeof import('three');
type Vec3 = import('three').Vector3;

const webglSupported = () => {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
};

const reducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function startNetwork(THREE: THREEModule, container: HTMLElement, canvas: HTMLCanvasElement) {
  const mobile = window.matchMedia('(max-width: 767px)').matches;
  const reduced = reducedMotion();

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1 : 1.5));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 120);
  camera.position.set(0, 1.5, 6);

  const disposables: Array<{ dispose: () => void }> = [];
  const track = <T extends { dispose: () => void }>(o: T): T => {
    disposables.push(o);
    return o;
  };

  // ── 1. Perspective grid floor with GPU-driven light pulses ──────────────
  const FLOOR_Y = -1.6;
  const seg: number[] = [];
  const zNear = 6;
  const zFar = -34;
  for (let z = zFar; z <= zNear; z += 1.0) seg.push(-26, FLOOR_Y, z, 26, FLOOR_Y, z);
  for (let x = -26; x <= 26; x += 1.25) seg.push(x, FLOOR_Y, zFar, x, FLOOR_Y, zNear);
  const gridGeo = track(new THREE.BufferGeometry());
  gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3));

  const gridMat = track(new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uBase: { value: new THREE.Color(0x2b4877) },
      uPulse: { value: new THREE.Color(0xff6500) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vPos;
      void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uBase;
      uniform vec3 uPulse;
      varying vec3 vPos;
      void main() {
        // Pulses roll from the horizon toward the viewer.
        float wave = fract(-vPos.z * 0.055 + uTime * 0.09);
        float band = smoothstep(0.0, 0.08, wave) * (1.0 - smoothstep(0.08, 0.22, wave));
        float across = 0.6 + 0.4 * sin(vPos.x * 0.7 + uTime * 0.6);
        float fadeX = 1.0 - smoothstep(9.0, 22.0, abs(vPos.x));
        float fadeZ = smoothstep(-30.0, -10.0, vPos.z);
        vec3 col = mix(uBase, uPulse, band * across);
        float a = (0.5 + band * 0.9 * across) * fadeX * fadeZ;
        gl_FragColor = vec4(col, a);
      }
    `,
  }));
  const grid = new THREE.LineSegments(gridGeo, gridMat);
  scene.add(grid);

  // Horizon glow strip where the floor fades into the dark background.
  const horizonGeo = track(new THREE.PlaneGeometry(60, 6));
  const horizonMat = track(new THREE.MeshBasicMaterial({
    color: 0xff6500, transparent: true, opacity: 0.09, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  const horizon = new THREE.Mesh(horizonGeo, horizonMat);
  horizon.position.set(0, FLOOR_Y + 0.4, zFar + 2);
  scene.add(horizon);

  // ── 2. Trading-node constellation with links ────────────────────────────
  const nodeCount = mobile ? 32 : 64;
  const nodes: Vec3[] = [];
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < nodeCount; i++) {
    nodes.push(new THREE.Vector3(
      (rnd() * 2 - 1) * 8.5,
      0.2 + rnd() * 2.6,
      -2 - rnd() * 13,
    ));
  }
  const group = new THREE.Group();
  scene.add(group);

  const nodePos = new Float32Array(nodeCount * 3);
  nodes.forEach((n, i) => nodePos.set([n.x, n.y, n.z], i * 3));
  const nodeGeo = track(new THREE.BufferGeometry());
  nodeGeo.setAttribute('position', new THREE.BufferAttribute(nodePos, 3));
  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = glowCanvas.height = 64;
  const gctx = glowCanvas.getContext('2d');
  if (gctx) {
    const g = gctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.3, 'rgba(255,190,140,0.85)');
    g.addColorStop(1, 'rgba(255,101,0,0)');
    gctx.fillStyle = g;
    gctx.fillRect(0, 0, 64, 64);
  }
  const glowTex = track(new THREE.CanvasTexture(glowCanvas));
  group.add(new THREE.Points(nodeGeo, track(new THREE.PointsMaterial({
    color: 0xffa05a, map: glowTex, size: mobile ? 0.34 : 0.28, sizeAttenuation: true,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }))));

  // Links between nearby nodes.
  const links: Array<[number, number]> = [];
  const linkSeg: number[] = [];
  for (let i = 0; i < nodeCount; i++) {
    for (let j = i + 1; j < nodeCount; j++) {
      if (nodes[i].distanceTo(nodes[j]) < 3.3 && links.length < 140) {
        links.push([i, j]);
        linkSeg.push(nodes[i].x, nodes[i].y, nodes[i].z, nodes[j].x, nodes[j].y, nodes[j].z);
      }
    }
  }
  const linkGeo = track(new THREE.BufferGeometry());
  linkGeo.setAttribute('position', new THREE.Float32BufferAttribute(linkSeg, 3));
  group.add(new THREE.LineSegments(linkGeo, track(new THREE.LineBasicMaterial({
    color: 0xff6500, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false,
  }))));

  // Order packets travelling along links.
  const packetCount = mobile ? 14 : 30;
  const packets = Array.from({ length: packetCount }, (_, i) => ({
    link: links.length ? i % links.length : 0,
    t: rnd(),
    speed: 0.08 + rnd() * 0.12,
  }));
  const packetPos = new Float32Array(packetCount * 3);
  const packetGeo = track(new THREE.BufferGeometry());
  packetGeo.setAttribute('position', new THREE.BufferAttribute(packetPos, 3));
  group.add(new THREE.Points(packetGeo, track(new THREE.PointsMaterial({
    color: 0xffc08a, map: glowTex, size: mobile ? 0.3 : 0.24, sizeAttenuation: true,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }))));

  // ── 3. Ambient motes ────────────────────────────────────────────────────
  const moteCount = mobile ? 40 : 110;
  const motePos = new Float32Array(moteCount * 3);
  for (let i = 0; i < moteCount; i++) {
    motePos[i * 3] = (rnd() * 2 - 1) * 12;
    motePos[i * 3 + 1] = rnd() * 4.5 - 1.5;
    motePos[i * 3 + 2] = -1 - rnd() * 22;
  }
  const moteGeo = track(new THREE.BufferGeometry());
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
  const motes = new THREE.Points(moteGeo, track(new THREE.PointsMaterial({
    color: 0xff8a4c, map: glowTex, size: 0.09, sizeAttenuation: true,
    transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending,
  })));
  scene.add(motes);

  // ── Layout and interaction ──────────────────────────────────────────────
  const resize = () => {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Keep the constellation framed on narrow screens.
    camera.fov = w < 768 ? 70 : 58;
    camera.updateProjectionMatrix();
  };

  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const onPointer = (e: PointerEvent) => {
    pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
  };
  if (!mobile && !reduced) window.addEventListener('pointermove', onPointer, { passive: true });

  // ── Render loop ─────────────────────────────────────────────────────────
  let raf = 0;
  let last = performance.now();
  let lastRender = 0;
  let visible = true;
  let elapsed = 0;

  const update = (dt: number, now: number) => {
    elapsed += dt;
    gridMat.uniforms.uTime.value = elapsed;
    group.rotation.y = Math.sin(elapsed * 0.05) * 0.12;
    motes.rotation.y = elapsed * 0.01;

    pointer.x += (pointer.tx - pointer.x) * 0.04;
    pointer.y += (pointer.ty - pointer.y) * 0.04;
    const scrollLift = Math.min(0.6, window.scrollY * 0.0008);
    camera.position.set(pointer.x * 0.35, 1.5 - pointer.y * 0.2 + scrollLift * 0.4, 6);
    camera.lookAt(0, 0.6, -10);

    if (links.length) {
      for (let i = 0; i < packetCount; i++) {
        const p = packets[i];
        p.t += dt * p.speed;
        if (p.t >= 1) {
          p.t -= 1;
          p.link = (p.link + packetCount) % links.length;
        }
        const [a, b] = links[p.link];
        const A = nodes[a];
        const B = nodes[b];
        packetPos[i * 3] = A.x + (B.x - A.x) * p.t;
        packetPos[i * 3 + 1] = A.y + (B.y - A.y) * p.t;
        packetPos[i * 3 + 2] = A.z + (B.z - A.z) * p.t;
      }
      packetGeo.attributes.position.needsUpdate = true;
    }

    renderer.render(scene, camera);
    lastRender = now;
  };

  const frame = (now: number) => {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!mobile || now - lastRender >= 33) update(dt, now);
    if (visible && !reduced) raf = requestAnimationFrame(frame);
  };

  const start = () => {
    if (reduced || raf || !visible || document.visibilityState !== 'visible') return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  };

  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) start();
  });
  io.observe(container);
  const onVisibility = () => start();
  document.addEventListener('visibilitychange', onVisibility);

  const ro = new ResizeObserver(() => resize());
  ro.observe(container);
  resize();

  if (reduced) {
    update(0, performance.now()); // one still frame
  } else {
    start();
  }

  return () => {
    if (raf) cancelAnimationFrame(raf);
    io.disconnect();
    ro.disconnect();
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pointermove', onPointer);
    disposables.forEach(d => d.dispose());
    renderer.dispose();
    renderer.forceContextLoss?.();
  };
}

export default function HeroNetworkBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas || !webglSupported()) return;

    let cancelled = false;
    let cleanup: (() => void) | undefined;

    import('three')
      .then(THREE => {
        if (cancelled) return;
        cleanup = startNetwork(THREE, container, canvas);
        setReady(true);
      })
      .catch(() => setReady(false)); // keep the static CSS gradient

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {/* Static fallback: visible when WebGL is unavailable or still loading. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_70%,rgba(255,101,0,0.16),rgba(7,11,20,0)_60%)]" />
      <div className="absolute inset-x-0 bottom-0 h-[45%] bg-[linear-gradient(to_top,rgba(255,101,0,0.08),transparent)]" />
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 h-full w-full transition-opacity duration-700 ${ready ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  );
}
