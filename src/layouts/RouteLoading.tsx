/**
 * RouteLoading — the single Suspense fallback shown while a route's code chunk downloads.
 *
 * Route components are `React.lazy()` (see AppLayout), so navigating to a screen whose chunk is not
 * yet cached leaves the outlet empty for one network round-trip. This placeholder fills that gap and
 * ANNOUNCES it: `role="status"` is a polite live region, so a screen-reader user hears "Loading…"
 * instead of silence. It is deliberately tiny — it must ship in the eager shell chunk, so it pulls in
 * no page code and no dependencies beyond its own token-driven stylesheet.
 *
 * @module layouts/RouteLoading
 */

import styles from './RouteLoading.module.css';

/**
 * Accessible placeholder for a pending route chunk.
 *
 * @returns The loading region.
 */
export function RouteLoading() {
  return (
    <div className={styles.routeLoading} role="status">
      Loading…
    </div>
  );
}

export default RouteLoading;
