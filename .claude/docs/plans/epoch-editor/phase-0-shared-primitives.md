# Phase 0 — Shared redesign primitives + status vocabulary

[← back to PLAN.md](PLAN.md) · [overview](overview.md) · [shared-contracts](shared-contracts.md)

Scaffolding the later phases consume: a small kit of reusable, tested, CSS-Module components and the
status-pill wrapper over the existing `dayLifecycle` vocabulary. No screen ships in this phase; Phases 1–8
import these. Ships as a component-library PR with unit + a11y tests.

**Inputs to read first:**

- [src/domain/dayLifecycle.ts](../../../src/domain/dayLifecycle.ts) — the lifecycle enum/labels to wrap (do not redefine).
- [src/domain/workflowStatus.ts](../../../src/domain/workflowStatus.ts) — `getDayRowStatus` (how a day resolves to a lifecycle variant).
- [src/components/ui/Button.jsx](../../../src/components/ui/Button.jsx) + its `.module.css` — the token-driven primitive to match for new components.
- An existing `DayLifecycleLegend` usage (grep `DayLifecycleLegend`) — the legend the pill must agree with.

**Contracts referenced:**

- [Status vocabulary](shared-contracts.md#3-status-vocabulary) — wrap, never coin new strings.
- [View-model + command wiring](shared-contracts.md#4-view-model--command-wiring) — `UndoToast`/readiness bar take view-model props, not store access.

## Tasks

- `src/components/ui/StatusPill.tsx` (+ `.module.css`): props `{ variant: keyof DAY_LIFECYCLE, label?: string }`. Renders the dot + `DAY_LIFECYCLE_LABEL[variant]` (or a short override, e.g. "Ready" for `READY`), token colors per variant (green=exported, blue=ready, grey=draft, amber=needs_fixing). **Imports `dayLifecycle`; never hardcodes the words.** Also export an `EpochStatusPill` (its own scope: `Complete`/`Incomplete`) so the scopes can't share a component instance — keeps the "no word across scopes" rule structural.
- `src/components/ui/UndoToast.tsx` (+ module): props `{ message, onUndo?, onDismiss, autoHideMs? }`. Bottom-center toast; `role="status"`/`aria-live="polite"`; Undo button only when `onUndo` given (reversible action), else dismiss-only. A host hook `useUndoToast()` returns `{ show(msg, onUndo?), node }` so pages mount one toast.
- `src/components/ui/BlastRadiusChip.tsx` (+ module): props `{ dayCount: number, title?: string }`. The "affects all N days" amber chip with the tooltip "Shared by all N days — already-exported days will need re-export."
- `src/components/AnimalScopeCard.tsx` (+ module): props `{ summary: AnimalSummaryVM, editHref }`. The read-only animal-static line (identity · probes · config · team) + quiet "Edit animal setup" link. Takes a pre-built summary VM (built in Phase 2's animal view-model), renders only.
- `src/components/ui/GeneratedValue.tsx` (+ module): props `{ value, derived: boolean, onOverride, onRevert, overrideLabel }`. The grey-monospace generated chip + `generated`/`manual` tag + Override/Revert; editable affordance when `manual`. Used by the epoch drill-in (Phase 4).
- `src/components/ReadinessBar.tsx` (+ module): props `{ issues: RepairableIssue[], onFix(issue) }`. Quiet one-line "Ready to export" when `issues` has no errors; loud bar listing blocking issues with per-issue "Fix in …" actions when present. **Takes the issue list as a prop** (the page computes it from `validateDay`); the bar has no validation logic.
- CHANGELOG: add an "Unreleased" entry noting the shared redesign primitives (internal; no user-facing behavior yet).

## Deliberately not in this phase

- Wiring any component into a screen — Phases 1–8 do that. P0 only ships the kit + tests.
- The readiness *gate* logic — `ReadinessBar` renders issues it's handed; computing them via `validateDay` is each page's job (Phases 3/5).
- Any change to `dayLifecycle.ts`/`workflowStatus.ts` — wrapped, not modified.

## Validation slice

| Test | Asserts |
| --- | --- |
| `StatusPill.test.tsx` | each `DAY_LIFECYCLE` variant renders its `DAY_LIFECYCLE_LABEL` (or the documented short label); colors come from tokens; `EpochStatusPill` renders `Complete`/`Incomplete` and never a lifecycle word |
| `UndoToast.test.tsx` | Undo button present iff `onUndo` given; `role=status`/`aria-live=polite`; Undo fires `onUndo`; auto-hide after `autoHideMs` |
| `GeneratedValue.test.tsx` | `derived=true` shows `generated` + Override; after Override shows editable + `manual` + Revert; Revert restores derived value (prop-driven) |
| `ReadinessBar.test.tsx` | empty errors → quiet "Ready to export"; with errors → loud bar lists each, "Fix in …" calls `onFix(issue)`; warnings alone do not make it loud |
| `BlastRadiusChip.test.tsx` / `AnimalScopeCard.test.tsx` | render N-days copy + tooltip; scope card renders summary + edit link |
| `primitives.a11y.test.tsx` (jest-axe) | each primitive has zero axe violations; toast/readiness live regions announce |

## Fixtures

In-test props only (variants, an issue list built from `RepairableIssue` literals, an `AnimalSummaryVM`
literal). No workspace fixtures needed — these are pure presentational components.

## Review

Before opening the PR, dispatch `code-reviewer` against the diff. Confirm:
- Every task implemented as specified; "Deliberately not" honored (nothing wired into a screen).
- `StatusPill` imports `dayLifecycle` and adds no new status strings; scopes don't share a pill.
- Validation slice passes; a11y tests are real (axe over rendered output, not `assert True`).
- New styles are CSS Modules + tokens (no new globals); component/test names don't reference this plan.
- `npm run lint:ci`, `npm run typecheck`, `npx vitest run baselines` (unchanged) all green.
