/**
 * DiwaliBurst — firecracker-style spark bursts behind the hero headline.
 * Pure CSS keyframes (GPU transform/opacity only), decorative, non-interactive.
 * Stops for users who have reduced motion turned on (see diwali-burst.css).
 */
import './diwali-burst.css';

// Burst centres as % of the headline box, with a staggered start time (seconds) and a palette.
const BURSTS: Array<{ x: number; y: number; delay: number; hue: 'orange' | 'gold' | 'ember' }> = [
  { x: 14, y: 30, delay: 0.4, hue: 'orange' },
  { x: 58, y: 48, delay: 1.9, hue: 'gold' },
  { x: 86, y: 22, delay: 3.1, hue: 'ember' },
  { x: 30, y: 82, delay: 4.6, hue: 'gold' },
];

const SPARKS = 18;
const CYCLE = 6.5; // seconds before a burst repeats

export default function DiwaliBurst() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-visible">
      {BURSTS.map((b, bi) => (
        <div
          key={bi}
          className="bs-burst-centre"
          style={{ left: `${b.x}%`, top: `${b.y}%`, animationDelay: `${b.delay}s`, animationDuration: `${CYCLE}s` }}
        >
          <span className="bs-burst-flash" style={{ animationDelay: `${b.delay}s`, animationDuration: `${CYCLE}s` }} />
          {Array.from({ length: SPARKS }, (_, si) => {
            const angle = (si / SPARKS) * Math.PI * 2 + (bi % 2 ? 0.13 : 0);
            // Alternate long and short rays so the burst looks organic.
            const dist = si % 3 === 0 ? 120 : si % 3 === 1 ? 84 : 60;
            const dx = Math.cos(angle) * dist;
            const dy = Math.sin(angle) * dist;
            return (
              <span
                key={si}
                className={`bs-spark bs-spark-${b.hue}`}
                style={{
                  ['--dx' as string]: `${dx.toFixed(1)}px`,
                  ['--dy' as string]: `${dy.toFixed(1)}px`,
                  animationDelay: `${b.delay}s`,
                  animationDuration: `${CYCLE}s`,
                }}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
