import { useEffect, useRef } from 'react';
import './transport-backdrop.css';

/**
 * Hero background: a cargo plane crossing the sky, a container ship sailing past the port and a
 * container truck driving the coast road. Original vector artwork in the site's black, white and
 * orange, moved with CSS transforms only (no images, no WebGL). Decorative: hidden from screen
 * readers, paused while the hero is off screen, and still for people who ask for reduced motion.
 */

const BOX_COLORS = ['#FF5A00', '#C2470F', '#8A3411', '#5A2410', '#3A3A3F', '#5C5C63', '#E9E9EC', '#2A2A2E'];

function seededRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
}

function stackBoxes(columns: number[], startX: number, baseY: number, boxW: number, boxH: number, seed: number): Box[] {
  const random = seededRandom(seed);
  const boxes: Box[] = [];
  columns.forEach((levels, column) => {
    for (let level = 0; level < levels; level += 1) {
      const pick = random();
      boxes.push({
        x: startX + column * (boxW + 1),
        y: baseY - (level + 1) * (boxH + 0.6),
        w: boxW,
        h: boxH,
        // Mostly orange and rust, some graphite, the odd white box.
        fill: BOX_COLORS[Math.floor(pick * BOX_COLORS.length)],
      });
    }
  });
  return boxes;
}

/** One path per colour instead of one element per container. */
function pathsByColour(boxes: Box[]): Array<[string, string]> {
  const groups = new Map<string, string>();
  for (const box of boxes) {
    groups.set(box.fill, `${groups.get(box.fill) ?? ''}M${box.x} ${box.y}h${box.w}v${box.h}h${-box.w}z`);
  }
  return Array.from(groups);
}
const topLines = (boxes: Box[], thickness: number) =>
  boxes.map((box) => `M${box.x} ${box.y}h${box.w}v${thickness}h${-box.w}z`).join('');

const SHIP_BOXES = [
  ...stackBoxes([3, 4, 4, 3], 22, 118, 22, 10, 11),
  ...stackBoxes([4, 5, 5, 5, 4, 5, 5, 4, 5, 5, 4, 4, 3], 214, 118, 28, 10.5, 29),
];
const SHIP_PATHS = pathsByColour(SHIP_BOXES);
const SHIP_TOPS = topLines(SHIP_BOXES, 1.1);
const SHIP_WINDOWS = [0, 1, 2]
  .flatMap((row) => Array.from({ length: 8 }, (_, col) => ({ row, col })))
  .filter(({ row, col }) => (row + col) % 3 !== 0)
  .map(({ row, col }) => `M${118 + col * 9} ${79 + row * 11}h5v5h-5z`)
  .join('');

function Ship() {
  return (
    <svg className="tb-art" viewBox="0 0 650 170" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="tb-hull" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#26262A" />
          <stop offset="1" stopColor="#0D0D0F" />
        </linearGradient>
      </defs>
      {SHIP_PATHS.map(([fill, d]) => (
        <path key={fill} d={d} fill={fill} opacity={fill === '#E9E9EC' ? 0.85 : 1} />
      ))}
      <path d={SHIP_TOPS} fill="#FFFFFF" opacity="0.25" />
      {/* Hull */}
      <path d="M14 118 H592 L636 90 L608 152 H48 L14 136 Z" fill="url(#tb-hull)" />
      <path d="M40 141 H614 L608 152 H48 Z" fill="#7A2C0C" />
      <path d="M14 118 H592 L636 90" fill="none" stroke="#FF5A00" strokeOpacity="0.8" strokeWidth="1.4" />
      {/* Bridge */}
      <rect x="104" y="58" width="94" height="14" fill="#2B2B30" />
      <rect x="112" y="72" width="78" height="46" fill="#1C1C20" />
      <rect x="112" y="40" width="26" height="32" fill="#2B2B30" />
      <rect x="112" y="46" width="26" height="5" fill="#FF5A00" />
      <rect x="108" y="61" width="86" height="6" fill="#FFE3C7" opacity="0.85" />
      <path d={SHIP_WINDOWS} fill="#FFD2A6" opacity="0.75" />
      <path d="M170 58 V30 M162 38 H178" stroke="#3A3A3F" strokeWidth="2" />
      <circle className="tb-blink" cx="170" cy="29" r="2.4" fill="#FF5A00" />
      {/* Bow wave */}
      <path d="M598 152 q16 -9 38 -2 q-12 4 -14 8 q-14 -2 -24 -6 Z" fill="#FFFFFF" opacity="0.3" />
    </svg>
  );
}

function Plane() {
  return (
    <svg className="tb-art" viewBox="0 0 270 96" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="tb-plane" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F4F4F6" />
          <stop offset="0.6" stopColor="#BDBDC3" />
          <stop offset="1" stopColor="#7E7E86" />
        </linearGradient>
      </defs>
      <path d="M30 44 L10 6 L40 6 L66 44 Z" fill="#D7D7DC" />
      <path d="M28 6 L40 6 L46 16 L33 16 Z" fill="#FF5A00" />
      <path d="M24 52 L2 48 L8 56 L34 58 Z" fill="#9A9AA2" />
      <path d="M150 52 L204 52 L172 70 L140 70 Z" fill="#6E6E76" />
      <path d="M26 48 Q26 40 38 40 L212 40 Q248 40 266 53 Q248 66 212 66 L38 66 Q26 66 26 58 Z" fill="url(#tb-plane)" />
      <path d="M30 59 H236" stroke="#FF5A00" strokeWidth="2.4" />
      <path d="M232 46 L246 46 Q252 48 256 52 L238 52 Z" fill="#1A1A1E" />
      <path d="M118 62 L186 62 L124 94 L96 94 Z" fill="#C9C9CF" />
      <ellipse cx="136" cy="80" rx="17" ry="7" fill="#8E8E96" />
      <circle className="tb-blink" cx="9" cy="8" r="2.2" fill="#FF5A00" />
      <circle className="tb-blink tb-blink-b" cx="104" cy="93" r="2" fill="#FFFFFF" />
    </svg>
  );
}

const TRUCK_RIBS = Array.from({ length: 37 }, (_, i) => `M${30 + i * 8} 22h1.6v54h-1.6z`).join('');

function Wheel({ x }: { x: number }) {
  return (
    <g>
      <circle cx={x} cy="96" r="13" fill="#0B0B0D" />
      <g className="tb-wheel">
        <circle cx={x} cy="96" r="7" fill="#3A3A3F" />
        <path d={`M${x - 7} 96 H${x + 7} M${x} 89 V103`} stroke="#9A9AA2" strokeWidth="1.6" />
      </g>
    </g>
  );
}

function Truck() {
  return (
    <svg className="tb-art" viewBox="0 0 440 118" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="tb-box" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FF6A14" />
          <stop offset="1" stopColor="#B33E0A" />
        </linearGradient>
        <linearGradient id="tb-beam" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#FFF3E0" stopOpacity="0.75" />
          <stop offset="1" stopColor="#FFF3E0" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M424 80 L440 70 V104 Z" fill="url(#tb-beam)" />
      <rect x="24" y="20" width="312" height="58" fill="url(#tb-box)" />
      <path d={TRUCK_RIBS} fill="#000000" opacity="0.18" />
      <rect x="24" y="20" width="312" height="2" fill="#FFFFFF" opacity="0.5" />
      <rect x="18" y="78" width="330" height="9" fill="#1A1A1E" />
      <path d="M340 38 H392 Q404 38 410 50 L424 70 Q428 76 428 84 V92 H340 Z" fill="#EDEDF0" />
      <path d="M392 44 L408 66 H356 V44 Z" fill="#1A1A1E" opacity="0.85" />
      <rect x="340" y="80" width="88" height="4" fill="#FF5A00" />
      <rect x="422" y="72" width="8" height="6" fill="#FFF3E0" />
      <rect x="18" y="64" width="5" height="8" fill="#FF5A00" />
      {[62, 92, 122, 366, 404].map((x) => (
        <Wheel key={x} x={x} />
      ))}
    </svg>
  );
}

const PORT_BOXES = [
  { x: 0, columns: [3, 4, 4, 3, 2] },
  { x: 250, columns: [2, 3, 3, 2] },
  { x: 520, columns: [4, 5, 5, 4, 3, 3] },
  { x: 860, columns: [3, 4, 3] },
  { x: 1010, columns: [2, 3, 3, 2, 2] },
].flatMap((group, index) => stackBoxes(group.columns, group.x, 212, 30, 13, 101 + index * 17));
const PORT_PATHS = pathsByColour(PORT_BOXES);

function Port() {
  return (
    <svg className="tb-port-art" viewBox="0 0 1200 220" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
      <defs>
        <symbol id="tb-crane" viewBox="0 0 260 200" overflow="visible">
          <g fill="none" stroke="#2E2E33" strokeWidth="5" strokeLinecap="square">
            <path d="M40 200 V58 M96 200 V58 M40 58 H96 M40 120 L96 90 M40 150 L96 120" />
            <path d="M-20 52 H238 M60 52 L196 12 M196 12 L238 52" strokeWidth="6" />
          </g>
          <path d="M-20 50 H238 M60 50 L196 10" stroke="#FF5A00" strokeOpacity="0.7" strokeWidth="1.2" fill="none" />
          <rect x="150" y="62" width="14" height="10" fill="#2E2E33" />
          <path d="M156 72 V104" stroke="#2E2E33" strokeWidth="1.5" />
          <circle className="tb-blink" cx="196" cy="10" r="2.6" fill="#FF5A00" />
        </symbol>
      </defs>
      <g opacity="0.7">
        {PORT_PATHS.map(([fill, d]) => (
          <path key={fill} d={d} fill={fill} />
        ))}
      </g>
      <use href="#tb-crane" x="120" y="10" width="260" height="200" />
      <use href="#tb-crane" x="400" y="26" width="220" height="170" />
      <use href="#tb-crane" x="760" y="6" width="270" height="206" />
    </svg>
  );
}

export default function TransportBackdrop() {
  const ref = useRef<HTMLDivElement>(null);

  // Stop the motion while the hero is scrolled out of view.
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => {
      el.dataset.paused = entry.isIntersecting ? 'false' : 'true';
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="tb-scene" aria-hidden="true" data-paused="false">
      <div className="tb-sky" />
      <div className="tb-sun" />

      <div className="tb-lane tb-lane-plane">
        <div className="tb-plane">
          <span className="tb-trail" />
          <Plane />
        </div>
      </div>

      <div className="tb-port">
        <Port />
      </div>

      <div className="tb-sea">
        <span className="tb-waves" />
        <span className="tb-waves tb-waves-b" />
      </div>
      <div className="tb-lane tb-lane-ship">
        <div className="tb-ship">
          <Ship />
        </div>
      </div>

      <div className="tb-road">
        <span className="tb-road-line" />
      </div>
      <div className="tb-lane tb-lane-truck">
        <div className="tb-truck">
          <Truck />
        </div>
      </div>
    </div>
  );
}
