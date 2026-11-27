import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Calendar, CheckCircle, Clock, ExternalLink, Inbox, Lock, MapPin, Package, RefreshCw, Send, TrendingUp, XCircle, Zap } from 'lucide-react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import PageMeta from '@/components/common/PageMeta';
import ProtectedContact from '@/components/common/ProtectedContact';
import SupplierRespondDialog from '@/components/common/SupplierRespondDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import { getRequirements } from '@/lib/api';
import { getPendingApprovalQuotations, approveAutoQuotation, dismissAutoQuotation, type AutoQuotationRow } from '@/lib/autoQuotationApi';
import type { Requirement } from '@/types/types';
import DeliveryByText from '@/components/common/DeliveryByText';

const LEAD_COUNT = 30;

function postedLabel(iso: string | null | undefined): string {
  if (!iso) return '';
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 60) return minutes <= 1 ? 'Just posted' : `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'Yesterday' : `${days} days ago`;
}

/**
 * RFQ leads: the open buyer requirements on BulkSkart, newest first. A quote sent from here is a real quotation the
 * buyer receives, and a buyer's phone number shows only when the buyer shared one (and the supplier's plan allows it).
 */
export default function SupplierRFQsPage() {
  const { user, company } = useAuth();
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<Requirement[]>([]);
  const [subscription, setSubscription] = useState<any>(null);
  const [quotedIds, setQuotedIds] = useState<Set<string>>(new Set());
  const [respondTo, setRespondTo] = useState<Requirement | null>(null);
  const [pendingAQs, setPendingAQs] = useState<AutoQuotationRow[]>([]);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [dismissingId, setDismissingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [requirements, subRes, pendingAQList, quoted] = await Promise.all([
      getRequirements({ status: 'active', limit: LEAD_COUNT }),
      company ? supabase.from('subscriptions').select('*').eq('company_id', company.id).eq('status', 'active').maybeSingle() : Promise.resolve({ data: null }),
      company ? getPendingApprovalQuotations(company.id) : Promise.resolve([] as AutoQuotationRow[]),
      company ? supabase.from('quotations').select('requirement_id').eq('supplier_company_id', company.id) : Promise.resolve({ data: [] }),
    ]);
    // a supplier does not quote on their own requests
    setLeads(requirements.filter((r) => r.buyer_id !== user?.id).slice(0, LEAD_COUNT));
    setSubscription((subRes as { data: unknown }).data ?? null);
    setPendingAQs(pendingAQList);
    const rows = ((quoted as { data: Array<{ requirement_id: string }> | null }).data ?? []) as Array<{ requirement_id: string }>;
    setQuotedIds(new Set(rows.map((row) => row.requirement_id)));
    setLoading(false);
  }, [company, user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const canQuote = Boolean(subscription && company && user);

  const handleApproveAQ = async (aq: AutoQuotationRow) => {
    if (!user) return;
    setApprovingId(aq.id);
    const { error } = await approveAutoQuotation(aq, user.id);
    setApprovingId(null);
    if (error) {
      toast.error('Failed to approve: ' + error);
      return;
    }
    toast.success('Quotation approved & sent to buyer!');
    setPendingAQs((prev) => prev.filter((q) => q.id !== aq.id));
    setQuotedIds((prev) => new Set([...prev, aq.requirement_id]));
  };

  const handleDismissAQ = async (id: string) => {
    setDismissingId(id);
    const { error } = await dismissAutoQuotation(id);
    setDismissingId(null);
    if (error) {
      toast.error('Failed to dismiss');
      return;
    }
    toast.success('Auto-quotation dismissed.');
    setPendingAQs((prev) => prev.filter((q) => q.id !== id));
  };

  return (
    <DashboardLayout>
      <PageMeta title="RFQ Leads — Supplier | BulkSkart" description="BulkSkart dashboard — manage your account, orders and trade activity." robots="noindex, nofollow" />
      <div className="flex-1 min-w-0 p-3 md:p-4 lg:p-5 overflow-y-auto">
        <div className="max-w-[1400px] w-full mx-auto">
          <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between mb-3 md:mb-4">
            <div>
              <h1 className="text-lg md:text-xl font-bold text-foreground">RFQ Leads</h1>
              <p className="text-xs md:text-sm text-muted-foreground">Open buyer requirements on BulkSkart, newest first.</p>
            </div>
            <div className="flex items-center gap-2 self-start md:self-auto">
              <Button type="button" size="sm" variant="outline" onClick={load} disabled={loading} className="h-8 text-xs gap-1.5">
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              {subscription && (
                <div className="text-xs text-muted-foreground bg-card border border-border rounded-lg px-3 py-1.5">
                  <span className="text-foreground font-semibold">{Math.max(0, (subscription.max_rfq_leads ?? 0) - (subscription.used_rfq_leads ?? 0))}</span> leads remaining
                </div>
              )}
            </div>
          </div>

          {loading && (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-muted rounded-xl animate-pulse border border-border" />
              ))}
            </div>
          )}

          {!loading && !subscription && (
            <div className="mb-3 flex flex-col sm:flex-row sm:items-center gap-2 bg-primary/5 border border-primary/20 rounded-xl p-2.5 md:p-3 text-sm">
              <div className="flex items-start gap-2.5 flex-1 min-w-0">
                <Lock className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground text-sm">Subscribe to quote and see buyer contacts</p>
                  <p className="text-xs mt-0.5 text-muted-foreground">A paid plan lets you send quotations and see the phone numbers buyers share.</p>
                </div>
              </div>
              <Link to="/dashboard/supplier/subscription" className="shrink-0">
                <Button size="sm" className="bg-primary text-primary-foreground text-xs w-full sm:w-auto">
                  View Plans
                </Button>
              </Link>
            </div>
          )}

          {/* ── Pending Auto-Quotations approval queue ─────────────────── */}
          {!loading && pendingAQs.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center gap-1.5 bg-orange-100 text-orange-700 border border-orange-300 rounded-full px-3 py-1 text-xs font-bold">
                  <Clock className="w-3.5 h-3.5" />
                  {pendingAQs.length} Auto-Quote{pendingAQs.length > 1 ? 's' : ''} Pending Your Approval
                </div>
              </div>
              <div className="space-y-3">
                {pendingAQs.map((aq) => {
                  const req = aq.requirements;
                  const fmt = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: aq.currency, maximumFractionDigits: 0 }).format(n);
                  return (
                    <div key={aq.id} className="bg-card border border-orange-300/50 rounded-xl p-4">
                      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="flex items-center gap-1 text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 rounded-full px-1.5 py-0.5">
                              <Zap className="w-2.5 h-2.5" /> AUTO-GENERATED
                            </span>
                            <Badge className="text-[10px] bg-orange-100 text-orange-700 border-orange-300">Pending Approval</Badge>
                          </div>
                          <p className="text-sm font-semibold text-foreground truncate">{aq.product_name}</p>
                          {req && (
                            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mt-1">
                              <span className="flex items-center gap-1">
                                <Package className="w-3 h-3" />
                                {req.quantity} {req.quantity_unit}
                              </span>
                              {req.destination_country && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  {req.destination_country}
                                </span>
                              )}
                              {req.deadline && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  <DeliveryByText deadline={req.deadline} />
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs text-muted-foreground">Total Amount</p>
                          <p className="text-base font-bold text-primary">{fmt(aq.total_amount)}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs bg-muted/30 rounded-lg p-2.5 mb-3 border border-border">
                        <div>
                          <p className="text-muted-foreground">Unit Price</p>
                          <p className="font-semibold text-foreground">{fmt(aq.unit_price)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Subtotal</p>
                          <p className="font-semibold text-foreground">{fmt(aq.subtotal)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Shipping + Tax</p>
                          <p className="font-semibold text-foreground">{fmt(aq.shipping_cost + aq.tax_amount)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            MOQ
                          </p>
                          <p className="font-semibold text-foreground">
                            {aq.moq} {aq.moq_unit}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <Button
                          size="sm"
                          onClick={() => handleApproveAQ(aq)}
                          disabled={approvingId === aq.id || !!dismissingId}
                          className="h-8 text-xs bg-orange-600 hover:bg-orange-700 text-white gap-1.5"
                        >
                          {approvingId === aq.id ? (
                            <>
                              <RefreshCw className="w-3 h-3 animate-spin" /> Approving…
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-3 h-3" /> Approve & Send
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDismissAQ(aq.id)}
                          disabled={dismissingId === aq.id || !!approvingId}
                          className="h-8 text-xs border-red-300 text-red-600 hover:bg-red-50 gap-1.5"
                        >
                          {dismissingId === aq.id ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : (
                            <>
                              <XCircle className="w-3 h-3" /> Dismiss
                            </>
                          )}
                        </Button>
                        {req && <p className="text-xs text-muted-foreground ml-auto">RFQ: {aq.requirement_id.slice(0, 8).toUpperCase()}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!loading && leads.length === 0 && (
            <div className="bg-card border border-border rounded-xl p-10 text-center">
              <Inbox className="w-9 h-9 mx-auto mb-3 text-muted-foreground/50" aria-hidden="true" />
              <p className="text-sm font-semibold text-foreground">No open requirements right now</p>
              <p className="text-xs text-muted-foreground mt-1">New buyer requirements appear here as soon as they are posted.</p>
            </div>
          )}

          {!loading && leads.length > 0 && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-2 md:gap-2.5">
              {leads.map((lead) => {
                const place = [lead.destination_city, lead.destination_country].filter(Boolean).join(', ');
                const quoted = quotedIds.has(lead.id);
                return (
                  <div key={lead.id} className="bg-card border border-border rounded-xl px-3 py-2.5 md:px-3.5 md:py-3 hover:border-primary/30 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                          <Link to={`/requirements/${lead.id}`} className="text-sm font-semibold text-foreground line-clamp-1 hover:text-primary">
                            {lead.title}
                          </Link>
                          {lead.created_at && <span className="text-[10px] font-semibold text-orange-500 shrink-0">{postedLabel(lead.created_at)}</span>}
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Package className="w-3 h-3" />
                            {Number(lead.quantity || 0).toLocaleString('en-IN')} {lead.quantity_unit}
                          </span>
                          {place && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {place}
                            </span>
                          )}
                          {lead.deadline && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              <DeliveryByText deadline={lead.deadline} />
                            </span>
                          )}
                          {lead.categories?.name && <span>{lead.categories.name}</span>}
                        </div>
                        <div className="flex items-center gap-2 mt-1.5 pt-1 border-t border-border/40 text-xs">
                          <span className="text-muted-foreground text-[11px] font-medium shrink-0">Contact:</span>
                          <ProtectedContact phone={lead.profiles?.phone} country={lead.destination_country} contactType="buyer" variant="inline" allowPaidSupplierUnlock seed={lead.id} />
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        {quoted ? (
                          <Badge variant="outline" className="text-xs text-orange-500 border-orange-500/30">
                            Quote sent
                          </Badge>
                        ) : canQuote ? (
                          <Button size="sm" onClick={() => setRespondTo(lead)} className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs gap-1">
                            <Send className="w-3 h-3" /> Send Quote
                          </Button>
                        ) : (
                          <Link to="/dashboard/supplier/subscription" className="text-xs text-primary border border-primary/40 rounded-md px-2 py-1 flex items-center gap-1 hover:bg-primary/10 transition-colors font-semibold">
                            <Lock className="w-3 h-3" /> Subscribe
                          </Link>
                        )}
                        <Link to={`/requirements/${lead.id}`} className="text-[11px] text-muted-foreground hover:text-primary flex items-center gap-1">
                          Details <ExternalLink className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {respondTo && user && company && (
        <SupplierRespondDialog
          open={Boolean(respondTo)}
          onClose={() => setRespondTo(null)}
          requirement={respondTo}
          supplierId={user.id}
          supplierCompanyId={company.id}
          onResponded={() => {
            setQuotedIds((prev) => new Set([...prev, respondTo.id]));
            setSubscription((prev: any) => (prev ? { ...prev, used_rfq_leads: (prev.used_rfq_leads ?? 0) + 1 } : prev));
          }}
        />
      )}
    </DashboardLayout>
  );
}
