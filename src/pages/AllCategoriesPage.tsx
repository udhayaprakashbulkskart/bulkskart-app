/**
 * All Categories: every category and subcategory on one page, with the banner and product photos from the
 * category design PDF (src/data/categoryCatalog.ts, public/category-images/).
 * /categories lists every category; /categories/<category> is that category's own page (own title, text and address).
 *
 * Laptops and desktops: a sticky list of categories on the left that follows the scroll; phones and tablets:
 * a sticky row of category chips. One search box filters all subcategories. A subcategory opens the products
 * search for it; /categories/<category> opens the page at that category.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight, BedDouble, Bike, BookOpen, Briefcase, Building2, Car, ChevronRight, Cog, Factory, FlaskConical, Gem, Glasses,
  HardHat, Headset, Hospital, House, KeyRound, Laptop, LayoutGrid, Leaf, Microscope, Package, Palette, Pickaxe, Pill, Plane,
  RadioTower, Scale, Scissors, Search, ShieldCheck, Shirt, ShoppingBag, ShoppingBasket, Sofa, SprayCan, Sprout, Stethoscope,
  TestTubes, Trophy, Truck, Tv, Wrench, X, BadgeCheck, Coins, FileText,
} from 'lucide-react';
import MainLayout from '@/components/layouts/MainLayout';
import PageMeta from '@/components/common/PageMeta';
import SeoFaqList from '@/components/common/SeoFaqList';
import { categoryFaq } from '@/lib/seoContent';
import { CATEGORY_CATALOG, type CatalogCategory } from '@/data/categoryCatalog';

const ICONS: Record<string, LucideIcon> = {
  'consumer-electronics-and-household-appliances': Tv,
  'industrial-and-engineering-products-spares-and-supplies': Factory,
  'building-construction-material-equipment-civil-engineering-and-real-estate': Building2,
  'apparel-clothing-and-garments': Shirt,
  'vegetables-fruits-grains-dairy-products-and-other-fmcg-and-grocery-items': ShoppingBasket,
  'operation-theater-medical-imaging-and-pathology-instruments-and-hospital-supplies': Stethoscope,
  'packaging-material-supplies-and-machines': Package,
  'chemicals-dyes-and-allied-products': FlaskConical,
  'mechanical-components-and-parts': Cog,
  'scientific-measuring-laboratory-instruments-and-supplies': Microscope,
  'furniture-furniture-supplies-and-furniture-hardware': Sofa,
  'fertilizers-seeds-plants-agro-machines-and-tools-poultry-and-animal-husbandry': Sprout,
  'automobiles-spare-parts-and-accessories': Car,
  'housewares-home-appliances-and-supplies': House,
  'metal-alloys-and-minerals': Pickaxe,
  'handicrafts-and-decoratives': Palette,
  'books-and-stationery': BookOpen,
  'cosmetics-and-personal-care': ShoppingBag,
  'home-textile-and-furnishing': BedDouble,
  'gems-jewelry-and-astrology': Gem,
  'computer-and-it-solutions': Laptop,
  'herbal-and-ayurvedic-product': Leaf,
  'security-safety-system-and-service': ShieldCheck,
  'telecom-equipment-and-goods': RadioTower,
  'business-and-audit-services': Briefcase,
  'textiles-yarn-and-fabrics': Scissors,
  'engineering-services': Wrench,
  'fashion-accessories-and-gear': Glasses,
  'sports-goods-toys-and-games': Trophy,
  'product-rental-and-leasing': KeyRound,
  'transportation-and-logistics': Truck,
  'financial-and-legal-services': Scale,
  'travel-tourism-and-hotels': Plane,
  'call-center-and-bpo-services': Headset,
  'r-and-d-and-testing-labs': TestTubes,
  'bicycle-rickshaw-and-spares': Bike,
  'health-products-drug-and-medicine': Pill,
  'facility-management': SprayCan,
  'leather-products': ShoppingBag,
  'contractors-and-freelancers': HardHat,
  'hospital-clinic-and-consultation': Hospital,
};

const TOTAL_SUBCATEGORIES = CATEGORY_CATALOG.reduce((n, c) => n + c.subcategories.length, 0);

/** Splits a title so its second half can be shown in orange, as on the design banners. */
export function splitTitle(title: string): [string, string] {
  const amp = title.lastIndexOf(' & ');
  if (amp > 0 && (title.length - amp) / title.length <= 0.65) return [title.slice(0, amp + 2), title.slice(amp + 3)];
  const cuts = [...title.matchAll(/, | & /g)].map((m) => (m.index ?? 0) + m[0].length);
  if (cuts.length) {
    const best = cuts.reduce((a, b) => (Math.abs(b / title.length - 0.5) < Math.abs(a / title.length - 0.5) ? b : a));
    return [title.slice(0, best).trimEnd(), title.slice(best)];
  }
  const space = title.lastIndexOf(' ');
  return space > 0 ? [title.slice(0, space), title.slice(space + 1)] : ['', title];
}

/** The photo shape that fits most of a category's pictures, so its tiles line up. */
function photoAspect(c: CatalogCategory): number {
  const ratios = c.subcategories.map((s) => s.w / s.h).sort((a, b) => a - b);
  const mid = ratios[Math.floor(ratios.length / 2)] ?? 1.3;
  return Math.min(1.9, Math.max(1.1, mid));
}

const productsHref = (q: string) => `/products?q=${encodeURIComponent(q)}`;

function matches(text: string, words: string[]) {
  const t = text.toLowerCase();
  return words.every((w) => t.includes(w));
}

/** Search snippet and intro for one category page: what it covers, from its own subcategories. */
export function categorySeo(c: CatalogCategory) {
  const examples = c.subcategories.slice(0, 6).map((s) => s.name);
  const title = `${c.title} — Bulk & Wholesale Suppliers in India | BulkSkart`;
  const description = `Buy ${c.title.toLowerCase()} in bulk from manufacturers and wholesale suppliers in India: ${examples.slice(0, 4).join(', ')} and more. Compare quotes or post a free RFQ on BulkSkart.`;
  const intro = `Source ${c.title.toLowerCase()} in bulk on BulkSkart. ${c.subcategories.length} subcategories, including ${examples.join(', ')}. Compare manufacturers and wholesale suppliers, ask for quotations, or post a free buying requirement (RFQ) and let suppliers come to you.`;
  return { title, description, intro };
}

/** Every category as an ItemList, for search engines (the build's pre-rendered /categories page carries the same). */
export function categoriesItemList() {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'BulkSkart product categories',
    numberOfItems: CATEGORY_CATALOG.length,
    itemListElement: CATEGORY_CATALOG.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.title,
      url: `https://www.bulkskart.com/categories/${c.slug}`,
    })),
  };
}

export default function AllCategoriesPage() {
  const { slug: routeSlug } = useParams<{ slug?: string }>();
  // /categories/<category>: that category's own page; anything else lists every category
  const routeCat = CATEGORY_CATALOG.find((c) => c.slug === routeSlug) ?? null;
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(routeCat?.slug ?? CATEGORY_CATALOG[0]?.slug ?? '');
  const chipRowRef = useRef<HTMLDivElement>(null);

  const words = useMemo(() => query.trim().toLowerCase().split(/\s+/).filter(Boolean), [query]);
  const visible = useMemo(() => {
    if (words.length === 0) return routeCat ? [routeCat] : CATEGORY_CATALOG;
    return CATEGORY_CATALOG.flatMap((c) => {
      if (matches(c.title, words)) return [c];
      const subs = c.subcategories.filter((s) => matches(s.name, words));
      return subs.length ? [{ ...c, subcategories: subs }] : [];
    });
  }, [words, routeCat]);
  const resultCount = visible.reduce((n, c) => n + c.subcategories.length, 0);

  // a category page opens at the top with its own category highlighted
  useEffect(() => {
    if (!routeCat) return;
    setActive(routeCat.slug);
    setQuery('');
    window.scrollTo({ top: 0 });
  }, [routeCat]);

  // follow the scroll (all-categories page): the category in view is highlighted in the list and the chips
  useEffect(() => {
    if (routeCat || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        const seen = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (seen[0]) setActive(seen[0].target.id.replace(/^cat-/, ''));
      },
      { rootMargin: '-20% 0px -70% 0px' },
    );
    for (const c of visible) {
      const el = document.getElementById(`cat-${c.slug}`);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [visible, routeCat]);

  // keep the highlighted chip in view on phones
  useEffect(() => {
    const row = chipRowRef.current;
    const chip = row?.querySelector<HTMLElement>(`[data-chip="${active}"]`);
    if (!row || !chip) return;
    const left = chip.offsetLeft - row.clientWidth / 2 + chip.clientWidth / 2;
    row.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
  }, [active]);

  // Chips and the side list are links to each category's page; on the all-categories page they scroll instead
  const jump = (event: React.MouseEvent, slug: string) => {
    if (routeCat) return;
    const el = document.getElementById(`cat-${slug}`);
    if (!el) return;
    event.preventDefault();
    setActive(slug);
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const navList = words.length > 0 ? visible : CATEGORY_CATALOG;
  const seo = routeCat ? categorySeo(routeCat) : null;
  const faq = routeCat ? categoryFaq(routeCat) : [];

  return (
    <MainLayout>
      {routeCat && seo ? (
        <PageMeta
          title={seo.title}
          description={seo.description}
          canonical={`https://www.bulkskart.com/categories/${routeCat.slug}`}
          ogImage={`https://www.bulkskart.com${routeCat.banner}`}
          breadcrumbs={[{ name: 'Home', item: '/' }, { name: 'Categories', item: '/categories' }, { name: routeCat.title, item: `/categories/${routeCat.slug}` }]}
          faq={faq.map((item) => ({ question: item.q, answer: item.a }))}
        />
      ) : (
        <PageMeta
          title="All Categories | Bulk Products, Suppliers & Services | BulkSkart"
          description={`Browse all ${CATEGORY_CATALOG.length} BulkSkart categories and ${TOTAL_SUBCATEGORIES} subcategories: electronics, industrial supplies, construction, apparel, FMCG, medical, packaging, chemicals, services and more.`}
          canonical="https://www.bulkskart.com/categories"
          breadcrumbs={[{ name: 'Home', item: '/' }, { name: 'Categories', item: '/categories' }]}
          jsonLd={categoriesItemList()}
        />
      )}

      <div className="bg-[#f5f5f5] text-neutral-900 dark:bg-[#0a0a0a] dark:text-white">
        {/* ── Page heading and search ── */}
        <div className="mx-auto w-full max-w-[1440px] px-3 pt-3 sm:px-5 lg:px-6 lg:pt-5">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[12px] text-neutral-500 dark:text-white/55">
            <Link to="/" className="hover:text-[#FF5A00]">Home</Link>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            {routeCat ? (
              <>
                <Link to="/categories" className="hover:text-[#FF5A00]">Categories</Link>
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="line-clamp-1 font-semibold text-neutral-800 dark:text-white/85">{routeCat.title}</span>
              </>
            ) : (
              <span className="font-semibold text-neutral-800 dark:text-white/85">Categories</span>
            )}
          </nav>
          <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            {routeCat && seo ? (
              <div className="max-w-[760px]">
                <h1 className="text-[22px] font-black leading-tight tracking-tight sm:text-[28px]">
                  Bulk {routeCat.title} <span className="block text-[15px] font-extrabold text-[#FF5A00] sm:text-[18px]">Wholesale suppliers &amp; manufacturers in India</span>
                </h1>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-neutral-600 dark:text-white/70 sm:text-[14px]">{seo.intro}</p>
              </div>
            ) : (
              <div>
                <h1 className="text-[24px] font-black leading-tight tracking-tight sm:text-[30px]">
                  All <span className="text-[#FF5A00]">Categories</span>
                </h1>
                <p className="mt-0.5 text-[12.5px] text-neutral-600 dark:text-white/65 sm:text-[14px]">
                  {CATEGORY_CATALOG.length} categories · {TOTAL_SUBCATEGORIES} subcategories of bulk products and services
                </p>
              </div>
            )}
            <label className="relative block w-full md:max-w-[420px]">
              <span className="sr-only">Search categories</span>
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${TOTAL_SUBCATEGORIES} subcategories…`}
                className="h-11 w-full rounded-full border border-neutral-300 bg-white pl-10 pr-10 text-[14px] text-neutral-900 shadow-sm outline-none transition-colors placeholder:text-neutral-400 focus:border-[#FF5A00] focus:ring-2 focus:ring-[#FF5A00]/20 dark:border-white/15 dark:bg-[#141414] dark:text-white"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 dark:hover:bg-white/10"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </label>
          </div>
          {words.length > 0 && (
            <p className="mt-2 text-[13px] text-neutral-600 dark:text-white/65" aria-live="polite">
              {resultCount > 0 ? `${resultCount} subcategories in ${visible.length} categories match “${query.trim()}”` : `Nothing matches “${query.trim()}”.`}
            </p>
          )}
        </div>

        {/* ── Category chips (phones and tablets) ── */}
        <div className="sticky top-0 z-30 mt-3 border-y border-neutral-200 bg-[#f5f5f5]/95 backdrop-blur lg:hidden dark:border-white/10 dark:bg-[#0a0a0a]/95">
          <div ref={chipRowRef} className="mx-auto flex max-w-[1440px] gap-2 overflow-x-auto px-3 py-2 sm:px-5" style={{ scrollbarWidth: 'none' }}>
            {navList.map((c) => {
              const Icon = ICONS[c.slug] ?? LayoutGrid;
              const on = c.slug === active;
              return (
                <Link
                  key={c.slug}
                  to={`/categories/${c.slug}`}
                  data-chip={c.slug}
                  aria-current={on ? 'page' : undefined}
                  onClick={(e) => jump(e, c.slug)}
                  className={`flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[12.5px] font-semibold transition-colors ${
                    on
                      ? 'border-transparent bg-gradient-to-r from-[#FF7A1A] to-[#F05A00] text-white shadow-[0_6px_16px_-8px_rgba(255,90,0,0.9)]'
                      : 'border-neutral-300 bg-white text-neutral-800 dark:border-white/15 dark:bg-[#141414] dark:text-white/90'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {splitTitle(c.title)[0].replace(/[,&]\s*$/, '').trim() || c.title}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="mx-auto grid w-full max-w-[1440px] gap-5 px-3 pb-10 pt-3 sm:px-5 lg:grid-cols-[264px_minmax(0,1fr)] lg:px-6 lg:pt-5">
          {/* ── Category list (laptops and desktops) ── */}
          <aside className="hidden lg:block">
            <nav aria-label="Categories" className="sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-2 shadow-sm dark:border-white/10 dark:bg-[#121212]" style={{ scrollbarWidth: 'thin' }}>
              <p className="px-2.5 pb-1.5 pt-1 text-[15px] font-black">
                All Categories <span className="text-neutral-500 dark:text-white/50">({navList.length})</span>
              </p>
              <ul>
                {navList.map((c) => {
                  const Icon = ICONS[c.slug] ?? LayoutGrid;
                  const on = c.slug === active;
                  return (
                    <li key={c.slug}>
                      <Link
                        to={`/categories/${c.slug}`}
                        onClick={(e) => jump(e, c.slug)}
                        aria-current={on ? 'page' : undefined}
                        className={`group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] leading-snug transition-colors ${
                          on ? 'bg-[#FF5A00]/10 font-bold text-[#E04E00] dark:text-[#FF8A3D]' : 'text-neutral-800 hover:bg-neutral-100 dark:text-white/85 dark:hover:bg-white/5'
                        }`}
                      >
                        <Icon className={`h-[18px] w-[18px] shrink-0 ${on ? 'text-[#FF5A00]' : 'text-neutral-500 dark:text-white/55'}`} aria-hidden="true" />
                        <span className="line-clamp-2 min-w-0 flex-1">{c.title}</span>
                        <ChevronRight className={`h-4 w-4 shrink-0 ${on ? 'text-[#FF5A00]' : 'text-neutral-400'}`} aria-hidden="true" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </aside>

          {/* ── Categories ── */}
          <div className="min-w-0 space-y-7 sm:space-y-9">
            {visible.length === 0 && (
              <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center dark:border-white/10 dark:bg-[#121212]">
                <p className="text-[15px] font-bold">No category matches “{query.trim()}”.</p>
                <p className="mt-1 text-[13px] text-neutral-600 dark:text-white/65">Post your requirement and verified suppliers will send you quotes.</p>
                <Link to="/post-requirement" className="mt-4 inline-flex h-10 items-center gap-2 rounded-full bg-[#FF5A00] px-5 text-[13px] font-bold text-white">
                  Post RFQ Now <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            )}
            {visible.map((c, ci) => (
              <CategorySection key={c.slug} category={c} eager={ci < 2} total={CATEGORY_CATALOG.find((x) => x.slug === c.slug)?.subcategories.length ?? c.subcategories.length} filtered={words.length > 0} />
            ))}

            {routeCat && words.length === 0 && (
              <Link to="/categories" className="inline-flex items-center gap-1.5 text-[13.5px] font-bold text-[#E04E00] hover:underline dark:text-[#FF8A3D]">
                Browse all {CATEGORY_CATALOG.length} categories <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            )}

            {/* ── Questions about this category (also its FAQPage data) ── */}
            {routeCat && words.length === 0 && (
              <section aria-labelledby="cat-faq-title">
                <h2 id="cat-faq-title" className="mb-3 text-[17px] font-black tracking-tight sm:text-[20px]">
                  {routeCat.title}: frequently asked questions
                </h2>
                <SeoFaqList items={faq} headingLevel="h3" />
              </section>
            )}

            {/* ── Post RFQ ── */}
            <div className="flex flex-col items-start gap-3 rounded-2xl border border-[#FF5A00]/30 bg-gradient-to-r from-[#FFF1E8] to-white p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5 dark:from-[#1d1009] dark:to-[#121212]">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#FF5A00] text-white"><FileText className="h-6 w-6" aria-hidden="true" /></span>
                <div>
                  <p className="text-[16px] font-black sm:text-[18px]">Need a specific product?</p>
                  <p className="text-[12.5px] text-neutral-600 dark:text-white/65 sm:text-[13.5px]">Post your requirement (RFQ) and get quotes from verified suppliers.</p>
                </div>
              </div>
              <Link to="/post-requirement" className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-[#FF7A1A] to-[#F05A00] px-5 text-[14px] font-extrabold text-white shadow-[0_10px_24px_-12px_rgba(255,90,0,0.9)]">
                Post RFQ Now <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

function CategorySection({ category: c, eager, total, filtered }: { category: CatalogCategory; eager: boolean; total: number; filtered: boolean }) {
  const [main, accent] = splitTitle(c.title);
  const aspect = photoAspect(c);
  const Icon = ICONS[c.slug] ?? LayoutGrid;
  return (
    <section id={`cat-${c.slug}`} aria-labelledby={`cat-${c.slug}-title`} className="scroll-mt-16 lg:scroll-mt-4">
      {/* banner: title on the black side, the category photo on the right */}
      <div className="relative isolate overflow-hidden rounded-2xl bg-[#0b0b0b] text-white shadow-[0_14px_34px_-22px_rgba(0,0,0,0.8)]">
        <img
          src={c.banner}
          alt=""
          width={c.bannerW}
          height={c.bannerH}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          className="absolute inset-y-0 right-0 -z-10 h-full w-[62%] object-cover [mask-image:linear-gradient(to_right,transparent,black_28%)] sm:w-[52%]"
        />
        <div aria-hidden="true" className="absolute inset-y-0 left-0 -z-10 w-[62%] bg-gradient-to-r from-[#0b0b0b] via-[#0b0b0b]/95 to-transparent sm:w-[58%]" />
        <div className="flex min-h-[132px] max-w-[68%] flex-col justify-center gap-1.5 p-3.5 sm:min-h-[170px] sm:max-w-[56%] sm:gap-2 sm:p-6 lg:min-h-[188px]">
          <h2 id={`cat-${c.slug}-title`} className="text-[17px] font-black leading-[1.12] tracking-tight sm:text-[24px] lg:text-[27px]">
            {main} <span className="text-[#FF6A00]">{accent}</span>
          </h2>
          <p className="line-clamp-2 text-[11px] leading-snug text-white/80 sm:text-[13px]">{c.subtitle}</p>
          <ul className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-semibold text-white/90 sm:text-[12px]">
            <li className="flex items-center gap-1"><BadgeCheck className="h-3.5 w-3.5 text-[#FF6A00] sm:h-4 sm:w-4" aria-hidden="true" />Verified Suppliers</li>
            <li className="flex items-center gap-1"><Coins className="h-3.5 w-3.5 text-[#FF6A00] sm:h-4 sm:w-4" aria-hidden="true" />Bulk Pricing</li>
            <li className="hidden items-center gap-1 min-[400px]:flex"><Truck className="h-3.5 w-3.5 text-[#FF6A00] sm:h-4 sm:w-4" aria-hidden="true" />Pan India Delivery</li>
          </ul>
        </div>
      </div>

      {/* subcategory count and actions */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-gradient-to-r from-[#FF7A1A] to-[#F05A00] px-3.5 text-[12.5px] font-bold text-white">
          <Icon className="h-4 w-4" aria-hidden="true" />
          Subcategories ({filtered ? `${c.subcategories.length} of ${total}` : c.subcategories.length})
        </span>
        <Link to={productsHref(c.title)} className="inline-flex h-8 items-center gap-1 rounded-full border border-neutral-300 bg-white px-3 text-[12.5px] font-semibold text-neutral-800 hover:border-[#FF5A00] hover:text-[#E04E00] dark:border-white/15 dark:bg-[#141414] dark:text-white/85">
          Products <ArrowRight className="h-3.5 w-3.5" />
        </Link>
        <Link to="/post-requirement" className="ml-auto inline-flex h-8 items-center gap-1 rounded-full px-2 text-[12.5px] font-bold text-[#E04E00] hover:underline dark:text-[#FF8A3D]">
          Post RFQ <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* subcategory tiles */}
      <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 md:grid-cols-5 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
        {c.subcategories.map((s) => (
          <li key={s.name}>
            <Link
              to={productsHref(s.name)}
              className="group flex h-full flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white text-neutral-900 transition-all hover:-translate-y-0.5 hover:border-[#FF5A00] hover:shadow-[0_12px_26px_-16px_rgba(255,90,0,0.7)] dark:border-white/10"
            >
              <span className="block overflow-hidden bg-white" style={{ aspectRatio: aspect }}>
                <img
                  src={s.img}
                  alt={s.name}
                  width={s.w}
                  height={s.h}
                  loading={eager ? 'eager' : 'lazy'}
                  decoding="async"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </span>
              <span className="flex flex-1 items-center justify-center px-1.5 py-2 text-center text-[11px] font-bold leading-[1.25] sm:px-2 sm:text-[12.5px]">
                <span className="line-clamp-3">{s.name}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
