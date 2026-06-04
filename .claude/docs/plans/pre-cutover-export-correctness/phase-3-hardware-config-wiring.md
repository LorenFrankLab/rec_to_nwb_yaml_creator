# Phase 3 — Hardware Config: wire cameras and route data-acq / technical to the export's source of truth

[← back to PLAN.md](PLAN.md) · [overview](overview.md) · [shared-contracts](shared-contracts.md#export-resolution-source-of-truth-contract)

Goal: make the Animal Editor's Hardware Config step actually persist what it appears to edit (Finding C):
camera add/edit/delete buttons currently do nothing, and data-acq / technical edits don't reliably land
where the export reads them. After this phase, cameras and `data_acq_device` configured in the UI appear
in the exported YAML.

**Inputs to read first:**

- [src/pages/AnimalEditor/HardwareConfigStep.jsx:1-120](../../../../src/pages/AnimalEditor/HardwareConfigStep.jsx)
  — renders `CamerasSection` (~`:82-86`) with no `onAdd`/`onEdit`/`onDelete`, and `DataAcqSection`; check
  how its `onFieldUpdate` routes (to `updateAnimal` vs `updateDay`).
- [src/pages/AnimalEditor/CamerasSection.jsx:56-90,160-190](../../../../src/pages/AnimalEditor/CamerasSection.jsx)
  — expects `onAdd`/`onEdit`/`onDelete`; buttons no-op without them.
- [src/pages/AnimalEditor/CameraModal.jsx](../../../../src/pages/AnimalEditor/CameraModal.jsx) — the
  existing add/edit camera modal (already on the shared `<Modal>`) to reuse, mirroring how the workspace
  Animal Editor adds cameras elsewhere.
- [src/pages/AnimalEditor/DataAcqSection.jsx:55-75](../../../../src/pages/AnimalEditor/DataAcqSection.jsx)
  — writes `data_acq_device` and `technical` via `onFieldUpdate`; confirm the keys vs. the export reads.
- [src/state/workspaceUtils.js:184-207](../../../../src/state/workspaceUtils.js) — export reads
  `animal.devices.data_acq_device` (`:185`) and `day.technical.*` (`:204-207`).
- [src/state/useWorkspace.js:183-220](../../../../src/state/useWorkspace.js) — `updateAnimal` (which
  `devices` keys it accepts) and `updateDay` (`technical`).

**Contracts referenced:**

- [Export-resolution source-of-truth contract](shared-contracts.md#export-resolution-source-of-truth-contract)
  — `data_acq_device` ← `animal.devices.data_acq_device`; `cameras` ← `animal.cameras`; `technical.*` is
  per-day.
- [Spyglass naming-identity contract](shared-contracts.md#spyglass-naming-identity-contract) —
  `camera_name` and `data_acq_device.name` are database identities; reuse-with-divergence is unsafe.
- [Parity, golden-fixture & round-trip contract](shared-contracts.md#parity-golden-fixture--round-trip-contract)
  — adding configured cameras/data-acq changes new-path output; update fixtures deliberately; legacy
  baselines stay; run the mandatory round-trip.

**Critical correction:** the Hardware Config writes are currently **total no-ops, not just mislocated.**
`updateAnimal` only applies the keys `subject | experimenters | devices | cameras | optogenetics`
(`useWorkspace.js:200-214`); the step's `onFieldUpdate('data_acq_device'|'technical'|'behavioral_events', …)`
matches **no branch and is silently dropped**. Task 0 fixes this before any wiring matters.

## Tasks

- **Task 0 — make `updateAnimal` actually persist these fields.** Extend `updateAnimal`
  (`useWorkspace.js:200-214`) so `data_acq_device`, `technical`, and `behavioral_events` updates are
  applied (or route them to the right slice: `data_acq_device` under `devices`, `behavioral_events` at
  animal level per the decided ownership, `technical` per-day via `updateDay`). Without this, every other
  task in this phase is a no-op. Add a test that each write reaches the model.
- **Task 1 — wire camera CRUD (required `lens`, identity-safe).** In `HardwareConfigStep`, manage camera
  add/edit/delete (open `CameraModal`, assign integer IDs, persist via `updateAnimal({ cameras })`) and pass
  `onAdd`/`onEdit`/`onDelete` to `CamerasSection`. **Make `CameraModal` require `lens`** (schema-required
  `nwb_schema.json:697`, omitted by `CameraModal.jsx:60`). **Enforce the Spyglass camera identity**
  (naming-identity contract): `camera_name` unique within the animal/session; warn if a user reuses an
  existing `camera_name` with different `meters_per_pixel`/`lens`/`model`/`manufacturer` (Spyglass keys
  `CameraDevice` on `camera_name` and rejects/diverges on calibration drift) — a changed calibration needs
  a new name. Keep integer `id` (trodes_to_nwb derives the numeric join from `camera_device {id}`).
- **Task 2 — route data-acq to `animal.devices.data_acq_device` AS AN ARRAY.** The schema is an
  **array** of `{name, system, amplifier, adc_circuit}` items (`nwb_schema.json:504`, all required), and
  the export reads `animal.devices.data_acq_device` (`workspaceUtils.js:185`). `DataAcqSection` currently
  edits a **single object** at `animal.data_acq_device` and **omits `name`** (`DataAcqSection.jsx:9,28`).
  Fix all three: (a) edit an array item (a single device is fine, but stored/exported as a one-element
  array), (b) collect the required `name`, (c) write to `animal.devices.data_acq_device` via
  `updateAnimal({ devices: { ...animal.devices, data_acq_device: [item] } })` — not a top-level field.
  **Spyglass identity:** `data_acq_device[].name` keys `DataAcquisitionDevice`; the same `name` with
  different `system`/`amplifier`/`adc_circuit` triggers a divergence check — keep `name` unique and
  stable for a given technical config.
- **Task 2b — behavioral-events ownership.** Per the decided ownership (animal-level is editable reference;
  the day's `behavioral_events` is the exported source), make the Animal Editor's `behavioral_events`
  actually persist (Task 0 enables this) **or** remove animal-level editing. The export keeps reading
  `day.behavioral_events`. Whichever, the editor and the export must agree (no write that never reaches
  the model).
- **Task 3 — technical fields per-day with animal defaults (Q3 decided).** Move
  `default_header_file_path`, `raw_data_to_volts`, `times_period_multiplier`, `units` out of the
  animal-level Hardware Config step and edit them **per-day in the Day Editor** (where `day.technical`
  lives and the export reads). `createDay` seeds `raw_data_to_volts` / `times_period_multiplier` from
  animal-level defaults (the rig is constant per animal; per-day override allowed);
  `default_header_file_path` is per-day. Hardware Config then owns only animal-level `data_acq_device`.
  No field may be edited at one level but read at another.
- **Task 4 — fixtures + docs.** Update the new-path parity fixtures so a configured session's export
  includes the cameras (with `lens`) and the data-acq **array**; review the byte diff. Update
  `docs/REFACTOR_CHANGELOG.md`.

## Deliberately not in this phase

- **Probe / ntrode resolution** — phase 2.
- **Integer-ID / required-field schema fixes** — phase 4 (cameras already use integer IDs; electrode
  devices are phase 4).
- **New camera-reference validation** (dangling `camera_id`) — phase 6.

## Validation slice

| Test | Asserts |
| --- | --- |
| `updateAnimal persists data_acq_device / technical / behavioral_events` *(unit)* | each field written via the Hardware Config `onFieldUpdate` actually reaches the model (regression for the silent no-op). |
| `Hardware Config add camera persists with required lens` *(integration)* | Add → save a camera (incl. `lens`) calls `updateAnimal`; it appears in `animal.cameras` and `mergeDayMetadata(...).cameras`; saving without `lens` is blocked by the modal. |
| `reusing a camera_name with different calibration warns` *(integration)* | editing/adding a camera that reuses an existing `camera_name` with a different `meters_per_pixel`/`lens`/`model` surfaces a warning (Spyglass identity); a new name does not. |
| `Hardware Config edit/delete camera persists` *(integration)* | edit changes the camera; delete removes it; both reflected in the merged export. |
| `data-acq writes the schema array shape with name` *(integration)* | editing system/amplifier/adc_circuit/name writes `animal.devices.data_acq_device` as a one-element array `[{name, system, amplifier, adc_circuit}]`; `mergeDayMetadata(...).data_acq_device` is that array; `schemaValidation` raises no data-acq error. |
| `technical fields edited per-day with animal defaults` *(integration)* | a new day inherits `raw_data_to_volts` / `times_period_multiplier` from animal defaults; editing them in the Day Editor updates `day.technical` and the export; the animal Hardware Config no longer edits them. |
| `golden-yaml.baseline.test.js` (existing) | byte-identical — legacy fixtures unchanged. |

All Vitest; camera CRUD tests are integration (render `HardwareConfigStep` + modal).

## Fixtures

`makeConfiguredWorkspace()` for a populated animal; the `CameraModal` and existing camera fixtures for
add/edit/delete; new-path parity fixtures updated per the parity contract.

## Review

`pr-review-toolkit:code-reviewer`; `ux-reviewer` (the camera CRUD is user-facing — confirm the buttons
now work, give feedback, and don't dead-end). Confirm: no field is written at one level but read at
another; dead placeholder handlers removed; fixtures' byte diff intentional; legacy baselines unchanged;
no plan/phase strings in code or test names.
