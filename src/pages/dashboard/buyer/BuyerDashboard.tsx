import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { getRequirements } from '@/lib/api';
import type { Requirement } from '@/types/types';
import { FileText, MessageSquare, Package, TrendingUp, Plus, ArrowRight, Shield, Calendar, Eye, Heart, Bell, AlertTriangle, ShieldCheck, CreditCard, CheckCircle2, Building2 } from 'lucide-react';
import { supabase } from '@/db/supabase';
import PageMeta from '@/components/common/PageMeta';

type BuyerStats = {
  totalReqs: number; totalQuotes: number; activeConvs: number;
  activeOrders: number; completedOrders: number; savedMfrs: number;
  unreadNotifs: number; openDisputes: number; buyerVerified: boolean;
};

export default function BuyerDashboard() {
  const { user, profile, buyerProfile, resolvedRole, displayName, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<BuyerStats>({
    totalReqs: 0, totalQuotes: 0, activeConvs: 0,
    activeOrders: 0, completedOrders: 0, savedMfrs: 0,
    unreadNotifs: 0, openDisputes: 0, buyerVerified: false,
  });

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
    return () => {
      cancelled = true;
    };
  }, [user, resolvedRole]);

  const statsCards = [
    { label: 'Requirements Posted', value: stats.totalReqs, icon: FileText, color: 'text-primary', to: '/dashboard/buyer/requirements' },
    { label: 'Quotes Received', value: stats.totalQuotes, icon: Package, color: 'text-green-500', to: '/dashboard/buyer/quotes' },
    { label: 'Active Orders', value: stats.activeOrders, icon: TrendingUp, color: 'text-[#FF5A00]', to: '/dashboard/buyer/orders' },
    { label: 'Completed Orders', value: stats.completedOrders, icon: CheckCircle2, color: 'text-green-600', to: '/dashboard/buyer/orders' },
    { label: 'Saved Manufacturers', value: stats.savedMfrs, icon: Heart, color: 'text-rose-500', to: '/dashboard/buyer/saved-manufacturers' },
    { label: 'Active Chats', value: stats.activeConvs, icon: MessageSquare, color: 'text-indigo-500', to: '/dashboard/buyer/messages' },
  ];

  return (
    <DashboardLayout>
      <PageMeta
        title="Buyer Dashboard | BulkSkart"
        description="BulkSkart dashboard — manage your account, orders and trade activity."
        robots="noindex, nofollow"
      />
      <div className="flex-1 min-w-0 p-3 md:p-6 overflow-y-auto">
        <div className="max-w-5xl w-full mx-auto">
          {/* Header */}
          <div className="bs-glass mb-4 flex items-center justify-between gap-3 flex-wrap rounded-2xl p-4">
            <div>
              <h1 className="text-base md:text-xl font-bold text-foreground">Welcome back, {displayName.split(' ')[0] || profile?.full_name?.split(' ')[0] || 'Buyer'}</h1>
              <p className="text-xs md:text-sm text-muted-foreground">Manage your bulk requirements and received quotes</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {stats.unreadNotifs > 0 && (
                <Link to="/dashboard/buyer/notifications">
                  <Button variant="outline" size="sm" className="gap-1.5 relative">
                    <Bell className="w-4 h-4" />
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-primary text-primary-foreground text-[10px] rounded-full flex items-center justify-center font-bold">{stats.unreadNotifs}</span>
                  </Button>
                </Link>
              )}
              <Link to="/post-requirement">
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2 hidden md:flex">
                  <Plus className="w-4 h-4" /> Post Requirement
                </Button>
              </Link>
            </div>
          </div>

          {/* Verification banner */}
          {!stats.buyerVerified && (
            <div className="mb-4 flex items-start gap-3 bg-primary/5 border border-primary/20 rounded-xl p-3 md:p-4 text-sm">
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
            <div className="mb-4 flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-3 text-sm">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
              <span className="text-red-700">{stats.openDisputes} open dispute{stats.openDisputes > 1 ? 's' : ''} pending resolution</span>
              <Link to="/dashboard/buyer/disputes" className="ml-auto shrink-0">
                <Button variant="outline" size="sm" className="text-xs border-red-300 text-red-600 hover:bg-red-50">View</Button>
              </Link>
            </div>
          )}

          {/* Mandatory Business Details Onboarding Banner for Buyers */}
          {(!(buyerProfile as any)?.onboarding_completed) && (
            <div className="mb-4 bg-gradient-to-r from-primary/10 via-orange-500/10 to-amber-500/5 border-2 border-primary/40 rounded-xl p-3.5 sm:p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
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

          {/* Stats grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 sm:gap-3 mb-4 md:mb-5">
            {statsCards.map(s => {
              const Icon = s.icon;
              return (
                <Link key={s.label} to={s.to} className="bg-card border border-border rounded-xl p-3 md:p-4 hover:shadow-md transition-shadow block">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
                      <p className="text-2xl font-bold text-foreground">{loading ? <span className="inline-block h-7 w-12 animate-pulse rounded-md bg-muted" /> : s.value}</p>
                    </div>
                    <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <Icon className={`w-5 h-5 ${s.color}`} />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3 md:mb-5">
            <Link to="/dashboard/buyer/verification">
              <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs">
                <ShieldCheck className="w-3.5 h-3.5" /> KYC Verification
              </Button>
            </Link>
            <Link to="/dashboard/buyer/saved-manufacturers">
              <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs">
                <Heart className="w-3.5 h-3.5" /> Saved Manufacturers
              </Button>
            </Link>
            <Link to="/dashboard/buyer/notifications">
              <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs">
                <Bell className="w-3.5 h-3.5" /> Notifications
              </Button>
            </Link>
            <Link to="/dashboard/buyer/disputes">
              <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs">
                <AlertTriangle className="w-3.5 h-3.5" /> Disputes
              </Button>
            </Link>
          </div>

          {/* Mobile post requirement button */}
          <Link to="/post-requirement" className="md:hidden block mb-4">
            <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90 gap-2">
              <Plus className="w-4 h-4" /> Post a New Requirement
            </Button>
          </Link>

          {/* Recent requirements */}
          <div className="bg-card border border-border rounded-xl overflow-hidden min-w-0">
            <div className="flex items-center justify-between px-4 md:px-5 py-3 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">Recent Requirements</h2>
              <Link to="/dashboard/buyer/requirements">
                <Button variant="ghost" size="sm" className="text-xs text-primary gap-1">View All <ArrowRight className="w-3 h-3" /></Button>
              </Link>
            </div>
            {loading ? (
              <div className="p-4 space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-muted rounded animate-pulse" />)}</div>
            ) : requirements.length === 0 ? (
              <div className="p-8 text-center">
                <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground mb-3">No requirements posted yet.</p>
                <Link to="/post-requirement">
                  <Button size="sm" className="bg-primary text-primary-foreground">Post Your First Requirement</Button>
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
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
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
