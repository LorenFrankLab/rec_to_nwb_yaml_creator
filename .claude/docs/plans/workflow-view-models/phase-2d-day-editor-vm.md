# Phase 2d — DayEditor view model

[← back to PLAN.md](PLAN.md) · [overview](overview.md)

Build `buildDayEditorViewModel(workspace, dayId)` — the largest surface, done last so the shared
vocabulary is proven on the other three first. Ship it as **four sub-slices** rather than one large PR:
2d-1 shell/steps/breadcrumb, 2d-2 overview field sources, 2d-3 issues/repair/export gate, 2d-4
bad-channel monotonicity/ack state. Each sub-slice extends the same builder and keeps previous tests
green.

**Inputs to read first:**

- [src/pages/DayEditor/](../../../src/pages/DayEditor/) — `DayEditorStepper` (step status ring),
  `OverviewStep` (session/experiment fields + the inherited/default subject metadata display),
  `ValidationStep` (issue list grouping), `BadChannelsEditor` (failed-channels + monotonic-removal ack),
  `Breadcrumb`, `IssueOwnershipHint`, and the `DayEditorContext` (read what it derives vs stores).
- [src/domain/workflowStatus.ts:413,490](../../../src/domain/workflowStatus.ts) — `getDayRowStatus`,
  `getDayWorkflowStatus` (step/overall status).
- [src/state/workspaceUtils.ts:357](../../../src/state/workspaceUtils.ts) — `mergeDayMetadata` (effective
  day metadata; the inherited/default values come from the animal→day merge — surface "inherited" vs
  "overridden" explicitly, the way `EffectiveDayReview` already distinguishes them).
- [src/domain/badChannelMonotonicity.ts](../../../src/domain/badChannelMonotonicity.ts) — the un-mark-without-ack blocker (`bad_channel_unfailed_without_ack`)
  and the carry-forward/ack model (see CLAUDE.md "Bad channels are day-owned").
- `src/domain/workflowOwnership.ts` + `src/domain/repairRouting.ts` — `ownershipForIssue` /
  `repairTargetForIssue`, the source for [`IssueViewModel`](shared-contracts.md#issueviewmodel) ownership +
  reach + repair (already consumed by `IssueOwnershipHint`/`RepairActionButton`).
- Phase-0 [logic-inventory.md](phase-0-inventory.md) DayEditor section — the richest, so lean on it.

**Contracts referenced:** [`IssueViewModel`](shared-contracts.md#issueviewmodel),
[`SectionViewModel`](shared-contracts.md#sectionviewmodel),
[`WorkflowSeverity`](shared-contracts.md#workflowseverity), [`WorkflowAction`](shared-contracts.md#workflowaction).

## Tasks

- Create `src/viewModels/dayEditorViewModel.ts` exporting `buildDayEditorViewModel` and:

  ```ts
  export interface DayEditorViewModel {
    breadcrumb: Array<{ label: string; href?: string }>;
    steps: SectionViewModel[];                  // Overview / Devices / Tasks / Behavioral / Validation / Export
    overall: WorkflowSeverity;
    overview: {
      fields: Array<{
        key: string; label: string; value: string;
        source: 'day' | 'inherited' | 'default'; // inherited/default surfaced, not hidden
        issue?: IssueViewModel;
      }>;
    };
    issues: IssueViewModel[];                    // the ValidationStep list, classified + repair-routed
    badChannels: {
      failed: number[];
      blockedRemovals: IssueViewModel[];         // bad_channel_unfailed_without_ack, with ack action
    };
    export: { action: WorkflowAction };          // disabledReason when blocked
  }
  ```

- Sub-slice **2d-1 shell/steps/breadcrumb**: create the builder skeleton, `breadcrumb`, `steps`, and
  `overall`. Compose `getDayWorkflowStatus`/existing step-status helpers; catch corrupt merge/config
  errors and represent them as `error` state rather than throwing.
- Sub-slice **2d-2 overview field sources**: add `overview.fields` with `source: 'day' | 'inherited' |
  'default'`. Effective values come from `mergeDayMetadata` compared against the day override vs animal
  default vs schema/default value; do not reimplement merge rules.
- Sub-slice **2d-3 issues/repair/export gate**: add `issues` and `export.action`. Issue classification
  comes from `ownershipForIssue`/`repairTargetForIssue`; export blocking reason comes from existing
  domain export-gate helpers.
- Sub-slice **2d-4 bad-channel monotonicity/ack**: add `badChannels.failed` and `badChannels.blockedRemovals`
  from `badChannelMonotonicity`, with ack actions represented as command descriptors.
- Compose existing functions throughout: step status from `getDayWorkflowStatus`; effective field values +
  their `source` from `mergeDayMetadata`; issue classification from `ownershipForIssue`/`repairTargetForIssue`;
  bad-channel blockers from `badChannelMonotonicity`. Do NOT reimplement any of these — the builder
  assembles them.
- The inherited/default distinction is the highest-value extraction here (it's the request's
  "inherited/default values" item and is currently spread across `OverviewStep`/`EffectiveDayReview`):
  every overview field declares `source`, so the UI can later show "inherited from animal" / "default"
  badges without re-deriving.
- `mergeDayMetadata` THROWS on a corrupt config — the builder MUST catch and surface a single
  `error`-severity issue (mirroring how `DayList`/`getDayRowStatus(...,null)` handle it today), never
  throw out of the builder. This guard lands in 2d-1 so later sub-slices inherit it.
- Map all step rings + overall + export gate via the [severity invariant](shared-contracts.md#severity-mapping-invariant).

## Deliberately not in this phase

- No wiring of any DayEditor component (phase-3). No write/command handlers — bad-channel marking,
  field edits, ack, config change are all phase-4 commands (this VM only *describes* their actions +
  disabled reasons). No new validation rules.

## Validation slice

| Test | Asserts |
| --- | --- |
| `dayEditorViewModel.test.ts` — 2d-1 steps/breadcrumb | step `SectionViewModel.status`es + `overall` reproduce the current stepper for ready / draft / needs-fixing days; crumbs reproduce `Workspace › Animal: X › Day: date`; corrupt config yields one `error` issue, no throw. |
| — 2d-2 inherited/default | a field set on the day → `source:'day'`; unset but on the animal → `'inherited'`; unset everywhere → `'default'`; values match `mergeDayMetadata`/`EffectiveDayReview`. |
| — 2d-3 issues/export | each issue's `ownership`/`reachesBeyondDay`/`repair` matches `ownershipForIssue`/`repairTargetForIssue` (i.e. what `IssueOwnershipHint` renders); export disabled reason matches today's Export step. |
| — 2d-4 bad channels | an un-acked monotonic removal yields a `blockedRemovals` entry with the ack `WorkflowAction`; export `disabledReason` reflects the block. |
| baselines | byte-identical. |

## Fixtures

Reuse the DayEditor/RecordingDays test fixtures; add: a day with inherited-only fields, a corrupt-config
day, and an un-acked-bad-channel-removal day (shared fixtures dir).

## Review

Dispatch `code-reviewer` for each sub-slice. Confirm: the sub-slice reproduces current behavior (parity
tests are real); `mergeDayMetadata` throw is caught→surfaced (not propagated) starting in 2d-1; builder
composes domain fns (no reimplementation); plain data; typecheck/lint:ci/baselines green; no plan-phase
strings; no component wiring.
