# Phase 1 — Define the view-model contracts

[← back to PLAN.md](PLAN.md) · [overview](overview.md)

Create the `src/viewModels/` layer and its shared types. Small, foundational PR: every builder imports
these. No builders, no consumers yet — this is the keystone the read-model phases depend on.

**Inputs to read first:**

- [shared-contracts.md](shared-contracts.md) — the canonical type definitions to realize verbatim
  (plus any contract-gap fields surfaced by [phase-0](phase-0-inventory.md)).
- [src/domain/dayLifecycle.ts:28](../../../src/domain/dayLifecycle.ts),
  [src/domain/sectionStatus.ts:27](../../../src/domain/sectionStatus.ts),
  [src/domain/dayRecovery.ts:71](../../../src/domain/dayRecovery.ts) — the existing enums the
  `WorkflowSeverity` mapping references (so the doc-comments cite real sources).
- [tsconfig.json](../../../tsconfig.json) + the TypeScript note in
  [CLAUDE.md](../../../CLAUDE.md) — new `.ts` is type-checked under `strict`; run `npm run typecheck`
  (the build does NOT type-check).

**Contracts referenced:** [all of shared-contracts.md](shared-contracts.md) — this phase IS their code
realization. Do not weaken the "plain data only" rule.

## Tasks

- Create `src/viewModels/types.ts` containing exactly the exported types from
  [shared-contracts.md](shared-contracts.md): `WorkflowSeverity`, `WorkflowAction`, `WorkflowCommand`,
  `IssueViewModel`, `SectionViewModel`, `DayRowViewModel` — plus any field added by a phase-0 contract gap (update
  shared-contracts.md in the same PR if so, keeping the doc and the code in lockstep).
- Each type carries a NumPy-style-equivalent TS doc-comment: what it represents and (for severity) the
  source→`WorkflowSeverity` mapping, citing the domain enum file. Do NOT reference plan phases in the
  doc-comments (they ship in the codebase).
- Add a `src/viewModels/index.ts` barrel re-exporting the types (builders import from `../viewModels`).
- Confirm the `@/`-alias decision is irrelevant here (no alias use); import via relative paths to match
  the build-included source (`vite.config.ts` resolves `@/` but no shipped source uses it).
- Page-level composite view-models (`ValidationSummaryViewModel`, `AnimalWorkspaceViewModel`,
  `AnimalViewModel`, `DayEditorViewModel`) are **not** defined here — each lives in its own builder
  phase, composed from these shared parts. Only the genuinely shared vocabulary lives in `types.ts`.

## Deliberately not in this phase

- No builders (phases 2a–2d). No command types (phase-4). No page edits (phase-3). A types-only PR is
  intentionally small; its job is to freeze the shared vocabulary so the four builders adopt one shape.

## Validation slice

| Test | Asserts |
| --- | --- |
| `npm run typecheck` | `src/viewModels/types.ts` compiles under `strict` with no errors. |
| `viewModels/__tests__/types.smoke.test.ts` | Trivial construction of one of each type type-checks and round-trips (guards against an accidental `any`; e.g. a `WorkflowAction` with `disabledReason` and a `WorkflowCommand.target` set). |

## Fixtures

None.

## Review

Before opening the PR, dispatch `code-reviewer`. Confirm:
- Types match shared-contracts.md exactly (if changed, the doc was updated in the same PR).
- No React/DOM/CSS/function-valued fields leaked in (plain-data rule held).
- `npm run typecheck` + `npm run lint:ci` clean; no plan-phase references in doc-comments.
- The smoke test is non-trivial (constructs real shapes; not `assert true`).
