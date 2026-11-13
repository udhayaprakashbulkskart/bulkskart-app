/**
 * AutoQuoteSettingsPanel
 *
 * Embedded panel for the Supplier Profile/Settings page.
 * Lets supplier configure:
 *   - auto_send_enabled (auto-send without review)
 *   - require_approval  (generate + hold for approval)
 *   - default rates, terms, T&C
 *
 * No new page — add <AutoQuoteSettingsPanel /> to existing supplier profile page.
 */
import React, { useEffect, useState } from 'react';
import { supabase } from '@/db/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Zap, Clock, RefreshCw, Info } from 'lucide-react';

interface Settings {
  id?: string;
  company_id: string;
  auto_send_enabled: boolean;
  require_approval: boolean;
  default_validity_days: number;
  default_payment_terms: string;
  default_delivery_days: number;
  shipping_rate_pct: number;
  tax_rate_pct: number;
  other_charges: number;
  terms_and_conditions: string;
}

interface Props {
  companyId: string;
}

const defaults = (companyId: string): Settings => ({
  company_id: companyId,
  auto_send_enabled: false,
  require_approval: true,
  default_validity_days: 30,
  default_payment_terms: 'T/T 30% advance, 70% before shipment',
  default_delivery_days: 14,
  shipping_rate_pct: 5,
  tax_rate_pct: 18,
  other_charges: 0,
  terms_and_conditions: '',
});

export default function AutoQuoteSettingsPanel({ companyId }: Props) {
  const [settings, setSettings] = useState<Settings>(defaults(companyId));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from('supplier_auto_quote_settings')
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setSettings({
            ...defaults(companyId),
            ...data,
            shipping_rate_pct: Number(data.shipping_rate_pct ?? 5),
            tax_rate_pct: Number(data.tax_rate_pct ?? 18),
            other_charges: Number(data.other_charges ?? 0),
          });
        }
        setLoading(false);
      });
  }, [companyId]);

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) =>
    setSettings(prev => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      company_id: companyId,
      auto_send_enabled: settings.auto_send_enabled,
      require_approval: settings.require_approval,
      default_validity_days: Number(settings.default_validity_days) || 30,
      default_payment_terms: settings.default_payment_terms || null,
      default_delivery_days: Number(settings.default_delivery_days) || 14,
      shipping_rate_pct: Number(settings.shipping_rate_pct) || 5,
      tax_rate_pct: Number(settings.tax_rate_pct) || 18,
      other_charges: Number(settings.other_charges) || 0,
      terms_and_conditions: settings.terms_and_conditions || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = settings.id
      ? await supabase.from('supplier_auto_quote_settings').update(payload).eq('id', settings.id)
      : await supabase.from('supplier_auto_quote_settings').upsert({ ...payload }, { onConflict: 'company_id' }).select('id').single()
          .then(async res => {
            if (res.data?.id) set('id', res.data.id);
            return res;
          });

    setSaving(false);
    if (error) { toast.error('Failed to save settings: ' + error.message); return; }
    toast.success('Auto-quote settings saved!');
  };

  if (loading) {
    return (
      <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
        <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Loading…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toggle row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Auto-send */}
        <div className={`flex items-start gap-3 rounded-xl border p-4 transition-colors ${settings.auto_send_enabled ? 'border-primary/40 bg-primary/5' : 'border-border bg-muted/20'}`}>
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">Auto-Send Quotations</p>
              <Switch
                checked={settings.auto_send_enabled}
                onCheckedChange={v => {
                  set('auto_send_enabled', v);
                  if (v) set('require_approval', false);
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Automatically generate and send quotes to matching buyers — no manual review required.
            </p>
          </div>
        </div>

        {/* Require approval */}
        <div className={`flex items-start gap-3 rounded-xl border p-4 transition-colors ${settings.require_approval && !settings.auto_send_enabled ? 'border-[#FF5A00]/40 bg-[#FF5A00]/30' : 'border-border bg-muted/20'}`}>
          <div className="w-9 h-9 rounded-full bg-[#FF5A00]/10 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4 text-[#FF7A2E]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">Require Approval Before Sending</p>
              <Switch
                checked={settings.require_approval && !settings.auto_send_enabled}
                disabled={settings.auto_send_enabled}
                onCheckedChange={v => set('require_approval', v)}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              System generates a draft quote — you review and click "Approve & Send" before it reaches the buyer.
            </p>
          </div>
        </div>
      </div>

      {/* Mode summary */}
      <div className="flex items-start gap-2 text-xs bg-muted/30 border border-border rounded-lg px-3 py-2.5">
        <Info className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-muted-foreground">
          {settings.auto_send_enabled
            ? '✅ Quotations will be generated and sent to buyers immediately when a new matching RFQ is posted.'
            : settings.require_approval
            ? '⏳ Quotations will be generated automatically and held in your RFQ queue for review before sending.'
            : '⚠️ Enable at least one option above to activate automatic quotations.'}
        </p>
      </div>

      {/* Default values */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Validity (days)</Label>
          <Input
            type="number" min={1}
            value={settings.default_validity_days}
            onChange={e => set('default_validity_days', Number(e.target.value))}
            className="bg-input border-border h-9 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Delivery (days)</Label>
          <Input
            type="number" min={1}
            value={settings.default_delivery_days}
            onChange={e => set('default_delivery_days', Number(e.target.value))}
            className="bg-input border-border h-9 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Shipping % of subtotal</Label>
          <Input
            type="number" min={0} max={100} step={0.5}
            value={settings.shipping_rate_pct}
            onChange={e => set('shipping_rate_pct', Number(e.target.value))}
            className="bg-input border-border h-9 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Tax (GST %)</Label>
          <Input
            type="number" min={0} max={100} step={0.5}
            value={settings.tax_rate_pct}
            onChange={e => set('tax_rate_pct', Number(e.target.value))}
            className="bg-input border-border h-9 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Other Fixed Charges (₹)</Label>
          <Input
            type="number" min={0}
            value={settings.other_charges}
            onChange={e => set('other_charges', Number(e.target.value))}
            className="bg-input border-border h-9 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Default Payment Terms</Label>
          <Input
            value={settings.default_payment_terms}
            onChange={e => set('default_payment_terms', e.target.value)}
            placeholder="e.g. T/T 30% advance"
            className="bg-input border-border h-9 text-sm"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Terms & Conditions (included in every auto-quote)</Label>
        <Textarea
          value={settings.terms_and_conditions}
          onChange={e => set('terms_and_conditions', e.target.value)}
          rows={3}
          placeholder="e.g. All prices are subject to change. Goods once sold cannot be returned unless defective…"
          className="bg-input border-border text-sm resize-none"
        />
      </div>

      <Button
        onClick={handleSave}
        disabled={saving}
        className="bg-[#C94400] text-primary-foreground hover:bg-primary/90 gap-2 h-9 px-5"
      >
        {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
        {saving ? 'Saving…' : 'Save Auto-Quote Settings'}
      </Button>
    </div>
  );
}
