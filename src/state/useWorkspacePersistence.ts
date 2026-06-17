import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { FLAGS } from '../featureFlags';
import { saveWorkspace, clearWorkspace } from './persistence';
import type { LoadDiscardReason } from './persistence';
import type { Workspace, PersistenceLoadOutcome, PersistenceStatus } from './workspaceTypes';

/** Inputs to {@link useWorkspacePersistence} (the workspace + the refs `useWorkspace` owns). */
export interface UseWorkspacePersistenceParams {
  /** The committed workspace slice (autosave dependency + payload). */
  workspace: Workspace;
  /** Live ref to the committed workspace (read by `saveNow`). */
  workspaceRef: { current: Workspace };
  /** Unusable-blob discard reason captured at hydration, or null (consumed once after mount). */
  initialDiscardRef: { current: LoadDiscardReason | null };
  /** Shape-recovery `{ missingKeys }` captured at hydration, or null (consumed once after mount). */
  initialRecoverRef: { current: { missingKeys: string[] } | null };
}

/** The persistence status plus the force-save action (a superset of {@link PersistenceStatus}). */
export interface WorkspacePersistence extends PersistenceStatus {
  /** Force an immediate write (Ctrl/Cmd+S), bypassing the autosave debounce. */
  saveNow: () => void;
}

/**
 * Owns the workspace persistence concern: the truthful SaveIndicator / beforeunload status, the
 * post-mount load notice (discard or recovery), the debounced + bounded-retry autosave, and the
 * Ctrl/Cmd+S force-save. Extracted verbatim from `useWorkspace` so its timing — the skip-initial
 * render, the 500ms debounce, the single 2s retry, the pending-flag-only-cleared-on-success guard —
 * is unchanged; only its home moved.
 *
 * Autosave reads the COMMITTED `workspace` (so it writes what React rendered); `saveNow` reads
 * `workspaceRef.current` (the always-current copy, since a force-save may fire before the next
 * render commits). The two initial-load refs are populated by `useWorkspace`'s `useState`
 * initializer and consumed once here after mount (we cannot call setState during render).
 *
 * @param params - The workspace + the hydration refs `useWorkspace` owns.
 * @param params.workspace - The committed workspace slice (autosave dependency + payload).
 * @param params.workspaceRef - Live ref to the committed workspace (saveNow).
 * @param params.initialDiscardRef - Unusable-blob discard reason, or null.
 * @param params.initialRecoverRef - Shape-recovery `{ missingKeys }`, or null.
 * @returns The persistence status plus `saveNow`.
 */
export function useWorkspacePersistence({
  workspace,
  workspaceRef,
  initialDiscardRef,
  initialRecoverRef,
}: UseWorkspacePersistenceParams): WorkspacePersistence {
  // Persistence status: drives the truthful SaveIndicator and the beforeunload guard.
  const [lastSaved, setLastSaved] = useState<string | null>(null); // ISO string of last confirmed write, or null
  const [saveError, setSaveError] = useState<string | null>(null); // user-facing save-failure message, or null
  const [hasPendingWrite, setHasPendingWrite] = useState(false); // debounce in flight
  const [loadNotice, setLoadNotice] = useState<string | null>(null); // recovery/discard notice for the UI
  const [loadOutcome, setLoadOutcome] = useState<PersistenceLoadOutcome>(null);

  // Surface a discard notice after mount when a saved blob could not be restored,
  // and clear the unusable blob so it isn't re-read.
  useEffect(() => {
    if (initialDiscardRef.current) {
      setLoadNotice(
        'Saved workspace data could not be restored (it was from an incompatible ' +
          'or corrupted version) and was discarded. Starting with an empty workspace.'
      );
      setLoadOutcome('discarded');
      initialDiscardRef.current = null;
      clearWorkspace();
    } else if (initialRecoverRef.current) {
      // Salvaged a structurally-incomplete blob: its data was kept, only the missing
      // top-level sections were restored. Name them so the recovery is never silent.
      const missing = initialRecoverRef.current.missingKeys.join(', ');
      setLoadNotice(
        `Saved workspace was missing required sections (${missing}); they were ` +
          'restored to empty so your existing data could be loaded. Please review before exporting.'
      );
      setLoadOutcome('recovered');
      initialRecoverRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced autosave on workspace change only (never on legacy formData edits).
  // Skip the initial render so we don't immediately rewrite what we just hydrated.
  const didMountAutosaveRef = useRef(false);

  useEffect(() => {
    if (!FLAGS.localStoragePersistence) return undefined;

    if (!didMountAutosaveRef.current) {
      didMountAutosaveRef.current = true;
      return undefined;
    }

    setHasPendingWrite(true);
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    // One bounded automatic retry after a transient failure, so recovery doesn't depend solely on
    // the user noticing the SaveIndicator (a later edit, or Ctrl/Cmd+S, also re-attempts). Bounded
    // by `retriesLeft` so a persistent failure (e.g. quota) can't become a save storm; both timers
    // are cleared on cleanup, and a workspace change re-runs the effect from scratch.
    const attempt = (retriesLeft: number) => {
      try {
        saveWorkspace(workspace);
        setLastSaved(new Date().toISOString());
        setSaveError(null);
        // Clear the pending flag ONLY on a confirmed write. Leaving it set on failure
        // keeps the beforeunload guard armed so unsaved work isn't lost on navigation.
        setHasPendingWrite(false);
      } catch (err) {
        setSaveError(`Could not save workspace: ${(err as Error).message}`);
        if (retriesLeft > 0) {
          retryTimer = setTimeout(() => attempt(retriesLeft - 1), 2000);
        }
      }
    };
    const timer = setTimeout(() => attempt(1), 500);

    return () => {
      clearTimeout(timer);
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [workspace]);

  const dismissLoadNotice = useCallback(() => setLoadNotice(null), []);

  // Force an immediate write (Ctrl/Cmd+S), bypassing the autosave debounce. No-op
  // when persistence is disabled. Mirrors the autosave's success/error bookkeeping.
  const saveNow = useCallback(() => {
    if (!FLAGS.localStoragePersistence) return;
    try {
      saveWorkspace(workspaceRef.current);
      setLastSaved(new Date().toISOString());
      setSaveError(null);
      setHasPendingWrite(false);
    } catch (err) {
      setSaveError(`Could not save workspace: ${(err as Error).message}`);
    }
  }, [workspaceRef]);

  // Real persistence status (never part of `model` — must not reach YAML).
  // Memoized so the StoreContext value's identity is stable when nothing changed,
  // preserving the provider's re-render optimization.
  const persistence = useMemo(
    () => ({
      enabled: FLAGS.localStoragePersistence,
      lastSaved,
      saveError,
      hasPendingWrite,
      loadNotice,
      loadOutcome,
      dismissLoadNotice,
      saveNow,
    }),
    [lastSaved, saveError, hasPendingWrite, loadNotice, loadOutcome, dismissLoadNotice, saveNow]
  );

  return persistence;
}
