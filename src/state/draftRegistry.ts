/**
 * @fileoverview Registry of in-progress field drafts, so persistence can SEE what is being typed.
 *
 * Text fields commit to the store on a debounce while typing (and on blur), but between a keystroke
 * and that commit the newest value lives only in the input. Before this registry existed, the save
 * indicator, the Ctrl/Cmd+S flush and the `beforeunload` guard all read the committed workspace,
 * so "Saved just now" could be shown while a focused textarea still held text that a reload would
 * lose (review finding F3).
 *
 * Every draft-capable input registers a `{ isDirty, flush }` pair while mounted
 * ({@link module:hooks/useDraftField}). Persistence then:
 *   - reports {@link hasPendingDrafts} so the indicator/unload guard never claim durability while a
 *     draft is pending;
 *   - calls {@link flushAllDrafts} before an explicit save (Ctrl/Cmd+S, the Save button, pagehide)
 *     so the value being typed is committed — and, because commits go through the store's
 *     ref-lockstep `commitWorkspace`, immediately visible to the synchronous write that follows.
 *
 * A draft that CANNOT be flushed automatically (an unapplied setup-dialog edit that needs the
 * user's Save/Cancel decision) registers with `flush: null`: it arms the unload guard but is left
 * for the user to resolve.
 *
 * Module-level singleton, framework-free; React consumers subscribe via {@link subscribeDrafts}
 * (`useSyncExternalStore`-compatible).
 */

/** A registered draft: whether it currently differs from the store, and how to commit it. */
export interface DraftEntry {
  /** True while the input holds a value the store has not received. */
  isDirty: () => boolean;
  /** Commit the current value to the store. `null` when only the user can resolve it. */
  flush: (() => DraftFlushItemResult | void) | null;
  /** A short label for diagnostics (never shown as-is to users). */
  label?: string;
  /** Last rejected writer reason for this draft, if any. */
  error?: () => string | null;
  /** Stable workspace-record + field identity. A later mount replaces the stale writer. */
  key?: string;
}

/** Value retained while its writer has not accepted it, including across input unmount/remount. */
export interface RetainedDraft<T = unknown> {
  value: T;
  error: string | null;
}

export interface DraftFlushItemResult {
  accepted: boolean;
  reason?: string;
  error?: unknown;
}

export interface DraftFlushResult {
  attempted: number;
  accepted: number;
  rejected: DraftFlushItemResult[];
  unapplied: number;
}

const entries = new Map<symbol | string, DraftEntry>();
const retainedDrafts = new Map<string, RetainedDraft>();
const listeners = new Set<() => void>();
// A monotonic version the subscribers compare (useSyncExternalStore needs a stable snapshot).
let version = 0;

/**
 * Notify subscribers that some draft's dirty state may have changed. Called by the field hooks
 * on every local edit/commit; cheap (a version bump + listener fan-out).
 */
export function notifyDraftChange(): void {
  version += 1;
  listeners.forEach((listener) => listener());
}

/**
 * Register a draft-capable input. Returns the unregister function (call on unmount).
 *
 * @param entry - The draft entry.
 * @returns Unregister.
 */
export function registerDraft(entry: DraftEntry): () => void {
  const key = entry.key ?? Symbol('draft');
  entries.set(key, entry);
  notifyDraftChange();
  return () => {
    // A keyed input may have remounted and replaced this entry. Its old cleanup must not remove
    // the new writer.
    if (entries.get(key) === entry) {
      entries.delete(key);
      notifyDraftChange();
    }
  };
}

/** Read a rejected/pending value retained for a stable record-and-field key. */
export function getRetainedDraft<T>(key: string | undefined): RetainedDraft<T> | null {
  if (!key) return null;
  return (retainedDrafts.get(key) as RetainedDraft<T> | undefined) ?? null;
}

/** Retain the latest unaccepted value so a remounted field can restore it. */
export function retainDraft<T>(key: string | undefined, value: T, error: string | null): void {
  if (!key) return;
  retainedDrafts.set(key, { value, error });
  notifyDraftChange();
}

/** Dispose a retained value after acceptance or an explicit return to the committed value. */
export function clearRetainedDraft(key: string | undefined): void {
  if (!key || !retainedDrafts.delete(key)) return;
  notifyDraftChange();
}

/**
 * Whether any registered input holds an uncommitted value.
 *
 * @returns True when at least one draft is dirty.
 */
export function hasPendingDrafts(): boolean {
  for (const entry of entries.values()) {
    if (entry.isDirty()) return true;
  }
  return false;
}

/**
 * Whether any dirty draft can only be resolved by the user (an open dialog with unapplied edits).
 *
 * @returns True when a non-flushable dirty draft exists.
 */
export function hasUnflushableDrafts(): boolean {
  for (const entry of entries.values()) {
    if (entry.flush === null && entry.isDirty()) return true;
  }
  return false;
}

/** First rejected pending-draft reason, for truthful global save feedback. */
export function getPendingDraftError(): string | null {
  for (const entry of entries.values()) {
    if (entry.isDirty()) {
      const error = entry.error?.();
      if (error) return error;
    }
  }
  return null;
}

/**
 * Commit every dirty, flushable draft to the store. Safe to call when nothing is pending.
 *
 * @returns The number of drafts flushed.
 */
export function flushAllDrafts(): DraftFlushResult {
  const result: DraftFlushResult = { attempted: 0, accepted: 0, rejected: [], unapplied: 0 };
  for (const entry of entries.values()) {
    if (entry.flush && entry.isDirty()) {
      result.attempted += 1;
      try {
        const outcome = entry.flush();
        if (outcome?.accepted === false) result.rejected.push(outcome);
        else result.accepted += 1;
      } catch (error) {
        result.rejected.push({
          accepted: false,
          reason: error instanceof Error ? error.message : 'A pending edit could not be saved.',
          error,
        });
      }
    } else if (entry.flush === null && entry.isDirty()) {
      result.unapplied += 1;
    }
  }
  if (result.attempted > 0) notifyDraftChange();
  return result;
}

/**
 * Subscribe to draft-state changes (`useSyncExternalStore` contract).
 *
 * @param listener - Called after any change.
 * @returns Unsubscribe.
 */
export function subscribeDrafts(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * The current registry version (a snapshot token for `useSyncExternalStore`).
 *
 * @returns A monotonic integer.
 */
export function getDraftVersion(): number {
  return version;
}

/** Test-only: drop every registration. */
export function resetDraftRegistryForTests(): void {
  entries.clear();
  retainedDrafts.clear();
  listeners.clear();
  version = 0;
}
