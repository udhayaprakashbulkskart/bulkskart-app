import React, { useEffect, useState } from 'react';
import { supabase } from '@/db/supabase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronDown, ChevronUp, MapPin, Star, Zap, Shield, SlidersHorizontal } from 'lucide-react';
import { Link } from 'react-router-dom';

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
  };
}

function scoreColor(score: number) {
  if (score >= 90) return 'bg-[#C94400]';
  if (score >= 70) return 'bg-[#C94400]';
  if (score >= 50) return 'bg-orange-500';
  return 'bg-[#C94400]';
}

function scoreBadgeVariant(score: number): string {
  if (score >= 90) return 'border-[#FF5A00]/40 text-[#FF7A2E] bg-[#FF5A00]/10 dark:bg-[#B33D00]/30';
  if (score >= 70) return 'border-[#FF5A00]/40 text-[#FF7A2E] bg-[#FF5A00]/10 dark:bg-[#B33D00]/30';
  return 'border-orange-500 text-orange-600 bg-[#FF5A00]/10 dark:bg-orange-950/30';
}

interface Props { rfqId: string; rfqTitle?: string; }

export default function RFQMatchResultsPanel({ rfqId, rfqTitle }: Props) {
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState('score');
  const [minScore, setMinScore] = useState('0');

  useEffect(() => {
    if (!rfqId) return;
    supabase
      .from('rfq_matches')
      .select(`
        id, company_id, match_score, score_category, score_location,
        score_moq, score_capacity, score_rating, notified_at, response_status,
        companies!company_id(id,company_name,slug,city,country,logo_url,is_verified,rating_avg,response_rate,avg_response_hours,profile_completion)
      `)
      .eq('rfq_id', rfqId)
      .order('match_score', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setMatches((data ?? []) as unknown as MatchRow[]);
        setLoading(false);
      });
  }, [rfqId]);

  const filtered = matches
    .filter(m => m.match_score >= parseInt(minScore))
    .sort((a, b) => {
      if (sortBy === 'score') return b.match_score - a.match_score;
      if (sortBy === 'rating') return (b.companies?.rating_avg ?? 0) - (a.companies?.rating_avg ?? 0);
      if (sortBy === 'response') return (b.companies?.response_rate ?? 0) - (a.companies?.response_rate ?? 0);
      return 0;
    });

  if (loading) return (
    <div className="space-y-3">
      {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header + filters */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            AI Matched Suppliers
            <Badge className="text-xs bg-primary/10 text-primary border-primary/20">{filtered.length}</Badge>
          </h3>
          {rfqTitle && <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-xs">{rfqTitle}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="h-8 text-xs w-32 bg-card border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="score">Match Score</SelectItem>
              <SelectItem value="rating">Rating</SelectItem>
              <SelectItem value="response">Response Rate</SelectItem>
            </SelectContent>
          </Select>
          <Select value={minScore} onValueChange={setMinScore}>
            <SelectTrigger className="h-8 text-xs w-28 bg-card border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="0">All Scores</SelectItem>
              <SelectItem value="70">Score ≥ 70</SelectItem>
              <SelectItem value="80">Score ≥ 80</SelectItem>
              <SelectItem value="90">Score ≥ 90</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-10 text-muted-foreground">
          <Zap className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">
            {matches.length === 0
              ? 'AI matching is running — check back in a moment.'
              : 'No matches found with selected filter.'}
          </p>
        </div>
      )}

      <div className="space-y-2">
        {filtered.map(m => {
          const c = m.companies;
          const isExpanded = expandedId === m.id;
          return (
            <div key={m.id} className="bg-card border border-border rounded-xl overflow-hidden">
              {/* Main row */}
              <div className="flex items-center gap-3 p-3 md:p-4">
                {/* Logo */}
                <div className="w-10 h-10 shrink-0 rounded-lg overflow-hidden bg-muted border border-border flex items-center justify-center">
                  {c?.logo_url
                    ? <img src={c.logo_url} alt={c.company_name} className="w-full h-full object-cover" />
                    : <span className="text-xs font-bold text-muted-foreground">{c?.company_name?.[0] ?? '?'}</span>
                  }
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-semibold text-foreground truncate">{c?.company_name}</span>
                    {c?.is_verified && (
                      <Shield className="w-3.5 h-3.5 text-[#FF7A2E] shrink-0" />
                    )}
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 font-semibold shrink-0 ${scoreBadgeVariant(m.match_score)}`}
                    >
                      {m.match_score}/100
                    </Badge>
                    {m.response_status === 'quoted' && (
                      <Badge className="text-[10px] bg-[#FF5A00]/10 text-[#FF7A2E] border-[#FF5A00]/40 shrink-0">Quoted</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                    {c?.city && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 shrink-0" />
                        {c.city}, {c.country}
                      </span>
                    )}
                    {c?.rating_avg > 0 && (
                      <span className="flex items-center gap-1">
                        <Star className="w-3 h-3 shrink-0 fill-[#FF5A00] text-[#FF7A2E]" />
                        {c.rating_avg.toFixed(1)}
                      </span>
                    )}
                    {c?.response_rate != null && (
                      <span>{c.response_rate}% response</span>
                    )}
                  </div>
                </div>

                {/* Score bar */}
                <div className="hidden md:flex flex-col items-end gap-1 w-24 shrink-0">
                  <span className="text-[10px] text-muted-foreground">Match</span>
                  <div className="w-full">
                    <Progress value={m.match_score} className="h-2" />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {c?.slug && (
                    <Link to={`/companies/${c.slug}`} target="_blank">
                      <Button size="sm" variant="outline" className="text-xs h-7 border-border">
                        Profile
                      </Button>
                    </Link>
                  )}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : m.id)}
                    className="p-1 rounded-md hover:bg-muted text-muted-foreground"
                  >
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Expanded breakdown */}
              {isExpanded && (
                <div className="border-t border-border bg-muted/20 px-4 py-3 space-y-3">
                  <p className="text-xs font-semibold text-foreground">Match Score Breakdown</p>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                    {[
                      { label: 'Category', score: m.score_category, max: 30 },
                      { label: 'Location', score: m.score_location, max: 20 },
                      { label: 'MOQ Fit', score: m.score_moq, max: 20 },
                      { label: 'Capacity', score: m.score_capacity, max: 15 },
                      { label: 'Rating', score: m.score_rating, max: 15 },
                    ].map(item => (
                      <div key={item.label} className="bg-card border border-border rounded-lg p-2 text-center">
                        <p className="text-[10px] text-muted-foreground mb-1">{item.label}</p>
                        <p className="text-sm font-bold text-foreground">{item.score}<span className="text-[10px] text-muted-foreground">/{item.max}</span></p>
                        <div className="mt-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${scoreColor(Math.round((item.score / item.max) * 100))}`}
                            style={{ width: `${Math.round((item.score / item.max) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <p className="text-xs text-muted-foreground">
                    You matched this supplier because:
                    {m.score_category >= 20 && ' Product category matches.'}
                    {m.score_location >= 15 && ' Location is nearby.'}
                    {m.score_moq >= 15 && ' MOQ is compatible with your order quantity.'}
                    {m.score_capacity >= 10 && ' Sufficient production capacity.'}
                    {m.score_rating >= 9 && ' High supplier rating.'}
                    {' '}Total score: {m.match_score}/100.
                  </p>

                  {c?.avg_response_hours != null && (
                    <p className="text-xs text-muted-foreground">
                      Avg. response time: <span className="text-foreground font-medium">{c.avg_response_hours}h</span>
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
