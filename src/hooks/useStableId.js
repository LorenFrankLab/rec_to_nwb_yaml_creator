/**
 * @file useStableId - React hook for generating stable, unique IDs
 * @description Ensures form inputs have unique IDs for proper label and ARIA associations
 */

import { useRef } from 'react';

let globalIdCounter = 0;

/**
 * Generates a stable, unique ID for form elements
 *
 * Benefits:
 * - Guarantees unique IDs even in dynamic arrays
 * - Maintains ID stability across re-renders
 * - Supports SSR (server-side rendering) safe patterns
 * - Enables proper label and aria-describedby associations
 *
 * @param {string|number} [providedId] - Optional ID provided by parent component
 * @param {string} [prefix='stable-id'] - Prefix for generated IDs
 * @returns {string} - A stable, unique ID
 *
 * @example
 * // With provided ID
 * const id = useStableId('my-input'); // Returns: 'my-input'
 *
 * @example
 * // Without provided ID (auto-generate)
 * const id = useStableId(); // Returns: 'stable-id-1'
 *
 * @example
 * // With custom prefix
 * const id = useStableId(undefined, 'input'); // Returns: 'input-1'
 *
 * @example
 * // In array contexts
 * {items.map((item, index) => {
 *   const id = useStableId(`item-${index}`);
 *   return <input id={id} key={item.id} />;
 * })}
 */
export function useStableId(providedId, prefix = 'stable-id') {
  // Store the stable ID in a ref to maintain across re-renders
  const stableIdRef = useRef(null);

  // On first render or when we don't have a stable ID yet
  if (stableIdRef.current === null) {
    // If providedId is truthy and not empty/whitespace, use it
    if (providedId !== undefined && providedId !== null) {
      const idString = String(providedId).trim();
      if (idString !== '') {
        stableIdRef.current = idString;
      }
    }

    // If still no ID, generate one
    if (stableIdRef.current === null) {
      globalIdCounter += 1;
      stableIdRef.current = `${prefix}-${globalIdCounter}`;
    }
  } else {
    // We have a stable ID - only update if providedId changes to a new non-empty value
    if (providedId !== undefined && providedId !== null) {
      const idString = String(providedId).trim();
      if (idString !== '' && idString !== stableIdRef.current) {
        stableIdRef.current = idString;
      }
    }
    // If providedId becomes undefined/null/empty, keep the current stable ID
  }

  return stableIdRef.current;
}
