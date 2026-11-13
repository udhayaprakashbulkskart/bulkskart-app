import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  RefreshCw, BarChart3, Clock, TrendingUp, CheckCircle2, FileText,
  Package, MessageSquare, Star, DollarSign, Percent, AlertCircle,
  Zap, Coins, ExternalLink, ArrowUpRight, ShieldCheck, ChevronRight
} from 'lucide-react';
import PageMeta from '@/components/common/PageMeta';

type Analytics = {
  totalRfqsReceived: number;
  rfqsAccepted: number;
  rfqsIgnored: number;
  quotesSent: number;
  quotesAccepted: number;
  quotesRejected: number;
  quotesRevised: number;
  ordersCompleted: number;
  activeOrders: number;
  responseRate: number;
  avgResponseHours: number;
  totalRevenue: number;
  commissionBalance: number;
  pendingCommission: number;
  totalCommissionEarned: number;
  leadCreditsBalance: number;
  leadCreditsConsumed: number;
  leadCreditsPurchased: number;
};

type RecentQuote = {
  id: string;
  unit_price: number;
  currency: string;
  status: string;
  created_at: string;
  requirements?: { title?: string } | { title?: string }[] | null;
};

function StatCard({
  label, value, icon: Icon, color, sub
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  sub?: string;
}) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between mb-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
        </div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </CardContent>
    </Card>
  );
}

export default function SupplierAnalyticsPage() {
  const { user, company } = useAuth();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [recentQuotes, setRecentQuotes] = useState<RecentQuote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !company) {
      // Provide clean default zero-state analytics so page never crashes
      setAnalytics({
        totalRfqsReceived: 0,
        rfqsAccepted: 0,
        rfqsIgnored: 0,
        quotesSent: 0,
        quotesAccepted: 0,
        quotesRejected: 0,
        quotesRevised: 0,
        ordersCompleted: 0,
        activeOrders: 0,
        responseRate: 0,
        avgResponseHours: 0,
        totalRevenue: 0,
        commissionBalance: 0,
        pendingCommission: 0,
        totalCommissionEarned: 0,
        leadCreditsBalance: 0,
        leadCreditsConsumed: 0,
        leadCreditsPurchased: 0,
      });
      setLoading(false);
      return;
    }

    Promise.all([
      // RFQs matched
      supabase.from('rfq_match_log').select('id', { count: 'exact', head: true }).eq('company_id', company.id),
      // Quotations by status
      supabase.from('quotations').select('id,status', { count: 'exact' }).eq('supplier_company_id', company.id).eq('is_draft', false),
      // Orders completed
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('supplier_company_id', company.id).eq('milestone', 'completed'),
      // Active orders
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('supplier_company_id', company.id).in('milestone', ['order_processing', 'production', 'ready_for_dispatch', 'dispatched']),
      // Company stats & lead_credits
      supabase.from('companies').select('response_rate,avg_response_hours,total_revenue,commission_balance,lead_credits').eq('id', company.id).maybeSingle(),
      // Recent quotes
      supabase.from('quotations').select('id,unit_price,currency,status,created_at,requirements(title)').eq('supplier_company_id', company.id).eq('is_draft', false).order('created_at', { ascending: false }).limit(8),
      // Commission from orders
      supabase.from('orders').select('commission_amount,commission_status').eq('supplier_company_id', company.id).not('commission_amount', 'is', null),
      // Lead credit transactions
      supabase.from('lead_credit_transactions').select('credits,type').eq('company_id', company.id),
    ])
      .then(([rfqRes, quotRes, compOrdRes, activeOrdRes, compRes, recentRes, commissionRes, creditTxRes]) => {
        const allQuotes = (quotRes.data ?? []) as { status: string }[];
        const comp = compRes.data as { response_rate?: number; avg_response_hours?: number; total_revenue?: number; commission_balance?: number; lead_credits?: number } | null;
        const commOrders = (commissionRes.data ?? []) as { commission_amount: number; commission_status: string }[];
        const creditTxs = (creditTxRes.data ?? []) as { credits: number; type: string }[];

        const totalCommEarned = commOrders.reduce((s, o) => s + (Number(o.commission_amount) || 0), 0);
        const pendingComm = commOrders.filter(o => o.commission_status === 'pending').reduce((s, o) => s + (Number(o.commission_amount) || 0), 0);
        const totalRfq = Number(rfqRes.count) || 0;
        const quotesSent = allQuotes.length;
        const accepted = allQuotes.filter(q => q.status === 'accepted').length;
        const rejected = allQuotes.filter(q => q.status === 'rejected').length;
        const revised = allQuotes.filter(q => q.status === 'revised').length;

        const consumedCredits = creditTxs.filter(t => t.type === 'consume').reduce((s, t) => s + (Number(t.credits) || 0), 0);
        const purchasedCredits = creditTxs.filter(t => t.type === 'purchase').reduce((s, t) => s + (Number(t.credits) || 0), 0);

        setAnalytics({
          totalRfqsReceived: totalRfq,
          rfqsAccepted: quotesSent,
          rfqsIgnored: Math.max(0, totalRfq - quotesSent),
          quotesSent,
          quotesAccepted: accepted,
          quotesRejected: rejected,
          quotesRevised: revised,
          ordersCompleted: Number(compOrdRes.count) || 0,
          activeOrders: Number(activeOrdRes.count) || 0,
          responseRate: Number(comp?.response_rate ?? (totalRfq > 0 ? Math.round((quotesSent / totalRfq) * 100) : 0)),
          avgResponseHours: Number(comp?.avg_response_hours ?? 0),
          totalRevenue: Number(comp?.total_revenue ?? 0),
          commissionBalance: Number(comp?.commission_balance ?? 0),
          pendingCommission: pendingComm,
          totalCommissionEarned: totalCommEarned,
          leadCreditsBalance: Number(comp?.lead_credits ?? 0),
          leadCreditsConsumed: consumedCredits,
          leadCreditsPurchased: purchasedCredits,
        });
        setRecentQuotes((recentRes.data ?? []) as unknown as RecentQuote[]);
        setLoading(false);
      })
      .catch((err) => {
        console.warn('Error fetching analytics:', err);
        // Fallback default safe state
        setAnalytics({
          totalRfqsReceived: 0,
          rfqsAccepted: 0,
          rfqsIgnored: 0,
          quotesSent: 0,
          quotesAccepted: 0,
          quotesRejected: 0,
          quotesRevised: 0,
          ordersCompleted: 0,
          activeOrders: 0,
          responseRate: 0,
          avgResponseHours: 0,
          totalRevenue: 0,
          commissionBalance: 0,
          pendingCommission: 0,
          totalCommissionEarned: 0,
          leadCreditsBalance: 0,
          leadCreditsConsumed: 0,
          leadCreditsPurchased: 0,
        });
        setLoading(false);
      });
  }, [user, company]);

  if (loading) {
    return (
      <DashboardLayout>
        <PageMeta
          title="Response Analytics — Supplier | BulkSkart"
          description="BulkSkart dashboard — manage your account, orders and trade activity."
          robots="noindex, nofollow"
        />
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-6 h-6 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const a = analytics ?? {
    totalRfqsReceived: 0,
    rfqsAccepted: 0,
    rfqsIgnored: 0,
    quotesSent: 0,
    quotesAccepted: 0,
    quotesRejected: 0,
    quotesRevised: 0,
    ordersCompleted: 0,
    activeOrders: 0,
    responseRate: 0,
    avgResponseHours: 0,
    totalRevenue: 0,
    commissionBalance: 0,
    pendingCommission: 0,
    totalCommissionEarned: 0,
    leadCreditsBalance: 0,
    leadCreditsConsumed: 0,
    leadCreditsPurchased: 0,
  };

  // Acceptance rate bar segments
  const totalQ = a.quotesSent || 1;
  const acceptedPct = Math.round((a.quotesAccepted / totalQ) * 100);
  const rejectedPct = Math.round((a.quotesRejected / totalQ) * 100);
  const revisedPct = Math.round((a.quotesRevised / totalQ) * 100);
  const pendingPct = Math.max(0, 100 - acceptedPct - rejectedPct - revisedPct);

  const STATUS_COLOR: Record<string, string> = {
    pending: 'bg-[#FF5A00]/10 text-[#FF7A2E] dark:bg-[#B33D00]/40 dark:text-[#FF7A2E]',
    accepted: 'bg-[#FF5A00]/10 text-[#FF7A2E] dark:bg-[#B33D00]/40 dark:text-[#FF7A2E]',
    rejected: 'bg-[#FF5A00]/10 text-[#FF7A2E] dark:bg-[#B33D00]/40 dark:text-[#FF7A2E]',
    revised: 'bg-orange-500/10 text-[#FF5A00] dark:bg-orange-950/30 dark:text-[#FF5A00]',
  };

  const getRequirementTitle = (q: RecentQuote): string => {
    if (!q.requirements) return 'Bulk Buyer Requirement';
    if (Array.isArray(q.requirements)) {
      return q.requirements[0]?.title ?? 'Bulk Buyer Requirement';
    }
    return q.requirements.title ?? 'Bulk Buyer Requirement';
  };

  return (
    <DashboardLayout>
      <PageMeta
        title="Response Analytics — Supplier | BulkSkart"
        description="BulkSkart dashboard — track lead credits, inquiries, quote responses and conversion metrics."
        robots="noindex, nofollow"
      />
      <div className="flex-1 min-w-0 p-4 md:p-6 overflow-y-auto">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <span>Performance & Credit Analytics</span>
                <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                  Live Audit
                </Badge>
              </h1>
              <p className="text-sm text-muted-foreground">
                Track your lead credits, RFQ responses, conversion funnel, and revenue metrics
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button asChild size="sm" className="text-xs gap-1.5 bg-[#1A0C05] text-primary-foreground">
                <Link to="/dashboard/supplier/subscription">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>View Quota & Plan</span>
                </Link>
              </Button>
            </div>
          </div>

          {!company && (
            <div className="bg-[#FF5A00]/10 border border-[#FF5A00]/20 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm text-[#FF7A2E] dark:text-[#FF7A2E]">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Company Profile Not Linked</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Link or register your supplier company profile to activate live order tracking and lead credit balance.
                  </p>
                </div>
              </div>
              <Button asChild size="sm" variant="outline" className="shrink-0 text-xs">
                <Link to="/dashboard/supplier/company">
                  Set Up Company Profile <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </Link>
              </Button>
            </div>
          )}

          {/* ── Highlighted Section: Lead Credits & Quota Usage ────────────── */}
          <Card className="border-[#FF5A00]/30 bg-gradient-to-br from-[#C94400]/5 via-transparent to-primary/5">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Zap className="w-5 h-5 text-[#FF7A2E]" /> Lead Credits & Quota Breakdown
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Clear transparency on how your lead credits and monthly allowances are utilized
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="bg-[#FF5A00]/10 text-[#FF7A2E] dark:text-[#FF7A2E] border border-[#FF5A00]/20 font-mono text-xs">
                  {a.leadCreditsBalance} Credits Available
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <div className="bg-card border border-border rounded-xl p-3.5">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span>Available Balance</span>
                    <Coins className="w-4 h-4 text-[#FF7A2E]" />
                  </div>
                  <p className="text-2xl font-bold text-foreground">{a.leadCreditsBalance}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Ready to unlock buyer phone & email
                  </p>
                </div>

                <div className="bg-card border border-border rounded-xl p-3.5">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span>Credits Consumed</span>
                    <TrendingUp className="w-4 h-4 text-primary" />
                  </div>
                  <p className="text-2xl font-bold text-foreground">{a.leadCreditsConsumed}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Buyer leads unlocked to date
                  </p>
                </div>

                <div className="bg-card border border-border rounded-xl p-3.5">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span>Credits Purchased</span>
                    <Package className="w-4 h-4 text-[#FF7A2E]" />
                  </div>
                  <p className="text-2xl font-bold text-foreground">{a.leadCreditsPurchased}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Top-up packs added
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-muted/40 rounded-lg p-3 border border-border/50">
                <div className="text-muted-foreground leading-relaxed">
                  <span className="font-semibold text-foreground">Where do credits go?</span> 1 credit is deducted only when you deliberately unlock an RFQ buyer's direct phone number, WhatsApp contact, or company email. Browsing feeds and public quotes does not consume credits.
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button asChild size="sm" variant="outline" className="h-7 text-xs gap-1">
                    <Link to="/dashboard/supplier/credits">
                      Audit Ledger <ArrowUpRight className="w-3 h-3" />
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Key Performance Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              label="Response Rate"
              value={`${Number(a.responseRate) || 0}%`}
              icon={BarChart3}
              color="bg-[#C94400]"
              sub={`${a.quotesSent} quotes / ${a.totalRfqsReceived} RFQs`}
            />
            <StatCard
              label="Avg Response Time"
              value={a.avgResponseHours > 0 ? `${a.avgResponseHours}h` : '—'}
              icon={Clock}
              color="bg-[#C94400]"
            />
            <StatCard
              label="Quotes Accepted"
              value={a.quotesAccepted}
              icon={CheckCircle2}
              color="bg-[#B33D00]"
              sub={`${acceptedPct}% acceptance rate`}
            />
            <StatCard
              label="Orders Completed"
              value={a.ordersCompleted}
              icon={Package}
              color="bg-[#B33D00]"
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="RFQs Received" value={a.totalRfqsReceived} icon={FileText} color="bg-orange-500" />
            <StatCard label="Quotes Sent" value={a.quotesSent} icon={TrendingUp} color="bg-[#C94400]" />
            <StatCard label="Active Orders" value={a.activeOrders} icon={MessageSquare} color="bg-[#C94400]" />
            <StatCard label="Total Revenue" value={`₹${(Number(a.totalRevenue) || 0).toLocaleString('en-IN')}`} icon={Star} color="bg-[#C94400]" />
          </div>

          {/* Commission Tracking Card */}
          <Card className="border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-primary" /> Commission Tracking
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground">
                    ₹{(Number(a.totalCommissionEarned) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Total Commission</p>
                </div>
                <div className="text-center border-x border-border">
                  <p className="text-2xl font-bold text-[#FF7A2E]">
                    ₹{(Number(a.pendingCommission) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Pending Payout</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-[#FF7A2E]">
                    ₹{(Number(a.commissionBalance) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Available Balance</p>
                </div>
              </div>
              {a.totalCommissionEarned === 0 && (
                <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg p-3">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  Commission is calculated automatically on completed orders. Complete your first order to start earning.
                </div>
              )}
              {a.pendingCommission > 0 && (
                <div className="mt-4 flex items-center gap-2 text-xs text-[#FF7A2E] dark:text-[#FF7A2E] bg-[#FF5A00]/10 dark:bg-[#B33D00]/20 border border-[#FF5A00]/50 rounded-lg p-3">
                  <Percent className="w-3.5 h-3.5 shrink-0" />
                  ₹{(Number(a.pendingCommission) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })} pending — payouts are processed within 7 business days of order delivery confirmation.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quote outcome breakdown */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Quote Outcome Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              {a.quotesSent === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No quotes sent yet</p>
              ) : (
                <>
                  <div className="flex rounded-full overflow-hidden h-4 mb-4 gap-0.5">
                    {acceptedPct > 0 && <div className="bg-[#1A0C05] transition-all" style={{ width: `${acceptedPct}%` }} title={`Accepted ${acceptedPct}%`} />}
                    {rejectedPct > 0 && <div className="bg-[#1A0C05] transition-all" style={{ width: `${rejectedPct}%` }} title={`Rejected ${rejectedPct}%`} />}
                    {revisedPct > 0 && <div className="bg-[#1A0C05] transition-all" style={{ width: `${revisedPct}%` }} title={`Revision ${revisedPct}%`} />}
                    {pendingPct > 0 && <div className="bg-[#1A0C05] transition-all" style={{ width: `${pendingPct}%` }} title={`Pending ${pendingPct}%`} />}
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs">
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-[#C94400] inline-block" />Accepted ({a.quotesAccepted})</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-[#C94400] inline-block" />Declined ({a.quotesRejected})</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-[#C94400] inline-block" />Revision requested ({a.quotesRevised})</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-[#C94400] inline-block" />Pending ({Math.max(0, a.quotesSent - a.quotesAccepted - a.quotesRejected - a.quotesRevised)})</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* RFQ funnel */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">RFQ Funnel</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { label: 'RFQs Matched & Received', value: a.totalRfqsReceived, max: a.totalRfqsReceived, color: 'bg-[#C94400]' },
                  { label: 'Quotes Sent', value: a.quotesSent, max: a.totalRfqsReceived, color: 'bg-[#C94400]' },
                  { label: 'Quotes Accepted', value: a.quotesAccepted, max: a.totalRfqsReceived, color: 'bg-[#C94400]' },
                  { label: 'Orders Completed', value: a.ordersCompleted, max: a.totalRfqsReceived, color: 'bg-[#C94400]' },
                ].map(row => (
                  <div key={row.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">{row.label}</span>
                      <span className="font-medium text-foreground">{row.value}</span>
                    </div>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${row.color} transition-all`}
                        style={{ width: row.max > 0 ? `${Math.min(100, (row.value / row.max) * 100)}%` : '0%' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent quotes */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Recent Quotes</CardTitle>
            </CardHeader>
            <CardContent>
              {recentQuotes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No quotes sent yet</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full whitespace-nowrap text-sm">
                    <thead>
                      <tr className="bg-muted/40">
                        <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-2">Requirement</th>
                        <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-2">Unit Price</th>
                        <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-2">Status</th>
                        <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-2">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentQuotes.map(q => {
                        const statusKey = q.status ? q.status.toLowerCase() : 'pending';
                        const displayStatus = q.status ? (q.status.charAt(0).toUpperCase() + q.status.slice(1)) : 'Pending';
                        const formattedDate = q.created_at ? new Date(q.created_at).toLocaleDateString('en-IN') : '—';
                        return (
                          <tr key={q.id} className="border-b border-border hover:bg-muted/30">
                            <td className="px-3 py-2 font-medium truncate max-w-[200px]">
                              {getRequirementTitle(q)}
                            </td>
                            <td className="px-3 py-2">
                              {q.currency ?? 'INR'} {(Number(q.unit_price) || 0).toLocaleString('en-IN')}
                            </td>
                            <td className="px-3 py-2">
                              <span className={`inline-flex text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[statusKey] ?? 'bg-muted text-muted-foreground'}`}>
                                {displayStatus}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">{formattedDate}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
