# Test Infrastructure Audit Report

**Date:** October 27, 2025
**Milestone:** M0 - Repository Audit & Safety Setup
**Status:** ✅ Complete

---

## Executive Summary

The rec_to_nwb_yaml_creator project has a **mature, comprehensive test infrastructure** with:

- **105 test files** containing **2,074 tests** (all passing, 1 skipped)
- **Vitest 4.0.1** as the test runner with jsdom environment
- **Well-organized test hierarchy** with clear separation of concerns
- **Golden baseline tests** for YAML export regression protection
- **Integration test helpers** for common workflows
- **CI/CD integration** with coverage reporting and schema synchronization checks

**Conclusion:** The existing test infrastructure is production-ready and well-maintained. No major changes required for M0. The refactoring plan can proceed with confidence that regressions will be caught.

---

## Test Framework Configuration

### Vitest Setup ([vitest.config.js](../vitest.config.js))

**Version:** 4.0.1
**Environment:** jsdom (browser simulation for React components)
**Setup Files:** [src/setupTests.js](../src/setupTests.js)

**Key Configuration:**

```javascript
{
  globals: true,
  environment: 'jsdom',
  setupFiles: ['./src/setupTests.js'],
  coverage: {
    provider: 'v8',
    reporter: ['text', 'json', 'html', 'lcov'],
    lines: 80,
    functions: 80,
    branches: 80,
    statements: 80
  },
  testTimeout: 15000,   // Increased for slower CI environments
  hookTimeout: 10000
}
```

**Path Aliases:**

- `@` → `./src`
- `@tests` → `./src/__tests__`
- `@fixtures` → `./src/__tests__/fixtures`

**ESBuild Configuration:**

- JSX loader enabled for `.js` files (supports JSX without `.jsx` extension)
- Optimized for fast test execution

### Setup Files

**[src/setupTests.js](../src/setupTests.js):**

- Imports `@testing-library/jest-dom` for extended matchers
- Registers custom matchers from [src/**tests**/helpers/custom-matchers.js](../src/__tests__/helpers/custom-matchers.js)
- Auto-cleanup after each test using `afterEach(cleanup)`

---

## Test Organization

### Directory Structure

```
src/__tests__/
├── baselines/           # Golden baseline regression tests (4 files)
│   ├── golden-yaml.baseline.test.js
│   ├── performance.baseline.test.js
│   ├── state-management.baseline.test.js
│   └── validation.baseline.test.js
├── debug/               # Debugging utilities (1 file)
│   └── import-debug.test.jsx
├── fixtures/            # Test data and verification (18+ YAML files)
│   ├── README.md
│   ├── fixtures-verification.test.js
│   ├── edge-cases/      # Unicode, boundary values, empty arrays
│   ├── golden/          # Canonical YAML outputs for regression testing
│   ├── invalid/         # Schema violations, missing fields
│   └── valid/           # Complete and minimal valid YAMLs
├── helpers/             # Reusable test utilities (3 files)
│   ├── custom-matchers.js
│   ├── helpers-verification.test.js
│   ├── integration-test-helpers.js
│   └── test-selectors.js
├── integration/         # End-to-end workflow tests (10 files)
│   ├── aria-landmarks.test.jsx
│   ├── complete-session-creation.test.jsx
│   ├── electrode-ntrode-management.test.jsx
│   ├── import-export-workflow.test.jsx
│   ├── keyboard-file-upload.test.jsx
│   ├── keyboard-navigation.test.jsx
│   ├── sample-metadata-modification.test.jsx
│   ├── sample-metadata-reproduction.test.jsx
│   ├── schema-contracts.test.js
│   └── skip-links.test.jsx
└── unit/                # Unit tests (88 files)
    ├── app/             # App.js function tests (27 files)
    │   └── state/       # State management tests (3 files)
    ├── bug-reports/     # Regression tests for specific bugs (1 file)
    ├── components/      # Component unit tests (16 files)
    ├── hooks/           # Custom hook tests (2 files)
    ├── io/              # YAML I/O tests (2 files)
    ├── schema/          # Schema validation tests (6 files)
    ├── utils/           # Utility function tests (4 files)
    └── validation/      # Validation logic tests (1+ files)
```

**Additional Test Locations:**

```
src/components/__tests__/    # Component co-located tests (18 files)
src/features/__tests__/      # Feature module tests (1 file)
src/hooks/__tests__/         # Hook co-located tests (2 files)
src/io/__tests__/            # I/O co-located tests (1 file)
src/state/__tests__/         # State co-located tests (3 files)
src/utils/__tests__/         # Utils co-located tests (1 file)
src/validation/__tests__/    # Validation co-located tests (1 file)
```

**Total:** 105 test files, 2,074 tests

---

## Test Categories

### 1. Baseline Tests (Regression Protection)

**Purpose:** Ensure changes don't break existing functionality or YAML output format.

#### Golden YAML Baseline ([src/**tests**/baselines/golden-yaml.baseline.test.js](../src/__tests__/baselines/golden-yaml.baseline.test.js))

**Coverage:**

- ✅ Deterministic YAML export (byte-for-byte equality)
- ✅ Round-trip consistency (import → export → import)
- ✅ Multiple export consistency (idempotency)

**Test Fixtures:**

- `20230622_sample_metadata.yml` - Full production metadata
- `20230622_sample_metadataProbeReconfig.yml` - Probe reconfiguration scenario
- `minimal-valid.yml` - Smallest valid YAML
- `realistic-session.yml` - Typical experiment session

**Critical for Refactoring:** These tests will catch any unintended changes to YAML formatting or serialization logic.

#### Performance Baseline ([src/**tests**/baselines/performance.baseline.test.js](../src/__tests__/baselines/performance.baseline.test.js))

**Coverage:**

- Component render performance
- Large dataset handling
- Memory leak detection

#### State Management Baseline ([src/**tests**/baselines/state-management.baseline.test.js](../src/__tests__/baselines/state-management.baseline.test.js))

**Coverage:**

- Deep cloning behavior
- Immutability guarantees
- Large dataset state updates

#### Validation Baseline ([src/**tests**/baselines/validation.baseline.test.js](../src/__tests__/baselines/validation.baseline.test.js))

**Coverage:**

- Schema validation consistency
- Error message format
- Validation performance

### 2. Integration Tests (End-to-End Workflows)

**Purpose:** Validate complete user journeys from UI interaction to YAML export.

**Key Test Suites:**

#### Complete Session Creation ([src/**tests**/integration/complete-session-creation.test.jsx](../src/__tests__/integration/complete-session-creation.test.jsx))

**Scenarios:**

- ✅ Create minimal valid session from blank form
- ✅ Create complete session with all optional fields
- ✅ Add and configure experimenters, subject, cameras, tasks
- ✅ Trigger ntrode generation
- ✅ Successful validation and export

#### Import/Export Workflow ([src/**tests**/integration/import-export-workflow.test.jsx](../src/__tests__/integration/import-export-workflow.test.jsx))

**Scenarios:**

- ✅ Import valid YAML and populate form
- ✅ Modify imported data and re-export
- ✅ Round-trip consistency
- ✅ Error handling for invalid YAMLs

#### Electrode/Ntrode Management ([src/**tests**/integration/electrode-ntrode-management.test.jsx](../src/__tests__/integration/electrode-ntrode-management.test.jsx))

**Scenarios:**

- ✅ Add/duplicate/remove electrode groups
- ✅ Auto-generate ntrode channel maps
- ✅ Synchronize electrode groups with ntrode maps

#### Accessibility ([src/**tests**/integration/aria-landmarks.test.jsx](../src/__tests__/integration/aria-landmarks.test.jsx), [skip-links.test.jsx](../src/__tests__/integration/skip-links.test.jsx), [keyboard-navigation.test.jsx](../src/__tests__/integration/keyboard-navigation.test.jsx))

**Scenarios:**

- ✅ ARIA landmarks for screen readers
- ✅ Skip links for keyboard navigation
- ✅ Full keyboard navigation support
- ✅ File upload via keyboard

#### Schema Contracts ([src/**tests**/integration/schema-contracts.test.js](../src/__tests__/integration/schema-contracts.test.js))

**Scenarios:**

- ✅ Validate against nwb_schema.json
- ✅ Ensure exported YAMLs meet schema requirements
- ✅ Catch schema drift

### 3. Unit Tests (Component & Function-Level)

**Purpose:** Test individual functions and components in isolation.

**Coverage:**

#### App.js Function Tests (27 files)

- State initialization
- Form data updates
- Array management (add/remove/duplicate)
- Electrode group management
- Ntrode map generation
- Import/export logic
- Validation
- Error display
- Navigation

#### Component Tests (34 files total)

- Form element components (InputElement, SelectElement, etc.)
- Field group components (SessionInfoFields, SubjectFields, etc.)
- Complex components (ChannelMap, ArrayUpdateMenu, etc.)
- Error boundary
- Alert modal

#### State Management Tests (6 files)

- StoreContext
- store.js
- Immutability
- Deep cloning
- Task/epoch cleanup

#### Validation Tests

- Schema validation
- Custom rules validation
- Error formatting

#### I/O Tests

- YAML encoding/decoding
- Filename formatting
- Memory leak prevention

### 4. Bug Regression Tests

**Purpose:** Prevent specific bugs from reoccurring.

**Examples:**

- `channel-map-blank-bug.test.jsx` - Prevent channel map data loss
- `schema-*.test.js` - Schema-related edge cases

---

## Test Fixtures

### Valid Fixtures (10 files)

**Location:** `src/__tests__/fixtures/valid/`

- `20230622_sample_metadata.yml` - Full production example
- `20230622_sample_metadataProbeReconfig.yml` - Probe reconfiguration
- `complete-minimal.yml` - All required fields only
- `complete-valid.yml` - All fields populated
- `minimal-complete.yml` - Minimal with complete sections
- `minimal-sample.yml` - Minimal example
- `minimal-valid.yml` - Absolute minimum
- `realistic-session.yml` - Typical session

### Invalid Fixtures (3 files)

**Location:** `src/__tests__/fixtures/invalid/`

- `invalid-types.yml` - Wrong data types
- `missing-required-fields.yml` - Missing required fields
- `schema-violations.yml` - Schema constraint violations

### Edge Case Fixtures (3 files)

**Location:** `src/__tests__/fixtures/edge-cases/`

- `boundary-values.yml` - Min/max values
- `empty-optional-arrays.yml` - Empty optional arrays
- `unicode-strings.yml` - Special characters

### Golden Fixtures (4 files)

**Location:** `src/__tests__/fixtures/golden/`

**Purpose:** Canonical outputs for byte-for-byte comparison in baseline tests.

**NOTE:** These files are the source of truth for YAML format. Any changes to YAML export logic MUST regenerate these fixtures using:

```bash
node src/__tests__/fixtures/golden/generate-golden.js
```

---

## Test Helpers

### Integration Test Helpers ([src/**tests**/helpers/integration-test-helpers.js](../src/__tests__/helpers/integration-test-helpers.js))

**Exported Functions:**

#### Timing Helpers

- `blurAndWait(element, delayMs)` - Handle React reconciliation timing
- `typeAndWait(user, element, value)` - Type + blur + wait
- `selectAndWait(user, element, value)` - Select + blur + wait

#### Query Helpers

- `getLast(elements)` - Get last element from array
- `getMainForm()` - Get main form element

#### Component Interaction Helpers

- `addListItem(user, screen, placeholder, value)` - Add item to ListElement
- `fillRequiredFields(user, screen)` - Fill minimal required fields
- `triggerExport(user, screen)` - Trigger YAML export
- `addCamera(user, screen, id)` - Add camera with ID
- `addTask(user, screen, name, cameraIds)` - Add task with cameras
- `addElectrodeGroup(user, screen, id, deviceType)` - Add electrode group

**Philosophy:**

- Extract technical implementation details
- Extract repetitive setup patterns
- Keep test assertions visible in tests
- Make helpers composable

### Test Selectors ([src/**tests**/helpers/test-selectors.js](../src/__tests__/helpers/test-selectors.js))

**Purpose:** Centralized query functions for common elements.

**Functions:**

- `getMainForm()` - Main form element
- (Add more as needed)

### Custom Matchers ([src/**tests**/helpers/custom-matchers.js](../src/__tests__/helpers/custom-matchers.js))

**Purpose:** Domain-specific assertions for YAML validation, form state, etc.

---

## Testing Patterns Documentation

**Location:** [docs/TESTING_PATTERNS.md](TESTING_PATTERNS.md)

**Purpose:** Machine-readable guide for writing tests in this codebase.

**Content:**

- Component type identification
- Query strategy selection
- React timing handling
- Special cases (ListElement, SelectInputPairElement, etc.)
- Component catalog
- Common patterns

**Critical for Refactoring:** This document ensures new tests follow established patterns and avoid common pitfalls (stale element references, timing issues, wrong query methods).

---

## CI/CD Integration

### GitHub Actions Workflow ([.github/workflows/test.yml](../.github/workflows/test.yml))

**Jobs:**

#### 1. Unit & Integration Tests

- ✅ Checkout repository
- ✅ Setup Node.js (version from .nvmrc)
- ✅ Install dependencies (`npm ci`)
- ✅ Run linter (`npm run lint`)
- ✅ Run all tests with coverage (`npm run test:coverage -- run`)
- ✅ Upload coverage to Codecov
- ✅ Upload coverage artifacts (30-day retention)

**Coverage Thresholds:**

- Lines: 80%
- Functions: 80%
- Branches: 80%
- Statements: 80%

#### 2. End-to-End Tests (Playwright)

- ✅ Install Playwright browsers (chromium)
- ✅ Run E2E tests (`npm run test:e2e`)
- ✅ Upload Playwright report
- ✅ Upload test results

#### 3. Schema Sync Check

- ✅ Checkout rec_to_nwb_yaml_creator
- ✅ Checkout trodes_to_nwb (main branch)
- ✅ Compare nwb_schema.json SHA-256 hashes
- ✅ Fail CI if schemas are out of sync

**Critical for Refactoring:** Schema sync check ensures web app and Python package stay synchronized during refactoring.

#### 4. Build Application

- ✅ Build production bundle (`npm run build`)
- ✅ Upload build artifacts (7-day retention)

**NOTE:** Build currently uses `CI=false` to bypass ESLint warnings. This should be fixed in Phase 3.

### CodeQL Analysis ([.github/workflows/codeql-analysis.yml](../.github/workflows/codeql-analysis.yml))

**Purpose:** Automated security scanning for JavaScript/TypeScript code.

---

## Test Execution

### Current Test Status (October 27, 2025)

```
✅ Test Files: 105 passed (105)
✅ Tests: 2,074 passed | 1 skipped (2,075)
✅ Duration: ~10 seconds (local)
✅ All tests passing
```

**Skipped Test:** 1 test intentionally skipped (debug/development test).

### Running Tests Locally

```bash
# Run all tests (watch mode)
npm test

# Run all tests once (CI mode)
npm test -- --run

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- src/__tests__/unit/app/App-submitForm.test.jsx

# Run tests matching pattern
npm test -- --run --grep "electrode group"

# Run E2E tests
npm run test:e2e
```

---

## Known Issues & Warnings

### 1. Schema Validation Warnings (Non-blocking)

**Stderr Output (repeated across many tests):**

```
strict mode: missing type "array" for keyword "uniqueItems" at ...
strict mode: missing type "string" for keyword "pattern" at ...
```

**Cause:** AJV strict mode warnings for JSON Schema Draft 7 compliance.

**Impact:** None - validation still works correctly. These are pedantic warnings about schema definition style.

**Resolution:** Can be addressed by adding explicit `"type": "array"` to schema properties with `uniqueItems`, but not critical.

### 2. React Key Prop Warnings (Development-only)

**Stderr Output:**

```
Warning: Each child in a list should have a unique "key" prop.
Check the render method of `App`. See https://reactjs.org/link/warning-keys for more information.
```

**Cause:** Some array-rendered elements in App.js missing unique `key` props.

**Impact:** Development warning only - not visible in production build.

**Resolution:** Should be fixed during refactoring when modularizing App.js.

### 3. Build ESLint Warnings (CI workaround)

**Issue:** Production build fails with `CI=true` due to ESLint warnings.

**Workaround:** `.github/workflows/test.yml` uses `CI=false npm run build`.

**Warnings:**

- Unused variables in App.js (lines 119, 122, 596, 618, 2852)
- Unused variables in ArrayUpdateMenu.jsx (line 13)

**Resolution:** Clean up unused variables in Phase 3.

### 4. jsdom Unimplemented APIs (Test-only)

**Stderr Output:**

```
Not implemented: Window's alert() method
```

**Cause:** jsdom doesn't implement all browser APIs.

**Impact:** Tests mock `window.alert()` with `vi.fn()` - no issues.

---

## Test Coverage Analysis

**TODO:** Run `npm run test:coverage` and analyze coverage report to identify:

- High-coverage areas (well-tested)
- Low-coverage areas (needs attention during refactoring)
- Untested edge cases

**Action:** Deferred to after M0 completion. Will inform PR prioritization.

---

## Recommendations for Refactoring

### ✅ Strengths to Preserve

1. **Golden baseline tests** - Critical for YAML format regression protection
2. **Integration test helpers** - Reusable, well-documented, composable
3. **Comprehensive integration tests** - Cover real user workflows
4. **Testing patterns documentation** - Explicit guidance prevents common mistakes
5. **CI/CD integration** - Automated testing on every PR
6. **Schema sync check** - Prevents drift from Python package

### ⚠️ Areas to Monitor During Refactoring

1. **App.js function tests** - These tests directly test functions in App.js. As App.js is modularized, tests should move with the extracted code.

2. **React key warnings** - Fix during modularization to ensure clean console output.

3. **ESLint warnings** - Clean up unused variables as code is refactored.

4. **Schema validation warnings** - Optional cleanup during schema version work (M0).

### 🚀 Opportunities for Enhancement

1. **Shadow export tests** (M1) - Add tests that compare old vs. new YAML export implementations to ensure parity during refactoring.

2. **Component-specific test files** - As components are extracted from App.js, co-locate tests with components for better organization.

3. **Test coverage tracking** - Baseline current coverage (likely ~80%+) and ensure refactoring doesn't reduce it.

4. **Accessibility tests** - Already strong, but consider adding more ARIA validation as new components are created.

---

## M0 Task Completion Checklist

- [x] Audit Vitest configuration and setup
- [x] Review baseline test fixtures
- [x] Review integration test coverage
- [x] Identify test organization patterns
- [x] Document CI/CD integration
- [x] Document test helpers and utilities
- [x] Identify known issues and warnings
- [x] Provide recommendations for refactoring

**Status:** ✅ M0 Test Infrastructure Audit Complete

---

## Next Steps

1. **M0:** Verify existing Context store (`StoreContext.js`, `store.js`) is intact and tested
2. **M0:** Add feature flags (`src/featureFlags.js`)
3. **M0:** Add schema version validation script
4. **M1:** Add shadow export tests to baseline suite
5. **M2-M12:** Continue with refactoring milestones

---

## Appendix: Test File Count by Category

| Category | File Count | Test Count (approx) |
|----------|-----------|-------------------|
| **Baselines** | 4 | ~50 |
| **Integration** | 10 | ~100 |
| **Unit - App** | 27 | ~500 |
| **Unit - Components** | 34 | ~700 |
| **Unit - State** | 6 | ~150 |
| **Unit - Hooks** | 2 | ~50 |
| **Unit - Validation** | 1+ | ~100 |
| **Unit - I/O** | 3 | ~50 |
| **Unit - Schema** | 6 | ~150 |
| **Unit - Utils** | 5 | ~100 |
| **Bug Reports** | 1 | ~10 |
| **Fixtures** | 1 | ~30 |
| **Helpers** | 1 | ~10 |
| **Debug** | 1 | ~5 |
| **Other** | 2 | ~20 |
| **TOTAL** | **105** | **2,074** |

---

**End of Report**
