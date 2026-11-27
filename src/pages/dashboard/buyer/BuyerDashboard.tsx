import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { getRequirements } from '@/lib/api';
import type { Requirement } from '@/types/types';
import { FileText, MessageSquare, Package, TrendingUp, Plus, Heart, Bell, AlertTriangle, ShieldCheck, CheckCircle2, Building2, Eye, Settings, Wallet } from 'lucide-react';
import { money } from '@/lib/orderPayments';
import { supabase } from '@/db/supabase';
import PageMeta from '@/components/common/PageMeta';
import { AccountCard, ActionsCard, BarsChart, Gauge, Kpi, Mini, Notice, PageHeader, Panel, QuickLink, Segmented } from '@/components/dashboard/parts';
import { fetchMonthly, lastMonths, percentChange, sum } from '@/components/dashboard/series';
import DeliveryByText from '@/components/common/DeliveryByText';
import RfqPriorityBadge from '@/components/common/RfqPriorityBadge';
import { displayPriorityTag } from '@/lib/rfqPriority';

type BuyerStats = {
  totalReqs: number; totalQuotes: number; activeConvs: number;
  activeOrders: number; completedOrders: number; savedMfrs: number;
  unreadNotifs: number; openDisputes: number; buyerVerified: boolean;
};

export default function BuyerDashboard() {
  const { user, buyerProfile, resolvedRole, loading: authLoading, displayName } = useAuth();
  const navigate = useNavigate();
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [loading, setLoading] = useState(true);
  // Money paid online that BulkSkart is holding for this buyer until they confirm delivery
  const [held, setHeld] = useState<{ total: number; count: number }>({ total: 0, count: 0 });
  useEffect(() => {
    if (!user) return;
    supabase
      .from('orders')
      .select('paid_amount,total_amount,order_status')
      .eq('buyer_id', user.id)
      .eq('payment_status', 'escrow')
      .then(({ data }) => {
        const rows = ((data ?? []) as { paid_amount: number | null; total_amount: number; order_status: string | null }[]).filter((o) => o.order_status !== 'cancelled');
        setHeld({ total: rows.reduce((s, o) => s + Number(o.paid_amount ?? o.total_amount), 0), count: rows.length });
      });
  }, [user]);

  const [stats, setStats] = useState<BuyerStats>({
    totalReqs: 0, totalQuotes: 0, activeConvs: 0,
    activeOrders: 0, completedOrders: 0, savedMfrs: 0,
    unreadNotifs: 0, openDisputes: 0, buyerVerified: false,
  });

  // The twelve months the chart covers, and what the buyer posted and received in each
  const slots = useMemo(() => lastMonths(12), []);
  const [postedByMonth, setPostedByMonth] = useState<number[]>(() => slots.map(() => 0));
  const [quotesByMonth, setQuotesByMonth] = useState<number[]>(() => slots.map(() => 0));
  const [series, setSeries] = useState<'posted' | 'quotes'>('posted');

  // Suppliers who land here by race/stale link get sent to the supplier dashboard
  useEffect(() => {
    if (authLoading) return;
    if (resolvedRole === 'supplier') navigate('/dashboard/supplier', { replace: true });
    if (resolvedRole === 'admin') navigate('/dashboard/admin', { replace: true });
  }, [authLoading, resolvedRole, navigate]);

  useEffect(() => {
    if (!user) return;
    if (resolvedRole && resolvedRole !== 'buyer') return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getRequirements({ buyerId: user.id }).catch(() => [] as Requirement[]),
      supabase.from('quotations').select('id', { count: 'exact', head: true }).eq('buyer_id', user.id),
      supabase.from('conversations').select('id', { count: 'exact', head: true }).eq('buyer_id', user.id),
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('buyer_id', user.id).in('milestone', ['order_processing','production','ready_for_dispatch','dispatched']),
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('buyer_id', user.id).eq('milestone', 'completed'),
      supabase.from('saved_manufacturers').select('id', { count: 'exact', head: true }).eq('buyer_id', user.id),
      supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_read', false),
      supabase.from('disputes').select('id', { count: 'exact', head: true }).eq('raised_by', user.id).eq('status', 'open'),
      supabase.from('buyer_profiles').select('verification_status').eq('user_id', user.id).maybeSingle(),
    ])
      .then(([reqs, quotRes, convRes, activeOrdRes, completedOrdRes, savedRes, notifRes, dispRes, verRes]) => {
        if (cancelled) return;
        setRequirements(Array.isArray(reqs) ? reqs : []);
        setStats({
          totalReqs: Array.isArray(reqs) ? reqs.length : 0,
          totalQuotes: quotRes.count ?? 0,
          activeConvs: convRes.count ?? 0,
          activeOrders: activeOrdRes.count ?? 0,
          completedOrders: completedOrdRes.count ?? 0,
          savedMfrs: savedRes.count ?? 0,
          unreadNotifs: notifRes.count ?? 0,
          openDisputes: dispRes.count ?? 0,
          buyerVerified: (verRes.data as { verification_status?: string } | null)?.verification_status === 'verified',
        });
      })
      .catch((err) => {
        console.warn('Buyer dashboard stats failed:', err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    // The chart is filled in after the page, from the dates on the buyer's own rows
    Promise.all([
      fetchMonthly(slots, (since) => supabase.from('requirements').select('created_at').eq('buyer_id', user.id).gte('created_at', since).limit(5000)),
      fetchMonthly(slots, (since) => supabase.from('quotations').select('created_at').eq('buyer_id', user.id).gte('created_at', since).limit(5000)),
    ]).then(([posted, quotes]) => {
      if (cancelled) return;
      setPostedByMonth(posted);
      setQuotesByMonth(quotes);
    });

    return () => {
      cancelled = true;
    };
  }, [user, resolvedRole, slots]);

  const last = slots.length - 1;
  const postedDelta = percentChange(postedByMonth[last], postedByMonth[last - 1]);
  const quotesDelta = percentChange(quotesByMonth[last], quotesByMonth[last - 1]);
  const withQuotes = requirements.filter((req) => (req.quote_count ?? 0) > 0).length;
  const coverage = requirements.length > 0 ? Math.round((withQuotes / requirements.length) * 1000) / 10 : null;
  const firstName = (displayName || '').trim().split(/\s+/)[0] || 'there';
  const initials = (displayName || 'U').trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'U';
  const completion = Number((buyerProfile as { profile_completion?: number } | null)?.profile_completion);
  const shown = series === 'posted' ? postedByMonth : quotesByMonth;

  return (
    <DashboardLayout>
      <PageMeta
        title="Buyer Dashboard | BulkSkart"
        description="BulkSkart dashboard — manage your account, orders and trade activity."
        robots="noindex, nofollow"
      />
      <div className="dpage">
        <PageHeader
          title={authLoading ? 'Welcome back' : `Hi, ${firstName}!`}
          subtitle="Welcome back. Here is how your sourcing is going."
          actions={
            <>
              <Link to="/dashboard/buyer/requirements" className="dbtn is-ghost">
                My requirements
              </Link>
              <Link to="/post-requirement" className="dbtn is-primary">
                <Plus aria-hidden="true" /> Post requirement
              </Link>
            </>
          }
        />

        {/* Verification banner: only once it is known, so a verified buyer never sees it flash */}
        {!loading && !stats.buyerVerified && (
          <Notice
            icon={ShieldCheck}
            title="Get Verified Buyer Badge"
            action={
              <Link to="/dashboard/buyer/verification" className="dbtn is-primary">
                Verify Now
              </Link>
            }
          >
            Verified buyers get priority responses from manufacturers and stand out in the marketplace.
          </Notice>
        )}

        {/* Open dispute alert */}
        {stats.openDisputes > 0 && (
          <Notice
            icon={AlertTriangle}
            tone="bad"
            title={`${stats.openDisputes} open dispute${stats.openDisputes > 1 ? 's' : ''} pending resolution`}
            action={
              <Link to="/dashboard/buyer/disputes" className="dbtn is-ghost">
                View
              </Link>
            }
          />
        )}

        {/* Mandatory Business Details Onboarding Banner for Buyers */}
        {!(buyerProfile as { onboarding_completed?: boolean } | null)?.onboarding_completed && (
          <Notice
            icon={Building2}
            tone="warn"
            title={`Complete Business Procurement Profile (${completion || 30}% Completed)`}
            action={
              <Link to="/business-setup" className="dbtn is-primary">
                Complete Profile
              </Link>
            }
          >
            Enter your procurement business details and categories to receive customized wholesale discounts and factory-direct pricing.
          </Notice>
        )}

        {/* The four main figures */}
        <div className="dgrid-kpi">
          <Kpi title="Requirements Posted" value={stats.totalReqs} loading={loading} icon={FileText} tone="orange" to="/dashboard/buyer/requirements" delta={{ pct: postedDelta, label: 'vs last month' }} />
          <Kpi title="Quotes Received" value={stats.totalQuotes} loading={loading} icon={Package} tone="purple" to="/dashboard/buyer/quotes" delta={{ pct: quotesDelta, label: 'vs last month' }} />
          <Kpi title="Active Orders" value={stats.activeOrders} loading={loading} icon={TrendingUp} tone="green" to="/dashboard/buyer/orders" hint="Being made or on the way" />
          <Kpi title="Completed Orders" value={stats.completedOrders} loading={loading} icon={CheckCircle2} tone="blue" to="/dashboard/buyer/orders" hint="Delivered and closed" />
        </div>

        {held.count > 0 && (
          <Notice
            icon={Wallet}
            title={`${money(held.total)} held by BulkSkart for you`}
            action={
              <Button asChild size="sm">
                <Link to="/dashboard/buyer/orders">View orders</Link>
              </Button>
            }
          >
            Paid online for {held.count} order{held.count === 1 ? '' : 's'}. The manufacturer gets it only when you confirm the goods arrived.
          </Notice>
        )}

        <div className="dgrid-trio">
          <AccountCard
            initials={initials}
            name={displayName || 'Your account'}
            role="Buyer"
            to="/dashboard/buyer/profile"
            rows={[
              { icon: ShieldCheck, label: 'Verification', value: loading ? '—' : stats.buyerVerified ? 'Verified' : 'Not verified' },
              { icon: FileText, label: 'Requirements', value: loading ? '—' : stats.totalReqs },
              { icon: Package, label: 'Quotes received', value: loading ? '—' : stats.totalQuotes },
              { icon: TrendingUp, label: 'Orders in progress', value: loading ? '—' : stats.activeOrders },
              { icon: Heart, label: 'Saved manufacturers', value: loading ? '—' : stats.savedMfrs },
              { icon: MessageSquare, label: 'Active chats', value: loading ? '—' : stats.activeConvs },
            ]}
            progress={Number.isFinite(completion) && completion > 0 ? { label: 'Profile completion', value: completion } : undefined}
          />

          <div className="dstack">
            <Panel title="Quote coverage" subtitle="Requirements that have received a quote" to="/dashboard/buyer/quotes">
              <Gauge
                value={coverage}
                label="Requirements with quotes"
                emptyText="Post a requirement to start"
                footer={requirements.length > 0 ? `${withQuotes} of ${requirements.length} requirements have a quote` : undefined}
              />
            </Panel>
            <ActionsCard
              title="Jump back in"
              subtitle="Where buyers usually go next"
              items={[
                { to: '/post-requirement', icon: Plus, label: 'Post a requirement', hint: 'Tell manufacturers what you need' },
                { to: '/dashboard/buyer/quotes', icon: Package, label: 'Compare quotes', hint: `${stats.totalQuotes} received so far` },
                { to: '/dashboard/buyer/messages', icon: MessageSquare, label: 'Open messages', hint: `${stats.activeConvs} active chats` },
              ]}
            />
          </div>

          <Panel
            className="dgrid-wide"
            title="Activity"
            subtitle="By month, for the last 12 months"
            right={
              <Segmented
                label="Chart shows"
                value={series}
                onChange={setSeries}
                options={[
                  { value: 'posted', label: 'Requirements' },
                  { value: 'quotes', label: 'Quotes' },
                ]}
              />
            }
          >
            <BarsChart
              months={slots.map((slot) => slot.label)}
              bars={shown}
              barLabel={series === 'posted' ? 'requirements' : 'quotes'}
              emptyText={series === 'posted' ? 'No requirements posted in the last 12 months yet.' : 'No quotes received in the last 12 months yet.'}
              ariaLabel={series === 'posted' ? 'Requirements posted in each of the last 12 months' : 'Quotes received in each of the last 12 months'}
            />
            <div className="dminis">
              <Mini label="Posted this month" value={postedByMonth[last]} pct={postedDelta} />
              <Mini label="Quotes this month" value={quotesByMonth[last]} pct={quotesDelta} />
              <Mini dark label="Last 12 months" value={sum(shown)} />
            </div>
          </Panel>
        </div>

        {/* Small figures that lead to the pages behind them */}
        <div className="dstrip">
          <QuickLink to="/dashboard/buyer/saved-manufacturers" icon={Heart} label="Saved Manufacturers" count={stats.savedMfrs} />
          <QuickLink to="/dashboard/buyer/messages" icon={MessageSquare} label="Active Chats" count={stats.activeConvs} />
          <QuickLink to="/dashboard/buyer/notifications" icon={Bell} label="Notifications" count={stats.unreadNotifs} />
          <QuickLink to="/dashboard/buyer/disputes" icon={AlertTriangle} label="Disputes" count={stats.openDisputes} />
          <QuickLink to="/dashboard/buyer/profile" icon={Settings} label="Profile settings" />
        </div>

        {/* Recent requirements */}
        <Panel
          title="Recent Requirements"
          subtitle="Your five newest"
          right={
            <div className="flex shrink-0 items-center gap-2">
              <Link to="/post-requirement" className="dbtn is-primary hidden md:inline-flex">
                <Plus aria-hidden="true" /> Post Requirement
              </Link>
              <Link to="/dashboard/buyer/requirements" className="dbtn is-ghost">
                View All
              </Link>
            </div>
          }
        >
          {loading ? (
            <div className="mt-3 space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-12 animate-pulse rounded-2xl bg-muted" />)}</div>
          ) : requirements.length === 0 ? (
            <div className="p-6 text-center">
              <FileText className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <p className="mb-3 text-sm text-muted-foreground">No requirements posted yet.</p>
              <Link to="/post-requirement">
                <Button size="sm" className="bg-primary text-primary-foreground">Post Your First Requirement</Button>
              </Link>
            </div>
          ) : (
            <div className="-mx-1 mt-3 overflow-x-auto">
              <table className="w-full whitespace-nowrap">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Requirement</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Qty</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Delivery by</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Status</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Quotes</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground"></th>
                  </tr>
                </thead>
                <tbody>
                  {requirements.slice(0, 5).map((req) => (
                    <tr key={req.id} className="border-t border-border transition-colors hover:bg-muted/30">
                      <td className="px-4 py-3 text-sm font-medium text-foreground">
                        <span className="inline-flex flex-wrap items-center gap-1.5">{req.title}<RfqPriorityBadge tag={displayPriorityTag(req)} /></span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{req.quantity} {req.quantity_unit}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {req.deadline ? <DeliveryByText deadline={req.deadline} /> : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`text-xs capitalize ${req.status === 'active' ? 'border-orange-600/40 text-orange-700' : 'text-muted-foreground'}`}>
                          {req.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-foreground">{req.quote_count}</td>
                      <td className="px-4 py-3">
                        <Link to={`/dashboard/buyer/quotes?req=${req.id}`}>
                          <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-primary">
                            <Eye className="h-3 w-3" /> View
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </DashboardLayout>
  );
}
