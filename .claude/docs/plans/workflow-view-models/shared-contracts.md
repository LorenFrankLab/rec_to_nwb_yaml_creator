# Shared contracts — workflow view-model vocabulary

[← back to PLAN.md](PLAN.md)

This is the canonical home for the cross-phase types. They live in `src/viewModels/types.ts`
(created in [phase-1](phase-1-contracts.md)) and are referenced by every builder
([2a](phase-2a-validation-summary-vm.md)–[2d](phase-2d-day-editor-vm.md)), the wiring
([phase-3](phase-3-wire-pages.md)), the commands ([phase-4](phase-4-commands.md)), and the boundary
tests ([phase-5](phase-5-boundary-tests.md)).

**Hard rule — these are plain data.** No React, no DOM, no CSS class names, no callbacks/functions, no
`href` construction that assumes a router beyond the existing `#/…` hash strings. A builder returns one
of these objects; a component renders it. If a field would hold a function, it belongs in the command
layer (phase-4), not here.

## Index

- [`WorkflowSeverity`](#workflowseverity)
- [`WorkflowAction`](#workflowaction)
- [`IssueViewModel`](#issueviewmodel)
- [`SectionViewModel`](#sectionviewmodel)
- [`DayRowViewModel`](#dayrowviewmodel)
- [Severity mapping invariant](#severity-mapping-invariant)

## WorkflowSeverity

```ts
export type WorkflowSeverity = 'ready' | 'todo' | 'warning' | 'error';
```

The single severity vocabulary the modern UI renders. **It does NOT replace the existing domain enums**
(`DAY_LIFECYCLE` in [src/domain/dayLifecycle.ts:28](../../../src/domain/dayLifecycle.ts),
`SECTION_STATUS` in [src/domain/sectionStatus.ts:27](../../../src/domain/sectionStatus.ts)) — the builders
MAP those onto `WorkflowSeverity`. See [Severity mapping invariant](#severity-mapping-invariant).

## WorkflowAction

```ts
export interface WorkflowAction {
  label: string;
  /** Hash route to navigate to, e.g. `#/animal/remy/electrode-groups?field=…`. Mutually informative
   *  with `command`: a link-style action sets `href`; a write-style action sets `command`. */
  href?: string;
  /** Intent identifier resolved by the phase-4 command layer (e.g. `createRecordingDay`). NOT a
   *  function — the component maps the id to a bound handler. */
  command?: string;
  /** When present the action is disabled and this string is the user-facing reason (drives
   *  `aria-describedby` + `title`). A non-null `disabledReason` means "render disabled". */
  disabledReason?: string;
}
```

## IssueViewModel

One validation/export issue, already classified — replaces the per-component decision of "is this
blocking?" and "what's the repair?".

```ts
export interface IssueViewModel {
  /** Only blocking (`error`) and non-blocking (`warning`) issues are surfaced as issues. */
  severity: 'error' | 'warning';
  /** Display message — already humanized (no raw snake_case schema keys). */
  message: string;
  /** Schema path for deep-link/scroll anchoring, e.g. `electrode_groups[0].targeted_x`. */
  fieldPath?: string;
  /** Ownership pattern from `ownershipForIssue` (src/domain/workflowOwnership). Verbatim string. */
  ownership: string;
  /** True when fixing this reaches beyond the day in front of the user (blast-radius cue). */
  reachesBeyondDay: boolean;
  /** Where to go to fix it (route + label), from `repairTargetForIssue`. */
  repair?: WorkflowAction;
}
```

## SectionViewModel

```ts
export interface SectionViewModel {
  key: string;          // route :tab segment, e.g. 'electrode-groups'
  label: string;        // 'Electrode Groups'
  status: WorkflowSeverity;
  summary: string;      // one-line state, e.g. '1 group · CA1' or 'Needs fixing — Targeted x is required'
  issueCount: number;
  action?: WorkflowAction; // 'Set up' / 'Fix' / 'Review' link to the section route
}
```

## DayRowViewModel

The recording-day row, identical shape whether rendered in the AnimalWorkspace day list or the
ValidationSummary table.

```ts
export interface DayRowViewModel {
  dayId: string;
  date: string;
  href?: string;             // `#/day/<id>` — absent for unresolvable rows
  status: WorkflowSeverity;
  statusLabel: string;       // 'Ready to export' | 'Needs fixing — …' | 'Re-link to export' | …
  sessionDescription?: string;
  /** Day classification from `classifyAnimalDays` (src/domain/dayRecovery DAY_STATUS): one of
   *  'ok' | 'dangling_reference' | 'recovered_unlinked' | 'wrong_owner'. */
  recovery: string;
  actions: WorkflowAction[]; // duplicate / delete / unlink / re-link, with disabledReason where relevant
}
```

## Severity mapping invariant

Builders MUST map existing domain truth onto `WorkflowSeverity` — they must not re-derive readiness.
The canonical mapping (do not weaken; add cases only with a test):

| Source (existing) | → WorkflowSeverity |
| --- | --- |
| `DAY_LIFECYCLE.READY` / `VALIDATED` / `EXPORTED` | `ready` |
| `DAY_LIFECYCLE.DRAFT` (no blocking error) | `todo` |
| `DAY_LIFECYCLE.NEEDS_FIXING` / any live blocking issue | `error` |
| `SECTION_STATUS.TODO` | `todo` |
| `SECTION_STATUS.DONE` with no blocking issue | `ready` |
| a section in `getAnimalBlockingSections(...)` | `error` |
| a non-blocking warning (e.g. bad-channel advisory) | `warning` |

The functions that already produce the left column:
[`getDayRowStatus`/`getDayWorkflowStatus`](../../../src/domain/workflowStatus.ts) (413, 490),
[`getAnimalSectionStatus`/`getAnimalBlockingSections`](../../../src/domain/sectionStatus.ts) (92, 131),
[`classifyAnimalDays`/`DAY_STATUS`](../../../src/domain/dayRecovery.ts) (71). Builders call these; they
do not reimplement the rules.
