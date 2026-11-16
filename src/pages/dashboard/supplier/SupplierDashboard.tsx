import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { getProducts, getRequirements, getMyQuotations, ensureManufacturerWelcomeLeads } from '@/lib/api';
import { toast } from 'sonner';
import { supabase } from '@/db/supabase';
import { Package, FileText, TrendingUp, Plus, CreditCard, AlertCircle, BarChart3, Bell, ShieldCheck, CheckCircle2, Clock, Wallet, AlertTriangle, Sparkles, Building2, Banknote, Send, CalendarClock } from 'lucide-react';
import PageMeta from '@/components/common/PageMeta';
import { AccountCard, ActionsCard, BarsChart, Gauge, Kpi, Mini, Notice, PageHeader, Panel, QuickLink, Segmented } from '@/components/dashboard/parts';
import { fetchMonthly, lastMonths, percentChange, sum } from '@/components/dashboard/series';
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
  const { user, profile, company, displayName } = useAuth();
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
  const [series, setSeries] = useState<'quotes' | 'orders'>('quotes');

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
  const shown = series === 'quotes' ? quotesByMonth : ordersByMonth;
  const firstName = (displayName || '').trim().split(/\s+/)[0] || 'there';
  const initialsOf = (text: string) => text.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'U';
  const completion = Number((company as { profile_completion?: number } | null)?.profile_completion);
  const verificationLabel = company?.verification_status === 'verified' ? 'Verified' : company?.verification_status === 'pending' ? 'In review' : 'Not verified';
  const planLabel = subscription ? `${subscription.tier.charAt(0).toUpperCase()}${subscription.tier.slice(1)}` : 'No plan';

  return (
    <DashboardLayout>
      <PageMeta
        title="Supplier Dashboard | BulkSkart"
        description="BulkSkart dashboard — manage your account, orders and trade activity."
        robots="noindex, nofollow"
      />
      <div className="dpage">
        <PageHeader
          title={`Hi, ${firstName}!`}
          subtitle={
            <span className="inline-flex flex-wrap items-center gap-2">
              <span>{company?.company_name ?? 'Your Dashboard'}</span>
              {company?.is_verified && (
                <Badge className="shrink-0 gap-0.5 border-green-500/30 bg-green-500/15 px-1.5 py-0 text-[10px] text-green-700 dark:text-green-400">
                  <ShieldCheck className="h-2.5 w-2.5" /> Verified
                </Badge>
              )}
            </span>
          }
          actions={
            <>
              <Link to="/dashboard/supplier/rfqs" className="dbtn is-ghost">
                RFQ leads
              </Link>
              <Link to="/dashboard/supplier/products" className="dbtn is-primary">
                <Plus aria-hidden="true" /> Add Product
              </Link>
            </>
          }
        />

        {/* Mandatory Business Details Onboarding Banner */}
        {(!company || !(company as { onboarding_completed?: boolean } | null)?.onboarding_completed) && (
          <Notice
            icon={Building2}
            tone="warn"
            title={!company ? 'Setup Your Business Profile (Mandatory)' : `Complete Business Profile (${completion || 35}% Complete)`}
            tag={`Step ${(company as { onboarding_step?: number } | null)?.onboarding_step || 1} of 5`}
            action={
              <Link to="/business-setup" className="dbtn is-primary">
                <Building2 aria-hidden="true" />
                {!company ? 'Start Setup Wizard' : 'Resume Profile Setup'}
              </Link>
            }
          >
            {!company
              ? 'To unlock supplier features, publish products, and receive matched buyer RFQs, complete the official 5-step business profile setup.'
              : 'Complete your business profile, operations capacity, and document verification to unlock direct buyer contact details.'}
          </Notice>
        )}

        {/* Verification banners */}
        {company?.verification_status === 'pending' && (
          <Notice icon={AlertCircle} tone="warn" title="Verification in progress">
            Your documents are under review. You'll be notified when approved.
          </Notice>
        )}
        {company?.verification_status === 'unverified' && (
          <Notice
            icon={ShieldCheck}
            title="Get Verified Manufacturer Badge"
            action={
              <Link to="/dashboard/supplier/verification" className="dbtn is-primary">
                Verify Now
              </Link>
            }
          >
            Upload GST, PAN, and bank documents to get verified and accept more orders.
          </Notice>
        )}

        {/* Open disputes */}
        {stats.openDisputes > 0 && (
          <Notice
            icon={AlertTriangle}
            tone="bad"
            title={`${stats.openDisputes} open dispute${stats.openDisputes > 1 ? 's' : ''}`}
            action={
              <Link to="/dashboard/supplier/disputes" className="dbtn is-ghost">
                View
              </Link>
            }
          />
        )}

        {/* Subscription banner */}
        {!subscription && (
          <Notice
            icon={CreditCard}
            tone="warn"
            title="Action Required: Unpaid Manufacturer Account"
            tag="Contacts Locked"
            action={
              <Link to="/dashboard/supplier/subscription" className="dbtn is-primary">
                <Sparkles aria-hidden="true" /> Pay Subscription Now
              </Link>
            }
          >
            Buyer contact phone numbers, bidding participant contact numbers, direct WhatsApp dialers, and official quotation submissions are strictly reserved for paid manufacturers. Upgrade your plan now to unlock all buyer contacts and active trade negotiation.
          </Notice>
        )}

        {/* Wallet summary */}
        {stats.walletBalance > 0 && (
          <Notice
            icon={Wallet}
            tone="good"
            title={`Wallet: ₹${Number(stats.walletBalance).toLocaleString()}`}
            action={
              stats.withdrawableBalance > 0 ? (
                <Link to="/dashboard/supplier/wallet" className="dbtn is-ghost">
                  Withdraw
                </Link>
              ) : undefined
            }
          >
            {`Withdrawable: ₹${Number(stats.withdrawableBalance).toLocaleString()}`}
          </Notice>
        )}

        {/* The four main figures */}
        <div className="dgrid-kpi">
          <Kpi title="Listed Products" value={stats.totalProducts} loading={loading} icon={Package} tone="orange" to="/dashboard/supplier/products" hint="Live in the marketplace" />
          <Kpi title="Quotes Sent" value={stats.quotesSent} loading={loading} icon={FileText} tone="purple" to="/dashboard/supplier/quotations" delta={{ pct: quotesDelta, label: 'vs last month' }} />
          <Kpi title="Active Orders" value={stats.activeOrders} loading={loading} icon={TrendingUp} tone="green" to="/dashboard/supplier/orders" delta={{ pct: ordersDelta, label: 'new orders vs last month' }} />
          <Kpi title="Completed Orders" value={stats.completedOrders} loading={loading} icon={CheckCircle2} tone="blue" to="/dashboard/supplier/orders" hint="Delivered and closed" />
        </div>

        <div className="dgrid-trio">
          <AccountCard
            initials={initialsOf(company?.company_name || displayName || 'U')}
            name={company?.company_name || displayName || 'Your company'}
            role="Supplier"
            to="/dashboard/supplier/profile"
            rows={[
              { icon: ShieldCheck, label: 'Verification', value: verificationLabel },
              { icon: CreditCard, label: 'Plan', value: planLabel },
              { icon: Package, label: 'Products listed', value: stats.totalProducts },
              { icon: CalendarClock, label: 'RFQ leads left', value: `${stats.leadsLeft} / ${stats.maxLeads}` },
              { icon: FileText, label: 'Quotes sent', value: stats.quotesSent },
              { icon: TrendingUp, label: 'Orders in progress', value: stats.activeOrders },
            ]}
            progress={Number.isFinite(completion) && completion > 0 ? { label: 'Profile completion', value: completion } : undefined}
          />

          <div className="dstack">
            <Panel title="Response rate" subtitle="How often you reply to buyers" to="/dashboard/supplier/analytics">
              <Gauge
                value={loading ? null : stats.responseRate}
                label="Replying to buyers"
                emptyText="Loading…"
                footer={!loading && stats.avgResponseHours > 0 ? `Average reply time: ${stats.avgResponseHours}h` : undefined}
              />
            </Panel>
            <ActionsCard
              title="Jump back in"
              subtitle="Where suppliers usually go next"
              items={[
                { to: '/dashboard/supplier/products', icon: Plus, label: 'Add a product', hint: `${stats.totalProducts} listed` },
                { to: '/dashboard/supplier/rfqs', icon: FileText, label: 'Answer RFQ leads', hint: `${stats.leadsLeft} leads left` },
                { to: '/dashboard/supplier/quotations', icon: Send, label: 'Send quotations', hint: `${stats.quotesSent} sent so far` },
              ]}
            />
          </div>

          <Panel
            className="dgrid-wide"
            title="Performance"
            subtitle="By month, for the last 12 months"
            right={
              <Segmented
                label="Chart shows"
                value={series}
                onChange={setSeries}
                options={[
                  { value: 'quotes', label: 'Quotes sent' },
                  { value: 'orders', label: 'Orders received' },
                ]}
              />
            }
          >
            <BarsChart
              months={slots.map((slot) => slot.label)}
              bars={shown}
              barLabel={series === 'quotes' ? 'quotes' : 'orders'}
              emptyText={series === 'quotes' ? 'No quotes sent in the last 12 months yet.' : 'No orders received in the last 12 months yet.'}
              ariaLabel={series === 'quotes' ? 'Quotes sent in each of the last 12 months' : 'Orders received in each of the last 12 months'}
            />
            <div className="dminis">
              <Mini label="Quotes this month" value={quotesByMonth[last]} pct={quotesDelta} />
              <Mini label="Orders this month" value={ordersByMonth[last]} pct={ordersDelta} />
              <Mini dark label="Last 12 months" value={sum(shown)} />
            </div>
          </Panel>
        </div>

        {/* The other figures */}
        <div className="dgrid-kpi">
          <Kpi title="Wallet Balance" value={`₹${Number(stats.walletBalance).toLocaleString()}`} loading={loading} icon={Wallet} tone="teal" to="/dashboard/supplier/wallet" />
          <Kpi title="Total Revenue" value={`₹${Number(stats.totalRevenue).toLocaleString()}`} loading={loading} icon={Banknote} tone="yellow" to="/dashboard/supplier/analytics" />
          <Kpi title="Avg Response Time" value={stats.avgResponseHours > 0 ? `${stats.avgResponseHours}h` : '—'} loading={loading} icon={Clock} tone="rose" to="/dashboard/supplier/analytics" />
          <Kpi title="RFQ Leads Left" value={stats.leadsLeft} suffix={`/ ${stats.maxLeads}`} loading={loading} icon={BarChart3} tone="blue" to="/dashboard/supplier/rfqs" />
        </div>

        {/* AI Opportunity Card */}
        <AIOpportunityCard summary={aiSummary} hasProducts={stats.totalProducts > 0} />

        {/* Matched Buyer Requirements — live AI matches */}
        <MatchedRequirementsPanel />

        {/* Small figures that lead to the pages behind them */}
        <div className="dstrip">
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
