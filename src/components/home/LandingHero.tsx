import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  ShieldCheck, Truck, ArrowRight, Layers, ChevronRight, FilePlus2, Gavel, Store, Users, Package, Globe, BadgeCheck,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import ProductCarouselHero from '@/components/home/hero/ProductCarouselHero';

/*
 * Top of the home page, laid out from the BulkSkart mobile design picture: the hero banner with the forklift photo,
 * the category tiles, the "Get Bulk Orders" banner and four action tiles. The photos are cut from that picture
 * (public/home-design). The product scroll and the stats strip follow.
 */

// ── Content ────────────────────────────────────────────────────────────
const HERO_SLIDES = [
  { title: 'The Global B2B Marketplace for', accent: 'Bulk Buying & Selling' },
  { title: 'Compare Quotes From', accent: 'Factories Worldwide' },
  { title: 'Pay Securely With', accent: 'Trade Assurance' },
];

const HERO_FEATURES = [
  { icon: ShieldCheck, label: ['Verified', 'Suppliers'] },
  { icon: Layers, label: ['Bulk', 'Pricing'] },
  { icon: Truck, label: ['Free', 'Delivery*'] },
  { icon: BadgeCheck, label: ['Trade', 'Assurance'] },
];

const CATEGORY_TILES = [
  { label: ['Industrial', 'Machinery'], img: '/home-design/cat-machinery.jpg', to: '/products?category=machinery-industrial' },
  { label: ['Packaging', 'Materials'], img: '/home-design/cat-packaging.jpg', to: '/products?category=packaging' },
  { label: ['Electrical', '& Electronics'], img: '/home-design/cat-electrical.jpg', to: '/products?category=electronics-electricals' },
  { label: ['Textile', '& Apparel'], img: '/home-design/cat-textile.jpg', to: '/products?category=textiles-apparel' },
  { label: ['Chemicals', '& Raw Materials'], img: '/home-design/cat-chemicals.jpg', to: '/products?category=chemicals-raw-materials' },
];

// More categories on wider screens (photos are thumbnails of the licensed catalogue photos, see public/home-design)
const MORE_CATEGORY_TILES = [
  { label: ['Metals', '& Steel'], img: '/home-design/cat-metals.jpg', to: '/products?category=construction-building' },
  { label: ['Construction', '& Building'], img: '/home-design/cat-construction.jpg', to: '/products?q=construction' },
  { label: ['Agriculture', '& Food'], img: '/home-design/cat-agriculture.jpg', to: '/products?category=agriculture-food' },
  { label: ['Automotive', 'Parts'], img: '/home-design/cat-automotive.jpg', to: '/products?q=automotive' },
  { label: ['Solar', '& Energy'], img: '/home-design/cat-solar.jpg', to: '/products?q=solar' },
  { label: ['Office', 'Furniture'], img: '/home-design/cat-furniture.jpg', to: '/products?q=furniture' },
  { label: ['Home', '& Kitchen'], img: '/home-design/cat-home-kitchen.jpg', to: '/products?q=kitchen' },
  { label: ['Beauty &', 'Personal Care'], img: '/home-design/cat-beauty.jpg', to: '/products?q=beauty' },
];

const ACTION_TILES = [
  { title: 'Live Bidding', sub: '(Buy & Sell)', icon: Gavel, to: '/auctions' },
  { title: 'Post RFQ', sub: '(Get Quotes)', icon: FilePlus2, to: '/post-requirement' },
  { title: 'Find Suppliers', sub: '(Verified)', icon: Users, to: '/manufacturers' },
  { title: 'Become a Supplier', sub: '(List & Sell)', icon: Store, to: '/auth?tab=supplier' },
];

const STATS = [
  { to: 50000, suffix: '+', label: 'Verified Manufacturers', icon: Users },
  { to: 1, suffix: 'M+', label: 'Bulk Products', icon: Package },
  { to: 120, suffix: '+', label: 'Trade Countries', icon: Globe },
  { to: 10000, suffix: '+', label: 'Live RFQs & Auctions', icon: Gavel },
];

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
  const { profile, resolvedRole } = useAuth();
  const [slide, setSlide] = useState(0);
  const isSupplier = resolvedRole === 'supplier' || profile?.role === 'supplier';

  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setSlide((s) => (s + 1) % HERO_SLIDES.length), 6500);
    return () => clearInterval(t);
  }, [reduce]);

  const current = HERO_SLIDES[slide];

  return (
    <section className="relative isolate overflow-hidden bg-black text-white">
      {/* ═════════════ HERO ═════════════ */}
      <div className="relative overflow-hidden">
        {/* the same warehouse, dim and soft, behind the text */}
        <img
          src="/home-design/hero-forklift.jpg"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover object-left-top opacity-[0.22] blur-[2px]"
          loading="eager"
          decoding="async"
        />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
        {/* warm light from the lower left, like the picture */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_0%_100%,rgba(255,90,0,0.28),transparent_70%),radial-gradient(ellipse_50%_50%_at_75%_45%,rgba(255,140,40,0.12),transparent_70%)]" />
        {/* warehouse and forklift photo on the right, fading into the black on its left */}
        <div aria-hidden="true" className="pointer-events-none absolute right-0 top-0 w-[43%] max-w-[300px] [mask-image:linear-gradient(to_top,transparent_0%,#000_30%)] sm:w-[40%] sm:max-w-none lg:h-full lg:w-auto">
          <img
            src="/home-design/hero-forklift.jpg"
            alt=""
            className="h-auto w-full [mask-image:linear-gradient(90deg,transparent_0%,rgba(0,0,0,0.75)_16%,#000_30%)] lg:h-full lg:w-auto lg:max-w-none"
            loading="eager"
            decoding="async"
          />
        </div>

        <div className="relative mx-auto max-w-[1400px] px-3.5 pt-4 sm:px-5 md:px-6 md:pt-12">
          <div className="max-w-[640px]">
            <motion.span
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#FF5A00]/80 bg-black/50 px-2.5 py-[3px] text-[10.5px] font-semibold text-white backdrop-blur-sm md:gap-2 md:px-3 md:py-1 md:text-[13px]"
            >
              <span className="relative flex h-2 w-2 md:h-2.5 md:w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#FF2D1A] opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#FF2D1A] md:h-2.5 md:w-2.5" />
              </span>
              Live Now: 52,000+ Active RFQs
            </motion.span>

            <div className="mt-2.5 min-h-[72px] min-[400px]:min-h-[76px] sm:min-h-[118px] md:mt-4 lg:min-h-[176px]">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={slide}
                  initial={reduce ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? undefined : { opacity: 0, y: -10 }}
                  transition={{ duration: 0.45 }}
                >
                  {slide === 0 ? (
                    <h1 className="max-w-[245px] text-[21px] font-extrabold leading-[1.13] tracking-tight min-[400px]:max-w-[262px] min-[400px]:text-[22.5px] sm:max-w-[420px] sm:text-[34px] lg:max-w-[620px] lg:text-[52px]">
                      {current.title}
                      <br />
                      <span className="text-[#FF6A14]">{current.accent}</span>
                    </h1>
                  ) : (
                    <p className="max-w-[245px] text-[21px] font-extrabold leading-[1.13] tracking-tight min-[400px]:max-w-[262px] min-[400px]:text-[22.5px] sm:max-w-[420px] sm:text-[34px] lg:max-w-[620px] lg:text-[52px]">
                      {current.title}
                      <br />
                      <span className="text-[#FF6A14]">{current.accent}</span>
                    </p>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            <p className="mt-2 max-w-[205px] text-[11.5px] leading-[1.35] text-white/85 min-[400px]:max-w-[222px] min-[400px]:text-[12px] sm:max-w-[420px] sm:text-[14px] lg:max-w-[460px] lg:text-[17px] lg:leading-relaxed">
              Connect with verified manufacturers, suppliers and bulk buyers worldwide. Get the best bulk prices, instant quotes and secure deals.
            </p>

            <div className="mt-3.5 flex flex-wrap items-center gap-2 md:mt-6 md:gap-3">
              <Link
                to="/post-requirement"
                className="group inline-flex h-[31px] items-center gap-1.5 rounded-[10px] bg-gradient-to-b from-[#FF7A1A] to-[#F25600] px-3.5 text-[12px] font-bold text-white shadow-[0_8px_24px_-8px_rgba(255,90,0,0.9)] transition-transform hover:-translate-y-0.5 md:h-12 md:px-6 md:text-[15px]"
              >
                Post Your Requirement
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                to="/manufacturers"
                className="inline-flex h-[31px] items-center rounded-[10px] border border-white/80 bg-black/60 px-3.5 text-[12px] font-bold text-white backdrop-blur-sm transition-colors hover:border-[#FF5A00] md:h-12 md:px-6 md:text-[15px]"
              >
                Get Supplier Quotes
              </Link>
            </div>
          </div>

          {/* four promises with dividers */}
          <ul className="relative mt-4 grid grid-cols-4 md:mt-10 md:max-w-[760px]">
            {HERO_FEATURES.map(({ icon: Icon, label }, i) => (
              <li key={label.join(' ')} className={`flex items-center justify-center gap-1.5 px-1 md:justify-start md:gap-2.5 md:px-4 ${i > 0 ? 'border-l border-white/20' : ''} ${i === 0 ? 'md:pl-0' : ''}`}>
                <Icon className="h-[18px] w-[18px] shrink-0 text-[#FF6A14] min-[400px]:h-5 min-[400px]:w-5 md:h-7 md:w-7" strokeWidth={1.75} aria-hidden="true" />
                <span className="text-[9.5px] font-medium leading-tight text-white/90 min-[400px]:text-[10px] sm:text-[12px] md:text-[14px]">
                  {label[0]}
                  <br />
                  {label[1]}
                </span>
              </li>
            ))}
          </ul>

          {/* slide dots */}
          <div className="relative flex items-center justify-center gap-1.5 pb-3 pt-3 md:justify-start md:gap-2 md:pb-8" role="tablist" aria-label="Hero slides">
            {HERO_SLIDES.map((s, i) => (
              <button
                key={s.accent}
                type="button"
                role="tab"
                aria-selected={i === slide}
                aria-label={`Show slide ${i + 1}`}
                onClick={() => setSlide(i)}
                className={`h-2 w-2 rounded-full transition-colors md:h-2.5 md:w-2.5 ${i === slide ? 'bg-[#FF5A00]' : 'bg-white/35 hover:bg-white/60'}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ═════════════ CATEGORY TILES ═════════════ */}
      <div className="relative mx-auto max-w-[1400px] px-2 sm:px-5 md:px-6">
        <div className="grid grid-cols-6 gap-1.5 sm:gap-2.5 md:grid-cols-7 md:gap-3 lg:gap-4">
          {CATEGORY_TILES.map(({ label, img, to }) => (
            <Link
              key={label.join(' ')}
              to={to}
              className="group flex flex-col items-center overflow-hidden rounded-[10px] bg-white px-0.5 pb-1.5 pt-1.5 text-center shadow-[0_6px_18px_-10px_rgba(0,0,0,0.9)] transition-transform hover:-translate-y-0.5 md:rounded-2xl md:pb-3 md:pt-3"
            >
              <img src={img} alt="" className="h-[33px] w-full object-contain mix-blend-multiply sm:h-[48px] md:h-[60px] lg:h-[78px]" loading="eager" decoding="async" />
              <span className="mt-1 whitespace-nowrap text-[7.5px] font-semibold leading-[1.2] tracking-[-0.02em] text-[#141414] min-[420px]:text-[8px] sm:text-[11px] md:mt-2 md:text-[12px] lg:text-[14px]">
                {label[0]}
                <br />
                {label[1]}
              </span>
            </Link>
          ))}
          {MORE_CATEGORY_TILES.map(({ label, img, to }) => (
            <Link
              key={label.join(' ')}
              to={to}
              className="group hidden flex-col items-center overflow-hidden rounded-2xl bg-white px-2 pb-3 pt-3 text-center shadow-[0_6px_18px_-10px_rgba(0,0,0,0.9)] transition-transform hover:-translate-y-0.5 md:flex"
            >
              <img src={img} alt="" className="h-[60px] w-full rounded-lg object-cover lg:h-[78px]" loading="lazy" decoding="async" />
              <span className="mt-2 whitespace-nowrap text-[12px] font-semibold leading-[1.2] tracking-[-0.02em] text-[#141414] lg:text-[14px]">
                {label[0]}
                <br />
                {label[1]}
              </span>
            </Link>
          ))}
          <Link
            to="/categories"
            className="flex flex-col items-center justify-center rounded-[10px] bg-white px-1 py-1.5 text-center shadow-[0_6px_18px_-10px_rgba(0,0,0,0.9)] transition-transform hover:-translate-y-0.5 md:rounded-2xl"
          >
            <span className="grid h-[24px] w-[24px] place-items-center rounded-full bg-[#ECECEC] sm:h-8 sm:w-8 md:h-12 md:w-12">
              <ChevronRight className="h-3.5 w-3.5 text-[#141414] sm:h-4 sm:w-4 md:h-6 md:w-6" />
            </span>
            <span className="mt-1.5 whitespace-nowrap text-[7.5px] font-semibold leading-[1.2] tracking-[-0.02em] text-[#141414] min-[420px]:text-[8px] sm:text-[11px] md:mt-2 md:text-[12px] lg:text-[14px]">
              More
              <br />
              Categories
            </span>
          </Link>
        </div>
      </div>

      {/* ═════════════ GET BULK ORDERS ═════════════ */}
      <div className="relative mx-auto mt-4 max-w-[1400px] px-2 sm:px-5 md:mt-6 md:px-6">
        <div className="relative overflow-hidden rounded-2xl border border-[#FF8A4C]/35 bg-gradient-to-r from-[#120d1a] via-[#1a1224] to-[#120d1a] md:rounded-3xl">
          <img
            src="/home-design/banner-refinery.jpg"
            alt=""
            aria-hidden="true"
            className="absolute inset-y-0 right-0 h-full w-[62%] object-cover [mask-image:linear-gradient(90deg,transparent_0%,rgba(0,0,0,0.7)_30%,#000_55%)] md:w-[55%]"
            loading="lazy"
            decoding="async"
          />
          <div className="relative px-3.5 py-3 md:px-10 md:py-10">
            <h2 className="text-[17px] font-extrabold leading-[1.15] tracking-tight min-[400px]:text-[18px] sm:text-[26px] md:text-[40px]">
              Get <span className="text-[#FF6A14]">Bulk Orders</span>
              <br />
              for Your Products
            </h2>
            <p className="mt-1 max-w-[190px] text-[10.5px] leading-snug text-white/85 min-[400px]:max-w-[205px] min-[400px]:text-[11px] sm:max-w-[320px] sm:text-[13px] md:mt-3 md:max-w-[420px] md:text-[16px]">
              List your products, reach verified buyers and grow your business.
            </p>
            <Link
              to={isSupplier ? '/dashboard/supplier/products' : '/auth?tab=supplier'}
              className="group mt-2.5 inline-flex h-[27px] items-center gap-1.5 rounded-[9px] bg-gradient-to-b from-[#FF7A1A] to-[#F25600] px-3.5 text-[11.5px] font-bold text-white shadow-[0_8px_22px_-8px_rgba(255,90,0,0.9)] transition-transform hover:-translate-y-0.5 md:mt-5 md:h-12 md:px-6 md:text-[15px]"
            >
              List Now
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* ═════════════ ACTION TILES ═════════════ */}
      <div className="relative mx-auto mt-3 max-w-[1400px] px-2 sm:px-5 md:mt-5 md:px-6">
        <div className="grid grid-cols-4 gap-1.5 sm:gap-2.5 md:gap-4">
          {ACTION_TILES.map(({ title, sub, icon: Icon, to }) => (
            <Link
              key={title}
              to={to}
              className="group flex flex-col items-center justify-center rounded-xl border border-white/12 bg-gradient-to-b from-[#1b1b1b] to-[#0e0e0e] px-0.5 py-2 text-center md:rounded-2xl shadow-[0_10px_24px_-14px_rgba(255,90,0,0.6)] transition-all hover:-translate-y-0.5 hover:border-[#FF5A00]/60 md:py-6"
            >
              <Icon className="h-[22px] w-[22px] text-[#FF6A14] md:h-9 md:w-9" strokeWidth={1.6} aria-hidden="true" />
              <span className="mt-1 whitespace-nowrap text-[9.5px] font-bold leading-tight text-white min-[400px]:text-[10px] sm:text-[12px] md:mt-3 md:text-[16px]">{title}</span>
              <span className="mt-0.5 text-[8.5px] text-white/70 min-[400px]:text-[9px] sm:text-[11px] md:text-[13px]">{sub}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* ═════════════ PRODUCT SCROLL: curved product carousel ═════════════ */}
      <div className="mt-4 md:mt-8">
        <ProductCarouselHero />
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
