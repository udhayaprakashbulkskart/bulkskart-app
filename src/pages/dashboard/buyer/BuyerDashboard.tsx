import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { getRequirements } from '@/lib/api';
import type { Requirement } from '@/types/types';
import { FileText, MessageSquare, Package, TrendingUp, Plus, ArrowRight, Heart, Bell, AlertTriangle, ShieldCheck, CheckCircle2, Building2, Eye } from 'lucide-react';
import { supabase } from '@/db/supabase';
import PageMeta from '@/components/common/PageMeta';
import { BarsChart, Gauge, Kpi, Mini, Panel, QuickLink } from '@/components/dashboard/parts';
import { fetchMonthly, lastMonths, percentChange } from '@/components/dashboard/series';

type BuyerStats = {
  totalReqs: number; totalQuotes: number; activeConvs: number;
  activeOrders: number; completedOrders: number; savedMfrs: number;
  unreadNotifs: number; openDisputes: number; buyerVerified: boolean;
};

export default function BuyerDashboard() {
  const { user, buyerProfile, resolvedRole, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<BuyerStats>({
    totalReqs: 0, totalQuotes: 0, activeConvs: 0,
    activeOrders: 0, completedOrders: 0, savedMfrs: 0,
    unreadNotifs: 0, openDisputes: 0, buyerVerified: false,
  });

  // The twelve months the chart covers, and what the buyer posted and received in each
  const slots = useMemo(() => lastMonths(12), []);
  const [postedByMonth, setPostedByMonth] = useState<number[]>(() => slots.map(() => 0));
  const [quotesByMonth, setQuotesByMonth] = useState<number[]>(() => slots.map(() => 0));

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
  const dash = (value: number) => (loading ? '—' : value);

  return (
    <DashboardLayout>
      <PageMeta
        title="Buyer Dashboard | BulkSkart"
        description="BulkSkart dashboard — manage your account, orders and trade activity."
        robots="noindex, nofollow"
      />
      <div className="dpage">
        <h1 className="sr-only">Buyer dashboard overview</h1>

        {/* Verification banner */}
        {!stats.buyerVerified && (
          <div className="flex items-start gap-3 bg-primary/5 border border-primary/20 rounded-2xl p-3 md:p-4 text-sm">
            <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5 text-primary" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground">Get Verified Buyer Badge</p>
              <p className="text-xs mt-0.5 text-muted-foreground">Verified buyers get priority responses from manufacturers and stand out in the marketplace.</p>
            </div>
            <Link to="/dashboard/buyer/verification" className="shrink-0">
              <Button size="sm" className="bg-primary text-primary-foreground text-xs">Verify Now</Button>
            </Link>
          </div>
        )}

        {/* Open dispute alert */}
        {stats.openDisputes > 0 && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl p-3 text-sm">
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
            <span className="text-red-700">{stats.openDisputes} open dispute{stats.openDisputes > 1 ? 's' : ''} pending resolution</span>
            <Link to="/dashboard/buyer/disputes" className="ml-auto shrink-0">
              <Button variant="outline" size="sm" className="text-xs border-red-300 text-red-600 hover:bg-red-50">View</Button>
            </Link>
          </div>
        )}

        {/* Mandatory Business Details Onboarding Banner for Buyers */}
        {(!(buyerProfile as any)?.onboarding_completed) && (
          <div className="bg-gradient-to-r from-primary/10 via-orange-500/10 to-amber-500/5 border-2 border-primary/40 rounded-2xl p-3.5 sm:p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-primary/20 text-primary flex items-center justify-center shrink-0 mt-0.5">
                <Building2 className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-foreground text-xs sm:text-sm truncate">
                  Complete Business Procurement Profile ({(buyerProfile as any)?.profile_completion || 30}% Completed)
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  Enter your procurement business details and categories to receive customized wholesale discounts and factory-direct pricing.
                </p>
              </div>
            </div>
            <Link to="/business-setup" className="shrink-0 w-full sm:w-auto">
              <Button size="sm" className="w-full bg-primary text-white hover:bg-primary/90 font-bold text-xs h-8 px-3 rounded-lg shadow-sm gap-1.5">
                Complete Profile
              </Button>
            </Link>
          </div>
        )}

        {/* The four main figures */}
        <div className="dgrid-kpi">
          <Kpi title="Requirements Posted" value={dash(stats.totalReqs)} icon={FileText} tone="orange" to="/dashboard/buyer/requirements" delta={{ pct: postedDelta, label: 'vs last month' }} />
          <Kpi title="Quotes Received" value={dash(stats.totalQuotes)} icon={Package} tone="purple" to="/dashboard/buyer/quotes" delta={{ pct: quotesDelta, label: 'vs last month' }} />
          <Kpi title="Active Orders" value={dash(stats.activeOrders)} icon={TrendingUp} tone="green" to="/dashboard/buyer/orders" />
          <Kpi title="Completed Orders" value={dash(stats.completedOrders)} icon={CheckCircle2} tone="blue" to="/dashboard/buyer/orders" />
        </div>

        {/* Chart and gauge */}
        <div className="dgrid-main">
          <Panel
            title="Activity"
            subtitle="Requirements you posted and quotes you received, by month"
            legend={[
              { label: 'Requirements posted', color: '#f2802d' },
              { label: 'Quotes received', color: '#34d399' },
            ]}
            right={<span className="dp-pill">Last 12 months</span>}
          >
            <BarsChart
              months={slots.map((slot) => slot.label)}
              bars={postedByMonth}
              barLabel="requirements"
              line={quotesByMonth}
              lineLabel="quotes"
              emptyText="No requirements or quotes in the last 12 months yet."
              ariaLabel="Requirements posted and quotes received in each of the last 12 months"
            />
          </Panel>

          <Panel title="Quote coverage" subtitle="Requirements that have received a quote" to="/dashboard/buyer/quotes">
            <Gauge value={coverage} label="Requirements with quotes" emptyText="Post a requirement to start" />
            <div className="dminis">
              <Mini label="Posted this month" value={postedByMonth[last]} pct={postedDelta} />
              <Mini label="Quotes this month" value={quotesByMonth[last]} pct={quotesDelta} />
            </div>
          </Panel>
        </div>

        {/* Quick links */}
        <div className="dgrid-q">
          <QuickLink to="/dashboard/buyer/saved-manufacturers" icon={Heart} label="Saved Manufacturers" count={stats.savedMfrs} />
          <QuickLink to="/dashboard/buyer/messages" icon={MessageSquare} label="Active Chats" count={stats.activeConvs} />
          <QuickLink to="/dashboard/buyer/notifications" icon={Bell} label="Notifications" count={stats.unreadNotifs} />
          <QuickLink to="/dashboard/buyer/disputes" icon={AlertTriangle} label="Disputes" count={stats.openDisputes} />
        </div>

        {/* Mobile post requirement button */}
        <Link to="/post-requirement" className="md:hidden block">
          <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90 gap-2">
            <Plus className="w-4 h-4" /> Post a New Requirement
          </Button>
        </Link>

        {/* Recent requirements */}
        <Panel
          title="Recent Requirements"
          right={
            <div className="flex items-center gap-2 shrink-0">
              <Link to="/post-requirement" className="hidden md:block">
                <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5 text-xs">
                  <Plus className="w-3.5 h-3.5" /> Post Requirement
                </Button>
              </Link>
              <Link to="/dashboard/buyer/requirements">
                <Button variant="ghost" size="sm" className="text-xs text-primary gap-1">View All <ArrowRight className="w-3 h-3" /></Button>
              </Link>
            </div>
          }
        >
          {loading ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-muted rounded animate-pulse" />)}</div>
          ) : requirements.length === 0 ? (
            <div className="p-6 text-center">
              <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-3">No requirements posted yet.</p>
              <Link to="/post-requirement">
                <Button size="sm" className="bg-primary text-primary-foreground">Post Your First Requirement</Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-1">
              <table className="w-full whitespace-nowrap">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2">Requirement</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2">Qty</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2">Deadline</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2">Status</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2">Quotes</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {requirements.slice(0, 5).map(req => (
                    <tr key={req.id} className="border-t border-border hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-foreground">{req.title}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{req.quantity} {req.quantity_unit}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {req.deadline ? new Date(req.deadline).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`text-xs capitalize ${req.status === 'active' ? 'text-green-400 border-green-400/30' : 'text-muted-foreground'}`}>
                          {req.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-foreground">{req.quote_count}</td>
                      <td className="px-4 py-3">
                        <Link to={`/dashboard/buyer/quotes?req=${req.id}`}>
                          <Button size="sm" variant="ghost" className="text-xs text-primary gap-1 h-7">
                            <Eye className="w-3 h-3" /> View
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
