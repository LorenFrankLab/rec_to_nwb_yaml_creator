import '@testing-library/jest-dom';
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Add custom matchers
expect.extend({
  toBeValidYaml(received) {
    // Will be implemented in later task
    return { pass: true, message: () => '' };
  },
});
