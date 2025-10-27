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

- [x] Add Prettier + ESLint (react, react-hooks, jsx-a11y) and enable CI (if not already) - Already configured via react-app preset
- [x] Create `tests/fixtures/golden/` with representative YAML exports (use src/**tests**/fixtures/valid/20230622_sample_metadata.yml, roundtrip)
- [x] Add test: `export(model) === golden` (byte-for-byte) - 13 tests added in golden-yaml.baseline.test.js
- [x] Commit: `chore: lint, CI, and golden YAML fixtures`
- [x] **Estimated Time:** 1 hour (Completed 2025-10-26)

### Promote YAML utilities → single deterministic IO module ✅ COMPLETE
>
> You already extracted YAML export helpers. Make them the single source of truth.

- [x] **Rename/Move:** `src/utils/yamlExport.js` → `src/io/yaml.js`
- [x] **API:** `encodeYaml(model)`, `decodeYaml(text)`, `formatDeterministicFilename(model)`
- [x] **Determinism:** sorted keys, `\n` EOL, UTF-8, explicit quoting where required
- [x] **Codemod:** replace all imports of `utils/yamlExport` with `io/yaml`
- [x] **Tests:** golden equality across two consecutive exports; round-trip parity
- [x] Commit: `fix(io): deterministic YAML encoder/decoder` (82810de)

### Promote validation utilities → pure validation system (event-driven) ✅ PHASE 1 COMPLETE

> You already extracted validation helpers. Rehome them and make timing explicit.

**Goal:** Centralize validation logic while improving user experience with immediate feedback.
**Outcome:** Users get fast inline hints while typing, formal validation on blur, and full cross-field validation on "Validate All" or export.

---

#### Validation Architecture Setup ✅ COMPLETE (2025-10-26)

- [x] **Move** existing `src/utils/validation.js` → `src/validation/`
  - `schemaValidation.js` — JSON Schema / AJV structural rules
  - `rulesValidation.js` — custom logical / cross-field rules
  - `paths.js` — normalize AJV paths → `subject[0].weight` style
  - `index.js` — `validate(model): Issue[]`
- [x] **Define Issue type:** `{ path, code, severity, message, instancePath?, schemaPath? }`
- [x] **Unify output:** both schema and rules validations return `Issue[]`
- [x] **Sort deterministically** (`path + code`) for stable snapshot tests
- [x] Commit: `feat(validation): promote validation utilities to pure system with unified Issue[] API` (5a4579e)
- [x] **Testing:** 125 new tests (TDD approach - tests written FIRST)
  - paths.test.js: 25 tests
  - schemaValidation.test.js: 36 tests
  - rulesValidation.test.js: 37 tests
  - integration.test.js: 27 tests
- [x] **Verification:** All 1454 tests passing, no regressions

---

#### Lightweight "Instant Feedback" Layer ✅ COMPLETE

- [x] Create `src/validation/quickChecks.js`
  - Cheap synchronous checks: required, format, enum, type
  - Runs on debounced `onChange` (250–400 ms)
- [x] Add `useQuickChecks(path, value)` hook for instant hints
- [x] Display hint text (subtle, not role="alert") below inputs
- [x] Ensure **no ARIA announcements** while typing
- [x] Commit: `feat(validation): add quickChecks instant hint layer`

---

#### Smart Hint-to-Error Escalation (Field-Scoped Validation) ✅ COMPLETE

**Implementation Decision:** Instead of separate field validation layer, we implemented smart escalation within the quick checks system:

- Gray hints while typing (`role="status"`, debounced 300ms)
- Red errors on blur (`role="alert"`, immediate, no debounce)
- Same message, escalating severity and visual treatment

**Tasks:**

- [x] Add `validateOnBlur()` function to `useQuickChecks` hook
- [x] Create error severity support in `HintDisplay` component
  - ARIA roles escalate: `role="status"` → `role="alert"`
  - `aria-live` escalates: `polite` → `assertive`
- [x] Add `.validation-error` CSS styling with WCAG AAA compliance
- [x] Wire up `handleBlur` in InputElement, DataListElement, SelectElement
- [x] Ensure layout stability (min-height, no shift)
- [x] Add `prefers-reduced-motion` support
- [x] Code review and UX review (both APPROVED ✅)
- [x] Commit: `feat(validation): smart hint-to-error escalation with accessibility`

**Rationale:** Progressive disclosure pattern is simpler and more user-friendly than separate validation layers. Single message area per field reduces cognitive load.

---

#### Full-Form Validation (on Demand) ✅ ALREADY EXISTS

**Current State:** The app already implements full-form validation on export attempt via `generateYMLFile()`:

- ✅ Runs `validate(model)` (both jsonschemaValidation + rulesValidation)
- ✅ Errors block export
- ✅ Displays error summary to user via `showErrorMessage()`

**Decision:** No separate "Validate All" button needed - export attempt serves this purpose. Scientific users naturally validate when attempting export.

---

#### Accessibility Improvements ✅ COMPLETE

**High-value, low-effort improvements to complete validation UX:**

- [x] Link validation hints to inputs via `aria-describedby`
  - Updated InputElement to generate unique hint ID from input ID
  - Updated DataListElement to generate unique hint ID
  - Updated SelectElement to generate unique hint ID
  - Pass `id` prop to HintDisplay component
  - Set `aria-describedby` attribute on input elements when validation present
  - Improves screen reader experience (announces hints when field focused)
- [x] Add "focus first error" behavior after export validation failure
  - In `generateYMLFile()`, after validation fails, find first invalid field
  - Focus the first error input and scroll into view (smooth, center)
  - Helps users quickly locate and fix validation errors
- [x] Commit: `fix(a11y): link validation hints and focus first error` (b6a6f94)

**Time Taken:** 1 hour (as estimated)
**Value Delivered:** High - Significantly improves screen reader UX and error recovery

**Not needed (design decision):**

- ❌ `useStableId()` - IDs are already stable via props
- ❌ Keyboard navigation through errors - Tab works fine
- ❌ Section summary with `aria-live` - Field-level errors sufficient

---

### Exit Criteria ✅ COMPLETE

- ✅ Users see immediate field hints while typing (gray, debounced 300ms)
- ✅ Errors appear on blur (red, immediate, role="alert")
- ✅ Cross-field errors shown on export attempt (existing behavior)
- ✅ All validation shares unified Issue[] API from `src/validation/`
- ✅ Performance excellent (no UI jank, proper debouncing)
- ✅ 1528 tests passing (100%)
- ✅ `aria-describedby` linking (completed)
- ✅ Focus first error on validation failure (completed)

### ~~Stable IDs for List Items~~ ❌ SKIPPED - Would Break Data Pipeline

**Status:** ABANDONED after code review (see SCRATCHPAD.md for details)

**Why Skipped:**

- Adding `id` fields to arrays would export them to YAML
- Only 2/11 arrays require `id` in JSON schema (cameras, electrode_groups)
- Would violate schema and potentially break trodes_to_nwb pipeline
- Current index-based keys are acceptable for this use case

**Alternative Considered:** Add separate `_reactKey` field for UI-only use, but deemed unnecessary complexity.

**Decision:** Keep current implementation. Arrays with schema-required IDs already have them.

- [ ] ~~Generate `id` with `nanoid()` when creating rows/ntrodes/groups~~
- [ ] ~~Replace all `key={index}` with `key={row.id}`~~
- [ ] ~~Ensure array operations accept **id**, not index~~
- [ ] ~~Commit: `fix(react): replace index keys with stable ids`~~
- [x] **Task Reconsidered:** 1.5 hours spent on investigation → ABANDONED

### Normalize Controlled Inputs + A11y Wiring ✅ COMPLETE

- [x] Convert mixed `defaultValue/value` inputs to **controlled**
- [x] Add `useStableId()`; bind `<label htmlFor>` and `aria-describedby` for error text
- [x] Wrap logical groups with `fieldset/legend`
- [x] Commit: `fix(a11y): controlled inputs and label/error associations` (4688eb8)
- [x] Migrate App.js to controlled mode (d635b42)
- [x] Fix 32 test failures using systematic debugging (e5f2d20)
- [x] **Actual Time:** 5 hours total (1566/1566 tests passing - 100%)

**Outcome:** All form components use controlled-only mode. ChannelMap migrated to controlled. All tests passing. Code review approved.

#### Extract Array Management ✅ COMPLETE

- [x] Create `src/hooks/useArrayManagement.js`
- [x] Extract `addArrayItem()` (App.js:412-446)
- [x] Extract `removeArrayItem()` (App.js:448-456)
- [x] Extract `duplicateArrayItem()` (App.js:557-582)
- [x] Update App.js to use extracted functions
- [x] Create comprehensive tests (32 tests, all passing)
- [x] Apply code review improvements (ID logic, console.warn, remove redundant clone)
- [x] Run full test suite (1598/1598 passing)
- [x] Commit: `refactor: extract array management to custom hook`
- [x] **Actual Time:** 2.5 hours

#### Extract Form Update Helpers ✅ COMPLETE

- [x] Create `src/hooks/useFormUpdates.js`
- [x] Extract `updateFormData()` logic (App.js:201-214)
- [x] Extract `updateFormArray()` logic (App.js:226-248)
- [x] Extract `onBlur()` logic (App.js:256-291)
- [x] Extract `handleChange()` helper (App.js:189-191)
- [x] Create comprehensive tests (52 tests, all passing)
- [x] Update App.js to use extracted functions
- [x] Run full test suite (1650/1650 passing)
- [x] Request code review - APPROVED
- [x] Commit: `refactor: extract form update helpers`
- [x] **Actual Time:** 2.5 hours

**Week 1-2 Exit Gate:**

- [x] App.js reduced by ~195 lines (7%) - ✅ Validation utilities extracted
- [x] All tests passing (1566/1566 = 100%) - ✅ Controlled input migration complete
- [x] No performance regressions - ✅ Verified
- [x] **Golden YAML identical** run-to-run - ✅ 18/18 baseline tests passing
- [x] No React key or controlled/uncontrolled warnings - ✅ All controlled mode
- [x] Code review approval - ✅ Approved by code-reviewer agent (e5f2d20)

### Week 3-4: Medium-Risk Refactoring - Complex Functions ✅ COMPLETE

**Goal:** Extract complex business logic from App.js
**Status:** ✅ COMPLETE - Both tasks finished
**Actual Reduction:** ~190 lines (array management: ~80 lines, form updates: ~110 lines)

### Extract Validation System ✅ COMPLETE

- [x] Ensure `validate(model)` merges schema + rules
- [x] Bind errors via `aria-describedby` (completed in accessibility phase)
- [x] Integration tests for timing & messages (189 validation tests)
- [x] Fix failing tests and update imports (camera validation logic improved)
- [x] Delete redundant App validation tests (3 files, 1767 lines, 94 tests)
- [x] Code review approved with minor suggestions
- [x] Commit: `refactor(validation): finalize integration`
- [x] **Actual Time:** 3 hours
- [x] **Tests:** 1556/1556 passing (100%)

### Extract Import/Export Logic (with worker seam) ✅ COMPLETE

- [x] Create `src/features/importExport.js`
- [x] Extract `importFile()` (App.js:80-154) → `importFiles(files, { onProgress? })`
- [x] Extract `generateYMLFile()` (App.js:652-678) → `exportAll(model, { onProgress? })`
- [x] Ensure both functions use `src/io/yaml.js`
- [x] Update App.js to use extracted functions
- [x] Run full test suite (1577/1577 passing)
- [x] Create comprehensive tests (21 tests, all passing)
- [x] Code review approved (APPROVE ✅)
- [x] Commit: `refactor: extract import/export logic`
- [x] **Actual Time:** 4.5 hours (vs 5 estimated)

### Extract Electrode Group Logic (id-based ops + renumber rules) ✅ COMPLETE

- [x] Create `src/hooks/useElectrodeGroups.js`
- [x] Extract `nTrodeMapSelected()` (App.js:153-223)
- [x] Extract `duplicateElectrodeGroupItem()` (App.js:246-267)
- [x] Extract `removeElectrodeGroupItem()` (App.js:152-178)
- [x] Ensure **ntrode renumbering** logic is centralized & unit-tested
- [x] Update App.js to use extracted functions
- [x] Run full test suite (especially ntrode tests) - 1612/1612 passing
- [x] Verify ntrode ID renumbering logic preserved
- [x] Test multi-shank device types (tetrode, 2-shank, 4-shank tested)
- [x] Request code review - APPROVED ✅
- [x] Commit: `refactor: extract electrode group logic` (pending)
- [x] **Actual Time:** 6 hours (matching estimate)

**Week 3-4 Exit Gate:** ✅ COMPLETE

- [x] App.js reduced by ~421 lines total (15%) - Original: 2794 lines → Current: 2373 lines
  - Array management: ~80 lines
  - Form updates: ~110 lines
  - Validation: ~60 lines (moved to src/validation/)
  - Import/export: ~145 lines
  - Electrode groups: ~175 lines (includes removing unused imports)
- [x] All tests passing (1612/1612 = 100%)
- [x] YAML output identical to pre-refactor (18/18 golden baseline tests passing)
- [x] Integration with trodes_to_nwb verified (schema validation, device types, ntrode numbering)
- [x] Code review approval (4 refactoring PRs all APPROVED)

**Note:** Original estimate of 505 lines (18%) was based on function body lines only. Actual reduction of 421 lines (15%) includes imports, comments, and whitespace. Core business logic extraction achieved the goal of simplifying App.js.

---

### Week 5-7: Component Extraction

**Goal:** Decompose large JSX render block into React components
**Status:** 🟡 IN PROGRESS - Store facade complete, SubjectFields next
**Estimated Reduction:** 1400 lines (49% of current 2373-line App.js → ~973 lines)

### Add a Light Store Facade (keeps future reducer optional) ✅ COMPLETE

- [x] Create `src/state/store.js` exposing `useStore()` → `{ model, selectors, actions }`
- [x] Internally call `useFormUpdates()` / `useArrayManagement()` / `useElectrodeGroups()`
- [x] Add selectors: getCameraIds(), getTaskEpochs(), getDioEvents()
- [x] Create comprehensive tests (31 tests, all passing)
- [x] Commit: `refactor(state): store facade for selectors/actions`
- [x] **Actual Time:** ~3 hours (as estimated)
- [ ] **NOTE:** App.js not yet migrated to use store (will happen with component extraction)

#### Extract Subject Fields Component ✅ COMPLETE

- [x] Read App.js subject section (lines 531-629) to understand dependencies
- [x] Create test file `src/components/__tests__/SubjectFields.test.jsx` (TDD)
- [x] Write tests FIRST (render, inputs, state updates, validation)
- [x] Watch tests fail (TDD red phase)
- [x] Create `src/components/SubjectFields.jsx`
- [x] Extract subject section JSX (props-based, not store-based)
- [x] Make tests pass (TDD green phase)
- [x] Update App.js to use `<SubjectFields formData={formData} ... />`
- [x] Debug integration test failures (systematic debugging)
- [x] Fix root cause (separate state instances)
- [x] Verify all 1664 tests pass (100%)
- [x] Verify golden YAML tests pass (18/18)
- [x] Commit: `refactor: extract SubjectFields component (prop-based)`
- [x] **Actual Time:** 6 hours (includes 3.5 hours debugging)

**Key Learning:** Store pattern needs Context provider for shared state. Used props instead for now.

#### Extract Additional Form Components

**Pattern:** Props-based components, TDD approach, verify golden YAML tests

**Completed:**

- [x] `<SubjectFields />` - 99 lines, 21 tests ✅
- [x] `<DataAcqDeviceFields />` - 102 lines, 21 tests, array with CRUD ✅
- [x] `<DeviceFields />` - 20 lines, 6 tests, single ListElement ✅
- [x] `<CamerasFields />` - 124 lines, 17 tests, array with CRUD + validation ✅
- [x] `<TasksFields />` - 135 lines, 8 tests, array with camera dependency ✅
- [x] `<BehavioralEventsFields />` - 81 lines, 7 tests, array with CRUD ✅
- [x] `<ElectrodeGroupFields />` - 268 lines, 26 tests, most complex component ✅

**Code Review & Quality Improvements:** ✅ COMPLETE

- [x] Added PropTypes to all 6 components (runtime type checking)
- [x] Added CRUD operation tests (add, remove, duplicate buttons)
- [x] Added validation tests for critical fields
- [x] All 1719 tests passing (up from 1698)
- [x] Commit: `test: add PropTypes and CRUD tests to 6 extracted components` (f98b347)

**ElectrodeGroupFields Extraction:** ✅ COMPLETE (2025-10-26)

- [x] Created component with 10 fields + ntrode integration (268 lines)
- [x] Created 26 comprehensive tests (TDD approach)
- [x] Code review: APPROVE ✅ (9/10 component, 10/10 tests, 10/10 integration)
- [x] All 1745 tests passing (+26 new tests)
- [x] All 18 golden YAML tests passing
- [x] App.js reduced by ~214 lines (2373 → 1572 lines, 33.7% total reduction)
- [x] Commit: `refactor: extract ElectrodeGroupFields component` (f0309a1)

**Pre-existing Bug Fixes:** ✅ COMPLETE (2025-10-26)

- [x] Fixed 4 duplicate onChange handlers (ElectrodeGroupFields, App.js optogenetics)
- [x] Fixed 1 PropTypes warning (min={0} → min="0")
- [x] All 1745 tests passing, 18 golden YAML tests passing
- [x] Commit: `fix: resolve duplicate onChange handlers and PropTypes warnings` (571da07)

**Remaining:**

- [x] `<OptogeneticsFields />` - Multiple subsections (virus_injection, optical_fiber, opto_excitation_source, fs_gui_yamls, opto_software) ✅
- [x] `<AssociatedFilesFields />` - Two subsections (associated_files, associated_video_files) with cross-field dependencies ✅
- [ ] Additional sections as needed
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

### Week 7.5: Implement React Context Provider for Shared Store

**Goal:** Replace prop drilling with Context-based store pattern
**Status:** 🔴 BLOCKED - Waiting for Week 5-7 component extractions to complete
**Estimated Time:** 4-6 hours

**Why This is Needed:**

The current SubjectFields implementation revealed a critical issue: each `useStore()` call creates a **separate state instance** because the hook calls `useState()` internally. This means components don't share data.

**Current Workaround (Temporary):**

- All components accept props (formData, handleChange, onBlur, etc.)
- App.js passes props down to each component
- Works but requires prop drilling for 10+ components

**Correct Pattern (Context Provider):**

#### Task 7.5.1: Create StoreContext Provider

- [ ] Create `src/state/StoreContext.js`
- [ ] Implement `StoreProvider` component that creates store ONCE
- [ ] Export `useStoreContext()` hook for accessing shared store
- [ ] Add tests for StoreContext (provider, consumer, shared state)
- [ ] Commit: `feat(state): add React Context provider for shared store`
- [ ] **Estimated Time:** 2 hours

**Implementation:**

```javascript
// src/state/StoreContext.js
import { createContext, useContext } from 'react';
import { useStore } from './store';

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const store = useStore(); // Created ONCE at top level
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStoreContext() {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStoreContext must be used within StoreProvider');
  }
  return context;
}
```

#### Task 7.5.2: Wrap App with StoreProvider

- [ ] Update `src/App.js` to export wrapped component
- [ ] Move `useState(defaultYMLValues)` call from App to StoreProvider (implicit via useStore)
- [ ] Remove individual hook calls (useArrayManagement, useFormUpdates, useElectrodeGroups)
- [ ] App accesses store via `useStoreContext()` instead of creating own state
- [ ] Verify all tests pass (App still works identically)
- [ ] Commit: `refactor(App): use StoreProvider for shared state`
- [ ] **Estimated Time:** 1 hour

**Implementation:**

```javascript
// src/App.js
import { StoreProvider, useStoreContext } from './state/StoreContext';

function AppContent() {
  const { model: formData, actions } = useStoreContext();

  // No more useState, useArrayManagement, etc.
  // Everything comes from shared store

  return (/* existing JSX */);
}

export function App() {
  return (
    <StoreProvider>
      <AppContent />
    </StoreProvider>
  );
}
```

#### Task 7.5.3: Migrate SubjectFields to useStoreContext

- [ ] Update `src/components/SubjectFields.jsx` to use `useStoreContext()`
- [ ] Remove all props (formData, handleChange, onBlur, itemSelected)
- [ ] Update App.js to render `<SubjectFields />` without props
- [ ] Update SubjectFields tests to provide StoreProvider wrapper
- [ ] Verify all 21 SubjectFields tests pass
- [ ] Verify integration tests pass
- [ ] Commit: `refactor(SubjectFields): migrate to useStoreContext`
- [ ] **Estimated Time:** 1.5 hours

**Implementation:**

```javascript
// src/components/SubjectFields.jsx
import { useStoreContext } from '../state/StoreContext';

export default function SubjectFields() {
  const { model, actions } = useStoreContext(); // Shared instance!

  return (
    <div id="subject-area" className="area-region">
      {/* Same JSX, but reads from shared context */}
    </div>
  );
}
```

#### Task 7.5.4: Migrate Remaining Components (if any extracted)

- [ ] For each component extracted in Week 5-7:
  - [ ] Remove props, use `useStoreContext()`
  - [ ] Update tests to use StoreProvider
  - [ ] Verify tests pass
- [ ] Run full test suite (all tests passing)
- [ ] Verify golden YAML tests pass (18/18)
- [ ] Commit: `refactor(components): migrate all to useStoreContext`
- [ ] **Estimated Time:** 1-2 hours (depends on component count)

**Week 7.5 Exit Gate:**

- [ ] StoreContext provider implemented and tested
- [ ] App.js uses shared store (no more prop drilling)
- [ ] All extracted components use `useStoreContext()`
- [ ] All tests passing (1664+ tests)
- [ ] Golden YAML tests passing (18/18)
- [ ] No regressions in functionality
- [ ] Code review approval

**Blockers:**

- Must complete Week 5-7 component extractions first
- Need at least 2-3 components extracted to prove pattern works

---

### Week 8: Code Cleanup

**Goal:** Clean up remaining code quality issues
**Status:** 🔴 BLOCKED - Waiting for Week 5-7 completion

- [ ] Remove unused variables (20 ESLint warnings)
- [ ] Remove unused imports
- [ ] Add missing JSDoc comments
- [ ] Improve variable naming
- [ ] Extract magic numbers to constants
- [ ] Ensure there aren't redundant tests
- [ ] Remove any commented-out code
- [ ] Remove any extraneous console.log statements
- [ ] Make sure all comments are relevant and use comments best practices
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
