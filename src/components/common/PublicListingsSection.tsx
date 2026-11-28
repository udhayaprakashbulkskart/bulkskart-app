/**
 * Public Requirements: buyer requirements collected from publicly accessible pages on other B2B websites, shown as
 * their own module next to Live RFQ (BulkSkart buyer RFQs).
 *
 * Only admin-approved requirements that have not expired (30 days after posting) are shown. The source website is
 * never named or linked here (admins see it), and there is no quotation button: these buyers are not on BulkSkart
 * and have not authorised it to forward quotations. Renders nothing when there are none (or before the migration).
 */
import { useEffect, useState } from 'react';
import { Box, Globe2, Info, MapPin, Tag } from 'lucide-react';
import { supabase } from '@/db/supabase';
import type { Requirement } from '@/types/types';
import { isMissingColumnError } from '@/lib/publicListings';
import { representativeImage } from '@/lib/representativeImage';

const PAGE = 12;

type Listing = Pick<
  Requirement,
  'id' | 'title' | 'specifications' | 'quantity' | 'quantity_unit' | 'destination_city' | 'destination_country' | 'listing_category' | 'created_at' | 'expires_at'
>;

const COLUMNS = 'id,title,specifications,quantity,quantity_unit,destination_city,destination_country,listing_category,created_at,expires_at';

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
        .eq('review_status', 'approved')
        .eq('status', 'active')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(limit);
      if (cancelled) return;
      if (error) {
        if (!isMissingColumnError(error)) console.warn('Public requirements could not be loaded', error.message);
        setItems([]);
        setTotal(0);
      } else {
        // expired ones are left out even if the database clock and this one disagree
        const now = Date.now();
        setItems(((data ?? []) as unknown as Listing[]).filter((r) => !r.expires_at || new Date(r.expires_at).getTime() > now));
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
    <section aria-labelledby="public-requirements-title" className={`w-full bg-[#070707] py-6 text-white sm:py-8 ${className}`}>
      <div className="mx-auto w-full max-w-[1400px] px-2.5 sm:px-5 md:px-6">
        <div className="flex flex-wrap items-end justify-between gap-2 px-1">
          <div>
            <h2 id="public-requirements-title" className="flex items-center gap-2 text-[22px] font-black leading-tight md:text-[30px]">
              <Globe2 className="h-6 w-6 text-[#FF6A14] md:h-7 md:w-7" aria-hidden="true" />
              Public <span className="text-[#FF6A14]">Requirements</span>
            </h2>
            <p className="mt-1 max-w-[760px] text-[12px] leading-snug text-white/70 md:text-[14px]">
              Market demand from buyers who listed their requirements publicly. They are not registered on BulkSkart, so quotations
              are not sent through BulkSkart for these. Live RFQ above has requirements from BulkSkart buyers.
            </p>
          </div>
          {total !== null && <span className="text-[12px] text-white/55 md:text-[13px]">{total} open {total === 1 ? 'requirement' : 'requirements'}</span>}
        </div>

        <ul className="mt-3 grid gap-2 sm:grid-cols-2 md:mt-4 md:gap-4 xl:grid-cols-3">
          {items.map((r) => (
            <PublicRequirementCard key={r.id} listing={r} />
          ))}
        </ul>

        {total !== null && items.length < total && (
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setLimit((n) => n + PAGE)}
              className="h-10 rounded-full border border-white/20 px-5 text-[13px] font-semibold hover:border-[#FF5A00]"
            >
              Show more public requirements
            </button>
          </div>
        )}

        <p className="mt-4 flex items-start gap-1.5 px-1 text-[11px] leading-snug text-white/50 md:text-[12px]">
          <Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Product, quantity, location and date are as the buyer listed them. Pictures are representative of the product
          category, not the buyer's own. Each requirement is removed 30 days after it was posted.
        </p>
      </div>
    </section>
  );
}

function PublicRequirementCard({ listing: r }: { listing: Listing }) {
  const qty = r.quantity != null ? `${Number(r.quantity).toLocaleString('en-IN')}${r.quantity_unit ? ` ${r.quantity_unit}` : ''}` : null;
  const place = [r.destination_city, r.destination_country].filter(Boolean).join(', ') || null;
  const specs = (r.specifications ?? '').split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 2);
  const picture = representativeImage(r.title, r.listing_category);

  return (
    <li>
      <article className="flex h-full gap-3 rounded-2xl border border-white/12 bg-[#101010] p-3 md:p-3.5">
        {picture && (
          <figure className="w-[92px] shrink-0 md:w-[112px]">
            <img src={picture.src} alt="" loading="lazy" decoding="async" className="aspect-square w-full rounded-xl bg-white object-cover" />
            <figcaption className="mt-1 text-center text-[9.5px] leading-tight text-white/45">Representative image</figcaption>
          </figure>
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-md border border-[#FF6A14]/60 bg-[#FF6A14]/10 px-2 py-0.5 text-[10px] font-black tracking-wide text-[#FF8A3D]">
              PUBLIC REQUIREMENT
            </span>
            {r.listing_category && (
              <span className="flex min-w-0 items-center gap-1 truncate text-[11px] text-white/60">
                <Tag className="h-3 w-3 shrink-0" aria-hidden="true" />
                {r.listing_category}
              </span>
            )}
          </div>
          <h3 className="mt-1.5 line-clamp-2 text-[14.5px] font-extrabold leading-snug md:text-[16px]">{r.title}</h3>
          <dl className="mt-1.5 grid gap-0.5 text-[12px] text-white/85 md:text-[12.5px]">
            <div className="flex items-center gap-1.5">
              <Box className="h-3.5 w-3.5 shrink-0 text-[#FF6A14]" aria-hidden="true" />
              <dt className="sr-only">Quantity</dt>
              <dd>{qty ?? <span className="text-white/45">Quantity not stated</span>}</dd>
            </div>
            {place && (
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-[#FF6A14]" aria-hidden="true" />
                <dt className="sr-only">Delivery location</dt>
                <dd className="truncate">{place}</dd>
              </div>
            )}
          </dl>
          {specs.length > 0 && (
            <ul className="mt-1.5 space-y-0.5 text-[11px] text-white/55">
              {specs.map((s) => <li key={s} className="truncate">{s}</li>)}
            </ul>
          )}
          <p className="mt-auto pt-2 text-[10.5px] text-white/45">Buyer not registered on BulkSkart · no quotations here</p>
        </div>
      </article>
    </li>
  );
}
