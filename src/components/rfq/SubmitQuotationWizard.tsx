import React, { useEffect, useId, useState } from 'react';
import { BadgeIndianRupee, Box, Calendar, Clock, Edit3, Eye, FileText, Handshake, IndianRupee, Loader2, MapPin, Package, Paperclip, Percent, Send, ShieldCheck, Target, Truck, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import { createQuotation } from '@/lib/api';
import type { Quotation } from '@/types/types';
import {
  Actions,
  Callout,
  CountedTextArea,
  Done,
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
  type EntityMeta,
  type FormPoint,
} from '@/components/formkit';

export interface SubmitQuotationWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rfq: {
    id: string;
    reqNumber?: string;
    title: string;
    quantity: number;
    quantityUnit: string;
    /** the buyer's budget per unit, when they gave one */
    targetPriceMin?: number | null;
    targetPriceMax?: number | null;
    deliveryLocation?: string;
    /** the date the buyer needs it by */
    deadline?: string | null;
    image?: string | null;
  };
  onSuccess?: () => void;
}

const GST_RATES = [0, 5, 12, 18, 28];

const POINTS: FormPoint[] = [
  { icon: BadgeIndianRupee, title: 'Your price and costs', detail: 'Freight, packing and GST shown apart' },
  { icon: Eye, title: 'Check it before it goes', detail: 'A full read-back first' },
  { icon: Send, title: 'Straight to the buyer', detail: 'As a quotation on this RFQ' },
];

const rupees = (value: number) => `₹${Math.round(value).toLocaleString('en-IN')}`;
const amount = (value: string) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/**
 * A supplier's quotation on a buyer's RFQ: price, quantity and costs, then a read-back, then it is sent. Nothing is
 * filled in for the supplier except the buyer's quantity and the usual 18% GST, which they can change.
 */
export default function SubmitQuotationWizard({ open, onOpenChange, rfq, onSuccess }: SubmitQuotationWizardProps) {
  const { user, profile, company } = useAuth();
  const ids = useId();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [unitPrice, setUnitPrice] = useState('');
  const [quantity, setQuantity] = useState(String(rfq.quantity || ''));
  const [moq, setMoq] = useState('');
  const [leadDays, setLeadDays] = useState('');
  const [freight, setFreight] = useState('');
  const [packaging, setPackaging] = useState('');
  const [taxRate, setTaxRate] = useState('18');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [validity, setValidity] = useState('14');
  const [notes, setNotes] = useState('');
  const [attachments, setAttachments] = useState<Array<{ name: string; url: string }>>([]);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<{ price?: string; quantity?: string; days?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  // a fresh start each time it opens
  useEffect(() => {
    if (open) {
      setStep(1);
      setQuantity(String(rfq.quantity || ''));
      setErrors({});
    }
  }, [open, rfq.id, rfq.quantity]);

  const unit = rfq.quantityUnit || 'Pcs';
  const price = amount(unitPrice);
  const qty = amount(quantity);
  const productSubtotal = price * qty;
  const freightCost = amount(freight);
  const packagingCost = amount(packaging);
  const subtotal = productSubtotal + freightCost + packagingCost;
  const rate = Number(taxRate) || 0;
  const gst = Math.round((subtotal * rate) / 100);
  const total = subtotal + gst;

  const targetMin = Number(rfq.targetPriceMin) || 0;
  const targetMax = Number(rfq.targetPriceMax) || 0;
  const hasTarget = targetMin > 0 || targetMax > 0;
  const targetText = targetMin > 0 && targetMax > 0 ? `${rupees(targetMin)} – ${rupees(targetMax)}` : rupees(targetMax || targetMin);
  const priceHint = !hasTarget
    ? `Your price for one ${unit.toLowerCase()}, before GST.`
    : price <= 0
      ? `The buyer's budget: ${targetText} per unit.`
      : (targetMax > 0 && price > targetMax)
        ? `Above the buyer's budget (${targetText}).`
        : (targetMin > 0 && price < targetMin)
          ? `Below the buyer's budget (${targetText}).`
          : `Within the buyer's budget (${targetText}).`;

  const meta: EntityMeta[] = [];
  if (rfq.quantity) meta.push({ icon: Box, children: `Needs ${Number(rfq.quantity).toLocaleString('en-IN')} ${unit}` });
  if (rfq.deliveryLocation) meta.push({ icon: MapPin, children: rfq.deliveryLocation });
  if (rfq.deadline) meta.push({ icon: Calendar, children: `By ${new Date(rfq.deadline).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}` });
  if (hasTarget) meta.push({ icon: Target, children: `Budget ${targetText}` });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!files.length) return;
    if (!company?.id) {
      toast.error('Files can be added from a supplier account.');
      return;
    }
    setUploading(true);
    const added: Array<{ name: string; url: string }> = [];
    for (const file of files.slice(0, Math.max(0, 5 - attachments.length))) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} is larger than 10 MB`);
        continue;
      }
      const ext = file.name.split('.').pop();
      const path = `supplier-quotes/${company.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { data, error } = await supabase.storage.from('attachments').upload(path, file);
      if (error || !data) {
        toast.error(`${file.name} could not be uploaded`);
        continue;
      }
      added.push({ name: file.name, url: supabase.storage.from('attachments').getPublicUrl(data.path).data.publicUrl });
    }
    setAttachments((prev) => [...prev, ...added]);
    setUploading(false);
  };

  const handleReview = (e: React.FormEvent) => {
    e.preventDefault();
    const found: typeof errors = {};
    if (price <= 0) found.price = 'Please enter a unit price greater than 0.';
    if (qty <= 0) found.quantity = 'Please enter the quantity you are quoting for.';
    if (!(amount(leadDays) > 0)) found.days = 'Please enter how many days delivery takes.';
    setErrors(found);
    const first = found.price ? 'price' : found.quantity ? 'qty' : found.days ? 'days' : null;
    if (first) {
      document.getElementById(`${ids}-${first}`)?.focus();
      return;
    }
    setStep(2);
  };

  const handleSubmit = async () => {
    if (!user || !company?.id) {
      toast.error('Please log in with your supplier account to send quotations.');
      return;
    }
    if (profile?.role !== 'supplier' && (profile?.role as string) !== 'manufacturer' && profile?.role !== 'admin') {
      toast.error('Only supplier accounts can send quotations.');
      return;
    }
    setSubmitting(true);
    // the buyer comes from the saved requirement itself: a quotation can only go to a real, open buyer request
    const { data: saved } = await supabase.from('requirements').select('id, buyer_id').eq('id', rfq.id).maybeSingle();
    const buyerId = (saved as { buyer_id?: string } | null)?.buyer_id ?? null;
    if (!buyerId) {
      setSubmitting(false);
      toast.error('Quotations cannot be sent on this RFQ: it is not an open buyer request on BulkSkart.');
      return;
    }

    const payload = {
      requirement_id: rfq.id,
      supplier_id: user.id,
      supplier_company_id: company.id,
      buyer_id: buyerId,
      unit_price: price,
      currency: 'INR',
      quantity: Math.round(qty),
      moq: Math.round(amount(moq)) || 1,
      moq_unit: unit,
      delivery_days: Math.round(amount(leadDays)),
      validity_days: Math.round(amount(validity)) || 14,
      payment_terms: paymentTerms.trim() || null,
      notes: notes.trim() || null,
      freight_charges: freightCost,
      packaging_charges: packagingCost,
      tax_rate: rate,
      tax_amount: gst,
      subtotal,
      total_price: total,
      total_quotation_value: total,
      attachment_urls: attachments.map((file) => file.url),
      status: 'pending',
      is_draft: false,
    } as unknown as Partial<Quotation>;

    const { error } = await createQuotation(payload);
    setSubmitting(false);
    if (error) {
      toast.error(error);
      return;
    }
    setStep(3);
    onSuccess?.();
  };

  const summary = (
    <dl className="fk-summary">
      <div>
        <dt>
          Product ({qty.toLocaleString('en-IN')} × {rupees(price)})
        </dt>
        <dd>{rupees(productSubtotal)}</dd>
      </div>
      {freightCost > 0 && (
        <div>
          <dt>Freight</dt>
          <dd>{rupees(freightCost)}</dd>
        </div>
      )}
      {packagingCost > 0 && (
        <div>
          <dt>Packaging</dt>
          <dd>{rupees(packagingCost)}</dd>
        </div>
      )}
      <div>
        <dt>GST ({rate}%)</dt>
        <dd>{rupees(gst)}</dd>
      </div>
      <div className="is-total">
        <dt>Total</dt>
        <dd>{rupees(total)}</dd>
      </div>
    </dl>
  );

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => {
        if (!submitting && !uploading) onOpenChange(next);
      }}
      busy={submitting || uploading}
      title={
        step === 1 ? (
          <>
            Submit <em>Quotation</em>
          </>
        ) : step === 2 ? (
          <>
            Check & <em>Send</em>
          </>
        ) : (
          <>
            Quotation <em>Sent</em>
          </>
        )
      }
      description={
        step === 1
          ? 'Step 1 of 2: your price, quantity and costs for this RFQ.'
          : step === 2
            ? 'Step 2 of 2: this is exactly what the buyer will receive.'
            : undefined
      }
      points={POINTS}
      sheetArt="quote"
      width={1080}
    >
      {step === 3 ? (
        <Done
          title="Your quotation is with the buyer"
          actions={
            <Actions single>
              <KitButton onClick={() => onOpenChange(false)}>Done</KitButton>
            </Actions>
          }
        >
          <p>
            {rupees(total)} for {qty.toLocaleString('en-IN')} {unit} of <b>{rfq.title}</b>.
          </p>
        </Done>
      ) : (
        <div className="fk-stack">
          <EntityCard image={rfq.image} fallbackIcon={Package} name={rfq.title} byLabel="RFQ:" by={rfq.reqNumber} meta={meta} />

          {step === 1 ? (
            <form onSubmit={handleReview} noValidate className="fk-form fk-stack">
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
                      value={unitPrice}
                      onChange={(e) => {
                        setUnitPrice(e.target.value);
                        setErrors((p) => ({ ...p, price: undefined }));
                      }}
                      placeholder="Price before GST"
                      invalid={Boolean(errors.price)}
                      aria-describedby={errors.price ? `${ids}-price-error` : `${ids}-price-hint`}
                      iconPadding
                    />
                  </IconBox>
                </Field>
                <Field htmlFor={`${ids}-qty`} label={`Quantity (${unit})`} required error={errors.quantity}>
                  <Stepper
                    id={`${ids}-qty`}
                    value={quantity}
                    onChange={(value) => {
                      setQuantity(value);
                      setErrors((p) => ({ ...p, quantity: undefined }));
                    }}
                    min={1}
                    unitName={unit}
                    invalid={Boolean(errors.quantity)}
                    required
                  />
                </Field>
                <Field htmlFor={`${ids}-days`} label="Delivery Time (days)" required error={errors.days}>
                  <IconBox icon={Clock}>
                    <TextInput
                      id={`${ids}-days`}
                      type="number"
                      inputMode="numeric"
                      min="1"
                      value={leadDays}
                      onChange={(e) => {
                        setLeadDays(e.target.value);
                        setErrors((p) => ({ ...p, days: undefined }));
                      }}
                      placeholder="e.g. 10"
                      invalid={Boolean(errors.days)}
                      iconPadding
                    />
                  </IconBox>
                </Field>
                <Field htmlFor={`${ids}-moq`} label="Minimum Order (MOQ)" optional>
                  <Stepper id={`${ids}-moq`} value={moq} onChange={setMoq} min={1} unitName={`MOQ ${unit}`} />
                </Field>
                <Field htmlFor={`${ids}-freight`} label="Freight (₹)" optional>
                  <IconBox icon={Truck}>
                    <TextInput id={`${ids}-freight`} type="number" inputMode="decimal" min="0" step="any" value={freight} onChange={(e) => setFreight(e.target.value)} placeholder="0" iconPadding />
                  </IconBox>
                </Field>
                <Field htmlFor={`${ids}-packaging`} label="Packaging (₹)" optional>
                  <IconBox icon={Package}>
                    <TextInput id={`${ids}-packaging`} type="number" inputMode="decimal" min="0" step="any" value={packaging} onChange={(e) => setPackaging(e.target.value)} placeholder="0" iconPadding />
                  </IconBox>
                </Field>
                <Field htmlFor={`${ids}-gst`} label="GST Rate">
                  <IconBox icon={Percent}>
                    <NativeSelect id={`${ids}-gst`} value={taxRate} onChange={(e) => setTaxRate(e.target.value)} iconPadding>
                      {GST_RATES.map((r) => (
                        <option key={r} value={String(r)}>
                          {r}%
                        </option>
                      ))}
                    </NativeSelect>
                  </IconBox>
                </Field>
                <Field htmlFor={`${ids}-valid`} label="Quote Valid For (days)">
                  <IconBox icon={Calendar}>
                    <TextInput id={`${ids}-valid`} type="number" inputMode="numeric" min="1" value={validity} onChange={(e) => setValidity(e.target.value)} iconPadding />
                  </IconBox>
                </Field>
                <Field htmlFor={`${ids}-payment`} label="Payment Terms" optional wide>
                  <IconBox icon={Handshake}>
                    <TextInput id={`${ids}-payment`} list={`${ids}-payment-list`} value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} placeholder="e.g. 50% Advance" iconPadding />
                  </IconBox>
                  <datalist id={`${ids}-payment-list`}>
                    {PAYMENT_TERMS.map((t) => (
                      <option key={t} value={t} />
                    ))}
                  </datalist>
                </Field>
              </div>

              <Field htmlFor={`${ids}-notes`} label="Notes for the Buyer" optional>
                <CountedTextArea
                  id={`${ids}-notes`}
                  icon={FileText}
                  rows={3}
                  maxLength={1000}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Specifications, certifications, what the price includes…"
                />
              </Field>

              <Field label="Documents" optional hint="Catalogue, certificates or test reports. Up to 5 files, 10 MB each.">
                {attachments.length > 0 && (
                  <ul className="fk-files">
                    {attachments.map((file) => (
                      <li key={file.url}>
                        <FileText aria-hidden="true" />
                        <span>{file.name}</span>
                        <button type="button" onClick={() => setAttachments((prev) => prev.filter((f) => f.url !== file.url))} aria-label={`Remove ${file.name}`}>
                          <X aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {attachments.length < 5 && (
                  <label className="fk-upload">
                    {uploading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Paperclip aria-hidden="true" />}
                    <span>{uploading ? 'Uploading…' : 'Add files'}</span>
                    <input type="file" className="sr-only" multiple accept="image/*,.pdf,.doc,.docx" onChange={handleUpload} disabled={uploading} />
                  </label>
                )}
              </Field>

              <SectionTitle>Quotation Value</SectionTitle>
              {summary}

              <Actions>
                <KitButton type="submit" disabled={uploading}>
                  <Eye aria-hidden="true" /> Review Quotation
                </KitButton>
                <KitButton variant="ghost" onClick={() => onOpenChange(false)}>
                  Cancel
                </KitButton>
              </Actions>
            </form>
          ) : (
            <>
              <SectionTitle>Your Quotation</SectionTitle>
              {summary}
              <dl className="fk-summary">
                <div>
                  <dt>Delivery time</dt>
                  <dd>{Math.round(amount(leadDays))} days</dd>
                </div>
                {amount(moq) > 0 && (
                  <div>
                    <dt>MOQ</dt>
                    <dd>
                      {Math.round(amount(moq)).toLocaleString('en-IN')} {unit}
                    </dd>
                  </div>
                )}
                {paymentTerms.trim() && (
                  <div>
                    <dt>Payment terms</dt>
                    <dd>{paymentTerms.trim()}</dd>
                  </div>
                )}
                <div>
                  <dt>Valid for</dt>
                  <dd>{Math.round(amount(validity)) || 14} days</dd>
                </div>
                {attachments.length > 0 && (
                  <div>
                    <dt>Documents</dt>
                    <dd>{attachments.length}</dd>
                  </div>
                )}
                {notes.trim() && (
                  <div className="is-block">
                    <dt>Notes</dt>
                    <dd>{notes.trim()}</dd>
                  </div>
                )}
              </dl>
              <Callout icon={ShieldCheck}>When you press Submit, this quotation goes to the buyer.</Callout>
              <Actions>
                <KitButton onClick={handleSubmit} disabled={submitting}>
                  {submitting ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
                  {submitting ? 'Sending…' : 'Submit Quotation'}
                </KitButton>
                <KitButton variant="ghost" onClick={() => setStep(1)} disabled={submitting}>
                  <Edit3 aria-hidden="true" /> Edit
                </KitButton>
              </Actions>
            </>
          )}
        </div>
      )}
    </FormDialog>
  );
}
