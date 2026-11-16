/**
 * SupplierRespondDialog
 *
 * Lets a supplier submit a quotation/response to a requirement.
 * Completely additive — does not touch any existing page code.
 */
import React, { useId, useState } from 'react';
import { BadgeIndianRupee, Bell, Box, CalendarClock, Clock, FileText, Loader2, MapPin, Paperclip, Send, Truck, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import {
  Actions,
  CountedTextArea,
  EntityCard,
  Field,
  FormDialog,
  IconBox,
  KitButton,
  NativeSelect,
  SectionTitle,
  Stepper,
  TextInput,
  type EntityMeta,
  type FormPoint,
} from '@/components/formkit';
import { createQuotation } from '@/lib/api';
import { supabase } from '@/db/supabase';
import type { Requirement, Quotation } from '@/types/types';

const UNITS = ['Pcs', 'KG', 'Tons', 'MT', 'Litre', 'Box', 'Carton', 'Dozen', 'Set', 'Pair', 'Metre', 'Yard'];
const PAYMENT_TERMS = ['100% Advance', '50% Advance', 'LC 30 Days', 'LC 60 Days', 'Net 30', 'Net 60', 'CAD', 'TT'];
const DELIVERY_TERMS = ['Ex-Works', 'FOB', 'CIF', 'C&F', 'DAP', 'DDP'];

const POINTS: FormPoint[] = [
  { icon: BadgeIndianRupee, title: 'Your price and terms', detail: 'Unit price, MOQ, delivery' },
  { icon: Bell, title: 'The buyer is notified', detail: 'As soon as you send it' },
  { icon: Paperclip, title: 'Photos or documents', detail: 'Up to 5 files' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  requirement: Requirement;
  supplierId: string;
  supplierCompanyId: string;
  onResponded: () => void;
}

export default function SupplierRespondDialog({ open, onClose, requirement, supplierId, supplierCompanyId, onResponded }: Props) {
  const ids = useId();
  const [priceError, setPriceError] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachmentUrls, setAttachmentUrls] = useState<string[]>([]);
  const [form, setForm] = useState({
    available_quantity: '',
    moq_unit: requirement.quantity_unit || 'Pcs',
    unit_price: '',
    currency: 'INR',
    moq: '1',
    delivery_days: '',
    shipping_cost: '',
    payment_terms: '',
    delivery_terms: 'FOB',
    validity_days: '30',
    notes: '',
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    const urls: string[] = [];
    for (const file of files.slice(0, 5)) {
      if (file.size > 10 * 1024 * 1024) { toast.error(`${file.name} exceeds 10 MB`); continue; }
      const ext = file.name.split('.').pop();
      const path = `supplier-quotes/${supplierCompanyId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { data, error } = await supabase.storage.from('attachments').upload(path, file);
      if (!error && data) {
        const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(data.path);
        urls.push(urlData.publicUrl);
      }
    }
    setAttachmentUrls(prev => [...prev, ...urls]);
    setUploading(false);
    if (urls.length) toast.success(`${urls.length} file(s) uploaded`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.unit_price || isNaN(Number(form.unit_price)) || Number(form.unit_price) <= 0) {
      setPriceError('Enter a valid unit price');
      document.getElementById(`${ids}-price`)?.focus();
      return;
    }
    setPriceError('');
    setLoading(true);
    // Use unknown cast so extended DB columns (shipping_cost, available_quantity) pass through
    const payload = {
      requirement_id: requirement.id,
      supplier_company_id: supplierCompanyId,
      supplier_id: supplierId,
      buyer_id: requirement.buyer_id,
      unit_price: parseFloat(form.unit_price),
      currency: form.currency,
      moq: parseInt(form.moq) || 1,
      moq_unit: form.moq_unit,
      delivery_days: form.delivery_days ? parseInt(form.delivery_days) : undefined,
      payment_terms: form.payment_terms || null,
      delivery_terms: form.delivery_terms || null,
      validity_days: parseInt(form.validity_days) || 30,
      notes: form.notes.trim() || null,
      status: 'pending' as const,
      is_draft: false,
      shipping_cost: form.shipping_cost ? parseFloat(form.shipping_cost) : null,
      available_quantity: form.available_quantity ? parseInt(form.available_quantity) : null,
      attachment_urls: attachmentUrls.length ? attachmentUrls : null,
    } as unknown as Partial<Quotation>;
    const { error } = await createQuotation(payload);
    setLoading(false);
    if (error) { toast.error(error); return; }
    toast.success('Response submitted! The buyer will be notified.');
    onResponded();
    onClose();
  };

  const meta: EntityMeta[] = [{ icon: Box, children: `Needs ${requirement.quantity.toLocaleString('en-IN')} ${requirement.quantity_unit}` }];
  const place = [requirement.destination_city, requirement.destination_country].filter(Boolean).join(', ');
  if (place) meta.push({ icon: MapPin, children: place });

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      busy={loading || uploading}
      title={
        <>
          Respond to <em>Requirement</em>
        </>
      }
      description="Send the buyer your price and terms for this requirement."
      points={POINTS}
      sheetArt="quote"
    >
      <form onSubmit={handleSubmit} noValidate className="fk-form fk-stack">
        <EntityCard fallbackIcon={FileText} name={requirement.title} meta={meta} />

        <SectionTitle>Your Quote</SectionTitle>

        <div className="fk-grid">
          <Field htmlFor={`${ids}-price`} label="Unit Price" required error={priceError}>
            <IconBox icon={Wallet} accent>
              <TextInput
                id={`${ids}-price`}
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                value={form.unit_price}
                onChange={(e) => {
                  set('unit_price', e.target.value);
                  if (priceError) setPriceError('');
                }}
                placeholder="e.g. 85.00"
                invalid={Boolean(priceError)}
                iconPadding
              />
            </IconBox>
          </Field>
          <Field htmlFor={`${ids}-currency`} label="Currency">
            <NativeSelect id={`${ids}-currency`} value={form.currency} onChange={(e) => set('currency', e.target.value)}>
              {['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD'].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field htmlFor={`${ids}-available`} label="Available Quantity">
            <Stepper id={`${ids}-available`} value={form.available_quantity} onChange={(v) => set('available_quantity', v)} min={1} unitName={form.moq_unit} />
          </Field>
          <Field htmlFor={`${ids}-unit`} label="Unit">
            <IconBox icon={Box}>
              <NativeSelect id={`${ids}-unit`} value={form.moq_unit} onChange={(e) => set('moq_unit', e.target.value)} iconPadding>
                {(UNITS.includes(form.moq_unit) ? UNITS : [form.moq_unit, ...UNITS]).map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </NativeSelect>
            </IconBox>
          </Field>
          <Field htmlFor={`${ids}-moq`} label="MOQ">
            <Stepper id={`${ids}-moq`} value={form.moq} onChange={(v) => set('moq', v)} min={1} unitName={form.moq_unit} />
          </Field>
          <Field htmlFor={`${ids}-days`} label="Delivery Time (days)">
            <IconBox icon={Clock}>
              <TextInput id={`${ids}-days`} type="number" inputMode="numeric" min="1" value={form.delivery_days} onChange={(e) => set('delivery_days', e.target.value)} placeholder="e.g. 14" iconPadding />
            </IconBox>
          </Field>
          <Field htmlFor={`${ids}-shipping`} label="Shipping Cost" optional>
            <IconBox icon={Truck}>
              <TextInput
                id={`${ids}-shipping`}
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={form.shipping_cost}
                onChange={(e) => set('shipping_cost', e.target.value)}
                placeholder="e.g. 2500"
                iconPadding
              />
            </IconBox>
          </Field>
          <Field htmlFor={`${ids}-valid`} label="Quote Valid For (days)">
            <IconBox icon={CalendarClock}>
              <TextInput id={`${ids}-valid`} type="number" inputMode="numeric" min="1" value={form.validity_days} onChange={(e) => set('validity_days', e.target.value)} iconPadding />
            </IconBox>
          </Field>
          <Field htmlFor={`${ids}-payment`} label="Payment Terms">
            <NativeSelect id={`${ids}-payment`} value={form.payment_terms} onChange={(e) => set('payment_terms', e.target.value)}>
              <option value="">Select…</option>
              {PAYMENT_TERMS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field htmlFor={`${ids}-delivery`} label="Delivery Terms">
            <NativeSelect id={`${ids}-delivery`} value={form.delivery_terms} onChange={(e) => set('delivery_terms', e.target.value)}>
              {DELIVERY_TERMS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>

        <Field htmlFor={`${ids}-notes`} label="Additional Message" optional>
          <CountedTextArea
            id={`${ids}-notes`}
            icon={FileText}
            rows={3}
            maxLength={1000}
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Introduce your company, highlight USPs, mention certifications..."
          />
        </Field>

        <Field label="Product Images / Documents" optional hint="Up to 5 files, 10 MB each.">
          <label className="fk-upload">
            <Paperclip aria-hidden="true" />
            <span>{uploading ? 'Uploading…' : attachmentUrls.length > 0 ? `${attachmentUrls.length} file(s) uploaded` : 'Choose files'}</span>
            <input type="file" className="sr-only" multiple accept="image/*,.pdf,.doc,.docx" onChange={handleFileUpload} disabled={uploading} />
          </label>
        </Field>

        <Actions>
          <KitButton type="submit" disabled={loading || uploading}>
            {loading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
            {loading ? 'Submitting…' : 'Submit Response'}
          </KitButton>
          <KitButton variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </KitButton>
        </Actions>
      </form>
    </FormDialog>
  );
}
