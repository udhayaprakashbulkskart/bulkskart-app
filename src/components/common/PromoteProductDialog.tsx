/**
 * PromoteProductDialog
 *
 * 3-step promotion flow with responsive layout, GST tax calculations,
 * authentic estimated labels, and real Razorpay payment gateway integration.
 *
 * Step 1 — Select Promotion Type (Featured Product, Boost Product, Promotion Campaign)
 * Step 2 — Duration & Budget selection (7, 15, 30 Days) with cleanly labeled estimates
 * Step 3 — Clean Order Summary (Product, Type, Duration, Base Price, GST, Total Payable) & Razorpay checkout
 */
import React, { useState, useMemo } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Star, Zap, BarChart2, Check, ChevronRight, ArrowLeft,
  TrendingUp, CreditCard,
  CheckCircle, Globe, Tag, Clock, ShieldCheck, Loader2
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRazorpay } from '@/hooks/useRazorpay';
import { toast } from 'sonner';
import type { Product } from '@/types/types';
import { PROMOTION_PLANS, promotionTotal, type DurationDays, type PlanOption, type PromotionType } from '@/lib/promotionPlans';

const PLANS = PROMOTION_PLANS;

const PROMOTION_TYPES: {
  type: PromotionType;
  icon: React.ReactNode;
  label: string;
  tagline: string;
  desc: string;
  badge: string;
  badgeColor: string;
}[] = [
  {
    type: 'featured',
    icon: <Star className="w-5 h-5 text-[#FF5A00]" />,
    label: 'Featured Product',
    tagline: 'Featured Products Spotlight',
    desc: 'Your product is shown in the Featured Products sections and carries a "Featured" badge on product listings.',
    badge: 'Featured',
    badgeColor: 'bg-[#FF5A00]/15 text-[#FF5A00] border-[#FF5A00]/30',
  },
  {
    type: 'boost',
    icon: <Zap className="w-5 h-5 text-orange-500" />,
    label: 'Boost Product',
    tagline: 'Sponsored Badge',
    desc: 'Your product carries a "Sponsored" badge on product listings, so buyers browsing the category notice it.',
    badge: 'Sponsored',
    badgeColor: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  },
  {
    type: 'campaign',
    icon: <BarChart2 className="w-5 h-5 text-orange-400" />,
    label: 'Promotion Campaign',
    tagline: 'Featured + Sponsored',
    desc: 'Both together: Featured Products placement and the "Sponsored" badge. The country and category you aim at are saved with the campaign.',
    badge: 'Campaign',
    badgeColor: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  },
];

const COUNTRIES = ['India', 'United States', 'United Arab Emirates', 'United Kingdom', 'Germany', 'Australia', 'Canada', 'Saudi Arabia', 'Singapore', 'Malaysia'];
const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  product: Product;
  companyId: string;
  onSuccess: () => void;
}

export default function PromoteProductDialog({ open, onOpenChange, product, companyId, onSuccess }: Props) {
  const { user, profile } = useAuth();
  const { startPromotionCheckout, loading: rzpLoading } = useRazorpay();

  const [step, setStep]                     = useState<1 | 2 | 3>(1);
  const [promoType, setPromoType]           = useState<PromotionType>('featured');
  const [selectedDays, setSelectedDays]     = useState<DurationDays>(7);
  const [targetCategory, setTargetCategory] = useState('');
  const [targetCountry, setTargetCountry]   = useState('All Countries');
  const [dailyBudget, setDailyBudget]       = useState('');
  const [totalBudget, setTotalBudget]       = useState('');
  const [paidSuccess, setPaidSuccess]       = useState(false);

  const selectedPlan = useMemo<PlanOption>(() => {
    return PLANS[promoType].find(p => p.days === selectedDays) ?? PLANS[promoType][0];
  }, [promoType, selectedDays]);

  // Tax calculations (18% GST)
  const basePrice = selectedPlan.basePrice;
  const { gst: gstAmount, total: totalPayable } = promotionTotal(basePrice);

  const reset = () => {
    setStep(1);
    setPromoType('featured');
    setSelectedDays(7);
    setTargetCategory('');
    setTargetCountry('All Countries');
    setDailyBudget('');
    setTotalBudget('');
    setPaidSuccess(false);
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const handlePayWithRazorpay = async () => {
    if (!product?.id || !companyId) {
      toast.error('Missing product or company profile');
      return;
    }

    startPromotionCheckout({
      company_id: companyId,
      product_id: product.id,
      product_name: product.name,
      promotion_type: promoType,
      duration_days: selectedDays,
      base_amount: basePrice,
      gst_amount: gstAmount,
      total_amount: totalPayable,
      target_category: targetCategory || undefined,
      target_country: targetCountry || 'All Countries',
      user_name: profile?.full_name || user?.email?.split('@')[0] || '',
      user_email: user?.email || '',
      user_phone: profile?.phone || '',
      onSuccess: () => {
        setPaidSuccess(true);
        setTimeout(() => {
          handleClose(false);
          onSuccess();
        }, 1600);
      },
      onError: (errMsg) => {
        toast.error(`Promotion payment failed: ${errMsg}`);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-xl bg-card border-border p-4 sm:p-6 max-h-[90dvh] overflow-y-auto">
        <DialogHeader className="space-y-1">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <DialogTitle className="text-foreground text-base sm:text-lg font-bold flex items-center gap-2">
              <Star className="w-4 h-4 text-[#FF5A00] shrink-0" />
              <span>Promote Product</span>
            </DialogTitle>
            <Badge variant="outline" className="text-xs max-w-[200px] truncate text-muted-foreground border-border">
              {product.name}
            </Badge>
          </div>
        </DialogHeader>

        {/* 3-Step Progress Indicator */}
        <div className="flex items-center justify-between gap-1.5 py-3 border-b border-border mb-3">
          {[
            { num: 1, label: 'Type' },
            { num: 2, label: 'Duration' },
            { num: 3, label: 'Summary & Pay' },
          ].map(s => {
            const isActive = step === s.num;
            const isDone = step > s.num;
            return (
              <div key={s.num} className="flex items-center gap-1.5 flex-1 justify-center sm:justify-start">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all shrink-0 ${
                    isActive
                      ? 'bg-[#FF5A00] text-white shadow-md'
                      : isDone
                        ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {isDone ? <Check className="w-3.5 h-3.5" /> : s.num}
                </div>
                <span
                  className={`text-xs font-medium truncate ${
                    isActive ? 'text-foreground font-semibold' : 'text-muted-foreground'
                  }`}
                >
                  {s.label}
                </span>
                {s.num < 3 && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 hidden sm:block ml-auto" />}
              </div>
            );
          })}
        </div>

        {/* ── STEP 1: Promotion Type Selection ──────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Select the promotional placement tier for <span className="font-semibold text-foreground">{product.name}</span>:
            </p>

            <div className="space-y-2.5">
              {PROMOTION_TYPES.map(pt => {
                const isSelected = promoType === pt.type;
                return (
                  <div
                    key={pt.type}
                    onClick={() => setPromoType(pt.type)}
                    className={`cursor-pointer rounded-xl p-3.5 border transition-all flex items-start gap-3 ${
                      isSelected
                        ? 'border-[#FF5A00] bg-[#FF5A00]/5 ring-1 ring-[#FF5A00]/30'
                        : 'border-border bg-card/50 hover:border-[#FF5A00]/40 hover:bg-muted/30'
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                        isSelected ? 'bg-[#FF5A00]/15' : 'bg-muted'
                      }`}
                    >
                      {pt.icon}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-foreground">{pt.label}</p>
                          <Badge className={`text-[10px] border px-1.5 py-0 ${pt.badgeColor}`}>{pt.badge}</Badge>
                        </div>
                        <span className="text-[11px] font-semibold text-[#FF5A00]">
                          From {fmt(PLANS[pt.type][0].basePrice)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{pt.desc}</p>
                    </div>

                    <div className="shrink-0 mt-1">
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          isSelected ? 'border-[#FF5A00] bg-[#FF5A00]' : 'border-muted-foreground/40'
                        }`}
                      >
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <Button
              onClick={() => setStep(2)}
              className="w-full h-10 bg-[#FF5A00] hover:bg-[#e04f00] text-white font-bold text-xs sm:text-sm mt-3 gap-2 rounded-xl"
            >
              Continue to Duration &amp; Budget <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* ── STEP 2: Duration, Budget & Targeting ───────────────────────────── */}
        {step === 2 && (
          <div className="space-y-4">
            {/* Duration Cards */}
            <div>
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-2.5">
                <Clock className="w-3.5 h-3.5 text-[#FF5A00]" /> Select Promotion Duration
              </Label>
              <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
                {PLANS[promoType].map(plan => {
                  const isSelected = selectedDays === plan.days;
                  return (
                    <div
                      key={plan.days}
                      onClick={() => setSelectedDays(plan.days)}
                      className={`cursor-pointer p-3 rounded-xl border text-center transition-all flex flex-col justify-between ${
                        isSelected
                          ? 'border-[#FF5A00] bg-[#FF5A00]/10 ring-1 ring-[#FF5A00]/40'
                          : 'border-border bg-card/60 hover:border-[#FF5A00]/30'
                      }`}
                    >
                      <div>
                        <p className="text-xs sm:text-sm font-bold text-foreground">{plan.label}</p>
                        <p className="text-sm sm:text-base font-black text-[#FF5A00] mt-0.5">{fmt(plan.basePrice)}</p>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1.5 font-medium">+18% GST</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* What the promotion changes. No reach numbers: views and leads are not promised or estimated. */}
            <div className="bg-muted/40 border border-border rounded-xl p-3.5 space-y-1.5">
              <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-[#FF5A00]" /> What you get for {selectedPlan.days} days
              </p>
              <ul className="text-[11px] text-muted-foreground space-y-1 list-disc pl-4">
                {(promoType === 'featured' || promoType === 'campaign') && (
                  <li>Shown in the Featured Products sections, with a "Featured" badge.</li>
                )}
                {(promoType === 'boost' || promoType === 'campaign') && (
                  <li>A "Sponsored" badge on your product in product listings.</li>
                )}
                <li>Starts as soon as the payment is confirmed.</li>
              </ul>
              <p className="text-[10px] text-muted-foreground">
                We do not estimate or promise a number of views, clicks or leads.
              </p>
            </div>

            {/* Campaign-Specific Filters */}
            {promoType === 'campaign' && (
              <div className="space-y-3 bg-card/60 border border-border rounded-xl p-3.5">
                <p className="text-xs font-bold text-foreground">Targeting Parameters</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <Tag className="w-3 h-3 text-[#FF5A00]" /> Target Category
                    </Label>
                    <Input
                      value={targetCategory}
                      onChange={e => setTargetCategory(e.target.value)}
                      placeholder="e.g. Textiles, Electronics"
                      className="bg-input border-border text-xs h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <Globe className="w-3 h-3 text-[#FF5A00]" /> Target Country
                    </Label>
                    <Select value={targetCountry} onValueChange={setTargetCountry}>
                      <SelectTrigger className="bg-input border-border h-9 text-xs">
                        <SelectValue placeholder="All Countries" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        <SelectItem value="All Countries">All Countries</SelectItem>
                        {COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Daily Budget (Optional)</Label>
                    <Input
                      type="number"
                      value={dailyBudget}
                      onChange={e => setDailyBudget(e.target.value)}
                      placeholder="e.g. 500"
                      className="bg-input border-border text-xs h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Total Budget (Optional)</Label>
                    <Input
                      type="number"
                      value={totalBudget}
                      onChange={e => setTotalBudget(e.target.value)}
                      placeholder={String(selectedPlan.basePrice)}
                      className="bg-input border-border text-xs h-9"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                className="gap-1.5 text-xs h-9 border-border"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </Button>
              <Button
                onClick={() => setStep(3)}
                className="flex-1 h-9 bg-[#FF5A00] hover:bg-[#e04f00] text-white font-bold text-xs gap-2 rounded-xl"
              >
                Review Order &amp; Pay <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Order Summary & Razorpay Payment ──────────────────────── */}
        {step === 3 && (
          <div className="space-y-4">
            {paidSuccess ? (
              <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
                <div className="w-14 h-14 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center border border-orange-500/30">
                  <CheckCircle className="w-7 h-7" />
                </div>
                <h3 className="text-base font-bold text-foreground">Promotion Activated!</h3>
                <p className="text-xs text-muted-foreground max-w-sm">
                  Payment verified successfully. &quot;{product.name}&quot; is now promoted for {selectedDays} days across BulkSkart.
                </p>
              </div>
            ) : (
              <>
                {/* Clean 6-Item Order Summary */}
                <div className="bg-muted/30 border border-border rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-border">
                    <span className="text-xs font-bold text-foreground uppercase tracking-wider">Order Summary</span>
                    <Badge variant="outline" className="text-[10px] text-[#FF5A00] border-[#FF5A00]/30 bg-[#FF5A00]/10">
                      Razorpay Live Gateway
                    </Badge>
                  </div>

                  <div className="space-y-2 text-xs">
                    {/* 1. Product */}
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-muted-foreground shrink-0">Product:</span>
                      <span className="text-foreground font-semibold text-right truncate max-w-[240px]">
                        {product.name}
                      </span>
                    </div>

                    {/* 2. Promotion Type */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Promotion Type:</span>
                      <span className="text-foreground font-semibold">
                        {PROMOTION_TYPES.find(p => p.type === promoType)?.label}
                      </span>
                    </div>

                    {/* 3. Duration */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Duration:</span>
                      <span className="text-foreground font-semibold">{selectedDays} Days</span>
                    </div>

                    {/* Target info if campaign */}
                    {promoType === 'campaign' && targetCountry && targetCountry !== 'All Countries' && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-muted-foreground">Target Country:</span>
                        <span className="text-foreground font-medium">{targetCountry}</span>
                      </div>
                    )}

                    {/* 4. Base Price */}
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
                      <span className="text-muted-foreground">Base Price:</span>
                      <span className="text-foreground font-semibold">{fmt(basePrice)}</span>
                    </div>

                    {/* 5. GST / Tax */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">GST (18%):</span>
                      <span className="text-foreground font-semibold">{fmt(gstAmount)}</span>
                    </div>

                    {/* 6. Total Payable */}
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/80">
                      <span className="text-sm font-bold text-foreground">Total Payable:</span>
                      <span className="text-base font-black text-[#FF5A00]">{fmt(totalPayable)}</span>
                    </div>
                  </div>
                </div>

                {/* Gateway Assurance */}
                <div className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground">Secure Razorpay Payment</p>
                    <p className="text-[11px] text-muted-foreground">
                      UPI, Cards, Net Banking accepted. Campaign activates immediately upon payment verification.
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <Button
                    variant="outline"
                    onClick={() => setStep(2)}
                    disabled={rzpLoading}
                    className="gap-1 text-xs h-10 border-border"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Back
                  </Button>

                  <Button
                    onClick={handlePayWithRazorpay}
                    disabled={rzpLoading}
                    className="flex-1 h-10 bg-[#FF5A00] hover:bg-[#e04f00] text-white font-bold text-xs sm:text-sm gap-2 rounded-xl shadow-md"
                  >
                    {rzpLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Opening Razorpay Checkout…</span>
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-4 h-4" />
                        <span>Pay {fmt(totalPayable)} &amp; Activate</span>
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
