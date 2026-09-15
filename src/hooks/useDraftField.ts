import { useCallback, useEffect, useRef, useState } from 'react';
import { notifyDraftChange, registerDraft } from '../state/draftRegistry';

/** Options for {@link useDraftField}. */
export interface UseDraftFieldOptions<T> {
  /** The committed (store) value. When it changes while the field is NOT dirty, the draft follows. */
  value: T;
  /** Commit a value to the store. */
  onCommit: (value: T) => void;
  /** Debounce before a typed value is committed (ms). Default 400. */
  debounceMs?: number;
  /** Equality used to decide dirtiness (default `Object.is`). */
  isEqual?: (a: T, b: T) => boolean;
  /** Diagnostics label. */
  label?: string;
}

/** The draft field API. */
export interface DraftField<T> {
  /** The value to render (the draft while typing, the committed value otherwise). */
  value: T;
  /** Set the draft (call from `onChange`). Schedules a debounced commit. */
  setValue: (next: T) => void;
  /** Commit immediately if dirty (call from `onBlur`, or from anything that needs the store current). */
  flush: () => void;
  /** Whether the draft differs from the committed value. */
  isDirty: boolean;
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
 * @returns The draft field API.
 */
export function useDraftField<T>({
  value,
  onCommit,
  debounceMs = 400,
  isEqual = Object.is,
  label,
}: UseDraftFieldOptions<T>): DraftField<T> {
  const [draft, setDraft] = useState<T>(value);
  const draftRef = useRef<T>(value);
  const committedRef = useRef<T>(value);
  const dirtyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    if (!dirtyRef.current) return;
    dirtyRef.current = false;
    committedRef.current = draftRef.current;
    onCommitRef.current(draftRef.current);
    notifyDraftChange();
  }, []);

  const setValue = useCallback(
    (next: T) => {
      draftRef.current = next;
      setDraft(next);
      dirtyRef.current = !isEqualRef.current(next, committedRef.current);
      notifyDraftChange();
      if (timerRef.current) clearTimeout(timerRef.current);
      if (dirtyRef.current) {
        timerRef.current = setTimeout(flush, debounceMs);
      } else {
        timerRef.current = null;
      }
    },
    [debounceMs, flush]
  );

  // Register with the draft registry for the field's lifetime; commit any pending draft on unmount.
  useEffect(() => {
    const unregister = registerDraft({ isDirty: () => dirtyRef.current, flush, label });
    return () => {
      flush();
      unregister();
    };
  }, [flush, label]);

  return { value: draft, setValue, flush, isDirty: dirtyRef.current };
}
