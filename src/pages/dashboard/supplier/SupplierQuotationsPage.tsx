import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import { checkDirectMessageQuota } from '@/lib/api';
import SubscribeToContactDialog from '@/components/common/SubscribeToContactDialog';
import { toast } from 'sonner';
import { BadgeIndianRupee, Bell, Box, CalendarClock, ClipboardList, Clock, Download, Factory, FileText, Handshake, IndianRupee, Loader2, Plus, RefreshCw, Save, Send, Truck } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Actions,
  CountedTextArea,
  DELIVERY_TERMS,
  Field,
  FormDialog,
  IconBox,
  KitButton,
  NativeSelect,
  PAYMENT_TERMS,
  SectionTitle,
  Stepper,
  TextInput,
  type FormPoint,
} from '@/components/formkit';
import { unitsWith } from '@/components/formkit/units';
import PageMeta from '@/components/common/PageMeta';

type QuotationRow = {
  id: string; requirement_id: string; supplier_company_id: string; buyer_id: string;
  unit_price: number; total_price: number | null; quantity: number | null; currency: string;
  moq: number; moq_unit: string; delivery_days: number | null; production_days: number | null;
  payment_terms: string | null; delivery_terms: string | null; validity_days: number; notes: string | null;
  status: string; is_draft: boolean; pdf_url: string | null; created_at: string;
  requirements?: { title: string; quantity: number; quantity_unit: string; destination_country: string | null };
  companies?: { company_name: string };
};

type ReqOption = { id: string; title: string; quantity: number; quantity_unit: string };

const QUOTE_POINTS: FormPoint[] = [
  { icon: ClipboardList, title: 'Pick a requirement', detail: 'Any active buyer request' },
  { icon: BadgeIndianRupee, title: 'Your price and terms', detail: 'Quantity, MOQ, delivery, payment' },
  { icon: Bell, title: 'Send it or keep a draft', detail: 'The buyer is notified when you send' },
];

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  accepted: 'bg-green-100 text-green-700 border-green-300',
  rejected: 'bg-red-100 text-red-700 border-red-300',
  revised: 'bg-orange-500/10 text-[#FF5A00] border-[#FF5A00]/30',
};

export default function SupplierQuotationsPage() {
  const { user, company } = useAuth();
  const navigate = useNavigate();
  const [quotations, setQuotations] = useState<QuotationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [gateReason, setGateReason] = useState<'not_logged_in' | 'not_registered_business' | 'no_subscription' | 'quota_exceeded'>('no_subscription');
  const [availableRfqs, setAvailableRfqs] = useState<ReqOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    requirement_id: '', quantity: '', unit_price: '', moq: '1', moq_unit: 'Pcs',
    delivery_days: '', production_days: '', validity_days: '30',
    payment_terms: '', delivery_terms: '', notes: '', is_draft: false,
  });
  const [formErrors, setFormErrors] = useState<{ requirement?: string; price?: string }>({});

  const fetchQuotations = async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    let query = supabase
      .from('quotations')
      .select('*, requirements(title, quantity, quantity_unit, destination_country), companies:supplier_company_id(company_name)')
      .order('created_at', { ascending: false })
      .limit(50);

    if (company?.id) {
      query = query.or(`supplier_company_id.eq.${company.id},supplier_id.eq.${user.id}`);
    } else {
      query = query.eq('supplier_id', user.id);
    }

    const { data } = await query;
    setQuotations(Array.isArray(data) ? data as QuotationRow[] : []);
    setLoading(false);
  };

  const fetchRfqs = async () => {
    if (!company?.id && !user?.id) return;
    // RFQs matched to this manufacturer or active RFQs
    const { data } = await supabase
      .from('requirements')
      .select('id, title, quantity, quantity_unit')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(50);
    setAvailableRfqs(Array.isArray(data) ? data as ReqOption[] : []);
  };

  useEffect(() => {
    fetchQuotations();
    fetchRfqs();
  }, [company?.id, user?.id]);

  const openDialog = async () => {
    if (!company) { setGateReason('not_registered_business'); setGateOpen(true); return; }
    const quota = await checkDirectMessageQuota(company.id, company);
    if (quota !== 'ok') { setGateReason(quota); setGateOpen(true); return; }
    fetchRfqs();
    setDialogOpen(true);
  };

  const totalPrice = form.quantity && form.unit_price
    ? (parseFloat(form.quantity) * parseFloat(form.unit_price)).toFixed(2)
    : '';

  const handleSubmit = async (isDraft: boolean) => {
    if (!company?.id || !user) return;
    const found: { requirement?: string; price?: string } = {};
    if (!form.requirement_id) found.requirement = 'Please select the requirement you are quoting for.';
    if (!(parseFloat(form.unit_price) > 0)) found.price = 'Please enter a unit price greater than 0.';
    setFormErrors(found);
    if (found.requirement || found.price) {
      document.getElementById(found.requirement ? 'quote-rfq' : 'quote-price')?.focus();
      return;
    }

    // Find buyer_id from requirement
    const { data: req } = await supabase
      .from('requirements')
      .select('buyer_id')
      .eq('id', form.requirement_id)
      .maybeSingle();
    if (!req) { toast.error('RFQ not found'); return; }

    setSaving(true);
    const payload = {
      requirement_id: form.requirement_id,
      supplier_company_id: company.id,
      supplier_id: user.id,
      buyer_id: req.buyer_id,
      quantity: form.quantity ? parseInt(form.quantity) : null,
      unit_price: parseFloat(form.unit_price),
      total_price: totalPrice ? parseFloat(totalPrice) : null,
      moq: parseInt(form.moq) || 1,
      moq_unit: form.moq_unit || 'Pcs',
      delivery_days: form.delivery_days ? parseInt(form.delivery_days) : null,
      production_days: form.production_days ? parseInt(form.production_days) : null,
      validity_days: parseInt(form.validity_days) || 30,
      payment_terms: form.payment_terms || null,
      delivery_terms: form.delivery_terms || null,
      notes: form.notes || null,
      is_draft: isDraft,
      status: isDraft ? 'pending' : 'pending',
      currency: 'INR',
    };

    const { error } = await supabase.from('quotations').insert(payload);
    if (error) { toast.error('Failed to save quotation'); setSaving(false); return; }

    if (!isDraft) {
      // Notify buyer
      await supabase.functions.invoke('send-notification', {
        body: {
          user_id: req.buyer_id,
          title: '💰 New Quotation Received',
          message: `${company.company_name} submitted a quotation for your requirement`,
          type: 'quote_received',
          link: '/dashboard/buyer/requirements',
          reference_id: form.requirement_id,
          reference_type: 'requirement',
        },
      });
      toast.success('Quotation submitted to buyer!');
    } else {
      toast.success('Quotation saved as draft');
    }

    setDialogOpen(false);
    setForm({ requirement_id: '', quantity: '', unit_price: '', moq: '1', moq_unit: 'Pcs', delivery_days: '', production_days: '', validity_days: '30', payment_terms: '', delivery_terms: '', notes: '', is_draft: false });
    setFormErrors({});
    setSaving(false);
    fetchQuotations();
  };

  return (
    <DashboardLayout>
      <SubscribeToContactDialog open={gateOpen} onClose={() => setGateOpen(false)} reason={gateReason} />
      <PageMeta
        title="Quotation Management — Supplier | BulkSkart"
        description="BulkSkart dashboard — manage your account, orders and trade activity."
        robots="noindex, nofollow"
      />
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Quotation Management</h1>
            <p className="text-sm text-muted-foreground">Create and track quotations for matched RFQs</p>
          </div>
          <Button onClick={openDialog} className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2">
            <Plus className="w-4 h-4" /> New Quotation
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40"><RefreshCw className="w-6 h-6 animate-spin text-primary" /></div>
        ) : quotations.length === 0 ? (
          <Card><CardContent className="text-center py-12 text-muted-foreground">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>No quotations yet. Create one from a matched RFQ.</p>
          </CardContent></Card>
        ) : (
          <div className="space-y-3">
            {quotations.map(q => (
              <Card key={q.id} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm truncate">{q.requirements?.title || 'RFQ'}</p>
                        <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_COLORS[q.status] || 'bg-muted text-muted-foreground'}`}>
                          {q.is_draft ? 'Draft' : q.status.charAt(0).toUpperCase() + q.status.slice(1)}
                        </span>
                      </div>
                      <div className="flex gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                        <span>Unit Price: <b className="text-foreground">{q.currency} {Number(q.unit_price).toLocaleString()}</b></span>
                        {q.quantity && <span>Qty: <b className="text-foreground">{q.quantity} {q.moq_unit}</b></span>}
                        {q.total_price && <span>Total: <b className="text-foreground">{q.currency} {Number(q.total_price).toLocaleString()}</b></span>}
                        {q.delivery_days && <span>Delivery: <b className="text-foreground">{q.delivery_days} days</b></span>}
                        <span>Valid: <b className="text-foreground">{q.validity_days} days</b></span>
                      </div>
                      {q.payment_terms && <p className="text-xs text-muted-foreground mt-1">Payment: {q.payment_terms}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {q.pdf_url && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={q.pdf_url} target="_blank" rel="noreferrer"><Download className="w-3.5 h-3.5 mr-1" />PDF</a>
                        </Button>
                      )}
                      <p className="text-xs text-muted-foreground">{new Date(q.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* New Quotation Dialog */}
      <FormDialog
        open={dialogOpen}
        onOpenChange={(next) => {
          if (!saving) setDialogOpen(next);
        }}
        busy={saving}
        title={
          <>
            Create <em>Quotation</em>
          </>
        }
        description="Quote a price and terms on an active buyer requirement."
        points={QUOTE_POINTS}
        width={1040}
      >
        <form
          noValidate
          className="fk-form fk-stack"
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit(false);
          }}
        >
          <SectionTitle>Requirement</SectionTitle>
          <Field htmlFor="quote-rfq" label="Select RFQ" required error={formErrors.requirement}>
            <IconBox icon={ClipboardList}>
              <NativeSelect
                id="quote-rfq"
                value={form.requirement_id}
                onChange={(e) => {
                  setForm((p) => ({ ...p, requirement_id: e.target.value }));
                  setFormErrors((p) => ({ ...p, requirement: undefined }));
                }}
                invalid={Boolean(formErrors.requirement)}
                iconPadding
              >
                <option value="">{availableRfqs.length ? 'Select an active requirement…' : 'No active requirements right now'}</option>
                {availableRfqs.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title} ({r.quantity} {r.quantity_unit})
                  </option>
                ))}
              </NativeSelect>
            </IconBox>
          </Field>

          <SectionTitle>Your Quote</SectionTitle>
          <div className="fk-grid">
            <Field htmlFor="quote-price" label="Unit Price (₹)" required error={formErrors.price}>
              <IconBox icon={IndianRupee} accent>
                <TextInput
                  id="quote-price"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={form.unit_price}
                  onChange={(e) => {
                    setForm((p) => ({ ...p, unit_price: e.target.value }));
                    setFormErrors((p) => ({ ...p, price: undefined }));
                  }}
                  placeholder="e.g. 5000"
                  invalid={Boolean(formErrors.price)}
                  iconPadding
                />
              </IconBox>
            </Field>
            <Field htmlFor="quote-qty" label="Quantity" optional>
              <Stepper id="quote-qty" value={form.quantity} onChange={(value) => setForm((p) => ({ ...p, quantity: value }))} min={1} unitName={form.moq_unit} />
            </Field>
            <Field htmlFor="quote-moq" label="MOQ">
              <Stepper id="quote-moq" value={form.moq} onChange={(value) => setForm((p) => ({ ...p, moq: value }))} min={1} unitName={`MOQ ${form.moq_unit}`} />
            </Field>
            <Field htmlFor="quote-unit" label="Unit">
              <IconBox icon={Box}>
                <NativeSelect id="quote-unit" value={form.moq_unit} onChange={(e) => setForm((p) => ({ ...p, moq_unit: e.target.value }))} iconPadding>
                  {unitsWith(form.moq_unit).map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </NativeSelect>
              </IconBox>
            </Field>
            <Field htmlFor="quote-production" label="Production Time (days)" optional>
              <IconBox icon={Factory}>
                <TextInput id="quote-production" type="number" inputMode="numeric" min="0" value={form.production_days} onChange={(e) => setForm((p) => ({ ...p, production_days: e.target.value }))} iconPadding />
              </IconBox>
            </Field>
            <Field htmlFor="quote-delivery-days" label="Delivery Time (days)" optional>
              <IconBox icon={Clock}>
                <TextInput id="quote-delivery-days" type="number" inputMode="numeric" min="0" value={form.delivery_days} onChange={(e) => setForm((p) => ({ ...p, delivery_days: e.target.value }))} iconPadding />
              </IconBox>
            </Field>
            <Field htmlFor="quote-validity" label="Quote Valid For (days)">
              <IconBox icon={CalendarClock}>
                <TextInput id="quote-validity" type="number" inputMode="numeric" min="1" value={form.validity_days} onChange={(e) => setForm((p) => ({ ...p, validity_days: e.target.value }))} iconPadding />
              </IconBox>
            </Field>
            <Field htmlFor="quote-payment" label="Payment Terms" optional>
              <IconBox icon={Handshake}>
                <TextInput id="quote-payment" list="quote-payment-list" value={form.payment_terms} placeholder="e.g. 50% Advance" onChange={(e) => setForm((p) => ({ ...p, payment_terms: e.target.value }))} iconPadding />
              </IconBox>
              <datalist id="quote-payment-list">
                {PAYMENT_TERMS.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </Field>
            <Field htmlFor="quote-delivery-terms" label="Delivery Terms" optional wide>
              <IconBox icon={Truck}>
                <TextInput id="quote-delivery-terms" list="quote-delivery-list" value={form.delivery_terms} placeholder="e.g. Ex-Works, FOB Mumbai" onChange={(e) => setForm((p) => ({ ...p, delivery_terms: e.target.value }))} iconPadding />
              </IconBox>
              <datalist id="quote-delivery-list">
                {DELIVERY_TERMS.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </Field>
          </div>

          <Field htmlFor="quote-notes" label="Additional Notes" optional>
            <CountedTextArea
              id="quote-notes"
              icon={FileText}
              rows={3}
              maxLength={1000}
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Specifications, packaging, what the price includes…"
            />
          </Field>

          <div className="fk-total" aria-live="polite">
            <span>Total price</span>
            <b>{totalPrice ? `₹${Number(totalPrice).toLocaleString('en-IN')}` : '—'}</b>
          </div>

          <Actions>
            <KitButton type="submit" disabled={saving}>
              {saving ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
              {saving ? 'Saving…' : 'Submit to Buyer'}
            </KitButton>
            <KitButton variant="ghost" onClick={() => handleSubmit(true)} disabled={saving}>
              <Save aria-hidden="true" /> Save as Draft
            </KitButton>
          </Actions>
        </form>
      </FormDialog>
    </DashboardLayout>
  );
}
