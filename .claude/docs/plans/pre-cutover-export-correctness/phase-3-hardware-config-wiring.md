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

- [User mental-model contract](shared-contracts.md#user-mental-model-contract) — cameras, data-acq hardware,
  and technical defaults should be framed as rig/session facts, with names treated as identities.
- [Export-resolution source-of-truth contract](shared-contracts.md#export-resolution-source-of-truth-contract)
  — `data_acq_device` ← `animal.devices.data_acq_device`; `cameras` ← `animal.cameras`; `technical.*` is
  per-day.
- [Spyglass naming-identity contract](shared-contracts.md#spyglass-naming-identity-contract) —
  `camera_name` and `data_acq_device.name` are database identities; reuse-with-divergence is unsafe.
- [UX mistake-prevention contract](shared-contracts.md#ux-mistake-prevention-contract) — identity drift gets
  a side-by-side comparison and safe primary action, not a passive warning.
- [Parity, golden-fixture & round-trip contract](shared-contracts.md#parity-golden-fixture--round-trip-contract)
  — adding configured cameras/data-acq changes new-path output; update fixtures deliberately; legacy
  baselines stay; run the mandatory round-trip.

**Critical correction:** the Hardware Config writes are currently **total no-ops, not just mislocated.**
`updateAnimal` only applies the keys `subject | experimenters | devices | cameras | optogenetics`
(`useWorkspace.js:200-214`); the step's `onFieldUpdate('data_acq_device'|'technical'|'behavioral_events', …)`
matches **no branch and is silently dropped**. Task 0 fixes this before any wiring matters.

## Tasks

- **Task 0 — make `updateAnimal` actually persist the animal-level fields.** Extend `updateAnimal`
  (`useWorkspace.js:200-214`) so `data_acq_device`, `technicalDefaults`, and `behavioral_events` updates are
  applied or routed to the right slice: `data_acq_device` under `devices`, `technicalDefaults` at
  `animal.technicalDefaults`, and `behavioral_events` at animal level per the decided ownership. Do **not**
  keep a top-level exported `animal.technical` field; exported technical values live on `day.technical` and
  are edited via `updateDay`. Without this routing, every other task in this phase is a no-op. Add a test
  that each write reaches the intended model location.
- **Task 1 — wire camera CRUD (required `lens`, identity-safe).** In `HardwareConfigStep`, manage camera
  add/edit/delete (open `CameraModal`, assign integer IDs, persist via `updateAnimal({ cameras })`) and pass
  `onAdd`/`onEdit`/`onDelete` to `CamerasSection`. **Make `CameraModal` require `lens`** (schema-required
  `nwb_schema.json:697`, omitted by `CameraModal.jsx:60`). **Enforce the Spyglass camera identity**
  (naming-identity contract): `camera_name` is a workspace/dataset identity; detect when a user reuses an
  existing `camera_name` anywhere in the workspace/dataset with different `meters_per_pixel`/`lens`/`model`
  /`manufacturer`/**or numeric `id`** (Spyglass keys `CameraDevice` on `camera_name` and checks those
  dependent fields) — a changed zoom/calibration/model/id needs a new name. The modal shows old vs. new
  values side by side and makes "Use a new camera name" the primary safe action. Saving a divergent reuse is
  blocked in the normal export path; an override would be a separate admin/import repair path, not this UI.
  Keep integer `id` (`trodes_to_nwb` derives the numeric join from `camera_device {id}`).
- **Task 2 — route data-acq to `animal.devices.data_acq_device` AS AN ARRAY.** The schema is an
  **array** of `{name, system, amplifier, adc_circuit}` items (`nwb_schema.json:504`, all required), and
  the export reads `animal.devices.data_acq_device` (`workspaceUtils.js:185`). `DataAcqSection` currently
  edits a **single object** at `animal.data_acq_device` and **omits `name`** (`DataAcqSection.jsx:9,28`).
  Fix all three: (a) edit an array item (a single device is fine, but stored/exported as a one-element
  array), (b) collect the required `name`, (c) write to `animal.devices.data_acq_device` via
  `updateAnimal({ devices: { ...animal.devices, data_acq_device: [item] } })` — not a top-level field.
  **Spyglass identity:** `data_acq_device[].name` keys `DataAcquisitionDevice`; the same `name` with
  different `system`/`amplifier`/`adc_circuit` triggers a divergence check — keep `name` unique and
  stable for a given technical config. Mirror the camera UX: show old vs. new dependent values and make a
  new data-acq name the primary safe action when dependent fields differ; block normal save of divergent
  reuse.
- **Task 2b — behavioral-events ownership.** Per the decided ownership (animal-level is editable reference;
  the day's `behavioral_events` is the exported source), make the Animal Editor's `behavioral_events`
  actually persist (Task 0 enables this) **or** remove animal-level editing. The export keeps reading
  `day.behavioral_events`. Whichever, the editor and the export must agree (no write that never reaches
  the model).
- **Task 3 — technical fields per-day with animal defaults (Q3 decided).** Add
  `animal.technicalDefaults = { raw_data_to_volts, times_period_multiplier }`, initialized from the current
  hardcoded defaults (`0.195`, `1.5`) or collected values. The Animal Editor may edit these **defaults**
  only; they are not exported directly. `createDay` copies them into `day.technical.raw_data_to_volts` and
  `day.technical.times_period_multiplier`. Move `default_header_file_path` and `units` to per-day editing in
  the Day Editor (where `day.technical` lives and the export reads). Fix the current key mismatch:
  `DataAcqSection` uses `ephys_to_volt_conversion`, but export reads `raw_data_to_volts`; standardize on
  `raw_data_to_volts`. No field may be edited at one level but read at another.
- **Task 4 — fixtures + docs.** Update the new-path parity fixtures so a configured session's export
  includes the cameras (with `lens`) and the data-acq **array**; review the byte diff. Run the mandatory
  downstream round-trip for the corrected configured-camera/data-acq sample. Update
  `docs/REFACTOR_CHANGELOG.md`.

## Deliberately not in this phase

- **Probe / ntrode resolution** — phase 2.
- **Integer-ID / required-field schema fixes** — phase 4 (cameras already use integer IDs; electrode
  devices are phase 4).
- **New camera-reference validation** (dangling `camera_id`) — phase 6.

## Validation slice

| Test | Asserts |
| --- | --- |
| `updateAnimal persists data_acq_device / technicalDefaults / behavioral_events` *(unit)* | each field written via the Hardware Config `onFieldUpdate` reaches the intended model location (regression for the silent no-op); no top-level exported `animal.technical` is created. |
| `Hardware Config add camera persists with required lens` *(integration)* | Add → save a camera (incl. `lens`) calls `updateAnimal`; it appears in `animal.cameras` and `mergeDayMetadata(...).cameras`; saving without `lens` is blocked by the modal. |
| `reusing a camera_name with different calibration/id is identity-safe` *(integration)* | editing/adding a camera that reuses an existing `camera_name` anywhere in the workspace with a different `meters_per_pixel`/`lens`/`model`/`manufacturer`/`id` shows old-vs-new comparison, blocks normal save, and offers a primary "new name" action; a new name does not warn. |
| `Hardware Config edit/delete camera persists` *(integration)* | edit changes the camera; delete removes it; both reflected in the merged export. |
| `data-acq writes the schema array shape with name` *(integration)* | editing system/amplifier/adc_circuit/name writes `animal.devices.data_acq_device` as a one-element array `[{name, system, amplifier, adc_circuit}]`; `mergeDayMetadata(...).data_acq_device` is that array; `schemaValidation` raises no data-acq error. |
| `reusing a data-acq name with different dependent fields is identity-safe` *(integration)* | divergent reuse shows old-vs-new system/amplifier/adc_circuit, blocks normal save, and offers a primary "new name" action; identical reuse is allowed. |
| `technical fields edited per-day with animal defaults` *(integration)* | a new day inherits `raw_data_to_volts` / `times_period_multiplier` from `animal.technicalDefaults`; editing the defaults affects newly created days only; editing a day updates `day.technical` and the export; `ephys_to_volt_conversion` no longer appears in workspace technical state. |
| `phase-3 configured-camera/data-acq sample passes downstream gates` *(integration, mandatory)* | a corrected sample with configured cameras (including `lens`) and `data_acq_device` array converts, has zero DANDI CRITICAL findings, `dandi validate` exits 0, and Spyglass smoke ingest has no `InsertError`. |
| `golden-yaml.baseline.test.js` (existing) | byte-identical — legacy fixtures unchanged. |

Automated app tests are Vitest; camera CRUD tests are integration (render `HardwareConfigStep` + modal).
The downstream round-trip is the external mandatory gate from the shared contract.

## Fixtures

`makeConfiguredWorkspace()` for a populated animal; the `CameraModal` and existing camera fixtures for
add/edit/delete plus divergent camera/data-acq identity reuse; new-path parity fixtures updated per the
parity contract.

## Review

`pr-review-toolkit:code-reviewer`; `ux-reviewer` (the camera CRUD is user-facing — confirm the buttons
now work, give feedback, and don't dead-end). Confirm: no field is written at one level but read at
another; divergent camera/data-acq identity reuse is blocked with a clear new-name path; dead placeholder
handlers removed; fixtures' byte diff intentional; legacy baselines unchanged; no plan/phase strings in code
or test names.
