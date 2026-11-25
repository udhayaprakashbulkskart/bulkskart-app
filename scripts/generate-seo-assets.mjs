/**
 * After `vite build`, stamp route meta into dist/index.html and write a sitemap.
 * Live nginx 301s a no-slash URL when a directory of that name exists, and it does
 * not serve /products from products.html. Shells stay out of dist so /products is
 * the SPA (200, no redirect). A parse-time script applies the matching title,
 * description, and no-slash canonical. Sitemap URLs use that same no-slash form.
 * Every address gets its own canonical and hreflang (index.html carries none: one shared homepage canonical would
 * mark every page as a copy of the homepage). Sitemaps list the addresses the pages themselves declare.
 * If Supabase is unreachable, the public sitemap already copied into dist is left in place.
 */
import fs from 'node:fs';
import path from 'node:path';
import { alternatives, categorySeo, prerenderPages, readCatalog, readContent, writePrerendered } from './seo-prerender.mjs';

const SITE = 'https://www.bulkskart.com';

const STATIC_PAGES = [
  {
    path: '/',
    title: 'BulkSkart | B2B Wholesale Marketplace & Bulk Suppliers in India',
    description: 'Find verified manufacturers and wholesale suppliers in India. Compare bulk prices, post free RFQs, and source factory-direct products on BulkSkart.',
  },
  {
    path: '/products',
    title: 'Bulk Wholesale Products Catalog — Factory Direct Pricing & MOQs | BulkSkart',
    description: 'Browse wholesale products from verified manufacturers. Compare bulk pricing and send a buying requirement on BulkSkart.',
  },
  {
    path: '/requirements',
    title: 'Live Buying Requirements & Active B2B RFQs | BulkSkart',
    description: 'Browse active buying requests. Filter by category, delivery location, and quantity, then submit a quotation on BulkSkart.',
  },
  {
    path: '/suppliers',
    title: 'Verified Global Manufacturers & Wholesale Exporters Directory | BulkSkart',
    description: 'Search verified factories, exporters, and OEM manufacturers. Filter by certification and connect on BulkSkart.',
  },
  {
    path: '/directory',
    title: 'Supplier Directory – GST-Checked Indian Manufacturers | BulkSkart',
    description: 'Indian manufacturers whose GST registration was checked and found active, with the products listed on their own websites.',
  },
  {
    path: '/supplier-map',
    title: 'Live Verified Supplier Map – Find Manufacturers Near You | BulkSkart',
    description: 'Find verified Indian manufacturers near you on a live map. Every factory is checked by BulkSkart: registration, location and active products.',
  },
  {
    path: '/categories',
    title: 'All B2B Product Categories & Industry Directory | BulkSkart',
    description: 'Explore industrial bulk product categories on BulkSkart, from machinery and textiles to raw materials.',
  },
  {
    path: '/pricing',
    title: 'Supplier Pricing Plans | BulkSkart',
    description: 'Compare BulkSkart supplier plans for listing products and responding to buyer requirements.',
  },
  {
    path: '/about',
    title: 'About Us — BulkSkart | Global B2B Bulk Trade Platform',
    description: 'BulkSkart is a B2B wholesale marketplace connecting buyers with manufacturers and suppliers.',
  },
  {
    path: '/contact',
    title: 'Contact BulkSkart — Support, Partnerships & Global Trade Enquiries',
    description: 'Contact BulkSkart for support, partnerships, and trade enquiries.',
  },
  {
    path: '/how-it-works',
    title: 'How BulkSkart Works — B2B Bulk Trade Made Simple',
    description: 'See how buyers post requirements and suppliers respond on BulkSkart.',
  },
  {
    path: '/blog',
    title: 'B2B Sourcing Guides & Global Trade Insights | BulkSkart Blog',
    description: 'Guides on bulk sourcing, manufacturers, and trade on BulkSkart.',
  },
];

function escapeXml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function urlset(urls) {
  const body = urls.map(url => `  <url><loc>${escapeXml(url)}</loc></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

function applyMeta(html, page) {
  const title = escapeHtml(page.title);
  const description = escapeHtml(page.description);
  const canonical = `${SITE}${page.path === '/' ? '/' : page.path}`;
  let next = html.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);
  next = next.replace(/(<meta name="description" content=")[^"]*(")/, `$1${description}$2`);
  next = next.replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${title}$2`);
  next = next.replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${description}$2`);
  next = next.replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${canonical}$2`);
  next = next.replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${title}$2`);
  next = next.replace(/(<meta name="twitter:description" content=")[^"]*(")/, `$1${description}$2`);
  next = next.replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${canonical}$2`);
  return next;
}

function noSlash(urlPath) {
  if (!urlPath || urlPath === '/') return '/';
  return urlPath.endsWith('/') ? urlPath.slice(0, -1) : urlPath;
}

function injectRouteMeta(html, pages) {
  const routes = {};
  for (const page of pages) {
    routes[noSlash(page.path)] = { title: page.title, description: page.description };
  }
  const payload = JSON.stringify(routes).replace(/</g, '\\u003c');
  const script = `<script id="bsk-route-meta">(function(){var routes=${payload};var path=location.pathname||"/";if(path.length>1&&path.endsWith("/"))path=path.slice(0,-1);var canonical="https://www.bulkskart.com"+(path==="/"?"/":path);function link(rel,attrs){var q='link[rel="'+rel+'"]'+(attrs.hreflang?'[hreflang="'+attrs.hreflang+'"]':'');var el=document.querySelector(q);if(!el){el=document.createElement("link");el.setAttribute("rel",rel);if(attrs.hreflang)el.setAttribute("hreflang",attrs.hreflang);document.head.appendChild(el);}el.setAttribute("href",canonical);}link("canonical",{});link("alternate",{hreflang:"en-IN"});link("alternate",{hreflang:"x-default"});var page=routes[path];if(!page)return;document.title=page.title;function meta(attr,name,content){var q="meta["+attr+"=\\""+name+"\\"]";var el=document.querySelector(q);if(!el){el=document.createElement("meta");el.setAttribute(attr,name);document.head.appendChild(el);}el.setAttribute("content",content);}meta("name","description",page.description);meta("property","og:title",page.title);meta("property","og:description",page.description);meta("property","og:url",canonical);meta("name","twitter:title",page.title);meta("name","twitter:description",page.description);})();</script>`;
  const without = html.replace(/<script id="bsk-route-meta">[\s\S]*?<\/script>\n?/, '');
  return without.replace('</head>', `${script}\n</head>`);
}

/** The category pages, from src/data/categoryCatalog.ts (same wording as categorySeo() in AllCategoriesPage). */
function categoryPages() {
  return readCatalog().map((c) => {
    const seo = categorySeo(c);
    return { path: `/categories/${c.slug}`, title: seo.title, description: seo.description };
  });
}

/** The FAQ and the "… alternative" pages (wording in src/data/seoContent.json). */
function contentPages() {
  const content = readContent();
  return [
    { path: '/faq', title: content.faqPage.title, description: content.faqPage.description },
    ...alternatives(content, readCatalog()).map((page) => ({ path: `/${page.slug}`, title: page.title, description: page.description })),
  ];
}

/** Public landing pages whose title is set by the page itself; listed in the sitemap so they are found. */
const HUB_PATHS = [
  '/b2b-marketplace',
  '/wholesale-suppliers',
  '/bulk-products',
  '/bulk-suppliers',
  '/manufacturers-in-india',
  '/manufacturers-in-tamil-nadu',
  '/manufacturers-in-coimbatore',
  '/manufacturers-in-chennai',
  '/wholesale-suppliers-in-india',
];

// A requirement worth listing: posted by a BulkSkart buyer, still open, not a tender import, demo row or outside link.
const OUTSIDE = /(?:\bgem\.gov\.in\b|\.gov\.in\b|\.nic\.in\b|\beprocure\b|\bcppp\b|\be-?tenders?\b|\bindiamart\b|\btradeindia\b|\bexportersindia\b|\balibaba\.com\b|https?:\/\/|www\.)/i;
function listableRequirement(row, now) {
  const text = [row.title, row.description, row.specifications].filter(Boolean).join(' ');
  if (!row.id || !row.title || !row.buyer_id) return false;
  if (/\b(test|debug|timed|timeout)\b/i.test(row.title) || / - Lot #\d+\s*$/.test(row.title)) return false;
  if (/\bGeM\b/.test(text) || OUTSIDE.test(text) || /seeded for BulkSkart production RFQ feed|^Requirement from India\. Looking for verified manufacturers/i.test(row.description || '')) return false;
  const ends = row.deadline ? new Date(`${String(row.deadline).slice(0, 10)}T23:59:59Z`).getTime() : row.expires_at ? new Date(row.expires_at).getTime() : Infinity;
  return ends > now;
}

async function fetchAll(base, key, table, query) {
  const rows = [];
  const pageSize = 1000;
  for (let from = 0; from < 20000; from += pageSize) {
    const to = from + pageSize - 1;
    const response = await fetch(`${base}/rest/v1/${table}?${query}`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Range: `${from}-${to}`,
        Prefer: 'count=exact',
      },
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`${table} ${response.status} ${detail.slice(0, 180)}`);
    }
    const batch = await response.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }
  return rows;
}

export async function generateSeoAssets(distDir) {
  const indexPath = path.join(distDir, 'index.html');
  if (!fs.existsSync(indexPath)) return;
  const html = fs.readFileSync(indexPath, 'utf8');
  const pages = [...STATIC_PAGES, ...contentPages(), ...categoryPages()];
  const home = pages.find(page => page.path === '/') || STATIC_PAGES[0];
  const shell = injectRouteMeta(applyMeta(html, home), pages);
  fs.writeFileSync(indexPath, shell);

  // real text for crawlers that do not run JavaScript (served by nginx from dist/_seo, see scripts/seo-prerender.mjs)
  const written = writePrerendered(distDir, shell, prerenderPages(readCatalog(), readContent(), STATIC_PAGES));
  console.log(`[seo] pre-rendered ${written.length} pages into dist/_seo`);

  const base = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!base || !key) {
    console.log('[seo] Supabase env missing; kept the existing sitemap and stamped route meta into index.html.');
    return;
  }

  try {
    const [products, requirements, companies] = await Promise.all([
      fetchAll(base, key, 'products', 'select=slug&is_active=eq.true&slug=not.is.null'),
      fetchAll(base, key, 'requirements', 'select=id,title,description,specifications,buyer_id,deadline,expires_at&status=eq.active&buyer_id=not.is.null'),
      fetchAll(base, key, 'companies', 'select=slug&slug=not.is.null'),
    ]);
    const absolute = (urlPath) => {
      const clean = noSlash(urlPath);
      return `${SITE}${clean === '/' ? '/' : clean}`;
    };
    const productUrls = products.map(row => row.slug).filter(Boolean).map(slug => absolute(`/products/${slug}`));
    // the addresses the pages declare as canonical: /requirements/<id>, /companies/<slug>, /categories/<slug>
    const now = Date.now();
    const requirementUrls = requirements.filter(row => listableRequirement(row, now)).map(row => absolute(`/requirements/${row.id}`));
    const companyUrls = companies.map(row => row.slug).filter(Boolean).map(slug => absolute(`/companies/${slug}`));
    const categoryUrls = [absolute('/categories'), ...categoryPages().map(page => absolute(page.path))];
    const unique = list => [...new Set(list)];
    const mainUrls = unique([...STATIC_PAGES, ...contentPages()].map(page => absolute(page.path)).concat(HUB_PATHS.map(absolute)));
    fs.writeFileSync(path.join(distDir, 'sitemap-main.xml'), urlset(mainUrls));
    fs.writeFileSync(path.join(distDir, 'sitemap-products.xml'), urlset(unique(productUrls)));
    fs.writeFileSync(path.join(distDir, 'sitemap-rfqs.xml'), urlset(unique(requirementUrls)));
    fs.writeFileSync(path.join(distDir, 'sitemap-companies.xml'), urlset(unique(companyUrls)));
    fs.writeFileSync(path.join(distDir, 'sitemap-categories.xml'), urlset(unique(categoryUrls)));
    const index = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>${SITE}/sitemap-main.xml</loc></sitemap>
  <sitemap><loc>${SITE}/sitemap-categories.xml</loc></sitemap>
  <sitemap><loc>${SITE}/sitemap-products.xml</loc></sitemap>
  <sitemap><loc>${SITE}/sitemap-companies.xml</loc></sitemap>
  <sitemap><loc>${SITE}/sitemap-rfqs.xml</loc></sitemap>
</sitemapindex>
`;
    fs.writeFileSync(path.join(distDir, 'sitemap.xml'), index);
    console.log(`[seo] sitemap products=${productUrls.length} requirements=${requirementUrls.length} companies=${companyUrls.length} categories=${unique(categoryUrls).length}`);
  } catch (error) {
    console.log(`[seo] sitemap refresh skipped: ${error instanceof Error ? error.message : error}`);
  }
}
