# TASKS.md

A milestone-based task plan for migrating the NWB Metadata Creator to the new architecture. Tasks are small, reviewable, and map 1:1 to PRs. Each milestone lists **Tasks**, **Acceptance (DoD)**, and **Artifacts**. Follow conventions in `CLAUDE.md` (small PRs, typed boundaries, feature flags, tests-first, parity checks).

---

## M0 — Repo Prep & Safety Rails (PR0)

**Tasks**

* [ ] Add feature flags: `src/featureFlags.ts` with `newNavigation`, `newDayEditor`, `channelMapEditor` default `false`.
* [ ] Add TypeScript baseline: `tsconfig.json` with `allowJs=true`, do not rename files yet.
* [ ] Install/verify test runner (Vitest/Jest) and YAML lib.
* [ ] Add YAML structural diff helper: `tests/helpers/yamlDiff.ts::yamlEqual()`.
* [ ] Add schema hash script `scripts/check-schema-hash.mjs` (warn-only in CI).
* [ ] Wire CI to run `lint`, `typecheck`, `test`, `check-schema-hash`.

**Acceptance (DoD)**

* Flags compile; app behavior unchanged with flags off.
* CI green on lint/type/tests; schema script runs and warns.

**Artifacts**

* `src/featureFlags.ts`, `tsconfig.json`, `scripts/check-schema-hash.mjs`, `tests/helpers/yamlDiff.ts`.

---

## M1 — Extract Pure Utilities (PR1)

**Tasks**

* [ ] Create `src/utils/yamlExport.ts::toYaml(obj)` (no aliases).
* [ ] Create `src/utils/schemaValidator.ts` using AJV (allErrors + strict).
* [ ] Add unit tests for valid/invalid fixtures.
* [ ] Create `src/utils/shadowExport.ts` to compare legacy YAML vs new.
* [ ] Refactor legacy exporter to call `toYaml` (no behavior changes).

**Acceptance (DoD)**

* Bit-for-bit YAML equality on sample fixtures.
* `validateSchema()` returns structured errors.
* Legacy UI still works.

**Artifacts**

* `src/utils/yamlExport.ts`, `src/utils/schemaValidator.ts`, `src/utils/shadowExport.ts`, tests.

---

## M2 — Router + Page Shells (Flagged) (PR2)

**Tasks**

* [ ] Add React Router and `src/AppRouter.tsx`.
* [ ] Route stubs: `AnimalWorkspace`, `DayEditor`, `ValidationSummary`.
* [ ] Entry point renders `<AppRouter/>`; when `FLAGS.newNavigation=false`, load legacy app.

**Acceptance (DoD)**

* Flags off → legacy UI unchanged.
* Flags on → new routes load stubs; no runtime errors.

**Artifacts**

* `src/AppRouter.tsx`, `src/pages/...` stubs.

---

## M3 — Central State Stores (PR3)

**Tasks**

* [ ] Zustand stores: `useAnimalStore.ts`, `useDayStore.ts`, `useDefaultsStore.ts` (types + reducers).
* [ ] Unit tests for reducers (upsert/patch/addDay/version snapshot).
* [ ] No UI wiring yet.

**Acceptance (DoD)**

* Stores compile and are tested; no UI change.

**Artifacts**

* `src/state/*`, tests.

---

## M4 — Animal Workspace MVP (Flagged) (PR4)

**Tasks**

* [ ] Implement `AnimalWorkspace`: list Day cards for selected animal.
* [ ] “Add Recording Day” → creates day with placeholder defaults.
* [ ] Skeleton `BatchCreateDialog` (UI only; no logic).
* [ ] Basic status chip (unknown/incomplete).

**Acceptance (DoD)**

* With flags on, can add a day; state updates.
* Unit/integration test: creation flows.

**Artifacts**

* `src/pages/AnimalWorkspace/*`, tests.

---

## M5 — Day Editor Stepper: Overview Step (PR5)

**Tasks**

* [ ] Implement `DayEditorStepper` with steps: Overview, Devices, Epochs, Validation, Export (only Overview enabled).
* [ ] `OverviewStep` form fields bound to `useDayStore`.
* [ ] Inline field-level schema validation (onChange debounce).
* [ ] `ValidationSummaryPanel` (inline) shows issues and “scroll-to-field”.

**Acceptance (DoD)**

* Editing Overview persists; schema errors render accessibly.
* Export disabled.

**Artifacts**

* `src/pages/DayEditor/DayEditorStepper.tsx`, `OverviewStep.tsx`, `ValidationSummaryPanel.tsx`, tests.

---

## M6 — Devices Step + Channel Map Editor (Flagged) (PR6)

**Tasks**

* [ ] Implement `DevicesStep` with device/group editing.
* [ ] Add minimal logical checks (duplicate channels, missing refs).
* [ ] `ChannelMapEditor` MVP (behind `FLAGS.channelMapEditor`): grid with CSV import/export.
* [ ] Hook validation orchestration: `src/components/validation/useValidation.ts` composing schema + logic + xref (stubs).

**Acceptance (DoD)**

* Devices edits persist; CSV round-trip works; issues appear in panel.

**Artifacts**

* `DevicesStep.tsx`, `ChannelMapEditor/*`, `useValidation.ts`, tests.

---

## M7 — Epochs/Tasks + Cross-Reference Checks (PR7)

**Tasks**

* [ ] `EpochsStep`: CRUD epochs with start/end; guard `end > start`.
* [ ] Task linkage and auto IDs.
* [ ] Cross-ref checks: `camera_id` exists; task indices valid.
* [ ] Validation panel links directly to offending fields.

**Acceptance (DoD)**

* Invalid references produce actionable errors and focus management.

**Artifacts**

* `EpochsStep.tsx`, updated `useValidation.ts`, tests.

---

## M8 — Export Step + Filename Enforcement + Shadow Export (PR8)

**Tasks**

* [ ] `ExportStep` with generated filename template `YYYY-MM-DD_<animal>_metadata.yml` (tokenized).
* [ ] Export unlocks only when no **error** issues across schema/logic/xref/naming/devices.
* [ ] Shadow export compare vs legacy; configurable block on mismatch.
* [ ] Tests: export 3–5 real fixtures; assert equality.

**Acceptance (DoD)**

* Export produces identical YAML on fixtures.
* Mismatch surfaces diff and blocks (while enabled).

**Artifacts**

* `ExportStep.tsx`, tests, fixture YAMLs.

---

## M9 — Validation Summary Page + Batch Ops + Autosave (PR9)

**Tasks**

* [ ] `ValidationSummary` page: table with status chips and reasons.
* [ ] “Validate All” runs pipeline for all days; store results.
* [ ] “Export Valid” exports only valid days; summarize skipped.
* [ ] `useAutosave.ts`: periodic save/restore from localStorage.

**Acceptance (DoD)**

* Batch validate/export works; autosave restores drafts after reload.

**Artifacts**

* `src/pages/ValidationSummary/*`, `src/hooks/useAutosave.ts`, tests.

---

## M10 — Probe Reconfiguration Wizard (PR10)

**Tasks**

* [ ] Diff current vs previous day device/electrode structure.
* [ ] Wizard UI: show diff; apply forward to subsequent new days.
* [ ] Optionally update defaults snapshot; record version history.
* [ ] Tests for change detection and forward-apply.

**Acceptance (DoD)**

* Structural changes trigger wizard; applying updates future-day defaults.

**Artifacts**

* `ProbeReconfigWizard/*`, tests.

---

## M11 — Accessibility & Keyboarding Pass (PR11)

**Tasks**

* [ ] Add ARIA roles, labels, and live regions for validation.
* [ ] Visible focus, skip links, reduced-motion support.
* [ ] Keyboard shortcuts: save (Ctrl/Cmd+S), add epoch (A), next/prev step.
* [ ] Automated a11y checks (axe) in CI.

**Acceptance (DoD)**

* Axe checks pass; full keyboard workflow viable.

**Artifacts**

* A11y utilities, CI step, documentation.

---

## M12 — Flip Feature Flags & Legacy Toggle (PR12)

**Tasks**

* [ ] Set `FLAGS.newNavigation=true`, `FLAGS.newDayEditor=true`, `FLAGS.channelMapEditor=true`.
* [ ] Add temporary “Use legacy editor” toggle in Settings.
* [ ] Keep shadow export for one release; log but don’t block if desired.

**Acceptance (DoD)**

* New flow is default; no critical regressions.
* Telemetry/logs show parity on live usage samples.

**Artifacts**

* Flag change, settings toggle, release notes.

---

## Cross-Cutting Tasks (ongoing across milestones)

**Validation Pipeline**

* [ ] Implement `src/components/validation/pipeline.ts` combining:

  * schema (AJV)
  * logic (temporal ordering, duplicates)
  * cross-ref (IDs, indices)
  * naming (filename tokens)
  * devices (channel map integrity)
* [ ] Unified `Issue` type `{ path, severity, message, source }`.
* [ ] Tests for each rule; table-driven cases.

**Schema Sync & Governance**

* [ ] Versioned schema file in `src/assets/schema/`.
* [ ] CI job to diff schema version/hash (upgrade path doc).
* [ ] Release checklist includes schema sync with converter.

**Docs & DX**

* [ ] Update README: local run, Node version, flags, fixtures.
* [ ] `CONTRIBUTING.md`: PR size, tests required, flag policy, parity checks.
* [ ] Troubleshooting guide: common validation failures + examples.

**Security/Perf**

* [ ] Configure CSP; sanitize imported CSV/templates.
* [ ] Debounced validation; validate touched fields until submit.
* [ ] Lazy-load heavy editors/wizards.

---

## Rollback & Parity Strategy

**Per-PR Rollback**

* [ ] Each PR is revertible without cascading changes.
* [ ] Keep legacy exporter callable until M12+1 release.

**Parity**

* [ ] Shadow export compare enabled from M8; stays for one release after M12.
* [ ] Golden fixtures maintained and auto-tested in CI.

---

## Milestone Review Gates (apply to each PR)

* [ ] Tests: unit + at least one integration (page or store).
* [ ] Parity: fixture YAML equality (from M1; enforced M8+).
* [ ] Flags: new features gated until M12.
* [ ] A11y: no new axe violations (from M11).
* [ ] CI: lint, typecheck, test, schema check all green.

---

## Suggested PR Sequence

M0 → M1 → M2 → M3 → M4 → M5 → M6 → M7 → M8 → M9 → M10 → M11 → M12

Keep PRs ≤ ~300 LOC net change where possible; prefer multiple tiny PRs over one large change.
