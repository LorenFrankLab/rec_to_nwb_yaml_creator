# Overview — Scope, dependencies, integration, risks

[← back to PLAN.md](PLAN.md)

These export-correctness defects were found by a review of the new workspace export path (2026-06-04). They are
**pre-existing** — not introduced by any v3 phase — and they are export-correctness blockers for the
cutover. Several are *silent scientific-data corruption*: the workspace path produces a YAML that
parses but is wrong, with no error surfaced.

## Current codebase integration points

The new export path is `encodeYaml(mergeDayMetadata(animal, day))` →
`formatDeterministicFilename(model)` → `downloadYamlFile(...)` (`src/io/yaml.js`). The defects live in
how the model is built and gated, not in the encoder.

- `src/state/workspaceUtils.js:84-111` — `resolveDayConfig`: resolves a day's probe config from
  `configurationHistory` only, never live `animal.devices`; reads `deviceOverrides.electrode_groups`
  and `deviceOverrides.ntrode_electrode_group_channel_map` but **not** `deviceOverrides.bad_channels`.
  Touched by phase 2.
- `src/state/workspaceUtils.js:150-249` — `mergeDayMetadata`: the single bridge to YAML. Reads
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
  Touched by phase 5. Legacy `src/components/SubjectFields.jsx:96-108` formats DOB with
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
- The UI prevents common scientific mistakes before export: identity drift is caught at edit time, task/video
  references are selected from known cameras/epochs, blocked exports link to the exact repair target, and the
  final Export step shows a compact preflight summary.
- Validation catches the cross-reference and channel-bound errors a scientist can realistically create.
- Import and persistence degrade safely (no silent invalid imports, no crash on an empty blob, no lost
  unsaved work after a failed autosave).
- **DANDI / Spyglass conformance.** The NWB files produced from this YAML are archived on DANDI and
  ingested into Spyglass (`/Users/edeno/Documents/GitHub/spyglass`). Phase 6 adds the Spyglass-motivated
  guards `trodes_to_nwb` won't (non-empty, consistent `electrode_groups[].location`; valid references;
  stable dataset-level identities such as camera/data-acq/task names) **as in-app validation rules**.
  The actual Spyglass/DANDI round-trip is **deferred** (no Python/Spyglass environment available now) — see
  the round-trip note below and in [shared-contracts.md](shared-contracts.md).
- **Browser-level QA, usability/proper-behavior audit, and professional UX polish.** After phases 1–8, a
  Playwright pass exercises the corrected workspace flows in a real browser, then Claude-executable audits
  triangulate UI/workspace/export behavior and apply professional UX polish before the v3 cutover consumes
  this work.

### Non-Goals

- **No broad legacy-form changes.** The single-page legacy form is the frozen safety net. The only allowed
  exception is phase 7's shared schema-error-path fix plus the legacy partial-import bug it exposes; that
  exception is documented in the phase and must not become a general legacy refactor.
- **No cutover.** Flag flips and the default-route change are Phase 11 of the separate
  [v3-workspace-cutover](../v3-workspace-cutover/PLAN.md) plan, not this plan's Phase 11 UX polish audit.
- **No new probe/device types.** But note `nwb_schema.json` **may need small edits** to encode DANDI
  constraints the bundled schema omits (e.g. a `species` pattern, `subject_id`/`session_id` no-slash
  patterns); coordinate any schema change with `trodes_to_nwb`'s bundled copy (they share it).
- **No persistence-blob forward migration.** Out of scope (tracked in the v3 plan's release-gated item).
- The reconfiguration *versioning* mechanics (added in the v3 plan) are reused, not redesigned — except
  the device-resolution model in [designs.md](designs.md), which phase 2 implements (model B).
- **Optogenetics IS in scope** (phase 8): the workspace path can emit opto metadata, and trodes_to_nwb has
  silent opto landmines (key mismatches, all-or-nothing skip) that corrupt opto sessions.

### Dependency policy

No new runtime dependencies. All fixes use existing libraries (AJV, the `yaml` encoder), existing helpers
(`getChannelCount`, `deviceTypeMap`, `validate`, `schemaValidation`), and the already-installed Playwright
dev tooling for the phase-9 browser QA pass, phase-10 audit, and phase-11 UX polish audit.

## Metrics

- **Schema validity:** for a fully-configured workspace session, `schemaValidation(mergeDayMetadata(animal, day))`
  returns zero errors (AJV Draft-7, `nwb_schema.json`).
- **Completeness:** exported `electrode_groups`, `ntrode_electrode_group_channel_map` (with day
  bad-channels applied), `data_acq_device`, and `cameras` equal what the UI shows as configured.
- **Fail-closed:** no code path downloads YAML for a day with an error-severity issue.
- **Legacy parity preserved:** the 125 golden baselines stay byte-identical throughout (see parity contract).
- **In-app schema + rule gate (per phase):** `decodeYaml(encodeYaml(mergeDayMetadata(...)))` deep-equals the
  expected metadata, `schemaValidation(...)` (AJV) is zero-error, and the new in-app DANDI/Spyglass rules
  pass. This is the per-phase gate ([round-trip contract](shared-contracts.md#parity-golden-fixture--round-trip-contract)).
- **Spyglass-ingestible (in-app proxy):** identities are unique/consistent across the workspace/dataset
  (`camera_name`, `data_acq_device[].name`, task name), locations non-empty/canonical, behavioral-event names
  unique ([naming-identity contract](shared-contracts.md#spyglass-naming-identity-contract)). These rules are
  modeled on Spyglass requirements but are not a substitute for an actual ingest.
- **Downstream round-trip — deferred, pre-cutover:** the real `trodes_to_nwb` → `nwbinspector --config dandi`
  → `dandi validate` → Spyglass ingest is **not runnable now**, so it is **not** a per-phase merge gate;
  it remains the ultimate correctness check and must be run once before the v3 cutover (commands + acceptance
  in [docs/PIPELINE_REQUIREMENTS.md](../../../../docs/PIPELINE_REQUIREMENTS.md)).
- **User mental model preserved:** controls, validation, repair actions, and preflight explain the workflow
  in terms of animals, recording days, rigs, cameras/calibrations, probes, tasks/videos, opto state, and
  export confidence rather than schema paths alone
  ([mental-model contract](shared-contracts.md#user-mental-model-contract)).
- **UX mistake-prevention:** export-blocking issues expose repair actions; camera/data-acq/task identity
  drift is caught while editing; task/video camera and epoch references are controlled choices; configuration
  version and optogenetics enabled/off state are visible; Export shows the preflight summary
  ([UX contract](shared-contracts.md#ux-mistake-prevention-contract)).
- **Playwright QA:** `npm run test:e2e` covers the corrected workspace happy path, fail-closed export/repair
  navigation, mistake-prevention controls, persistence recovery, opto on/off behavior, and desktop/narrow
  viewport reachability ([phase 9](phase-9-playwright-qa-pass.md)).
- **Claude-executable usability/proper-behavior audit:** the phase-10 findings artifact proves UI/state/export
  agreement, mistake-injection coverage, label/unit clarity, keyboard/narrow-viewport usability, visible
  repair recovery, and a proceed/block recommendation for Phase 11
  ([phase 10](phase-10-claude-usability-behavior-audit.md)).
- **Professional UX quality:** the phase-11 polish report proves interaction consistency, form clarity,
  information hierarchy, responsive layout, accessibility polish, content quality, and perceived-performance
  confidence, with remaining debt severity-ranked and a final cutover recommendation for this plan
  ([phase 11](phase-11-professional-ux-polish-audit.md)).

## Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| A device-resolution fix silently changes *legacy* export bytes | The 125 golden baselines don't exercise `mergeDayMetadata`; they must stay byte-identical. Any baseline diff is a blocker, not a regenerate. See the [parity contract](shared-contracts.md#parity-golden-fixture--round-trip-contract). |
| The probe-resolution redesign interacts with the reconfiguration wizard | Phase 2 settles the model in [designs.md](designs.md) first (Open Question 1) and re-runs the reconfig integration tests; the wizard's create-then-apply flow is preserved. |
| Fixing IDs to integers breaks components that assume strings | Phase 4 standardizes the type end-to-end (creation, `ChannelMapEditor`/`DevicesStep` PropTypes, channel-map utils) in one PR and asserts the merged output's types. |
| Fail-closed export makes the new editor look broken before output fixes land | Intended and safe — the legacy path is still default and the workspace is flag-gated. Phases 2–5 restore exportability for valid sessions. Noted in phase 1. |
| Python/DANDI/Spyglass environment unavailable (current state) | AJV/`nwb_schema.json` + the new in-app DANDI/Spyglass rules are the per-phase gate. The real downstream round-trip is deferred to a single pre-cutover task (not a per-phase blocker); schema-pass ≠ Inspector/DANDI/Spyglass-pass, so it must still be run before the v3 cutover. |
| Playwright QA becomes brittle or superficial | Phase 9 uses role/label selectors, deterministic workspace fixtures, event/locator waits, and no conditional "if visible" skips for required workspace flows. Visual snapshots stay limited; traces/screenshots are artifacts for debugging. |
| Automated usability audit misses human confusion | Phase 10 is Claude-executable and catches UI/state/export mismatches, ambiguous labels, unreachable controls, and likely mistake paths. A separate human lab-user dry run is still recommended, but it is outside this Claude-run implementation plan. |
| UX polish turns into broad redesign | Phase 11 fixes small consistency/content/layout/accessibility issues and logs larger redesigns as scoped follow-ups; it must not change export semantics or become a design-system rewrite. |

## Rollout Strategy

Each phase is an independent PR merged to `modern` behind the existing workspace feature flags (still
off by default). Nothing changes for legacy-form users. The output-changing phases (2–5, 8) update the
**new-path** parity fixtures/tests deliberately and with review; they never touch the legacy golden
baselines. Phase 9 is the browser regression QA gate after phases 1–8, Phase 10 is the Claude-executable
usability/proper-behavior audit that recommends whether to proceed to Phase 11, and Phase 11 is the
professional UX polish audit that makes this plan's cutover recommendation. The separate v3 cutover Phase 11
consumes this work as its correctness precondition.

## Open Questions

All open questions are **decided** (2026-06-04):

1. **Device-resolution model — DECIDED: model B** (snapshots are the source of truth; the day pins a
   version; `animal.devices` mirrors the latest snapshot; reconfiguration forks *before* the geometry
   edit). Mid-study reconfiguration is rare (implanted probe), so a per-version pin beats a live-diff
   workflow, and a recording day's geometry is a fixed physical fact. The wizard's live-vs-snapshot diff
   is dropped. Full design + the freeze-before-edit transaction: [designs.md](designs.md#device-resolution-model).
2. **DOB precision — DECIDED: midnight-normalize** a date-only value with `new Date(value).toISOString()`
   on save, mirroring legacy `SubjectFields.jsx:96-108`. The schema pattern is unanchored so the
   trailing `Z` passes. No time-of-day input.
3. **Hardware Config technical fields — DECIDED: per-day with animal-level defaults.** The rig is
   constant per animal but occasionally varies per day, so `raw_data_to_volts` / `times_period_multiplier`
   are stored as `animal.technicalDefaults`, seeded into `day.technical` at `createDay`, and overridable per
   day; `default_header_file_path` is per-day only. The Animal Editor may edit the non-exported defaults,
   but `mergeDayMetadata` reads only `day.technical.*`. Phase 3 must also rename the current UI key
   `ephys_to_volt_conversion` to the exported `raw_data_to_volts`.
4. **`species` input — DECIDED: controlled dropdown of Latin binomials + an "other (binomial)" escape,
   validated against the binomial / NCBI-taxon-URI form.** DANDI rejects free text (`Rat`); a dropdown is
   safest while the escape keeps flexibility for unusual species (phase 5).
5. **Behavioral-events ownership — DECIDED: day-level is the exported source; animal-level is editable
   reference only.** Consistent with the v3 Phase-10.5 relabel. Phase 3 must make animal-level
   `behavioral_events` actually persist (today `updateAnimal` drops them) **or** remove animal-level
   editing; the export keeps reading `day.behavioral_events`.

## Estimated Effort

~11 PRs. Rough diff sizes: phase 1 small–medium (~200 LOC including repair links/preflight); phase 2 medium
(~275 LOC incl. design + fixtures + configuration-version context);
phase 3 medium–large (~300 LOC — the `updateAnimal` no-op fix, camera/data-acq identity, behavioral-events
ownership); phase 4 medium (~250 LOC incl. integer-ID sweep + multi-shank offset + stray-key removal);
phase 5 medium (~250 LOC — subject/session completeness: weight, species, DOB, no-slash ids,
experiment_description); phase 6 large (~450+ LOC of rules + task/video reference UX + the corrected
channel-bound + Spyglass/DANDI rules + tests); phase 7 small–medium (~150 LOC, re-scoped); phase 8
medium–large (~300+ LOC — workspace opto UI + key fixes + all-or-nothing validation); phase 9 medium
(~250+ LOC of Playwright fixtures/specs + QA runbook/artifacts); phase 10 small–medium (~150+ LOC/scripts
plus QA artifact, depending how many findings are fixed inline); phase 11 small–medium (~150+ LOC/screenshots
/copy/layout/a11y fixes + UX polish report, depending how many findings are fixed inline). Test LOC dominates.
Each output-changing phase is gated on the in-app schema + DANDI/Spyglass **rules**; the actual
trodes_to_nwb → NWB Inspector (dandi) → dandi-validate → Spyglass round-trip is deferred to a single
pre-cutover task (no Python/Spyglass environment now).

**Caveat:** these are rough lower bounds. The [UX mistake-prevention contract](shared-contracts.md#ux-mistake-prevention-contract)
adds real UI per phase — the export preflight summary + repair-action routing (phase 1), identity
side-by-side comparison modals (phase 3), pinned-config badges + reconfiguration confirmation (phase 2),
controlled region/canonical inputs (phases 4–5), task/video camera + epoch selectors and task-name identity
checks (phase 6), and the opto enabled-state surface (phase 8) — which can push several phases meaningfully
above the LOC noted. Phase 9 then verifies those UX paths in browser, including viewport/reachability issues
that jsdom will miss. Phase 10 adds a scripted Claude-run usability/proper-behavior audit over the integrated
experience. Phase 11 adds a professional UX polish pass over consistency, accessibility, content, responsive
layout, and perceived performance. Treat the UX work as first-class scope, not trim.
