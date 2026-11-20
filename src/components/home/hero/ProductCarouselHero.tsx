import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, BadgeCheck, ChevronDown, ChevronLeft, ChevronRight, Pause, Play, Search } from 'lucide-react';
import LoanEligibleTag from '@/components/common/LoanEligibleTag';
import { useCurrency } from '@/contexts/CurrencyContext';
import { formatPriceRange } from '@/lib/productPrice';
import { fromCatalogue, heroLists, loadHeroProducts, type HeroProduct } from './heroProducts';
import './product-carousel.css';

/**
 * Landing hero: heading, search, and a curved 3D ring of product cards that drifts slowly. Drag it, scroll it
 * sideways, tap a card to bring it to the front (tap the front card to open it), or use the arrows and dots below.
 * The bottom bar names the product in front. Transforms only; still for people who ask for reduced motion and
 * paused while off screen.
 */

type Tab = 'featured' | 'top';

interface Geometry {
  cardW: number;
  cardH: number;
  rx: number;
  rz: number;
  stageH: number;
  perspective: number;
  /** cards further than this many places from the front are hidden */
  visible: number;
}

const STEP = (Math.PI * 2) / 24; // 15° between neighbours, whatever the list length
const SECONDS_PER_CARD = 3.2;
const MIN_SLOTS = 16;

/** Neighbouring cards sit edge to edge with a small gap, and the band reaches both sides of the screen. */
function geometryFor(width: number): Geometry {
  const ring = (cardW: number, gap: number, share: number) => Math.max(width * share, (cardW + gap) / Math.sin(STEP));
  if (width < 640) return { cardW: 146, cardH: 200, rx: ring(146, 8, 0.6), rz: 360, stageH: 222, perspective: 800, visible: 3.8 };
  if (width < 1024) return { cardW: 176, cardH: 242, rx: ring(176, 12, 0.52), rz: 400, stageH: 266, perspective: 1100, visible: 5.2 };
  return { cardW: 214, cardH: 292, rx: ring(214, 14, 0.5), rz: 420, stageH: 318, perspective: 1300, visible: 5.7 };
}

const pad = (n: number) => String(n).padStart(2, '0');
const NO_PRODUCTS: HeroProduct[] = [];

function prefersReducedMotion() {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function ProductCarouselHero() {
  const navigate = useNavigate();
  const { currencyInfo, rates } = useCurrency();
  const currency = currencyInfo.currency;
  const [lists, setLists] = useState<ReturnType<typeof heroLists> | null>(null);
  const [tab, setTab] = useState<Tab>('featured');
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(() => !prefersReducedMotion());
  const [geo, setGeo] = useState<Geometry>(() => geometryFor(typeof window === 'undefined' ? 1280 : window.innerWidth));
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<'Products' | 'Suppliers'>('Products');

  const stageRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Array<HTMLAnchorElement | HTMLDivElement | null>>([]);
  const pos = useRef(0);
  const target = useRef<number | null>(null);
  const vel = useRef(0);
  const drag = useRef<{ startX: number; startPos: number; lastX: number; lastT: number; moved: boolean; id: number } | null>(null);
  const suppressClick = useRef(false);
  const hover = useRef(false);
  const autoRef = useRef(auto);
  const activeRef = useRef(0);
  const geoRef = useRef(geo);
  const reduce = useRef(prefersReducedMotion());

  autoRef.current = auto;
  geoRef.current = geo;

  // ── data ──
  useEffect(() => {
    let cancelled = false;
    // Never leave the ring empty for long: the catalogue fills it if products are slow to arrive.
    const fallback = window.setTimeout(() => {
      if (!cancelled) setLists((current) => current ?? heroLists([], fromCatalogue()));
    }, 3000);
    loadHeroProducts().then((loaded) => {
      if (!cancelled) setLists(loaded);
    });
    return () => {
      cancelled = true;
      window.clearTimeout(fallback);
    };
  }, []);

  const unique: HeroProduct[] = lists ? (tab === 'top' ? lists.top : lists.featured) : NO_PRODUCTS;
  // Short lists are repeated so the ring stays full on both sides.
  const slots: Array<HeroProduct | null> = useMemo(() => {
    if (!unique.length) return Array.from({ length: 16 }, () => null);
    const out: HeroProduct[] = [];
    while (out.length < MIN_SLOTS) out.push(...unique);
    return out;
  }, [unique]);
  const count = slots.length;
  const countRef = useRef(count);
  countRef.current = count;
  const current = unique.length ? unique[active % unique.length] : null;

  // ── sizes ──
  useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => setGeo(geometryFor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── layout: place every card from the ring position ──
  const wrap = (d: number) => {
    const n = countRef.current;
    return ((((d + n / 2) % n) + n) % n) - n / 2;
  };

  const layout = useCallback(() => {
    const g = geoRef.current;
    const n = countRef.current;
    for (let i = 0; i < n; i += 1) {
      const el = cardRefs.current[i];
      if (!el) continue;
      const d = wrap(i - pos.current);
      const theta = d * STEP;
      const x = g.rx * Math.sin(theta);
      const z = g.rz * (Math.cos(theta) - 1);
      const ad = Math.abs(d);
      const opacity = ad <= g.visible - 1 ? 1 : ad >= g.visible ? 0 : g.visible - ad;
      el.style.transform = `translate3d(${x.toFixed(1)}px, 0, ${z.toFixed(1)}px) rotateY(${((theta * 180) / Math.PI).toFixed(2)}deg)`;
      el.style.opacity = opacity.toFixed(3);
      el.style.zIndex = String(1000 - Math.round(ad * 10));
      el.style.visibility = opacity <= 0.01 ? 'hidden' : 'visible';
    }
    const n2 = countRef.current;
    const front = ((Math.round(pos.current) % n2) + n2) % n2;
    if (front !== activeRef.current) {
      activeRef.current = front;
      setActive(front);
    }
  }, []);

  // ── motion loop ──
  useEffect(() => {
    let raf = 0;
    let last = 0;
    let onScreen = true;
    const tick = (t: number) => {
      const dt = last ? Math.min(0.064, (t - last) / 1000) : 0;
      last = t;
      const n = countRef.current;
      if (!drag.current) {
        if (target.current !== null) {
          const diff = target.current - pos.current;
          pos.current += diff * Math.min(1, dt * 9);
          if (Math.abs(diff) < 0.002) {
            pos.current = target.current;
            target.current = null;
          }
        } else if (Math.abs(vel.current) > 0.05) {
          pos.current += vel.current * dt;
          vel.current *= Math.pow(0.04, dt);
          if (Math.abs(vel.current) < 0.6) {
            vel.current = 0;
            target.current = Math.round(pos.current);
          }
        } else if (autoRef.current && !hover.current && !reduce.current) {
          pos.current += dt / SECONDS_PER_CARD;
        }
      }
      // keep the number small without a visible jump
      if (pos.current > n * 4 || pos.current < -n * 4) {
        const shift = Math.floor(pos.current / n) * n;
        pos.current -= shift;
        if (target.current !== null) target.current -= shift;
      }
      layout();
      if (onScreen && !document.hidden) raf = requestAnimationFrame(tick);
      else raf = 0;
    };
    const start = () => {
      if (!raf) {
        last = 0;
        raf = requestAnimationFrame(tick);
      }
    };
    const io =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(([entry]) => {
            onScreen = entry.isIntersecting;
            if (onScreen) start();
          });
    if (stageRef.current && io) io.observe(stageRef.current);
    const onVisibility = () => {
      if (!document.hidden && onScreen) start();
    };
    document.addEventListener('visibilitychange', onVisibility);
    start();
    return () => {
      cancelAnimationFrame(raf);
      io?.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [layout]);

  // New list or size: lay the cards out straight away
  useEffect(() => {
    layout();
  }, [layout, slots, geo]);

  // Switching between Featured and Top Sellers starts from the first card
  useEffect(() => {
    pos.current = 0;
    target.current = null;
    vel.current = 0;
    activeRef.current = -1;
    layout();
  }, [tab, lists, layout]);

  const goTo = useCallback(
    (i: number) => {
      const dest = pos.current + wrap(i - pos.current);
      vel.current = 0;
      if (reduce.current) {
        pos.current = Math.round(dest);
        target.current = null;
        layout();
      } else {
        target.current = Math.round(dest);
      }
    },
    [layout],
  );
  const step = (by: number) => goTo(Math.round(target.current ?? pos.current) + by);

  // ── pointer: drag to turn, tap to choose ──
  const pxPerCard = () => Math.max(60, geoRef.current.rx * Math.sin(STEP));
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    drag.current = { startX: e.clientX, startPos: pos.current, lastX: e.clientX, lastT: performance.now(), moved: false, id: e.pointerId };
    target.current = null;
    vel.current = 0;
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.startX;
    if (!d.moved && Math.abs(dx) > 6) {
      d.moved = true;
      stageRef.current?.setPointerCapture(e.pointerId);
    }
    if (!d.moved) return;
    pos.current = d.startPos - dx / pxPerCard();
    const now = performance.now();
    const dt = Math.max(1, now - d.lastT) / 1000;
    vel.current = Math.max(-14, Math.min(14, -(e.clientX - d.lastX) / pxPerCard() / dt));
    d.lastX = e.clientX;
    d.lastT = now;
  };
  const endDrag = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (d.moved) {
      suppressClick.current = true;
      window.setTimeout(() => {
        suppressClick.current = false;
      }, 0);
      if (reduce.current || performance.now() - d.lastT > 120) {
        vel.current = 0;
        target.current = Math.round(pos.current);
      }
    }
  };

  // Sideways scrolling (trackpads, shift + wheel) turns the ring; up and down still scroll the page.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    let snap = 0;
    const onWheel = (e: WheelEvent) => {
      const sideways = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.shiftKey ? e.deltaY : 0;
      if (!sideways) return;
      e.preventDefault();
      target.current = null;
      vel.current = 0;
      pos.current += sideways / pxPerCard();
      window.clearTimeout(snap);
      snap = window.setTimeout(() => {
        target.current = Math.round(pos.current);
      }, 140);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
      window.clearTimeout(snap);
    };
  }, []);

  const onCardClick = (i: number) => (e: MouseEvent) => {
    if (suppressClick.current) {
      e.preventDefault();
      return;
    }
    if (Math.abs(wrap(i - pos.current)) > 0.5) {
      e.preventDefault();
      goTo(i);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const next = Math.round(target.current ?? pos.current) + (e.key === 'ArrowRight' ? 1 : -1);
    goTo(next);
    const n = countRef.current;
    cardRefs.current[((next % n) + n) % n]?.focus({ preventScroll: true });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    navigate(scope === 'Suppliers' ? `/manufacturers${q ? `?q=${encodeURIComponent(q)}` : ''}` : `/products${q ? `?q=${encodeURIComponent(q)}` : ''}`);
  };

  // Start loading the other list's photos when someone points at its tab, so switching shows them at once.
  const prefetched = useRef(new Set<Tab>());
  const prefetch = (key: Tab) => {
    if (!lists || prefetched.current.has(key)) return;
    prefetched.current.add(key);
    for (const item of key === 'top' ? lists.top : lists.featured) {
      const img = new Image();
      img.decoding = 'async';
      img.src = item.img;
    }
  };

  const price = (p: HeroProduct, compact = true) => formatPriceRange(p.priceMin, p.priceMax, p.currency, currency, rates, { compact });

  return (
    <section className="pc-hero" aria-label="BulkSkart products">
      <div className="relative mx-auto max-w-[1400px] px-4 pt-6 text-center sm:px-5 md:px-6 md:pt-8">
        <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1 text-[11.5px] font-semibold text-white/80 md:text-[12px]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#FF5A00] shadow-[0_0_10px_rgba(255,90,0,0.9)]" />
          B2B wholesale marketplace
        </p>
        <h1 className="pc-title mt-3 text-[32px] sm:text-[44px] md:text-[56px]">
          Source Direct From <em className="whitespace-nowrap">Top Sellers</em>
        </h1>
        <p className="mx-auto mt-2.5 max-w-[640px] text-[14px] leading-relaxed text-white/60 md:text-[15.5px]">
          Buy in bulk from verified manufacturers. Drag, scroll or tap a product to explore.
        </p>

        <form onSubmit={submit} role="search" className="mx-auto mt-4 flex max-w-[620px] items-stretch overflow-hidden rounded-full border border-white/15 bg-[#121212] p-1 shadow-[0_18px_50px_-24px_rgba(255,90,0,0.55)] focus-within:border-[#FF5A00]/70">
          <div className="relative shrink-0">
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as 'Products' | 'Suppliers')}
              aria-label="Search in"
              className="h-10 cursor-pointer appearance-none rounded-full bg-transparent pl-4 pr-7 text-[13px] font-semibold text-white focus:outline-none md:h-11"
            >
              <option>Products</option>
              <option>Suppliers</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/55" aria-hidden="true" />
          </div>
          <span className="my-2 w-px bg-white/12" aria-hidden="true" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search steel pipes, cotton yarn, packaging…"
            aria-label="Search"
            className="min-w-0 flex-1 bg-transparent px-3 text-[13.5px] text-white placeholder:text-white/40 focus:outline-none md:text-[14.5px]"
          />
          <button type="submit" className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#FF5A00] px-4 text-[13px] font-bold text-black transition-colors hover:bg-[#FF7A2E] md:px-5">
            <Search className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Search</span>
          </button>
        </form>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-[12.5px]">
          <div role="tablist" aria-label="Products to show" className="inline-flex rounded-full border border-white/12 bg-white/[0.04] p-1">
            {(
              [
                ['featured', 'Featured'],
                ['top', 'Top Sellers'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                onPointerEnter={() => prefetch(key)}
                onFocus={() => prefetch(key)}
                className={`rounded-full px-3.5 py-1.5 font-semibold transition-colors ${tab === key ? 'bg-[#FF5A00] text-black' : 'text-white/70 hover:text-white'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <Link to="/products" className="inline-flex items-center gap-1 rounded-full border border-white/12 px-3.5 py-2 font-semibold text-white/85 transition-colors hover:border-[#FF5A00]/70 hover:text-white">
            Explore all products <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>

      {/* ── the ring ── */}
      <div
        ref={stageRef}
        className="pc-stage mx-auto mt-1 w-full max-w-[1600px]"
        style={{
          height: geo.stageH + 24,
          ['--pc-perspective' as string]: `${geo.perspective}px`,
          ['--pc-card-w' as string]: `${geo.cardW}px`,
          ['--pc-card-h' as string]: `${geo.cardH}px`,
        }}
        role="group"
        aria-roledescription="carousel"
        aria-label={tab === 'top' ? 'Top sellers' : 'Featured products'}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerEnter={(e) => {
          if (e.pointerType === 'mouse') hover.current = true;
        }}
        onPointerLeave={() => {
          hover.current = false;
        }}
        onKeyDown={onKeyDown}
      >
        <div className="pc-ring" key={`${tab}-${lists ? 'ready' : 'loading'}`}>
          {slots.map((p, i) => {
            const isFront = p !== null && i === active;
            if (!p) {
              return (
                <div
                  key={`s-${i}`}
                  ref={(el) => {
                    cardRefs.current[i] = el;
                  }}
                  className="pc-card pc-skeleton"
                  aria-hidden="true"
                />
              );
            }
            return (
              <Link
                key={`${p.id}-${i}`}
                ref={(el) => {
                  cardRefs.current[i] = el;
                }}
                to={p.to}
                className="pc-card"
                data-active={isFront}
                tabIndex={isFront ? 0 : -1}
                aria-hidden={isFront ? undefined : true}
                aria-label={`${p.name}, ${p.supplier}, ${price(p, false)}`}
                draggable={false}
                onClick={onCardClick(i)}
              >
                <img src={p.img} alt="" loading={i < 6 || i > count - 6 ? 'eager' : 'lazy'} decoding="async" draggable={false} />
                {p.topSeller && p.badge && (
                  <span className="pc-card-badge rounded-full bg-[#FF5A00] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black">{p.badge}</span>
                )}
                <span className="pc-card-info text-left">
                  <span className="line-clamp-2 text-[11px] font-semibold leading-snug text-white sm:text-[12px] md:text-[13px]">{p.name}</span>
                  <span className="mt-1 block text-[11px] font-bold text-[#FF7A2E] sm:text-[11.5px] md:text-[12.5px]">{price(p)}</span>
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── bottom bar ── */}
      <div className="relative mx-auto max-w-[1400px] px-4 pb-5 sm:px-5 md:px-6 md:pb-6">
        {/* room on the right for the floating "AI Trade Help" button, which sits over this bar on laptop screens */}
        <div className="grid gap-3 border-t border-white/10 pt-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center lg:pr-[124px] min-[1620px]:pr-0">
          <div className="flex min-w-0 items-center gap-3" aria-live={auto ? 'off' : 'polite'}>
            <p className="shrink-0 text-white">
              <span className="text-[26px] font-light tabular-nums leading-none md:text-[30px]">{current ? pad((active % unique.length) + 1) : '--'}</span>
              <span className="ml-1 text-[12px] text-white/45 tabular-nums">/ {pad(unique.length || 16)}</span>
            </p>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-extrabold uppercase tracking-[0.06em] text-white md:text-[14px]">{current ? current.name : 'Loading products…'}</p>
              {current && (
                <p className="flex min-w-0 items-center gap-1 truncate text-[11.5px] text-white/55">
                  {current.verified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-[#FF5A00]" aria-label="Verified supplier" />}
                  <span className="truncate">
                    {current.supplier} · {current.country}
                    {current.moq ? ` · MOQ ${current.moq}` : ''}
                  </span>
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-center gap-1.5" role="group" aria-label="Choose a product">
            {unique.map((p, i) => (
              <button
                key={p.id}
                type="button"
                className="pc-dot"
                aria-label={`Show ${p.name}`}
                aria-current={current?.id === p.id ? 'true' : undefined}
                onClick={() => {
                  const n = countRef.current;
                  const base = Math.round(pos.current);
                  // the nearest copy of this product on the ring
                  let best = i;
                  for (let k = i; k < n; k += unique.length) if (Math.abs(wrap(k - base)) < Math.abs(wrap(best - base))) best = k;
                  goTo(best);
                }}
              />
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 md:justify-end">
            {current && (
              <span className="flex items-center gap-2">
                <span className="text-[14px] font-extrabold text-[#FF7A2E]">{price(current)}</span>
                <LoanEligibleTag size="xs" />
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <button type="button" onClick={() => step(-1)} aria-label="Previous product" className="grid h-8 w-8 place-items-center rounded-full border border-white/15 text-white/80 transition-colors hover:border-[#FF5A00] hover:text-white">
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
              <button type="button" onClick={() => step(1)} aria-label="Next product" className="grid h-8 w-8 place-items-center rounded-full border border-white/15 text-white/80 transition-colors hover:border-[#FF5A00] hover:text-white">
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setAuto((a) => !a)}
                aria-pressed={auto}
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/15 px-3 text-[11px] font-semibold uppercase tracking-wide text-white/75 transition-colors hover:border-[#FF5A00] hover:text-white"
              >
                {auto ? <Pause className="h-3.5 w-3.5" aria-hidden="true" /> : <Play className="h-3.5 w-3.5" aria-hidden="true" />}
                Auto {auto ? 'on' : 'off'}
              </button>
              {current && (
                <Link to={current.to} className="inline-flex h-8 items-center gap-1 rounded-full bg-white px-3 text-[12px] font-bold text-black transition-colors hover:bg-[#FF5A00]">
                  View <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              )}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
