/**
 * Browser-stored lists that belong to one person (a half-written requirement, saved products,
 * favourite manufacturers). They are kept in this browser only, so when a different person signs in
 * or signs up here, the previous person's lists are cleared instead of showing up in the new account.
 * Someone who saved things before creating their account keeps them.
 */

export const USER_SCOPED_KEYS = ['bulkskart_rfq_draft', 'bulkskart_product_wishlist', 'bulkskart_fav_mfg', 'bulkskart_saved_rfqs'] as const;
export const LAST_USER_KEY = 'bulkskart_last_user';

export function claimBrowserStorageFor(userId: string | null | undefined): void {
  if (!userId) return;
  try {
    const last = localStorage.getItem(LAST_USER_KEY);
    if (last && last !== userId) {
      for (const key of USER_SCOPED_KEYS) localStorage.removeItem(key);
    }
    localStorage.setItem(LAST_USER_KEY, userId);
  } catch {
    /* storage unavailable (private mode): nothing is kept, so nothing can leak */
  }
}
