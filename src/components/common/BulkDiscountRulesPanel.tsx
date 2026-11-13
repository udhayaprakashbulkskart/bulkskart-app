import React, { useEffect, useState } from 'react';
import { supabase } from '@/db/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { Plus, Trash2, Percent, Tag, RefreshCw, CheckCircle2 } from 'lucide-react';

interface Rule {
  id?: string;
  min_qty: string;
  max_qty: string;
  discount_pct: string;
  label: string;
  is_active: boolean;
}

interface Props {
  productId: string;
  companyId: string;
  moqUnit?: string;
}

const emptyRule = (): Rule => ({ min_qty: '', max_qty: '', discount_pct: '', label: '', is_active: true });

export default function BulkDiscountRulesPanel({ productId, companyId, moqUnit = 'Pcs' }: Props) {
  const [rules, setRules] = useState<(Rule & { id: string })[]>([]);
  const [draft, setDraft] = useState<Rule>(emptyRule());
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const fetchRules = async () => {
    const { data } = await supabase
      .from('bulk_discount_rules')
      .select('*')
      .eq('product_id', productId)
      .order('min_qty', { ascending: true });
    setRules((data ?? []) as (Rule & { id: string })[]);
  };

  useEffect(() => { fetchRules(); }, [productId]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.min_qty || !draft.discount_pct) { toast.error('Min qty and discount % are required'); return; }
    setSaving(true);
    const { error } = await supabase.from('bulk_discount_rules').insert({
      product_id: productId,
      company_id: companyId,
      min_qty: parseInt(draft.min_qty),
      max_qty: draft.max_qty ? parseInt(draft.max_qty) : null,
      discount_pct: parseFloat(draft.discount_pct),
      label: draft.label || `${draft.discount_pct}% off from ${draft.min_qty} ${moqUnit}`,
      is_active: true,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Bulk discount rule added!');
    setDraft(emptyRule());
    setShowAdd(false);
    fetchRules();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('bulk_discount_rules').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Rule removed');
    fetchRules();
  };

  return (
    <Card className="mt-4">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Percent className="w-3.5 h-3.5 text-primary" /> Bulk Discount Rules
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">Set quantity-based price breaks for buyers</CardDescription>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowAdd(p => !p)}
            className="text-xs border border-primary/30 text-primary hover:bg-primary/10 gap-1 h-7"
          >
            <Plus className="w-3 h-3" /> Add Rule
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        {/* Existing rules */}
        {rules.length === 0 && !showAdd ? (
          <p className="text-xs text-muted-foreground py-2 text-center">
            No discount rules yet. Add quantity breaks to attract bulk buyers.
          </p>
        ) : (
          <div className="space-y-2 mb-3">
            {rules.map(r => (
              <div key={r.id} className="flex items-center gap-2 bg-muted/40 rounded-lg px-3 py-2">
                <Tag className="w-3.5 h-3.5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground">
                    {r.min_qty}{r.max_qty ? `–${r.max_qty}` : '+'} {moqUnit}
                    <span className="text-primary ml-2">{r.discount_pct}% off</span>
                  </p>
                  {r.label && <p className="text-[10px] text-muted-foreground truncate">{r.label}</p>}
                </div>
                <CheckCircle2 className="w-3 h-3 text-[#FF7A2E] shrink-0" />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDelete(r.id)}
                  className="h-6 w-6 p-0 text-destructive hover:bg-destructive/10 shrink-0"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Add form */}
        {showAdd && (
          <form onSubmit={handleAdd} className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-3">
            <p className="text-xs font-semibold text-primary">New Discount Rule</p>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-[10px] text-muted-foreground">Min Qty *</Label>
                <Input
                  type="number" min="1" required
                  value={draft.min_qty}
                  onChange={e => setDraft(p => ({ ...p, min_qty: e.target.value }))}
                  placeholder="100"
                  className="h-8 text-xs bg-input border-border"
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Max Qty</Label>
                <Input
                  type="number" min="1"
                  value={draft.max_qty}
                  onChange={e => setDraft(p => ({ ...p, max_qty: e.target.value }))}
                  placeholder="500"
                  className="h-8 text-xs bg-input border-border"
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Discount % *</Label>
                <Input
                  type="number" min="0.1" max="80" step="0.5" required
                  value={draft.discount_pct}
                  onChange={e => setDraft(p => ({ ...p, discount_pct: e.target.value }))}
                  placeholder="10"
                  className="h-8 text-xs bg-input border-border"
                />
              </div>
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Label (optional)</Label>
              <Input
                value={draft.label}
                onChange={e => setDraft(p => ({ ...p, label: e.target.value }))}
                placeholder="e.g. Wholesale Rate"
                className="h-8 text-xs bg-input border-border"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={saving} size="sm" className="flex-1 h-8 text-xs bg-[#C94400] text-primary-foreground">
                {saving ? <RefreshCw className="w-3 h-3 animate-spin" /> : 'Save Rule'}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setShowAdd(false)} className="h-8 text-xs border border-border">
                Cancel
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
