/**
 * Search content shared by the pages and the build's pre-rendered HTML (scripts/generate-seo-assets.mjs reads the same
 * src/data/seoContent.json): the BulkSkart FAQ, the "… alternative" pages and the questions on every category page.
 * Every answer states only what BulkSkart itself does; other platforms are named, never described.
 */
import content from '@/data/seoContent.json';
import { CATEGORY_CATALOG, type CatalogCategory } from '@/data/categoryCatalog';

export interface SeoLink {
  label: string;
  href: string;
}
export interface SeoQuestion {
  q: string;
  a: string;
  links?: SeoLink[];
}
export interface AlternativePageContent {
  slug: string;
  competitor: string;
  title: string;
  description: string;
  h1: string;
  intro: string;
  points: string[];
  faq: SeoQuestion[];
}

const SUBCATEGORY_COUNT = CATEGORY_CATALOG.reduce((n, c) => n + c.subcategories.length, 0);

/** {placeholders} → values; unknown ones are left as they are */
export function fill(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (whole, key: string) => (key in vars ? String(vars[key]) : whole));
}

const siteVars: Record<string, string | number> = {
  categoryCount: CATEGORY_CATALOG.length,
  subcategoryCount: SUBCATEGORY_COUNT,
};

export const FAQ_PAGE: { title: string; description: string } = content.faqPage;

export const BRAND_FAQ: SeoQuestion[] = (content.brandFaq as SeoQuestion[]).map((item) => ({ ...item, a: fill(item.a, siteVars) }));

export const ALTERNATIVES: AlternativePageContent[] = (content.alternatives as AlternativePageContent[]).map((page) => ({
  ...page,
  points: page.points.map((p) => fill(p, siteVars)),
}));

export const ALTERNATIVE_CHECKLIST: string[] = content.alternativeChecklist;

export function alternativeBySlug(slug: string): AlternativePageContent | null {
  return ALTERNATIVES.find((page) => page.slug === slug) ?? null;
}

/** The questions answered on one category's page (and in its FAQPage data). */
export function categoryFaq(category: CatalogCategory): SeoQuestion[] {
  const vars = {
    lower: category.title.toLowerCase(),
    count: category.subcategories.length,
    examples: category.subcategories
      .slice(0, 4)
      .map((s) => s.name)
      .join(', '),
  };
  return (content.categoryFaq as SeoQuestion[]).map((item) => ({ q: fill(item.q, vars), a: fill(item.a, vars) }));
}
