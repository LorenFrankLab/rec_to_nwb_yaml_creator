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
 * Route information object
 * @typedef {object} RouteInfo
 * @property {'home'|'workspace'|'day'|'validation'|'legacy'} view - Current view name
 * @property {Object.<string, string>} params - Route parameters (e.g., {id: '123'})
 * @property {boolean} [isUnknownRoute] - True if route was not recognized
 */

/**
 * Parse hash string into route object
 *
 * Pure function that converts window.location.hash into structured route information.
 * Moved outside component to ensure stable reference and prevent re-render issues.
 *
 * @param {string} [hash=window.location.hash] - Hash string to parse (e.g., "#/workspace")
 * @returns {RouteInfo} Parsed route information
 *
 * @example
 * parseHashRoute('#/day/123')
 * // Returns: { view: 'day', params: { id: '123' } }
 *
 * @example
 * parseHashRoute('#/')
 * // Returns: { view: 'legacy', params: {} }
 */
export function parseHashRoute(hash = typeof window !== 'undefined' ? window.location.hash : '') {
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
 * @returns {RouteInfo} Current route information
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
export function useHashRouter() {
  // Initialize with current hash
  // Use function form to only parse once on mount
  const [route, setRoute] = useState(() => parseHashRoute());

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
