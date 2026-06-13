import { useEffect } from 'react';

/**
 * Warns the user before unloading the page while a workspace write is pending.
 *
 * Registers a `beforeunload` listener only while there is unsaved/in-flight work,
 * so the native "leave site?" prompt appears if the user navigates away before a
 * debounced save completes.
 *
 * @param hasUnsavedWork - true when a debounced save is in flight.
 * @returns
 */
export function useUnsavedWorkGuard(hasUnsavedWork: boolean): void {
  useEffect(() => {
    if (!hasUnsavedWork) return undefined;

    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = ''; // required for the native prompt in Chrome
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedWork]);
}
