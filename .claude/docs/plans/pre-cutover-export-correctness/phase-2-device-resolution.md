# Phase 2 — Device resolution: export the configured probes and day bad-channels

[← back to PLAN.md](PLAN.md) · [overview](overview.md) · [designs](designs.md#device-resolution-model)

Goal: close the two P0 data-loss defects in `resolveDayConfig` — configured probes omitted from export
(Finding A) and day-level bad-channel edits dropped (Finding B) — so the workspace path exports the
electrode groups, ntrode map, and bad channels the user actually configured. This phase changes
**new-path output bytes**; follow the parity contract.

**Model decided (B).** The device-resolution model is settled — [designs.md](designs.md#device-resolution-model):
snapshots are the source of truth, `animal.devices` mirrors the latest snapshot, and reconfiguration
**forks before the geometry edit**. No brainstorm checkpoint remains; implement B.

**Inputs to read first:**

- [src/state/workspaceUtils.js:84-111](../../../../src/state/workspaceUtils.js) — `resolveDayConfig`,
  the function this phase rewrites.
- [src/state/workspaceUtils.js:150-249](../../../../src/state/workspaceUtils.js) — `mergeDayMetadata`;
  confirms the ntrode map (`:228`) and electrode groups (`:227`) come solely from `resolveDayConfig`.
- [src/state/useWorkspace.js:117-174](../../../../src/state/useWorkspace.js) — `createAnimal` initial
  snapshot (`:164`); [src/state/useWorkspace.js](../../../../src/state/useWorkspace.js) —
  `createConfigurationSnapshotAndApplyForward`, the atomic reconfiguration store action.
- [src/pages/DayEditor/ReconfigWizard.jsx:63-117](../../../../src/pages/DayEditor/ReconfigWizard.jsx) —
  the fork-before-edit confirmation path that the model change must keep working.
- [src/pages/DayEditor/DevicesStep.jsx:54-61,130-140](../../../../src/pages/DayEditor/DevicesStep.jsx) —
  how day bad channels are read (`:60`) and written to `deviceOverrides.bad_channels.{ntrodeId}` (`:137`).

**Contracts referenced:**

- [User mental-model contract](shared-contracts.md#user-mental-model-contract) — physical configuration is a
  recording-day fact; historical days must not look like they edit live latest devices.
- [Export-resolution source-of-truth contract](shared-contracts.md#export-resolution-source-of-truth-contract).
- [UX mistake-prevention contract](shared-contracts.md#ux-mistake-prevention-contract) — day device editing
  must show the pinned configuration version/range context.
- [Parity & golden-fixture contract](shared-contracts.md#parity-golden-fixture--round-trip-contract) — new-path
  fixtures updated deliberately; the 125 legacy baselines stay byte-identical.

**Designs referenced:** [Device-resolution model](designs.md#device-resolution-model),
[Day bad-channel merge](designs.md#day-bad-channel-merge).

## Tasks

- **Task 1 — `updateAnimal` mirrors the latest snapshot (Finding A core).** Make the `updateAnimal`
  `devices` branch (`useWorkspace.js:206-208`) write the new devices into **both** `animal.devices` and
  `configurationHistory[latest].devices` (via `structuredClone`). This is what makes configuring probes
  reach export. `resolveDayConfig` then reads `configurationHistory[day.configurationVersion].devices`
  (the pinned snapshot) — remove the current fallback to latest/first when the pinned version is missing,
  so corruption fails loud instead of exporting the wrong probe config. (`animal.devices` is the editor
  mirror; the snapshot is authoritative.)
- **Task 2 — reconfiguration is fork-before-edit.** Reshape `ReconfigWizard` per
  [designs.md](designs.md#reconfiguration-wizard-reshaping): on "Reconfigure from day X" it forks a new
  version with `createConfigurationSnapshotAndApplyForward(animalId, config, dayIds)`, where `config.devices`
  is a clone of the latest snapshot and `dayIds` is the affected chronological range. The action creates the
  snapshot, returns N+1, and repoints the selected days in one atomic transition — **before** the user edits
  geometry. Drop the live-vs-snapshot diff UI. Do not reintroduce the removed two-action store API; keep the
  pure transition helpers and update `reconfigWorkflow.integration.test.js` / `ReconfigWizard.test.jsx` to
  the model (earlier days keep the frozen old config; later days get the new one).
- **Task 3 — day bad-channel merge (Finding B).** In `resolveDayConfig`, after selecting the ntrode list,
  apply `day.deviceOverrides.bad_channels` onto each ntrode's `bad_channels` per
  [designs.md](designs.md#day-bad-channel-merge), normalizing the key with `String(n.ntrode_id)`. Clone —
  never mutate a snapshot. Also account for the current `trodes_to_nwb` caveat: for electrode groups with
  multiple ntrode rows, the converter currently reads only the first row's `bad_channels` while building the
  electrode table. Either coordinate a converter fix before claiming multi-shank bad-channel correctness, or
  keep the phase's converter-facing bad-channel proof to single-ntrode groups and **flag the multi-shank
  case as a known limitation** to verify in the deferred pre-cutover round-trip (and a converter fix).
- **Task 4 — DevicesStep renders the effective config (Finding: bad-channel UI source).** `DevicesStep`
  currently renders live `animal.devices` (`DevicesStep.jsx:34`); make it render
  `resolveDayConfig(animal, day)` so the bad-channel editor edits the day's *pinned* ntrode list (correct
  for historical days), matching what the export uses. Show a compact configuration badge in `DevicesStep`
  (e.g. "Configuration v2, applied from 2026-06-04") and mark whether it is the latest or historical so
  users know they are editing day-level bad channels against a pinned snapshot, not changing geometry.
- **Task 4b — reconfiguration confirmation UX.** The fork-before-edit wizard confirms the affected day range
  before it creates the new version, then lands the user in the Animal Editor with a clear "editing latest
  configuration vN" context. It must not show the old live-vs-snapshot diff; it should show the days that
  will move to the new version and the days that stay pinned to the old one.
- **Task 5 — new-path parity fixtures.** Update `workspaceBuilders.js` / the new-path parity references so
  a configured session's expected export includes the probes and merged bad channels. Review the byte diff
  (probes appearing, bad-channels applied) and confirm each change is intended.
- **Task 6 — docs + in-app gate.** Update `docs/REFACTOR_CHANGELOG.md`. The downstream round-trip is
  deferred (no Python/Spyglass env now) — gate this phase on the in-app schema + DANDI/Spyglass rules. Use a
  fixture whose devices already carry integer IDs + required fields so this phase can prove its resolution
  and bad-channel behavior without waiting for phase 4's UI-generation fixes. Always assert the new path is
  **semantically** complete (probes + bad-channels present and equal to the configured devices). General
  zero-error for UI-generated devices is still phase 4.

## Deliberately not in this phase

- **Integer IDs / required `description` / `targeted_location`** — phase 4. This phase may still emit
  string IDs; the bad-channel merge must be written to survive phase 4's type change (test it).
- **Hardware Config camera / data-acq wiring** — phase 3.
- **New validation rules** for dangling/out-of-range references — phase 6.

## Validation slice

| Test | Asserts |
| --- | --- |
| `configuring probes after creation reaches export` *(unit)* | after `updateAnimal({devices})` with electrode groups, the day pinned to the latest version yields non-empty `electrode_groups` / ntrode map (`configurationHistory[latest]` now mirrors the devices). **Direct P0-A reproduction.** |
| `mergeDayMetadata includes the configured probes` *(unit)* | `mergeDayMetadata(animal, day).electrode_groups` / `…ntrode…` equal the configured devices (**semantic** completeness — not full schema validity, which awaits phase 4's integer IDs / required fields). |
| `merged output is schema-valid for an already-valid-shaped fixture` *(unit)* | with a fixture whose devices carry integer IDs + `description`/`targeted_location`, `schemaValidation(mergeDayMetadata(...))` is zero-error — proves resolution doesn't *introduce* invalidity. (General zero-error for UI-generated devices is phase 4.) |
| `day bad-channel overrides are applied to the exported ntrode map` *(unit)* | with `day.deviceOverrides.bad_channels[id] = [2]`, the merged ntrode `id` has `bad_channels: [2]`; other ntrodes unchanged; snapshot not mutated. **P0-B reproduction.** |
| `bad-channel merge survives an integer ntrode_id` *(unit)* | an integer `ntrode_id` against a string-keyed override map still merges (guards phase 4). |
| `missing pinned configuration fails closed` *(unit)* | a day whose `configurationVersion` has no matching snapshot throws an actionable error; it does not fall back to latest/first and export the wrong geometry. |
| `DevicesStep edits the day's effective ntrode list` *(integration)* | on a historical day, the bad-channel editor renders the pinned snapshot's ntrodes (from `resolveDayConfig`), not live `animal.devices`. |
| `DevicesStep shows pinned configuration context` *(integration)* | the devices step displays the day configuration version and whether it is latest/historical; the text updates after reconfiguration. |
| `reconfiguration yields correct per-day config (fork-before-edit)` *(integration)* | reuse `makeReconfigWorkspace`: the atomic action forks from day X and pins the affected range; editing geometry afterward leaves earlier days on the frozen old config and later days on the new one; no two-action store API is required. |
| `reconfiguration confirmation shows affected days` *(integration)* | before fork, the wizard lists the day range that will move to the new version and the earlier days that remain pinned; confirmation happens before geometry edit. |
| `phase-2 corrected sample is schema-valid` *(integration)* | a schema-shaped sample exercising configured probes + day bad-channel merge has zero `schemaValidation` errors and passes the in-app DANDI/Spyglass rules. |
| `golden-yaml.baseline.test.js` (existing) | **byte-identical** — these are legacy fixtures and must not change. |

Automated app tests are Vitest; mark the reconfiguration test as integration. The real downstream round-trip
is deferred to a single pre-cutover task (see the round-trip contract), not a gate on this phase.

## Fixtures

`makeReconfigWorkspace()` ([reconfigWorkspace.js](../../../../src/state/__tests__/fixtures/reconfigWorkspace.js))
for reconfiguration; a "configured-after-creation" animal (live devices populated, initial snapshot
empty) synthesized inline or added to `test-fixtures.js` for the P0-A test; existing golden + new-path
parity fixtures (the latter regenerated per the parity contract).

## Review

Dispatch `pr-review-toolkit:code-reviewer` and `pr-review-toolkit:silent-failure-hunter` (export/parity).
Confirm: the model matches the confirmed Open Question 1 decision; `resolveDayConfig` never mutates live
devices/snapshots; the 125 legacy baselines are byte-identical; the new-path fixture diff is intentional
and documented; reconfiguration tests assert the model, not a weakened version; no plan/phase strings in
code or test names.
