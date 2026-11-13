import React, { useEffect, useState } from 'react';
import { supabase } from '@/db/supabase';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calculator, Tag, TrendingDown, Zap } from 'lucide-react';

interface DiscountRule {
  id: string;
  min_qty: number;
  max_qty: number | null;
  discount_pct: number;
  label: string | null;
}

interface Props {
  productId: string;
  priceMin: number | null;
  priceMax: number | null;
  moq: number;
  moqUnit: string;
  currency?: string;
}

export default function BulkPriceCalculator({ productId, priceMin, priceMax, moq, moqUnit, currency = 'INR' }: Props) {
  const [rules, setRules] = useState<DiscountRule[]>([]);
  const [qty, setQty] = useState(String(moq || 1));

  useEffect(() => {
    supabase
      .from('bulk_discount_rules')
      .select('*')
      .eq('product_id', productId)
      .eq('is_active', true)
      .order('min_qty', { ascending: true })
      .then(({ data }) => setRules((data ?? []) as DiscountRule[]));
  }, [productId]);

  const basePrice = priceMin ?? 0;

  const getDiscount = (q: number): number => {
    const rule = [...rules]
      .reverse()
      .find(r => q >= r.min_qty && (r.max_qty == null || q <= r.max_qty));
    return rule?.discount_pct ?? 0;
  };

  const qtyNum = parseInt(qty) || moq;
  const discountPct = getDiscount(qtyNum);
  const effectivePrice = basePrice * (1 - discountPct / 100);
  const totalCost = effectivePrice * qtyNum;

  const symMap: Record<string, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£', AED: 'د.إ' };
  const sym = symMap[currency] ?? currency + ' ';

  if (!priceMin) return null;

  return (
    <Card className="border-primary/20 bg-primary/3">
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-sm flex items-center gap-2">
          <Calculator className="w-4 h-4 text-primary" />
          Bulk Price Calculator
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Enter quantity ({moqUnit})</p>
          <Input
            type="number"
            min={moq}
            value={qty}
            onChange={e => setQty(e.target.value)}
            className="bg-input border-border text-sm h-9"
            placeholder={`Min. ${moq}`}
          />
        </div>

        {/* Result */}
        <div className="bg-muted/50 rounded-lg p-3 space-y-1.5">
          {discountPct > 0 ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Base price</span>
                <span className="text-xs line-through text-muted-foreground">{sym}{basePrice.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#FF7A2E] flex items-center gap-1 font-medium">
                  <TrendingDown className="w-3 h-3" /> Bulk discount
                </span>
                <span className="text-xs text-[#FF7A2E] font-semibold">−{discountPct}%</span>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-1.5">
                <span className="text-xs font-semibold text-foreground">Price per {moqUnit}</span>
                <span className="text-sm font-bold text-primary">{sym}{effectivePrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">Price per {moqUnit}</span>
              <span className="text-sm font-bold text-primary">{sym}{basePrice.toLocaleString('en-IN')}</span>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-border pt-1.5">
            <span className="text-xs font-semibold text-foreground">Est. Total ({qtyNum.toLocaleString()} {moqUnit})</span>
            <span className="text-base font-black text-primary">{sym}{totalCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
          </div>
        </div>

        {/* Discount slabs */}
        {rules.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
              Available Discounts
            </p>
            <div className="space-y-1">
              {rules.map(r => {
                const active = qtyNum >= r.min_qty && (r.max_qty == null || qtyNum <= r.max_qty);
                return (
                  <div
                    key={r.id}
                    className={`flex items-center justify-between rounded-md px-2 py-1.5 text-xs transition-colors ${active ? 'bg-[#FF5A00]/10 dark:bg-[#B33D00]/30 border border-[#FF5A00]/50' : 'bg-muted/40'}`}
                  >
                    <span className="flex items-center gap-1.5">
                      <Tag className={`w-3 h-3 ${active ? 'text-[#FF7A2E]' : 'text-muted-foreground'}`} />
                      <span className={active ? 'text-[#FF7A2E] dark:text-[#FF7A2E] font-medium' : 'text-muted-foreground'}>
                        {r.min_qty}{r.max_qty ? `–${r.max_qty}` : '+'} {moqUnit}
                      </span>
                    </span>
                    <span className={`font-bold ${active ? 'text-[#FF7A2E]' : 'text-foreground'}`}>
                      {r.discount_pct}% off
                      {active && <Zap className="w-3 h-3 inline ml-1" />}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <p className="text-[10px] text-muted-foreground">*Estimates based on listed price. Final price confirmed by supplier quotation.</p>
      </CardContent>
    </Card>
  );
}
