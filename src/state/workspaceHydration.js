import { createDefaultWorkspace } from './workspaceUtils';
import { FLAGS } from '../featureFlags';
import { loadWorkspace } from './persistence';
import { normalizeWorkspaceDevices } from '../utils/deviceNormalization';

/**
 * Resolve the workspace slice's INITIAL state, the pure logic of `useWorkspace`'s `useState`
 * initializer (extracted verbatim so the hydration precedence is unchanged). Precedence:
 *
 *   1. a test-provided `initialState.workspace` (device-normalized) ALWAYS wins;
 *   2. else, with persistence off, the empty default;
 *   3. else the localStorage blob: a clean first run / unreadable storage → default; a
 *      structurally-valid (possibly shape-repaired) blob → hydrated, with any `recovered`
 *      notice surfaced; an unusable blob → default, with the `discarded` reason surfaced.
 *
 * The two notices are returned (not raised) because the caller cannot call `setState` during
 * render — it stashes them in refs and emits a post-mount notice. At most one of
 * `discarded` / `recovered` is ever non-null.
 *
 * @param {object|null} initialState - Optional initial state; `initialState.workspace` wins.
 * @returns {{ workspace: object, discarded: (object|null), recovered: (object|null) }}
 */
export function resolveInitialWorkspace(initialState) {
  const fallback = createDefaultWorkspace();

  if (initialState?.workspace) {
    // tests win
    return { workspace: normalizeWorkspaceDevices(initialState.workspace), discarded: null, recovered: null };
  }
  if (!FLAGS.localStoragePersistence) {
    return { workspace: fallback, discarded: null, recovered: null };
  }

  const loaded = loadWorkspace();
  if (loaded == null) {
    // clean first run
    return { workspace: fallback, discarded: null, recovered: null };
  }
  if (loaded.workspace) {
    // Structurally valid but possibly shape-repaired → restored. Missing required sections drive a
    // recovery notice after mount (not a discard); a clean hydrate carries no notice.
    return { workspace: loaded.workspace, discarded: null, recovered: loaded.recovered || null };
  }
  // Unusable blob → fall back to defaults; the discard reason drives a notice after mount.
  return { workspace: fallback, discarded: loaded.discarded, recovered: null };
}
