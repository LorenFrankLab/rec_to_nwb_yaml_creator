# Refactoring Tasks

**Current Phase:** Phase 3 - Code Quality & Refactoring
**Status:** 🟢 READY TO START
**Last Updated:** 2025-10-25

---

## Quick Navigation

- **Active:** [Phase 3: Code Quality & Refactoring](#phase-3-code-quality--refactoring)
- **Archive:** [Completed Phases](#completed-phases-archive)

---

## Phase 3: Code Quality & Refactoring (Weeks 13-15)

**Goal:** Extract utilities and improve App.js maintainability
**Status:** 🟢 READY TO START
**Approach:** Extract low-risk utilities first, then components

### Week 1-2: Utility Extraction

**Goal:** Extract utilities from App.js (~195 lines reduction)

#### Extract YAML Export Utilities (2 hours)

- [x] Create `src/utils/yamlExport.js`
- [x] Extract `convertObjectToYAMLString()` (App.js:444-474)
- [x] Extract `createYAMLFile()` helper
- [x] Update App.js imports
- [x] Run full test suite
- [x] Commit: `refactor: extract YAML export utilities`

#### Extract Error Display Utilities (1-2 hours)

- [x] Create `src/utils/errorDisplay.js`
- [x] Extract `showErrorMessage()` (not showCustomValidityError - already in utils.js)
- [x] Extract `displayErrorOnUI()` (clearCustomValidityError doesn't exist)
- [x] Update App.js imports
- [x] Run full test suite
- [x] Commit: `refactor: extract error display utilities`

#### Extract Validation Utilities (2-3 hours)

- [x] Create `src/utils/validation.js`
- [x] Extract `jsonschemaValidation()`
- [x] Extract `rulesValidation()`
- [x] Update App.js imports
- [x] Run full test suite
- [x] Commit: `refactor: extract validation utilities`

#### Extract String Formatting Utilities (1-2 hours)

- [x] Create `src/utils/stringFormatting.js`
- [x] Extract `sanitizeTitle()`
- [x] Extract `formatCommaSeparatedString()`
- [x] Extract `commaSeparatedStringToNumber()`
- [x] Update utils.js imports
- [x] Run full test suite
- [x] Commit: `refactor: extract string formatting utilities`

## Pre-Flight Guardrails & Baselines

- [ ] Add Prettier + ESLint (react, react-hooks, jsx-a11y) and enable CI (if not already)
- [ ] Create `tests/fixtures/golden/` with representative YAML exports (use src/**tests**/fixtures/valid/20230622_sample_metadata.yml, roundtrip)
- [ ] Add test: `export(model) === golden` (byte-for-byte)
- [ ] Commit: `chore: lint, CI, and golden YAML fixtures`
- [ ] **Estimated Time:** 1 hour

### Promote YAML utilities → single deterministic IO module
>
> You already extracted YAML export helpers. Make them the single source of truth.

- [ ] **Rename/Move:** `src/utils/yamlExport.js` → `src/io/yaml.js`
- [ ] **API:** `encodeYaml(model)`, `decodeYaml(text)`, `formatDeterministicFilename(model)`
- [ ] **Determinism:** sorted keys, `\n` EOL, UTF-8, explicit quoting where required
- [ ] **Codemod:** replace all imports of `utils/yamlExport` with `io/yaml`
- [ ] **Tests:** golden equality across two consecutive exports; round-trip parity
- [ ] Commit: `fix(io): deterministic YAML encoder/decoder`

### ✅ Promote validation utilities → pure validation system (event-driven)
>
> You already extracted validation helpers. Rehome them and make timing explicit.

- [ ] **Move/Split:** `src/utils/validation.js` → `src/validation/`
  - `schemaValidation.js` (AJV/TypeBox)
  - `rulesValidation.js` (domain rules)
  - `index.js` → `validate(model): Issue[]`
- [ ] **Timing:** No render-time validation; trigger via “Validate All”/submit
- [ ] **A11y:** Map `Issue{path,code,severity,message}` to inputs via `aria-describedby`
- [ ] **Tests:** fixture issues stable; interaction test ensures no per-keystroke validation
- [ ] Commit: `refactor(validation): pure, event-driven validation system`

### Stable IDs for List Items (fix incorrect key usage)

- [ ] Generate `id` with `nanoid()` when creating rows/ntrodes/groups
- [ ] Replace all `key={index}` with `key={row.id}`
- [ ] Ensure array operations accept **id**, not index
- [ ] Commit: `fix(react): replace index keys with stable ids`
- [ ] **Estimated Time:** 1 hour

### Normalize Controlled Inputs + A11y Wiring

- [ ] Convert mixed `defaultValue/value` inputs to **controlled**
- [ ] Add `useStableId()`; bind `<label htmlFor>` and `aria-describedby` for error text
- [ ] Wrap logical groups with `fieldset/legend`
- [ ] Commit: `fix(a11y): controlled inputs and label/error associations`
- [ ] **Estimated Time:** 2 hours

#### Extract Array Management

- [ ] Create `src/hooks/useArrayManagement.js`
- [ ] Extract `addArrayItem()` (App.js:364-385)
- [ ] Extract `removeArrayItem()` (App.js:393-408)
- [ ] Extract `duplicateArrayItem()` (App.js:680-705)
- [ ] Update App.js to use extracted functions
- [ ] Run full test suite
- [ ] Commit: `refactor: extract array management to custom hook`
- [ ] **Estimated Time:** 3 hours

#### Extract Form Update Helpers

- [ ] Create `src/hooks/useFormUpdates.js`
- [ ] Extract `updateFormData()` logic (App.js:164-175)
- [ ] Extract `updateFormArray()` logic (App.js:187-209)
- [ ] Extract `onBlur()` logic (App.js:217-237)
- [ ] Update App.js to use extracted functions
- [ ] Run full test suite
- [ ] Commit: `refactor: extract form update helpers`
- [ ] **Estimated Time:** 3 hours

**Week 1-2 Exit Gate:**

- [ ] App.js reduced by ~195 lines (7%)
- [ ] All tests passing (1185+)
- [ ] No performance regressions
- [ ] **Golden YAML identical** run-to-run
- [ ] No React key or controlled/uncontrolled warnings
- [ ] Code review approval

### Week 3-4: Medium-Risk Refactoring - Complex Functions

**Goal:** Extract complex business logic from App.js
**Status:** 🔴 BLOCKED - Waiting for Week 1-2 completion
**Estimated Reduction:** 310 additional lines (11% of App.js)

### Extract Validation System (already moved; finalize behavior)

- [ ] Ensure `validate(model)` merges schema + rules
- [ ] Bind errors via `aria-describedby`; add “Validate All” UX if missing
- [ ] Integration tests for timing & messages
- [ ] Commit: `refactor(validation): finalize integration`

### Extract Import/Export Logic (with worker seam)

- [ ] Create `src/features/importExport.js`
- [ ] Extract `importFile()` (App.js:80-154) → `importFiles(files, { onProgress? })`
- [ ] Extract `generateYMLFile()` (App.js:652-678) → `exportAll(model, { onProgress? })`
- [ ] Ensure both functions use `src/io/yaml.js`
- [ ] Update App.js to use extracted functions
- [ ] Run full test suite
- [ ] Manual test: import → edit → export → re-import
- [ ] Test with trodes_to_nwb Python package
- [ ] Commit: `refactor: extract import/export logic`
- [ ] **Estimated Time:** 5 hours

### Extract Electrode Group Logic (id-based ops + renumber rules)

- [ ] Create `src/hooks/useElectrodeGroups.js`
- [ ] Extract `nTrodeMapSelected()` (App.js:292-356)
- [ ] Extract `duplicateElectrodeGroupItem()` (App.js:707-756) → `duplicateGroup(id)`
- [ ] Extract `removeElectrodeGroupItem()` (App.js:410-436) → `removeGroup(id)`
- [ ] Ensure **ntrode renumbering** logic is centralized & unit-tested
- [ ] Update App.js to use extracted functions
- [ ] Run full test suite (especially ntrode tests)
- [ ] Verify ntrode ID renumbering logic preserved
- [ ] Test multi-shank device types
- [ ] Commit: `refactor: extract electrode group logic`
- [ ] **Estimated Time:** 6 hours

**Week 3-4 Exit Gate:**

- [ ] App.js reduced by ~505 lines total (18%)
- [ ] All tests passing (1224+)
- [ ] YAML output identical to pre-refactor
- [ ] Integration with trodes_to_nwb verified
- [ ] Code review approval

---

### Week 5-7: Component Extraction

**Goal:** Decompose large JSX render block into React components
**Status:** 🔴 BLOCKED - Waiting for Week 3-4 completion
**Estimated Reduction:** 1400 lines (49% of App.js)

### Add a Light Store Facade (keeps future reducer optional)

- [ ] Create `src/state/store.js` exposing `useStore()` → `{ model, selectors, actions }`
- [ ] Internally call `useFormUpdates()` / `useArrayManagement()` for now
- [ ] Update new components to read/write via store hooks instead of deep props
- [ ] Commit: `refactor(state): store facade for selectors/actions`
- [ ] **Estimated Time:** 3 hours

#### Extract Subject Fields Component

- [ ] Create `src/components/SubjectFields.jsx`
- [ ] Extract subject section JSX (App.js:1063-1145)
- [ ] Pass form state and handlers via props
- [ ] Add Storybook story
- [ ] Test component in isolation
- [ ] Update App.js to use `<SubjectFields />`
- [ ] Run full test suite
- [ ] Commit: `refactor: extract SubjectFields component`
- [ ] **Estimated Time:** 4 hours

#### Extract Additional Form Components

Following same pattern:

- [ ] `<DataAcqDevice />` (App.js:1148-1247)
- [ ] `<CameraFields />` (App.js:1248-1371)
- [ ] `<TaskFields />` (App.js:1372-1482)
- [ ] `<ElectrodeGroupFields />` (App.js:~400 lines)
- [ ] `<BehavioralEventsFields />`
- [ ] `<OptogeneticsFields />`
- [ ] `<AssociatedFilesFields />`
- [ ] **Estimated Time:** 2-3 days (ongoing)

#### Visual Regression Testing Setup

- [ ] Install Storybook
- [ ] Configure visual regression tests
- [ ] Add stories for all extracted components
- [ ] Establish baseline snapshots
- [ ] **Estimated Time:** 4 hours

**Week 5-7 Exit Gate:**

- [ ] App.js render block reduced to ~500 lines
- [ ] All components tested in isolation
- [ ] Visual regression tests passing
- [ ] Full integration tests passing
- [ ] Code review approval

---

### Week 8: Code Cleanup

**Goal:** Clean up remaining code quality issues
**Status:** 🔴 BLOCKED - Waiting for Week 5-7 completion

- [ ] Remove unused variables (20 ESLint warnings)
- [ ] Remove unused imports
- [ ] Add missing JSDoc comments
- [ ] Improve variable naming
- [ ] Extract magic numbers to constants
- [ ] **Estimated Time:** 1 week

### Phase 3 Exit Gate

- [ ] App.js reduced by 60%+ (1900+ lines extracted)
- [ ] 0 ESLint warnings
- [ ] Test coverage ≥ 80%
- [ ] All refactoring covered by tests
- [ ] No performance regressions
- [ ] YAML output identical to pre-refactor
- [ ] Integration with trodes_to_nwb verified
- [ ] Human review and approval

---
---

## Completed Phases (Archive)

<details>
<summary><b>Phase 2.5: Refactoring Preparation</b> ✅ COMPLETE (10 hours)</summary>

- [x] Task 2.5.1: CSS Selector Migration (313 calls migrated)
- [x] Task 2.5.2: Core Function Tests (88 existing tests adequate)
- [x] Task 2.5.3: Electrode Sync Tests (51 existing tests excellent)
- [x] Task 2.5.4: Error Recovery (skipped - NICE-TO-HAVE)

**Exit Criteria Met:**

- [x] All tests passing (1295/1295 = 100%)
- [x] No flaky tests
- [x] Behavioral contract tests verified (139 tests)
- [x] Ready for Phase 3 refactoring

**See:** `docs/archive/PHASE_2.5_COMPLETE.md`

</details>

<details>
<summary><b>Phase 2: Bug Fixes</b> ✅ COMPLETE</summary>

- [x] P1: Missing required fields validation (critical)
- [x] P2: Duplicate channel mapping (critical)
- [x] P3: Optogenetics dependencies (important)
- [x] P4: Date of birth edge case (minor - working correctly)

**All baseline bugs fixed and tests passing.**

</details>

<details>
<summary><b>Phase 1.5: Test Quality</b> ✅ COMPLETE</summary>

- [x] Deferred tasks from Phase 1 completed in Phase 2.5
- [x] Test coverage improved to support refactoring

</details>

<details>
<summary><b>Phase 1: Testing Foundation</b> ✅ COMPLETE</summary>

- [x] Core module tests (App.js functionality)
- [x] Validation system tests
- [x] State management tests
- [x] Component tests (form elements)
- [x] Utility function tests
- [x] Integration workflows (import/export)

**1295 tests written, all passing.**

</details>

<details>
<summary><b>Phase 0: Baseline & Infrastructure</b> ✅ COMPLETE</summary>

- [x] Vitest and Playwright setup
- [x] CI/CD pipeline (GitHub Actions)
- [x] Pre-commit hooks (Husky, lint-staged)
- [x] Baseline tests (validation, state, performance, E2E)

**Infrastructure established, all baselines passing.**

</details>

---

## Notes

For detailed task history, see:

- `docs/archive/PHASE_*.md` - Detailed completion reports
- `docs/REFACTOR_CHANGELOG.md` - Chronological changes
- `docs/SCRATCHPAD.md` - Current phase notes
