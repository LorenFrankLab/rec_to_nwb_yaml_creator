/**
 * useReconfigContext — the shared parser + hook for transient animal-editor route context.
 *
 * A reconfiguration deep-link (`ReconfigWizard`) carries its context in the hash query string:
 * `?context=reconfigure&version=&fromDay=&movedDays=` (plus `?field=` for repair deep-links). Both
 * the legacy Animal Editor stepper and the tabbed Animal View READ these params to render the
 * reconfiguration context banner, so the parser lives here as ONE implementation rather than forked
 * per host. (Re-pointing the EMITTERS to tab routes is Phase 3a; this is read-only.)
 */
import { useState, useEffect } from 'react';

/** Transient animal-view route context parsed from the hash query string. */
interface ReconfigContext {
  context: string | null;
  version: number | null;
  fromDayId: string | null;
  movedDays: number | null;
  field: string | null;
}

/**
 * Parse a non-negative integer query param, or null when absent/blank/non-numeric.
 * @param raw - Raw query value.
 * @returns The parsed safe integer, or null.
 */
function parseIntegerParam(raw: string | null): number | null {
  const trimmed = (raw || '').trim();
  if (!trimmed || !/^\d+$/.test(trimmed)) return null;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

/**
 * Parse transient animal-view route context from a hash string.
 *
 * @param hash - Current window hash (e.g. `#/animal/remy/electrode-groups?context=reconfigure`).
 * @returns The parsed route context.
 */
export function parseReconfigContext(hash: string): ReconfigContext {
  const query = (hash || '').split('?')[1] || '';
  const params = new URLSearchParams(query);
  const movedDays = parseIntegerParam(params.get('movedDays'));

  return {
    context: params.get('context'),
    version: parseIntegerParam(params.get('version')),
    fromDayId: params.get('fromDay'),
    movedDays: movedDays !== null && movedDays > 0 ? movedDays : null,
    field: params.get('field'),
  };
}

/**
 * Track the route query context while mounted, re-parsing on every `hashchange`.
 *
 * @returns The parsed route context.
 */
export function useReconfigContext(): ReconfigContext {
  const [routeContext, setRouteContext] = useState<ReconfigContext>(() => (
    typeof window === 'undefined'
      ? { context: null, version: null, fromDayId: null, movedDays: null, field: null }
      : parseReconfigContext(window.location.hash)
  ));

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleHashChange = () => {
      setRouteContext(parseReconfigContext(window.location.hash));
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  return routeContext;
}
