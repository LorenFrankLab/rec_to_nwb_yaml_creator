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

- [ ] Test with maximum electrode groups (200+) - covered in baselines
- [ ] Test with empty form submission - covered in validation tests
- [ ] Test with all optional fields filled - covered in baselines
- [ ] Test with malformed input data - covered in validation tests
- [ ] Test browser compatibility (validation APIs) - N/A for Phase 1

### Week 6: Coverage Push to 60% Target

**Current Coverage:** 39.19%
**Target Coverage:** 60%
**Gap:** ~21% (approximately 250-300 more tests needed)

#### Priority 1: App.js Core Functions (Target: +15% coverage)

##### Event Handlers (Currently Untested)

- [ ] Test clearYMLFile() - form reset functionality
- [ ] Test clickNav() - navigation highlighting
- [ ] Test submitForm() - form submission flow
- [ ] Test openDetailsElement() - expand all details elements

##### Error Display Functions (Currently Untested)

- [ ] Test showErrorMessage() - Ajv error display
- [ ] Test displayErrorOnUI() - custom validity error display
- [ ] Test error message formatting and element selection

##### Array Management Functions (Partially Tested)

- [ ] Test addArrayItem() with various array types
- [ ] Test removeArrayItem() with confirmation dialog
- [ ] Test duplicateArrayItem() for non-electrode arrays
- [ ] Test edge cases: empty arrays, invalid indices

##### YAML Conversion (Partially Tested)

- [ ] Test convertObjectToYAMLString() with edge cases
- [ ] Test createYAMLFile() blob creation and download
- [ ] Test YAML Document API usage

#### Priority 2: Missing Component Tests (Target: +3% coverage)

##### ArrayUpdateMenu.jsx (53.33% coverage)

- [ ] Test add button click handlers
- [ ] Test count input validation
- [ ] Test dropdown selection
- [ ] Test interaction with different array types

##### SelectInputPairElement.jsx (14.28% coverage)

- [ ] Test select and input coordination
- [ ] Test value updates
- [ ] Test validation
- [ ] Test edge cases

##### ChannelMap.jsx (8.69% coverage)

- [ ] Test channel mapping UI
- [ ] Test map updates
- [ ] Test bad_channels selection
- [ ] Test multi-shank device handling

#### Priority 3: Integration Tests (Target: +3% coverage)

##### Sample Metadata Reproduction

- [x] Test loading 20230622_sample_metadata.yml (21 tests - COMPLETE)
- [ ] Test modifying and re-exporting sample metadata
- [ ] Test all device types present in sample
- [ ] Test camera/task/epoch dependencies in sample

##### End-to-End Workflows

- [ ] Test complete session creation workflow
- [ ] Test adding electrode groups with ntrode generation
- [ ] Test complex form interactions
- [ ] Test validation error recovery

##### Error Recovery Scenarios

- [ ] Test recovering from validation failures
- [ ] Test handling malformed YAML import
- [ ] Test undoing changes (form reset)
- [ ] Test browser back/forward navigation

#### Test Implementation Strategy

##### Phase A: High-Impact Functions (Est. 100 tests)

1. clearYMLFile and form reset
2. Error display functions
3. Array management edge cases
4. YAML conversion edge cases

##### Phase B: Missing Components (Est. 80 tests)

1. ArrayUpdateMenu comprehensive tests
2. SelectInputPairElement tests
3. ChannelMap UI interaction tests

##### Phase C: Integration Scenarios (Est. 70 tests)

1. Complete workflows
2. Error recovery
3. Complex interactions

**Total New Tests Needed:** ~250 tests to reach 60% coverage

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
