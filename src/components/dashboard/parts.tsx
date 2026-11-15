import React, { useId, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { compact, niceCeil } from './series';
import './dashboard.css';

/* ───────────── panel ───────────── */

interface PanelProps {
  title: string;
  subtitle?: string;
  /** Something to show at the right of the title (a pill, a link). */
  right?: React.ReactNode;
  /** When given, an arrow button leads there. */
  to?: string;
  legend?: Array<{ label: string; color: string }>;
  className?: string;
  children: React.ReactNode;
}

export function Panel({ title, subtitle, right, to, legend, className, children }: PanelProps) {
  return (
    <section className={`dp${className ? ` ${className}` : ''}`}>
      <header className="dp-head">
        <div className="min-w-0">
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
          {legend && (
            <div className="dp-legend">
              {legend.map((item) => (
                <span key={item.label}>
                  <i style={{ background: item.color }} aria-hidden="true" />
                  {item.label}
                </span>
              ))}
            </div>
          )}
        </div>
        {right}
        {to && (
          <Link to={to} className="dp-go" aria-label={`Open ${title}`}>
            <ArrowUpRight aria-hidden="true" />
          </Link>
        )}
      </header>
      {children}
    </section>
  );
}

/* ───────────── how a change is drawn ───────────── */

/** A rise has an up arrow, a fall a down arrow, and no change has neither: an arrow on 0% would claim growth that did not happen. */
function changeLook(pct: number): { tone: 'is-up' | 'is-down' | 'is-flat'; text: string } {
  if (pct > 0) return { tone: 'is-up', text: `▲ ${pct}%` };
  if (pct < 0) return { tone: 'is-down', text: `▼ ${Math.abs(pct)}%` };
  return { tone: 'is-flat', text: '● No change' };
}

/* ───────────── KPI card ───────────── */

export type KpiTone = 'orange' | 'purple' | 'green' | 'blue' | 'rose' | 'teal' | 'yellow';

export interface Delta {
  /** Change in percent; null when there is nothing to compare with. */
  pct: number | null;
  /** What it was compared with, for example "vs last month". */
  label: string;
}

interface KpiProps {
  title: string;
  value: React.ReactNode;
  suffix?: string;
  icon: React.ElementType;
  tone: KpiTone;
  /** Makes the whole card a link. */
  to?: string;
  delta?: Delta;
  moreLabel?: string;
}

export function Kpi({ title, value, suffix, icon: Icon, tone, to, delta, moreLabel = 'View more' }: KpiProps) {
  const body = (
    <>
      <div className="dk-top">
        <span className="dk-title">{title}</span>
        <span className={`dk-chip is-${tone}`} aria-hidden="true">
          <Icon />
        </span>
      </div>
      <div className="dk-value">
        {value}
        {suffix && <small>{suffix}</small>}
      </div>
      {delta && delta.pct !== null && (
        <p className={`dk-delta ${changeLook(delta.pct).tone}`}>
          <b>{changeLook(delta.pct).text}</b> {delta.label}
        </p>
      )}
      {to && <span className="dk-more">{moreLabel} ↗</span>}
    </>
  );
  return to ? (
    <Link to={to} className="dk">
      {body}
    </Link>
  ) : (
    <div className="dk">{body}</div>
  );
}

/* ───────────── small stat tile ───────────── */

export function Mini({ label, value, pct }: { label: string; value: React.ReactNode; pct?: number | null }) {
  return (
    <div className="dmini">
      <span>{label}</span>
      <b>{value}</b>
      {pct !== undefined && pct !== null && <em className={changeLook(pct).tone}>{changeLook(pct).text}</em>}
    </div>
  );
}

/* ───────────── quick link button ───────────── */

export function QuickLink({ to, icon: Icon, label, count }: { to: string; icon: React.ElementType; label: string; count?: number }) {
  return (
    <Link to={to} className="dq">
      <Icon aria-hidden="true" />
      <span>{label}</span>
      {count !== undefined && count > 0 && <b>{count}</b>}
    </Link>
  );
}

/* ───────────── cylinder bar chart with an optional line ───────────── */

const W = 720;
const H = 300;
const PAD = { l: 44, r: 12, t: 16, b: 30 };

interface BarsChartProps {
  /** One label per bar, for example "Jan". */
  months: string[];
  bars: number[];
  barLabel: string;
  line?: number[];
  lineLabel?: string;
  /** Said instead of an empty chart when every value is zero. */
  emptyText: string;
  ariaLabel: string;
}

/** A smooth path through the points (a Catmull-Rom curve), kept inside the plot. */
function smoothPath(points: Array<[number, number]>, top: number, bottom: number): string {
  if (points.length === 0) return '';
  const clamp = (y: number) => Math.min(bottom, Math.max(top, y));
  let d = `M${points[0][0].toFixed(1)},${points[0][1].toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = clamp(p1[1] + (p2[1] - p0[1]) / 6);
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = clamp(p2[1] - (p3[1] - p1[1]) / 6);
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

export function BarsChart({ months, bars, barLabel, line, lineLabel, emptyText, ariaLabel }: BarsChartProps) {
  const uid = useId().replace(/:/g, '');
  const [hover, setHover] = useState<number | null>(null);
  const n = months.length;

  const geometry = useMemo(() => {
    const highest = Math.max(0, ...bars, ...(line ?? []));
    const max = niceCeil(highest);
    const plotW = W - PAD.l - PAD.r;
    const plotH = H - PAD.t - PAD.b;
    const slot = plotW / n;
    const bw = Math.min(34, slot * 0.58);
    const y = (v: number) => PAD.t + plotH - (v / max) * plotH;
    const cx = (i: number) => PAD.l + slot * i + slot / 2;
    const ticks = [0, 1, 2, 3, 4].map((i) => ({ value: (max * i) / 4, y: y((max * i) / 4) }));
    const linePoints: Array<[number, number]> = (line ?? []).map((v, i) => [cx(i), y(v)]);
    return { max, plotH, slot, bw, y, cx, ticks, linePoints, highest, base: PAD.t + plotH };
  }, [bars, line, n]);

  if (geometry.highest === 0) {
    return <div className="dbars-empty">{emptyText}</div>;
  }

  const { bw, y, cx, ticks, linePoints, base } = geometry;
  const ry = 6;

  return (
    <div className="dbars">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel}>
        <defs>
          <linearGradient id={`${uid}-body`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#ffb877" />
            <stop offset="0.22" stopColor="#f7913f" />
            <stop offset="0.58" stopColor="#df6f2a" />
            <stop offset="1" stopColor="#8f3b12" />
          </linearGradient>
          <linearGradient id={`${uid}-cap`} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#ffe0bd" />
            <stop offset="1" stopColor="#f4a15c" />
          </linearGradient>
          <filter id={`${uid}-glow`} x="-10%" y="-30%" width="120%" height="160%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {ticks.map((tick) => (
          <g key={tick.value}>
            <line x1={PAD.l} x2={W - PAD.r} y1={tick.y} y2={tick.y} stroke="rgba(255,255,255,0.06)" strokeDasharray={tick.value === 0 ? undefined : '3 5'} />
            <text x={PAD.l - 10} y={tick.y + 4} textAnchor="end">
              {compact(Math.round(tick.value * 10) / 10)}
            </text>
          </g>
        ))}

        {bars.map((v, i) => {
          if (v <= 0) return null;
          const top = Math.min(y(v), base - ry * 2 - 1);
          return (
            <g key={months[i] + i}>
              <g className="dbar" style={{ animationDelay: `${i * 45}ms` }}>
                <rect x={cx(i) - bw / 2} y={top + ry} width={bw} height={base - top - ry} fill={`url(#${uid}-body)`} />
                <ellipse cx={cx(i)} cy={base} rx={bw / 2} ry={ry} fill="#8f3b12" opacity="0.55" />
                <ellipse cx={cx(i)} cy={top + ry} rx={bw / 2} ry={ry} fill={`url(#${uid}-cap)`} />
                <rect x={cx(i) - bw / 2} y={top + ry} width={bw} height={base - top - ry} fill="#fff" opacity={hover === i ? 0.12 : 0} />
              </g>
            </g>
          );
        })}

        {line && linePoints.length > 1 && (
          <g className="dline" filter={`url(#${uid}-glow)`}>
            <path d={smoothPath(linePoints, PAD.t, base)} fill="none" stroke="#34d399" strokeWidth="2.4" strokeLinecap="round" />
            {linePoints.map(([px, py], i) => (
              <circle key={i} cx={px} cy={py} r={hover === i ? 4.5 : 3} fill="#0f1014" stroke="#34d399" strokeWidth="2" />
            ))}
          </g>
        )}

        {months.map((label, i) => (
          <text key={label + i} x={cx(i)} y={H - 8} textAnchor="middle">
            {label}
          </text>
        ))}

        {months.map((label, i) => (
          <rect
            key={`hit-${label}-${i}`}
            className="dhit"
            x={cx(i) - geometry.slot / 2}
            y={PAD.t}
            width={geometry.slot}
            height={geometry.plotH}
            tabIndex={0}
            aria-label={`${label}: ${bars[i]} ${barLabel}${line ? `, ${line[i]} ${lineLabel ?? ''}` : ''}`}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover((h) => (h === i ? null : h))}
            onFocus={() => setHover(i)}
            onBlur={() => setHover((h) => (h === i ? null : h))}
          />
        ))}
      </svg>

      {hover !== null && (
        <div className="dtip" style={{ left: `${(cx(hover) / W) * 100}%`, top: `${(Math.min(y(bars[hover] ?? 0), line ? y(line[hover] ?? 0) : base) / H) * 100}%` }} role="presentation">
          <span>{months[hover]}</span>
          <i style={{ background: '#f2802d' }} />
          {bars[hover]} {barLabel}
          {line && (
            <>
              <br />
              <i style={{ background: '#34d399' }} />
              {line[hover]} {lineLabel}
            </>
          )}
        </div>
      )}

      {/* the same figures for screen readers; the wrapper hides it, because a table ignores the one-pixel size of sr-only */}
      <div className="sr-only">
        <table>
          <caption>{ariaLabel}</caption>
          <thead>
            <tr>
              <th>Month</th>
              <th>{barLabel}</th>
              {line && <th>{lineLabel}</th>}
            </tr>
          </thead>
          <tbody>
            {months.map((label, i) => (
              <tr key={label + i}>
                <td>{label}</td>
                <td>{bars[i]}</td>
                {line && <td>{line[i]}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ───────────── segmented gauge ───────────── */

interface GaugeProps {
  /** 0 to 100, or null when there is nothing to measure yet. */
  value: number | null;
  label: string;
  /** Said under the dash when value is null. */
  emptyText?: string;
}

const G = { w: 250, h: 196, cx: 125, cy: 122, r: 92, len: 28, ticks: 15, start: 150, sweep: 240 };

function tickColor(i: number, n: number): string {
  // lighter orange at the start of the arc, deeper at the end
  const t = n <= 1 ? 0 : i / (n - 1);
  const from = [255, 184, 119];
  const to = [226, 104, 36];
  const c = from.map((f, k) => Math.round(f + (to[k] - f) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

export function Gauge({ value, label, emptyText }: GaugeProps) {
  const filled = value === null ? 0 : Math.round((Math.min(100, Math.max(0, value)) / 100) * G.ticks);
  const shown = value === null ? '—' : `${Math.round(value * 10) / 10}%`;
  return (
    <div className="dgauge" role="img" aria-label={value === null ? `${label}: no data yet` : `${label}: ${shown}`}>
      <svg viewBox={`0 0 ${G.w} ${G.h}`} aria-hidden="true">
        {Array.from({ length: G.ticks }, (_, i) => {
          const angle = G.start + (G.sweep * i) / (G.ticks - 1);
          const on = i < filled;
          return (
            <rect
              key={i}
              className="dtick"
              x={-6}
              y={-G.r - G.len / 2}
              width={12}
              height={G.len}
              rx={6}
              fill={on ? tickColor(i, G.ticks) : '#26272e'}
              transform={`translate(${G.cx} ${G.cy}) rotate(${angle + 90})`}
            />
          );
        })}
      </svg>
      <div className="dgauge-center">
        <b>{shown}</b>
        <span>{value === null && emptyText ? emptyText : label}</span>
      </div>
    </div>
  );
}
