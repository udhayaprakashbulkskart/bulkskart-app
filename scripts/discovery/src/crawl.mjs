/**
 * Reads one company website: the start page, its home page, its about/contact pages, then its product pages,
 * up to `maxPages`. Only pages on the same website are read.
 */
import { companyFacts, linksToFollow, looksLikeCompany, productFromPage, readPage } from './extract.mjs';
import { FetchBlocked, hostOf } from './net.mjs';

const key = (u) => {
  const url = new URL(u);
  url.hash = '';
  return url.href.replace(/\/$/, '');
};

export async function crawlSite(startUrl, { fetcher, maxPages = 25, maxProducts = 60, deadline = Infinity }) {
  const pages = [];
  const products = [];
  const errors = [];
  const seen = new Set();
  const queue = [startUrl, new URL('/', startUrl).href];
  let site = null; // the website's own address after any redirect (http -> https, bare -> www)

  while (queue.length && pages.length < maxPages && Date.now() < deadline) {
    const next = queue.shift();
    const k = key(next);
    if (seen.has(k)) continue;
    seen.add(k);
    if (site && hostOf(next) !== hostOf(site)) continue;
    let res;
    try {
      res = await fetcher.page(next);
    } catch (e) {
      errors.push({ url: next, error: e instanceof FetchBlocked ? e.reason : String(e?.message || e).slice(0, 200) });
      continue;
    }
    if (res.status >= 400) {
      errors.push({ url: next, error: `HTTP ${res.status}`, status: res.status });
      continue;
    }
    if (!site) site = new URL('/', res.url).href;
    if (hostOf(res.url) !== hostOf(site)) { errors.push({ url: next, error: 'redirected to another website' }); continue; }
    seen.add(key(res.url));
    const page = readPage(res.html, res.url);
    page.hash = res.hash;
    pages.push(page);

    const product = productFromPage(page);
    if (product && products.length < maxProducts && !products.some((p) => p.source_url === product.source_url)) {
      products.push({ ...product, content_hash: res.hash });
    }
    const { about, products: productLinks } = linksToFollow(page, site);
    // company facts first (a few pages), then the catalogue
    for (const u of about.slice(0, 6).reverse()) if (!seen.has(key(u))) queue.unshift(u);
    for (const u of productLinks.slice(0, 80)) if (!seen.has(key(u))) queue.push(u);
  }
  return { site, pages, products, errors };
}

/** Read a site and return what would be stored: the company facts and its products (or why it was skipped). */
export async function readCompanySite(url, opts) {
  const crawl = await crawlSite(url, opts);
  if (!crawl.pages.length) return { ok: false, reason: crawl.errors[0]?.error || 'no page could be read', crawl };
  const facts = companyFacts(crawl.pages, crawl.site);
  if (!looksLikeCompany(facts)) return { ok: false, reason: 'not a company website (no name with a GSTIN, address or phone)', facts, crawl };
  return { ok: true, facts, crawl };
}
