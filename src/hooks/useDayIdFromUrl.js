import { useState, useEffect } from 'react';

/**
 * Parses day ID from URL hash: #/day/remy-2023-06-22
 *
 * @returns {string|null} Day ID or null if not found
 *
 * @example
 * // URL: #/day/remy-2023-06-22
 * const dayId = useDayIdFromUrl(); // "remy-2023-06-22"
 *
 * @example
 * // URL: #/workspace
 * const dayId = useDayIdFromUrl(); // null
 */
export function useDayIdFromUrl() {
  const [dayId, setDayId] = useState(null);

  useEffect(() => {
    /**
     * Parse dayId from current URL hash
     */
    const parseDayId = () => {
      const hash = window.location.hash;
      const match = hash.match(/#\/day\/(.+)/);
      setDayId(match ? decodeURIComponent(match[1]) : null);
    };

    // Parse on mount
    parseDayId();

    // Listen for hash changes
    window.addEventListener('hashchange', parseDayId);

    // Cleanup listener on unmount
    return () => window.removeEventListener('hashchange', parseDayId);
  }, []);

  return dayId;
}
