import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import PageMeta from '@/components/common/PageMeta';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/db/supabase';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { Zap, Target, TrendingUp, Users, AlertCircle, Activity } from 'lucide-react';

interface MatchRow {
  match_score: number;
  response_status: string;
  rfq_id: string;
  requirements?: { title: string; profiles?: { full_name: string } };
}

interface BucketData { label: string; total: number; responded: number; rate: number; fill: string; }

function StatCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
            <Icon className="w-4 h-4 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AIMatchAnalyticsPage() {
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMatches = async () => {
      try {
        const { data } = await supabase
          .from('rfq_matches')
          .select('match_score,response_status,rfq_id,requirements!rfq_id(title,profiles!buyer_id(full_name))')
          .order('match_score', { ascending: false })
          .limit(500);
        setMatches((data ?? []) as unknown as MatchRow[]);
      } catch (err) {
        console.warn('Error fetching match analytics:', err);
        setMatches([]);
      } finally {
        setLoading(false);
      }
    };
    fetchMatches();
  }, []);

  // Derived metrics
  const totalMatches = matches.length;
  const totalRfqs = new Set(matches.map(m => m.rfq_id)).size;
  const avgScore = totalMatches > 0
    ? Math.round(matches.reduce((s, m) => s + m.match_score, 0) / totalMatches)
    : 0;
  const avgPerRfq = totalRfqs > 0 ? Math.round(totalMatches / totalRfqs) : 0;
  const responded = matches.filter(m => m.response_status === 'quoted').length;
  const overallResponseRate = totalMatches > 0 ? Math.round((responded / totalMatches) * 100) : 0;

  // Score buckets
  const buckets: BucketData[] = [
    { label: '91–100', total: 0, responded: 0, rate: 0, fill: '#22c55e' },
    { label: '71–90', total: 0, responded: 0, rate: 0, fill: '#eab308' },
    { label: '51–70', total: 0, responded: 0, rate: 0, fill: '#f97316' },
    { label: '0–50', total: 0, responded: 0, rate: 0, fill: '#ef4444' },
  ];
  for (const m of matches) {
    let b: BucketData;
    if (m.match_score >= 91) b = buckets[0];
    else if (m.match_score >= 71) b = buckets[1];
    else if (m.match_score >= 51) b = buckets[2];
    else b = buckets[3];
    b.total++;
    if (m.response_status === 'quoted') b.responded++;
  }
  for (const b of buckets) {
    b.rate = b.total > 0 ? Math.round((b.responded / b.total) * 100) : 0;
  }

  // Top RFQs by match count
  const rfqCounts: Record<string, { title: string; count: number; avgScore: number; quoted: number }> = {};
  for (const m of matches) {
    if (!rfqCounts[m.rfq_id]) {
      rfqCounts[m.rfq_id] = { title: m.requirements?.title ?? 'RFQ', count: 0, avgScore: 0, quoted: 0 };
    }
    rfqCounts[m.rfq_id].count++;
    rfqCounts[m.rfq_id].avgScore += m.match_score;
    if (m.response_status === 'quoted') rfqCounts[m.rfq_id].quoted++;
  }
  const topRfqs = Object.entries(rfqCounts)
    .map(([id, d]) => ({ id, title: d.title, count: d.count, avgScore: Math.round(d.avgScore / d.count), quoted: d.quoted }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return (
    <DashboardLayout>
      <PageMeta
        title="AI Match Analytics — Admin | BulkSkart"
        description="AI-powered supplier matching performance analytics."
        robots="noindex, nofollow"
      />
      <div className="flex-1 min-w-0 p-4 md:p-6 overflow-y-auto">
        <div className="max-w-6xl w-full mx-auto space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              AI Match Analytics
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Performance metrics for the AI-powered supplier matching algorithm
            </p>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
            </div>
          ) : (
            <>
              {/* KPI cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="RFQs Processed" value={totalRfqs} icon={Target} color="bg-[#C94400]" />
                <StatCard label="Total Matches" value={totalMatches} sub={`~${avgPerRfq} per RFQ`} icon={Users} color="bg-[#C94400]" />
                <StatCard label="Avg Match Score" value={`${avgScore}/100`} icon={Activity} color="bg-[#C94400]" />
                <StatCard label="Overall Response Rate" value={`${overallResponseRate}%`} sub={`${responded} quoted`} icon={TrendingUp} color="bg-[#B33D00]" />
              </div>

              {/* Score distribution chart */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Match Score Distribution & Response Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  {totalMatches === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                      <AlertCircle className="w-8 h-8 opacity-40" />
                      <p className="text-sm">No match data available yet</p>
                      <p className="text-xs">Matches will appear here once buyers post RFQs</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Volume chart */}
                      <div>
                        <p className="text-xs text-muted-foreground mb-3">Matches by Score Range</p>
                        <ResponsiveContainer width="100%" height={180}>
                          <BarChart data={buckets} barSize={36}>
                            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} />
                            <Tooltip
                              contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                              formatter={(v: number) => [v, 'Matches']}
                            />
                            <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                              {buckets.map((b, i) => <Cell key={i} fill={b.fill} />)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Response rate by bucket */}
                      <div>
                        <p className="text-xs text-muted-foreground mb-3">Response Rate by Score Range</p>
                        <div className="space-y-3 mt-4">
                          {buckets.map(b => (
                            <div key={b.label}>
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span className="text-foreground font-medium">Score {b.label}</span>
                                <span className="text-muted-foreground">{b.responded}/{b.total} quoted ({b.rate}%)</span>
                              </div>
                              <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{ width: `${b.rate}%`, background: b.fill }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Algorithm notes */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Scoring Algorithm Weights</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {[
                      { label: 'Category Match', weight: 30, color: 'bg-[#C94400]' },
                      { label: 'Location Match', weight: 20, color: 'bg-[#C94400]' },
                      { label: 'MOQ Compatibility', weight: 20, color: 'bg-[#C94400]' },
                      { label: 'Capacity Match', weight: 15, color: 'bg-orange-500' },
                      { label: 'Supplier Rating', weight: 15, color: 'bg-[#C94400]' },
                    ].map(w => (
                      <div key={w.label} className="bg-muted/40 border border-border rounded-lg p-3 text-center">
                        <p className="text-xs text-muted-foreground">{w.label}</p>
                        <p className="text-xl font-bold text-foreground mt-1">{w.weight}<span className="text-xs text-muted-foreground">pts</span></p>
                        <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${w.color}`} style={{ width: `${w.weight}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    Suppliers with a total score below 50 are excluded from match notifications.
                    Top 20 suppliers per RFQ are notified. Requires active subscription.
                  </p>
                </CardContent>
              </Card>

              {/* Top RFQs table */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">RFQ Match History</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {topRfqs.length === 0 ? (
                    <div className="flex items-center justify-center py-10 text-muted-foreground text-sm">
                      No RFQ match history yet
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2 whitespace-nowrap">RFQ Title</th>
                            <th className="text-right text-xs font-medium text-muted-foreground px-4 py-2 whitespace-nowrap">Matches</th>
                            <th className="text-right text-xs font-medium text-muted-foreground px-4 py-2 whitespace-nowrap">Avg Score</th>
                            <th className="text-right text-xs font-medium text-muted-foreground px-4 py-2 whitespace-nowrap">Quotes</th>
                            <th className="text-right text-xs font-medium text-muted-foreground px-4 py-2 whitespace-nowrap">Response Rate</th>
                          </tr>
                        </thead>
                        <tbody>
                          {topRfqs.map(r => (
                            <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                              <td className="px-4 py-2.5 text-foreground max-w-[220px] truncate">{r.title}</td>
                              <td className="px-4 py-2.5 text-right text-foreground font-medium">{r.count}</td>
                              <td className="px-4 py-2.5 text-right">
                                <Badge variant="outline" className="text-xs">{r.avgScore}/100</Badge>
                              </td>
                              <td className="px-4 py-2.5 text-right text-foreground">{r.quoted}</td>
                              <td className="px-4 py-2.5 text-right">
                                <span className={r.count > 0 && Math.round((r.quoted / r.count) * 100) >= 50 ? 'text-[#FF7A2E]' : 'text-muted-foreground'}>
                                  {r.count > 0 ? `${Math.round((r.quoted / r.count) * 100)}%` : '—'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
