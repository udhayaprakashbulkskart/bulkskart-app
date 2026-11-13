import React, { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import { checkDirectMessageQuota } from '@/lib/api';
import SubscribeToContactDialog from '@/components/common/SubscribeToContactDialog';
import { Flame, Zap, Target, ArrowRight, RefreshCw, Package, MapPin, Calendar, BarChart2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

type MatchRow = {
  id: string;
  rfq_id: string;
  match_score: number;
  score_category: number;
  score_location: number;
  response_status: 'pending' | 'quoted' | 'dismissed' | 'expired';
  notified_at: string;
  created_at: string;
  requirements?: {
    id: string;
    title: string;
    quantity: number;
    quantity_unit: string;
    destination_city: string | null;
    destination_country: string | null;
    deadline: string | null;
    is_urgent: boolean;
    req_number: string | null;
    status: string;
    categories?: { name: string } | null;
  };
};

function UrgencyChip({ req }: { req: MatchRow['requirements'] }) {
  if (!req) return null;
  if (req.is_urgent) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FF5A00]/10 text-[#FF7A2E] border border-[#FF5A00]/40">
        <Flame className="w-2.5 h-2.5" /> URGENT
      </span>
    );
  }
  if (req.deadline) {
    const days = Math.ceil((new Date(req.deadline).getTime() - Date.now()) / 86_400_000);
    if (days <= 7) return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FF5A00]/10 text-[#FF7A2E] border border-[#FF5A00]/40">
        <Flame className="w-2.5 h-2.5" /> URGENT
      </span>
    );
    if (days <= 30) return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FF5A00]/10 text-[#FF7A2E] border border-[#FF5A00]/40">
        <Zap className="w-2.5 h-2.5" /> NEW
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
      <Target className="w-2.5 h-2.5" /> MATCHED
    </span>
  );
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Not Quoted',
  quoted: 'Quoted',
  dismissed: 'Dismissed',
  expired: 'Expired',
};
const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-[#FF5A00]/10 text-[#FF7A2E] border-[#FF5A00]/40',
  quoted: 'bg-[#FF5A00]/10 text-[#FF7A2E] border-[#FF5A00]/40',
  dismissed: 'bg-muted text-muted-foreground border-border',
  expired: 'bg-[#FF5A00]/10 text-[#FF7A2E] border-[#FF5A00]/40',
};

export default function MatchedRequirementsPanel() {
  const { company } = useAuth();
  const navigate = useNavigate();
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissing, setDismissing] = useState<string | null>(null);
  const [gateOpen, setGateOpen] = useState(false);
  const [gateReason, setGateReason] = useState<'not_logged_in' | 'not_registered_business' | 'no_subscription' | 'quota_exceeded'>('no_subscription');

  const fetchMatches = useCallback(async () => {
    if (!company?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from('rfq_matches')
      .select(`
        id, rfq_id, match_score, score_category, score_location,
        response_status, notified_at, created_at,
        requirements:rfq_id(
          id, title, quantity, quantity_unit,
          destination_city, destination_country,
          deadline, is_urgent, req_number, status,
          categories(name)
        )
      `)
      .eq('company_id', company.id)
      .neq('response_status', 'expired')
      .order('match_score', { ascending: false })
      .limit(50);

    // Filter: only show active requirements
    const live = ((data as unknown as MatchRow[]) ?? []).filter(
      m => m.requirements?.status === 'active'
    );
    setMatches(live);
    setLoading(false);
  }, [company?.id]);

  useEffect(() => { fetchMatches(); }, [fetchMatches]);

  const handleApplyFast = async (m: MatchRow) => {
    if (!company) { setGateReason('not_registered_business'); setGateOpen(true); return; }
    const quota = await checkDirectMessageQuota(company.id, company);
    if (quota !== 'ok') { setGateReason(quota); setGateOpen(true); return; }
    if (m.requirements?.id) navigate(`/requirements/${m.requirements.id}`);
  };

  const handleDismiss = async (matchId: string) => {
    setDismissing(matchId);
    await supabase.from('rfq_matches').update({ response_status: 'dismissed' }).eq('id', matchId);
    setMatches(prev => prev.filter(m => m.id !== matchId));
    setDismissing(null);
    toast.success('Requirement dismissed.');
  };

  const pendingCount = matches.filter(m => m.response_status === 'pending').length;

  return (
    <>
      <SubscribeToContactDialog
        open={gateOpen}
        onClose={() => setGateOpen(false)}
        reason={gateReason}
      />
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            <CardTitle className="text-base font-bold">Matched Buyer Requirements</CardTitle>
            {pendingCount > 0 && (
              <Badge className="bg-[#1A0C05] text-primary-foreground text-xs">{pendingCount} new</Badge>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={fetchMatches} className="gap-1 text-xs h-7">
            <RefreshCw className="w-3 h-3" /> Refresh
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Requirements matched to your business by our AI. Apply fast to win deals.
        </p>
      </CardHeader>

      <CardContent className="p-0">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : matches.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground px-6">
            <Target className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No matched requirements yet</p>
            <p className="text-xs mt-1">Complete your company profile and add products to improve matching.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {matches.map(m => {
              const req = m.requirements;
              if (!req) return null;
              const locStr = [req.destination_city, req.destination_country].filter(Boolean).join(', ');
              const deadlineStr = req.deadline
                ? new Date(req.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                : null;

              return (
                <div key={m.id} className="px-4 py-3 hover:bg-muted/30 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Top row: urgency + status + req number */}
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <UrgencyChip req={req} />
                        <span className={`inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded border ${STATUS_COLOR[m.response_status]}`}>
                          {STATUS_LABEL[m.response_status]}
                        </span>
                        {req.req_number && (
                          <span className="text-[10px] text-muted-foreground font-mono">{req.req_number}</span>
                        )}
                      </div>

                      {/* Title */}
                      <p className="text-sm font-semibold text-foreground leading-snug">{req.title}</p>

                      {/* Category */}
                      {req.categories?.name && (
                        <p className="text-[11px] text-primary mt-0.5">{req.categories.name}</p>
                      )}

                      {/* Meta row */}
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Package className="w-3 h-3 shrink-0" />
                          {req.quantity.toLocaleString()} {req.quantity_unit}
                        </span>
                        {locStr && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="w-3 h-3 shrink-0" />
                            {locStr}
                          </span>
                        )}
                        {deadlineStr && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="w-3 h-3 shrink-0" />
                            By {deadlineStr}
                          </span>
                        )}
                        {/* Match score */}
                        <span className="flex items-center gap-1 text-xs font-semibold text-primary ml-auto">
                          <BarChart2 className="w-3 h-3 shrink-0" />
                          {m.match_score}% match
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* CTAs */}
                  {m.response_status === 'pending' && (
                    <div className="flex items-center gap-2 mt-2.5">
                      <Button
                        size="sm"
                        className="h-8 text-xs px-4 bg-[#C94400] hover:bg-primary/90 text-primary-foreground gap-1.5 font-bold"
                        onClick={() => handleApplyFast(m)}
                      >
                        Apply Fast <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs px-3 text-muted-foreground"
                        disabled={dismissing === m.id}
                        onClick={() => handleDismiss(m.id)}
                      >
                        {dismissing === m.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : 'Dismiss'}
                      </Button>
                    </div>
                  )}
                  {m.response_status === 'quoted' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 h-7 text-xs px-3 text-primary border-primary/30"
                      onClick={() => handleApplyFast(m)}
                    >
                      View Requirement
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
    </>
  );
}
