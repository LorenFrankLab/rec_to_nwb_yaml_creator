import { useState, useEffect } from 'react';

/**
 * Custom hook to extract animal ID from URL hash
 *
 * Parses routes like #/animal/:id/editor to extract the animal ID.
 * Returns null if route doesn't match or ID is invalid.
 *
 * @returns {string|null} Animal ID from URL, or null if not found
 *
 * @example
 * // URL: #/animal/remy/editor
 * const animalId = useAnimalIdFromUrl(); // "remy"
 *
 * @example
 * // URL: #/workspace
 * const animalId = useAnimalIdFromUrl(); // null
 */
export function useAnimalIdFromUrl() {
  const [animalId, setAnimalId] = useState(null);

  useEffect(() => {
    /**
     *
     */
    function parseAnimalId() {
      // Get hash without #
      const hash = window.location.hash.slice(1);

      // Strip query parameters
      const path = hash.split('?')[0];

      // Match pattern: /animal/:id/editor
      const match = path.match(/^\/animal\/([^/]+)\/editor$/);

      if (match && match[1]) {
        setAnimalId(match[1]);
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
