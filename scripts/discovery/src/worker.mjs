#!/usr/bin/env node
/**
 * BulkSkart supplier & product discovery worker. Run on a schedule by .github/workflows/supplier-discovery.yml.
 *
 *   node src/worker.mjs                          process queued jobs, then recheck what is due
 *   node src/worker.mjs --dry-run --seed <url>   read one website and print what would be stored (saves nothing)
 *
 * Every write goes through the discovery_worker_* database functions (migration 00074), which apply the
 * verification and publishing rules. This program only reports what websites and the GST source say.
 * Logs never contain phone numbers, emails or full GSTINs (the repository's Actions logs are public).
 */
import { categoryFor } from './categories.mjs';
import { loadConfig } from './config.mjs';
import { readCompanySite } from './crawl.mjs';
import { createRpc } from './db.mjs';
import { createDescriber } from './describe.mjs';
import { verifyGstin } from './gst.mjs';
import { createFetcher, FetchBlocked, hostOf, publicUrl } from './net.mjs';
import { isCandidateHost, searchCompanySites } from './search.mjs';

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const maskGstin = (g) => (g ? `${g.slice(0, 2)}••••••••••${g.slice(-3)}` : null);

export function productPayload(p, supplierId, description) {
  return {
    supplier_id: supplierId,
    name: p.name,
    source_url: p.source_url,
    source_type: 'official_website',
    category_slug: p.category_slug,
    manufacturer: p.manufacturer,
    description_source: p.description_source,
    description: description || p.description_source,
    description_generated: Boolean(description),
    specifications: p.specifications,
    image_source_url: p.image_source_url,
    price_text: p.price_text,
    moq_text: p.moq_text,
    http_status: 200,
    content_hash: p.content_hash,
    evidence: { method: p.method, read_at: new Date().toISOString() },
  };
}

export function supplierPayload(facts, crawl, { jobId, foundVia, categories }) {
  const f = facts.evidence.found;
  return {
    website_url: crawl.site,
    source_url: f.gstin?.url || f.address?.url || f.name?.url || crawl.site,
    source_type: 'official_website',
    name_on_site: facts.name,
    gstin: facts.gstin,
    address: facts.address,
    city: facts.city,
    state: facts.state,
    pincode: facts.pincode,
    phones: facts.phones,
    emails: facts.emails,
    category_slugs: categories,
    found_via: foundVia,
    job_id: jobId,
    content_hash: crawl.pages[0]?.hash,
    evidence: { ...facts.evidence, read_at: new Date().toISOString(), pages_read: crawl.pages.length, errors: crawl.errors.slice(0, 10) },
  };
}

export async function processSite(url, ctx) {
  const { rpc, fetcher, settings, cfg, describe, stats, job, foundVia, deadline } = ctx;
  const read = await readCompanySite(url, { fetcher, maxPages: settings.max_pages_per_site ?? 25, maxProducts: cfg.maxProductsPerSite, deadline });
  stats.pages_read += read.crawl.pages.length;
  if (!read.ok) {
    stats.not_company += 1;
    log(`  skipped ${hostOf(url)}: ${read.reason}`);
    if (!read.crawl.pages.length) throw new Error(read.reason);
    return null;
  }
  const { facts, crawl } = read;
  const products = crawl.products.map((p) => ({ ...p, category_slug: categoryFor(p.name, p.category_hint, Object.entries(p.specifications).flat().join(' ')) }));
  const categories = [...new Set(products.map((p) => p.category_slug).filter(Boolean))];
  const sup = await rpc('discovery_worker_upsert_supplier', { p: supplierPayload(facts, crawl, { jobId: job?.id, foundVia, categories }) });
  if (sup?.skipped) { stats.suppressed += 1; return null; }
  stats[sup.created ? 'suppliers_new' : 'suppliers_updated'] += 1;
  if (sup.duplicate_of) { stats.duplicates += 1; log(`  ${hostOf(crawl.site)}: duplicate of an existing supplier`); return sup; }

  for (const p of products) {
    if (Date.now() > deadline) break;
    let description = null;
    if (describe) { try { description = await describe(p); } catch { description = null; } }
    const r = await rpc('discovery_worker_upsert_product', { p: productPayload(p, sup.id, description) });
    if (r?.skipped || r?.duplicate) stats.product_duplicates += 1;
    else stats[r.created ? 'products_new' : 'products_updated'] += 1;
  }
  if (sup.needs_gst_check && cfg.gst.url) {
    const g = await verifyGstin(sup.gstin, cfg.gst);
    await rpc('discovery_worker_record_gst', { p_supplier: sup.id, p: g });
    stats.gst_checked += 1;
    if (g.result === 'error') stats.gst_errors += 1;
  }
  const final = await rpc('discovery_worker_evaluate', { p_supplier: sup.id });
  log(`  ${hostOf(crawl.site)}: ${products.length} products, GSTIN ${maskGstin(facts.gstin) ?? 'not shown'} -> ${final?.verification_status}/${final?.publish_status}`);
  return sup;
}

export async function runJob(claim, ctx) {
  const { job, settings, suppressed_domains: suppressed = [] } = claim;
  const { rpc, cfg } = ctx;
  const stats = { sites_considered: 0, pages_read: 0, not_company: 0, suppressed: 0, suppliers_new: 0, suppliers_updated: 0, duplicates: 0,
    products_new: 0, products_updated: 0, product_duplicates: 0, gst_checked: 0, gst_errors: 0, errors: 0 };
  log(`job ${job.id} (${job.kind})`);
  try {
    let sites;
    let foundVia;
    if (job.kind === 'search') {
      const found = await searchCompanySites(job, cfg.search, { suppressed });
      sites = found.sites.map((s) => s.url);
      foundVia = `search:${found.provider}`;
      stats.source_type = found.provider;
      stats.query = found.query;
    } else {
      sites = (job.seed_urls || []).filter((u) => publicUrl(u));
      foundVia = 'seed_url';
      stats.source_type = 'seed_urls';
    }
    for (const url of sites) {
      if (Date.now() > ctx.deadline) { stats.stopped_early = true; break; }
      const host = hostOf(url);
      if (job.kind === 'search' && !isCandidateHost(host, suppressed)) continue;
      if (suppressed.some((d) => host === d || host.endsWith(`.${d}`))) { stats.suppressed += 1; continue; }
      stats.sites_considered += 1;
      try {
        await processSite(url, { ...ctx, settings, stats, job, foundVia });
      } catch (e) {
        stats.errors += 1;
        log(`  error on ${host}: ${String(e?.message || e).slice(0, 160)}`);
        await rpc('discovery_worker_log_error', { p_job: job.id, p_url: url, p_error: String(e?.message || e) }).catch(() => {});
      }
    }
    await rpc('discovery_worker_finish_job', { p_job: job.id, p_status: 'done', p_stats: stats, p_error: null });
    log(`job ${job.id} done`, JSON.stringify(stats));
  } catch (e) {
    log(`job ${job.id} failed: ${String(e?.message || e).slice(0, 300)}`);
    await rpc('discovery_worker_finish_job', { p_job: job.id, p_status: 'failed', p_stats: stats, p_error: String(e?.message || e) });
  }
}

/** ok / gone / failed for one address, without throwing */
export async function checkUrl(fetcher, url) {
  try {
    const res = await fetcher.page(url, { acceptAny: true });
    if (res.status < 400) return { ok: true, http_status: res.status, content_hash: res.hash, url };
    return { ok: false, gone: res.status === 404 || res.status === 410, http_status: res.status, url };
  } catch (e) {
    if (e instanceof FetchBlocked) return { ok: false, gone: e.reason === 'dns_not_found', error: e.reason, url };
    return { ok: false, gone: false, error: String(e?.message || e).slice(0, 200), url };
  }
}

export async function recheck(item, { rpc, fetcher, cfg, deadline }) {
  const site = await checkUrl(fetcher, item.website_url);
  await rpc('discovery_worker_record_recheck', { p: { entity: 'supplier', id: item.id, ...site } });
  for (const p of (item.products || []).slice(0, 25)) {
    if (Date.now() > deadline) break;
    const r = await checkUrl(fetcher, p.source_url);
    await rpc('discovery_worker_record_recheck', { p: { entity: 'product', id: p.id, ...r } });
  }
  if (item.gst_due && item.gstin && cfg.gst.url) {
    await rpc('discovery_worker_record_gst', { p_supplier: item.id, p: await verifyGstin(item.gstin, cfg.gst) });
  }
  log(`  recheck ${hostOf(item.website_url)}: ${site.ok ? 'ok' : `failed (${site.http_status ?? site.error})`}`);
}

async function dryRun(seeds, cfg) {
  const fetcher = createFetcher();
  for (const seed of seeds) {
    const read = await readCompanySite(seed, { fetcher, maxPages: 25, maxProducts: cfg.maxProductsPerSite, deadline: Date.now() + 10 * 60_000 });
    const f = read.facts;
    console.log(JSON.stringify({
      website: read.crawl.site, would_store: read.ok, reason: read.reason ?? null,
      pages_read: read.crawl.pages.map((p) => p.url), errors: read.crawl.errors.slice(0, 10),
      company: f ? { name: f.name, name_from: f.evidence.found.name, gstin: maskGstin(f.gstin), gstin_from: f.evidence.found.gstin?.url ?? null,
        address: f.address, city: f.city, state: f.state, pincode: f.pincode, phones_found: f.phones.length, emails_found: f.emails.length } : null,
      products: read.crawl.products.map((p) => ({ name: p.name, url: p.source_url, category: categoryFor(p.name, p.category_hint, Object.entries(p.specifications).flat().join(' ')),
        specifications: Object.keys(p.specifications).length, price_text: p.price_text, moq_text: p.moq_text, image: Boolean(p.image_source_url), method: p.method })),
    }, null, 2));
  }
}

export async function main(argv = process.argv.slice(2), env = process.env) {
  const cfg = loadConfig(env);
  const seeds = argv.flatMap((a, i) => (a === '--seed' && argv[i + 1] ? [argv[i + 1]] : []));
  if (argv.includes('--dry-run')) {
    if (!seeds.length) throw new Error('--dry-run needs --seed <url>');
    return dryRun(seeds, cfg);
  }
  if (!cfg.serviceKey) {
    log('SUPABASE_SERVICE_ROLE_KEY is not set: nothing to do. Add it as a repository secret to turn discovery on.');
    return;
  }
  const rpc = createRpc(cfg);
  const fetcher = createFetcher();
  const describe = createDescriber(cfg.llm);
  const deadline = Date.now() + cfg.timeBudgetMs;
  log(`discovery: search ${cfg.search.provider || 'not configured'}, GST check ${cfg.gst.url ? cfg.gst.provider : 'not configured'}, AI descriptions ${describe ? cfg.llm.model : 'off'}`);
  const ctx = { rpc, fetcher, cfg, describe, deadline };

  for (let n = 0; Date.now() < deadline - 5 * 60_000; n++) {
    const claim = await rpc('discovery_worker_claim_job');
    if (!claim) break;
    await runJob(claim, ctx);
  }
  if (cfg.maxRechecks > 0 && Date.now() < deadline - 2 * 60_000) {
    const due = await rpc('discovery_worker_due_rechecks', { p_limit: cfg.maxRechecks });
    log(`rechecks due: ${due.length}`);
    for (const item of due) {
      if (Date.now() > deadline) break;
      try { await recheck(item, ctx); } catch (e) { log(`  recheck error: ${String(e?.message || e).slice(0, 160)}`); }
    }
  }
  log('discovery run finished');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(String(e?.stack || e));
    process.exit(1);
  });
}
