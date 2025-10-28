import '@testing-library/jest-dom';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Import custom matchers
import './__tests__/helpers/custom-matchers';

// Cleanup after each test
afterEach(() => {
  cleanup();
});
