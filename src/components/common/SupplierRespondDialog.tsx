/**
 * SupplierRespondDialog
 *
 * Lets a supplier submit a quotation/response to a requirement.
 * Completely additive — does not touch any existing page code.
 */
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Send, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { createQuotation } from '@/lib/api';
import { supabase } from '@/db/supabase';
import type { Requirement, Quotation } from '@/types/types';

const UNITS = ['Pcs', 'KG', 'Tons', 'MT', 'Litre', 'Box', 'Carton', 'Dozen', 'Set', 'Pair', 'Metre', 'Yard'];
const PAYMENT_TERMS = ['100% Advance', '50% Advance', 'LC 30 Days', 'LC 60 Days', 'Net 30', 'Net 60', 'CAD', 'TT'];
const DELIVERY_TERMS = ['Ex-Works', 'FOB', 'CIF', 'C&F', 'DAP', 'DDP'];

interface Props {
  open: boolean;
  onClose: () => void;
  requirement: Requirement;
  supplierId: string;
  supplierCompanyId: string;
  onResponded: () => void;
}

export default function SupplierRespondDialog({ open, onClose, requirement, supplierId, supplierCompanyId, onResponded }: Props) {
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
      toast.error('Enter a valid unit price'); return;
    }
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

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-2xl max-h-[90dvh] overflow-y-auto bg-card">
        <DialogHeader>
          <DialogTitle className="text-[17px] font-black text-foreground flex items-center gap-2">
            <Send className="w-4 h-4 text-[#FF5A00]" /> Respond to Requirement
          </DialogTitle>
          <DialogDescription className="text-[12px] text-muted-foreground">
            <span className="font-semibold text-foreground">{requirement.title}</span> · {requirement.quantity.toLocaleString()} {requirement.quantity_unit}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Available Qty + Unit */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[12px] font-semibold text-foreground">Available Quantity</Label>
              <Input type="number" min="1" value={form.available_quantity} onChange={e => set('available_quantity', e.target.value)}
                placeholder={`e.g. ${requirement.quantity}`} className="border-border text-[13px] h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px] font-semibold text-foreground">Unit</Label>
              <Select value={form.moq_unit} onValueChange={v => set('moq_unit', v)}>
                <SelectTrigger className="border-border text-[13px] h-9"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-popover border-border">{UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          {/* Price + Currency */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[12px] font-semibold text-foreground">Unit Price <span className="text-[#FF7A2E]">*</span></Label>
              <Input type="number" min="0.01" step="0.01" value={form.unit_price} onChange={e => set('unit_price', e.target.value)}
                placeholder="e.g. 85.00" className="border-border text-[13px] h-9" required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px] font-semibold text-foreground">Currency</Label>
              <Select value={form.currency} onValueChange={v => set('currency', v)}>
                <SelectTrigger className="border-border text-[13px] h-9"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* MOQ + Delivery days */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[12px] font-semibold text-foreground">MOQ</Label>
              <Input type="number" min="1" value={form.moq} onChange={e => set('moq', e.target.value)}
                placeholder="Min order qty" className="border-border text-[13px] h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px] font-semibold text-foreground">Delivery Time (days)</Label>
              <Input type="number" min="1" value={form.delivery_days} onChange={e => set('delivery_days', e.target.value)}
                placeholder="e.g. 14" className="border-border text-[13px] h-9" />
            </div>
          </div>

          {/* Shipping Cost + Validity */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[12px] font-semibold text-foreground">Shipping Cost (optional)</Label>
              <Input type="number" min="0" step="0.01" value={form.shipping_cost} onChange={e => set('shipping_cost', e.target.value)}
                placeholder="e.g. 2500" className="border-border text-[13px] h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px] font-semibold text-foreground">Quote Valid For (days)</Label>
              <Input type="number" min="1" value={form.validity_days} onChange={e => set('validity_days', e.target.value)}
                className="border-border text-[13px] h-9" />
            </div>
          </div>

          {/* Payment + Delivery terms */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[12px] font-semibold text-foreground">Payment Terms</Label>
              <Select value={form.payment_terms} onValueChange={v => set('payment_terms', v)}>
                <SelectTrigger className="border-border text-[13px] h-9"><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent className="bg-popover border-border">{PAYMENT_TERMS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px] font-semibold text-foreground">Delivery Terms</Label>
              <Select value={form.delivery_terms} onValueChange={v => set('delivery_terms', v)}>
                <SelectTrigger className="border-border text-[13px] h-9"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-popover border-border">{DELIVERY_TERMS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          {/* Message */}
          <div className="space-y-1.5">
            <Label className="text-[12px] font-semibold text-foreground">Additional Message</Label>
            <Textarea value={form.notes} onChange={e => set('notes', e.target.value)}
              placeholder="Introduce your company, highlight USPs, mention certifications..."
              className="border-border text-[13px] min-h-[80px] resize-none" />
          </div>

          {/* File upload */}
          <div className="space-y-1.5">
            <Label className="text-[12px] font-semibold text-foreground">Product Images / Documents (optional, up to 5 files, 10 MB each)</Label>
            <label className="flex items-center gap-2 border border-dashed border-border rounded-lg px-4 py-3 cursor-pointer hover:border-[#FF5A00] transition-colors group">
              <Upload className="w-4 h-4 text-muted-foreground group-hover:text-[#FF5A00]" />
              <span className="text-[12px] text-muted-foreground group-hover:text-[#FF5A00]">
                {uploading ? 'Uploading…' : attachmentUrls.length > 0 ? `${attachmentUrls.length} file(s) uploaded` : 'Choose files'}
              </span>
              <input type="file" className="hidden" multiple accept="image/*,.pdf,.doc,.docx" onChange={handleFileUpload} disabled={uploading} />
            </label>
          </div>

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="ghost" onClick={onClose} className="flex-1 border border-border text-muted-foreground hover:bg-muted">
              Cancel
            </Button>
            <Button type="submit" disabled={loading || uploading}
              className="flex-1 bg-[#1A0C05] hover:bg-[#1A0C05] text-white font-bold gap-2 shadow-[0_2px_0_#b83c00]">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</> : <><Send className="w-4 h-4" /> Submit Response</>}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
