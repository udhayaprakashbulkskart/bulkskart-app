import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { compact, niceCeil } from './series';
import './dashboard.css';

/* ───────────── motion ───────────── */

/** Count-ups and bar growth only run where the browser says motion is welcome; tests and old browsers see the final figure at once. */
function motionAllowed(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** A figure that climbs from 0 to its value the first time it appears, and from the old value to the new one after that. */
function useCountUp(target: number, enabled: boolean, duration = 900): number {
  const [current, setCurrent] = useState(enabled ? 0 : target);
  const from = useRef(enabled ? 0 : target);
  useEffect(() => {
    if (!enabled) {
      from.current = target;
      setCurrent(target);
      return undefined;
    }
    const origin = from.current;
    const startedAt = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - (1 - t) ** 3;
      const next = origin + (target - origin) * eased;
      from.current = next;
      setCurrent(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, enabled, duration]);
  return current;
}

const NUMBER_IN_TEXT = /^([^\d-]*)(-?\d[\d,]*(?:\.\d+)?)(.*)$/;

interface ParsedFigure {
  prefix: string;
  target: number;
  decimals: number;
  grouped: boolean;
  suffix: string;
}

/** Splits "₹48,000" into a prefix, the number and a suffix, so the number can be animated and the rest kept as it is. */
function parseFigure(value: React.ReactNode): ParsedFigure | null {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    const text = String(value);
    return { prefix: '', target: value, decimals: text.includes('.') ? text.split('.')[1].length : 0, grouped: false, suffix: '' };
  }
  if (typeof value !== 'string') return null;
  const match = NUMBER_IN_TEXT.exec(value);
  if (!match) return null;
  const raw = match[2];
  const target = Number(raw.replace(/,/g, ''));
  if (!Number.isFinite(target)) return null;
  return { prefix: match[1], target, decimals: raw.includes('.') ? raw.split('.')[1].length : 0, grouped: raw.includes(','), suffix: match[3] };
}

export function AnimatedValue({ value }: { value: React.ReactNode }) {
  const figure = useMemo(() => parseFigure(value), [value]);
  const [enabled] = useState(motionAllowed);
  const current = useCountUp(figure?.target ?? 0, enabled && figure !== null);
  if (!figure) return <>{value}</>;
  // once it has arrived, show the text exactly as it was given
  if (!enabled || current === figure.target) return <>{value}</>;
  const text = figure.grouped
    ? current.toLocaleString(undefined, { minimumFractionDigits: figure.decimals, maximumFractionDigits: figure.decimals })
    : current.toFixed(figure.decimals);
  return (
    <>
      {figure.prefix}
      {text}
      {figure.suffix}
    </>
  );
}

/* ───────────── how a change is drawn ───────────── */

/** A rise has an up arrow, a fall a down arrow, and no change has neither: an arrow on 0% would claim growth that did not happen. */
function changeLook(pct: number): { tone: 'is-up' | 'is-down' | 'is-flat'; text: string } {
  if (pct > 0) return { tone: 'is-up', text: `▲ ${pct}%` };
  if (pct < 0) return { tone: 'is-down', text: `▼ ${Math.abs(pct)}%` };
  return { tone: 'is-flat', text: '● No change' };
}

/* ───────────── page header ───────────── */

interface PageHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  /** Buttons at the right of the title. */
  actions?: React.ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <header className="dhead">
      <div className="dhead-text">
        <h1 className="dhead-title">{title}</h1>
        {subtitle && <div className="dhead-sub">{subtitle}</div>}
      </div>
      {actions && <div className="dhead-actions">{actions}</div>}
    </header>
  );
}

/* ───────────── loading placeholder ───────────── */

export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <span className={`dskel${className ? ` ${className}` : ''}`} style={style} aria-hidden="true" />;
}

/* ───────────── notice ───────────── */

interface NoticeProps {
  icon: React.ElementType;
  title: React.ReactNode;
  /** A small tag after the title, for example "Contacts Locked". */
  tag?: string;
  children?: React.ReactNode;
  /** Buttons at the right. */
  action?: React.ReactNode;
  tone?: 'info' | 'warn' | 'bad' | 'good';
}

/** A frosted banner with an icon, used for things the person should know or do. */
export function Notice({ icon: Icon, title, tag, children, action, tone = 'info' }: NoticeProps) {
  return (
    <div className={`dnotice is-${tone}`}>
      <div className="flex min-w-0 items-center gap-3">
        <span className="dnotice-ico" aria-hidden="true">
          <Icon />
        </span>
        <div className="min-w-0">
          <b>{title}</b>
          {tag && <span className="dsh-flag">{tag}</span>}
          {children && <p>{children}</p>}
        </div>
      </div>
      {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}

/* ───────────── segmented control ───────────── */

interface SegmentedProps<T extends string> {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  label: string;
}

export function Segmented<T extends string>({ options, value, onChange, label }: SegmentedProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const move = (event: React.KeyboardEvent, index: number) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const next = (index + (event.key === 'ArrowRight' ? 1 : options.length - 1)) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };
  return (
    <div className="dseg" role="tablist" aria-label={label}>
      {options.map((option, index) => (
        <button
          key={option.value}
          ref={(node) => {
            refs.current[index] = node;
          }}
          type="button"
          role="tab"
          aria-selected={option.value === value}
          tabIndex={option.value === value ? 0 : -1}
          className={option.value === value ? 'is-on' : undefined}
          onClick={() => onChange(option.value)}
          onKeyDown={(event) => move(event, index)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/* ───────────── panel ───────────── */

interface PanelProps {
  title: string;
  subtitle?: string;
  /** Something to show at the right of the title (a pill, a switch). */
  right?: React.ReactNode;
  /** When given, a round arrow button leads there. */
  to?: string;
  className?: string;
  children: React.ReactNode;
}

export function Panel({ title, subtitle, right, to, className, children }: PanelProps) {
  return (
    <section className={`dp${className ? ` ${className}` : ''}`}>
      <header className="dp-head">
        <div className="min-w-0">
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
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
  /** Makes the whole card a button instead (for a card that switches a tab on the same page). */
  onClick?: () => void;
  delta?: Delta;
  /** A line of small print under the title. */
  hint?: string;
  /** Draws a shimmer where the figure will be. */
  loading?: boolean;
}

export function Kpi({ title, value, suffix, icon: Icon, tone, to, onClick, delta, hint, loading = false }: KpiProps) {
  const change = delta && delta.pct !== null ? changeLook(delta.pct) : null;
  const small = hint ?? (change ? delta?.label : undefined);
  const body = (
    <>
      <div className="dk-top">
        <span className={`dk-chip is-${tone}`} aria-hidden="true">
          <Icon />
        </span>
        {change ? <span className={`dk-delta ${change.tone}`}>{change.text}</span> : to || onClick ? <ArrowUpRight className="dk-go" aria-hidden="true" /> : null}
      </div>
      <div className="dk-value">
        {loading ? (
          <>
            <Skeleton className="dskel-value" />
            <span className="sr-only">Loading</span>
          </>
        ) : (
          <>
            <AnimatedValue value={value} />
            {suffix && <small>{suffix}</small>}
          </>
        )}
      </div>
      <b className="dk-title">{title}</b>
      {small && <span className="dk-sub">{small}</span>}
    </>
  );
  if (to) {
    return (
      <Link to={to} className="dk" aria-busy={loading || undefined}>
        {body}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" className="dk" onClick={onClick} aria-busy={loading || undefined}>
        {body}
      </button>
    );
  }
  return (
    <div className="dk" aria-busy={loading || undefined}>
      {body}
    </div>
  );
}

/* ───────────── small stat tile ───────────── */

export function Mini({ label, value, pct, dark = false }: { label: string; value: React.ReactNode; pct?: number | null; dark?: boolean }) {
  return (
    <div className={`dmini${dark ? ' is-dark' : ''}`}>
      <span>{label}</span>
      <b>{value}</b>
      {pct !== undefined && pct !== null && <em className={changeLook(pct).tone}>{changeLook(pct).text}</em>}
    </div>
  );
}

/* ───────────── stat strip item ───────────── */

export function QuickLink({ to, icon: Icon, label, count }: { to: string; icon: React.ElementType; label: string; count?: number }) {
  return (
    <Link to={to} className="dq">
      <span className="dq-chip" aria-hidden="true">
        <Icon />
      </span>
      <span className="dq-text">
        {count !== undefined && <b>{count}</b>}
        <span>{label}</span>
      </span>
    </Link>
  );
}

/* ───────────── dark "jump back in" card ───────────── */

interface ActionItem {
  to: string;
  icon: React.ElementType;
  label: string;
  hint?: string;
}

export function ActionsCard({ title, subtitle, items }: { title: string; subtitle?: string; items: ActionItem[] }) {
  return (
    <section className="ddark">
      <header>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </header>
      <ul>
        {items.map(({ to, icon: Icon, label, hint }) => (
          <li key={to + label}>
            <Link to={to}>
              <span className="ddark-chip" aria-hidden="true">
                <Icon />
              </span>
              <span className="ddark-text">
                <b>{label}</b>
                {hint && <small>{hint}</small>}
              </span>
              <ArrowUpRight className="ddark-go" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ───────────── account card ───────────── */

interface AccountCardProps {
  initials: string;
  name: string;
  role: string;
  rows: Array<{ icon: React.ElementType; label: string; value: React.ReactNode }>;
  /** A bar under the list, for example how much of the profile is filled in (0 to 100). */
  progress?: { label: string; value: number };
  to?: string;
}

export function AccountCard({ initials, name, role, rows, progress, to }: AccountCardProps) {
  const pct = progress ? Math.min(100, Math.max(0, Math.round(progress.value))) : 0;
  return (
    <Panel title="Account" subtitle="Who you are on BulkSkart" to={to}>
      <div className="dacc">
        <span className="dacc-avatar" aria-hidden="true">
          {initials}
        </span>
        <div className="min-w-0">
          <b className="dacc-name">{name}</b>
          <span className="dacc-role">{role}</span>
        </div>
      </div>
      <ul className="dacc-rows">
        {rows.map(({ icon: Icon, label, value }) => (
          <li key={label}>
            <span className="dacc-ico" aria-hidden="true">
              <Icon />
            </span>
            <span>{label}</span>
            <b>{value}</b>
          </li>
        ))}
      </ul>
      {progress && (
        <div className="dacc-progress">
          <div>
            <span>{progress.label}</span>
            <b>{pct}%</b>
          </div>
          <div className="dacc-bar" role="progressbar" aria-label={progress.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
            <i style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}
    </Panel>
  );
}

/* ───────────── pill bar chart ───────────── */

interface BarsChartProps {
  /** One label per bar, for example "Jan". */
  months: string[];
  bars: number[];
  /** What a bar counts, for example "requirements"; used in the spoken label of each bar. */
  barLabel: string;
  /** Said instead of an empty chart when every value is zero. */
  emptyText: string;
  ariaLabel: string;
  /** Draw a dashed line at the average of the bars. */
  showAverage?: boolean;
}

/**
 * Rounded pill bars with a hatched fill. The tallest bar is red and carries its figure; pointing at, or tabbing to, another
 * bar moves the highlight to it. Built from HTML, not SVG, so the labels keep their size on a phone.
 */
export function BarsChart({ months, bars, barLabel, emptyText, ariaLabel, showAverage = true }: BarsChartProps) {
  const [pointed, setPointed] = useState<number | null>(null);
  const [grown, setGrown] = useState(() => !motionAllowed());
  useEffect(() => {
    if (grown) return undefined;
    const frame = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(frame);
  }, [grown]);

  const geometry = useMemo(() => {
    const highest = Math.max(0, ...bars);
    const max = niceCeil(highest);
    const peak = highest > 0 ? bars.indexOf(highest) : 0;
    const average = bars.length > 0 ? bars.reduce((total, value) => total + value, 0) / bars.length : 0;
    const ticks = [4, 3, 2, 1, 0].map((step) => (max * step) / 4);
    return { highest, max, peak, average, ticks };
  }, [bars]);

  if (geometry.highest === 0) {
    return <div className="dbars-empty">{emptyText}</div>;
  }

  const { max, peak, average, ticks } = geometry;
  const lit = pointed ?? peak;
  // the average's tag goes above the line, at the end where the bar stays under it, so it never covers a bar
  const avgSide = bars[bars.length - 1] <= average ? 'is-right' : bars[0] <= average ? 'is-left' : 'is-right';
  const round = (value: number) => compact(Math.round(value * 10) / 10);

  return (
    <div className="dbars" role="group" aria-label={ariaLabel}>
      <div className="dbars-y" aria-hidden="true">
        {ticks.map((tick) => (
          <span key={tick}>{round(tick)}</span>
        ))}
      </div>
      <div className="dbars-area">
        <div className="dbars-grid" aria-hidden="true">
          {ticks.map((tick) => (
            <i key={tick} />
          ))}
        </div>
        {showAverage && average > 0 && (
          <div className={`dbars-avg ${avgSide}`} style={{ bottom: `${(average / max) * 100}%` }} aria-hidden="true">
            <span>Avg {round(average)}</span>
          </div>
        )}
        <div className="dbars-cols" style={{ gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))` }}>
          {bars.map((value, index) => (
            <button
              key={months[index] + index}
              type="button"
              className={`dbar${lit === index ? ' is-lit' : ''}${value === 0 ? ' is-zero' : ''}`}
              aria-label={`${months[index]}: ${value} ${barLabel}`}
              onMouseEnter={() => setPointed(index)}
              onMouseLeave={() => setPointed((current) => (current === index ? null : current))}
              onFocus={() => setPointed(index)}
              onBlur={() => setPointed((current) => (current === index ? null : current))}
            >
              {lit === index && <em className="dbar-tag">{round(value)}</em>}
              <span className="dbar-pill" style={{ height: grown ? `${Math.max((value / max) * 100, value > 0 ? 7 : 3)}%` : '3%', transitionDelay: `${index * 40}ms` }} />
            </button>
          ))}
        </div>
      </div>
      <div className="dbars-x" aria-hidden="true">
        {months.map((label, index) => (
          <span key={label + index} className={lit === index ? 'is-lit' : undefined}>
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ───────────── fan gauge and ring ───────────── */

interface GaugeProps {
  /** 0 to 100, or null when there is nothing to measure yet. */
  value: number | null;
  label: string;
  /** Said under the dash when value is null. */
  emptyText?: string;
  /** "fan" is a half circle of segments, "ring" a full circle of ticks. */
  variant?: 'fan' | 'ring';
  /** A line of small print in a pill under the gauge. */
  footer?: React.ReactNode;
}

const FAN = { w: 240, h: 128, cx: 120, cy: 122, outer: 112, inner: 72, segments: 36, gap: 1.6 };
const RING = { size: 180, c: 90, inner: 60, outer: 80, ticks: 60 };

const polar = (cx: number, cy: number, radius: number, degrees: number): [number, number] => {
  const radians = (degrees * Math.PI) / 180;
  return [cx + radius * Math.cos(radians), cy + radius * Math.sin(radians)];
};

/** One segment of the fan: the ring slice between two angles. */
function fanSegment(index: number): string {
  const slice = 180 / FAN.segments;
  const start = 180 + index * slice + FAN.gap / 2;
  const end = 180 + (index + 1) * slice - FAN.gap / 2;
  const [x1, y1] = polar(FAN.cx, FAN.cy, FAN.outer, start);
  const [x2, y2] = polar(FAN.cx, FAN.cy, FAN.outer, end);
  const [x3, y3] = polar(FAN.cx, FAN.cy, FAN.inner, end);
  const [x4, y4] = polar(FAN.cx, FAN.cy, FAN.inner, start);
  return `M${x1.toFixed(2)},${y1.toFixed(2)} A${FAN.outer},${FAN.outer} 0 0 1 ${x2.toFixed(2)},${y2.toFixed(2)} L${x3.toFixed(2)},${y3.toFixed(2)} A${FAN.inner},${FAN.inner} 0 0 0 ${x4.toFixed(2)},${y4.toFixed(2)} Z`;
}

function segmentColor(index: number, total: number): string {
  // the brand orange: lighter at the start of the arc, deeper at the end
  const t = total <= 1 ? 0 : index / (total - 1);
  const from = [255, 150, 70];
  const to = [224, 79, 0];
  const c = from.map((f, k) => Math.round(f + (to[k] - f) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

export function Gauge({ value, label, emptyText, variant = 'fan', footer }: GaugeProps) {
  const clamped = value === null ? 0 : Math.min(100, Math.max(0, value));
  const total = variant === 'fan' ? FAN.segments : RING.ticks;
  const filled = value === null ? 0 : Math.max(clamped > 0 ? 1 : 0, Math.round((clamped / 100) * total));
  const shown = value === null ? '—' : `${Math.round(value * 10) / 10}%`;
  return (
    <div className={`dgauge is-${variant}`}>
      <div className="dgauge-art" role="img" aria-label={value === null ? `${label}: no data yet` : `${label}: ${shown}`}>
        {variant === 'fan' ? (
          <svg viewBox={`0 0 ${FAN.w} ${FAN.h}`} aria-hidden="true">
            {Array.from({ length: FAN.segments }, (_, i) => (
              <path key={i} className={i < filled ? 'dseg-on' : 'dseg-off'} d={fanSegment(i)} fill={i < filled ? segmentColor(i, FAN.segments) : undefined} style={{ animationDelay: `${i * 14}ms` }} />
            ))}
          </svg>
        ) : (
          <svg viewBox={`0 0 ${RING.size} ${RING.size}`} aria-hidden="true">
            {Array.from({ length: RING.ticks }, (_, i) => {
              const angle = -90 + (360 / RING.ticks) * i;
              const [x1, y1] = polar(RING.c, RING.c, RING.inner, angle);
              const [x2, y2] = polar(RING.c, RING.c, RING.outer, angle);
              return <line key={i} className={i < filled ? 'dseg-on' : 'dseg-off'} x1={x1.toFixed(2)} y1={y1.toFixed(2)} x2={x2.toFixed(2)} y2={y2.toFixed(2)} stroke={i < filled ? segmentColor(i, RING.ticks) : undefined} strokeWidth="4.4" strokeLinecap="round" style={{ animationDelay: `${i * 10}ms` }} />;
            })}
          </svg>
        )}
        <div className="dgauge-center">
          <b>{shown}</b>
          <span>{value === null && emptyText ? emptyText : label}</span>
        </div>
      </div>
      {footer && <div className="dgauge-foot">{footer}</div>}
    </div>
  );
}
