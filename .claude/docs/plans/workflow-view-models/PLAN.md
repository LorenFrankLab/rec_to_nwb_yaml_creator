# Workflow View-Models Implementation Plan

**Status:** Phase 0 complete (logic inventory mapped). Execution shape: **build-all-then-wire** (Open
Question 1 resolved). Next: Phase 1 (`types.ts`).

| Phase | Status |
| --- | --- |
| 0 — logic inventory | ✅ done — [logic-inventory.md](logic-inventory.md) |
| 1 — contracts/types | ⏳ next |
| 2a — ValidationSummary VM | ▫️ pending |
| 2b — AnimalWorkspace VM | ▫️ pending |
| 2c — AnimalView VM | ▫️ pending |
| 2d — DayEditor VM (4 sub-slices) | ▫️ pending |
| 3 — wire pages | ▫️ pending |
| 4 — commands | ▫️ pending |
| 5 — boundary tests | ▫️ pending |
| 6 — workflow UI | ▫️ pending |

Make the modern UI *render* workflow state instead of *discovering* it. Today the four modern surfaces
(ValidationSummary, AnimalWorkspace, AnimalView, DayEditor) each recompute section status, export
readiness, blocking-vs-warning, next repair target, inherited/default values, and button enabled/disabled
reasons inline. This plan inserts a pure, tested **view-model layer** (read) plus an **intent-command
layer** (write) between the existing `src/domain/*` truth functions and the pages, so pages become thin
renderers and the workflow logic becomes independently testable — the foundation for safely iterating on
workflow UX.

## Reading order

For agent invocation, **load only the slice you need**:

1. **Working a specific phase?** Open the matching phase file — each is self-contained (inputs to read,
   contracts it depends on, tasks, validation slice, fixtures, review).
2. **Need shared semantics / the type vocabulary?** [shared-contracts.md](shared-contracts.md).
3. **Need broader scope / integration points / risks / open questions?** [overview.md](overview.md).

## Files

- [overview.md](overview.md) — scope, non-goals, integration points (file:line), risks, rollout, open questions.
- [shared-contracts.md](shared-contracts.md) — the view-model vocabulary (`WorkflowSeverity`,
  `WorkflowAction`, `IssueViewModel`, `SectionViewModel`, `DayRowViewModel`) + the severity-mapping invariant.
- [logic-inventory.md](logic-inventory.md) — the Phase-0 output: every inline workflow decision per
  surface (file:line + REUSE/EXTRACT/COMMAND), the consolidated contract gaps (C1–C19, the Phase-1
  spec), the domain gaps (D1–D6), and the cross-surface duplication list.
- Phases (each ships as a separable PR unless noted):
  - [phase-0-inventory.md](phase-0-inventory.md) — map the component-trapped logic (doc-only deliverable).
  - [phase-1-contracts.md](phase-1-contracts.md) — `src/viewModels/types.ts` (the shared vocabulary in code).
  - [phase-2a-validation-summary-vm.md](phase-2a-validation-summary-vm.md) — `buildValidationSummaryViewModel` (**first concrete slice**) + the shared `dayRowViewModel` helper.
  - [phase-2b-animal-workspace-vm.md](phase-2b-animal-workspace-vm.md) — `buildAnimalWorkspaceViewModel` (reuses shared `dayRowViewModel`).
  - [phase-2c-animal-view-vm.md](phase-2c-animal-view-vm.md) — `buildAnimalViewModel` (section-nav rings).
  - [phase-2d-day-editor-vm.md](phase-2d-day-editor-vm.md) — `buildDayEditorViewModel` (largest; inherited/default + bad-channel + issues).
  - [phase-3-wire-pages.md](phase-3-wire-pages.md) — wire the pages to render the VMs (one PR per surface; DayEditor split into sub-slices).
  - [phase-4-commands.md](phase-4-commands.md) — intent commands wrapping `workspaceActions`.
  - [phase-5-boundary-tests.md](phase-5-boundary-tests.md) — cross-surface scenario matrix (the safety net).
  - [phase-6-workflow-ui.md](phase-6-workflow-ui.md) — enabled UI experiments (a menu + guardrails, not one PR).

Dependency order: 0 → 1 → 2a → {2b, 2c, 2d} → 3 (per page, after that page's 2x) → 4 → 5 → 6. 2b–2d may
proceed in parallel after 2a (2a owns the shared `dayRowViewModel` helper that 2b consumes). See
[overview Open Question 1](overview.md#open-questions) for the build-all-then-wire vs vertical-slice choice.
