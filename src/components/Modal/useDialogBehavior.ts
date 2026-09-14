import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

/** Elements a dialog may hand focus to, in DOM order. */
export const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface DialogBehaviorOptions {
  /** Whether the dialog is currently mounted/shown (default true). */
  isOpen?: boolean;
  /** Called for ESC. */
  onClose: () => void;
}

/**
 * The modal-dialog behaviors every dialog surface in the app owes its keyboard users:
 * ESC close, Tab containment, body-scroll lock, focus moved inside on open, and focus
 * returned to the opener on close.
 *
 * Focus lands on `[data-initial-focus]` when the content declares one, otherwise on the
 * first focusable element.
 *
 * Shared so a dialog fix lands once. Callers own their own markup, ARIA and layout — this
 * only wires behavior to the element `contentRef` points at.
 *
 * @param contentRef - The dialog's content element (the focus-trap boundary).
 * @param options - Open state and the close callback.
 * @param options.isOpen - Whether the dialog is shown (default true).
 * @param options.onClose - Called on Escape.
 */
export function useDialogBehavior(
  contentRef: RefObject<HTMLElement | null>,
  { isOpen = true, onClose }: DialogBehaviorOptions
): void {
  // Read through a ref so a caller passing an inline `onClose` doesn't retear down the
  // listeners (and the scroll lock / focus restore with them) on every render.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const content = contentRef.current;
    const opener = document.activeElement as HTMLElement | null;

    const initial =
      content?.querySelector<HTMLElement>('[data-initial-focus]') ??
      content?.querySelector<HTMLElement>(FOCUSABLE);
    initial?.focus();

    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab' || !contentRef.current) return;
      const focusable = Array.from(
        contentRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)
      ).filter((element) => !element.hasAttribute('hidden'));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!contentRef.current.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      if (typeof opener?.focus === 'function') opener.focus();
    };
  }, [isOpen, contentRef]);
}
