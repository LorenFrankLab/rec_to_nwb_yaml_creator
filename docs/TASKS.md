# Milestones

### **M0 – Repository Audit & Safety Setup**

**Tasks**

* [ ] Audit current test infrastructure (Vitest, baselines, integration tests).
* [ ] Verify existing Context store (`StoreContext.js`, `store.js`) is intact and tested.
* [ ] Add lightweight feature flag file `src/featureFlags.js` with all flags off.
* [ ] Replace schema hash plan with **schema version validation** script:

  * Reads `$schemaVersion` from local schema JSON.
  * Confirms match against expected trodes_to_nwb version.
* [ ] Add schema version test to CI pipeline.

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

* [ ] Document type strategy in `docs/types_migration.md`.
* [ ] Choose between:

  * **Option A:** Stay in JS with rich JSDoc typing.
  * **Option B:** Adopt `ts-migrate` later once modularization stabilizes.
* [ ] Define measurable type coverage goal (e.g., 70% function-level typing).
* [ ] Add type lint rules to CI (`eslint-plugin-jsdoc` or `typescript-eslint`).

**Acceptance (DoD)**

* Type direction agreed and documented.
* No new build dependencies yet.
* PRs can use JSDoc for type hints immediately.

---

### **M1 – Extract Pure Utilities & Add Shadow Export**

**Tasks**

* [ ] Extract `toYaml()` into `src/utils/yamlExport.js`.
* [ ] Create `src/utils/schemaValidator.js` using AJV (strict mode).
* [ ] Add **shadow export test** to verify YAML parity between new and legacy code.

  * Runs on all fixture YAMLs.
  * Blocks merges if outputs differ.
* [ ] Integrate with Vitest baseline suite.
* [ ] Document regression protocol in `CLAUDE.md`.

**Acceptance (DoD)**

* All YAML fixtures pass shadow export test.
* No UI changes.
* Utilities fully unit-tested.

**Artifacts**

* `src/utils/yamlExport.js`
* `src/utils/schemaValidator.js`
* `tests/baseline/shadowExport.test.jsx`

---

### **M2 – UI Skeleton (Single-Page Compatible + A11y Baseline)**

**Tasks**

* [ ] Introduce `AppLayout` wrapper for new UI skeleton (no routing change).
* [ ] Implement **conditional rendering** for sections:

  * `Home`, `AnimalWorkspace`, `DayEditor`, `ValidationSummary`.
* [ ] Keep navigation **hash-based** (`#/workspace`, `#/day/:id`) to preserve bookmarks.
* [ ] Add global ARIA landmarks (`main`, `nav`, `region`).
* [ ] Add initial `aria-landmarks.test.jsx` to CI pipeline.

**Acceptance (DoD)**

* Legacy app still works.
* New sections load via hash changes.
* Axe accessibility tests pass.

**Artifacts**

* `src/layouts/AppLayout.jsx`
* `src/pages/AnimalWorkspace/index.jsx`
* `src/__tests__/integration/aria-landmarks.test.jsx`

---

### **M3 – Extend Existing Store (Context) for Animal & Day**

**Tasks**

* [ ] Add animal/day abstractions to existing `store.js`:

  * `animals`, `days`, `defaults`, `actions` for adding and cloning days.
* [ ] Maintain compatibility with existing form model.
* [ ] Write new reducer/unit tests in `tests/state/store_animal.test.jsx`.
* [ ] Add `docs/animal_hierarchy.md` to define:

  * In-memory data model
  * localStorage autosave model
  * Mapping from day → YAML

**Acceptance (DoD)**

* Store continues to power legacy UI.
* New animal/day layers tested and non-breaking.

**Artifacts**

* Updated `src/state/store.js`, `docs/animal_hierarchy.md`, tests.

---

### **M4 – Animal Workspace MVP**

**Tasks**

* [ ] Add `AnimalWorkspace` component to manage animals and days.
* [ ] Implement “Add Recording Day” (clones defaults).
* [ ] Render validation status chips per day.
* [ ] Create stub for `BatchCreateDialog` (no logic yet).

**Acceptance (DoD)**

* Users can add and view days per animal.
* State persists correctly.
* Tests validate creation and rendering.

**Artifacts**

* `src/pages/AnimalWorkspace/AnimalWorkspace.jsx`, tests.

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
