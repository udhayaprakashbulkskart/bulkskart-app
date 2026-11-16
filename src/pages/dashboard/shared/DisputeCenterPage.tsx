import React, { useEffect, useRef, useState } from 'react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import { toast } from 'sonner';
import { AlertTriangle, Upload, FileText, RefreshCw, Plus, ChevronRight, Package, Loader2, Send, X, Bell, ShieldCheck } from 'lucide-react';
import { Actions, CountedTextArea, Field, FormDialog, IconBox, KitButton, NativeSelect, SectionTitle, type FormPoint } from '@/components/formkit';
import { Link } from 'react-router-dom';
import PageMeta from '@/components/common/PageMeta';

type Dispute = {
  id: string; order_id: string; reason: string; description: string; status: string;
  created_at: string; evidence_urls: string[];
  orders?: { order_number: string };
};

type OrderOption = { id: string; order_number: string };

const DISPUTE_POINTS: FormPoint[] = [
  { icon: Package, title: 'Pick the order' },
  { icon: FileText, title: 'Say what went wrong', detail: 'Add photos or documents' },
  { icon: Bell, title: 'The team is notified' },
  { icon: ShieldCheck, title: 'Track it here', detail: 'The status shows on this page' },
];

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-orange-100 text-orange-700 border-orange-300',
  under_review: 'bg-orange-500/10 text-[#FF5A00] border-[#FF5A00]/30',
  resolved: 'bg-orange-100 text-orange-700 border-orange-300',
  closed: 'bg-muted text-muted-foreground',
};

const toHex = (s: string) =>
  Array.from(new TextEncoder().encode(s), (b) => b.toString(16).padStart(2, '0')).join('');

export default function DisputeCenterPage() {
  const { user, profile } = useAuth();
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [form, setForm] = useState({ order_id: '', reason: 'quality_issue', description: '' });
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [formErrors, setFormErrors] = useState<{ order?: string; description?: string }>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchDisputes = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('disputes')
      .select('*, orders(order_number)')
      .or(`raised_by.eq.${user.id},against_user_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .limit(50);
    setDisputes(Array.isArray(data) ? data as Dispute[] : []);
    setLoading(false);
  };

  const fetchOrders = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('orders')
      .select('id, order_number')
      .or(profile?.role === 'buyer' ? `buyer_id.eq.${user.id}` : `supplier_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .limit(50);
    setOrders(Array.isArray(data) ? data as OrderOption[] : []);
  };

  useEffect(() => { fetchDisputes(); }, [user]);

  const handleAddFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const valid = files.filter(f => f.size <= 10 * 1024 * 1024);
    if (valid.length < files.length) toast.error('Some files exceed 10MB limit');
    setEvidenceFiles(prev => [...prev, ...valid].slice(0, 5));
    e.target.value = '';
  };

  const handleSubmit = async () => {
    if (!user) return;
    const found: { order?: string; description?: string } = {};
    if (!form.order_id) found.order = 'Please select the order this is about.';
    if (!form.description.trim()) found.description = 'Please describe what went wrong.';
    setFormErrors(found);
    if (found.order || found.description) {
      document.getElementById(found.order ? 'dispute-order' : 'dispute-description')?.focus();
      return;
    }

    setSaving(true);
    try {
      const evidenceUrls: string[] = [];
      let failedUploads = 0;
      for (const file of evidenceFiles) {
        const dot = file.name.lastIndexOf('.');
        const stem = dot > 0 ? file.name.slice(0, dot) : file.name;
        const ext = dot > 0 ? file.name.slice(dot) : '';
        const safeName = `${user.id}/${form.order_id}/${Date.now()}-${toHex(stem)}${ext}`;
        const { data, error } = await supabase.storage.from('dispute-evidence').upload(safeName, file, { upsert: false });
        if (!error && data) {
          const { data: urlData } = supabase.storage.from('dispute-evidence').getPublicUrl(data.path);
          evidenceUrls.push(urlData.publicUrl);
        } else {
          failedUploads += 1;
        }
      }

      // Get against_user_id from order
      const { data: orderData } = await supabase
        .from('orders')
        .select('buyer_id, supplier_id')
        .eq('id', form.order_id)
        .maybeSingle();
      const against = orderData
        ? (profile?.role === 'buyer' ? (orderData as { supplier_id?: string }).supplier_id : (orderData as { buyer_id?: string }).buyer_id)
        : null;

      const { error } = await supabase.from('disputes').insert({
        order_id: form.order_id,
        raised_by: user.id,
        against_user_id: against || null,
        reason: form.reason as 'quality_issue' | 'delivery_delay' | 'payment_issue' | 'communication_issue' | 'other',
        description: form.description,
        evidence_urls: evidenceUrls,
      });
      if (error) throw error;

      // Notify admin
      const { data: admins } = await supabase.from('profiles').select('id').eq('role', 'admin').limit(5);
      for (const admin of (admins || [])) {
        await supabase.functions.invoke('send-notification', {
          body: {
            user_id: admin.id,
            title: '⚠️ New Dispute Raised',
            message: `A dispute was raised for order #${orders.find(o => o.id === form.order_id)?.order_number}`,
            type: 'dispute',
            link: '/dashboard/admin',
            reference_id: form.order_id,
            reference_type: 'order',
          },
        });
      }

      toast.success('Dispute submitted. The BulkSkart team will look into it.');
      if (failedUploads > 0) toast.warning(`${failedUploads} evidence file(s) could not be uploaded. You can send them when the team contacts you.`);
      setDialogOpen(false);
      setForm({ order_id: '', reason: 'quality_issue', description: '' });
      setEvidenceFiles([]);
      fetchDisputes();
    } catch {
      toast.error('Failed to submit dispute');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <PageMeta
        title="Dispute Center | BulkSkart"
        description="BulkSkart dashboard — manage your account, orders and trade activity."
        robots="noindex, nofollow"
      />
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">Dispute Center</h1>
              <p className="text-sm text-muted-foreground">Raise and track disputes for your orders</p>
            </div>
          </div>
          <Button onClick={() => { fetchOrders(); setDialogOpen(true); }} className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2">
            <Plus className="w-4 h-4" /> Raise Dispute
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40"><RefreshCw className="w-6 h-6 animate-spin text-primary" /></div>
        ) : disputes.length === 0 ? (
          <Card>
            <CardContent className="text-center py-16 text-muted-foreground">
              <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>No disputes raised yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {disputes.map(d => (
              <Card key={d.id} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm">Order #{d.orders?.order_number}</p>
                        <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_COLORS[d.status] || 'bg-muted text-muted-foreground'}`}>
                          {d.status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{d.reason.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</p>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{d.description}</p>
                      {d.evidence_urls?.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">{d.evidence_urls.length} evidence file(s) attached</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-muted-foreground">{new Date(d.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <FormDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!saving) setDialogOpen(open);
        }}
        busy={saving}
        title={
          <>
            Raise a <em>Dispute</em>
          </>
        }
        description="Tell us what went wrong with an order. The BulkSkart team is notified."
        points={DISPUTE_POINTS}
        width={980}
      >
        <form
          noValidate
          className="fk-form fk-stack"
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
        >
          <SectionTitle>The Order</SectionTitle>
          <div className="fk-grid">
            <Field htmlFor="dispute-order" label="Order" required error={formErrors.order}>
              <IconBox icon={Package}>
                <NativeSelect
                  id="dispute-order"
                  value={form.order_id}
                  onChange={(e) => {
                    setForm((p) => ({ ...p, order_id: e.target.value }));
                    setFormErrors((p) => ({ ...p, order: undefined }));
                  }}
                  invalid={Boolean(formErrors.order)}
                  iconPadding
                >
                  <option value="">{orders.length ? 'Select an order…' : 'No orders to dispute'}</option>
                  {orders.map((o) => (
                    <option key={o.id} value={o.id}>
                      #{o.order_number}
                    </option>
                  ))}
                </NativeSelect>
              </IconBox>
            </Field>
            <Field htmlFor="dispute-reason" label="Reason" required>
              <IconBox icon={AlertTriangle}>
                <NativeSelect id="dispute-reason" value={form.reason} onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))} iconPadding>
                  <option value="quality_issue">Product quality issue</option>
                  <option value="delivery_delay">Delivery delay</option>
                  <option value="payment_issue">Payment issue</option>
                  <option value="communication_issue">Communication issue</option>
                  <option value="other">Other</option>
                </NativeSelect>
              </IconBox>
            </Field>
          </div>
          <Field htmlFor="dispute-description" label="Describe the issue" required error={formErrors.description}>
            <CountedTextArea
              id="dispute-description"
              icon={FileText}
              rows={4}
              maxLength={2000}
              value={form.description}
              onChange={(e) => {
                setForm((p) => ({ ...p, description: e.target.value }));
                setFormErrors((p) => ({ ...p, description: undefined }));
              }}
              placeholder="What happened, when, and what you expected instead…"
              invalid={Boolean(formErrors.description)}
            />
          </Field>
          <Field label="Evidence" optional hint="Photos, invoices or documents. Up to 5 files, 10 MB each.">
            {evidenceFiles.length > 0 && (
              <ul className="fk-files">
                {evidenceFiles.map((f, i) => (
                  <li key={`${f.name}-${i}`}>
                    <FileText aria-hidden="true" />
                    <span>{f.name}</span>
                    <button type="button" onClick={() => setEvidenceFiles((prev) => prev.filter((_, j) => j !== i))} aria-label={`Remove ${f.name}`}>
                      <X aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {evidenceFiles.length < 5 && (
              <label className="fk-upload">
                <Upload aria-hidden="true" />
                <span>Add files</span>
                <input ref={fileRef} type="file" multiple accept="image/*,.pdf,.doc,.docx" className="sr-only" onChange={handleAddFile} />
              </label>
            )}
          </Field>
          <Actions>
            <KitButton type="submit" disabled={saving}>
              {saving ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
              {saving ? 'Submitting…' : 'Submit Dispute'}
            </KitButton>
            <KitButton variant="ghost" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </KitButton>
          </Actions>
        </form>
      </FormDialog>
    </DashboardLayout>
  );
}
