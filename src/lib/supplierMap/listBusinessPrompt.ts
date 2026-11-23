/**
 * The "List your business" invitation on the supplier map: shown to visitors who are not signed in, once they have
 * searched, at most once per visit, and not again for a while after they answer.
 */

/** The one-page "Register your factory" signup; it ends on the map listing page. */
export const LIST_BUSINESS_SIGNUP_HREF = '/register-factory';
export const MAP_LISTING_HREF = '/dashboard/supplier/map-listing';

/** Where "List your business" goes for this visitor; null for signed-in buyers and admins, who are not the audience. */
export function listBusinessHref(role: string | null | undefined, signedIn: boolean): string | null {
  if (!signedIn) return LIST_BUSINESS_SIGNUP_HREF;
  return role === 'supplier' ? MAP_LISTING_HREF : null;
}

const UNTIL_KEY = 'bs_list_business_prompt_until';
const SEEN_THIS_VISIT_KEY = 'bs_list_business_prompt_seen';
const DAY = 86_400_000;

/** How long each answer keeps the popup away. */
export const SNOOZE_DAYS = { later: 3, buyer: 90, listing: 30 } as const;
export type PromptAnswer = keyof typeof SNOOZE_DAYS;

type Store = Pick<Storage, 'getItem' | 'setItem'>;
const safe = <T>(fn: () => T, fallback: T): T => {
  try {
    return fn();
  } catch {
    return fallback;
  }
};
const local = (): Store | null => safe(() => window.localStorage, null);
const session = (): Store | null => safe(() => window.sessionStorage, null);

export function shouldOfferListing(opts: {
  signedIn: boolean;
  authLoading: boolean;
  searched: boolean;
  now?: number;
  store?: Store | null;
  visit?: Store | null;
}): boolean {
  if (opts.signedIn || opts.authLoading || !opts.searched) return false;
  const now = opts.now ?? Date.now();
  const store = opts.store === undefined ? local() : opts.store;
  const visit = opts.visit === undefined ? session() : opts.visit;
  const until = Number(safe(() => store?.getItem(UNTIL_KEY), null) || 0);
  if (until > now) return false;
  return safe(() => visit?.getItem(SEEN_THIS_VISIT_KEY), null) !== '1';
}

export function markListingOffered(visit: Store | null = session()): void {
  safe(() => visit?.setItem(SEEN_THIS_VISIT_KEY, '1'), undefined);
}

export function answerListingPrompt(answer: PromptAnswer, now = Date.now(), store: Store | null = local()): void {
  safe(() => store?.setItem(UNTIL_KEY, String(now + SNOOZE_DAYS[answer] * DAY)), undefined);
}
