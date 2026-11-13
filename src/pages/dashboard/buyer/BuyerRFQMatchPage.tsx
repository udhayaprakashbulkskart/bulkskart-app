import React, { useEffect, useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import PageMeta from '@/components/common/PageMeta';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ArrowLeft, Zap, Shield, MapPin, Star, ChevronDown, ChevronUp,
  SlidersHorizontal, Search, Package, Clock, RefreshCw,
  CheckCircle, XCircle, MessageSquare, BarChart3, TrendingUp,
  Info, ExternalLink, Users,
} from 'lucide-react';
import { supabase } from '@/db/supabase';
import { getQuotationsForRequirement } from '@/lib/api';
import type { Quotation } from '@/types/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Requirement {
  id: string;
  title: string;
  description: string | null;
  quantity: number;
  quantity_unit: string;
  destination_country: string | null;
  destination_city: string | null;
  deadline: string | null;
  budget_min: number | null;
  budget_max: number | null;
  currency: string;
  status: string;
  quote_count: number;
  categories: { name: string } | null;
}

interface MatchRow {
  id: string;
  company_id: string;
  match_score: number;
  score_category: number;
  score_location: number;
  score_moq: number;
  score_capacity: number;
  score_rating: number;
  notified_at: string;
  response_status: string;
  companies: {
    id: string;
    company_name: string;
    slug: string;
    city: string | null;
    country: string;
    logo_url: string | null;
    is_verified: boolean;
    rating_avg: number;
    response_rate: number | null;
    avg_response_hours: number | null;
    profile_completion: number;
    years_in_business: number | null;
    employee_count: string | null;
  };
}

// ─── Score helpers ────────────────────────────────────────────────────────────

function scoreGrade(score: number): { label: string; color: string; bg: string; bar: string } {
  if (score >= 90) return { label: 'Excellent', color: 'text-[#FF7A2E]', bg: 'bg-[#FF5A00]/10 border-[#FF5A00]/40 dark:bg-[#B33D00]/30 dark:border-[#FF5A00]/40', bar: 'bg-[#C94400]' };
  if (score >= 75) return { label: 'Good',      color: 'text-[#FF5A00]',  bg: 'bg-orange-500/10 border-[#FF5A00]/30 dark:bg-orange-950/30 dark:border-[#FF5A00]/30', bar: 'bg-[#C94400]' };
  if (score >= 60) return { label: 'Moderate',  color: 'text-[#FF7A2E]',bg: 'bg-[#FF5A00]/10 border-[#FF5A00]/40 dark:bg-[#B33D00]/30 dark:border-[#FF5A00]/40', bar: 'bg-[#C94400]' };
  return                   { label: 'Low',       color: 'text-[#FF7A2E]',   bg: 'bg-[#FF5A00]/10 border-[#FF5A00]/40 dark:bg-[#B33D00]/30 dark:border-[#FF5A00]/40', bar: 'bg-[#C94400]' };
}

function pctColor(pct: number) {
  if (pct >= 90) return 'bg-[#C94400]';
  if (pct >= 70) return 'bg-[#C94400]';
  if (pct >= 50) return 'bg-[#C94400]';
  return 'bg-[#C94400]';
}

const SUB_SCORES = [
  { key: 'score_category', label: 'Category Match', max: 30, tip: 'Relevance of supplier product catalog to requirement' },
  { key: 'score_location', label: 'Location Match', max: 20, tip: 'Geographical proximity to buyer delivery destination' },
  { key: 'score_moq',      label: 'MOQ Fit',        max: 20, tip: 'Minimum order quantity compatibility with purchase volume' },
  { key: 'score_capacity', label: 'Capacity Fit',   max: 15, tip: 'Factory production capacity to fulfill batch size' },
  { key: 'score_rating',   label: 'Supplier Trust', max: 15, tip: 'Platform verified rating, response rate, and history' },
] as const;

// ─── Sub-components ───────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const grade = scoreGrade(score);
  const r = 28, circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  return (
    <div className="relative w-20 h-20 shrink-0">
      <svg width="80" height="80" className="-rotate-90">
        <circle cx="40" cy="40" r={r} strokeWidth="7" className="stroke-muted fill-none" />
        <circle
          cx="40" cy="40" r={r} strokeWidth="7" fill="none"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          className={`transition-all duration-700 ${
            score >= 90 ? 'stroke-[#FF5A00]' : score >= 75 ? 'stroke-[#FF5A00]' : score >= 60 ? 'stroke-[#FF5A00]' : 'stroke-[#FF5A00]'
          }`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-black text-foreground leading-none">{score}</span>
        <span className="text-[9px] text-muted-foreground leading-none mt-0.5">/100</span>
      </div>
    </div>
  );
}

function SubScoreBar({ label, score, max, tip }: { label: string; score: number; max: number; tip: string }) {
  const pct = Math.round((score / max) * 100);
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex flex-col gap-1 cursor-default">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground flex items-center gap-1">
                {label} <Info className="w-2.5 h-2.5 opacity-50" />
              </span>
              <span className="font-semibold text-foreground tabular-nums">{score}<span className="text-[9px] text-muted-foreground">/{max}</span></span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${pctColor(pct)}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs max-w-[180px] text-center">{tip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BuyerRFQMatchPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [requirement, setRequirement] = useState<Requirement | null>(null);
  const [matches, setMatches]         = useState<MatchRow[]>([]);
  const [quotations, setQuotations]   = useState<Quotation[]>([]);
  const [loadingReq, setLoadingReq]   = useState(true);
  const [loadingMatch, setLoadingMatch] = useState(true);
  const [loadingQuotes, setLoadingQuotes] = useState(true);
  const [expandedId, setExpandedId]   = useState<string | null>(null);

  // Filters
  const [search, setSearch]     = useState('');
  const [sortBy, setSortBy]     = useState('score');
  const [minScore, setMinScore] = useState('0');

  // ── Fetch requirement ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    supabase
      .from('requirements')
      .select('id,title,description,quantity,quantity_unit,destination_country,destination_city,deadline,budget_min,budget_max,currency,status,quote_count,categories(name)')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        setRequirement(data as Requirement | null);
        setLoadingReq(false);
      });
  }, [id]);

  // ── Fetch AI matches ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    supabase
      .from('rfq_matches')
      .select(`
        id, company_id, match_score, score_category, score_location,
        score_moq, score_capacity, score_rating, notified_at, response_status,
        companies!company_id(
          id,company_name,slug,city,country,logo_url,is_verified,
          rating_avg,response_rate,avg_response_hours,profile_completion,
          years_in_business,employee_count
        )
      `)
      .eq('rfq_id', id)
      .order('match_score', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setMatches((data ?? []) as unknown as MatchRow[]);
        setLoadingMatch(false);
      });
  }, [id]);

  // ── Fetch quotations ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    getQuotationsForRequirement(id).then(q => {
      setQuotations(q as Quotation[]);
      setLoadingQuotes(false);
    });
  }, [id]);

  // ── Rerun matching ─────────────────────────────────────────────────────────
  const handleRerun = async () => {
    if (!id) return;
    setLoadingMatch(true);
    await supabase.functions.invoke('run-rfq-matching', { body: { rfq_id: id } });
    setTimeout(() => {
      supabase
        .from('rfq_matches')
        .select(`
          id, company_id, match_score, score_category, score_location,
          score_moq, score_capacity, score_rating, notified_at, response_status,
          companies!company_id(
            id,company_name,slug,city,country,logo_url,is_verified,
            rating_avg,response_rate,avg_response_hours,profile_completion,
            years_in_business,employee_count
          )
        `)
        .eq('rfq_id', id)
        .order('match_score', { ascending: false })
        .limit(50)
        .then(({ data }) => {
          setMatches((data ?? []) as unknown as MatchRow[]);
          setLoadingMatch(false);
        });
    }, 3000);
  };

  // ── Filtered + sorted matches ──────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = matches.filter(m => {
      const scoreOk = m.match_score >= parseInt(minScore);
      const searchOk = !search || m.companies?.company_name?.toLowerCase().includes(search.toLowerCase());
      return scoreOk && searchOk;
    });
    if (sortBy === 'score')    list = [...list].sort((a, b) => b.match_score - a.match_score);
    if (sortBy === 'rating')   list = [...list].sort((a, b) => (b.companies?.rating_avg ?? 0) - (a.companies?.rating_avg ?? 0));
    if (sortBy === 'response') list = [...list].sort((a, b) => (b.companies?.response_rate ?? 0) - (a.companies?.response_rate ?? 0));
    if (sortBy === 'quoted')   list = [...list].sort((a, b) => (b.response_status === 'quoted' ? 1 : 0) - (a.response_status === 'quoted' ? 1 : 0));
    return list;
  }, [matches, minScore, search, sortBy]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!matches.length) return null;
    const avg = Math.round(matches.reduce((s, m) => s + m.match_score, 0) / matches.length);
    const top = matches[0]?.match_score ?? 0;
    const quoted = matches.filter(m => m.response_status === 'quoted').length;
    return { avg, top, total: matches.length, quoted };
  }, [matches]);

  // ─── Layout ────────────────────────────────────────────────────────────────
  return (
    <DashboardLayout>
      <PageMeta
        title={`Supplier Matches — ${requirement?.title ?? 'RFQ'} | BulkSkart`}
        description="View matched verified manufacturers and matching score breakdown"
        robots="noindex, nofollow"
      />

      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-6xl w-full mx-auto px-4 md:px-6 py-6 space-y-6">

          {/* ── Back + header ─────────────────────────────────────────────── */}
          <div className="flex items-start gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground gap-1.5 shrink-0 -ml-1"
              onClick={() => navigate('/dashboard/buyer/requirements')}
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to RFQs
            </Button>
          </div>

          {/* Requirement summary card */}
          {loadingReq ? (
            <Skeleton className="h-28 w-full rounded-xl" />
          ) : requirement ? (
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex flex-col md:flex-row md:items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <h1 className="text-lg font-bold text-foreground">{requirement.title}</h1>
                    <Badge variant="outline" className={`text-xs capitalize shrink-0 ${
                      requirement.status === 'active' ? 'text-[#FF7A2E] border-[#FF5A00]/30 bg-[#FF5A00]/10'
                        : 'text-muted-foreground border-border'
                    }`}>
                      {requirement.status}
                    </Badge>
                    {requirement.categories && (
                      <Badge variant="outline" className="text-xs border-border text-muted-foreground shrink-0">
                        {requirement.categories.name}
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                    {[
                      { label: 'Quantity', value: `${requirement.quantity.toLocaleString()} ${requirement.quantity_unit}` },
                      { label: 'Destination', value: requirement.destination_country ?? '—' },
                      {
                        label: 'Deadline',
                        value: requirement.deadline
                          ? new Date(requirement.deadline).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                          : '—',
                      },
                      {
                        label: 'Budget',
                        value: (requirement.budget_min || requirement.budget_max)
                          ? `${requirement.currency} ${(requirement.budget_min ?? 0).toLocaleString()}–${(requirement.budget_max ?? 0).toLocaleString()}`
                          : 'Not specified',
                      },
                    ].map(d => (
                      <div key={d.label} className="bg-muted/40 rounded-lg px-3 py-2">
                        <p className="text-[10px] text-muted-foreground mb-0.5">{d.label}</p>
                        <p className="text-xs font-semibold text-foreground">{d.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs gap-1.5"
                    onClick={handleRerun}
                    disabled={loadingMatch}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingMatch ? 'animate-spin' : ''}`} />
                    Re-run Matching
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl p-8 text-center">
              <p className="text-sm text-muted-foreground">Requirement not found</p>
              <Link to="/dashboard/buyer/requirements">
                <Button size="sm" className="mt-3 bg-[#1A0C05] text-primary-foreground">Back to Requirements</Button>
              </Link>
            </div>
          )}

          {/* ── Stats strip ───────────────────────────────────────────────── */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Matched Suppliers', value: stats.total, icon: Users, color: 'text-primary', bg: 'bg-primary/10' },
                { label: 'Top Match Score', value: stats.top, icon: TrendingUp, color: 'text-[#FF7A2E]', bg: 'bg-[#FF5A00]/10', suffix: '/100' },
                { label: 'Average Score', value: stats.avg, icon: BarChart3, color: 'text-[#FF5A00]', bg: 'bg-orange-500/10', suffix: '/100' },
                { label: 'Quoted Suppliers', value: stats.quoted, icon: CheckCircle, color: 'text-[#FF7A2E]', bg: 'bg-[#FF5A00]/10' },
              ].map(s => {
                const Icon = s.icon;
                return (
                  <div key={s.label} className="bg-card border border-border rounded-xl p-4">
                    <div className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center mb-2`}>
                      <Icon className={`w-4 h-4 ${s.color}`} />
                    </div>
                    <p className="text-xl font-black text-foreground leading-none">
                      {s.value}{s.suffix && <span className="text-sm font-normal text-muted-foreground">{s.suffix}</span>}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{s.label}</p>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Tabs: Match List | Quote Comparison ───────────────────────── */}
          <Tabs defaultValue="matches" className="w-full">
            <TabsList className="h-9 mb-4">
              <TabsTrigger value="matches" className="text-xs gap-1.5">
                <Zap className="w-3.5 h-3.5" /> Matched Suppliers
                {!loadingMatch && <span className="ml-1 bg-[#C94400] text-primary-foreground rounded-full px-1.5 py-px text-[10px] font-semibold">{filtered.length}</span>}
              </TabsTrigger>
              <TabsTrigger value="quotes" className="text-xs gap-1.5">
                <Package className="w-3.5 h-3.5" /> Quotation Comparison
                {!loadingQuotes && quotations.length > 0 && (
                  <span className="ml-1 bg-[#C94400] text-primary-foreground rounded-full px-1.5 py-px text-[10px] font-semibold">{quotations.length}</span>
                )}
              </TabsTrigger>
            </TabsList>

            {/* ──────────────── MATCHES TAB ──────────────────────────────── */}
            <TabsContent value="matches" className="space-y-4">

              {/* Filters */}
              <div className="flex flex-col md:flex-row gap-2 items-start md:items-center">
                <div className="relative flex-1 min-w-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search suppliers..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-9 h-8 text-xs bg-card border-border"
                  />
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="h-8 text-xs w-36 bg-card border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="score">Match Score</SelectItem>
                      <SelectItem value="rating">Supplier Rating</SelectItem>
                      <SelectItem value="response">Response Rate</SelectItem>
                      <SelectItem value="quoted">Quoted First</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={minScore} onValueChange={setMinScore}>
                    <SelectTrigger className="h-8 text-xs w-32 bg-card border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">All Scores</SelectItem>
                      <SelectItem value="60">≥ 60 Pts</SelectItem>
                      <SelectItem value="75">≥ 75 Pts</SelectItem>
                      <SelectItem value="90">≥ 90 Pts</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Match list */}
              {loadingMatch ? (
                <div className="space-y-3">
                  {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
                </div>
              ) : filtered.length === 0 ? (
                <div className="bg-card border border-border rounded-xl py-14 text-center">
                  <Zap className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
                  <p className="text-sm font-medium text-foreground">
                    {matches.length === 0 ? 'Supplier matching is in progress, please refresh shortly' : 'No suppliers match your current filter criteria'}
                  </p>
                  {matches.length === 0 && (
                    <Button size="sm" variant="outline" className="mt-3 text-xs gap-1.5" onClick={handleRerun}>
                      <RefreshCw className="w-3.5 h-3.5" /> Run Match Now
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {filtered.map((m, idx) => {
                    const c = m.companies;
                    const grade = scoreGrade(m.match_score);
                    const isExpanded = expandedId === m.id;
                    return (
                      <div key={m.id} className={`bg-card border rounded-xl overflow-hidden transition-colors ${
                        isExpanded ? 'border-primary/40' : 'border-border hover:border-primary/20'
                      }`}>
                        {/* Main row */}
                        <div className="flex items-center gap-3 p-3 md:p-4">
                          {/* Rank */}
                          <div className="w-6 shrink-0 text-center">
                            <span className="text-xs font-bold text-muted-foreground">#{idx + 1}</span>
                          </div>

                          {/* Logo */}
                          <div className="w-10 h-10 shrink-0 rounded-lg overflow-hidden bg-muted border border-border flex items-center justify-center">
                            {c?.logo_url
                              ? <img
                                  src={c.logo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.company_name)}&background=1e293b&color=ff5a00&bold=true`}
                                  alt={c.company_name}
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(c.company_name)}&background=1e293b&color=ff5a00&bold=true`;
                                  }}
                                  className="w-full h-full object-cover"
                                />
                              : <span className="text-xs font-bold text-muted-foreground">{c?.company_name?.[0] ?? '?'}</span>
                            }
                          </div>

                          {/* Company info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-sm font-semibold text-foreground truncate">{c?.company_name}</span>
                              {c?.is_verified && <Shield className="w-3.5 h-3.5 text-[#FF7A2E] shrink-0" />}
                              {m.response_status === 'quoted' && (
                                <Badge className="text-[10px] px-1.5 py-0 bg-[#FF5A00]/10 text-[#FF7A2E] border-[#FF5A00]/40 shrink-0">Quoted</Badge>
                              )}
                              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 font-semibold shrink-0 border ${grade.bg} ${grade.color}`}>
                                {grade.label}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2.5 text-xs text-muted-foreground mt-0.5 flex-wrap">
                              {c?.city && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3 shrink-0" />{c.city}, {c.country}
                                </span>
                              )}
                              {(c?.rating_avg ?? 0) > 0 && (
                                <span className="flex items-center gap-1">
                                  <Star className="w-3 h-3 fill-[#FF5A00] text-[#FF7A2E] shrink-0" />
                                  {c?.rating_avg.toFixed(1)}
                                </span>
                              )}
                              {c?.response_rate != null && <span>{c.response_rate}% Response Rate</span>}
                              {c?.years_in_business && <span>{c.years_in_business} Yrs Experience</span>}
                            </div>
                          </div>

                          {/* Score ring — desktop */}
                          <div className="hidden md:flex flex-col items-center gap-1 shrink-0">
                            <ScoreRing score={m.match_score} />
                          </div>

                          {/* Mobile score badge */}
                          <div className="flex md:hidden shrink-0">
                            <Badge variant="outline" className={`text-sm font-black border ${grade.bg} ${grade.color}`}>
                              {m.match_score}
                            </Badge>
                          </div>

                          {/* Total score bar — desktop */}
                          <div className="hidden lg:flex flex-col gap-1 w-28 shrink-0">
                            <span className="text-[10px] text-muted-foreground">Relevance</span>
                            <Progress value={m.match_score} className="h-2" />
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            {c?.slug && (
                              <Link to={`/companies/${c.slug}`} target="_blank">
                                <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1 border-border">
                                  <ExternalLink className="w-3 h-3" />
                                  <span className="hidden md:inline">Profile</span>
                                </Button>
                              </Link>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-muted-foreground hover:bg-muted p-1.5"
                              onClick={() => setExpandedId(isExpanded ? null : m.id)}
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </Button>
                          </div>
                        </div>

                        {/* ── Expanded breakdown ───────────────────────────── */}
                        {isExpanded && (
                          <div className="border-t border-border bg-muted/20 px-4 py-4 space-y-4">
                            {/* Sub-score breakdown */}
                            <div>
                              <p className="text-xs font-semibold text-foreground mb-3 flex items-center gap-1.5">
                                <BarChart3 className="w-3.5 h-3.5 text-primary" /> Match Score Breakdown
                              </p>
                              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-3">
                                {SUB_SCORES.map(s => {
                                  const score = m[s.key as keyof MatchRow] as number;
                                  const pct = Math.round((score / s.max) * 100);
                                  return (
                                    <div key={s.key} className="bg-card border border-border rounded-lg p-3">
                                      <div className="flex items-center justify-between mb-1.5">
                                        <p className="text-[10px] text-muted-foreground">{s.label}</p>
                                        <TooltipProvider delayDuration={200}>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Info className="w-3 h-3 text-muted-foreground/50 cursor-default" />
                                            </TooltipTrigger>
                                            <TooltipContent side="top" className="text-xs max-w-[160px] text-center">{s.tip}</TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                      </div>
                                      <p className="text-xl font-black text-foreground leading-none">
                                        {score}
                                        <span className="text-[10px] font-normal text-muted-foreground">/{s.max}</span>
                                      </p>
                                      <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                                        <div
                                          className={`h-full rounded-full transition-all duration-500 ${pctColor(pct)}`}
                                          style={{ width: `${pct}%` }}
                                        />
                                      </div>
                                      <p className="text-[9px] text-muted-foreground mt-1">{pct}% Weight Score</p>
                                    </div>
                                  );
                                })}
                              </div>

                              {/* Visual stacked bar */}
                              <div className="bg-card border border-border rounded-lg p-3">
                                <p className="text-[10px] text-muted-foreground mb-2">Relevance Score Visualization (Max 100)</p>
                                <div className="flex h-4 rounded-full overflow-hidden gap-px">
                                  {SUB_SCORES.map((s, i) => {
                                    const score = m[s.key as keyof MatchRow] as number;
                                    const widthPct = (score / 100) * 100;
                                    const colors = ['bg-[#C94400]', 'bg-[#C94400]', 'bg-[#C94400]', 'bg-[#C94400]', 'bg-[#C94400]'];
                                    return (
                                      <TooltipProvider key={s.key} delayDuration={100}>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <div
                                              className={`${colors[i]} transition-all duration-700 cursor-default`}
                                              style={{ width: `${widthPct}%` }}
                                            />
                                          </TooltipTrigger>
                                          <TooltipContent side="top" className="text-xs">{s.label}: {score}/{s.max}</TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    );
                                  })}
                                  {/* Remainder */}
                                  <div className="flex-1 bg-muted/60" />
                                </div>
                                <div className="flex justify-between mt-1.5 text-[9px] text-muted-foreground">
                                  <span>0</span>
                                  <span>Total Score: <strong className="text-foreground">{m.match_score}/100</strong></span>
                                  <span>100</span>
                                </div>
                              </div>
                            </div>

                            {/* Match reason */}
                            <div className="bg-primary/5 border border-primary/20 rounded-lg px-4 py-3 text-xs text-foreground space-y-1">
                              <p className="font-semibold text-primary flex items-center gap-1.5">
                                <Zap className="w-3.5 h-3.5" /> Match Rationale
                              </p>
                              <p className="text-muted-foreground leading-relaxed">
                                {m.score_category >= 20 && '· Product category strongly matches your requirement.'}
                                {m.score_category < 20 && '· Product category partially matches; confirm specifications with supplier.'}
                                {m.score_location >= 15 && ' · Proximity to destination reduces shipping time and freight costs.'}
                                {m.score_moq >= 15 && ' · Supplier MOQ is fully compatible with your order volume.'}
                                {m.score_moq < 15 && m.score_moq > 0 && ' · MOQ differs slightly; negotiable upon inquiry.'}
                                {m.score_capacity >= 10 && ' · Manufacturing capacity matches your required batch size.'}
                                {m.score_rating >= 9 && ' · Verified supplier with stellar track record on BulkSkart.'}
                                {` Overall relevance score: ${m.match_score}/100.`}
                              </p>
                            </div>

                            {/* Extra company info */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                              {c?.employee_count && (
                                <div className="bg-muted/40 rounded-lg px-3 py-2">
                                  <p className="text-muted-foreground text-[10px]">Team Size</p>
                                  <p className="font-semibold text-foreground">{c.employee_count}</p>
                                </div>
                              )}
                              {c?.years_in_business && (
                                <div className="bg-muted/40 rounded-lg px-3 py-2">
                                  <p className="text-muted-foreground text-[10px]">Years Active</p>
                                  <p className="font-semibold text-foreground">{c.years_in_business} Yrs</p>
                                </div>
                              )}
                              {c?.avg_response_hours != null && (
                                <div className="bg-muted/40 rounded-lg px-3 py-2">
                                  <p className="text-muted-foreground text-[10px]">Avg Response</p>
                                  <p className="font-semibold text-foreground">{c.avg_response_hours}h</p>
                                </div>
                              )}
                              {c?.profile_completion != null && (
                                <div className="bg-muted/40 rounded-lg px-3 py-2">
                                  <p className="text-muted-foreground text-[10px]">Profile Score</p>
                                  <p className="font-semibold text-foreground">{c.profile_completion}%</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* ──────────────── QUOTES COMPARISON TAB ───────────────────── */}
            <TabsContent value="quotes">
              {loadingQuotes ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
                </div>
              ) : quotations.length === 0 ? (
                <div className="bg-card border border-border rounded-xl py-14 text-center">
                  <Package className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
                  <p className="text-sm font-medium text-foreground">No Quotations Received Yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Matched suppliers will submit custom quotations once they review your RFQ.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs text-muted-foreground">{quotations.length} quotations received · Click table header to sort</p>

                  {/* Comparison table */}
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px]">
                      <thead>
                        <tr className="border-b border-border">
                          {['Supplier', 'Unit Price', 'MOQ', 'Currency', 'Lead Time', 'Payment Terms', 'Validity', 'Status', 'Actions'].map(h => (
                            <th key={h} className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide pb-2 whitespace-nowrap pr-4 first:pl-0">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {quotations.map(q => {
                          const matchForQ = matches.find(m => m.company_id === q.supplier_company_id);
                          return (
                            <tr key={q.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors group">
                              <td className="py-3 pr-4">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 shrink-0 rounded-md bg-muted border border-border flex items-center justify-center overflow-hidden">
                                    {q.companies?.logo_url
                                      ? <img src={q.companies.logo_url} className="w-full h-full object-cover" alt="" />
                                      : <span className="text-[9px] font-bold text-muted-foreground">{q.companies?.company_name?.[0]}</span>
                                    }
                                  </div>
                                  <div className="min-w-0">
                                    <Link
                                      to={`/companies/${q.companies?.slug}`}
                                      className="text-xs font-semibold text-foreground hover:text-primary truncate block"
                                    >
                                      {q.companies?.company_name ?? '—'}
                                    </Link>
                                    <div className="flex items-center gap-1 mt-0.5">
                                      {q.companies?.is_verified && <Shield className="w-3 h-3 text-[#FF7A2E]" />}
                                      {matchForQ && (
                                        <span className={`text-[9px] font-bold px-1 rounded ${scoreGrade(matchForQ.match_score).color}`}>
                                          {matchForQ.match_score}% Match
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 pr-4">
                                <span className="text-sm font-black text-foreground whitespace-nowrap">
                                  {q.unit_price.toLocaleString()}
                                </span>
                              </td>
                              <td className="py-3 pr-4 text-xs text-foreground whitespace-nowrap">
                                {q.moq.toLocaleString()} {q.moq_unit}
                              </td>
                              <td className="py-3 pr-4 text-xs text-muted-foreground">{q.currency}</td>
                              <td className="py-3 pr-4 text-xs text-foreground whitespace-nowrap">
                                {q.delivery_days ? (
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-muted-foreground" />{q.delivery_days} Days
                                  </span>
                                ) : '—'}
                              </td>
                              <td className="py-3 pr-4 text-xs text-muted-foreground max-w-[120px] truncate">
                                {q.payment_terms ?? '—'}
                              </td>
                              <td className="py-3 pr-4 text-xs text-muted-foreground whitespace-nowrap">
                                {q.validity_days} Days
                              </td>
                              <td className="py-3 pr-4">
                                <Badge variant="outline" className={`text-[10px] capitalize whitespace-nowrap ${
                                  q.status === 'accepted' ? 'text-[#FF7A2E] border-[#FF5A00]/30 bg-[#FF5A00]/10'
                                    : q.status === 'rejected' ? 'text-destructive border-destructive/30 bg-destructive/10'
                                    : 'text-muted-foreground border-border'
                                }`}>
                                  {q.status === 'pending' ? 'Pending' : q.status === 'accepted' ? 'Accepted' : 'Rejected'}
                                </Badge>
                              </td>
                              <td className="py-3">
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {q.status === 'pending' && (
                                    <>
                                      <Button size="sm" className="h-6 text-[10px] px-2 bg-[#B33D00] hover:bg-[#B33D00] text-white gap-1" onClick={async () => {
                                        const { updateQuotationStatus } = await import('@/lib/api');
                                        await updateQuotationStatus(q.id, 'accepted');
                                        const updated = await getQuotationsForRequirement(id!);
                                        setQuotations(updated as Quotation[]);
                                      }}>
                                        <CheckCircle className="w-2.5 h-2.5" /> Accept
                                      </Button>
                                      <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2 text-destructive border border-destructive/30 hover:bg-destructive/10" onClick={async () => {
                                        const { updateQuotationStatus } = await import('@/lib/api');
                                        await updateQuotationStatus(q.id, 'rejected');
                                        const updated = await getQuotationsForRequirement(id!);
                                        setQuotations(updated as Quotation[]);
                                      }}>
                                        <XCircle className="w-2.5 h-2.5" />
                                      </Button>
                                    </>
                                  )}
                                  <Link to="/dashboard/buyer/messages">
                                    <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2 border border-border text-muted-foreground hover:bg-muted">
                                      <MessageSquare className="w-2.5 h-2.5" />
                                    </Button>
                                  </Link>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Best price highlight */}
                  {quotations.length >= 2 && (() => {
                    const sorted = [...quotations].sort((a, b) => a.unit_price - b.unit_price);
                    const best = sorted[0];
                    const savings = sorted[sorted.length - 1].unit_price - best.unit_price;
                    return (
                      <div className="bg-[#FF5A00]/10 border border-[#FF5A00]/30 rounded-xl px-4 py-3 flex items-start gap-2.5 text-sm">
                        <TrendingUp className="w-4 h-4 text-[#FF7A2E] shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold text-[#FF7A2E]">Lowest Quote: </span>
                          <span className="text-foreground">
                            {best.companies?.company_name} · {best.currency} {best.unit_price.toLocaleString()}/unit
                          </span>
                          {savings > 0 && (
                            <span className="text-muted-foreground text-xs ml-2">
                              Save vs highest: {best.currency} {savings.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </DashboardLayout>
  );
}
