import { memo, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calculator, ArrowRight } from 'lucide-react';
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

function LoanCalculator({ tone = 'page' }: LoanCalculatorProps) {
  const landing = tone === 'landing';
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

  const card = landing
    ? 'rounded-3xl border border-slate-700/80 bg-slate-950/80 p-5 sm:p-7 text-white shadow-xl shadow-black/20'
    : 'rounded-3xl border border-border bg-card p-5 sm:p-7 text-foreground';
  const muted = landing ? 'text-slate-400' : 'text-muted-foreground';
  const field = landing
    ? 'h-10 bg-slate-900 border-slate-700 text-white'
    : 'h-10 bg-background';
  const chip = (active: boolean) =>
    `h-8 rounded-lg px-2.5 text-xs font-semibold transition-colors ${
      active
        ? 'bg-[#FF5A00] text-white'
        : landing
          ? 'bg-slate-900 text-slate-300 border border-slate-700 hover:border-[#FF5A00]/60'
          : 'bg-muted text-foreground border border-border hover:border-[#FF5A00]/60'
    }`;

  return (
    <article className={card}>
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
          landing ? 'bg-black/40 border border-white/10' : 'bg-muted/50 border border-border'
        }`}
        aria-live="polite"
      >
        <p className={`text-[11px] font-semibold uppercase tracking-wider ${muted}`}>Monthly installment</p>
        <p className={`text-3xl sm:text-4xl font-black tracking-tight ${landing ? 'text-white' : 'text-foreground'}`}>
          {money(quote.emi)}
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
            <dd className={`font-black ${landing ? 'text-emerald-400' : 'text-emerald-700 dark:text-emerald-400'}`}>Free</dd>
          </div>
        </dl>

        <div className="mt-4">
          <div className={`h-2 overflow-hidden rounded-full flex ${landing ? 'bg-slate-800' : 'bg-muted'}`}>
            <div className="h-full bg-[#FF5A00]" style={{ width: `${principalShare}%` }} />
            <div className="h-full bg-amber-400" style={{ width: `${100 - principalShare}%` }} />
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
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#FF5A00] px-5 text-sm font-bold text-white shadow-lg shadow-orange-950/30 transition-transform active:scale-95"
        >
          Place this order
          <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          to="/post-requirement"
          className={`inline-flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-bold transition-transform active:scale-95 ${
            landing
              ? 'border border-slate-600 bg-slate-900 text-white hover:bg-slate-800'
              : 'border border-border bg-background text-foreground hover:bg-muted'
          }`}
        >
          Get supplier quotes
        </Link>
      </div>
    </article>
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
