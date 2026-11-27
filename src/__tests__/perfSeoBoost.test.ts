import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('performance: heavy catalogues stay off the home teaser', () => {
  it('does not load the 1.8MB Alibaba dataset for the home supplier row', () => {
    const home = src('src/components/home/VerifiedSuppliersSection.tsx');
    const api = src('src/lib/api.ts');
    expect(home).toContain('includeStaticCatalog: false');
    expect(api).toContain('includeStaticCatalog');
    expect(api).toContain('options?.includeStaticCatalog !== false');
    expect(src('src/pages/SEOHubPage.tsx')).toContain('includeStaticCatalog: false');
  });

  it('does not download 5,000 company rows just to count them, and the RFQ alert selects only the fields it shows', () => {
    const stats = src('src/lib/liveStats.ts');
    expect(stats).toContain("select('id', { count: 'exact', head: true })");
    expect(stats).not.toContain('limit(5000)');
    const alert = src('src/components/common/RfqTopAlert.tsx');
    expect(alert).toContain('id,title,description,specifications,quantity,quantity_unit,budget_min,budget_max,currency,created_at,source_type');
    expect(alert).not.toMatch(/const SELECT = '\*'/);
  });

  it('keeps similar-product padding off the 2.8MB global catalogue', () => {
    const api = src('src/lib/api.ts');
    const start = api.indexOf('export async function getSimilarProducts');
    const fn = api.slice(start, start + 900);
    expect(fn).not.toContain('loadGlobalCatalog');
  });
});

describe('SEO: brand, hreflang and social URLs', () => {
  it('puts BulkSkart in the visible home H1, titles already include it, and adds hreflang en', () => {
    expect(src('src/components/home/LandingHero.tsx')).toContain("title: 'BulkSkart — The Global B2B Marketplace for'");
    const meta = src('src/components/common/PageMeta.tsx');
    expect(meta).toContain("hreflang: 'en'");
    expect(meta).toContain("hreflang: 'en-IN'");
    expect(meta).toContain("hreflang: 'x-default'");
    expect(src('scripts/seo-prerender.mjs')).toContain('hreflang="en"');
  });

  it('lists only social profiles that exist in Organization JSON-LD sameAs', () => {
    const html = src('index.html');
    expect(html).toContain('https://www.linkedin.com/company/bulkskart');
    expect(html).toContain('https://www.instagram.com/bulkskart/');
    expect(html).not.toContain('https://twitter.com/bulkskart');
    expect(html).not.toContain('https://youtube.com/@bulkskart');
    expect(html).toContain('"name": "BulkSkart"');
    expect(html).toContain('"@type": "SearchAction"');
  });
});
