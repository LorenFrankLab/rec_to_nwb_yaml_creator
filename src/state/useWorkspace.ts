import { useState, useMemo, useRef, useCallback } from 'react';
import { resolveInitialWorkspace } from './workspaceHydration';
import type { InitialWorkspaceState } from './workspaceHydration';
import { createWorkspaceActions } from './workspaceActions';
import { getAnimalDays } from './workspaceSelectors';
import { useWorkspacePersistence } from './useWorkspacePersistence';
import type { LoadDiscardReason } from './persistence';
import type { Workspace } from './workspaceTypes';
import { FLAGS } from '../featureFlags';
import { getWriterState } from './writerLock';
import { ACCEPTED_COMMIT } from './commitResult';
import type { CommitResult } from './commitResult';

/**
 * Thrown by every record-mutating action in a READ-ONLY tab (another tab holds the writer lease).
 * Ownership is enforced at the mutation boundary, not only at the write: an edit a reader accepted
 * would be replaced by the writer's next save and lost.
 */
export class ReadOnlyWorkspaceError extends Error {
  constructor() {
    super('This tab is read-only — another tab is editing this workspace. Take over editing first.');
    this.name = 'ReadOnlyWorkspaceError';
  }
}

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
 * @param initialState - Optional initial state; `initialState.workspace` (test-provided) wins over
 *   localStorage hydration.
 * @returns The workspace slice (`workspace` / `setWorkspace` / `workspaceActions` /
 *   `workspaceSelectors` / `persistence`).
 */
export function useWorkspace(initialState: InitialWorkspaceState | null = null) {
  // Hydrate from localStorage when persistence is enabled and no test-provided workspace was
  // supplied. Any discard/recovery reason is captured for a post-mount notice (we cannot call
  // setState during render); the persistence hook consumes these refs once after mount.
  const initialDiscardRef = useRef<LoadDiscardReason | null>(null);
  const initialRecoverRef = useRef<{ missingKeys: string[] } | null>(null);

  const [workspace, setWorkspace] = useState<Workspace>(() => {
    const { workspace: initialWorkspace, discarded, recovered } =
      resolveInitialWorkspace(initialState);
    initialDiscardRef.current = discarded;
    initialRecoverRef.current = recovered;
    // The hydration layer types the workspace loosely (`Record<string, unknown>`) because it
    // tolerates corrupt blobs; from here it is the canonical typed `Workspace` the store drives.
    return initialWorkspace as unknown as Workspace;
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
   * The updater is evaluated exactly once against the live ref. Publishing that same object to
   * React prevents clocks, ids, and other operation inputs from being evaluated a second time by a
   * queued state updater or Strict Mode.
   *
   * Stable across renders (it closes over only the stable `workspaceRef` and `setWorkspace`), so
   * the actions memo can build once.
   *
   * @param updater - Workspace transform.
   */
  const applyWorkspace = useCallback((updater: (prev: Workspace) => Workspace): CommitResult => {
    const next = updater(workspaceRef.current);
    workspaceRef.current = next;
    setWorkspace(next);
    return ACCEPTED_COMMIT;
  }, []);

  // The single mutation boundary for record edits: refused while this tab is read-only (the
  // persistence layer also refuses to write, but an accepted-then-discarded edit is data loss).
  const commitWorkspace = useCallback(
    (updater: (prev: Workspace) => Workspace): CommitResult => {
      if (FLAGS.localStoragePersistence && getWriterState().role === 'reader') {
        throw new ReadOnlyWorkspaceError();
      }
      return applyWorkspace(updater);
    },
    [applyWorkspace]
  );

  const workspaceActions = useMemo(
    () => createWorkspaceActions({ commitWorkspace, workspaceRef }),
    [commitWorkspace]
  );

  const workspaceSelectors = useMemo(
    () => ({
      /**
       * Get all days for a specific animal, sorted by date.
       *
       * @param animalId - Animal identifier
       * @returns Array of day objects sorted by date
       */
      getAnimalDays: (animalId: string) => getAnimalDays(workspace, animalId),
    }),
    [workspace]
  );

  // Whole-workspace replacement (reader live-follow, take-over, backup/checkpoint restore). Keeps
  // the ref in lockstep for the synchronous write that follows; NOT ownership-gated, because a
  // read-only tab replaces its copy precisely to follow the writer.
  const replaceWorkspace = useCallback((next: Workspace) => applyWorkspace(() => next), [applyWorkspace]);

  const persistence = useWorkspacePersistence({
    workspace,
    workspaceRef,
    initialDiscardRef,
    initialRecoverRef,
    replaceWorkspace,
  });

  return { workspace, setWorkspace, workspaceActions, workspaceSelectors, persistence };
}
