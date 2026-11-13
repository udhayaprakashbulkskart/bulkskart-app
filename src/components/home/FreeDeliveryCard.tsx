import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import { Truck, Check, Package, MapPin, BadgePercent, ArrowRight, Boxes, Infinity as InfinityIcon, Home, PlusSquare, FileText } from 'lucide-react';
import { useCurrency } from '@/contexts/CurrencyContext';

const POINTS = [
  { icon: Package, text: 'Every order on this platform, any quantity or category' },
  { icon: BadgePercent, text: 'Delivery charge at checkout is always zero' },
  { icon: MapPin, text: 'Door delivery on confirmed orders' },
  { icon: Check, text: 'You pay the product price only' },
] as const;

const FEATURES = [
  { icon: Boxes, label: 'All Categories', sub: 'Covered' },
  { icon: InfinityIcon, label: 'Any Order', sub: 'Value' },
  { icon: Truck, label: '₹0 Delivery', sub: 'Charge' },
  { icon: Home, label: 'Doorstep', sub: 'Delivery' },
] as const;

interface FreeDeliveryCardProps {
  tone?: 'landing' | 'page';
}

/** Landing-page version: matches the reference layout (orange glow, feature strip, fee banner, checklist). */
function LandingFreeDelivery() {
  const { formatLocalPrice } = useCurrency();
  const reduce = useReducedMotion();

  return (
    <motion.article
      initial={reduce ? false : { opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-[#FF5A00]/50 bg-gradient-to-b from-[#120a06] via-[#0b0d12] to-[#0a0a0f] p-5 text-white shadow-[0_20px_60px_-24px_rgba(255,90,0,0.6)] sm:p-7"
    >
      {!reduce && (
        <>
        </>
      )}

      <div className="relative flex items-start justify-between gap-6">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="h-6 w-1 rounded-full bg-[#C94400]" />
            <span className="text-[12px] font-bold uppercase tracking-[0.2em] text-[#FF7A2E]">Platform benefit</span>
          </div>
          <h2 className="mt-4 text-[34px] font-black italic leading-[1.02] tracking-tight sm:text-[46px]">
            Free Delivery
            <span className="block bg-gradient-to-r from-[#FF7A2E] to-[#FFB067] bg-clip-text text-transparent">on Every Order</span>
          </h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-300 sm:text-[15px]">
            Place any order on BulkSkart and get it delivered at no extra cost. No hidden fees, no minimum order value.
          </p>
        </div>

        {/* Truck badge */}
        <motion.div
          className="relative hidden shrink-0 sm:block"
          animate={reduce ? undefined : { x: [0, 6, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          aria-hidden="true"
        >
          <div className="flex h-36 w-44 items-center justify-center rounded-3xl border border-[#FF5A00]/40 bg-gradient-to-br from-[#FF7A2E]/25 to-transparent shadow-[0_0_40px_-6px_rgba(255,90,0,0.8)]">
            <div className="text-center">
              <Truck className="mx-auto h-14 w-14 text-[#FF7A2E]" strokeWidth={1.6} />
              <p className="mt-1 text-[12px] font-black tracking-wide text-white">BulkSkart</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Feature strip */}
      <div className="relative mt-6 grid grid-cols-2 overflow-hidden rounded-2xl border border-white/10 bg-[#0A0A0A]/40 sm:grid-cols-4">
        {FEATURES.map(({ icon: Icon, label, sub }, i) => (
          <motion.div
            key={label}
            initial={reduce ? false : { opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45, delay: 0.1 + i * 0.07 }}
            className={`flex items-center gap-3 px-4 py-3.5 ${i % 2 === 0 ? 'border-r border-white/10' : ''} ${i < 2 ? 'border-b border-white/10 sm:border-b-0' : ''} ${i < 3 ? 'sm:border-r sm:border-white/10' : 'sm:border-r-0'}`}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#FF7A2E] to-[#E84A00] shadow-[0_6px_16px_-6px_rgba(255,90,0,0.9)]">
              <Icon className="h-5 w-5 text-white" />
            </span>
            <span className="text-[12px] font-bold leading-tight text-slate-100 sm:text-[13px]">
              {label}
              <span className="block font-semibold text-neutral-400">{sub}</span>
            </span>
          </motion.div>
        ))}
      </div>

      {/* Fee banner */}
      <motion.div
        initial={reduce ? false : { opacity: 0, scale: 0.97 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="relative mt-5 flex items-center justify-between gap-4 rounded-2xl border-2 border-[#FF5A00]/60 bg-[#0A0A0A]/50 px-5 py-4 shadow-[0_0_34px_-8px_rgba(255,90,0,0.8)] sm:px-7 sm:py-5"
      >
        <p className="text-[13px] font-black uppercase leading-tight tracking-wide text-white sm:text-[16px]">
          Your delivery fee
        </p>
        <div className="flex items-center gap-3">
          <span className="text-[44px] font-black leading-none text-[#FF5A00] drop-shadow-[0_0_18px_rgba(255,90,0,0.9)] sm:text-[58px]">
            {formatLocalPrice(0)}
          </span>
          <span className="hidden border-l border-white/15 pl-3 text-[12px] font-bold leading-tight text-slate-200 sm:block">
            On All Orders,<span className="block">All Categories</span>
          </span>
        </div>
      </motion.div>

      <ul className="relative mt-5 space-y-2.5">
        {POINTS.map((point, i) => {
          const Icon = point.icon;
          return (
            <motion.li
              key={point.text}
              initial={reduce ? false : { opacity: 0, x: -12 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: 0.5 + i * 0.08 }}
              className="flex items-center gap-3 text-sm text-slate-100 sm:text-[15px]"
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-[#FF7A2E] to-[#E84A00] shadow-[0_4px_10px_-4px_rgba(255,90,0,0.9)]">
                <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
              </span>
              <span>{point.text}</span>
            </motion.li>
          );
        })}
      </ul>

      <div className="relative mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link
          to="/products"
          className="group/btn inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#FF7A2E] to-[#E84A00] px-5 text-base font-bold text-white shadow-[0_12px_30px_-10px_rgba(255,90,0,0.9)] transition-transform hover:-translate-y-0.5 active:scale-[0.99]"
        >
          <PlusSquare className="h-5 w-5" />
          Start an Order
          <ArrowRight className="h-5 w-5 transition-transform group-hover/btn:translate-x-1" />
        </Link>
        <Link
          to="/post-requirement"
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/20 px-5 text-base font-bold text-white transition-colors hover:border-[#FF5A00] hover:text-[#FF7A2E] active:scale-[0.99]"
        >
          <FileText className="h-5 w-5" />
          Post a Requirement
        </Link>
      </div>
    </motion.article>
  );
}

export default function FreeDeliveryCard({ tone = 'page' }: FreeDeliveryCardProps) {
  const landing = tone === 'landing';
  const { formatLocalPrice } = useCurrency();

  if (landing) return <LandingFreeDelivery />;

  return (
    <article className="h-full rounded-3xl border border-[#FF5A00]/30 bg-card p-5 sm:p-7 text-foreground">
      <div className="inline-flex items-center gap-1.5 rounded-full bg-[#FF5A00]/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#FF7A2E]">
        <Truck className="h-3.5 w-3.5" />
        Platform benefit
      </div>

      <h2 className="mt-4 text-2xl sm:text-3xl font-black tracking-tight text-foreground">
        Free delivery on every order
      </h2>
      <p className="mt-2 text-sm leading-relaxed max-w-xl text-muted-foreground">
        Place any order on BulkSkart and delivery is free. The offer covers every order value and every category sold on this platform, so freight is not added on top of the product price.
      </p>

      <ul className="mt-5 space-y-2.5">
        {POINTS.map((point) => {
          const Icon = point.icon;
          return (
            <li key={point.text} className="flex items-start gap-2.5 text-sm">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#FF5A00]/15 text-[#FF7A2E]">
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className="text-foreground">{point.text}</span>
            </li>
          );
        })}
      </ul>

      <div className="mt-6 rounded-2xl px-4 py-3 bg-muted/60 border border-border">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#FF7A2E]">Your delivery fee</p>
        <p className="text-3xl font-black tracking-tight text-foreground">
          {formatLocalPrice(0)}
          <span className="ml-2 text-sm font-semibold text-muted-foreground">on all orders</span>
        </p>
      </div>

      <div className="mt-6 flex flex-wrap gap-2.5">
        <Link
          to="/products"
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#C94400] px-5 text-sm font-bold text-white shadow-lg shadow-orange-950/30 transition-transform active:scale-95"
        >
          Start an order
          <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          to="/post-requirement"
          className="inline-flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-bold transition-transform active:scale-95 border border-border bg-background text-foreground hover:bg-muted"
        >
          Post a requirement
        </Link>
      </div>
    </article>
  );
}
