/**
 * PostRequirementDialog
 *
 * Modal that lets a buyer post a new RFQ requirement directly from the
 * RequirementsPage. Completely self-contained; does NOT touch any existing
 * RequirementsPage state — it only calls createRequirement() and on success
 * invokes onPosted() so the parent can prepend the new row.
 */
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Upload, Zap, Calendar, Package, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { createRequirement } from '@/lib/api';
import { supabase } from '@/db/supabase';
import { invokeAutoQuotation } from '@/lib/autoQuotationApi';
import type { Category, Requirement } from '@/types/types';
import SingleImageUploader from '@/components/common/SingleImageUploader';

const UNITS = ['Pcs', 'KG', 'Tons', 'MT', 'Litre', 'Box', 'Carton', 'Dozen', 'Set', 'Pair', 'Metre', 'Yard'];

const COUNTRIES = [
  'India', 'UAE', 'USA', 'UK', 'Germany', 'Singapore', 'Australia',
  'Canada', 'France', 'Japan', 'Brazil', 'China', 'Kenya', 'Italy',
  'Spain', 'Netherlands', 'South Korea', 'Mexico', 'Indonesia', 'Thailand',
];

interface Props {
  open: boolean;
  onClose: () => void;
  categories: Category[];
  buyerId: string;
  onPosted: (req: Requirement) => void;
}

export default function PostRequirementDialog({ open, onClose, categories, buyerId, onPosted }: Props) {
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    title: '',
    category_id: '',
    description: '',
    quantity: '',
    quantity_unit: 'Pcs',
    budget_max: '',
    destination_country: 'India',
    destination_city: '',
    deadline: '',
    specifications: '',
    is_urgent: false,
  });

  const set = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }));

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('File must be under 5 MB'); return; }
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `requirements/${buyerId}/${Date.now()}.${ext}`;
    const { data, error } = await supabase.storage.from('attachments').upload(path, file);
    if (error) { toast.error('Upload failed'); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(data.path);
    setAttachmentUrl(urlData.publicUrl);
    setUploading(false);
    toast.success('File uploaded');
  };

  const validateDialogForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!form.title.trim()) {
      errors.title = 'Requirement title/product name is required';
    }
    if (!form.category_id) {
      errors.category_id = 'Please select a requirement category';
    }
    if (!form.description.trim() || form.description.trim().length < 15) {
      errors.description = 'Requirement description is required (min 15 characters)';
    }
    if (!form.quantity || isNaN(Number(form.quantity)) || Number(form.quantity) <= 0) {
      errors.quantity = 'Valid order quantity is required';
    }
    if (!form.destination_country && !form.destination_city.trim()) {
      errors.destination = 'Delivery destination country or city is required';
    }
    if (!attachmentUrl) {
      errors.image = 'Requirement reference image is required. Upload an image representing the requested item.';
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      const firstError = Object.values(errors)[0];
      toast.error(firstError);
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Strict No Empty Post validation
    if (!validateDialogForm()) {
      return;
    }

    setLoading(true);
    const payload: Partial<Requirement> = {
      buyer_id: buyerId,
      title: form.title.trim(),
      category_id: form.category_id,
      description: form.description.trim(),
      quantity: parseInt(form.quantity),
      quantity_unit: form.quantity_unit,
      budget_max: form.budget_max ? parseFloat(form.budget_max) : null,
      destination_country: form.destination_country || null,
      destination_city: form.destination_city.trim() || null,
      deadline: form.deadline || null,
      specifications: form.specifications.trim() || null,
      attachment_url: attachmentUrl,
      status: 'active',
      // @ts-expect-error — new columns not yet in TS type
      is_urgent: form.is_urgent,
      deal_status: 'active',
    };
    const { error, id } = await createRequirement(payload);
    setLoading(false);
    if (error || !id) { toast.error(error ?? 'Failed to post requirement'); return; }
    // Fetch full row with joins for live prepend
    const { data: newReq } = await supabase
      .from('requirements')
      .select('*, profiles!buyer_id(id,full_name,email), categories!category_id(id,name,slug)')
      .eq('id', id)
      .maybeSingle();
    if (newReq) onPosted(newReq as Requirement);
    toast.success('Requirement posted with reference photo! Suppliers will respond shortly.');
    // Trigger auto-quotation matching in background (non-blocking)
    invokeAutoQuotation(id).catch(() => {/* silent — non-critical */});
    // Reset form
    setForm({ title: '', category_id: '', description: '', quantity: '', quantity_unit: 'Pcs', budget_max: '', destination_country: 'India', destination_city: '', deadline: '', specifications: '', is_urgent: false });
    setAttachmentUrl(null);
    setFieldErrors({});
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-2xl max-h-[90dvh] overflow-y-auto bg-card">
        <DialogHeader>
          <DialogTitle className="text-[18px] font-black text-foreground flex items-center gap-2">
            <Package className="w-5 h-5 text-[#FF5A00]" />
            Post a Requirement
          </DialogTitle>
          <DialogDescription className="text-[13px] text-muted-foreground">
            Describe what you need — verified suppliers will respond with quotes.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Urgency toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => set('is_urgent', !form.is_urgent)}
              className={`flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-full border transition-colors ${form.is_urgent ? 'bg-[#FF5A00]/10 border-[#FF5A00]/40 text-[#FF7A2E]' : 'border-border text-muted-foreground hover:border-[#FF5A00]'}`}
            >
              <Zap className="w-3.5 h-3.5" />
              {form.is_urgent ? 'Urgent' : 'Normal'} Priority
            </button>
            {form.is_urgent && <Badge className="bg-[#FF5A00]/10 text-[#FF7A2E] border-[#FF5A00]/40 text-[10px]">URGENT</Badge>}
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label className="text-[13px] font-semibold text-foreground">Requirement / Product Name <span className="text-[#FF7A2E]">*</span></Label>
            <Input
              value={form.title}
              onChange={e => { set('title', e.target.value); setFieldErrors(prev => ({ ...prev, title: '' })); }}
              placeholder="e.g. Basmati Rice 1121 Grade Export Quality"
              className={`border-border text-[13px] h-10 ${fieldErrors.title ? 'border-destructive ring-1 ring-destructive' : ''}`}
              required
            />
            {fieldErrors.title && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> {fieldErrors.title}</p>}
          </div>

          {/* Reference Image Uploader */}
          <div className="bg-muted/30 p-3 rounded-xl border border-border">
            <SingleImageUploader
              label="Requirement Reference Image *"
              description="Upload a photo or drawing of the exact requested product/commodity (JPG, PNG, WEBP, max 5MB)."
              value={attachmentUrl}
              shape="rectangle"
              bucket="rfq-images"
              folder={`rfqs/${buyerId}`}
              onChange={(url) => {
                setAttachmentUrl(url ?? null);
                if (url) setFieldErrors(prev => ({ ...prev, image: '' }));
              }}
            />
            {fieldErrors.image && (
              <p className="text-xs text-destructive mt-2 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> {fieldErrors.image}
              </p>
            )}
          </div>

          {/* Category + Unit in 2 cols */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[13px] font-semibold text-foreground">Category <span className="text-[#FF7A2E]">*</span></Label>
              <Select value={form.category_id} onValueChange={v => { set('category_id', v); setFieldErrors(prev => ({ ...prev, category_id: '' })); }}>
                <SelectTrigger className={`border-border text-[13px] h-10 ${fieldErrors.category_id ? 'border-destructive ring-1 ring-destructive' : ''}`}>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {categories.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.category_id && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> {fieldErrors.category_id}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px] font-semibold text-foreground">Unit <span className="text-[#FF7A2E]">*</span></Label>
              <Select value={form.quantity_unit} onValueChange={v => set('quantity_unit', v)}>
                <SelectTrigger className="border-border text-[13px] h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Quantity + Budget */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[13px] font-semibold text-foreground">Quantity <span className="text-[#FF7A2E]">*</span></Label>
              <Input
                type="number" min="1"
                value={form.quantity}
                onChange={e => { set('quantity', e.target.value); setFieldErrors(prev => ({ ...prev, quantity: '' })); }}
                placeholder="e.g. 500"
                className={`border-border text-[13px] h-10 ${fieldErrors.quantity ? 'border-destructive ring-1 ring-destructive' : ''}`}
              />
              {fieldErrors.quantity && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> {fieldErrors.quantity}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px] font-semibold text-foreground">Budget / Expected Price (₹, optional)</Label>
              <Input
                type="number" min="0"
                value={form.budget_max}
                onChange={e => set('budget_max', e.target.value)}
                placeholder="e.g. 50000"
                className="border-border text-[13px] h-10"
              />
            </div>
          </div>

          {/* Destination + City */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[13px] font-semibold text-foreground">Delivery Location (Country) <span className="text-[#FF7A2E]">*</span></Label>
              <Select value={form.destination_country} onValueChange={v => { set('destination_country', v); setFieldErrors(prev => ({ ...prev, destination: '' })); }}>
                <SelectTrigger className={`border-border text-[13px] h-10 ${fieldErrors.destination ? 'border-destructive ring-1 ring-destructive' : ''}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border max-h-60">
                  {COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px] font-semibold text-foreground">City / State</Label>
              <Input
                value={form.destination_city}
                onChange={e => { set('destination_city', e.target.value); setFieldErrors(prev => ({ ...prev, destination: '' })); }}
                placeholder="e.g. Mumbai"
                className="border-border text-[13px] h-10"
              />
            </div>
          </div>
          {fieldErrors.destination && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> {fieldErrors.destination}</p>}

          {/* Deadline */}
          <div className="space-y-1.5">
            <Label className="text-[13px] font-semibold text-foreground flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#FF5A00]" /> Required Delivery Date (optional)
            </Label>
            <Input
              type="date"
              value={form.deadline}
              onChange={e => set('deadline', e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="border-border text-[13px] h-10"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="text-[13px] font-semibold text-foreground">Description <span className="text-[#FF7A2E]">*</span></Label>
            <Textarea
              value={form.description}
              onChange={e => { set('description', e.target.value); setFieldErrors(prev => ({ ...prev, description: '' })); }}
              placeholder="Describe your requirement in detail (material grade, intended use, testing standards)..."
              className={`border-border text-[13px] min-h-[80px] resize-none ${fieldErrors.description ? 'border-destructive ring-1 ring-destructive' : ''}`}
            />
            {fieldErrors.description && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> {fieldErrors.description}</p>}
          </div>

          {/* Specifications */}
          <div className="space-y-1.5">
            <Label className="text-[13px] font-semibold text-foreground">Product Specifications (optional)</Label>
            <Textarea
              value={form.specifications}
              onChange={e => set('specifications', e.target.value)}
              placeholder="Grade, size, certifications, packaging, etc."
              className="border-border text-[13px] min-h-[70px] resize-none"
            />
          </div>

          {/* File upload */}
          <div className="space-y-1.5">
            <Label className="text-[13px] font-semibold text-foreground">Image / Document (optional, max 5 MB)</Label>
            <label className="flex items-center gap-2 border border-dashed border-border rounded-lg px-4 py-3 cursor-pointer hover:border-[#FF5A00] transition-colors group">
              <Upload className="w-4 h-4 text-muted-foreground group-hover:text-[#FF5A00]" />
              <span className="text-[12px] text-muted-foreground group-hover:text-[#FF5A00]">
                {uploading ? 'Uploading…' : attachmentUrl ? '✓ File uploaded' : 'Choose file to upload'}
              </span>
              <input type="file" className="hidden" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" onChange={handleFileUpload} disabled={uploading} />
            </label>
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="flex-1 border border-border text-muted-foreground hover:bg-muted"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || uploading}
              className="flex-1 bg-[#1A0C05] hover:bg-[#1A0C05] text-white font-bold gap-2 shadow-[0_2px_0_#b83c00]"
            >
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Posting…</> : <><Plus className="w-4 h-4" /> Post Requirement</>}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
