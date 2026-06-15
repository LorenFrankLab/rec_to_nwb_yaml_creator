# Phase 5 — Boundary-test matrix (the safety net)

[← back to PLAN.md](PLAN.md) · [overview](overview.md)

The builder phases (2a–2d) each test their own surface; Phase 4 tests the descriptor command layer the
view-models actually emit. This phase adds the **cross-cutting scenario matrix** at the view-model +
descriptor-command boundary — the cases that span surfaces or exercise the nasty states — so the UI
experiments in [phase-6](phase-6-workflow-ui.md) have a safety net that stays green while the rendering
shape changes. Net-new tests only; no source change.

**Inputs to read first:**

- All four builders (`src/viewModels/*ViewModel.ts`) and the descriptor command handlers
  (`src/viewModels/commands/`).
- [shared-contracts.md → severity mapping](shared-contracts.md#severity-mapping-invariant) — the matrix
  locks this in.
- Phase-0 [logic-inventory.md](phase-0-inventory.md) — confirm every decision category has at least one
  boundary case here.

**Contracts referenced:** all of [shared-contracts.md](shared-contracts.md) — the matrix is the
executable specification of the contract.

## Tasks

- Create `src/viewModels/__tests__/scenarios.test.ts` (or one file per scenario family) driving the
  builders and VM-emitted command descriptors through the matrix below. Each scenario is built once as a
  fixture and asserted across the relevant builders (so e.g. an "animal setup issue affecting day export"
  case is checked in BOTH `animalViewModel` rings AND `dayEditorViewModel` export gate — proving the
  surfaces agree).
- Where two builders should agree on a shared fact (day status, a blocking section), assert they produce
  the same `WorkflowSeverity`/label for the same input — this is the cross-surface consistency guarantee
  that pure-per-surface tests miss.
- Consolidate the shared fixtures into one helper module (`src/viewModels/__tests__/fixtures/`) so the
  matrix and the per-builder tests draw from one source (DRY; no copy-paste workspaces).
- Add a descriptor coverage assertion over the shared fixtures: every `WorkflowAction.command.id` emitted
  by a builder has a Phase-4 handler. This is not a promise that every editable form write is commandified;
  it only locks the descriptor boundary that exists today.

## The matrix (each row → at least one assertion per relevant builder)

| Scenario | Asserts |
| --- | --- |
| empty workspace | every builder returns its empty/zero shape (no throw); counts 0. |
| one incomplete animal (no subject) | AnimalView setup rings `todo`/`error`; AnimalWorkspace setup card shown. |
| complete animal, no days | AnimalView `Recording Days` count 0; ValidationSummary scoped empty copy. |
| day missing export-required field | DayEditor step `error` + issue with repair; ValidationSummary row `error` + count; AnimalWorkspace day row `error` label — all three agree. |
| imported corrupt/incomplete day | builders surface the corrupt/recovery state (no throw); `mergeDayMetadata` throw caught → one `error` issue. |
| animal-setup issue affecting day export | AnimalView ring `error` AND DayEditor export `disabledReason` AND the day's row `error` — cross-surface agreement. |
| bad-channel warning vs blocker | a warning bad-channel → `warning`; an un-acked monotonic removal → `error` + export blocked + ack action; after ack → unblocked. |
| ready-to-export vs already-exported | `DAY_LIFECYCLE.READY` → `ready` 'Ready to export'; `EXPORTED` → `ready` 'Exported'/'Validated' per current labels (distinct, both exportable). |
| orphan / missing / wrong-owner day recovery | each `DayRowViewModel.recovery` + label correct; ValidationSummary + AnimalWorkspace agree on the same day. |
| severity mapping (full) | one case per row of the [severity invariant](shared-contracts.md#severity-mapping-invariant). |

Mark any scenario that drives a full builder over a large fixture as slower; keep them in the standard
`vitest run` lane (still fast — pure functions).

## Deliberately not in this phase

- No source changes — if a scenario reveals a builder bug, fix it in that builder's phase scope (or a
  follow-up), and reference it; do not patch logic inside the test file.
- No UI/component tests here — those belong to the pages; this is the VM/command safety net.
- No field-write command coverage for intents Phase 4 intentionally deferred (`updateDayOverview`,
  `markBadChannels`, `updateTaskEpochs`, `updateCameraUsage`, etc.). Those remain covered by existing
  component/store tests until a future UI experiment promotes them.

## Validation slice

The phase *is* the validation slice. Definition of done: every matrix row has a passing assertion in at
least one builder, every cross-surface row asserts agreement between the surfaces named, the full
severity-mapping table is covered, and every VM-emitted command descriptor has a handler. `npx vitest run`
+ `baselines` green.

## Fixtures

The consolidated `src/viewModels/__tests__/fixtures/` helper (built up across 2a–2d), extended with the
corrupt-import and cross-surface cases. One canonical builder per scenario; no per-test duplication.

## Review

Dispatch `code-reviewer`. Confirm: every matrix row covered; cross-surface rows actually assert agreement
(not the same builder twice); descriptor command ids are handler-covered; tests are non-trivial (real
fixtures, real comparisons — see `testing-anti-patterns`); fixtures are shared, not copy-pasted; no source
logic changed in test files.
