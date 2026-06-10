import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  esbuild: {
    loader: 'jsx',
    include: /src\/.*\.jsx?$/,
    exclude: [],
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        '.js': 'jsx',
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'src/setupTests.js',
        '**/*.test.{js,jsx}',
        '**/__tests__/fixtures/**',
        'build/',
      ],
      all: true,
      lines: 80,
      functions: 80,
      branches: 80,
      statements: 80,
    },
    include: ['src/**/*.{test,spec}.{js,jsx}'],
    exclude: ['node_modules/', 'build/', 'dist/'],
    // Global per-test budget for the no-coverage run (the `npm test` correctness gate).
    // Heavy App-render integration tests are ~3s without coverage, so 30s is a wide
    // margin even on slow CI cores. The coverage run needs much more headroom: v8
    // instrumentation ~triples per-test wall-clock locally, and on the 4-core CI runner
    // the heaviest test (complete-session export) was observed >60s once slow cores +
    // oversubscription stack on top — so `test:coverage` raises this to 120s via
    // --testTimeout (see package.json). Per-test `{ timeout }` overrides were removed in
    // favor of these two central budgets (see the integration test files).
    testTimeout: 30000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tests': path.resolve(__dirname, './src/__tests__'),
      '@fixtures': path.resolve(__dirname, './src/__tests__/fixtures'),
    },
  },
});
