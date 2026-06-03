# Shared Contracts

[← back to PLAN.md](PLAN.md)

Cross-phase contracts. Each lives here once; phases link in by anchor. **Do not weaken** a contract
without updating this file and every phase that references it.

- [Workspace data model & store actions](#workspace-data-model--store-actions)
- [`mergeDayMetadata` contract](#mergedaymetadata-contract)
- [Validation & step-status contract](#validation--step-status-contract)
- [Persistence contract](#persistence-contract)
- [`<Modal>` primitive contract](#modal-primitive-contract)
- [YAML parity / shadow-export contract](#yaml-parity--shadow-export-contract)
- [Feature flags & routing contract](#feature-flags--routing-contract)

---

## Workspace data model & store actions

Referenced by phases 1, 4, 5, 7, 8.

The store (`src/state/store.js`, hook `useStore`) holds `model = { ...formData, workspace }`.
`formData` is the legacy flat form; `workspace` is the new model. **Never mix them**: new pages read
and write `workspace.*` only; legacy reads `formData.*` only. Types are JSDoc in
`src/state/workspaceTypes.js`.

```text
Workspace { version, lastModified, animals: Record<AnimalId, Animal>, days: Record<DayId, Day>, settings }
Animal    { id, subject, devices, cameras, experimenters, optogenetics?, behavioral_events,
            days: DayId[], created, lastModified, configurationHistory: ConfigurationSnapshot[] }
Day       { id, animalId, experimentDate, session, tasks, behavioral_events, associated_files,
            associated_video_files, technical, deviceOverrides?, configurationVersion,
            state: { draft, validated, exported } }   // typedef also declares optional exportedAt,
                                                       // but createDay does not set it — treat as absent
ConfigurationSnapshot { version, date, description, devices, appliedToDays: DayId[] }
```

Workspace mutations go **only** through these store actions (in `workspaceActions`, `src/state/store.js`):
`createAnimal(animalId, subject, metadata)`, `updateAnimal(animalId, updates)`,
`deleteAnimal(animalId)`, `addConfigurationSnapshot(animalId, config)`,
`createDay(animalId, date, session)`, `updateDay(dayId, updates)`, `deleteDay(dayId)`,
`updateWorkspaceSettings(settings)`. All use `setWorkspace(prev => …)` with `structuredClone` for
nested updates — **preserve this immutability discipline**. `createDay`/`createAnimal` throw on
duplicate id (callers must dedupe, not rely on a render-time snapshot).

**Invariant (do not weaken):** the epoch-cleanup effect that removes orphaned task→epoch references
must run for **both** legacy `formData.tasks` and workspace `days[].tasks` once multi-day tasks exist
(Phase 4 adds workspace tasks; Phase 6 owns the unified cleanup). Today it guards legacy only.

---

## `mergeDayMetadata` contract

Referenced by phases 1, 5, 7.

`mergeDayMetadata(animal, day)` (`src/state/workspaceUtils.js:34-100`) returns the **flat
metadata object** that maps 1:1 onto the legacy YAML schema — the single bridge from the workspace
model to YAML. It derives the configuration snapshot internally from `day.configurationVersion`
(falling back to the latest/first snapshot). Merge precedence: day `deviceOverrides` > configuration
snapshot > animal defaults;
day session weight overrides animal subject weight; optogenetics keys included only if
`animal.optogenetics` is present.

**Invariant (do not weaken):** the returned object MUST be safe to treat as owned data.
Today it assigns nested animal/config references directly (`:62-72`) — Phase 1 changes it to return a
`structuredClone`d (or deep-frozen) result so downstream mutation cannot corrupt animal/config state.
After Phase 1, callers may read freely; producers must not reintroduce shared references.

**Parity invariant:** `encodeYaml(mergeDayMetadata(animal, day))` must equal the legacy export byte-for-byte
for equivalent data. This is what the [shadow-export check](#yaml-parity--shadow-export-contract)
enforces.

---

## Validation & step-status contract

Referenced by phases 2, 4, 5, 7.

- `validate(model)` → `src/validation/index.js:27` returns an array of issues
  `{ severity:'error'|'warning'|'info', message, field?, step? }`, combining `schemaValidation(model)`
  (AJV / `nwb_schema.json`) and `rulesValidation(model)`. `validateField(model, fieldPath)` is the
  field-level entry. **Reuse these; do not fork validation logic into components.**
- `computeStepStatus(day, mergedDay)` → `src/pages/DayEditor/validation.js:52` returns
  `{ overview, devices, epochs, validation, export }`, each `'valid'|'incomplete'|'error'|'pending'`.
  Today `devices`/`epochs`/`validation` are **hardcoded `'incomplete'`** (`:60-62`). Phases wire them
  to real status: Phase 2 → `devices`, Phase 4 → `epochs`, Phase 5 → `validation`.
- `StepNavigation.isExportEnabled()` (`src/pages/DayEditor/StepNavigation.jsx:118-121`) requires every
  step `'valid'`. Do not loosen this gate; instead make each step report true status so Export becomes
  reachable only when the day is genuinely complete.
- **Severity policy (per original UX review, TASKS.md M8b):** data-entry steps are non-blocking —
  missing cameras / incomplete tasks surface as info/warning and still allow saving. **Only export**
  is hard-gated on zero `error`-severity issues. Epoch `end > start` is an error; overlapping epochs
  and empty-epoch tasks are warnings.

---

## Persistence contract

Referenced by phases 1, 7, 10. Established in Phase 1.

- Persist **only** `model.workspace` (animals + days + settings). **Never** persist legacy `formData`,
  and never persist anything that is itself YAML output.
- Key: `localStorage["rec_to_nwb_workspace_v1"]`. Stored shape: `{ schemaVersion: <int>, workspace }`.
- Gated by `featureFlags.localStoragePersistence` (`src/featureFlags.js:133`). Phase 1 flips it true;
  it remains the single switch (Phase 10 leaves it on).
- **Autosave:** debounced write (≈500 ms) after any `workspace` change; no write on legacy-only edits.
- **Load:** on store init, if the flag is on and a blob exists with a matching `schemaVersion`, hydrate
  `workspace`. On `schemaVersion` mismatch or parse error, **discard and start fresh with a
  user-visible notice** — never crash, never silently load a half-compatible shape.
- **SaveIndicator truth (do not weaken):** the indicator may show "Saved" **only** after a successful
  localStorage write. While the flag is off, it must not claim "Saved" — show "Not saved (in memory)"
  or hide. Setting `lastSaved` from a synchronous `setState` with a dead try/catch is prohibited
  (remove the false-success pattern in `DayEditorStepper.jsx:63-101`,
  `HardwareConfigStep.jsx:54-68`).
- A `beforeunload` handler warns when there is unsaved/in-flight work (debounce pending or flag off).

---

## `<Modal>` primitive contract

Referenced by phases 3, 4. Created in Phase 3.

A single shared component (`src/components/Modal/…`) owns dialog accessibility so individual modals
don't reimplement it:

- Renders `role="dialog"` `aria-modal="true"` with a labelled title; ESC closes; overlay click closes
  (configurable); body scroll locked while open.
- **Focus trap:** Tab/Shift-Tab cycle within the modal (port CameraModal's working implementation,
  `src/pages/AnimalEditor/CameraModal.jsx:163-176`).
- **Focus return:** on close, focus returns to the element that opened the modal.
- Initialization from props happens via a stable key (remount on open) — **not** an effect keyed on an
  unstable array prop, which resets forms mid-edit.

Phase 3 migrates `CameraModal` and `ElectrodeGroupModal` onto it (deleting their bespoke
ESC/scroll/trap code); Phase 4's `TaskModal` is built on it from the start.

---

## YAML parity / shadow-export contract

Referenced by phases 5, 7, 10. The project's hardest safety rule.

- The new export path produces YAML via `encodeYaml(mergeDayMetadata(animal, day))`
  (`src/io/yaml.js:37`), filename via `formatDeterministicFilename(model)` (`:107`), download via
  `downloadYamlFile(name, content)` (`:127`).
- The contract has **two distinct safeguards — keep them distinct:**
  - **Runtime pre-download gate (Phase 5):** before any download, recompute the YAML and verify the
    encoder is stable (does not mutate its input in place) and the output is schema-valid. This is an
    encoder-stability/schema check — it does **not** prove byte-for-byte parity with the legacy export
    path, because legacy `exportAll` (`src/features/importExport.js`) encodes a different,
    independently-built flat `formData` object. On failure: **block the download**, show a diff, log
    details. A `shadowExportStrict` flag (default true) gates only the debug override of this gate.
  - **Legacy-parity invariant (do not weaken):** byte-for-byte equality with the locked-in output is
    enforced by the golden round-trip tests — `src/__tests__/baselines/golden-yaml.baseline.test.js`
    (4 fixtures) and the phase-level parse-fixture → build-workspace →
    `encodeYaml(mergeDayMetadata(animal, day))` → assert-byte-identical tests — which MUST stay
    byte-identical in **every** phase, not just Phase 5. These golden tests are the parity proof; a
    parity change is a blocker requiring explicit fixture regeneration per CLAUDE.md's protocol — never
    regenerate to "make it pass."

---

## Feature flags & routing contract

Referenced by phases 1, 2, 10. `src/featureFlags.js`, `src/hooks/useHashRouter.js`,
`src/layouts/AppLayout.jsx`.

- Current flags, all `false`: `showLegacyToggle` (`:105`), `animalWorkspace` (`:121`),
  `localStoragePersistence` (`:133`), `newDayEditor` (`:149`).
- **Today routing does not gate on these flags** (new pages render via hash routes regardless).
  Phase 2 establishes the intended relationship: routes become flag-aware so a single flip controls
  exposure. Until Phase 10, default route stays `legacy`; new routes remain reachable for testing.
- **Phase 10 cutover (single switch):** flip `animalWorkspace`/`newDayEditor`/`localStoragePersistence`
  on, set default route to workspace home, expose `showLegacyToggle`, keep shadow-export strict for one
  release. `#/` bookmarks must still resolve (see overview Open Question 3).
- Unknown routes currently fall back to legacy with a console warning
  (`src/hooks/useHashRouter.js:99-101`); after cutover the fallback target follows the default route.
