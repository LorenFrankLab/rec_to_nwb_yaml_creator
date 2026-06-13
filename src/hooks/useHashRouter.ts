/**
 * Custom hook for hash-based routing
 *
 * Provides lightweight routing for M2 - AppLayout component.
 * Uses window.location.hash to determine current view without external dependencies.
 *
 * @module hooks/useHashRouter
 */

import { useState, useEffect } from 'react';

/**
 * Canonical tab keys for the tabbed animal view (Phase 1 — tabbed-workspace-ia).
 * `days` is the default. Order is the section-nav display order. Any other `:tab`
 * segment normalizes to `days` (redirect-to-days).
 *
 * @type {string[]}
 */
export const ANIMAL_VIEW_TABS = [
  'days',
  'export',
  'electrode-groups',
  'recording-system',
  'cameras',
  'task-types',
  'optogenetics',
];

/**
 * The default tab for the animal view when none (or an unknown one) is given.
 * @type {string}
 */
export const DEFAULT_ANIMAL_VIEW_TAB = 'days';

/** Parsed route information. */
export interface RouteInfo {
  /** Current view name. */
  view: 'home' | 'workspace' | 'day' | 'validation' | 'animal-view' | 'legacy';
  /** Route parameters (e.g., `{id: '123'}` or `{animalId, tab}`). */
  params: Record<string, string>;
  /** True if route was not recognized. */
  isUnknownRoute?: boolean;
}

/**
 * Parse hash string into route object
 *
 * Pure function that converts window.location.hash into structured route information.
 * Moved outside component to ensure stable reference and prevent re-render issues.
 *
 * @param [hash=window.location.hash] - Hash string to parse (e.g., "#/workspace")
 * @returns Parsed route information
 *
 * @example
 * parseHashRoute('#/day/123')
 * // Returns: { view: 'day', params: { id: '123' } }
 *
 * @example
 * parseHashRoute('#/')
 * // Returns: { view: 'legacy', params: {} }
 */
export function parseHashRoute(
  hash: string = typeof window !== 'undefined' ? window.location.hash : ''
): RouteInfo {
  // Guard for SSR/testing environments
  if (typeof window === 'undefined') {
    return { view: 'legacy', params: {} };
  }

  // Remove leading # and normalize
  const cleanHash = hash.slice(1) || '';

  // Empty hash -> legacy form (default)
  if (!cleanHash || cleanHash === '/') {
    return { view: 'legacy', params: {} };
  }

  // Strip query parameters for route matching
  // e.g., "/workspace?animal=bean" -> "/workspace"
  const pathWithoutQuery = cleanHash.split('?')[0];

  // Exact matches (without query parameters)
  if (pathWithoutQuery === '/home') {
    return { view: 'home', params: {} };
  }

  if (pathWithoutQuery === '/workspace') {
    return { view: 'workspace', params: {} };
  }

  if (pathWithoutQuery === '/validation') {
    return { view: 'validation', params: {} };
  }

  // Pattern match for the tabbed animal view (Phase 1 — tabbed-workspace-ia):
  // /animal/:id/:tab and the bare /animal/:id (which defaults to the `days` tab).
  // An unknown/unsupported tab normalizes to `days` (redirect-to-days). The legacy stepper route
  // `/animal/:id/editor` was removed in Phase 5; `editor` is not in ANIMAL_VIEW_TABS, so a stale
  // `/editor` bookmark now resolves here to the `days` tab (a graceful redirect, no dead route).
  const animalTabMatch = pathWithoutQuery.match(/^\/animal\/([^/]+)\/([^/]+)$/);
  const animalNoTabMatch = pathWithoutQuery.match(/^\/animal\/([^/]+)$/);
  if (animalTabMatch || animalNoTabMatch) {
    // Decode the route param like the day route's useDayIdFromUrl, so a %-encoded id round-trips to
    // its real store key — but ALSO guard a malformed percent-sequence (keep the raw segment), which
    // the day route does not. (Imported animal ids are gated to a route-safe charset, so this decode
    // is belt-and-suspenders.)
    // One of the two matched (the enclosing `if` guarantees it).
    let animalId = (animalTabMatch || animalNoTabMatch)![1];
    try {
      animalId = decodeURIComponent(animalId);
    } catch {
      // Malformed percent-encoding — keep the raw segment.
    }

    // Validate ID is not empty or whitespace
    if (!animalId || animalId.trim() === '') {
      console.warn('Invalid animal ID in route:', cleanHash);
      return { view: 'legacy', params: {} };
    }

    const rawTab = animalTabMatch ? animalTabMatch[2] : 'days';
    const tab = ANIMAL_VIEW_TABS.includes(rawTab) ? rawTab : 'days';
    return { view: 'animal-view', params: { animalId, tab } };
  }

  // Pattern match for /day/:id (without query parameters)
  const dayMatch = pathWithoutQuery.match(/^\/day\/([^/]+)$/);
  if (dayMatch) {
    const id = dayMatch[1];

    // Validate ID is not empty or whitespace
    if (!id || id.trim() === '') {
      console.warn('Invalid day ID in route:', cleanHash);
      return { view: 'legacy', params: {} };
    }

    return { view: 'day', params: { id } };
  }

  // Unknown route - fallback to legacy with warning
  console.warn('Unknown route:', cleanHash);
  return { view: 'legacy', params: {}, isUnknownRoute: true };
}

/**
 * Hook for hash-based routing
 *
 * Manages current route state and listens for hash changes.
 * Automatically updates when user navigates via browser back/forward or clicks links.
 *
 * @returns Current route information
 *
 * @example
 * function AppLayout() {
 *   const route = useHashRouter();
 *
 *   if (route.view === 'workspace') {
 *     return <AnimalWorkspace />;
 *   }
 *   // ...
 * }
 */
export function useHashRouter(): RouteInfo {
  // Initialize with current hash
  // Use function form to only parse once on mount
  const [route, setRoute] = useState<RouteInfo>(() => parseHashRoute());

  useEffect(() => {
    /**
     * Handle hash change events
     * Updates route state when user navigates
     */
    const handleHashChange = () => {
      setRoute(parseHashRoute());
    };

    // Listen for hash changes
    window.addEventListener('hashchange', handleHashChange);

    // Cleanup listener on unmount
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []); // Empty deps - parseHashRoute is stable (outside component)

  return route;
}
