import { Link } from 'react-router-dom';
import { Truck, Check, Package, MapPin, BadgePercent, ArrowRight } from 'lucide-react';
import { useCurrency } from '@/contexts/CurrencyContext';

const POINTS = [
  { icon: Package, text: 'Every order on this platform, any quantity or category' },
  { icon: BadgePercent, text: 'Delivery charge at checkout is always zero' },
  { icon: MapPin, text: 'Door delivery on confirmed orders' },
  { icon: Check, text: 'You pay the product price only' },
] as const;

interface FreeDeliveryCardProps {
  tone?: 'landing' | 'page';
}

export default function FreeDeliveryCard({ tone = 'page' }: FreeDeliveryCardProps) {
  const landing = tone === 'landing';
  const { formatLocalPrice } = useCurrency();

  // The landing variant sits on a dark panel; the plain one follows the light/dark theme
  const green = landing ? 'text-emerald-400' : 'text-emerald-700 dark:text-emerald-400';
  return (
    <article
      className={
        landing
          ? 'h-full rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/80 via-slate-950 to-slate-950 p-5 sm:p-7 text-white shadow-xl shadow-black/20'
          : 'h-full rounded-3xl border border-emerald-500/30 bg-card p-5 sm:p-7 text-foreground'
      }
    >
      <div className={`inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${green}`}>
        <Truck className="h-3.5 w-3.5" />
        Platform benefit
      </div>

      <h2 className={`mt-4 text-2xl sm:text-3xl font-black tracking-tight ${landing ? 'text-white' : 'text-foreground'}`}>
        Free delivery on every order
      </h2>
      <p className={`mt-2 text-sm leading-relaxed max-w-xl ${landing ? 'text-slate-300' : 'text-muted-foreground'}`}>
        Place any order on BulkSkart and delivery is free. The offer covers every order value and every category sold on this platform, so freight is not added on top of the product price.
      </p>

      <ul className="mt-5 space-y-2.5">
        {POINTS.map((point) => {
          const Icon = point.icon;
          return (
            <li key={point.text} className="flex items-start gap-2.5 text-sm">
              <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 ${green}`}>
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className={landing ? 'text-slate-200' : 'text-foreground'}>{point.text}</span>
            </li>
          );
        })}
      </ul>

      <div className={`mt-6 rounded-2xl px-4 py-3 ${landing ? 'bg-black/30 border border-white/10' : 'bg-muted/60 border border-border'}`}>
        <p className={`text-[11px] font-semibold uppercase tracking-wider ${green}`}>Your delivery fee</p>
        <p className={`text-3xl font-black tracking-tight ${landing ? 'text-white' : 'text-foreground'}`}>
          {formatLocalPrice(0)}
          <span className={`ml-2 text-sm font-semibold ${landing ? 'text-slate-400' : 'text-muted-foreground'}`}>on all orders</span>
        </p>
      </div>

      <div className="mt-6 flex flex-wrap gap-2.5">
        <Link
          to="/products"
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#FF5A00] px-5 text-sm font-bold text-white shadow-lg shadow-orange-950/30 transition-transform active:scale-95"
        >
          Start an order
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
          Post a requirement
        </Link>
      </div>
    </article>
  );
}
