import { useCallback, useEffect, useRef, useState } from 'react';
import {
  clearRetainedDraft,
  getRetainedDraft,
  notifyDraftChange,
  registerDraft,
  retainDraft,
} from '../state/draftRegistry';
import type { DraftFlushItemResult } from '../state/draftRegistry';
import { normalizeCommitResponse, rejectedCommit } from '../state/commitResult';
import type { CommitResponse } from '../state/commitResult';

/** Options for {@link useDraftField}. */
export interface UseDraftFieldOptions<T> {
  /** The committed (store) value. When it changes while the field is NOT dirty, the draft follows. */
  value: T;
  /** Commit a value to the store. */
  onCommit: (value: T) => CommitResponse;
  /** Debounce before a typed value is committed (ms). Default 400. */
  debounceMs?: number;
  /** Equality used to decide dirtiness (default `Object.is`). */
  isEqual?: (a: T, b: T) => boolean;
  /** Diagnostics label. */
  label?: string;
  /** Stable workspace-record + semantic-field key used to restore rejected drafts after remount. */
  draftKey?: string;
}

/** The draft field API. */
export interface DraftField<T> {
  /** The value to render (the draft while typing, the committed value otherwise). */
  value: T;
  /** Set the draft (call from `onChange`). Schedules a debounced commit. */
  setValue: (next: T) => void;
  /** Commit immediately if dirty (call from `onBlur`, or from anything that needs the store current). */
  flush: () => DraftFlushItemResult;
  /** Whether the draft differs from the committed value. */
  isDirty: boolean;
  /** Last rejected commit message, cleared after a successful commit or a new edit. */
  commitError: string | null;
}

/**
 * A text-field draft that the persistence layer can see.
 *
 * Keeps a local draft so typing is never lost to a remount, commits it to the store on a debounce
 * and on blur, and registers with the draft registry so `saveNow` / `beforeunload` / the save
 * indicator account for it (see {@link module:state/draftRegistry}). Validation stays the caller's
 * concern (typically on blur).
 *
 * The draft is committed on unmount too, so navigating away mid-edit does not drop the text.
 *
 * @param options - See {@link UseDraftFieldOptions}.
 * @param options.value - The committed value.
 * @param options.onCommit - Commit callback.
 * @param options.debounceMs - Debounce (ms).
 * @param options.isEqual - Dirtiness equality.
 * @param options.label - Diagnostics label.
 * @param options.draftKey - Stable record-and-field identity for remount recovery.
 * @returns The draft field API.
 */
export function useDraftField<T>({
  value,
  onCommit,
  debounceMs = 400,
  isEqual = Object.is,
  label,
  draftKey,
}: UseDraftFieldOptions<T>): DraftField<T> {
  const retainedAtMount = useRef(getRetainedDraft<T>(draftKey));
  const initialDraft = retainedAtMount.current?.value ?? value;
  const initialError = retainedAtMount.current?.error ?? null;
  const [draft, setDraft] = useState<T>(initialDraft);
  const [commitError, setCommitError] = useState<string | null>(initialError);
  const commitErrorRef = useRef<string | null>(initialError);
  const draftRef = useRef<T>(initialDraft);
  const committedRef = useRef<T>(value);
  const dirtyRef = useRef(!isEqual(initialDraft, value));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(false);
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;
  const isEqualRef = useRef(isEqual);
  isEqualRef.current = isEqual;

  // Follow an external (store) change only while the field is clean — a draft in progress wins.
  useEffect(() => {
    committedRef.current = value;
    if (!dirtyRef.current) {
      draftRef.current = value;
      setDraft(value);
    }
  }, [value]);

  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!dirtyRef.current) return { accepted: true };
    try {
      const result = normalizeCommitResponse(onCommitRef.current(draftRef.current));
      if (!result.accepted) {
        commitErrorRef.current = result.reason;
        retainDraft(draftKey, draftRef.current, result.reason);
        if (mountedRef.current) setCommitError(result.reason);
        notifyDraftChange();
        return result;
      }
      dirtyRef.current = false;
      committedRef.current = draftRef.current;
      commitErrorRef.current = null;
      clearRetainedDraft(draftKey);
      if (mountedRef.current) setCommitError(null);
      notifyDraftChange();
      return result;
    } catch (error) {
      const result = rejectedCommit(error);
      commitErrorRef.current = result.reason;
      retainDraft(draftKey, draftRef.current, result.reason);
      if (mountedRef.current) setCommitError(result.reason);
      notifyDraftChange();
      return result;
    }
  }, [draftKey]);

  const setValue = useCallback(
    (next: T) => {
      draftRef.current = next;
      setDraft(next);
      commitErrorRef.current = null;
      setCommitError(null);
      dirtyRef.current = !isEqualRef.current(next, committedRef.current);
      if (dirtyRef.current) retainDraft(draftKey, next, null);
      else clearRetainedDraft(draftKey);
      notifyDraftChange();
      if (timerRef.current) clearTimeout(timerRef.current);
      if (dirtyRef.current) {
        timerRef.current = setTimeout(flush, debounceMs);
      } else {
        timerRef.current = null;
      }
    },
    [debounceMs, draftKey, flush]
  );

  // Register with the draft registry for the field's lifetime; commit any pending draft on unmount.
  useEffect(() => {
    mountedRef.current = true;
    let unregister = () => {};
    const registeredFlush = () => {
      const result = flush();
      // Once a writer accepts a retained value after its input has unmounted, remove the stale
      // registration. A remounted keyed field replaces this entry before it can run.
      if (!mountedRef.current && result.accepted) unregister();
      return result;
    };
    const entry = {
      isDirty: () => dirtyRef.current,
      flush: registeredFlush,
      label,
      key: draftKey,
      error: () => commitErrorRef.current,
    };
    unregister = registerDraft(entry);
    return () => {
      mountedRef.current = false;
      const result = flush();
      // A rejected edit must remain registered after its input unmounts, so global Save, writer
      // handover, and the unload guard still see it and can retry the original writer.
      if (result.accepted) unregister();
    };
  }, [draftKey, flush, label]);

  return { value: draft, setValue, flush, isDirty: dirtyRef.current, commitError };
}
