import React from 'react';

/**
 * The two drawings the form kit uses. They are drawn here as vectors (no photographs): a warehouse with a forklift
 * for the side panel on desktop, and a quote clipboard for the top of the sheet on a phone. Both are decoration only.
 */

const CARTON = '#d39a5f';
const CARTON_DARK = '#b97d44';
const CARTON_TAPE = '#e9c79b';

/** One carton: a face, a darker lid edge and a strip of tape. */
function Carton({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={1.2} fill={CARTON} />
      <rect x={x} y={y} width={w} height={Math.max(2, h * 0.16)} fill={CARTON_DARK} opacity={0.55} />
      <rect x={x + w / 2 - 1.5} y={y} width={3} height={h} fill={CARTON_TAPE} opacity={0.75} />
      <rect x={x} y={y} width={w} height={h} rx={1.2} fill="none" stroke="#8a5a2c" strokeOpacity={0.45} strokeWidth={0.7} />
    </g>
  );
}

/** A bay of pallet racking seen from the front: blue uprights, orange beams, cartons on every level. */
function RackBay({ x, w, dim }: { x: number; w: number; dim?: boolean }) {
  const levels = [78, 128, 178, 228];
  return (
    <g opacity={dim ? 0.5 : 0.9}>
      {levels.map((y, level) => (
        <g key={y}>
          {[0, 1, 2].map((slot) => {
            const bw = w / 3 - 5;
            const bh = 26 + ((slot + level) % 3) * 6;
            return <Carton key={slot} x={x + 4 + slot * (w / 3)} y={y - bh} w={bw} h={bh} />;
          })}
          <rect x={x} y={y} width={w} height={4.5} fill="#ff6a13" />
        </g>
      ))}
      <rect x={x - 2.5} y={34} width={5} height={236} fill="#2f5d8f" />
      <rect x={x + w - 2.5} y={34} width={5} height={236} fill="#2f5d8f" />
    </g>
  );
}

export function WarehouseArt({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 340 300" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="fk-wa-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#12151b" />
          <stop offset="1" stopColor="#262b35" />
        </linearGradient>
        <linearGradient id="fk-wa-floor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4a505b" />
          <stop offset="1" stopColor="#8b919c" />
        </linearGradient>
        <linearGradient id="fk-wa-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0e1014" />
          <stop offset="0.3" stopColor="#0e1014" stopOpacity="0.72" />
          <stop offset="0.72" stopColor="#0e1014" stopOpacity="0.05" />
          <stop offset="1" stopColor="#0e1014" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="fk-wa-truck" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff8a2b" />
          <stop offset="1" stopColor="#f25c05" />
        </linearGradient>
        <radialGradient id="fk-wa-lamp" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffe9c9" stopOpacity="0.95" />
          <stop offset="1" stopColor="#ffe9c9" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="340" height="300" fill="url(#fk-wa-wall)" />
      {/* lamps along the roof */}
      {[40, 105, 170, 235, 300].map((x, i) => (
        <g key={x}>
          <ellipse cx={x} cy={44 + (i % 2) * 6} rx={26} ry={12} fill="url(#fk-wa-lamp)" opacity={0.5} />
          <ellipse cx={x} cy={44 + (i % 2) * 6} rx={7} ry={2.4} fill="#fff4de" />
        </g>
      ))}

      {/* racking: far bays dim, near bays bright */}
      <RackBay x={96} w={72} dim />
      <RackBay x={176} w={72} dim />
      <RackBay x={8} w={82} />
      <RackBay x={254} w={82} />

      {/* the floor, with a sheen */}
      <rect x="0" y="262" width="340" height="38" fill="url(#fk-wa-floor)" />
      <rect x="0" y="262" width="340" height="2" fill="#aab0bb" opacity="0.55" />
      <path d="M60 300 L130 262 L150 262 L96 300 Z" fill="#fff" opacity="0.07" />
      <path d="M210 300 L196 262 L212 262 L240 300 Z" fill="#fff" opacity="0.07" />

      {/* a pallet of cartons on the floor */}
      <g>
        <ellipse cx="52" cy="284" rx="44" ry="5" fill="#000" opacity="0.28" />
        <rect x="14" y="276" width="76" height="6" rx="1" fill="#a8743e" />
        <rect x="18" y="282" width="8" height="4" fill="#8a5a2c" />
        <rect x="48" y="282" width="8" height="4" fill="#8a5a2c" />
        <rect x="78" y="282" width="8" height="4" fill="#8a5a2c" />
        <Carton x={16} y={250} w={34} h={26} />
        <Carton x={52} y={250} w={36} h={26} />
        <Carton x={24} y={226} w={34} h={24} />
      </g>

      {/* the forklift, carrying a wrapped pallet */}
      <g>
        <ellipse cx="222" cy="288" rx="92" ry="6.5" fill="#000" opacity="0.34" />
        {/* load */}
        <rect x="118" y="268" width="74" height="6" rx="1" fill="#a8743e" />
        <Carton x={120} y={244} w={23} h={24} />
        <Carton x={144} y={244} w={23} h={24} />
        <Carton x={168} y={244} w={23} h={24} />
        <Carton x={120} y={220} w={23} h={24} />
        <Carton x={144} y={220} w={23} h={24} />
        <Carton x={168} y={220} w={23} h={24} />
        <Carton x={132} y={196} w={23} h={24} />
        <Carton x={156} y={196} w={23} h={24} />
        <rect x="118" y="194" width="76" height="74" rx="2" fill="#e8f4ff" opacity="0.13" />
        {/* forks and mast */}
        <rect x="112" y="274" width="92" height="4" rx="1.5" fill="#1b1e24" />
        <rect x="196" y="150" width="6" height="130" rx="1.5" fill="#23272e" />
        <rect x="205" y="150" width="6" height="130" rx="1.5" fill="#2e333b" />
        <rect x="194" y="232" width="20" height="44" rx="2" fill="#1b1e24" />
        {/* cab */}
        <path d="M216 232 L224 166 L282 166 L292 232" fill="none" stroke="#1b1e24" strokeWidth="4.5" strokeLinejoin="round" />
        <rect x="220" y="161" width="66" height="6" rx="3" fill="#1b1e24" />
        {/* driver */}
        <circle cx="256" cy="186" r="8.5" fill="#e2b48c" />
        <path d="M246.5 184 a9.5 9.5 0 0 1 19 0 l2 1.6 h-23 Z" fill="#ff7a1a" />
        <path d="M244 200 q12 -8 24 0 l4 30 h-32 Z" fill="#27303f" />
        <rect x="238" y="212" width="16" height="4" rx="2" fill="#27303f" transform="rotate(-20 238 212)" />
        <circle cx="234" cy="214" r="6" fill="none" stroke="#1b1e24" strokeWidth="2.5" />
        <rect x="262" y="214" width="14" height="18" rx="3" fill="#1b1e24" />
        {/* body */}
        <path d="M212 232 h72 q22 0 24 18 v20 q0 6 -6 6 h-90 q-4 0 -4 -4 v-36 q0 -4 4 -4 Z" fill="url(#fk-wa-truck)" />
        <path d="M284 232 q22 0 24 18 v20 q0 6 -6 6 h-18 Z" fill="#d94e00" />
        <rect x="216" y="240" width="60" height="5" rx="2.5" fill="#fff" opacity="0.28" />
        <rect x="222" y="252" width="34" height="9" rx="2" fill="#1b1e24" opacity="0.8" />
        {/* wheels */}
        <circle cx="232" cy="276" r="15" fill="#15171b" />
        <circle cx="232" cy="276" r="6.5" fill="#8b919c" />
        <circle cx="290" cy="278" r="12.5" fill="#15171b" />
        <circle cx="290" cy="278" r="5.5" fill="#8b919c" />
      </g>

      {/* melts into the panel above it */}
      <rect width="340" height="170" fill="url(#fk-wa-fade)" />
    </svg>
  );
}

export function ClipboardArt({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 160 132" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="fk-cb-board" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff8a2b" />
          <stop offset="1" stopColor="#f25c05" />
        </linearGradient>
        <linearGradient id="fk-cb-box" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#dca468" />
          <stop offset="1" stopColor="#bd8046" />
        </linearGradient>
      </defs>
      <ellipse cx="88" cy="124" rx="62" ry="5" fill="#000" opacity="0.1" />
      <g transform="rotate(-7 66 66)">
        <rect x="20" y="16" width="92" height="104" rx="9" fill="url(#fk-cb-board)" />
        <rect x="28" y="26" width="76" height="86" rx="4" fill="#fff" />
        <rect x="48" y="8" width="36" height="18" rx="5" fill="#3d4654" />
        <circle cx="66" cy="10" r="5" fill="none" stroke="#3d4654" strokeWidth="3" />
        <text x="66" y="47" textAnchor="middle" fontFamily="Inter, system-ui, sans-serif" fontSize="13" fontWeight="800" fontStyle="italic" fill="#3d4654">
          QUOTE
        </text>
        {[58, 78].map((y) => (
          <g key={y}>
            <rect x="36" y={y} width="13" height="13" rx="3" fill="#ff5a00" />
            <path d={`M39 ${y + 6.5} l3 3 l5 -6`} fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="55" y={y + 2} width="40" height="3" rx="1.5" fill="#d7dbe2" />
            <rect x="55" y={y + 8} width="26" height="3" rx="1.5" fill="#e6e9ee" />
          </g>
        ))}
      </g>
      {/* cartons */}
      <g>
        <rect x="96" y="66" width="54" height="52" rx="3" fill="url(#fk-cb-box)" />
        <path d="M96 69 q0 -3 3 -3 h48 q3 0 3 3 v9 h-54 Z" fill="#b97d44" />
        <rect x="119" y="66" width="8" height="52" fill="#ecd0a8" opacity="0.8" />
        <rect x="70" y="92" width="34" height="26" rx="2.5" fill="#c98b4f" />
        <path d="M70 94.5 q0 -2.5 2.5 -2.5 h29 q2.500 0 2.5 2.5 v5.500 h-34 Z" fill="#a96f3a" />
        <rect x="84" y="92" width="6" height="26" fill="#ecd0a8" opacity="0.8" />
      </g>
    </svg>
  );
}
