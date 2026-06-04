# Shared Contracts

[← back to PLAN.md](PLAN.md)

Cross-phase contracts. Each lives here once; phases link in by anchor. **Do not weaken** a contract
without updating this file and every phase that references it.

- [Export-resolution source-of-truth contract](#export-resolution-source-of-truth-contract)
- [Schema device-output contract](#schema-device-output-contract)
- [Validation & export-gate contract](#validation--export-gate-contract)
- [Parity & golden-fixture contract](#parity--golden-fixture-contract)

**Downstream:** the exported YAML feeds DANDI (public archive) and Spyglass
(`/Users/edeno/Documents/GitHub/spyglass`). Per CLAUDE.md, Spyglass requires non-empty, consistently
capitalized `electrode_groups[].location` (auto-creates `BrainRegion` rows), pre-registered
`device_type`s, and the ndx_franklab_novela columns (`bad_channel`, etc.). `trodes_to_nwb` validates
each session YAML against the **same `nwb_schema.json`** with `jsonschema.Draft202012Validator` and does
**only** schema checks — no cross-reference or channel-bound checks (verified in
`metadata_validation.py`). So the app is the sole place dangling references / out-of-range channels /
empty locations can be caught (phase 6).

---

## Export-resolution source-of-truth contract

Referenced by phases 2, 3. `mergeDayMetadata(animal, day)` (`src/state/workspaceUtils.js:154`) is the
single bridge from the workspace model to YAML. After this plan, each exported section has exactly one
defined source of truth:

| Exported key | Source of truth (after fixes) |
| --- | --- |
| `electrode_groups` | `day.deviceOverrides.electrode_groups` if present, else `configurationHistory[day.configurationVersion].devices.electrode_groups` (the pinned snapshot; `animal.devices` mirrors the *latest* snapshot — see model B). **Never** an empty initial snapshot when probes are configured. |
| `ntrode_electrode_group_channel_map` | same resolution as above, **with** `day.deviceOverrides.bad_channels.{ntrode_id}` applied onto each ntrode's `bad_channels` (phase 2). |
| `data_acq_device` | `animal.devices.data_acq_device` — an **array** of `{name, system, amplifier, adc_circuit}` items (schema `nwb_schema.json:504`, all four required). The Hardware Config step must write this array shape here (phase 3). |
| `cameras` | `animal.cameras` — each `{id, camera_name, manufacturer, model, lens, meters_per_pixel}` with `lens` **required** (schema `:697`). Hardware Config add/edit/delete writes here (phase 3). |
| `times_period_multiplier`, `raw_data_to_volts`, `default_header_file_path`, `units` | `day.technical.*` (per-day). **Decision (Q3):** these are per-day; `raw_data_to_volts` / `times_period_multiplier` are seeded from **animal-level defaults** at `createDay` and overridable per day; `default_header_file_path` is per-day. Edit them in the Day Editor, not the animal-level Hardware Config (phase 3). |

**Invariant (do not weaken):** `mergeDayMetadata` already deep-clones its output (v3 Phase 1) and emits
keys in legacy `formData` order for byte parity. Phases 2–3 change *which values* are emitted, not the
key order or the clone discipline. The byte-for-byte **legacy** parity guarantee (the 125 baselines)
is unaffected because those fixtures don't run the merge; the **new-path** parity fixtures are updated
deliberately (see parity contract).

The device-resolution rule (model B: snapshots are the source of truth, `animal.devices` mirrors the
latest, reconfiguration forks before editing) and the bad-channel merge are specified in
[designs.md](designs.md#device-resolution-model); channel-map key/value semantics in
[designs.md](designs.md#channel-map-semantics). Phase 2 owns them.

---

## Schema device-output contract

Referenced by phases 4, 5, 6. The workspace path must emit values the shared `nwb_schema.json` accepts
(AJV Draft-7 here; `trodes_to_nwb` uses Draft 2020-12 — keep both in mind). Concretely:

- **Electrode group** (`nwb_schema.json:981-1002`): `id` is an **integer** (`minimum: 0`); `description`
  and `targeted_location` are **required** (currently omitted by `ElectrodeGroupModal.jsx:76-85`);
  `location`, `device_type`, `targeted_x/y/z`, `units` also required.
- **Ntrode channel map** (`nwb_schema.json:1752-1776`): `ntrode_id` and `electrode_group_id` are
  **integers**; `bad_channels` (array of integers) and `map` (object) required. `ntrode_id` must be
  unique across the animal's whole map (no collision on incremental add).
- **Subject `date_of_birth`** (`nwb_schema.json:494-501`): must match a `T`-separated timestamp
  pattern (`YYYY-MM-DDTHH:MM[:SS[.ffffff]]`). A bare `YYYY-MM-DD` is rejected. The pattern is
  **unanchored** (AJV `RegExp.test`), so `new Date(value).toISOString()` (trailing `Z`) passes — mirror
  the legacy `SubjectFields.jsx` (phase 5).
- **`data_acq_device`** (`nwb_schema.json:504`): an **array** whose items require `name`, `system`,
  `amplifier`, `adc_circuit` (all strings). The current `DataAcqSection` edits a single object and omits
  `name` — phase 3 fixes the array shape + required fields.
- **`cameras[]`** (`nwb_schema.json:697`): `lens` and `camera_name` are required (alongside
  `manufacturer`/`model`/`meters_per_pixel`). `CameraModal` must require `lens` (phase 3).

**Invariant (do not weaken):** IDs are integers **end-to-end** — creation (`AnimalEditorStepper`,
`channelMapUtils`), in-memory model, PropTypes (`ChannelMapEditor`, `DevicesStep`), and exported YAML.
Do not "fix" one layer by string-coercing at the boundary; that reintroduces the type split the
reviewer already flagged (`ChannelMapEditor` expects string, `DevicesStep` expects number today).

---

## Validation & export-gate contract

Referenced by phases 1, 6. The day-level export must be **fail-closed**.

- `validate(model)` (`src/validation/index.js:27`) → array of `{severity, message, field?, step?}`,
  combining `schemaValidation` (AJV) + `rulesValidation`.
- `computeStepStatus(day, mergedDay)` (`src/pages/DayEditor/validation.js:52`) computes an authoritative
  `export` status: `'valid'` iff full validation has **zero** error-severity issues (`:68`).
- **The export gate is not redundant with the prereq steps.** `computeDevicesStatus` (`:118`) and
  `computeEpochsStatus` (`:94`) derive their status from *completeness*, not from schema/rule errors
  routed to their bucket — so a **device-field schema error** (e.g. an electrode group missing
  `description`, a string ID) leaves `devices: 'valid'` while `export: 'error'`. That is the case that
  must drive phase 1's tests (not a blank `session_description`, which trips `overview` completeness and
  blocks via the old prereqs anyway).
- **The gate (do not weaken):** Download YAML may fire **only** when `computeStepStatus(...).export ===
  'valid'`. Every reachable path — the Export step button (`ExportStep.jsx`), the step-nav gate
  (`StepNavigation.jsx:139`, `isExportEnabled`), and keyboard navigation (`DayEditorStepper.jsx` Alt+Arrow)
  — must consult that single status. `ExportStep`'s download handler re-checks it (defense in depth) in
  addition to the encoder-stability shadow-export check, which stays.
- **Severity policy (unchanged from the v3 plan):** data-entry steps are non-blocking (missing cameras /
  incomplete tasks are info/warning). **Only export** is hard-gated on zero error-severity issues. The
  new rules in phase 6 are **error** severity only where they would produce invalid/ambiguous YAML
  (dangling references, out-of-range channels); softer issues stay warnings.

---

## Parity & golden-fixture contract

Referenced by phases 2, 3, 4, 5. The project's hardest safety rule. There are **two** distinct guards;
keep them distinct:

- **Legacy golden baselines — must stay byte-identical, every phase.**
  `src/__tests__/baselines/golden-yaml.baseline.test.js` parses each of the 4 legacy fixtures and
  re-encodes (`parse → encode → assert byte-identical`), 125 assertions. These **do not exercise
  `mergeDayMetadata`**, so no phase here should change them. A diff is a blocker requiring explicit
  regeneration per CLAUDE.md — never regenerate to "make it pass."
- **New-path parity fixtures — deliberately updated when output legitimately changes.** The new export
  path is guarded by `src/pages/DayEditor/__tests__/exportParity.integration.test.js` and
  `legacyParity.integration.test.js` (assert `encodeYaml(mergeDayMetadata(...))` against the
  legacy-export reference / expected metadata) plus the workspace fixtures
  (`src/__tests__/fixtures/workspaceBuilders.js`, `legacyParityFixture.js`,
  `src/__tests__/fixtures/golden/legacy-export.reference.yml`). Phases 2–5 **change new-path output on
  purpose** (probes now present, bad-channels applied, integer IDs, timestamp DOB). When they do:
  1. Update the fixture/reference so it reflects the **corrected** output.
  2. Review the byte diff and confirm every change is intended (a probe appearing, an ID becoming an
     integer) — not an accidental regression.
  3. Re-assert `decodeYaml(encodeYaml(mergeDayMetadata(...)))` deep-equals the expected metadata and
     `schemaValidation(...)` returns zero errors.
  4. Document the change in `docs/REFACTOR_CHANGELOG.md`.
- **`trodes_to_nwb` round-trip (when available).** `trodes_to_nwb` is not always checked out
  (`/Users/edeno/Documents/GitHub/trodes_to_nwb`). When it is, convert a corrected sample and confirm
  it succeeds + passes NWB Inspector. When it isn't, AJV schema validation against `nwb_schema.json` is
  the required substitute gate. Never skip both.
