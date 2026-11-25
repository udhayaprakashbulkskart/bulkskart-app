/**
 * Pre-rendered HTML for the pages search engines matter most for: the home page, all categories, each category, the
 * FAQ and the "… alternative" pages. Each file is dist/index.html with that page's title, description, canonical,
 * structured data and real text (H1, intro, links, questions and answers) inside #root. React replaces that text when
 * it starts, so people see the normal app; crawlers that do not run JavaScript (Bing often, social previews, AI answer
 * engines) read the content instead of an empty shell.
 *
 * Files go to dist/_seo/ so no folder in dist/ shadows a route (nginx would 301 /categories to /categories/ and then
 * 403). nginx serves them with: location = / → /_seo/home.html; location / → try_files $uri /_seo$uri.html $uri/ /index.html.
 * Until nginx has that line the files are simply unused.
 *
 * The wording comes from the same sources as the React pages: src/data/categoryCatalog.ts, src/data/seoContent.json,
 * and categorySeo() in AllCategoriesPage (mirrored here; a test checks they stay the same).
 */
import fs from 'node:fs';
import path from 'node:path';

export const SITE = 'https://www.bulkskart.com';

/* ── data ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

/** The categories as written in src/data/categoryCatalog.ts (a generated file with one fixed shape). */
export function readCatalog(root = process.cwd()) {
  const source = fs.readFileSync(path.resolve(root, 'src/data/categoryCatalog.ts'), 'utf8');
  return source
    .split(/\n\s*slug: "/)
    .slice(1)
    .map((block) => ({
      slug: block.slice(0, block.indexOf('"')),
      title: (block.match(/title: "([^"]+)"/) || [])[1] || '',
      subtitle: (block.match(/subtitle: "([^"]+)"/) || [])[1] || '',
      banner: (block.match(/banner: "([^"]+)"/) || [])[1] || '',
      subcategories: [...block.matchAll(/\{ name: "([^"]+)"/g)].map((m) => m[1]),
    }));
}

export function readContent(root = process.cwd()) {
  return JSON.parse(fs.readFileSync(path.resolve(root, 'src/data/seoContent.json'), 'utf8'));
}

export function fill(text, vars) {
  return text.replace(/\{(\w+)\}/g, (whole, key) => (key in vars ? String(vars[key]) : whole));
}

function siteVars(catalog) {
  return { categoryCount: catalog.length, subcategoryCount: catalog.reduce((n, c) => n + c.subcategories.length, 0) };
}

/** Same as categorySeo() in src/pages/AllCategoriesPage.tsx. */
export function categorySeo(c) {
  const examples = c.subcategories.slice(0, 6);
  const lower = c.title.toLowerCase();
  return {
    title: `${c.title} — Bulk & Wholesale Suppliers in India | BulkSkart`,
    description: `Buy ${lower} in bulk from manufacturers and wholesale suppliers in India: ${examples.slice(0, 4).join(', ')} and more. Compare quotes or post a free RFQ on BulkSkart.`,
    intro: `Source ${lower} in bulk on BulkSkart. ${c.subcategories.length} subcategories, including ${examples.join(', ')}. Compare manufacturers and wholesale suppliers, ask for quotations, or post a free buying requirement (RFQ) and let suppliers come to you.`,
  };
}

/** Same as categoryFaq() in src/lib/seoContent.ts. */
export function categoryFaq(c, content) {
  const vars = { lower: c.title.toLowerCase(), count: c.subcategories.length, examples: c.subcategories.slice(0, 4).join(', ') };
  return content.categoryFaq.map((item) => ({ q: fill(item.q, vars), a: fill(item.a, vars) }));
}

export function brandFaq(content, catalog) {
  const vars = siteVars(catalog);
  return content.brandFaq.map((item) => ({ ...item, a: fill(item.a, vars) }));
}

export function alternatives(content, catalog) {
  const vars = siteVars(catalog);
  return content.alternatives.map((page) => ({ ...page, points: page.points.map((p) => fill(p, vars)) }));
}

/* ── structured data (the same shapes PageMeta writes) ─────────────────────────────────────────────────────────── */

const abs = (p) => (p.startsWith('http') ? p : `${SITE}${p}`);

function breadcrumbLd(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item: abs(item) })),
  };
}

function faqLd(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({ '@type': 'Question', name: item.q, acceptedAnswer: { '@type': 'Answer', text: item.a } })),
  };
}

function itemListLd(catalog) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'BulkSkart product categories',
    numberOfItems: catalog.length,
    itemListElement: catalog.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.title, url: `${SITE}/categories/${c.slug}` })),
  };
}

/* ── page text ─────────────────────────────────────────────────────────────────────────────────────────────────── */

export function esc(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const a = (href, text) => `<a href="${esc(href)}">${esc(text)}</a>`;
const crumbs = (items) =>
  `<nav aria-label="Breadcrumb">${items.map(([name, href], i) => (i === items.length - 1 ? `<span>${esc(name)}</span>` : `${a(href, name)} › `)).join('')}</nav>`;
const faqHtml = (items, level = 'h2') =>
  items
    .map(
      (item) =>
        `<section><${level}>${esc(item.q)}</${level}><p>${esc(item.a)}</p>${
          item.links && item.links.length ? `<p>${item.links.map((l) => a(l.href, `${l.label} →`)).join(' · ')}</p>` : ''
        }</section>`,
    )
    .join('');
const footerNav = () =>
  `<nav aria-label="BulkSkart">${[
    ['/', 'Home'],
    ['/categories', 'All categories'],
    ['/products', 'Products'],
    ['/manufacturers', 'Manufacturers'],
    ['/requirements', 'Buying requirements'],
    ['/post-requirement', 'Post a free requirement'],
    ['/pricing', 'Supplier plans'],
    ['/faq', 'FAQ'],
    ['/about', 'About'],
    ['/contact', 'Contact'],
  ]
    .map(([href, text]) => a(href, text))
    .join(' · ')}</nav>`;

/** Every pre-rendered page: path, meta, structured data and the HTML that goes inside #root. */
export function prerenderPages(catalog, content, staticPages = []) {
  const home = staticPages.find((p) => p.path === '/') || {
    title: 'BulkSkart | B2B Wholesale Marketplace & Bulk Suppliers in India',
    description: 'Find verified manufacturers and wholesale suppliers in India. Compare bulk prices, post free RFQs, and source factory-direct products on BulkSkart.',
  };
  const subTotal = catalog.reduce((n, c) => n + c.subcategories.length, 0);
  const pages = [];

  pages.push({
    path: '/',
    title: home.title,
    description: home.description,
    jsonLd: [],
    body:
      `<h1>BulkSkart — B2B wholesale marketplace and bulk suppliers in India</h1>` +
      `<p>${esc(home.description)}</p>` +
      `<p>${a('/post-requirement', 'Post a free buying requirement (RFQ)')} · ${a('/auth?tab=supplier', 'Sell on BulkSkart')}</p>` +
      `<h2>Shop by category</h2><ul>${catalog.map((c) => `<li>${a(`/categories/${c.slug}`, c.title)}</li>`).join('')}</ul>` +
      footerNav(),
  });

  const hubTitle = 'All Categories | Bulk Products, Suppliers & Services | BulkSkart';
  pages.push({
    path: '/categories',
    title: hubTitle,
    description: `Browse all ${catalog.length} BulkSkart categories and ${subTotal} subcategories: electronics, industrial supplies, construction, apparel, FMCG, medical, packaging, chemicals, services and more.`,
    jsonLd: [breadcrumbLd([['Home', '/'], ['Categories', '/categories']]), itemListLd(catalog)],
    body:
      crumbs([['Home', '/'], ['Categories', '/categories']]) +
      `<h1>All Categories</h1><p>${catalog.length} categories · ${subTotal} subcategories of bulk products and services</p>` +
      `<ul>${catalog
        .map((c) => `<li>${a(`/categories/${c.slug}`, c.title)} — ${esc(c.subtitle)} (${c.subcategories.length} subcategories)</li>`)
        .join('')}</ul>` +
      footerNav(),
  });

  for (const c of catalog) {
    const seo = categorySeo(c);
    const faq = categoryFaq(c, content);
    const trail = [['Home', '/'], ['Categories', '/categories'], [c.title, `/categories/${c.slug}`]];
    const others = catalog.filter((x) => x.slug !== c.slug).slice(0, 12);
    pages.push({
      path: `/categories/${c.slug}`,
      title: seo.title,
      description: seo.description,
      image: c.banner ? `${SITE}${c.banner}` : undefined,
      jsonLd: [breadcrumbLd(trail), faqLd(faq)],
      body:
        crumbs(trail) +
        `<h1>Bulk ${esc(c.title)} <span>Wholesale suppliers &amp; manufacturers in India</span></h1>` +
        `<p>${esc(seo.intro)}</p>` +
        `<h2>${esc(c.title)}: subcategories</h2><ul>${c.subcategories.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>` +
        `<p>${a('/post-requirement', 'Need a specific product? Post your requirement (RFQ) and get quotes')}</p>` +
        `<h2>${esc(c.title)}: frequently asked questions</h2>${faqHtml(faq, 'h3')}` +
        `<h2>More categories</h2><ul>${others.map((o) => `<li>${a(`/categories/${o.slug}`, o.title)}</li>`).join('')}</ul>` +
        `<p>${a('/categories', `Browse all ${catalog.length} categories`)}</p>` +
        footerNav(),
    });
  }

  const faq = brandFaq(content, catalog);
  const alts = alternatives(content, catalog);
  pages.push({
    path: '/faq',
    title: content.faqPage.title,
    description: content.faqPage.description,
    jsonLd: [breadcrumbLd([['Home', '/'], ['FAQ', '/faq']]), faqLd(faq)],
    body:
      crumbs([['Home', '/'], ['FAQ', '/faq']]) +
      `<h1>BulkSkart FAQ</h1><p>What buyers and manufacturers most often ask about BulkSkart, the B2B wholesale marketplace.</p>` +
      faqHtml(faq) +
      `<h2>Comparing B2B marketplaces?</h2><ul>${alts.map((p) => `<li>${a(`/${p.slug}`, `BulkSkart as ${/^[aeiou]/i.test(p.competitor) ? 'an' : 'a'} ${p.competitor} alternative`)}</li>`).join('')}</ul>` +
      footerNav(),
  });

  for (const page of alts) {
    const trail = [['Home', '/'], [`${page.competitor} alternative`, `/${page.slug}`]];
    pages.push({
      path: `/${page.slug}`,
      title: page.title,
      description: page.description,
      jsonLd: [breadcrumbLd(trail), faqLd(page.faq)],
      body:
        crumbs(trail) +
        `<h1>${esc(page.h1)}</h1><p>${esc(page.intro)}</p>` +
        `<h2>What you get on BulkSkart</h2><ul>${page.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` +
        `<p>${a('/post-requirement', 'Post a free requirement')} · ${a('/auth?tab=supplier', 'Sell on BulkSkart')}</p>` +
        `<h2>Questions to ask any B2B marketplace</h2><ul>${content.alternativeChecklist.map((q) => `<li>${esc(q)}</li>`).join('')}</ul>` +
        `<h2>Frequently asked questions</h2>${faqHtml(page.faq, 'h3')}` +
        `<p>${a('/faq', 'More answers on the BulkSkart FAQ')}</p>` +
        `<p><small>${esc(page.competitor)} is a trademark of its owner. BulkSkart is not affiliated with, endorsed by or sponsored by ${esc(page.competitor)}. Details of other platforms change; check their own websites.</small></p>` +
        footerNav(),
    });
  }
  return pages;
}

/* ── files ─────────────────────────────────────────────────────────────────────────────────────────────────────── */

const PRE_STYLE =
  '<style id="bsk-pre-style">.bsk-pre{max-width:880px;margin:0 auto;padding:20px 16px 48px;font-family:Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;font-size:15px;line-height:1.6}' +
  '.bsk-pre h1{font-size:28px;line-height:1.2;margin:10px 0}.bsk-pre h1 span{display:block;font-size:17px;color:#FF5A00}.bsk-pre h2{font-size:19px;margin:26px 0 8px}' +
  '.bsk-pre h3{font-size:15.5px;margin:16px 0 4px}.bsk-pre a{color:#FF5A00}.bsk-pre ul{padding-left:20px}.bsk-pre nav{margin:14px 0;font-size:13px}</style>';

/** dist/index.html turned into one page's HTML. */
export function renderPage(baseHtml, page) {
  const title = esc(page.title);
  const description = esc(page.description);
  const canonical = `${SITE}${page.path === '/' ? '/' : page.path}`;
  let html = baseHtml
    .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/, `$1${description}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${title}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${description}$2`)
    .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${canonical}$2`)
    .replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${title}$2`)
    .replace(/(<meta name="twitter:description" content=")[^"]*(")/, `$1${description}$2`);
  if (page.image) {
    html = html
      .replace(/(<meta property="og:image" content=")[^"]*(")/, `$1${esc(page.image)}$2`)
      .replace(/(<meta name="twitter:image" content=")[^"]*(")/, `$1${esc(page.image)}$2`);
  }
  const head = [
    `<link rel="canonical" href="${canonical}" />`,
    `<link rel="alternate" hreflang="en-IN" href="${canonical}" />`,
    `<link rel="alternate" hreflang="x-default" href="${canonical}" />`,
    // the same id PageMeta uses, so the app overwrites this one instead of adding a second copy
    page.jsonLd.length
      ? `<script type="application/ld+json" id="bulkskart-dynamic-jsonld">${JSON.stringify(page.jsonLd.length === 1 ? page.jsonLd[0] : page.jsonLd).replace(/</g, '\\u003c')}</script>`
      : '',
    PRE_STYLE,
  ].join('\n');
  // before the route script in the shell: it adds a canonical link when it finds none, and it runs as soon as it is parsed
  html = html.includes('<script id="bsk-route-meta">')
    ? html.replace('<script id="bsk-route-meta">', `${head}\n<script id="bsk-route-meta">`)
    : html.replace('</head>', `${head}\n</head>`);
  // the generic no-JavaScript block would be a second, unrelated H1 next to the page's own text
  html = html.replace(/<noscript>\s*<main>[\s\S]*?<\/main>\s*<\/noscript>\s*/, '');
  return html.replace('<div id="root"></div>', `<div id="root"><div class="bsk-pre">${page.body}</div></div>`);
}

export function prerenderFile(distDir, urlPath) {
  return urlPath === '/' ? path.join(distDir, '_seo', 'home.html') : path.join(distDir, '_seo', `${urlPath.replace(/^\//, '')}.html`);
}

/** Writes dist/_seo/…; returns the paths written. */
export function writePrerendered(distDir, baseHtml, pages) {
  fs.rmSync(path.join(distDir, '_seo'), { recursive: true, force: true });
  const written = [];
  for (const page of pages) {
    const file = prerenderFile(distDir, page.path);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, renderPage(baseHtml, page));
    written.push(page.path);
  }
  return written;
}
