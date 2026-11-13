import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Flame, Loader2, Package, Sparkles } from 'lucide-react';
import { supabase } from '@/db/supabase';
import CreateReverseAuctionDialog from '@/components/auctions/CreateReverseAuctionDialog';

/** How many catalogue rows to read per request. Most of the newest rows are not catalogue photos. */
const SCAN_PAGE = 80;
/** Cards revealed at a time. Only these are mounted, so their images are the ones fetched. */
const REVEAL = 18;
/** Cap for this rail. Further rows stay on the products page. */
const MAX_PRODUCTS = 500;
/** Stop the first paint if the newest rows are sparse, so the homepage does not scan the whole table. */
const INITIAL_SCAN_CAP = 400;

type ProductRow = {
  id: string;
  name: string;
  slug: string | null;
  images: string[] | null;
  moq: number | string | null;
  moq_unit: string | null;
  price_min: number | string | null;
  price_max: number | string | null;
  price_currency: string | null;
  categories: { name: string | null } | null;
};

type CatalogCard = {
  id: string;
  name: string;
  slug: string;
  image: string;
  category: string | null;
  moq: number | null;
  moqUnit: string | null;
  priceMin: number | null;
  priceMax: number | null;
  currency: string | null;
};

function asNumber(value: number | string | null | undefined): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function catalogImage(images: string[] | null | undefined): string | null {
  if (!images) return null;
  for (const url of images) {
    if (typeof url === 'string' && url.includes('/product-images/catalog/')) return url;
  }
  return null;
}

function toCard(row: ProductRow): CatalogCard | null {
  const image = catalogImage(row.images);
  const slug = row.slug?.trim();
  if (!image || !slug || !row.name) return null;
  const categoryName = row.categories?.name?.trim();
  return {
    id: row.id,
    name: row.name,
    slug,
    image,
    category: categoryName || null,
    moq: asNumber(row.moq),
    moqUnit: row.moq_unit?.trim() || null,
    priceMin: asNumber(row.price_min),
    priceMax: asNumber(row.price_max),
    currency: row.price_currency?.trim() || null,
  };
}

function money(amount: number, currency: string | null): string {
  const formatted = amount.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  if (currency === 'INR') return `₹${formatted}`;
  if (currency === 'USD') return `$${formatted}`;
  if (currency === 'EUR') return `€${formatted}`;
  if (currency === 'GBP') return `£${formatted}`;
  return currency ? `${formatted} ${currency}` : formatted;
}

function priceLabel(card: CatalogCard): string | null {
  const { priceMin, priceMax, currency } = card;
  if (priceMin == null && priceMax == null) return null;
  if (priceMin != null && priceMax != null && priceMin !== priceMax) {
    return `${money(priceMin, currency)} – ${money(priceMax, currency)}`;
  }
  return money((priceMin ?? priceMax) as number, currency);
}

function moqLabel(card: CatalogCard): string | null {
  if (card.moq == null || card.moq <= 0) return null;
  const qty = card.moq.toLocaleString('en-IN');
  return card.moqUnit ? `MOQ ${qty} ${card.moqUnit}` : `MOQ ${qty}`;
}

async function scanProducts(from: number): Promise<{ cards: CatalogCard[]; next: number; done: boolean }> {
  const { data, error } = await supabase
    .from('products')
    .select('id,name,slug,images,moq,moq_unit,price_min,price_max,price_currency,categories!category_id(name)')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(from, from + SCAN_PAGE - 1);
  if (error) throw error;
  const rows = (data ?? []) as unknown as ProductRow[];
  const cards = rows.map(toCard).filter((card): card is CatalogCard => card !== null);
  return { cards, next: from + rows.length, done: rows.length < SCAN_PAGE };
}

function mergeCards(current: CatalogCard[], incoming: CatalogCard[]): CatalogCard[] {
  const seen = new Set(current.map(card => card.id));
  const next = [...current];
  for (const card of incoming) {
    if (seen.has(card.id) || next.length >= MAX_PRODUCTS) continue;
    seen.add(card.id);
    next.push(card);
  }
  return next;
}

export default function LiveReverseAuctionsRail() {
  const [cards, setCards] = useState<CatalogCard[]>([]);
  const [visible, setVisible] = useState(REVEAL);
  const [cursor, setCursor] = useState(0);
  const [exhausted, setExhausted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failedImages, setFailedImages] = useState<Set<string>>(() => new Set());
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const pullUntil = useCallback(async (startCursor: number, startCards: CatalogCard[], target: number, scanCap: number) => {
    let nextCursor = startCursor;
    let collected = startCards;
    let done = false;
    let scanned = 0;
    while (collected.length < target && !done && scanned < scanCap) {
      const page = await scanProducts(nextCursor);
      collected = mergeCards(collected, page.cards);
      nextCursor = page.next;
      done = page.done;
      scanned += SCAN_PAGE;
    }
    return { collected, nextCursor, done };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const result = await pullUntil(0, [], REVEAL, INITIAL_SCAN_CAP);
        if (cancelled) return;
        setCards(result.collected);
        setCursor(result.nextCursor);
        setExhausted(result.done);
        setVisible(Math.min(REVEAL, result.collected.length));
      } catch {
        if (!cancelled) {
          setCards([]);
          setExhausted(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [pullUntil]);

  const shown = cards.slice(0, visible);
  const canRevealBuffered = visible < cards.length;
  const canFetchMore = !exhausted && cards.length < MAX_PRODUCTS;
  const canLoadMore = canRevealBuffered || canFetchMore;

  const loadMore = async () => {
    if (loadingMore || !canLoadMore) return;
    if (canRevealBuffered) {
      setVisible(count => Math.min(count + REVEAL, cards.length));
      return;
    }
    setLoadingMore(true);
    try {
      const result = await pullUntil(cursor, cards, Math.min(cards.length + REVEAL, MAX_PRODUCTS), SCAN_PAGE * 6);
      setCards(result.collected);
      setCursor(result.nextCursor);
      setExhausted(result.done || result.collected.length >= MAX_PRODUCTS);
      setVisible(Math.min(result.collected.length, visible + REVEAL));
    } catch {
      setExhausted(true);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <section className="relative z-20 mx-auto mb-8 w-full max-w-[1400px] px-4 sm:mb-12 sm:px-5 md:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FF5A00]/15 text-[#FF5A00]">
            <Flame className="h-5 w-5" />
          </span>
          <h2 className="text-[18px] font-black uppercase tracking-tight text-white sm:text-[22px]">Sell Products in 24 Hours</h2>
          <span className="rounded-md bg-gradient-to-r from-[#FF7A2E] to-[#E84A00] px-2 py-0.5 text-[11px] font-black text-white">HOT</span>
        </div>
        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-[13px] font-semibold text-white hover:border-[#FF5A00]"
        >
          <Sparkles className="h-4 w-4 text-[#FF5A00]" /> List Product in 24h
        </button>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <h3 className="text-[16px] font-black text-white">Catalogue</h3>
        <Link to="/products" className="group flex items-center gap-1 text-[13px] font-bold text-[#FF7A2E] hover:text-[#FF5A00]">
          View all products <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="flex gap-4 overflow-hidden">
            {[1, 2, 3].map(n => <div key={n} className="h-72 w-[78vw] max-w-[320px] shrink-0 animate-pulse rounded-2xl border border-white/5 bg-white/[0.03]" />)}
          </div>
        ) : shown.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-[#0c0c0c] p-6 text-center sm:p-8">
            <Package className="mx-auto h-9 w-9 text-[#FF5A00]" />
            <p className="mt-3 text-sm font-semibold text-white">No catalogue photos are available right now.</p>
          </div>
        ) : (
          <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
            {shown.map(card => {
              const price = priceLabel(card);
              const moq = moqLabel(card);
              const imageFailed = failedImages.has(card.id);
              return (
                <Link
                  key={card.id}
                  to={`/products/${card.slug}`}
                  className="group w-[78vw] max-w-[320px] shrink-0 snap-start overflow-hidden rounded-2xl border border-[#FF5A00]/40 bg-gradient-to-b from-[#121212] to-[#0a0a0a] shadow-[0_18px_50px_-22px_rgba(255,90,0,0.55)] transition-all duration-300 hover:-translate-y-1 hover:border-[#FF5A00]"
                >
                  <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#0A0A0A]">
                    {imageFailed ? (
                      <div className="flex h-full items-center justify-center px-4 text-center text-xs text-neutral-400">{card.name}</div>
                    ) : (
                      <img
                        src={card.image}
                        alt={card.name}
                        width={640}
                        height={400}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                        onError={() => setFailedImages(prev => {
                          const next = new Set(prev);
                          next.add(card.id);
                          return next;
                        })}
                      />
                    )}
                    {card.category && (
                      <span className="absolute bottom-3 left-3 flex max-w-[80%] items-center gap-1.5 rounded-lg border border-white/15 bg-[#0A0A0A]/60 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
                        <Package className="h-3.5 w-3.5 shrink-0 text-[#FF5A00]" />
                        <span className="truncate">{card.category}</span>
                      </span>
                    )}
                  </div>
                  <div className="p-4">
                    <h4 className="line-clamp-2 min-h-[2.6em] text-[15px] font-bold leading-snug text-white group-hover:text-[#FF7A2E]">{card.name}</h4>
                    {moq && <p className="mt-2 text-[12px] text-slate-300">{moq}</p>}
                    {price && <p className="mt-1 text-[18px] font-black text-[#FF7A2E]">{price}</p>}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {!loading && shown.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#0c0c0c] px-4 py-2.5 text-[12px] text-slate-300">
          <span>{shown.length} catalogue {shown.length === 1 ? 'product' : 'products'}</span>
          {canLoadMore && (
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className="inline-flex items-center gap-2 rounded-lg border border-[#FF5A00]/50 px-3 py-1.5 text-[12px] font-bold text-[#FF7A2E] hover:bg-[#FF5A00]/10 disabled:opacity-60"
            >
              {loadingMore && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Load more
            </button>
          )}
        </div>
      )}

      <CreateReverseAuctionDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSuccess={() => setIsCreateOpen(false)}
      />
    </section>
  );
}
