import { useEffect } from 'react';

/**
 * Decoupled bridge between the app-level keyboard shortcuts (mounted in AppLayout)
 * and whichever stepper is currently on screen (DayEditor / AnimalEditor). The
 * shortcut hook lives at the top of the tree and cannot reach a stepper's local
 * step state directly, so it broadcasts a window CustomEvent the active stepper
 * subscribes to. Only one stepper is mounted per route, so there is no ambiguity.
 *
 * @module hooks/stepperShortcuts
 */

/** Window event name carrying `{ action: 'next' | 'prev' | 'add' }`. */
export const STEPPER_SHORTCUT_EVENT = 'workspace:stepper-shortcut';

/**
 * Broadcast a stepper navigation/add intent to the active stepper.
 *
 * @param {'next'|'prev'|'add'} action - The stepper intent.
 * @returns {void}
 */
export function emitStepperShortcut(action) {
  window.dispatchEvent(new CustomEvent(STEPPER_SHORTCUT_EVENT, { detail: { action } }));
}

/**
 * Subscribe the current stepper to stepper-shortcut events.
 *
 * @param {(action: 'next'|'prev'|'add') => void} handler - Called with the action.
 * @returns {void}
 */
export function useStepperShortcut(handler) {
  useEffect(() => {
    const listener = (event) => handler(event.detail?.action);
    window.addEventListener(STEPPER_SHORTCUT_EVENT, listener);
    return () => window.removeEventListener(STEPPER_SHORTCUT_EVENT, listener);
  }, [handler]);
}
