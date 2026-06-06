# Shared Contracts

[← back to PLAN.md](PLAN.md)

Cross-phase contracts. Each lives here once; phases link in by anchor. **Do not weaken** a contract
without updating this file and every phase that references it.

- [Export-resolution source-of-truth contract](#export-resolution-source-of-truth-contract)
- [Schema device-output contract](#schema-device-output-contract)
- [Validation & export-gate contract](#validation--export-gate-contract)
- [User mental-model contract](#user-mental-model-contract)
- [UX mistake-prevention contract](#ux-mistake-prevention-contract)
- [Domain boundaries & ownership contract](#domain-boundaries--ownership-contract)
- [Professional UX quality contract](#professional-ux-quality-contract)
- [Spyglass naming-identity contract](#spyglass-naming-identity-contract)
- [DANDI conformance contract](#dandi-conformance-contract)
- [Parity, golden-fixture & round-trip contract](#parity-golden-fixture--round-trip-contract)

**Downstream:** the exported YAML feeds DANDI (public archive) and Spyglass
(`/Users/edeno/Documents/GitHub/spyglass`). Per CLAUDE.md, Spyglass requires non-empty, consistently
capitalized `electrode_groups[].location` (auto-creates `BrainRegion` rows), stable database identities,
pre-registered `device_type`s, and the ndx_franklab_novela columns (`bad_channel`, etc.). `trodes_to_nwb`
validates each session YAML against its bundled schema copy (same behavioral schema; currently only the
app copy has the top-level `"version"` metadata line) with `jsonschema.Draft202012Validator` and its
metadata validator performs schema checks only — no app-level cross-reference or channel-bound checks
(verified in `metadata_validation.py`). Conversion may still raise for missing converter-specific fields,
but the app is the sole practical place dangling references / out-of-range channels / empty locations /
identity drift can be caught before export (phase 6).

---

## Export-resolution source-of-truth contract

Referenced by phases 2, 3. `mergeDayMetadata(animal, day)` (`src/state/workspaceUtils.js:150`) is the
single bridge from the workspace model to YAML. After this plan, each exported section has exactly one
defined source of truth:

| Exported key | Source of truth (after fixes) |
| --- | --- |
| `electrode_groups` | `day.deviceOverrides.electrode_groups` if present, else `configurationHistory[day.configurationVersion].devices.electrode_groups` (the pinned snapshot; `animal.devices` mirrors the *latest* snapshot — see model B). **Never** an empty initial snapshot when probes are configured. |
| `ntrode_electrode_group_channel_map` | same resolution as above, **with** `day.deviceOverrides.bad_channels.{ntrode_id}` applied onto each ntrode's `bad_channels` (phase 2). |
| `data_acq_device` | `animal.devices.data_acq_device` — an **array** of `{name, system, amplifier, adc_circuit}` items (schema `nwb_schema.json:504`, all four required). The Hardware Config step must write this array shape here (phase 3). |
| `cameras` | `animal.cameras` — each `{id, camera_name, manufacturer, model, lens, meters_per_pixel}` with `lens` **required** (schema `:697`). Hardware Config add/edit/delete writes here (phase 3). |
| `times_period_multiplier`, `raw_data_to_volts`, `default_header_file_path`, `units` | `day.technical.*` (per-day). **Decision (Q3):** these are per-day; `raw_data_to_volts` / `times_period_multiplier` are seeded from `animal.technicalDefaults` at `createDay` and overridable per day; `default_header_file_path` is per-day. The Animal Editor may edit the non-exported defaults; `mergeDayMetadata` never reads defaults directly (phase 3). |

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

Referenced by phases 1, 6, 9. The day-level export must be **fail-closed**.

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
- **The gate (do not weaken):** Download YAML may fire **only** when `isExportEnabled(computeStepStatus(...))`
  is true — i.e. `export === 'valid'` AND every prerequisite step (`overview`/`devices`/`epochs`/`validation`)
  is `'valid'` (the gate function lives in `src/domain/stepGate.js`; `pages/DayEditor/stepGate.js` re-exports
  it). Every reachable path — the Export step button (`ExportStep.jsx`), the step-nav gate
  (`StepNavigation.jsx`), and keyboard navigation (`DayEditorStepper.jsx` Alt+Arrow) — must consult that
  single function. `ExportStep`'s download handler re-checks it (defense in depth) in addition to the
  encoder-stability shadow-export check, which stays. (Phase 8.6 also has the workflow-status helper
  `getDayWorkflowStatus` derive `readyForExportPreflight` from the SAME function so it can't drift.)
- **Severity policy (unchanged from the v3 plan):** data-entry steps are non-blocking while the user is
  drafting. **Only export** is hard-gated on zero error-severity issues. The new rules in phase 6 are
  **error** severity where they would produce invalid/ambiguous or Spyglass-skipped YAML (dangling camera /
  electrode-group references, out-of-range channels, duplicate task epochs, invalid video/task dependencies);
  softer data-entry incompleteness stays warning/info until it reaches export.

---

## User mental-model contract

Referenced by phases 1–11 and [workflow-clarity-design.md](workflow-clarity-design.md). Every agent
implementing or auditing this plan must reason from the scientist's workflow first and the YAML/schema
second. The app is not merely a schema editor; it is a tool for describing a real recording session so it
can convert cleanly, publish to DANDI, and ingest into Spyglass.

- **Users think in animals, recording days, rigs, and sessions.** They do not naturally think in
  `mergeDayMetadata`, `ntrode_electrode_group_channel_map`, AJV paths, or Spyglass primary keys. UI labels,
  repair actions, preflight summaries, and QA scenarios should start from "what was recorded on this day?"
  and only expose technical names when precision requires it.
- **The workflow order must be visible.** The app should guide users through: create/select animal, configure
  shared animal hardware (especially electrodes/probes), create/import recording days, fill day-specific
  metadata and failed channels, record hardware changes starting on a day, then export. Electrode setup must
  be a first-class setup action, not something users find only by opening a recording day.
- **Existing data needs a review state.** If the workspace already has days, imported metadata, recovered
  configurations, or repaired persisted state, the UI should say what was found and what must be reviewed
  before export. Do not let recovered data look silently trusted or disappear behind empty states.
- **Physical configuration is a recording fact.** Probe geometry, camera calibration/zoom, data-acq hardware,
  and optogenetics state are facts about a recording day. Later edits are corrections to metadata, not a
  casual rewrite of history. Configuration version context and reconfiguration confirmation must preserve
  that mental model.
- **Names are identities, not decoration.** Users may think a camera/task/data-acq name is just a label, but
  Spyglass treats these as identities. The UI must teach this at the moment of risk: same name means same
  dependent metadata; a camera with a different zoom/calibration/lens/model/id needs a different name.
- **Export is a confidence checkpoint, not just file download.** Users expect "Export" to mean "this is ready
  for conversion/publication/ingestion." The preflight summary must answer their real questions: which animal
  and day, which configuration version, which cameras/calibrations, which probes/bad channels, which tasks
  and videos, whether opto is on, and whether downstream identity risks remain.
- **Repair should not require knowing the schema.** A scientist should not need DANDI/Spyglass/AJV knowledge
  to fix an issue. Errors should name the affected scientific object, explain the consequence, and route to
  the next safe action.
- **Autosave and persistence must match ordinary expectations.** Users assume edits they see are retained
  unless the UI says otherwise. Save state, failed-save warnings, reload recovery, and partial-import notices
  must be visible and specific enough to maintain trust.
- **Agent implementation rule.** Before adding controls, validation, QA, or copy, identify the user goal,
  the user's likely mental model, the dangerous misconception, and the UI behavior that prevents or repairs
  it. Phase 10/11 artifacts must include this mental-model mapping for the core workflows.

---

## UX mistake-prevention contract

Referenced by phases 1–11. The user should encounter invalid states as close as possible to
the field or workflow that created them, not only at final export. This is a correctness contract, not polish:
the UI must make the scientifically dangerous choices hard to make accidentally.

- **Every export-blocking issue has a repair target.** Validation issues that block export include enough
  metadata to route the user to the right step and focus/highlight the relevant control where possible
  (`step`, `path`/`field`, and a short action label). Export and validation summaries show those actions;
  the disabled Export state is never a dead-end message.
- **Identity-safe naming is active, not passive.** When a camera/data-acq/task name reuses an existing
  Spyglass identity with different dependent metadata, the UI shows a side-by-side comparison and offers the
  safe primary action: create/use a new name. A changed camera zoom/calibration/model/lens/manufacturer/id
  must not be hidden behind a generic warning.
- **Pinned configuration context is visible.** Day device editing shows which configuration version the day
  uses and whether it is historical/current. Reconfiguration confirms the day range affected before the user
  edits geometry; historical days should not look like they are editing live latest devices.
- **Controlled choices for canonical references.** Species, probe/device type, camera references, task epoch
  references, and region/location fields use controlled dropdowns or strong autocomplete from known values
  where possible. "Other" escapes remain, but must validate the emitted value before export. If a phase adds
  an export-blocking reference rule, that phase also owns the closest practical editing-surface prevention
  for the same mistake; validation-only catch-up is not enough for user-created task/video/camera references.
- **Optogenetics has an explicit enabled state.** No partial hidden opto state: when opto is off, opto fields
  are absent/empty by design; when on, all converter-required sections are visible and required, including
  FsGUI camera/epoch references.
- **Export has a preflight summary.** Before download, the user sees a compact summary of the day that will
  be encoded: subject/session completeness, configuration version, cameras/calibrations, probes/bad channels,
  tasks/videos, optogenetics status, and any downstream identity warnings. Passing preflight is the user's
  confidence check; failing preflight links back to repairs.
- **Import/persistence errors name the damaged section.** Partial import and workspace-load recovery notices
  identify the excluded/normalized top-level section and the nested field/path that caused it, so users know
  what was not carried forward.
- **Browser QA and scripted usability audit verify the integrated path.** Phase 9 samples these UX contracts
  in Playwright using required controls and real browser navigation/download/persistence behavior; required
  workspace flows must fail tests when a control is absent, not quietly skip. Phase 10 then triangulates UI,
  workspace state, exported YAML, mistake injection, labels/units, keyboard/viewport behavior, and recovery
  into an executable findings/fix log.

---

## Domain boundaries & ownership contract

Referenced by phase 8.5. Correctness contracts should be owned by domain/state modules, not by whichever
React page first needed them.

- **Page modules render and dispatch; domain modules decide export truth.** Validation composition, repair
  ownership/routing, bad-channel converter semantics, override cleanup semantics, and workspace configuration
  transitions should live in pure helpers or state modules with direct tests.
- **No sibling page folder owns app-wide behavior.** A Day Editor page may render Day Editor controls, but
  Animal Editor, Export, RepairActions, and other surfaces should not import app-wide validation/routing from
  `pages/DayEditor`. Use a shared domain module instead.
- **Extraction is behavior-preserving before QA.** Phase 8.5 is allowed to move code and add guard tests; it
  should not redesign export semantics, rewrite the whole store, or remove the legacy path.
- **Architecture guard tests are part of correctness.** Tests should fail when domain/state modules import
  page modules or when page modules import app-wide domain behavior from sibling page folders.

---

## Professional UX quality contract

Referenced by phase 11. Correct output is not enough for cutover; the workspace must feel predictable,
coherent, and professionally usable for repeated scientific work. Phase 11 is still Claude-executable: it
uses code inspection, Playwright screenshots, keyboard/browser checks, and findings artifacts rather than
human observation.

- **Consistency is part of safety.** Add/Edit/Delete/Save/Cancel, modal close behavior, destructive
  confirmations, disabled states, status badges, repair actions, and export/preflight controls behave the
  same way across screens unless a difference is explicitly justified by the workflow.
- **Scientific fields expose meaning at the control.** High-risk fields show labels, units, examples, and
  required/optional status close to the input. Users should not need schema knowledge to know what
  `meters_per_pixel`, `lens`, species, region, task epoch, camera id, or opto state means.
- **Context is always visible.** Users can tell which animal/day/session/configuration version they are
  editing, whether changes are saved, whether validation is clean, and whether export is ready.
- **Responsive and dense layouts remain usable.** Desktop, tablet-ish, and narrow widths keep critical
  controls reachable; text does not overflow important buttons/badges/modals/tables; validation and preflight
  summaries stay scannable.
- **Accessibility polish goes beyond tabbing.** Focus order, visible focus, focus trap/return, accessible
  names, error associations, status announcements, contrast/status semantics, and reduced-motion tolerance are
  checked for named critical route/states with objective assertions, including text contrast at 4.5:1 and
  focus/non-text status indicators at 3:1, not only subjective review.
- **Content design names consequence and next action.** Errors, empty states, disabled-state explanations,
  destructive confirmations, and preflight copy use user-facing scientific language, state what will happen,
  and tell the user the next safe action.
- **Perceived performance builds confidence.** Autosave, validation, export, and recovery feedback are timely,
  stable, and unambiguous; users are not left wondering whether a change saved or an export started.

---

## Spyglass naming-identity contract

Referenced by phases 3, 6, 10. Spyglass ingests these NWB files; several YAML fields become **database
identities / primary keys**, and Spyglass ingestion **fails silently** (logs to an `InsertError` side
table and continues) for most violations — so the app is the place to enforce them. (Verified against
`spyglass@master`: `common_device.py`, `common_ephys.py`, `common_region.py`, `common_task.py`,
`common_dio.py`, `common_behav.py`.)

- **`cameras[].camera_name` is the `CameraDevice` primary key.** `meters_per_pixel`, `lens`, `model`,
  `manufacturer`, and parsed numeric `camera_id` are dependent metadata. **Reusing a `camera_name` with
  different calibration/lens/model/id raises a divergence error or silently reuses the wrong calibration.**
  Rule: the same `camera_name` anywhere in the workspace/dataset implies identical calibration and numeric
  id — a changed zoom/calibration/model/id **requires a new `camera_name`**.
- **Camera numeric ids are parsed from the NWB device name `camera_device {id}`** (`common_task.py:219`,
  `common_behav.py:477`), which trodes_to_nwb writes from `cameras[].id`. Keep `id` an integer and unique;
  don't rely on `camera_name` for the numeric join.
- **`data_acq_device[].name` is a `DataAcquisitionDevice` identity** (`common_device.py:60,190`). Same
  `name` with different `system`/`amplifier`/`adc_circuit` triggers a divergence check. Rule: the same
  `name` anywhere in the workspace/dataset implies identical technical fields.
- **`tasks[].task_name` is checked for secondary-key consistency** (`common_task.py:20`): the same
  `task_name` with a different `task_description` can raise. Rule: task names stable and consistent
  (one description per name within the workspace/dataset).
- **`electrode_groups[].location` auto-creates `BrainRegion` rows by exact string** (`common_ephys.py:51`,
  `common_region.py:44` — no trim/case-fold). Spelling/case drift fragments regions. `targeted_location`
  is still schema-required and is passed to `trodes_to_nwb` as the per-electrode location, but current
  Spyglass common ingestion reads the group location for BrainRegion identity. Rule: both strings non-empty;
  `location` is canonical/case-consistent across groups.
- **Task/video import depends on a successful `TaskEpoch`**: `associated_video_files` without matching task
  metadata warn and **do not import** (`common_behav.py:451`, `common_task.py:240`). `TaskEpoch` is keyed by
  session + epoch and needs a unique interval match; duplicate task epochs across task rows, missing valid
  camera names, or ambiguous/no interval matches can fail or skip inserts. Rule (app-checkable): task epochs
  are unique per day, task camera ids are valid/non-empty (no-camera paths explicitly allowed/tested), and
  each video has a matching task epoch + valid scalar `camera_id`. Timestamp-overlap and exact `VideoFile`
  row checks are **not** app-provable — they are verified by the deferred pre-cutover Spyglass ingest.
- **`behavioral_events` names must be unique within a session** — duplicate `dio_event_name` is a hard
  `DIOEvents` PK violation (`common_dio.py`) and a trodes_to_nwb `ValueError`.

Phase 3 enforces the camera / data-acq identity at the editing surface (warn on reuse-with-divergence);
phase 6 adds the cross-reference / uniqueness / non-empty-location validation rules. The actual Spyglass
ingest (`populate_all_common(..., raise_err=True)` or zero `InsertError` plus expected `TaskEpoch` /
`VideoFile` / `Electrode` rows) is **deferred** to the single pre-cutover round-trip task (no Spyglass
environment now); default Spyglass population logs into `InsertError` and continues, so these in-app rules
are the only guard until then.

## DANDI conformance contract

Referenced by phases 5, 10. The NWB files are published to DANDI, whose validators impose requirements
**above** `nwb_schema.json`. DANDI runs NWB Inspector with the **DANDI config**, which promotes these
Subject checks to **CRITICAL (blocking)**:

- **`species`** must be a **Latin binomial** (`^[A-Z][a-z]+ [a-z]+$`, e.g. `Rattus norvegicus`) **or an
  NCBI Taxonomy URI** (`http://purl.obolibrary.org/obo/NCBITaxon_<digits>`). **Free text like `Rat` /
  `Long Evans` is rejected** — and the app's schema example is literally `"Rat"`, so this is a real gap.
- **`sex`** ∈ `{M,F,U,O}` upper-case (already an enum in the app — OK).
- **`subject_id`** present, **no `/`**; **`session_id`** **no `/`**.
- **age OR `date_of_birth`** present (DOB satisfies it once phase 5 lands; emit timezone-aware where
  possible — best practice, non-blocking).

Best-practice (non-blocking but expected): `experimenter` in `Last, First` form; `institution`;
`keywords` present. `dandi validate` **exits non-zero** on any blocking violation. Phase 5 constrains
`species` + the id patterns in-app; the round-trip gate (below) runs the actual validators.

## Parity, golden-fixture & round-trip contract

Referenced by phases 2, 3, 4, 5, 8, 9. The project's hardest safety rule. There are **distinct** guards;
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
- **In-app validation is the gate; the downstream round-trip is a deferred pre-cutover task (not a
  per-phase merge gate).** The actual `trodes_to_nwb` → `nwbinspector --config dandi` → `dandi validate`
  → Spyglass ingest round-trip is **not runnable in the current environment**, so it is **not** a merge
  blocker for these phases. For the output-changing phases (2–5, 8), the gate is:
  1. `decodeYaml(encodeYaml(mergeDayMetadata(...)))` deep-equals the expected metadata, **and**
  2. `schemaValidation(...)` (AJV) returns zero errors for a genuinely-configured session, **and**
  3. the new in-app **DANDI** (species form, no-slash ids) and **Spyglass** (identity uniqueness,
     non-empty/canonical location, reference/channel-bound) validation **rules** from phases 5–6 pass.
  These in-app rules are modeled on the downstream requirements (see
  [docs/PIPELINE_REQUIREMENTS.md](../../../../docs/PIPELINE_REQUIREMENTS.md)) but are **not** a substitute
  for the real validators — schema-pass ≠ Inspector/DANDI/Spyglass-pass. **The actual downstream
  round-trip remains the ultimate correctness check and MUST be run before the v3 cutover**, when a
  Python/Spyglass environment is available; track it as a single pre-cutover gate (the commands and
  acceptance — zero Inspector CRITICAL, `dandi validate` exit 0, clean Spyglass ingest — live in
  `docs/PIPELINE_REQUIREMENTS.md`), not as a blocker on each phase here.
