import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  Search, Camera, ChevronDown, ShieldCheck, Zap, Truck, ArrowRight, Sparkles,
  Settings, Box, Shirt, FlaskConical, Recycle, Layers, LayoutGrid,
  CheckCircle2, FileText, Gavel, Calculator, Wallet, Store, BadgeCheck,
} from 'lucide-react';
import TransportScene from '@/components/home/TransportScene';
import DiwaliBurst from '@/components/home/DiwaliBurst';
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

// ── Component ──────────────────────────────────────────────────────────
// Solid orange letters with a staggered glow-and-bounce loop (Diwali highlight).
function GlowLetters({ word, baseDelay, reduce }: { word: string; baseDelay: number; reduce: boolean }) {
  return (
    <>
      {Array.from(word).map((ch, i) => (
        <motion.span
          key={i}
          className="inline-block text-[#FF5A00]"
          initial={reduce ? false : { opacity: 0, y: 26 }}
          animate={reduce ? undefined : {
            opacity: 1,
            y: [0, -5, 0],
            textShadow: ['0 0 0px rgba(255,90,0,0)', '0 0 18px rgba(255,90,0,0.85)', '0 0 0px rgba(255,90,0,0)'],
          }}
          transition={{
            opacity: { duration: 0.5, delay: baseDelay + i * 0.05 },
            y: { duration: 2.4, repeat: Infinity, ease: 'easeInOut', delay: 1 + i * 0.12 },
            textShadow: { duration: 2.4, repeat: Infinity, ease: 'easeInOut', delay: 1 + i * 0.12 },
          }}
        >
          {ch}
        </motion.span>
      ))}
    </>
  );
}

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
      {/* ═════════════ HERO ═════════════ */}
      <div className="relative">
        <div className="relative mx-auto max-w-[1400px] px-4 pb-8 pt-6 sm:px-5 md:px-6 md:pb-12 md:pt-14">
          {/* Left column */}
          <div className="relative">
            <motion.div
              {...fadeUp(0)}
              className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-[#161616]/[0.06] px-3 py-1 text-[12px] font-semibold text-white/85 backdrop-blur-md"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#C94400] opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#C94400]" />
              </span>
              Live marketplace
            </motion.div>

            <h1 className="max-w-[640px] text-[30px] font-black leading-[1.05] tracking-tight sm:text-[40px] md:text-[54px]">
              {HEADLINE.map((w, i) => (
                <motion.span
                  key={w + i}
                  className="mr-[0.25em] inline-block"
                  initial={reduce ? false : { opacity: 0, y: 26, filter: 'blur(6px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  transition={{ duration: 0.6, delay: 0.08 + i * 0.07, ease: [0.22, 1, 0.36, 1] }}
                >
                  {w}
                </motion.span>
              ))}
              <br />
              {HEADLINE_ACCENT.map((w, i) => (
                <span key={w + i} className="mr-[0.25em] inline-block whitespace-nowrap">
                  <GlowLetters word={w} baseDelay={0.45 + i * 0.12} reduce={!!reduce} />
                </span>
              ))}
            </h1>
            {/* Diwali firecracker bursts behind the headline (decorative) */}
            <DiwaliBurst />

            <motion.p {...fadeUp(0.7)} className="mt-4 max-w-[560px] text-[15px] leading-relaxed text-white/70 md:text-[17px]">
              Connect with verified manufacturers, suppliers and bulk buyers worldwide. Get the best bulk prices, instant quotes and secure deals.
            </motion.p>

            <motion.div {...fadeUp(0.85)} className="mt-5 flex flex-wrap gap-2">
              {[
                { icon: ShieldCheck, label: 'Verified suppliers' },
                { icon: Zap, label: 'Bulk pricing' },
                { icon: Truck, label: 'Free delivery*' },
                { icon: BadgeCheck, label: 'Trade assurance' },
              ].map(({ icon: Icon, label }) => (
                <span key={label} className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-[#161616]/[0.06] px-3 py-1.5 text-[12px] font-semibold text-white/90 backdrop-blur-md">
                  <Icon className="h-3.5 w-3.5 text-[#FF5A00]" />
                  {label}
                </span>
              ))}
            </motion.div>

            {/* Search */}
            <motion.div {...fadeUp(1)} className="mt-6 max-w-[860px]">
              <form
                onSubmit={submit}
                role="search"
                className={`group relative rounded-2xl bg-gradient-to-r from-[#C94400]/60 via-white/10 to-[#B33D00]/40 p-[1.5px] transition-shadow duration-300 ${focused ? 'shadow-[0_0_40px_-8px_rgba(255,90,0,0.55)]' : 'shadow-[0_10px_40px_-18px_rgba(0,0,0,0.8)]'}`}
              >
                <div className="flex items-stretch overflow-hidden rounded-[14px] bg-[#161616]">
                  <div className="relative shrink-0">
                    <select
                      value={scope}
                      onChange={e => setScope(e.target.value as 'Products' | 'Suppliers')}
                      aria-label="Search in"
                      className="h-12 cursor-pointer appearance-none border-r border-[#2A2A2A]/10 bg-transparent pl-4 pr-8 text-sm font-semibold text-white focus:outline-none md:h-14 md:text-base"
                    >
                      <option>Products</option>
                      <option>Suppliers</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/60" />
                  </div>
                  <input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    placeholder="Search products, suppliers, categories…"
                    aria-label="Search"
                    className="min-w-0 flex-1 bg-[#161616] px-3 text-base text-white placeholder:text-white/45 focus:outline-none md:px-4"
                  />
                  <button type="button" aria-label="Search by image" className="flex h-12 w-12 items-center justify-center text-white/55 transition-colors hover:text-[#FF5A00] md:h-14 md:w-14">
                    <Camera className="h-5 w-5" />
                  </button>
                  <button type="submit" aria-label="Search" className="relative h-12 w-12 overflow-hidden bg-gradient-to-br from-[#FF7A2E] to-[#E84A00] transition-transform active:scale-95 md:h-14 md:w-14">
                    <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                    <Search className="relative mx-auto h-5 w-5 text-white" />
                  </button>
                </div>
              </form>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-white/70">
                <Sparkles className="h-4 w-4 text-[#FF5A00]" />
                <span>Trending:</span>
                {TRENDING.map(t => (
                  <Link key={t} to={`/products?q=${encodeURIComponent(t)}`} className="inline-flex min-h-9 items-center rounded-full border border-white/10 bg-[#161616]/[0.04] px-3 text-sm text-white/90 transition-colors hover:border-[#FF5A00]/60 hover:text-white">
                    {t}
                  </Link>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* ═════════════ PRODUCT SCROLL: curved product carousel ═════════════ */}
      <ProductCarouselHero />

      {/* ═════════════ CATEGORY CHIPS ═════════════ */}
      <div className="relative mx-auto mt-2 max-w-[1400px] px-4 sm:px-5 md:px-6">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none sm:grid sm:grid-cols-4 sm:overflow-visible md:grid-cols-8">
          {CATEGORY_CHIPS.map(({ label, icon: Icon, to, tint }, i) => (
            <motion.div
              key={label}
              className="shrink-0"
              initial={reduce ? false : { opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.45, delay: i * 0.04 }}
            >
              <Link
                to={to}
                className="group relative flex min-h-11 min-w-[92px] flex-col items-center justify-center gap-1 overflow-hidden rounded-2xl border border-white/10 bg-[#161616]/[0.04] px-3 py-2.5 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-white/25 hover:shadow-[0_18px_40px_-16px_rgba(255,90,0,0.5)] sm:min-w-0"
              >
                <span className={`pointer-events-none absolute -inset-6 bg-gradient-to-br ${tint} to-transparent opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100`} />
                <Icon className="relative h-5 w-5 text-[#FF7A2E] transition-transform duration-300 group-hover:scale-110" />
                <span className="relative text-sm font-semibold text-white/90">{label}</span>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ═════════════ PROMO CAROUSEL ═════════════ */}
      <div className="relative mx-auto mt-5 max-w-[1400px] px-4 sm:px-5 md:px-6">
        <div className="relative min-h-[220px] overflow-hidden rounded-3xl border border-white/10 sm:min-h-[260px] md:min-h-[320px]">
          <motion.div
            className="absolute inset-0"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.1, ease: 'easeOut' }}
          >
            <TransportScene />
          </motion.div>
          <div className="absolute inset-0 bg-gradient-to-r from-[#070B14] via-[#070B14]/75 to-[#070B14]/15" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#070B14]/80 via-transparent to-transparent" />

          <div className="relative flex min-h-[220px] flex-col justify-between p-5 sm:min-h-[260px] md:min-h-[320px] md:p-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={`copy-${slide}`}
                initial={reduce ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.45 }}
                className="max-w-[560px]"
              >
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#FF5A00]/50 bg-[#FF5A00]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#FF8A4C]">
                  <Sparkles className="h-3 w-3" /> {promo.tag}
                </span>
                <h2 className="mt-3 text-[26px] font-black leading-[1.1] md:text-[38px]">
                  {promo.title}{' '}
                  <span className="bg-gradient-to-r from-[#FF7A2E] to-[#FFB067] bg-clip-text text-transparent">{promo.highlight}</span>
                </h2>
                <ul className="mt-4 space-y-2">
                  {PROMO_POINTS.map((p, i) => (
                    <motion.li
                      key={p}
                      initial={reduce ? false : { opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.15 + i * 0.1 }}
                      className="flex items-center gap-2.5 text-sm text-white/85 md:text-base"
                    >
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-[#FF5A00]" /> {p}
                    </motion.li>
                  ))}
                </ul>
              </motion.div>
            </AnimatePresence>

            <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
              <Link
                to="/post-requirement"
                className="group inline-flex h-12 items-center gap-2 rounded-xl bg-gradient-to-r from-[#FF7A2E] to-[#E84A00] px-6 text-sm font-bold text-white shadow-[0_10px_30px_-8px_rgba(255,90,0,0.7)] transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
              >
                Post your requirement
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>

            {/* Slide controls */}
            <div className="mt-5 flex items-center gap-2" role="tablist" aria-label="Promo slides">
              {PROMO_SLIDES.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  role="tab"
                  aria-selected={i === slide}
                  aria-label={`Show slide ${i + 1}`}
                  onClick={() => setSlide(i)}
                  className="relative h-1.5 overflow-hidden rounded-full bg-white/25 transition-all duration-300"
                  style={{ width: i === slide ? 44 : 18 }}
                >
                  {i === slide && !reduce && (
                    <motion.span
                      key={`bar-${slide}`}
                      className="absolute inset-y-0 left-0 bg-[#1A0C05]"
                      initial={{ width: '0%' }}
                      animate={{ width: '100%' }}
                      transition={{ duration: 6.5, ease: 'linear' }}
                    />
                  )}
                  {i === slide && reduce && <span className="absolute inset-0 bg-[#1A0C05]" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ═════════════ QUICK ACTIONS ═════════════ */}
      <div className="relative mx-auto mt-5 max-w-[1400px] px-4 sm:px-5 md:px-6">
        <div className="grid grid-cols-1 gap-2.5 min-[480px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {QUICK_ACTIONS.map(({ label, sub, icon: Icon, to, tint }, i) => (
            <motion.div
              key={label}
              initial={reduce ? false : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.5, delay: i * 0.06 }}
            >
              <Link
                to={to}
                className="group relative flex h-full flex-col items-start gap-3 overflow-hidden rounded-2xl border border-white/10 bg-[#161616]/[0.04] p-4 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-white/25"
              >
                <span className={`pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br ${tint} to-transparent opacity-20 blur-2xl transition-opacity duration-300 group-hover:opacity-60`} />
                <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#FF7A2E] to-[#E84A00] shadow-[0_8px_20px_-6px_rgba(255,90,0,0.7)]">
                  <Icon className="h-5 w-5 text-white" />
                </span>
                <span className="relative">
                  <span className="block text-[14px] font-bold text-white">{label}</span>
                  <span className="mt-0.5 block text-[12px] text-white/55">{sub}</span>
                </span>
                <ArrowRight className="absolute bottom-4 right-4 h-4 w-4 text-white/35 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-[#FF7A2E]" />
              </Link>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ═════════════ STATS ═════════════ */}
      <div className="relative mx-auto mb-7 mt-5 max-w-[1400px] px-4 sm:px-5 md:px-6">
        <LiveCountStrip />
      </div>
    </section>
  );
}
