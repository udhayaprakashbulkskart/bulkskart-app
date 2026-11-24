/**
 * Candidate company websites from a permitted search API (Brave Search API or Google Programmable Search JSON API).
 * Search results only point at websites: nothing about a company is taken from them. Marketplaces, directories,
 * social networks, news and government sites are skipped: a company is only read from its own website.
 */

const NOT_COMPANY_SITES = [
  'indiamart.com', 'tradeindia.com', 'exportersindia.com', 'justdial.com', 'alibaba.com', 'aliexpress.com', 'made-in-china.com',
  'amazon.in', 'amazon.com', 'flipkart.com', 'meesho.com', 'udaan.com', 'moglix.com', 'industrybuying.com', 'jiomart.com',
  'facebook.com', 'instagram.com', 'linkedin.com', 'twitter.com', 'x.com', 'youtube.com', 'pinterest.com', 'quora.com', 'reddit.com',
  'wikipedia.org', 'glassdoor.com', 'glassdoor.co.in', 'ambitionbox.com', 'naukri.com', 'zaubacorp.com', 'tofler.in', 'thecompanycheck.com',
  'falconebiz.com', 'kompass.com', 'dnb.com', 'crunchbase.com', 'yellowpages.in', 'sulekha.com', 'getdistributors.com', 'go4worldbusiness.com',
  'tradeford.com', 'ec21.com', 'globalsources.com', 'thomasnet.com', 'europages.com', 'bulkskart.com', 'google.com', 'bing.com',
];

export function isCandidateHost(host, suppressed = []) {
  const h = String(host || '').toLowerCase().replace(/^www\./, '');
  if (!h || !h.includes('.')) return false;
  if (/\.(gov|nic|edu|ac|mil)(\.[a-z]{2})?$/.test(h) || /\.(gov|nic)\.in$/.test(h)) return false;
  if (/(^|\.)(news|times|blog|medium|wordpress|blogspot|substack)\./.test(h) || /(blogspot|wordpress)\.com$/.test(h)) return false;
  const blocked = [...NOT_COMPANY_SITES, ...suppressed.map((s) => String(s).toLowerCase())];
  return !blocked.some((d) => h === d || h.endsWith(`.${d}`));
}

export function buildQuery(job) {
  const q = String(job.query || '').trim();
  const where = String(job.location || '').trim();
  const words = [q];
  if (!/\b(manufacturer|manufacturers|factory|maker|producer|exporter)\b/i.test(q)) words.push('manufacturer');
  if (where) words.push(where);
  if (!/india/i.test(`${q} ${where}`)) words.push('India');
  return words.join(' ');
}

async function brave(query, count, key, fetchImpl) {
  const out = [];
  for (let offset = 0; out.length < count && offset < 5; offset++) {
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=20&offset=${offset}&country=IN&search_lang=en`;
    const res = await fetchImpl(url, { headers: { Accept: 'application/json', 'X-Subscription-Token': key }, signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`Brave Search API: HTTP ${res.status}`);
    const data = await res.json();
    const results = data?.web?.results ?? [];
    out.push(...results.map((r) => ({ url: r.url, title: r.title, snippet: r.description })));
    if (results.length < 20) break;
  }
  return out;
}

async function googleCse(query, count, key, cx, fetchImpl) {
  const out = [];
  for (let start = 1; out.length < count && start <= 91; start += 10) {
    const url = `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(key)}&cx=${encodeURIComponent(cx)}&q=${encodeURIComponent(query)}&num=10&start=${start}&gl=in`;
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`Google Programmable Search: HTTP ${res.status}`);
    const data = await res.json();
    const items = data?.items ?? [];
    out.push(...items.map((r) => ({ url: r.link, title: r.title, snippet: r.snippet })));
    if (items.length < 10) break;
  }
  return out;
}

/** one homepage per website, best ranked first */
export async function searchCompanySites(job, cfg, { suppressed = [], fetchImpl = fetch } = {}) {
  if (!cfg.provider) throw new Error('No search API is configured (set BRAVE_SEARCH_API_KEY, or GOOGLE_CSE_KEY and GOOGLE_CSE_ID)');
  const count = Math.max(1, Math.min(100, job.max_results || 20));
  const query = buildQuery(job);
  const raw = cfg.provider === 'brave' ? await brave(query, count * 3, cfg.braveKey, fetchImpl)
    : cfg.provider === 'google_cse' ? await googleCse(query, count * 3, cfg.googleKey, cfg.googleCx, fetchImpl)
    : (() => { throw new Error(`Unknown SEARCH_PROVIDER ${cfg.provider}`); })();
  const seen = new Set();
  const sites = [];
  for (const r of raw) {
    let u;
    try { u = new URL(r.url); } catch { continue; }
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    if (seen.has(host) || !isCandidateHost(host, suppressed)) continue;
    seen.add(host);
    sites.push({ url: `${u.protocol}//${u.hostname}/`, found_on: r.url, title: r.title });
    if (sites.length >= count) break;
  }
  return { query, provider: cfg.provider, sites };
}
