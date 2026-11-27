import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { CATEGORY_CATALOG } from '@/data/categoryCatalog';
import { ALTERNATIVES, BRAND_FAQ, categoryFaq } from '@/lib/seoContent';
import { categorySeo as pageCategorySeo } from '@/pages/AllCategoriesPage';
// @ts-expect-error plain JavaScript build script
import * as pre from '../../scripts/seo-prerender.mjs';

vi.mock('@/components/layouts/MainLayout', () => ({ default: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
const pageMeta = vi.hoisted(() => ({ last: null as null | Record<string, unknown> }));
vi.mock('@/components/common/PageMeta', () => ({
  default: (props: Record<string, unknown>) => {
    pageMeta.last = props;
    return null;
  },
}));

import FaqPage from '@/pages/FaqPage';
import AlternativePage from '@/pages/AlternativePage';

const catalog = pre.readCatalog(process.cwd());
const content = pre.readContent(process.cwd());

describe('SEO: the pre-rendered HTML says exactly what the pages say', () => {
  it('reads every category from the catalogue file', () => {
    expect(catalog).toHaveLength(CATEGORY_CATALOG.length);
    catalog.forEach((c: { slug: string; title: string; subcategories: string[] }, i: number) => {
      expect(c.slug).toBe(CATEGORY_CATALOG[i].slug);
      expect(c.title).toBe(CATEGORY_CATALOG[i].title);
      expect(c.subcategories).toEqual(CATEGORY_CATALOG[i].subcategories.map((s) => s.name));
    });
  });

  it('uses the same title, description, intro and questions as each category page', () => {
    CATEGORY_CATALOG.forEach((c, i) => {
      expect(pre.categorySeo(catalog[i])).toEqual(pageCategorySeo(c));
      expect(pre.categoryFaq(catalog[i], content)).toEqual(categoryFaq(c));
    });
  });

  it('uses the same FAQ and alternative-page wording as the React pages', () => {
    expect(pre.brandFaq(content, catalog)).toEqual(BRAND_FAQ);
    expect(pre.alternatives(content, catalog)).toEqual(ALTERNATIVES);
    expect(JSON.stringify(BRAND_FAQ)).not.toMatch(/\{\w+\}/);
    expect(JSON.stringify(ALTERNATIVES)).not.toMatch(/\{\w+\}/);
  });
});

describe('SEO: pre-rendered pages', () => {
  const pages = pre.prerenderPages(catalog, content, []);
  const shell = `<html><head><title>x</title><meta name="description" content="x" /><meta property="og:title" content="x" /><script id="bsk-route-meta">route()</script></head><body><noscript>
      <main><h1>generic</h1></main>
    </noscript><div id="root"></div></body></html>`;

  it('covers the home page, all categories, every category, the FAQ and each alternative page', () => {
    const paths = pages.map((p: { path: string }) => p.path);
    expect(paths).toContain('/');
    expect(paths).toContain('/categories');
    expect(paths).toContain('/faq');
    for (const c of CATEGORY_CATALOG) expect(paths).toContain(`/categories/${c.slug}`);
    for (const a of ALTERNATIVES) expect(paths).toContain(`/${a.slug}`);
    expect(paths).toContain('/products');
    expect(paths).toContain('/requirements');
    expect(paths).toContain('/suppliers');
    expect(paths).toContain('/manufacturers');
    expect(paths).toHaveLength(1 + 1 + CATEGORY_CATALOG.length + 1 + ALTERNATIVES.length + 8);
  });

  it('puts the meta, one canonical (before the route script) and the structured data in the head, and the text in #root', () => {
    const page = pages.find((p: { path: string }) => p.path === '/categories/apparel-clothing-and-garments');
    const html: string = pre.renderPage(shell, page);
    expect(html).toContain('<title>Apparel, Clothing &amp; Garments — Bulk &amp; Wholesale Suppliers in India | BulkSkart</title>');
    expect(html.match(/rel="canonical"/g)).toHaveLength(1);
    expect(html.indexOf('rel="canonical"')).toBeLessThan(html.indexOf('<script id="bsk-route-meta">'));
    const ld = JSON.parse(html.match(/<script type="application\/ld\+json" id="bulkskart-dynamic-jsonld">([\s\S]*?)<\/script>/)![1]);
    expect(ld.map((o: { '@type': string }) => o['@type'])).toEqual(['BreadcrumbList', 'FAQPage']);
    expect(ld[1].mainEntity).toHaveLength(4);
    expect(html).not.toContain('generic');
    expect(html.match(/<h1>/g)).toHaveLength(1);
    expect(html).toMatch(/<div id="root"><div class="bsk-pre">.*Where can I buy apparel, clothing &amp; garments in bulk\?/s);
  });

  it('escapes text and keeps </script> out of the structured data', () => {
    const html: string = pre.renderPage(shell, { path: '/x', title: 'A <b> & "c"', description: 'd', jsonLd: [{ name: '</script><script>alert(1)</script>' }], body: '' });
    expect(html).toContain('<title>A &lt;b&gt; &amp; &quot;c&quot;</title>');
    expect(html).not.toContain('</script><script>alert(1)');
  });

  it('writes the files under _seo so no folder in dist shadows a route', () => {
    expect(pre.prerenderFile('/d', '/')).toBe('/d/_seo/home.html');
    expect(pre.prerenderFile('/d', '/categories')).toBe('/d/_seo/categories.html');
    expect(pre.prerenderFile('/d', '/categories/x')).toBe('/d/_seo/categories/x.html');
  });

  it('nginx serves them for those addresses and keeps the copies themselves off the web', () => {
    for (const file of ['nginx.conf', 'deploy/bulkskart/stack/frontend/nginx.conf']) {
      const conf = readFileSync(join(process.cwd(), file), 'utf8');
      expect(conf, file).toContain('try_files $uri /_seo$uri.html $uri/ /index.html;');
      expect(conf, file).toContain('try_files /_seo/home.html /index.html;');
      expect(conf, file).toMatch(/location \^~ \/_seo\/ \{\s*internal;\s*\}/);
    }
  });
});

describe('SEO: the FAQ page', () => {
  it('shows every question as a heading with its answer, and marks the same questions up as FAQPage', () => {
    render(
      <MemoryRouter>
        <FaqPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('BulkSkart FAQ');
    for (const item of BRAND_FAQ) expect(screen.getByRole('heading', { level: 2, name: item.q })).toBeInTheDocument();
    expect(pageMeta.last?.faq).toEqual(BRAND_FAQ.map((item) => ({ question: item.q, answer: item.a })));
    expect(pageMeta.last?.canonical).toBe('https://www.bulkskart.com/faq');
    // once in the answer about IndiaMART, once in the list of comparisons
    for (const link of screen.getAllByRole('link', { name: 'BulkSkart as an IndiaMART alternative →' })) expect(link).toHaveAttribute('href', '/indiamart-alternative');
    expect(screen.getByRole('link', { name: 'BulkSkart as a TradeIndia alternative →' })).toHaveAttribute('href', '/tradeindia-alternative');
    expect(screen.getByRole('link', { name: 'BulkSkart as an Alibaba alternative →' })).toHaveAttribute('href', '/alibaba-alternative');
  });
});

describe('SEO: the alternative pages', () => {
  it.each(ALTERNATIVES.map((a) => [a.slug, a]))('%s describes BulkSkart only, with the trademark note', (_slug, page) => {
    render(
      <MemoryRouter>
        <AlternativePage slug={page.slug} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(page.h1);
    expect(screen.getByText(new RegExp(`${page.competitor} is a trademark of its owner`))).toBeInTheDocument();
    for (const item of page.faq) expect(screen.getByRole('heading', { level: 3, name: item.q })).toBeInTheDocument();
    expect(pageMeta.last?.canonical).toBe(`https://www.bulkskart.com/${page.slug}`);
  });

  it('never claims to be the biggest or the best', () => {
    const text = JSON.stringify(content).toLowerCase();
    for (const word of ['#1', 'number one', 'largest', 'biggest', 'best b2b', 'cheapest', 'guarantee']) expect(text).not.toContain(word);
  });
});
