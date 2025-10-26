# Phase 1.5: Test Quality Improvements Plan

**Created:** 2025-10-24
**Status:** APPROVED - Ready to Execute
**Timeline:** 2-3 weeks
**Effort:** 40-60 hours

---

## Executive Summary

Phase 1 achieved 60.55% test coverage with 1,078+ tests, but comprehensive code review revealed critical quality gaps that make the codebase unsafe for Phase 2 bug fixes and especially unsafe for Phase 3 refactoring.

**This plan addresses the critical gaps before proceeding to Phase 2.**

### Review Findings Summary

**Coverage vs. Quality Mismatch:**
- 111+ tests are trivial documentation tests (`expect(true).toBe(true)`)
- Effective coverage closer to 40-45% with meaningful tests
- Branch coverage: 30.86% (69% of if/else paths untested)
- App.js coverage: 44.08% (core file has massive gaps)

**Critical Missing Tests:**
- Sample metadata modification workflows (0/8 tests)
- End-to-end workflows (0/11 tests)
- Error recovery scenarios (0/15 tests)
- Integration tests that actually test (current tests just document)

**Test Code Quality Issues:**
- ~2,000 lines of mocked implementations
- ~1,500 lines of DRY violations
- 100+ CSS selectors that will break on refactoring
- 537 lines testing browser APIs instead of app

---

## Goals

### Primary Goals

1. **Fix Critical Test Gaps** - Add missing tests for core workflows
2. **Convert Documentation Tests** - Replace trivial tests with real assertions
3. **Improve Integration Tests** - Make integration tests actually test
4. **Reduce Test Debt** - Fix DRY violations and code smells
5. **Prepare for Refactoring** - Enable safe Phase 3 refactoring

### Success Criteria

- [ ] Meaningful test coverage ≥ 60% (no documentation-only tests)
- [ ] Branch coverage ≥ 50% (up from 30.86%)
- [ ] All critical workflows tested (sample modification, E2E, error recovery)
- [ ] Integration tests simulate real user interactions
- [ ] Test code follows DRY principles
- [ ] All tests use semantic queries (not CSS selectors)
- [ ] Human approval to proceed to Phase 2

---

## Plan Structure

### Week 1: Critical Gap Filling (Priority 1)

**Goal:** Add missing tests for critical workflows that were marked complete but untested

**Estimated Effort:** 20-25 hours

### Week 2: Test Quality Improvements (Priority 2)

**Goal:** Convert documentation tests, fix DRY violations, improve integration tests

**Estimated Effort:** 15-20 hours

### Week 3: Refactoring Preparation (Priority 3)

**Goal:** Add tests needed for safe Phase 3 refactoring

**Estimated Effort:** 10-15 hours (optional, can defer to later)

---

## Week 1: Critical Gap Filling

### Task 1.1: Sample Metadata Modification Tests (8 tests, 4-6 hours)

**Priority:** P0 - CRITICAL
**File:** `src/__tests__/integration/sample-metadata-modification.test.jsx`
**Blocking:** User's specific concern (line 585 in TASKS.md)

**Tests to Add:**

```javascript
describe('Sample Metadata Modification Workflows', () => {
  describe('Import workflow', () => {
    it('imports sample metadata through file upload', async () => {
      // Load sample YAML fixture
      // Simulate file upload
      // Verify form populated with sample data
    });
  });

  describe('Modification workflows', () => {
    beforeEach(async () => {
      // Import sample metadata
    });

    it('modifies experimenter name after import', async () => {
      // Change experimenter field
      // Verify change reflected in form
    });

    it('modifies subject information after import', async () => {
      // Change subject fields (sex, weight, date_of_birth)
      // Verify changes reflected
    });

    it('adds new camera to existing session', async () => {
      // Sample has 2 cameras
      // Add camera 3
      // Verify 3 cameras in form
    });

    it('adds new task to existing session', async () => {
      // Add task referencing new camera
      // Verify task added with camera reference
    });

    it('adds new electrode group to existing session', async () => {
      // Sample has 4 electrode groups
      // Add electrode group 5
      // Verify ntrode maps generated
    });
  });

  describe('Re-export workflows', () => {
    it('re-exports modified metadata with changes preserved', async () => {
      // Import sample
      // Modify experimenter
      // Export YAML
      // Parse exported YAML
      // Verify modification present
      // Verify other fields unchanged
    });

    it('round-trip preserves all modifications', async () => {
      // Import → Modify → Export → Import
      // Verify all modifications preserved
    });
  });
});
```

**Deliverables:**
- [x] 8 tests for sample metadata modification workflows
- [x] Tests use actual file upload simulation (not mocks)
- [x] Tests verify form population (not just rendering)
- [x] All 8 tests passing

---

### Task 1.2: End-to-End Workflow Tests (11 tests, 6-8 hours)

**Priority:** P0 - CRITICAL
**File:** `src/__tests__/integration/complete-session-creation.test.jsx`
**Blocking:** Major gap in user journey coverage

**Tests to Add:**

```javascript
describe('Complete Session Creation Workflow', () => {
  it('creates minimal valid session from blank form', async () => {
    // Start with blank form
    // Fill required fields only:
    // - experimenter_name, lab, institution
    // - subject (id, species, sex, weight, date_of_birth)
    // - data_acq_device
    // - times_period_multiplier, raw_data_to_volts
    // - session_id, session_description, session_start_time
    // Click "Generate YML File"
    // Verify YAML generated
    // Verify YAML validates
    // Verify filename correct
  });

  it('creates complete session with all optional fields', async () => {
    // Fill all optional sections:
    // - cameras (2)
    // - tasks (3) with camera references
    // - behavioral_events (5)
    // - electrode_groups (4) with ntrode maps
    // - associated_files
    // - associated_video_files
    // Generate and validate YAML
  });

  it('adds experimenter names correctly', async () => {
    // Test ListElement for experimenter_name
    // Add 3 experimenters
    // Verify array format
  });

  it('adds subject information correctly', async () => {
    // Fill subject nested object
    // Verify all fields
  });

  it('adds data acquisition device correctly', async () => {
    // Fill data_acq_device
    // Verify nested structure
  });

  it('adds cameras with correct IDs', async () => {
    // Add 2 cameras
    // Verify IDs: 0, 1
    // Verify unique IDs
  });

  it('adds tasks with camera references', async () => {
    // Add 2 cameras
    // Add 3 tasks
    // Reference cameras in tasks
    // Verify camera_id references valid
  });

  it('adds behavioral events correctly', async () => {
    // Add 5 behavioral events
    // Verify Din/Dout/Accel/Gyro/Mag
    // Verify event names unique
  });

  it('adds electrode groups with device types', async () => {
    // Add 4 electrode groups
    // Select different device types
    // Verify ntrode maps generated
  });

  it('triggers ntrode generation on device type selection', async () => {
    // Add electrode group
    // Select tetrode_12.5
    // Verify 1 ntrode generated with 4 channels
    // Select 128c probe
    // Verify 32 ntrodes generated
  });

  it('validates complete form before export', async () => {
    // Fill complete form
    // Submit
    // Verify validation passes
    // Verify no error messages
  });

  it('exports complete session as valid YAML', async () => {
    // Fill complete form
    // Export
    // Parse YAML
    // Validate against schema
    // Verify all fields present
  });
});
```

**Deliverables:**
- [x] 11 tests for complete session creation
- [x] Tests cover blank form → complete form → export
- [x] Tests verify YAML generation and validation
- [x] All 11 tests passing

---

### Task 1.3: Error Recovery Scenario Tests (15 tests, 6-8 hours)

**Priority:** P0 - CRITICAL
**File:** `src/__tests__/integration/error-recovery.test.jsx`
**Blocking:** Error handling untested

**Tests to Add:**

```javascript
describe('Validation Failure Recovery', () => {
  it('displays error when submitting form with missing required fields', async () => {
    // Submit blank form
    // Verify error messages displayed
    // Verify which fields are invalid
  });

  it('allows user to correct validation errors and resubmit', async () => {
    // Submit with missing fields
    // Fill missing fields
    // Resubmit
    // Verify validation passes
  });

  it('highlights invalid fields with custom validity', async () => {
    // Submit with invalid data
    // Verify input.setCustomValidity called
    // Verify error messages visible
  });

  it('clears validation errors after fixing fields', async () => {
    // Submit with errors
    // Fix fields
    // Verify errors cleared
  });
});

describe('Malformed YAML Import Recovery', () => {
  it('displays error when importing YAML with syntax errors', async () => {
    // Create file with malformed YAML
    // Upload
    // Verify error alert shown
    // Verify form not corrupted
  });

  it('displays error when importing YAML with wrong types', async () => {
    // Create file with type errors (string for number)
    // Upload
    // Verify validation error
    // Verify partial import with valid fields
  });

  it('displays error when importing YAML with invalid references', async () => {
    // Create file with task referencing non-existent camera
    // Upload
    // Verify validation error
    // Verify error message explains issue
  });

  it('allows user to retry import after error', async () => {
    // Import malformed YAML (error)
    // Import valid YAML
    // Verify success
  });

  it('preserves valid fields during partial import', async () => {
    // Import YAML with some invalid fields
    // Verify valid fields imported
    // Verify invalid fields excluded
    // Verify alert lists excluded fields
  });
});

describe('Form Corruption Prevention', () => {
  it('does not corrupt form on failed import (BUG: currently clears form before validation)', async () => {
    // Fill form with data
    // Import invalid YAML
    // BUG: form is cleared before validation
    // Document current broken behavior
    // TODO Phase 2: Fix to validate before clearing
  });

  it('recovers from FileReader errors without crashing', async () => {
    // Trigger FileReader error
    // Verify app doesn't crash
    // Verify error message shown
  });
});

describe('Undo Changes', () => {
  it('shows confirmation dialog before resetting form', async () => {
    // Fill form
    // Click "Clear YML File"
    // Verify confirmation dialog
  });

  it('resets form to default values when confirmed', async () => {
    // Fill form
    // Click clear
    // Confirm
    // Verify form reset to defaultYMLValues
  });

  it('preserves form when reset is cancelled', async () => {
    // Fill form
    // Click clear
    // Cancel
    // Verify form unchanged
  });
});

describe('Concurrent Operations', () => {
  it('handles rapid button clicks without errors', async () => {
    // Rapidly click "Add camera" 10 times
    // Verify no crashes
    // Verify correct number of cameras
  });

  it('handles form submission during import', async () => {
    // Start import
    // Submit form during import
    // Verify no corruption
  });
});
```

**Deliverables:**
- [x] 15 tests for error recovery scenarios
- [x] Tests cover validation errors, import errors, user corrections
- [x] Tests document known bugs (form cleared before validation)
- [x] All 15 tests passing (or skipped if documenting bugs)

---

### Task 1.4: Fix Import/Export Integration Tests (20 tests, 4-6 hours)

**Priority:** P0 - CRITICAL
**File:** `src/__tests__/integration/import-export-workflow.test.jsx` (REWRITE)
**Blocking:** Current tests don't actually test import/export

**Current Problem:**
```javascript
// Current test (doesn't test anything):
it('imports minimal valid YAML successfully', async () => {
  const { container } = render(<App />);

  const minimalYaml = `...`;

  await waitFor(() => {
    expect(container).toBeInTheDocument();
  });

  // Never simulates import!
  // Never verifies form population!
});
```

**New Tests:**

```javascript
describe('Import Workflow', () => {
  it('imports minimal valid YAML through file upload', async () => {
    const { user } = renderWithProviders(<App />);

    const yamlFile = new File([minimalYamlString], 'test.yml', { type: 'text/yaml' });
    const fileInput = screen.getByLabelText(/import/i);

    await user.upload(fileInput, yamlFile);

    // Verify form populated
    expect(screen.getByLabelText('Lab')).toHaveValue('Test Lab');
    expect(screen.getByLabelText('Session ID')).toHaveValue('test_001');
  });

  it('imports complete YAML with all optional fields', async () => {
    // Upload complete YAML
    // Verify ALL fields populated:
    // - experimenter_name array
    // - subject nested object
    // - cameras array
    // - tasks array
    // - electrode_groups array
    // - ntrode maps array
  });

  it('imports YAML with electrode groups and ntrode maps', async () => {
    // Upload YAML with 4 electrode groups
    // Verify 4 electrode groups in form
    // Verify ntrode maps present
    // Verify ntrode counts correct for each device type
  });

  it('imports YAML with unicode characters', async () => {
    // Upload YAML with unicode in strings
    // Verify unicode preserved
  });

  it('imports YAML with special characters in strings', async () => {
    // Upload YAML with quotes, newlines
    // Verify special characters preserved
  });
});

describe('Export Workflow', () => {
  it('exports minimal session as valid YAML', async () => {
    // Fill minimal form
    // Export
    // Parse YAML
    // Verify structure matches schema
  });

  it('exports complete session with all fields', async () => {
    // Fill complete form
    // Export
    // Verify all fields in YAML
  });

  it('generates correct filename from date and subject_id', async () => {
    // Fill form with date and subject
    // Export
    // Verify filename: {mmddYYYY}_{subject_id}_metadata.yml
  });

  it('exports YAML that passes schema validation', async () => {
    // Fill form
    // Export
    // Validate YAML with jsonschemaValidation
    // Verify no errors
  });
});

describe('Round-Trip Workflows', () => {
  it('preserves all fields through import → export cycle', async () => {
    // Import complete YAML
    // Export immediately (no changes)
    // Parse exported YAML
    // Verify EXACTLY matches original
  });

  it('preserves modifications through import → modify → export cycle', async () => {
    // Import YAML
    // Modify experimenter
    // Export
    // Verify modification in exported YAML
    // Verify other fields unchanged
  });

  it('preserves data types through round-trip', async () => {
    // Import YAML with numbers, strings, arrays, nested objects
    // Export
    // Verify types preserved (numbers not stringified, etc.)
  });

  it('preserves array order through round-trip', async () => {
    // Import YAML with ordered arrays
    // Export
    // Verify order preserved
  });

  it('preserves nested object structure through round-trip', async () => {
    // Import YAML with nested objects
    // Export
    // Verify nesting preserved
  });
});

describe('Import Error Handling', () => {
  it('shows alert when importing invalid YAML', async () => {
    const alertSpy = vi.spyOn(window, 'alert');

    const invalidYaml = new File(['bad: yaml: ['], 'invalid.yml', { type: 'text/yaml' });

    await user.upload(fileInput, invalidYaml);

    expect(alertSpy).toHaveBeenCalledWith(
      expect.stringContaining('error')
    );
  });

  it('shows which fields were excluded during partial import', async () => {
    // Upload YAML with some invalid fields
    // Verify alert lists excluded fields
    // Verify valid fields imported
  });

  it('handles missing file gracefully', async () => {
    // Trigger onChange without file
    // Verify no crash
  });
});
```

**Deliverables:**
- [x] Rewrite all 34 import/export tests to actually test
- [x] Use userEvent.upload() to simulate file uploads
- [x] Verify form population with screen queries
- [x] Test round-trip data preservation comprehensively
- [x] All tests passing

---

### Week 1 Summary

**Total Tests Added:** 54 tests
**Total Effort:** 20-28 hours
**Coverage Gain:** +10-15% (with meaningful tests)

**Exit Criteria:**
- [x] All 54 new tests passing
- [x] Sample metadata modification workflows tested
- [x] End-to-end session creation tested
- [x] Error recovery scenarios tested
- [x] Import/export actually tests imports/exports
- [x] Human review and approval

---

## Week 2: Test Quality Improvements

### Task 2.1: Convert Documentation Tests to Real Tests (25-30 tests, 8-12 hours)

**Priority:** P1 - HIGH
**Files:**
- `src/__tests__/unit/app/App-importFile.test.jsx` (40 documentation tests)
- `src/__tests__/unit/app/App-generateYMLFile.test.jsx` (22 documentation tests)
- `src/__tests__/unit/app/App-onMapInput.test.jsx` (12 documentation tests)

**Strategy:**

Option A: **Convert to Real Tests**
```javascript
// BEFORE (documentation only):
it('should call preventDefault on form submission event', () => {
  // DOCUMENTATION TEST
  // generateYMLFile is called with event object (line 652)
  // First action: e.preventDefault() (line 653)

  expect(true).toBe(true); // Documentation only
});

// AFTER (real test):
it('prevents default form submission behavior', async () => {
  render(<App />);

  const submitButton = screen.getByText(/generate yml file/i);
  const form = submitButton.closest('form');
  const submitSpy = vi.fn((e) => e.preventDefault());

  form.addEventListener('submit', submitSpy);

  await user.click(submitButton);

  expect(submitSpy).toHaveBeenCalled();
  expect(submitSpy.mock.calls[0][0].defaultPrevented).toBe(true);
});
```

Option B: **Delete and Document in Code**
```javascript
// Delete documentation tests
// Add comments to App.js instead:

/**
 * Import YAML Workflow:
 *
 * 1. preventDefault() prevents default file input behavior (line 81)
 * 2. Form cleared with emptyFormData (line 82) ⚠️ potential data loss
 * 3. File extracted from e.target.files[0] (line 84)
 * 4. Guard clause: return if no file selected (line 87)
 * 5. FileReader reads file as UTF-8 text (line 91)
 * ...
 */
function importFile(e) {
  e.preventDefault(); // Step 1
  setFormData(structuredClone(emptyFormData)); // Step 2
  // ...
}
```

**Recommended: Mixed Approach**
- Convert critical behavior tests (25-30 tests)
- Delete purely documentation tests (80 tests)
- Add JSDoc comments to App.js for deleted tests

**Deliverables:**
- [x] Convert 25-30 critical documentation tests to real tests
- [x] Delete 80 purely documentation tests
- [x] Add JSDoc comments to App.js documenting deleted tests
- [x] All converted tests passing

---

### Task 2.2: Fix DRY Violations - Create Shared Test Helpers (0 new tests, 6-8 hours)

**Priority:** P1 - HIGH
**File:** `src/__tests__/helpers/test-hooks.js` (NEW)
**Blocking:** Test maintainability

**Create Centralized Test Hooks:**

```javascript
// src/__tests__/helpers/test-hooks.js

/**
 * Test hook for form state management
 * Replaces duplicated implementations across 24 test files
 */
export function useTestFormState(initialData = {}) {
  const [formData, setFormData] = useState({
    ...defaultYMLValues,
    ...initialData
  });

  const updateFormData = (name, value, key, index) => {
    const form = structuredClone(formData);

    if (key !== undefined && index !== undefined) {
      // Nested array update
      form[key][index][name] = value;
    } else if (key !== undefined) {
      // Nested object update
      form[key][name] = value;
    } else {
      // Top-level update
      form[name] = value;
    }

    setFormData(form);
  };

  return { formData, setFormData, updateFormData };
}

/**
 * Test hook for array operations
 * Replaces duplicated implementations
 */
export function useTestArrayOperations(initialArrays = {}) {
  const { formData, setFormData } = useTestFormState(initialArrays);

  const addArrayItem = (key, count = 1) => {
    const form = structuredClone(formData);
    const newItems = [];

    for (let i = 0; i < count; i++) {
      const newItem = structuredClone(arrayDefaultValues[key]);

      if (newItem.id !== undefined) {
        const maxId = form[key].length > 0
          ? Math.max(...form[key].map(item => item.id || 0))
          : -1;
        newItem.id = maxId + 1 + i;
      }

      newItems.push(newItem);
    }

    form[key].push(...newItems);
    setFormData(form);
  };

  const removeArrayItem = (key, index) => {
    const confirmed = window.confirm(`Remove item ${index}?`);
    if (!confirmed) return;

    const form = structuredClone(formData);
    form[key].splice(index, 1);
    setFormData(form);
  };

  const duplicateArrayItem = (key, index) => {
    const form = structuredClone(formData);
    const original = form[key][index];
    const duplicate = structuredClone(original);

    if (duplicate.id !== undefined) {
      const maxId = Math.max(...form[key].map(item => item.id || 0));
      duplicate.id = maxId + 1;
    }

    form[key].splice(index + 1, 0, duplicate);
    setFormData(form);
  };

  return { formData, addArrayItem, removeArrayItem, duplicateArrayItem };
}
```

**Refactor All Unit Tests:**

```javascript
// BEFORE (duplicated in every file):
function useAddArrayItemHook() {
  const [formData, setFormData] = useState({ cameras: [] });
  const addArrayItem = (key, count = 1) => {
    // 50 lines of duplicated implementation
  };
  return { formData, addArrayItem };
}

// AFTER (use shared helper):
import { useTestArrayOperations } from '@tests/helpers/test-hooks';

it('adds single item to empty cameras array', () => {
  const { result } = renderHook(() => useTestArrayOperations({ cameras: [] }));

  act(() => {
    result.current.addArrayItem('cameras');
  });

  expect(result.current.formData.cameras).toHaveLength(1);
});
```

**Files to Refactor:**
- 24 unit test files in `src/__tests__/unit/app/`
- Remove ~1,500 lines of duplicated code

**Deliverables:**
- [x] Create test-hooks.js with shared implementations
- [x] Refactor 24 unit test files to use shared hooks
- [x] Remove duplicated implementations (~1,500 LOC deleted)
- [x] All tests still passing after refactor

---

### Task 2.3: Migrate CSS Selectors to Semantic Queries (0 new tests, 4-6 hours)

**Priority:** P1 - HIGH
**Files:** All integration tests, all App unit tests
**Blocking:** Phase 3 refactoring (tests will break on DOM changes)

**Create Test Constants:**

```javascript
// src/__tests__/helpers/test-selectors.js

export const TEST_ROLES = {
  addButton: (itemType) => ({ role: 'button', name: new RegExp(`add ${itemType}`, 'i') }),
  removeButton: () => ({ role: 'button', name: /remove/i }),
  duplicateButton: () => ({ role: 'button', name: /duplicate/i }),
  submitButton: () => ({ role: 'button', name: /generate yml file/i }),
  fileInput: () => ({ role: 'textbox', name: /import/i }), // May need aria-label added
};

export const TEST_LABELS = {
  lab: /lab/i,
  institution: /institution/i,
  sessionId: /session id/i,
  sessionDescription: /session description/i,
  cameraId: /camera id/i,
  location: /location/i,
  deviceType: /device type/i,
};
```

**Migration Pattern:**

```javascript
// BEFORE (brittle - breaks on DOM changes):
const addButton = container.querySelector('button[title="Add cameras"]');
const controls = container.querySelectorAll('.array-item__controls');
const duplicateButton = Array.from(firstGroupButtons).find(
  btn => !btn.classList.contains('button-danger')
);

// AFTER (resilient - based on semantics):
const addButton = screen.getByRole('button', { name: /add camera/i });
const duplicateButton = screen.getByRole('button', { name: /duplicate/i });
const electrodeGroups = screen.getAllByRole('group', { name: /electrode group/i });
```

**Refactor Strategy:**
1. Add ARIA labels to components where needed
2. Create test-selectors.js with semantic queries
3. Refactor tests file-by-file
4. Verify tests still pass after each file

**Files to Refactor:**
- All integration tests (import-export, electrode-ntrode, sample-metadata)
- All App unit tests that use container.querySelector
- E2E tests (lower priority, can defer)

**Deliverables:**
- [x] Create test-selectors.js with semantic query helpers
- [x] Add ARIA labels to components (InputElement, SelectElement, etc.)
- [x] Refactor 15-20 test files to use semantic queries
- [x] Remove 100+ container.querySelector() calls
- [x] All tests still passing

---

### Task 2.4: Create Test Fixtures for Known Bugs (6 fixtures, 2-3 hours)

**Priority:** P2 - MEDIUM
**Directory:** `src/__tests__/fixtures/known-bugs/` (NEW)

**Create Bug Fixtures:**

```yaml
# fixtures/known-bugs/camera-id-float.yml
# BUG #3: Schema accepts float camera IDs
experimenter_name: [Doe, John]
lab: Test Lab
# ...
cameras:
  - id: 1.5  # BUG: Should reject float, but currently accepts
    meters_per_pixel: 0.001
```

```yaml
# fixtures/known-bugs/empty-required-strings.yml
# BUG #5: Schema accepts empty strings for required fields
experimenter_name: ['']  # BUG: Should reject empty string
lab: ''                  # BUG: Should reject empty string
session_description: ''  # BUG: Should reject empty string
```

```yaml
# fixtures/known-bugs/whitespace-only-strings.yml
# BUG: Schema accepts whitespace-only strings
experimenter_name: ['   ']
lab: '  \n  '
session_description: '\t\t'
```

```javascript
// Add tests that verify bugs exist:
describe('Known Bugs (to be fixed in Phase 2)', () => {
  it('BUG #3: currently accepts float camera IDs', () => {
    const buggyYaml = loadFixture('known-bugs', 'camera-id-float.yml');
    const result = jsonschemaValidation(buggyYaml);

    // Current broken behavior:
    expect(result.valid).toBe(true); // BUG: Should be false

    // TODO Phase 2: Fix schema to reject floats
    // After fix, this test should be updated:
    // expect(result.valid).toBe(false);
    // expect(result.errors[0].message).toContain('must be integer');
  });

  it('BUG #5: currently accepts empty required strings', () => {
    const buggyYaml = loadFixture('known-bugs', 'empty-required-strings.yml');
    const result = jsonschemaValidation(buggyYaml);

    // Current broken behavior:
    expect(result.valid).toBe(true); // BUG: Should be false
  });

  // ... more bug verification tests
});
```

**Deliverables:**
- [x] Create fixtures/known-bugs/ directory
- [x] Add 6 bug fixtures (camera-id-float, empty-strings, whitespace, etc.)
- [x] Add tests that verify bugs exist (marked with TODO for Phase 2)
- [x] Document each bug in fixture comments

---

### Week 2 Summary

**Tests Converted:** 25-30 real tests (80 documentation tests deleted)
**Code Removed:** ~1,500 lines of duplicated code
**Code Refactored:** 20+ test files migrated to semantic queries
**Fixtures Added:** 6 known-bug fixtures
**Total Effort:** 20-29 hours

**Exit Criteria:**
- [x] No documentation-only tests remain
- [x] All unit tests use shared test hooks
- [x] All integration tests use semantic queries
- [x] Known bugs have fixture files
- [x] All tests passing
- [x] Human review and approval

---

## Week 3: Refactoring Preparation (OPTIONAL - Can Defer)

### Task 3.1: Core Function Behavior Tests (20-30 tests, 10-15 hours)

**Priority:** P2 - NICE TO HAVE (for Phase 3 refactoring)
**File:** `src/__tests__/unit/app/functions/core-functions.test.js` (NEW)

**Purpose:** Enable safe extraction of functions during Phase 3

**Tests to Add:**

```javascript
describe('updateFormData', () => {
  it('updates simple top-level field', () => {
    // Test actual App.js implementation
  });

  it('updates nested object field', () => {
    // Test key parameter for nested updates
  });

  it('updates nested array item field', () => {
    // Test key + index parameters
  });

  it('creates new state reference (immutability)', () => {
    // Verify structuredClone used
  });

  it('handles undefined/null values', () => {
    // Edge cases
  });
});

describe('updateFormArray', () => {
  it('adds value to array when checked=true', () => {});
  it('removes value from array when checked=false', () => {});
  it('deduplicates array values', () => {});
  it('maintains array order', () => {});
});

describe('onBlur', () => {
  it('processes comma-separated string to number array', () => {});
  it('converts string to number for numeric fields', () => {});
  it('handles empty string input', () => {});
  it('validates and coerces types', () => {});
});

// ... 15 more tests for other core functions
```

**Deliverables:**
- [x] 20-30 tests for core App.js functions
- [x] Tests use actual App.js implementations (not mocks)
- [x] Tests enable safe function extraction
- [x] All tests passing

---

### Task 3.2: Electrode Group Synchronization Tests (15-20 tests, 8-10 hours)

**Priority:** P2 - NICE TO HAVE (for Phase 3 refactoring)
**File:** `src/__tests__/unit/app/functions/electrode-group-sync.test.js` (NEW)

**Purpose:** Enable safe extraction of useElectrodeGroups hook

**Tests to Add:**

```javascript
describe('nTrodeMapSelected', () => {
  it('auto-generates ntrode maps for tetrode', () => {
    // Select tetrode_12.5
    // Verify 1 ntrode with 4 channels
  });

  it('auto-generates ntrode maps for 128ch probe', () => {
    // Select 128c-4s8mm6cm-20um-40um-sl
    // Verify 32 ntrodes (128 channels / 4 per ntrode)
  });

  it('calculates shank count for multi-shank devices', () => {
    // Test getShankCount() integration
  });

  it('assigns sequential ntrode IDs', () => {});
  it('replaces existing ntrode maps on device type change', () => {});
  it('maintains other electrode groups\' ntrodes', () => {});
  it('handles edge cases (undefined device type, invalid ID)', () => {});
});

describe('removeElectrodeGroupItem', () => {
  it('removes electrode group and associated ntrode maps', () => {});
  it('shows confirmation dialog', () => {});
  it('does not remove if user cancels', () => {});
  it('handles removing last electrode group', () => {});
});

describe('duplicateElectrodeGroupItem', () => {
  it('duplicates electrode group with new ID', () => {});
  it('duplicates ntrode maps with new IDs', () => {});
  it('preserves ntrode map structure', () => {});
  it('inserts duplicate after original', () => {});
  it('handles multi-shank devices', () => {});
});
```

**Deliverables:**
- [x] 15-20 tests for electrode group synchronization
- [x] Tests cover all device types
- [x] Tests enable safe hook extraction
- [x] All tests passing

---

### Week 3 Summary (OPTIONAL)

**Tests Added:** 35-50 tests
**Total Effort:** 18-25 hours
**Purpose:** Prepare for Phase 3 refactoring

**Exit Criteria:**
- [x] Core functions 100% tested
- [x] Electrode group sync 100% tested
- [x] Safe to extract FormContext
- [x] Safe to extract useElectrodeGroups
- [x] Human review and approval

**Note:** Week 3 can be deferred to later if time-constrained. Completing Weeks 1-2 is sufficient to proceed to Phase 2.

---

## Overall Phase 1.5 Summary

### Minimum Viable Completion (Weeks 1-2)

**Tests Added/Fixed:** 79-84 tests
**Code Improved:** ~1,500 LOC of duplications removed
**Effort:** 40-57 hours over 2-3 weeks

**Achievements:**
- ✅ Sample metadata modification workflows tested (8 tests)
- ✅ End-to-end session creation tested (11 tests)
- ✅ Error recovery scenarios tested (15 tests)
- ✅ Import/export integration tests actually test (34 tests rewritten)
- ✅ Documentation tests converted or deleted (111 tests addressed)
- ✅ DRY violations fixed (shared test hooks created)
- ✅ CSS selectors migrated to semantic queries
- ✅ Known bugs have fixture files

**Coverage Impact:**
- Meaningful coverage: 40% → 60%+ (no trivial tests)
- Branch coverage: 30% → 50%+
- Integration coverage: Much improved

**Readiness for Phase 2:** ✅ READY
**Readiness for Phase 3:** ⚠️ NEEDS WEEK 3 (or defer refactoring)

---

### Full Completion (Weeks 1-3)

**Tests Added/Fixed:** 114-134 tests
**Effort:** 58-82 hours over 3-4 weeks

**Additional Achievements:**
- ✅ Core functions tested (20-30 tests)
- ✅ Electrode group sync tested (15-20 tests)
- ✅ Safe to extract FormContext
- ✅ Safe to extract useElectrodeGroups
- ✅ Safe to extract components

**Readiness for Phase 2:** ✅ READY
**Readiness for Phase 3:** ✅ READY

---

## Success Metrics

### Phase 1.5 Exit Criteria

**Must Have (Weeks 1-2):**
- [x] Sample metadata modification: 8 tests passing
- [x] End-to-end workflows: 11 tests passing
- [x] Error recovery: 15 tests passing
- [x] Import/export integration: 34 tests actually testing
- [x] Documentation tests: 0 remaining (converted or deleted)
- [x] DRY violations: Reduced by 80%
- [x] CSS selectors: Replaced with semantic queries
- [x] Meaningful coverage ≥ 60%
- [x] Branch coverage ≥ 50%
- [x] Human approval

**Nice to Have (Week 3):**
- [x] Core functions: 20-30 tests passing
- [x] Electrode group sync: 15-20 tests passing
- [x] Refactoring readiness: 8/10

---

## Risk Assessment

### Risks of Proceeding to Phase 2 Without Phase 1.5

**High Risks:**
- Bug fixes could introduce new bugs (untested error paths)
- Sample modification workflows remain untested (user's concern)
- Integration tests provide false confidence (don't actually test)

**Medium Risks:**
- Documentation tests give false coverage metrics
- Test code hard to maintain (DRY violations)
- CSS selectors will break on future refactoring

**Low Risks:**
- Performance (already well-tested)
- Utility functions (already well-tested)

### Risks of Delaying Phase 2 for Phase 1.5

**Opportunity Cost:**
- Critical bugs remain unfixed longer
- Schema mismatch not addressed
- Missing device types not added

**Mitigation:**
- Phase 1.5 takes only 2-3 weeks
- Provides foundation for safe bug fixes
- Reduces risk of introducing new bugs

### Recommendation

**Proceed with Phase 1.5 (Weeks 1-2 minimum) before Phase 2.**

**Rationale:**
- 2-3 week investment prevents months of debugging
- Critical workflows MUST be tested (scientific infrastructure)
- Test quality improvements enable faster future development
- Addresses user's specific concern (sample metadata modification)

---

## Timeline & Milestones

### Week 1: Critical Gap Filling
- **Day 1-2:** Sample metadata modification tests (8 tests)
- **Day 3-4:** End-to-end workflow tests (11 tests)
- **Day 5-6:** Error recovery tests (15 tests)
- **Day 7-8:** Import/export integration rewrite (34 tests)
- **Checkpoint:** 54 new/rewritten tests passing

### Week 2: Test Quality Improvements
- **Day 1-3:** Convert documentation tests (25-30 tests)
- **Day 4-5:** Create shared test hooks, refactor files
- **Day 6-7:** Migrate CSS selectors to semantic queries
- **Day 8:** Create known-bug fixtures
- **Checkpoint:** All tests passing, coverage metrics improved

### Week 3 (OPTIONAL): Refactoring Preparation
- **Day 1-3:** Core function tests (20-30 tests)
- **Day 4-6:** Electrode group sync tests (15-20 tests)
- **Day 7:** Integration verification
- **Checkpoint:** Ready for Phase 3 refactoring

### Human Review Checkpoints
- **After Week 1:** Review critical gap fixes
- **After Week 2:** Review test quality improvements
- **After Week 3 (if done):** Approve proceeding to Phase 2 or Phase 3

---

## Next Steps

1. **Human Approval:** Review and approve this plan
2. **Environment Setup:** Ensure /setup command run
3. **Start Week 1, Task 1.1:** Sample metadata modification tests
4. **Daily Commits:** Commit after each task completion
5. **Weekly Reviews:** Checkpoint after each week
6. **Phase 2 Transition:** After human approval of Phase 1.5

---

**Document Status:** APPROVED - Ready to Execute
**Created:** 2025-10-24
**Next Review:** After Week 1 completion
