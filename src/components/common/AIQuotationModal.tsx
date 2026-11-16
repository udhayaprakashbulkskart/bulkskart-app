import React, { useEffect, useId, useState } from 'react';
import { Box, Clock, Edit3, Eye, FileText, Handshake, IndianRupee, Loader2, Package, Send, ShieldCheck, Sparkles, Truck } from 'lucide-react';
import { toast } from 'sonner';
import {
  Actions,
  Callout,
  CountedTextArea,
  DELIVERY_TERMS,
  EntityCard,
  Field,
  FormDialog,
  IconBox,
  KitButton,
  NativeSelect,
  PAYMENT_TERMS,
  SectionTitle,
  Stepper,
  TextInput,
  optionsWith,
  type EntityMeta,
  type FormPoint,
} from '@/components/formkit';
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

const POINTS: FormPoint[] = [
  { icon: Sparkles, title: 'Started from your catalogue', detail: 'Your product price and MOQ' },
  { icon: Eye, title: 'You check it first', detail: 'Nothing is sent until you confirm' },
  { icon: Send, title: 'Goes to the buyer', detail: 'As a quotation on their requirement' },
];

interface QuoteForm {
  unitPrice: string;
  quantity: string;
  moq: string;
  deliveryDays: string;
  paymentTerms: string;
  deliveryTerms: string;
  notes: string;
}

const positive = (value: number | null | undefined) => (value && value > 0 ? String(value) : '');

function fromDraft(draft: AIQuotationDraft | null, requirement: Requirement | null): QuoteForm {
  return {
    unitPrice: positive(draft?.unitPrice),
    quantity: positive(draft?.quantity || Number(requirement?.quantity)),
    moq: positive(draft?.moq),
    deliveryDays: positive(draft?.deliveryDays),
    paymentTerms: draft?.paymentTerms ?? '',
    deliveryTerms: draft?.deliveryTerms ?? '',
    notes: draft?.notes ?? '',
  };
}

const rupees = (value: number) => `₹${Math.round(value).toLocaleString('en-IN')}`;

/**
 * A quotation drafted from the supplier's own catalogue. The supplier checks every value on a read-back screen and
 * only then sends it; nothing goes to the buyer without that confirmation.
 */
export default function AIQuotationModal({ open, onOpenChange, requirement, product, initialDraft, onSuccess, onRequireSubscription }: AIQuotationModalProps) {
  const { user, company } = useAuth();
  const ids = useId();
  const [form, setForm] = useState<QuoteForm>(() => fromDraft(initialDraft, requirement));
  const [errors, setErrors] = useState<{ price?: string; quantity?: string }>({});
  const [isPreview, setIsPreview] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // a new draft (another requirement or product) starts the form again
  useEffect(() => {
    if (initialDraft) {
      setForm(fromDraft(initialDraft, requirement));
      setErrors({});
      setIsPreview(false);
    }
  }, [initialDraft, requirement]);

  if (!requirement) return null;

  const set = (key: keyof QuoteForm, value: string) => setForm((prev) => ({ ...prev, [key]: value }));
  const unit = initialDraft?.moqUnit || requirement.quantity_unit || 'Pieces';
  const numPrice = Number(form.unitPrice) || 0;
  const numQty = Number(form.quantity) || 0;
  const totalCalculated = numPrice * numQty;
  const requested = Number(requirement.quantity) || 0;

  const priceHint =
    initialDraft?.priceSource === 'catalogue' && form.unitPrice === positive(initialDraft.unitPrice)
      ? 'From your catalogue price. Change it if this order needs a different price.'
      : initialDraft?.priceSource === 'buyer' && form.unitPrice === positive(initialDraft.unitPrice)
        ? "From the buyer's target price or budget. Check it before you send."
        : `Your price for one ${unit.toLowerCase()}.`;

  const meta: EntityMeta[] = [];
  if (requested > 0) meta.push({ icon: Box, children: `Needs ${requested.toLocaleString('en-IN')} ${requirement.quantity_unit || unit}` });
  if (product) meta.push({ icon: Sparkles, children: `${product.matchScore}% match` });

  const handleValidateAndPreview = (e: React.FormEvent) => {
    e.preventDefault();
    const found: typeof errors = {};
    if (numPrice <= 0) found.price = 'Please enter a unit price greater than 0.';
    if (numQty <= 0) found.quantity = 'Please enter the quantity you are quoting for.';
    setErrors(found);
    if (found.price || found.quantity) {
      document.getElementById(found.price ? `${ids}-price` : `${ids}-qty`)?.focus();
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
        moq: Number(form.moq) || 1,
        moq_unit: unit,
        delivery_days: Number(form.deliveryDays) || null,
        payment_terms: form.paymentTerms || null,
        delivery_terms: form.deliveryTerms || null,
        notes: form.notes.trim() || null,
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

      toast.success('Quotation sent to the buyer.');
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
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      busy={isSubmitting}
      title={
        isPreview ? (
          <>
            Check & <em>Send Quote</em>
          </>
        ) : (
          <>
            AI <em>Quotation</em>
          </>
        )
      }
      description={
        isPreview
          ? 'This is exactly what the buyer will receive. Nothing is sent until you confirm.'
          : 'Drafted from your catalogue for this requirement. Change anything before you send it.'
      }
      points={POINTS}
      sheetArt="quote"
      width={1040}
    >
      <div className="fk-stack">
        <EntityCard
          image={product?.image}
          fallbackIcon={Package}
          name={requirement.title}
          byLabel={product ? 'Your product:' : 'Requirement'}
          by={product?.name}
          meta={meta}
        />

        {!isPreview ? (
          <form onSubmit={handleValidateAndPreview} noValidate className="fk-form fk-stack">
            <SectionTitle>Your Quote</SectionTitle>

            <div className="fk-grid">
              <Field htmlFor={`${ids}-price`} label={`Unit Price (₹ per ${unit})`} required error={errors.price} hint={priceHint}>
                <IconBox icon={IndianRupee} accent>
                  <TextInput
                    id={`${ids}-price`}
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="any"
                    value={form.unitPrice}
                    onChange={(e) => {
                      set('unitPrice', e.target.value);
                      setErrors((prev) => ({ ...prev, price: undefined }));
                    }}
                    placeholder="e.g. 250"
                    invalid={Boolean(errors.price)}
                    aria-describedby={errors.price ? `${ids}-price-error` : `${ids}-price-hint`}
                    iconPadding
                  />
                </IconBox>
              </Field>
              <Field htmlFor={`${ids}-qty`} label={`Quantity (${unit})`} required error={errors.quantity}>
                <Stepper
                  id={`${ids}-qty`}
                  value={form.quantity}
                  onChange={(value) => {
                    set('quantity', value);
                    setErrors((prev) => ({ ...prev, quantity: undefined }));
                  }}
                  min={1}
                  unitName={unit}
                  invalid={Boolean(errors.quantity)}
                  describedBy={errors.quantity ? `${ids}-qty-error` : undefined}
                  required
                />
              </Field>
              <Field htmlFor={`${ids}-moq`} label="Minimum Order (MOQ)" optional>
                <Stepper id={`${ids}-moq`} value={form.moq} onChange={(value) => set('moq', value)} min={1} unitName={`MOQ ${unit}`} />
              </Field>
              <Field htmlFor={`${ids}-days`} label="Delivery Time (days)" optional>
                <IconBox icon={Clock}>
                  <TextInput
                    id={`${ids}-days`}
                    type="number"
                    inputMode="numeric"
                    min="1"
                    value={form.deliveryDays}
                    onChange={(e) => set('deliveryDays', e.target.value)}
                    placeholder="e.g. 15"
                    iconPadding
                  />
                </IconBox>
              </Field>
              <Field htmlFor={`${ids}-payment`} label="Payment Terms" optional>
                <IconBox icon={Handshake}>
                  <NativeSelect id={`${ids}-payment`} value={form.paymentTerms} onChange={(e) => set('paymentTerms', e.target.value)} iconPadding>
                    <option value="">Select…</option>
                    {optionsWith(PAYMENT_TERMS, form.paymentTerms).map((term) => (
                      <option key={term} value={term}>
                        {term}
                      </option>
                    ))}
                  </NativeSelect>
                </IconBox>
              </Field>
              <Field htmlFor={`${ids}-delivery`} label="Delivery Terms" optional>
                <IconBox icon={Truck}>
                  <NativeSelect id={`${ids}-delivery`} value={form.deliveryTerms} onChange={(e) => set('deliveryTerms', e.target.value)} iconPadding>
                    <option value="">Select…</option>
                    {optionsWith(DELIVERY_TERMS, form.deliveryTerms).map((term) => (
                      <option key={term} value={term}>
                        {term}
                      </option>
                    ))}
                  </NativeSelect>
                </IconBox>
              </Field>
            </div>

            <Field htmlFor={`${ids}-notes`} label="Notes for the Buyer" optional>
              <CountedTextArea
                id={`${ids}-notes`}
                icon={FileText}
                rows={3}
                maxLength={1000}
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
                placeholder="Specifications, packaging, inspection, what the price includes…"
              />
            </Field>

            <div className="fk-total" aria-live="polite">
              <span>Estimated total</span>
              <b>{totalCalculated > 0 ? rupees(totalCalculated) : '—'}</b>
            </div>

            <Actions>
              <KitButton type="submit">
                <Eye aria-hidden="true" /> Preview Quote
              </KitButton>
              <KitButton variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </KitButton>
            </Actions>
          </form>
        ) : (
          <>
            <SectionTitle>Your Quote</SectionTitle>
            <dl className="fk-summary">
              <div className="is-total">
                <dt>Total</dt>
                <dd>{rupees(totalCalculated)}</dd>
              </div>
              <div>
                <dt>Unit price</dt>
                <dd>
                  {rupees(numPrice)} / {unit}
                </dd>
              </div>
              <div>
                <dt>Quantity</dt>
                <dd>
                  {numQty.toLocaleString('en-IN')} {unit}
                </dd>
              </div>
              {Number(form.moq) > 0 && (
                <div>
                  <dt>MOQ</dt>
                  <dd>
                    {Number(form.moq).toLocaleString('en-IN')} {unit}
                  </dd>
                </div>
              )}
              {Number(form.deliveryDays) > 0 && (
                <div>
                  <dt>Delivery time</dt>
                  <dd>{Number(form.deliveryDays)} days</dd>
                </div>
              )}
              {form.paymentTerms && (
                <div>
                  <dt>Payment terms</dt>
                  <dd>{form.paymentTerms}</dd>
                </div>
              )}
              {form.deliveryTerms && (
                <div>
                  <dt>Delivery terms</dt>
                  <dd>{form.deliveryTerms}</dd>
                </div>
              )}
              {form.notes.trim() && (
                <div className="is-block">
                  <dt>Notes</dt>
                  <dd>{form.notes.trim()}</dd>
                </div>
              )}
            </dl>

            <Callout icon={ShieldCheck}>When you press Confirm & Send, this quotation goes to the buyer.</Callout>

            <Actions>
              <KitButton onClick={handleConfirmAndSendQuote} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
                {isSubmitting ? 'Sending…' : 'Confirm & Send Quote'}
              </KitButton>
              <KitButton variant="ghost" onClick={() => setIsPreview(false)} disabled={isSubmitting}>
                <Edit3 aria-hidden="true" /> Edit
              </KitButton>
            </Actions>
          </>
        )}
      </div>
    </FormDialog>
  );
}
