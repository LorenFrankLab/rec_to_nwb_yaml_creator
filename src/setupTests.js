import '@testing-library/jest-dom';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Import custom matchers
import './__tests__/helpers/custom-matchers';

// jsdom runs on an opaque origin (about:blank), so window.localStorage is not
// available by default. Provide a minimal in-memory Storage polyfill for tests
// that exercise persistence. Guarded so a real Storage (browser / configured
// jsdom) is left untouched.
if (typeof window !== 'undefined' && !window.localStorage) {
  const createMemoryStorage = () => {
    let store = new Map();
    return {
      getItem: (key) => (store.has(String(key)) ? store.get(String(key)) : null),
      setItem: (key, value) => {
        store.set(String(key), String(value));
      },
      removeItem: (key) => {
        store.delete(String(key));
      },
      clear: () => {
        store = new Map();
      },
      key: (index) => Array.from(store.keys())[index] ?? null,
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
