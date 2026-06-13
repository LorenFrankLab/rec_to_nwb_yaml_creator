import { createDefaultWorkspace } from './workspaceUtils';
import { FLAGS } from '../featureFlags';
import { loadWorkspace } from './persistence';
import type { LoadDiscardReason } from './persistence';
import { normalizeWorkspaceDevices } from '../utils/deviceNormalization';

/** Optional initial state for {@link resolveInitialWorkspace}; a present `workspace` always wins. */
export interface InitialWorkspaceState {
  /** A test-provided workspace (device-normalized before use). */
  workspace?: unknown;
}

/**
 * The resolved initial workspace slice plus the two at-most-one-non-null post-mount notices.
 */
export interface InitialWorkspaceResolution {
  /** The hydrated or default workspace. */
  workspace: Record<string, unknown>;
  /** Discard reason when a stored blob was unusable, else null. */
  discarded: LoadDiscardReason | null;
  /** Recovery notice (the shape-repaired sections) when a blob was incomplete-but-valid, else null. */
  recovered: { missingKeys: string[] } | null;
}

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
 * @param initialState - Optional initial state; `initialState.workspace` wins.
 * @returns The resolved workspace plus the `discarded` / `recovered` notices.
 */
export function resolveInitialWorkspace(
  initialState?: InitialWorkspaceState | null
): InitialWorkspaceResolution {
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
