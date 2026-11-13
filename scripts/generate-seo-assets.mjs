/**
 * After `vite build`, stamp route meta into dist/index.html and write a sitemap.
 * Live nginx 301s a no-slash URL when a directory of that name exists, and it does
 * not serve /products from products.html. Shells stay out of dist so /products is
 * the SPA (200, no redirect). A parse-time script applies the matching title,
 * description, and no-slash canonical. Sitemap URLs use that same no-slash form.
 * If Supabase is unreachable, the public sitemap already copied into dist is left in place.
 */
import fs from 'node:fs';
import path from 'node:path';

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
    title: 'B2B Sourcing Guides & Global Trade Insights | Bulkskart Blog',
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
  const script = `<script id="bsk-route-meta">(function(){var routes=${payload};var path=location.pathname||"/";if(path.length>1&&path.endsWith("/"))path=path.slice(0,-1);var page=routes[path];if(!page)return;var canonical="https://www.bulkskart.com"+(path==="/"?"/":path);document.title=page.title;function meta(attr,name,content){var q="meta["+attr+"=\\""+name+"\\"]";var el=document.querySelector(q);if(!el){el=document.createElement("meta");el.setAttribute(attr,name);document.head.appendChild(el);}el.setAttribute("content",content);}meta("name","description",page.description);meta("property","og:title",page.title);meta("property","og:description",page.description);meta("property","og:url",canonical);meta("name","twitter:title",page.title);meta("name","twitter:description",page.description);var link=document.querySelector('link[rel="canonical"]');if(!link){link=document.createElement("link");link.setAttribute("rel","canonical");document.head.appendChild(link);}link.setAttribute("href",canonical);})();</script>`;
  const without = html.replace(/<script id="bsk-route-meta">[\s\S]*?<\/script>\n?/, '');
  return without.replace('</head>', `${script}\n</head>`);
}

function categoryPages() {
  const source = fs.readFileSync(path.resolve('src/pages/CategoriesPage.tsx'), 'utf8');
  const pages = [];
  const pattern = /name: '([^']+)',\s*slug: '([^']+)',\s*description: '([^']+)'/g;
  for (const match of source.matchAll(pattern)) {
    const [, name, slug, description] = match;
    pages.push({
      path: `/category/${slug}`,
      title: `${name} — Wholesale & Bulk Supply | BulkSkart`,
      description,
    });
  }
  return pages;
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
  const pages = [...STATIC_PAGES, ...categoryPages()];
  const home = pages.find(page => page.path === '/') || STATIC_PAGES[0];
  fs.writeFileSync(indexPath, injectRouteMeta(applyMeta(html, home), pages));

  const base = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!base || !key) {
    console.log('[seo] Supabase env missing; kept the existing sitemap and stamped route meta into index.html.');
    return;
  }

  try {
    const [products, requirements, companies, categories] = await Promise.all([
      fetchAll(base, key, 'products', 'select=slug&is_active=eq.true&slug=not.is.null'),
      fetchAll(base, key, 'requirements', 'select=id,title&status=eq.active'),
      fetchAll(base, key, 'companies', 'select=slug&slug=not.is.null'),
      fetchAll(base, key, 'categories', 'select=slug&is_active=eq.true&slug=not.is.null'),
    ]);
    const absolute = (urlPath) => {
      const clean = noSlash(urlPath);
      return `${SITE}${clean === '/' ? '/' : clean}`;
    };
    const productUrls = products.map(row => row.slug).filter(Boolean).map(slug => absolute(`/products/${slug}`));
    const requirementUrls = requirements
      .filter(row => row.id && row.title && !/\b(test|debug|timed|timeout)\b/i.test(row.title))
      .map(row => absolute(`/requirement/${row.id}`));
    const companyUrls = companies.map(row => row.slug).filter(Boolean).map(slug => absolute(`/suppliers/${slug}`));
    const categoryUrls = [
      ...categories.map(row => absolute(`/category/${row.slug}`)),
      ...categoryPages().map(page => absolute(page.path)),
    ];
    const unique = list => [...new Set(list)];
    const mainUrls = STATIC_PAGES.map(page => absolute(page.path));
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
