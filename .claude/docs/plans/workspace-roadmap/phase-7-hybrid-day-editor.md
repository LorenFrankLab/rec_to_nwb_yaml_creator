# Phase 7 — Hybrid tabbed Day Editor

[← PLAN.md](PLAN.md) · [overview](overview.md)

Replace the Day Editor's linear stepper shell with a **tabbed section-nav** matching the Animal view — free navigation, per-section status, an optional "Next ▸" guided path, and **Export as a tab that stays blocked until valid** (the gate survives). The five step *components* are unchanged; only the navigation shell changes. **🟢 UI only**, merge-neutral. Mockup: [../scope-tiers-ia/mockup-tabbed-day-editor-interactive.html](../scope-tiers-ia/mockup-tabbed-day-editor-interactive.html).

**Inputs to read first:**

- `src/pages/DayEditor/DayEditorStepper.jsx:39` (`currentStep`), `:43` (`stepOrderRef = ['overview','devices','epochs','validation','export']`), `:287-294` (step→component config), `:310` (`CurrentStepComponent`), `:341` (`StepNavigation`). The linear shell to replace.
- `src/pages/DayEditor/StepNavigation.jsx` — the current stepper nav (replaced by a section-nav).
- `src/pages/DayEditor/stepGate.js` — `isExportEnabled(stepStatus)`; becomes the Export tab's disabled condition.
- `src/pages/AnimalView/index.jsx` — the `navigation "Animal sections"` section-nav + `aria-current` pattern to mirror (the established tabbed model).
- The per-step status source already feeding the stepper (`computeStepStatus` via `src/domain/validation.js`) — reuse for the per-tab badges.

## Tasks

- **Section-nav shell**: replace `StepNavigation` + the implicit linear order with a section-nav (the AnimalView pattern: a `navigation` landmark of links/buttons with `aria-current`), grouped e.g. *Session* (Overview, Files & Weight), *Recording* (Devices & Failed Channels, Tasks & Epochs), *Finish* (Validation & Export). Each carries its `computeStepStatus` glyph (✓/⚠/✗); "Validation & Export" shows the to-fix count.
- **Keep the components**: render the same `OverviewStep`/`DevicesStep`/`TasksEpochsStep`/`ValidationStep`/`ExportStep` for the selected section. No change to their internals.
- **Export gate survives**: the Export tab/section is reachable but its action stays disabled while `!isExportEnabled(stepStatus)` — reuse the existing gate, just surface it as a blocked tab instead of a locked final step.
- **Optional "Next ▸"**: each section keeps a "Next ▸" affordance advancing through the same order, so the guided path remains; keep the existing keyboard shortcuts (Alt+←/→ → prev/next section) wired to the new nav.
- **Remove the old shell**: the linear `StepNavigation` usage and `currentStep`-as-wizard-step logic that the section-nav replaces — delete in this phase (name it in the PR), not left in parallel.
- **a11y + tests**: mirror the AnimalView a11y guarantees (one `main`, the section-nav landmark, focus moves to the panel on section change). CHANGELOG entry.

## Deliberately not in this phase

- Any change to step *content* (fields, validation, export) — identical; this is purely the navigation shell.
- Merging the Day Editor into the AnimalView route — it stays `#/day/:id`; only its internal nav changes.

## Validation slice

| Test | Asserts |
| --- | --- |
| section-nav renders all sections w/ status | each section present with its ✓/⚠/✗ from `computeStepStatus` |
| free navigation | clicking any section shows that step's component; `aria-current` tracks |
| Export gate | Export action disabled while `!isExportEnabled`; enabled when all steps valid |
| Next ▸ + keyboard | "Next ▸" and Alt+→ advance through the order; Alt+← retreats |
| focus management | focus moves to the panel on section change (a11y) |
| no behaviour regression in steps | existing OverviewStep/DevicesStep/etc. tests still pass unchanged |
| baselines | byte-identical (UI only) |

## Fixtures

Reuse the existing Day Editor test fixtures (a configured day with mixed step statuses). Add `jest-axe`/section-nav-landmark assertions mirroring the AnimalView a11y tests.

## Review

Dispatch `code-reviewer`. Confirm: step components unchanged (their tests pass as-is); the Export gate is preserved (disabled-until-valid); the old `StepNavigation` linear shell is removed (no parallel wizard left); a11y matches the AnimalView pattern (one main, section-nav landmark, focus-on-change); baselines byte-identical; names don't reference this plan.
