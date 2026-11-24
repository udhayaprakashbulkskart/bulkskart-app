/**
 * A polite, safe page fetcher:
 *   - only http(s) on the default ports, never an address inside a private network (checked on every redirect);
 *   - robots.txt is read first and obeyed for every page and redirect;
 *   - one request at a time per site, at least 1.5 s apart (or the site's Crawl-delay, up to 10 s);
 *   - identifies itself (USER_AGENT), stops after 20 s and 2 MB, follows at most 5 redirects.
 */
import { createHash } from 'node:crypto';
import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { ALLOW_ALL, crawlDelaySeconds, DISALLOW_ALL, isAllowed, parseRobots } from './robots.mjs';
import { ROBOTS_TOKEN, USER_AGENT } from './config.mjs';

export class FetchBlocked extends Error {
  constructor(reason, url) {
    super(`${reason}: ${url}`);
    this.reason = reason;
    this.url = url;
  }
}

function ipv4Private(ip) {
  const [a, b] = ip.split('.').map(Number);
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
}

/** loopback, private, link-local, CGNAT, multicast and reserved ranges, IPv4 and IPv6 */
export function isPrivateAddress(ip) {
  if (isIP(ip) === 4) return ipv4Private(ip);
  const v6 = ip.toLowerCase();
  if (v6 === '::' || v6 === '::1') return true;
  const mapped = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return ipv4Private(mapped[1]);
  return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(v6) || v6.startsWith('64:ff9b:') || v6.startsWith('2001:db8');
}

/** a public web address we may open, or null */
export function publicUrl(raw, base) {
  let url;
  try { url = new URL(raw, base); } catch { return null; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (url.username || url.password) return null;
  if (url.port && !((url.protocol === 'http:' && url.port === '80') || (url.protocol === 'https:' && url.port === '443'))) return null;
  const host = url.hostname.toLowerCase();
  if (!host.includes('.') || /\.(local|localhost|internal|lan|home|corp|intranet)$/.test(host) || host === 'localhost') return null;
  if (isIP(host.replace(/^\[|\]$/g, ''))) return null; // bare IP addresses are never a company website
  url.hash = '';
  return url;
}

export const hostOf = (url) => new URL(url).hostname.toLowerCase().replace(/^www\./, '');
export const sameSite = (a, b) => hostOf(a) === hostOf(b);
export const sha256 = (text) => createHash('sha256').update(text).digest('hex');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function createFetcher({ fetchImpl = fetch, lookup = dnsLookup, minDelayMs = 1500, timeoutMs = 20_000, maxBytes = 2_000_000, now = () => Date.now() } = {}) {
  const robotsCache = new Map(); // origin -> robots
  const nextSlot = new Map(); // host -> earliest time for the next request

  async function assertPublicHost(url) {
    let addresses;
    try { addresses = await lookup(url.hostname, { all: true }); }
    catch (e) { throw new FetchBlocked(e?.code === 'ENOTFOUND' ? 'dns_not_found' : 'dns_error', url.href); }
    if (!addresses.length || addresses.some((a) => isPrivateAddress(a.address))) throw new FetchBlocked('private_address', url.href);
  }

  async function wait(host, robots) {
    const delay = Math.min(10_000, Math.max(minDelayMs, (crawlDelaySeconds(robots, ROBOTS_TOKEN) ?? 0) * 1000));
    const at = nextSlot.get(host) ?? 0;
    const t = now();
    nextSlot.set(host, Math.max(t, at) + delay);
    if (at > t) await sleep(at - t);
  }

  async function readBody(res) {
    const reader = res.body?.getReader();
    if (!reader) return '';
    const chunks = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); break; }
      chunks.push(value);
    }
    return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf8');
  }

  async function raw(url, accept) {
    await assertPublicHost(url);
    return fetchImpl(url.href, {
      redirect: 'manual',
      headers: { 'User-Agent': USER_AGENT, Accept: accept, 'Accept-Language': 'en-IN,en;q=0.8' },
      signal: AbortSignal.timeout(timeoutMs),
    });
  }

  async function robotsFor(url) {
    const origin = url.origin;
    if (robotsCache.has(origin)) return robotsCache.get(origin);
    let robots;
    try {
      let target = new URL('/robots.txt', origin);
      let res;
      for (let hop = 0; hop < 5; hop++) {
        res = await raw(target, 'text/plain');
        if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
          const next = publicUrl(res.headers.get('location'), target);
          if (!next) break;
          target = next;
          continue;
        }
        break;
      }
      if (res.status >= 200 && res.status < 300) robots = parseRobots(await readBody(res));
      else if (res.status >= 400 && res.status < 500) robots = ALLOW_ALL;
      else robots = DISALLOW_ALL;
    } catch {
      robots = DISALLOW_ALL; // unreachable: treat as "do not crawl" (RFC 9309 2.3.1.4)
    }
    robotsCache.set(origin, robots);
    return robots;
  }

  /** a page: { url, status, contentType, html, hash } — throws FetchBlocked for robots, private hosts, non-HTML */
  async function page(rawUrl, { acceptAny = false } = {}) {
    let url = publicUrl(rawUrl);
    if (!url) throw new FetchBlocked('not_a_public_url', String(rawUrl));
    for (let hop = 0; hop <= 5; hop++) {
      await assertPublicHost(url); // before anything else, so an unsafe or vanished host is reported as such
      const robots = await robotsFor(url);
      if (!isAllowed(robots, ROBOTS_TOKEN, url.pathname + url.search)) throw new FetchBlocked('robots_disallowed', url.href);
      await wait(url.hostname, robots);
      const res = await raw(url, 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1');
      if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
        const next = publicUrl(res.headers.get('location'), url);
        if (!next) throw new FetchBlocked('bad_redirect', url.href);
        url = next;
        continue;
      }
      const contentType = (res.headers.get('content-type') || '').toLowerCase();
      if (res.status >= 400) {
        await res.body?.cancel?.();
        return { url: url.href, status: res.status, contentType, html: '', hash: null };
      }
      if (!acceptAny && contentType && !contentType.includes('html')) {
        await res.body?.cancel?.();
        throw new FetchBlocked('not_html', url.href);
      }
      const html = await readBody(res);
      return { url: url.href, status: res.status, contentType, html, hash: sha256(html) };
    }
    throw new FetchBlocked('too_many_redirects', String(rawUrl));
  }

  return { page, robotsFor };
}
