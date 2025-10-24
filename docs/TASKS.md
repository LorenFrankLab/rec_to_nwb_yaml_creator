# Refactoring Tasks

**Current Phase:** Phase 1 - Testing Foundation
**Phase Status:** 🟡 IN PROGRESS
**Last Updated:** 2025-10-23

---

## Phase 0: Baseline & Infrastructure (Weeks 1-2)

**Goal:** Establish comprehensive baselines WITHOUT changing production code
**Exit Criteria:** All baselines passing, CI operational, human approval
**Status:** ✅ APPROVED AND MERGED TO MAIN (2025-10-23)

### Week 1: Infrastructure Setup

#### Infrastructure Setup

- [x] Task 1: Install Vitest and configure (vitest.config.js)
- [x] Task 2: Install Playwright and configure (playwright.config.js)
- [x] Task 3: Create test directory structure
- [x] Task 4: Create test helpers and custom matchers
- [x] Task 5: Create test fixtures (valid and invalid YAML samples)

#### CI/CD Pipeline

- [x] Task 9: Create GitHub Actions workflow (.github/workflows/test.yml)
  - [x] Configure test job (lint, baseline tests, coverage)
  - [x] Configure integration job (schema sync with trodes_to_nwb)
  - [x] Set up coverage upload to Codecov

#### Pre-commit Hooks

- [x] Task 10: Install and configure Husky and lint-staged
  - [x] Configure pre-commit hook (.husky/pre-commit)
  - [x] Configure pre-push hook (.husky/pre-push)
  - [x] Configure lint-staged (.lintstagedrc.json)

### Week 2: Baseline Tests

#### Validation Baseline Tests

- [x] Task 6: Create validation baseline tests
  - [x] Baseline: accepts valid YAML structure
  - [x] Baseline: camera ID float bug (documents current wrong behavior)
  - [x] Baseline: empty string bug (documents current wrong behavior)
  - [x] Baseline: required fields validation
  - [x] Baseline: type validation
  - [x] Baseline: pattern validation (non-empty strings)
  - [x] Baseline: array validation
  - [x] Baseline: nested object validation
  - [x] All validation baselines passing (43 tests)

#### State Management Baseline Tests

- [x] Task 7: Create state management baseline tests
  - [x] Baseline: structuredClone performance measurement
  - [x] Baseline: immutability verification
  - [x] Baseline: array operations at scale
  - [x] Baseline: edge cases and quirks
  - [x] All state management baselines passing (43 tests)

#### Performance Baseline Tests

- [x] Task 8: Create performance baseline tests
  - [x] Measure validation performance (minimal to 200 electrode groups)
  - [x] Measure YAML parsing performance
  - [x] Measure YAML stringification performance
  - [x] Measure initial render time
  - [x] Measure array operations at scale
  - [x] Measure complex operations (import/export cycle)
  - [x] Document performance baselines in SCRATCHPAD.md
  - [x] All performance baselines passing (21 tests)

#### Visual Regression Baseline (E2E)

- [x] Task 11: Create visual regression baseline tests
  - [x] Capture initial form state screenshot
  - [x] Capture electrode groups section screenshot
  - [x] Capture validation error state screenshot
  - [x] Capture form interaction states
  - [x] Capture import/export workflows
  - [x] Store screenshots as baseline references

#### Integration Contract Baselines

- [x] Task 12: Create integration contract baseline tests
  - [x] Document current schema hash
  - [x] Compare schema with trodes_to_nwb
  - [x] Document all device types
  - [x] Verify device types exist in trodes_to_nwb
  - [x] Snapshot schema required fields
  - [x] All contract tests passing (7 tests)

### Documentation and Completion

- [x] Task 13: Create TASKS.md tracking document (this file)
- [x] Task 14: Create REFACTOR_CHANGELOG.md
- [x] Task 15: Create /refactor command for future sessions
- [x] Task 16: Final verification and Phase 0 completion
  - [x] Run all baseline tests (107 tests PASSING)
  - [x] Run integration tests (7 tests PASSING)
  - [x] Run lint (0 errors, 20 warnings acceptable)
  - [x] Run build (SUCCESS with warnings)
  - [x] Verify documentation completeness
  - [x] Create Phase 0 completion report
  - [x] Update TASKS.md (this file)
  - [x] Update SCRATCHPAD.md with completion notes

### Phase 0 Exit Gate

**Test Results:**

- [x] `npm run test:baseline -- --run` → ✅ PASSING (107 tests)
- [x] `npm run test:integration -- --run` → ✅ PASSING (7 tests)
- [x] `npm run lint` → ✅ 0 errors (20 warnings acceptable)
- [x] `npm run build` → ✅ SUCCESS

**Documentation:**

- [x] Performance baselines documented (SCRATCHPAD.md)
- [x] Visual regression baselines captured (Playwright screenshots)
- [x] Schema sync check documented (integration tests)
- [x] Phase 0 completion report created

**Known Issues Documented:**

- [x] Schema mismatch with trodes_to_nwb (P0 - requires investigation)
- [x] Missing device types in web app (4 types)
- [x] Empty string validation bug (BUG #5)
- [x] Float camera ID bug (BUG #3)
- [x] Whitespace-only string acceptance

**Human Actions Completed:**

- [x] **HUMAN REVIEW:** Approved all baseline tests and documented behavior
- [x] **HUMAN REVIEW:** Approved known bugs to be fixed in Phase 2
- [x] **HUMAN REVIEW:** Approved schema mismatch investigation during Phase 1/2
- [x] **HUMAN REVIEW:** Approved missing device types to be added in Phase 2
- [x] **HUMAN APPROVAL:** Approved moving to Phase 1
- [x] **MERGED TO MAIN:** Phase 0 merged into main branch (2025-10-23)

---

## Phase 1: Testing Foundation (Weeks 3-5)

**Goal:** Build comprehensive test suite WITHOUT changing production code
**Status:** 🟡 IN PROGRESS - Started 2025-10-23
**Coverage Target:** 60-70% by end of phase
**Current Coverage:** ~15% (baseline tests only)

### Week 3: Core Module Tests

#### App.js Core Functionality

- [x] Test state initialization and default values (17 tests, discovered optogenetic_stimulation_software bug)
- [x] Test form data updates (updateFormData, updateFormArray) (25 tests, learned ID naming patterns)
- [x] Test onBlur transformations (41 tests, documented utility function behaviors)
- [x] Test item selection handlers (16 tests, documented DataList and select behaviors)
- [x] Test array item management (21 tests, verified structure and defaults)
- [x] Test electrode group and ntrode map synchronization (covered in array management tests)

#### Validation System Tests

- [x] Test jsonschemaValidation with valid inputs (15 tests covering all major input types)
- [x] Test jsonschemaValidation with invalid inputs (13 tests for required fields and type violations)
- [x] Test rulesValidation custom constraints (7 tests for camera/task relationship validation)
- [x] Test validation error handling and display (9 tests for return value structure)
- [x] Test validation with complex nested structures (19 tests including integration scenarios)

#### State Management Tests

- [x] Test immutability of state updates (23 tests - immutability.test.js)
- [x] Test deep cloning behavior (21 tests - deep-cloning.test.js)
- [x] Test state updates with large datasets (16 tests - large-datasets.test.js)
- [x] Test concurrent state updates (covered in existing tests)
- [x] Test state rollback on errors (not applicable - no error rollback in current implementation)

### Week 4: Component and Utility Tests

#### Form Element Components

- [x] Test InputElement (text, number, date inputs) - 39 tests, discovered date formatting bug
- [x] Test SelectElement (dropdown selection) - 32 tests, discovered duplicate key bug
- [x] Test DataListElement (autocomplete) - 36 tests, same duplicate key bug, PropTypes typo
- [x] Test CheckboxList (multi-select) - 31 tests, discovered duplicate key bug, PropTypes typo, defaultProps mismatch
- [x] Test RadioList (single-select) - 39 tests, discovered duplicate key bug, PropTypes typo, defaultProps mismatch, misleading JSDoc
- [x] Test ListElement (dynamic string lists) - 52 tests, discovered PropTypes typo, defaultProps mismatch, missing key prop, incorrect PropTypes syntax
- [x] Test ArrayItemControl (duplicate/remove buttons) - 31 tests, discovered PropTypes typo, misleading JSDoc, empty import

**✅ ALL FORM ELEMENT COMPONENTS COMPLETE (7/7)**

#### Utility Functions

- [x] Test sanitizeTitle string cleaning (86 tests - utils.test.js)
- [x] Test commaSeparatedStringToNumber parsing
- [x] Test formatCommaSeparatedString formatting
- [x] Test showCustomValidityError error display
- [x] Test type coercion functions (isInteger, isNumeric, stringToInteger, titleCase)
- [x] Test isProduction environment detection (discovered security bug)
- [x] Test ID auto-increment logic (already covered in App-array-management.test.jsx)

#### Dynamic Dependencies

- [x] Test camera ID tracking and updates (33 tests - App-dynamic-dependencies.test.jsx)
- [x] Test task epoch tracking and cleanup
- [x] Test DIO event tracking
- [x] Test dependent field clearing on deletions
- [x] Test useEffect reactive updates for all three dependency types

### Week 5: Integration and Edge Cases

#### Import/Export Workflow

- [x] Test YAML file import with valid data (34 tests - import-export-workflow.test.jsx)
- [x] Test YAML file import with invalid data
- [x] Test YAML file import with partial data
- [x] Test YAML file export generation
- [x] Test filename generation (date format)
- [x] Test error handling during import/export

#### Electrode Group and Ntrode Management

- [x] Test device type selection triggers ntrode generation (35 tests - electrode-ntrode-management.test.jsx)
- [x] Test ntrode channel map updates
- [x] Test electrode group duplication with ntrode maps
- [x] Test electrode group removal with ntrode cleanup
- [x] Test shank count calculation for multi-shank devices

#### Edge Cases and Error Handling

- [X] Test with maximum electrode groups (200+) - covered in baselines
- [ ] Test with empty form submission - covered in validation tests
- [x] Test with all optional fields filled - covered in baselines
- [x] Test with malformed input data - covered in validation tests
- [x] Test browser compatibility (validation APIs) - N/A for Phase 1

### Week 6: Coverage Push to 60% Target

**Current Coverage:** 39.19%
**Target Coverage:** 60%
**Gap:** ~21% (approximately 250-300 more tests needed)

#### Priority 1: App.js Core Functions (Target: +15% coverage)

##### Event Handlers (Currently Untested)

**clearYMLFile() Tests:**

- [x] Test form reset clears all fields to defaultYMLValues (7 tests created)
- [x] Test form reset with confirmation dialog
- [x] Test form reset cancellation (user clicks cancel)
- [x] Test form reset to defaultYMLValues (not emptyFormData)
- [x] Test form reset when already at defaults (edge case)
- [x] Test structuredClone immutability
- [x] Test preventDefault behavior

**clickNav() Tests:**

- [x] Test navigation item click adds highlight-region class (8 tests created)
- [x] Test active-nav-link class added to parent node
- [x] Test previous active-nav-link classes removed before adding new
- [x] Test data-id attribute targets correct element
- [x] Test highlight-region and active-nav-link removed after 1000ms timeout
- [x] Test clicking same nav item multiple times
- [x] Test rapid multiple clicks on different nav items
- [x] Test missing target element handled gracefully

**submitForm() Tests:**

- [x] Test openDetailsElement called before submission (6 tests created)
- [x] Test form.requestSubmit() triggered
- [x] Test integration with generateYMLFile via onSubmit
- [x] Test all details elements opened before submission
- [x] Test button type="button" prevents default
- [x] Test onClick handler instead of native form submit

**openDetailsElement() Tests:**

- [x] Test all details elements opened when called (6 tests created)
- [x] Test open attribute set to true on each element
- [x] Test handles already-open details correctly
- [x] Test querySelector finds multiple details elements
- [x] Test no errors thrown
- [x] Test purpose: reveal all fields before validation

##### Error Display Functions (Currently Untested)

**showErrorMessage() Tests:**

- [ ] Test Ajv error message display
- [ ] Test error message with instancePath
- [ ] Test error message formatting
- [ ] Test element selection by instancePath
- [ ] Test error display when element not found
- [ ] Test error display with nested paths
- [ ] Test error display with array indices
- [ ] Test multiple error messages

**displayErrorOnUI() Tests:**

- [ ] Test custom validity error on input element
- [ ] Test error display with element ID
- [ ] Test error display with message
- [ ] Test error display timeout (2 seconds)
- [ ] Test error display when element not found
- [ ] Test showCustomValidityError integration

##### Array Management Functions (Partially Tested)

**addArrayItem() Tests:**

- [ ] Test adding single item to cameras array
- [ ] Test adding single item to tasks array
- [ ] Test adding single item to behavioral_events array
- [ ] Test adding multiple items at once (count parameter)
- [ ] Test adding items with auto-incrementing IDs
- [ ] Test adding items to empty array
- [ ] Test adding items with existing items
- [ ] Test adding items updates formData state
- [ ] Test structuredClone used for immutability

**removeArrayItem() Tests:**

- [ ] Test removing item shows confirmation dialog
- [ ] Test removing item when confirmed
- [ ] Test removing item when cancelled
- [ ] Test removing first item in array
- [ ] Test removing last item in array
- [ ] Test removing middle item in array
- [ ] Test removing from empty array (guard clause)
- [ ] Test removing from single-item array
- [ ] Test array splice used correctly
- [ ] Test formData state updated after removal

**duplicateArrayItem() Tests:**

- [ ] Test duplicating camera item
- [ ] Test duplicating task item with camera_id references
- [ ] Test duplicating behavioral_event item
- [ ] Test duplicating item increments ID
- [ ] Test duplicated item has unique ID
- [ ] Test duplicated item preserves other fields
- [ ] Test duplicating with items containing id field
- [ ] Test duplicating updates formData state

##### YAML Conversion (Partially Tested)

**convertObjectToYAMLString() Tests:**

- [ ] Test converting simple object
- [ ] Test converting nested object
- [ ] Test converting object with arrays
- [ ] Test converting empty object
- [ ] Test converting null values
- [ ] Test converting undefined values (filtered out)
- [ ] Test YAML.Document API usage
- [ ] Test toString() output format

**createYAMLFile() Tests:**

- [ ] Test Blob creation with text/plain type
- [ ] Test anchor element creation
- [ ] Test download attribute set
- [ ] Test href set to blob URL
- [ ] Test click() triggers download
- [ ] Test webkitURL.createObjectURL called
- [ ] Test filename parameter used

#### Priority 2: Missing Component Tests (Target: +3% coverage)

##### ArrayUpdateMenu.jsx (53.33% coverage)

**Basic Functionality:**

- [ ] Test component renders with title prop
- [ ] Test dropdown renders with array types
- [ ] Test count input renders with default value 1
- [ ] Test add button renders with text
- [ ] Test component accepts updateFormArray prop

**Add Button Interaction:**

- [ ] Test clicking add button with default count (1)
- [ ] Test clicking add button with count > 1
- [ ] Test clicking add button calls updateFormArray
- [ ] Test add button passes correct array key
- [ ] Test add button passes count parameter

**Count Input Validation:**

- [ ] Test count input accepts numbers
- [ ] Test count input minimum value 1
- [ ] Test count input maximum value (reasonable limit)
- [ ] Test count input with invalid input
- [ ] Test count input onChange handler

**Dropdown Selection:**

- [ ] Test dropdown shows all array types
- [ ] Test selecting different array type
- [ ] Test selected value persists
- [ ] Test dropdown change updates state
- [ ] Test adding items for different array types

**Integration:**

- [ ] Test ArrayUpdateMenu with cameras array
- [ ] Test ArrayUpdateMenu with tasks array
- [ ] Test ArrayUpdateMenu with behavioral_events array
- [ ] Test ArrayUpdateMenu with electrode_groups array

##### SelectInputPairElement.jsx (14.28% coverage)

**Component Rendering:**

- [ ] Test component renders select and input
- [ ] Test select renders with dataItems
- [ ] Test input renders with placeholder
- [ ] Test component accepts all required props

**Select Coordination:**

- [ ] Test selecting option updates select value
- [ ] Test select onChange handler called
- [ ] Test select value passed to parent
- [ ] Test select with empty dataItems

**Input Coordination:**

- [ ] Test input onChange handler
- [ ] Test input value updates
- [ ] Test input validation
- [ ] Test input with different input types

**Combined Behavior:**

- [ ] Test select and input work independently
- [ ] Test both values passed to updateFormData
- [ ] Test validation on both select and input
- [ ] Test edge case: select without input value
- [ ] Test edge case: input without select value

##### ChannelMap.jsx (8.69% coverage)

**Component Rendering:**

- [ ] Test component renders with ntrode data
- [ ] Test renders channel mapping inputs
- [ ] Test renders bad_channels selection
- [ ] Test renders for each ntrode in group

**Channel Mapping:**

- [ ] Test default channel map displays (0→0, 1→1, etc.)
- [ ] Test custom channel mapping
- [ ] Test changing channel map values
- [ ] Test map updates call onChange handler
- [ ] Test map validation (no duplicate mappings)

**Bad Channels Selection:**

- [ ] Test bad_channels checkbox rendering
- [ ] Test selecting bad channel
- [ ] Test deselecting bad channel
- [ ] Test bad_channels array updates
- [ ] Test multiple bad channels selected

**Multi-Shank Device Handling:**

- [ ] Test rendering for single-shank device
- [ ] Test rendering for 4-shank device
- [ ] Test each shank has independent map
- [ ] Test ntrode_id displayed for each shank
- [ ] Test updates to one shank don't affect others

**Integration:**

- [ ] Test ChannelMap with tetrode device (4 channels)
- [ ] Test ChannelMap with 32-channel device
- [ ] Test ChannelMap with 128-channel device
- [ ] Test electrode_group_id association

#### Priority 3: Integration Tests (Target: +3% coverage)

##### Sample Metadata Reproduction

- [x] Test loading 20230622_sample_metadata.yml (21 tests - COMPLETE)

**Modification and Re-export:**

- [ ] Test importing sample metadata
- [ ] Test modifying experimenter name
- [ ] Test modifying subject information
- [ ] Test adding a new camera
- [ ] Test adding a new task
- [ ] Test adding a new electrode group
- [ ] Test re-exporting modified metadata
- [ ] Test round-trip preserves modifications

**Device Type Coverage:**

- [ ] Test all device types in sample are supported
- [ ] Test each device type has correct channel count
- [ ] Test each device type has correct shank count
- [ ] Test ntrode generation for each device type

**Dynamic Dependencies:**

- [ ] Test camera references in tasks are valid
- [ ] Test electrode group IDs in ntrodes are valid
- [ ] Test adding camera updates task dropdown
- [ ] Test removing camera clears task references
- [ ] Test adding task updates epoch lists

##### End-to-End Workflows

**Complete Session Creation:**

- [ ] Test creating new session from scratch
- [ ] Test adding experimenter names
- [ ] Test adding subject information
- [ ] Test adding data acquisition device
- [ ] Test adding cameras (2)
- [ ] Test adding tasks with camera references
- [ ] Test adding behavioral events
- [ ] Test adding electrode groups
- [ ] Test ntrode generation triggered
- [ ] Test validation passes
- [ ] Test export generates valid YAML

**Adding Electrode Groups:**

- [ ] Test adding first electrode group
- [ ] Test selecting device type
- [ ] Test ntrode maps auto-generated
- [ ] Test adding second electrode group (different type)
- [ ] Test ntrode maps independent
- [ ] Test duplicating electrode group
- [ ] Test removing electrode group
- [ ] Test ntrodes cleaned up on removal

**Complex Form Interactions:**

- [ ] Test filling all optional fields
- [ ] Test adding optogenetics sections
- [ ] Test adding associated files
- [ ] Test adding associated video files
- [ ] Test fs_gui_yamls section
- [ ] Test validation with complete form

##### Error Recovery Scenarios

**Validation Failure Recovery:**

- [ ] Test submitting form with missing required fields
- [ ] Test error messages displayed
- [ ] Test user can see which fields are invalid
- [ ] Test filling missing fields
- [ ] Test resubmitting after fixes
- [ ] Test validation passes after fixes

**Malformed YAML Import:**

- [ ] Test importing YAML with syntax errors
- [ ] Test importing YAML with wrong types
- [ ] Test importing YAML with invalid references
- [ ] Test form shows error message
- [ ] Test form not corrupted by bad import
- [ ] Test user can try again

**Undoing Changes:**

- [ ] Test form reset after partial edits
- [ ] Test confirmation dialog shown
- [ ] Test reset clears all changes
- [ ] Test reset restores default values
- [ ] Test canceling reset preserves changes

**Browser Navigation:**

- [ ] Test form state persists during session
- [ ] Test unsaved changes warning (if implemented)
- [ ] Test page reload behavior

### Phase 1 Exit Gate

- [ ] Unit test coverage ≥ 60%
- [ ] Integration test coverage ≥ 50%
- [ ] All tests passing
- [ ] No new ESLint errors introduced
- [ ] Documentation updated
- [ ] Human review and approval

---

## Phase 2: Bug Fixes (Weeks 6-8)

**Goal:** Fix documented bugs with TDD approach
**Status:** 🔴 BLOCKED - Waiting for Phase 1 completion

### Critical Bugs (P0)

#### Schema Synchronization

- [ ] Investigate schema mismatch with trodes_to_nwb
- [ ] Determine canonical schema version
- [ ] Sync schemas between repositories
- [ ] Add schema hash validation to CI

#### Missing Device Types

- [ ] Add `128c-4s4mm6cm-15um-26um-sl` to deviceTypes
- [ ] Add `128c-4s4mm6cm-20um-40um-sl` to deviceTypes
- [ ] Add `128c-4s6mm6cm-20um-40um-sl` to deviceTypes
- [ ] Add `128c-4s8mm6cm-15um-26um-sl` to deviceTypes
- [ ] Verify device metadata exists in trodes_to_nwb

### High Priority Bugs

#### BUG #5: Empty String Validation

- [ ] Write test that fails for empty string in required field
- [ ] Update schema to enforce non-empty strings
- [ ] Verify test passes after fix
- [ ] Test with all string fields
- [ ] Update baselines to expect rejection

#### BUG #3: Float Camera ID Acceptance

- [ ] Write test that fails for float camera ID
- [ ] Update schema to enforce integer camera IDs
- [ ] Verify test passes after fix
- [ ] Test with all ID fields
- [ ] Update baselines to expect rejection

### Medium Priority Bugs

#### Whitespace-Only String Acceptance

- [ ] Write test that fails for whitespace-only strings
- [ ] Add pattern/trim validation to schema
- [ ] Verify test passes after fix
- [ ] Test with all string fields

#### Empty Array Validation

- [ ] Identify which arrays should reject empty
- [ ] Write tests for minimum array lengths
- [ ] Update schema with minItems constraints
- [ ] Verify tests pass after fix

### Phase 2 Exit Gate

- [ ] All P0 bugs fixed
- [ ] All P1 bugs fixed
- [ ] Test coverage ≥ 70%
- [ ] Schema synchronized with trodes_to_nwb
- [ ] No regressions in existing functionality
- [ ] Human review and approval

---

## Phase 3: Code Quality & Refactoring (Weeks 9-11)

**Goal:** Improve code quality and maintainability
**Status:** 🔴 BLOCKED - Waiting for Phase 2 completion

### Code Cleanup

- [ ] Remove unused variables (20 ESLint warnings)
- [ ] Remove unused imports
- [ ] Add missing JSDoc comments
- [ ] Improve variable naming
- [ ] Extract magic numbers to constants

### Refactoring

- [ ] Extract large functions in App.js
- [ ] Reduce cyclomatic complexity
- [ ] Improve error handling consistency
- [ ] Standardize validation error messages
- [ ] Simplify nested conditionals

### Phase 3 Exit Gate

- [ ] 0 ESLint warnings
- [ ] Test coverage ≥ 80%
- [ ] All refactoring covered by tests
- [ ] No performance regressions
- [ ] Human review and approval

---

## Phase 4: Performance Optimization (Week 12)

**Goal:** Optimize performance where needed
**Status:** 🔴 BLOCKED - Waiting for Phase 3 completion

**Note:** Current performance is excellent (see SCRATCHPAD.md). Phase 4 may not be necessary unless regressions occur during refactoring.

### Phase 4 Exit Gate

- [ ] All performance baselines maintained or improved
- [ ] No user-visible slowdowns
- [ ] Human review and approval

---

## Phase 5: Documentation & Final Review (Week 13)

**Goal:** Comprehensive documentation and final review
**Status:** 🔴 BLOCKED - Waiting for Phase 4 completion

### Documentation

- [ ] Update CLAUDE.md with new architecture
- [ ] Update README.md with testing instructions
- [ ] Document all major components
- [ ] Create troubleshooting guide
- [ ] Update CHANGELOG.md

### Final Review

- [ ] Code review by maintainer
- [ ] Integration testing with trodes_to_nwb
- [ ] User acceptance testing
- [ ] Final approval for merge to main

### Phase 5 Exit Gate

- [ ] All documentation complete
- [ ] All tests passing
- [ ] Coverage ≥ 80%
- [ ] Production deployment successful
- [ ] Human final approval

---

## Notes

### Test Commands

```bash
# Run all tests
npm test -- --run

# Run baseline tests only
npm run test:baseline -- --run

# Run integration tests
npm run test:integration -- --run

# Run specific test file
npm test -- validation-baseline.test.js --run

# Run with coverage
npm run test:coverage -- --run

# Run E2E tests
npm run test:e2e

# Update snapshots
npm test -- --run --update
npm run test:e2e -- --update-snapshots
```

### Git Workflow

```bash
# Current branch
git branch
# Should show: refactor/phase-0-baselines (or current phase branch)

# Commit with phase prefix
git add <files>
git commit -m "phase0(category): description"

# View recent commits
git log --oneline -10

# Push to remote
git push -u origin refactor/phase-0-baselines
```

### Phase Transition Checklist

Before moving to next phase:

1. ✅ All tasks in current phase checked off
2. ✅ All tests passing
3. ✅ Documentation updated
4. ✅ Human review completed
5. ✅ Git tag created: `git tag v3.0.0-phaseX-complete`
6. ✅ Tag pushed: `git push --tags`

### Emergency Procedures

If tests start failing unexpectedly:

1. Check git status - uncommitted changes?
2. Run `npm install` - dependencies corrupted?
3. Check Node version - `node --version` should be v20.19.5
4. Clear coverage - `rm -rf coverage/`
5. Review recent commits - `git log --oneline -5`
6. Check SCRATCHPAD.md for known issues

---

**Quick Links:**

- [Phase 0 Plan](plans/2025-10-23-phase-0-baselines.md)
- [Phase 0 Completion Report](PHASE_0_COMPLETION_REPORT.md)
- [Refactor Command](.claude/commands/refactor.md)
- [Performance Baselines](SCRATCHPAD.md)
- [CI/CD Pipeline](CI_CD_PIPELINE.md)
