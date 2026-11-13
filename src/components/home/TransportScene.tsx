/**
 * TransportScene — animated logistics scene for the homepage promo banner.
 * An aeroplane crosses the sky on a flight path, a container ship sails the sea, and a delivery truck
 * drives the road. Pure SVG with SMIL motion: no WebGL, very light on CPU and battery.
 * Decorative (aria-hidden). Reduced-motion users get the still scene.
 */
import { useState } from 'react';
import './transport-scene.css';

const reducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Stars for the night sky.
const STARS: Array<[number, number, number]> = [
  [60, 30, 1.2], [140, 70, 0.9], [220, 25, 1.4], [330, 55, 1], [420, 20, 1.3],
  [520, 48, 0.9], [610, 28, 1.5], [700, 66, 1], [760, 16, 1.2], [480, 90, 0.8],
];

const FLIGHT_PATH = 'M-60 110 Q 260 20 860 80';
const SHIP_PATH = 'M-110 178 L 910 178';
const TRUCK_PATH = 'M-160 242 L 960 242';

function Plane() {
  return (
    <g>
      <path d="M0 0 C -6 -3 -14 -3 -22 0 C -14 3 -6 3 0 0 Z" fill="#FFB067" />
      <path d="M-4 -1 L 4 -1 L -2 -11 L -7 -11 Z" fill="#FF6500" />
      <path d="M-4 1 L 4 1 L -2 11 L -7 11 Z" fill="#FF6500" />
      <path d="M-20 -1 L -26 -7 L -23 -7 L -17 -1 Z" fill="#FF6500" />
      <circle cx="4" cy="0" r="1.6" fill="#FFFFFF" />
    </g>
  );
}

function Ship() {
  return (
    <g>
      <path d="M0 0 H76 L66 14 H10 Z" fill="#111827" />
      <path d="M2 2 H74 L70 6 H6 Z" fill="#FF6500" />
      <rect x="12" y="-10" width="11" height="10" fill="#FF6500" />
      <rect x="25" y="-10" width="11" height="10" fill="#E5E7EB" />
      <rect x="38" y="-10" width="11" height="10" fill="#1E3A8A" />
      <rect x="51" y="-10" width="11" height="10" fill="#FF6500" />
      <rect x="20" y="-18" width="9" height="8" fill="#E5E7EB" />
      <rect x="44" y="-18" width="9" height="8" fill="#FF6500" />
    </g>
  );
}

function Truck() {
  return (
    <g>
      <rect x="0" y="-38" width="92" height="40" rx="3" fill="#FF6500" />
      <rect x="6" y="-30" width="60" height="4" fill="#FFB067" opacity="0.7" />
      <path d="M96 -26 H118 L132 -10 V2 H96 Z" fill="#1E3A8A" />
      <rect x="104" y="-20" width="16" height="10" fill="#93C5FD" opacity="0.8" />
      <rect x="96" y="-2" width="38" height="3" fill="#111827" />
      <circle cx="18" cy="4" r="8" fill="#0B1220" />
      <circle cx="18" cy="4" r="3" fill="#94A3B8" />
      <circle cx="112" cy="4" r="8" fill="#0B1220" />
      <circle cx="112" cy="4" r="3" fill="#94A3B8" />
    </g>
  );
}

export default function TransportScene() {
  const [still] = useState(reducedMotion);

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 800 280"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 h-full w-full"
    >
      <defs>
        <linearGradient id="ts-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#070B14" />
          <stop offset="0.6" stopColor="#0E1A2E" />
          <stop offset="1" stopColor="#120A05" />
        </linearGradient>
        <linearGradient id="ts-sea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0B2238" />
          <stop offset="1" stopColor="#050B14" />
        </linearGradient>
        <linearGradient id="ts-road" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1A1A1F" />
          <stop offset="1" stopColor="#0A0A0C" />
        </linearGradient>
        <radialGradient id="ts-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FF6500" stopOpacity="0.55" />
          <stop offset="1" stopColor="#FF6500" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Sky */}
      <rect x="0" y="0" width="800" height="280" fill="url(#ts-sky)" />
      <circle cx="640" cy="70" r="110" fill="url(#ts-glow)" />
      {STARS.map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill="#FFFFFF" opacity="0.7" className={still ? undefined : 'bs-twinkle'} style={{ animationDelay: `${(i * 0.37) % 3}s` }} />
      ))}

      {/* Flight path + plane */}
      <path d={FLIGHT_PATH} fill="none" stroke="#FF6500" strokeOpacity="0.45" strokeWidth="1.6" strokeDasharray="6 8" className={still ? undefined : 'bs-dash'} />
      <g>
        <Plane />
        {!still && (
          <animateMotion dur="18s" repeatCount="indefinite" rotate="auto" path={FLIGHT_PATH} />
        )}
      </g>

      {/* Sea */}
      <rect x="0" y="150" width="800" height="70" fill="url(#ts-sea)" />
      <path d="M0 156 Q 50 146 100 156 T 200 156 T 300 156 T 400 156 T 500 156 T 600 156 T 700 156 T 800 156 V 180 H 0 Z" fill="#0F3A5C" opacity="0.5" className={still ? undefined : 'bs-waves'} />
      <g>
        <Ship />
        {!still && (
          <animateMotion dur="24s" repeatCount="indefinite" path={SHIP_PATH} />
        )}
      </g>

      {/* Road + truck */}
      <rect x="0" y="226" width="800" height="54" fill="url(#ts-road)" />
      <rect x="0" y="226" width="800" height="2" fill="#FF6500" opacity="0.5" />
      <line x1="0" y1="268" x2="800" y2="268" stroke="#FFFFFF" strokeOpacity="0.35" strokeWidth="2" strokeDasharray="18 16" className={still ? undefined : 'bs-dash-fast'} />
      <g>
        <Truck />
        {!still && (
          <animateMotion dur="13s" repeatCount="indefinite" path={TRUCK_PATH} />
        )}
      </g>
    </svg>
  );
}
