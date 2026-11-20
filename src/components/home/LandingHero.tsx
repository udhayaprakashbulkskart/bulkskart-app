import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  Search, Camera, ChevronDown, ShieldCheck, Zap, Truck, ArrowRight, Sparkles,
  Settings, Box, Shirt, FlaskConical, Recycle, Layers, LayoutGrid,
  FileText, Gavel, Calculator, Wallet, Store, BadgeCheck,
} from 'lucide-react';
import ProductCarouselHero from '@/components/home/hero/ProductCarouselHero';
import LiveCountStrip from '@/components/common/LiveCountStrip';

// ── Content ────────────────────────────────────────────────────────────
const TRENDING = ['Textile', 'Steel', 'Chemicals', 'Packaging', 'Electrical'];

const CATEGORY_CHIPS = [
  { label: 'Machinery', icon: Settings, to: '/products?category=machinery-industrial', tint: 'from-orange-500/30' },
  { label: 'Packaging', icon: Box, to: '/products?category=packaging', tint: 'from-[#C94400]/30' },
  { label: 'Electrical', icon: Zap, to: '/products?category=electronics-electricals', tint: 'from-[#C94400]/30' },
  { label: 'Textile', icon: Shirt, to: '/products?category=textiles-apparel', tint: 'from-[#C94400]/30' },
  { label: 'Chemicals', icon: FlaskConical, to: '/products?category=chemicals-raw-materials', tint: 'from-[#C94400]/30' },
  { label: 'Plastic', icon: Recycle, to: '/products?q=plastic', tint: 'from-[#C94400]/30' },
  { label: 'Steel', icon: Layers, to: '/products?q=steel', tint: 'from-neutral-400/30' },
  { label: 'More', icon: LayoutGrid, to: '/products', tint: 'from-[#C94400]/30' },
];

const QUICK_ACTIONS = [
  { label: 'Post RFQ', sub: 'Get quotes fast', icon: FileText, to: '/post-requirement', tint: 'from-orange-500' },
  { label: 'Live Auctions', sub: 'Buy at best price', icon: Gavel, to: '/auctions', tint: 'from-[#C94400]' },
  { label: 'Bulk Calculator', sub: 'Estimate & save', icon: Calculator, to: '/loan-calculator', tint: 'from-[#C94400]' },
  { label: 'Order Loan', sub: 'Business credit', icon: Wallet, to: '/loan-calculator', tint: 'from-[#C94400]' },
  { label: 'Become a Supplier', sub: 'List your products', icon: Store, to: '/auth?tab=supplier', tint: 'from-[#C94400]' },
];

const PROMO_SLIDES = [
  { tag: 'Bulk Made Easy', title: 'Source directly from', highlight: 'verified manufacturers' },
  { tag: 'Bulk Made Easy', title: 'Compare quotes from', highlight: 'factories worldwide' },
  { tag: 'Bulk Made Easy', title: 'Pay securely with', highlight: 'trade assurance' },
];
const PROMO_POINTS = ['Post requirements (RFQ) in under a minute', 'Get multiple quotations', 'Compare and choose the best offer'];

const HEADLINE = ['The', 'Global', 'B2B', 'Marketplace', 'for'];
const HEADLINE_ACCENT = ['Bulk', 'Buying', '&', 'Selling'];

export default function LandingHero() {
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<'Products' | 'Suppliers'>('Products');
  const [focused, setFocused] = useState(false);
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setSlide(s => (s + 1) % PROMO_SLIDES.length), 6500);
    return () => clearInterval(t);
  }, [reduce]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    navigate(scope === 'Suppliers'
      ? `/manufacturers${q ? `?q=${encodeURIComponent(q)}` : ''}`
      : `/products${q ? `?q=${encodeURIComponent(q)}` : ''}`);
  };

  const promo = PROMO_SLIDES[slide];
  const fadeUp = (delay: number) => ({
    initial: reduce ? false : { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] as const },
  });

  return (
    <section className="relative isolate overflow-hidden bg-black text-white">
      <div className="relative mx-auto max-w-[1400px] px-4 pb-2 pt-4 sm:px-5 md:px-6 md:pt-8">
        <motion.div {...fadeUp(1)} className="max-w-[860px]">
          <form
            onSubmit={submit}
            role="search"
            className={`group relative rounded-2xl bg-gradient-to-r from-[#C94400]/70 via-white/10 to-[#B33D00]/50 p-[1.5px] ${focused ? 'shadow-[0_0_40px_-8px_rgba(255,90,0,0.55)]' : ''}`}
          >
            <div className="flex h-12 items-stretch overflow-hidden rounded-[14px] bg-[#161616] md:h-14">
              <div className="relative shrink-0">
                <select
                  value={scope}
                  onChange={e => setScope(e.target.value as 'Products' | 'Suppliers')}
                  aria-label="Search in"
                  className="h-full cursor-pointer appearance-none border-r border-white/10 bg-transparent pl-3 pr-7 text-sm font-semibold text-white focus:outline-none"
                >
                  <option>Products</option>
                  <option>Suppliers</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-white/60" />
              </div>
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder="Search products, suppliers, categories…"
                aria-label="Search"
                className="min-w-0 flex-1 bg-transparent px-3 text-base text-white placeholder:text-white/45 focus:outline-none"
              />
              <button type="button" aria-label="Search by image" className="flex w-11 items-center justify-center text-white/70 hover:text-[#FF5A00]">
                <Camera className="h-5 w-5" />
              </button>
              <button type="submit" aria-label="Search" className="relative w-12 bg-gradient-to-br from-[#FF7A2E] to-[#E84A00] md:w-14">
                <Search className="mx-auto h-5 w-5 text-white" />
              </button>
            </div>
          </form>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-white/70">
            <Sparkles className="h-4 w-4 text-[#FF5A00]" />
            <span>Trending:</span>
            {TRENDING.map(t => (
              <Link key={t} to={`/products?q=${encodeURIComponent(t)}`} className="inline-flex min-h-9 items-center rounded-full border border-white/10 px-3 text-sm text-white/90 hover:border-[#FF5A00]/60">
                {t}
              </Link>
            ))}
          </div>
        </motion.div>
      </div>

      <div className="relative mx-auto mt-3 max-w-[1400px] px-4 sm:px-5 md:px-6">
        <div className="relative min-h-[420px] overflow-hidden rounded-3xl border border-white/10 md:min-h-[460px]">
          <img
            src="https://live.staticflickr.com/4092/5009413427_3d13b6b445_b.jpg"
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#070B14] via-[#070B14]/75 to-[#070B14]/20" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#070B14] via-transparent to-[#070B14]/30" />
          <div className="relative flex min-h-[420px] flex-col justify-between p-5 md:min-h-[460px] md:p-8 lg:max-w-[760px]">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#FF5A00]/40 bg-[#FF5A00]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#FF8A4C]">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#C94400] opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#C94400]" />
                </span>
                Live marketplace
              </div>
              <h1 className="max-w-[640px] text-[28px] font-black leading-[1.05] tracking-tight sm:text-[40px] md:text-[52px]">
                {HEADLINE.map((w, i) => (
                  <span key={w + i} className="mr-[0.22em] inline-block">{w}</span>
                ))}
                <br />
                {HEADLINE_ACCENT.map((w, i) => (
                  <span key={w + i} className="mr-[0.22em] inline-block whitespace-nowrap text-[#FF5A00]">{w}</span>
                ))}
              </h1>
              <p className="mt-3 max-w-[520px] text-[15px] leading-relaxed text-white/75 md:text-[17px]">
                Connect with verified manufacturers, suppliers and bulk buyers worldwide. Get the best bulk prices, instant quotes and secure deals.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {[
                  { icon: ShieldCheck, label: 'Verified suppliers' },
                  { icon: Zap, label: 'Bulk pricing' },
                  { icon: Truck, label: 'Free delivery*' },
                  { icon: BadgeCheck, label: 'Trade assurance' },
                ].map(({ icon: Icon, label }) => (
                  <span key={label} className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/30 px-3 py-1.5 text-[12px] font-semibold text-white">
                    <Icon className="h-3.5 w-3.5 text-[#FF5A00]" />
                    {label}
                  </span>
                ))}
              </div>
              <ul className="mt-3 space-y-1.5">
                {PROMO_POINTS.map((point) => (
                  <li key={point} className="text-sm text-white/80">{point}</li>
                ))}
              </ul>
              <AnimatePresence mode="wait">
                <motion.p
                  key={promo.title}
                  initial={reduce ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="mt-4 text-sm font-semibold text-white/80"
                >
                  {promo.title} <span className="text-[#FF8A4C]">{promo.highlight}</span>
                </motion.p>
              </AnimatePresence>
            </div>
            <div>
              <Link
                to="/post-requirement"
                className="inline-flex h-12 items-center gap-2 rounded-xl bg-gradient-to-r from-[#FF7A2E] to-[#E84A00] px-5 text-sm font-bold text-white"
              >
                Post your requirement
                <ArrowRight className="h-4 w-4" />
              </Link>
              <div className="mt-4 flex items-center gap-2" role="tablist" aria-label="Promo slides">
                {PROMO_SLIDES.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    role="tab"
                    aria-selected={i === slide}
                    aria-label={`Show slide ${i + 1}`}
                    onClick={() => setSlide(i)}
                    className="flex h-11 items-center"
                  >
                    <span className={`block h-1.5 rounded-full ${i === slide ? 'w-8 bg-[#FF5A00]' : 'w-2.5 bg-white/40'}`} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <ProductCarouselHero />

      <div className="relative mx-auto mt-4 max-w-[1400px] px-4 sm:px-5 md:px-6">
        <LiveCountStrip />
      </div>

      <div className="relative mx-auto mt-5 max-w-[1400px] px-4 sm:px-5 md:px-6">
        <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none md:grid md:grid-cols-8 md:overflow-visible">
          {CATEGORY_CHIPS.map(({ label, icon: Icon, to }) => (
            <Link
              key={label}
              to={to}
              className="flex w-[76px] shrink-0 flex-col items-center gap-2 md:w-auto"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-[#161616] text-[#FF7A2E]">
                <Icon className="h-6 w-6" />
              </span>
              <span className="text-center text-xs font-semibold text-white/90">{label}</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="relative mx-auto mb-6 mt-5 max-w-[1400px] px-4 sm:px-5 md:px-6">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
          {QUICK_ACTIONS.map(({ label, sub, icon: Icon, to }) => (
            <Link
              key={label}
              to={to}
              className="flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-2xl border border-[#FF5A00]/30 bg-[#1a120e] px-2 py-3 text-center"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FF5A00] text-white">
                <Icon className="h-4 w-4" />
              </span>
              <span className="text-sm font-bold text-white">{label}</span>
              <span className="text-[11px] text-white/55">{sub}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

