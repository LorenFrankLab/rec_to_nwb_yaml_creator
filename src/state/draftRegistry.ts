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
  flush: (() => void) | null;
  /** A short label for diagnostics (never shown as-is to users). */
  label?: string;
}

const entries = new Map<symbol, DraftEntry>();
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
  const key = Symbol('draft');
  entries.set(key, entry);
  notifyDraftChange();
  return () => {
    entries.delete(key);
    notifyDraftChange();
  };
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

/**
 * Commit every dirty, flushable draft to the store. Safe to call when nothing is pending.
 *
 * @returns The number of drafts flushed.
 */
export function flushAllDrafts(): number {
  let flushed = 0;
  for (const entry of entries.values()) {
    if (entry.flush && entry.isDirty()) {
      entry.flush();
      flushed += 1;
    }
  }
  if (flushed > 0) notifyDraftChange();
  return flushed;
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
  listeners.clear();
  version = 0;
}
