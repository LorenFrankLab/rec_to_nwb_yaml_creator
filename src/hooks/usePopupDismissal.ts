import { useEffect } from 'react';
import type { RefObject } from 'react';

interface PopupDismissalOptions {
  /** Whether the popup is currently open; the listeners exist only while it is. */
  open: boolean;
  /** The element that toggles the popup (a click on it is its own onClick's business). */
  triggerRef: RefObject<HTMLElement | null>;
  /** The popup surface itself; a pointerdown inside it is not a dismissal. */
  popupRef: RefObject<HTMLElement | null>;
  /** Close the popup (without moving focus — the caller decides that for keyboard paths). */
  onDismiss: () => void;
}

/**
 * The two dismissals every anchored popup (menu, switcher) owes the page:
 *   - an outside pointerdown (pointerdown, not click, so it beats the popup's own item click);
 *   - a route change (this app is hash-routed) — back/forward, a keyboard-activated link, or
 *     programmatic routing never pass through an outside pointerdown, and an absolutely-positioned
 *     popup that survives them lingers over the next view and intercepts its first click.
 *
 * Keyboard dismissal (Escape → close and return focus) stays with the caller, whose roving-focus
 * model decides where focus goes.
 *
 * @param options - Open state, the trigger/popup elements, and the close callback.
 * @param options.open - Whether the popup is open (listeners exist only while it is).
 * @param options.triggerRef - The element that toggles the popup.
 * @param options.popupRef - The popup surface.
 * @param options.onDismiss - Closes the popup.
 */
export function usePopupDismissal({ open, triggerRef, popupRef, onDismiss }: PopupDismissalOptions): void {
  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (popupRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      onDismiss();
    };
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('hashchange', onDismiss);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('hashchange', onDismiss);
    };
  }, [open, triggerRef, popupRef, onDismiss]);
}
