import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { getProducts, createProduct, updateProduct, deleteProduct, getCategories } from '@/lib/api';
import type { Product, Category } from '@/types/types';
import {
  Actions,
  CountedTextArea,
  Field,
  FormDialog,
  IconBox,
  KitButton,
  NativeSelect,
  SectionTitle,
  Stepper,
  TextArea,
  TextInput,
  fk,
  type FormPoint,
} from '@/components/formkit';
import { unitsWith } from '@/components/formkit/units';
import { useCurrency } from '@/contexts/CurrencyContext';
import { buildPlans } from '@/lib/subscriptionPlans';
import { toast } from 'sonner';
import { AlertCircle, Box, Check, Coins, Edit2, FileDown, FileText, Image as ImageIcon, Layers, ListChecks, Loader2, Lock, Package, Percent, Plus, Sparkles, Star, Tag, Trash2, Video, Wallet, Zap } from 'lucide-react';
import PageMeta from '@/components/common/PageMeta';
import PromoteProductDialog from '@/components/common/PromoteProductDialog';
import ProductPromotionsPanel from '@/components/common/ProductPromotionsPanel';
import BulkDiscountRulesPanel from '@/components/common/BulkDiscountRulesPanel';
import MultiImageUploader from '@/components/common/MultiImageUploader';
import SafeImage from '@/components/common/SafeImage';

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED'];

const PRODUCT_POINTS: FormPoint[] = [
  { icon: ImageIcon, title: 'Real product photos', detail: 'At least 1, up to 10' },
  { icon: FileText, title: 'Clear details', detail: 'Name, category, description' },
  { icon: Wallet, title: 'Price and MOQ', detail: 'What buyers can order' },
];

/** where each checked field lives, so the first problem can be focused */
const FIELD_IDS = {
  images: 'prod-images',
  name: 'prod-name',
  categoryId: 'prod-category',
  description: 'prod-description',
  moq: 'prod-moq',
  priceMin: 'prod-price-min',
} as const;

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
  const { countryConfig, formatLocalPrice } = useCurrency();
  const plans = buildPlans(countryConfig, formatLocalPrice);
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
      const companyId = company.id;
      (data || []).forEach(p => {
        if (p.company_id === companyId && !map.has(p.id)) {
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
    const first = (['images', 'name', 'categoryId', 'description', 'moq', 'priceMin'] as const).find((key) => errors[key]);
    if (first) {
      const target = document.getElementById(FIELD_IDS[first]);
      target?.focus();
      target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return false;
    }
    return true;
  };

  const clearError = (key: string) =>
    setValidationErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });

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
    toast.success(editingId ? 'Product updated.' : 'Product listed.');
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
              {!company && <h3 className="text-lg font-bold text-foreground mb-2">Finish your business profile first</h3>}
              <p className="text-sm text-muted-foreground">Manage your product listings</p>
            </div>
            <Button
              onClick={handleAddProductClick}
              className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2 text-sm font-semibold"
            >
              <Plus className="w-4 h-4" /> Add Product
            </Button>
            <FormDialog
              open={dialogOpen}
              onOpenChange={(open) => {
                if (!saving) handleDialogOpenChange(open);
              }}
              busy={saving}
              title={
                editingId ? (
                  <>
                    Edit <em>Product</em>
                  </>
                ) : (
                  <>
                    Add <em>Product</em>
                  </>
                )
              }
              description="Real photos and clear details help buyers find and trust your product."
              points={PRODUCT_POINTS}
              width={1080}
            >
              <form onSubmit={handleSave} noValidate className="fk-form fk-stack">
                <SectionTitle>Photos</SectionTitle>
                <div className="fk-field" id="prod-images" tabIndex={-1}>
                  <span className={fk.label}>
                    Product Images
                    <span className="fk-req" aria-hidden="true">
                      *
                    </span>
                  </span>
                  <MultiImageUploader
                    images={form.images}
                    onChange={(imgs) => {
                      setForm((p) => ({ ...p, images: imgs }));
                      clearError('images');
                    }}
                    folder={`products/${company?.id || 'general'}`}
                    maxImages={10}
                  />
                  {validationErrors.images ? (
                    <p className="fk-error" role="alert">
                      <AlertCircle aria-hidden="true" />
                      {validationErrors.images}
                    </p>
                  ) : (
                    <p className={fk.hint}>At least 1, up to 10. Clear photos of the real item.</p>
                  )}
                </div>

                <SectionTitle>Details</SectionTitle>
                <Field htmlFor="prod-name" label="Product Name" required error={validationErrors.name}>
                  <IconBox icon={Tag}>
                    <TextInput
                      id="prod-name"
                      value={form.name}
                      onChange={(e) => {
                        set('name', e.target.value);
                        clearError('name');
                      }}
                      placeholder="e.g. 100W Mono Solar Panels"
                      invalid={Boolean(validationErrors.name)}
                      iconPadding
                    />
                  </IconBox>
                </Field>
                <Field htmlFor="prod-category" label="Category" required error={validationErrors.categoryId}>
                  <IconBox icon={Layers}>
                    <NativeSelect
                      id="prod-category"
                      value={form.categoryId}
                      onChange={(e) => {
                        set('categoryId', e.target.value);
                        clearError('categoryId');
                      }}
                      invalid={Boolean(validationErrors.categoryId)}
                      iconPadding
                    >
                      <option value="">Select category…</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </NativeSelect>
                  </IconBox>
                </Field>
                <Field htmlFor="prod-description" label="Description" required error={validationErrors.description} hint="At least 15 characters.">
                  <CountedTextArea
                    id="prod-description"
                    icon={FileText}
                    rows={4}
                    maxLength={3000}
                    value={form.description}
                    onChange={(e) => {
                      set('description', e.target.value);
                      clearError('description');
                    }}
                    placeholder="Describe the product clearly, including materials, usage, and features..."
                    invalid={Boolean(validationErrors.description)}
                  />
                </Field>
                <Field htmlFor="prod-specs" label="Specifications" optional>
                  <IconBox icon={ListChecks} area>
                    <TextArea id="prod-specs" value={form.specifications} onChange={(e) => set('specifications', e.target.value)} rows={3} placeholder="Size, material, certification..." iconPadding />
                  </IconBox>
                </Field>

                <SectionTitle>Price &amp; MOQ</SectionTitle>
                <div className="fk-grid">
                  <Field htmlFor="prod-moq" label="Minimum Order (MOQ)" required error={validationErrors.moq}>
                    <Stepper
                      id="prod-moq"
                      value={form.moq}
                      onChange={(value) => {
                        set('moq', value);
                        clearError('moq');
                      }}
                      min={1}
                      unitName={form.moqUnit}
                      invalid={Boolean(validationErrors.moq)}
                      required
                    />
                  </Field>
                  <Field htmlFor="prod-unit" label="MOQ Unit" required>
                    <IconBox icon={Box}>
                      <NativeSelect id="prod-unit" value={form.moqUnit} onChange={(e) => set('moqUnit', e.target.value)} iconPadding>
                        {unitsWith(form.moqUnit).map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </NativeSelect>
                    </IconBox>
                  </Field>
                  <Field htmlFor="prod-price-min" label={`Price From (${form.currency})`} required error={validationErrors.priceMin}>
                    <IconBox icon={Wallet} accent>
                      <TextInput
                        id="prod-price-min"
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="any"
                        value={form.priceMin}
                        onChange={(e) => {
                          set('priceMin', e.target.value);
                          clearError('priceMin');
                        }}
                        placeholder="Lowest unit price"
                        invalid={Boolean(validationErrors.priceMin)}
                        iconPadding
                      />
                    </IconBox>
                  </Field>
                  <Field htmlFor="prod-price-max" label={`Price Up To (${form.currency})`} optional>
                    <IconBox icon={Wallet}>
                      <TextInput
                        id="prod-price-max"
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="any"
                        value={form.priceMax}
                        onChange={(e) => set('priceMax', e.target.value)}
                        placeholder="Highest unit price"
                        iconPadding
                      />
                    </IconBox>
                  </Field>
                  <Field htmlFor="prod-currency" label="Currency">
                    <IconBox icon={Coins}>
                      <NativeSelect id="prod-currency" value={form.currency} onChange={(e) => set('currency', e.target.value)} iconPadding>
                        {CURRENCIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </NativeSelect>
                    </IconBox>
                  </Field>
                </div>

                <SectionTitle>Media &amp; Downloads</SectionTitle>
                <Field htmlFor="prod-video" label="Product Video URL" optional hint="YouTube, Vimeo or a direct video link. Shown on the product page.">
                  <IconBox icon={Video}>
                    <TextInput id="prod-video" type="url" inputMode="url" value={form.videoUrl} onChange={(e) => set('videoUrl', e.target.value)} placeholder="https://youtube.com/watch?v=..." iconPadding />
                  </IconBox>
                </Field>
                <Field htmlFor="prod-brochure" label="Brochure / Datasheet URL" optional hint="A direct PDF link. Buyers can download it from your product page.">
                  <IconBox icon={FileDown}>
                    <TextInput id="prod-brochure" type="url" inputMode="url" value={form.brochureUrl} onChange={(e) => set('brochureUrl', e.target.value)} placeholder="https://... (PDF link)" iconPadding />
                  </IconBox>
                </Field>

                <Actions>
                  <KitButton type="submit" disabled={saving}>
                    {saving ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}
                    {saving ? 'Saving…' : editingId ? 'Update Product' : 'Add Product'}
                  </KitButton>
                  <KitButton variant="ghost" onClick={() => handleDialogOpenChange(false)} disabled={saving}>
                    Cancel
                  </KitButton>
                </Actions>
              </form>
            </FormDialog>
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
                  className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90 gap-2 font-bold px-6"
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
                <div className="mt-6 pt-4 border-t border-border flex items-center justify-center gap-2 text-xs text-orange-500 font-medium">
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
                      <span className="absolute bottom-2 right-2 bg-black/75 backdrop-blur-sm text-white text-[10px] px-2 py-0.5 rounded-md font-medium z-10 border border-white/10">
                        +{p.images.length - 1} photos
                      </span>
                    )}

                    {/* Promotion badges overlay */}
                    {(p.is_featured || (p as Product & { is_sponsored?: boolean }).is_sponsored) && (
                      <div className="absolute top-2 left-2 flex gap-1.5 z-10 flex-wrap">
                        {p.is_featured && (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-white bg-[#FF5A00] rounded-md px-2 py-0.5 shadow-sm">
                            <Star className="w-2.5 h-2.5 fill-white" /> Featured
                          </span>
                        )}
                        {(p as Product & { is_sponsored?: boolean }).is_sponsored && (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-orange-950 bg-orange-400 rounded-md px-2 py-0.5 shadow-sm">
                            <Zap className="w-2.5 h-2.5 fill-orange-950" /> Sponsored
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
                        className="w-full text-xs h-8 bg-[#FF5A00]/15 text-[#FF5A00] border border-[#FF5A00]/30 hover:bg-[#FF5A00]/25 gap-1.5 px-2 font-semibold justify-center"
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
      <FormDialog
        open={!!discountProduct}
        onOpenChange={(open) => {
          if (!open) setDiscountProduct(null);
        }}
        title={
          <>
            Bulk <em>Discounts</em>
          </>
        }
        description={discountProduct ? `Lower unit prices for larger orders of ${discountProduct.name}.` : undefined}
        width={720}
      >
        {discountProduct && company && <BulkDiscountRulesPanel productId={discountProduct.id} companyId={company.id} moqUnit={discountProduct.moq_unit} />}
      </FormDialog>

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
      <FormDialog
        open={paywallOpen}
        onOpenChange={setPaywallOpen}
        title={
          <>
            Choose a <em>Plan</em>
          </>
        }
        description="Listing products on BulkSkart needs an active supplier plan."
        width={620}
      >
        <div className="fk-stack">
          <dl className="fk-summary">
            {plans.map((plan) => (
              <div key={plan.tier}>
                <dt>
                  <b className="text-foreground">{plan.label}</b>
                  {plan.priceInr !== null && <span> · {plan.priceDisplay}/month</span>}
                </dt>
                <dd>{plan.features.find((f) => /product listings/i.test(f)) ?? plan.tagline}</dd>
              </div>
            ))}
          </dl>
          <p className="fk-note">Monthly prices, before tax. Each plan&apos;s full list of features is on the plans page.</p>
          <Actions>
            <KitButton
              onClick={() => {
                setPaywallOpen(false);
                navigate('/dashboard/supplier/subscription');
              }}
            >
              <Sparkles aria-hidden="true" /> View Plans &amp; Subscribe
            </KitButton>
            <KitButton variant="ghost" onClick={() => setPaywallOpen(false)}>
              Maybe Later
            </KitButton>
          </Actions>
        </div>
      </FormDialog>
    </DashboardLayout>
  );
}
