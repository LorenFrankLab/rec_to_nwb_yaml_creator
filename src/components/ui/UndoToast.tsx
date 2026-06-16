import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import styles from './UndoToast.module.css';

export interface UndoToastProps {
  /** The message announced to the user (e.g. "Deleted day 20230622"). */
  message: string;
  /** Dismiss the toast (always provided — every toast can be dismissed). */
  onDismiss: () => void;
  /** Reverse the action. When given, an Undo button is shown; omit it for a non-reversible notice. */
  onUndo?: () => void;
  /** Auto-dismiss after this many ms. Omit to keep the toast until acted on. */
  autoHideMs?: number;
}

/**
 * UndoToast — the bottom-center confirmation for reversible actions (the "undo-for-reversible /
 * confirm-for-catastrophic" split). Announces politely via a `role="status"` live region; the Undo
 * affordance appears only when the action is reversible (`onUndo` given).
 */
const UndoToast = ({ message, onDismiss, onUndo, autoHideMs }: UndoToastProps) => {
  useEffect(() => {
    if (!autoHideMs) return undefined;
    const timer = setTimeout(onDismiss, autoHideMs);
    return () => clearTimeout(timer);
  }, [autoHideMs, onDismiss]);

  return (
    <div className={styles.toast} role="status" aria-live="polite">
      <span className={styles.message}>{message}</span>
      <div className={styles.actions}>
        {onUndo && (
          <button type="button" className={styles.undo} onClick={onUndo}>
            Undo
          </button>
        )}
        <button type="button" className={styles.dismiss} onClick={onDismiss} aria-label="Dismiss">
          ×
        </button>
      </div>
    </div>
  );
};

export default UndoToast;

interface ToastState {
  /** Monotonic id so each successive toast remounts with a fresh auto-hide timer. */
  id: number;
  message: string;
  onUndo?: () => void;
}

export interface UseUndoToast {
  /** Show a toast; pass `onUndo` to make it reversible. */
  show: (message: string, onUndo?: () => void) => void;
  /** The toast element to mount once in the page (null when nothing is showing). */
  node: ReactNode;
}

/**
 * useUndoToast — a host hook so a page mounts exactly one toast. `show(message, onUndo?)` raises it;
 * acting on Undo (or dismissing, or auto-hide) clears it. Undo runs the caller's handler and then
 * hides the toast.
 */
export function useUndoToast(autoHideMs = 6000): UseUndoToast {
  const [toast, setToast] = useState<ToastState | null>(null);
  const nextId = useRef(0);

  const dismiss = useCallback(() => setToast(null), []);
  const show = useCallback((message: string, onUndo?: () => void) => {
    nextId.current += 1;
    setToast({ id: nextId.current, message, onUndo });
  }, []);

  // `key={toast.id}` remounts the toast on each `show`, so its auto-hide effect re-runs and a new
  // toast never inherits the prior toast's already-running timer.
  const node = toast ? (
    <UndoToast
      key={toast.id}
      message={toast.message}
      autoHideMs={autoHideMs}
      onDismiss={dismiss}
      onUndo={
        toast.onUndo
          ? () => {
              toast.onUndo?.();
              dismiss();
            }
          : undefined
      }
    />
  ) : null;

  return { show, node };
}
