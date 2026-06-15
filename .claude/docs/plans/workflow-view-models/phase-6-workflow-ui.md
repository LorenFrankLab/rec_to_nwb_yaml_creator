# Phase 6 — Workflow UI iteration (enabled, not prescribed)

[← back to PLAN.md](PLAN.md) · [overview](overview.md)

This is the payoff, not a single PR. With read state (builders) and VM-emitted write descriptors resolved
by commands, then locked by the [Phase 5 matrix](phase-5-boundary-tests.md), the UI can change *shape*
while the view-model/descriptor-command tests stay mostly unchanged. Each idea below is its own
brainstorm → branch → gate → merge cycle; this file is the menu + the guardrails, deliberately without
fixed task lists (the designs aren't decided — that's what `brainstorming` is for when you pick one up).

**Do not start a Phase-6 experiment by editing components blind.** Start from the relevant `build…ViewModel`:
if the UI wants a fact the VM doesn't expose, ADD it to the VM (with a test) first, then render it. The
rule that keeps this phase safe: **components read view-models; they never re-derive workflow state.**

Write-side rule: Phase 4 intentionally commandified only VM-emitted descriptors, not every editable field
write. If a Phase-6 experiment wants to freely swap or redesign editable controls (for example task/epoch
editing, camera usage, overview blur writes, or bad-channel checkbox flows), first promote that specific
write to an intent command in the experiment's branch, add command tests, then change the UI. Do not
pre-commandify unrelated field writes as part of the experiment.

## Enabled experiments (each independent)

- **Checklist-first workspace** — render `AnimalWorkspaceViewModel.setupSections` + `dayRows` as a
  guided checklist; the data already says what's `todo`/`error`.
- **"Next thing to fix" panel** — surface the highest-severity `IssueViewModel` across the animal/day
  (the VMs already classify + route repairs); a cross-VM selector picks the next target.
- **Validation side panel** — a persistent `ValidationSummaryViewModel`-driven panel instead of a
  separate route.
- **DayEditor as single page vs sections** — the `DayEditorViewModel.steps` + `overview.fields` support
  either layout from the same data.
- **Clearer inherited/default display** — render the `overview.fields[].source` badges
  (`day`/`inherited`/`default`) Phase 2d exposed.
- **Import review → repair** — lead the import dialog's unimportable/divergence output straight into the
  repair `WorkflowAction`s the VMs carry.
- **Export-readiness dashboard** — aggregate `ValidationSummaryViewModel.counts` across animals.

## Guardrails (apply to every Phase-6 PR)

- Prefer extending a view-model over computing in a component. A PR that adds workflow derivation back
  into a `.tsx` fails review (it re-creates the problem this whole plan removed — see the
  [overview metric](overview.md#metrics): no domain-logic imports in `src/pages/**`).
- The [Phase 5 matrix](phase-5-boundary-tests.md) must stay green. If an experiment needs new VM fields,
  add fields + tests; do not change existing severity/label semantics without updating the
  [contract](shared-contracts.md) and the matrix in the same PR.
- If an experiment needs a new field-write command, add it narrowly with tests and route only the affected
  controls through it. Existing non-commandified field writes may remain local when the experiment does not
  change their interaction model.
- Golden baselines stay byte-identical unless the experiment deliberately changes export (then it's a
  separate, flagged decision with trodes_to_nwb coordination per CLAUDE.md — out of scope for pure UI).
- Each experiment: `brainstorming` first (the design is open), then its own branch → full gate →
  Playwright visual review → merge, like every other UI cycle in this repo.

## Definition of done (for the phase as a whole)

There is no single "done" — the phase is open-ended. The *success criterion* is structural: a UI
experiment can change the rendered shape of any of the four surfaces while
`src/viewModels/__tests__/**` (builders + descriptor commands + matrix) stays green with at most additive
changes. If an experiment forces broad rewrites of the VM tests, or exposes an editable write that must be
shared across multiple UI shapes, stop and fix that boundary before continuing.

## Deliberately not in this phase

- Not a prescriptive PR. Don't execute this file top-to-bottom; pick one experiment, brainstorm it, and
  treat it as its own plan.
