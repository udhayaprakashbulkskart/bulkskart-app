import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import { checkDirectMessageQuota } from '@/lib/api';
import SubscribeToContactDialog from '@/components/common/SubscribeToContactDialog';
import { toast } from 'sonner';
import { FileText, Plus, RefreshCw, ChevronLeft, Download, CheckCircle2, XCircle, MessageSquare, Edit3 } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
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

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-[#FF5A00]/10 text-[#FF7A2E] border-[#FF5A00]/40',
  accepted: 'bg-[#FF5A00]/10 text-[#FF7A2E] border-[#FF5A00]/40',
  rejected: 'bg-[#FF5A00]/10 text-[#FF7A2E] border-[#FF5A00]/40',
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
    requirement_id: '', quantity: '', unit_price: '', moq: '1', moq_unit: 'pcs',
    delivery_days: '', production_days: '', validity_days: '30',
    payment_terms: '', delivery_terms: '', notes: '', is_draft: false,
  });

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
    if (!form.requirement_id) { toast.error('Select an RFQ'); return; }
    if (!form.unit_price) { toast.error('Enter unit price'); return; }

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
      moq_unit: form.moq_unit || 'pcs',
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
    setForm({ requirement_id: '', quantity: '', unit_price: '', moq: '1', moq_unit: 'pcs', delivery_days: '', production_days: '', validity_days: '30', payment_terms: '', delivery_terms: '', notes: '', is_draft: false });
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
          <Button onClick={openDialog} className="bg-[#1A0C05] hover:bg-primary/90 text-primary-foreground gap-2">
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
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-2xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Quotation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Select RFQ *</Label>
              <select
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                value={form.requirement_id}
                onChange={e => setForm(p => ({ ...p, requirement_id: e.target.value }))}
              >
                <option value="">-- Select matched RFQ --</option>
                {availableRfqs.map(r => (
                  <option key={r.id} value={r.id}>{r.title} ({r.quantity} {r.quantity_unit})</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1.5">
                <Label>Quantity</Label>
                <Input type="number" value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))} placeholder="e.g. 100" />
              </div>
              <div className="space-y-1.5">
                <Label>Unit Price (INR) *</Label>
                <Input type="number" value={form.unit_price} onChange={e => setForm(p => ({ ...p, unit_price: e.target.value }))} placeholder="e.g. 5000" />
              </div>
              <div className="space-y-1.5">
                <Label>MOQ</Label>
                <Input type="number" value={form.moq} onChange={e => setForm(p => ({ ...p, moq: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Unit</Label>
                <Input value={form.moq_unit} onChange={e => setForm(p => ({ ...p, moq_unit: e.target.value }))} placeholder="pcs" />
              </div>
              <div className="space-y-1.5">
                <Label>Production Time (days)</Label>
                <Input type="number" value={form.production_days} onChange={e => setForm(p => ({ ...p, production_days: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Delivery Time (days)</Label>
                <Input type="number" value={form.delivery_days} onChange={e => setForm(p => ({ ...p, delivery_days: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Validity (days)</Label>
                <Input type="number" value={form.validity_days} onChange={e => setForm(p => ({ ...p, validity_days: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Payment Terms</Label>
                <Input value={form.payment_terms} placeholder="e.g. 50% advance" onChange={e => setForm(p => ({ ...p, payment_terms: e.target.value }))} />
              </div>
            </div>
            {totalPrice && (
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                <p className="text-sm font-medium">Total Price: <span className="text-primary font-bold">INR {Number(totalPrice).toLocaleString()}</span></p>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Delivery Terms</Label>
              <Input value={form.delivery_terms} placeholder="e.g. Ex-works, FOB Mumbai" onChange={e => setForm(p => ({ ...p, delivery_terms: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Additional Notes</Label>
              <Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={3} />
            </div>
          </div>
          <DialogFooter className="flex-col md:flex-row gap-2">
            <Button variant="outline" onClick={() => handleSubmit(true)} disabled={saving}>Save as Draft</Button>
            <Button onClick={() => handleSubmit(false)} disabled={saving} className="bg-[#1A0C05] hover:bg-primary/90 text-primary-foreground">
              {saving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : null}
              Submit to Buyer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
