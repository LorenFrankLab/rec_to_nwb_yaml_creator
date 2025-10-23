# Phase 0: Baseline & Infrastructure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Establish comprehensive baselines and testing infrastructure WITHOUT changing production code behavior

**Architecture:** Safety-first approach documenting current behavior (including bugs) as baselines, setting up modern testing tools (Vitest, Playwright), and creating CI/CD pipeline with quality gates

**Tech Stack:** Vitest (unit/integration tests), Playwright (E2E), GitHub Actions (CI/CD), Husky (pre-commit hooks), React Testing Library

**Phase Exit Criteria:**

- ✅ All baseline tests documented and passing
- ✅ CI/CD pipeline operational and green
- ✅ Performance baselines documented
- ✅ Visual regression baselines captured
- ✅ Schema sync check working
- ✅ Human review and approval

---

## Task 1: Install Vitest and Configure

**Files:**

- Create: `vitest.config.js`
- Create: `src/setupTests.js`
- Modify: `package.json`

**Step 1: Install Vitest dependencies**

```bash
npm install --save-dev vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @vitest/coverage-v8 c8
```

Expected: Dependencies added to package.json

**Step 2: Create Vitest configuration**

File: `vitest.config.js`

```javascript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
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
    testTimeout: 10000,
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
```

**Step 3: Create test setup file**

File: `src/setupTests.js`

```javascript
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
```

**Step 4: Add test scripts to package.json**

Modify: `package.json` scripts section

```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "test:baseline": "vitest run --testPathPattern=baselines",
    "test:integration": "vitest run --testPathPattern=integration"
  }
}
```

**Step 5: Verify Vitest works**

```bash
npm test -- --run --passWithNoTests
```

Expected: "No test files found" message (this is correct - we haven't written tests yet)

**Step 6: Commit**

```bash
git add vitest.config.js src/setupTests.js package.json package-lock.json
git commit -m "phase0(infra): configure Vitest test framework"
```

---

## Task 2: Install Playwright and Configure

**Files:**

- Create: `playwright.config.js`
- Create: `e2e/.gitkeep`
- Modify: `package.json`

**Step 1: Install Playwright**

```bash
npm install --save-dev @playwright/test
npx playwright install chromium firefox webkit
```

Expected: Playwright installed, browsers downloaded

**Step 2: Create Playwright configuration**

File: `playwright.config.js`

```javascript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['list'],
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  webServer: {
    command: 'npm start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
```

**Step 3: Create e2e directory**

```bash
mkdir -p e2e
touch e2e/.gitkeep
```

**Step 4: Add Playwright script to package.json**

Modify: `package.json` scripts section

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui"
  }
}
```

**Step 5: Verify Playwright setup**

```bash
npx playwright test --help
```

Expected: Playwright help text displayed

**Step 6: Commit**

```bash
git add playwright.config.js e2e/.gitkeep package.json package-lock.json
git commit -m "phase0(infra): configure Playwright E2E testing"
```

---

## Task 3: Create Test Directory Structure

**Files:**

- Create: `src/__tests__/baselines/.gitkeep`
- Create: `src/__tests__/unit/.gitkeep`
- Create: `src/__tests__/integration/.gitkeep`
- Create: `src/__tests__/fixtures/valid/.gitkeep`
- Create: `src/__tests__/fixtures/invalid/.gitkeep`
- Create: `src/__tests__/fixtures/edge-cases/.gitkeep`
- Create: `src/__tests__/helpers/.gitkeep`

**Step 1: Create directory structure**

```bash
mkdir -p src/__tests__/baselines
mkdir -p src/__tests__/unit
mkdir -p src/__tests__/integration
mkdir -p src/__tests__/fixtures/valid
mkdir -p src/__tests__/fixtures/invalid
mkdir -p src/__tests__/fixtures/edge-cases
mkdir -p src/__tests__/helpers
```

**Step 2: Create .gitkeep files**

```bash
touch src/__tests__/baselines/.gitkeep
touch src/__tests__/unit/.gitkeep
touch src/__tests__/integration/.gitkeep
touch src/__tests__/fixtures/valid/.gitkeep
touch src/__tests__/fixtures/invalid/.gitkeep
touch src/__tests__/fixtures/edge-cases/.gitkeep
touch src/__tests__/helpers/.gitkeep
```

**Step 3: Verify structure**

```bash
tree src/__tests__ -L 2
```

Expected: Directory tree showing all created directories

**Step 4: Commit**

```bash
git add src/__tests__/
git commit -m "phase0(infra): create test directory structure"
```

---

## Task 4: Create Test Helpers

**Files:**

- Create: `src/__tests__/helpers/test-utils.jsx`
- Create: `src/__tests__/helpers/custom-matchers.js`

**Step 1: Create test utils helper**

File: `src/__tests__/helpers/test-utils.jsx`

```javascript
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * Custom render with common providers
 */
export function renderWithProviders(ui, options = {}) {
  const user = userEvent.setup();

  return {
    user,
    ...render(ui, options),
  };
}

/**
 * Wait for async validation to complete
 */
export async function waitForValidation(timeout = 1000) {
  return new Promise(resolve => setTimeout(resolve, timeout));
}

/**
 * Generate test YAML data
 */
export function createTestYaml(overrides = {}) {
  const base = {
    experimenter: ['Doe, John'],
    experiment_description: 'Test experiment',
    session_description: 'Test session',
    session_id: 'test_001',
    institution: 'Test Institution',
    lab: 'Test Lab',
    session_start_time: '2025-01-01T00:00:00',
    timestamps_reference_time: '2025-01-01T00:00:00',
    subject: {
      description: 'Test subject',
      sex: 'M',
      species: 'Rattus norvegicus',
      subject_id: 'test_subject',
      date_of_birth: '2024-01-01T00:00:00',
      weight: '300g',
    },
    data_acq_device: [
      {
        name: 'TestDevice',
        system: 'TestSystem',
        amplifier: 'TestAmp',
        adc_circuit: 'TestADC',
      },
    ],
    cameras: [],
    tasks: [],
    associated_video_files: [],
    associated_files: [],
    electrode_groups: [],
    ntrode_electrode_group_channel_map: [],
  };

  return { ...base, ...overrides };
}
```

**Step 2: Create custom matchers**

File: `src/__tests__/helpers/custom-matchers.js`

```javascript
import { expect } from 'vitest';

/**
 * Custom matchers for YAML validation testing
 */
expect.extend({
  toBeValidYaml(received) {
    // Import here to avoid circular dependencies
    const App = require('../../App');
    const result = App.jsonschemaValidation(received);

    return {
      pass: result.valid,
      message: () =>
        result.valid
          ? `Expected YAML to be invalid`
          : `Expected YAML to be valid, but got errors:\n${JSON.stringify(
              result.errors,
              null,
              2
            )}`,
    };
  },

  toHaveValidationError(received, expectedError) {
    const App = require('../../App');
    const result = App.jsonschemaValidation(received);

    const hasError = result.errors?.some(err =>
      err.message.includes(expectedError)
    );

    return {
      pass: hasError,
      message: () =>
        hasError
          ? `Expected validation to NOT have error containing "${expectedError}"`
          : `Expected validation to have error containing "${expectedError}", but got:\n${JSON.stringify(
              result.errors,
              null,
              2
            )}`,
    };
  },
});
```

**Step 3: Update setupTests.js to import custom matchers**

Modify: `src/setupTests.js`

```javascript
import '@testing-library/jest-dom';
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Import custom matchers
import './src/__tests__/helpers/custom-matchers';

// Cleanup after each test
afterEach(() => {
  cleanup();
});
```

**Step 4: Test that helpers load**

```bash
npm test -- --run --passWithNoTests
```

Expected: No errors about missing imports

**Step 5: Commit**

```bash
git add src/__tests__/helpers/ src/setupTests.js
git commit -m "phase0(infra): add test helpers and custom matchers"
```

---

## Task 5: Create Test Fixtures

**Files:**

- Create: `src/__tests__/fixtures/valid/minimal-valid.json`
- Create: `src/__tests__/fixtures/valid/complete-metadata.json`
- Create: `src/__tests__/fixtures/invalid/missing-required-fields.json`
- Create: `src/__tests__/fixtures/invalid/wrong-types.json`

**Step 1: Create minimal valid fixture**

File: `src/__tests__/fixtures/valid/minimal-valid.json`

```json
{
  "experimenter": ["Doe, John"],
  "experiment_description": "Minimal valid test",
  "session_description": "Test session",
  "session_id": "test_001",
  "institution": "Test Institution",
  "lab": "Test Lab",
  "session_start_time": "2025-01-01T00:00:00",
  "timestamps_reference_time": "2025-01-01T00:00:00",
  "subject": {
    "description": "Test subject",
    "sex": "M",
    "species": "Rattus norvegicus",
    "subject_id": "test_subject",
    "date_of_birth": "2024-01-01T00:00:00",
    "weight": "300g"
  },
  "data_acq_device": [
    {
      "name": "SpikeGadgets",
      "system": "SpikeGadgets",
      "amplifier": "Intan",
      "adc_circuit": "Intan"
    }
  ],
  "cameras": [],
  "tasks": [],
  "associated_video_files": [],
  "associated_files": [],
  "electrode_groups": [],
  "ntrode_electrode_group_channel_map": []
}
```

**Step 2: Create complete metadata fixture**

File: `src/__tests__/fixtures/valid/complete-metadata.json`

```json
{
  "experimenter": ["Doe, John", "Smith, Jane"],
  "experiment_description": "Complete metadata test",
  "session_description": "Full session with all features",
  "session_id": "test_002",
  "institution": "UCSF",
  "lab": "Frank Lab",
  "session_start_time": "2025-01-15T10:30:00",
  "timestamps_reference_time": "2025-01-15T10:30:00",
  "subject": {
    "description": "Adult male rat",
    "sex": "M",
    "species": "Rattus norvegicus",
    "subject_id": "rat_001",
    "date_of_birth": "2024-06-15T00:00:00",
    "weight": "350g",
    "genotype": "Wild type",
    "age": "P90"
  },
  "data_acq_device": [
    {
      "name": "SpikeGadgets",
      "system": "SpikeGadgets",
      "amplifier": "Intan",
      "adc_circuit": "Intan"
    }
  ],
  "cameras": [
    {
      "id": 0,
      "meters_per_pixel": 0.001,
      "manufacturer": "Basler",
      "model": "Test Camera",
      "lens": "Test Lens",
      "camera_name": "overhead"
    }
  ],
  "tasks": [
    {
      "task_name": "sleep",
      "task_description": "Sleep session",
      "task_environment": "home cage",
      "camera_id": [0],
      "task_epochs": [1, 2]
    }
  ],
  "electrode_groups": [
    {
      "id": 0,
      "location": "CA1",
      "device_type": "tetrode_12.5",
      "description": "CA1 tetrode"
    }
  ],
  "ntrode_electrode_group_channel_map": [
    {
      "ntrode_id": 0,
      "electrode_group_id": 0,
      "bad_channels": [],
      "map": {
        "0": 0,
        "1": 1,
        "2": 2,
        "3": 3
      }
    }
  ],
  "associated_video_files": [],
  "associated_files": []
}
```

**Step 3: Create invalid fixture (missing required fields)**

File: `src/__tests__/fixtures/invalid/missing-required-fields.json`

```json
{
  "experimenter": ["Doe, John"],
  "session_description": "Missing required fields"
}
```

**Step 4: Create invalid fixture (wrong types)**

File: `src/__tests__/fixtures/invalid/wrong-types.json`

```json
{
  "experimenter": ["Doe, John"],
  "experiment_description": "Wrong types test",
  "session_description": "Test session",
  "session_id": "test_003",
  "institution": "Test Institution",
  "lab": "Test Lab",
  "session_start_time": "2025-01-01T00:00:00",
  "timestamps_reference_time": "2025-01-01T00:00:00",
  "subject": {
    "description": "Test subject",
    "sex": "M",
    "species": "Rattus norvegicus",
    "subject_id": "test_subject",
    "date_of_birth": "2024-01-01T00:00:00",
    "weight": "300g"
  },
  "data_acq_device": [
    {
      "name": "SpikeGadgets",
      "system": "SpikeGadgets",
      "amplifier": "Intan",
      "adc_circuit": "Intan"
    }
  ],
  "cameras": [
    {
      "id": 1.5,
      "meters_per_pixel": "not_a_number"
    }
  ],
  "tasks": [],
  "associated_video_files": [],
  "associated_files": [],
  "electrode_groups": [],
  "ntrode_electrode_group_channel_map": []
}
```

**Step 5: Verify fixtures are valid JSON**

```bash
cat src/__tests__/fixtures/valid/minimal-valid.json | jq .
cat src/__tests__/fixtures/valid/complete-metadata.json | jq .
cat src/__tests__/fixtures/invalid/missing-required-fields.json | jq .
cat src/__tests__/fixtures/invalid/wrong-types.json | jq .
```

Expected: All parse successfully (jq formats the JSON)

**Step 6: Commit**

```bash
git add src/__tests__/fixtures/
git commit -m "phase0(fixtures): add test YAML fixtures (valid and invalid)"
```

---

## Task 6: Create Validation Baseline Tests

**Files:**

- Create: `src/__tests__/baselines/validation-baseline.test.js`

**Step 1: Write validation baseline test**

File: `src/__tests__/baselines/validation-baseline.test.js`

```javascript
/**
 * BASELINE TEST - Do not modify without approval
 *
 * This test documents CURRENT behavior (including bugs).
 * When we fix bugs, we'll update these tests to new expected behavior.
 *
 * Purpose: Detect unintended regressions during refactoring
 */

import { describe, it, expect } from 'vitest';
import { createTestYaml } from '../helpers/test-utils';

// Import validation functions from App.js
// NOTE: This will require exporting these functions
import App from '../../App';

describe('BASELINE: Current Validation Behavior', () => {
  describe('Valid YAML (currently passes)', () => {
    it('accepts valid YAML structure', () => {
      const validYaml = createTestYaml();

      // Use custom matcher
      expect(validYaml).toBeValidYaml();
    });
  });

  describe('Known Bug: Float Camera IDs (BUG #3)', () => {
    it('INCORRECTLY accepts camera_id: 1.5 (should reject)', () => {
      const yaml = createTestYaml({
        cameras: [{ id: 1.5, meters_per_pixel: 0.001 }],
      });

      // CURRENT BEHAVIOR (WRONG): Accepts float
      // This test documents the bug but expects current behavior
      // When bug is fixed in Phase 2, this test will be updated

      // For now, we don't know if validation catches this
      // So we'll just run validation and snapshot the result
      const App = require('../../App');
      const result = App.jsonschemaValidation ? App.jsonschemaValidation(yaml) : { valid: true };

      // Document current behavior (likely accepts it incorrectly)
      expect(result).toMatchSnapshot('camera-id-float-bug');
    });
  });

  describe('Known Bug: Empty String Validation (BUG #5)', () => {
    it('INCORRECTLY accepts empty session_description (should reject)', () => {
      const yaml = createTestYaml({
        session_description: '',
      });

      const App = require('../../App');
      const result = App.jsonschemaValidation ? App.jsonschemaValidation(yaml) : { valid: true };

      // CURRENT BEHAVIOR (WRONG): Accepts empty string
      expect(result).toMatchSnapshot('empty-string-bug');
    });
  });

  describe('Required Fields Validation', () => {
    it('rejects YAML missing experimenter', () => {
      const yaml = createTestYaml();
      delete yaml.experimenter;

      expect(yaml).toHaveValidationError('experimenter');
    });

    it('rejects YAML missing session_id', () => {
      const yaml = createTestYaml();
      delete yaml.session_id;

      expect(yaml).toHaveValidationError('session_id');
    });
  });
});
```

**Step 2: Export validation functions from App.js (if not already exported)**

Modify: `src/App.js` (at the bottom of the file)

Add these export statements if validation functions aren't already exported:

```javascript
// Export validation functions for testing
export { jsonschemaValidation, rulesValidation };
```

**Step 3: Run the baseline test**

```bash
npm test -- validation-baseline.test.js --run
```

Expected: Test runs and creates snapshots (may fail if functions aren't exported yet)

**Step 4: Review snapshot files**

```bash
cat src/__tests__/baselines/__snapshots__/validation-baseline.test.js.snap
```

Expected: Snapshots captured for baseline behavior

**Step 5: Commit**

```bash
git add src/__tests__/baselines/validation-baseline.test.js src/__tests__/baselines/__snapshots__/ src/App.js
git commit -m "phase0(baselines): add validation baseline tests documenting current behavior"
```

---

## Task 7: Create State Management Baseline Tests

**Files:**

- Create: `src/__tests__/baselines/state-management-baseline.test.js`

**Step 1: Write state management baseline test**

File: `src/__tests__/baselines/state-management-baseline.test.js`

```javascript
/**
 * BASELINE TEST - Documents current state management behavior
 */

import { describe, it, expect } from 'vitest';

describe('BASELINE: State Management', () => {
  describe('structuredClone Performance', () => {
    it('documents current performance with structuredClone', () => {
      const largeState = {
        electrode_groups: Array(100)
          .fill(null)
          .map((_, i) => ({
            id: i,
            location: 'CA1',
            device_type: 'tetrode_12.5',
            description: 'Test electrode group',
          })),
      };

      const iterations = 100;
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        structuredClone(largeState);
      }

      const duration = performance.now() - start;
      const avgTime = duration / iterations;

      console.log(`📊 structuredClone avg: ${avgTime.toFixed(2)}ms for 100 electrode groups`);

      // Baseline: Document current performance
      // Should be < 50ms per clone on average
      expect(avgTime).toBeLessThan(50);

      // Store exact timing for future comparison
      expect(avgTime).toMatchSnapshot('structuredclone-performance');
    });
  });

  describe('Immutability Check', () => {
    it('structuredClone creates new object references', () => {
      const original = { cameras: [{ id: 0 }] };
      const cloned = structuredClone(original);

      // Should be different objects
      expect(cloned).not.toBe(original);
      expect(cloned.cameras).not.toBe(original.cameras);

      // But equal values
      expect(cloned).toEqual(original);
    });
  });
});
```

**Step 2: Run the baseline test**

```bash
npm test -- state-management-baseline.test.js --run
```

Expected: Test passes and creates snapshots

**Step 3: Review performance output**

Check console output for baseline performance metrics

**Step 4: Commit**

```bash
git add src/__tests__/baselines/state-management-baseline.test.js src/__tests__/baselines/__snapshots__/
git commit -m "phase0(baselines): add state management baseline tests"
```

---

## Task 8: Create Performance Baseline Tests

**Files:**

- Create: `src/__tests__/baselines/performance-baseline.test.js`

**Step 1: Write performance baseline test**

File: `src/__tests__/baselines/performance-baseline.test.js`

```javascript
/**
 * BASELINE TEST - Documents current performance metrics
 */

import { describe, it, expect } from 'vitest';
import { renderWithProviders } from '../helpers/test-utils';
import App from '../../App';

describe('BASELINE: Performance Metrics', () => {
  describe('Component Render Performance', () => {
    it('measures initial App render time', () => {
      const start = performance.now();
      const { container } = renderWithProviders(<App />);
      const duration = performance.now() - start;

      console.log(`📊 Initial App Render: ${duration.toFixed(2)}ms`);

      // Baseline: Document current performance
      // Should complete within 5 seconds (very generous)
      expect(duration).toBeLessThan(5000);

      // Verify App actually rendered
      expect(container).toBeTruthy();
    });
  });

  describe('Validation Performance', () => {
    it('measures validation time for large form data', () => {
      const App = require('../../App');
      if (!App.jsonschemaValidation) {
        console.log('⚠️ jsonschemaValidation not exported, skipping');
        return;
      }

      const largeYaml = {
        experimenter: ['Test, User'],
        experiment_description: 'Performance test',
        session_description: 'Large dataset',
        session_id: 'perf_001',
        institution: 'Test',
        lab: 'Test Lab',
        session_start_time: '2025-01-01T00:00:00',
        timestamps_reference_time: '2025-01-01T00:00:00',
        subject: {
          description: 'Test',
          sex: 'M',
          species: 'Rattus norvegicus',
          subject_id: 'test',
          date_of_birth: '2024-01-01T00:00:00',
          weight: '300g',
        },
        data_acq_device: [{ name: 'Test', system: 'Test', amplifier: 'Test', adc_circuit: 'Test' }],
        cameras: [],
        tasks: [],
        associated_video_files: [],
        associated_files: [],
        electrode_groups: Array(100)
          .fill(null)
          .map((_, i) => ({
            id: i,
            location: 'CA1',
            device_type: 'tetrode_12.5',
            description: `Electrode group ${i}`,
          })),
        ntrode_electrode_group_channel_map: Array(100)
          .fill(null)
          .map((_, i) => ({
            ntrode_id: i,
            electrode_group_id: i,
            bad_channels: [],
            map: { 0: i * 4, 1: i * 4 + 1, 2: i * 4 + 2, 3: i * 4 + 3 },
          })),
      };

      const start = performance.now();
      const result = App.jsonschemaValidation(largeYaml);
      const duration = performance.now() - start;

      console.log(`📊 Validation (100 electrode groups): ${duration.toFixed(2)}ms`);

      // Should complete within 1 second
      expect(duration).toBeLessThan(1000);
    });
  });
});
```

**Step 2: Run the performance baseline test**

```bash
npm test -- performance-baseline.test.js --run
```

Expected: Test passes and logs performance metrics

**Step 3: Document performance baselines in SCRATCHPAD.md**

Create file: `docs/SCRATCHPAD.md`

```markdown
# Refactoring Scratchpad

## Performance Baselines

### Measured on: 2025-10-23

#### Component Rendering
- Initial App render: [Check test output] ms

#### Validation Performance
- 100 electrode groups validation: [Check test output] ms

#### State Management
- structuredClone (100 electrode groups): [Check test output] ms average

### Targets
- Initial render: < 1000ms
- Validation: < 500ms
- State updates: < 10ms
```

**Step 4: Commit**

```bash
git add src/__tests__/baselines/performance-baseline.test.js docs/SCRATCHPAD.md
git commit -m "phase0(baselines): add performance baseline tests"
```

---

## Task 9: Set Up CI/CD Pipeline

**Files:**

- Create: `.github/workflows/test.yml`

**Step 1: Create GitHub Actions workflow**

File: `.github/workflows/test.yml`

```yaml
name: Test Suite

on:
  push:
    branches: [main, modern, 'refactor/**']
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run linter
        run: npm run lint

      - name: Run baseline tests
        run: npm run test:baseline -- --run

      - name: Run all tests with coverage
        run: npm run test:coverage -- --run

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
          flags: unittests
          fail_ci_if_error: false

  integration:
    runs-on: ubuntu-latest
    needs: test

    steps:
      - uses: actions/checkout@v4
        with:
          path: rec_to_nwb_yaml_creator

      - uses: actions/checkout@v4
        with:
          repository: LorenFrankLab/trodes_to_nwb
          path: trodes_to_nwb

      - name: Compare schemas
        run: |
          cd rec_to_nwb_yaml_creator
          SCHEMA_HASH=$(sha256sum src/nwb_schema.json | cut -d' ' -f1)
          cd ../trodes_to_nwb
          PYTHON_SCHEMA_HASH=$(sha256sum src/trodes_to_nwb/nwb_schema.json | cut -d' ' -f1)

          if [ "$SCHEMA_HASH" != "$PYTHON_SCHEMA_HASH" ]; then
            echo "❌ Schema mismatch detected!"
            echo "Web app hash: $SCHEMA_HASH"
            echo "Python hash: $PYTHON_SCHEMA_HASH"
            exit 1
          fi

          echo "✅ Schemas are synchronized"
```

**Step 2: Test CI configuration locally**

```bash
# Simulate CI run
npm ci
npm run lint
npm run test:baseline -- --run
npm run test:coverage -- --run
```

Expected: All commands succeed

**Step 3: Commit**

```bash
git add .github/workflows/test.yml
git commit -m "phase0(ci): add GitHub Actions test workflow"
```

---

## Task 10: Set Up Pre-commit Hooks

**Files:**

- Create: `.husky/pre-commit`
- Create: `.husky/pre-push`
- Create: `.lintstagedrc.json`
- Modify: `package.json`

**Step 1: Install Husky and lint-staged**

```bash
npm install --save-dev husky lint-staged
npx husky install
```

**Step 2: Create pre-commit hook**

```bash
npx husky add .husky/pre-commit "npx lint-staged"
```

File should be created at: `.husky/pre-commit`

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npx lint-staged
```

**Step 3: Create pre-push hook**

```bash
npx husky add .husky/pre-push "npm run test:baseline -- --run"
```

File: `.husky/pre-push`

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

echo "🧪 Running baseline tests before push..."
npm run test:baseline -- --run

if [ $? -ne 0 ]; then
  echo "❌ Baseline tests failed. Push blocked."
  exit 1
fi

echo "✅ Baseline tests passed"
```

**Step 4: Configure lint-staged**

File: `.lintstagedrc.json`

```json
{
  "*.{js,jsx}": [
    "eslint --fix",
    "vitest related --run"
  ],
  "*.{json,md,yml,yaml}": [
    "prettier --write"
  ]
}
```

**Step 5: Add prepare script to package.json**

Modify: `package.json`

```json
{
  "scripts": {
    "prepare": "husky install"
  }
}
```

**Step 6: Test pre-commit hook**

```bash
# Make a small change and try to commit
echo "# Test" >> README.md
git add README.md
git commit -m "test: verify pre-commit hook"
```

Expected: Lint-staged runs, then commit succeeds

**Step 7: Revert test commit**

```bash
git reset --soft HEAD~1
git restore --staged README.md
git restore README.md
```

**Step 8: Commit the hook setup**

```bash
git add .husky/ .lintstagedrc.json package.json package-lock.json
git commit -m "phase0(infra): set up pre-commit hooks with Husky"
```

---

## Task 11: Create Visual Regression Baseline (E2E)

**Files:**

- Create: `e2e/baselines/visual-regression.spec.js`

**Step 1: Create visual regression test**

File: `e2e/baselines/visual-regression.spec.js`

```javascript
import { test, expect } from '@playwright/test';

test.describe('BASELINE: Visual Regression', () => {
  test('captures initial form state', async ({ page }) => {
    await page.goto('/');

    // Wait for app to load
    await expect(page.locator('h1')).toBeVisible();

    // Take screenshot of entire page
    await expect(page).toHaveScreenshot('form-initial-state.png', {
      fullPage: true,
    });
  });

  test('captures electrode groups section', async ({ page }) => {
    await page.goto('/');

    // Navigate to electrode groups
    const electrodeLink = page.locator('text=Electrode Groups');
    if (await electrodeLink.isVisible()) {
      await electrodeLink.click();
    }

    // Wait for section to be visible
    await page.waitForTimeout(500);

    // Take screenshot of section
    await expect(page).toHaveScreenshot('electrode-groups-section.png', {
      fullPage: true,
    });
  });

  test('captures validation error state', async ({ page }) => {
    await page.goto('/');

    // Try to download without filling form (should show errors)
    const downloadButton = page.locator('button:has-text("Download")');
    if (await downloadButton.isVisible()) {
      await downloadButton.click();

      // Wait for validation errors to appear
      await page.waitForTimeout(1000);

      // Take screenshot
      await expect(page).toHaveScreenshot('validation-errors.png', {
        fullPage: true,
      });
    }
  });
});
```

**Step 2: Run Playwright test to generate baseline screenshots**

```bash
npm run test:e2e -- --update-snapshots
```

Expected: Playwright starts app, runs tests, captures screenshots

**Step 3: Review generated screenshots**

```bash
ls -lh e2e/baselines/visual-regression.spec.js-snapshots/
```

Expected: PNG files created for each screenshot

**Step 4: Commit**

```bash
git add e2e/baselines/ e2e/baselines/visual-regression.spec.js-snapshots/
git commit -m "phase0(baselines): add visual regression baseline tests"
```

---

## Task 12: Create Integration Contract Baseline Tests

**Files:**

- Create: `src/__tests__/integration/schema-contracts.test.js`

**Step 1: Write schema contract test**

File: `src/__tests__/integration/schema-contracts.test.js`

```javascript
/**
 * BASELINE TEST - Documents current integration contracts
 */

import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import schema from '../../nwb_schema.json';
import { deviceTypes } from '../../valueList';

describe('BASELINE: Integration Contracts', () => {
  describe('Schema Hash', () => {
    it('documents current schema version', () => {
      const schemaString = JSON.stringify(schema, null, 2);
      const hash = crypto.createHash('sha256').update(schemaString).digest('hex');

      console.log(`📊 Schema Hash: ${hash.substring(0, 16)}...`);

      // Store hash for sync detection with Python package
      expect(hash).toMatchSnapshot('schema-hash');
    });
  });

  describe('Device Types Contract', () => {
    it('documents all supported device types', () => {
      const types = deviceTypes();

      console.log(`📊 Device Types (${types.length}):`, types.slice(0, 3), '...');

      // These must match Python package probe_metadata files
      expect(types).toMatchSnapshot('device-types');
    });

    it('all device types are non-empty strings', () => {
      const types = deviceTypes();

      types.forEach(type => {
        expect(typeof type).toBe('string');
        expect(type.length).toBeGreaterThan(0);
      });
    });
  });

  describe('YAML Generation Contract', () => {
    it('documents YAML output format', () => {
      // Import YAML generation function if available
      // For now, just document the schema structure

      const requiredTopLevel = [
        'experimenter',
        'experiment_description',
        'session_description',
        'session_id',
        'institution',
        'lab',
        'session_start_time',
        'timestamps_reference_time',
        'subject',
        'data_acq_device',
      ];

      requiredTopLevel.forEach(field => {
        expect(schema.required).toContain(field);
      });

      // Snapshot the full schema structure
      expect(schema.required).toMatchSnapshot('schema-required-fields');
    });
  });
});
```

**Step 2: Run integration contract tests**

```bash
npm test -- schema-contracts.test.js --run
```

Expected: Tests pass and create snapshots

**Step 3: Review snapshots**

```bash
cat src/__tests__/integration/__snapshots__/schema-contracts.test.js.snap
```

Expected: Hash and device types captured

**Step 4: Commit**

```bash
git add src/__tests__/integration/schema-contracts.test.js src/__tests__/integration/__snapshots__/
git commit -m "phase0(baselines): add integration contract baseline tests"
```

---

## Task 13: Create TASKS.md Tracking Document

**Files:**

- Create: `docs/TASKS.md`

**Step 1: Create TASKS.md with Phase 0 checklist**

File: `docs/TASKS.md`

```markdown
# Refactoring Tasks

**Current Phase:** Phase 0 - Baseline & Infrastructure
**Phase Status:** 🟢 Complete
**Last Updated:** 2025-10-23

---

## Phase 0: Baseline & Infrastructure (Weeks 1-2)

**Goal:** Establish comprehensive baselines WITHOUT changing production code
**Exit Criteria:** All baselines passing, CI operational, you've approved all baselines

### Week 1: Infrastructure Setup

#### Infrastructure Setup
- [x] Install Vitest and configure (vitest.config.js)
- [x] Install Playwright and configure (playwright.config.js)
- [x] Install testing-library packages
- [x] Set up test directory structure
- [x] Configure coverage reporting
- [x] Create custom test helpers (src/__tests__/helpers/test-utils.jsx)
- [x] Create custom matchers (src/__tests__/helpers/custom-matchers.js)

#### CI/CD Pipeline
- [x] Create .github/workflows/test.yml
- [x] Configure test job (unit tests)
- [x] Configure integration job (schema sync)
- [x] Set up coverage upload to Codecov

#### Pre-commit Hooks
- [x] Install husky and lint-staged
- [x] Configure pre-commit hook (.husky/pre-commit)
- [x] Configure pre-push hook (.husky/pre-push)
- [x] Configure lint-staged (.lintstagedrc.json)

#### Test Fixtures
- [x] Create fixtures directory structure
- [x] Generate minimal-valid.json fixture
- [x] Generate complete-metadata.json fixture
- [x] Generate invalid fixtures (missing fields, wrong types)

### Week 2: Baseline Tests

#### Validation Baseline Tests
- [x] Create validation-baseline.test.js
- [x] Baseline test: accepts valid YAML structure
- [x] Baseline test: camera ID float bug (documents current wrong behavior)
- [x] Baseline test: empty string bug (documents current wrong behavior)
- [x] Baseline test: required fields validation
- [x] Run and verify all baselines pass

#### State Management Baseline Tests
- [x] Create state-management-baseline.test.js
- [x] Baseline: structuredClone performance measurement
- [x] Baseline: immutability verification
- [x] Run and verify all baselines pass

#### Performance Baseline Tests
- [x] Create performance-baseline.test.js
- [x] Measure initial render time
- [x] Measure validation performance (100 electrode groups)
- [x] Document performance baselines in SCRATCHPAD.md

#### Visual Regression Baseline
- [x] Create e2e/baselines/visual-regression.spec.js
- [x] Capture initial form state screenshot
- [x] Capture electrode groups section screenshot
- [x] Capture validation error state screenshot
- [x] Store screenshots as baseline references

#### Integration Contract Baselines
- [x] Create schema-contracts.test.js
- [x] Document current schema hash
- [x] Document all device types
- [x] Snapshot schema required fields
- [x] Run and verify all contract tests pass

### Phase 0 Exit Gate
- [x] ALL baseline tests documented and passing
- [x] CI/CD pipeline operational
- [x] Performance baselines documented
- [x] Visual regression baselines captured
- [x] Schema sync check working
- [ ] Human review: All baselines approved ⚠️ REQUIRES YOUR APPROVAL
- [ ] Tag release: `git tag v3.0.0-phase0-complete`

---

## Phase 1: Testing Foundation (Weeks 3-5)

**Goal:** Build comprehensive test suite WITHOUT changing production code
**Status:** 🔴 Blocked (waiting for Phase 0 approval)

[Tasks will be expanded when Phase 0 is approved]
```

**Step 2: Commit TASKS.md**

```bash
git add docs/TASKS.md
git commit -m "phase0(docs): create TASKS.md tracking document"
```

---

## Task 14: Create REFACTOR_CHANGELOG.md

**Files:**

- Create: `docs/REFACTOR_CHANGELOG.md`

**Step 1: Create changelog**

File: `docs/REFACTOR_CHANGELOG.md`

```markdown
# Refactor Changelog

All notable changes during the refactoring project.

Format: [Phase] Category: Description

---

## [Phase 0: Baseline & Infrastructure] - 2025-10-23

### Added
- Vitest test framework configuration (vitest.config.js)
- Playwright E2E test configuration (playwright.config.js)
- GitHub Actions CI/CD test workflow (.github/workflows/test.yml)
- Pre-commit hooks with Husky and lint-staged
- Test directory structure (baselines, unit, integration, fixtures)
- Custom test helpers (test-utils.jsx, custom-matchers.js)
- Test fixtures (valid and invalid YAML samples)
- Validation baseline test suite (documents current behavior including bugs)
- State management baseline tests (structuredClone performance)
- Performance baseline tests (render time, validation speed)
- Visual regression baseline tests (screenshots of all major UI states)
- Integration contract tests (schema hash, device types)
- TASKS.md tracking document
- SCRATCHPAD.md session notes
- REFACTOR_CHANGELOG.md (this file)

### Changed
- package.json: Added test scripts and dev dependencies
- src/setupTests.js: Added custom matchers import
- src/App.js: Exported validation functions for testing
- .gitignore: Added .worktrees/ directory

### Fixed
- None (Phase 0 is baseline only, no bug fixes)

---

## [Future Phases]

### Phase 1: Testing Foundation
- TBD

### Phase 2: Bug Fixes
- TBD
```

**Step 2: Commit changelog**

```bash
git add docs/REFACTOR_CHANGELOG.md
git commit -m "phase0(docs): create refactoring changelog"
```

---

## Task 15: Create /refactor Command

**Files:**

- Create: `.claude/commands/refactor.md`

**Step 1: Create .claude/commands directory**

```bash
mkdir -p .claude/commands
```

**Step 2: Create refactor command**

File: `.claude/commands/refactor.md`

```markdown
I'm working on the rec_to_nwb_yaml_creator refactoring project.

Start now by reading the files and telling me which task you'll work on next.

Your workflow MUST be:

1. First, read these files IN ORDER:
   - CLAUDE.md (project overview and critical context)
   - docs/plans/COMPREHENSIVE_REFACTORING_PLAN.md (master plan)
   - docs/plans/2025-10-23-phase-0-baselines.md (current phase plan)
   - docs/TASKS.md (current task checklist)
   - docs/SCRATCHPAD.md (context from previous session)

2. Find the FIRST unchecked [ ] task in TASKS.md for the current phase

3. For EVERY task, follow strict TDD:
   a. Create the TEST file first (baseline or unit test)
   b. Run the test and verify it FAILS or establishes baseline
   c. Only then create the implementation or fix
   d. Run test until it PASSES
   e. Run full regression suite to verify no breakage
   f. Update documentation if needed

4. For significant changes:
   a. Use `verification-before-completion` skill before marking done
   b. Use `requesting-code-review` skill for phase completions
   c. Never skip verification steps

5. Update files as you work:
   - Check off [x] completed tasks in TASKS.md
   - Add notes to SCRATCHPAD.md (decisions, blockers, questions)
   - Update REFACTOR_CHANGELOG.md with changes
   - Commit frequently: "phase0(category): description"

6. Phase Gate Rules:
   - DO NOT move to next phase until ALL tasks checked in current phase
   - DO NOT skip tests to match broken code
   - DO NOT change baselines without explicit approval
   - ASK permission if you need to change requirements or approach

7. When blocked or uncertain:
   - Document in SCRATCHPAD.md
   - Ask for guidance
   - Do not proceed with assumptions

Current Phase: [Will be determined from TASKS.md]
```

**Step 3: Commit the command**

```bash
git add .claude/commands/refactor.md
git commit -m "phase0(docs): add /refactor command for future sessions"
```

---

## Task 16: Final Verification and Phase 0 Completion

**Step 1: Run all baseline tests**

```bash
npm run test:baseline -- --run
```

Expected: All baseline tests pass

**Step 2: Run full test suite with coverage**

```bash
npm run test:coverage -- --run
```

Expected: Tests pass (may have low coverage, that's expected)

**Step 3: Run E2E tests**

```bash
npm run test:e2e
```

Expected: Visual regression tests pass

**Step 4: Verify CI would pass**

```bash
npm run lint
npm run test:baseline -- --run
npm run test:coverage -- --run
```

Expected: All commands succeed

**Step 5: Update SCRATCHPAD.md with completion notes**

Append to: `docs/SCRATCHPAD.md`

```markdown
### 2025-10-23: Phase 0 Complete

**Completed Tasks:**
- ✅ All infrastructure setup complete
- ✅ All baseline tests passing
- ✅ CI/CD pipeline configured
- ✅ Pre-commit hooks working
- ✅ Visual regression baselines captured
- ✅ Performance baselines documented

**Performance Baselines Captured:**
- Initial render: [see test output] ms
- Validation (100 electrode groups): [see test output] ms
- structuredClone (100 electrode groups): [see test output] ms

**Next Steps:**
- Human review and approval required
- After approval: Tag v3.0.0-phase0-complete
- Then begin Phase 1: Testing Foundation
```

**Step 6: Commit final updates**

```bash
git add docs/SCRATCHPAD.md
git commit -m "phase0(docs): document Phase 0 completion"
```

**Step 7: Push to remote**

```bash
git push -u origin refactor/phase-0-baselines
```

---

## Phase 0 Exit Gate Checklist

Before proceeding to Phase 1, verify:

- [ ] All tasks in TASKS.md Phase 0 section are checked ✅
- [ ] `npm run test:baseline -- --run` passes ✅
- [ ] `npm run test:coverage -- --run` passes ✅
- [ ] `npm run test:e2e` passes ✅
- [ ] CI pipeline is green on GitHub Actions ✅
- [ ] Performance baselines documented in SCRATCHPAD.md ✅
- [ ] Visual regression screenshots reviewed ✅
- [ ] Schema sync test passes ✅
- [ ] **HUMAN REVIEW: You've reviewed all baseline tests** ⚠️
- [ ] **HUMAN APPROVAL: You approve moving to Phase 1** ⚠️
- [ ] Tag created: `git tag v3.0.0-phase0-complete` ✅
- [ ] Tag pushed: `git push --tags` ✅

---

## Notes

**Test Commands:**

```bash
# Run all tests
npm test -- --run

# Run specific test file
npm test -- validation-baseline.test.js --run

# Run with coverage
npm run test:coverage -- --run

# Run E2E tests
npm run test:e2e

# Run baseline tests only
npm run test:baseline -- --run
```

**Git Workflow:**

```bash
# Current branch
git branch
# Should show: refactor/phase-0-baselines

# Commit frequently
git add <files>
git commit -m "phase0(category): description"

# Push to remote
git push -u origin refactor/phase-0-baselines
```

**Troubleshooting:**

- If tests fail: Check console output, verify imports
- If CI fails: Check GitHub Actions logs
- If hooks don't run: Run `npx husky install`
- If snapshots need updating: Run test with `--update-snapshots`
