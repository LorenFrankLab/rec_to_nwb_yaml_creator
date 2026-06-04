# Phase 6 — Validation completeness: cross-reference and channel-bound rules

[← back to PLAN.md](PLAN.md) · [overview](overview.md) · [shared-contracts](shared-contracts.md#validation--export-gate-contract)

Goal: catch the invalid-but-schema-passing states a scientist can realistically create (Finding F):
dangling camera / electrode-group references, and out-of-range ntrode `map` channels and `bad_channels`.
With phase 1's fail-closed gate, these new **error**-severity rules then block export of the affected day.

**Inputs to read first:**

- [src/validation/rulesValidation.js:30-150](../../../../src/validation/rulesValidation.js) — existing
  rules: camera-presence (`:36-66`; note Rule 2 wrongly assumes `associated_video_files[].camera_id` is
  an array), opto all-or-nothing (`:69-86`), channel-value uniqueness (`:91-117`), logical-channel
  sequentiality (`:122-148`). New rules append here, same issue shape.
- [src/validation/index.js:27](../../../../src/validation/index.js) — `validate(model)`; the model the
  rules see (cameras, tasks, associated_video_files, electrode_groups, ntrode map).
- [src/pages/DayEditor/validation.js:198-229](../../../../src/pages/DayEditor/validation.js) —
  `groupErrorsByStep`: **path-routes** errors and ignores any `issue.step` the rule sets, and routes
  `camera` paths to `devices` before `task` — relevant to Task 5.
- [src/utils/deviceTypeUtils.js:43-45](../../../../src/utils/deviceTypeUtils.js) —
  `getChannelCount(deviceType)`. [src/ntrode/deviceTypes.js:7-82](../../../../src/ntrode/deviceTypes.js) —
  `deviceTypeMap(deviceType)`.
- [src/nwb_schema.json:888](../../../../src/nwb_schema.json) — `associated_video_files[].camera_id` is a
  **scalar integer** (task `camera_id` is an array). [:993](../../../../src/nwb_schema.json) — integer
  electrode `id`. The schema constrains neither references nor channel bounds, so these must be rules.

**Contracts referenced:**

- [Validation & export-gate contract](shared-contracts.md#validation--export-gate-contract) — new rules
  are **error** severity only where they yield invalid/ambiguous YAML; they flow through `validate` →
  `computeStepStatus.export` → the phase-1 gate.
- [UX mistake-prevention contract](shared-contracts.md#ux-mistake-prevention-contract) — new rules must
  include repair targets/action labels so blocked export guides the user back to the bad field/workflow.

**Designs referenced:** [Channel-map semantics](designs.md#channel-map-semantics) — keys are local
(`0…count-1`), values are probe-electrode IDs bounded by device/group, and `bad_channels` are probe-local
indices. The earlier global-hardware-channel framing is obsolete.

## Tasks

- **Task 1 — dangling camera references (array vs scalar).** Add a rule: every value in each
  `tasks[].camera_id` **array** and each scalar `associated_video_files[].camera_id` references an
  existing `cameras[].id`. Build the valid-id set from `model.cameras`. Handle the **cardinality
  difference** — video `camera_id` is a single integer, not an array (the existing Rule 2's
  `Array.isArray` check is wrong for it). Error severity.
- **Task 2 — dangling electrode-group references.** Add a rule: every
  `ntrode_electrode_group_channel_map[].electrode_group_id` references an existing `electrode_groups[].id`.
  Error severity.
- **Task 3 — channel bounds (per [channel-map semantics](designs.md#channel-map-semantics)).** Map
  **values are probe electrode IDs**, reset per electrode **group** (a second tetrode is `0..3`, **not**
  `4..7`). Add rules (error severity), looking up `device_type` via the ntrode's group: (a) every map
  value is an integer in `[0, getChannelCount(device_type))`; (b) within an electrode **group**, the
  ntrodes' values **partition** `0 … getChannelCount-1` (unique + complete — catches the missing
  per-shank offset and cross-shank collisions); (c) map **keys** are `0 … (ntrode channel count − 1)`;
  (d) `bad_channels` indices are in `[0, getChannelCount(device_type))`. The earlier "values are global
  hardware, don't bound" framing was **wrong** (it would have passed the buggy `4..7` fixture); use the
  corrected rules here.
- **Task 4 — non-empty, consistent `location` and non-empty `targeted_location`.** Both
  `electrode_groups[].location` **and** `electrode_groups[].targeted_location` must be non-empty,
  non-whitespace (error severity). `targeted_location` is schema-required and `trodes_to_nwb` uses it as
  the per-electrode location, but current Spyglass common ingestion creates `BrainRegion` rows from
  `electrode_group.location` / `elect_data.group.location`; cite `location` as the Spyglass identity. Flag
  inconsistent capitalization of the same `location` across groups (e.g. `CA1` vs `ca1`) as a **warning**
  (region fragmentation). See the [Spyglass naming-identity contract](shared-contracts.md#spyglass-naming-identity-contract).
- **Task 5 — `device_type` is a known probe.** Add a rule: every `electrode_groups[].device_type` is in
  the supported set (the app's `deviceTypes()` ⊆ the 12 `trodes_to_nwb` `probe_metadata` `probe_type`
  files, exact + case-sensitive — an unknown one is a hard `FileNotFoundError` downstream). Guards
  copy/CSV-import-introduced values. Error severity.
- **Task 6 — behavioral-event name uniqueness.** Add a rule: `behavioral_events[].name` values are unique
  within the day (duplicate is a hard Spyglass `DIOEvents` PK violation and a trodes_to_nwb `ValueError`).
  Error severity.
- **Task 7 — task/video dependency + camera refs.** Add rules: task epochs are unique per day/session; each
  task with exported epochs has valid, non-empty `camera_id` values unless a no-camera task path has been
  proven by the Spyglass smoke; each non-empty `associated_video_files` entry has a `task_epochs` that
  matches some `tasks[].task_epochs` (Spyglass `VideoFile` depends on a successful `TaskEpoch`; orphaned
  videos silently don't import — `common_behav.py:451`, `common_task.py:240`) **and** a valid scalar
  `camera_id`. App validation cannot prove timestamp-overlap or interval-list fuzzy matching; the mandatory
  Spyglass smoke must assert expected `TaskEpoch`/`VideoFile` rows. Error severity for the app-checkable
  references/duplicates.
- **Task 8 — workspace/dataset identity consistency (Spyglass).** Add rules: a `camera_name` reused anywhere
  in the workspace/dataset has the same `meters_per_pixel`/`lens`/`model`/`manufacturer`/numeric `id`;
  `data_acq_device[].name` reused anywhere has the same `system`/`amplifier`/`adc_circuit`; `tasks[].task_name`
  is used consistently (no same `task_name` with different `task_description`). Error severity (these are
  PK/divergence hazards in Spyglass). The reuse-with-divergence *editing* guard is phase 3; these catch it
  in the exported file and across already-created workspace days/animals.
- **Task 9 — honor `issue.step` in routing.** `groupErrorsByStep` (`validation.js:198-229`) ignores any
  `step` a rule sets and path-routes (`camera` → `devices` before `task`). Make it prefer an explicit
  `issue.step`, falling back to path routing — then set `step` on the new rules so they surface on the
  right step. Add routing tests; keep messages actionable (which id/index, valid range).
- **Task 9b — add repair metadata to validation issues.** Extend the issue shape used by app rules with
  optional `path`/`field`, `step`, and `actionLabel` (and a focus id/path if the UI needs one). Each new
  rule in this phase should set enough metadata for Phase 1's Export/Validation repair actions to navigate
  and focus/highlight the offending camera, task, electrode group, ntrode map, video, or opto section.
- **Task 10 — docs.** Note the new rules in `docs/REFACTOR_CHANGELOG.md`.

## Deliberately not in this phase

- **The gate itself** — phase 1 already routes `validate` errors to the export gate; this phase only adds
  rules.
- **Schema/type validity of IDs** — phase 4. This phase assumes integer IDs and checks *references*, not
  types.
- **Auto-fixing** invalid references — validation reports; it does not mutate the model.

## Validation slice

| Test | Asserts |
| --- | --- |
| `dangling task camera_id (array) is an error` *(unit)* | a task with `camera_id:[99]` when cameras are `[{id:0}]` errors; a valid reference yields none. |
| `dangling video camera_id (scalar) is an error` *(unit)* | an `associated_video_files` item with scalar `camera_id: 99` errors; `camera_id: 0` passes. Proves the array-vs-scalar handling. |
| `dangling ntrode electrode_group_id is an error` *(unit)* | an ntrode `electrode_group_id` with no matching group errors. |
| `map values are bounded probe electrode IDs, reset per group` *(unit)* | a second `tetrode_12.5` group with `map {0:4,1:5,2:6,3:7}` **errors** (values must be `0..3`); `{0:0,1:1,2:2,3:3}` passes; a 4-shank probe whose shanks partition `0..127` passes, but two shanks sharing `0..31` (missing offset) errors. |
| `out-of-range bad_channels index is an error` *(unit)* | `bad_channels:[99]` on a 4-channel ntrode errors; `[2]` passes; wrong map-key set (missing key `1`) errors. |
| `empty location or targeted_location is an error` *(unit)* | `location: ''` or `targeted_location: ''` (or whitespace) errors; non-empty passes; mixed-case duplicate `location` values across groups warn. |
| `unknown device_type is an error` *(unit)* | a `device_type` not in the supported probe set errors; a known one passes. |
| `duplicate behavioral-event name is an error` *(unit)* | two `behavioral_events` with the same `name` error; unique names pass. |
| `task epochs are unique and camera-backed` *(unit)* | duplicate task epochs across task rows error; tasks with epochs and no valid camera ids error unless a tested no-camera path is explicitly allowed. |
| `orphaned associated_video_file is an error` *(unit)* | a video whose `task_epochs` matches no task errors; a video with a matching task + valid scalar `camera_id` passes. |
| `duplicate/divergent camera_name / data_acq name / task_name is an error` *(unit)* | reused `camera_name` with different calibration/id, reused `data_acq_device.name` with different dependent fields, and same `task_name` with differing description each error across the workspace/dataset. |
| `rule issues route to the intended step` *(unit)* | a rule that sets `step:'devices'` lands in the devices bucket via `groupErrorsByStep`, overriding path routing. |
| `rule issues include repair metadata` *(unit)* | each new error-severity rule emits `step`, an actionable `path`/field target when applicable, and a short `actionLabel` used by the export repair UI. |
| `new rules block export via the existing gate` *(integration)* | a day with a dangling reference has `computeStepStatus(...).export === 'error'` and cannot be exported (ties phase 1). |
| `golden-yaml.baseline.test.js` (existing) | byte-identical — validation-only changes, no output bytes change. |

All Vitest; the gate-integration test renders the export gate.

## Fixtures

Reuse `makeConfiguredWorkspace()` and mutate it per case (dangling id, out-of-range channel). No new
shapes. The `getChannelCount` / `deviceTypeMap` helpers supply the valid bounds.

## Review

`pr-review-toolkit:code-reviewer`; `pr-review-toolkit:pr-test-analyzer` (confirm each rule has both a
failing and a passing case, and the bounds come from the real device helpers, not hardcoded). Confirm:
severities match the contract (errors only where output would be invalid); messages are actionable and
step-routed; no plan/phase strings.
