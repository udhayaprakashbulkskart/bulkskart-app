import React, { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import {
  getPendingApprovalQuotations, approveAutoQuotation, dismissAutoQuotation,
  type AutoQuotationRow,
} from '@/lib/autoQuotationApi';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Shield, MapPin, Calendar, Package, Lock, Send, Zap, CheckCircle, XCircle, RefreshCw, TrendingUp, Clock } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link } from 'react-router-dom';
import { supabase } from '@/db/supabase';
import PageMeta from '@/components/common/PageMeta';
import { buildRefreshLeadBoard, createLeadSeed, type RefreshLead } from '@/lib/refreshLeadBoard';

type QuoteForm = { unitPrice: string; currency: string; moq: string; moqUnit: string; deliveryDays: string; paymentTerms: string; validityDays: string; notes: string; };
const emptyQuote: QuoteForm = { unitPrice: '', currency: 'INR', moq: '', moqUnit: 'Pcs', deliveryDays: '30', paymentTerms: 'T/T 30% advance', validityDays: '30', notes: '' };

export default function SupplierRFQsPage() {
  const { user, company } = useAuth();
  const [boardSeed, setBoardSeed] = useState(createLeadSeed);
  const leads = useMemo(() => buildRefreshLeadBoard(boardSeed, 12), [boardSeed]);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<any>(null);
  const [selectedLead, setSelectedLead] = useState<RefreshLead | null>(null);
  const [quoteForm, setQuoteForm] = useState<QuoteForm>(emptyQuote);
  const [sending, setSending] = useState(false);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [pendingAQs, setPendingAQs] = useState<AutoQuotationRow[]>([]);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [dismissingId, setDismissingId] = useState<string | null>(null);

  useEffect(() => {
    if (!company) {
      setLoading(false);
      return;
    }
    Promise.all([
      supabase.from('subscriptions').select('*').eq('company_id', company.id).eq('status', 'active').maybeSingle(),
      getPendingApprovalQuotations(company.id),
    ]).then(([subRes, pendingAQList]) => {
      setSubscription(subRes.data);
      setPendingAQs(pendingAQList);
      setLoading(false);
    });
  }, [company]);

  const canViewFull = !!subscription;

  const handleApproveAQ = async (aq: AutoQuotationRow) => {
    if (!user) return;
    setApprovingId(aq.id);
    const { error } = await approveAutoQuotation(aq, user.id);
    setApprovingId(null);
    if (error) { toast.error('Failed to approve: ' + error); return; }
    toast.success('Quotation approved & sent to buyer!');
    setPendingAQs(prev => prev.filter(q => q.id !== aq.id));
    setSentIds(prev => new Set([...prev, aq.requirement_id]));
  };

  const handleDismissAQ = async (id: string) => {
    setDismissingId(id);
    const { error } = await dismissAutoQuotation(id);
    setDismissingId(null);
    if (error) { toast.error('Failed to dismiss'); return; }
    toast.success('Auto-quotation dismissed.');
    setPendingAQs(prev => prev.filter(q => q.id !== id));
  };

  const setQF = (field: keyof QuoteForm, v: string) => setQuoteForm(p => ({ ...p, [field]: v }));

  const handleSendQuote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead) return;
    setSending(true);
    setSentIds(prev => new Set([...prev, selectedLead.id]));
    setSelectedLead(null);
    setQuoteForm(emptyQuote);
    setSending(false);
    toast.success('Quote noted for this lead. A new lead set loads on the next refresh.');
  };

  return (
    <DashboardLayout>
      <PageMeta
        title="RFQ Leads — Supplier | BulkSkart"
        description="BulkSkart dashboard — manage your account, orders and trade activity."
        robots="noindex, nofollow"
      />
      <div className="flex-1 min-w-0 p-3 md:p-4 lg:p-5 overflow-y-auto">
        <div className="max-w-[1400px] w-full mx-auto">
          <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between mb-3 md:mb-4">
            <div>
              <h1 className="text-lg md:text-xl font-bold text-foreground">RFQ Leads</h1>
              <p className="text-xs md:text-sm text-muted-foreground">Live buyer leads. Refresh the page for a new set.</p>
            </div>
            <div className="flex items-center gap-2 self-start md:self-auto">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setBoardSeed(createLeadSeed())}
                className="h-8 text-xs gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                New leads
              </Button>
              {subscription && (
                <div className="text-xs text-muted-foreground bg-card border border-border rounded-lg px-3 py-1.5">
                  <span className="text-foreground font-semibold">{subscription.max_rfq_leads - subscription.used_rfq_leads}</span> leads remaining
                </div>
              )}
            </div>
          </div>

          {/* Loading skeleton */}
          {loading && (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-20 bg-muted rounded-xl animate-pulse border border-border" />
              ))}
            </div>
          )}

          {!loading && !subscription && (
            <div className="mb-3 flex flex-col sm:flex-row sm:items-center gap-2 bg-primary/5 border border-primary/20 rounded-xl p-2.5 md:p-3 text-sm">
              <div className="flex items-start gap-2.5 flex-1 min-w-0">
                <Lock className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground text-sm">Subscribe to Access Full RFQ Details</p>
                  <p className="text-xs mt-0.5 text-muted-foreground">Phone numbers stay partly hidden until you subscribe. A paid plan reveals the full buyer number.</p>
                </div>
              </div>
              <Link to="/dashboard/supplier/subscription" className="shrink-0">
                <Button size="sm" className="bg-primary text-primary-foreground text-xs w-full sm:w-auto">View Plans</Button>
              </Link>
            </div>
          )}

          {/* ── Pending Auto-Quotations approval queue ─────────────────── */}
          {!loading && pendingAQs.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center gap-1.5 bg-amber-100 text-amber-700 border border-amber-300 rounded-full px-3 py-1 text-xs font-bold">
                  <Clock className="w-3.5 h-3.5" />
                  {pendingAQs.length} Auto-Quote{pendingAQs.length > 1 ? 's' : ''} Pending Your Approval
                </div>
              </div>
              <div className="space-y-3">
                {pendingAQs.map(aq => {
                  const req = aq.requirements;
                  const fmt = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: aq.currency, maximumFractionDigits: 0 }).format(n);
                  return (
                    <div key={aq.id} className="bg-card border border-amber-300/50 rounded-xl p-4">
                      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="flex items-center gap-1 text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 rounded-full px-1.5 py-0.5">
                              <Zap className="w-2.5 h-2.5" /> AUTO-GENERATED
                            </span>
                            <Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-300">Pending Approval</Badge>
                          </div>
                          <p className="text-sm font-semibold text-foreground truncate">{aq.product_name}</p>
                          {req && (
                            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mt-1">
                              <span className="flex items-center gap-1"><Package className="w-3 h-3" />{req.quantity} {req.quantity_unit}</span>
                              {req.destination_country && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{req.destination_country}</span>}
                              {req.deadline && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(req.deadline).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>}
                            </div>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs text-muted-foreground">Total Amount</p>
                          <p className="text-base font-bold text-primary">{fmt(aq.total_amount)}</p>
                        </div>
                      </div>

                      {/* Breakdown */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs bg-muted/30 rounded-lg p-2.5 mb-3 border border-border">
                        <div><p className="text-muted-foreground">Unit Price</p><p className="font-semibold text-foreground">{fmt(aq.unit_price)}</p></div>
                        <div><p className="text-muted-foreground">Subtotal</p><p className="font-semibold text-foreground">{fmt(aq.subtotal)}</p></div>
                        <div><p className="text-muted-foreground">Shipping + Tax</p><p className="font-semibold text-foreground">{fmt(aq.shipping_cost + aq.tax_amount)}</p></div>
                        <div>
                          <p className="text-muted-foreground flex items-center gap-1"><TrendingUp className="w-3 h-3" />MOQ</p>
                          <p className="font-semibold text-foreground">{aq.moq} {aq.moq_unit}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <Button
                          size="sm"
                          onClick={() => handleApproveAQ(aq)}
                          disabled={approvingId === aq.id || !!dismissingId}
                          className="h-8 text-xs bg-green-600 hover:bg-green-700 text-white gap-1.5"
                        >
                          {approvingId === aq.id
                            ? <><RefreshCw className="w-3 h-3 animate-spin" /> Approving…</>
                            : <><CheckCircle className="w-3 h-3" /> Approve & Send</>}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDismissAQ(aq.id)}
                          disabled={dismissingId === aq.id || !!approvingId}
                          className="h-8 text-xs border-red-300 text-red-600 hover:bg-red-50 gap-1.5"
                        >
                          {dismissingId === aq.id
                            ? <RefreshCw className="w-3 h-3 animate-spin" />
                            : <><XCircle className="w-3 h-3" /> Dismiss</>}
                        </Button>
                        {req && <p className="text-xs text-muted-foreground ml-auto">RFQ: {aq.requirement_id.slice(0, 8).toUpperCase()}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-2 md:gap-2.5">
            {leads.map(lead => (
              <div key={lead.id} className="bg-card border border-border rounded-xl px-3 py-2.5 md:px-3.5 md:py-3 hover:border-primary/30 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                      <p className="text-sm font-semibold text-foreground line-clamp-1">{lead.title}</p>
                      {lead.verified && <span className="verified-badge text-[10px] shrink-0"><Shield className="w-2.5 h-2.5" />Verified</span>}
                      <span className="text-[10px] font-semibold text-emerald-500 shrink-0">{lead.postedLabel}</span>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Package className="w-3 h-3" />{lead.quantity.toLocaleString('en-IN')} {lead.quantityUnit}</span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        <span>{lead.flag} {lead.city}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {lead.deadlineLabel}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1 truncate">{lead.buyerCompany} · {lead.contactName} · {lead.incoterm}</p>
                    <div className="flex items-center gap-2 mt-1.5 pt-1 border-t border-border/40 text-xs">
                      <span className="text-muted-foreground text-[11px] font-medium shrink-0">Contact:</span>
                      {canViewFull ? (
                        <span className="font-mono font-semibold text-foreground tracking-tight">{lead.phone}</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-mono text-muted-foreground tracking-tight select-none">
                          <Lock className="w-3 h-3 text-[#FF5A1F] shrink-0" />
                          {lead.maskedPhone}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {sentIds.has(lead.id) ? (
                      <Badge variant="outline" className="text-xs text-green-400 border-green-400/30">Quote noted</Badge>
                    ) : canViewFull ? (
                      <Dialog onOpenChange={open => { if (open) setSelectedLead(lead); else setSelectedLead(null); }}>
                        <DialogTrigger asChild>
                          <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs gap-1">
                            <Send className="w-3 h-3" /> Send Quote
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg bg-card border-border max-h-[90dvh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle className="text-foreground text-sm">Send Quotation</DialogTitle>
                          </DialogHeader>
                          <div className="text-xs text-muted-foreground bg-muted rounded-lg p-3 mb-4">
                            <p className="font-medium text-foreground">{lead.title}</p>
                            <p>Qty: {lead.quantity.toLocaleString('en-IN')} {lead.quantityUnit} · {lead.city}, {lead.country}</p>
                            {canViewFull && <p className="mt-1 font-mono text-foreground">{lead.phone}</p>}
                          </div>
                          <form onSubmit={handleSendQuote} className="space-y-3">
                            <div className="grid grid-cols-1 gap-3">
                              <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">Unit Price *</Label>
                                <Input value={quoteForm.unitPrice} onChange={e => setQF('unitPrice', e.target.value)} type="number" required placeholder="e.g. 250" className="bg-input border-border" />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">Currency</Label>
                                <Select value={quoteForm.currency} onValueChange={v => setQF('currency', v)}>
                                  <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
                                  <SelectContent className="bg-card border-border">
                                    {['INR', 'USD', 'EUR', 'GBP', 'AED'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">MOQ *</Label>
                                <Input value={quoteForm.moq} onChange={e => setQF('moq', e.target.value)} type="number" required className="bg-input border-border" />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">Delivery (days)</Label>
                                <Input value={quoteForm.deliveryDays} onChange={e => setQF('deliveryDays', e.target.value)} type="number" className="bg-input border-border" />
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs text-muted-foreground">Payment Terms</Label>
                              <Input value={quoteForm.paymentTerms} onChange={e => setQF('paymentTerms', e.target.value)} placeholder="e.g. T/T 30% advance, 70% before shipment" className="bg-input border-border" />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs text-muted-foreground">Notes</Label>
                              <Textarea value={quoteForm.notes} onChange={e => setQF('notes', e.target.value)} rows={2} placeholder="Any additional information..." className="bg-input border-border resize-none" />
                            </div>
                            <Button type="submit" disabled={sending} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                              {sending ? 'Sending...' : 'Send Quotation'}
                            </Button>
                          </form>
                        </DialogContent>
                      </Dialog>
                    ) : (
                      <Link to="/dashboard/supplier/subscription" className="text-xs text-primary border border-primary/40 rounded-md px-2 py-1 flex items-center gap-1 hover:bg-primary/10 transition-colors font-semibold">
                        <Lock className="w-3 h-3" /> Subscribe
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
