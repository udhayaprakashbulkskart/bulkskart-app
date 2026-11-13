import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PageMeta from '@/components/common/PageMeta';
import { Textarea } from '@/components/ui/textarea';
import MainLayout from '@/components/layouts/MainLayout';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { createRequirement, getCategories } from '@/lib/api';
import { supabase } from '@/db/supabase';
import type { Category, RfqStatus } from '@/types/types';
import { toast } from 'sonner';
import {
  AlertCircle, Package, Globe, Calendar, FileText, CheckCircle,
  Image as ImageIcon, Clock, Save, ArrowRight, ShieldCheck,
  Building2, Sparkles, RefreshCw, Send, CheckCircle2, ChevronRight,
  LogIn, UserPlus
} from 'lucide-react';
import { trackRFQPosted } from '@/lib/analytics';
import SingleImageUploader from '@/components/common/SingleImageUploader';

const UNITS = ['Pcs', 'Metres', 'Kilograms (kg)', 'Metric Tons (MT)', 'Boxes', 'Cartons', 'Liters', 'Pairs', 'Sets', 'Units'];
const COUNTRIES = ['India', 'UAE', 'USA', 'UK', 'Germany', 'Singapore', 'Australia', 'Canada', 'China', 'Japan', 'France', 'Italy', 'Saudi Arabia', 'South Africa', 'Kenya', 'Nigeria', 'Other'];
const CLOSING_DURATIONS = [
  { label: '24 Hours (Fast-track Sourcing)', value: '24h' },
  { label: '48 Hours (Standard Live Window)', value: '48h' },
  { label: '7 Days (Comprehensive Quotations)', value: '7d' },
  { label: '14 Days (Large Project Tender)', value: '14d' },
  { label: '30 Days (Annual Contract Sourcing)', value: '30d' }
];

export default function PostRequirementPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [success, setSuccess] = useState(false);
  const [createdRfqId, setCreatedRfqId] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [documentUrl, setDocumentUrl] = useState<string>('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    title: '',
    description: '',
    specifications: '',
    categoryId: '',
    quantity: '',
    quantityUnit: 'Pcs',
    destinationCountry: 'India',
    destinationCity: '',
    pincode: '',
    closingDuration: '48h',
    requiredDate: '',
    budgetMin: '',
    budgetMax: '',
    currency: 'INR',
    buyerName: profile?.full_name || '',
    buyerContact: profile?.phone || user?.email || '',
    targetAudience: 'all' // 'all' or 'verified'
  });
  const [error, setError] = useState('');

  // Load categories and check for saved drafts
  useEffect(() => {
    getCategories().then(cats => {
      if (cats && cats.length > 0) setCategories(cats);
    });

    const savedDraft = localStorage.getItem('bulkskart_rfq_draft');
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        setForm(prev => ({ ...prev, ...parsed }));
        if (parsed.attachmentUrl) setAttachmentUrl(parsed.attachmentUrl);
        toast.info('Restored your previous RFQ draft from saved session.');
      } catch (e) {
        // ignore
      }
    }
  }, []);

  const handleSaveDraft = () => {
    try {
      localStorage.setItem('bulkskart_rfq_draft', JSON.stringify({ ...form, attachmentUrl }));
      setDraftSaved(true);
      toast.success('RFQ draft saved locally. You can return anytime to complete it.');
      setTimeout(() => setDraftSaved(false), 3000);
    } catch (e) {
      toast.error('Failed to save draft to browser storage');
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!form.title.trim()) {
      errors.title = 'Requirement title/product name is required';
    }
    if (!form.categoryId) {
      errors.categoryId = 'Please select a requirement category';
    }
    if (!form.description.trim() || form.description.trim().length < 15) {
      errors.description = 'Requirement description is required (min 15 characters)';
    }
    if (!form.quantity || parseFloat(form.quantity) <= 0) {
      errors.quantity = 'Valid order quantity is required';
    }
    if (!form.destinationCountry) {
      errors.destination = 'Delivery destination country is required';
    }
    if (!form.destinationCity) {
      errors.destinationCity = 'Delivery city / hub is required';
    }
    if (!user && !form.buyerContact.trim()) {
      errors.buyerContact = 'Contact email or phone is required to receive manufacturer quotations';
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      const firstError = Object.values(errors)[0];
      setError(firstError);
      toast.error(firstError);
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) return;

    if (!user) {
      toast.error('Authentication Required', {
        description: 'Please sign in or create a free account to submit your RFQ and receive quotes.'
      });
      localStorage.setItem('bulkskart_rfq_draft', JSON.stringify({
        ...form,
        savedAt: new Date().toISOString()
      }));
      navigate('/auth?redirect=/post-requirement&mode=buyer');
      return;
    }

    setLoading(true);

    // Compute deadline based on closing duration or requiredDate
    const now = new Date();
    let computedDeadline = form.requiredDate;
    if (!computedDeadline) {
      const durationHours = form.closingDuration === '24h' ? 24 : form.closingDuration === '48h' ? 48 : form.closingDuration === '7d' ? 168 : 336;
      computedDeadline = new Date(now.getTime() + durationHours * 3600 * 1000).toISOString().split('T')[0];
    }

    const uniqueRfqNumber = `BS-RFQ-${Math.floor(1000 + Math.random() * 9000)}`;

    try {
      const buyerId = user.id;

      const payload = {
        buyer_id: buyerId,
        title: form.title.trim(),
        description: `${form.description.trim()}${form.specifications ? `\n\nSpecifications:\n${form.specifications.trim()}` : ''}`,
        specifications: form.specifications.trim() || null,
        category_id: form.categoryId,
        quantity: Math.max(1, Math.round(parseFloat(form.quantity) || 0)),
        quantity_unit: form.quantityUnit,
        destination_country: form.destinationCountry,
        destination_city: form.destinationCity || null,
        deadline: computedDeadline,
        budget_min: form.budgetMin ? parseFloat(form.budgetMin) : null,
        budget_max: form.budgetMax ? parseFloat(form.budgetMax) : null,
        currency: form.currency,
        attachment_url: attachmentUrl || null,
        status: 'active' as RfqStatus,
        quote_count: 0,
        view_count: 1,
        is_verified_buyer: true
      };

      const { error: err, id } = await createRequirement(payload);

      if (err || !id) {
        setError(err || 'Failed to publish RFQ. Please try again.');
        toast.error(err || 'Failed to publish RFQ. Please try again.');
        return;
      }

      // Clear draft on successful post
      localStorage.removeItem('bulkskart_rfq_draft');

      setCreatedRfqId(id);
      setSuccess(true);
      toast.success(`RFQ published successfully! Verified manufacturers will be notified.`);

      // Fire matching in background — never block the buyer UI
      void import('@/lib/api').then(({ triggerRfqMatching }) => {
        triggerRfqMatching(id).catch(() => {});
      });

      // Fire analytics
      const selectedCat = categories.find(c => c.id === form.categoryId);
      trackRFQPosted({
        category: selectedCat?.name,
        destination: form.destinationCountry,
        quantity: parseFloat(form.quantity),
        unit: form.quantityUnit
      });
    } catch (err: any) {
      console.warn('Error saving RFQ to DB:', err);
      const message = err?.message || 'Failed to publish RFQ. Please try again.';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const set = (field: keyof typeof form, v: string) => setForm(p => ({ ...p, [field]: v }));

  if (success) {
    return (
      <MainLayout>
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <div className="p-8 rounded-3xl bg-card border border-border shadow-md space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-600">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div>
              <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-[#FF5A1F]/15 text-[#FF5A1F] border border-[#FF5A1F]/30">
                {createdRfqId}
              </span>
              <h2 className="text-2xl font-bold text-foreground mt-3 mb-1">
                Requirement Published to Marketplace!
              </h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Your RFQ for <strong className="text-foreground">{form.title}</strong> ({form.quantity} {form.quantityUnit}) is now active in Live Reverse Auctions. Verified manufacturers in this category will submit quotation proposals.
              </p>
            </div>

            {/* Sourcing Timeline Card */}
            <div className="p-4 rounded-2xl bg-muted/40 border border-border text-left text-xs space-y-2">
              <div className="flex justify-between items-center text-foreground font-semibold">
                <span>Next Steps & Notification Alerts:</span>
                <span className="text-[#FF5A1F] font-bold">Within 24 Hours</span>
              </div>
              <ul className="text-muted-foreground space-y-1 list-disc list-inside">
                <li>Automated broadcast sent to registered factories matching category.</li>
                <li>Suppliers submit unit pricing, delivery lead times, and tax estimates.</li>
                <li>Compare quotation breakdown side-by-side in your dashboard and award PO.</li>
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Button
                onClick={() => navigate(`/auctions/reverse`)}
                className="bg-[#FF5A1F] hover:bg-[#e04f1a] text-white font-bold h-11 px-6 rounded-xl shadow-sm"
              >
                View in Live Reverse Auctions <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setSuccess(false);
                  setForm({
                    title: '',
                    description: '',
                    specifications: '',
                    categoryId: '',
                    quantity: '',
                    quantityUnit: 'Pcs',
                    destinationCountry: 'India',
                    destinationCity: '',
                    pincode: '',
                    closingDuration: '48h',
                    requiredDate: '',
                    budgetMin: '',
                    budgetMax: '',
                    currency: 'INR',
                    buyerName: profile?.full_name || '',
                    buyerContact: profile?.phone || user?.email || '',
                    targetAudience: 'all'
                  });
                  setAttachmentUrl(null);
                }}
                className="h-11 px-5 rounded-xl border-border"
              >
                Post Another Requirement
              </Button>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <PageMeta
        title="Post Your Bulk Sourcing Requirement (RFQ) — BulkSkart"
        description="Submit your product specs, order quantity, delivery timeline and budget. Receive competitive quotations from verified manufacturers within 24 hours."
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 md:py-8">
        
        {/* Header Breadcrumbs & Title */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <Link to="/" className="hover:text-foreground">Home</Link>
            <span>/</span>
            <span className="text-foreground font-semibold">Post Your Requirement</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight flex items-center gap-2">
                Post Your Sourcing Requirement
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FF5A1F]/15 text-[#FF5A1F] border border-[#FF5A1F]/30">
                  Buyer RFQ
                </span>
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Submit product specifications and target budget to receive verified factory quotations.
              </p>
            </div>

            {/* Save Draft Button */}
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSaveDraft}
                className="h-9 px-3 rounded-xl border-border text-xs font-semibold flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5 text-[#FF5A1F]" />
                {draftSaved ? 'Draft Saved ✓' : 'Save Draft'}
              </Button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 flex items-center gap-2.5 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-2xl p-3.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!user && (
          <div className="mb-6 p-4 rounded-2xl bg-[#FF5A00]/10 border border-[#FF5A00]/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#FF5A00]/20 flex items-center justify-center shrink-0 text-[#FF5A00]">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs sm:text-sm font-bold text-foreground">Sign In or Create a Free Account to Submit</p>
                <p className="text-[11px] text-muted-foreground">You can draft your requirements below. An account is required before final submission so verified suppliers can contact you.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
              <Link to="/login?redirect=/post-requirement" className="flex-1 sm:flex-initial">
                <Button size="sm" variant="outline" className="w-full text-xs font-bold border-border h-8.5 rounded-lg">
                  <LogIn className="w-3.5 h-3.5 mr-1 text-[#FF5A00]" /> Sign In
                </Button>
              </Link>
              <Link to="/register?redirect=/post-requirement" className="flex-1 sm:flex-initial">
                <Button size="sm" className="w-full text-xs font-bold bg-[#FF5A00] hover:bg-[#e04e00] text-white h-8.5 rounded-lg shadow-xs">
                  <UserPlus className="w-3.5 h-3.5 mr-1" /> Create Free Account
                </Button>
              </Link>
            </div>
          </div>
        )}

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <form onSubmit={handleSubmit} className="bs-glass space-y-6 rounded-3xl p-4 sm:p-6">
          
          {/* Card 1: Product Identity & Reference Upload */}
          <div className="bg-card border border-border rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h2 className="text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
                <Package className="w-4 h-4 text-[#FF5A1F]" /> Product Specifications
              </h2>
              <span className="text-xs text-muted-foreground font-medium">* Mandatory fields</span>
            </div>

            {/* Reference Image Uploader */}
            <div className="bg-muted/20 p-4 rounded-2xl border border-border/80">
              <SingleImageUploader
                label="Product Sample Photo / Engineering Drawing (Optional but Recommended)"
                description="Upload an image representing the item, CAD drawing or material standard (JPG, PNG, max 5MB)."
                value={attachmentUrl}
                shape="rectangle"
                bucket="rfq-images"
                folder={user?.id ? `rfqs/${user.id}` : 'rfqs/guest'}
                onChange={(url) => setAttachmentUrl(url ?? null)}
              />
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">Product Name / Requirement Title *</Label>
              <Input
                value={form.title}
                onChange={e => { set('title', e.target.value); setFieldErrors(prev => ({ ...prev, title: '' })); }}
                placeholder="e.g. Cotton Fabric – 100% Cotton (Knitted) or MS Pipe 25mm"
                className={`bg-background h-10 rounded-xl text-xs sm:text-sm font-medium ${
                  fieldErrors.title ? 'border-destructive ring-1 ring-destructive' : 'border-border'
                }`}
              />
              {fieldErrors.title && <p className="text-[11px] text-destructive">{fieldErrors.title}</p>}
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">Industry Category *</Label>
              <Select
                value={form.categoryId}
                onValueChange={v => { set('categoryId', v); setFieldErrors(prev => ({ ...prev, categoryId: '' })); }}
              >
                <SelectTrigger className={`bg-background h-10 rounded-xl text-xs sm:text-sm ${
                  fieldErrors.categoryId ? 'border-destructive ring-1 ring-destructive' : 'border-border'
                }`}>
                  <SelectValue placeholder="Select primary manufacturing category" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border max-h-60">
                  {categories.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                  <SelectItem value="textiles-apparel">Textiles & Apparel</SelectItem>
                  <SelectItem value="metals-mining">Metals, Pipes & Construction</SelectItem>
                  <SelectItem value="chemicals-plastics">Plastics & Raw Materials</SelectItem>
                  <SelectItem value="electrical-electronics">Electrical & Conductors</SelectItem>
                  <SelectItem value="industrial-machinery">Industrial Machinery & Tools</SelectItem>
                </SelectContent>
              </Select>
              {fieldErrors.categoryId && <p className="text-[11px] text-destructive">{fieldErrors.categoryId}</p>}
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">Detailed Requirement Description *</Label>
              <Textarea
                value={form.description}
                onChange={e => { set('description', e.target.value); setFieldErrors(prev => ({ ...prev, description: '' })); }}
                placeholder="State your required grade, certifications (e.g. ISO/BIS/CE), tolerances, and packaging preferences..."
                rows={3}
                className={`bg-background rounded-xl text-xs sm:text-sm resize-none ${
                  fieldErrors.description ? 'border-destructive ring-1 ring-destructive' : 'border-border'
                }`}
              />
              {fieldErrors.description && <p className="text-[11px] text-destructive">{fieldErrors.description}</p>}
            </div>

            {/* Technical Specifications */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">Technical Specifications / Tolerances</Label>
              <Textarea
                value={form.specifications}
                onChange={e => set('specifications', e.target.value)}
                placeholder="e.g. Dimensions: 25mm diameter x 3mm thickness; Tensile strength: 410 MPa; Finish: Hot-dip galvanized."
                rows={2}
                className="bg-background rounded-xl text-xs sm:text-sm resize-none border-border"
              />
            </div>
          </div>

          {/* Card 2: Quantity, Unit & Target Budget */}
          <div className="bg-card border border-border rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h2 className="text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#FF5A1F]" /> Quantity, Unit & Target Budget
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">Total Quantity Required *</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.quantity}
                  onChange={e => { set('quantity', e.target.value); setFieldErrors(prev => ({ ...prev, quantity: '' })); }}
                  placeholder="e.g. 10000"
                  className={`bg-background h-10 rounded-xl text-xs sm:text-sm font-medium ${
                    fieldErrors.quantity ? 'border-destructive ring-1 ring-destructive' : 'border-border'
                  }`}
                />
                {fieldErrors.quantity && <p className="text-[11px] text-destructive">{fieldErrors.quantity}</p>}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">Measurement Unit *</Label>
                <Select value={form.quantityUnit} onValueChange={v => set('quantityUnit', v)}>
                  <SelectTrigger className="bg-background h-10 rounded-xl text-xs sm:text-sm border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {UNITS.map(u => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Target Price Range */}
            <div className="pt-2 border-t border-border/60">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">Currency</Label>
                  <Select value={form.currency} onValueChange={v => set('currency', v)}>
                    <SelectTrigger className="bg-background h-10 rounded-xl text-xs sm:text-sm border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="INR">INR (₹)</SelectItem>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                      <SelectItem value="AED">AED (د.إ)</SelectItem>
                      <SelectItem value="GBP">GBP (£)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">Target Min Price / Unit</Label>
                  <Input
                    type="number"
                    value={form.budgetMin}
                    onChange={e => set('budgetMin', e.target.value)}
                    placeholder="e.g. 60"
                    className="bg-background h-10 rounded-xl text-xs sm:text-sm border-border"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">Target Max Price / Unit</Label>
                  <Input
                    type="number"
                    value={form.budgetMax}
                    onChange={e => set('budgetMax', e.target.value)}
                    placeholder="e.g. 75"
                    className="bg-background h-10 rounded-xl text-xs sm:text-sm border-border"
                  />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                Displays as a target guideline in Live Reverse Auctions to attract competitive factory bids.
              </p>
            </div>
          </div>

          {/* Card 3: Delivery Location, Expiry Window & Contact */}
          <div className="bg-card border border-border rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h2 className="text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
                <Globe className="w-4 h-4 text-[#FF5A1F]" /> Delivery Location & Expiry Schedule
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">Destination Country *</Label>
                <Select
                  value={form.destinationCountry}
                  onValueChange={v => { set('destinationCountry', v); setFieldErrors(prev => ({ ...prev, destination: '' })); }}
                >
                  <SelectTrigger className="bg-background h-10 rounded-xl text-xs sm:text-sm border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border max-h-56">
                    {COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">City / Delivery Hub *</Label>
                <Input
                  value={form.destinationCity}
                  onChange={e => { set('destinationCity', e.target.value); setFieldErrors(prev => ({ ...prev, destinationCity: '' })); }}
                  placeholder="e.g. Tiruppur, Chennai, Ahmedabad"
                  className={`bg-background h-10 rounded-xl text-xs sm:text-sm ${
                    fieldErrors.destinationCity ? 'border-destructive ring-1 ring-destructive' : 'border-border'
                  }`}
                />
                {fieldErrors.destinationCity && <p className="text-[11px] text-destructive">{fieldErrors.destinationCity}</p>}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">Pincode / Postal Code</Label>
                <Input
                  value={form.pincode}
                  onChange={e => set('pincode', e.target.value)}
                  placeholder="e.g. 641604"
                  className="bg-background h-10 rounded-xl text-xs sm:text-sm border-border"
                />
              </div>
            </div>

            {/* Closing Schedule */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/60">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">RFQ Closing Window (Reverse Auction Duration)</Label>
                <Select value={form.closingDuration} onValueChange={v => set('closingDuration', v)}>
                  <SelectTrigger className="bg-background h-10 rounded-xl text-xs sm:text-sm border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {CLOSING_DURATIONS.map(d => (
                      <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">Expected Delivery By Date (Optional)</Label>
                <Input
                  type="date"
                  value={form.requiredDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={e => set('requiredDate', e.target.value)}
                  className="bg-background h-10 rounded-xl text-xs sm:text-sm border-border"
                />
              </div>
            </div>

            {/* Contact details for guest / new buyers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/60">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">Buyer / Company Name</Label>
                <Input
                  value={form.buyerName}
                  onChange={e => set('buyerName', e.target.value)}
                  placeholder="e.g. Metro Fabrics Ltd"
                  className="bg-background h-10 rounded-xl text-xs sm:text-sm border-border"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">Contact Email / Phone for Quotations *</Label>
                <Input
                  value={form.buyerContact}
                  onChange={e => { set('buyerContact', e.target.value); setFieldErrors(prev => ({ ...prev, buyerContact: '' })); }}
                  placeholder="e.g. procurement@metrofabrics.com or +91 98765 43210"
                  className={`bg-background h-10 rounded-xl text-xs sm:text-sm ${
                    fieldErrors.buyerContact ? 'border-destructive ring-1 ring-destructive' : 'border-border'
                  }`}
                />
                {fieldErrors.buyerContact && <p className="text-[11px] text-destructive">{fieldErrors.buyerContact}</p>}
              </div>
            </div>
          </div>

          {/* Submit Actions Bar */}
          <div className="p-4 rounded-3xl bg-card border border-border shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="w-4 h-4 text-[#FF5A1F] shrink-0" />
              <span>Direct factory quotes • 100% Escrow Protection • No commission fees on buyers</span>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <Button
                type="button"
                variant="outline"
                onClick={handleSaveDraft}
                className="flex-1 sm:flex-none h-11 px-4 rounded-xl border-border text-xs font-semibold"
              >
                Save Draft
              </Button>

              <Button
                type="submit"
                disabled={loading}
                className="flex-1 sm:flex-none h-11 px-6 rounded-xl bg-[#FF5A1F] hover:bg-[#e04f1a] text-white font-bold text-xs sm:text-sm shadow-sm flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Publishing RFQ...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Publish Requirement</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
        <aside className="bs-glass sticky top-24 hidden rounded-3xl p-4 lg:block">
          <p className="text-[11px] font-bold uppercase tracking-widest text-primary">Live brief</p>
          <p className="mt-2 text-sm font-bold text-foreground">{form.title || 'Untitled requirement'}</p>
          <dl className="mt-4 space-y-3 text-xs">
            <div className="flex items-center justify-between gap-3 border-b border-border pb-2">
              <dt className="text-muted-foreground">Quantity</dt>
              <dd className="font-semibold text-foreground">{form.quantity ? `${form.quantity} ${form.quantityUnit}` : '—'}</dd>
            </div>
            <div className="flex items-center justify-between gap-3 border-b border-border pb-2">
              <dt className="text-muted-foreground">Destination</dt>
              <dd className="font-semibold text-foreground">{form.destinationCity ? `${form.destinationCity}, ` : ''}{form.destinationCountry || '—'}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Window</dt>
              <dd className="font-semibold text-foreground">{form.closingDuration || '—'}</dd>
            </div>
          </dl>
          <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">This summary updates as you type. Publishing still uses the same form.</p>
        </aside>
        </div>
      </div>
    </MainLayout>
  );
}
