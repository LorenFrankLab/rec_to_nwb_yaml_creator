# App code organization review

Date: 2026-06-05

Scope: architecture and maintainability review of the current app structure. This is not a
bug review and does not replace the phase gates.

Plan disposition: the pre-QA subset of this review is now incorporated as
[Phase 8.5 — Domain boundaries and ownership cleanup](phase-8-5-domain-boundaries-ownership-cleanup.md).
Treat the phase file as the executable source of truth. This note remains the architectural rationale and
should be refreshed at the start of Phase 8.5 before code changes begin.

## Refreshed inventory at Phase 8.5 start (verified against the branch)

The review below predates phases 1–8 in wording but is structurally accurate. Verified current state
before extraction, with the exact symbols/targets each task moves:

- **App-wide validation/repair routing lives in `src/pages/DayEditor/validation.js`** (906 lines). It
  exports `validateDay`, `computeStepStatus`, `computeDevicesStatus`, `computeEpochsStatus`,
  `dayOverrideIssues`, `groupErrorsByStep`, `stepIdForIssue`, `repairTargetForIssue`,
  `animalEditorStepForFieldPath`, `STEP_LABELS`, `SURFACE_BY_CODE`, `ANIMAL_EDITOR_STEPS`, plus the
  page-only field-blur helper `validateField`. Phase 8 added opto/fs_gui routing here
  (`SURFACE_BY_CODE.partial_configuration/multiple_excitation_sources`, the `fs_gui` branches in
  `stepIdForIssue`/`deriveSurfaceFromPath`, the Optogenetics entry in `ANIMAL_EDITOR_STEPS`) — that
  routing moves intact.
  - **Consumers (verified):** same-folder `DayEditorStepper` (`computeStepStatus`), `ExportStep`
    (`computeStepStatus`, `validateDay`, `STEP_LABELS`), `OverviewStep` (`validateField` — page-only,
    stays), `RepairActions` (`repairTargetForIssue`, `STEP_LABELS`), `ValidationStep`
    (`groupErrorsByStep`, `validateDay`); and the two **cross-page (sibling) importers that are the
    real violations** — `pages/AnimalEditor/AnimalEditorStepper.jsx`
    (`animalEditorStepForFieldPath`) and `pages/ValidationSummary/index.jsx` (`computeStepStatus`).
  - **Task 1 target:** move everything except `validateField` to `src/domain/validation.js`; repoint
    all consumers (including Day Editor's own) at the domain module; leave `validateField` in
    `pages/DayEditor/validation.js`.
- **Bad-channel + override converter semantics live in render bodies (Task 2 targets):**
  - `pages/DayEditor/BadChannelsEditor.jsx` — multi-shank detection (`getProbeShanks().length > 1 &&
    ntrodes.length > 1`), later-row mark translation (`translateLaterRowMarks`), the probe-wide
    migration union (`handleProbeWideToggle`), and invalid-mark detection.
  - `pages/AnimalEditor/ChannelMapEditor.jsx` — the same multi-shank/translation/migration logic plus
    `validateChannelMaps` (probe-local range, multi-shank first-row, scalar-tolerance).
  - `pages/DayEditor/DevicesStep.jsx` — `validateBadChannels` (multi-shank first-row range) and the
    malformed/stale/shadowing override-cleanup decisions (`wholeOverridesMalformed`,
    `badChannelContainerMalformed`, `staleOverrideKeys`, `corruptValueKeys`, `presentGeometryKeys`),
    which **mirror `dayOverrideIssues`**.
  - **Task 2 target:** pure `src/domain/badChannels.js` (multi-shank rule, later-row translation,
    probe-wide map build, invalid-mark interpretation, range check) and `src/domain/deviceOverrides.js`
    (`classifyDeviceOverrides`), with a test that the classifier corresponds 1:1 to `dayOverrideIssues`.
- **Risky workspace transitions live inline in `src/state/useWorkspace.js` (Task 3 targets):** the
  `updateAnimal` devices branch (mirrors the edit into the latest snapshot, lines ~228-248),
  `addConfigurationSnapshot`/`applyConfigurationForward`/`rebuildConfigurationHistory`, `createDay`
  (pins `configurationVersion = getConfigHistory(animal).length`), and `updateDay`'s malformed-session
  guard. Electrode-group/channel-map mutation recipes live in
  `pages/AnimalEditor/AnimalEditorStepper.jsx` (`handleSaveGroup`, `confirmDeleteGroup`,
  `handleCopyConfirm`, `handleSaveChannelMap`).
  - **Task 3 target:** pure `src/state/workspaceTransitions.js` with the four named transitions;
    `useWorkspace` keeps hydration, autosave, debounce, localStorage, the existence-check throws, and
    the `workspaceRef`/version-return orchestration.
- **`src/state/repairCommands.js`** is the executable-repair executor (current command set:
  `resetDayCollection`, `resetAnimalCameras`, `resetDataAcqDevice`, `rebuildConfigurationHistory`,
  `resetDeviceOverrides`, `removeDeviceOverrideKey`, `resetBadChannelOverrides`,
  `removeBadChannelOverrideKey`, `resetDaySession`) — already a state-layer module; not moved.
- **`pages/DayEditor/shadowExport.js`** is pure export-truth behavior (encoder-stability check) that a
  sibling page (`ValidationSummary`) imports cross-folder. **Task 1/4 target:** move to
  `src/domain/shadowExport.js` so no page imports export-truth from a sibling page.

### Deferred at Phase 8.5 (recorded, not expanded)

- **Issue #4 (legacy/workspace facade in `store.js`)** — legacy-path relocation/removal is explicitly
  out of scope for this phase (and gated on the v3 cutover). Not touched.
- **Issue #5 (schema-aligned types)** — type generation/sync is deferred to post-cutover per the phase
  scope guard; only done if type drift directly blocks the phase (it does not).
- **`pages/DayEditor/SaveIndicator.jsx`** is a shared **presentational** component imported by
  `AnimalEditor/HardwareConfigStep`. It is not app-wide domain behavior, so relocating it to
  `src/components` is out of this phase's scope; the architecture guard allowlists this single
  presentational cross-page import and forbids all others.

## Verdict

The app is moving in the right direction, but it is not yet cleanly organized. The recent
raw-state, canonical-read, validation, and executable-repair work has introduced the right
architectural seams. The remaining risk is that several of those seams still live inside page
modules and large React components, so app-wide domain behavior can still become page-specific
by accident.

Short version: the architecture is now professional enough to support cutover hardening, but
it should get one follow-up organization pass before the codebase settles.

## What is strong

- `src/state/workspaceSelectors.js` is the right abstraction for imported/persisted state:
  raw state may be corrupt, canonical UI reads are safe, and validation still sees the raw
  corruption. The structural guard test is especially valuable.
- `src/utils/deviceNormalization.js` has the right normalization contract: exact legacy values
  can migrate, but corrupt values are preserved so validation can block export instead of
  laundering them into plausible YAML.
- `src/state/workspaceUtils.js` now contains real domain boundaries:
  `resolveDayConfig` owns effective probe resolution and `mergeDayMetadata` owns the export
  object. That is much better than scattering export semantics through components.
- `src/state/repairCommands.js` is a good pattern. Validation issues can carry serializable
  repair commands, and one executor maps them to store writes. This is a major improvement
  over repair buttons that merely navigate to a destination and hope the user knows what to do.
- The test strategy is serious: baseline tests, schema/rules tests, repairability matrix,
  Playwright coverage, accessibility tests, and structural guard tests. This is one of the
  healthiest parts of the repo.

## Main organization issues

### 1. App-wide validation/routing lives under `pages/DayEditor`

`src/pages/DayEditor/validation.js` is no longer just Day Editor validation. It exports step
status, issue ownership, repair routing, Animal Editor deep-link routing, and the day validation
composition used by other surfaces such as `ValidationStep`, `ExportStep`, `RepairActions`, and
`AnimalEditorStepper`.

That means it is domain/workspace validation code living in a page folder.

Recommended direction:

- Move issue ownership, repair routing, step status, and day validation composition into a
  domain module such as `src/domain/validation`, `src/workspace/validation`, or
  `src/state/validation`.
- Leave page-specific rendering helpers in `pages/DayEditor`.
- Add an architecture guard test that page modules cannot import domain behavior from sibling
  page modules.

### 2. Converter/domain semantics still live inside React components

Several components contain behavior that is really converter/domain logic:

- `src/pages/AnimalEditor/ChannelMapEditor.jsx` embeds multi-shank bad-channel semantics and
  migration rules.
- `src/pages/DayEditor/BadChannelsEditor.jsx` owns probe-wide bad-channel selection and later-row
  migration behavior.
- `src/pages/DayEditor/DevicesStep.jsx` mirrors malformed/stale/shadowing override detection and
  repair behavior.
- `src/pages/AnimalEditor/AnimalEditorStepper.jsx` owns electrode-group/channel-map mutation
  recipes.

These components are understandable historically, but they are fragile places for converter
truth. A small UI refactor can accidentally change export behavior.

Recommended direction:

- Extract pure helpers for bad-channel semantics, channel-map validation, override cleanup,
  and electrode-group/channel-map mutations.
- Keep React components focused on rendering, interaction state, and calling named domain
  functions.
- Test the pure helpers directly, then keep lighter component tests for wiring and UX.

### 3. `useWorkspace` is still a large mixed-responsibility hook

`src/state/useWorkspace.js` owns hydration, autosave, persistence notices, selectors, and all
workspace mutations. Some actions are complex enough to be domain transitions, especially
configuration snapshot edits, reconfiguration, day creation, day updates, and repair writes.

Recommended direction:

- Extract pure transition functions, or move the workspace state to a reducer.
- Keep side effects in the hook: load, save, debounce, and persistence status.
- Put domain mutations in testable functions with clear invariants:
  create animal, update animal devices, add snapshot, apply configuration forward,
  rebuild configuration history, create day, update day, delete day.

### 4. Legacy and workspace flows still share a facade

`src/state/store.js` intentionally merges legacy form state and workspace state. That is useful
before cutover, but it creates two active models and two import/export pathways:

- legacy single-session model through `useLegacyForm` and `features/importExport.js`
- workspace model through animal/day state and `mergeDayMetadata`

Recommended direction after cutover:

- Move legacy-only code under `src/legacy` or remove it once it is no longer the default path.
- Keep compatibility tests and golden baselines, but do not let legacy hooks remain mixed into
  the primary store indefinitely.
- Make the workspace export path the only production path once cutover is complete.

### 5. JSDoc types are useful but stale in places

`src/state/workspaceTypes.js` is helpful, but it does not fully match the schema in some spots.
Examples include electrode-group targeted fields and optogenetics field names. Stale types are
risky in this repo because schema names map directly to converter and Spyglass behavior.

Recommended direction:

- Treat `nwb_schema.json` as the source of truth.
- Generate types from the schema or add a TypeScript/JSDoc sync check.
- Keep the type layer thin and mechanically verified rather than manually curated.

## Recommended follow-up phase

Add a short architecture cleanup phase after export-correctness/opto work and before Playwright QA:

### Phase 8.5: domain boundaries and ownership cleanup

Goal: make the current good contracts structural, not convention-based.

Tasks:

1. Move app-wide validation and repair routing out of `pages/DayEditor`.
2. Extract channel-map, bad-channel, and override-repair semantics from React components into
   pure domain helpers.
3. Extract workspace mutations from `useWorkspace` into pure transition functions or a reducer.
4. Add architecture guard tests for forbidden page-to-page domain imports.
5. Add or generate schema-aligned types for the workspace/export model only if type drift is directly
   blocking the phase; otherwise defer this to post-cutover cleanup.

Acceptance:

- No page imports domain logic from another page folder.
- Components render and dispatch; converter/export behavior lives in pure helpers.
- The workspace hook owns effects and store wiring, not all domain transitions inline.
- Existing golden baselines remain byte-identical.
- Full test suite, lint, build, and Playwright gates still pass.

Scope guard:

- Do this before Phase 9 so browser QA audits a stable architecture.
- Do not remove the legacy flow in this phase.
- Do not rewrite the whole store to a reducer in this phase.
- Do not change export semantics except to preserve existing behavior through purer helpers.

## Immediate guardrail

When adding a new repair command such as `resetDaySession`, do not stop at the executor. The
complete path should include:

- an issue producer that emits the command,
- a repairability-matrix row proving the command clears the issue,
- a destination UI control or banner that exposes it,
- integration coverage proving the user can execute it from the validation/export surface.

This is the same invariant that made `configurationHistory` repair trustworthy: issue,
ownership, visible action, executable repair, and post-repair validation must move together.
