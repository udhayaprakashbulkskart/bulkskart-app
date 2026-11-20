/** Shrink Unsplash/CDN payloads for card pictures (a 560 x 350 WebP is about 35-60KB instead of 300KB+). */
export function optimizeCatalogUrl(url: string, width = 560, height = 350): string {
  if (!url) return url;
  if (url.includes('images.unsplash.com')) {
    try {
      const u = new URL(url);
      u.searchParams.set('auto', 'format');
      u.searchParams.set('fit', 'crop');
      u.searchParams.set('w', String(width));
      u.searchParams.set('h', String(height));
      u.searchParams.set('q', '70');
      u.searchParams.set('fm', 'webp');
      return u.toString();
    } catch {
      return url;
    }
  }
  return url;
}
