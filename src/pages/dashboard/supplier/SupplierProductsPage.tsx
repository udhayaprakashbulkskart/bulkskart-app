import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { getProducts, createProduct, updateProduct, deleteProduct, getCategories } from '@/lib/api';
import type { Product, Category } from '@/types/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, Package, Image, Star, Zap, Percent, Video, FileText, AlertCircle, Lock, CheckCircle, Sparkles } from 'lucide-react';
import PageMeta from '@/components/common/PageMeta';
import PromoteProductDialog from '@/components/common/PromoteProductDialog';
import ProductPromotionsPanel from '@/components/common/ProductPromotionsPanel';
import BulkDiscountRulesPanel from '@/components/common/BulkDiscountRulesPanel';
import MultiImageUploader from '@/components/common/MultiImageUploader';
import SafeImage from '@/components/common/SafeImage';

const UNITS = ['Pcs', 'Units', 'MT', 'KG', 'Tons', 'Boxes', 'Cartons', 'Liters', 'Meters', 'Pairs', 'Sets'];

function generateSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now().toString(36);
}

type ProductForm = {
  name: string; description: string; specifications: string; categoryId: string;
  moq: string; moqUnit: string; priceMin: string; priceMax: string; currency: string;
  videoUrl: string; brochureUrl: string;
  images: string[];
};

const emptyForm: ProductForm = {
  name: '', description: '', specifications: '', categoryId: '',
  moq: '', moqUnit: 'Pcs', priceMin: '', priceMax: '', currency: 'INR',
  videoUrl: '', brochureUrl: '',
  images: [],
};

export default function SupplierProductsPage() {
  const navigate = useNavigate();
  const { user, company, isPaidSubscriber } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  // Promotion state
  const [promoteProduct, setPromoteProduct] = useState<Product | null>(null);
  // Discount rules panel
  const [discountProduct, setDiscountProduct] = useState<Product | null>(null);

  const fetchProducts = () => {
    if (!company) return;
    setLoading(true);
    getProducts({ companyId: company.id }).then(data => {
      const map = new Map<string, Product>();
      (data || []).forEach(p => {
        if (!map.has(p.id)) {
          map.set(p.id, p);
        }
      });
      setProducts(Array.from(map.values()));
      setLoading(false);
    });
  };

  useEffect(() => {
    getCategories().then(setCategories);
    fetchProducts();
  }, [company]);

  const set = (field: keyof ProductForm, v: string) => setForm(p => ({ ...p, [field]: v }));

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const validateProductForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!form.name.trim()) {
      errors.name = 'Product name is required';
    }
    if (!form.categoryId) {
      errors.categoryId = 'Please select a product category';
    }
    if (!form.description.trim() || form.description.trim().length < 15) {
      errors.description = 'Please provide a detailed product description (minimum 15 characters)';
    }
    if (!form.images || form.images.length === 0) {
      errors.images = 'At least 1 product image is required. Upload a clear photo of the item.';
    }
    if (!form.moq || parseFloat(form.moq) <= 0) {
      errors.moq = 'Valid Minimum Order Quantity (MOQ) is required';
    }
    if (!form.priceMin || parseFloat(form.priceMin) <= 0) {
      errors.priceMin = 'Starting unit price is required';
    }

    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) {
      const firstError = Object.values(errors)[0];
      toast.error(firstError);
      return false;
    }
    return true;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) {
      toast.error('Supplier company profile not found. Please log in.');
      return;
    }

    // Strict No Empty Post validation
    if (!validateProductForm()) {
      return;
    }

    if (!editingId && !isPaidSubscriber) {
      toast.error('Active supplier subscription required to upload and list products.');
      setPaywallOpen(true);
      return;
    }

    setSaving(true);
    const payload: Partial<Product> = {
      company_id: company.id,
      name: form.name.trim(),
      slug: editingId ? undefined : generateSlug(form.name),
      description: form.description.trim(),
      specifications: form.specifications.trim() || null,
      category_id: form.categoryId,
      moq: parseFloat(form.moq) || 1,
      moq_unit: form.moqUnit,
      price_min: form.priceMin ? parseFloat(form.priceMin) : null,
      price_max: form.priceMax ? parseFloat(form.priceMax) : null,
      price_currency: form.currency,
      video_url: form.videoUrl.trim() || null,
      brochure_url: form.brochureUrl.trim() || null,
      images: form.images,
      is_active: true,
    };

    const { error } = editingId
      ? await updateProduct(editingId, payload)
      : await createProduct(payload);

    setSaving(false);
    if (error) { toast.error(error); return; }
    toast.success(editingId ? 'Product updated successfully!' : 'Product listed successfully with verified photos!');
    setDialogOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setValidationErrors({});
    fetchProducts();
  };

  const handleEdit = (p: Product) => {
    setEditingId(p.id);
    setForm({
      name: p.name, description: p.description ?? '', specifications: p.specifications ?? '',
      categoryId: p.category_id ?? '', moq: String(p.moq), moqUnit: p.moq_unit,
      priceMin: p.price_min ? String(p.price_min) : '', priceMax: p.price_max ? String(p.price_max) : '',
      currency: p.price_currency,
      videoUrl: p.video_url ?? '', brochureUrl: p.brochure_url ?? '',
      images: p.images ?? [],
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this product?')) return;
    await deleteProduct(id);
    toast.success('Product deleted.');
    fetchProducts();
  };

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) { setEditingId(null); setForm(emptyForm); setValidationErrors({}); }
  };

  const handleAddProductClick = () => {
    // Unpaid manufacturers can view My Products; subscription is only required to add/publish
    if (!isPaidSubscriber) {
      toast.message('Subscription required to add products', {
        description: 'Activate a manufacturer plan to upload and publish listings.',
      });
      setPaywallOpen(true);
      return;
    }
    setEditingId(null);
    setForm(emptyForm);
    setValidationErrors({});
    setDialogOpen(true);
  };

  return (
    <DashboardLayout>
      <PageMeta
        title="My Products — Supplier | BulkSkart"
        description="BulkSkart dashboard — manage your account, orders and trade activity."
        robots="noindex, nofollow"
      />
      <div className="flex-1 min-w-0 p-4 md:p-6 overflow-y-auto">
        <div className="max-w-5xl w-full mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl font-bold text-foreground">My Products</h1>
              <p className="text-sm text-muted-foreground">Manage your product listings</p>
            </div>
            <Button
              onClick={handleAddProductClick}
              className="bg-[#1A0C05] text-primary-foreground hover:bg-primary/90 gap-2 text-sm font-semibold"
            >
              <Plus className="w-4 h-4" /> Add Product
            </Button>
            <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
              <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-xl bg-card border-border max-h-[90dvh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-foreground">{editingId ? 'Edit Product' : 'Add New Product'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSave} className="space-y-4 mt-2">
                  {/* Multi-image uploader */}
                  <div className="bg-muted/30 p-3 rounded-xl border border-border">
                    <Label className="text-xs text-muted-foreground block mb-2">
                      Product Images * <span className="text-muted-foreground/60">(min 1 required, max 10)</span>
                    </Label>
                    <MultiImageUploader
                      images={form.images}
                      onChange={imgs => setForm(p => ({ ...p, images: imgs }))}
                      folder={`products/${company?.id || 'general'}`}
                      maxImages={10}
                    />
                    {validationErrors.images && (
                      <p className="text-xs text-destructive mt-2 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" /> {validationErrors.images}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Product Name *</Label>
                    <Input
                      value={form.name}
                      onChange={e => set('name', e.target.value)}
                      required
                      placeholder="e.g. 100W Mono Solar Panels"
                      className={`bg-input ${validationErrors.name ? 'border-destructive ring-1 ring-destructive' : 'border-border'}`}
                    />
                    {validationErrors.name && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> {validationErrors.name}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Category *</Label>
                    <Select value={form.categoryId} onValueChange={v => set('categoryId', v)}>
                      <SelectTrigger className={`bg-input ${validationErrors.categoryId ? 'border-destructive ring-1 ring-destructive' : 'border-border'}`}>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {validationErrors.categoryId && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> {validationErrors.categoryId}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Description *</Label>
                    <Textarea
                      value={form.description}
                      onChange={e => set('description', e.target.value)}
                      rows={3}
                      placeholder="Describe the product clearly, including materials, usage, and features..."
                      className={`bg-input resize-none ${validationErrors.description ? 'border-destructive ring-1 ring-destructive' : 'border-border'}`}
                    />
                    {validationErrors.description && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> {validationErrors.description}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Specifications</Label>
                    <Textarea value={form.specifications} onChange={e => set('specifications', e.target.value)} rows={2} placeholder="Size, material, certification..." className="bg-input border-border resize-none" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">MOQ *</Label>
                      <Input value={form.moq} onChange={e => set('moq', e.target.value)} type="number" required min="1" className={`bg-input ${validationErrors.moq ? 'border-destructive ring-1 ring-destructive' : 'border-border'}`} />
                      {validationErrors.moq && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> {validationErrors.moq}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">MOQ Unit *</Label>
                      <Select value={form.moqUnit} onValueChange={v => set('moqUnit', v)}>
                        <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-card border-border">
                          {UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Currency</Label>
                      <Select value={form.currency} onValueChange={v => set('currency', v)}>
                        <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-card border-border">
                          {['INR', 'USD', 'EUR', 'GBP', 'AED'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Price Min *</Label>
                      <Input
                        value={form.priceMin}
                        onChange={e => set('priceMin', e.target.value)}
                        type="number"
                        placeholder="Min price"
                        className={`bg-input ${validationErrors.priceMin ? 'border-destructive ring-1 ring-destructive' : 'border-border'}`}
                      />
                      {validationErrors.priceMin && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> {validationErrors.priceMin}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Price Max</Label>
                      <Input value={form.priceMax} onChange={e => set('priceMax', e.target.value)} type="number" placeholder="Max" className="bg-input border-border" />
                    </div>
                  </div>

                  {/* ── Media URLs ─────────────────────────────────────── */}
                  <div className="border-t border-border pt-4 space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Media &amp; Downloads</p>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Video className="w-3.5 h-3.5 text-primary" /> Product Video URL
                      </Label>
                      <Input
                        value={form.videoUrl}
                        onChange={e => set('videoUrl', e.target.value)}
                        type="url"
                        placeholder="https://youtube.com/watch?v=... or direct .mp4 link"
                        className="bg-input border-border"
                      />
                      <p className="text-[11px] text-muted-foreground">YouTube, Vimeo or direct video link. Shown on the product detail page.</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-primary" /> Brochure / Datasheet URL
                      </Label>
                      <Input
                        value={form.brochureUrl}
                        onChange={e => set('brochureUrl', e.target.value)}
                        type="url"
                        placeholder="https://... (PDF link)"
                        className="bg-input border-border"
                      />
                      <p className="text-[11px] text-muted-foreground">Direct PDF link. Buyers can download it from your product page.</p>
                    </div>
                  </div>
                  <Button type="submit" disabled={saving} className="w-full bg-[#1A0C05] text-primary-foreground hover:bg-primary/90">
                    {saving ? 'Saving...' : editingId ? 'Update Product' : 'Add Product'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...Array(3)].map((_, i) => <div key={i} className="h-48 bg-muted rounded-xl animate-pulse" />)}
            </div>
          ) : products.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-8 sm:p-12 text-center max-w-2xl mx-auto shadow-sm my-4">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4 border border-primary/20">
                <Package className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">No Products Listed Yet</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto leading-relaxed">
                Your product catalog is currently empty. List your manufactured items, machinery, or raw materials to display your verified listings to corporate buyers worldwide.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button
                  onClick={handleAddProductClick}
                  className="w-full sm:w-auto bg-[#C94400] text-primary-foreground hover:bg-primary/90 gap-2 font-bold px-6"
                >
                  <Plus className="w-4 h-4" /> Add Your First Product
                </Button>
                {!isPaidSubscriber && (
                  <Button
                    variant="outline"
                    onClick={() => navigate('/dashboard/supplier/subscription')}
                    className="w-full sm:w-auto border-border hover:bg-muted gap-2 font-semibold"
                  >
                    <Sparkles className="w-4 h-4 text-[#FF5A00]" /> View Subscription Plans
                  </Button>
                )}
              </div>
              {!isPaidSubscriber && (
                <div className="mt-6 pt-4 border-t border-border flex items-center justify-center gap-2 text-xs text-[#FF7A2E] font-medium">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Active supplier subscription required to upload &amp; publish product listings</span>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {products.map(p => (
                <div key={p.id} className="bg-card border border-border rounded-xl overflow-hidden flex flex-col hover:border-primary/40 transition-all shadow-sm">
                  {/* Compact, clean image container */}
                  <div className="h-36 sm:h-40 w-full bg-muted relative shrink-0 overflow-hidden">
                    <SafeImage
                      src={p.images?.[0]}
                      alt={p.name}
                      type="product"
                      className="w-full h-full object-cover"
                    />
                    {/* Multi-photo badge */}
                    {p.images && p.images.length > 1 && (
                      <span className="absolute bottom-2 right-2 bg-[#0A0A0A]/75 backdrop-blur-sm text-white text-[10px] px-2 py-0.5 rounded-md font-medium z-10 border border-white/10">
                        +{p.images.length - 1} photos
                      </span>
                    )}

                    {/* Promotion badges overlay */}
                    {(p.is_featured || (p as Product & { is_sponsored?: boolean }).is_sponsored) && (
                      <div className="absolute top-2 left-2 flex gap-1.5 z-10 flex-wrap">
                        {p.is_featured && (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-white bg-[#C94400] rounded-md px-2 py-0.5 shadow-sm">
                            <Star className="w-2.5 h-2.5 fill-white" /> Featured
                          </span>
                        )}
                        {(p as Product & { is_sponsored?: boolean }).is_sponsored && (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-[#FF7A2E] bg-[#C94400] rounded-md px-2 py-0.5 shadow-sm">
                            <Zap className="w-2.5 h-2.5 fill-[#FF5A00]" /> Sponsored
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Card Content */}
                  <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider truncate">
                          {p.categories?.name || 'Wholesale Catalogue'}
                        </span>
                        <span className="text-[10px] text-muted-foreground shrink-0 font-mono">
                          ID: {p.id.slice(0, 8)}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-foreground line-clamp-1 hover:text-[#FF5A00] transition-colors" title={p.name}>
                        {p.name}
                      </p>
                    </div>

                    {/* Aligned MOQ & Price row */}
                    <div className="flex items-center justify-between gap-2 py-1.5 px-2.5 bg-muted/40 border border-border/60 rounded-lg text-xs">
                      <div className="text-muted-foreground truncate">
                        MOQ: <span className="font-semibold text-foreground">{p.moq} {p.moq_unit}</span>
                      </div>
                      <div className="font-black text-[#FF5A00] text-xs sm:text-sm shrink-0">
                        {p.price_currency} {p.price_min?.toLocaleString()}{p.price_max ? ` – ${p.price_max.toLocaleString()}` : '+'}
                      </div>
                    </div>

                    {/* Responsive 4-Button Action Grid: 2x2 grid with ample width per button so text never clips or overflows */}
                    <div className="grid grid-cols-2 gap-2 pt-2">
                      <Button
                        onClick={() => handleEdit(p)}
                        size="sm"
                        variant="outline"
                        className="w-full text-xs h-8 border-border hover:bg-muted gap-1.5 px-2 font-medium justify-center"
                      >
                        <Edit2 className="w-3.5 h-3.5 shrink-0 text-muted-foreground" /> Edit
                      </Button>

                      <Button
                        onClick={() => setDiscountProduct(p)}
                        size="sm"
                        variant="outline"
                        className="w-full text-xs h-8 border-border hover:bg-muted gap-1.5 px-2 font-medium justify-center"
                      >
                        <Percent className="w-3.5 h-3.5 shrink-0 text-muted-foreground" /> Discounts
                      </Button>

                      <Button
                        onClick={() => setPromoteProduct(p)}
                        size="sm"
                        className="w-full text-xs h-8 bg-[#FF5A00]/15 text-[#FF5A00] border border-[#FF5A00]/30 hover:bg-[#B33D00]/25 gap-1.5 px-2 font-semibold justify-center"
                        variant="ghost"
                      >
                        <Star className="w-3.5 h-3.5 shrink-0 text-[#FF5A00]" /> Promote
                      </Button>

                      <Button
                        onClick={() => handleDelete(p.id)}
                        size="sm"
                        variant="outline"
                        className="w-full text-xs h-8 border-destructive/30 text-destructive hover:bg-destructive/10 gap-1.5 px-2 font-medium justify-center"
                      >
                        <Trash2 className="w-3.5 h-3.5 shrink-0" /> Delete
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Product Promotions Panel ──────────────────────────────── */}
        {company && <ProductPromotionsPanel companyId={company.id} />}
      </div>

      {/* ── Bulk Discount Rules Dialog ── */}
      <Dialog open={!!discountProduct} onOpenChange={open => { if (!open) setDiscountProduct(null); }}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg bg-card border-border max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground text-base">Bulk Discount Rules — {discountProduct?.name}</DialogTitle>
          </DialogHeader>
          {discountProduct && company && (
            <BulkDiscountRulesPanel
              productId={discountProduct.id}
              companyId={company.id}
              moqUnit={discountProduct.moq_unit}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* ── Promote Product Dialog (additive, zero changes to products page) ── */}
      {promoteProduct && company && (
        <PromoteProductDialog
          open={!!promoteProduct}
          onOpenChange={open => { if (!open) setPromoteProduct(null); }}
          product={promoteProduct}
          companyId={company.id}
          onSuccess={fetchProducts}
        />
      )}

      {/* ── Subscription Paywall Dialog ── */}
      <Dialog open={paywallOpen} onOpenChange={setPaywallOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md bg-card border-border text-foreground">
          <DialogHeader>
            <div className="w-12 h-12 rounded-xl bg-[#FF5A00]/15 text-[#FF5A00] flex items-center justify-center mb-2 mx-auto sm:mx-0">
              <Lock className="w-6 h-6" />
            </div>
            <DialogTitle className="text-xl font-bold text-foreground">
              Subscription Required to Upload Products
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground pt-1">
              To maintain verified manufacturer authenticity and prevent unverified listings on BulkSkart, an active supplier subscription plan is required to publish products and catalogs.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2.5 my-3 bg-muted/40 p-3.5 rounded-xl border border-border">
            <p className="text-xs font-semibold text-foreground uppercase tracking-wider">
              Included with Active Supplier Plan:
            </p>
            <div className="space-y-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-[#FF7A2E] shrink-0" />
                <span>Upload unlimited product catalogs &amp; multiple high-res photos</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-[#FF7A2E] shrink-0" />
                <span>Verified Manufacturer badge &amp; priority search placement</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-[#FF7A2E] shrink-0" />
                <span>Unlock direct WhatsApp numbers &amp; buyer RFQ contact details</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPaywallOpen(false)}
              className="border-border hover:bg-muted font-medium"
            >
              Maybe Later
            </Button>
            <Button
              type="button"
              onClick={() => {
                setPaywallOpen(false);
                navigate('/dashboard/supplier/subscription');
              }}
              className="flex-1 bg-[#1A0C05] hover:bg-[#1A0C05] text-white font-bold gap-2"
            >
              <Sparkles className="w-4 h-4" /> View Plans &amp; Subscribe
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
