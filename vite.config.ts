/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ONE config for BOTH the app build (was `react-scripts`) and the Vitest test lane (was the
// separate `vitest.config.js`). Vite and Vitest share this file; the `test` block below is the
// former vitest.config.js merged in unchanged, so the test transform is byte-stable.
export default defineConfig(({ command }) => ({
  // GitHub Pages serves the PRODUCTION app under /rec_to_nwb_yaml_creator/ (was CRA's `homepage`
  // field). CRA applied that base only to the build and served dev at `/`; mirror that — a global
  // base would move the dev server to `/rec_to_nwb_yaml_creator/` and break Playwright + the
  // kill-stale-:3000 workflow, which drive `http://localhost:3000/`.
  base: command === 'build' ? '/rec_to_nwb_yaml_creator/' : '/',
  plugins: [react()],
  // Keep CRA's output dir so `gh-pages -d build` (deploy) and the CI build-artifact path are unchanged.
  build: { outDir: 'build' },
  // Match the port Playwright's webServer + baseURL expect (and the kill-stale-:3000 workflow).
  server: { port: 3000 },
  preview: { port: 3000 },
  esbuild: {
    // This codebase mixes JSX across extensions — `.jsx` components/tests, `.tsx`
    // modules, and any legacy JSX-in-`.js` — so the transform must parse JSX regardless
    // of extension. The `tsx` loader is a strict superset of `jsx`: it strips TypeScript
    // syntax AND parses JSX, so one loader covers JSX-in-`.js`, `.jsx` components, and
    // `.ts`/`.tsx` modules. (`tsx` is a no-op for TypeScript stripping on files that
    // contain no TypeScript, so existing `.js`/`.jsx` parsing is unchanged.)
    loader: 'tsx',
    include: /src\/.*\.(jsx?|tsx?)$/,
    exclude: [],
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        '.js': 'jsx',
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tests': path.resolve(__dirname, './src/__tests__'),
      '@fixtures': path.resolve(__dirname, './src/__tests__/fixtures'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      // Measure PRODUCTION source (covered or not), not just test-touched files — in Vitest 4 an
      // explicit `include` is what makes uncovered source count toward the percentages (the removed
      // `all: true` no longer does). Tests, fixtures, mocks, setup, type decls, and non-logic entry
      // points are excluded from the denominator.
      include: ['src/**/*.{js,jsx,ts,tsx}'],
      exclude: [
        'src/**/*.{test,spec}.{js,jsx,ts,tsx}',
        'src/**/__tests__/**',
        'src/**/__mocks__/**',
        'src/setupTests.ts',
        'src/**/*.d.ts',
        'src/index.tsx',
        'src/reportWebVitals.js',
      ],
      // Thresholds MUST be nested here in Vitest 4 (keys placed directly on `coverage` are silently
      // ignored — which made this gate vacuous). Set a few points below the measured whole-repo level
      // (statements ~94, branches ~87, functions ~92, lines ~95) so the gate catches REGRESSION
      // without flaking on run-to-run v8 variance; ratchet up as coverage improves.
      thresholds: { lines: 90, functions: 85, branches: 80, statements: 90 },
    },
    include: ['src/**/*.{test,spec}.{js,jsx,ts,tsx}'],
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
}));
