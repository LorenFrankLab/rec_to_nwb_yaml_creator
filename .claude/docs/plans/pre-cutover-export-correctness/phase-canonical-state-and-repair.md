# Raw → canonical → repair: make the corruption contract impossible to violate

## Why this exists

The validation contract (see `phase-validation-contract.md`) surfaces, routes, gates, and
enforces corruption *at the issue*. But the two STATE TRANSITIONS it sits between were left
ad-hoc, and that's where the recurring findings live:

1. **raw → canonical** — every component re-derives "is this safe to render" with its own
   `|| []` / `Array.isArray` / `isRecord`, so one site always lags (a `cameras || []` that
   preserves a corrupt string before `.reduce`; a `configurationHistory.find` with no guard).
2. **issue → repair** — issues carry a *destination* ("Fix in Animal Editor"), not a *fix*,
   so a repair can land on a blank empty state and the promised reset never happens.

Decision (user, 2026-06-05): **full structural, phased & gated, executable repair commands.**
Three principles to make true:
- raw state MAY be corrupt; canonical UI state MUST be safe; export MUST stay blocked until
  raw corruption is explicitly repaired.
- corrupt persisted state is a FIRST-CLASS state — never hidden, never silently dropped.
- the contract is enforced structurally, not by remembering to guard each component.

## The mechanisms

### Phase 1 — shape-safe canonical read layer (`src/state/workspaceSelectors.js`)
One module owns the ONLY `asArray`/`asRecord` guards. Every component and the merge read raw
state through `getAnimalCameras`, `getConfigHistory`, `getDataAcqDevices`, `getAnimalSubject`,
`getAnimalExperimenters`, `getExperimenterNames`, `getDaySession`, `getDayTasks`,
`getDayAssociatedVideos/Files`, `getDayBehavioralEvents`, `getDayKeywords`, `getAnimalDayIds`.
A test forbids ad-hoc `\.<field> \|\| \[\]` raw access on these fields, so the
"another component used `|| []`" class can't regress. Kills the three HIGH crashes structurally.

### Phase 2 — executable repair commands on issues
Issues gain an optional `repairCommand` (serializable): e.g. `{type:'resetAnimalField',
field:'cameras', value:[]}`, `{type:'rebuildConfigHistory'}`, `{type:'resetDataAcqDevice'}`,
`{type:'resetDayCollection', field:'tasks'}`, `{type:'removeOverrideKey', key}`,
`{type:'resetDeviceOverrides'}`. One `applyRepairCommand(command, {animalId, dayId, animal, actions})`
executor maps each to a store write. RepairActions renders an actual **Reset/Repair** button
that EXECUTES the command (no dead navigation), threaded from DayEditorStepper (which owns
`animal`/`day`/`actions`).

### Phase 3 — destination repair banners
A shared `RawCorruptionBanner` (given raw `animal`/`day`) surfaces the owned raw-shape
corruptions with their reset commands, rendered at the destination (CamerasSection,
HardwareConfigStep, DevicesStep, OverviewStep). So "Fix in Animal Editor" lands on a visible
"Reset corrupt cameras to none" control, not the "Add First Camera" empty state. The read-only
`session_id`-loss case becomes an honest "reset session" command, not a dead `none`.

### Phase 4 — summaries never drop corrupt records
ValidationSummary shows an explicit ERROR row for a day reference that resolves to a
missing/non-record record (instead of dropping it), so validate/export accounting can't report
only the surviving rows while a corrupt day hides.

## Execution
Each phase its own gated commit on `phase-7-converter-truth-contracts`. The latest review's six
findings are absorbed as the first instances. Gate each: full vitest (`--test-timeout=30000`),
125 golden baselines byte-identical, 0 lint errors, clean build, no plan/review tags in shipped
code. Do NOT merge to `modern`; pause before merge.

## Latest-review findings → phase
- DevicesStep reconfig `configurationHistory.find` crash → Phase 1
- HardwareConfig `data_acq_device.entries()` crash → Phase 1
- configurationHistory surfaced-but-not-repairable → Phase 2 (`rebuildConfigHistory`/reset)
- cameras corruption hidden as empty state → Phase 3 banner (+ Phase 2 reset command)
- ValidationSummary drops corrupt days → Phase 4
- malformed `day.session` loses read-only `session_id` → Phase 3 (reset-session command)
