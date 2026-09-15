import { useSyncExternalStore } from 'react';

/** Below this width the long section rails collapse into one compact section selector. */
export const COMPACT_NAV_QUERY = '(max-width: 720px)';

/**
 * Subscribe to a CSS media query. Returns `false` where `matchMedia` is unavailable (jsdom), so
 * server/test renders keep the wide layout.
 *
 * @param query - e.g. `(max-width: 720px)`.
 * @returns Whether the query currently matches.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () =>
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia(query).matches
        : false,
    () => false
  );
}
