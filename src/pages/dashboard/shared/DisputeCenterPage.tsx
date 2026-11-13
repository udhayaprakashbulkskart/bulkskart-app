import React, { useEffect, useRef, useState } from 'react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import { toast } from 'sonner';
import { AlertTriangle, Upload, FileText, RefreshCw, Plus, ChevronRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Link } from 'react-router-dom';
import PageMeta from '@/components/common/PageMeta';

type Dispute = {
  id: string; order_id: string; reason: string; description: string; status: string;
  created_at: string; evidence_urls: string[];
  orders?: { order_number: string };
};

type OrderOption = { id: string; order_number: string };

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-[#FF5A00]/10 text-[#FF7A2E] border-[#FF5A00]/40',
  under_review: 'bg-orange-500/10 text-[#FF5A00] border-[#FF5A00]/30',
  resolved: 'bg-[#FF5A00]/10 text-[#FF7A2E] border-[#FF5A00]/40',
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
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!form.order_id) { toast.error('Select an order'); return; }
    if (!form.description.trim()) { toast.error('Describe the dispute'); return; }

    setSaving(true);
    try {
      const evidenceUrls: string[] = [];
      for (const file of evidenceFiles) {
        const dot = file.name.lastIndexOf('.');
        const stem = dot > 0 ? file.name.slice(0, dot) : file.name;
        const ext = dot > 0 ? file.name.slice(dot) : '';
        const safeName = `${user.id}/${form.order_id}/${Date.now()}-${toHex(stem)}${ext}`;
        const { data, error } = await supabase.storage.from('dispute-evidence').upload(safeName, file, { upsert: false });
        if (!error && data) {
          const { data: urlData } = supabase.storage.from('dispute-evidence').getPublicUrl(data.path);
          evidenceUrls.push(urlData.publicUrl);
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

      toast.success('Dispute submitted. Admin will review within 2–3 business days.');
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
          <Button onClick={() => { fetchOrders(); setDialogOpen(true); }} className="bg-[#1A0C05] hover:bg-primary/90 text-primary-foreground gap-2">
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>Raise a Dispute</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Order *</Label>
              <Select value={form.order_id} onValueChange={v => setForm(p => ({ ...p, order_id: v }))}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="-- Select order --" />
                </SelectTrigger>
                <SelectContent>
                  {orders.length === 0
                    ? <SelectItem value="none" disabled>No orders available</SelectItem>
                    : orders.map(o => (
                        <SelectItem key={o.id} value={o.id}>#{o.order_number}</SelectItem>
                      ))
                  }
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Dispute Reason *</Label>
              <Select value={form.reason} onValueChange={v => setForm(p => ({ ...p, reason: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="quality_issue">Product Quality Issue</SelectItem>
                  <SelectItem value="delivery_delay">Delivery Delay</SelectItem>
                  <SelectItem value="payment_issue">Payment Issue</SelectItem>
                  <SelectItem value="communication_issue">Communication Issue</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Describe the Issue *</Label>
              <Textarea
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                rows={4}
                placeholder="Provide a detailed description of the issue..."
              />
            </div>
            <div className="space-y-1.5">
              <Label>Evidence Files (max 5, 10MB each)</Label>
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <Upload className="w-3.5 h-3.5 mr-1" /> Upload Evidence
              </Button>
              <input ref={fileRef} type="file" multiple accept="image/*,.pdf,.doc,.docx" className="hidden" onChange={handleAddFile} />
              {evidenceFiles.length > 0 && (
                <div className="space-y-1">
                  {evidenceFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <FileText className="w-3 h-3" /> {f.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={saving} className="bg-[#1A0C05] hover:bg-primary/90 text-primary-foreground">
              {saving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : null}
              Submit Dispute
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
