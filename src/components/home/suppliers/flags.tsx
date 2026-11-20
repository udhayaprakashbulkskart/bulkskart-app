import React from 'react';

/**
 * Small flat flags (30 x 20) for the country chips and the supplier cards.
 * Emoji flags are drawn as two letters on Windows, so the common ones are drawn here instead.
 * Anything not listed falls back to the emoji the data already carries.
 */

const W = 30;
const H = 20;

function star(cx: number, cy: number, r: number, rotate = 0): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? r : r * 0.382;
    const angle = ((i * 36 - 90 + rotate) * Math.PI) / 180;
    pts.push(`${(cx + radius * Math.cos(angle)).toFixed(2)},${(cy + radius * Math.sin(angle)).toFixed(2)}`);
  }
  return pts.join(' ');
}

const bands = (colors: string[], vertical = false) =>
  colors.map((fill, i) =>
    vertical ? (
      <rect key={i} x={(W / colors.length) * i} y={0} width={W / colors.length + 0.2} height={H} fill={fill} />
    ) : (
      <rect key={i} x={0} y={(H / colors.length) * i} width={W} height={H / colors.length + 0.2} fill={fill} />
    ),
  );

const FLAG_ART: Record<string, React.ReactNode> = {
  India: (
    <>
      {bands(['#ff9933', '#ffffff', '#138808'])}
      <circle cx={15} cy={10} r={2.4} fill="none" stroke="#000080" strokeWidth={0.6} />
      <circle cx={15} cy={10} r={0.55} fill="#000080" />
    </>
  ),
  China: (
    <>
      <rect width={W} height={H} fill="#de2910" />
      <polygon points={star(6, 5.6, 3.2)} fill="#ffde00" />
      <polygon points={star(11.6, 2.4, 1.1, 20)} fill="#ffde00" />
      <polygon points={star(13.6, 4.6, 1.1, 40)} fill="#ffde00" />
      <polygon points={star(13.6, 7.4, 1.1, 20)} fill="#ffde00" />
      <polygon points={star(11.6, 9.6, 1.1)} fill="#ffde00" />
    </>
  ),
  USA: (
    <>
      <rect width={W} height={H} fill="#ffffff" />
      {Array.from({ length: 7 }, (_, i) => (
        <rect key={i} x={0} y={(H / 13) * i * 2} width={W} height={H / 13} fill="#b22234" />
      ))}
      <rect width={13} height={(H / 13) * 7} fill="#3c3b6e" />
      {Array.from({ length: 12 }, (_, i) => (
        <circle key={i} cx={2.2 + (i % 4) * 3.1} cy={2 + Math.floor(i / 4) * 2.6} r={0.62} fill="#ffffff" />
      ))}
    </>
  ),
  Germany: <>{bands(['#000000', '#dd0000', '#ffce00'])}</>,
  UAE: (
    <>
      {bands(['#00732f', '#ffffff', '#000000'])}
      <rect width={8} height={H} fill="#ff0000" />
    </>
  ),
  Japan: (
    <>
      <rect width={W} height={H} fill="#ffffff" />
      <circle cx={15} cy={10} r={5.4} fill="#bc002d" />
    </>
  ),
  'South Korea': (
    <>
      <rect width={W} height={H} fill="#ffffff" />
      <circle cx={15} cy={10} r={4.6} fill="#cd2e3a" />
      <path d="M10.4 10a4.6 4.6 0 0 0 9.2 0a2.3 2.3 0 0 0-4.6 0a2.3 2.3 0 0 1-4.6 0z" fill="#0047a0" />
      {[
        [4.4, 3.6, 40],
        [25.6, 3.6, -40],
        [4.4, 16.4, -40],
        [25.6, 16.4, 40],
      ].map(([x, y, r], i) => (
        <rect key={i} x={x - 2.2} y={y - 0.35} width={4.4} height={0.7} fill="#000000" transform={`rotate(${r} ${x} ${y})`} />
      ))}
    </>
  ),
  UK: (
    <>
      <rect width={W} height={H} fill="#012169" />
      <path d="M0 0L30 20M30 0L0 20" stroke="#ffffff" strokeWidth={3.4} />
      <path d="M0 0L30 20M30 0L0 20" stroke="#c8102e" strokeWidth={1.2} />
      <path d="M15 0V20M0 10H30" stroke="#ffffff" strokeWidth={5.6} />
      <path d="M15 0V20M0 10H30" stroke="#c8102e" strokeWidth={3.2} />
    </>
  ),
  France: <>{bands(['#0055a4', '#ffffff', '#ef4135'], true)}</>,
  Italy: <>{bands(['#009246', '#ffffff', '#ce2b37'], true)}</>,
  Sweden: (
    <>
      <rect width={W} height={H} fill="#006aa7" />
      <rect x={9} width={4.6} height={H} fill="#fecc00" />
      <rect y={7.7} width={W} height={4.6} fill="#fecc00" />
    </>
  ),
  Turkey: (
    <>
      <rect width={W} height={H} fill="#e30a17" />
      <circle cx={11.4} cy={10} r={5} fill="#ffffff" />
      <circle cx={12.9} cy={10} r={4} fill="#e30a17" />
      <polygon points={star(17.4, 10, 2.2, 18)} fill="#ffffff" />
    </>
  ),
  Singapore: (
    <>
      <rect width={W} height={10} fill="#ef3340" />
      <rect y={10} width={W} height={10} fill="#ffffff" />
      <circle cx={7.4} cy={5} r={3.2} fill="#ffffff" />
      <circle cx={8.6} cy={5} r={2.7} fill="#ef3340" />
      {[
        [11.6, 3.2],
        [14.2, 5],
        [13.2, 7.8],
        [10.2, 7.8],
        [9.2, 5],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={0.55} fill="#ffffff" />
      ))}
    </>
  ),
  Vietnam: (
    <>
      <rect width={W} height={H} fill="#da251d" />
      <polygon points={star(15, 10.4, 6)} fill="#ffff00" />
    </>
  ),
  Thailand: (
    <>
      <rect width={W} height={H} fill="#a51931" />
      <rect y={3.3} width={W} height={13.4} fill="#f4f5f8" />
      <rect y={6.7} width={W} height={6.6} fill="#2d2a4a" />
    </>
  ),
  Canada: (
    <>
      <rect width={W} height={H} fill="#ffffff" />
      <rect width={7.5} height={H} fill="#d52b1e" />
      <rect x={22.5} width={7.5} height={H} fill="#d52b1e" />
      <polygon
        points="15,3 16.4,6 18.2,5.4 17.6,8.6 20,7.6 19.4,9.4 21.4,10.4 18.6,12.6 19,13.8 15.8,13.4 15.8,17 14.2,17 14.2,13.4 11,13.8 11.4,12.6 8.6,10.4 10.6,9.4 10,7.6 12.4,8.6 11.8,5.4 13.6,6"
        fill="#d52b1e"
      />
    </>
  ),
  Switzerland: (
    <>
      <rect width={W} height={H} fill="#d52b1e" />
      <rect x={12.6} y={4.2} width={4.8} height={11.6} fill="#ffffff" />
      <rect x={9.2} y={7.6} width={11.6} height={4.8} fill="#ffffff" />
    </>
  ),
  Spain: (
    <>
      <rect width={W} height={H} fill="#aa151b" />
      <rect y={5} width={W} height={10} fill="#f1bf00" />
    </>
  ),
  Netherlands: <>{bands(['#ae1c28', '#ffffff', '#21468b'])}</>,
  Poland: <>{bands(['#ffffff', '#dc143c'])}</>,
  Russia: <>{bands(['#ffffff', '#0039a6', '#d52b1e'])}</>,
  Indonesia: <>{bands(['#ce1126', '#ffffff'])}</>,
  Mexico: (
    <>
      {bands(['#006847', '#ffffff', '#ce1126'], true)}
      <circle cx={15} cy={10} r={2.3} fill="#8c5a2b" opacity={0.85} />
    </>
  ),
  Australia: (
    <>
      <rect width={W} height={H} fill="#012169" />
      <rect width={15} height={10} fill="#012169" />
      <path d="M0 0L15 10M15 0L0 10" stroke="#ffffff" strokeWidth={1.8} />
      <path d="M0 0L15 10M15 0L0 10" stroke="#c8102e" strokeWidth={0.6} />
      <path d="M7.5 0V10M0 5H15" stroke="#ffffff" strokeWidth={3} />
      <path d="M7.5 0V10M0 5H15" stroke="#c8102e" strokeWidth={1.7} />
      <polygon points={star(7.5, 15.2, 2.4)} fill="#ffffff" />
      <polygon points={star(22.5, 3.6, 1.1)} fill="#ffffff" />
      <polygon points={star(26.2, 8.2, 1.1)} fill="#ffffff" />
      <polygon points={star(22.5, 13.2, 1.1)} fill="#ffffff" />
      <polygon points={star(18.8, 8, 1.1)} fill="#ffffff" />
    </>
  ),
  Brazil: (
    <>
      <rect width={W} height={H} fill="#009c3b" />
      <polygon points="15,2 27.4,10 15,18 2.6,10" fill="#ffdf00" />
      <circle cx={15} cy={10} r={4.3} fill="#002776" />
      <path d="M10.8 9.2q4.4-1.1 8.6 1.4" stroke="#ffffff" strokeWidth={0.7} fill="none" />
    </>
  ),
};

/** Names the data uses for the same country. */
const ALIASES: Record<string, string> = {
  'united states': 'USA',
  'united states of america': 'USA',
  us: 'USA',
  'united arab emirates': 'UAE',
  'united kingdom': 'UK',
  'great britain': 'UK',
  england: 'UK',
  korea: 'South Korea',
  'republic of korea': 'South Korea',
  'viet nam': 'Vietnam',
  turkiye: 'Turkey',
};

function canonical(country: string): string {
  const key = country.trim();
  const alias = ALIASES[key.toLowerCase()];
  return alias ?? key;
}

export function hasFlag(country: string): boolean {
  return canonical(country) in FLAG_ART;
}

/** A flat flag for a country, or the emoji passed in when there is no drawing for it. */
export function Flag({ country, fallback, className }: { country: string; fallback?: string; className?: string }) {
  const art = FLAG_ART[canonical(country)];
  if (!art) {
    return (
      <span className={className} aria-hidden="true" data-flag="emoji">
        {fallback ?? '🌐'}
      </span>
    );
  }
  return (
    <svg className={className} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" data-flag={canonical(country)} preserveAspectRatio="none">
      {art}
      <rect width={W} height={H} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={0.8} />
      <rect width={W} height={6} fill="rgba(255,255,255,0.1)" />
    </svg>
  );
}
