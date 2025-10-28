# Milestones

### **M0 – Repository Audit & Safety Setup**

**Tasks**

* [x] Audit current test infrastructure (Vitest, baselines, integration tests). ✅ See [TEST_INFRASTRUCTURE_AUDIT.md](TEST_INFRASTRUCTURE_AUDIT.md)
* [x] Verify existing Context store (`StoreContext.js`, `store.js`) is intact and tested. ✅ See [CONTEXT_STORE_VERIFICATION.md](CONTEXT_STORE_VERIFICATION.md)
* [x] Add lightweight feature flag file `src/featureFlags.js` with all flags off. ✅ 41 tests passing
* [x] Replace schema hash plan with **schema version validation** script. ✅ Script created and tested
  * ✅ Added `version: "1.0.1"` to nwb_schema.json
  * ✅ Created scripts/check-schema-version.mjs with colored output
  * ✅ Added npm script `check:schema`
  * ✅ Configured AJV to allow version metadata field
* [x] Add schema version test to CI pipeline. ✅ Added to test.yml workflow

**Acceptance (DoD)**

* No app behavior changes.
* CI verifies schema version alignment.
* Tests and linter run green.

**Artifacts**

* `src/featureFlags.js`
* `scripts/check-schema-version.mjs`

---

### **M0.5 – Type System Strategy**

**Tasks**

* [x] Document type strategy in `docs/types_migration.md`. ✅
* [x] Choose between: ✅ **Option A selected: JSDoc with optional TypeScript in Phase 2**

  * **Option A:** Stay in JS with rich JSDoc typing. ✅ **SELECTED**
  * **Option B:** Adopt `ts-migrate` later once modularization stabilizes. ✅ **Deferred to M13+**
* [x] Define measurable type coverage goal (e.g., 70% function-level typing). ✅ **70% coverage goal documented**
* [x] Add type lint rules to CI (`eslint-plugin-jsdoc` or `typescript-eslint`). ✅ **eslint-plugin-jsdoc installed and configured**
* [x] Create `jsconfig.json` with path aliases. ✅ **Created with @/* path mapping**

**Acceptance (DoD)**

* ✅ Type direction agreed and documented.
* ✅ eslint-plugin-jsdoc installed (new dev dependency).
* ✅ PRs can use JSDoc for type hints immediately.
* ✅ All tests passing (2126 passing, 1 snapshot updated for schema hash)

---

### **M1 – Extract Pure Utilities & Add Shadow Export**

**Tasks**

* [x] Extract `toYaml()` into `src/utils/yamlExport.js`. ✅ Already exists as `io/yaml.js`
  * ✅ `encodeYaml()` - converts objects to YAML (8 existing tests)
  * ✅ `decodeYaml()` - parses YAML to objects (23 new tests added)
  * ✅ `formatDeterministicFilename()` - generates filenames (12 existing tests)
  * ✅ `downloadYamlFile()` - triggers browser download (7 existing tests)
  * ✅ Removed deprecated `src/utils/yamlExport.js`
* [x] Create `src/utils/schemaValidator.js` using AJV (strict mode). ✅ Already exists as `validation/` module
  * ✅ `schemaValidation()` - validates against JSON schema (189 tests across 6 test files)
  * ✅ `rulesValidation()` - validates business logic rules
  * ✅ `validate()` - unified validation combining schema + rules
  * ✅ `validateField()` - field-level validation
  * ✅ Pure utilities with comprehensive JSDoc
  * ℹ️ **Note:** Uses `strict: false` to allow version metadata field in schema
* [x] Add **shadow export test** to verify YAML parity. ✅ Already exists as golden baseline tests
  * ✅ 18 tests in `__tests__/baselines/golden-yaml.baseline.test.js`
  * ✅ Runs on 4 fixture YAMLs (sample, minimal, realistic, probe-reconfig)
  * ✅ Blocks merges if outputs differ (in CI pipeline)
  * ✅ Tests byte-for-byte equality, round-trip consistency, format stability
* [x] Integrate with Vitest baseline suite. ✅ Already integrated and running in CI
* [x] Document regression protocol in `CLAUDE.md`. ✅ Added comprehensive documentation
  * ✅ Golden baseline test explanation
  * ✅ Regeneration protocol
  * ✅ Test coverage summary (2149 tests)
  * ✅ CI/CD integration details

**Acceptance (DoD)**

* ✅ All YAML fixtures pass shadow export test.
* ✅ No UI changes.
* ✅ Utilities fully unit-tested.

**Artifacts**

* ✅ `src/io/yaml.js` (YAML utilities)
* ✅ `src/validation/` (Schema validator module)
* ✅ `src/__tests__/baselines/golden-yaml.baseline.test.js` (Shadow export tests)
* ✅ Updated `CLAUDE.md` with regression protocol

---

### **M2 – UI Skeleton (Single-Page Compatible + A11y Baseline)**

**Tasks**

* [x] Introduce `AppLayout` wrapper for new UI skeleton (no routing change). ✅ Implemented with 35 tests
* [x] Implement **conditional rendering** for sections: ✅ All views implemented as stubs

  * ✅ `Home` - stub with feature preview
  * ✅ `AnimalWorkspace` - stub with feature preview
  * ✅ `DayEditor` - stub with dayId param support
  * ✅ `ValidationSummary` - stub with feature preview
  * ✅ `LegacyFormView` - extracted original App.js form
* [x] Keep navigation **hash-based** (`#/workspace`, `#/day/:id`) to preserve bookmarks. ✅ useHashRouter hook implemented
* [x] Add global ARIA landmarks (`main`, `nav`, `region`). ✅ All views provide proper landmarks
* [x] Add initial `aria-landmarks.test.jsx` to CI pipeline. ✅ 10 tests passing

**Acceptance (DoD)**

* ✅ Legacy app still works - LegacyFormView renders at #/
* ✅ New sections load via hash changes - useHashRouter hook tested
* ✅ Axe accessibility tests pass - ARIA landmarks verified

**Artifacts**

* ✅ `src/layouts/AppLayout.jsx` - 179 lines, 35 tests
* ✅ `src/hooks/useHashRouter.js` - Hash-based routing hook
* ✅ `src/pages/Home/index.jsx` - 53 lines (stub)
* ✅ `src/pages/AnimalWorkspace/index.jsx` - 54 lines (stub)
* ✅ `src/pages/DayEditor/index.jsx` - 67 lines (stub with dayId)
* ✅ `src/pages/ValidationSummary/index.jsx` - 54 lines (stub)
* ✅ `src/pages/LegacyFormView.jsx` - 14,733 lines (extracted from App.js)
* ✅ `src/__tests__/integration/aria-landmarks.test.jsx` - 148 lines, 10 tests

---

### **M3 – Extend Existing Store (Context) for Animal & Day**

**Tasks**

* [x] Add animal/day abstractions to existing `store.js`: ✅ Implemented with 57 tests

  * ✅ `animals`, `days`, `settings` in workspace state
  * ✅ CRUD actions: createAnimal, updateAnimal, deleteAnimal, createDay, updateDay, deleteDay
  * ✅ Configuration history for probe version tracking (addConfigurationSnapshot)
  * ✅ Workspace settings (defaultLab, autoSaveInterval, shadowExportEnabled)
* [x] Maintain compatibility with existing form model. ✅ 100% backward compatible
  * ✅ Model structure: `{ ...formData, workspace }` - legacy fields still accessible
  * ✅ YAML export unchanged (workspace field NOT exported)
  * ✅ All 2149 pre-existing tests still passing
* [x] Write new reducer/unit tests in `tests/state/store_animal.test.jsx`. ✅ 57 tests across 3 files
  * ✅ `__tests__/unit/state/workspace-animal.test.js` (15 tests)
  * ✅ `__tests__/unit/state/workspace-day.test.js` (20 tests)
  * ✅ `__tests__/unit/state/workspace-merge.test.js` (22 tests)
* [x] Add `docs/animal_hierarchy.md` to define: ✅ Complete (495 lines)

  * ✅ In-memory data model (Animal, Day, ConfigurationSnapshot types)
  * ✅ localStorage autosave model (deferred to M4)
  * ✅ Mapping from day → YAML (mergeDayMetadata implementation)
  * ✅ Configuration versioning for probe changes over time

**Acceptance (DoD)**

* ✅ Store continues to power legacy UI (all 2277 tests passing).
* ✅ New animal/day layers tested and non-breaking (57 workspace tests).
* ✅ Golden baseline tests passing (YAML integrity preserved).
* ✅ Performance optimized (model memoization fixed 20 test regressions).

**Artifacts**

* ✅ Updated `src/state/store.js` (workspace state + actions)
* ✅ `src/state/workspaceTypes.js` (430 lines - JSDoc type definitions)
* ✅ `src/state/workspaceUtils.js` (172 lines - pure utility functions)
* ✅ `docs/animal_hierarchy.md` (495 lines - complete documentation)
* ✅ 57 workspace tests in `src/__tests__/unit/state/`

#### Code Review

* ✅ Approved by code-reviewer agent (4.8/5.0 rating)
* ✅ No critical issues identified
* ⚠️ Minor technical debt documented (formDataRef pattern - refactor tests in M4)

---

### **M4 – Animal Workspace MVP**

**Tasks**

* [x] Add `AnimalWorkspace` component to manage animals and days. ✅ Implemented with full UI (189 lines)
* [x] Implement "Add Recording Day" (clones defaults). ✅ Button creates days with auto-generated IDs
* [x] Render validation status chips per day. ✅ Draft/Validated/Exported status badges
* [x] Create stub for `BatchCreateDialog` (no logic yet). ✅ Alert message placeholder

**Acceptance (DoD)**

* ✅ Users can add and view days per animal.
* ✅ State persists correctly (uses store actions).
* ✅ Tests validate creation and rendering (4 tests).
* ✅ Code review approved (4.5/5.0 rating).

**Artifacts**

* ✅ `src/pages/AnimalWorkspace/index.jsx` (189 lines)
* ✅ `src/pages/AnimalWorkspace/AnimalWorkspace.css` (213 lines)
* ✅ `src/pages/AnimalWorkspace/__tests__/AnimalWorkspace.test.jsx` (72 lines, 4 tests)

**Test Results:** 2281 tests passing (2277 from M3 + 4 new)

---

### **M5 – Day Editor Stepper (Overview Step)**

**Tasks**

* [ ] Add `DayEditorStepper.jsx` with step navigation (Overview, Devices, Epochs, Validation, Export).
* [ ] Implement `OverviewStep` form bound to `store`.
* [ ] Integrate field-level schema validation via `schemaValidator`.
* [ ] Display inline errors with ARIA live regions.
* [ ] Add accessibility tests for form focus and keyboard navigation.

**Acceptance (DoD)**

* Editing Overview updates store and shows inline validation.
* All a11y tests pass.
* Export remains disabled.

**Artifacts**

* `src/pages/DayEditor/DayEditorStepper.jsx`, `OverviewStep.jsx`, tests.

---

### **M6 – Devices Step + Channel Map Editor**

**Tasks**

* [ ] Add `DevicesStep` form (edit devices/electrode groups).
* [ ] Integrate `ChannelMapEditor` (grid UI, CSV import/export).
* [ ] Add duplicate/missing channel validation.
* [ ] Extend `useValidation.js` to combine schema + logic + cross-reference checks.

**Acceptance (DoD)**

* Devices edits persist and validate.
* Channel map round-trips via CSV.
* Validation summary displays accurate device-level issues.

**Artifacts**

* `src/pages/DayEditor/DevicesStep.jsx`, `ChannelMapEditor.jsx`, tests.

---

### **M7 – Epochs/Tasks + Cross-Reference Validation**

**Tasks**

* [ ] Add `EpochsStep` CRUD table for behavioral tasks.
* [ ] Validate `end_time > start_time`.
* [ ] Cross-reference `camera_id` and `task_id` consistency.
* [ ] Show scroll-to-field for invalid references.

**Acceptance (DoD)**

* Invalid references clearly highlighted.
* YAML validation state updates live.
* No regressions in existing tests.

---

### **M8 – Export Step + Continuous YAML Parity**

**Tasks**

* [ ] Add `ExportStep` UI with filename template `YYYY-MM-DD_<animal>_metadata.yml`.
* [ ] Disable export until all validation passes.
* [ ] Run **shadow export comparison** before file download.
* [ ] Extend test suite to assert equality for all sample fixtures.

**Acceptance (DoD)**

* YAML parity confirmed in CI.
* Export safely blocked on validation errors.

**Artifacts**

* `src/pages/DayEditor/ExportStep.jsx`, tests.

---

### **M9 – Validation Summary & Batch Tools**

**Tasks**

* [ ] Implement `ValidationSummary` overview for all days.
* [ ] Add “Validate All” and “Export Valid Only” actions.
* [ ] Integrate `useAutosave.js` to persist drafts in localStorage.
* [ ] Write integration test for autosave recovery.

**Acceptance (DoD)**

* Batch validation/export works.
* Autosave restores state on reload.
* All a11y tests pass.

---

### **M10 – Probe Reconfiguration Wizard**

**Tasks**

* [ ] Compare current vs. previous day device configurations.
* [ ] Display diff and offer “apply forward” to next sessions.
* [ ] Optionally update animal defaults snapshot.

**Acceptance (DoD)**

* Device structure diffs correctly detected and applied.
* Snapshot history updates.
* Tests simulate multi-day workflow.

---

### **M11 – Continuous Accessibility & Keyboard Shortcuts**

**Tasks**

* [ ] Add global keyboard shortcuts (Save, Next Step, Add Epoch).
* [ ] Verify ARIA coverage and tab order in all new components.
* [ ] Run automated Axe checks in CI.

**Acceptance (DoD)**

* All accessibility tests pass.
* Full workflow navigable via keyboard.

---

### **M12 – Feature Flag Cleanup & Legacy Removal**

**Tasks**

* [ ] Flip all feature flags on by default.
* [ ] Add “Use Legacy Editor” toggle for one release.
* [ ] Schedule PR13 for flag removal.
* [ ] Tag release `v3.0.0` after parity confirmation.

**Acceptance (DoD)**

* New workflow is default.
* Legacy toggle functional and reversible.
* Shadow export still enforced for one additional release.

---

## Cross-Cutting & Continuous Tasks

* [ ] Maintain **schema version sync** with Python converter.
* [ ] Keep shadow export tests green across all milestones.
* [ ] Document validation rules in `docs/validation_pipeline.md`.
* [ ] Enforce a11y criteria in every PR.
* [ ] Tag releases after each milestone (v3.0.0-mX).
* [ ] Maintain rollback test in CI (revert + rebuild check).

---

## Definition of Done (Applies to All PRs)

* ✅ All tests (unit, integration, a11y) pass.
* ✅ YAML output identical to baseline.
* ✅ Schema version matches converter.
* ✅ Feature flags tested both ON and OFF.
* ✅ Documentation updated for new modules.
