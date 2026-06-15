# Phase 2a — ValidationSummary view model (first concrete slice)

[← back to PLAN.md](PLAN.md) · [overview](overview.md)

Build `buildValidationSummaryViewModel(workspace, animalId?)` — a pure function that reproduces today's
ValidationSummary page state (counts, per-day rows, batch-export readiness) as data. This is the first
slice because ValidationSummary already sits closest to export truth; proving the
[`WorkflowSeverity`](shared-contracts.md#workflowseverity) vocabulary here de-risks the other three.

**No UI change in this phase** — the page still renders its current logic; the builder is added and
tested in parallel. Wiring is [phase-3](phase-3-wire-pages.md).

**Inputs to read first:**

- [src/pages/ValidationSummary/validationSummaryRows.ts](../../../src/pages/ValidationSummary/validationSummaryRows.ts)
  — `buildRows` (178), `buildAnimalRows` (279), `dayChipDisplay` (89), `deriveChip` (57),
  `buildAnimalDaysByKey` (157), `subjectLabel` (285). This is ~90% of the builder already, in non-VM
  shape; the builder wraps/normalizes it to the contract types.
- [src/pages/ValidationSummary/useValidationSummaryActions.ts:84](../../../src/pages/ValidationSummary/useValidationSummaryActions.ts)
  — the action-time readiness/export derivation. Read this to reproduce today's disabled-reason copy and
  preflight shape in the VM tests, but do NOT move live hook logic in this phase (the builder is additive).
- [src/pages/ValidationSummary/index.tsx](../../../src/pages/ValidationSummary/index.tsx) — what the page
  actually renders (counts row, the two `<ExportReport>` groups' messages, the disabled-reason copy), so
  the VM reproduces those exact strings.
- [src/domain/workflowStatus.ts:413,490](../../../src/domain/workflowStatus.ts),
  [src/domain/dayRecovery.ts:71](../../../src/domain/dayRecovery.ts) — the rules behind row status +
  recovery; called via `validationSummaryRows`, not reimplemented.
- The phase-0 [logic-inventory.md](phase-0-inventory.md) ValidationSummary section.

**Contracts referenced:**
[`WorkflowSeverity`](shared-contracts.md#workflowseverity),
[`DayRowViewModel`](shared-contracts.md#dayrowviewmodel),
[`WorkflowAction`](shared-contracts.md#workflowaction),
[severity mapping invariant](shared-contracts.md#severity-mapping-invariant) — map `DAY_LIFECYCLE` →
`WorkflowSeverity`; do not re-derive readiness.

## Tasks

- Create `src/viewModels/validationSummaryViewModel.ts` exporting
  `buildValidationSummaryViewModel(workspace, animalId?)` and the page VM type:

  The batch-export preflight and the run reports use the shared
  [`DayPreflightViewModel`](shared-contracts.md#extended-vocabulary-realized-contract-gap-types) and
  [`BatchRunResultViewModel`](shared-contracts.md#extended-vocabulary-realized-contract-gap-types)
  (Phase 1) — do not re-coin per-day preflight or report shapes here:

  ```ts
  export interface ValidationSummaryViewModel {
    scope: { animalId?: string; subhead?: string };      // animal-scoped vs all-animals
    counts: { valid: number; error: number; incomplete: number };
    days: DayStatusRowViewModel[];                        // extends DayRowViewModel with the table's scan cells
    batchExport: {
      action: WorkflowAction;                            // 'Export Valid Only' (+disabledReason when blocked)
      preflight: {                                        // null until the user opens the confirm step
        days: DayPreflightViewModel[];
        warnings: IssueViewModel[];                       // outstanding warnings to acknowledge
        confirm: WorkflowAction;                          // disabledReason while warnings unacked
      } | null;
    };
    reports: BatchRunResultViewModel;                    // skipped / overridden / failed / stale / validate-errors
    empty?: { message: string };
  }
  ```

  Define `DayStatusRowViewModel` as `DayRowViewModel` plus the table-specific scan fields
  (`configVersionLabel`, `cameras`, `cameraCalibration`, `opto`) the current `DayStatusTable` shows;
  the orphan/wrong-owner state rides on the shared `DayRowViewModel.recovery`/`recoveryDetail`/
  `exportEligibility` fields rather than bespoke flags. Keep all fields plain data.
- Create `src/viewModels/dayRowViewModel.ts` in this phase. It owns the shared row-status→label + recovery
  + action translation from the existing `SummaryRow`/day-list concepts into `DayRowViewModel`. 2b must
  reuse this helper rather than creating a parallel day-row path.
- Implement the builder by composing `buildRows`/`buildAnimalRows` and additive pure derivation helpers in
  `src/viewModels/validationSummaryViewModel.ts` (counts, disabled reason, empty copy). Map each row's
  `DAY_LIFECYCLE` variant → `WorkflowSeverity` via the
  [invariant table](shared-contracts.md#severity-mapping-invariant). Reuse `dayChipDisplay` for the
  label so the chip text is identical.
- Do not extract or delete code from `useValidationSummaryActions` yet. If the builder needs a pure helper
  that is currently buried in that hook, copy the current behavior into the additive builder with an
  explicit parity test. The live hook cleanup happens in Phase 3-a when the page is actually wired, so
  there is no hidden behavior edit in this phase.
- `batchExport.action.command` is `{ id: 'exportValidOnly' }` (resolved in phase-4); for now the page keeps
  calling the hook handler — the VM just *describes* the action + disabled reason.

## Deliberately not in this phase

- Do NOT wire `index.tsx` / `DayStatusTable.tsx` to consume the VM (that's [phase-3](phase-3-wire-pages.md)).
  The page logic stays; the builder runs only in tests.
- Do NOT move live derive code out of `useValidationSummaryActions` (that's [phase-3](phase-3-wire-pages.md)
  3-a, when the page and hook are rewired together under the full page gate).
- Do NOT touch the write handlers (validate-all, run-export) — they become phase-4 commands.
- Do NOT build the other three surfaces' VMs.

## Validation slice

| Test | Asserts |
| --- | --- |
| `validationSummaryViewModel.test.ts` — parity, all-animals | For a realistic multi-animal workspace, `vm.counts` and each `vm.days[i].statusLabel`/`status` equal what `buildRows` + the page render today. |
| — parity, animal-scoped | `buildValidationSummaryViewModel(ws, 'remy')` reproduces the scoped header subhead + only remy's rows. |
| — severity mapping | A day in each `DAY_LIFECYCLE` state maps to the [invariant](shared-contracts.md#severity-mapping-invariant) `WorkflowSeverity`. |
| — export-blocked reason | When no day is exportable, `vm.batchExport.action.disabledReason` equals the current page copy. |
| — recovery rows | dangling / recovered-unlinked / wrong-owner days produce the right `recovery` + `statusLabel` ('Re-link to export', 'Missing record', 'belongs to …'). |
| — empty | Empty workspace → `vm.empty.message`; zero days for an animal → scoped empty copy. |
| baselines (existing) | `npx vitest run baselines` still byte-identical (builder is additive). |

## Fixtures

Reuse the realistic workspace builder the existing ValidationSummary/RecordingDays tests use
(`buildRealisticWorkspace` and friends in `src/pages/**/__tests__/`); add edge fixtures (empty,
corrupt-config day, orphan day) in the test file or a shared `conftest`-equivalent helper under
`src/viewModels/__tests__/fixtures/`.

## Review

Dispatch `code-reviewer` against the diff. Confirm: builder reproduces current statuses/labels/counts
(parity tests are real comparisons, not tautologies); live hook logic was NOT moved in this additive
phase; the shared `dayRowViewModel` helper was introduced here for 2b reuse; the VM is plain data
(no functions/JSX); `npm run typecheck`/`lint:ci`/`baselines` green; no
plan-phase strings in code; the "Deliberately not in this phase" list held (no `index.tsx` wiring).
