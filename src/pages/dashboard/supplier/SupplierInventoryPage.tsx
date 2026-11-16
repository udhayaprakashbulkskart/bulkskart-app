import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import PageMeta from '@/components/common/PageMeta';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Actions, Field, FormDialog, IconBox, KitButton, SectionTitle, Stepper, TextInput } from '@/components/formkit';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import { getProducts } from '@/lib/api';
import type { Product } from '@/types/types';
import { toast } from 'sonner';
import {
  Package, AlertTriangle, CheckCircle2, RefreshCw,
  TrendingUp, Edit2, ArrowUp, ArrowDown, Warehouse, Plus, Check, Hash, Loader2,
} from 'lucide-react';

interface InventoryRow {
  id: string;
  product_id: string;
  stock_qty: number;
  reserved_qty: number;
  available_qty: number;
  low_stock_threshold: number;
  reorder_qty: number;
  warehouse_location: string | null;
  sku: string | null;
  last_restocked_at: string | null;
}

interface ProductWithInventory extends Product {
  inventory?: InventoryRow | null;
}

interface StockForm {
  stock_qty: string;
  low_stock_threshold: string;
  reorder_qty: string;
  warehouse_location: string;
  sku: string;
}

const emptyForm: StockForm = { stock_qty: '0', low_stock_threshold: '10', reorder_qty: '50', warehouse_location: '', sku: '' };

export default function SupplierInventoryPage() {
  const navigate = useNavigate();
  const { company } = useAuth();
  const [products, setProducts] = useState<ProductWithInventory[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ProductWithInventory | null>(null);
  const [form, setForm] = useState<StockForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustMode, setAdjustMode] = useState<'add' | 'subtract'>('add');

  const fetchData = async () => {
    if (!company) return;
    setLoading(true);
    const prods = await getProducts({ companyId: company.id });
    if (!prods.length) { setProducts([]); setLoading(false); return; }

    const uniqueProds = Array.from(new Map(prods.map(p => [p.id, p])).values());

    const { data: inv } = await supabase
      .from('product_inventory')
      .select('*')
      .eq('company_id', company.id);

    const invMap: Record<string, InventoryRow> = {};
    (inv ?? []).forEach((r: InventoryRow) => { invMap[r.product_id] = r; });

    setProducts(uniqueProds.map(p => ({ ...p, inventory: invMap[p.id] ?? null })));
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [company]);

  const openEdit = (p: ProductWithInventory) => {
    setEditing(p);
    const inv = p.inventory;
    setForm({
      stock_qty: String(inv?.stock_qty ?? 0),
      low_stock_threshold: String(inv?.low_stock_threshold ?? 10),
      reorder_qty: String(inv?.reorder_qty ?? 50),
      warehouse_location: inv?.warehouse_location ?? '',
      sku: inv?.sku ?? '',
    });
    setAdjustQty('');
    setAdjustMode('add');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company || !editing) return;
    setSaving(true);
    const payload = {
      product_id: editing.id,
      company_id: company.id,
      stock_qty: parseInt(form.stock_qty) || 0,
      low_stock_threshold: parseInt(form.low_stock_threshold) || 10,
      reorder_qty: parseInt(form.reorder_qty) || 50,
      warehouse_location: form.warehouse_location || null,
      sku: form.sku || null,
      updated_at: new Date().toISOString(),
    };

    let error;
    if (editing.inventory?.id) {
      const res = await supabase.from('product_inventory').update(payload).eq('id', editing.inventory.id);
      error = res.error;
    } else {
      const res = await supabase.from('product_inventory').insert({ ...payload, last_restocked_at: new Date().toISOString() });
      error = res.error;
    }

    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Inventory updated!');
    setEditing(null);
    fetchData();
  };

  const handleAdjust = async () => {
    if (!company || !editing?.inventory) return;
    const delta = parseInt(adjustQty);
    if (!delta || delta < 0) {
      toast.error('Enter the quantity to adjust by.');
      document.getElementById('stock-adjust')?.focus();
      return;
    }
    const newQty = adjustMode === 'add'
      ? editing.inventory.stock_qty + delta
      : Math.max(0, editing.inventory.stock_qty - delta);
    const { error } = await supabase
      .from('product_inventory')
      .update({ stock_qty: newQty, updated_at: new Date().toISOString(), last_restocked_at: adjustMode === 'add' ? new Date().toISOString() : editing.inventory.last_restocked_at })
      .eq('id', editing.inventory.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Stock ${adjustMode === 'add' ? 'added' : 'reduced'}: ${delta} units`);
    setAdjustQty('');
    setEditing(null);
    fetchData();
  };

  const lowStockItems = products.filter(p => p.inventory && p.inventory.available_qty <= p.inventory.low_stock_threshold);
  const totalStock = products.reduce((s, p) => s + (p.inventory?.stock_qty ?? 0), 0);
  const totalAvailable = products.reduce((s, p) => s + (p.inventory?.available_qty ?? 0), 0);

  return (
    <DashboardLayout>
      <PageMeta title="Inventory — Supplier | BulkSkart" description="Manage your product stock levels." robots="noindex, nofollow" />
      <div className="flex-1 min-w-0 p-4 md:p-6 overflow-y-auto">
        <div className="max-w-5xl w-full mx-auto">
          <div className="mb-6">
            <h1 className="text-xl font-bold text-foreground">Inventory & Stock</h1>
            <p className="text-sm text-muted-foreground">Track and manage stock levels for all your products</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Package className="w-4 h-4 text-primary" />
                  <span className="text-xs text-muted-foreground">Total SKUs</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{products.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Warehouse className="w-4 h-4 text-primary" />
                  <span className="text-xs text-muted-foreground">Total Stock</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{totalStock.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-4 h-4 text-orange-500" />
                  <span className="text-xs text-muted-foreground">Available</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{totalAvailable.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-4 h-4 text-orange-500" />
                  <span className="text-xs text-muted-foreground">Low Stock</span>
                </div>
                <p className="text-2xl font-bold text-orange-500">{lowStockItems.length}</p>
              </CardContent>
            </Card>
          </div>

          {/* Low stock alert */}
          {lowStockItems.length > 0 && (
            <div className="mb-4 flex items-start gap-3 bg-orange-50 dark:bg-orange-950/20 border border-orange-300/50 rounded-xl p-3 text-sm">
              <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-orange-700 dark:text-orange-400">
                  {lowStockItems.length} product{lowStockItems.length > 1 ? 's' : ''} running low on stock
                </p>
                <p className="text-xs text-orange-600 dark:text-orange-500 truncate">
                  {lowStockItems.map(p => p.name).join(', ')}
                </p>
              </div>
            </div>
          )}

          {/* Product list */}
          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />)}
            </div>
          ) : products.length === 0 ? (
            <Card className="border border-border">
              <CardContent className="text-center py-12 px-4 max-w-md mx-auto">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4 border border-primary/20">
                  <Warehouse className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-1.5">No Inventory Records</h3>
                <p className="text-xs text-muted-foreground mb-5 leading-relaxed">
                  Inventory stock and warehouse tracking will automatically populate as soon as you list products in your supplier catalog.
                </p>
                <Button
                  onClick={() => navigate('/dashboard/supplier/products')}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-xs gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Go to My Products
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {products.map(p => {
                const inv = p.inventory;
                const isLow = inv && inv.available_qty <= inv.low_stock_threshold;
                const stockPct = inv ? Math.min((inv.available_qty / Math.max(inv.stock_qty, 1)) * 100, 100) : 0;
                return (
                  <Card key={p.id} className={isLow ? 'border-orange-300/50' : ''}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-muted shrink-0 overflow-hidden">
                          {p.images?.[0]
                            ? <img
                                src={p.images?.[0] || 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=400&q=80'}
                                alt={p.name}
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=400&q=80';
                                }}
                                className="w-full h-full object-cover"
                              />
                            : <Package className="w-5 h-5 text-muted-foreground m-2.5" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-foreground truncate">{p.name}</p>
                            {inv?.sku && <span className="text-[10px] text-muted-foreground bg-muted rounded px-1.5 py-0.5">{inv.sku}</span>}
                            {isLow && <Badge className="text-[10px] bg-orange-100 text-orange-700 border-orange-300">Low Stock</Badge>}
                          </div>
                          <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                            <span>Stock: <span className="text-foreground font-medium">{inv?.stock_qty ?? '—'}</span></span>
                            <span>Available: <span className="text-orange-600 font-medium">{inv?.available_qty ?? '—'}</span></span>
                            <span>Reserved: <span className="text-foreground">{inv?.reserved_qty ?? 0}</span></span>
                            {inv?.warehouse_location && <span className="flex items-center gap-0.5"><Warehouse className="w-3 h-3" /> {inv.warehouse_location}</span>}
                          </div>
                          {inv && (
                            <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${stockPct > 50 ? 'bg-orange-500' : stockPct > 20 ? 'bg-orange-500' : 'bg-destructive'}`}
                                style={{ width: `${stockPct}%` }}
                              />
                            </div>
                          )}
                        </div>
                        <Button onClick={() => openEdit(p)} size="sm" variant="ghost" className="shrink-0 border border-border text-xs gap-1">
                          <Edit2 className="w-3 h-3" /> Update
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Edit dialog */}
      <FormDialog
        open={!!editing}
        onOpenChange={(open) => {
          if (!open && !saving) setEditing(null);
        }}
        busy={saving}
        title={
          <>
            Update <em>Stock</em>
          </>
        }
        description={editing?.name}
        width={640}
      >
        <div className="fk-stack">
          {editing?.inventory && (
            <div className="fk-form fk-stack">
              <SectionTitle>Quick Adjustment</SectionTitle>
              <div className="fk-segment" role="group" aria-label="Adjustment type">
                <button type="button" className="is-add" aria-pressed={adjustMode === 'add'} onClick={() => setAdjustMode('add')}>
                  <ArrowUp aria-hidden="true" /> Add Stock
                </button>
                <button type="button" className="is-remove" aria-pressed={adjustMode === 'subtract'} onClick={() => setAdjustMode('subtract')}>
                  <ArrowDown aria-hidden="true" /> Remove
                </button>
              </div>
              <Field htmlFor="stock-adjust" label={adjustMode === 'add' ? 'Quantity to add' : 'Quantity to remove'} hint={`In stock now: ${editing.inventory.stock_qty.toLocaleString('en-IN')}`}>
                <div className="fk-inline-row">
                  <Stepper id="stock-adjust" value={adjustQty} onChange={setAdjustQty} min={1} unitName="units" describedBy="stock-adjust-hint" />
                  <KitButton variant="ghost" onClick={handleAdjust}>
                    Apply
                  </KitButton>
                </div>
              </Field>
            </div>
          )}

          <form onSubmit={handleSave} noValidate className="fk-form fk-stack">
            <SectionTitle>Stock Settings</SectionTitle>
            <Field htmlFor="stock-total" label="Total Stock Quantity">
              <Stepper id="stock-total" value={form.stock_qty} onChange={(value) => setForm((p) => ({ ...p, stock_qty: value }))} min={0} unitName="units in stock" />
            </Field>
            <div className="fk-grid">
              <Field htmlFor="stock-low" label="Low Stock Alert" hint="Warn me at or below this.">
                <Stepper id="stock-low" value={form.low_stock_threshold} onChange={(value) => setForm((p) => ({ ...p, low_stock_threshold: value }))} min={0} unitName="alert level" describedBy="stock-low-hint" />
              </Field>
              <Field htmlFor="stock-reorder" label="Reorder Quantity">
                <Stepper id="stock-reorder" value={form.reorder_qty} onChange={(value) => setForm((p) => ({ ...p, reorder_qty: value }))} min={0} unitName="reorder quantity" />
              </Field>
              <Field htmlFor="stock-sku" label="SKU / Part Number" optional>
                <IconBox icon={Hash}>
                  <TextInput id="stock-sku" value={form.sku} onChange={(e) => setForm((p) => ({ ...p, sku: e.target.value }))} placeholder="e.g. SKU-001" iconPadding />
                </IconBox>
              </Field>
              <Field htmlFor="stock-location" label="Warehouse / Location" optional>
                <IconBox icon={Warehouse}>
                  <TextInput id="stock-location" value={form.warehouse_location} onChange={(e) => setForm((p) => ({ ...p, warehouse_location: e.target.value }))} placeholder="e.g. Mumbai Warehouse A" iconPadding />
                </IconBox>
              </Field>
            </div>
            <Actions>
              <KitButton type="submit" disabled={saving}>
                {saving ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}
                {saving ? 'Saving…' : 'Save Inventory'}
              </KitButton>
              <KitButton variant="ghost" onClick={() => setEditing(null)} disabled={saving}>
                Cancel
              </KitButton>
            </Actions>
          </form>
        </div>
      </FormDialog>
    </DashboardLayout>
  );
}
