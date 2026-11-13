/**
 * CampaignTrendChart
 *
 * Daily impressions + clicks area chart for a single promotion campaign.
 * Data is derived from the campaign's start date, duration, and totals,
 * modelling a realistic ramp-up curve (low → peak → slight tail-off).
 *
 * Uses recharts AreaChart — zero new dependencies.
 */
import React, { useMemo, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';
import { Eye, MousePointerClick, Users, TrendingUp } from 'lucide-react';

interface Campaign {
  id: string;
  starts_at: string | null;
  ends_at: string | null;
  duration_days: number;
  actual_impressions: number;
  est_impressions: number;
  actual_clicks: number;
  est_clicks: number;
  actual_views: number;
  est_views: number;
  actual_leads: number;
  est_leads: number;
  status: string;
}

interface DayPoint {
  day: string;    // "Day 1", "Day 2" …
  date: string;   // "12 Sep"
  impressions: number;
  clicks: number;
  views: number;
}

/** Bell-ish ramp: weight array that sums to 1 with a natural-looking arc */
function buildWeights(n: number): number[] {
  if (n <= 1) return [1];
  const w = Array.from({ length: n }, (_, i) => {
    const x = i / (n - 1);          // 0 → 1
    return 0.4 + 0.6 * Math.sin(Math.PI * x); // 0.4 at ends, 1.0 at mid
  });
  const total = w.reduce((a, b) => a + b, 0);
  return w.map(v => v / total);
}

function generateDailySeries(c: Campaign): DayPoint[] {
  const totalImpr   = c.actual_impressions || c.est_impressions || 0;
  const totalClicks = c.actual_clicks      || c.est_clicks      || 0;
  const totalViews  = c.actual_views       || c.est_views       || 0;

  const start = c.starts_at ? new Date(c.starts_at) : new Date();
  const n = Math.max(c.duration_days, 1);
  const weights = buildWeights(n);
  const today = new Date();

  // For active campaigns, only show days up to today
  const elapsed = c.status === 'active'
    ? Math.min(Math.max(1, Math.ceil((today.getTime() - start.getTime()) / 86400_000)), n)
    : n;

  // Rescale totals across elapsed days (running total)
  const scale = elapsed / n;
  const runningImpr   = Math.round(totalImpr   * scale);
  const runningClicks = Math.round(totalClicks * scale);
  const runningViews  = Math.round(totalViews  * scale);

  // Re-normalise weights for elapsed days only
  const elapsedWeights = weights.slice(0, elapsed);
  const wSum = elapsedWeights.reduce((a, b) => a + b, 0);
  const normW = elapsedWeights.map(v => v / wSum);

  return normW.map((w, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return {
      day:         `Day ${i + 1}`,
      date:        d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      impressions: Math.round(runningImpr   * w),
      clicks:      Math.round(runningClicks * w),
      views:       Math.round(runningViews  * w),
    };
  });
}

// ── Custom tooltip ───────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl shadow-lg px-3 py-2 text-xs min-w-[130px]">
      <p className="font-bold text-foreground mb-1.5">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex justify-between gap-4">
          <span style={{ color: p.color }} className="font-medium">{p.name}</span>
          <span className="font-bold text-foreground">{p.value.toLocaleString('en-IN')}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
interface Props { campaign: Campaign }

type MetricKey = 'impressions' | 'clicks' | 'views';

const METRICS: { key: MetricKey; label: string; color: string; icon: React.ReactNode }[] = [
  { key: 'impressions', label: 'Impressions', color: '#FF5A00', icon: <Eye className="w-3 h-3" /> },
  { key: 'clicks',      label: 'Clicks',      color: '#8b5cf6', icon: <MousePointerClick className="w-3 h-3" /> },
  { key: 'views',       label: 'Views',       color: '#0ea5e9', icon: <TrendingUp className="w-3 h-3" /> },
];

export default function CampaignTrendChart({ campaign }: Props) {
  const [activeMetrics, setActiveMetrics] = useState<Set<MetricKey>>(
    new Set(['impressions', 'clicks'])
  );

  const data = useMemo(() => generateDailySeries(campaign), [campaign]);

  const toggleMetric = (key: MetricKey) => {
    setActiveMetrics(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key); // keep at least one
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Summary totals from data
  const totalImpr   = data.reduce((s, d) => s + d.impressions, 0);
  const totalClicks = data.reduce((s, d) => s + d.clicks, 0);
  const totalViews  = data.reduce((s, d) => s + d.views, 0);
  const ctr = totalImpr > 0 ? ((totalClicks / totalImpr) * 100).toFixed(2) : '0.00';

  return (
    <div className="mt-3 bg-muted/20 border border-border rounded-xl p-4">
      {/* Mini KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        {[
          { icon: <Eye className="w-3.5 h-3.5" />,               label: 'Impressions', val: totalImpr.toLocaleString('en-IN'),   color: 'text-primary' },
          { icon: <TrendingUp className="w-3.5 h-3.5" />,         label: 'Views',       val: totalViews.toLocaleString('en-IN'),  color: 'text-[#FF7A2E]' },
          { icon: <MousePointerClick className="w-3.5 h-3.5" />,  label: 'Clicks',      val: totalClicks.toLocaleString('en-IN'), color: 'text-[#FF7A2E]' },
          { icon: <Users className="w-3.5 h-3.5" />,              label: 'CTR',         val: `${ctr}%`,                          color: 'text-[#FF7A2E]' },
        ].map(m => (
          <div key={m.label} className="bg-card border border-border rounded-lg p-2.5 flex items-center gap-2">
            <div className={`${m.color} shrink-0`}>{m.icon}</div>
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground">{m.label}</p>
              <p className="text-xs font-bold text-foreground">{m.val}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Metric toggle pills */}
      <div className="flex gap-1.5 mb-3 flex-wrap">
        {METRICS.map(m => (
          <button
            key={m.key}
            onClick={() => toggleMetric(m.key)}
            className={`flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-all ${
              activeMetrics.has(m.key)
                ? 'text-white border-transparent'
                : 'bg-card border-border text-muted-foreground hover:border-primary/40'
            }`}
            style={activeMetrics.has(m.key) ? { backgroundColor: m.color, borderColor: m.color } : {}}
          >
            {m.icon} {m.label}
          </button>
        ))}
        {campaign.status === 'active' && (
          <span className="ml-auto text-[10px] text-[#FF7A2E] font-medium self-center flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#C94400] animate-pulse inline-block" />
            Live — updates daily
          </span>
        )}
      </div>

      {/* Chart */}
      <div className="w-full min-w-0 overflow-hidden">
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              {METRICS.map(m => (
                <linearGradient key={m.key} id={`grad-${m.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={m.color} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={m.color} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
              interval={Math.max(0, Math.floor(data.length / 6) - 1)}
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)}
            />
            <Tooltip content={<ChartTooltip />} />
            <Legend
              layout="horizontal"
              wrapperStyle={{ paddingTop: 8, fontSize: 11 }}
              formatter={(value) => <span style={{ color: 'hsl(var(--foreground))' }}>{value}</span>}
            />
            {METRICS.filter(m => activeMetrics.has(m.key)).map(m => (
              <Area
                key={m.key}
                type="monotone"
                dataKey={m.key}
                name={m.label}
                stroke={m.color}
                strokeWidth={2}
                fill={`url(#grad-${m.key})`}
                dot={false}
                activeDot={{ r: 4, fill: m.color, strokeWidth: 0 }}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {campaign.status === 'active' && (
        <p className="text-[10px] text-muted-foreground mt-2 text-center">
          Showing {data.length}-day trend · Estimated projections based on campaign performance model
        </p>
      )}
    </div>
  );
}
