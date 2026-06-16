# Phase 3 — Day-editor frame + Day / Failed-channels / DIO tabs

[← back to PLAN.md](PLAN.md) · [overview](overview.md) · [shared-contracts](shared-contracts.md)

Replace the day editor's chrome and three of its four tabs. New header (scope-boundary card, day chips,
autosave indicator, **issue-driven readiness bar**) + tabs **Day / Epochs / Failed channels / DIO**. This
phase builds Day, Failed channels, DIO and the frame; the **Epochs** tab temporarily renders the existing
tasks editor as a bridge until [Phase 4](phase-4-epoch-grid.md) replaces it. Adds the day-level
`dataFolder` field. Design: [day-editor.html](day-editor.html) (Day / Failed-channels / DIO tabs).

**Inputs to read first:**

- [src/pages/DayEditor/DayEditorStepper.tsx](../../../src/pages/DayEditor/DayEditorStepper.tsx) — the current 5-section editor (frame replaced here). **Note `DayEditorProvider` (~:25) + `useDayEditorContext`:** the steps reach their data through `DayEditorContext`, **not props** (`DayEditorStepper.tsx:46`; `TasksEpochsStep.tsx:30` reads `useDayEditorContext()`). The new frame **must keep the provider wired** or the bridge + tabs won't render.
- [src/pages/DayEditor/{OverviewStep,DevicesStep,BehavioralEventsStep,TasksEpochsStep}.tsx](../../../src/pages/DayEditor/) — Overview→Day, Devices(bad channels)→Failed channels, Behavioral→DIO; TasksEpochs bridges the Epochs tab.
- [src/viewModels/dayEditorViewModel.ts](../../../src/viewModels/dayEditorViewModel.ts) — `buildDayEditorViewModel` (shell load-state, breadcrumb, step statuses, Overview slice) to reshape into the 4-tab model.
- [src/domain/dayValidationComposer.ts:51](../../../src/domain/dayValidationComposer.ts) — `validateDay`: the readiness bar's source.
- [src/domain/badChannels.ts](../../../src/domain/badChannels.ts) (`buildProbeWideBadChannelMap:168`, `toggleMark:131`, `validBadChannelIds:201`, `isMultiShankGroup:51`) + [src/domain/badChannelMonotonicity.ts](../../../src/domain/badChannelMonotonicity.ts) + [src/ntrode/ChannelMap.jsx](../../../src/ntrode/ChannelMap.jsx) — Failed-channels grid.
- [src/validation/behavioralEvents.ts:18,37](../../../src/validation/behavioralEvents.ts) — DIO collision gates.
- [src/state/workspaceTransitions.ts:435](../../../src/state/workspaceTransitions.ts) — `createDayRecord` carry list (add `dataFolder`).

**Contracts referenced:**

- [Issue-driven readiness](shared-contracts.md#issue-driven-readiness) (designs) — bar reads `validateDay`, never a local check.
- [Data-folder model](shared-contracts.md#6-data-folder--filename-derivation) — this phase adds the **field + carry-forward**; the *derivation* is [Phase 4](phase-4-epoch-grid.md).
- [Status vocabulary](shared-contracts.md#3-status-vocabulary), Phase 0 primitives (`ReadinessBar`, `AnimalScopeCard`, `StatusPill`).

## Tasks

- New `DayEditorFrame` replacing `DayEditorStepper`'s chrome **while keeping `DayEditorProvider` wired** (the steps/tabs read `useDayEditorContext`, not props — see Inputs): breadcrumb; title (date); day chips (`config v{n}`, opto badge, `↩ carried from {date}`, lifecycle `StatusPill`); `SaveIndicator` (reuse `src/pages/DayEditor/SaveIndicator.tsx`); the **`AnimalScopeCard`** (animal-static line + "Edit animal setup" link, summary from `buildAnimalViewModel`); the **`ReadinessBar`** fed `validateDay(day, mergeDayMetadata(animal, day), animal, animalDays)`; tab bar (Day / Epochs / Failed channels / DIO), active tab = local state (keep the existing free-navigation + `Alt+←/→`). The Day / Failed-channels / DIO tab bodies are derived from `OverviewStep`/`DevicesStep`/`BehavioralEventsStep`, which consume the context — so the provider must wrap the tab panels.
- **Day tab** (from `OverviewStep`): `session_id` (derived, read-only), **`Data folder`** (new editable `day.dataFolder` field, helper "set once · carried forward"), weight (`g`), session description, experimenters (default from team), opto-protocol card (laser DIO / FSGui file / camera reference). Writes via `updateDay`.
- **`day.dataFolder` model**: add optional `dataFolder?: string` to the day shape (`workspaceTypes`), thread through `updateDay`/`applyDayUpdates`, and **add it to the `createDayRecord` carry list** (`workspaceTransitions.ts:435`) so a new same-block day inherits the folder. It is **off-export** (merge ignores it) — additive, no schema bump, no baseline change.
- **Failed channels tab** (from `DevicesStep` bad-channel editor): probe-wide grid per probe (reuse `ChannelMap` + `badChannels` helpers); multi-shank marks consolidate to the first ntrode row via `buildProbeWideBadChannelMap`; carried marks ringed; toggling reads/writes `day.deviceOverrides.bad_channels` via `updateDay`. Un-marking a channel bad on an earlier same-config day → in-context confirm + ack (`badChannelMonotonicity` + `day.state.badChannelRemovalAcks`); unacknowledged regression blocks export (already enforced by `validateDay`/`badChannelUnfailIssues`).
- **DIO tab** (from `BehavioralEventsStep`): carry-forward summary by default — Din/Dout two-column read-only view of `day.behavioral_events` with "↩ carried from {date} · unchanged"; "Edit · rewired the rig" reveals the editor; name/description collision gate reuses `duplicateBehavioralEventNames`/`…Descriptions`. Copy-from-animal bootstrap reuses the existing affordance.
- Retire `OverviewStep`, `DevicesStep`, `BehavioralEventsStep` (folded into Day / Failed-channels / DIO). `TasksEpochsStep` is **kept as the Epochs-tab bridge** (removed in Phase 4). `ValidationStep`/`ExportStep` are **kept until [Phase 5](phase-5-export-preview.md)** (the readiness bar replaces the inline Validation step's role; Export moves to the preview screen). Name these removals in the PR.
- CHANGELOG: new day-editor frame + Day/Failed-channels/DIO tabs + data-folder field.

## Deliberately not in this phase

- The **Epochs grid** — [Phase 4](phase-4-epoch-grid.md). The Epochs tab bridges the old tasks editor here.
- **Filename derivation** — Phase 4 (`fileNaming.ts`). This phase only adds the folder *field* + carry-forward.
- The **export-preview** screen — [Phase 5](phase-5-export-preview.md); `ExportStep`/`ValidationStep` stay until then.
- **Task-catalog *activation*** — not a thing: the catalog is already the live shape (the Epochs bridge here, and Phase 4, reuse it). See [shared-contracts §2](shared-contracts.md#2-substrate-to-reuse).

## Validation slice

| Test | Asserts |
| --- | --- |
| `dayEditorViewModel.test.ts` (extend) | 4-tab model; day chips (config/opto/carried/lifecycle); readiness-bar input = `validateDay` issues |
| `DayFrame.test.tsx` | scope card + edit-animal link; autosave indicator; readiness quiet when no errors, loud + field links when blocking; `Alt+←/→` navigates tabs |
| `DayTab.dataFolder.test.tsx` | editing `dataFolder` writes `day.dataFolder` via `updateDay`; a carried-forward day inherits the source folder; **export is byte-identical with and without `dataFolder`** |
| `FailedChannels.test.tsx` | multi-shank mark consolidates to first ntrode row (`buildProbeWideBadChannelMap`); carried marks ringed; un-mark prompts confirm + records ack; unacknowledged regression blocks export (gate) |
| `DioTab.test.tsx` | carry-forward Din/Dout summary by default; "Edit" reveals editor; duplicate name/description gate fires (`behavioralEvents` helpers) |
| `baselines` | byte-identical (Day/Failed-channels/DIO edits write the same arrays/overrides as today; `dataFolder` is off-export) |

## Fixtures

A day with a multi-shank probe + carried bad-channel marks + a prior same-config day (for monotonicity); an
opto day (opto-protocol card + DIO Laser); a day carried forward (for the `dataFolder` carry + "carried
from" chip). Reuse golden fixtures for the byte-identity assertions.

## Review

Dispatch `code-reviewer`. Confirm: readiness bar reads `validateDay` (no local gate); failed-channels uses
the shared `badChannels`/monotonicity helpers (multi-shank consolidation correct); `dataFolder` is
off-export and baselines unchanged; the three retired steps are actually removed; Epochs bridge + Validation/
Export retained with a note; lint/typecheck/e2e/baselines green.
