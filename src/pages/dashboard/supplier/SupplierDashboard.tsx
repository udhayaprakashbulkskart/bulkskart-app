import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { getProducts, getRequirements, getMyQuotations, ensureManufacturerWelcomeLeads } from '@/lib/api';
import { toast } from 'sonner';
import { supabase } from '@/db/supabase';
import { Package, FileText, TrendingUp, Plus, CreditCard, AlertCircle, BarChart3, Bell, ShieldCheck, CheckCircle2, Clock, Wallet, AlertTriangle, Sparkles, Building2, Banknote } from 'lucide-react';
import PageMeta from '@/components/common/PageMeta';
import { BarsChart, Gauge, Kpi, Mini, Panel, QuickLink } from '@/components/dashboard/parts';
import { fetchMonthly, lastMonths, percentChange } from '@/components/dashboard/series';
import MatchedRequirementsPanel from '@/components/common/MatchedRequirementsPanel';
import AIOpportunityCard from '@/components/common/AIOpportunityCard';
import {
  analyzeAndMatchOpportunities,
  generateAIOpportunitySummary,
  type AIOpportunitySummary,
} from '@/lib/aiSalesAssistant';

type MfrStats = {
  totalProducts: number; rfqLeads: number; quotesSent: number; leadsLeft: number; maxLeads: number;
  activeOrders: number; completedOrders: number; responseRate: number; avgResponseHours: number;
  totalRevenue: number; walletBalance: number; withdrawableBalance: number;
  unreadNotifs: number; openDisputes: number;
};

export default function SupplierDashboard() {
  const { user, profile, company } = useAuth();
  const [stats, setStats] = useState<MfrStats>({
    totalProducts: 0, rfqLeads: 0, quotesSent: 0, leadsLeft: 0, maxLeads: 10,
    activeOrders: 0, completedOrders: 0, responseRate: 0, avgResponseHours: 0,
    totalRevenue: 0, walletBalance: 0, withdrawableBalance: 0,
    unreadNotifs: 0, openDisputes: 0,
  });
  const [subscription, setSubscription] = useState<{
    tier: string; ends_at: string | null; max_rfq_leads: number; used_rfq_leads: number; max_products: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiSummary, setAiSummary] = useState<AIOpportunitySummary>({
    totalOpportunities: 0,
    highPriorityCount: 0,
    mediumPriorityCount: 0,
    lowPriorityCount: 0,
    averageMatchScore: 0,
    potentialBusinessINR: 0,
    potentialBusinessINRFormatted: '₹0',
  });

  // The twelve months the chart covers: quotes the company sent and orders it received in each
  const slots = useMemo(() => lastMonths(12), []);
  const [quotesByMonth, setQuotesByMonth] = useState<number[]>(() => slots.map(() => 0));
  const [ordersByMonth, setOrdersByMonth] = useState<number[]>(() => slots.map(() => 0));

  useEffect(() => {
    if (!user || !company) { setLoading(false); return; }
    let cancelled = false;

    // Auto-deliver 5 sample buyer leads into Messages (one-time per company)
    try {
      const { seeded } = ensureManufacturerWelcomeLeads(company.id, company.company_name || 'Your Factory');
      if (seeded) {
        toast.success('5 sample buyer leads are in your Messages inbox', {
          description: 'Open Messages → Inquiries to reply.',
        });
      }
    } catch {
      /* ignore seed errors */
    }

    // Fast path: lightweight count queries only — paint the dashboard ASAP
    Promise.all([
      supabase.from('products').select('id', { count: 'exact', head: true }).eq('company_id', company.id),
      supabase.from('quotations').select('id', { count: 'exact', head: true }).eq('supplier_company_id', company.id).eq('is_draft', false),
      supabase.from('subscriptions').select('tier,ends_at,max_rfq_leads,used_rfq_leads,max_products').eq('company_id', company.id).eq('status', 'active').maybeSingle(),
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('supplier_company_id', company.id).in('milestone', ['order_processing','production','ready_for_dispatch','dispatched']),
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('supplier_company_id', company.id).eq('milestone', 'completed'),
      supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_read', false),
      supabase.from('disputes').select('id', { count: 'exact', head: true }).eq('raised_by', user.id).eq('status', 'open'),
      supabase.from('companies').select('response_rate,avg_response_hours,total_revenue,wallet_balance,withdrawable_balance').eq('id', company.id).maybeSingle(),
    ]).then(([prodRes, quotRes, subRes, activeOrdRes, compOrdRes, notifRes, dispRes, companyRes]) => {
      if (cancelled) return;
      const sub = subRes.data;
      const comp = companyRes.data as { response_rate?: number; avg_response_hours?: number; total_revenue?: number; wallet_balance?: number; withdrawable_balance?: number } | null;
      setSubscription(sub);
      if (!sub) {
        supabase.rpc('notify_unpaid_manufacturers').then(() => {}, () => {});
      }

      setStats({
        totalProducts: prodRes.count ?? 0,
        rfqLeads: sub?.used_rfq_leads ?? 0,
        quotesSent: quotRes.count ?? 0,
        leadsLeft: sub ? (sub.max_rfq_leads - sub.used_rfq_leads) : 0,
        maxLeads: sub?.max_rfq_leads ?? 10,
        activeOrders: activeOrdRes.count ?? 0,
        completedOrders: compOrdRes.count ?? 0,
        responseRate: Number(comp?.response_rate ?? 0),
        avgResponseHours: Number(comp?.avg_response_hours ?? 0),
        totalRevenue: Number(comp?.total_revenue ?? 0),
        walletBalance: Number(comp?.wallet_balance ?? 0),
        withdrawableBalance: Number(comp?.withdrawable_balance ?? 0),
        unreadNotifs: notifRes.count ?? 0,
        openDisputes: dispRes.count ?? 0,
      });
      setLoading(false);

      // Defer heavy AI matching so first paint isn't blocked
      Promise.all([
        getProducts({ companyId: company.id }),
        getRequirements({ status: 'active', limit: 40 }),
      ]).then(([supplierProds, activeReqs]) => {
        if (cancelled) return;
        const matched = analyzeAndMatchOpportunities(supplierProds || [], activeReqs || []);
        setAiSummary(generateAIOpportunitySummary(matched));
      }).catch(() => {});
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });

    // The chart is filled in after the page, from the dates on the company's own rows
    Promise.all([
      fetchMonthly(slots, (since) => supabase.from('quotations').select('created_at').eq('supplier_company_id', company.id).eq('is_draft', false).gte('created_at', since).limit(5000)),
      fetchMonthly(slots, (since) => supabase.from('orders').select('created_at').eq('supplier_company_id', company.id).gte('created_at', since).limit(5000)),
    ]).then(([quotes, orders]) => {
      if (cancelled) return;
      setQuotesByMonth(quotes);
      setOrdersByMonth(orders);
    });

    return () => { cancelled = true; };
  }, [user, company, slots]);

  const last = slots.length - 1;
  const quotesDelta = percentChange(quotesByMonth[last], quotesByMonth[last - 1]);
  const ordersDelta = percentChange(ordersByMonth[last], ordersByMonth[last - 1]);
  const dash = (value: number | string) => (loading ? '—' : value);

  return (
    <DashboardLayout>
      <PageMeta
        title="Supplier Dashboard | BulkSkart"
        description="BulkSkart dashboard — manage your account, orders and trade activity."
        robots="noindex, nofollow"
      />
      <div className="dpage">
        {/* Company name and quick action */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <h1 className="text-base md:text-lg font-bold text-foreground truncate max-w-[280px] sm:max-w-md">{company?.company_name ?? 'Your Dashboard'}</h1>
            {company?.is_verified && (
              <Badge className="bg-green-100 text-green-700 border-green-300 text-[10px] px-1.5 py-0 gap-0.5 shrink-0">
                <ShieldCheck className="w-2.5 h-2.5" /> Verified
              </Badge>
            )}
          </div>
          <Link to="/dashboard/supplier/products" className="hidden md:block">
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2 text-sm">
              <Plus className="w-4 h-4" /> Add Product
            </Button>
          </Link>
        </div>

        {/* Mandatory Business Details Onboarding Banner */}
        {(!company || !(company as any)?.onboarding_completed) && (
          <div className="bg-gradient-to-r from-primary/10 via-orange-500/10 to-amber-500/5 border-2 border-primary/40 rounded-2xl p-4 sm:p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center shrink-0 mt-0.5">
                  <Building2 className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-foreground text-sm sm:text-base">
                      {!company ? 'Setup Your Business Profile (Mandatory)' : `Complete Business Profile (${(company as any)?.profile_completion || 35}% Complete)`}
                    </p>
                    <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">
                      Step {(company as any)?.onboarding_step || 1} of 5
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {!company
                      ? 'To unlock supplier features, publish products, and receive matched buyer RFQs, complete the official 5-step business profile setup.'
                      : 'Complete your business profile, operations capacity, and document verification to unlock direct buyer contact details.'}
                  </p>
                </div>
              </div>
              <Link to="/business-setup" className="shrink-0 w-full sm:w-auto">
                <Button size="sm" className="w-full bg-primary text-white hover:bg-primary/90 font-bold text-xs h-9 px-4 rounded-xl shadow-md gap-1.5">
                  <Building2 className="w-3.5 h-3.5" />
                  {!company ? 'Start Setup Wizard' : 'Resume Profile Setup'}
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Verification banners */}
        {company?.verification_status === 'pending' && (
          <div className="flex items-start gap-3 bg-yellow-50 border border-yellow-200 rounded-2xl p-3 md:p-4 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-yellow-600" />
            <div>
              <p className="font-semibold text-yellow-800">Verification in progress</p>
              <p className="text-xs mt-0.5 text-yellow-700">Your documents are under review. You'll be notified when approved.</p>
            </div>
          </div>
        )}
        {company?.verification_status === 'unverified' && (
          <div className="flex items-start gap-3 bg-muted border border-border rounded-2xl p-3 md:p-4 text-sm text-muted-foreground">
            <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5 text-primary" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground">Get Verified Manufacturer Badge</p>
              <p className="text-xs mt-0.5">Upload GST, PAN, and bank documents to get verified and accept more orders.</p>
            </div>
            <Link to="/dashboard/supplier/verification" className="shrink-0">
              <Button size="sm" className="bg-primary text-primary-foreground text-xs">Verify Now</Button>
            </Link>
          </div>
        )}

        {/* Open disputes */}
        {stats.openDisputes > 0 && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl p-3 text-sm">
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
            <span className="text-red-700">{stats.openDisputes} open dispute{stats.openDisputes > 1 ? 's' : ''}</span>
            <Link to="/dashboard/supplier/disputes" className="ml-auto shrink-0">
              <Button variant="outline" size="sm" className="text-xs border-red-300 text-red-600 hover:bg-red-50">View</Button>
            </Link>
          </div>
        )}

        {/* Subscription banner */}
        {!subscription && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/5 border-2 border-amber-500/30 rounded-2xl p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0 mt-0.5">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-black text-foreground text-sm">Action Required: Unpaid Manufacturer Account</p>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-500 border border-amber-500/30 uppercase">
                    Contacts Locked
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Buyer contact phone numbers, bidding participant contact numbers, direct WhatsApp dialers, and official quotation submissions are strictly reserved for paid manufacturers. Upgrade your plan now to unlock all buyer contacts and active trade negotiation.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
              <Link to="/dashboard/supplier/subscription" className="w-full sm:w-auto">
                <Button size="sm" className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-xs h-9 px-4 rounded-xl shadow-md gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> Pay Subscription Now
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Wallet summary */}
        {stats.walletBalance > 0 && (
          <div className="flex items-center gap-4 bg-teal-50 border border-teal-200 rounded-2xl p-3 md:p-4 text-sm flex-wrap">
            <Wallet className="w-5 h-5 text-teal-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="font-semibold text-teal-800">Wallet: ₹{Number(stats.walletBalance).toLocaleString()}</span>
              <span className="text-teal-600 ml-3">Withdrawable: ₹{Number(stats.withdrawableBalance).toLocaleString()}</span>
            </div>
            {stats.withdrawableBalance > 0 && (
              <Link to="/dashboard/supplier/wallet" className="shrink-0">
                <Button size="sm" variant="outline" className="text-xs border-teal-300 text-teal-700">Withdraw</Button>
              </Link>
            )}
          </div>
        )}

        {/* The four main figures */}
        <div className="dgrid-kpi">
          <Kpi title="Listed Products" value={dash(stats.totalProducts)} icon={Package} tone="orange" to="/dashboard/supplier/products" />
          <Kpi title="Quotes Sent" value={dash(stats.quotesSent)} icon={FileText} tone="purple" to="/dashboard/supplier/quotations" delta={{ pct: quotesDelta, label: 'vs last month' }} />
          <Kpi title="Active Orders" value={dash(stats.activeOrders)} icon={TrendingUp} tone="green" to="/dashboard/supplier/orders" delta={{ pct: ordersDelta, label: 'new orders vs last month' }} />
          <Kpi title="Completed Orders" value={dash(stats.completedOrders)} icon={CheckCircle2} tone="blue" to="/dashboard/supplier/orders" />
        </div>

        {/* Chart and gauge */}
        <div className="dgrid-main">
          <Panel
            title="Performance"
            subtitle="Quotes you sent and orders you received, by month"
            legend={[
              { label: 'Quotes sent', color: '#f2802d' },
              { label: 'Orders received', color: '#34d399' },
            ]}
            right={<span className="dp-pill">Last 12 months</span>}
          >
            <BarsChart
              months={slots.map((slot) => slot.label)}
              bars={quotesByMonth}
              barLabel="quotes"
              line={ordersByMonth}
              lineLabel="orders"
              emptyText="No quotes or orders in the last 12 months yet."
              ariaLabel="Quotes sent and orders received in each of the last 12 months"
            />
          </Panel>

          <Panel title="Response rate" subtitle="How often you reply to buyers" to="/dashboard/supplier/analytics">
            <Gauge value={loading ? null : stats.responseRate} label="Replying to buyers" emptyText="Loading…" />
            <div className="dminis">
              <Mini label="Quotes this month" value={quotesByMonth[last]} pct={quotesDelta} />
              <Mini label="Orders this month" value={ordersByMonth[last]} pct={ordersDelta} />
            </div>
          </Panel>
        </div>

        {/* The other figures */}
        <div className="dgrid-kpi">
          <Kpi title="Wallet Balance" value={dash(`₹${Number(stats.walletBalance).toLocaleString()}`)} icon={Wallet} tone="teal" to="/dashboard/supplier/wallet" />
          <Kpi title="Total Revenue" value={dash(`₹${Number(stats.totalRevenue).toLocaleString()}`)} icon={Banknote} tone="yellow" to="/dashboard/supplier/analytics" />
          <Kpi title="Avg Response Time" value={dash(stats.avgResponseHours > 0 ? `${stats.avgResponseHours}h` : '—')} icon={Clock} tone="rose" to="/dashboard/supplier/analytics" />
          <Kpi title="RFQ Leads Left" value={dash(stats.leadsLeft)} suffix={`/ ${stats.maxLeads}`} icon={BarChart3} tone="blue" to="/dashboard/supplier/rfqs" />
        </div>

        {/* AI Opportunity Card */}
        <AIOpportunityCard summary={aiSummary} hasProducts={stats.totalProducts > 0} />

        {/* Matched Buyer Requirements — live AI matches */}
        <MatchedRequirementsPanel />

        {/* Quick actions */}
        <div className="dgrid-q">
          <QuickLink to="/dashboard/supplier/products" icon={Package} label="Manage Products" />
          <QuickLink to="/dashboard/supplier/rfqs" icon={FileText} label="View RFQ Leads" />
          <QuickLink to="/dashboard/supplier/quotations" icon={TrendingUp} label="My Quotations" />
          <QuickLink to="/dashboard/supplier/verification" icon={ShieldCheck} label="Verification" />
          <QuickLink to="/dashboard/supplier/notifications" icon={Bell} label="Notifications" count={stats.unreadNotifs} />
          <QuickLink to="/dashboard/supplier/disputes" icon={AlertTriangle} label="Disputes" count={stats.openDisputes} />
        </div>
      </div>
    </DashboardLayout>
  );
}
