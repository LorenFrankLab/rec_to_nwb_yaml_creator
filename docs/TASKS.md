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

- [ ] Create `src/utils/yamlExport.js`
- [ ] Extract `convertObjectToYAMLString()` (App.js:444-474)
- [ ] Extract `createYAMLFile()` helper
- [ ] Update App.js imports
- [ ] Run full test suite
- [ ] Commit: `refactor: extract YAML export utilities`

#### Extract Error Display Utilities (1-2 hours)

- [ ] Create `src/utils/errorDisplay.js`
- [ ] Extract `showCustomValidityError()`
- [ ] Extract `clearCustomValidityError()`
- [ ] Update App.js imports
- [ ] Run full test suite
- [ ] Commit: `refactor: extract error display utilities`

#### Extract Validation Utilities (2-3 hours)

- [ ] Create `src/utils/validation.js`
- [ ] Extract `jsonschemaValidation()`
- [ ] Extract `rulesValidation()`
- [ ] Update App.js imports
- [ ] Run full test suite
- [ ] Commit: `refactor: extract validation utilities`

#### Extract String Formatting Utilities (1-2 hours)

- [ ] Create `src/utils/stringFormatting.js`
- [ ] Extract `sanitizeTitle()`
- [ ] Extract `formatCommaSeparatedString()`
- [ ] Extract `commaSeparatedStringToNumber()`
- [ ] Update App.js imports
- [ ] Run full test suite
- [ ] Commit: `refactor: extract string formatting utilities`

### Week 3+: Custom Hooks (Future Phase)

**Status:** 🔴 DEFERRED - To be planned after utility extraction complete

- Form state management hooks
- Array management hooks
- Effect hooks

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
