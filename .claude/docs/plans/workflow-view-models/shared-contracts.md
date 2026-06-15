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
- [`WorkflowCommand`](#workflowcommand)
- [`IssueViewModel`](#issueviewmodel)
- [`SectionViewModel`](#sectionviewmodel)
- [`DayRowViewModel`](#dayrowviewmodel)
- [Extended vocabulary (realized contract-gap types)](#extended-vocabulary-realized-contract-gap-types)
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
  /** Hash route to navigate to, e.g. `#/animal/remy/electrode-groups?field=…`.
   *  Mutually informative with `command`: a link-style action sets `href`; a write-style
   *  action sets `command`. */
  href?: string;
  /** Intent descriptor resolved by the command layer. NOT a function — the component maps
   *  `command.id` to a bound handler. The builder supplies stable target/context; the component
   *  supplies only transient user-entered values (for example a typed date). */
  command?: WorkflowCommand;
  /** When present the action is disabled and this string is the user-facing reason (drives
   *  `aria-describedby` + `title`). A non-null `disabledReason` means "render disabled". */
  disabledReason?: string;
  /** The kind of setup action, distinct from the label, so a renderer can style/announce the verb
   *  consistently: `setup` (not started), `fix` (blocking error), `review` (done). */
  intent?: 'fix' | 'setup' | 'review';
}
```

## WorkflowCommand

Plain-data command metadata carried by an action. This prevents pages from re-discovering the target of a
write action while still keeping builders callback-free.

```ts
export interface WorkflowCommand {
  /** Intent identifier resolved by `commandHandlers`, e.g. `createRecordingDay`, `deleteDay`, `exportValidOnly`. */
  id: string;
  /** Stable target/context known by the builder: day id, animal id, section key, field path, etc. */
  target?: {
    animalId?: string;
    dayId?: string;
    section?: string;
    fieldPath?: string;
  };
  /** Optional plain-data payload known at render time. Components may merge in transient form values. */
  payload?: Record<string, unknown>;
  /** User-facing caveat to surface before a destructive command runs (e.g. already-downloaded files
   *  are not deleted). Present only when the command has a consequence worth confirming. */
  confirmCaveat?: string;
}
```

Phase 4 may tighten `id` into a literal union once the full command inventory is known. Until then the
contract still requires the target/payload to be plain data, not nested workspace objects or callbacks.

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
  countLabel?: string;     // pre-rendered count token when issueCount isn't the display ('N ready', 'used', 'incomplete')
  showCount?: boolean;     // a not-started ('todo') section hides its count
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
  /** Day classification from `classifyAnimalDays` (src/domain/dayRecovery DAY_STATUS) — the frozen
   *  `DayStatus` union (see Extended vocabulary). */
  recovery: DayStatus;
  actions: WorkflowAction[]; // duplicate / delete / unlink / re-link, with disabledReason where relevant
  /** Lifecycle refinement when status === 'ready' — a saved day reads 'validated', a downloaded day
   *  'exported'; status alone collapses all three to 'ready'. */
  lifecycle?: 'ready' | 'validated' | 'exported';
  /** Whether a metadata-valid day is actually exportable, or blocked pending re-link. */
  exportEligibility?: 'eligible' | 'blocked-needs-relink';
  /** Structured recovery detail for non-'ok' rows (owner description + repair) — see DayRecoveryViewModel. */
  recoveryDetail?: DayRecoveryViewModel;
}
```

## Extended vocabulary (realized contract-gap types)

These types/fields are the [logic-inventory](logic-inventory.md) contract gaps the team chose to land
in the shared vocabulary up front (rather than per-builder), so the four builders adopt one shape. They
live in `src/viewModels/types.ts` alongside the core types. All are plain data and obey the same hard
rule. The additive fields on the core types above (`WorkflowAction.intent`, `WorkflowCommand.confirmCaveat`,
`SectionViewModel.countLabel`/`showCount`, `DayRowViewModel.lifecycle`/`exportEligibility`/`recoveryDetail`)
are part of this set.

Closed vocabularies are frozen as real unions; the day-editor step status reuses the domain
`StepStatus` (`src/domain/stepStatus`) to keep its 4-state fidelity rather than collapsing into
`WorkflowSeverity`:

```ts
/** The closed DAY_STATUS set (src/domain/dayRecovery); builders translate the string-typed enum onto it. */
export type DayStatus =
  | 'ok' | 'dangling_reference' | 'recovered_unlinked' | 'orphan_no_owner' | 'wrong_owner';

// StepStatus is re-exported from src/domain/stepStatus: 'valid' | 'incomplete' | 'error' | 'pending'.

/** Structured recovery detail for a day not in its normal place — complements DayRowViewModel.recovery. */
export interface DayRecoveryViewModel {
  status: DayStatus;          // DAY_STATUS classification (dayRecovery)
  ownerDescription?: string;  // 'Belongs to <owner>', from describeOwner
  message?: string;           // the recovery note shown on the row
  repair?: WorkflowAction;    // re-link / unlink / remove reference
}

/** What one day will contribute to a batch export — the preflight "what this file will contain" scan. */
export interface DayPreflightViewModel {
  dayId: string;
  label: string;              // subject + date
  configLabel: string;        // e.g. 'config v2 (latest)'
  groups: number;
  failedChannels: number;
  cameras: number;
  opto: string;
  warnings: IssueViewModel[]; // non-blocking issues to acknowledge before export
  error?: string;             // set when the day could not be merged/scanned
}

/** One bucket of a batch run's per-day outcomes. */
export interface BatchRunReportViewModel {
  kind: 'skipped' | 'overridden' | 'failed' | 'stale' | 'validate-error';
  items: Array<{ dayId: string; subjectId: string; date: string; detail?: string }>;
}

/** The result of a validate-all / batch-export run: a summary message plus per-outcome reports. */
export interface BatchRunResultViewModel {
  message: string;
  reports: BatchRunReportViewModel[];
}

/** One step of the day-editor stepper — a SectionViewModel-shaped item plus the current-step flag. */
export interface StepViewModel {
  key: string;                // 'overview' | 'devices' | 'validation' | 'export' | …
  label: string;
  status: StepStatus;         // domain step status — keeps ⚠ incomplete vs ○ pending distinct
  statusLabel: string;        // 'Complete' | 'Has errors' | 'Not started' …
  issueCount?: number;        // e.g. the Validation step's 'N to fix'
  active: boolean;
  href?: string;
}

/** A day-editor field whose effective value may be day-set, inherited, defaulted, or derived. */
export interface FieldValueViewModel {
  fieldPath: string;          // 'session.weight'
  label: string;
  value: string;              // stringified for display
  source: 'day' | 'inherited' | 'default' | 'derived';
  inheritedFrom?: string;     // when source==='inherited', e.g. 'animal'
  fallbackValue?: string;     // placeholder shown when the day has none
  helpText?: string;
  readOnly?: boolean;
  issue?: IssueViewModel;
}

/** The day-editor export gate: whether export is open, why not, and the blockers that explain it. */
export interface ExportGateViewModel {
  open: boolean;
  reason?: 'validation-errors' | 'incomplete-steps' | 'merge-error' | 'unlinked-day';
  blockingIssues: IssueViewModel[];
  blockingSteps: SectionViewModel[];
  message: string;
  action: WorkflowAction;     // export action, disabledReason while blocked
}

/** Per-channel bad-channel mark state, carrying the monotonicity (prior-bad → needs-ack) rule. */
export interface BadChannelMarkViewModel {
  ntrodeId: string;           // bad-channel maps are keyed by String(ntrode_id) at lookup
  channel: number;            // probe-local index
  marked: boolean;
  priorBad: boolean;          // failed on an earlier same-config day
  requiresAck: boolean;       // un-marking needs an off-export acknowledgement
  acked: boolean;
}

/** A breadcrumb trail; the last item is the current page. */
export interface BreadcrumbViewModel {
  items: Array<{ label: string; href?: string }>;
}

/** The day-editor shell's load state — distinct from a day row's recovery. */
export interface DayEditorShellViewModel {
  state: 'ok' | 'no-day-id' | 'day-not-found' | 'animal-not-found';
  message?: string;
  ownerKey?: string;
}

/** An advisory recovery/cleanup notice (malformed collection, stale override, …) with its repair command. */
export interface RecoveryNoticeViewModel {
  kind: 'malformed-collection' | 'stale-override' | 'badchannel-corruption';
  message: string;
  repair: WorkflowCommand;
}
```

> **Builder adoption.** These shared types replace the per-builder inline shapes the phase sketches
> first drafted: 2a's batch preflight/result use `DayPreflightViewModel`/`BatchRunResultViewModel`; 2c's
> opto count uses `SectionViewModel.countLabel`; 2d's steps use `StepViewModel[]`, overview fields use
> `FieldValueViewModel[]`, export uses `ExportGateViewModel`, bad-channel state uses
> `BadChannelMarkViewModel[]`, plus `BreadcrumbViewModel` / `DayEditorShellViewModel` /
> `RecoveryNoticeViewModel`. Page-level composites (`ValidationSummaryViewModel`, `AnimalWorkspaceViewModel`,
> `AnimalViewModel`, `DayEditorViewModel`) still live in their builder modules, assembled from these parts.

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
