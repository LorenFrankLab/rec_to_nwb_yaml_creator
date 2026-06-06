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
- **Pre-QA domain-boundary hardening, workflow clarity, ownership/default clarity, browser-level QA, usability/proper-behavior audit, and
  professional UX polish.** After phases 1–8, Phase 8.5 moves app-wide validation/repair routing and converter
  semantics out of page modules so the Playwright pass exercises stable domain contracts. Phase 8.6 then makes
  the user workflow explicit (animal setup first, day metadata second, hardware changes by day range, export
  confidence last). Phase 8.7 makes field ownership explicit: shared setup, configuration versions,
  recording-system defaults copied into days, advanced day overrides, catalog selections, task-epoch setup
  assignments, and day-only recording facts. Phase 9 exercises the
  corrected workspace flows in a real browser, and Claude-executable
  audits triangulate UI/workspace/export behavior and apply professional UX polish before the v3 cutover
  consumes this work.
- **Workflow clarity and electrode setup discoverability.** The app must make the intended order of operations
  obvious: create/select animal, configure shared hardware/electrodes, create/import recording days, fill
  day-specific metadata and failed channels, record hardware changes by day range, then export. A user must
  not have to discover electrode setup by guessing that it lives behind a Day Editor Devices view; see
  [workflow-clarity-design.md](workflow-clarity-design.md).
- **Screen-to-user-job coherence.** Every modern route, major step, modal, empty state, repair path, and
  destructive confirmation must have a clear user job, visible heading, primary action, next/return path,
  ownership cue, and mistake-prevention role; see [workflow-screen-map.md](workflow-screen-map.md).

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
- **Workflow clarity:** the workspace, Animal Editor, Day Editor Devices step, reconfiguration wizard,
  validation summary, and Export preflight expose the same user workflow: animal setup first, recording-day
  metadata second, day-specific failed channels, configuration changes by day range, and export confidence.
  New animals, existing/imported data, missing electrodes, historical configurations, and reconfiguration
  starts are covered by explicit routes/states and Playwright or QA artifacts
  ([phase 8.6](phase-8-6-workflow-clarity-setup-ux.md), [workflow clarity design](workflow-clarity-design.md)).
- **Screen coherence:** the modern screens match the scientist's jobs rather than implementation buckets:
  Create Animal, Animal Workspace, Animal Setup, Day Editor, Validation Summary, reconfiguration, modals,
  and destructive confirmations each expose a coherent heading, primary action, next/return action, ownership
  cue, and repair destination. Labels such as `Home`, `Animal Editor`, `Hardware Config`, `Devices`, and
  `Epochs` are replaced or visibly disambiguated before browser QA
  ([workflow-screen-map.md](workflow-screen-map.md)).
- **Scientist workflow fit:** the modern YAML creator supports both common conversion cadences: exporting a
  freshly finished recording the same day, and catching up on several recorded days at once. In both cadences
  the app must prevent silent metadata/naming mistakes, keep repeated setup entry out of the scientist's way,
  and protect downstream NWB/Spyglass/DANDI identities before export rather than relying on later cleanup.
- **Ownership/default clarity:** users can tell at the point of action whether each field is shared animal
  setup, a configuration version pinned by the day, a recording-system default copied into the day, an
  advanced day override, an animal catalog item selected by the day/task/video/FsGUI row, a task-epoch setup
  assignment, or a day-only recording fact.
  Data acquisition is not hidden in a camera-like hardware bucket; changed camera zoom/calibration/lens/model/id
  is visibly a different camera identity; within-day room/camera/opto differences are represented at
  task-epoch scope; behavioral event ownership is explicit rather than half animal-level reference and half
  day-level export; effective technical values are visible where users edit the recording day without implying
  they should routinely change day by day
  ([phase 8.7](phase-8-7-ownership-defaults-day-configurability.md)).
- **Lifecycle cleanup discoverability:** users can remove test/mistaken animals and recording days through
  secondary destructive actions with confirmations that name cascade/export consequences. Cleanup actions use
  the existing guarded store transitions and do not make deletion visually compete with setup/export
  ([phase 8.7](phase-8-7-ownership-defaults-day-configurability.md)).
- **Domain-boundary stability:** before browser QA, app-wide validation, repair routing, bad-channel
  semantics, override cleanup, and risky workspace transitions live in pure domain/state helpers rather than
  page-local render code. Architecture guard tests prevent sibling page modules from becoming hidden sources
  of export truth
  ([phase 8.5](phase-8-5-domain-boundaries-ownership-cleanup.md)).

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
| Users still cannot find electrode setup or the correct workflow order | Phase 8.6 implements the workflow-clarity design before browser QA: animal setup checklist, `Set Up Electrodes` CTA, Day Devices empty state, existing-data review state, reconfiguration context, validation grouping, and preflight alignment must be implemented or logged as `blocks Phase 9`. |
| Architecture cleanup changes behavior just before QA | Phase 8.5 is behavior-preserving: extract/move domain logic, add architecture guards, and re-run validation/repair/golden/lint/build gates. Any semantic change must be deliberate, documented, and covered before Phase 9 starts. |
| Workflow clarity changes accidentally alter export semantics | Phase 8.6 may change wording, setup/readiness state, routing, and empty/review states, but not schema/rule/export semantics. It must build on Phase 8.5 domain helpers and re-run validation/export/golden/lint/build gates before Phase 9. |
| Users still cannot tell what is animal-level vs. day-level vs. task-epoch-level | Phase 8.7 adds an ownership/default/override matrix and aligns Animal Editor, Day Editor, Validation, and Export around shared setup, configuration versions, recording-system defaults copied into days, advanced day overrides, catalog selections, task-epoch setup assignments, and day-only facts. Ownership cues must appear where users make the edit/selection, not only in help text or docs. Any discovered source-of-truth mismatch must be fixed or logged as `blocks Phase 9`. |
| Camera catalog UX promises historical stability but export emits all animal cameras | Phase 8.7 Task 5 must resolve the camera export binding before browser QA: either implement day-used camera export from task/video/FsGUI references with baseline/export audit, or explicitly keep the all-animal-cameras fallback and warn that camera catalog changes affect all day exports. |
| Users cannot clean up test or mistaken animals/days | Phase 8.7 exposes secondary destructive actions for deleting animals and recording days, with cascade/export warnings and cancel/confirm tests. Deletion must remain guarded by the existing state transitions, including preserving wrong-owner day records. |

## Rollout Strategy

Each phase is an independent PR merged to `modern` behind the existing workspace feature flags (still
off by default). Nothing changes for legacy-form users. The output-changing phases (2–5, 8) update the
**new-path** parity fixtures/tests deliberately and with review; they never touch the legacy golden
baselines. Phase 8.5 is the behavior-preserving architecture hardening gate after phases 1–8, Phase 8.6 is
the workflow-clarity/setup-UX gate, and Phase 8.7 is the ownership/default/day-configurability gate before
browser QA. Phase 9 is the browser regression QA gate, Phase 10 is the
Claude-executable usability/proper-behavior audit that recommends whether to proceed to Phase 11, and Phase 11
is the professional UX polish audit that makes this plan's cutover recommendation. The separate v3 cutover Phase
11 consumes this work as its correctness precondition.

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

## Implementation findings / follow-ups

Recorded during implementation; revisit in the named phase.

1. **Phase-1 gate-isolation fixture corrected (resolved in phase 1).** The phase-1 file
   suggested isolating the new export gate with an electrode group missing schema-required
   `description`. That does **not** isolate it: AJV reports the `required` error with path
   `description` (the bare missing-property name), which `groupErrorsByStep`/`stepIdForIssue`
   route to the **catch-all `validation`** bucket, so `validation: 'error'` and the *old*
   prerequisite gate already blocks — proving nothing about the export status. The truly
   isolating fixture is a device-field error whose path contains `electrode`/`camera`/`ntrode`
   (routes to the Devices bucket, which `computeDevicesStatus` ignores), e.g. a non-numeric
   `electrode_groups[0].targeted_x`: `{overview, devices, epochs, validation}` all `'valid'`,
   `export: 'error'`. Phase 1 uses this fixture.
2. **Issue→step routing is path-substring based and coarse (revisit in phase 6).**
   `stepIdForIssue` routes by substring of the issue `path`, so a bare `required` artifact
   whose path is only the missing property name (e.g. `description`, `weight`) lands in the
   catch-all `validation` step rather than the step that actually owns the field. Repair
   actions therefore degrade to the catch-all step for those issues. Phase 6's richer issue
   shape (`path`/`actionLabel`) should also carry an explicit owning `step` (or a fuller path)
   so routing/repair targeting is precise rather than substring-inferred.
3. **Field-level repair focus is wired only for the Overview editable session fields
   (extend in phase 6).** Repair focus targets `[data-field-path]` anchors; phase 1 added them
   to the Overview `session_description` / `experiment_description` controls (the editable
   fields whose validation paths match). Other steps degrade to step-level focus until phase 6
   adds field-level issue metadata and the corresponding anchors on those steps' controls.
4. **`schemaValidation` does not fail closed on an AJV runtime throw (harden in phase 6/7).**
   `src/validation/schemaValidation.js` calls the compiled validator with no `try/catch`. Today
   that is acceptable — a throw propagates out of `validate()` and crashes the render (no download
   fires, so it is *not* fail-open), and no caller defaults a thrown result to `[]`. But the
   export gate now rests entirely on `validate()` returning error issues for bad data, so this
   shared module (also used by the frozen legacy path) should be made explicitly fail-closed:
   wrap the validator call and, on throw, return a synthetic error-severity issue rather than
   allowing any path to an empty result. Cross-cutting; do it deliberately in the validation
   phase (6) or persistence/hardening phase (7), not as a drive-by in phase 1.

### Phase 2 findings / follow-ups

1. **Stale/dangling bad-channel overrides are silently ignored (surface in phase 6).**
   `resolveDayConfig` applies `day.deviceOverrides.bad_channels` only to ntrodes present
   in the resolved (pinned) map. An override keyed to an `ntrode_id` absent from that map
   (e.g. left over from a different configuration version after a reconfiguration) is
   ignored — it cannot be attached and is not exported. This is the correct export
   behavior, but the dropped marking is currently invisible to the user. Phase 6
   (dangling-reference validation) should surface a warning that a day carries a
   bad-channel override for an ntrode not in its configuration, so the scientist can
   re-mark it on the correct ntrode.
2. **`diffProbeConfigs` is now production-dead (remove in a later phase).** The
   fork-before-edit reconfiguration wizard dropped the live-vs-snapshot diff, so
   `src/state/configDiff.js`'s `diffProbeConfigs` is only referenced by its own tests
   (`reconcileAppliedToDays` from the same module is still used). Left in place this
   phase; remove it + its tests + the `workspaceTypes.js` doc reference in a cleanup pass.
3. **A corrupt persisted day hard-crashes the Day Editor (improve to ErrorState later).**
   `resolveDayConfig` now throws on a stale pin, and both `DayEditorStepper` (via
   `mergeDayMetadata`) and `DevicesStep` call it during render — so a day pinning a
   missing configuration version crashes the editor instead of showing the actionable
   thrown message. This is fail-loud (not silent-wrong, which is the priority), but a
   future change should catch the throw and route to `ErrorState` with the message,
   without ever falling back to an empty-probes render.

### Post-Phase-4 lab feedback (2026-06-04) — actioned + deferred

From driving the running app:

1. **Electrode-group region UX changed to match recording-time workflow (done).** The lab noted
   that at recording time only the **target** is known — the actual `location` needs histology — so
   `location` and `description` should not be required in the editor. The modal now leads with
   **Targeted Location** (required); **Location** and **Description** are optional and filled in on
   save (blank `location` → defaults to the target; blank `description` → `"{device_type} targeting
   {targeted_location}"`). Both stay schema-required and present in the saved group.
2. **Lab requested `location` be dropped from the schema `required` — DEFERRED as a coordinated
   cross-repo change.** `nwb_schema.json` is version-pinned (`1.0.1`) to `trodes_to_nwb` via the
   `check:schema` gate (which compares only the version string, so content drift is undetectable),
   and `trodes_to_nwb`/Spyglass consume `location`. Genuinely removing the requirement needs: a schema
   version bump here, the matching `trodes_to_nwb` bundled-copy edit, and a Spyglass null-location
   fallback. Not done unilaterally; the UI change in (1) delivers the workflow without the risk.
   Revisit if/when the cross-repo change is coordinated.
3. **Task epoch numbers constrained to positive integers (done).** `min="1"` + reject non-positive.
4. **Day-Overview unexplained "x" + DOB/weight/subject-description not editable → Phase 5 (noted).**
   These subject fields are inherited, shown read-only in the day's collapsed "inherited metadata",
   and their validation errors route to the Overview step (`validation.js` `stepIdForIssue`: any
   `subject` path → `overview`) with no editable surface — hence a bare "x". The DOB is stored as
   `YYYY-MM-DD` but the schema needs a `T`-timestamp. All of this is exactly
   [phase 5 (subject/session completeness)](phase-5-subject-session-completeness.md); phase 5 should
   also (a) make the Overview status name *which* inherited field is incomplete rather than a bare
   "x", and (b) provide an editable/repair path for subject fields (they are currently only set at
   animal creation).

### Phase 4 findings / follow-ups

1. **Frozen-golden tetrode map values `0:4..3:7` are scientifically wrong but out of scope.**
   `realistic-session.yml` (one of the 4 byte-frozen legacy golden baselines) and the new-path
   fixtures built to byte-match it (`workspaceBuilders.js`, `legacyParityFixture.js`,
   `golden/workspace-export.realistic.yml`, `golden/legacy-export.reference.yml`) give a *second*
   standalone tetrode group the map values `{0:4,1:5,2:6,3:7}`. Per the channel-map semantics
   ([designs.md](designs.md#channel-map-semantics)), map values are probe-local electrode ids that
   **reset per electrode group**, so a tetrode's second group should be `{0:0,1:1,2:2,3:3}`. The
   **generator is correct** (`generateChannelMapsForGroup` resets per group; proven by dedicated
   unit tests), so this is purely a fixture-data artifact. Correcting it means regenerating a frozen
   golden baseline (forbidden without coordination) and re-checking the legacy↔new byte-parity
   harness + trodes_to_nwb, so it was deliberately **not** changed in phase 4. Revisit when a golden
   regeneration is coordinated (and verify in the deferred pre-cutover round-trip).
2. **CSV `electrode_id` column removed (resolved in phase 4 via review).** Generated ntrodes no
   longer carry `electrode_id` (not a schema field). `exportChannelMapsToCSV` no longer emits the
   column and `importChannelMapsFromCSV` tolerates/ignores it for backward compatibility with older
   CSVs. No remaining work; noted here only because external CSV templates that relied on the column
   will simply see it absent (and any value they keep is ignored on import).

### Phase 3 findings / follow-ups

1. **Blur-save has no unsaved-changes guard (app-wide pattern).** `DataAcqSection` (and other
   blur-save sections) commit on blur; a field edited but never blurred (navigate away) is
   silently discarded, and there is no "unsaved changes" indicator. This is an app-wide
   editing pattern, not specific to Phase 3; consider a shared unsaved-state cue or save
   affordance in a UX-polish pass (phase 11).
2. **Camera table omits a Lens column.** `lens` is now required and part of the camera
   identity, but the cameras table shows ID/Name/Manufacturer/Model/Meters-per-pixel/Status.
   Add a Lens column (or expandable detail) in a polish pass; not export-affecting.
3. **Minor cosmetic/consistency.** The "Use a new name" buttons in the camera modal vs.
   data-acq divergence panels use different CSS classes (`btn-save` vs `button-primary`);
   `DayTechnicalSection`'s `<details>` relies on the browser default disclosure triangle; and
   `CameraModal` labels lack the visual required-`*` indicator that `DataAcqSection` shows
   (adding it must keep the asterisk out of the accessible label — e.g. a CSS `::after` — so
   it doesn't break label-text queries). Cosmetic; fold into the phase-11 consistency pass.

## Estimated Effort

~12 PRs. Rough diff sizes: phase 1 small–medium (~200 LOC including repair links/preflight); phase 2 medium
(~275 LOC incl. design + fixtures + configuration-version context);
phase 3 medium–large (~300 LOC — the `updateAnimal` no-op fix, camera/data-acq identity, behavioral-events
ownership); phase 4 medium (~250 LOC incl. integer-ID sweep + multi-shank offset + stray-key removal);
phase 5 medium (~250 LOC — subject/session completeness: weight, species, DOB, no-slash ids,
experiment_description); phase 6 large (~450+ LOC of rules + task/video reference UX + the corrected
channel-bound + Spyglass/DANDI rules + tests); phase 7 small–medium (~150 LOC, re-scoped); phase 8
medium–large (~300+ LOC — workspace opto UI + key fixes + all-or-nothing validation); phase 8.5 medium
(~250+ LOC of behavior-preserving extraction + architecture guards); phase 8.6 medium (~250+ LOC of workflow
status helpers + setup/discoverability UX + tests); phase 8.7 small–medium (~150+ LOC of ownership matrix,
ownership descriptors, IA/copy alignment, and tests); phase 9 medium (~250+ LOC of Playwright fixtures/specs +
QA runbook/artifacts); phase 10 small–medium (~150+ LOC/scripts plus QA artifact, depending how many findings
are fixed inline); phase 11 small–medium (~150+ LOC/screenshots/copy/layout/a11y fixes + UX polish report,
depending how many findings are fixed inline). Test LOC dominates.
Each output-changing phase is gated on the in-app schema + DANDI/Spyglass **rules**; the actual
trodes_to_nwb → NWB Inspector (dandi) → dandi-validate → Spyglass round-trip is deferred to a single
pre-cutover task (no Python/Spyglass environment now).

**Caveat:** these are rough lower bounds. The [UX mistake-prevention contract](shared-contracts.md#ux-mistake-prevention-contract)
adds real UI per phase — the export preflight summary + repair-action routing (phase 1), identity
side-by-side comparison modals (phase 3), pinned-config badges + reconfiguration confirmation (phase 2),
controlled region/canonical inputs (phases 4–5), task/video camera + epoch selectors and task-name identity
checks (phase 6), and the opto enabled-state surface (phase 8) — which can push several phases meaningfully
above the LOC noted. Phase 8.5 should keep those semantics intact while moving them behind stable domain
helpers. Phase 8.6 then makes the workflow/setup path visible enough for browser QA to test it, and Phase 8.7
removes the remaining animal-vs-day-vs-epoch ownership ambiguity before browser scenarios lock in the UI. Phase 9 verifies
those UX paths in browser, including viewport/reachability issues that jsdom will miss. Phase 10 adds a scripted
Claude-run usability/proper-behavior audit over the integrated experience. Phase 11 adds a professional UX
polish pass over consistency, accessibility, content, responsive layout, and perceived performance. Treat the UX
work as first-class scope, not trim.
