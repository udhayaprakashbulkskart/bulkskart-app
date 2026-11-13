/**
 * ProductPromotionsPanel
 *
 * Shows a supplier's promotion campaigns with:
 *  - Summary stats (Active campaigns, Total Spent, Impressions, Leads)
 *  - Tabbed list: Active / Pending / Completed / All
 *  - Per-campaign performance row
 *
 * Additive only — rendered below the product grid in SupplierProductsPage.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/db/supabase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart2, Eye, MousePointerClick, Users, DollarSign,
  Star, Zap, TrendingUp, Calendar, RefreshCw, Pause, X, Play, ChevronDown, ChevronUp,
  Edit2, Globe, Tag,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const COUNTRIES = ['India','United States','United Arab Emirates','United Kingdom','Germany','Australia','Canada','Saudi Arabia','Singapore','Malaysia','Bangladesh','Sri Lanka'];
import { toast } from 'sonner';
import CampaignTrendChart from '@/components/common/CampaignTrendChart';

interface Campaign {
  id: string;
  product_id: string;
  promotion_type: string;
  target_category: string | null;
  target_country: string | null;
  duration_days: number;
  status: string;
  est_impressions: number;
  est_views: number;
  est_clicks: number;
  est_leads: number;
  actual_impressions: number;
  actual_views: number;
  actual_clicks: number;
  actual_leads: number;
  total_spent: number;
  payment_amount: number;
  payment_currency: string;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  products?: { name: string; images?: string[] | null };
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft:           { label: 'Draft',           color: 'bg-muted text-muted-foreground border-border' },
  pending_payment: { label: 'Pending Payment', color: 'bg-[#FF5A00]/10 text-[#FF7A2E] border-[#FF5A00]/40' },
  active:          { label: 'Active',          color: 'bg-[#FF5A00]/10 text-[#FF7A2E] border-[#FF5A00]/40' },
  paused:          { label: 'Paused',          color: 'bg-[#FF5A00]/10 text-orange-700 border-[#FF5A00]/30' },
  completed:       { label: 'Completed',       color: 'bg-orange-500/10 text-[#FF5A00] border-[#FF5A00]/30' },
  cancelled:       { label: 'Cancelled',       color: 'bg-[#FF5A00]/10 text-[#FF7A2E] border-[#FF5A00]/40' },
};

const TYPE_ICON: Record<string, React.ReactNode> = {
  featured: <Star className="w-3.5 h-3.5 text-primary" />,
  boost:    <Zap className="w-3.5 h-3.5 text-[#FF7A2E]" />,
  campaign: <BarChart2 className="w-3.5 h-3.5 text-[#FF7A2E]" />,
};

const fmt = (n: number, cur = 'INR') => {
  try { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(n); }
  catch { return `₹${n.toLocaleString('en-IN')}`; }
};

interface Props { companyId: string }

export default function ProductPromotionsPanel({ companyId }: Props) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState('active');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Edit-before-resume state
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [editCategory, setEditCategory]       = useState('');
  const [editCountry, setEditCountry]         = useState('');
  const [editSaving, setEditSaving]           = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('product_promotions')
      .select('*, products!product_id(name,images)')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    setCampaigns(Array.isArray(data) ? (data as Campaign[]) : []);
    setLoading(false);
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  /** Look up company owner_id then insert a notification for them */
  const notify = useCallback(async (
    title: string, message: string, type: string, link: string,
  ) => {
    const { data: co } = await supabase
      .from('companies')
      .select('owner_id')
      .eq('id', companyId)
      .single();
    if (!co?.owner_id) return;
    await supabase.from('notifications').insert({ user_id: co.owner_id, title, message, type, link });
  }, [companyId]);

  const handlePause = async (id: string) => {
    const campaign = campaigns.find(c => c.id === id);
    const { error } = await supabase.from('product_promotions').update({ status: 'paused' }).eq('id', id);
    if (error) { toast.error('Failed to pause campaign'); return; }
    toast.success('Campaign paused.');
    notify(
      'Campaign Paused',
      `Your promotion for "${campaign?.products?.name ?? 'product'}" has been paused.`,
      'promo_paused',
      '/dashboard/supplier/products',
    );
    load();
  };

  const handleResume = async (id: string) => {
    const campaign = campaigns.find(c => c.id === id);
    const { error } = await supabase
      .from('product_promotions')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) { toast.error('Failed to resume campaign'); return; }
    toast.success('Campaign resumed and is now active!');
    notify(
      'Campaign Active',
      `Your promotion for "${campaign?.products?.name ?? 'product'}" is now live.`,
      'promo_active',
      '/dashboard/supplier/products',
    );
    load();
  };

  const openEdit = (c: Campaign) => {
    setEditingCampaign(c);
    setEditCategory(c.target_category ?? '');
    setEditCountry(c.target_country ?? '');
  };

  const handleSaveAndResume = async () => {
    if (!editingCampaign) return;
    setEditSaving(true);
    const { error } = await supabase
      .from('product_promotions')
      .update({
        target_category: editCategory || null,
        target_country:  editCountry && editCountry !== 'all' ? editCountry : null,
        status:          'active',
        updated_at:      new Date().toISOString(),
      })
      .eq('id', editingCampaign.id);
    setEditSaving(false);
    if (error) { toast.error('Failed to save changes'); return; }
    toast.success('Campaign updated and resumed!');
    notify(
      'Campaign Active',
      `Your promotion for "${editingCampaign.products?.name ?? 'product'}" has been updated and is now live.`,
      'promo_active',
      '/dashboard/supplier/products',
    );
    setEditingCampaign(null);
    load();
  };

  const handleSaveOnly = async () => {
    if (!editingCampaign) return;
    setEditSaving(true);
    const { error } = await supabase
      .from('product_promotions')
      .update({
        target_category: editCategory || null,
        target_country:  editCountry && editCountry !== 'all' ? editCountry : null,
        updated_at:      new Date().toISOString(),
      })
      .eq('id', editingCampaign.id);
    setEditSaving(false);
    if (error) { toast.error('Failed to save changes'); return; }
    toast.success('Campaign targeting updated.');
    setEditingCampaign(null);
    load();
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Cancel this promotion? This cannot be undone.')) return;
    const { error } = await supabase.from('product_promotions').update({ status: 'cancelled' }).eq('id', id);
    if (error) { toast.error('Failed to cancel'); return; }
    toast.success('Campaign cancelled.');
    load();
  };

  // Summary stats
  const active     = campaigns.filter(c => c.status === 'active');
  const totalSpent = campaigns.reduce((s, c) => s + (c.total_spent || c.payment_amount || 0), 0);
  const totalImpr  = campaigns.reduce((s, c) => s + (c.actual_impressions || c.est_impressions || 0), 0);
  const totalLeads = campaigns.reduce((s, c) => s + (c.actual_leads || 0), 0);
  const totalClicks= campaigns.reduce((s, c) => s + (c.actual_clicks || 0), 0);

  const filtered = tab === 'all' ? campaigns :
    tab === 'active'    ? campaigns.filter(c => c.status === 'active') :
    tab === 'pending'   ? campaigns.filter(c => ['draft','pending_payment'].includes(c.status)) :
    tab === 'completed' ? campaigns.filter(c => ['completed','cancelled'].includes(c.status)) :
    campaigns;

  if (loading) {
    return (
      <div className="mt-8 bg-card border border-border rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Loading promotions…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8">
      {/* Section header */}
      <div className="flex items-center gap-2 mb-4">
        <BarChart2 className="w-5 h-5 text-primary" />
        <h2 className="text-base font-bold text-foreground">Product Promotions</h2>
        {active.length > 0 && (
          <Badge className="text-[10px] bg-[#FF5A00]/10 text-[#FF7A2E] border border-[#FF5A00]/40">
            {active.length} Active
          </Badge>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          { icon: <BarChart2 className="w-4 h-4" />, label: 'Active Campaigns', val: active.length.toString(),              color: 'text-[#FF7A2E]' },
          { icon: <DollarSign className="w-4 h-4" />, label: 'Total Spent',     val: fmt(totalSpent),                       color: 'text-primary' },
          { icon: <Eye className="w-4 h-4" />,        label: 'Impressions',     val: totalImpr.toLocaleString('en-IN'),      color: 'text-[#FF5A00]' },
          { icon: <Users className="w-4 h-4" />,      label: 'Leads',           val: totalLeads.toLocaleString('en-IN'),     color: 'text-[#FF7A2E]' },
        ].map(m => (
          <div key={m.label} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 ${m.color}`}>
              {m.icon}
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">{m.label}</p>
              <p className="text-sm font-bold text-foreground">{m.val}</p>
            </div>
          </div>
        ))}
      </div>

      {campaigns.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-xl p-10 text-center">
          <BarChart2 className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-semibold text-foreground mb-1">No promotions yet</p>
          <p className="text-xs text-muted-foreground">Click "Promote" on any product card above to launch your first campaign.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="w-full bg-muted/40 border-b border-border rounded-none h-10 p-0">
              {[
                { val: 'active',    label: 'Active',    count: campaigns.filter(c => c.status === 'active').length },
                { val: 'pending',   label: 'Pending',   count: campaigns.filter(c => ['draft','pending_payment'].includes(c.status)).length },
                { val: 'completed', label: 'Completed', count: campaigns.filter(c => ['completed','cancelled'].includes(c.status)).length },
                { val: 'all',       label: 'All',       count: campaigns.length },
              ].map(t => (
                <TabsTrigger
                  key={t.val}
                  value={t.val}
                  className="flex-1 h-10 rounded-none text-xs data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent"
                >
                  {t.label}
                  {t.count > 0 && (
                    <span className="ml-1.5 text-[10px] bg-muted rounded-full px-1.5">{t.count}</span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value={tab} className="p-0 mt-0">
              {filtered.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">No campaigns in this category.</div>
              ) : (
                <div className="divide-y divide-border">
                  {filtered.map(c => {
                    const sc = STATUS_CONFIG[c.status] ?? STATUS_CONFIG.draft;
                    const startDate = c.starts_at ? new Date(c.starts_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
                    const endDate   = c.ends_at   ? new Date(c.ends_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
                    const impressions = c.actual_impressions || c.est_impressions || 0;
                    const views       = c.actual_views       || c.est_views       || 0;
                    const clicks      = c.actual_clicks      || c.est_clicks      || 0;
                    const leads       = c.actual_leads       || c.est_leads       || 0;

                    return (
                      <div key={c.id} className="p-4 hover:bg-muted/20 transition-colors">
                        <div
                          className="flex items-start gap-3 flex-wrap cursor-pointer"
                          onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                        >
                          {/* Product thumbnail */}
                          <div className="w-10 h-10 rounded-lg bg-muted shrink-0 overflow-hidden flex items-center justify-center">
                            {c.products?.images?.[0]
                              ? <img src={c.products.images[0]} alt={c.products.name} className="w-full h-full object-cover" />
                              : <Star className="w-4 h-4 text-muted-foreground" />}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-0.5">
                              <p className="text-sm font-semibold text-foreground truncate">{c.products?.name ?? 'Product'}</p>
                              <Badge className={`text-[10px] border px-1.5 py-0 ${sc.color}`}>{sc.label}</Badge>
                              <span className="flex items-center gap-1 text-[10px] text-muted-foreground border border-border rounded-full px-1.5 py-0.5">
                                {TYPE_ICON[c.promotion_type]}
                                <span className="capitalize">{c.promotion_type}</span>
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{startDate} – {endDate}</span>
                              {c.target_country && <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" />{c.target_country}</span>}
                              <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />{fmt(c.payment_amount, c.payment_currency)}</span>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            {c.status === 'active' && (
                              <Button
                                size="sm" variant="outline"
                                onClick={() => handlePause(c.id)}
                                className="h-7 text-[11px] gap-1 border-border"
                              >
                                <Pause className="w-3 h-3" /> Pause
                              </Button>
                            )}
                            {c.status === 'paused' && (
                              <Button
                                size="sm" variant="outline"
                                onClick={() => openEdit(c)}
                                className="h-7 text-[11px] gap-1 border-border"
                              >
                                <Edit2 className="w-3 h-3" /> Edit
                              </Button>
                            )}
                            {c.status === 'paused' && (
                              <Button
                                size="sm" variant="outline"
                                onClick={() => handleResume(c.id)}
                                className="h-7 text-[11px] gap-1 border-[#FF5A00]/40 text-[#FF7A2E] hover:bg-[#B33D00]/10"
                              >
                                <Play className="w-3 h-3" /> Resume
                              </Button>
                            )}
                            {['active','paused','draft','pending_payment'].includes(c.status) && (
                              <Button
                                size="sm" variant="ghost"
                                onClick={() => handleCancel(c.id)}
                                className="h-7 text-[11px] text-destructive hover:bg-destructive/10"
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Performance metrics */}
                        <div className="grid grid-cols-4 gap-2 mt-3">
                          {[
                            { icon: <Eye className="w-3 h-3" />,              label: 'Impressions', val: impressions.toLocaleString('en-IN') },
                            { icon: <Eye className="w-3 h-3" />,              label: 'Views',       val: views.toLocaleString('en-IN') },
                            { icon: <MousePointerClick className="w-3 h-3" />,label: 'Clicks',      val: clicks.toLocaleString('en-IN') },
                            { icon: <Users className="w-3 h-3" />,            label: 'Leads',       val: leads.toString() },
                          ].map(m => (
                            <div key={m.label} className="bg-muted/30 rounded-lg p-2 text-center border border-border">
                              <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
                                {m.icon}
                                <span className="text-[10px]">{m.label}</span>
                              </div>
                              <p className="text-xs font-bold text-foreground">{m.val}</p>
                              {c.status !== 'active' && <p className="text-[9px] text-muted-foreground">est.</p>}
                            </div>
                          ))}
                        </div>

                        {/* Trend chart toggle */}
                        <button
                          onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                          className="mt-3 w-full flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground border border-dashed border-border rounded-lg py-1.5 transition-colors hover:bg-muted/30"
                        >
                          {expandedId === c.id
                            ? <><ChevronUp className="w-3.5 h-3.5" /> Hide trend chart</>
                            : <><ChevronDown className="w-3.5 h-3.5" /> View daily trend chart</>}
                        </button>

                        {/* Trend chart */}
                        {expandedId === c.id && (
                          <CampaignTrendChart campaign={c} />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* ── Edit Targeting Dialog (paused campaigns) ─────────────────── */}
      <Dialog open={!!editingCampaign} onOpenChange={open => { if (!open) setEditingCampaign(null); }}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <Edit2 className="w-4 h-4 text-primary" /> Edit Campaign Targeting
            </DialogTitle>
          </DialogHeader>

          <p className="text-xs text-muted-foreground -mt-1 mb-1">
            Update the targeting for <span className="font-semibold text-foreground">{editingCampaign?.products?.name}</span> before resuming.
          </p>

          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Tag className="w-3 h-3" /> Target Category
                <span className="text-muted-foreground/50">(optional)</span>
              </Label>
              <Input
                value={editCategory}
                onChange={e => setEditCategory(e.target.value)}
                placeholder="e.g. Textiles, Electronics"
                className="bg-input border-border text-sm h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Globe className="w-3 h-3" /> Target Country
                <span className="text-muted-foreground/50">(optional)</span>
              </Label>
              <Select value={editCountry || 'all'} onValueChange={setEditCountry}>
                <SelectTrigger className="bg-input border-border h-9 text-sm">
                  <SelectValue placeholder="All countries" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="all">All Countries</SelectItem>
                  {COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                onClick={handleSaveOnly}
                disabled={editSaving}
                className="flex-1 h-9 text-xs border-border"
              >
                {editSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                Save Only
              </Button>
              <Button
                onClick={handleSaveAndResume}
                disabled={editSaving}
                className="flex-1 h-9 text-xs bg-[#B33D00] hover:bg-[#B33D00] text-white gap-1.5"
              >
                {editSaving
                  ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  : <Play className="w-3.5 h-3.5" />}
                Save & Resume
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
