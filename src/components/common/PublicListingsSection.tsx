/**
 * Public listings: buyer requirements copied from public pages on other B2B marketplaces, shown apart from
 * BulkSkart buyer RFQs. Each card carries a PUBLIC LISTING label and a VIEW ORIGINAL RFQ button that opens the
 * listing on its own website, where suppliers contact the buyer. No BulkSkart quotation is offered for these.
 * Renders nothing until the database has public listings (or before its migration is applied).
 */
import { useEffect, useState } from 'react';
import { Box, CalendarDays, ExternalLink, Globe2, Info, MapPin } from 'lucide-react';
import { supabase } from '@/db/supabase';
import type { Requirement } from '@/types/types';
import { isMissingColumnError, originalListingUrl, postedOnLabel } from '@/lib/publicListings';

const PAGE = 12;

type Listing = Pick<
  Requirement,
  'id' | 'title' | 'description' | 'specifications' | 'quantity' | 'quantity_unit' | 'destination_city' | 'destination_country'
  | 'source_name' | 'source_url' | 'source_category' | 'source_subcategory' | 'source_posted_on'
>;

const COLUMNS =
  'id,title,description,specifications,quantity,quantity_unit,destination_city,destination_country,source_name,source_url,source_category,source_subcategory,source_posted_on';

export default function PublicListingsSection({ className = '' }: { className?: string }) {
  const [items, setItems] = useState<Listing[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [limit, setLimit] = useState(PAGE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error, count } = await supabase
        .from('requirements')
        .select(COLUMNS, { count: 'exact' })
        .eq('source_type', 'public_listing')
        .eq('status', 'active')
        .order('source_posted_on', { ascending: false, nullsFirst: false })
        .limit(limit);
      if (cancelled) return;
      if (error) {
        // before the public-listings migration there is nothing to show
        if (!isMissingColumnError(error)) console.warn('Public listings could not be loaded', error.message);
        setItems([]);
        setTotal(0);
      } else {
        setItems((data ?? []) as unknown as Listing[]);
        setTotal(count ?? null);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [limit]);

  if (loading || items.length === 0) return null;

  return (
    <section aria-labelledby="public-listings-title" className={`w-full bg-[#070707] py-6 text-white sm:py-8 ${className}`}>
      <div className="mx-auto w-full max-w-[1400px] px-2.5 sm:px-5 md:px-6">
        <div className="flex flex-wrap items-end justify-between gap-2 px-1">
          <div>
            <h2 id="public-listings-title" className="flex items-center gap-2 text-[22px] font-black leading-tight md:text-[30px]">
              <Globe2 className="h-6 w-6 text-[#FF6A14] md:h-7 md:w-7" aria-hidden="true" />
              Public <span className="text-[#FF6A14]">Listings</span>
            </h2>
            <p className="mt-1 max-w-[760px] text-[12px] leading-snug text-white/70 md:text-[14px]">
              Buyer requirements posted publicly on other B2B marketplaces. These buyers are not on BulkSkart: contact them on
              the original listing.
            </p>
          </div>
          {total !== null && <span className="text-[12px] text-white/55 md:text-[13px]">{total} public {total === 1 ? 'listing' : 'listings'}</span>}
        </div>

        <ul className="mt-3 grid gap-2 md:mt-4 md:grid-cols-2 md:gap-4 xl:grid-cols-3">
          {items.map((r) => (
            <PublicListingCard key={r.id} listing={r} />
          ))}
        </ul>

        {total !== null && items.length < total && (
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setLimit((n) => n + PAGE)}
              className="h-10 rounded-full border border-white/20 px-5 text-[13px] font-semibold hover:border-[#FF5A00]"
            >
              Show more public listings
            </button>
          </div>
        )}

        <p className="mt-4 flex items-start gap-1.5 px-1 text-[11px] leading-snug text-white/50 md:text-[12px]">
          <Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Product, quantity, location and date are as shown on the original page when it was checked. Buyer names and contact
          details are not copied. BulkSkart quotations are not available for public listings.
        </p>
      </div>
    </section>
  );
}

function PublicListingCard({ listing: r }: { listing: Listing }) {
  const url = originalListingUrl(r);
  const posted = postedOnLabel(r.source_posted_on);
  const qty = r.quantity != null ? `${Number(r.quantity).toLocaleString('en-IN')}${r.quantity_unit ? ` ${r.quantity_unit}` : ''}` : null;
  const place = [r.destination_city, r.destination_country].filter(Boolean).join(', ') || null;
  const specs = (r.specifications ?? '').split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 3);

  return (
    <li>
      <article className="flex h-full flex-col rounded-2xl border border-white/12 bg-[#101010] p-3.5 md:p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-md border border-[#FF6A14]/60 bg-[#FF6A14]/10 px-2 py-0.5 text-[10.5px] font-black tracking-wide text-[#FF8A3D]">
            PUBLIC LISTING
          </span>
          {r.source_name && <span className="rounded-md bg-white/8 px-2 py-0.5 text-[10.5px] font-semibold text-white/80">Source: {r.source_name}</span>}
          {r.source_subcategory && <span className="truncate text-[11px] text-white/55">{r.source_subcategory}</span>}
        </div>
        <h3 className="mt-2 line-clamp-2 text-[15px] font-extrabold leading-snug md:text-[16.5px]">{r.title}</h3>
        <dl className="mt-2 grid gap-1 text-[12.5px] text-white/85 md:text-[13px]">
          <div className="flex items-center gap-1.5">
            <Box className="h-4 w-4 shrink-0 text-[#FF6A14]" aria-hidden="true" />
            <dt className="sr-only">Quantity</dt>
            <dd>{qty ?? <span className="text-white/45">Quantity not stated</span>}</dd>
          </div>
          {place && (
            <div className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4 shrink-0 text-[#FF6A14]" aria-hidden="true" />
              <dt className="sr-only">Delivery location</dt>
              <dd>{place}</dd>
            </div>
          )}
          {posted && (
            <div className="flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4 shrink-0 text-[#FF6A14]" aria-hidden="true" />
              <dt className="sr-only">Posted on</dt>
              <dd>Posted {posted}{r.source_name ? ` on ${r.source_name}` : ''}</dd>
            </div>
          )}
        </dl>
        {specs.length > 0 && (
          <ul className="mt-2 space-y-0.5 text-[11.5px] text-white/60">
            {specs.map((s) => <li key={s} className="truncate">{s}</li>)}
          </ul>
        )}
        <div className="mt-auto pt-3">
          {url ? (
            <a
              href={url}
              target="_blank"
              rel="nofollow noopener noreferrer"
              className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#FF7A1A] to-[#F25600] text-[13.5px] font-extrabold text-white"
            >
              VIEW ORIGINAL RFQ <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
          ) : (
            <p className="text-[12px] text-white/50">Original listing link unavailable.</p>
          )}
        </div>
      </article>
    </li>
  );
}
