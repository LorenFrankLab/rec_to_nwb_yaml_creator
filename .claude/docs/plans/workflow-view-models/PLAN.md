# Workflow View-Models Implementation Plan

**Status:** Not started.

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
