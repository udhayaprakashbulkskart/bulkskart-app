/**
 * AutoQuotationCard
 *
 * Displays a single auto-generated quotation to the buyer.
 * Actions: Accept · Reject · Counter Offer (price + message) · Download PDF
 * Counter-offer replaces the old plain "Negotiate" button with a structured dialog.
 */
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  CheckCircle, XCircle, MessageSquare, RefreshCw, Download,
  Building2, Calendar, Package, ShieldCheck, Clock, Zap,
  FileText, TrendingUp, AlertCircle, ArrowLeftRight, DollarSign,
} from 'lucide-react';
import { toast } from 'sonner';

export interface AutoQuotation {
  id: string;
  requirement_id: string;
  supplier_company_id: string;
  buyer_id: string;
  status: 'draft' | 'pending_approval' | 'sent' | 'accepted' | 'rejected' | 'revised_requested' | 'expired';
  unit_price: number;
  quantity: number;
  quantity_unit: string;
  currency: string;
  subtotal: number;
  shipping_cost: number;
  tax_amount: number;
  other_charges: number;
  total_amount: number;
  product_name: string;
  product_specs: string | null;
  moq: number;
  moq_unit: string;
  delivery_days: number | null;
  estimated_delivery_date: string | null;
  validity_days: number;
  valid_until: string | null;
  payment_terms: string | null;
  terms_and_conditions: string | null;
  is_auto_generated: boolean;
  buyer_action: 'accepted' | 'rejected' | 'revised_requested' | null;
  buyer_notes: string | null;
  counter_offer_price: number | null;
  counter_offer_message: string | null;
  counter_offer_at: string | null;
  created_at: string;
  // joins
  companies?: { company_name: string; logo_url?: string | null; verification_status?: string };
}

interface Props {
  quote: AutoQuotation;
  requirementTitle: string;
  requirementId: string;
  onAccept: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
  onRevise: (id: string, notes: string) => Promise<void>;
  onCounterOffer: (id: string, price: number, message: string) => Promise<void>;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  sent:              { label: 'Quote Received',     color: 'bg-orange-500/10 text-[#FF5A00] border-[#FF5A00]/30',     icon: <FileText className="w-3 h-3" /> },
  accepted:          { label: 'Accepted',           color: 'bg-[#FF5A00]/10 text-[#FF7A2E] border-[#FF5A00]/40',  icon: <CheckCircle className="w-3 h-3" /> },
  rejected:          { label: 'Rejected',           color: 'bg-[#FF5A00]/10 text-[#FF7A2E] border-[#FF5A00]/40',        icon: <XCircle className="w-3 h-3" /> },
  revised_requested: { label: 'Counter Offer Sent', color: 'bg-[#FF5A00]/10 text-[#FF7A2E] border-[#FF5A00]/40', icon: <ArrowLeftRight className="w-3 h-3" /> },
  expired:           { label: 'Expired',            color: 'bg-muted text-muted-foreground border-border',  icon: <Clock className="w-3 h-3" /> },
  pending_approval:  { label: 'Pending Approval',   color: 'bg-[#FF5A00]/10 text-[#FF7A2E] border-[#FF5A00]/40', icon: <Clock className="w-3 h-3" /> },
  draft:             { label: 'Draft',              color: 'bg-muted text-muted-foreground border-border',  icon: <FileText className="w-3 h-3" /> },
};

function fmt(n: number, cur = 'INR') {
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: cur, maximumFractionDigits: 2 }).format(n);
  } catch {
    return `₹${n.toLocaleString('en-IN')}`;
  }
}

export default function AutoQuotationCard({
  quote, requirementTitle, requirementId,
  onAccept, onReject, onRevise, onCounterOffer,
}: Props) {
  const [counterOpen, setCounterOpen] = useState(false);
  const [counterPrice, setCounterPrice] = useState('');
  const [counterMsg, setCounterMsg] = useState('');
  const [reviseOpen, setReviseOpen] = useState(false);
  const [reviseNotes, setReviseNotes] = useState('');
  const [busy, setBusy] = useState<'accept' | 'reject' | 'revise' | 'counter' | null>(null);

  const statusCfg = STATUS_CONFIG[quote.status] ?? STATUS_CONFIG.sent;
  const isFinal = ['accepted', 'rejected', 'expired'].includes(quote.status);
  const supplierName = quote.companies?.company_name ?? 'Supplier';
  const isVerified = quote.companies?.verification_status === 'verified';

  const handleAccept = async () => {
    setBusy('accept'); await onAccept(quote.id); setBusy(null);
  };
  const handleReject = async () => {
    setBusy('reject'); await onReject(quote.id); setBusy(null);
  };
  const handleRevise = async () => {
    if (!reviseNotes.trim()) { toast.error('Please describe what changes you need'); return; }
    setBusy('revise');
    await onRevise(quote.id, reviseNotes.trim());
    setBusy(null); setReviseOpen(false); setReviseNotes('');
  };
  const handleCounterOffer = async () => {
    const price = parseFloat(counterPrice);
    if (!counterPrice || isNaN(price) || price <= 0) {
      toast.error('Enter a valid counter-offer total amount'); return;
    }
    if (price >= quote.total_amount) {
      toast.error('Counter-offer should be lower than the quoted total'); return;
    }
    setBusy('counter');
    await onCounterOffer(quote.id, price, counterMsg.trim());
    setBusy(null); setCounterOpen(false); setCounterPrice(''); setCounterMsg('');
  };

  const handleDownload = () => {
    const lines = [
      '========================================',
      '       QUOTATION — BULKSKART',
      '========================================',
      `Supplier       : ${supplierName}`,
      `Requirement ID : ${requirementId.slice(0, 8).toUpperCase()}`,
      `Product        : ${quote.product_name}`,
      quote.product_specs ? `Specifications : ${quote.product_specs}` : '',
      `Quantity       : ${quote.quantity} ${quote.quantity_unit}`,
      `Unit Price     : ${fmt(quote.unit_price, quote.currency)}`,
      `MOQ            : ${quote.moq} ${quote.moq_unit}`,
      '----------------------------------------',
      `Subtotal       : ${fmt(quote.subtotal, quote.currency)}`,
      `Shipping       : ${fmt(quote.shipping_cost, quote.currency)}`,
      `Tax (GST)      : ${fmt(quote.tax_amount, quote.currency)}`,
      quote.other_charges > 0 ? `Other Charges  : ${fmt(quote.other_charges, quote.currency)}` : '',
      `TOTAL AMOUNT   : ${fmt(quote.total_amount, quote.currency)}`,
      quote.counter_offer_price
        ? `COUNTER OFFER  : ${fmt(quote.counter_offer_price, quote.currency)} (by buyer)`
        : '',
      '----------------------------------------',
      quote.estimated_delivery_date
        ? `Est. Delivery  : ${new Date(quote.estimated_delivery_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
        : '',
      `Valid Until    : ${quote.valid_until ? new Date(quote.valid_until).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : `${quote.validity_days} days`}`,
      quote.payment_terms ? `Payment Terms  : ${quote.payment_terms}` : '',
      quote.terms_and_conditions ? `\nTerms & Conditions:\n${quote.terms_and_conditions}` : '',
      '========================================',
      `Auto-generated on ${new Date(quote.created_at).toLocaleDateString('en-IN')}`,
    ].filter(Boolean).join('\n');

    const blob = new Blob([lines], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Quotation_${supplierName.replace(/\s+/g, '_')}_${requirementId.slice(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`bg-card border rounded-xl overflow-hidden transition-shadow hover:shadow-md ${
      quote.status === 'accepted' ? 'border-[#FF5A00]/50' :
      quote.status === 'rejected' ? 'border-[#FF5A00]/50' :
      quote.status === 'revised_requested' ? 'border-[#FF5A00]/50' :
      'border-border'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Building2 className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-sm font-bold text-foreground truncate">{supplierName}</p>
              {isVerified && (
                <span className="flex items-center gap-0.5 text-[10px] font-bold text-primary bg-primary/10 rounded-full px-1.5 py-0.5">
                  <ShieldCheck className="w-2.5 h-2.5" /> Verified
                </span>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground">
              {new Date(quote.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {quote.is_auto_generated && (
            <span className="flex items-center gap-1 text-[9px] font-bold text-primary bg-primary/10 border border-primary/20 rounded-full px-1.5 py-0.5">
              <Zap className="w-2.5 h-2.5" /> AUTO
            </span>
          )}
          <Badge className={`text-[10px] border flex items-center gap-1 ${statusCfg.color}`}>
            {statusCfg.icon} {statusCfg.label}
          </Badge>
        </div>
      </div>

      {/* Product info */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-start gap-2 mb-2">
          <Package className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-foreground">{quote.product_name}</p>
            {quote.product_specs && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{quote.product_specs}</p>
            )}
          </div>
        </div>

        {/* Pricing breakdown */}
        <div className="bg-muted/30 rounded-lg border border-border p-3 space-y-1.5 mt-3">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Unit Price × {quote.quantity} {quote.quantity_unit}</span>
            <span className="font-medium text-foreground">{fmt(quote.unit_price, quote.currency)} × {quote.quantity}</span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Subtotal</span><span>{fmt(quote.subtotal, quote.currency)}</span>
          </div>
          {quote.shipping_cost > 0 && (
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Shipping</span><span>+ {fmt(quote.shipping_cost, quote.currency)}</span>
            </div>
          )}
          {quote.tax_amount > 0 && (
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Tax (GST)</span><span>+ {fmt(quote.tax_amount, quote.currency)}</span>
            </div>
          )}
          {quote.other_charges > 0 && (
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Other Charges</span><span>+ {fmt(quote.other_charges, quote.currency)}</span>
            </div>
          )}
          <div className="border-t border-border pt-1.5 flex justify-between font-bold text-sm">
            <span className="text-foreground">Quoted Total</span>
            <span className={quote.counter_offer_price ? 'line-through text-muted-foreground text-xs self-center' : 'text-primary'}>
              {fmt(quote.total_amount, quote.currency)}
            </span>
          </div>
          {/* Counter offer highlight */}
          {quote.counter_offer_price && (
            <div className="flex justify-between font-bold text-sm bg-[#FF5A00]/10 border border-[#FF5A00]/40 rounded-md px-2 py-1.5 mt-1">
              <span className="flex items-center gap-1.5 text-[#FF7A2E]">
                <ArrowLeftRight className="w-3.5 h-3.5" /> Your Counter Offer
              </span>
              <span className="text-[#FF7A2E]">{fmt(quote.counter_offer_price, quote.currency)}</span>
            </div>
          )}
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap gap-3 mt-3 text-xs text-muted-foreground">
          {quote.moq > 0 && (
            <span className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> MOQ: {quote.moq} {quote.moq_unit}
            </span>
          )}
          {quote.estimated_delivery_date && (
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              Delivery by {new Date(quote.estimated_delivery_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </span>
          )}
          {quote.valid_until && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Valid till {new Date(quote.valid_until).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </span>
          )}
        </div>

        {quote.payment_terms && (
          <p className="text-xs text-muted-foreground mt-1.5">
            <span className="font-medium text-foreground">Payment:</span> {quote.payment_terms}
          </p>
        )}

        {/* Counter offer message */}
        {quote.counter_offer_message && (
          <div className="mt-2 flex items-start gap-1.5 text-xs text-[#FF7A2E] bg-[#FF5A00]/10 border border-[#FF5A00]/40 rounded px-2 py-1.5">
            <MessageSquare className="w-3 h-3 shrink-0 mt-0.5" />
            <span>{quote.counter_offer_message}</span>
          </div>
        )}

        {/* Buyer notes (revision requests) */}
        {quote.buyer_notes && !quote.counter_offer_message && (
          <div className="mt-2 flex items-start gap-1.5 text-xs text-[#FF7A2E] bg-[#FF5A00]/10 border border-[#FF5A00]/40 rounded px-2 py-1.5">
            <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
            <span>{quote.buyer_notes}</span>
          </div>
        )}
      </div>

      {/* Actions — active quote */}
      {!isFinal && quote.status === 'sent' && (
        <div className="px-4 pb-4 flex flex-wrap gap-2">
          <Button size="sm" onClick={handleAccept} disabled={!!busy}
            className="h-8 text-xs bg-[#B33D00] hover:bg-[#B33D00] text-white gap-1.5">
            {busy === 'accept' ? <RefreshCw className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
            Accept
          </Button>
          <Button size="sm" onClick={handleReject} disabled={!!busy} variant="outline"
            className="h-8 text-xs border-[#FF5A00]/40 text-[#FF7A2E] hover:bg-[#B33D00]/10 gap-1.5">
            {busy === 'reject' ? <RefreshCw className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
            Reject
          </Button>
          {/* Counter Offer — primary negotiate action */}
          <Button size="sm" onClick={() => setCounterOpen(true)} disabled={!!busy}
            className="h-8 text-xs bg-[#B33D00] hover:bg-[#B33D00] text-white gap-1.5">
            <ArrowLeftRight className="w-3 h-3" /> Counter Offer
          </Button>
          <Button size="sm" onClick={() => setReviseOpen(true)} disabled={!!busy} variant="outline"
            className="h-8 text-xs gap-1.5">
            <RefreshCw className="w-3 h-3" /> Request Revision
          </Button>
          <Button size="sm" onClick={handleDownload} variant="ghost"
            className="h-8 text-xs gap-1.5 text-muted-foreground">
            <Download className="w-3 h-3" /> Download
          </Button>
        </div>
      )}

      {/* Actions — counter offer sent, waiting supplier */}
      {quote.status === 'revised_requested' && (
        <div className="px-4 pb-4 flex flex-wrap gap-2 items-center">
          <span className="flex items-center gap-1.5 text-xs text-[#FF7A2E] bg-[#FF5A00]/10 border border-[#FF5A00]/40 rounded-full px-3 py-1">
            <ArrowLeftRight className="w-3 h-3" /> Counter offer sent — awaiting supplier response
          </span>
          <Button size="sm" onClick={handleDownload} variant="ghost"
            className="h-8 text-xs gap-1.5 text-muted-foreground ml-auto">
            <Download className="w-3 h-3" /> Download
          </Button>
        </div>
      )}

      {/* Actions — final states */}
      {isFinal && (
        <div className="px-4 pb-4 flex gap-2">
          <Button size="sm" onClick={handleDownload} variant="outline" className="h-8 text-xs gap-1.5">
            <Download className="w-3 h-3" /> Download Quotation
          </Button>
        </div>
      )}

      {/* ── Counter Offer Dialog ─────────────────────────────────────── */}
      <Dialog open={counterOpen} onOpenChange={setCounterOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground text-sm flex items-center gap-2">
              <ArrowLeftRight className="w-4 h-4 text-[#FF7A2E]" />
              Make a Counter Offer
            </DialogTitle>
          </DialogHeader>

          {/* Original quote summary */}
          <div className="bg-muted/30 border border-border rounded-lg p-3 text-xs space-y-1 mb-1">
            <div className="flex justify-between text-muted-foreground">
              <span>Supplier quoted total</span>
              <span className="font-bold text-foreground">{fmt(quote.total_amount, quote.currency)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Unit price</span>
              <span>{fmt(quote.unit_price, quote.currency)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Quantity</span>
              <span>{quote.quantity} {quote.quantity_unit}</span>
            </div>
          </div>

          {/* Counter price input */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5" />
              Your Counter-Offer Total ({quote.currency}) <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">₹</span>
              <Input
                type="number"
                min={1}
                step="0.01"
                value={counterPrice}
                onChange={e => setCounterPrice(e.target.value)}
                placeholder={`e.g. ${Math.round(quote.total_amount * 0.9).toLocaleString('en-IN')}`}
                className="bg-input border-border h-10 text-sm pl-7"
                autoFocus
              />
            </div>
            {counterPrice && !isNaN(parseFloat(counterPrice)) && parseFloat(counterPrice) > 0 && (
              <p className={`text-xs font-medium ${parseFloat(counterPrice) < quote.total_amount ? 'text-[#FF7A2E]' : 'text-destructive'}`}>
                {parseFloat(counterPrice) < quote.total_amount
                  ? `${fmt(quote.total_amount - parseFloat(counterPrice), quote.currency)} savings (${((1 - parseFloat(counterPrice) / quote.total_amount) * 100).toFixed(1)}% off)`
                  : 'Counter offer must be lower than the quoted total'}
              </p>
            )}
          </div>

          {/* Optional message */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" />
              Message to supplier <span className="text-muted-foreground/60">(optional)</span>
            </Label>
            <Textarea
              value={counterMsg}
              onChange={e => setCounterMsg(e.target.value)}
              placeholder="e.g. We can offer this price for a long-term contract. Please consider our order volume."
              rows={3}
              className="bg-input border-border text-sm resize-none"
            />
          </div>

          <div className="flex gap-2 mt-1">
            <Button variant="outline" className="flex-1 h-9 text-xs" onClick={() => { setCounterOpen(false); setCounterPrice(''); setCounterMsg(''); }}>
              Cancel
            </Button>
            <Button
              onClick={handleCounterOffer}
              disabled={busy === 'counter' || !counterPrice || parseFloat(counterPrice) >= quote.total_amount}
              className="flex-1 h-9 text-xs bg-[#B33D00] hover:bg-[#B33D00] text-white gap-1.5"
            >
              {busy === 'counter'
                ? <><RefreshCw className="w-3 h-3 animate-spin" /> Sending…</>
                : <><ArrowLeftRight className="w-3 h-3" /> Send Counter Offer</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Revision request dialog ──────────────────────────────────── */}
      <Dialog open={reviseOpen} onOpenChange={setReviseOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground text-sm">Request Revised Quotation</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground mb-3">
            Describe what changes you need — the supplier will be notified.
          </p>
          <Textarea
            value={reviseNotes}
            onChange={e => setReviseNotes(e.target.value)}
            placeholder="e.g. Please reduce the unit price, increase delivery window, or adjust payment terms…"
            rows={4}
            className="bg-input border-border text-sm resize-none"
          />
          <div className="flex gap-2 mt-2">
            <Button variant="outline" className="flex-1 h-9 text-xs" onClick={() => setReviseOpen(false)}>Cancel</Button>
            <Button onClick={handleRevise} disabled={busy === 'revise'}
              className="flex-1 h-9 text-xs bg-[#C94400] text-primary-foreground">
              {busy === 'revise' ? <RefreshCw className="w-3 h-3 animate-spin mr-1" /> : null}
              Send Request
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
