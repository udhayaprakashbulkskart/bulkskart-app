/** Tag stored on a product when it should show the "Verified product" badge. */
export const VERIFIED_PRODUCT_TAG = 'verified-product';

export function isVerifiedProduct(product: { tags?: string[] | null } | null | undefined): boolean {
  return (product?.tags ?? []).some((tag) => tag.toLowerCase() === VERIFIED_PRODUCT_TAG);
}

/** Tags shown as chips — the verified flag is a badge, not a chip. */
export function visibleProductTags(tags?: string[] | null): string[] {
  return (tags ?? []).filter((tag) => tag.toLowerCase() !== VERIFIED_PRODUCT_TAG);
}
