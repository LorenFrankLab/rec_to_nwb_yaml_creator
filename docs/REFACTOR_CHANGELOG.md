# Refactoring Changelog

**Purpose:** Track all changes made during the refactoring milestones.

**Last Updated:** October 28, 2025

---

## M5.5.1 - Animal Creation Form Post-Release Fixes (October 28, 2025)

### Summary

Fixed user-reported issues from M5.5 initial release:
1. Removed "Other (O)" option from Sex field per user feedback
2. Fixed navigation bug where AnimalWorkspace wasn't receiving URL parameter to auto-select animal

### Changes

#### Bug Fixes

- **`src/pages/Home/AnimalCreationForm.jsx`**
  - Removed "Other (O)" option from Sex radio buttons (line 368)
  - Sex field now only offers: Male (M), Female (F), Unknown (U)
  - No test changes required (tests only used 'U')

- **`src/pages/AnimalWorkspace/index.jsx`**
  - Added `useEffect` hook to read `?animal=<id>` URL parameter on mount
  - Auto-selects animal if parameter present and animal exists
  - Fixes navigation from Home after animal creation

#### Tests Added

- **`src/pages/AnimalWorkspace/__tests__/AnimalWorkspace.test.jsx`** - Added 2 tests
  - Test auto-selection from URL parameter
  - Test graceful handling of non-existent animal in parameter
  - Total tests now: 6 (was 4)

### Test Results

**All 2372 tests passing** (2370 + 2 new, 1 skipped)

### Impact

- Users can now successfully navigate from Home → AnimalWorkspace after creating an animal
- Sex field matches NWB standard values (no "Other" option)
- Experimenter names remain unchanged (correctly support full names like "Kyu Hyun Lee")

---

## M5.5 - Animal Creation Form (October 28, 2025)

### Summary

Implemented complete animal creation interface, filling the critical gap where users had no way to create animals through the modern workspace UI. Uses Container/Presentational pattern with comprehensive validation, smart defaults, and full WCAG 2.1 Level AA accessibility compliance.

### Changes

#### Components

- **Created `src/pages/Home/AnimalCreationForm.jsx`** - 560 lines, 19 tests
  - Presentational form component with 8 required fields
  - Controlled inputs with local state management
  - Field-level validation with inline error messages
  - Species dropdown with constrained vocabulary (Rat, Mouse, Marmoset, Macaque, Other)
  - Sex radio buttons (M/F/U/O)
  - HTML5 date picker with future date constraint
  - Dynamic experimenter list with add/remove functionality
  - Keyboard shortcuts (Escape to cancel, Ctrl+Enter to submit)
  - Focus management for accessibility
  - PropTypes validation for all props

- **Updated `src/pages/Home/index.jsx`** - 146 lines, 8 tests (replaced stub)
  - Container component integrating with store
  - Smart defaults with three-tier precedence:
    1. Workspace settings (if configured)
    2. Last animal's experimenters (fallback)
    3. Frank Lab defaults (final fallback)
  - Store integration via `createAnimal(animalId, subject, metadata)`
  - Success navigation to AnimalWorkspace
  - Error handling with user-friendly messages
  - First-time user welcome message

- **Created `src/pages/Home/Home.css`** - 234 lines
  - Material Design styling matching M5 patterns
  - Imports CSS variables from DayEditor.css
  - Responsive layout with mobile breakpoints
  - Form card with elevation and rounded corners
  - Radio button styling
  - Dynamic list item styling
  - Validation error/warning states
  - First-time user notice styling

#### CSS Infrastructure

- **Updated `src/pages/DayEditor/DayEditor.css`**
  - Added 4 missing CSS variables for grey palette:
    - `--color-grey-300: #bdbdbd`
    - `--color-grey-400: #9e9e9e`
    - `--color-grey-700: #616161`
    - `--color-grey-800: #424242`
  - Ensures consistent Material Design color system

#### Tests

- **Created `src/pages/Home/__tests__/AnimalCreationForm.test.jsx`** - 388 lines, 19 tests
  - Rendering: 2 tests (all fields present, defaults pre-filled)
  - Validation: 5 tests (uniqueness, future dates, age warnings, experimenters, species)
  - Submit behavior: 5 tests (disabled state, enabled state, data structure, race conditions)
  - Interactions: 2 tests (add/remove experimenters)
  - Accessibility: 2 tests (focus management, screen reader announcements)
  - Edge cases: 3 tests (spaces prevention, empty strings, species conversion, cancel text)

- **Created `src/pages/Home/__tests__/Home.test.jsx`** - 198 lines, 8 tests
  - Rendering: 1 test (form present)
  - Defaults: 2 tests (workspace settings, last animal fallback)
  - Navigation: 1 test (success navigation)
  - Error handling: 1 test (duplicate detection)
  - Accessibility: 1 test (landmarks and headings)
  - First-time UX: 2 tests (welcome message conditional)

#### Validation Logic

- Inline validation function `validateAnimalForm()` with comprehensive rules:
  - Subject ID: required, no whitespace, alphanumeric + underscore/hyphen only, unique
  - Species: required, custom species required when "Other" selected
  - Sex: required (one of M/F/U/O)
  - Genotype: required
  - Date of birth: required, cannot be future, warns if >5 years ago (non-blocking)
  - Experimenter names: at least one required, empty strings filtered
  - Lab: required, no whitespace-only
  - Institution: required, no whitespace-only

### Code Review Fixes

- **P0-1: JSDoc Syntax** - Fixed `function` → `Function` type annotations (lines 82-83)
- **P0-2: CSS Variables** - Added missing grey-300, 400, 700, 800 to DayEditor.css

### Test Results

- **M5.5 Tests:** 27/27 passing (19 AnimalCreationForm + 8 Home)
- **Full Suite:** 2370/2371 passing (27 new tests, no regressions)
- **Build:** Success (verified with `npm run build`)

### Impact

- **Fills Critical Gap:** Users can now create animals through modern UI instead of legacy form
- **Progressive Disclosure:** Collects only subject info at creation time, defers hardware to Day Editor
- **Database Integrity:** Species dropdown prevents pollution (no "rat" vs "Rat" variants)
- **Smart UX:** Pre-fills experimenters from settings/last animal, reducing repetitive data entry
- **Accessibility:** Full WCAG 2.1 Level AA compliance enables use by researchers with disabilities

---

## M2 - UI Skeleton (October 27, 2025)

### Summary

Completed UI skeleton infrastructure for hash-based routing and accessibility. All view components implemented as stubs with proper ARIA landmarks. Legacy app extracted to LegacyFormView, preserving all existing functionality while enabling future multi-animal workspace features.

### Changes

#### Core Infrastructure

- **Created `src/layouts/AppLayout.jsx`** - 179 lines, 35 tests
  - Hash-based routing using useHashRouter hook
  - View rendering based on current route
  - Skip links for keyboard accessibility (WCAG 2.1 Level A - 2.4.1)
  - Screen reader announcements for route changes
  - Focus management on navigation
  - Global ARIA landmark structure

- **Created `src/hooks/useHashRouter.js`** - 3,497 bytes
  - Parses window.location.hash into route object
  - Supports routes: `/`, `/home`, `/workspace`, `/day/:id`, `/validation`
  - Listens for hashchange events
  - Returns `{ view, params }` object

#### View Components (Stubs)

- **Created `src/pages/Home/index.jsx`** - 53 lines
  - Stub for future animal selection interface (M3)
  - Proper `<main>` landmark with id="main-content"
  - Feature preview with roadmap links
  - Accessible heading structure

- **Created `src/pages/AnimalWorkspace/index.jsx`** - 54 lines
  - Stub for future multi-day management (M4)
  - Proper ARIA landmarks
  - Feature preview listing planned capabilities

- **Created `src/pages/DayEditor/index.jsx`** - 67 lines
  - Stub for future stepper interface (M5-M7)
  - Accepts `dayId` prop from route params
  - Displays feature preview with planned steps

- **Created `src/pages/ValidationSummary/index.jsx`** - 54 lines
  - Stub for future batch validation (M9)
  - Lists planned batch operations

- **Created `src/pages/LegacyFormView.jsx`** - 14,733 lines
  - Extracted entire original App.js form functionality
  - Preserves all existing features unchanged
  - Renders at `#/` (default route)
  - No breaking changes to user workflow

#### Accessibility

- **Created `src/__tests__/integration/aria-landmarks.test.jsx`** - 148 lines, 10 tests
  - Verifies navigation landmark presence
  - Verifies main content landmark
  - Tests landmark uniqueness (exactly one nav, one main)
  - Validates aria-label attributes
  - Confirms screen reader support

#### App Entry Point

- **Updated `src/App.js`** - Simplified to 32 lines
  - Now renders `<AppLayout />` only
  - All form logic moved to LegacyFormView
  - JSDoc documentation added

### Test Results

- **Total Tests:** 2218 passing (up from 2149, +69 new tests)
  - AppLayout tests: 35 passing
  - ARIA landmarks tests: 10 passing
  - Hash router integration tests: 24 passing
- **Test Files:** 109 passing
- **Coverage:** All M2 routes and accessibility features tested

### Breaking Changes

**None.** All changes are additive:

- Legacy app continues to work at `#/` (default route)
- All existing tests pass (2 pre-existing failures in ElectrodeGroupFields, unrelated to M2)
- No changes to YAML export functionality
- No changes to validation logic
- No changes to state management

### Routes Implemented

| Route | View | Purpose | Status |
|-------|------|---------|--------|
| `#/` or no hash | LegacyFormView | Original single-session YAML editor | ✅ Working |
| `#/home` | Home | Animal selection (stub) | ✅ Stub |
| `#/workspace` | AnimalWorkspace | Multi-day management (stub) | ✅ Stub |
| `#/day/:id` | DayEditor | Session editor (stub) | ✅ Stub |
| `#/validation` | ValidationSummary | Batch validation (stub) | ✅ Stub |

### Accessibility Features

1. **Skip Links** - First focusable elements, allow keyboard users to jump to content
2. **ARIA Landmarks** - `<main>`, `<nav>`, `<banner>`, `<contentinfo>` roles
3. **Focus Management** - Moves focus to main content on route change
4. **Screen Reader Announcements** - aria-live region announces navigation
5. **Semantic HTML** - Proper heading hierarchy, landmark structure
6. **Keyboard Navigation** - All features accessible via keyboard

### Files Changed

```
src/App.js                                              - Simplified to 32 lines
src/layouts/AppLayout.jsx                               - 179 lines (new)
src/layouts/__tests__/AppLayout.test.jsx                - 381 lines (new, 35 tests)
src/hooks/useHashRouter.js                              - 113 lines (new)
src/hooks/__tests__/useHashRouter.test.js               - 252 lines (new, 24 tests)
src/pages/Home/index.jsx                                - 53 lines (new stub)
src/pages/AnimalWorkspace/index.jsx                     - 54 lines (new stub)
src/pages/DayEditor/index.jsx                           - 67 lines (new stub)
src/pages/ValidationSummary/index.jsx                   - 54 lines (new stub)
src/pages/LegacyFormView.jsx                            - 14,733 lines (extracted from App.js)
src/__tests__/integration/aria-landmarks.test.jsx       - 148 lines (new, 10 tests)
docs/TASKS.md                                           - M2 section marked complete
docs/SCRATCHPAD.md                                      - M2 summary added
docs/REFACTOR_CHANGELOG.md                              - M2 section added
```

### Next Steps (M3)

1. Extend Context store with animal/day data model
2. Add animal/day reducers and actions
3. Create `docs/animal_hierarchy.md` data model documentation
4. Write tests for animal/day state management
5. Implement localStorage autosave

---

## M1 - Extract Pure Utilities (October 27, 2025)

### Summary

Completed YAML utilities extraction and test coverage. Discovered that extraction had already been done in earlier refactoring (Phase 3), with all YAML functions moved to `src/io/yaml.js`. Added missing test coverage for `decodeYaml()` and removed deprecated legacy file.

### Changes

#### Test Coverage

- **Created `src/__tests__/unit/io/yaml-decodeYaml.test.js`** - 23 comprehensive tests
  - Normal operation: simple objects, nested structures, arrays, null values, booleans, numeric types
  - Edge cases: empty strings, whitespace, empty objects, special characters, multiline strings
  - Error handling: malformed YAML, multiple documents, non-string inputs (null, undefined, number, object)
  - Round-trip compatibility: encode -> decode verification
  - Scientific metadata use cases: NWB structures, ISO 8601 datetime preservation, empty arrays

#### Cleanup

- **Removed `src/utils/yamlExport.js`** - Deprecated file no longer used
  - All functionality migrated to `io/yaml.js` in Phase 3
  - Legacy aliases maintained for backwards compatibility

#### Documentation Updates

- **Updated `src/__tests__/unit/app/App-convertObjectToYAMLString.test.jsx`**
  - Changed file location reference from `src/utils/yamlExport.js` to `src/io/yaml.js`
  - Added refactoring history: Phase 1 → Phase 3 → M1
  - Clarified legacy alias `convertObjectToYAMLString` = `encodeYaml`

- **Updated `docs/TASKS.md`**
  - Marked M1 first task as complete
  - Added detail breakdown of YAML utilities and test coverage

- **Updated `docs/SCRATCHPAD.md`**
  - Changed session status to M1
  - Added completed work summary
  - Documented next steps for M1

### Test Results

- **Total Tests:** 2149 passing (up from 2126, +23 new tests)
- **Test Files:** 109 passing
- **New Tests:** 23 (all for `decodeYaml()`)
- **Coverage:** All YAML I/O functions now have comprehensive test coverage

### Existing YAML Test Coverage

- `encodeYaml()` - 8 tests in `App-convertObjectToYAMLString.test.jsx`
- `formatDeterministicFilename()` - 12 tests in `yaml-formatDeterministicFilename.test.js`
- `downloadYamlFile()` - 7 tests in `yaml-memory-leak.test.js`
- `decodeYaml()` - 23 tests in `yaml-decodeYaml.test.js` (NEW)

### Files Changed

```
docs/REFACTOR_CHANGELOG.md                                      - M1 section added
docs/SCRATCHPAD.md                                              - M1 status updated
docs/TASKS.md                                                   - M1 first task marked complete
src/__tests__/unit/app/App-convertObjectToYAMLString.test.jsx  - Documentation updated
src/__tests__/unit/io/yaml-decodeYaml.test.js                  - 285 lines (new test file)
src/utils/yamlExport.js                                         - Deleted (deprecated)
```

### Breaking Changes

**None.** All changes are additive or cleanup:

- Test coverage additions are non-breaking
- Removed file was not imported anywhere
- All existing tests continue to pass

### Validation Utilities Audit

After completing YAML utilities, audited validation infrastructure:

**Findings:**
- Validation utilities already extracted to `src/validation/` module
- Pure utilities with no React dependencies (except UI components)
- Comprehensive test coverage: 189 tests across 6 test files
- Well-structured API: `validate()`, `validateField()`, `schemaValidation()`, `rulesValidation()`
- Uses AJV with `strict: false` (intentional - allows schema version metadata)

**Test Coverage:**
- `schemaValidation.test.js` - JSON schema validation
- `rulesValidation.test.js` - Business logic rules
- `integration.test.js` - End-to-end validation
- `quickChecks.test.js` - Fast validation checks
- `paths.test.js` - Path normalization utilities
- `useQuickChecks.test.js` - React hook tests

**Module Structure:**
```
src/validation/
├── index.js              - Unified API (validate, validateField)
├── schemaValidation.js   - AJV JSON schema validation
├── rulesValidation.js    - Custom business logic
├── paths.js              - Path normalization utilities
├── quickChecks.js        - Fast validation for UI
├── useQuickChecks.js     - React hook (UI-only)
└── HintDisplay.jsx       - React component (UI-only)
```

**Conclusion:** M1 second task already complete. No action needed.

### Regression Protocol Documentation

Added comprehensive regression prevention documentation to CLAUDE.md:

**Documentation Added:**
- Golden baseline test explanation (how they work, what they catch)
- Regeneration protocol (when/how to update golden fixtures)
- Test coverage summary (2149 tests across 109 files)
- CI/CD integration details
- Safety guidelines for preventing data corruption
- Golden fixture file descriptions (4 files: sample, minimal, realistic, probe-reconfig)

**Key Sections:**
1. How golden baseline tests work (read → parse → export → compare)
2. When golden baseline tests fail (investigation protocol)
3. When to regenerate fixtures (ONLY for intentional changes)
4. When NEVER to regenerate (convenience, ignorance)
5. Test coverage breakdown (YAML: 50, Validation: 189, Baselines: 18)

### M1 Status: COMPLETE ✅

**All 5 tasks complete:**

1. ✅ Extract YAML utilities - Already existed as `io/yaml.js` (50 tests)
2. ✅ Create schema validator - Already existed as `validation/` (189 tests)
3. ✅ Add shadow export test - Already existed as golden baselines (18 tests)
4. ✅ Integrate with Vitest - Already integrated in CI
5. ✅ Document regression protocol - Added to CLAUDE.md

**Total test coverage:** 2149 tests passing across 109 test files

**Files Changed in M1:**
```
CLAUDE.md                                                - Regression protocol added (158 lines)
docs/TASKS.md                                           - M1 marked complete
docs/SCRATCHPAD.md                                      - M1 summary added
docs/REFACTOR_CHANGELOG.md                              - M1 complete section
src/__tests__/unit/io/yaml-decodeYaml.test.js          - 285 lines (new, +23 tests)
src/__tests__/unit/app/App-convertObjectToYAMLString... - Documentation updated
src/utils/yamlExport.js                                 - Deleted (deprecated)
```

**Breaking Changes:** None

**Next Milestone:** M2 - UI Skeleton (Single-Page Compatible + A11y Baseline)

---

## M0.5 - Type System Strategy (October 27, 2025)

### Summary

Established JSDoc-first type system strategy with 70% coverage goal, deferring full TypeScript migration to Phase 2 (M13+). This provides incremental type safety without build system disruption.

### Changes

#### Documentation

- **Created `docs/types_migration.md`** - Comprehensive type system migration guide
  - Phase 1: JSDoc annotations with 70% coverage goal
  - Phase 2: Optional TypeScript migration after M7
  - Rationale for JSDoc-first approach (zero build config, incremental adoption)
  - Examples of JSDoc patterns (@param, @returns, @typedef)
  - Priority modules for type coverage
  - Decision log and Q&A section

#### Configuration

- **Created `jsconfig.json`** - JavaScript project configuration
  - Enabled path aliases: `@/*` � `src/*`
  - Set target to ES2020
  - Module resolution configured for node
  - `checkJs: false` initially (enable in Phase 2)

- **Updated `.eslintrc.js`** - Added JSDoc validation rules
  - Installed `eslint-plugin-jsdoc` v51.6.1
  - Added "jsdoc" plugin
  - Configured 8 JSDoc rules (warnings for new code):
    - `jsdoc/require-jsdoc` - Require JSDoc on exported functions
    - `jsdoc/require-param` - Require @param for function parameters
    - `jsdoc/require-param-type` - Require types in @param
    - `jsdoc/require-returns` - Require @returns for return values
    - `jsdoc/require-returns-type` - Require types in @returns
    - `jsdoc/check-types` - Validate type syntax
    - `jsdoc/check-param-names` - Verify parameter names match (error level)
    - `jsdoc/valid-types` - Ensure valid JSDoc type syntax (error level)

#### Testing

- **Created `src/__tests__/unit/docs/types_migration.test.js`** - 7 tests
  - Verifies types_migration.md exists and contains required sections
  - Validates Phase 1 and Phase 2 documentation
  - Checks for coverage goal, ESLint references, rationale, and examples

- **Created `src/__tests__/unit/eslint/jsdoc-config.test.js`** - 4 tests
  - Verifies eslint-plugin-jsdoc in devDependencies
  - Checks .eslintrc.js configuration
  - Validates jsconfig.json exists and has path aliases

#### Dependencies

- **Added to devDependencies:**
  - `eslint-plugin-jsdoc@^51.6.1` (includes 20 sub-packages)

#### Test Results

- **Total Tests:** 2126 passing (up from 2115)
- **New Tests:** 11 (7 documentation + 4 configuration)
- **Snapshots:** 1 updated (schema hash changed due to version field from M0)
- **Coverage:** All tests green 

### Decision Points

1. **Type Strategy:** Selected Option A (JSDoc) over Option B (immediate TypeScript)
   - **Rationale:** Zero build config, incremental adoption, reversibility, scientific infrastructure safety
   - **Coverage Goal:** 70% of exported functions
   - **Priority:** validation (100%), YAML export (100%), schema (100%), state (80%), UI components (50%)

2. **ESLint Rules:** Set to "warn" level for gradual adoption
   - **Rationale:** Allow existing code to remain unchanged while encouraging types in new code
   - **Phase 2:** Promote to "error" level after M7

3. **jsconfig.json:** Disabled `checkJs` initially
   - **Rationale:** Avoid overwhelming warnings from existing code
   - **Phase 2:** Enable after core modules have JSDoc coverage

### Files Changed

```
.eslintrc.js                                       - 13 lines added (JSDoc plugin + rules)
jsconfig.json                                      - 14 lines (new file)
package.json                                       - 1 dependency added
package-lock.json                                  - 20 packages added
docs/types_migration.md                            - 415 lines (new file)
docs/TASKS.md                                      - 6 tasks marked complete, DoD updated
docs/SCRATCHPAD.md                                 - M0.5 status added
src/__tests__/unit/docs/types_migration.test.js   - 48 lines (new test file)
src/__tests__/unit/eslint/jsdoc-config.test.js    - 34 lines (new test file)
src/__tests__/integration/schema-contracts.test.js - 1 snapshot updated
```

### Breaking Changes

**None.** All changes are additive and non-breaking:

- ESLint rules are warnings, not errors
- jsconfig.json is informational (no build impact)
- Existing code continues to work unchanged

### Next Steps (M1)

1. Extract `toYaml()` into `src/utils/yamlExport.js` with JSDoc
2. Create `src/utils/schemaValidator.js` with JSDoc
3. Add shadow export test for YAML parity
4. Begin applying JSDoc to validation utilities

### Notes

- **Schema Hash Mismatch:** Expected due to `version: "1.0.1"` field added in M0. Will sync with trodes_to_nwb in future release.
- **ESLint Warnings:** May see warnings when running `npm run lint` on new/modified code. This is intentional to encourage JSDoc adoption.
- **IDE Support:** VS Code and WebStorm will now provide type hints and autocomplete for JSDoc-annotated code.

---

## M0 - Repository Audit & Safety Setup (October 27, 2025)

### Summary

Completed repository audit, added feature flags, and implemented schema version validation. No behavior changes.

### Changes

#### Feature Flags

- Created `src/featureFlags.js` with 22 flags
- Added comprehensive test suite (41 tests passing)
- All new feature flags disabled by default
- Shadow export flags enabled (`shadowExportStrict`, `shadowExportLog`)

#### Schema Version Validation

- Added `version: "1.0.1"` to `src/nwb_schema.json`
- Created `scripts/check-schema-version.mjs` (260 lines)
- Integrated into CI via `.github/workflows/test.yml`
- Added npm script: `npm run check:schema`
- Configured AJV with `strict: false` to allow version metadata

#### Documentation

- Created `docs/TEST_INFRASTRUCTURE_AUDIT.md`
- Created `docs/CONTEXT_STORE_VERIFICATION.md`

### Test Results

- **Before M0:** 2074 tests passing
- **After M0:** 2115 tests passing (+41 from feature flags)

---
