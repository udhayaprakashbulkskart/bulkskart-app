/**
 * Photo credit for product images that came from openly licensed sources.
 *
 * Credits are stored in public.product_image_sources. That table is not in the
 * production schema (migration 00062 is not applied; this release must not
 * change the database). Querying it 404s on every product page, so this
 * renders nothing. Catalog photos under product-images/catalog/ still display;
 * they are supplier/catalog files and do not need this credit line.
 */
export default function ProductImageCredit(_props: { productId: string; imageUrl?: string }) {
  return null;
}
