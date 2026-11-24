/**
 * Public supplier directory (/directory, /directory/:id).
 * Only manufacturers that passed verification and were published (migration 00074): their products as their own
 * website states them, with no contacts, GSTIN or links to other websites. Buyers act through BulkSkart.
 */
import { Fragment, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BadgeCheck, Building2, Factory, Loader2, MapPin, Package, Search } from 'lucide-react';
import MainLayout from '@/components/layouts/MainLayout';
import PageMeta from '@/components/common/PageMeta';
import NeutralProductPlaceholder from '@/components/common/NeutralProductPlaceholder';
import {
  CATEGORY_LABELS, categoryLabel, type DirectoryProduct, type DirectorySupplier, directorySupplier, directorySuppliers, formatDate,
} from '@/lib/discovery/api';

const PAGE = 24;

function GstBadge({ s }: { s: Pick<DirectorySupplier, 'gst_status' | 'verified_at'> }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#FF5A00]/12 px-2 py-0.5 text-[11px] font-bold text-[#E04E00] dark:text-[#FF8A3D]">
      <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" /> GST {s.gst_status ?? 'active'} · checked {formatDate(s.verified_at)}
    </span>
  );
}

export default function SupplierDirectoryPage() {
  const { id } = useParams<{ id?: string }>();
  return id ? <SupplierDetail id={id} /> : <DirectoryList />;
}

function DirectoryList() {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [rows, setRows] = useState<DirectorySupplier[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    directorySuppliers({ search: query, category, limit: PAGE, offset }).then(({ data, error: e }) => {
      if (!alive) return;
      setRows((prev) => (offset === 0 ? data?.rows ?? [] : [...prev, ...(data?.rows ?? [])]));
      setTotal(data?.total ?? 0);
      setError(e);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [query, category, offset]);

  return (
    <MainLayout>
      <PageMeta title="Supplier Directory | BulkSkart" description="Indian manufacturers with an active GST registration, and the products on their own websites." />
      <div className="mx-auto w-full max-w-6xl space-y-5 px-4 py-8">
        <header className="space-y-2">
          <h1 className="flex items-center gap-2 text-2xl font-black sm:text-3xl"><Factory className="h-7 w-7 text-[#FF5A00]" aria-hidden="true" /> Supplier Directory</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Manufacturers listed from their own websites. Each one's GST registration was checked and found active, and its name and state match its
            website. They are not BulkSkart members yet: post your requirement and we will reach the right ones for you.
          </p>
        </header>
        <form onSubmit={(e) => { e.preventDefault(); setOffset(0); setQuery(search.trim()); }} className="flex flex-col gap-2 sm:flex-row">
          <label className="relative flex-1">
            <span className="sr-only">Search suppliers or products</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Product, company or city"
              className="min-h-[44px] w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-[#FF5A00]" />
          </label>
          <select value={category} onChange={(e) => { setOffset(0); setCategory(e.target.value); }} aria-label="Category"
            className="min-h-[44px] rounded-xl border border-border bg-background px-3 text-sm">
            <option value="">All categories</option>
            {Object.entries(CATEGORY_LABELS).map(([slug, label]) => <option key={slug} value={slug}>{label}</option>)}
          </select>
          <button type="submit" className="fk-btn is-primary min-h-[44px]">Search</button>
        </form>

        {error ? (
          <p className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">The directory could not be loaded. Please try again.</p>
        ) : loading && offset === 0 ? (
          <div className="flex justify-center p-12"><Loader2 className="h-7 w-7 animate-spin text-[#FF5A00]" aria-label="Loading" /></div>
        ) : rows.length === 0 ? (
          <div className="space-y-3 rounded-2xl border border-border bg-card p-8 text-center">
            <p className="font-bold">{query || category ? 'No supplier matches yet.' : 'No suppliers are listed yet.'}</p>
            <p className="text-sm text-muted-foreground">Tell manufacturers what you need, or list your own factory.</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Link to={`/post-requirement${query ? `?q=${encodeURIComponent(query)}` : ''}`} className="fk-btn is-primary">Post a requirement</Link>
              <Link to="/register-factory" className="fk-btn is-ghost">Register your factory</Link>
            </div>
          </div>
        ) : (
          <>
            <p className="text-[13px] text-muted-foreground">{total} supplier{total === 1 ? '' : 's'}</p>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((s) => (
                <li key={s.id}>
                  <Link to={`/directory/${s.id}`} className="flex h-full flex-col gap-2 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-[#FF5A00]">
                    <span className="flex items-start gap-2 font-black leading-snug"><Building2 className="mt-0.5 h-4 w-4 shrink-0 text-[#FF5A00]" aria-hidden="true" />{s.name}</span>
                    <span className="flex items-center gap-1 text-[12.5px] text-muted-foreground"><MapPin className="h-3.5 w-3.5" aria-hidden="true" />{[s.city, s.state].filter(Boolean).join(', ') || s.country}</span>
                    <GstBadge s={s} />
                    {s.sample_products && s.sample_products.length > 0 && (
                      <span className="flex flex-wrap gap-1">
                        {s.sample_products.map((p) => <span key={p} className="rounded-md bg-muted px-1.5 py-0.5 text-[11.5px]">{p}</span>)}
                      </span>
                    )}
                    <span className="mt-auto text-[12px] font-bold text-[#E04E00] dark:text-[#FF8A3D]">{s.product_count} product{s.product_count === 1 ? '' : 's'} →</span>
                  </Link>
                </li>
              ))}
            </ul>
            {rows.length < total && (
              <div className="flex justify-center">
                <button type="button" onClick={() => setOffset(rows.length)} disabled={loading} className="fk-btn is-ghost">
                  {loading ? 'Loading…' : 'Show more'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
}

function SupplierDetail({ id }: { id: string }) {
  const [s, setS] = useState<(DirectorySupplier & { products: DirectoryProduct[] }) | null | undefined>(undefined);
  useEffect(() => {
    directorySupplier(id).then(({ data }) => setS(data ?? null));
  }, [id]);

  if (s === undefined) {
    return <MainLayout><div className="flex justify-center p-16"><Loader2 className="h-7 w-7 animate-spin text-[#FF5A00]" aria-label="Loading" /></div></MainLayout>;
  }
  if (!s) {
    return (
      <MainLayout>
        <PageMeta title="Supplier not found | BulkSkart" description="This supplier is not listed." robots="noindex, nofollow" />
        <div className="mx-auto max-w-xl space-y-3 px-4 py-16 text-center">
          <p className="text-lg font-black">This supplier is not listed</p>
          <p className="text-sm text-muted-foreground">It may have been removed after a recheck, or at the company's request.</p>
          <Link to="/directory" className="fk-btn is-primary inline-flex">Back to the directory</Link>
        </div>
      </MainLayout>
    );
  }
  return (
    <MainLayout>
      <PageMeta title={`${s.name} | Supplier Directory | BulkSkart`} description={`${s.name}${s.city ? `, ${s.city}` : ''}: products listed from the company's website.`} />
      <div className="mx-auto w-full max-w-5xl space-y-5 px-4 py-8">
        <Link to="/directory" className="text-[13px] font-bold text-muted-foreground hover:text-foreground">← Supplier Directory</Link>
        <header className="space-y-2 rounded-2xl border border-border bg-card p-5">
          <h1 className="text-2xl font-black">{s.name}</h1>
          {s.legal_name && s.legal_name !== s.name && <p className="text-sm text-muted-foreground">Registered as {s.legal_name}</p>}
          <p className="flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-4 w-4" aria-hidden="true" />{[s.city, s.state, s.country].filter(Boolean).join(', ')}</p>
          <GstBadge s={s} />
          <p className="text-[12.5px] text-muted-foreground">
            Listed from the company's own website; not a BulkSkart member yet. Products, specifications and any prices are as the company published
            them on the date shown, and may have changed.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Link to={`/post-requirement?q=${encodeURIComponent(s.products[0]?.name ?? s.name)}`} className="fk-btn is-primary">Request a quotation</Link>
            <Link to="/register-factory" className="fk-btn is-ghost">Is this your company? List it free</Link>
          </div>
        </header>

        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-black"><Package className="h-5 w-5 text-[#FF5A00]" aria-hidden="true" /> Products ({s.products.length})</h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {s.products.map((p) => {
              const specs = Object.entries(p.specifications ?? {});
              return (
                <li key={p.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
                  <div className="flex gap-3">
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-border">
                      {p.image_url ? <img src={p.image_url} alt={p.name} loading="lazy" className="h-full w-full object-cover" />
                        : <NeutralProductPlaceholder title={p.name} category={categoryLabel(p.category)} subtext="" className="h-full w-full" />}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-black leading-snug">{p.name}</h3>
                      {p.category && <p className="text-[12px] text-muted-foreground">{categoryLabel(p.category)}</p>}
                      <p className="text-[11.5px] text-muted-foreground">Checked {formatDate(p.checked_at)}</p>
                    </div>
                  </div>
                  {p.description && <p className="text-[13px] leading-relaxed">{p.description}</p>}
                  {specs.length > 0 && (
                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-xl bg-muted/50 p-3 text-[12.5px]">
                      {specs.slice(0, 12).map(([k, v]) => <Fragment key={k}><dt className="text-muted-foreground">{k}</dt><dd>{v}</dd></Fragment>)}
                    </dl>
                  )}
                  {(p.price_text || p.moq_text) && (
                    <p className="text-[12.5px]">
                      {p.price_text && <><b>Price on the company website:</b> {p.price_text}. </>}
                      {p.moq_text && <><b>Minimum order on the company website:</b> {p.moq_text}.</>}
                    </p>
                  )}
                  <Link to={`/post-requirement?q=${encodeURIComponent(p.name)}`} className="mt-auto text-[13px] font-bold text-[#E04E00] hover:underline dark:text-[#FF8A3D]">Request a quotation for this →</Link>
                </li>
              );
            })}
          </ul>
        </section>
        <p className="text-[12px] text-muted-foreground">
          Is this your company and you want it removed? <Link to={`/contact?subject=${encodeURIComponent(`Directory removal: ${s.name}`)}`} className="font-bold underline">Tell us</Link>.
        </p>
      </div>
    </MainLayout>
  );
}
