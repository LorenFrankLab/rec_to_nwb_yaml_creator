import { useState, useEffect, useRef, useCallback, useMemo, useSyncExternalStore } from 'react';
import {
  flushAllDrafts,
  hasPendingDrafts as readPendingDrafts,
  hasUnflushableDrafts,
  subscribeDrafts,
  getDraftVersion,
  getPendingDraftError,
} from './draftRegistry';
import { FLAGS } from '../featureFlags';
import {
  saveWorkspace,
  clearWorkspace,
  discardUnusableWorkspace,
  loadWorkspace,
  syncRevisionFromStorage,
  WORKSPACE_STORAGE_KEY,
  WorkspaceConflictError,
} from './persistence';
import { stageBackupArtifacts, discardStagedArtifacts, releaseReplacedArtifacts } from './persistence';
import type { LoadDiscardReason, BackupArtifacts } from './persistence';
import {
  acquireWriterLock,
  getWriterState,
  subscribeWriterState,
  requestTakeOver,
  retryAcquire,
  onBeforeHandOver,
} from './writerLock';
import type { WriterState, HandOverOutcome } from './writerLock';
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
  /**
   * Force an immediate write (Ctrl/Cmd+S / Save), flushing pending field drafts first. Returns
   * whether the write was confirmed.
   */
  saveNow: () => boolean;
  /** Ask the editing tab to hand over the writer lease to this tab. */
  takeOver: () => Promise<boolean>;
  /**
   * Replace the in-memory workspace with an already-hydrated one (a restored backup or checkpoint)
   * and write it immediately, first putting the backup's receipt artifacts into this browser's
   * side store (receipts without arriving bytes are marked `yamlStored: false`). Writer-only;
   * resolves false (and sets `saveError`) otherwise.
   */
  restoreWorkspace: (next: Workspace, artifacts?: BackupArtifacts) => Promise<boolean>;
  /**
   * The unusable original could not be copied anywhere durable, so saving is blocked until the
   * user has downloaded it; call this after that download to clear the original and unblock.
   */
  acknowledgeUnpreservedOriginal: () => void;
  /** True while a backup restore is in flight (saves and a second restore are refused meanwhile). */
  restoreInFlight: boolean;
  /** Abort the restore in flight: nothing it has not yet committed will be written. */
  cancelRestore: () => void;
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
  // True from mount until the unusable original this load discarded has been durably preserved (or
  // preservation has failed): every write is refused meanwhile — the main key still holds the only
  // copy of the original, and an autosave would replace it. Edits made meanwhile are kept in memory
  // and written once the flag clears (the autosave effect depends on it).
  const [preservationPending, setPreservationPending] = useState(() => initialDiscardRef.current != null);
  const preservationPendingRef = useRef(preservationPending);
  preservationPendingRef.current = preservationPending;
  // True while a discarded original still sits under the main key because no durable copy could be
  // made: every write is refused (it would overwrite the only copy) until the user downloads it.
  const [originalUnpreserved, setOriginalUnpreserved] = useState(false);
  const originalUnpreservedRef = useRef(false);
  originalUnpreservedRef.current = originalUnpreserved;
  // A backup restore in flight (its asynchronous artifact staging): hand-over, saves and a second
  // restore are refused meanwhile. The token identifies the CURRENT operation — a continuation whose
  // token is stale (cancelled, or superseded) commits nothing.
  const [restoreInFlight, setRestoreInFlight] = useState(false);
  const restoreInFlightRef = useRef(false);
  const restoreTokenRef = useRef(0);

  /**
   * Why a write must not happen right now, or null. Shared by autosave, Save and restore (which
   * skips its own in-flight check).
   */
  const writeBlocker = useCallback((options: { forRestore?: boolean } = {}): string | null => {
    if (!isWriterRef.current) return 'This tab is read-only — another tab is editing this workspace.';
    if (preservationPendingRef.current) {
      return 'Not saved yet: keeping a copy of the unrestorable original data first (your edits are kept and will be saved).';
    }
    if (originalUnpreservedRef.current) {
      return 'Not saved: download the unrestorable original from the Workspace page first.';
    }
    if (!options.forRestore && restoreInFlightRef.current) {
      return 'Not saved: a backup restore is in progress (cancel it or wait for it to finish).';
    }
    return null;
  }, []);

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

  // Surface a discard notice after mount when a saved blob could not be restored. The unusable
  // blob is cleared ONLY once its bytes are durably kept (IndexedDB acknowledged, or a localStorage
  // copy); until then — and if neither store could take it — the main key stays and saving is
  // blocked, so the only copy of the original is never overwritten by an empty workspace.
  useEffect(() => {
    if (initialDiscardRef.current) {
      setLoadOutcome('discarded');
      initialDiscardRef.current = null;
      setLoadNotice(
        'Saved workspace data could not be restored (it was from an incompatible or corrupted ' +
          'version). Keeping a copy of the original data before continuing…'
      );
      void discardUnusableWorkspace().then(({ preserved }) => {
        setPreservationPending(false);
        if (preserved) {
          setLoadNotice(
            'Saved workspace data could not be restored (it was from an incompatible ' +
              'or corrupted version) and was discarded from the active workspace. A copy of the ' +
              'original data was kept — see "Saved on this browser" on the Workspace page to download it. ' +
              'Starting with an empty workspace.'
          );
        } else {
          setOriginalUnpreserved(true);
          setLoadNotice(
            'Saved workspace data could not be restored (it was from an incompatible or corrupted ' +
              'version), and this browser could not keep a durable copy of it. Nothing will be saved ' +
              'until you download the original from "Saved on this browser" on the Workspace page.'
          );
        }
      });
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
      const blocked = writeBlocker();
      if (blocked) {
        // Stays "pending" (the unload guard stays armed); re-attempted when the blocker lifts.
        setSaveError(blocked);
        return;
      }
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
  }, [workspace, enabled, isWriter, preservationPending, originalUnpreserved, writeBlocker]);

  const dismissLoadNotice = useCallback(() => setLoadNotice(null), []);

  // Whether a text field is mid-edit (its newest value not yet committed to the store). Read from
  // the draft registry so the indicator / unload guard cannot claim durability over a pending draft.
  useSyncExternalStore(subscribeDrafts, getDraftVersion, getDraftVersion);
  const hasPendingDrafts = readPendingDrafts();
  const hasUnappliedDrafts = hasUnflushableDrafts();
  const draftError = getPendingDraftError();

  // Force an immediate write (Ctrl/Cmd+S, the Save button, pagehide), bypassing the autosave
  // debounce. FLUSHES pending field drafts first: their commits go through the ref-lockstep
  // `commitWorkspace`, so `workspaceRef.current` already holds them when the synchronous write
  // below runs. An explicit save also refreshes the last-known-good checkpoint. No-op when
  // persistence is disabled; refused (with a visible reason) in a read-only tab.
  const saveNow = useCallback((): boolean => {
    const flush = flushAllDrafts();
    if (flush.rejected.length > 0) {
      setSaveError(flush.rejected[0].reason ?? 'A pending edit could not be saved.');
      return false;
    }
    if (flush.unapplied > 0) {
      setSaveError('Apply or cancel the open dialog before saving.');
      return false;
    }
    if (!enabled) return true;
    const blocked = writeBlocker();
    if (blocked) {
      setSaveError(blocked);
      return false;
    }
    try {
      saveWorkspace(workspaceRef.current, { checkpoint: true });
      lastPersistedRef.current = workspaceRef.current;
      setLastSaved(new Date().toISOString());
      setSaveError(null);
      setHasPendingWrite(false);
      return true;
    } catch (err) {
      setSaveError(`Could not save workspace: ${(err as Error).message}`);
      return false;
    }
  }, [workspaceRef, enabled, writeBlocker]);

  // Leaving the page: commit pending drafts and write synchronously (localStorage is synchronous, so
  // this completes before unload) — but ONLY when there is unsaved work (a pending draft, a pending
  // debounced write, or a failed write). An unconditional write would re-persist the in-memory
  // workspace on every reload, clobbering a blob another source just put in storage (e.g. a restore
  // or a test harness seed) with stale content. `pagehide` fires on every navigation/close
  // (including mobile tab discard, where `beforeunload` does not); `beforeunload` is kept for the
  // unsaved-work prompt (useUnsavedWorkGuard). The same final write runs right before this tab hands
  // the writer lease to another tab — and there it is a VETO: the lease is released only when nothing
  // is left unsaved (a failed write, or a dialog holding unapplied edits, keeps this tab the writer,
  // because the next writer's save would otherwise replace observations that were never written).
  const saveNowRef = useRef(saveNow);
  saveNowRef.current = saveNow;
  const unsavedRef = useRef(false);
  unsavedRef.current = hasPendingWrite || saveError != null;
  useEffect(() => {
    /** Flush + write if anything is unsaved; true when nothing is left unsaved afterwards. */
    const finalWrite = (): boolean => {
      const flushed = flushAllDrafts();
      if (flushed.rejected.length > 0 || flushed.unapplied > 0) return false;
      const dirty = flushed.accepted > 0 || unsavedRef.current || workspaceRef.current !== lastPersistedRef.current;
      return dirty ? saveNowRef.current() : true;
    };
    const onPageHide = () => {
      finalWrite();
    };
    const onHandOver = (): HandOverOutcome => {
      if (restoreInFlightRef.current) {
        return { ok: false, reason: 'the editing tab is restoring a backup' };
      }
      if (hasUnflushableDrafts()) {
        return { ok: false, reason: 'a dialog with unapplied changes is open in the editing tab' };
      }
      return finalWrite()
        ? { ok: true }
        : { ok: false, reason: 'the editing tab could not save its unsaved work (its last save failed)' };
    };
    window.addEventListener('pagehide', onPageHide);
    const offHandOver = onBeforeHandOver(onHandOver);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      offHandOver();
    };
  }, [workspaceRef]);

  /** Ask the editing tab for the lease, then load its final save. */
  const takeOver = useCallback(async (): Promise<boolean> => {
    if (!enabled) return true;
    const { state: next, refusal } = await requestTakeOver();
    if (next.role === 'writer') {
      reloadFromStorage();
      setSaveError(null);
      return true;
    }
    setSaveError(
      refusal
        ? `Could not take over editing — ${refusal}. Resolve that in the other tab and try again.`
        : 'Could not take over editing — the other tab did not respond. Close it and try again.'
    );
    return false;
  }, [enabled, reloadFromStorage]);

  /** The user downloaded the unpreserved original: clear it and let saves resume. */
  const acknowledgeUnpreservedOriginal = useCallback(() => {
    if (!originalUnpreservedRef.current) return;
    clearWorkspace();
    syncRevisionFromStorage();
    setOriginalUnpreserved(false);
    setSaveError(null);
    setLoadNotice(null);
  }, []);

  /** Replace the in-memory workspace with a restored one and write it immediately (writer-only). */
  /** Abort the restore in flight (its continuation sees a stale token and commits nothing). */
  const cancelRestore = useCallback(() => {
    if (!restoreInFlightRef.current) return;
    restoreTokenRef.current += 1;
    restoreInFlightRef.current = false;
    setRestoreInFlight(false);
    setSaveError(null);
  }, []);

  /**
   * Replace the in-memory workspace with a restored one and write it — atomically from the user's
   * point of view: the incoming receipt bytes are STAGED (the active ones untouched), the workspace
   * is written to storage FIRST and only then swapped into memory and the staged bytes promoted.
   * A failed write, a cancellation, or a guard that trips after the asynchronous phase leaves
   * memory, storage and the active receipt bytes exactly as they were.
   */
  const restoreWorkspace = useCallback(
    async (incoming: Workspace, artifacts: BackupArtifacts = {}): Promise<boolean> => {
      if (!enabled) {
        replaceWorkspace(incoming);
        return true;
      }
      if (restoreInFlightRef.current) {
        setSaveError('A backup restore is already in progress.');
        return false;
      }
      const blocked = writeBlocker({ forRestore: true });
      if (blocked) {
        setSaveError(blocked);
        return false;
      }
      restoreTokenRef.current += 1;
      const token = restoreTokenRef.current;
      restoreInFlightRef.current = true;
      setRestoreInFlight(true);
      // Every attempt writes its incoming bytes to keys of its own (named by the restored
      // receipts), so a cancelled attempt's cleanup can never touch a retry's bytes.
      const opId = `restore-${Date.now().toString(36)}-${token}`;
      let staged: Awaited<ReturnType<typeof stageBackupArtifacts>>['staged'] = {};
      try {
        const stagedResult = await stageBackupArtifacts(incoming, artifacts, opId);
        staged = stagedResult.staged;
        const next = stagedResult.workspace;
        // Cancelled or superseded while staging: commit nothing.
        if (restoreTokenRef.current !== token) {
          void discardStagedArtifacts(staged);
          return false;
        }
        const blockedAfter = writeBlocker({ forRestore: true });
        if (blockedAfter) {
          void discardStagedArtifacts(staged);
          setSaveError(`Restore cancelled — ${blockedAfter}`);
          return false;
        }
        // Storage first (synchronous, may throw) — memory and the active artifacts change only
        // once the durable write succeeded.
        try {
          syncRevisionFromStorage();
          saveWorkspace(next, { checkpoint: true });
        } catch (err) {
          void discardStagedArtifacts(staged);
          setSaveError(`Could not save the restored workspace: ${(err as Error).message}`);
          return false;
        }
        const replaced = workspaceRef.current;
        replaceWorkspace(next);
        lastPersistedRef.current = next;
        setLastSaved(new Date().toISOString());
        setSaveError(null);
        setHasPendingWrite(false);
        // Nothing left to promote: the restored receipts already name their acknowledged bytes.
        // The replaced workspace's artifacts are unreachable now — best-effort cleanup.
        void releaseReplacedArtifacts(replaced, next);
        return true;
      } finally {
        if (restoreTokenRef.current === token) {
          restoreInFlightRef.current = false;
          setRestoreInFlight(false);
        }
      }
    },
    [enabled, replaceWorkspace, writeBlocker, workspaceRef]
  );

  // Real persistence status (never part of `model` — must not reach YAML).
  // Memoized so the StoreContext value's identity is stable when nothing changed,
  // preserving the provider's re-render optimization.
  const persistence = useMemo(
    () => ({
      enabled,
      lastSaved,
      saveError,
      draftError,
      hasPendingWrite,
      hasPendingDrafts,
      hasUnappliedDrafts,
      loadNotice,
      loadOutcome,
      writer: writerState,
      preservationPending,
      originalUnpreserved,
      dismissLoadNotice,
      saveNow,
      takeOver,
      restoreWorkspace,
      acknowledgeUnpreservedOriginal,
      restoreInFlight,
      cancelRestore,
    }),
    [
      enabled,
      lastSaved,
      saveError,
      draftError,
      hasPendingWrite,
      hasPendingDrafts,
      hasUnappliedDrafts,
      loadNotice,
      loadOutcome,
      writerState,
      preservationPending,
      originalUnpreserved,
      dismissLoadNotice,
      saveNow,
      takeOver,
      restoreWorkspace,
      acknowledgeUnpreservedOriginal,
      restoreInFlight,
      cancelRestore,
    ]
  );

  return persistence;
}
