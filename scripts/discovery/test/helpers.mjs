// Test helpers: an in-memory "internet" of reserved .example sites, and GSTIN-shaped test strings with a valid
// check character. Nothing here is a real company; nothing here reaches a database.
import { gstinCheckChar } from '../src/gst.mjs';

export const testGstin = (first14) => first14 + gstinCheckChar(first14);

/** fetch() and dns.lookup() over a map of url -> { status, html, headers } */
export function fakeWeb(routes, { privateHosts = [] } = {}) {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    const r = routes[url] ?? routes[url.replace(/\/$/, '')];
    if (!r) return new Response('not found', { status: 404, headers: { 'content-type': 'text/html' } });
    if (r.redirect) return new Response(null, { status: 301, headers: { location: r.redirect } });
    return new Response(r.html ?? r.body ?? '', { status: r.status ?? 200, headers: { 'content-type': r.type ?? 'text/html; charset=utf-8', ...(r.headers ?? {}) } });
  };
  const lookup = async (host) => {
    if (host.startsWith('nxdomain.')) { const e = new Error('ENOTFOUND'); e.code = 'ENOTFOUND'; throw e; }
    return [{ address: privateHosts.includes(host) ? '10.0.0.7' : '203.0.113.10', family: 4 }];
  };
  return { fetchImpl, lookup, calls };
}
