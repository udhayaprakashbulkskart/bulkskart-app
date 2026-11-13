import React, { useEffect, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { getRequirements, getQuotationsForRequirement, updateQuotationStatus, createOrder } from '@/lib/api';
import type { Requirement, Quotation } from '@/types/types';
import { Shield, CheckCircle, XCircle, MessageSquare, Package, RefreshCw, Edit3, Download, Clock, Truck, DollarSign, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/db/supabase';
import PageMeta from '@/components/common/PageMeta';

export default function BuyerQuotesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [selectedReqId, setSelectedReqId] = useState(searchParams.get('req') ?? '');
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviseDialogOpen, setReviseDialogOpen] = useState(false);
  const [reviseQuoteId, setReviseQuoteId] = useState<string | null>(null);
  const [reviseNote, setReviseNote] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    getRequirements({ buyerId: user.id }).then(data => {
      setRequirements(data);
      if (!selectedReqId && data.length > 0) setSelectedReqId(data[0].id);
      setLoading(false);
    });
  }, [user]);

  useEffect(() => {
    if (!selectedReqId) return;
    setLoading(true);
    getQuotationsForRequirement(selectedReqId).then(data => { setQuotations(data); setLoading(false); });
  }, [selectedReqId]);

  const notifySupplier = async (quotation: Quotation, type: string, message: string) => {
    if (!quotation.supplier_id) return;
    await supabase.functions.invoke('send-notification', {
      body: {
        user_id: quotation.supplier_id,
        title: type === 'accepted' ? '🎉 Quote Accepted!' : type === 'rejected' ? 'Quote Declined' : '🔄 Revision Requested',
        message,
        type: `quote_${type}`,
        link: '/dashboard/supplier/quotations',
        reference_id: quotation.id,
        reference_type: 'quotation',
      },
    });
  };

  const handleAccept = async (q: Quotation) => {
    setActionLoading(q.id);
    // 1. Mark quotation accepted
    await updateQuotationStatus(q.id, 'accepted');

    // Compute selectedReq inline so it always reflects current state
    const req = requirements.find(r => r.id === selectedReqId);

    // 2. Auto-create order
    const { data: order, error: orderErr } = await createOrder({
      quotation_id: q.id,
      requirement_id: selectedReqId || null,
      buyer_id: user!.id,
      supplier_id: q.supplier_id ?? null,
      supplier_company_id: q.supplier_company_id,
      total_amount: q.total_price ?? q.unit_price * (req?.quantity ?? 1),
      currency: q.currency ?? 'INR',
      quantity: req?.quantity ?? 1,
      quantity_unit: req?.quantity_unit ?? null,
    });

    if (orderErr || !order) {
      toast.error('Quote accepted but order creation failed. Please contact support.');
      setActionLoading(null);
      return;
    }

    // 3. Notify supplier
    await notifySupplier(q, 'accepted',
      `Your quote for ${q.requirements?.title ?? 'your requirement'} was accepted! Order ${order.order_number} has been created.`
    );

    toast.success(`Order ${order.order_number} created! Redirecting to tracking…`);
    setQuotations(prev => prev.map(qt => qt.id === q.id ? { ...qt, status: 'accepted' } : qt));
    setActionLoading(null);

    // 4. Navigate to order tracking
    setTimeout(() => navigate(`/dashboard/buyer/orders/${order.id}`), 800);
  };

  const handleReject = async (q: Quotation) => {
    setActionLoading(q.id);
    await updateQuotationStatus(q.id, 'rejected');
    await notifySupplier(q, 'rejected', `Your quote for ${q.requirements?.title ?? 'requirement'} was declined.`);
    toast.info('Quote declined.');
    setQuotations(prev => prev.map(qt => qt.id === q.id ? { ...qt, status: 'rejected' } : qt));
    setActionLoading(null);
  };

  const openRevise = (id: string) => { setReviseQuoteId(id); setReviseNote(''); setReviseDialogOpen(true); };

  const handleRevise = async () => {
    if (!reviseQuoteId || !reviseNote.trim()) return;
    const q = quotations.find(qt => qt.id === reviseQuoteId);
    setActionLoading(reviseQuoteId);
    await updateQuotationStatus(reviseQuoteId, 'revised');
    // Store revision note in quotation notes field
    await supabase.from('quotations').update({ notes: `[REVISION REQUEST] ${reviseNote}` }).eq('id', reviseQuoteId);
    if (q) await notifySupplier(q, 'revised', `Buyer requested changes: "${reviseNote}"`);
    toast.success('Revision requested. Supplier will update the quote.');
    setQuotations(prev => prev.map(qt => qt.id === reviseQuoteId ? { ...qt, status: 'revised' } : qt));
    setReviseDialogOpen(false);
    setActionLoading(null);
  };

  const selectedReq = requirements.find(r => r.id === selectedReqId);

  const statusColor: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700 border-yellow-300',
    accepted: 'bg-green-100 text-green-700 border-green-300',
    rejected: 'bg-red-100 text-red-700 border-red-300',
    revised: 'bg-orange-500/10 text-[#FF5A00] border-[#FF5A00]/30',
  };

  return (
    <DashboardLayout>
      <PageMeta
        title="Received Quotes — Buyer | BulkSkart"
        description="BulkSkart dashboard — manage your account, orders and trade activity."
        robots="noindex, nofollow"
      />
      <div className="flex-1 min-w-0 p-4 md:p-6 overflow-y-auto">
        <div className="max-w-5xl w-full mx-auto">
          <div className="bs-glass mb-6 rounded-3xl p-4">
            <p className="text-[11px] font-bold uppercase tracking-widest text-primary">Compare quotations</p>
            <h1 className="text-xl font-black text-foreground">Received Quotes</h1>
            <p className="text-sm text-muted-foreground">Review, compare, and respond to quotations from manufacturers</p>
          </div>

          {/* Requirement selector */}
          <div className="bg-card border border-border rounded-xl p-3 md:p-4 mb-5">
            <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
              <div className="text-xs text-muted-foreground shrink-0">Select Requirement:</div>
              <Select value={selectedReqId} onValueChange={setSelectedReqId}>
                <SelectTrigger className="flex-1 bg-input border-border">
                  <SelectValue placeholder="Select a requirement" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {requirements.map(r => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.title} ({r.quote_count ?? 0} quotes)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedReq && (
              <div className="mt-3 pt-3 border-t border-border flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span>Qty: <span className="text-foreground font-medium">{selectedReq.quantity} {selectedReq.quantity_unit}</span></span>
                {selectedReq.destination_country && <span>Dest: <span className="text-foreground font-medium">{selectedReq.destination_country}</span></span>}
                {selectedReq.deadline && <span>Deadline: <span className="text-foreground font-medium">{new Date(selectedReq.deadline).toLocaleDateString()}</span></span>}
              </div>
            )}
          </div>

          {/* Summary bar */}
          {quotations.length > 0 && (
            <div className="flex gap-3 mb-4 flex-wrap text-xs">
              <span className="px-2 py-1 rounded-full bg-muted text-muted-foreground">{quotations.length} total</span>
              <span className="px-2 py-1 rounded-full bg-yellow-100 text-yellow-700">{quotations.filter(q => q.status === 'pending').length} pending</span>
              <span className="px-2 py-1 rounded-full bg-green-100 text-green-700">{quotations.filter(q => q.status === 'accepted').length} accepted</span>
              <span className="px-2 py-1 rounded-full bg-red-100 text-red-700">{quotations.filter(q => q.status === 'rejected').length} declined</span>
            </div>
          )}

          {loading ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-36 bg-muted rounded-xl animate-pulse" />)}</div>
          ) : quotations.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-12 text-center">
              <Package className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">No quotes received yet</p>
              <p className="text-sm text-muted-foreground mt-1">Manufacturers matched to your requirement will send quotes here.</p>
            </div>
          ) : (
            <>
            <div className="mb-4 flex gap-3 overflow-x-auto pb-1 snap-x snap-mandatory">
              {quotations.map(q => (
                <div key={`compare-${q.id}`} className="bs-glass min-w-[168px] snap-start rounded-2xl p-3">
                  <p className="truncate text-xs font-semibold text-foreground">{q.companies?.company_name ?? 'Manufacturer'}</p>
                  <p className="mt-1 text-lg font-black text-primary">{q.currency ?? 'INR'} {Number(q.unit_price).toLocaleString()}</p>
                  <p className="text-[11px] text-muted-foreground">Unit price · MOQ {q.moq}</p>
                </div>
              ))}
            </div>
            <div className="space-y-4">
              {quotations.map(q => (
                <div key={q.id} className={`bs-glass rounded-3xl p-5 transition-shadow hover:shadow-hover ${q.status === 'accepted' ? 'border-green-400' : q.status === 'rejected' ? 'border-muted opacity-60' : q.status === 'revised' ? 'border-[#FF5A00]/30' : 'border-border'}`}>
                  {/* Header */}
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                        {q.companies?.company_name?.[0]?.toUpperCase() ?? 'M'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-foreground">{q.companies?.company_name}</p>
                          {q.companies?.verification_status === 'verified' && (
                            <Badge className="bg-green-100 text-green-700 border-green-300 text-[10px] px-1.5 py-0 gap-0.5">
                              <Shield className="w-2.5 h-2.5" /> Verified
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{q.companies?.city}{q.companies?.country ? `, ${q.companies.country}` : ''}</p>
                        {q.companies?.years_in_business && <p className="text-xs text-muted-foreground">{q.companies.years_in_business}y in business</p>}
                      </div>
                    </div>
                    <span className={`inline-flex items-center text-xs font-medium px-2.5 py-0.5 rounded-full border ${statusColor[q.status] ?? 'bg-muted text-muted-foreground border-border'}`}>
                      {q.status.charAt(0).toUpperCase() + q.status.slice(1)}
                    </span>
                  </div>

                  {/* Price grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                    <div className="bg-muted rounded-lg p-3">
                      <div className="flex items-center gap-1 mb-0.5"><DollarSign className="w-3 h-3 text-muted-foreground" /><p className="text-xs text-muted-foreground">Unit Price</p></div>
                      <p className="text-base font-bold text-foreground">{q.currency ?? 'INR'} {Number(q.unit_price).toLocaleString()}</p>
                    </div>
                    <div className="bg-muted rounded-lg p-3">
                      <div className="flex items-center gap-1 mb-0.5"><Package className="w-3 h-3 text-muted-foreground" /><p className="text-xs text-muted-foreground">MOQ</p></div>
                      <p className="text-base font-bold text-foreground">{q.moq} {q.moq_unit ?? 'pcs'}</p>
                    </div>
                    {q.delivery_days != null && (
                      <div className="bg-muted rounded-lg p-3">
                        <div className="flex items-center gap-1 mb-0.5"><Truck className="w-3 h-3 text-muted-foreground" /><p className="text-xs text-muted-foreground">Delivery</p></div>
                        <p className="text-base font-bold text-foreground">{q.delivery_days} days</p>
                      </div>
                    )}
                    {q.validity_days != null && (
                      <div className="bg-muted rounded-lg p-3">
                        <div className="flex items-center gap-1 mb-0.5"><Calendar className="w-3 h-3 text-muted-foreground" /><p className="text-xs text-muted-foreground">Valid For</p></div>
                        <p className="text-base font-bold text-foreground">{q.validity_days} days</p>
                      </div>
                    )}
                  </div>

                  {/* Extra details */}
                  <div className="flex flex-wrap gap-4 mt-3 text-xs text-muted-foreground">
                    {q.total_price && <span>Total: <strong className="text-foreground">{q.currency ?? 'INR'} {Number(q.total_price).toLocaleString()}</strong></span>}
                    {q.production_days && <span>Production: <strong className="text-foreground">{q.production_days}d</strong></span>}
                    {q.payment_terms && <span>Payment: <strong className="text-foreground">{q.payment_terms}</strong></span>}
                    {q.delivery_terms && <span>Delivery terms: <strong className="text-foreground">{q.delivery_terms}</strong></span>}
                  </div>

                  {q.notes && (
                    <p className="text-xs text-muted-foreground mt-3 bg-muted/50 rounded-lg p-3 leading-relaxed">{q.notes}</p>
                  )}

                  {/* Actions */}
                  {q.status === 'pending' && (
                    <div className="flex gap-2 mt-4 flex-wrap">
                      <Button
                        onClick={() => handleAccept(q)}
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white gap-1 text-xs"
                        disabled={actionLoading === q.id}
                      >
                        {actionLoading === q.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                        Accept Quote
                      </Button>
                      <Button
                        onClick={() => openRevise(q.id)}
                        size="sm"
                        variant="outline"
                        className="gap-1 text-xs border-[#FF5A00]/30 text-[#FF5A00] hover:bg-orange-500/10"
                        disabled={actionLoading === q.id}
                      >
                        <Edit3 className="w-3.5 h-3.5" /> Request Changes
                      </Button>
                      <Button
                        onClick={() => handleReject(q)}
                        size="sm"
                        variant="outline"
                        className="gap-1 text-xs border-red-200 text-red-600 hover:bg-red-50"
                        disabled={actionLoading === q.id}
                      >
                        <XCircle className="w-3.5 h-3.5" /> Decline
                      </Button>
                      <Link to="/dashboard/buyer/messages">
                        <Button size="sm" variant="outline" className="gap-1 text-xs">
                          <MessageSquare className="w-3.5 h-3.5" /> Chat
                        </Button>
                      </Link>
                    </div>
                  )}
                  {q.status === 'accepted' && (
                    <div className="flex items-center gap-2 mt-3">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-sm text-green-600 font-medium">You accepted this quote</span>
                      <Link to="/dashboard/buyer/messages" className="ml-auto">
                        <Button size="sm" variant="outline" className="gap-1 text-xs">
                          <MessageSquare className="w-3.5 h-3.5" /> Continue Chat
                        </Button>
                      </Link>
                    </div>
                  )}
                  {q.status === 'revised' && (
                    <div className="flex items-center gap-2 mt-3">
                      <Edit3 className="w-4 h-4 text-[#FF5A00]" />
                      <span className="text-sm text-[#FF5A00]">Revision requested — awaiting updated quote</span>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-3">{new Date(q.created_at ?? '').toLocaleDateString()}</p>
                </div>
              ))}
            </div>
            </>
          )}
        </div>
      </div>

      {/* Revise dialog */}
      <Dialog open={reviseDialogOpen} onOpenChange={setReviseDialogOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <DialogHeader><DialogTitle>Request Revision</DialogTitle></DialogHeader>
          <div className="py-2 space-y-3">
            <p className="text-sm text-muted-foreground">Describe the changes you'd like the supplier to make to this quote.</p>
            <Textarea
              value={reviseNote}
              onChange={e => setReviseNote(e.target.value)}
              rows={4}
              placeholder="e.g. Please reduce unit price, increase delivery time to 30 days, and include GST separately…"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviseDialogOpen(false)}>Cancel</Button>
            <Button
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={handleRevise}
              disabled={!reviseNote.trim() || actionLoading === reviseQuoteId}
            >
              {actionLoading === reviseQuoteId ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : null}
              Send Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
