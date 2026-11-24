/**
 * Reads company facts and products from a company's own web pages. Only what a page shows is taken: structured data
 * (schema.org JSON-LD) first, then clearly labelled text. Nothing is filled in. Each fact keeps the page it came from.
 */
import { parse } from 'node-html-parser';
import { findGstins, isValidGstin, stateOfGstin } from './gst.mjs';
import { publicUrl } from './net.mjs';

const STATES = [
  ['Andaman and Nicobar Islands', 'andaman'], ['Andhra Pradesh'], ['Arunachal Pradesh'], ['Assam'], ['Bihar'], ['Chandigarh'],
  ['Chhattisgarh', 'chattisgarh'], ['Dadra and Nagar Haveli and Daman and Diu', 'dadra', 'silvassa', 'daman'], ['Delhi', 'new delhi'],
  ['Goa'], ['Gujarat'], ['Haryana'], ['Himachal Pradesh'], ['Jammu and Kashmir', 'jammu & kashmir'], ['Jharkhand'], ['Karnataka'],
  ['Kerala'], ['Ladakh'], ['Lakshadweep'], ['Madhya Pradesh'], ['Maharashtra'], ['Manipur'], ['Meghalaya'], ['Mizoram'],
  ['Nagaland'], ['Odisha', 'orissa'], ['Puducherry', 'pondicherry'], ['Punjab'], ['Rajasthan'], ['Sikkim'], ['Tamil Nadu', 'tamilnadu'],
  ['Telangana'], ['Tripura'], ['Uttar Pradesh'], ['Uttarakhand', 'uttaranchal'], ['West Bengal'],
];
const STATE_RE = new RegExp(`\\b(${STATES.flat().map((s) => s.replace(/[&]/g, '&').replace(/\s+/g, '\\s+')).join('|')})\\b`, 'i');
export function canonicalState(text) {
  const m = String(text || '').match(STATE_RE);
  if (!m) return null;
  const hit = m[1].toLowerCase().replace(/\s+/g, ' ');
  return STATES.find((names) => names.some((n) => n.toLowerCase() === hit))?.[0] ?? null;
}

const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const GENERIC_TITLE = /^(home|homepage|welcome|index|products?|our products|product range|catalogue|catalog|about us|contact us|services|gallery|default)$/i;

function jsonldObjects(root) {
  const out = [];
  for (const script of root.querySelectorAll('script[type="application/ld+json"]')) {
    let data;
    try { data = JSON.parse(script.rawText.trim()); } catch { continue; }
    const stack = Array.isArray(data) ? [...data] : [data];
    while (stack.length) {
      const item = stack.shift();
      if (!item || typeof item !== 'object') continue;
      if (Array.isArray(item['@graph'])) stack.push(...item['@graph']);
      out.push(item);
    }
  }
  return out;
}
const typesOf = (obj) => (Array.isArray(obj['@type']) ? obj['@type'] : [obj['@type']]).filter(Boolean).map(String);
const isType = (obj, re) => typesOf(obj).some((t) => re.test(t));
const firstString = (v) => (typeof v === 'string' ? v : Array.isArray(v) ? v.find((x) => typeof x === 'string') ?? (v[0]?.url || null) : v && typeof v === 'object' ? v.url || v.name || null : null);

function specsFrom(root) {
  const specs = {};
  const add = (k, v) => {
    const key = clean(k).replace(/[:：]\s*$/, '');
    const val = clean(v);
    if (!key || !val || key.length > 60 || val.length > 300 || /^\d+$/.test(key) || key.toLowerCase() === val.toLowerCase()) return;
    if (Object.keys(specs).length < 60 && !(key in specs)) specs[key] = val;
  };
  for (const table of root.querySelectorAll('table')) {
    const rows = table.querySelectorAll('tr').map((tr) => tr.querySelectorAll('th,td'));
    const pairs = rows.filter((cells) => cells.length === 2);
    if (pairs.length >= 2 && pairs.length >= rows.length * 0.6) for (const [k, v] of pairs) add(k.text, v.text);
  }
  for (const dl of root.querySelectorAll('dl')) {
    const dts = dl.querySelectorAll('dt');
    const dds = dl.querySelectorAll('dd');
    if (dts.length >= 2 && dts.length === dds.length) dts.forEach((dt, i) => add(dt.text, dds[i].text));
  }
  if (Object.keys(specs).length < 2) {
    for (const li of root.querySelectorAll('li')) {
      const m = clean(li.text).match(/^([A-Za-z][A-Za-z0-9 ./()%&-]{1,40})\s*[:：]\s*(.{1,200})$/);
      if (m) add(m[1], m[2]);
    }
    if (Object.keys(specs).length < 3) return {};
  }
  return specs;
}

/** One fetched page, read once. */
export function readPage(html, pageUrl) {
  const root = parse(html || '', { comment: false });
  const jsonld = jsonldObjects(root);
  for (const el of root.querySelectorAll('script,style,noscript,template,svg,iframe')) el.remove();
  const meta = (sel) => clean(root.querySelector(sel)?.getAttribute('content'));
  const body = root.querySelector('body') ?? root;
  const text = body.structuredText ?? body.text;
  const links = [];
  const seen = new Set();
  for (const a of root.querySelectorAll('a[href]')) {
    const href = a.getAttribute('href') || '';
    if (/^(mailto|tel|javascript):/i.test(href)) continue;
    const u = publicUrl(href, pageUrl);
    if (!u || seen.has(u.href)) continue;
    seen.add(u.href);
    links.push({ href: u.href, text: clean(a.text).slice(0, 120) });
  }
  const footer = root.querySelectorAll('footer').map((f) => f.structuredText).join('\n');
  return {
    url: pageUrl,
    title: clean(root.querySelector('title')?.text),
    h1: clean(root.querySelector('h1')?.text),
    metaDescription: meta('meta[name="description"]'),
    ogSiteName: meta('meta[property="og:site_name"]'),
    ogTitle: meta('meta[property="og:title"]'),
    ogImage: meta('meta[property="og:image"]'),
    text: clean(text).length ? String(text).replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').slice(0, 200_000) : '',
    footer,
    tel: root.querySelectorAll('a[href^="tel:"]').map((a) => a.getAttribute('href').slice(4)),
    mailto: root.querySelectorAll('a[href^="mailto:"]').map((a) => a.getAttribute('href').slice(7).split('?')[0]),
    links,
    jsonld,
    specs: specsFrom(root),
    paragraphs: root.querySelectorAll('p').map((p) => clean(p.text)).filter((p) => p.length >= 60).slice(0, 12),
    images: root.querySelectorAll('img').slice(0, 60).map((img) => ({ src: img.getAttribute('src') || img.getAttribute('data-src') || '', alt: clean(img.getAttribute('alt')) })),
  };
}

// ── company facts ───────────────────────────────────────────────────────────────────────────────────────────
const LEGAL = /(Pvt\.?\s*Ltd\.?|Private\s+Limited|Limited|Ltd\.?|LLP|Industries|Enterprises|Corporation|Company|Exports|Manufacturing|Mfg\.?\s*Co\.?)/i;
const COPYRIGHT = /(?:©|\(c\)|copyright)\s*(?:\d{4}(?:\s*[-–]\s*\d{2,4})?)?\s*[,.]?\s*(?:by\s+)?(?:all rights reserved\.?\s*)?([A-Z][A-Za-z0-9&.,'()\- ]{2,90}?)(?=\s*(?:[.|,]\s*all rights|all rights|\||\.?\s*$|\n|\s{2}))/im;

export function cleanCompanyName(raw) {
  let n = clean(raw)
    .replace(/^(welcome to|welcome|home\s*[-|:])\s*/i, '')
    .replace(/\s*[-|:–]\s*(home|official website|homepage|welcome)$/i, '')
    .replace(/\s*\.\s*all rights reserved.*$/i, '')
    .replace(/,\s*$/, '')
    .replace(/(?<!\b(?:Ltd|Co|Inc|Pvt|Corp|Mfg|Bros))\.\s*$/i, '');
  if (n.length > 120) n = n.slice(0, 120);
  return n;
}

function nameFromTitle(title) {
  const parts = clean(title).split(/\s+[|–—-]\s+|\s*\|\s*|\s*::\s*/).map(cleanCompanyName).filter((p) => p && !GENERIC_TITLE.test(p) && p.length <= 80);
  return parts.find((p) => LEGAL.test(p)) ?? parts.at(-1) ?? null;
}

const PIN_RE = /\b([1-9][0-9]{2})\s?([0-9]{3})\b/g;

function addressFromText(text) {
  const lines = String(text || '').split('\n').map(clean).filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const m of line.matchAll(PIN_RE)) {
      const around = line.slice(Math.max(0, m.index - 80), m.index + 20);
      const prev = lines.slice(Math.max(0, i - 2), i).join(', ');
      const ctx = `${prev} ${around}`;
      if (!(canonicalState(ctx) || /\b(pin|pin\s*code|pincode|india)\b/i.test(ctx))) continue;
      if (/\b(phone|mobile|tel|fax|call|whatsapp)\b/i.test(line.slice(Math.max(0, m.index - 25), m.index))) continue;
      let address = line.length < 40 && prev ? `${prev}, ${line}` : line;
      address = address.replace(/^.*?\b(address|regd\.?\s*office|registered office|office|factory|works|plant|corporate office|head office)\s*[:\-–]\s*/i, '');
      address = address.replace(/\s*(phone|mobile|tel|email|e-mail|fax)\s*[:\-].*$/i, '').slice(0, 300);
      return { address: clean(address), pincode: `${m[1]}${m[2]}` };
    }
  }
  return null;
}

function cityFrom(address, state, pincode) {
  if (!address) return null;
  const parts = address.split(/,|\n/).map(clean).filter(Boolean)
    .map((p) => p.replace(new RegExp(`\\b${pincode ?? 'x^'}\\b|\\b\\d{3}\\s?\\d{3}\\b`, 'g'), '').replace(/\b(india|pin(\s*code)?)\b\.?/gi, '').replace(/[-–:]+\s*$/, '').trim())
    .filter((p) => p && (!state || canonicalState(p) !== state || clean(p.replace(STATE_RE, '')).length > 2))
    .map((p) => (state ? clean(p.replace(STATE_RE, '')) : p))
    .filter(Boolean);
  const candidate = parts.at(-1);
  return candidate && /^[A-Za-z][A-Za-z .()-]{1,38}$/.test(candidate) && !/\b(road|street|nagar|plot|no\.|survey|sector|phase|lane|marg|estate|gidc|midc|area)\b/i.test(candidate) ? candidate : null;
}

function normalisePhone(raw) {
  const digits = String(raw || '').replace(/[^\d+]/g, '');
  const d = digits.replace(/^\+?91/, '').replace(/^0/, '');
  if (/^[6-9]\d{9}$/.test(d)) return `+91 ${d.slice(0, 5)} ${d.slice(5)}`;
  if (/^\d{10}$/.test(d)) return `+91 ${d}`;
  return null;
}

/** Company facts from a site's pages, each with the page it came from. */
export function companyFacts(pages, siteUrl) {
  const evidence = { pages: pages.map((p) => ({ url: p.url, title: p.title })) };
  const orgs = pages.flatMap((p) => p.jsonld.filter((o) => isType(o, /^(Organization|Corporation|LocalBusiness|Store|ProfessionalService|Manufacturer|WholesaleStore|HomeAndConstructionBusiness|AutomotiveBusiness)$/)).map((o) => ({ o, url: p.url })));

  // name
  let name = null;
  for (const { o, url } of orgs) {
    const v = cleanCompanyName(o.legalName || o.name);
    if (v) { name = { value: v, method: o.legalName ? 'json-ld legalName' : 'json-ld name', url }; break; }
  }
  if (!name) {
    for (const p of pages) {
      const m = `${p.footer}\n${p.text.slice(-3000)}`.match(COPYRIGHT);
      const v = m ? cleanCompanyName(m[1]) : null;
      if (v && LEGAL.test(v) && v.length >= 4) { name = { value: v, method: 'copyright notice', url: p.url }; break; }
    }
  }
  if (!name) {
    const home = pages[0];
    const v = cleanCompanyName(home?.ogSiteName) || nameFromTitle(home?.title);
    if (v) name = { value: v, method: home?.ogSiteName ? 'og:site_name' : 'page title', url: home.url };
  }

  // address (structured first)
  let address = null;
  for (const { o, url } of [...orgs, ...pages.flatMap((p) => p.jsonld.filter((x) => isType(x, /PostalAddress/)).map((x) => ({ o: { address: x }, url: p.url })))]) {
    const a = Array.isArray(o.address) ? o.address[0] : o.address;
    if (a && typeof a === 'object' && (a.postalCode || a.streetAddress)) {
      const pin = String(a.postalCode || '').replace(/\s/g, '');
      address = {
        address: clean([a.streetAddress, a.addressLocality, a.addressRegion, a.postalCode].filter(Boolean).join(', ')),
        city: clean(a.addressLocality) || null, state: canonicalState(a.addressRegion) || canonicalState(a.streetAddress),
        pincode: /^[1-9]\d{5}$/.test(pin) ? pin : null, method: 'json-ld address', url,
      };
      break;
    }
  }
  if (!address) {
    const ordered = [...pages].sort((a, b) => Number(/contact/i.test(b.url)) - Number(/contact/i.test(a.url)));
    for (const p of ordered) {
      const found = addressFromText(p.text);
      if (found) {
        const state = canonicalState(found.address);
        address = { ...found, state, city: cityFrom(found.address, state, found.pincode), method: 'address text', url: p.url };
        break;
      }
    }
  }

  // GSTIN: labelled ones first; with several, the one whose state matches the address
  const gstins = [];
  for (const p of pages) {
    for (const g of findGstins(p.text)) if (!gstins.some((x) => x.gstin === g.gstin)) gstins.push({ ...g, url: p.url });
    for (const { o } of orgs) {
      const id = String(o.taxID || o.vatID || '').toUpperCase().replace(/\s/g, '');
      if (isValidGstin(id) && !gstins.some((x) => x.gstin === id)) gstins.push({ gstin: id, context: 'schema.org taxID', labelled: true, url: p.url });
    }
  }
  const sorted = [...gstins].sort((a, b) => Number(b.labelled) - Number(a.labelled));
  const gstin = sorted.find((g) => address?.state && stateOfGstin(g.gstin) === address.state) ?? sorted[0] ?? null;

  // phones and emails, as published (admin-only)
  const phones = [...new Set([
    ...pages.flatMap((p) => p.tel), ...orgs.map(({ o }) => firstString(o.telephone)),
    ...pages.flatMap((p) => [...p.text.matchAll(/(?:phone|mobile|tel|call|contact|whatsapp)[^0-9+]{0,15}((?:\+?91[\s-]?)?0?[6-9]\d{4}[\s-]?\d{5}|0\d{2,4}[\s-]\d{6,8})/gi)].map((m) => m[1])),
  ].map(normalisePhone).filter(Boolean))].slice(0, 5);
  const host = new URL(siteUrl).hostname.replace(/^www\./, '');
  const emails = [...new Set([
    ...pages.flatMap((p) => p.mailto), ...orgs.map(({ o }) => firstString(o.email)),
    ...pages.flatMap((p) => p.text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) ?? []),
  ].map((e) => String(e || '').trim().toLowerCase()).filter((e) => /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(e)))]
    .sort((a, b) => Number(b.endsWith(host)) - Number(a.endsWith(host))).slice(0, 5);

  evidence.found = {
    name, address: address ? { value: address.address, method: address.method, url: address.url } : null,
    gstin: gstin ? { value: gstin.gstin, url: gstin.url, context: gstin.context } : null,
    other_gstins: gstins.filter((g) => g.gstin !== gstin?.gstin).map((g) => ({ value: g.gstin, url: g.url })),
  };
  return {
    name: name?.value ?? null,
    gstin: gstin?.gstin ?? null,
    address: address?.address ?? null,
    city: address?.city ?? null,
    state: address?.state ?? null,
    pincode: address?.pincode ?? null,
    phones,
    emails,
    evidence,
  };
}

/** A site counts as a company website when it names the company and shows a GSTIN, an address or a phone. */
export const looksLikeCompany = (facts) => Boolean(facts.name && (facts.gstin || facts.pincode || facts.phones.length));

// ── links to follow ─────────────────────────────────────────────────────────────────────────────────────────
const SKIP_PATH = /\/(cart|checkout|login|signin|register|account|wp-admin|wp-login|blog|news|events?|careers?|jobs|privacy|terms|cookie|sitemap|tag|author|feed|search)(\/|$|\?)|\.(pdf|jpe?g|png|gif|webp|svg|zip|docx?|xlsx?|pptx?|mp4|mp3)(\?|$)/i;
const ABOUT = /(about|contact|company|profile|who-we-are|overview|reach-us|enquiry|inquiry|location|address)/i;
const PRODUCTISH = /(product|catalog|catalogue|range|item|machine|equipment|solution|model|series|categor|portfolio|offering|our-|collection)/i;

export function linksToFollow(page, siteUrl) {
  const host = new URL(siteUrl).hostname.replace(/^www\./, '');
  const internal = page.links.filter((l) => new URL(l.href).hostname.replace(/^www\./, '') === host && !SKIP_PATH.test(new URL(l.href).pathname));
  return {
    about: internal.filter((l) => ABOUT.test(new URL(l.href).pathname) || ABOUT.test(l.text)).map((l) => l.href),
    products: internal.filter((l) => PRODUCTISH.test(new URL(l.href).pathname) || /^(products?|our products|product range|catalogue)$/i.test(l.text)).map((l) => l.href),
  };
}

// ── products ────────────────────────────────────────────────────────────────────────────────────────────────
const MOQ_RE = /\b(minimum order(?: quantity)?|moq)\b\s*[:\-–]?\s*([0-9][^\n;|]{0,40})/i;

/** A product read from its own page, or null when the page is not one product's page. */
export function productFromPage(page) {
  const ld = page.jsonld.find((o) => isType(o, /^(Product|ProductModel|IndividualProduct|Vehicle)$/));
  const path = new URL(page.url).pathname;
  let name = clean(ld?.name) || page.h1 || '';
  if (!ld) {
    const productPath = PRODUCTISH.test(path) && path.split('/').filter(Boolean).length >= 1;
    const specCount = Object.keys(page.specs).length;
    if (!page.h1 || GENERIC_TITLE.test(page.h1) || page.h1.length > 140) return null;
    if (!(specCount >= 2 || (productPath && /specification|technical|features|application/i.test(page.text)))) return null;
    // a catalogue listing (many product links, no spec table) is not one product's page
    if (specCount < 2 && page.links.filter((l) => PRODUCTISH.test(new URL(l.href).pathname)).length > 25) return null;
    name = page.h1;
  }
  if (!name || GENERIC_TITLE.test(name)) return null;

  const specs = { ...page.specs };
  if (ld?.sku && !specs.SKU) specs.SKU = clean(ld.sku);
  if (ld?.mpn && !specs['Model number']) specs['Model number'] = clean(ld.mpn);
  const offer = Array.isArray(ld?.offers) ? ld.offers[0] : ld?.offers;
  // price and MOQ only when the page states them; kept word for word
  const price = offer && (offer.price || offer.lowPrice) ? clean(`${offer.priceCurrency || ''} ${offer.price ?? `${offer.lowPrice}${offer.highPrice ? `–${offer.highPrice}` : ''}`}`) : null;
  const specPrice = Object.entries(specs).find(([k]) => /^(price|rate|unit price)$/i.test(k))?.[1] ?? null;
  const specMoq = Object.entries(specs).find(([k]) => /^(moq|minimum order( quantity)?|min\.? order)$/i.test(k))?.[1] ?? null;
  const textMoq = page.text.match(MOQ_RE)?.[2] ?? null;

  const description = clean(ld?.description) || page.paragraphs.find((p) => !/cookie|copyright|all rights reserved/i.test(p)) || page.metaDescription || null;
  let image = firstString(ld?.image) || page.ogImage || null;
  if (!image) {
    const words = name.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    image = page.images.find((i) => i.src && words.some((w) => i.alt.toLowerCase().includes(w)))?.src ?? null;
  }
  const imageUrl = image ? publicUrl(image, page.url)?.href ?? null : null;
  const brand = firstString(ld?.brand) || firstString(ld?.manufacturer);

  return {
    name: clean(name).slice(0, 200),
    description_source: description ? description.slice(0, 4000) : null,
    specifications: specs,
    image_source_url: imageUrl,
    price_text: (price || specPrice) ? clean(price || specPrice).slice(0, 200) : null,
    moq_text: (specMoq || textMoq) ? clean(specMoq || textMoq).slice(0, 200) : null,
    manufacturer: brand ? clean(brand).slice(0, 200) : null,
    category_hint: clean(ld?.category) || null,
    source_url: page.url,
    method: ld ? 'json-ld Product' : 'product page (heading + specifications)',
  };
}
