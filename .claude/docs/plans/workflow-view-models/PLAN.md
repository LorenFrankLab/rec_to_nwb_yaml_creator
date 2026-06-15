# Workflow View-Models Implementation Plan

**Status:** Phases 0–2 complete (pure read-layer built/tested/merged). **Phase 3 COMPLETE** — all
seven surfaces (3-a…3-g, DayEditor split into 4) render their view-models; golden baselines
byte-identical throughout; Playwright confirmed each rendered surface. 3-d extracted the shared
`resolveDayOwner` selector and established the VM-in-stepper threading; 3-e wired Overview's read-only
values/help/weight placeholder; 3-f (3-f-1 VM enrichment + 3-f-2 component wiring) enriched
IssueViewModel (ownership action / workflow category / repair display metadata, executable-repair
precedence) + ExportGateViewModel (lifecycle readiness), converted the shared repair components
(RepairActions/RepairActionButton/IssueOwnershipHint) to render IssueViewModel, and wired ValidationStep
+ ExportStep to `vm.issues`/`vm.export` (ExportStep keeps its independent download gate — defense in
depth); 3-g wired the Devices bad-channel monotonicity un-mark gate to `vm.badChannels.marks` (and
fixed `buildBadChannelMarks` to mark a multi-shank first row's probe-wide channels, not just its own
shank's map keys). **Next: Phase 4 (commands)**, then 5 (boundary matrix), 6 (UI).

**Phase-3 carry-forward (incl. the merged Phase-2 review fixups):**

- DayEditor nav is LOCAL (the router only accepts `#/day/:id`; the section nav is button/local-state).
  `buildDayEditorViewModel(workspace, dayId, activeStep)` takes the live current step — the wiring
  passes the stepper's `currentStep`. Steps carry no href (nav via `step.key`). Day-surface repairs +
  export blocking-step actions are `{ id: 'navigateDaySection', target: { dayId, section, fieldPath? } }`
  command descriptors → wire to the stepper's local setCurrentStep + focus (NOT a route).
- AnimalWorkspace `review.rawCorruptionNotices` carries the raw-animal-corruption repairs — render
  those from the VM instead of mounting `RawCorruptionBanner`'s own detection.
- Deferred: extract `resolveDayOwner(workspace, dayId)` into `workspaceSelectors` (the D2 gap) and
  point BOTH `DayEditorStepper` and `buildDayEditorViewModel` at it (touching the stepper is in scope
  during wiring); the builder's inline copy is currently locked by owner-resolution parity tests.

| Phase | Status |
| --- | --- |
| 0 — logic inventory | ✅ done — [logic-inventory.md](logic-inventory.md) |
| 1 — contracts/types | ✅ done — `src/viewModels/types.ts` (full vocabulary) |
| 2a — ValidationSummary VM | ✅ done — `validationSummaryViewModel.ts` + shared `dayRowViewModel.ts` |
| 2b — AnimalWorkspace VM | ✅ done — `animalWorkspaceViewModel.ts` (+ D1 selector) |
| 2c — AnimalView VM | ✅ done — `animalViewModel.ts` |
| 2d — DayEditor VM (4 sub-slices) | ✅ done — `dayEditorViewModel.ts` |
| 3 — wire pages | ✅ done (7 surface PRs: 3-a…3-g all merged) |
| &nbsp;&nbsp;3-a — ValidationSummary | ✅ done — page renders `buildValidationSummaryViewModel` (`chipVariant` now shared; `statusTitle`/`animalKey` local) |
| &nbsp;&nbsp;3-b — AnimalWorkspace | ✅ done — picker + pane render `buildAnimalWorkspaceViewModel`; promoted shared `chipVariant`; VM gained `actionLabel`/`recoveredCount` |
| &nbsp;&nbsp;3-c — AnimalView | ✅ done — section-nav rings/counts + header facts + panel descriptor render `buildAnimalViewModel` |
| &nbsp;&nbsp;3-d — DayEditor shell/steps/breadcrumb | ✅ done — stepper renders `vm.steps`/`vm.shell`/`vm.breadcrumb`; `resolveDayOwner` extracted → selectors |
| &nbsp;&nbsp;3-e — DayEditor overview sources | ✅ done — OverviewStep renders `vm.overview.fields` (read-only values + help + weight placeholder); editable inputs keep day-owned `defaultValue` |
| &nbsp;&nbsp;3-f — DayEditor issues/export | ✅ done — ValidationStep + ExportStep render `vm.issues`/`vm.export`; shared repair components consume `IssueViewModel`; VM enriched (3-f-1) then wired (3-f-2); ExportStep download gate kept independent |
| &nbsp;&nbsp;3-g — DayEditor bad channels | ✅ done — Devices un-mark gate reads `vm.badChannels.marks`; `buildBadChannelMarks` fixed to mark a multi-shank first row's probe-wide channels |
| 4 — commands | ▫️ next |
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
