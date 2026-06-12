import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { FLAGS } from '../featureFlags';
import { saveWorkspace, clearWorkspace } from './persistence';

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
 * @param {object} params
 * @param {object} params.workspace - The committed workspace slice (autosave dependency + payload).
 * @param {{ current: object }} params.workspaceRef - Live ref to the committed workspace (saveNow).
 * @param {{ current: (object|null) }} params.initialDiscardRef - Unusable-blob discard reason, or null.
 * @param {{ current: (object|null) }} params.initialRecoverRef - Shape-recovery `{ missingKeys }`, or null.
 * @returns {{ enabled: boolean, lastSaved: (string|null), saveError: (string|null), hasPendingWrite: boolean, loadNotice: (string|null), dismissLoadNotice: Function, saveNow: Function }}
 */
export function useWorkspacePersistence({
  workspace,
  workspaceRef,
  initialDiscardRef,
  initialRecoverRef,
}) {
  // Persistence status: drives the truthful SaveIndicator and the beforeunload guard.
  const [lastSaved, setLastSaved] = useState(null); // ISO string of last confirmed write, or null
  const [saveError, setSaveError] = useState(null); // user-facing save-failure message, or null
  const [hasPendingWrite, setHasPendingWrite] = useState(false); // debounce in flight
  const [loadNotice, setLoadNotice] = useState(null); // discard notice for the UI, or null

  // Surface a discard notice after mount when a saved blob could not be restored,
  // and clear the unusable blob so it isn't re-read.
  useEffect(() => {
    if (initialDiscardRef.current) {
      setLoadNotice(
        'Saved workspace data could not be restored (it was from an incompatible ' +
          'or corrupted version) and was discarded. Starting with an empty workspace.'
      );
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
    let retryTimer = null;
    // One bounded automatic retry after a transient failure, so recovery doesn't depend solely on
    // the user noticing the SaveIndicator (a later edit, or Ctrl/Cmd+S, also re-attempts). Bounded
    // by `retriesLeft` so a persistent failure (e.g. quota) can't become a save storm; both timers
    // are cleared on cleanup, and a workspace change re-runs the effect from scratch.
    const attempt = (retriesLeft) => {
      try {
        saveWorkspace(workspace);
        setLastSaved(new Date().toISOString());
        setSaveError(null);
        // Clear the pending flag ONLY on a confirmed write. Leaving it set on failure
        // keeps the beforeunload guard armed so unsaved work isn't lost on navigation.
        setHasPendingWrite(false);
      } catch (err) {
        setSaveError(`Could not save workspace: ${err.message}`);
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
      setSaveError(`Could not save workspace: ${err.message}`);
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
      dismissLoadNotice,
      saveNow,
    }),
    [lastSaved, saveError, hasPendingWrite, loadNotice, dismissLoadNotice, saveNow]
  );

  return persistence;
}
