import '@testing-library/jest-dom';
import { afterEach, expect } from 'vitest';
import { cleanup } from '@testing-library/react';
import { toHaveNoViolations } from 'jest-axe';

// Import custom matchers
import './__tests__/helpers/custom-matchers';

// Suite-wide Axe matcher for the accessibility integration tests.
expect.extend(toHaveNoViolations);

// jsdom does not implement scrollIntoView; several components call it on
// focus/navigation. Provide a no-op so those code paths don't crash in tests.
if (typeof window !== 'undefined' && !window.HTMLElement.prototype.scrollIntoView) {
  window.HTMLElement.prototype.scrollIntoView = () => {};
}

// jsdom runs on an opaque origin (about:blank), so window.localStorage is not
// available by default. Provide a minimal in-memory Storage polyfill for tests
// that exercise persistence. Guarded so a real Storage (browser / configured
// jsdom) is left untouched.
if (typeof window !== 'undefined' && !window.localStorage) {
  const createMemoryStorage = () => {
    let store = new Map<string, string>();
    return {
      getItem: (key: string) => (store.has(String(key)) ? store.get(String(key)) : null),
      setItem: (key: string, value: string) => {
        store.set(String(key), String(value));
      },
      removeItem: (key: string) => {
        store.delete(String(key));
      },
      clear: () => {
        store = new Map<string, string>();
      },
      key: (index: number) => Array.from(store.keys())[index] ?? null,
      get length() {
        return store.size;
      },
    };
  };
  Object.defineProperty(window, 'localStorage', {
    value: createMemoryStorage(),
    configurable: true,
    writable: true,
  });
}

// Cleanup after each test
afterEach(() => {
  cleanup();
  // Keep persistence tests isolated: clear any workspace blob written by autosave.
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.clear();
  }
});
