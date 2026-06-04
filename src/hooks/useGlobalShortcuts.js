import { useEffect, useRef } from 'react';

/**
 * Whether the event target is a text-entry surface where shortcuts must not fire.
 *
 * @param {EventTarget|null} el - The keydown target.
 * @returns {boolean}
 */
function isEditableTarget(el) {
  if (!el || !el.tagName) return false;
  const tag = el.tagName.toUpperCase();
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable === true;
}

/**
 * Whether any shared `<Modal>` (which renders `.modal-overlay`) is open.
 *
 * @returns {boolean}
 */
function isModalOpen() {
  return typeof document !== 'undefined' && !!document.querySelector('.modal-overlay');
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
 * @param {object} handlers
 * @param {() => void} [handlers.onSave]
 * @param {() => void} [handlers.onNextStep]
 * @param {() => void} [handlers.onPrevStep]
 * @param {() => void} [handlers.onAdd]
 * @param {() => void} [handlers.onShowHelp]
 * @returns {void}
 */
export default function useGlobalShortcuts(handlers = {}) {
  // Keep the latest handlers in a ref so the listener is attached once and never
  // goes stale, without re-binding on every render.
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const onKeyDown = (e) => {
      const { onSave, onNextStep, onPrevStep, onAdd, onShowHelp } = handlersRef.current;
      const guarded = isEditableTarget(e.target) || isModalOpen();

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
