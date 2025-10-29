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

### **M5 – Day Editor Stepper (Overview Step)** ✅

**Status:** COMPLETED (2025-10-28)

**Tasks**

* ✅ Add `DayEditorStepper.jsx` with step navigation (Overview, Devices, Epochs, Validation, Export).
* ✅ Implement `OverviewStep` form bound to `store`.
* ✅ Integrate field-level schema validation via `schemaValidator`.
* ✅ Display inline errors with ARIA live regions.
* ✅ Add accessibility tests for form focus and keyboard navigation.
* ✅ Add validation loading indicator for async validation.
* ✅ Fix PropTypes for type safety (detailed shape validation).
* ✅ Fix WCAG AA color contrast for warning text.
* ✅ Code review approved with P1 issues addressed.

**Acceptance (DoD)**

* ✅ Editing Overview updates store and shows inline validation.
* ✅ All a11y tests pass (WCAG 2.1 Level AA compliant).
* ✅ Export remains disabled until all steps valid.
* ✅ Auto-save on blur with field-level validation.
* ✅ Read-only fields properly indicate inherited values.
* ✅ Material Design styling with responsive layout.

**Artifacts**

* ✅ `src/pages/DayEditor/index.jsx` (37 lines)
* ✅ `src/pages/DayEditor/DayEditorStepper.jsx` (146 lines, container)
* ✅ `src/pages/DayEditor/OverviewStep.jsx` (234 lines, form component)
* ✅ `src/pages/DayEditor/StepNavigation.jsx` (135 lines, navigation)
* ✅ `src/pages/DayEditor/SaveIndicator.jsx` (48 lines, save status)
* ✅ `src/pages/DayEditor/ReadOnlyField.jsx` (42 lines, inherited fields)
* ✅ `src/pages/DayEditor/ErrorState.jsx` (25 lines, error display)
* ✅ `src/pages/DayEditor/validation.js` (150 lines, validation utilities)
* ✅ `src/pages/DayEditor/DayEditor.css` (407 lines, Material Design)
* ✅ `src/pages/DayEditor/DevicesStub.jsx` (stub for M6)
* ✅ `src/pages/DayEditor/EpochsStub.jsx` (stub for M7)
* ✅ `src/pages/DayEditor/ValidationStub.jsx` (stub for M9)
* ✅ `src/pages/DayEditor/ExportStub.jsx` (stub for M10)
* ✅ `src/hooks/useDayIdFromUrl.js` (30 lines, URL parsing hook)
* ✅ `src/hooks/__tests__/useDayIdFromUrl.test.js` (7 tests)
* ✅ `src/pages/DayEditor/__tests__/` (8 test files, 62 tests)

**Test Results:** 2339 tests passing (2281 from M4 + 58 new, 4 pre-existing integration test timeouts)

**Code Review:** Approved (A- grade) - All P1 issues addressed before commit

---

### **M5.5 – Animal Creation Form** ✅

**Status:** COMPLETE

**Tasks**

* [x] Create `AnimalCreationForm.jsx` with 8 required fields (TDD)
* [x] Implement controlled inputs with field-level validation
* [x] Add species dropdown with constrained vocabulary
* [x] Add dynamic experimenter list (add/remove buttons)
* [x] Add HTML5 date picker with future date constraint
* [x] Implement smart defaults from workspace settings/last animal
* [x] Add uniqueness validation for subject_id
* [x] Update Home page to use AnimalCreationForm
* [x] Add success navigation to AnimalWorkspace
* [x] Add first-time user welcome message with escape hatch
* [x] Create Home.css with Material Design patterns
* [x] Write 27 comprehensive tests (19 form + 8 container)
* [x] Verify WCAG 2.1 Level AA compliance
* [x] Request code review
* [x] Fix P0 issues (JSDoc syntax, CSS variables)

**Acceptance (DoD)**

* ✅ Users can create animals from Home page (#/home)
* ✅ Form validates all required fields with inline errors
* ✅ Submit disabled until all fields valid
* ✅ Unique subject_id enforced (checks existing animals)
* ✅ Date of birth cannot be in future
* ✅ At least one experimenter required
* ✅ Smart defaults populate from settings/last animal
* ✅ Species uses constrained dropdown (prevents DB pollution)
* ✅ After creation, navigates to AnimalWorkspace with animal selected
* ✅ First-time users see welcome message with documentation link
* ✅ All 27 tests passing (2370 total: 2343 existing + 27 new)
* ✅ WCAG 2.1 Level AA compliant
* ✅ Keyboard navigation works (Tab, Enter, Escape, Ctrl+Enter)
* ✅ Screen readers announce errors correctly
* ✅ Code review approved (all P0 issues fixed)

**Rationale**

**Critical Gap:** M4 (AnimalWorkspace) and M5 (Day Editor) assume animals already exist, but there's no UI to create them. Users are stuck using legacy form or browser console. This milestone fills that gap before M6.

**Design Philosophy:** Progressive disclosure - collect only what's known at "animal creation time" (subject info + experimenters), defer hardware configuration to Day Editor per session. Matches scientific workflow and reduces cognitive load.

**Artifacts**

* ✅ `docs/M5.5_DESIGN.md` (design document with review feedback, 1432 lines)
* ✅ `src/pages/Home/index.jsx` (updated - container component, 146 lines)
* ✅ `src/pages/Home/AnimalCreationForm.jsx` (new - form component, 560 lines)
* ✅ `src/pages/Home/Home.css` (new - styling, 234 lines)
* ✅ `src/pages/Home/__tests__/Home.test.jsx` (new - 8 tests, 198 lines)
* ✅ `src/pages/Home/__tests__/AnimalCreationForm.test.jsx` (new - 19 tests, 388 lines)
* ✅ `src/pages/DayEditor/DayEditor.css` (updated - added 4 CSS variables)

**Form Fields (8 total):**

1. Subject ID (text, unique, required)
2. Species (dropdown: Rat/Mouse/Marmoset/Macaque/Other, required)
3. Sex (radio: M/F/U/O, required)
4. Genotype (text, required)
5. Date of Birth (date picker, no future dates, required)
6. Experimenter Names (dynamic list, min 1, required)
7. Lab (text, pre-filled, required)
8. Institution (text, pre-filled, required)

**Test Results:** 2370 tests passed, 1 skipped (27 new tests added)

**Design Reviews:**

* Code Review: REQUEST_CHANGES → APPROVED (P0-1: JSDoc fixed, P0-2: CSS variables added)
* UI Review: NEEDS_POLISH → APPROVED (Material Design consistency, responsive)
* UX Review: NEEDS_POLISH → APPROVED (progressive disclosure, smart defaults)

**Actual Effort:** 12 hours (completed 2025-10-28)

---

### **M6 – Devices Step + Channel Map Editor** ✅ **COMPLETE**

**Tasks**

* [x] Add `DevicesStep` form (edit devices/electrode groups). ✅ Implemented with 32 tests
  * ✅ `DevicesStep.jsx` - Main container (334 lines)
  * ✅ `BadChannelsEditor.jsx` - Edit failed channels (180 lines)
  * ✅ `ReadOnlyDeviceInfo.jsx` - Display inherited device config (80 lines)
  * ✅ Accordion UI with status badges (All OK, N failed, All failed)
  * ✅ Integrated with DayEditorStepper
  * ✅ Material Design CSS styling (347 lines)
  * ✅ All 2440 tests passing (no regressions)
* [x] ~~Integrate `ChannelMapEditor` (grid UI, CSV import/export)~~. ✅ **OUT OF SCOPE**
  * Channel maps are animal-level configuration (not day-level)
  * Editing moved to legacy form (animal editor not yet in new UI)
* [x] Add duplicate/missing channel validation. ✅ **COMPLETE**
  * ✅ Rule 4: Duplicate channels (already existed)
  * ✅ Rule 5: Missing channels (NEW - 7 tests added)
  * ✅ All 44 validation tests passing
* [x] Extend validation framework. ✅ **COMPLETE**
  * ✅ Schema validation (AJV + JSON schema)
  * ✅ Business rules validation (5 rules enforced)
  * ✅ Cross-reference validation (cameras, tasks, optogenetics)

**Acceptance (DoD)**

* ✅ Devices edits persist and validate (bad_channels only).
* ✅ ~~Channel map round-trips via CSV~~. **OUT OF SCOPE** (animal-level editing)
* ✅ Validation summary displays accurate device-level issues.

**Artifacts**

* ✅ `src/pages/DayEditor/DevicesStep.jsx` (main component, 334 lines)
* ✅ `src/pages/DayEditor/BadChannelsEditor.jsx` (failed channels editor, 180 lines)
* ✅ `src/pages/DayEditor/ReadOnlyDeviceInfo.jsx` (read-only display, 80 lines)
* ✅ `src/pages/DayEditor/__tests__/DevicesStep.test.jsx` (15 tests)
* ✅ `src/pages/DayEditor/__tests__/BadChannelsEditor.test.jsx` (12 tests)
* ✅ `src/pages/DayEditor/__tests__/ReadOnlyDeviceInfo.test.jsx` (5 tests)
* ✅ `src/pages/DayEditor/DayEditor.css` (updated with 347 lines)
* ✅ `docs/M6_DEVICES_DESIGN.md` (design document with UX/UI review, 650 lines)
* ✅ `src/validation/rulesValidation.js` (added Rule 5, 152 lines added)
* ✅ `src/validation/__tests__/rulesValidation.test.js` (7 new Rule 5 tests)

**Code Review:** ✅ APPROVED (no P0 issues, P1 issues addressed)

**Actual Effort:** 8 hours (completed 2025-10-28)

---

### **M7 – Animal Editor (Electrode Groups & Device Configuration)** ✅

**Status:** COMPLETE (2025-10-29)

**Rationale**

Animal-level electrode group configuration is currently only accessible via the legacy form. This milestone brings electrode group editing into the modern UI, allowing users to configure device types, channel maps, and stereotaxic coordinates without leaving the new workflow.

**Critical Design Constraint:** This is **animal-level** configuration that applies to all days unless overridden. Changes here affect the baseline configuration inherited by all recording sessions.

**Tasks**

* [x] Create `AnimalEditor` page component with stepper navigation ✅
* [x] Implement `ElectrodeGroupsStep` with CRUD operations (add/edit/delete groups) ✅
* [x] Add device type selection dropdown (integrates with `deviceTypes.js`) ✅
* [x] Implement auto-generation of ntrode channel maps when device type selected ✅
* [x] Add `ChannelMapEditor` component for editing ntrode mappings ✅
  * [x] Grid UI showing logical channel → hardware channel mappings ✅
  * [x] CSV import/export for bulk editing ✅
  * [x] Validation for duplicate/missing channels ✅
* [x] Add stereotaxic coordinate inputs (AP, ML, DV) for each electrode group ✅
* [x] Implement brain region (location) field with autocomplete for consistency ✅
* [x] Add reference electrode configuration ✅
* [x] Create `useAnimalIdFromUrl` hook for routing ✅ (simplified - no dedicated editor hook needed)
* [x] Integrate validation framework (schema + rules validation) ✅
* [x] Add navigation from AnimalWorkspace sidebar to Animal Editor ✅
* [x] Update DevicesStep to link to new Animal Editor (replace legacy links) ✅
* [x] Write comprehensive test suite (target: 50+, actual: 114 tests) ✅
  * [x] CRUD operations for electrode groups ✅
  * [x] Device type selection and channel map generation ✅
  * [x] Channel map validation (duplicates, missing, sequential) ✅
  * [x] CSV import/export round-trip ✅
  * [x] Inherited data propagation to days ✅
* [x] Add accessibility tests (WCAG 2.1 Level AA) ✅
* [x] Request code review before completion ✅ (APPROVED with P1 fixes applied)
* [x] Update documentation (TASKS.md, SCRATCHPAD.md, CHANGELOG.md) ✅

**Acceptance (DoD)**

* ✅ Users can create/edit/delete electrode groups in new UI
* ✅ Device type selection auto-generates appropriate channel maps
* ✅ Channel maps editable via grid UI and CSV import/export
* ✅ All validation rules enforced (duplicates, gaps, required fields)
* ✅ Changes propagate to all days as inherited baseline
* ✅ Days can still override bad_channels at day-level (M6 DevicesStep)
* ✅ No regressions in existing tests (2681 passing, 1 skipped)
* ✅ All new tests passing (114 tests across 6 files)
* ✅ WCAG 2.1 Level AA compliant
* ✅ Code review approved (P1 issues fixed)

**Artifacts**

* ✅ `src/pages/AnimalEditor/index.jsx` - Main container (30 lines)
* ✅ `src/pages/AnimalEditor/AnimalEditorStepper.jsx` - Stepper navigation (475 lines)
* ✅ `src/pages/AnimalEditor/ElectrodeGroupsStep.jsx` - CRUD table interface (285 lines)
* ✅ `src/pages/AnimalEditor/ElectrodeGroupModal.jsx` - Add/edit form modal (530 lines)
* ✅ `src/pages/AnimalEditor/CopyFromAnimalDialog.jsx` - Template/copy dialog (185 lines)
* ✅ `src/pages/AnimalEditor/ChannelMapsStep.jsx` - Channel maps step (220 lines)
* ✅ `src/pages/AnimalEditor/ChannelMapEditor.jsx` - Grid UI editor (440 lines)
* ✅ `src/hooks/useAnimalIdFromUrl.js` - URL parsing hook (48 lines)
* ✅ `src/pages/AnimalEditor/__tests__/` - Test suite (114 tests across 6 files)
* ✅ Material Design CSS integrated into existing DayEditor.css
* ✅ CSV import/export utilities (csvChannelMapUtils.js)
* ✅ Channel map generation utilities (channelMapUtils.js)

**Integration Points:**

* **AnimalWorkspace:** Add "Edit Electrode Groups" button/link
* **DevicesStep:** Replace `#/legacy` links with `#/animal/:id/editor`
* **Store:** Animal electrode group changes update `animals` state
* **Validation:** Reuse existing schema + rules validation from M6

**Actual Effort:** ~32 hours (completed over multiple sessions)

**Test Results:** 2681 tests passing, 1 skipped (114 new M7 tests)

**Code Review:** APPROVED (all P1 issues fixed in commit c75290d)

---

### **M8 – Cameras, Hardware & Tasks** ⏳ NEXT

**Status:** PLANNED (Architecture approved by UX/UI review)

**Rationale:** Complete animal-level hardware configuration and add day-level task/epoch management. Implements "Animal = Template, Day = Instance" pattern where hardware is configured once at animal level and inherited by all days.

**Design Document:** `docs/plans/2025-10-29-m8-cameras-tasks-plan.md`

**Architecture:**

* **Animal Editor Step 3:** Cameras, Data Acquisition Device, Behavioral Events (M8a)
* **Day Editor Step 3:** Tasks & Epochs (M8b)

**Split into M8a and M8b for parallel development:**

#### **M8a – Animal Editor: Cameras, Hardware & Behavioral Events**

**Tasks**

* [ ] Create `HardwareConfigStep.jsx` (Animal Editor Step 3)
* [ ] Implement `CamerasSection.jsx` with CRUD table
  * [ ] Camera ID, name, manufacturer, model, lens, meters_per_pixel
  * [ ] CameraModal for add/edit operations
  * [ ] Validation: unique IDs, positive meters_per_pixel
* [ ] Implement `DataAcqSection.jsx`
  * [ ] System, amplifier, ADC circuit
  * [ ] Default header file path with file browser
  * [ ] Advanced settings (Ephys-to-Volt, Times Multiplier) - collapsible
* [ ] Implement `BehavioralEventsSection.jsx`
  * [ ] DIO event definitions (name, description)
  * [ ] Inline editing for simple fields
  * [ ] Validation: unique names, valid identifiers
* [ ] Apply UX/UI fixes from review:
  * [ ] Replace emoji with Material Symbols (accessibility)
  * [ ] Use elevation hierarchy (white bg for lists, gray for config)
  * [ ] Enforce 48px minimum touch targets
  * [ ] Add validation status column to tables
  * [ ] Implement mobile responsive (card layout < 600px)
* [ ] Write comprehensive tests (target: 55+ tests)
  * [ ] CameraModal: 10 tests (CRUD, validation)
  * [ ] CamerasSection: 12 tests (table, empty state)
  * [ ] DataAcqSection: 8 tests (form, collapsible)
  * [ ] BehavioralEventsSection: 10 tests (CRUD, validation)
  * [ ] HardwareConfigStep: 15 tests (integration, navigation)
* [ ] Integration with Animal Editor stepper
* [ ] Accessibility audit (WCAG 2.1 Level AA)
* [ ] Request code review

**Acceptance (DoD)**

* ✅ Users can configure cameras at animal level
* ✅ Data acquisition device configurable with advanced settings
* ✅ Behavioral events (DIO channels) manageable
* ✅ Material Symbols used (not emoji)
* ✅ WCAG AA compliant (4.5:1 contrast, 48px touch targets)
* ✅ Mobile responsive (< 600px card layout)
* ✅ 55+ new tests passing
* ✅ No regressions in existing 2681 tests
* ✅ Code review approved

**Artifacts**

* `src/pages/AnimalEditor/HardwareConfigStep.jsx`
* `src/pages/AnimalEditor/CamerasSection.jsx`
* `src/pages/AnimalEditor/CameraModal.jsx`
* `src/pages/AnimalEditor/DataAcqSection.jsx`
* `src/pages/AnimalEditor/BehavioralEventsSection.jsx`
* `src/pages/AnimalEditor/__tests__/` (5 test files, 55+ tests)

**Estimated Effort:** 26-34 hours (1-1.5 weeks)

---

#### **M8b – Day Editor: Tasks & Epochs**

**Tasks**

* [ ] Create `TasksEpochsStep.jsx` (Day Editor Step 3)
* [ ] Implement `TasksTable.jsx` with CRUD operations
  * [ ] Columns: Task name, cameras, epochs, actions
  * [ ] Add/Edit/Delete operations
  * [ ] Status badges for validation
* [ ] Implement `TaskModal.jsx` with accordion sections
  * [ ] Section 1: Task Details (name, description) - open by default
  * [ ] Section 2: Cameras (multi-select from animal.cameras)
  * [ ] Section 3: Behavioral Events (inherited display)
  * [ ] Section 4: Task Epochs (inline table editor) - open by default
* [ ] Implement `TaskEpochsEditor.jsx`
  * [ ] Dynamic table: epoch #, start time, end time, actions
  * [ ] Add/remove epoch rows
  * [ ] Validation: end_time > start_time
* [ ] Implement `BehavioralEventsDisplay.jsx`
  * [ ] Read-only display of inherited events from animal
  * [ ] Collapsible section for day-specific events (optional)
  * [ ] Lock icons for inherited items
* [ ] Apply UX/UI fixes:
  * [ ] Info banner (blue) for missing cameras - non-blocking
  * [ ] Accordion sections for progressive disclosure
  * [ ] "Inherited from Animal" labels with lock icons
  * [ ] Mobile responsive patterns
* [ ] Cross-reference validation:
  * [ ] Warn if task references non-existent camera
  * [ ] Validate epoch times (end > start)
  * [ ] Warn if no epochs defined for task
* [ ] Write comprehensive tests (target: 63+ tests)
  * [ ] TaskModal: 18 tests (accordions, validation)
  * [ ] TasksTable: 10 tests (CRUD, empty state)
  * [ ] TaskEpochsEditor: 12 tests (inline editing, validation)
  * [ ] BehavioralEventsDisplay: 8 tests (inherited, day-specific)
  * [ ] TasksEpochsStep: 15 tests (integration, warnings)
* [ ] Integration with Day Editor stepper
* [ ] Accessibility audit (WCAG 2.1 Level AA)
* [ ] Request code review

**Acceptance (DoD)**

* ✅ Users can add/edit/delete tasks in Day Editor
* ✅ Task epochs editor works with validation
* ✅ Inherited behavioral events displayed (read-only)
* ✅ Day-specific events can be added (optional)
* ✅ Camera references validated (warn if missing, non-blocking)
* ✅ Info banner for missing cameras (blue, not amber)
* ✅ TaskModal uses accordion pattern
* ✅ All validation rules enforced
* ✅ 63+ new tests passing
* ✅ No regressions
* ✅ Code review approved

**Artifacts**

* `src/pages/DayEditor/TasksEpochsStep.jsx`
* `src/pages/DayEditor/TasksTable.jsx`
* `src/pages/DayEditor/TaskModal.jsx`
* `src/pages/DayEditor/TaskEpochsEditor.jsx`
* `src/pages/DayEditor/BehavioralEventsDisplay.jsx`
* `src/pages/DayEditor/__tests__/` (5 test files, 63+ tests)

**Estimated Effort:** 20-28 hours (1 week)

---

**Combined M8 Acceptance:**

* ✅ Animal Editor has 3 steps (Electrode Groups, Channel Maps, Hardware)
* ✅ Day Editor has 3 steps (Overview, Devices, Tasks)
* ✅ Inheritance pattern works: day.tasks reference animal.cameras
* ✅ Behavioral events inherited from animal (with day override option)
* ✅ Total: 2799+ tests passing (2681 existing + 118 new)
* ✅ Golden baseline tests still passing
* ✅ WCAG 2.1 Level AA compliant
* ✅ Mobile responsive (< 600px breakpoint)
* ✅ UX/UI review feedback addressed
* ✅ Code reviews approved for both parts

**Total M8 Effort:** 46-62 hours (2-3 weeks with UX/UI polish)

**Test Results (Target):** 2799 tests passing (2681 existing + 55 M8a + 63 M8b)

---

### **M9 – Export Step + Continuous YAML Parity**

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

### **M10 – Validation Summary & Batch Tools**

**Tasks**

* [ ] Implement `ValidationSummary` overview for all days.
* [ ] Add "Validate All" and "Export Valid Only" actions.
* [ ] Integrate `useAutosave.js` to persist drafts in localStorage.
* [ ] Write integration test for autosave recovery.

**Acceptance (DoD)**

* Batch validation/export works.
* Autosave restores state on reload.
* All a11y tests pass.

---

### **M11 – Probe Reconfiguration Wizard**

**Tasks**

* [ ] Compare current vs. previous day device configurations.
* [ ] Display diff and offer "apply forward" to next sessions.
* [ ] Optionally update animal defaults snapshot.

**Acceptance (DoD)**

* Device structure diffs correctly detected and applied.
* Snapshot history updates.
* Tests simulate multi-day workflow.

---

### **M12 – Continuous Accessibility & Keyboard Shortcuts**

**Tasks**

* [ ] Add global keyboard shortcuts (Save, Next Step, Add Epoch).
* [ ] Verify ARIA coverage and tab order in all new components.
* [ ] Run automated Axe checks in CI.

**Acceptance (DoD)**

* All accessibility tests pass.
* Full workflow navigable via keyboard.

---

### **M13 – Feature Flag Cleanup & Legacy Removal**

**Tasks**

* [ ] Flip all feature flags on by default.
* [ ] Add "Use Legacy Editor" toggle for one release.
* [ ] Schedule PR14 for flag removal.
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
