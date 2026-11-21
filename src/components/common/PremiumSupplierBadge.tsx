/**
 * Gold "PREMIUM SUPPLIER" emblem: crown, shield plaque and laurel branches, drawn in SVG so it stays sharp at any size.
 */
import { useId } from 'react';

const LEAVES = Array.from({ length: 7 }, (_, i) => i);

/** A laurel leaf on the left branch, along a circle around the plaque (mirrored for the right branch). */
function leaf(i: number) {
  const angle = ((118 + i * 15) * Math.PI) / 180;
  const x = 100 + 82 * Math.cos(angle);
  const y = 84 + 82 * Math.sin(angle);
  const tilt = 118 + i * 15 + 90 + (i % 2 ? 28 : -28);
  return { x, y, tilt };
}

export default function PremiumSupplierBadge({ className = '' }: { className?: string }) {
  const id = useId().replace(/:/g, '');
  const gold = `gold-${id}`;
  const goldText = `gold-text-${id}`;
  const plate = `plate-${id}`;
  return (
    <svg viewBox="0 0 200 165" className={className} role="img" aria-label="Premium Supplier">
      <defs>
        <linearGradient id={gold} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFF1A8" />
          <stop offset="0.45" stopColor="#FFC928" />
          <stop offset="1" stopColor="#C27C00" />
        </linearGradient>
        <linearGradient id={goldText} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFE680" />
          <stop offset="1" stopColor="#F0A800" />
        </linearGradient>
        <linearGradient id={plate} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2A1E08" />
          <stop offset="1" stopColor="#0D0903" />
        </linearGradient>
      </defs>

      {/* laurel branches */}
      {[false, true].map((mirror) => (
        <g key={String(mirror)} transform={mirror ? 'translate(200 0) scale(-1 1)' : undefined}>
          <path d="M61 156 A82 82 0 0 1 22 66" fill="none" stroke={`url(#${gold})`} strokeWidth="2.4" strokeLinecap="round" />
          {LEAVES.map((i) => {
            const { x, y, tilt } = leaf(i);
            return <ellipse key={i} cx={x} cy={y} rx="10" ry="4.2" fill={`url(#${gold})`} transform={`rotate(${tilt} ${x} ${y})`} />;
          })}
        </g>
      ))}

      {/* crown */}
      <g fill={`url(#${gold})`}>
        <path d="M68 58 L61 22 L84 41 L100 10 L116 41 L139 22 L132 58 Z" stroke="#8A5400" strokeWidth="1.2" strokeLinejoin="round" />
        <rect x="67" y="54" width="66" height="9" rx="2.5" stroke="#8A5400" strokeWidth="1.2" />
        <circle cx="61" cy="21" r="4.5" />
        <circle cx="100" cy="9" r="5" />
        <circle cx="139" cy="21" r="4.5" />
      </g>

      {/* plaque */}
      <path d="M47 70 H153 L162 80 V106 L100 140 L38 106 V80 Z" fill={`url(#${plate})`} stroke={`url(#${gold})`} strokeWidth="3.2" strokeLinejoin="round" />
      <path d="M52 76 H148 L155 83 V103 L100 132 L45 103 V83 Z" fill="none" stroke="#FFC928" strokeOpacity="0.35" strokeWidth="1" />
      <text x="100" y="97" textAnchor="middle" fontSize="17" fontWeight="900" fill="#FFFFFF" fontFamily="inherit" letterSpacing="0.5">PREMIUM</text>
      <text x="100" y="116" textAnchor="middle" fontSize="15" fontWeight="900" fill={`url(#${goldText})`} fontFamily="inherit" letterSpacing="0.5">SUPPLIER</text>
      <path d="M100 121 l1.6 3.4 3.6 0.4 -2.7 2.4 0.8 3.6 -3.3 -1.9 -3.3 1.9 0.8 -3.6 -2.7 -2.4 3.6 -0.4 Z" fill="#FFC928" />
    </svg>
  );
}
