import { useState, useEffect } from 'react';
import { parseHashRoute } from './useHashRouter';

/**
 * Views whose route carries an `animalId` param. Both the legacy stepper
 * (`#/animal/:id/editor`) and the tabbed animal view (`#/animal/:id/:tab`,
 * `#/animal/:id`) are owned by one animal, so the id is meaningful on both.
 */
const ANIMAL_VIEWS = new Set(['animal-editor', 'animal-view']);

/**
 * Custom hook to extract the animal ID from the URL hash.
 *
 * Resolves the id for any animal-scoped route — the legacy `#/animal/:id/editor`
 * stepper AND the tabbed `#/animal/:id/:tab` (and bare `#/animal/:id`) views — by
 * delegating route parsing to {@link parseHashRoute} (single source of routing truth),
 * then URL-decoding the raw id. Returns `null` for any non-animal route.
 *
 * @returns {string|null} Animal ID from URL, or null if the route isn't animal-scoped.
 *
 * @example
 * // URL: #/animal/remy/cameras  -> "remy"
 * // URL: #/animal/remy/editor   -> "remy"
 * // URL: #/workspace            -> null
 */
export function useAnimalIdFromUrl() {
  const [animalId, setAnimalId] = useState(null);

  useEffect(() => {
    /**
     * Resolve the animal id from the current hash route.
     */
    function parseAnimalId() {
      const route = parseHashRoute();
      if (ANIMAL_VIEWS.has(route.view) && route.params.animalId) {
        // parseHashRoute passes the raw id through; decode here (e.g., %20 -> space).
        setAnimalId(decodeURIComponent(route.params.animalId));
      } else {
        setAnimalId(null);
      }
    }

    // Parse on mount
    parseAnimalId();

    // Listen for hash changes
    window.addEventListener('hashchange', parseAnimalId);

    return () => {
      window.removeEventListener('hashchange', parseAnimalId);
    };
  }, []);

  return animalId;
}
