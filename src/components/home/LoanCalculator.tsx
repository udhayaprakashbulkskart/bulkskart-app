import { memo, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  Calculator, ArrowRight, Package, Coins, Percent, Receipt, Banknote, Truck, Info, ShoppingCart, FileText, Zap,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useCurrency } from '@/contexts/CurrencyContext';
import LoanRequestForm from '@/components/home/LoanRequestForm';
import {
  DOWN_LIMITS,
  RATE_LIMITS,
  TENURE_LIMITS,
  TENURE_PRESETS,
  loanRange,
  quoteOrderLoan,
} from '@/lib/orderFinance';

interface LoanCalculatorProps {
  tone?: 'landing' | 'page';
}

function currencyFormatter(locale: string, currency: string): Intl.NumberFormat {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    });
  } catch {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    });
  }
}

/** Monthly figure that rolls in whenever the value changes (landing page only). */
function AnimatedValue({ text, landing, className }: { text: string; landing: boolean; className?: string }) {
  const reduce = useReducedMotion();
  if (!landing || reduce) return <span className={className}>{text}</span>;
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={text}
        className={`inline-block ${className ?? ''}`}
        initial={{ opacity: 0, y: 14, filter: 'blur(4px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        exit={{ opacity: 0, y: -14, filter: 'blur(4px)' }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        {text}
      </motion.span>
    </AnimatePresence>
  );
}

function LoanCalculator({ tone = 'page' }: LoanCalculatorProps) {
  const landing = tone === 'landing';
  const reduce = useReducedMotion();
  const { currencyInfo } = useCurrency();
  const currency = currencyInfo.currency || 'INR';
  const locale = currencyInfo.locale || 'en-IN';
  const range = useMemo(() => loanRange(currency), [currency]);

  const [amount, setAmount] = useState(range.defaultAmount);
  const [down, setDown] = useState<number>(DOWN_LIMITS.default);
  const [rate, setRate] = useState<number>(RATE_LIMITS.default);
  const [months, setMonths] = useState<number>(TENURE_LIMITS.default);

  useEffect(() => {
    setAmount(loanRange(currency).defaultAmount);
  }, [currency]);

  const deferredAmount = useDeferredValue(amount);
  const deferredDown = useDeferredValue(down);
  const deferredRate = useDeferredValue(rate);
  const deferredMonths = useDeferredValue(months);
  const quotePending = amount !== deferredAmount || down !== deferredDown || rate !== deferredRate || months !== deferredMonths;

  const quote = useMemo(
    () => quoteOrderLoan({
      orderAmount: deferredAmount,
      downPaymentPct: deferredDown,
      annualRatePct: deferredRate,
      months: deferredMonths,
      currency,
    }),
    [deferredAmount, deferredDown, deferredRate, deferredMonths, currency],
  );

  const format = useMemo(() => currencyFormatter(locale, currency), [locale, currency]);
  const money = (value: number) => format.format(value);

  const repaid = quote.totalPayable > 0 ? quote.totalPayable : 1;
  const principalShare = Math.min(100, Math.max(0, (quote.principal / repaid) * 100));

  if (landing) {
    const pct = Math.min(100, Math.max(0, ((amount - range.min) / Math.max(1, range.max - range.min)) * 100));
    const rows = [
      { icon: Package, label: 'Order Value', value: money(quote.orderAmount), tone: 'text-white' },
      { icon: Coins, label: 'Pay Today', sub: '(Down Payment)', value: money(quote.payToday), tone: 'text-white' },
      { icon: Banknote, label: 'Amount Financed', value: money(quote.principal), tone: 'text-white' },
      { icon: Percent, label: 'Interest over Tenure', value: money(quote.totalInterest), tone: 'text-white' },
      { icon: Receipt, label: 'Total You Repay', value: money(quote.totalPayable), tone: 'text-[#FF7A2E]' },
    ];
    const chipLanding = (active: boolean) =>
      `h-10 rounded-lg border text-sm font-semibold transition-all duration-200 ${
        active
          ? 'border-transparent bg-gradient-to-r from-[#FF7A2E] to-[#E84A00] text-white shadow-[0_8px_20px_-8px_rgba(255,90,0,0.9)]'
          : 'border-white/10 bg-[#0d1218] text-slate-200 hover:border-[#FF5A00]/60 hover:text-white'
      }`;
    const inputLanding = 'h-11 rounded-lg border border-white/10 bg-[#0d1218] px-3 text-white focus-visible:border-[#FF5A00] focus-visible:ring-[#FF5A00]/30';
    return (
      <motion.article
        initial={reduce ? { opacity: 1 } : { opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.15 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-3xl border border-[#FF5A00]/50 bg-gradient-to-b from-[#120a06] via-[#0b0d12] to-[#0a0a0f] p-5 text-white shadow-[0_20px_60px_-24px_rgba(255,90,0,0.6)] sm:p-7"
      >
        {!reduce && (
          <>
          </>
        )}

        <div className="relative grid gap-7 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#FF5A00]/40 bg-[#FF5A00]/15 px-3.5 py-1.5 text-[12px] font-bold uppercase tracking-wider text-[#FF7A2E]">
                <Calculator className="h-4 w-4" />
                Order loan calculator
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-[#FF5A00]/40 bg-[#FF5A00]/10 px-3 py-1.5 text-[12px] font-bold text-[#FF7A2E]">
                <Zap className="h-3.5 w-3.5" />
                Fast loan approval*
              </div>
            </div>
            <h2 className="mt-4 text-[30px] font-black leading-[1.05] tracking-tight sm:text-[40px]">
              See the <span className="text-[#FF5A00]">Monthly Cost</span>
            </h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-300 sm:text-[15px]">
              Plan a bulk order with easy monthly installments. Delivery on that order stays free.
            </p>

            <div className="mt-6 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-200">Order Value</span>
              <AnimatedValue text={money(amount)} landing className="text-lg font-black text-[#FF5A00]" />
            </div>
            <input
              type="range"
              min={range.min}
              max={range.max}
              step={range.step}
              value={amount}
              onChange={(event) => setAmount(event.target.valueAsNumber)}
              aria-label="Order value"
              className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full outline-none [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[#2A2A2A] [&::-webkit-slider-thumb]:bg-[#C94400] [&::-webkit-slider-thumb]:shadow-[0_0_14px_rgba(255,90,0,0.9)]"
              style={{ background: `linear-gradient(to right, #FF5A00 ${pct}%, #2a2f3a ${pct}%)` }}
            />

            <div className="mt-4 grid grid-cols-2 gap-2.5 xl:grid-cols-4">
              {range.presets.map((preset) => (
                <button key={preset} type="button" className={chipLanding(amount === preset)} onClick={() => setAmount(preset)}>
                  {money(preset)}
                </button>
              ))}
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-200">
                  Down Payment %
                  <Info className="h-3.5 w-3.5 text-neutral-400" />
                </span>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={DOWN_LIMITS.min}
                  max={DOWN_LIMITS.max}
                  step={DOWN_LIMITS.step}
                  value={down}
                  onChange={(event) => {
                    const next = event.target.valueAsNumber;
                    if (Number.isFinite(next)) setDown(Math.min(DOWN_LIMITS.max, Math.max(DOWN_LIMITS.min, next)));
                  }}
                  className={`mt-2 ${inputLanding}`}
                  aria-label="Down payment percent"
                />
              </label>
              <label className="block">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-200">
                  Annual Rate %
                  <Info className="h-3.5 w-3.5 text-neutral-400" />
                </span>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={RATE_LIMITS.min}
                  max={RATE_LIMITS.max}
                  step={RATE_LIMITS.step}
                  value={rate}
                  onChange={(event) => {
                    const next = event.target.valueAsNumber;
                    if (Number.isFinite(next)) setRate(Math.min(RATE_LIMITS.max, Math.max(RATE_LIMITS.min, next)));
                  }}
                  className={`mt-2 ${inputLanding}`}
                  aria-label="Annual interest rate percent"
                />
              </label>
            </div>

            <div className="mt-6">
              <span className="text-sm font-semibold text-slate-200">Tenure (Months)</span>
              <div className="mt-2 grid grid-cols-4 gap-2.5" role="group" aria-label="Tenure presets">
                {TENURE_PRESETS.map((preset) => (
                  <button key={preset} type="button" className={chipLanding(months === preset)} onClick={() => setMonths(preset)}>
                    {preset} mo
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div
            className={`relative self-start rounded-2xl border-2 border-[#FF5A00]/60 bg-[#0A0A0A]/45 p-5 shadow-[0_0_34px_-8px_rgba(255,90,0,0.7)] transition-opacity ${quotePending ? 'opacity-80' : 'opacity-100'}`}
            aria-live="polite"
          >
            <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-slate-300">Monthly Installment</p>
            <p className="mt-2 flex flex-wrap items-baseline gap-2 text-white">
              <AnimatedValue text={money(quote.emi)} landing className="text-[40px] font-black leading-none tracking-tight sm:text-[46px]" />
              <span className="text-base font-semibold text-slate-300">/ month</span>
            </p>

            <dl className="mt-5 divide-y divide-white/10 overflow-hidden rounded-xl border border-white/10 bg-[#161616]/[0.02]">
              {rows.map(({ icon: Icon, label, sub, value, tone }) => (
                <div key={label} className="flex items-center justify-between gap-3 px-3.5 py-3">
                  <dt className="flex items-center gap-3 text-sm text-slate-300">
                    <Icon className="h-4 w-4 shrink-0 text-[#FF5A00]" />
                    <span>
                      {label}
                      {sub && <span className="block text-[11px] text-neutral-400">{sub}</span>}
                    </span>
                  </dt>
                  <dd className={`text-sm font-bold tabular-nums ${tone}`}>{value}</dd>
                </div>
              ))}
              <div className="flex items-center justify-between gap-3 px-3.5 py-3">
                <dt className="flex items-center gap-3 text-sm text-slate-300">
                  <Truck className="h-4 w-4 shrink-0 text-[#FF5A00]" />
                  Delivery Fee
                </dt>
                <dd>
                  <span className="rounded-full bg-[#B33D00] px-3 py-1 text-xs font-extrabold text-white shadow-[0_0_14px_-2px_rgba(16,185,129,0.8)]">Free</span>
                </dd>
              </div>
            </dl>

            <div className="mt-4">
              <div className="flex h-2 overflow-hidden rounded-full bg-[#0A0A0A]">
                <motion.div className="h-full bg-gradient-to-r from-[#FF7A2E] to-[#E84A00]" animate={{ width: `${principalShare}%` }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }} />
                <motion.div className="h-full bg-gradient-to-r from-[#2A1205] to-[#B33D00]" animate={{ width: `${100 - principalShare}%` }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }} />
              </div>
              <div className="mt-1.5 flex justify-between text-[10px] font-semibold text-neutral-400">
                <span>Financed</span>
                <span>Interest</span>
              </div>
            </div>
          </div>
        </div>

        <LoanRequestForm tone={tone} currency={currency} quote={quote} money={money} />

        <p className="mt-4 text-[11px] leading-relaxed text-neutral-400">
          *Fast loan approval is subject to review by the financing partner. Illustrative installment for planning an order. It is not a credit offer or approval. Final terms depend on the financing partner. Delivery stays free on every order placed on BulkSkart.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Link
            to="/products"
            className="group inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#FF7A2E] to-[#E84A00] px-5 text-base font-bold text-white shadow-[0_12px_30px_-10px_rgba(255,90,0,0.9)] transition-transform hover:-translate-y-0.5 active:scale-[0.99]"
          >
            <ShoppingCart className="h-5 w-5" />
            Place This Order
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            to="/post-requirement"
            className="group inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/20 px-5 text-base font-bold text-white transition-colors hover:border-[#FF5A00] hover:text-[#FF7A2E] active:scale-[0.99]"
          >
            <FileText className="h-5 w-5" />
            Get Supplier Quotes
          </Link>
        </div>
      </motion.article>
    );
  }

  const card = landing
    ? 'relative overflow-hidden rounded-3xl border border-[#FF5A00]/35 bg-gradient-to-b from-[#0e1522] to-[#0a0f1a] p-5 sm:p-7 text-white shadow-[0_18px_50px_-22px_rgba(255,90,0,0.55)] transition-shadow duration-300 hover:shadow-[0_24px_60px_-20px_rgba(255,90,0,0.7)]'
    : 'rounded-3xl border border-border bg-card p-5 sm:p-7 text-foreground';
  const muted = landing ? 'text-neutral-400' : 'text-muted-foreground';
  const field = landing
    ? 'h-11 rounded-xl bg-[#0b1220] border-white/10 text-white focus-visible:border-[#FF5A00] focus-visible:ring-[#FF5A00]/30'
    : 'h-10 bg-background';
  const chip = (active: boolean) =>
    `h-8 rounded-full px-3 text-xs font-semibold transition-all duration-200 ${
      active
        ? landing
          ? 'border border-transparent bg-gradient-to-r from-[#FF7A2E] to-[#E84A00] text-white shadow-[0_8px_20px_-8px_rgba(255,90,0,0.8)]'
          : 'bg-[#C94400] text-white'
        : landing
          ? 'border border-white/10 bg-[#161616]/[0.04] text-slate-200 hover:border-[#FF5A00]/60 hover:text-white'
          : 'bg-muted text-foreground border border-border hover:border-[#FF5A00]/60'
    }`;

  return (
    <motion.article
      className={card}
      initial={landing && !reduce ? { opacity: 0, y: 28 } : false}
      whileInView={landing && !reduce ? { opacity: 1, y: 0 } : undefined}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
    >
      {landing && (
        <>
          <motion.span
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#FF5A00]/20 blur-3xl"
            animate={reduce ? undefined : { x: [0, -22, 0], y: [0, 16, 0] }}
            transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.span
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-20 -left-16 h-48 w-48 rounded-full bg-[#FF5A00]/15 blur-3xl"
            animate={reduce ? undefined : { x: [0, 20, 0], y: [0, -14, 0] }}
            transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
          />
        </>
      )}
      <div className="relative">

      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[#FF5A00]/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#FF5A00]">
            <Calculator className="h-3.5 w-3.5" />
            Order loan calculator
          </div>
          <h2 className={`mt-3 text-2xl sm:text-3xl font-black tracking-tight ${landing ? 'text-white' : 'text-foreground'}`}>
            See the monthly cost
          </h2>
          <p className={`mt-1.5 text-sm leading-relaxed ${muted}`}>
            Plan a bulk order as a monthly installment. Delivery on that order stays free.
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        <label className="block">
          <span className={`flex items-center justify-between text-xs font-semibold ${landing ? 'text-slate-300' : 'text-foreground'}`}>
            Order value
            <span className="text-sm font-black text-[#FF5A00]">{money(amount)}</span>
          </span>
          <input
            type="range"
            min={range.min}
            max={range.max}
            step={range.step}
            value={amount}
            onChange={(event) => setAmount(event.target.valueAsNumber)}
            aria-label="Order value"
            className="mt-2 h-2 w-full cursor-pointer accent-[#FF5A00]"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {range.presets.map((preset) => (
              <button key={preset} type="button" className={chip(amount === preset)} onClick={() => setAmount(preset)}>
                {money(preset)}
              </button>
            ))}
          </div>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="block">
            <span className={`text-xs font-semibold ${muted}`}>Down payment %</span>
            <Input
              type="number"
              inputMode="decimal"
              min={DOWN_LIMITS.min}
              max={DOWN_LIMITS.max}
              step={DOWN_LIMITS.step}
              value={down}
              onChange={(event) => {
                const next = event.target.valueAsNumber;
                if (Number.isFinite(next)) setDown(Math.min(DOWN_LIMITS.max, Math.max(DOWN_LIMITS.min, next)));
              }}
              className={`mt-1 ${field}`}
              aria-label="Down payment percent"
            />
          </label>
          <label className="block">
            <span className={`text-xs font-semibold ${muted}`}>Annual rate %</span>
            <Input
              type="number"
              inputMode="decimal"
              min={RATE_LIMITS.min}
              max={RATE_LIMITS.max}
              step={RATE_LIMITS.step}
              value={rate}
              onChange={(event) => {
                const next = event.target.valueAsNumber;
                if (Number.isFinite(next)) setRate(Math.min(RATE_LIMITS.max, Math.max(RATE_LIMITS.min, next)));
              }}
              className={`mt-1 ${field}`}
              aria-label="Annual interest rate percent"
            />
          </label>
          <label className="block">
            <span className={`text-xs font-semibold ${muted}`}>Tenure (months)</span>
            <Input
              type="number"
              inputMode="numeric"
              min={TENURE_LIMITS.min}
              max={TENURE_LIMITS.max}
              step={1}
              value={months}
              onChange={(event) => {
                const next = event.target.valueAsNumber;
                if (Number.isFinite(next)) setMonths(Math.min(TENURE_LIMITS.max, Math.max(TENURE_LIMITS.min, next)));
              }}
              className={`mt-1 ${field}`}
              aria-label="Loan tenure in months"
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Tenure presets">
          {TENURE_PRESETS.map((preset) => (
            <button key={preset} type="button" className={chip(months === preset)} onClick={() => setMonths(preset)}>
              {preset} mo
            </button>
          ))}
        </div>
      </div>

      <div
        className={`mt-5 rounded-2xl p-4 transition-opacity ${quotePending ? 'opacity-80' : 'opacity-100'} ${
          landing ? 'border border-[#FF5A00]/30 bg-gradient-to-br from-[#C94400]/15 via-[#161616]/[0.03] to-transparent' : 'bg-muted/50 border border-border'
        }`}
        aria-live="polite"
      >
        <p className={`text-[11px] font-semibold uppercase tracking-wider ${muted}`}>Monthly installment</p>
        <p className={`text-3xl sm:text-4xl font-black tracking-tight ${landing ? 'text-white' : 'text-foreground'}`}>
          <AnimatedValue text={money(quote.emi)} landing={landing} />
          <span className={`ml-1 text-sm font-semibold ${muted}`}>/ month</span>
        </p>

        <dl className="mt-4 space-y-2 text-sm">
          <Row label="Order value" value={money(quote.orderAmount)} muted={muted} strong={landing ? 'text-white' : 'text-foreground'} />
          <Row label="Pay today (down payment)" value={money(quote.payToday)} muted={muted} strong={landing ? 'text-white' : 'text-foreground'} />
          <Row label="Amount financed" value={money(quote.principal)} muted={muted} strong={landing ? 'text-white' : 'text-foreground'} />
          <Row label="Interest over tenure" value={money(quote.totalInterest)} muted={muted} strong={landing ? 'text-white' : 'text-foreground'} />
          <Row label="Total you repay" value={money(quote.totalPayable)} muted={muted} strong={landing ? 'text-white' : 'text-foreground'} />
          <div className={`flex items-center justify-between gap-3 border-t pt-2 ${landing ? 'border-white/10' : 'border-border'}`}>
            <dt className={muted}>Delivery fee</dt>
            <dd className="font-black text-[#FF7A2E]">Free</dd>
          </div>
        </dl>

        <div className="mt-4">
          <div className={`h-2 overflow-hidden rounded-full flex ${landing ? 'bg-[#0A0A0A]' : 'bg-muted'}`}>
            <motion.div
              className="h-full bg-gradient-to-r from-[#FF7A2E] to-[#E84A00]"
              initial={false}
              animate={{ width: `${principalShare}%` }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            />
            <motion.div
              className="h-full bg-gradient-to-r from-[#2A1205] to-[#B33D00]"
              initial={false}
              animate={{ width: `${100 - principalShare}%` }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
          <div className={`mt-1.5 flex justify-between text-[10px] font-semibold ${muted}`}>
            <span>Financed</span>
            <span>Interest</span>
          </div>
        </div>
      </div>

      <LoanRequestForm tone={tone} currency={currency} quote={quote} money={money} />

      <p className={`mt-3 text-[11px] leading-relaxed ${muted}`}>
        Illustrative installment for planning an order. It is not a credit offer or approval. Final terms depend on the financing partner. Delivery stays free on every order placed on BulkSkart.
      </p>

      <div className="mt-4 flex flex-wrap gap-2.5">
        <Link
          to="/products"
          className={`group/btn inline-flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-bold transition-transform active:scale-95 ${
            landing
              ? 'bg-gradient-to-r from-[#FF7A2E] to-[#E84A00] text-white shadow-[0_10px_24px_-10px_rgba(255,90,0,0.9)] hover:-translate-y-0.5'
              : 'bg-[#C94400] text-white shadow-lg shadow-orange-950/30'
          }`}
        >
          Place this order
          <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-0.5" />
        </Link>
        <Link
          to="/post-requirement"
          className={`inline-flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-bold transition-transform active:scale-95 ${
            landing
              ? 'border border-white/20 text-white hover:border-[#FF5A00] hover:text-[#FF7A2E]'
              : 'border border-border bg-background text-foreground hover:bg-muted'
          }`}
        >
          Get supplier quotes
        </Link>
      </div>
      </div>
    </motion.article>
  );
}

function Row({ label, value, muted, strong }: { label: string; value: string; muted: string; strong: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className={muted}>{label}</dt>
      <dd className={`font-semibold tabular-nums ${strong}`}>{value}</dd>
    </div>
  );
}

export default memo(LoanCalculator);
