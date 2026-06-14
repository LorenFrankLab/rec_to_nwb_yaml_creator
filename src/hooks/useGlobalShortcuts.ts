import { useEffect, useRef } from 'react';

/** The latest keyboard-shortcut handlers; each binding is optional. */
interface ShortcutHandlers {
  onSave?: () => void;
  onNextStep?: () => void;
  onPrevStep?: () => void;
  onAdd?: () => void;
  onShowHelp?: () => void;
}

/**
 * Whether the event target is a text-entry surface where shortcuts must not fire.
 *
 * @param el - The keydown target (read defensively for the Element-only props).
 * @returns Whether shortcuts must be suppressed.
 */
function isEditableTarget(el: HTMLElement | null): boolean {
  if (!el || !el.tagName) return false;
  const tag = el.tagName.toUpperCase();
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable === true;
}

/**
 * Whether any shared `<Modal>` is open. Identified by `aria-modal="true"`, the
 * ARIA contract the shared Modal sets on its content box (a stable, semantic hook
 * rather than the overlay's now-hashed CSS-Module class).
 *
 * @returns
 */
function isModalOpen() {
  return typeof document !== 'undefined' && !!document.querySelector('[aria-modal="true"]');
}

/**
 * Global keyboard shortcuts, mounted once at the top of the app.
 *
 * Bindings (each a single, conflict-free chord — never overriding Tab/Enter/Space
 * or single letters AT reserves):
 * - **Ctrl/Cmd+S** — save (always `preventDefault`s the browser save dialog; only
 *   invokes `onSave` when not guarded).
 * - **Alt+ArrowRight / Alt+ArrowLeft** — next / previous stepper step.
 * - **Alt+N** — context add (e.g. add an epoch on the Epochs step).
 * - **? (Shift+/)** — open the shortcuts help.
 *
 * Guarded: while focus is in an input/textarea/select/contenteditable, or any modal
 * is open, the handlers do not fire (Ctrl/Cmd+S still suppresses the browser dialog
 * but does not save). The help dialog's own Esc-to-close is owned by `<Modal>`.
 *
 * @param handlers
 * @param [handlers.onSave]
 * @param [handlers.onNextStep]
 * @param [handlers.onPrevStep]
 * @param [handlers.onAdd]
 * @param [handlers.onShowHelp]
 * @returns
 */
export default function useGlobalShortcuts(handlers: ShortcutHandlers = {}): void {
  // Keep the latest handlers in a ref so the listener is attached once and never
  // goes stale, without re-binding on every render.
  const handlersRef = useRef<ShortcutHandlers>(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const { onSave, onNextStep, onPrevStep, onAdd, onShowHelp } = handlersRef.current;
      const guarded = isEditableTarget(e.target as HTMLElement | null) || isModalOpen();

      // Ctrl/Cmd+S: always prevent the browser save dialog; save only when unguarded.
      if ((e.metaKey || e.ctrlKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        if (!guarded) onSave?.();
        return;
      }

      if (guarded) return;

      // ? (Shift+/) — open help.
      if (e.key === '?') {
        e.preventDefault();
        onShowHelp?.();
        return;
      }

      // Alt-modified stepper / add shortcuts (Alt avoids AT virtual-cursor conflicts).
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          onNextStep?.();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          onPrevStep?.();
        } else if (e.key === 'n' || e.key === 'N') {
          e.preventDefault();
          onAdd?.();
        }
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);
}
