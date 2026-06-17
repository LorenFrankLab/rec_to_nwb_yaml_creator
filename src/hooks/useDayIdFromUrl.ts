import { useState, useEffect } from 'react';

/**
 * Parse the day id from a hash like `#/day/remy-2023-06-22`, or null when the hash is not a day route.
 *
 * @param hash - The location hash (e.g. `window.location.hash`).
 * @returns The decoded day id, or null.
 */
function parseDayIdFromHash(hash: string): string | null {
  // Capture everything up to a `?` so a repair deep-link query (`#/day/:id?field=…`) is not absorbed
  // into the id. Day ids never contain `?`; they may contain `/` (legacy composite ids), which `[^?]`
  // preserves.
  const match = hash.match(/#\/day\/([^?]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Parses day ID from URL hash: #/day/remy-2023-06-22
 *
 * The state is initialized SYNCHRONOUSLY from the current hash (a lazy initializer), not null-then-
 * effect. A null first render would make the Day Editor briefly render its "no day id" error state on
 * a direct `#/day/A` → `#/day/B` remount — and that error state has no `#main-content`, so
 * AppLayout's one-shot route-change focus (which targets `#main-content` on the next animation frame)
 * would find nothing and silently no-op, stranding keyboard/SR focus and the route announcement on the
 * prior day. Resolving the id on the first render keeps `#main-content` present when that focus fires.
 *
 * @returns Day ID or null if not found
 *
 * @example
 * // URL: #/day/remy-2023-06-22
 * const dayId = useDayIdFromUrl(); // "remy-2023-06-22"
 *
 * @example
 * // URL: #/workspace
 * const dayId = useDayIdFromUrl(); // null
 */
export function useDayIdFromUrl(): string | null {
  const [dayId, setDayId] = useState<string | null>(() =>
    typeof window === 'undefined' ? null : parseDayIdFromHash(window.location.hash)
  );

  useEffect(() => {
    const syncDayId = () => setDayId(parseDayIdFromHash(window.location.hash));

    // Re-sync on mount in case the hash changed between the lazy initializer and the effect attach.
    syncDayId();

    // Listen for hash changes
    window.addEventListener('hashchange', syncDayId);

    // Cleanup listener on unmount
    return () => window.removeEventListener('hashchange', syncDayId);
  }, []);

  return dayId;
}
