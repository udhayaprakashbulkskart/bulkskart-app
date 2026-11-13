import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import MainLayout from '@/components/layouts/MainLayout';
import PageMeta from '@/components/common/PageMeta';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import { toast } from 'sonner';
import {
  Truck, Plane, Ship, Train, Package, MapPin, Clock,
  Calculator, CheckCircle2, Send, ArrowRight, Info,
} from 'lucide-react';

const MODES = [
  { value: 'road', label: 'Road / Truck', icon: Truck, eta: '2–7 days', note: 'Best for domestic' },
  { value: 'rail', label: 'Rail / Train', icon: Train, eta: '3–8 days', note: 'Cost-effective bulk' },
  { value: 'sea', label: 'Sea Freight', icon: Ship, eta: '15–45 days', note: 'International bulk' },
  { value: 'air', label: 'Air Freight', icon: Plane, eta: '1–5 days', note: 'Fastest, premium' },
  { value: 'multimodal', label: 'Multimodal', icon: Package, eta: 'Varies', note: 'Combined modes' },
];

const INCOTERMS = ['EXW', 'FCA', 'FOB', 'CIF', 'DAP', 'DDP', 'CPT', 'CIP'];

const CARGO_TYPES = ['General Cargo', 'Hazardous Material', 'Perishable Goods', 'Oversized/Heavy', 'Liquid Bulk', 'Dry Bulk', 'Refrigerated', 'Fragile / High Value'];

interface FormState {
  originCity: string;
  originCountry: string;
  destCity: string;
  destCountry: string;
  cargoType: string;
  weightKg: string;
  volumeCbm: string;
  shipmentMode: string;
  incoterms: string;
}

interface EstimateResult {
  mode: string;
  costMin: number;
  costMax: number;
  daysMin: number;
  daysMax: number;
}

function estimateCost(form: FormState): EstimateResult[] {
  const w = parseFloat(form.weightKg) || 100;
  const v = parseFloat(form.volumeCbm) || 1;
  const isInternational = form.originCountry !== form.destCountry;

  const results: EstimateResult[] = MODES.filter(m => {
    if (m.value === 'sea' && !isInternational) return false;
    if (form.shipmentMode !== 'all' && form.shipmentMode !== m.value) return false;
    return true;
  }).map(m => {
    let base = w * (isInternational ? 120 : 40);
    let mult = 1;
    if (m.value === 'air') mult = 6;
    else if (m.value === 'sea') mult = 0.5;
    else if (m.value === 'rail') mult = 0.7;
    else if (m.value === 'multimodal') mult = 1.3;

    const cbmFactor = v * 500 * mult;
    const cost = Math.max(base * mult, cbmFactor);
    const days = m.value === 'air' ? [1, 5] : m.value === 'sea' ? [15, 45] : m.value === 'rail' ? [3, 8] : m.value === 'road' ? [2, 7] : [5, 20];
    return { mode: m.value, costMin: Math.round(cost * 0.85), costMax: Math.round(cost * 1.15), daysMin: days[0], daysMax: days[1] };
  });

  return results;
}

export default function ShippingCalculatorPage() {
  const { user } = useAuth();
  const [form, setForm] = useState<FormState>({
    originCity: '', originCountry: 'India',
    destCity: '', destCountry: '',
    cargoType: 'General Cargo', weightKg: '', volumeCbm: '',
    shipmentMode: 'all', incoterms: 'FOB',
  });
  const [results, setResults] = useState<EstimateResult[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [rfqSent, setRfqSent] = useState(false);

  const set = (k: keyof FormState, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleCalculate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.originCity || !form.destCity || !form.destCountry) {
      toast.error('Please fill in origin and destination');
      return;
    }
    setResults(estimateCost(form));
  };

  const handleFreightRFQ = async () => {
    if (!user) { toast.error('Please log in to send a freight RFQ'); return; }
    setSubmitting(true);
    const { error } = await supabase.from('shipping_quotes').insert({
      requester_id: user.id,
      origin_city: form.originCity,
      origin_country: form.originCountry,
      destination_city: form.destCity,
      destination_country: form.destCountry,
      cargo_type: form.cargoType,
      weight_kg: parseFloat(form.weightKg) || null,
      volume_cbm: parseFloat(form.volumeCbm) || null,
      shipment_mode: form.shipmentMode !== 'all' ? form.shipmentMode : null,
      incoterms: form.incoterms,
      status: 'pending',
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    setRfqSent(true);
    toast.success('Freight RFQ sent to logistics partners!');
  };

  const modeIcon = (mode: string) => {
    const m = MODES.find(x => x.value === mode);
    if (!m) return Truck;
    return m.icon;
  };

  return (
    <MainLayout>
      <PageMeta
        title="Shipping & Freight Quote Calculator | BulkSkart Logistics"
        description="Every BulkSkart order includes free delivery. Compare the freight cost the platform covers for road, rail, sea, and air, then place the order with a ₹0 delivery charge."
        keywords="shipping calculator, freight quote, ocean freight calculator, air cargo rates, B2B shipping estimator"
        canonical="/shipping-calculator"
        ogType="website"
        breadcrumbs={[
          { name: 'Home', item: '/' },
          { name: 'Shipping Calculator', item: '/shipping-calculator' },
        ]}
      />
      <div className="max-w-5xl mx-auto px-4 py-8 md:py-12">
        <div className="bs-glass mb-8 rounded-3xl p-6 text-center">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-primary">Logistics</p>
          <h1 className="text-2xl md:text-3xl font-black text-foreground mb-2">Shipping & Freight Calculator</h1>
          <p className="text-muted-foreground text-sm md:text-base max-w-xl mx-auto">
            Delivery is free on every order placed on BulkSkart. These estimates show the freight cost the platform covers, so you can compare routes before you order.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
            <Truck className="h-3.5 w-3.5" />
            Your delivery charge on every order: ₹0
          </div>
        </div>

        <div className="grid md:grid-cols-5 gap-6">
          {/* Form */}
          <div className="md:col-span-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-primary" /> Calculate Shipping Cost
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCalculate} className="space-y-4">
                  {/* Origin */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1"><MapPin className="w-3 h-3" /> Origin</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">City / Port</Label>
                        <Input value={form.originCity} onChange={e => set('originCity', e.target.value)} placeholder="Mumbai" required className="bg-input border-border mt-0.5" />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Country</Label>
                        <Input value={form.originCountry} onChange={e => set('originCountry', e.target.value)} placeholder="India" className="bg-input border-border mt-0.5" />
                      </div>
                    </div>
                  </div>
                  {/* Destination */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1"><MapPin className="w-3 h-3" /> Destination</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">City / Port</Label>
                        <Input value={form.destCity} onChange={e => set('destCity', e.target.value)} placeholder="Dubai" required className="bg-input border-border mt-0.5" />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Country</Label>
                        <Input value={form.destCountry} onChange={e => set('destCountry', e.target.value)} placeholder="UAE" required className="bg-input border-border mt-0.5" />
                      </div>
                    </div>
                  </div>
                  {/* Cargo */}
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">Weight (kg)</Label>
                      <Input type="number" min="0" value={form.weightKg} onChange={e => set('weightKg', e.target.value)} placeholder="500" className="bg-input border-border mt-0.5" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Volume (CBM)</Label>
                      <Input type="number" min="0" value={form.volumeCbm} onChange={e => set('volumeCbm', e.target.value)} placeholder="2.5" className="bg-input border-border mt-0.5" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Incoterms</Label>
                      <Select value={form.incoterms} onValueChange={v => set('incoterms', v)}>
                        <SelectTrigger className="bg-input border-border mt-0.5 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-card border-border">
                          {INCOTERMS.map(t => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">Cargo Type</Label>
                      <Select value={form.cargoType} onValueChange={v => set('cargoType', v)}>
                        <SelectTrigger className="bg-input border-border mt-0.5 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-card border-border">
                          {CARGO_TYPES.map(t => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Preferred Mode</Label>
                      <Select value={form.shipmentMode} onValueChange={v => set('shipmentMode', v)}>
                        <SelectTrigger className="bg-input border-border mt-0.5 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-card border-border">
                          <SelectItem value="all" className="text-xs">All Modes</SelectItem>
                          {MODES.map(m => <SelectItem key={m.value} value={m.value} className="text-xs">{m.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90 gap-2">
                    <Calculator className="w-4 h-4" /> Calculate Estimates
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Results */}
          <div className="md:col-span-2 space-y-4">
            {results === null ? (
              <Card className="h-full">
                <CardContent className="flex flex-col items-center justify-center h-full py-12 text-center">
                  <Truck className="w-10 h-10 text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">Fill the form and click Calculate to see estimated shipping costs</p>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="space-y-3">
                  {results.map(r => {
                    const Icon = modeIcon(r.mode);
                    const modeInfo = MODES.find(m => m.value === r.mode);
                    return (
                      <Card key={r.mode} className="hover:border-primary/30 transition-colors">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                <Icon className="w-4 h-4 text-primary" />
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-foreground">{modeInfo?.label}</p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <Clock className="w-3 h-3 text-muted-foreground" />
                                  <span className="text-xs text-muted-foreground">{r.daysMin}–{r.daysMax} days</span>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">You pay ₹0</p>
                              <p className="text-[10px] text-muted-foreground line-through">Market ₹{r.costMin.toLocaleString()}–{r.costMax.toLocaleString()}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
                <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-2.5">
                  <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>Market ranges are the freight BulkSkart covers. Your delivery charge on an order placed here is ₹0. Carrier rates still vary by route and cargo.</span>
                </div>
                {rfqSent ? (
                  <div className="flex items-center gap-2 bg-green-50 dark:bg-green-950/20 border border-green-300/50 rounded-xl p-3">
                    <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                    <p className="text-sm text-green-700 dark:text-green-400">Freight RFQ sent! Logistics partners will contact you shortly.</p>
                  </div>
                ) : (
                  <Button onClick={handleFreightRFQ} disabled={submitting} className="w-full bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 gap-2 text-sm" variant="ghost">
                    <Send className="w-4 h-4" />
                    {submitting ? 'Sending…' : 'Get Real Quotes from Logistics Partners'}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {/* How it works */}
        <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { step: '1', title: 'Enter Shipment Details', desc: 'Origin, destination, weight, volume' },
            { step: '2', title: 'Get Instant Estimates', desc: 'Compare road, air, sea & rail costs' },
            { step: '3', title: 'Submit Freight RFQ', desc: 'Send to verified logistics partners' },
            { step: '4', title: 'Choose Best Offer', desc: 'Compare and book directly' },
          ].map(s => (
            <div key={s.step} className="bg-card border border-border rounded-xl p-4 text-center">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm flex items-center justify-center mx-auto mb-2">{s.step}</div>
              <p className="text-sm font-semibold text-foreground">{s.title}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </MainLayout>
  );
}
