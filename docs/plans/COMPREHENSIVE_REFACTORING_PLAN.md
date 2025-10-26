# Comprehensive Refactoring Plan: rec_to_nwb_yaml_creator

**Created:** 2025-01-23
**Purpose:** Establish robust testing infrastructure BEFORE fixing bugs to prevent regressions
**Philosophy:** Measure twice, cut once - baseline everything, then improve safely
**Timeline:** 16 weeks (4 months)
**Total Effort:** ~350 hours

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Core Principles](#core-principles)
3. [Phase 0: Baseline & Infrastructure (Weeks 1-2)](#phase-0-baseline--infrastructure-weeks-1-2)
4. [Phase 1: Testing Foundation (Weeks 3-5)](#phase-1-testing-foundation-weeks-3-5)
5. [Phase 2: Critical Bug Fixes with TDD (Weeks 6-7)](#phase-2-critical-bug-fixes-with-tdd-weeks-6-7)
6. [Phase 3: Architecture Refactoring (Weeks 8-11)](#phase-3-architecture-refactoring-weeks-8-11)
7. [Phase 4: Modern Tooling & DX (Weeks 12-14)](#phase-4-modern-tooling--dx-weeks-12-14)
8. [Phase 5: Polish & Documentation (Weeks 15-16)](#phase-5-polish--documentation-weeks-15-16)
9. [Modern Tooling Stack](#modern-tooling-stack)
10. [Risk Mitigation Strategy](#risk-mitigation-strategy)
11. [Success Metrics](#success-metrics)

---

## Executive Summary

This refactoring plan **prioritizes establishing safety nets before making changes**. Unlike typical refactoring approaches that fix bugs first, this plan:

1. **Establishes comprehensive baselines** (current behavior, performance, bundle size)
2. **Builds testing infrastructure** (unit, integration, E2E, visual regression)
3. **Modernizes tooling** (TypeScript, Vitest, Playwright, Biome)
4. **THEN fixes bugs with TDD** (tests first, verify failure, fix, verify pass)
5. **Finally refactors architecture** (with tests protecting against regressions)

### Why This Order?

**Traditional Approach (DANGEROUS):**

```
Fix Bug → Hope Nothing Broke → Manual Testing → Deploy → 🔥
```

**Our Approach (SAFE):**

```
Baseline → Test Infrastructure → Fix with TDD → Regression Tests Pass → ✅
```

### Key Statistics

| Metric | Current | After Phase 0 | After Phase 2 | Final Target |
|--------|---------|---------------|---------------|--------------|
| **Test Coverage** | ~0% | 0% (baseline) | 60% | 85%+ |
| **Type Safety** | 0% | 0% | 20% | 90%+ |
| **Bundle Size** | Unknown | Measured | Measured | <500kb |
| **Critical Bugs** | 10 | 10 (documented) | 0 | 0 |
| **App.js LOC** | 2,767 | 2,767 | 2,767 | <500 |

---

## Core Principles

### 1. **No Changes Without Tests**

**Rule:** Every bug fix, feature addition, or refactoring MUST have tests written FIRST.

**Enforcement:**

- Pre-commit hook blocks commits without tests for changed code
- CI fails if coverage decreases
- PR template requires test evidence

### 2. **Baseline Everything First**

Before changing ANY code, establish baselines for:

- Current behavior (snapshot tests, golden files)
- Performance metrics (bundle size, render time, memory)
- Visual appearance (screenshot tests)
- Integration contracts (schema sync, device types)

### 3. **Modern Tooling with Strong Guarantees**

Replace outdated tools with modern alternatives that enforce good practices:

| Old Tool | New Tool | Why |
|----------|----------|-----|
| Jest | **Vitest** | 10x faster, native ESM, Vite integration |
| ESLint + Prettier | **Biome** | 100x faster, single tool, zero config |
| PropTypes | **TypeScript** | Compile-time safety, IDE support |
| react-scripts test | **Vitest + Testing Library** | Better DX, faster feedback |
| Manual validation | **JSON Schema → TypeScript** | Generated types from schema |

### 4. **Incremental Migration, Not Big Bang**

- Migrate file-by-file, starting with utilities
- Run old and new systems in parallel during transition
- Always have a rollback plan
- Document migration patterns for consistency

### 5. **Developer Experience (DX) is Critical**

Good DX → Faster development → Better code quality

**Investments:**

- Fast test execution (<5s for unit tests)
- Instant feedback (HMR, watch mode)
- Clear error messages (no cryptic stack traces)
- Type-ahead autocomplete (TypeScript + JSDoc)
- Visual regression testing (catch UI bugs immediately)

---

## Phase 0: Baseline & Infrastructure (Weeks 1-2)

**Goal:** Establish comprehensive baselines and safety nets WITHOUT changing production code

**Effort:** 60 hours

### Week 1: Measurement & Documentation

#### 1.1 Establish Current Behavior Baselines

**Task:** Document EXACTLY how the application behaves today

**Deliverables:**

```bash
# Create baseline test suite
mkdir -p src/__tests__/baselines
```

**File:** `src/__tests__/baselines/validation-baseline.test.js`

```javascript
/**
 * BASELINE TEST - Do not modify without approval
 *
 * This test documents CURRENT behavior (including bugs).
 * When we fix bugs, we'll update these tests to new expected behavior.
 *
 * Purpose: Detect unintended regressions during refactoring
 */

import { jsonschemaValidation, rulesValidation } from '../../App';
import validYaml from '../fixtures/baseline-valid.json';
import invalidYaml from '../fixtures/baseline-invalid.json';

describe('BASELINE: Current Validation Behavior', () => {
  describe('Valid YAML (currently passes)', () => {
    it('accepts valid YAML structure', () => {
      const result = jsonschemaValidation(validYaml);
      expect(result).toMatchSnapshot('valid-yaml-result');
    });
  });

  describe('Known Bug: Float Camera IDs', () => {
    it('INCORRECTLY accepts camera_id: 1.5 (BUG #3)', () => {
      const yaml = {
        ...validYaml,
        cameras: [{ id: 1.5, meters_per_pixel: 0.001 }]
      };

      const result = jsonschemaValidation(yaml);

      // CURRENT BEHAVIOR (WRONG): Accepts float
      expect(result.valid).toBe(true);

      // TODO: After fix, this should be false
      // expect(result.valid).toBe(false);
      // expect(result.errors[0].message).toContain('must be integer');
    });
  });

  describe('Known Bug: Empty String Validation', () => {
    it('INCORRECTLY accepts empty session_description (BUG #5)', () => {
      const yaml = {
        ...validYaml,
        session_description: ''
      };

      const result = jsonschemaValidation(yaml);

      // CURRENT BEHAVIOR (WRONG): Accepts empty string
      expect(result.valid).toBe(true);
    });
  });

  describe('State Management Baseline', () => {
    it('structuredClone used for all state updates', () => {
      // Document current implementation for performance comparison
      const largeState = { electrode_groups: Array(20).fill({}) };

      const start = performance.now();
      const cloned = structuredClone(largeState);
      const duration = performance.now() - start;

      // Baseline: structuredClone takes ~5-10ms for 20 electrode groups
      expect(duration).toBeLessThan(50); // Allow headroom
      expect(cloned).not.toBe(largeState);
    });
  });
});
```

**Action Items:**

- [ ] Create 20+ baseline tests covering ALL current behaviors
- [ ] Document known bugs with `BUG #N` references to REVIEW.md
- [ ] Generate snapshots for all test cases
- [ ] Commit baselines as "source of truth" for current behavior

#### 1.2 Performance Baselines

**File:** `src/__tests__/baselines/performance-baseline.test.js`

```javascript
import { performance } from 'perf_hooks';

describe('BASELINE: Performance Metrics', () => {
  it('measures bundle size', async () => {
    const fs = require('fs');
    const buildPath = './build/static/js/main.*.js';
    const files = fs.readdirSync('./build/static/js/');
    const mainJs = files.find(f => f.startsWith('main.'));
    const size = fs.statSync(`./build/static/js/${mainJs}`).size;

    console.log(`📊 Bundle Size: ${(size / 1024).toFixed(2)} KB`);

    // Document current size (not enforcing yet)
    expect(size).toBeLessThan(5 * 1024 * 1024); // 5MB max
  });

  it('measures initial render time', () => {
    const { render } = require('@testing-library/react');
    const App = require('../../App').default;

    const start = performance.now();
    render(<App />);
    const duration = performance.now() - start;

    console.log(`📊 Initial Render: ${duration.toFixed(2)}ms`);

    // Baseline: Document current performance
    expect(duration).toBeLessThan(5000); // 5s max
  });
});
```

**Action Items:**

- [ ] Measure and document bundle size
- [ ] Measure initial render time
- [ ] Measure form interaction responsiveness
- [ ] Measure validation performance (100 electrode groups)
- [ ] Create performance budget for future optimization

#### 1.3 Visual Regression Baselines

**Tool:** Playwright + Percy or Chromatic

**File:** `e2e/baselines/visual-regression.spec.js`

```javascript
import { test, expect } from '@playwright/test';

test.describe('BASELINE: Visual Regression', () => {
  test('captures initial form state', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await expect(page).toHaveScreenshot('form-initial-state.png');
  });

  test('captures electrode group section', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.click('text=Electrode Groups');
    await expect(page.locator('#electrode-groups')).toHaveScreenshot('electrode-groups.png');
  });

  test('captures validation error state', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.click('button:has-text("Download")');
    await expect(page).toHaveScreenshot('validation-errors.png');
  });
});
```

**Action Items:**

- [ ] Capture screenshots of ALL form sections
- [ ] Capture error states
- [ ] Capture responsive layouts (mobile, tablet, desktop)
- [ ] Store screenshots as baseline references

#### 1.4 Integration Contract Baselines

**File:** `src/__tests__/baselines/integration-contracts.test.js`

```javascript
describe('BASELINE: Integration Contracts', () => {
  it('documents current schema version', () => {
    const schema = require('../../nwb_schema.json');

    // Document schema hash for sync detection
    const schemaString = JSON.stringify(schema, null, 2);
    const hash = require('crypto')
      .createHash('sha256')
      .update(schemaString)
      .digest('hex');

    console.log(`📊 Schema Hash: ${hash}`);

    // Store for comparison with Python package
    expect(hash).toBeTruthy();
  });

  it('documents all supported device types', () => {
    const { deviceTypes } = require('../../valueList');
    const types = deviceTypes();

    console.log(`📊 Device Types (${types.length}):`, types);

    // Baseline: These must match Python package
    expect(types).toMatchSnapshot('device-types-baseline');
  });

  it('documents YAML generation output format', () => {
    // Generate sample YAML and snapshot it
    const { generateYMLFile } = require('../../App');
    const sampleData = require('../fixtures/baseline-valid.json');

    const yamlOutput = generateYMLFile(sampleData);

    // Store exact output format
    expect(yamlOutput).toMatchSnapshot('yaml-output-format');
  });
});
```

### Week 2: Testing Infrastructure Setup

#### 2.1 Install Modern Testing Tools

**File:** `package.json` additions

```json
{
  "devDependencies": {
    "@testing-library/react": "^14.1.2",
    "@testing-library/jest-dom": "^6.1.5",
    "@testing-library/user-event": "^14.5.1",
    "@vitest/ui": "^1.1.0",
    "vitest": "^1.1.0",
    "jsdom": "^23.0.1",

    "@playwright/test": "^1.40.1",
    "chromatic": "^10.2.0",

    "msw": "^2.0.11",
    "faker": "^5.5.3",

    "husky": "^8.0.3",
    "lint-staged": "^15.2.0",

    "typescript": "^5.3.3",
    "@types/react": "^18.2.45",
    "@types/react-dom": "^18.2.18",

    "c8": "^9.0.0",
    "@vitest/coverage-v8": "^1.1.0"
  }
}
```

**Script additions:**

```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "test:baseline": "vitest run --testPathPattern=baselines",
    "test:integration": "vitest run --testPathPattern=integration",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:visual": "playwright test --grep @visual",
    "prepare": "husky install"
  }
}
```

#### 2.2 Configure Vitest

**File:** `vitest.config.js`

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

**Key Features:**

- ✅ 80% coverage requirement (enforced)
- ✅ Path aliases for cleaner imports
- ✅ V8 coverage (faster than Istanbul)
- ✅ HTML coverage reports
- ✅ Global test helpers (describe, it, expect)

#### 2.3 Configure Playwright

**File:** `playwright.config.js`

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
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
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

#### 2.4 Configure Pre-commit Hooks

**File:** `.husky/pre-commit`

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# Run lint-staged
npx lint-staged

# Run baseline tests (fast check)
npm run test:baseline -- --run --silent

# Check for schema changes
if git diff --cached --name-only | grep -q "nwb_schema.json"; then
  echo "⚠️  WARNING: nwb_schema.json changed!"
  echo "❗ You MUST update the Python package schema as well"
  echo "❗ Run: npm run test:integration -- --run"
  exit 1
fi
```

**File:** `.husky/pre-push`

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

echo "🧪 Running full test suite before push..."

# Run all tests
npm run test:coverage -- --run

# Check coverage threshold
if [ $? -ne 0 ]; then
  echo "❌ Tests failed or coverage below threshold"
  exit 1
fi

echo "✅ All tests passed!"
```

**File:** `.lintstagedrc.json`

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

#### 2.5 Set Up Test Fixtures

**Directory Structure:**

```
src/__tests__/
├── fixtures/
│   ├── valid/
│   │   ├── minimal-valid.json
│   │   ├── complete-metadata.json
│   │   ├── single-electrode-group.json
│   │   ├── multiple-electrode-groups.json
│   │   └── with-optogenetics.json
│   ├── invalid/
│   │   ├── missing-required-fields.json
│   │   ├── wrong-date-format.json
│   │   ├── float-camera-id.json
│   │   ├── empty-strings.json
│   │   └── duplicate-ids.json
│   └── edge-cases/
│       ├── maximum-complexity.json
│       ├── unicode-characters.json
│       └── boundary-values.json
├── baselines/
├── unit/
├── integration/
└── helpers/
    ├── test-utils.jsx
    ├── fixtures-generator.js
    └── custom-matchers.js
```

**File:** `src/__tests__/helpers/test-utils.jsx`

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
  const base = require('../fixtures/valid/minimal-valid.json');
  return { ...base, ...overrides };
}
```

**File:** `src/__tests__/helpers/custom-matchers.js`

```javascript
import { expect } from 'vitest';

expect.extend({
  toBeValidYaml(received) {
    const { jsonschemaValidation } = require('../../App');
    const result = jsonschemaValidation(received);

    return {
      pass: result.valid,
      message: () => result.valid
        ? `Expected YAML to be invalid`
        : `Expected YAML to be valid, but got errors: ${JSON.stringify(result.errors, null, 2)}`,
    };
  },

  toHaveValidationError(received, expectedError) {
    const { jsonschemaValidation } = require('../../App');
    const result = jsonschemaValidation(received);

    const hasError = result.errors?.some(err =>
      err.message.includes(expectedError)
    );

    return {
      pass: hasError,
      message: () => hasError
        ? `Expected validation to NOT have error containing "${expectedError}"`
        : `Expected validation to have error containing "${expectedError}", but got: ${JSON.stringify(result.errors, null, 2)}`,
    };
  },
});
```

#### 2.6 Create CI/CD Pipeline

**File:** `.github/workflows/test.yml`

```yaml
name: Test Suite

on:
  push:
    branches: [main, modern]
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

      - name: Run unit tests with coverage
        run: npm run test:coverage -- --run

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
          flags: unittests

      - name: Run Playwright tests
        run: npm run test:e2e

      - name: Upload Playwright report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/

      - name: Check bundle size
        run: |
          npm run build
          npx bundlesize

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
          diff -u \
            rec_to_nwb_yaml_creator/src/nwb_schema.json \
            trodes_to_nwb/src/trodes_to_nwb/nwb_schema.json \
          || (echo "❌ Schema mismatch detected!" && exit 1)
```

### Phase 0 Deliverables Checklist

- [ ] **Baseline tests** covering ALL current behavior (including bugs)
- [ ] **Performance baselines** (bundle size, render time, memory)
- [ ] **Visual regression tests** (screenshots of all states)
- [ ] **Integration contract tests** (schema, device types, YAML output)
- [ ] **Modern testing tools installed** (Vitest, Playwright, MSW)
- [ ] **Pre-commit hooks** enforcing quality gates
- [ ] **CI/CD pipeline** running all tests automatically
- [ ] **Test fixtures library** with valid/invalid/edge cases
- [ ] **Custom test helpers** for common testing patterns
- [ ] **Coverage reporting** configured and enforced
- [ ] **Documentation** of baseline metrics

---

## Phase 1: Testing Foundation (Weeks 3-5)

**Goal:** Build comprehensive test suite WITHOUT changing production code

**Effort:** 90 hours

### Week 3: Unit Tests for Pure Functions

#### 3.1 Validation Logic Tests

**File:** `src/__tests__/unit/validation/json-schema-validation.test.js`

```javascript
import { describe, it, expect, beforeEach } from 'vitest';
import { jsonschemaValidation } from '@/App';
import { createTestYaml } from '@tests/helpers/test-utils';

describe('JSON Schema Validation', () => {
  let validYaml;

  beforeEach(() => {
    validYaml = createTestYaml();
  });

  describe('Required Fields', () => {
    it('rejects missing experimenter', () => {
      delete validYaml.experimenter;

      expect(validYaml).toHaveValidationError('experimenter');
    });

    it('rejects missing session_id', () => {
      delete validYaml.session_id;

      expect(validYaml).toHaveValidationError('session_id');
    });

    // ... 20+ more required field tests
  });

  describe('Type Validation', () => {
    it('rejects float camera_id', () => {
      validYaml.cameras = [{ id: 1.5 }];

      expect(validYaml).toHaveValidationError('integer');
    });

    it('rejects string for numeric fields', () => {
      validYaml.subject.weight = 'heavy';

      expect(validYaml).toHaveValidationError('number');
    });
  });

  describe('Pattern Validation', () => {
    it('enforces date format YYYY-MM-DD', () => {
      validYaml.session_start_time = '01/23/2025';

      expect(validYaml).toHaveValidationError('pattern');
    });

    it('accepts valid ISO 8601 date', () => {
      validYaml.session_start_time = '2025-01-23T10:30:00';

      expect(validYaml).toBeValidYaml();
    });
  });

  describe('Custom Rules', () => {
    it('rejects tasks referencing non-existent cameras', () => {
      validYaml.tasks = [{ camera_id: [1, 2] }];
      validYaml.cameras = [];

      expect(validYaml).toHaveValidationError('camera');
    });

    it('accepts tasks with valid camera references', () => {
      validYaml.tasks = [{ task_name: 'test', camera_id: [0] }];
      validYaml.cameras = [{ id: 0 }];

      expect(validYaml).toBeValidYaml();
    });
  });

  describe('Edge Cases', () => {
    it('handles extremely large arrays', () => {
      validYaml.electrode_groups = Array(200).fill({ id: 0 });

      const start = performance.now();
      const result = jsonschemaValidation(validYaml);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(1000); // < 1 second
    });

    it('handles unicode characters in strings', () => {
      validYaml.session_description = '实验描述 🧪';

      expect(validYaml).toBeValidYaml();
    });
  });
});
```

**Coverage Target:** 100% of validation logic

**Action Items:**

- [ ] Write tests for jsonschemaValidation (50+ tests)
- [ ] Write tests for rulesValidation (30+ tests)
- [ ] Write tests for custom validation rules
- [ ] Write property-based tests (use fast-check)
- [ ] Measure and document validation performance

#### 3.2 Data Transform Tests

**File:** `src/__tests__/unit/transforms/data-transforms.test.js`

```javascript
import { describe, it, expect } from 'vitest';
import {
  commaSeparatedStringToNumber,
  formatCommaSeparatedString,
  isInteger,
  isNumeric,
} from '@/utils';

describe('Data Transforms', () => {
  describe('commaSeparatedStringToNumber', () => {
    it('parses comma-separated integers', () => {
      expect(commaSeparatedStringToNumber('1, 2, 3')).toEqual([1, 2, 3]);
    });

    it('handles spaces inconsistently', () => {
      expect(commaSeparatedStringToNumber('1,2, 3 , 4')).toEqual([1, 2, 3, 4]);
    });

    it('filters out non-numeric values', () => {
      expect(commaSeparatedStringToNumber('1, abc, 2')).toEqual([1, 2]);
    });

    it('BASELINE: currently accepts floats (BUG)', () => {
      // Current behavior (wrong)
      expect(commaSeparatedStringToNumber('1, 2.5, 3')).toEqual([1, 2.5, 3]);

      // After fix, should filter floats for ID fields
      // expect(commaSeparatedStringToNumber('1, 2.5, 3', { integersOnly: true }))
      //   .toEqual([1, 3]);
    });

    it('deduplicates values', () => {
      expect(commaSeparatedStringToNumber('1, 2, 1, 3')).toEqual([1, 2, 3]);
    });

    it('handles empty string', () => {
      expect(commaSeparatedStringToNumber('')).toEqual([]);
    });

    it('handles null and undefined', () => {
      expect(commaSeparatedStringToNumber(null)).toEqual([]);
      expect(commaSeparatedStringToNumber(undefined)).toEqual([]);
    });
  });

  describe('Type Validators', () => {
    describe('isInteger', () => {
      it('accepts integer strings', () => {
        expect(isInteger('42')).toBe(true);
        expect(isInteger('-10')).toBe(true);
        expect(isInteger('0')).toBe(true);
      });

      it('rejects float strings', () => {
        expect(isInteger('1.5')).toBe(false);
        expect(isInteger('3.14159')).toBe(false);
      });

      it('rejects non-numeric strings', () => {
        expect(isInteger('abc')).toBe(false);
        expect(isInteger('')).toBe(false);
      });

      it('handles edge cases', () => {
        expect(isInteger(null)).toBe(false);
        expect(isInteger(undefined)).toBe(false);
        expect(isInteger('Infinity')).toBe(false);
        expect(isInteger('NaN')).toBe(false);
      });
    });

    describe('isNumeric', () => {
      it('accepts numeric strings', () => {
        expect(isNumeric('42')).toBe(true);
        expect(isNumeric('1.5')).toBe(true);
        expect(isNumeric('-3.14')).toBe(true);
      });

      it('accepts scientific notation', () => {
        expect(isNumeric('1e5')).toBe(true);
        expect(isNumeric('2.5e-3')).toBe(true);
      });

      it('rejects non-numeric strings', () => {
        expect(isNumeric('abc')).toBe(false);
        expect(isNumeric('12abc')).toBe(false);
      });
    });
  });

  describe('formatCommaSeparatedString', () => {
    it('formats array as comma-separated string', () => {
      expect(formatCommaSeparatedString([1, 2, 3])).toBe('1, 2, 3');
    });

    it('handles single element', () => {
      expect(formatCommaSeparatedString([1])).toBe('1');
    });

    it('handles empty array', () => {
      expect(formatCommaSeparatedString([])).toBe('');
    });
  });
});
```

**Coverage Target:** 100% of utility functions

#### 3.3 Device Type Mapping Tests

**File:** `src/__tests__/unit/ntrode/device-type-mapping.test.js`

```javascript
import { describe, it, expect } from 'vitest';
import { deviceTypeMap, getShankCount } from '@/ntrode/deviceTypes';
import { deviceTypes } from '@/valueList';

describe('Device Type Mapping', () => {
  describe('deviceTypeMap', () => {
    const allDeviceTypes = deviceTypes();

    allDeviceTypes.forEach(deviceType => {
      it(`generates valid map for ${deviceType}`, () => {
        const result = deviceTypeMap(deviceType);

        expect(result).toBeInstanceOf(Array);
        expect(result.length).toBeGreaterThan(0);

        result.forEach((ntrode, idx) => {
          expect(ntrode).toHaveProperty('ntrode_id', idx);
          expect(ntrode).toHaveProperty('electrode_group_id', 0);
          expect(ntrode).toHaveProperty('map');
          expect(typeof ntrode.map).toBe('object');
        });
      });
    });

    it('generates correct channel map for tetrode_12.5', () => {
      const result = deviceTypeMap('tetrode_12.5');

      expect(result).toHaveLength(1);
      expect(result[0].map).toEqual({ 0: 0, 1: 1, 2: 2, 3: 3 });
    });

    it('generates correct channel map for 128ch probe', () => {
      const result = deviceTypeMap('128c-4s6mm6cm-15um-26um-sl');

      expect(result).toHaveLength(32); // 128 channels / 4 per ntrode = 32
      expect(result[0].map).toHaveProperty('0');
      expect(result[0].map).toHaveProperty('1');
      expect(result[0].map).toHaveProperty('2');
      expect(result[0].map).toHaveProperty('3');
    });

    it('throws error for invalid device type', () => {
      expect(() => deviceTypeMap('nonexistent_probe')).toThrow();
    });
  });

  describe('getShankCount', () => {
    it('returns 1 for single-shank probes', () => {
      expect(getShankCount('tetrode_12.5')).toBe(1);
      expect(getShankCount('A1x32-6mm-50-177-H32_21mm')).toBe(1);
    });

    it('returns correct count for multi-shank probes', () => {
      expect(getShankCount('128c-4s6mm6cm-15um-26um-sl')).toBe(4);
      expect(getShankCount('32c-2s8mm6cm-20um-40um-dl')).toBe(2);
      expect(getShankCount('64c-3s6mm6cm-20um-40um-sl')).toBe(3);
    });
  });

  describe('Channel Map Validation', () => {
    it('has no duplicate channel assignments within ntrode', () => {
      const allDeviceTypes = deviceTypes();

      allDeviceTypes.forEach(deviceType => {
        const ntrodes = deviceTypeMap(deviceType);

        ntrodes.forEach(ntrode => {
          const channels = Object.values(ntrode.map);
          const uniqueChannels = new Set(channels);

          expect(uniqueChannels.size).toBe(channels.length);
        });
      });
    });

    it('has sequential channel IDs starting from 0', () => {
      const result = deviceTypeMap('tetrode_12.5');
      const channelIds = Object.keys(result[0].map).map(Number);

      expect(channelIds).toEqual([0, 1, 2, 3]);
    });
  });
});
```

### Week 4: Component Tests

#### 4.1 Form Component Tests

**File:** `src/__tests__/unit/components/input-element.test.jsx`

```javascript
import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders } from '@tests/helpers/test-utils';
import { screen } from '@testing-library/react';
import InputElement from '@/element/InputElement';

describe('InputElement', () => {
  it('renders input with label', () => {
    renderWithProviders(
      <InputElement
        title="Test Field"
        name="test_field"
        value=""
        onChange={vi.fn()}
      />
    );

    expect(screen.getByLabelText('Test Field')).toBeInTheDocument();
  });

  it('calls onChange when user types', async () => {
    const handleChange = vi.fn();
    const { user } = renderWithProviders(
      <InputElement
        title="Test Field"
        name="test_field"
        value=""
        onChange={handleChange}
      />
    );

    await user.type(screen.getByLabelText('Test Field'), 'hello');

    expect(handleChange).toHaveBeenCalled();
  });

  it('displays validation error', () => {
    renderWithProviders(
      <InputElement
        title="Test Field"
        name="test_field"
        value=""
        onChange={vi.fn()}
        required
      />
    );

    const input = screen.getByLabelText('Test Field');
    input.setCustomValidity('This field is required');

    expect(input).toBeInvalid();
  });

  it('supports number type with proper parsing', async () => {
    const handleChange = vi.fn();
    const { user } = renderWithProviders(
      <InputElement
        title="Numeric Field"
        name="numeric"
        type="number"
        value=""
        onChange={handleChange}
      />
    );

    await user.type(screen.getByLabelText('Numeric Field'), '42');

    // Should parse to number
    expect(handleChange).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ value: expect.any(Number) })
    );
  });

  it('renders help text when provided', () => {
    renderWithProviders(
      <InputElement
        title="Test Field"
        name="test"
        value=""
        onChange={vi.fn()}
        helpText="This is helpful information"
      />
    );

    expect(screen.getByText('This is helpful information')).toBeInTheDocument();
  });
});
```

**Action Items:**

- [ ] Test ALL form components (InputElement, SelectElement, DataListElement, etc.)
- [ ] Test complex components (ChannelMap, ArrayUpdateMenu)
- [ ] Test user interactions (typing, selecting, clicking)
- [ ] Test validation feedback
- [ ] Test accessibility (ARIA labels, keyboard navigation)

#### 4.2 State Management Tests

**File:** `src/__tests__/unit/state/form-data-updates.test.js`

```javascript
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useState } from 'react';

// Mock the updateFormData function from App.js
function createFormDataHook() {
  const [formData, setFormData] = useState({ cameras: [], electrode_groups: [] });

  const updateFormData = (key, value) => {
    const newData = structuredClone(formData);
    newData[key] = value;
    setFormData(newData);
  };

  return { formData, updateFormData };
}

describe('Form State Management', () => {
  describe('updateFormData', () => {
    it('updates simple field immutably', () => {
      const { result } = renderHook(() => createFormDataHook());
      const initialData = result.current.formData;

      act(() => {
        result.current.updateFormData('session_id', 'test_001');
      });

      expect(result.current.formData.session_id).toBe('test_001');
      expect(result.current.formData).not.toBe(initialData);
    });

    it('updates nested array item', () => {
      const { result } = renderHook(() => createFormDataHook());

      act(() => {
        result.current.updateFormData('cameras', [{ id: 0, model: 'Camera1' }]);
      });

      expect(result.current.formData.cameras).toHaveLength(1);
      expect(result.current.formData.cameras[0].model).toBe('Camera1');
    });

    it('maintains referential inequality after update', () => {
      const { result } = renderHook(() => createFormDataHook());
      const initialData = result.current.formData;

      act(() => {
        result.current.updateFormData('cameras', [{ id: 0 }]);
      });

      // Should create new object, not mutate
      expect(result.current.formData).not.toBe(initialData);
      expect(result.current.formData.cameras).not.toBe(initialData.cameras);
    });
  });

  describe('Performance Characteristics', () => {
    it('structuredClone performance for large state', () => {
      const largeState = {
        electrode_groups: Array(100).fill({ id: 0, name: 'test', device_type: 'tetrode' }),
      };

      const iterations = 100;
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        structuredClone(largeState);
      }

      const duration = performance.now() - start;
      const avgTime = duration / iterations;

      console.log(`📊 structuredClone avg: ${avgTime.toFixed(2)}ms`);

      // Baseline: Document current performance
      expect(avgTime).toBeLessThan(50); // < 50ms per clone
    });
  });
});
```

### Week 5: Integration Tests

#### 5.1 YAML Generation & Import Tests

**File:** `src/__tests__/integration/yaml-roundtrip.test.js`

```javascript
import { describe, it, expect } from 'vitest';
import yaml from 'yaml';
import { generateYMLFile, importFile } from '@/App';
import { createTestYaml } from '@tests/helpers/test-utils';

describe('YAML Generation & Import', () => {
  describe('Round-trip', () => {
    it('preserves data through export-import cycle', () => {
      const original = createTestYaml({
        experimenter: ['Doe, John'],
        session_id: 'test_001',
        cameras: [{ id: 0, model: 'TestCam' }],
      });

      // Export
      const yamlString = generateYMLFile(original);
      expect(yamlString).toBeTruthy();

      // Parse
      const parsed = yaml.parse(yamlString);

      // Import
      const imported = importFile(yamlString);

      // Should match original
      expect(imported.experimenter).toEqual(original.experimenter);
      expect(imported.session_id).toEqual(original.session_id);
      expect(imported.cameras).toEqual(original.cameras);
    });

    it('handles complex nested structures', () => {
      const complex = createTestYaml({
        electrode_groups: [
          { id: 0, device_type: 'tetrode_12.5', location: 'CA1' },
          { id: 1, device_type: 'tetrode_12.5', location: 'CA3' },
        ],
        ntrode_electrode_group_channel_map: [
          { ntrode_id: 0, electrode_group_id: 0, map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
          { ntrode_id: 1, electrode_group_id: 1, map: { 0: 4, 1: 5, 2: 6, 3: 7 } },
        ],
      });

      const yamlString = generateYMLFile(complex);
      const imported = importFile(yamlString);

      expect(imported.electrode_groups).toHaveLength(2);
      expect(imported.ntrode_electrode_group_channel_map).toHaveLength(2);
    });

    it('rejects invalid YAML on import', () => {
      const invalidYaml = `
experimenter: Missing Required Fields
# No session_id, dates, etc.
`;

      expect(() => importFile(invalidYaml)).toThrow();
    });
  });

  describe('Filename Generation', () => {
    it('generates correct filename format', () => {
      const data = createTestYaml({
        subject: { subject_id: 'rat01' },
        // Assuming experiment_date field exists
        experiment_date: '2025-01-23',
      });

      const filename = generateFilename(data);

      // Format: {mmddYYYY}_{subject_id}_metadata.yml
      expect(filename).toMatch(/^\d{8}_rat01_metadata\.yml$/);
    });

    it('handles missing date gracefully', () => {
      const data = createTestYaml({
        subject: { subject_id: 'rat01' },
      });

      const filename = generateFilename(data);

      // Should not contain placeholder
      expect(filename).not.toContain('{EXPERIMENT_DATE');
    });
  });
});
```

#### 5.2 Electrode Group Synchronization Tests

**File:** `src/__tests__/integration/electrode-ntrode-sync.test.js`

```javascript
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useState } from 'react';

// Mock electrode group management from App.js
function useElectrodeGroups() {
  const [formData, setFormData] = useState({
    electrode_groups: [],
    ntrode_electrode_group_channel_map: [],
  });

  const addElectrodeGroup = (deviceType) => {
    const newData = structuredClone(formData);
    const newId = formData.electrode_groups.length;

    newData.electrode_groups.push({ id: newId, device_type: deviceType });

    // Auto-generate ntrode maps
    const ntrodes = deviceTypeMap(deviceType);
    ntrodes.forEach(ntrode => {
      ntrode.electrode_group_id = newId;
      newData.ntrode_electrode_group_channel_map.push(ntrode);
    });

    setFormData(newData);
  };

  const removeElectrodeGroup = (id) => {
    const newData = structuredClone(formData);

    newData.electrode_groups = newData.electrode_groups.filter(g => g.id !== id);
    newData.ntrode_electrode_group_channel_map =
      newData.ntrode_electrode_group_channel_map.filter(n => n.electrode_group_id !== id);

    setFormData(newData);
  };

  const duplicateElectrodeGroup = (index) => {
    const newData = structuredClone(formData);
    const original = newData.electrode_groups[index];
    const newId = Math.max(...newData.electrode_groups.map(g => g.id)) + 1;

    // Duplicate electrode group
    const duplicate = { ...original, id: newId };
    newData.electrode_groups.push(duplicate);

    // Duplicate associated ntrodes
    const originalNtrodes = newData.ntrode_electrode_group_channel_map
      .filter(n => n.electrode_group_id === original.id);

    originalNtrodes.forEach(ntrode => {
      const newNtrode = {
        ...ntrode,
        ntrode_id: newData.ntrode_electrode_group_channel_map.length,
        electrode_group_id: newId,
      };
      newData.ntrode_electrode_group_channel_map.push(newNtrode);
    });

    setFormData(newData);
  };

  return { formData, addElectrodeGroup, removeElectrodeGroup, duplicateElectrodeGroup };
}

describe('Electrode Group & Ntrode Synchronization', () => {
  describe('Add Electrode Group', () => {
    it('creates electrode group with auto-generated ntrode maps', () => {
      const { result } = renderHook(() => useElectrodeGroups());

      act(() => {
        result.current.addElectrodeGroup('tetrode_12.5');
      });

      expect(result.current.formData.electrode_groups).toHaveLength(1);
      expect(result.current.formData.ntrode_electrode_group_channel_map).toHaveLength(1);
      expect(result.current.formData.ntrode_electrode_group_channel_map[0].electrode_group_id).toBe(0);
    });

    it('creates correct number of ntrodes for device type', () => {
      const { result } = renderHook(() => useElectrodeGroups());

      act(() => {
        result.current.addElectrodeGroup('128c-4s6mm6cm-15um-26um-sl');
      });

      // 128 channels / 4 per ntrode = 32 ntrodes
      expect(result.current.formData.ntrode_electrode_group_channel_map).toHaveLength(32);
    });
  });

  describe('Remove Electrode Group', () => {
    it('removes electrode group AND associated ntrode maps', () => {
      const { result } = renderHook(() => useElectrodeGroups());

      act(() => {
        result.current.addElectrodeGroup('tetrode_12.5');
        result.current.addElectrodeGroup('tetrode_12.5');
      });

      expect(result.current.formData.electrode_groups).toHaveLength(2);
      expect(result.current.formData.ntrode_electrode_group_channel_map).toHaveLength(2);

      act(() => {
        result.current.removeElectrodeGroup(0);
      });

      expect(result.current.formData.electrode_groups).toHaveLength(1);
      expect(result.current.formData.ntrode_electrode_group_channel_map).toHaveLength(1);
      expect(result.current.formData.ntrode_electrode_group_channel_map[0].electrode_group_id).toBe(1);
    });

    it('does not affect other electrode groups', () => {
      const { result } = renderHook(() => useElectrodeGroups());

      act(() => {
        result.current.addElectrodeGroup('tetrode_12.5');
        result.current.addElectrodeGroup('A1x32-6mm-50-177-H32_21mm');
        result.current.addElectrodeGroup('tetrode_12.5');
      });

      const beforeRemoval = result.current.formData.ntrode_electrode_group_channel_map[2];

      act(() => {
        result.current.removeElectrodeGroup(1);
      });

      const afterRemoval = result.current.formData.ntrode_electrode_group_channel_map
        .find(n => n.electrode_group_id === 2);

      expect(afterRemoval).toBeTruthy();
    });
  });

  describe('Duplicate Electrode Group', () => {
    it('duplicates electrode group with new ID', () => {
      const { result } = renderHook(() => useElectrodeGroups());

      act(() => {
        result.current.addElectrodeGroup('tetrode_12.5');
      });

      const originalId = result.current.formData.electrode_groups[0].id;

      act(() => {
        result.current.duplicateElectrodeGroup(0);
      });

      expect(result.current.formData.electrode_groups).toHaveLength(2);
      expect(result.current.formData.electrode_groups[1].id).not.toBe(originalId);
    });

    it('duplicates associated ntrode maps with new IDs', () => {
      const { result } = renderHook(() => useElectrodeGroups());

      act(() => {
        result.current.addElectrodeGroup('tetrode_12.5');
        result.current.duplicateElectrodeGroup(0);
      });

      expect(result.current.formData.ntrode_electrode_group_channel_map).toHaveLength(2);

      const original = result.current.formData.ntrode_electrode_group_channel_map[0];
      const duplicate = result.current.formData.ntrode_electrode_group_channel_map[1];

      expect(duplicate.ntrode_id).not.toBe(original.ntrode_id);
      expect(duplicate.electrode_group_id).not.toBe(original.electrode_group_id);
      expect(duplicate.map).toEqual(original.map); // Same channel mapping
    });
  });

  describe('Edge Cases', () => {
    it('handles removing last electrode group', () => {
      const { result } = renderHook(() => useElectrodeGroups());

      act(() => {
        result.current.addElectrodeGroup('tetrode_12.5');
        result.current.removeElectrodeGroup(0);
      });

      expect(result.current.formData.electrode_groups).toHaveLength(0);
      expect(result.current.formData.ntrode_electrode_group_channel_map).toHaveLength(0);
    });

    it('maintains ID consistency after multiple operations', () => {
      const { result } = renderHook(() => useElectrodeGroups());

      act(() => {
        result.current.addElectrodeGroup('tetrode_12.5'); // ID: 0
        result.current.addElectrodeGroup('tetrode_12.5'); // ID: 1
        result.current.removeElectrodeGroup(0);
        result.current.addElectrodeGroup('tetrode_12.5'); // ID: 2
      });

      const ids = result.current.formData.electrode_groups.map(g => g.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(ids.length); // No duplicate IDs
    });
  });
});
```

### Phase 1 Deliverables Checklist

- [ ] **Unit tests** for all pure functions (validation, transforms, utils)
- [ ] **Unit tests** for all React components
- [ ] **State management tests** covering all update patterns
- [ ] **Integration tests** for YAML generation/import
- [ ] **Integration tests** for electrode/ntrode synchronization
- [ ] **Performance benchmarks** for critical paths
- [ ] **Property-based tests** for complex logic
- [ ] **80% code coverage** achieved (enforced by CI)
- [ ] **Test documentation** explaining patterns and helpers
- [ ] **CI passing** with all tests green

---

## Phase 2: Critical Bug Fixes with TDD (Weeks 6-7)

**Goal:** Fix P0 bugs using strict Test-Driven Development

**Effort:** 50 hours

**Process for EVERY bug fix:**

1. **Write failing test** that reproduces the bug
2. **Run test** → Verify it FAILS (proves test catches bug)
3. **Fix the bug** with minimal code change
4. **Run test** → Verify it PASSES
5. **Run regression suite** → Verify no new bugs
6. **Document the fix** in CHANGELOG.md

### Week 6: Data Corruption Fixes

#### Bug #1: Camera ID Float Parsing

**Step 1: Write Failing Test**

**File:** `src/__tests__/unit/validation/bug-fixes/camera-id-float.test.js`

```javascript
import { describe, it, expect } from 'vitest';
import { commaSeparatedStringToNumber } from '@/utils';
import { jsonschemaValidation } from '@/App';

describe('BUG FIX: Camera ID Float Parsing (#3)', () => {
  it('SHOULD reject float camera IDs', () => {
    const yaml = {
      // ... valid base data
      cameras: [{ id: 1.5, meters_per_pixel: 0.001 }],
    };

    const result = jsonschemaValidation(yaml);

    // AFTER FIX: Should be invalid
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain('must be integer');
  });

  it('SHOULD accept integer camera IDs', () => {
    const yaml = {
      // ... valid base data
      cameras: [{ id: 1, meters_per_pixel: 0.001 }],
    };

    const result = jsonschemaValidation(yaml);

    expect(result.valid).toBe(true);
  });

  it('SHOULD filter floats from comma-separated ID lists', () => {
    const result = commaSeparatedStringToNumber('1, 2.5, 3', { integersOnly: true });

    // AFTER FIX: Should filter out 2.5
    expect(result).toEqual([1, 3]);
  });
});
```

**Step 2: Run Test → FAILS ❌**

```bash
$ npm test -- camera-id-float

❌ BUG FIX: Camera ID Float Parsing (#3) > SHOULD reject float camera IDs
   Expected: false
   Received: true

   REASON: Test confirms bug exists
```

**Step 3: Fix the Bug**

**File:** `src/utils.js`

```javascript
// BEFORE (accepts floats):
export const commaSeparatedStringToNumber = (str) => {
  return str
    .split(',')
    .map(s => parseFloat(s.trim()))  // ❌ parseFloat accepts 1.5
    .filter(n => !isNaN(n));
};

// AFTER (rejects floats for IDs):
export const commaSeparatedStringToNumber = (str, options = {}) => {
  const { integersOnly = false } = options;

  return str
    .split(',')
    .map(s => s.trim())
    .filter(s => {
      if (!isNumeric(s)) return false;
      if (integersOnly && !isInteger(s)) return false;  // ✅ Reject floats
      return true;
    })
    .map(s => parseInt(s, 10));  // ✅ Use parseInt for integers
};
```

**File:** `src/App.js`

```javascript
// Update onBlur handler to use integersOnly for ID fields
const onBlur = (event) => {
  const { name, value, type } = event.target;

  // Detect ID fields
  const isIdField = name.includes('id') || name.includes('_ids');

  if (type === 'text' && value.includes(',')) {
    const parsed = commaSeparatedStringToNumber(value, {
      integersOnly: isIdField  // ✅ Enforce integers for IDs
    });
    updateFormData(name, parsed);
  }
  // ... rest of handler
};
```

**File:** `src/nwb_schema.json`

```json
{
  "cameras": {
    "items": {
      "properties": {
        "id": {
          "type": "integer"  // ✅ Already correct, enforce in code too
        }
      }
    }
  }
}
```

**Step 4: Run Test → PASSES ✅**

```bash
$ npm test -- camera-id-float

✅ BUG FIX: Camera ID Float Parsing (#3)
   ✓ SHOULD reject float camera IDs (12ms)
   ✓ SHOULD accept integer camera IDs (8ms)
   ✓ SHOULD filter floats from comma-separated ID lists (3ms)
```

**Step 5: Run Regression Suite → PASSES ✅**

```bash
$ npm run test:coverage -- --run

✅ All tests passed
   Coverage: 82% (target: 80%)
```

**Step 6: Document the Fix**

**File:** `CHANGELOG.md`

```markdown
## [Unreleased]

### Fixed
- **CRITICAL:** Camera ID now correctly rejects float values (e.g., 1.5) and only accepts integers (#3)
  - Added `integersOnly` option to `commaSeparatedStringToNumber`
  - Updated onBlur handler to detect ID fields and enforce integer validation
  - Added regression test to prevent future float acceptance
  - Impact: Prevents invalid data from entering YAML that would fail Python validation
```

#### Bug #2: Empty String Validation

**Follow same TDD process...**

[Similar detailed steps for each P0 bug]

### Week 7: Schema & Spyglass Compatibility

#### Bug #4: Schema Synchronization

**File:** `.github/workflows/schema-sync.yml`

```yaml
name: Schema Synchronization Check

on:
  pull_request:
    paths:
      - 'src/nwb_schema.json'

jobs:
  check-sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          path: web-app

      - uses: actions/checkout@v4
        with:
          repository: LorenFrankLab/trodes_to_nwb
          path: python-package

      - name: Compare schemas
        run: |
          WEB_SCHEMA="web-app/src/nwb_schema.json"
          PY_SCHEMA="python-package/src/trodes_to_nwb/nwb_schema.json"

          if ! diff -u "$WEB_SCHEMA" "$PY_SCHEMA"; then
            echo "❌ Schema mismatch detected!"
            echo ""
            echo "The schemas in the two repositories are out of sync."
            echo "Please update BOTH repositories with the same schema changes."
            echo ""
            echo "Steps to fix:"
            echo "1. Copy the schema to both repositories"
            echo "2. Run tests in BOTH repositories"
            echo "3. Create PRs in BOTH repositories"
            exit 1
          fi

          echo "✅ Schemas are synchronized"
```

**Test:**

```javascript
describe('BUG FIX: Schema Synchronization (#4)', () => {
  it('detects schema changes in PR', async () => {
    // Mock GitHub Actions context
    const schemaChanged = process.env.GITHUB_PR_FILES?.includes('nwb_schema.json');

    if (schemaChanged) {
      // Verify CI job runs
      expect(process.env.CI_SCHEMA_CHECK).toBe('true');
    }
  });

  it('compares schema hashes', () => {
    const webSchema = require('@/nwb_schema.json');
    const pythonSchema = require('../../../../trodes_to_nwb/src/trodes_to_nwb/nwb_schema.json');

    expect(JSON.stringify(webSchema)).toBe(JSON.stringify(pythonSchema));
  });
});
```

### Phase 2 Deliverables Checklist

- [ ] **Bug #1 Fixed:** Camera ID float parsing (test → fix → verify)
- [ ] **Bug #2 Fixed:** Empty string validation (test → fix → verify)
- [ ] **Bug #3 Fixed:** Schema synchronization automated (test → fix → verify)
- [ ] **Bug #4 Fixed:** VARCHAR length limits enforced (test → fix → verify)
- [ ] **Bug #5 Fixed:** Sex enum validation (test → fix → verify)
- [ ] **Bug #6 Fixed:** Subject ID pattern enforcement (test → fix → verify)
- [ ] **Bug #7 Fixed:** Brain region normalization (test → fix → verify)
- [ ] **Bug #8 Fixed:** Auto-save implemented (test → fix → verify)
- [ ] **Bug #9 Fixed:** beforeunload warning added (test → fix → verify)
- [ ] **Bug #10 Fixed:** Required field indicators (test → fix → verify)
- [ ] **All regression tests pass** (no new bugs introduced)
- [ ] **Coverage maintained** at 80%+
- [ ] **CHANGELOG.md updated** with all fixes
- [ ] **Integration tests pass** with Python package

---

## Phase 3: Architecture Refactoring (Weeks 8-11)

**Goal:** Decompose App.js monolith with tests protecting against regressions

**Effort:** 80 hours

### Week 8: Extract Context & Hooks

#### 3.1 Create Form Context

**File:** `src/contexts/FormContext.jsx`

```typescript
import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { produce } from 'immer';

interface FormContextValue {
  formData: FormData;
  updateFormData: (key: string, value: any) => void;
  updateFormArray: (key: string, value: any[]) => void;
  resetForm: () => void;
  isDirty: boolean;
}

const FormContext = createContext<FormContextValue | null>(null);

export function FormProvider({ children, initialData = defaultYMLValues }) {
  const [formData, setFormData] = useState(initialData);
  const [originalData] = useState(initialData);

  // Use Immer for 10x faster immutable updates
  const updateFormData = useCallback((key, value) => {
    setFormData(produce(draft => {
      draft[key] = value;
    }));
  }, []);

  const updateFormArray = useCallback((key, value) => {
    setFormData(produce(draft => {
      draft[key] = value;
    }));
  }, []);

  const resetForm = useCallback(() => {
    setFormData(initialData);
  }, [initialData]);

  const isDirty = useMemo(() => {
    return JSON.stringify(formData) !== JSON.stringify(originalData);
  }, [formData, originalData]);

  const value = useMemo(() => ({
    formData,
    updateFormData,
    updateFormArray,
    resetForm,
    isDirty,
  }), [formData, updateFormData, updateFormArray, resetForm, isDirty]);

  return <FormContext.Provider value={value}>{children}</FormContext.Provider>;
}

export function useFormContext() {
  const context = useContext(FormContext);
  if (!context) {
    throw new Error('useFormContext must be used within FormProvider');
  }
  return context;
}
```

**Test:**

```javascript
describe('FormContext', () => {
  it('provides form data to children', () => {
    const { result } = renderHook(() => useFormContext(), {
      wrapper: ({ children }) => <FormProvider>{children}</FormProvider>,
    });

    expect(result.current.formData).toBeDefined();
  });

  it('updates form data immutably', () => {
    const { result } = renderHook(() => useFormContext(), {
      wrapper: ({ children }) => <FormProvider>{children}</FormProvider>,
    });

    const originalData = result.current.formData;

    act(() => {
      result.current.updateFormData('session_id', 'test_001');
    });

    expect(result.current.formData.session_id).toBe('test_001');
    expect(result.current.formData).not.toBe(originalData);
  });

  it('tracks dirty state', () => {
    const { result } = renderHook(() => useFormContext(), {
      wrapper: ({ children }) => <FormProvider>{children}</FormProvider>,
    });

    expect(result.current.isDirty).toBe(false);

    act(() => {
      result.current.updateFormData('session_id', 'test_001');
    });

    expect(result.current.isDirty).toBe(true);
  });
});
```

### Week 9: Component Extraction

[Extract sections into separate components with tests]

### Week 10: TypeScript Migration

**Strategy:** Gradual migration, file-by-file

**Step 1: Add TypeScript**

```bash
npm install --save-dev typescript @types/react @types/react-dom
```

**File:** `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "allowJs": true,
    "checkJs": false,
    "noEmit": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "paths": {
      "@/*": ["./src/*"],
      "@tests/*": ["./src/__tests__/*"]
    }
  },
  "include": ["src"],
  "exclude": ["node_modules", "build", "dist"]
}
```

**Step 2: Generate Types from Schema**

**File:** `scripts/generate-types-from-schema.js`

```javascript
const fs = require('fs');
const { compile } = require('json-schema-to-typescript');

const schema = require('../src/nwb_schema.json');

compile(schema, 'NWBMetadata', {
  bannerComment: '/* eslint-disable */\n// Auto-generated from nwb_schema.json',
  style: {
    singleQuote: true,
    semi: true,
  },
})
  .then(ts => fs.writeFileSync('src/types/nwb-metadata.ts', ts))
  .then(() => console.log('✅ Types generated from schema'));
```

**Add to package.json:**

```json
{
  "scripts": {
    "generate:types": "node scripts/generate-types-from-schema.js",
    "postinstall": "npm run generate:types"
  }
}
```

**Step 3: Migrate Utilities First**

**File:** `src/utils.ts`

```typescript
export function isInteger(value: string | number): boolean {
  return Number.isInteger(Number(value));
}

export function isNumeric(value: string | number): boolean {
  return !isNaN(Number(value)) && isFinite(Number(value));
}

export function commaSeparatedStringToNumber(
  str: string,
  options: { integersOnly?: boolean } = {}
): number[] {
  const { integersOnly = false } = options;

  return str
    .split(',')
    .map(s => s.trim())
    .filter(s => {
      if (!isNumeric(s)) return false;
      if (integersOnly && !isInteger(s)) return false;
      return true;
    })
    .map(s => (integersOnly ? parseInt(s, 10) : parseFloat(s)));
}
```

### Week 11: Performance Optimization

**Replace structuredClone with Immer**

**Before:**

```javascript
const updateFormData = (key, value) => {
  const newData = structuredClone(formData);  // 5-10ms
  newData[key] = value;
  setFormData(newData);
};
```

**After:**

```javascript
import { produce } from 'immer';

const updateFormData = (key, value) => {
  setFormData(produce(draft => {
    draft[key] = value;  // <1ms
  }));
};
```

**Test:**

```javascript
describe('Performance: Immer vs structuredClone', () => {
  it('Immer is faster than structuredClone for large state', () => {
    const largeState = {
      electrode_groups: Array(100).fill({ id: 0, name: 'test' }),
    };

    // structuredClone
    const start1 = performance.now();
    for (let i = 0; i < 100; i++) {
      structuredClone(largeState);
    }
    const duration1 = performance.now() - start1;

    // Immer
    const start2 = performance.now();
    for (let i = 0; i < 100; i++) {
      produce(largeState, draft => {
        draft.electrode_groups[0].name = 'updated';
      });
    }
    const duration2 = performance.now() - start2;

    console.log(`📊 structuredClone: ${duration1.toFixed(2)}ms`);
    console.log(`📊 Immer: ${duration2.toFixed(2)}ms`);
    console.log(`📊 Speedup: ${(duration1 / duration2).toFixed(2)}x`);

    // Immer should be significantly faster
    expect(duration2).toBeLessThan(duration1);
  });
});
```

### Phase 3 Deliverables Checklist

- [ ] **FormContext** extracted with tests
- [ ] **Custom hooks** extracted (useFormData, useElectrodeGroups, useValidation)
- [ ] **Components decomposed** (App.js → <500 LOC)
- [ ] **TypeScript** added incrementally (50%+ coverage)
- [ ] **Types generated** from nwb_schema.json
- [ ] **Immer** replacing structuredClone (10x speedup)
- [ ] **All tests pass** after refactoring (regressions caught)
- [ ] **Coverage maintained** at 80%+
- [ ] **Bundle size** measured and optimized
- [ ] **Documentation** updated for new architecture

---

## Phase 4: Modern Tooling & DX (Weeks 12-14)

**Goal:** Replace outdated tools with modern alternatives

**Effort:** 60 hours

### Week 12: Replace ESLint + Prettier with Biome

**Why Biome?**

- 100x faster than ESLint + Prettier
- Single tool (no config conflicts)
- Zero configuration needed
- Built-in import sorting
- JSON/YAML formatting

**Install:**

```bash
npm install --save-dev @biomejs/biome
```

**File:** `biome.json`

```json
{
  "$schema": "https://biomejs.dev/schemas/1.4.1/schema.json",
  "organizeImports": {
    "enabled": true
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "suspicious": {
        "noExplicitAny": "warn",
        "noArrayIndexKey": "warn"
      },
      "style": {
        "noNonNullAssertion": "warn",
        "useConst": "error"
      },
      "correctness": {
        "noUnusedVariables": "error",
        "useExhaustiveDependencies": "warn"
      }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "trailingComma": "all",
      "semicolons": "always"
    }
  },
  "json": {
    "formatter": {
      "enabled": true
    }
  }
}
```

**Update package.json:**

```json
{
  "scripts": {
    "lint": "biome check .",
    "lint:fix": "biome check --apply .",
    "format": "biome format --write ."
  }
}
```

**Migration:**

```bash
# Run Biome to see what needs fixing
npm run lint

# Auto-fix everything possible
npm run lint:fix

# Remove old tools
npm uninstall eslint prettier eslint-config-react-app
```

### Week 13: Add Advanced Testing Tools

#### 13.1 Visual Regression Testing with Chromatic

**Install:**

```bash
npm install --save-dev chromatic
```

**File:** `.storybook/main.js` (if using Storybook)

```javascript
module.exports = {
  stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
    '@storybook/addon-a11y',
  ],
};
```

**File:** `src/components/InputElement.stories.jsx`

```javascript
export default {
  title: 'Form/InputElement',
  component: InputElement,
};

export const Default = {
  args: {
    title: 'Test Field',
    name: 'test',
    value: '',
    onChange: () => {},
  },
};

export const WithError = {
  args: {
    ...Default.args,
    value: '',
    required: true,
  },
  play: async ({ canvasElement }) => {
    const input = canvasElement.querySelector('input');
    input.setCustomValidity('This field is required');
  },
};

export const Filled = {
  args: {
    ...Default.args,
    value: 'Test value',
  },
};
```

**Run visual tests:**

```bash
npx chromatic --project-token=<token>
```

#### 13.2 Property-Based Testing with fast-check

**Install:**

```bash
npm install --save-dev fast-check
```

**File:** `src/__tests__/unit/validation/property-based.test.js`

```javascript
import { fc } from 'fast-check';
import { commaSeparatedStringToNumber } from '@/utils';

describe('Property-Based Tests', () => {
  it('commaSeparatedStringToNumber always returns array', () => {
    fc.assert(
      fc.property(fc.string(), (str) => {
        const result = commaSeparatedStringToNumber(str);
        return Array.isArray(result);
      })
    );
  });

  it('parsed numbers are all numeric', () => {
    fc.assert(
      fc.property(fc.array(fc.integer()), (numbers) => {
        const str = numbers.join(', ');
        const result = commaSeparatedStringToNumber(str);

        return result.every(n => typeof n === 'number' && !isNaN(n));
      })
    );
  });

  it('integersOnly filters out floats', () => {
    fc.assert(
      fc.property(fc.array(fc.float()), (numbers) => {
        const str = numbers.join(', ');
        const result = commaSeparatedStringToNumber(str, { integersOnly: true });

        return result.every(n => Number.isInteger(n));
      })
    );
  });
});
```

### Week 14: Add Code Quality Tools

#### 14.1 Bundle Size Monitoring

**File:** `.github/workflows/bundle-size.yml`

```yaml
name: Bundle Size Check

on: pull_request

jobs:
  check-size:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'

      - run: npm ci
      - run: npm run build

      - uses: andresz1/size-limit-action@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
```

**File:** `.size-limit.json`

```json
[
  {
    "name": "Main Bundle",
    "path": "build/static/js/main.*.js",
    "limit": "500 KB"
  },
  {
    "name": "CSS",
    "path": "build/static/css/*.css",
    "limit": "50 KB"
  }
]
```

#### 14.2 Dependency Vulnerability Scanning

**File:** `.github/workflows/security.yml`

```yaml
name: Security Scan

on:
  schedule:
    - cron: '0 0 * * 1'  # Weekly
  pull_request:

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4

      - name: Run npm audit
        run: npm audit --audit-level=moderate

      - name: Check for outdated dependencies
        run: npm outdated || true
```

### Phase 4 Deliverables Checklist

- [ ] **Biome** replacing ESLint + Prettier (100x faster)
- [ ] **Chromatic** for visual regression testing
- [ ] **fast-check** for property-based testing
- [ ] **Bundle size monitoring** in CI
- [ ] **Security scanning** automated
- [ ] **Type coverage** at 90%+
- [ ] **Documentation** for new tooling
- [ ] **Developer onboarding guide** updated

---

## Phase 5: Polish & Documentation (Weeks 15-16)

**Goal:** Final polish, comprehensive documentation, deployment

**Effort:** 30 hours

### Week 15: User Experience Polish

[Documentation, error messages, accessibility fixes]

### Week 16: Deployment & Handoff

[Production deployment, monitoring setup, team training]

---

## Modern Tooling Stack

### Summary Table

| Category | Old | New | Benefit |
|----------|-----|-----|---------|
| **Testing** | Jest | Vitest | 10x faster, native ESM |
| **Linting** | ESLint + Prettier | Biome | 100x faster, single tool |
| **Types** | PropTypes | TypeScript | Compile-time safety |
| **State** | structuredClone | Immer | 10x faster updates |
| **E2E** | Manual | Playwright | Automated, multi-browser |
| **Visual** | Manual | Chromatic | Catch UI regressions |
| **Coverage** | None | Vitest + c8 | V8-native, accurate |
| **Bundle** | None | size-limit | Prevent bloat |

---

## Risk Mitigation Strategy

### Rollback Plan

Every phase has a rollback point:

**Phase 0:** No production code changed, can abandon
**Phase 1:** Tests added, no behavior changed, can revert
**Phase 2:** Each bug fix is isolated, can cherry-pick
**Phase 3:** Feature flags control new architecture
**Phase 4:** Old tools remain until migration complete
**Phase 5:** Gradual rollout with monitoring

### Feature Flags

**File:** `src/feature-flags.js`

```javascript
export const FEATURE_FLAGS = {
  USE_NEW_CONTEXT: process.env.REACT_APP_USE_NEW_CONTEXT === 'true',
  USE_IMMER: process.env.REACT_APP_USE_IMMER === 'true',
  USE_TYPESCRIPT: process.env.REACT_APP_USE_TYPESCRIPT === 'true',
};
```

**Usage:**

```javascript
import { FEATURE_FLAGS } from './feature-flags';

const updateFormData = FEATURE_FLAGS.USE_IMMER
  ? updateFormDataWithImmer
  : updateFormDataWithClone;
```

---

## Success Metrics

### Phase 0 Success Criteria

- [ ] Baselines established for 100% of current behavior
- [ ] CI pipeline running all tests automatically
- [ ] 0 regressions detected (all baseline tests pass)

### Phase 1 Success Criteria

- [ ] 80%+ code coverage achieved
- [ ] <5s unit test execution time
- [ ] 0 regressions in baseline tests

### Phase 2 Success Criteria

- [ ] All 10 P0 bugs fixed with TDD
- [ ] 100% of fixes have regression tests
- [ ] 0 new bugs introduced

### Phase 3 Success Criteria

- [ ] App.js reduced from 2,767 → <500 LOC
- [ ] 10x performance improvement (Immer)
- [ ] 50%+ TypeScript coverage

### Phase 4 Success Criteria

- [ ] 100x faster linting (Biome)
- [ ] Visual regression tests catching UI changes
- [ ] Bundle size monitored and optimized

### Phase 5 Success Criteria

- [ ] Production deployment successful
- [ ] 0 critical bugs in production
- [ ] Team trained and onboarded

---

## Conclusion

This refactoring plan prioritizes **safety over speed** by:

1. **Establishing baselines first** (Phase 0)
2. **Building comprehensive tests** (Phase 1)
3. **Fixing bugs with TDD** (Phase 2)
4. **Refactoring with test protection** (Phase 3)
5. **Modernizing tools** (Phase 4)
6. **Polishing and documenting** (Phase 5)

**Total Timeline:** 16 weeks
**Total Effort:** ~350 hours
**Risk Level:** Low (tests protect against regressions)
**ROI:** High (prevents data corruption, improves velocity)

**Next Steps:**

1. Review this plan with team
2. Get approval for Phase 0 (2 weeks, 60 hours)
3. Begin baseline establishment
4. Report progress weekly

---

**Document Version:** 1.0
**Created:** 2025-01-23
**Author:** Claude Code
**Status:** Draft - Awaiting Review
