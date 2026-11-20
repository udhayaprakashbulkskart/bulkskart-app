import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  ShieldCheck, Zap, ArrowRight, Sparkles,
  Settings, Box, Shirt, FlaskConical, Recycle, Layers, LayoutGrid,
  CheckCircle2, FileText, Gavel, Calculator, Wallet, Store, Users, Package, Globe,
} from 'lucide-react';
import TransportScene from '@/components/home/TransportScene';
import ProductCarouselHero from '@/components/home/hero/ProductCarouselHero';

// ── Content ────────────────────────────────────────────────────────────
const CATEGORY_CHIPS = [
  { label: 'Machinery', icon: Settings, to: '/products?category=machinery-industrial', tint: 'from-orange-500/30' },
  { label: 'Packaging', icon: Box, to: '/products?category=packaging', tint: 'from-[#C94400]/30' },
  { label: 'Electrical', icon: Zap, to: '/products?category=electronics-electricals', tint: 'from-[#C94400]/30' },
  { label: 'Textile', icon: Shirt, to: '/products?category=textiles-apparel', tint: 'from-[#C94400]/30' },
  { label: 'Chemicals', icon: FlaskConical, to: '/products?category=chemicals-raw-materials', tint: 'from-[#C94400]/30' },
  { label: 'Plastic', icon: Recycle, to: '/products?q=plastic', tint: 'from-[#C94400]/30' },
  { label: 'Steel', icon: Layers, to: '/products?q=steel', tint: 'from-slate-400/30' },
  { label: 'More', icon: LayoutGrid, to: '/products', tint: 'from-[#C94400]/30' },
];

const QUICK_ACTIONS = [
  { label: 'Post RFQ', sub: 'Get quotes fast', icon: FileText, to: '/post-requirement', tint: 'from-orange-500' },
  { label: 'Live Auctions', sub: 'Buy at best price', icon: Gavel, to: '/auctions', tint: 'from-[#C94400]' },
  { label: 'Bulk Calculator', sub: 'Estimate & save', icon: Calculator, to: '/loan-calculator', tint: 'from-[#C94400]' },
  { label: 'Order Loan', sub: 'Business credit', icon: Wallet, to: '/loan-calculator', tint: 'from-[#C94400]' },
  { label: 'Become a Supplier', sub: 'List your products', icon: Store, to: '/auth?tab=supplier', tint: 'from-[#C94400]' },
];

const STATS = [
  { to: 50000, suffix: '+', label: 'Verified Manufacturers', icon: Users },
  { to: 1, suffix: 'M+', label: 'Bulk Products', icon: Package },
  { to: 120, suffix: '+', label: 'Trade Countries', icon: Globe },
  { to: 10000, suffix: '+', label: 'Live RFQs & Auctions', icon: Gavel },
];

const PROMO_SLIDES = [
  { tag: 'Bulk Made Easy', title: 'Source directly from', highlight: 'verified manufacturers' },
  { tag: 'Bulk Made Easy', title: 'Compare quotes from', highlight: 'factories worldwide' },
  { tag: 'Bulk Made Easy', title: 'Pay securely with', highlight: 'trade assurance' },
];
const PROMO_POINTS = ['Post requirements (RFQ) in under a minute', 'Get multiple quotations', 'Compare and choose the best offer'];


// ── Helpers ────────────────────────────────────────────────────────────
function CountUp({ to, suffix = '' }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const [value, setValue] = useState(reduce ? to : 0);

  useEffect(() => {
    if (reduce) return;
    const el = ref.current;
    if (!el) return;
    let started = false;
    const run = () => {
      const start = performance.now();
      const dur = 1600;
      const frame = (now: number) => {
        const t = Math.min(1, (now - start) / dur);
        const eased = 1 - Math.pow(1 - t, 3);
        setValue(Math.round(to * eased));
        if (t < 1) requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    };
    const io = new IntersectionObserver(([e]) => {
      if (e?.isIntersecting && !started) { started = true; run(); io.disconnect(); }
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, [to, reduce]);

  const shown = to >= 1000 && to < 1000000 ? `${(value / 1000).toLocaleString('en-IN', { maximumFractionDigits: 0 })}K` : value.toLocaleString('en-IN');
  return <span ref={ref}>{shown}{suffix && suffix !== 'M+' ? suffix : ''}{suffix === 'M+' ? 'M+' : ''}</span>;
}

// ── Component ──────────────────────────────────────────────────────────
export default function LandingHero() {
  const reduce = useReducedMotion();
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setSlide(s => (s + 1) % PROMO_SLIDES.length), 6500);
    return () => clearInterval(t);
  }, [reduce]);

  const promo = PROMO_SLIDES[slide];
  const fadeUp = (delay: number) => ({
    initial: reduce ? false : { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] as const },
  });

  return (
    <section className="relative isolate overflow-hidden bg-black text-white">
      {/* ═════════════ HERO: curved product carousel ═════════════ */}
      <ProductCarouselHero />

      {/* ═════════════ CATEGORY CHIPS ═════════════ */}
      <div className="relative mx-auto mt-2 max-w-[1400px] px-4 sm:px-5 md:px-6">
        <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-8">
          {CATEGORY_CHIPS.map(({ label, icon: Icon, to, tint }, i) => (
            <motion.div
              key={label}
              initial={reduce ? false : { opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.45, delay: i * 0.04 }}
            >
              <Link
                to={to}
                className="group relative flex flex-col items-center justify-center gap-1.5 overflow-hidden rounded-2xl border border-white/10 bg-[#161616]/[0.04] py-3.5 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-white/25 hover:shadow-[0_18px_40px_-16px_rgba(255,90,0,0.5)]"
              >
                <span className={`pointer-events-none absolute -inset-6 bg-gradient-to-br ${tint} to-transparent opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100`} />
                <Icon className="relative h-5 w-5 text-[#FF7A2E] transition-transform duration-300 group-hover:scale-110" />
                <span className="relative text-[11px] font-semibold text-white/90 md:text-[12px]">{label}</span>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ═════════════ PROMO CAROUSEL ═════════════ */}
      <div className="relative mx-auto mt-5 max-w-[1400px] px-4 sm:px-5 md:px-6">
        <div className="relative min-h-[300px] overflow-hidden rounded-3xl border border-white/10 md:min-h-[320px]">
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

          <div className="relative flex min-h-[300px] flex-col justify-between p-5 md:min-h-[320px] md:p-8">
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
                      className="flex items-center gap-2.5 text-[13px] text-white/85 md:text-[14px]"
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
                className="group inline-flex h-12 items-center gap-2 rounded-xl bg-gradient-to-r from-[#FF7A2E] to-[#E84A00] px-6 text-[14px] font-bold text-white shadow-[0_10px_30px_-8px_rgba(255,90,0,0.7)] transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
              >
                Post your requirement
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>

              <div className="flex items-center gap-2.5 rounded-2xl border border-white/15 bg-[#070B14]/70 px-4 py-2.5 backdrop-blur-md">
                <ShieldCheck className="h-5 w-5 text-[#FF5A00]" />
                <div>
                  <div className="text-[18px] font-black leading-none"><CountUp to={50000} suffix="+" /></div>
                  <div className="mt-0.5 text-[11px] text-white/60">Verified manufacturers</div>
                </div>
              </div>
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
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-5">
          {QUICK_ACTIONS.map(({ label, sub, icon: Icon, to, tint }, i) => (
            <motion.div
              key={label}
              className={i === QUICK_ACTIONS.length - 1 ? 'col-span-2 sm:col-span-1' : ''}
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
        <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-white/10 bg-[#161616]/[0.03] backdrop-blur-md md:grid-cols-4">
          {STATS.map(({ to, suffix, label, icon: Icon }, i) => (
            <motion.div
              key={label}
              initial={reduce ? false : { opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.08 }}
              className={`flex flex-col items-center gap-1 px-2 py-5 text-center ${i % 2 === 0 ? 'border-r border-white/10' : ''} ${i < 2 ? 'border-b border-white/10 md:border-b-0' : ''} ${i < 3 ? 'md:border-r md:border-white/10' : 'md:border-r-0'}`}
            >
              <Icon className="h-5 w-5 text-[#FF7A2E]" />
              <div className="bg-gradient-to-b from-white to-white/70 bg-clip-text text-[22px] font-black leading-none text-transparent md:text-[26px]">
                <CountUp to={to} suffix={suffix} />
              </div>
              <div className="text-[11px] text-white/60 md:text-[12px]">{label}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
