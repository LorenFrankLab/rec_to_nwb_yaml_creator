import { useState, useEffect, useRef, useCallback, useMemo, useSyncExternalStore } from 'react';
import { flushAllDrafts, hasPendingDrafts as readPendingDrafts, subscribeDrafts, getDraftVersion } from './draftRegistry';
import { FLAGS } from '../featureFlags';
import {
  saveWorkspace,
  clearWorkspace,
  loadWorkspace,
  syncRevisionFromStorage,
  WORKSPACE_STORAGE_KEY,
  WorkspaceConflictError,
} from './persistence';
import type { LoadDiscardReason } from './persistence';
import {
  acquireWriterLock,
  getWriterState,
  subscribeWriterState,
  requestTakeOver,
  retryAcquire,
  onBeforeHandOver,
} from './writerLock';
import type { WriterState } from './writerLock';
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
  /** Replace the whole in-memory workspace (reader live-follow, take-over, backup restore). */
  replaceWorkspace: (next: Workspace) => void;
}

/** The persistence status plus the actions (a superset of {@link PersistenceStatus}). */
export interface WorkspacePersistence extends PersistenceStatus {
  /** Force an immediate write (Ctrl/Cmd+S / Save), flushing pending field drafts first. */
  saveNow: () => void;
  /** Ask the editing tab to hand over the writer lease to this tab. */
  takeOver: () => Promise<boolean>;
  /**
   * Replace the in-memory workspace with an already-hydrated one (a restored backup or checkpoint)
   * and write it immediately. Writer-only; returns false (and sets `saveError`) otherwise.
   */
  restoreWorkspace: (next: Workspace) => boolean;
}

/** How often a read-only tab re-tries the writer lease (the editing tab may have closed). */
const READER_RETRY_MS = 3_000;

/**
 * Owns the workspace persistence concern: the truthful SaveIndicator / beforeunload status, the
 * post-mount load notice (discard or recovery), the debounced + bounded-retry autosave, the
 * Ctrl/Cmd+S force-save, the single-writer lease (a second tab is read-only and follows the
 * writer's saves live), and backup restore.
 *
 * Autosave reads the COMMITTED `workspace` (so it writes what React rendered); `saveNow` reads
 * `workspaceRef.current` (the always-current copy, since a force-save may fire before the next
 * render commits, and every record-mutating action commits through the ref in lockstep). The two
 * initial-load refs are populated by `useWorkspace`'s `useState` initializer and consumed once
 * here after mount (we cannot call setState during render).
 *
 * @param params - See {@link UseWorkspacePersistenceParams}.
 * @param params.workspace - The committed workspace slice (autosave dependency + payload).
 * @param params.workspaceRef - Live ref to the committed workspace (saveNow).
 * @param params.initialDiscardRef - Unusable-blob discard reason, or null.
 * @param params.initialRecoverRef - Shape-recovery `{ missingKeys }`, or null.
 * @param params.replaceWorkspace - Whole-workspace replacer.
 * @returns The persistence status plus its actions.
 */
export function useWorkspacePersistence({
  workspace,
  workspaceRef,
  initialDiscardRef,
  initialRecoverRef,
  replaceWorkspace,
}: UseWorkspacePersistenceParams): WorkspacePersistence {
  // Persistence status: drives the truthful SaveIndicator and the beforeunload guard.
  const [lastSaved, setLastSaved] = useState<string | null>(null); // ISO string of last confirmed write, or null
  const [saveError, setSaveError] = useState<string | null>(null); // user-facing save-failure message, or null
  const [hasPendingWrite, setHasPendingWrite] = useState(false); // debounce in flight
  const [loadNotice, setLoadNotice] = useState<string | null>(null); // recovery/discard notice for the UI
  const [loadOutcome, setLoadOutcome] = useState<PersistenceLoadOutcome>(null);

  const enabled = FLAGS.localStoragePersistence;

  // ── Single-writer ownership ──
  // With persistence off there is nothing to own: every tab is a "writer" of in-memory state.
  const lockState = useSyncExternalStore(subscribeWriterState, getWriterState, getWriterState);
  const writerState: WriterState = useMemo(
    () => (enabled ? lockState : { role: 'writer' }),
    [enabled, lockState]
  );
  const isWriter = writerState.role === 'writer';
  const isWriterRef = useRef(isWriter);
  isWriterRef.current = isWriter;

  useEffect(() => {
    if (!enabled) return;
    void acquireWriterLock();
  }, [enabled]);

  // The workspace object that storage already holds (the hydrated one at mount, then the last one
  // written or re-loaded). Autosave writes only when the committed workspace is a DIFFERENT object
  // — never because the effect re-ran for another reason (e.g. this tab becoming the writer), which
  // would re-persist an untouched hydrated blob and clobber whatever another source just stored.
  const lastPersistedRef = useRef<Workspace>(workspace);

  /** Re-hydrate the in-memory workspace from storage (reader follow / promotion / take-over). */
  const reloadFromStorage = useCallback((): boolean => {
    const loaded = loadWorkspace();
    if (loaded && loaded.workspace) {
      const next = loaded.workspace as unknown as Workspace;
      lastPersistedRef.current = next;
      replaceWorkspace(next);
      return true;
    }
    syncRevisionFromStorage();
    return false;
  }, [replaceWorkspace]);

  // A read-only tab follows the writer's saves live (the `storage` event fires in OTHER tabs), and
  // periodically re-tries the lease so it becomes editable once the writing tab closes.
  useEffect(() => {
    if (!enabled || isWriter) return undefined;
    const onStorage = (event: StorageEvent) => {
      if (event.key === WORKSPACE_STORAGE_KEY && !isWriterRef.current) reloadFromStorage();
    };
    window.addEventListener('storage', onStorage);
    const timer = setInterval(() => {
      void retryAcquire().then((next) => {
        if (next.role === 'writer') reloadFromStorage();
      });
    }, READER_RETRY_MS);
    return () => {
      window.removeEventListener('storage', onStorage);
      clearInterval(timer);
    };
  }, [enabled, isWriter, reloadFromStorage]);

  // Surface a discard notice after mount when a saved blob could not be restored,
  // and clear the unusable blob so it isn't re-read (its bytes are already quarantined).
  useEffect(() => {
    if (initialDiscardRef.current) {
      setLoadNotice(
        'Saved workspace data could not be restored (it was from an incompatible ' +
          'or corrupted version) and was discarded from the active workspace. A copy of the ' +
          'original data was kept — see "Saved on this browser" on the Workspace page to download it. ' +
          'Starting with an empty workspace.'
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

  // Debounced autosave on workspace change only (never on legacy formData edits, never for the
  // hydrated object itself — see `lastPersistedRef`).
  useEffect(() => {
    if (!enabled) return undefined;
    if (workspace === lastPersistedRef.current) return undefined;
    // A read-only tab never writes (finding F4). Nothing is "pending" for it either.
    if (!isWriter) return undefined;

    setHasPendingWrite(true);
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    // One bounded automatic retry after a transient failure, so recovery doesn't depend solely on
    // the user noticing the SaveIndicator (a later edit, or Ctrl/Cmd+S, also re-attempts). Bounded
    // by `retriesLeft` so a persistent failure (e.g. quota) can't become a save storm; both timers
    // are cleared on cleanup, and a workspace change re-runs the effect from scratch.
    const attempt = (retriesLeft: number) => {
      try {
        saveWorkspace(workspace);
        lastPersistedRef.current = workspace;
        setLastSaved(new Date().toISOString());
        setSaveError(null);
        // Clear the pending flag ONLY on a confirmed write. Leaving it set on failure
        // keeps the beforeunload guard armed so unsaved work isn't lost on navigation.
        setHasPendingWrite(false);
      } catch (err) {
        setSaveError(`Could not save workspace: ${(err as Error).message}`);
        // A revision conflict will not resolve by retrying.
        if (retriesLeft > 0 && !(err instanceof WorkspaceConflictError)) {
          retryTimer = setTimeout(() => attempt(retriesLeft - 1), 2000);
        }
      }
    };
    const timer = setTimeout(() => attempt(1), 500);

    return () => {
      clearTimeout(timer);
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [workspace, enabled, isWriter]);

  const dismissLoadNotice = useCallback(() => setLoadNotice(null), []);

  // Whether a text field is mid-edit (its newest value not yet committed to the store). Read from
  // the draft registry so the indicator / unload guard cannot claim durability over a pending draft.
  useSyncExternalStore(subscribeDrafts, getDraftVersion, getDraftVersion);
  const hasPendingDrafts = readPendingDrafts();

  // Force an immediate write (Ctrl/Cmd+S, the Save button, pagehide), bypassing the autosave
  // debounce. FLUSHES pending field drafts first: their commits go through the ref-lockstep
  // `commitWorkspace`, so `workspaceRef.current` already holds them when the synchronous write
  // below runs. An explicit save also refreshes the last-known-good checkpoint. No-op when
  // persistence is disabled; refused (with a visible reason) in a read-only tab.
  const saveNow = useCallback(() => {
    flushAllDrafts();
    if (!enabled) return;
    if (!isWriterRef.current) {
      setSaveError('This tab is read-only — another tab is editing this workspace.');
      return;
    }
    try {
      saveWorkspace(workspaceRef.current, { checkpoint: true });
      lastPersistedRef.current = workspaceRef.current;
      setLastSaved(new Date().toISOString());
      setSaveError(null);
      setHasPendingWrite(false);
    } catch (err) {
      setSaveError(`Could not save workspace: ${(err as Error).message}`);
    }
  }, [workspaceRef, enabled]);

  // Leaving the page: commit pending drafts and write synchronously (localStorage is synchronous, so
  // this completes before unload) — but ONLY when there is unsaved work (a pending draft, a pending
  // debounced write, or a failed write). An unconditional write would re-persist the in-memory
  // workspace on every reload, clobbering a blob another source just put in storage (e.g. a restore
  // or a test harness seed) with stale content. `pagehide` fires on every navigation/close
  // (including mobile tab discard, where `beforeunload` does not); `beforeunload` is kept for the
  // unsaved-work prompt (useUnsavedWorkGuard). The same final write runs right before this tab hands
  // the writer lease to another tab.
  const saveNowRef = useRef(saveNow);
  saveNowRef.current = saveNow;
  const unsavedRef = useRef(false);
  unsavedRef.current = hasPendingWrite || saveError != null;
  useEffect(() => {
    const finalWrite = () => {
      const flushed = flushAllDrafts();
      if (flushed > 0 || unsavedRef.current) saveNowRef.current();
    };
    window.addEventListener('pagehide', finalWrite);
    const offHandOver = onBeforeHandOver(finalWrite);
    return () => {
      window.removeEventListener('pagehide', finalWrite);
      offHandOver();
    };
  }, []);

  /** Ask the editing tab for the lease, then load its final save. */
  const takeOver = useCallback(async (): Promise<boolean> => {
    if (!enabled) return true;
    const next = await requestTakeOver();
    if (next.role === 'writer') {
      reloadFromStorage();
      setSaveError(null);
      return true;
    }
    setSaveError('Could not take over editing — the other tab did not respond. Close it and try again.');
    return false;
  }, [enabled, reloadFromStorage]);

  /** Replace the in-memory workspace with a restored one and write it immediately (writer-only). */
  const restoreWorkspace = useCallback(
    (next: Workspace): boolean => {
      if (enabled && !isWriterRef.current) {
        setSaveError('This tab is read-only — take over editing before restoring a backup.');
        return false;
      }
      replaceWorkspace(next);
      if (!enabled) return true;
      try {
        // A restore overwrites deliberately: adopt whatever revision is stored, then write.
        syncRevisionFromStorage();
        saveWorkspace(next, { checkpoint: true });
        lastPersistedRef.current = next;
        setLastSaved(new Date().toISOString());
        setSaveError(null);
        setHasPendingWrite(false);
        return true;
      } catch (err) {
        setSaveError(`Could not save the restored workspace: ${(err as Error).message}`);
        return false;
      }
    },
    [enabled, replaceWorkspace]
  );

  // Real persistence status (never part of `model` — must not reach YAML).
  // Memoized so the StoreContext value's identity is stable when nothing changed,
  // preserving the provider's re-render optimization.
  const persistence = useMemo(
    () => ({
      enabled,
      lastSaved,
      saveError,
      hasPendingWrite,
      hasPendingDrafts,
      loadNotice,
      loadOutcome,
      writer: writerState,
      dismissLoadNotice,
      saveNow,
      takeOver,
      restoreWorkspace,
    }),
    [
      enabled,
      lastSaved,
      saveError,
      hasPendingWrite,
      hasPendingDrafts,
      loadNotice,
      loadOutcome,
      writerState,
      dismissLoadNotice,
      saveNow,
      takeOver,
      restoreWorkspace,
    ]
  );

  return persistence;
}
