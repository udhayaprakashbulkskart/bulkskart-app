import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Box,
  Camera,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Factory,
  FlaskConical,
  Globe,
  Heart,
  Layers,
  MessageCircleMore,
  Network,
  Package,
  PackageOpen,
  Plane,
  RefreshCw,
  Settings,
  Shirt,
  ShieldCheck,
  Stethoscope,
  TreePine,
  Wheat,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Laurel } from '../shared/parts';
import { Flag } from './flags';
import { optimizeCatalogUrl } from './images';
import { activeDot, dotTarget, nearestCard, nextScrollStep, type Direction } from './scroll';
import './suppliers-showcase.css';

/** What one card needs. The section's own supplier type has all of this and more. */
export interface ShowcaseSupplier {
  id: string;
  name: string;
  slug?: string;
  country: string;
  /** The emoji flag, used only when there is no drawn flag for the country. */
  flag: string;
  img: string;
  industry?: string;
  sampleProduct?: string;
  tags?: string[];
  yearsInBusiness?: number;
  totalProducts?: number;
  exportsGlobally?: boolean;
}

export interface CountryChip {
  key: string;
  label: string;
  flag: string;
}

interface SuppliersShowcaseProps<T extends ShowcaseSupplier> {
  suppliers: T[];
  selectedCountry: string;
  onCountryChange: (key: string) => void;
  /** The chips after "All Global". */
  chips: CountryChip[];
  /** The countries in the "More" menu. */
  moreChips: CountryChip[];
  secondsLeft: number;
  isRefreshing: boolean;
  onRefresh: () => void;
  error: string | null;
  onRetry: () => void;
  onOpenSupplier: (supplier: T) => void;
  renderLogo: (supplier: T) => React.ReactNode;
  /** Time between automatic moves of the cards. */
  autoScrollMs?: number;
}

const FAVOURITES_KEY = 'bulkskart_fav_mfg';

/** The four figures in the strip, as printed in the design. */
const FIGURES: Array<{ icon: LucideIcon; value: string; label: string }> = [
  { icon: Factory, value: '10,000+', label: 'Verified Suppliers' },
  { icon: Globe, value: '120+', label: 'Countries' },
  { icon: Layers, value: '50+', label: 'Industries' },
  { icon: ShieldCheck, value: '100%', label: 'Verified Profiles' },
];

const TAG_ICONS: Array<[RegExp, LucideIcon]> = [
  [/pcb|circuit|semiconductor|chip|micro|electronic|sensor/i, Cpu],
  [/cable|power|electric|switchgear|transformer|battery|energy|solar|wire/i, Zap],
  [/chemical|polymer|resin|coating|plastic|pellet|paint/i, FlaskConical],
  [/textile|fabric|garment|apparel|yarn|cotton|cloth/i, Shirt],
  [/pack|box|carton|bottle|glass|jar|container/i, Package],
  [/food|agro|spice|grain|coffee|tea|rice|sugar/i, Wheat],
  [/medical|pharma|health|surgical/i, Stethoscope],
  [/timber|wood|lumber|furniture|pallet/i, TreePine],
  [/optic|lens|camera/i, Camera],
  [/oem|odm|machin|cnc|hydraulic|tool|gear|industrial|engineer|steel|metal|auto/i, Settings],
];

function tagIcon(label: string): LucideIcon {
  for (const [pattern, icon] of TAG_ICONS) if (pattern.test(label)) return icon;
  return Network;
}

function readFavourites(): string[] {
  try {
    const saved = localStorage.getItem(FAVOURITES_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

/** A shield with a tick and a small laurel on each side: the mark beside the section title. */
function TitleMark() {
  return (
    <svg className="vs-shield" viewBox="0 0 80 92" aria-hidden="true">
      <defs>
        <linearGradient id="vs-shield-edge" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff9b3d" />
          <stop offset="1" stopColor="#ee5a00" />
        </linearGradient>
        <linearGradient id="vs-shield-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a1a08" />
          <stop offset="1" stopColor="#1a0d06" />
        </linearGradient>
      </defs>
      <path
        d="M40 5C30 13 17 15 7 15v31c0 20 15 35 33 41 18-6 33-21 33-41V15C63 15 50 13 40 5Z"
        fill="url(#vs-shield-fill)"
        stroke="url(#vs-shield-edge)"
        strokeWidth="6"
        strokeLinejoin="round"
      />
      <path d="M25 46l11 11 20-22" fill="none" stroke="#ff9b3d" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** The dark shield with a tick that starts the "Verified Manufacturer" badge. */
function BadgeShield() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2l8.5 3v6.2c0 5.1-3.5 8.9-8.5 10.8-5-1.9-8.5-5.7-8.5-10.8V5z" fill="#2a1304" />
      <path d="M8 12.2l3 3 5.2-6" fill="none" stroke="#ff9d2e" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CardImage({ src, alt, priority }: { src: string; alt: string; priority: boolean }) {
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const url = useMemo(() => optimizeCatalogUrl(src), [src]);

  useEffect(() => {
    setState('loading');
  }, [url]);

  if (!url || state === 'failed') {
    return (
      <div className="vs-media-empty" role="img" aria-label={alt}>
        <Factory aria-hidden="true" />
      </div>
    );
  }
  return (
    <>
      {state === 'loading' && <div className="vs-media-wait" aria-hidden="true" />}
      <img
        src={url}
        alt={alt}
        width={560}
        height={350}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        // React 18 does not know fetchPriority yet, so it is passed as a plain attribute
        {...({ fetchpriority: priority ? 'high' : 'low' } as React.ImgHTMLAttributes<HTMLImageElement>)}
        onLoad={() => setState('ready')}
        onError={() => setState('failed')}
        className={state === 'ready' ? 'is-ready' : undefined}
      />
    </>
  );
}

/**
 * Keeps the cards moving by themselves, right and then back left, and reports where they are.
 * It stops while the pointer is over them, while something inside has focus, after a touch or a wheel turn
 * (for a few seconds), while the tab is hidden, while the section is off screen, and for people who ask
 * their device for less motion.
 */
function useCarousel(trackRef: React.RefObject<HTMLDivElement | null>, resetKey: string, intervalMs: number, hasCards: boolean) {
  const [position, setPosition] = useState({ card: 0, dot: 0, dots: 0 });
  const directionRef = useRef<Direction>(1);
  const pausedUntilRef = useRef(0);
  /** Leave the cards alone for a few seconds: the visitor has just used them. */
  const pause = useCallback((ms = 8000) => {
    pausedUntilRef.current = Date.now() + ms;
  }, []);

  const measure = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const cards = Array.from(el.children) as HTMLElement[];
    const max = Math.max(0, el.scrollWidth - el.clientWidth);
    const base = cards[0]?.offsetLeft ?? 0;
    const offsets = cards.map((c) => c.offsetLeft - base);
    const dots = max > 6 ? Math.min(4, cards.length) : 0;
    const next = { card: nearestCard(offsets, el.scrollLeft), dot: activeDot(el.scrollLeft, max, dots), dots };
    setPosition((prev) => (prev.card === next.card && prev.dot === next.dot && prev.dots === next.dots ? prev : next));
  }, [trackRef]);

  // a new set of cards starts again from the left
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    directionRef.current = 1;
    if (typeof el.scrollTo === 'function') el.scrollTo({ left: 0, behavior: 'auto' });
    else el.scrollLeft = 0;
    measure();
  }, [resetKey, hasCards, measure, trackRef]);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return undefined;

    let hovering = false;
    let hasFocus = false;
    let visible = typeof IntersectionObserver === 'undefined';
    let frame = 0;
    const reducedMotion = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

    const onPointerEnter = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') hovering = true;
    };
    const onPointerLeave = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') hovering = false;
    };
    // Only real input pauses the cards (touch, wheel, keys, clicks): the browser also scrolls the track
    // by itself when the layout changes, and that must not count as the visitor scrolling.
    const onScroll = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };

    const section = el.closest('.vs') ?? el;
    let observer: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(
        (entries) => {
          visible = entries.some((entry) => entry.isIntersecting);
        },
        { threshold: 0.3 },
      );
      observer.observe(section);
    }

    const tick = () => {
      if (reducedMotion?.matches || document.hidden || !visible || hovering || hasFocus || Date.now() < pausedUntilRef.current) return;
      const cards = el.children;
      if (cards.length < 2) return;
      const first = cards[0] as HTMLElement;
      const second = cards[1] as HTMLElement;
      const move = nextScrollStep({
        scrollLeft: el.scrollLeft,
        max: el.scrollWidth - el.clientWidth,
        step: second.offsetLeft - first.offsetLeft,
        dir: directionRef.current,
      });
      if (!move) return;
      directionRef.current = move.dir;
      if (typeof el.scrollTo === 'function') el.scrollTo({ left: move.target, behavior: 'smooth' });
      else el.scrollLeft = move.target;
    };

    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      hasFocus = typeof target?.matches === 'function' ? target.matches(':focus-visible') : true;
    };
    const onFocusOut = () => {
      hasFocus = false;
    };
    const touch = () => pause();

    el.addEventListener('scroll', onScroll, { passive: true });
    el.addEventListener('pointerenter', onPointerEnter);
    el.addEventListener('pointerleave', onPointerLeave);
    el.addEventListener('pointerdown', touch);
    el.addEventListener('touchstart', touch, { passive: true });
    el.addEventListener('wheel', touch, { passive: true });
    el.addEventListener('keydown', touch);
    el.addEventListener('focusin', onFocusIn);
    el.addEventListener('focusout', onFocusOut);
    window.addEventListener('resize', measure);
    const timer = window.setInterval(tick, intervalMs);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('resize', measure);
      el.removeEventListener('scroll', onScroll);
      el.removeEventListener('pointerenter', onPointerEnter);
      el.removeEventListener('pointerleave', onPointerLeave);
      el.removeEventListener('pointerdown', touch);
      el.removeEventListener('touchstart', touch);
      el.removeEventListener('wheel', touch);
      el.removeEventListener('keydown', touch);
      el.removeEventListener('focusin', onFocusIn);
      el.removeEventListener('focusout', onFocusOut);
      observer?.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [intervalMs, hasCards, measure, pause, trackRef]);

  const scrollToDot = useCallback(
    (index: number) => {
      const el = trackRef.current;
      if (!el) return;
      const left = dotTarget(index, el.scrollWidth - el.clientWidth, position.dots);
      pause();
      if (typeof el.scrollTo === 'function') el.scrollTo({ left, behavior: 'smooth' });
      else el.scrollLeft = left;
    },
    [pause, position.dots, trackRef],
  );

  const scrollByCard = useCallback(
    (direction: Direction) => {
      const el = trackRef.current;
      if (!el || el.children.length < 2) return;
      const first = el.children[0] as HTMLElement;
      const second = el.children[1] as HTMLElement;
      const step = second.offsetLeft - first.offsetLeft;
      directionRef.current = direction;
      pause();
      if (typeof el.scrollBy === 'function') el.scrollBy({ left: direction * step, behavior: 'smooth' });
      else el.scrollLeft += direction * step;
    },
    [pause, trackRef],
  );

  return { ...position, scrollToDot, scrollByCard };
}

export default function SuppliersShowcase<T extends ShowcaseSupplier>({
  suppliers,
  selectedCountry,
  onCountryChange,
  chips,
  moreChips,
  secondsLeft,
  isRefreshing,
  onRefresh,
  error,
  onRetry,
  onOpenSupplier,
  renderLogo,
  autoScrollMs = 3000,
}: SuppliersShowcaseProps<T>) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [favourites, setFavourites] = useState<string[]>(readFavourites);
  const resetKey = useMemo(() => suppliers.map((s) => s.id).join('|'), [suppliers]);
  const carousel = useCarousel(trackRef, resetKey, autoScrollMs, suppliers.length > 0);

  const toggleFavourite = (id: string) => {
    setFavourites((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        localStorage.setItem(FAVOURITES_KEY, JSON.stringify(next));
      } catch {
        // storage can be blocked; the heart still works for this visit
      }
      return next;
    });
    const adding = !favourites.includes(id);
    toast.success(adding ? 'Added to Favourites' : 'Removed from Favourites');
  };

  const moreSelected = moreChips.find((c) => c.key === selectedCountry);

  return (
    <section className="vs" aria-labelledby="vs-title">
      <div className="vs-wrap">
        <header className="vs-head">
          <div className="vs-title-block">
            <Laurel className="vs-laurel" idPrefix="vs-laurel" />
            <TitleMark />
            <div className="vs-titles">
              <h2 id="vs-title">
                Verified <span>Suppliers</span>
              </h2>
              <p>Trusted Manufacturers &amp; Exporters Worldwide</p>
            </div>
            <Laurel flip className="vs-laurel" idPrefix="vs-laurel" />
          </div>

          <div className="vs-live">
            <span className="vs-live-dot" aria-hidden="true" />
            <span aria-hidden="true">Live Update: {secondsLeft}s</span>
            <span className="sr-only">Live update: the suppliers change every 30 seconds</span>
            <button
              type="button"
              className={`vs-refresh${isRefreshing ? ' is-spinning' : ''}`}
              onClick={onRefresh}
              aria-label="Show the next verified suppliers now"
              title="Show the next verified suppliers now"
            >
              <RefreshCw aria-hidden="true" />
            </button>
          </div>
        </header>

        <ul className="vs-stats" aria-label="Verified suppliers at a glance">
          {FIGURES.map(({ icon: Icon, value, label }) => (
            <li key={label}>
              <Icon aria-hidden="true" />
              <span>
                <b>{value}</b>
                <span>{label}</span>
              </span>
            </li>
          ))}
        </ul>

        <div className="vs-chips" role="group" aria-label="Filter suppliers by country">
          <button type="button" className={`vs-chip vs-chip-all${selectedCountry === 'all' ? ' is-selected' : ''}`} aria-pressed={selectedCountry === 'all'} onClick={() => onCountryChange('all')}>
            <Globe aria-hidden="true" />
            <span>All Global</span>
          </button>
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              className={`vs-chip${selectedCountry === chip.key ? ' is-selected' : ''}`}
              aria-pressed={selectedCountry === chip.key}
              onClick={() => onCountryChange(chip.key)}
            >
              <Flag country={chip.key} fallback={chip.flag} className="vs-flag" />
              <span>{chip.label}</span>
            </button>
          ))}
          {moreChips.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className={`vs-chip vs-chip-more${moreSelected ? ' is-selected' : ''}`} aria-label="More countries">
                  {moreSelected && <Flag country={moreSelected.key} fallback={moreSelected.flag} className="vs-flag" />}
                  <span>{moreSelected ? moreSelected.label : 'More'}</span>
                  <ChevronDown aria-hidden="true" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="vs-menu">
                {moreChips.map((chip) => (
                  <DropdownMenuItem key={chip.key} onSelect={() => onCountryChange(chip.key)} className={chip.key === selectedCountry ? 'is-selected' : undefined}>
                    <Flag country={chip.key} fallback={chip.flag} className="vs-flag" />
                    <span>{chip.label}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {error && (
          <div className="vs-error" role="alert">
            <span>{error}</span>
            <button type="button" onClick={onRetry}>
              <RefreshCw aria-hidden="true" /> Retry
            </button>
          </div>
        )}

        {suppliers.length === 0 ? (
          <div className="vs-empty">
            <Factory aria-hidden="true" />
            <p>No verified suppliers found for this region.</p>
            <button type="button" onClick={() => onCountryChange('all')}>
              Show All Global Suppliers
            </button>
          </div>
        ) : (
          <div className="vs-carousel" role="region" aria-roledescription="carousel" aria-label="Verified suppliers">
            <button type="button" className="vs-arrow vs-arrow-prev" onClick={() => carousel.scrollByCard(-1)} aria-label="Show earlier suppliers">
              <ChevronLeft aria-hidden="true" />
            </button>
            <button type="button" className="vs-arrow vs-arrow-next" onClick={() => carousel.scrollByCard(1)} aria-label="Show more suppliers">
              <ChevronRight aria-hidden="true" />
            </button>

            <div className="vs-track" ref={trackRef} tabIndex={0} role="group" aria-label="Verified supplier cards, scrolling by themselves">
              {suppliers.map((s, index) => {
                const facts: Array<{ icon: LucideIcon; lines: [string, string] }> = [];
                if (s.yearsInBusiness && s.yearsInBusiness > 0) facts.push({ icon: CalendarDays, lines: [`${s.yearsInBusiness}+`, 'Years'] });
                if (s.totalProducts && s.totalProducts > 0) facts.push({ icon: Box, lines: [`${s.totalProducts.toLocaleString('en-US')}+`, 'Products'] });
                if (s.exportsGlobally) facts.push({ icon: Plane, lines: ['Global', 'Export'] });
                const tags = (s.tags ?? []).filter(Boolean).slice(0, 3);
                const isFavourite = favourites.includes(s.id);
                return (
                  <article
                    key={s.id}
                    className={`vs-card${index === carousel.card ? ' is-current' : ''}`}
                    aria-roledescription="slide"
                    aria-label={`${index + 1} of ${suppliers.length}: ${s.name}`}
                  >
                    <div className="vs-media">
                      <button type="button" className="vs-media-hit" onClick={() => onOpenSupplier(s)} aria-label={`View ${s.name}`} tabIndex={-1} />
                      <CardImage src={s.img} alt={s.sampleProduct || `${s.name} - ${s.industry || 'Verified Manufacturer'}`} priority={index < 2} />
                      <span className="vs-badge">
                        <BadgeShield />
                        Verified Manufacturer
                      </span>
                      <button
                        type="button"
                        className={`vs-heart${isFavourite ? ' is-on' : ''}`}
                        aria-pressed={isFavourite}
                        aria-label={isFavourite ? `Remove ${s.name} from favourites` : `Add ${s.name} to favourites`}
                        onClick={() => toggleFavourite(s.id)}
                      >
                        <Heart aria-hidden="true" />
                      </button>
                    </div>

                    <div className="vs-body">
                      <div className="vs-id">
                        <button type="button" className="vs-logo" onClick={() => onOpenSupplier(s)} aria-label={`${s.name} logo`} tabIndex={-1}>
                          {renderLogo(s)}
                        </button>
                        <span className="vs-sep" aria-hidden="true" />
                        <div className="vs-who">
                          <h3 title={s.name}>
                            <button type="button" onClick={() => onOpenSupplier(s)}>
                              {s.name}
                            </button>
                          </h3>
                          <p className="vs-country">
                            <Flag country={s.country} fallback={s.flag} className="vs-flag" />
                            <span>{s.country}</span>
                          </p>
                        </div>
                      </div>

                      {/* both rows always take their space (empty ones are only hidden), so every card is the same height */}
                      <ul className={`vs-tags${tags.length ? '' : ' is-empty'}`}>
                        {tags.map((tag) => {
                          const Icon = tagIcon(tag);
                          return (
                            <li key={tag} title={tag}>
                              <Icon aria-hidden="true" />
                              <span>{tag}</span>
                            </li>
                          );
                        })}
                      </ul>

                      <hr className={`vs-rule${facts.length ? '' : ' is-empty'}`} />
                      <ul className={`vs-facts${facts.length ? '' : ' is-empty'}`}>
                        {facts.map(({ icon: Icon, lines }) => (
                          <li key={lines[1]}>
                            <Icon aria-hidden="true" />
                            <span>
                              <b>{lines[0]}</b>
                              <span>{lines[1]}</span>
                            </span>
                          </li>
                        ))}
                      </ul>

                      <div className="vs-actions">
                        <button type="button" className="vs-btn vs-btn-primary" onClick={() => onOpenSupplier(s)}>
                          <PackageOpen aria-hidden="true" />
                          <span>View Products</span>
                          <ArrowRight aria-hidden="true" />
                        </button>
                        <Link className="vs-btn vs-btn-ghost" to={`/post-requirement?supplier=${encodeURIComponent(s.id)}`}>
                          <MessageCircleMore aria-hidden="true" />
                          <span>Send Inquiry</span>
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}

        {/* the row is always there (empty until the cards have been measured), so the dots appearing never move the page */}
        <div className="vs-dots" role="group" aria-label="Move through the suppliers" aria-hidden={carousel.dots > 1 ? undefined : true}>
          {carousel.dots > 1 &&
            Array.from({ length: carousel.dots }, (_, i) => (
              <button
                key={i}
                type="button"
                className={i === carousel.dot ? 'is-on' : undefined}
                aria-label={`Show suppliers, part ${i + 1} of ${carousel.dots}`}
                aria-current={i === carousel.dot ? 'true' : undefined}
                onClick={() => carousel.scrollToDot(i)}
              />
            ))}
        </div>

        <Link to="/manufacturers" className="vs-all">
          <span>View All Verified Suppliers</span>
          <ArrowRight aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
