import { useState, useMemo, useRef, useCallback } from 'react';
import { resolveInitialWorkspace } from './workspaceHydration';
import { createWorkspaceActions } from './workspaceActions';
import { getAnimalDays } from './workspaceSelectors';
import { useWorkspacePersistence } from './useWorkspacePersistence';

/**
 * Owns the workspace slice of the store: multi-animal/day state plus the store primitives the
 * collaborators compose. The concerns are split across focused modules, but the WIRING — and the
 * same-tick action semantics — live here:
 *
 *   - hydration → {@link resolveInitialWorkspace} (the `useState` initializer logic);
 *   - localStorage autosave + persistence status → {@link useWorkspacePersistence};
 *   - the workspace mutation actions → {@link createWorkspaceActions} (over `commitWorkspace`);
 *   - the `getAnimalDays` selector → the pure `getAnimalDays(workspace, …)` in `workspaceSelectors`.
 *
 * The `setWorkspace` functional-update form (rather than a reducer) is kept deliberately so the
 * duplicate-id `throw`s surface with the same timing the existing tests assert.
 *
 * @param {object|null} initialState - Optional initial state; `initialState.workspace`
 *   (test-provided) wins over localStorage hydration.
 * @returns {{ workspace: object, setWorkspace: Function, workspaceActions: object, workspaceSelectors: object, persistence: object }}
 */
export function useWorkspace(initialState = null) {
  // Hydrate from localStorage when persistence is enabled and no test-provided workspace was
  // supplied. Any discard/recovery reason is captured for a post-mount notice (we cannot call
  // setState during render); the persistence hook consumes these refs once after mount.
  const initialDiscardRef = useRef(null);
  const initialRecoverRef = useRef(null);

  const [workspace, setWorkspace] = useState(() => {
    const { workspace: initialWorkspace, discarded, recovered } =
      resolveInitialWorkspace(initialState);
    initialDiscardRef.current = discarded;
    initialRecoverRef.current = recovered;
    return initialWorkspace;
  });

  // Latest committed workspace, refreshed every render. Lets the memoized actions and
  // `saveNow` read the authoritative current state synchronously (the `setWorkspace`
  // updater is deferred under React batching, so its result is not available at the
  // moment an action returns).
  const workspaceRef = useRef(workspace);
  workspaceRef.current = workspace;

  /**
   * Apply a workspace updater while keeping `workspaceRef.current` in LOCKSTEP with the change.
   *
   * A single action can read the ref straight from the last render, but a COMPOSITE batch of
   * actions in one tick — e.g. a replace-import's `deleteAnimal` → `createAnimal` →
   * `createConfigurationSnapshotAndApplyForward`, all before React commits — needs each step to see
   * the prior step's result synchronously. Without this, a later step reserves state (like the next
   * configuration version) from the STALE pre-batch animal, which can duplicate version 1 and pin
   * days to the wrong hardware config.
   *
   * The updater is run once here against the ref and again inside `setWorkspace` (React may also
   * re-invoke it under batching/StrictMode), so it should be pure for any value field a LATER
   * same-tick step reads. A captured timestamp does differ by a tick between the two runs, but only
   * the React-committed copy persists (the ref is overwritten on the next render) and the version
   * reservation reads `configurationHistory`, not timestamps, so that difference is inert.
   *
   * Stable across renders (it closes over only the stable `workspaceRef` and `setWorkspace`), so
   * the actions memo can build once.
   *
   * @param {(prev: object) => object} updater - Workspace transform.
   */
  const commitWorkspace = useCallback((updater) => {
    workspaceRef.current = updater(workspaceRef.current);
    setWorkspace(updater);
  }, []);

  const workspaceActions = useMemo(
    () => createWorkspaceActions({ commitWorkspace, setWorkspace, workspaceRef }),
    [commitWorkspace]
  );

  const workspaceSelectors = useMemo(
    () => ({
      /**
       * Get all days for a specific animal, sorted by date.
       *
       * @param {string} animalId - Animal identifier
       * @returns {Array} Array of day objects sorted by date
       */
      getAnimalDays: (animalId) => getAnimalDays(workspace, animalId),
    }),
    [workspace]
  );

  const persistence = useWorkspacePersistence({
    workspace,
    workspaceRef,
    initialDiscardRef,
    initialRecoverRef,
  });

  return { workspace, setWorkspace, workspaceActions, workspaceSelectors, persistence };
}
