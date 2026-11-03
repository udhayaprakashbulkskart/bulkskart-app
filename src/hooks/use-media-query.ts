import { useSyncExternalStore } from 'react';

/**
 * True while the CSS media query matches. The first render already has the right answer
 * (no flash of the wrong layout), and it follows window resizes and rotation.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Phones and small tablets in portrait: the layout the mobile home screen is built for. */
export const MOBILE_QUERY = '(max-width: 767.98px)';
