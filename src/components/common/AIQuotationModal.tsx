import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Send, CheckCircle2, AlertCircle, ArrowRight, ShieldCheck, Eye, Edit3, Building2, Package, Lock } from 'lucide-react';
import { toast } from 'sonner';
import type { Requirement } from '@/types/types';
import type { AIQuotationDraft, MatchedProduct } from '@/lib/aiSalesAssistant';
import { useAuth } from '@/contexts/AuthContext';
import { createQuotation, checkSupplierPaidSubscription } from '@/lib/api';

interface AIQuotationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requirement: Requirement | null;
  product?: MatchedProduct | null;
  initialDraft: AIQuotationDraft | null;
  onSuccess?: () => void;
  onRequireSubscription?: () => void;
}

export default function AIQuotationModal({
  open,
  onOpenChange,
  requirement,
  product,
  initialDraft,
  onSuccess,
  onRequireSubscription,
}: AIQuotationModalProps) {
  const { user, company } = useAuth();

  // Editable fields with human-in-the-loop confirmation
  const [unitPrice, setUnitPrice] = useState<string>(initialDraft?.unitPrice ? String(initialDraft.unitPrice) : '250');
  const [moq, setMoq] = useState<string>(initialDraft?.moq ? String(initialDraft.moq) : '500');
  const [quantity, setQuantity] = useState<string>(initialDraft?.quantity ? String(initialDraft.quantity) : String(requirement?.quantity || 1000));
  const [deliveryDays, setDeliveryDays] = useState<string>(initialDraft?.deliveryDays ? String(initialDraft.deliveryDays) : '15');
  const [notes, setNotes] = useState<string>(initialDraft?.notes || 'Direct factory quotation with pre-dispatch inspection and export grade packaging.');
  const [paymentTerms, setPaymentTerms] = useState<string>(initialDraft?.paymentTerms || '30% Advance, 70% against BL/Dispatch');
  const [deliveryTerms, setDeliveryTerms] = useState<string>(initialDraft?.deliveryTerms || 'FOB Origin Port / Door Delivery Options');

  // Preview stage state
  const [isPreview, setIsPreview] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync draft when opened with new draft
  React.useEffect(() => {
    if (initialDraft) {
      setUnitPrice(String(initialDraft.unitPrice || 250));
      setMoq(String(initialDraft.moq || 500));
      setQuantity(String(initialDraft.quantity || requirement?.quantity || 1000));
      setDeliveryDays(String(initialDraft.deliveryDays || 15));
      setNotes(initialDraft.notes || 'Direct factory quotation with pre-dispatch inspection and export grade packaging.');
      setPaymentTerms(initialDraft.paymentTerms || '30% Advance, 70% against BL/Dispatch');
      setDeliveryTerms(initialDraft.deliveryTerms || 'FOB Origin Port');
      setIsPreview(false);
    }
  }, [initialDraft, requirement]);

  if (!requirement) return null;

  const numPrice = Number(unitPrice) || 0;
  const numQty = Number(quantity) || 0;
  const totalCalculated = numPrice * numQty;

  const handleValidateAndPreview = (e: React.FormEvent) => {
    e.preventDefault();
    if (numPrice <= 0) {
      toast.error('Please enter a valid unit price greater than 0');
      return;
    }
    if (numQty <= 0) {
      toast.error('Please enter a valid quotation quantity');
      return;
    }
    setIsPreview(true);
  };

  const handleConfirmAndSendQuote = async () => {
    if (!user) {
      toast.error('Please log in as a verified manufacturer to send quotes');
      onRequireSubscription?.();
      return;
    }

    // Backend active subscription check before sending quote
    if (company) {
      const subCheck = await checkSupplierPaidSubscription(company.id, company);
      if (!subCheck.allowed) {
        toast.error('Active paid subscription (Starter ₹2,500, Business ₹7,500, or Growth ₹15,000) required to send quotations.');
        onOpenChange(false);
        onRequireSubscription?.();
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const res = await createQuotation({
        requirement_id: requirement.id,
        supplier_id: user.id,
        supplier_company_id: (company as any)?.id || '',
        buyer_id: requirement.buyer_id || user.id,
        unit_price: numPrice,
        currency: 'INR',
        moq: Number(moq) || 100,
        moq_unit: initialDraft?.moqUnit || requirement.quantity_unit || 'Pieces',
        delivery_days: Number(deliveryDays) || 15,
        payment_terms: paymentTerms,
        delivery_terms: deliveryTerms,
        notes,
        total_price: totalCalculated,
        status: 'pending',
      });

      if (res?.error) {
        toast.error(res.error);
        if (res.error.includes('subscription')) {
          onOpenChange(false);
          onRequireSubscription?.();
        }
        return;
      }

      toast.success('Quotation proposal submitted successfully to buyer!');
      onOpenChange(false);
      setIsPreview(false);
      onSuccess?.();
    } catch (err: any) {
      console.error('Failed to submit quote:', err);
      toast.error(err?.message || 'Failed to submit quotation. Please check your subscription.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-1.5rem)] md:max-w-xl bg-card border-border text-foreground p-3.5 sm:p-6 rounded-2xl max-h-[92dvh] overflow-y-auto">
        <DialogHeader className="space-y-1.5 text-left">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-[#FF5A00]/15 text-[#FF5A00] shrink-0">
              <Sparkles className="w-4 h-4" />
            </span>
            <DialogTitle className="text-base sm:text-lg font-black text-foreground leading-tight">
              {isPreview ? 'Review & Confirm Quotation' : 'AI Quotation Generator'}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
            {isPreview
              ? 'Please verify quote parameters before transmission. Quotations are never sent automatically without your explicit confirmation.'
              : `Auto-drafted from your catalogue specs for "${requirement.title}". You have complete control to edit all values.`}
          </DialogDescription>
        </DialogHeader>

        {/* Requirement & Matched Product Context */}
        <div className="bg-muted/40 border border-border rounded-xl p-3 sm:p-3.5 space-y-2 mt-1">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-1">
            <span className="text-muted-foreground shrink-0">Target Requirement:</span>
            <span className="font-bold text-foreground min-w-0 sm:text-right truncate">{requirement.title}</span>
          </div>
          {product && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs border-t border-border pt-1.5 gap-1">
              <span className="text-muted-foreground shrink-0">Matched Catalog Item:</span>
              <span className="font-semibold text-[#FF7A2E] dark:text-[#FF7A2E] min-w-0 sm:text-right truncate flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{product.name} ({product.matchScore}% Match)</span>
              </span>
            </div>
          )}
          <div className="flex items-center justify-between text-xs border-t border-border pt-1.5">
            <span className="text-muted-foreground">Requested Volume:</span>
            <span className="font-bold text-foreground">
              {(Number(requirement.quantity) || 1000).toLocaleString()} {requirement.quantity_unit || 'Units'}
            </span>
          </div>
        </div>

        {/* STAGE 1: EDITABLE FORM */}
        {!isPreview ? (
          <form onSubmit={handleValidateAndPreview} className="space-y-3.5 sm:space-y-4 mt-2">
            {/* Price & Quantity */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
              <div className="space-y-1">
                <Label className="text-xs text-foreground font-semibold">Unit Price (INR / ₹) *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-xs pointer-events-none">₹</span>
                  <Input
                    type="number"
                    min="1"
                    step="any"
                    required
                    value={unitPrice}
                    onChange={e => setUnitPrice(e.target.value)}
                    className="pl-7 bg-card border-border text-foreground h-11 text-xs rounded-xl focus:border-[#FF5A00]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-foreground font-semibold">Quotation Quantity *</Label>
                <Input
                  type="number"
                  min="1"
                  required
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                  className="bg-card border-border text-foreground h-11 text-xs rounded-xl focus:border-[#FF5A00]"
                />
              </div>
            </div>

            {/* MOQ and Lead Days */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
              <div className="space-y-1">
                <Label className="text-xs text-foreground font-semibold">Minimum Order Quantity (MOQ)</Label>
                <Input
                  type="number"
                  min="1"
                  value={moq}
                  onChange={e => setMoq(e.target.value)}
                  className="bg-card border-border text-foreground h-11 text-xs rounded-xl focus:border-[#FF5A00]"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-foreground font-semibold">Delivery Timeline (Days)</Label>
                <Input
                  type="number"
                  min="1"
                  value={deliveryDays}
                  onChange={e => setDeliveryDays(e.target.value)}
                  className="bg-card border-border text-foreground h-11 text-xs rounded-xl focus:border-[#FF5A00]"
                />
              </div>
            </div>

            {/* Terms */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
              <div className="space-y-1">
                <Label className="text-xs text-foreground font-semibold">Payment Terms</Label>
                <Input
                  value={paymentTerms}
                  onChange={e => setPaymentTerms(e.target.value)}
                  className="bg-card border-border text-foreground h-11 text-xs rounded-xl focus:border-[#FF5A00]"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-foreground font-semibold">Incoterms / Delivery</Label>
                <Input
                  value={deliveryTerms}
                  onChange={e => setDeliveryTerms(e.target.value)}
                  className="bg-card border-border text-foreground h-11 text-xs rounded-xl focus:border-[#FF5A00]"
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <Label className="text-xs text-foreground font-semibold">Manufacturer Notes & Specifications</Label>
              <Textarea
                rows={3}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="bg-card border-border text-foreground text-xs rounded-xl focus:border-[#FF5A00] p-3 leading-relaxed"
              />
            </div>

            {/* Total value display */}
            <div className="bg-muted/40 p-3 sm:p-3.5 rounded-xl border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="text-xs text-muted-foreground">Estimated Total Proposal Value:</span>
              <span className="text-base sm:text-lg font-black text-[#FF5A00]">
                ₹{Math.round(totalCalculated).toLocaleString('en-IN')}
              </span>
            </div>

            {/* Actions */}
            <div className="flex flex-col-reverse sm:flex-row gap-2.5 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="w-full sm:flex-1 border border-white/15 text-white hover:bg-white/10 h-11 rounded-xl text-xs font-semibold"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="w-full sm:flex-1 bg-[#C94400] hover:bg-[#B33D00] text-white font-extrabold text-xs h-11 rounded-xl shadow-[0_2px_12px_rgba(255,90,0,0.4)] gap-1.5"
              >
                <Eye className="w-4 h-4" />
                <span>Preview Quote →</span>
              </Button>
            </div>
          </form>
        ) : (
          /* STAGE 2: CONFIRMATION PREVIEW */
          <div className="space-y-3.5 sm:space-y-4 mt-2">
            <div className="border border-[#FF5A00]/40 bg-[#161320] rounded-xl p-3.5 sm:p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/10 pb-2.5 gap-2">
                <div>
                  <span className="text-[10px] text-white/50 block">PROPOSAL TOTAL</span>
                  <span className="text-lg sm:text-xl font-black text-[#FF5A00]">
                    ₹{Math.round(totalCalculated).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="sm:text-right">
                  <span className="text-[10px] text-white/50 block">UNIT RATE</span>
                  <span className="text-sm font-bold text-white">
                    ₹{numPrice.toLocaleString('en-IN')} / unit
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="flex justify-between sm:block">
                  <span className="text-white/50 sm:block">Volume:</span>
                  <span className="font-semibold text-white">{numQty.toLocaleString()} units</span>
                </div>
                <div className="flex justify-between sm:block">
                  <span className="text-white/50 sm:block">MOQ:</span>
                  <span className="font-semibold text-white">{moq} units</span>
                </div>
                <div className="flex justify-between sm:block">
                  <span className="text-white/50 sm:block">Delivery Time:</span>
                  <span className="font-semibold text-white">{deliveryDays} business days</span>
                </div>
                <div className="flex justify-between sm:block">
                  <span className="text-white/50 sm:block">Incoterms:</span>
                  <span className="font-semibold text-white truncate">{deliveryTerms}</span>
                </div>
              </div>

              <div className="text-xs pt-1 border-t border-white/5">
                <span className="text-white/50 block mb-0.5">Payment Terms:</span>
                <span className="font-medium text-white/90">{paymentTerms}</span>
              </div>

              <div className="text-xs pt-1 border-t border-white/5">
                <span className="text-white/50 block mb-0.5">Manufacturer Notes:</span>
                <p className="text-white/80 text-xs italic bg-[#0A0A0A]/20 p-2.5 rounded-lg break-words">{notes}</p>
              </div>
            </div>

            <div className="p-3 bg-[#FF5A00]/10 border border-[#FF5A00]/30 rounded-xl flex items-center gap-2.5 text-xs text-[#FF7A2E]">
              <ShieldCheck className="w-4 h-4 shrink-0 text-[#FF7A2E]" />
              <span className="leading-relaxed">
                Confirmation Guard: By clicking Send Quote, you confirm this formal offer will be submitted to the buyer procurement desk.
              </span>
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-2.5 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsPreview(false)}
                className="w-full sm:flex-1 border border-white/15 text-white hover:bg-white/10 h-11 rounded-xl text-xs font-semibold gap-1.5"
              >
                <Edit3 className="w-4 h-4" />
                <span>Edit Parameters</span>
              </Button>
              <Button
                type="button"
                onClick={handleConfirmAndSendQuote}
                disabled={isSubmitting}
                className="w-full sm:flex-1 bg-[#C94400] hover:bg-[#B33D00] text-white font-extrabold text-xs h-11 rounded-xl shadow-[0_2px_12px_rgba(255,90,0,0.4)] gap-1.5"
              >
                <Send className="w-4 h-4" />
                <span>{isSubmitting ? 'Sending...' : 'Confirm & Send Quote'}</span>
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
