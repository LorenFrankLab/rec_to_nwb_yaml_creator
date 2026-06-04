# Overview — Scope, dependencies, integration, risks

[← back to PLAN.md](PLAN.md)

These nine defects were found by a review of the new workspace export path (2026-06-04). They are
**pre-existing** — not introduced by any v3 phase — and they are export-correctness blockers for the
cutover. Several are *silent scientific-data corruption*: the workspace path produces a YAML that
parses but is wrong, with no error surfaced.

## Current codebase integration points

The new export path is `encodeYaml(mergeDayMetadata(animal, day))` →
`formatDeterministicFilename(model)` → `downloadYamlFile(...)` (`src/io/yaml.js`). The defects live in
how the model is built and gated, not in the encoder.

- `src/state/workspaceUtils.js:60-110` — `resolveDayConfig`: resolves a day's probe config from
  `configurationHistory` only, never live `animal.devices`; reads `deviceOverrides.electrode_groups`
  and `deviceOverrides.ntrode_electrode_group_channel_map` but **not** `deviceOverrides.bad_channels`.
  Touched by phase 2.
- `src/state/workspaceUtils.js:154-230` — `mergeDayMetadata`: the single bridge to YAML. Reads
  `animal.devices.data_acq_device` (`:185`), `day.technical.*` (`:204-207`), and the resolved ntrode
  map verbatim (`:228`). Touched by phases 2–3.
- `src/state/useWorkspace.js:117-174` — `createAnimal`: seeds `configurationHistory[0].devices` from
  `metadata.devices?.electrode_groups` (`:164`), which Home passes empty. Touched by phase 2.
- `src/state/useWorkspace.js:206-208` — `updateAnimal` devices branch: updates `animal.devices` only,
  never `configurationHistory`. Touched by phase 2.
- `src/pages/DayEditor/DevicesStep.jsx:137` — writes day bad channels to
  `deviceOverrides.bad_channels.{ntrodeId}`. Source of the phase-2 bad-channel merge.
- `src/pages/AnimalEditor/HardwareConfigStep.jsx:82-86` — renders `CamerasSection` with no
  `onAdd`/`onEdit`/`onDelete`. Touched by phase 3.
- `src/pages/AnimalEditor/DataAcqSection.jsx:59-71` — writes `data_acq_device` / `technical` via
  `onFieldUpdate`; the Animal-Editor `onFieldUpdate` routing vs. the export's read locations is the
  phase-3 source-of-truth mismatch.
- `src/pages/DayEditor/validation.js:52-70` — `computeStepStatus`: computes an authoritative
  `export` status from full validation (`:68`). Read by phase 1.
- `src/pages/DayEditor/StepNavigation.jsx:139-143` — `isExportEnabled`: checks only
  overview/devices/epochs/validation, ignoring `export`. Touched by phase 1.
- `src/pages/DayEditor/DayEditorStepper.jsx:40-50` — `Alt+Right` advances unconditionally. Touched by phase 1.
- `src/pages/DayEditor/ExportStep.jsx:28-76` — `handleDownload` runs the shadow-export encoder-stability
  check only; never re-runs schema/rule validation. Touched by phase 1.
- `src/pages/AnimalEditor/AnimalEditorStepper.jsx:24-36,225-229` — electrode-group IDs created as
  strings. `src/pages/AnimalEditor/ElectrodeGroupModal.jsx:76-85` — saved group omits `description`
  and `targeted_location`. `src/utils/channelMapUtils.js:61-108` — ntrode IDs created as strings;
  `generateAllChannelMaps` increments correctly but incremental add can collide with existing maps.
  Touched by phase 4.
- `src/nwb_schema.json:981-1002` (electrode_groups item: integer `id`, required `description` /
  `targeted_location`), `:494-501` (`date_of_birth` pattern requires a `T` timestamp), `:1752-1776`
  (ntrode item: integer `ntrode_id` / `electrode_group_id`). The schema each fix must satisfy.
- `src/pages/Home/AnimalCreationForm.jsx:415-421` + `src/pages/Home/index.jsx:64` — DOB stored as
  `YYYY-MM-DD`. `src/pages/DayEditor/OverviewStep.jsx:184` — DOB shown read-only, no repair path.
  Touched by phase 5. Legacy `src/components/SubjectFields.jsx:100-103` formats DOB with
  `new Date(value).toISOString()` — the pattern to mirror.
- `src/validation/rulesValidation.js:36-148` — existing rules (camera-presence, opto all-or-nothing,
  channel uniqueness/sequentiality); missing cross-ref and bound checks. Touched by phase 6.
- `src/validation/schemaValidation.js:45-47` — flattens a nested `required` error path to the bare
  `missingProperty`. `src/features/importExport.js:149-168` — partial import excludes by top-level
  field derived from that flattened path. Touched by phase 7.
- `src/state/persistence.js:60-75` — `loadWorkspace` accepts `{schemaVersion:1, workspace:{}}`.
  `src/state/useWorkspace.js:96-106` — autosave `finally` clears `hasPendingWrite` on failure.
  `src/hooks/useUnsavedWorkGuard.js` + `src/layouts/AppLayout.jsx:99-100` — guard ignores `saveError`.
  `src/pages/AnimalWorkspace/index.jsx:37-38`, `src/pages/Home/index.jsx:101,111` —
  `Object.keys(workspace.animals)` crash on an empty workspace. Touched by phase 7.

## Scope and dependency policy

### Goals

- The workspace export path produces **schema-valid, semantically-complete** YAML for any genuinely
  configured session: probes present, day bad-channel edits applied, integer IDs and required fields,
  schema-valid DOB.
- Export **fails closed**: a day with any error-severity validation issue cannot be downloaded by any
  route (button, keyboard, or the Export step).
- Validation catches the cross-reference and channel-bound errors a scientist can realistically create.
- Import and persistence degrade safely (no silent invalid imports, no crash on an empty blob, no lost
  unsaved work after a failed autosave).
- **DANDI / Spyglass conformance.** The NWB files produced from this YAML are archived on DANDI and
  ingested into Spyglass (`/Users/edeno/Documents/GitHub/spyglass`). Phase 6 adds the Spyglass-motivated
  guards `trodes_to_nwb` won't (non-empty, consistent `electrode_groups[].location`; valid references)
  — see the downstream note in [shared-contracts.md](shared-contracts.md).

### Non-Goals

- **No legacy-form changes.** The single-page legacy form is the frozen safety net; these fixes touch
  the workspace path only.
- **No cutover.** Flag flips and the default-route change are Phase 11 of the v3 plan, not here.
- **No new probe/device types.** But note `nwb_schema.json` **may need small edits** to encode DANDI
  constraints the bundled schema omits (e.g. a `species` pattern, `subject_id`/`session_id` no-slash
  patterns); coordinate any schema change with `trodes_to_nwb`'s bundled copy (they share it).
- **No persistence-blob forward migration.** Out of scope (tracked in the v3 plan's release-gated item).
- The reconfiguration *versioning* mechanics (added in the v3 plan) are reused, not redesigned — except
  the device-resolution model in [designs.md](designs.md), which phase 2 implements (model B).
- **Optogenetics IS in scope** (phase 8): the workspace path can emit opto metadata, and trodes_to_nwb has
  silent opto landmines (key mismatches, all-or-nothing skip) that corrupt opto sessions.

### Dependency policy

No new runtime dependencies. All fixes use existing libraries (AJV, the `yaml` encoder) and existing
helpers (`getChannelCount`, `deviceTypeMap`, `validate`, `schemaValidation`).

## Metrics

- **Schema validity:** for a fully-configured workspace session, `schemaValidation(mergeDayMetadata(animal, day))`
  returns zero errors (AJV Draft-7, `nwb_schema.json`).
- **Completeness:** exported `electrode_groups`, `ntrode_electrode_group_channel_map` (with day
  bad-channels applied), `data_acq_device`, and `cameras` equal what the UI shows as configured.
- **Fail-closed:** no code path downloads YAML for a day with an error-severity issue.
- **Legacy parity preserved:** the 125 golden baselines stay byte-identical throughout (see parity contract).
- **Round-trip (mandatory, output-changing phases):** a corrected sample converts via `create_nwbs(...)`
  **and** passes `nwbinspector --config dandi` (zero CRITICAL) **and** `dandi validate` (exit 0). "Converted
  without error" alone is insufficient — both downstream validators only log, never raise
  ([round-trip contract](shared-contracts.md#parity-golden-fixture--round-trip-contract)).
- **Spyglass-ingestible:** identities are unique/consistent (camera_name, data_acq name, task name),
  locations non-empty/canonical, behavioral-event names unique
  ([naming-identity contract](shared-contracts.md#spyglass-naming-identity-contract)).

## Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| A device-resolution fix silently changes *legacy* export bytes | The 125 golden baselines don't exercise `mergeDayMetadata`; they must stay byte-identical. Any baseline diff is a blocker, not a regenerate. See the [parity contract](shared-contracts.md#parity-golden-fixture--round-trip-contract). |
| The probe-resolution redesign interacts with the reconfiguration wizard | Phase 2 settles the model in [designs.md](designs.md) first (Open Question 1) and re-runs the reconfig integration tests; the wizard's create-then-apply flow is preserved. |
| Fixing IDs to integers breaks components that assume strings | Phase 4 standardizes the type end-to-end (creation, `ChannelMapEditor`/`DevicesStep` PropTypes, channel-map utils) in one PR and asserts the merged output's types. |
| Fail-closed export makes the new editor look broken before output fixes land | Intended and safe — the legacy path is still default and the workspace is flag-gated. Phases 2–5 restore exportability for valid sessions. Noted in phase 1. |
| `trodes_to_nwb` not checked out locally | AJV/`nwb_schema.json` schema validation is the always-required gate; the Python round-trip is a recommended-when-available extra, not a blocker. |

## Rollout Strategy

Each phase is an independent PR merged to `modern` behind the existing workspace feature flags (still
off by default). Nothing changes for legacy-form users. The output-changing phases (2–5) update the
**new-path** parity fixtures/tests deliberately and with review; they never touch the legacy golden
baselines. The cutover (v3 Phase 11) consumes this work as its correctness precondition.

## Open Questions

All three are **decided** (2026-06-04):

1. **Device-resolution model — DECIDED: model B** (snapshots are the source of truth; the day pins a
   version; `animal.devices` mirrors the latest snapshot; reconfiguration forks *before* the geometry
   edit). Mid-study reconfiguration is rare (implanted probe), so a per-version pin beats a live-diff
   workflow, and a recording day's geometry is a fixed physical fact. The wizard's live-vs-snapshot diff
   is dropped. Full design + the freeze-before-edit transaction: [designs.md](designs.md#device-resolution-model).
2. **DOB precision — DECIDED: midnight-normalize** a date-only value with `new Date(value).toISOString()`
   on save, mirroring legacy `SubjectFields.jsx:100-103`. The schema pattern is unanchored so the
   trailing `Z` passes. No time-of-day input.
3. **Hardware Config technical fields — DECIDED: per-day with animal-level defaults.** The rig is
   constant per animal but occasionally varies per day, so `raw_data_to_volts` / `times_period_multiplier`
   are seeded from animal-level defaults at `createDay` and overridable per day; `default_header_file_path`
   is per-day. Edit them in the Day Editor; the animal-level Hardware Config step keeps only
   `data_acq_device`.
4. **`species` input — DECIDED: controlled dropdown of Latin binomials + an "other (binomial)" escape,
   validated against the binomial / NCBI-taxon-URI form.** DANDI rejects free text (`Rat`); a dropdown is
   safest while the escape keeps flexibility for unusual species (phase 5).
5. **Behavioral-events ownership — DECIDED: day-level is the exported source; animal-level is editable
   reference only.** Consistent with the v3 Phase-10.5 relabel. Phase 3 must make animal-level
   `behavioral_events` actually persist (today `updateAnimal` drops them) **or** remove animal-level
   editing; the export keeps reading `day.behavioral_events`.

## Estimated Effort

~8 PRs. Rough diff sizes: phase 1 small (~150 LOC); phase 2 medium (~250 LOC incl. design + fixtures);
phase 3 medium–large (~300 LOC — the `updateAnimal` no-op fix, camera/data-acq identity, behavioral-events
ownership); phase 4 medium (~250 LOC incl. integer-ID sweep + multi-shank offset + stray-key removal);
phase 5 medium (~250 LOC — subject/session completeness: weight, species, DOB, no-slash ids,
experiment_description); phase 6 large (~350 LOC of rules + the corrected channel-bound + Spyglass/DANDI
rules + tests); phase 7 small–medium (~150 LOC, re-scoped); phase 8 medium (~200 LOC — opto key fixes +
all-or-nothing validation). Test LOC dominates. Each output-changing phase also carries a mandatory
trodes_to_nwb → NWB Inspector (dandi) → dandi-validate round-trip.
