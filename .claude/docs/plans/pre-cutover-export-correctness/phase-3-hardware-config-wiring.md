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
- [Parity & golden-fixture contract](shared-contracts.md#parity--golden-fixture-contract) — adding
  configured cameras/data-acq changes new-path output; update fixtures deliberately; legacy baselines stay.

## Tasks

- **Task 1 — wire camera CRUD (incl. required `lens`).** In `HardwareConfigStep`, manage camera
  add/edit/delete (open `CameraModal`, assign IDs, persist) and pass `onAdd`/`onEdit`/`onDelete` to
  `CamerasSection`. Persist through `updateAnimal({ cameras })`. **Make `CameraModal` require `lens`** —
  it is schema-required (`nwb_schema.json:697`) but the modal's validity check omits it
  (`CameraModal.jsx:60`), so a camera can currently be saved schema-invalid. Mirror the ID-assignment /
  save behavior already used to add cameras in the Animal workspace; remove dead/placeholder handlers.
- **Task 2 — route data-acq to `animal.devices.data_acq_device` AS AN ARRAY.** The schema is an
  **array** of `{name, system, amplifier, adc_circuit}` items (`nwb_schema.json:504`, all required), and
  the export reads `animal.devices.data_acq_device` (`workspaceUtils.js:185`). `DataAcqSection` currently
  edits a **single object** at `animal.data_acq_device` and **omits `name`** (`DataAcqSection.jsx:9,28`).
  Fix all three: (a) edit an array item (a single device is fine, but stored/exported as a one-element
  array), (b) collect the required `name`, (c) write to `animal.devices.data_acq_device` via
  `updateAnimal({ devices: { ...animal.devices, data_acq_device: [item] } })` — not a top-level field.
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
| `Hardware Config add camera persists with required lens` *(integration)* | Add → save a camera (incl. `lens`) calls `updateAnimal`; it appears in `animal.cameras` and `mergeDayMetadata(...).cameras`; saving without `lens` is blocked by the modal. |
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
