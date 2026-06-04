# Phase 6 — Validation completeness: task/video reference UX, cross-reference, and channel-bound rules

[← back to PLAN.md](PLAN.md) · [overview](overview.md) · [shared-contracts](shared-contracts.md#validation--export-gate-contract)

Goal: prevent and catch the invalid-but-schema-passing states a scientist can realistically create
(Finding F): dangling task/video camera references, orphaned task/video epoch links, dangling
electrode-group references, and out-of-range ntrode `map` channels and `bad_channels`. With phase 1's
fail-closed gate, these new **error**-severity rules then block export of the affected day.

**Inputs to read first:**

- [src/validation/rulesValidation.js:30-150](../../../../src/validation/rulesValidation.js) — existing
  rules: camera-presence (`:36-66`; note Rule 2 wrongly assumes `associated_video_files[].camera_id` is
  an array), opto all-or-nothing (`:69-86`), channel-value uniqueness (`:91-117`), logical-channel
  sequentiality (`:122-148`). New rules append here, same issue shape.
- [src/validation/index.js:27](../../../../src/validation/index.js) — `validate(model)`; the model the
  rules see (cameras, tasks, associated_video_files, electrode_groups, ntrode map).
- [src/pages/DayEditor/validation.js:198-229](../../../../src/pages/DayEditor/validation.js) —
  `groupErrorsByStep`: **path-routes** errors and ignores any `issue.step` the rule sets, and routes
  `camera` paths to `devices` before `task` — relevant to Task 9.
- [src/pages/DayEditor/TasksEpochsStep.jsx](../../../../src/pages/DayEditor/TasksEpochsStep.jsx),
  [TaskModal.jsx](../../../../src/pages/DayEditor/TaskModal.jsx), and
  [TasksTable.jsx](../../../../src/pages/DayEditor/TasksTable.jsx) — existing workspace task UI. The modal
  currently treats missing camera references as non-blocking and only checks duplicate names within the day;
  it does not enforce workspace/dataset `task_name` description identity.
- [src/state/useWorkspace.js:479-483](../../../../src/state/useWorkspace.js) — workspace `updateDay` already
  accepts `associated_files` / `associated_video_files`, but the workspace Day Editor has no dedicated
  associated-video editing surface. Add or wire one here rather than relying on legacy-form UI.
- [src/state/useEpochCleanup.js](../../../../src/state/useEpochCleanup.js) — cleanup helpers for orphaned
  task-epoch references; reuse the logic, but surface impacted video/file references before destructive edits
  rather than silently leaving invalid links.
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

- **Task 0 — proactive task/video reference UX.** The workspace Day Editor must prevent the same mistakes
  this phase validates. Tighten `TaskModal` / `TasksEpochsStep` so camera references are selected from the
  current animal's cameras (labels include at least numeric id + `camera_name`; include calibration/lens where
  space allows) and dangling selected ids block normal save until removed or the camera is restored. Add/wire
  a workspace associated-files/video editor for `day.associated_video_files` (and `associated_files` if
  needed for parity) because `updateDay` already supports the state but no workspace surface owns it. Video
  `camera_id` is a scalar selected from existing cameras; video `task_epochs` is selected from the current
  task epoch set. No manual numeric entry for these references in the normal path.
- **Task 0b — task-name identity prevention.** `tasks[].task_name` is a Spyglass identity consistency hazard
  across the workspace/dataset, not just within one day. When the user saves a task whose `task_name` already
  exists with a different `task_description`, show the existing vs. proposed descriptions side by side and
  block normal save until the user either uses a new task name or matches the existing description. Same name
  + same description is allowed. This is the task analogue of phase 3's camera/data-acq identity guard.
- **Task 0c — repair-before-orphaning destructive edits.** When deleting a task epoch or removing a camera
  that is referenced by a task/video, show the affected tasks/videos and require the user to repair or confirm
  a deterministic cleanup. Do not silently leave dangling references; if cleanup is chosen, clear/update the
  affected fields through `updateDay` and leave the validation summary clean.
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
  PK/divergence hazards in Spyglass). The reuse-with-divergence *editing* guard is phase 3 for camera/data-acq
  and Task 0b here for task names; these rules catch invalid imported/existing state in the exported file and
  across already-created workspace days/animals.
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
- **Rule-level auto-fixing** invalid references — validation reports; it does not mutate the model. The
  user-facing repair flows in Tasks 0/0c may update state only after an explicit user action.

## Validation slice

| Test | Asserts |
| --- | --- |
| `task modal prevents dangling camera refs` *(integration)* | camera choices come from `animal.cameras`; an existing task with a missing camera id shows the missing id and blocks normal save until removed/restored; valid selected ids save as an integer array. |
| `associated videos use controlled camera/epoch refs` *(integration)* | the workspace video editor writes `day.associated_video_files`; video `camera_id` is a scalar selected from existing cameras and `task_epochs` is selected from current task epochs; stale/manual ids cannot be saved in the normal path. |
| `task_name reuse with different description is blocked at edit time` *(integration)* | saving a task with an existing workspace/dataset `task_name` and different `task_description` shows old-vs-new descriptions and blocks normal save until the name changes or the description matches. |
| `destructive task/camera edits cannot orphan videos silently` *(integration)* | deleting a referenced task epoch or camera shows affected task/video rows and either repairs them through explicit cleanup or cancels; no dangling reference is left without a visible validation error. |
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
| `golden-yaml.baseline.test.js` (existing) | byte-identical — validation/UI-only changes, no legacy output bytes change. |

All Vitest; UI tests render the Day Editor task/video surfaces and the gate-integration test renders the
export gate.

## Fixtures

Reuse `makeConfiguredWorkspace()` and mutate it per case (dangling id, out-of-range channel, stale
task/video refs, divergent task-name descriptions). No new output shapes. The `getChannelCount` /
`deviceTypeMap` helpers supply the valid bounds.

## Review

`pr-review-toolkit:code-reviewer`; `ux-reviewer`; `pr-review-toolkit:pr-test-analyzer` (confirm each rule
has both a failing and a passing case, and the bounds come from the real device helpers, not hardcoded).
Confirm: task/video reference mistakes are prevented in the editor where practical; severities match the
contract (errors only where output would be invalid); messages are actionable and step-routed; no plan/phase
strings.
