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

**Designs referenced:** [Channel-map semantics](designs.md#channel-map-semantics) — keys are local
(`0…count-1`), **values are global hardware channels** (do not bound them by device count); `bad_channels`
are local indices (boundable).

## Tasks

- **Task 1 — dangling camera references (array vs scalar).** Add a rule: every value in each
  `tasks[].camera_id` **array** and each scalar `associated_video_files[].camera_id` references an
  existing `cameras[].id`. Build the valid-id set from `model.cameras`. Handle the **cardinality
  difference** — video `camera_id` is a single integer, not an array (the existing Rule 2's
  `Array.isArray` check is wrong for it). Error severity.
- **Task 2 — dangling electrode-group references.** Add a rule: every
  `ntrode_electrode_group_channel_map[].electrode_group_id` references an existing `electrode_groups[].id`.
  Error severity.
- **Task 3 — channel bounds (per [channel-map semantics](designs.md#channel-map-semantics)).** Add a
  rule: for each ntrode, every `bad_channels` index is in `[0, getChannelCount(device_type))` (these are
  **local** indices), and the `map` **keys** form the expected local set `0…count-1`. Look up the ntrode's
  group via `electrode_group_id` for `device_type`. **Do NOT** bound the `map` **values** by device count —
  they are global hardware channels (`4,5,6,7` for a second tetrode is valid); a "value in deviceTypeMap"
  rule would flag checked-in valid fixtures. At most assert map values are non-negative integers (the
  existing within-ntrode uniqueness rule stays). Error severity.
- **Task 4 — non-empty, consistent `location` (Spyglass).** Add a rule: every `electrode_groups[].location`
  is a non-empty, non-whitespace string (error severity — a NULL/empty location breaks Spyglass spatial
  queries). Optionally flag inconsistent capitalization of the same region across groups (e.g. `CA1` vs
  `ca1`) as a **warning** (Spyglass auto-creates `BrainRegion` rows and would fragment). See the downstream
  note in [shared-contracts.md](shared-contracts.md).
- **Task 5 — honor `issue.step` in routing.** `groupErrorsByStep` (`validation.js:198-229`) currently
  ignores any `step` a rule sets and path-routes (sending `camera` paths to `devices` before `task`). Make
  it prefer an explicit `issue.step` when present, falling back to path routing — then set `step` on the
  new rules (`devices` for ntrode/group/location, `epochs` for task camera refs, etc.) so they surface on
  the right step. Add routing tests; keep messages actionable (which id/index, the valid range).
- **Task 6 — docs.** Note the new rules in `docs/REFACTOR_CHANGELOG.md`.

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
| `valid global hardware map values do NOT error` *(unit)* | a second `tetrode_12.5` ntrode with `map {0:4,1:5,2:6,3:7}` (global hardware channels) yields **no** channel-bound error — guards against the wrong rule. |
| `out-of-range bad_channels index is an error` *(unit)* | `bad_channels:[99]` on a 4-channel ntrode errors; `[2]` passes; wrong map-key set (e.g. missing key `1`) errors. |
| `empty electrode-group location is an error` *(unit)* | `location: ''` (or whitespace) errors; a non-empty location passes; mixed-case duplicates warn. |
| `rule issues route to the intended step` *(unit)* | a rule that sets `step:'devices'` lands in the devices bucket via `groupErrorsByStep`, overriding path routing. |
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
