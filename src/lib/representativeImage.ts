/**
 * A photo of the same kind of product, taken from BulkSkart's category pictures (src/data/categoryCatalog.ts),
 * for a requirement that has no picture of its own. Kept apart from publicListings.ts so the catalogue
 * only loads where a picture is drawn.
 */
import { CATEGORY_CATALOG } from '@/data/categoryCatalog';

const STOP = new Set(['and', 'for', 'the', 'with', 'other', 'all', 'type', 'use', 'new', 'used', 'products', 'product', 'supplies', 'services', 'service', 'parts', 'equipment', 'equipments', 'machine', 'machines', 'industrial']);

function words(text: string): string[] {
  return (text.toLowerCase().match(/[a-z]{3,}/g) ?? [])
    .map((w) => (w.length > 4 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w))
    .filter((w) => !STOP.has(w));
}

let index: { img: string; name: string; words: Set<string> }[] | null = null;

/**
 * A photo of the same kind of product from BulkSkart's category pictures, for a requirement that has none of its own.
 * Shown with a "Representative image" caption; null when no category picture is a clear match.
 */
export function representativeImage(title: string, category?: string | null): { src: string; name: string } | null {
  index ??= CATEGORY_CATALOG.flatMap((c) => c.subcategories.map((s) => ({ img: s.img, name: s.name, words: new Set(words(s.name)) })));
  const fromCategory = words(category ?? '');
  const fromTitle = words(title);
  let best: { src: string; name: string } | null = null;
  let bestScore = 0;
  for (const s of index) {
    // the listed product category counts most; words from the product name break ties
    const score = fromCategory.filter((w) => s.words.has(w)).length * 3 + fromTitle.filter((w) => s.words.has(w)).length;
    if (score > bestScore) {
      bestScore = score;
      best = { src: s.img, name: s.name };
    }
  }
  return bestScore >= 3 ? best : null;
}
