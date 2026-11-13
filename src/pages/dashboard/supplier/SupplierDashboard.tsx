import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { getProducts, getRequirements, getMyQuotations, ensureManufacturerWelcomeLeads } from '@/lib/api';
import { toast } from 'sonner';
import { supabase } from '@/db/supabase';
import { Package, FileText, TrendingUp, Plus, ArrowRight, Shield, CreditCard, AlertCircle, BarChart3, Bell, ShieldCheck, CheckCircle2, MessageSquare, Clock, Wallet, AlertTriangle, RefreshCw, Sparkles, Building2 } from 'lucide-react';
import PageMeta from '@/components/common/PageMeta';
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

    return () => { cancelled = true; };
  }, [user, company]);

  const statsCards = [
    { label: 'Listed Products', value: stats.totalProducts, icon: Package, color: 'text-primary', to: '/dashboard/supplier/products' },
    { label: 'Quotes Sent', value: stats.quotesSent, icon: FileText, color: 'text-[#FF7A2E]', to: '/dashboard/supplier/quotations' },
    { label: 'Active Orders', value: stats.activeOrders, icon: TrendingUp, color: 'text-[#FF5A00]', to: '/dashboard/supplier/orders' },
    { label: 'Completed Orders', value: stats.completedOrders, icon: CheckCircle2, color: 'text-[#FF7A2E]', to: '/dashboard/supplier/orders' },
    { label: 'Response Rate', value: `${stats.responseRate}%`, icon: BarChart3, color: 'text-[#FF7A2E]', to: '/dashboard/supplier/analytics' },
    { label: 'Avg Response Time', value: stats.avgResponseHours > 0 ? `${stats.avgResponseHours}h` : '—', icon: Clock, color: 'text-orange-500', to: '/dashboard/supplier/analytics' },
    { label: 'Wallet Balance', value: `₹${Number(stats.walletBalance).toLocaleString()}`, icon: Wallet, color: 'text-[#FF7A2E]', to: '/dashboard/supplier/wallet' },
    { label: 'RFQ Leads Left', value: stats.leadsLeft, sub: `/ ${stats.maxLeads}`, icon: BarChart3, color: 'text-[#FF7A2E]', to: '/dashboard/supplier/rfqs' },
  ];

  return (
    <DashboardLayout>
      <PageMeta
        title="Supplier Dashboard | BulkSkart"
        description="BulkSkart dashboard — manage your account, orders and trade activity."
        robots="noindex, nofollow"
      />
      <div className="flex-1 min-w-0 p-3 md:p-4 lg:p-5">
        <div className="max-w-[1400px] w-full mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base md:text-xl font-bold text-foreground truncate max-w-[280px] sm:max-w-md">{company?.company_name ?? 'Your Dashboard'}</h1>
                {company?.is_verified && (
                  <Badge className="bg-[#FF5A00]/10 text-[#FF7A2E] border-[#FF5A00]/40 text-[10px] px-1.5 py-0 gap-0.5 shrink-0">
                    <ShieldCheck className="w-2.5 h-2.5" /> Verified
                  </Badge>
                )}
              </div>
              <p className="text-xs md:text-sm text-muted-foreground truncate">Manage products, leads, and quotations</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {stats.unreadNotifs > 0 && (
                <Link to="/dashboard/supplier/notifications">
                  <Button variant="outline" size="sm" className="gap-1.5 relative">
                    <Bell className="w-4 h-4" />
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-[#C94400] text-primary-foreground text-[10px] rounded-full flex items-center justify-center font-bold">{stats.unreadNotifs}</span>
                  </Button>
                </Link>
              )}
              <Link to="/dashboard/supplier/products" className="hidden md:block">
                <Button className="bg-[#1A0C05] text-primary-foreground hover:bg-primary/90 gap-2 text-sm">
                  <Plus className="w-4 h-4" /> Add Product
                </Button>
              </Link>
            </div>
          </div>

          {/* Mandatory Business Details Onboarding Banner */}
          {(!company || !(company as any)?.onboarding_completed) && (
            <div className="mb-4 bg-gradient-to-r from-primary/10 via-orange-500/10 to-[#B33D00]/5 border-2 border-primary/40 rounded-2xl p-4 sm:p-5 shadow-sm">
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
                  <Button size="sm" className="w-full bg-[#C94400] text-white hover:bg-primary/90 font-bold text-xs h-9 px-4 rounded-xl shadow-md gap-1.5">
                    <Building2 className="w-3.5 h-3.5" />
                    {!company ? 'Start Setup Wizard' : 'Resume Profile Setup'}
                  </Button>
                </Link>
              </div>
            </div>
          )}

          {/* Verification banners */}
          {company?.verification_status === 'pending' && (
            <div className="mb-4 flex items-start gap-3 bg-[#FF5A00]/10 border border-[#FF5A00]/40 rounded-xl p-3 md:p-4 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-[#FF7A2E]" />
              <div>
                <p className="font-semibold text-[#FF7A2E]">Verification in progress</p>
                <p className="text-xs mt-0.5 text-[#FF7A2E]">Your documents are under review. You'll be notified when approved.</p>
              </div>
            </div>
          )}
          {company?.verification_status === 'unverified' && (
            <div className="mb-4 flex items-start gap-3 bg-muted border border-border rounded-xl p-3 md:p-4 text-sm text-muted-foreground">
              <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5 text-primary" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground">Get Verified Manufacturer Badge</p>
                <p className="text-xs mt-0.5">Upload GST, PAN, and bank documents to get verified and accept more orders.</p>
              </div>
              <Link to="/dashboard/supplier/verification" className="shrink-0">
                <Button size="sm" className="bg-[#1A0C05] text-primary-foreground text-xs">Verify Now</Button>
              </Link>
            </div>
          )}

          {/* Open disputes */}
          {stats.openDisputes > 0 && (
            <div className="mb-4 flex items-center gap-3 bg-[#FF5A00]/10 border border-[#FF5A00]/40 rounded-xl p-3 text-sm">
              <AlertTriangle className="w-4 h-4 text-[#FF7A2E] shrink-0" />
              <span className="text-[#FF7A2E]">{stats.openDisputes} open dispute{stats.openDisputes > 1 ? 's' : ''}</span>
              <Link to="/dashboard/supplier/disputes" className="ml-auto shrink-0">
                <Button variant="outline" size="sm" className="text-xs border-[#FF5A00]/40 text-[#FF7A2E] hover:bg-[#B33D00]/10">View</Button>
              </Link>
            </div>
          )}

          {/* Subscription banner */}
          {!subscription && (
            <div className="mb-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-[#C94400]/10 via-orange-500/10 to-[#B33D00]/5 border-2 border-[#FF5A00]/30 rounded-2xl p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#FF5A00]/20 text-[#FF7A2E] flex items-center justify-center shrink-0 mt-0.5">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-black text-foreground text-sm">Action Required: Unpaid Manufacturer Account</p>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FF5A00]/20 text-[#FF7A2E] border border-[#FF5A00]/30 uppercase">
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
                  <Button size="sm" className="w-full bg-gradient-to-r from-[#C94400] to-orange-500 hover:from-[#C94400] hover:to-orange-600 text-white font-bold text-xs h-9 px-4 rounded-xl shadow-md gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> Pay Subscription Now
                  </Button>
                </Link>
              </div>
            </div>
          )}

          {/* Wallet summary */}
          {stats.walletBalance > 0 && (
            <div className="mb-4 flex items-center gap-4 bg-[#FF5A00]/10 border border-[#FF5A00]/40 rounded-xl p-3 md:p-4 text-sm flex-wrap">
              <Wallet className="w-5 h-5 text-[#FF7A2E] shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-[#FF7A2E]">Wallet: ₹{Number(stats.walletBalance).toLocaleString()}</span>
                <span className="text-[#FF7A2E] ml-3">Withdrawable: ₹{Number(stats.withdrawableBalance).toLocaleString()}</span>
              </div>
              {stats.withdrawableBalance > 0 && (
                <Link to="/dashboard/supplier/wallet" className="shrink-0">
                  <Button size="sm" variant="outline" className="text-xs border-[#FF5A00]/40 text-[#FF7A2E]">Withdraw</Button>
                </Link>
              )}
            </div>
          )}

          {/* AI Opportunity Card */}
          <div className="mb-5">
            <AIOpportunityCard summary={aiSummary} hasProducts={stats.totalProducts > 0} />
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3 mb-4 md:mb-5">
            {statsCards.map(s => {
              const Icon = s.icon;
              return (
                <Link key={s.label} to={s.to} className="bg-card border border-border rounded-xl p-3 md:p-4 hover:shadow-md transition-shadow block">
                  <div className="flex items-start justify-between mb-1.5 md:mb-2">
                    <div className="w-8 h-8 md:w-9 md:h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <Icon className={`w-4 h-4 md:w-5 md:h-5 ${s.color}`} />
                    </div>
                  </div>
                  <p className="text-xl md:text-2xl font-bold text-foreground">{loading ? '—' : s.value}<span className="text-xs md:text-sm font-normal text-muted-foreground">{s.sub ?? ''}</span></p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                </Link>
              );
            })}
          </div>

          {/* Matched Buyer Requirements — live AI matches */}
          <MatchedRequirementsPanel />

          {/* Quick actions */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
            <Link to="/dashboard/supplier/products" className="bg-card border border-border rounded-xl p-3 md:p-4 card-hover block">
              <Package className="w-6 h-6 text-primary mb-2" />
              <p className="text-sm font-semibold text-foreground">Manage Products</p>
              <p className="text-xs text-muted-foreground mt-0.5">Add, edit, delete product listings</p>
            </Link>
            <Link to="/dashboard/supplier/rfqs" className="bg-card border border-border rounded-xl p-3 md:p-4 card-hover block">
              <FileText className="w-6 h-6 text-primary mb-2" />
              <p className="text-sm font-semibold text-foreground">View RFQ Leads</p>
              <p className="text-xs text-muted-foreground mt-0.5">Browse matching buyer requirements</p>
            </Link>
            <Link to="/dashboard/supplier/quotations" className="bg-card border border-border rounded-xl p-3 md:p-4 card-hover block">
              <TrendingUp className="w-6 h-6 text-primary mb-2" />
              <p className="text-sm font-semibold text-foreground">My Quotations</p>
              <p className="text-xs text-muted-foreground mt-0.5">Track sent quotes and responses</p>
            </Link>
            <Link to="/dashboard/supplier/verification" className="bg-card border border-border rounded-xl p-3 md:p-4 card-hover block">
              <ShieldCheck className="w-6 h-6 text-primary mb-2" />
              <p className="text-sm font-semibold text-foreground">Verification</p>
              <p className="text-xs text-muted-foreground mt-0.5">Submit KYC documents</p>
            </Link>
            <Link to="/dashboard/supplier/notifications" className="bg-card border border-border rounded-xl p-3 md:p-4 card-hover block">
              <Bell className="w-6 h-6 text-primary mb-2" />
              <p className="text-sm font-semibold text-foreground">Notifications</p>
              <p className="text-xs text-muted-foreground mt-0.5">View alerts and updates</p>
            </Link>
            <Link to="/dashboard/supplier/disputes" className="bg-card border border-border rounded-xl p-3 md:p-4 card-hover block">
              <AlertTriangle className="w-6 h-6 text-primary mb-2" />
              <p className="text-sm font-semibold text-foreground">Disputes</p>
              <p className="text-xs text-muted-foreground mt-0.5">Raise or view disputes</p>
            </Link>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
