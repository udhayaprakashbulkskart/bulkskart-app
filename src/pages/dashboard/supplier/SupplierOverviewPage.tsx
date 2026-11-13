import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { getRequirements, getMyQuotations, getConversations, getSupplierInquiries } from '@/lib/api';
import { supabase } from '@/db/supabase';
import { cn } from '@/lib/utils';
import type { Requirement, Quotation } from '@/types/types';
import {
  Eye, TrendingUp, FileText, MessageSquare, ShieldCheck, Clock,
  CheckCircle, Package, ArrowRight, CreditCard, Plus, BarChart3,
  UserCircle, AlertCircle, Shield,
} from 'lucide-react';
import PageMeta from '@/components/common/PageMeta';
import AIOpportunityCard from '@/components/common/AIOpportunityCard';

interface SubData {
  tier: string;
  status: string;
  max_products: number;
  max_rfq_leads: number;
  used_rfq_leads: number;
  ends_at: string | null;
}

function ProgressBar({ used, max, label }: { used: number; max: number; label: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;
  const color = pct >= 90 ? 'bg-destructive' : pct >= 70 ? 'bg-[#C94400]' : 'bg-[#C94400]';
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-xs font-medium text-foreground">{used}<span className="text-muted-foreground">/{max === 999999 ? '∞' : max}</span></span>
      </div>
      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function SupplierOverviewPage() {
  const { user, company, profile } = useAuth();
  const [subscription, setSubscription] = useState<SubData | null>(null);
  const [productCount, setProductCount] = useState(0);
  const [quotesSent, setQuotesSent] = useState(0);
  const [acceptedQuotes, setAcceptedQuotes] = useState(0);
  const [activeConversations, setActiveConversations] = useState(0);
  const [recentRfqs, setRecentRfqs] = useState<Requirement[]>([]);
  const [recentQuotes, setRecentQuotes] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !company) { setLoading(false); return; }
    Promise.all([
      supabase.from('products').select('id', { count: 'exact', head: true }).eq('company_id', company.id),
      supabase.from('subscriptions').select('*').eq('company_id', company.id).eq('status', 'active').maybeSingle(),
      getMyQuotations(user.id),
      getConversations(user.id, company.id),
      getRequirements({ status: 'active' }),
    ]).then(([prodRes, subRes, quotations, convs, rfqs]) => {
      setSubscription(subRes.data);
      setProductCount(prodRes.count ?? 0);
      setQuotesSent(quotations.length);
      setAcceptedQuotes(quotations.filter(q => q.status === 'accepted').length);
      const directInquiries = getSupplierInquiries(company.id, user.id);
      setActiveConversations(convs.length + directInquiries.length);
      setRecentRfqs(rfqs.slice(0, 5));
      setRecentQuotes(quotations.slice(0, 5));
      setLoading(false);
    });
  }, [user, company]);

  const acceptanceRate = quotesSent > 0 ? Math.round((acceptedQuotes / quotesSent) * 100) : 0;
  const daysLeft = subscription?.ends_at
    ? Math.max(0, Math.ceil((new Date(subscription.ends_at).getTime() - Date.now()) / 86400000))
    : null;

  const tierLabel = subscription?.tier ?? 'Free';
  const tierColor = tierLabel === 'enterprise' ? 'text-[#FF7A2E] border-[#FF5A00]/30 bg-[#FF5A00]/10'
    : tierLabel === 'growth' ? 'text-[#FF7A2E] border-[#FF5A00]/30 bg-[#FF5A00]/10'
    : tierLabel === 'business' ? 'text-primary border-primary/30 bg-primary/10'
    : 'text-muted-foreground border-border bg-muted';

  const headerStats = [
    {
      label: 'Profile Views', value: company?.review_count ?? 0,
      sub: 'All time', icon: Eye, color: 'text-[#FF5A00]', bg: 'bg-orange-500/10',
    },
    {
      label: 'RFQ Leads', value: subscription?.used_rfq_leads ?? 0,
      sub: `${subscription ? subscription.max_rfq_leads - subscription.used_rfq_leads : 0} remaining`,
      icon: TrendingUp, color: 'text-primary', bg: 'bg-primary/10',
    },
    {
      label: 'Quotes Sent', value: quotesSent,
      sub: `${acceptanceRate}% acceptance rate`,
      icon: FileText, color: 'text-[#FF7A2E]', bg: 'bg-[#FF5A00]/10',
    },
    {
      label: 'Conversations', value: activeConversations,
      sub: 'Active chats', icon: MessageSquare, color: 'text-[#FF7A2E]', bg: 'bg-[#FF5A00]/10',
    },
  ];

  return (
    <DashboardLayout>
      <PageMeta
        title="Business Overview — Supplier | BulkSkart"
        description="BulkSkart dashboard — manage your account, orders and trade activity."
        robots="noindex, nofollow"
      />
      <div className="flex-1 min-w-0 p-4 md:p-6 overflow-y-auto">
        <div className="max-w-5xl w-full mx-auto space-y-6">

          {/* Header */}
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-xl font-bold text-foreground">Business Overview</h1>
              <p className="text-sm text-muted-foreground">Your performance at a glance</p>
            </div>
            <Link to="/dashboard/supplier/products">
              <Button className="bg-[#1A0C05] text-primary-foreground hover:bg-primary/90 gap-2 text-sm shrink-0">
                <Plus className="w-4 h-4" /> Add Product
              </Button>
            </Link>
          </div>

          {/* Header Stats */}
          <AIOpportunityCard />

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {headerStats.map(s => {
              const Icon = s.icon;
              const isConvCard = s.label === 'Conversations';
              const cardContent = (
                <div className={cn(
                  "bg-card border border-border rounded-xl p-3 md:p-4 transition-colors",
                  isConvCard && "hover:border-primary/50 cursor-pointer"
                )}>
                  <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center mb-3`}>
                    <Icon className={`w-5 h-5 ${s.color}`} />
                  </div>
                  <p className="text-2xl font-bold text-foreground">{loading ? '—' : s.value}</p>
                  <p className="text-xs font-medium text-foreground mt-0.5 flex items-center justify-between">
                    <span>{s.label}</span>
                    {isConvCard && <ArrowRight className="w-3.5 h-3.5 text-primary opacity-80" />}
                  </p>
                  <p className="text-xs text-muted-foreground">{s.sub}</p>
                </div>
              );

              return isConvCard ? (
                <Link key={s.label} to="/dashboard/supplier/messages" title="Open messages & buyer inquiries">
                  {cardContent}
                </Link>
              ) : (
                <div key={s.label}>{cardContent}</div>
              );
            })}
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Subscription Status */}
            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-primary" /> Subscription
                </h3>
                <Badge className={`text-xs capitalize border ${tierColor}`}>
                  {tierLabel}
                </Badge>
              </div>

              {subscription ? (
                <>
                  <div className="space-y-3">
                    <ProgressBar used={productCount} max={subscription.max_products} label="Products" />
                    <ProgressBar used={subscription.used_rfq_leads} max={subscription.max_rfq_leads} label="RFQ Leads" />
                  </div>
                  {daysLeft !== null && (
                    <div className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${
                      daysLeft <= 7 ? 'bg-destructive/10 border border-destructive/30 text-destructive' : 'bg-muted text-muted-foreground'
                    }`}>
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      {daysLeft <= 7
                        ? `Renews in ${daysLeft} day${daysLeft !== 1 ? 's' : ''} — please renew soon`
                        : `${daysLeft} days until renewal`}
                    </div>
                  )}
                  {tierLabel !== 'enterprise' && (
                    <Link to="/dashboard/supplier/subscription">
                      <Button size="sm" variant="ghost" className="w-full border border-primary/30 text-primary hover:bg-primary/10 text-xs h-8 gap-1">
                        Upgrade Plan <ArrowRight className="w-3 h-3" />
                      </Button>
                    </Link>
                  )}
                </>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground mb-3">No active subscription. Subscribe to unlock RFQ leads and direct messaging.</p>
                  <Link to="/dashboard/supplier/subscription">
                    <Button size="sm" className="bg-[#1A0C05] text-primary-foreground text-xs">Subscribe Now</Button>
                  </Link>
                </div>
              )}
            </div>

            {/* Verification Status */}
            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" /> Verification Status
              </h3>
              <div className={`flex items-center gap-3 rounded-lg p-3 ${
                company?.is_verified ? 'bg-[#FF5A00]/10 border border-[#FF5A00]/25'
                : company?.verification_status === 'pending' ? 'bg-[#FF5A00]/10 border border-[#FF5A00]/25'
                : 'bg-muted border border-border'
              }`}>
                {company?.is_verified
                  ? <ShieldCheck className="w-5 h-5 text-[#FF7A2E] shrink-0" />
                  : company?.verification_status === 'pending'
                  ? <Clock className="w-5 h-5 text-[#FF7A2E] shrink-0" />
                  : <AlertCircle className="w-5 h-5 text-muted-foreground shrink-0" />
                }
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {company?.is_verified ? 'Verified Business' : company?.verification_status === 'pending' ? 'Under Review' : 'Not Verified'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {company?.is_verified ? 'Your badge is visible to all buyers' : company?.verification_status === 'pending' ? 'Admin review in 1–2 business days' : 'Submit documents to get verified'}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                {[
                  { label: 'GST Certificate', done: !!company?.gst_doc_url || !!company?.gst_number },
                  { label: 'IEC Certificate', done: !!company?.iec_doc_url || !!company?.iec_number },
                  { label: 'Company Registration', done: !!company?.reg_doc_url },
                  { label: 'Business Profile Completed', done: !!company?.description && !!company?.logo_url },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-2 text-xs">
                    {item.done
                      ? <CheckCircle className="w-3.5 h-3.5 text-[#FF7A2E] shrink-0" />
                      : <div className="w-3.5 h-3.5 rounded-full border border-muted-foreground/40 shrink-0" />
                    }
                    <span className={item.done ? 'text-foreground' : 'text-muted-foreground'}>{item.label}</span>
                  </div>
                ))}
              </div>

              {!company?.is_verified && (
                <Link to="/dashboard/supplier/profile">
                  <Button size="sm" variant="ghost" className="w-full border border-primary/30 text-primary hover:bg-primary/10 text-xs h-8 gap-1">
                    Complete Verification <ArrowRight className="w-3 h-3" />
                  </Button>
                </Link>
              )}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Recent RFQ Leads */}
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" /> Recent RFQ Leads
                </h3>
                <Link to="/dashboard/supplier/rfqs">
                  <Button size="sm" variant="ghost" className="text-xs text-primary h-7 gap-1 hover:bg-primary/10">
                    View All <ArrowRight className="w-3 h-3" />
                  </Button>
                </Link>
              </div>
              {recentRfqs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No recent RFQ leads.</p>
              ) : (
                <div className="space-y-2">
                  {recentRfqs.map(rfq => (
                    <div key={rfq.id} className="flex items-start justify-between gap-3 p-2.5 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{rfq.title}</p>
                        <p className="text-xs text-muted-foreground">{rfq.quantity} {rfq.quantity_unit} · {rfq.destination_country ?? 'Global'}</p>
                      </div>
                      <Link to={`/dashboard/supplier/rfqs?req=${rfq.id}`}>
                        <Button size="sm" variant="ghost" className="text-xs text-primary border border-primary/20 hover:bg-primary/10 h-6 shrink-0">View</Button>
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Quotes */}
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" /> Recent Quotes
                </h3>
                <Link to="/dashboard/supplier/quotes">
                  <Button size="sm" variant="ghost" className="text-xs text-primary h-7 gap-1 hover:bg-primary/10">
                    View All <ArrowRight className="w-3 h-3" />
                  </Button>
                </Link>
              </div>
              {recentQuotes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No quotes sent yet.</p>
              ) : (
                <div className="space-y-2">
                  {recentQuotes.map(q => (
                    <div key={q.id} className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-muted/30">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">
                          {q.requirements?.title ?? 'Quote'}
                        </p>
                        <p className="text-xs text-muted-foreground">{q.currency} {q.unit_price.toLocaleString()}</p>
                      </div>
                      <Badge variant="outline" className={`text-xs capitalize shrink-0 ${
                        q.status === 'accepted' ? 'text-[#FF7A2E] border-[#FF5A00]/30'
                        : q.status === 'rejected' ? 'text-destructive border-destructive/30'
                        : 'text-muted-foreground border-border'
                      }`}>
                        {q.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Quick Actions</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { label: 'Buyer Inquiries & Chat', icon: MessageSquare, href: '/dashboard/supplier/messages', color: 'text-[#FF7A2E] bg-[#FF5A00]/10 border-[#FF5A00]/20' },
                { label: 'Add Product', icon: Plus, href: '/dashboard/supplier/products', color: 'text-primary bg-primary/10 border-primary/20' },
                { label: 'Browse RFQ Leads', icon: TrendingUp, href: '/dashboard/supplier/rfqs', color: 'text-[#FF7A2E] bg-[#FF5A00]/10 border-[#FF5A00]/20' },
                { label: 'Edit Business Profile', icon: UserCircle, href: '/dashboard/supplier/profile', color: 'text-[#FF5A00] bg-orange-500/10 border-[#FF5A00]/30/20' },
                { label: 'View Subscription', icon: CreditCard, href: '/dashboard/supplier/subscription', color: 'text-[#FF7A2E] bg-[#FF5A00]/10 border-[#FF5A00]/20' },
              ].map(action => {
                const Icon = action.icon;
                return (
                  <Link key={action.label} to={action.href}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border text-center hover:scale-105 transition-transform ${action.color}`}>
                    <Icon className="w-5 h-5" />
                    <span className="text-xs font-medium text-foreground">{action.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
