# Phase 0 — Inventory the component-trapped logic

[← back to PLAN.md](PLAN.md) · [overview](overview.md)

Goal: produce a written map of every workflow decision the four modern surfaces currently make
*inline*, and where each should live (a `src/domain/*` function that already exists, a new view-model
builder, or the phase-4 command layer). This is a **doc-only deliverable** — no source change — and it
is the spec the Phase 2 builders are checked against. Ships as one PR adding the map under this plan
directory.

**Inputs to read first:**

- [src/pages/AnimalWorkspace/index.tsx](../../../src/pages/AnimalWorkspace/index.tsx),
  [AnimalSetupCard.tsx](../../../src/pages/AnimalWorkspace/AnimalSetupCard.tsx),
  [DayList.tsx](../../../src/pages/AnimalWorkspace/DayList.tsx),
  [RecordingDaysTab.tsx](../../../src/pages/AnimalWorkspace/RecordingDaysTab.tsx),
  [ExistingDataReview.tsx](../../../src/pages/AnimalWorkspace/ExistingDataReview.tsx) — the workspace hub.
- [src/pages/AnimalView/index.tsx](../../../src/pages/AnimalView/index.tsx) — `SECTION_GROUPS`, the
  per-tab status ring, active-tab resolution, `?field=` repair anchor.
- [src/pages/DayEditor/](../../../src/pages/DayEditor/) — `DayEditorStepper`, `OverviewStep`,
  `ValidationStep`, `BadChannelsEditor`, `Breadcrumb`, `IssueOwnershipHint`, the `DayEditorContext`.
- [src/pages/ValidationSummary/index.tsx](../../../src/pages/ValidationSummary/index.tsx),
  [validationSummaryRows.ts](../../../src/pages/ValidationSummary/validationSummaryRows.ts),
  [useValidationSummaryActions.ts](../../../src/pages/ValidationSummary/useValidationSummaryActions.ts),
  [DayStatusTable.tsx](../../../src/pages/ValidationSummary/DayStatusTable.tsx),
  [EffectiveDayReview.tsx](../../../src/pages/ValidationSummary/EffectiveDayReview.tsx).
- The domain truth functions listed in [overview.md → integration points](overview.md#current-codebase-integration-points)
  — so the map can mark "already pure (reuse)" vs "trapped (extract)".

**Contracts referenced:** none yet (Phase 0 informs the contract; if the audit finds a decision the
[shared vocabulary](shared-contracts.md) can't express, record it as a contract gap for phase-1).

## Tasks

- Create `.claude/docs/plans/workflow-view-models/logic-inventory.md`. For each of the four surfaces,
  produce a table with columns: **Decision · Where computed today (file:line) · Inputs it reads ·
  Target home (existing domain fn / new builder / command) · Notes**.
- Cover, per surface, at minimum these decision categories (from the request): section status; export
  readiness; blocking vs warning issues; next repair target; inherited/default values; animal-level vs
  day-level ownership; button enabled/disabled reasons; empty/corrupt/import recovery states.
- For each decision, classify the target home explicitly:
  - **REUSE** — already a pure `src/domain/*` function (cite it). The builder will call it.
  - **EXTRACT** — display/label/action assembly currently inline in a component; moves into a builder.
  - **COMMAND** — a write/intent currently expressed as nested-object edits; moves to phase-4.
- Flag any decision the [`WorkflowSeverity`/`WorkflowAction`/`IssueViewModel`](shared-contracts.md)
  vocabulary cannot represent as a **contract gap** with a proposed field — this is the single most
  valuable output, because it's cheaper to fix the contract now than after four builders adopt it.
- Add a short "duplication" subsection: list decisions computed in **more than one** surface with
  slightly different logic (e.g. day status→label appears in `DayList` and `validationSummaryRows`),
  since these are the highest-value consolidations.

## Deliberately not in this phase

- No `src/` changes. No types file (that's [phase-1](phase-1-contracts.md)). No builders. Resisting "I
  can see the builder, let me just write it" is the point — the map must exist first so the builders are
  checked against a known target, and so contract gaps surface before code commits to the vocabulary.

## Validation slice

| Test | Asserts |
| --- | --- |
| (none — doc deliverable) | n/a |

Review verifies completeness instead: every decision category above appears for every surface, every row
has a file:line "where computed today", and every contract gap has a proposed field.

## Fixtures

None.

## Review

Before opening the PR, dispatch `code-reviewer` (or a human) against the new doc. Confirm:
- All four surfaces covered; all decision categories present per surface.
- Every "where computed today" cites a real file:line (spot-check 5).
- Target-home classification (REUSE/EXTRACT/COMMAND) is filled for every row.
- Contract gaps (if any) are explicit with a proposed `shared-contracts.md` change, so phase-1 can
  incorporate them.
- The doc does not reference plan phase numbers in any code (there is no code) and stays under this plan
  directory.
