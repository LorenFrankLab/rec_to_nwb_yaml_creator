# Phase 8 — Recovery review, empty states, a11y/e2e, retire sweep

[← back to PLAN.md](PLAN.md) · [overview](overview.md) · [shared-contracts](shared-contracts.md)

The last surfaces + the cross-cutting finish: the **recovery-review** screen (records that didn't fit on
load — auto-recovered FYI + needs-review repairs, nothing discarded), the remaining **empty states**, the
**keyboard-shortcuts** help, an **axe + e2e** pass over every new surface, and a **retire sweep** confirming
no old day-editor step/route is orphaned. Designs: [recovery-review.html](recovery-review.html),
[empty-states.html](empty-states.html), [animals.html](animals.html) (shortcuts).

**Inputs to read first:**

- [src/state/persistence.ts:105](../../../src/state/persistence.ts) — `loadWorkspace` recovered/discarded notice path the banner + review render.
- [src/domain/dayRecovery.ts](../../../src/domain/dayRecovery.ts) — the recovery classification (dangling day → unknown animal, malformed `bad_channels`, orphaned file, unknown camera).
- [src/state/workspaceActions.ts:603,639](../../../src/state/workspaceActions.ts) — `removeDayReference`/`relinkDayReference` (repair actions) + the repair command ids in [commandCatalog.ts](../../../src/viewModels/commands/commandCatalog.ts).
- [src/components/AnimalSwitcher.tsx](../../../src/components/AnimalSwitcher.tsx) + existing keyboard-shortcuts help (grep) — the shortcuts surface.
- [e2e/](../../../e2e/) + [playwright.config.js](../../../playwright.config.js) — the committed e2e suite to extend.

**Contracts referenced:**

- [Substrate to reuse](shared-contracts.md#2-substrate-to-reuse) — recovery renders `dayRecovery`/`loadWorkspace` output and emits the existing repair commands; never recomputes recovery.
- [View-model + command wiring](shared-contracts.md#4-view-model--command-wiring) — repairs are descriptor commands (`removeDayReference`/`relinkDayReference`/`repairDay`).

## Tasks

- Recovery-review screen (reached from the Animals-home load banner, Phase 1): render the `loadWorkspace`
  recovered (FYI — "N upgraded, no data lost") + needs-review records from `dayRecovery`, each with concrete
  repair actions (Create / Re-link / Discard for a dangling day; Reset / Open-in-editor for malformed
  `bad_channels`; Add-task / Re-point / Discard for an orphaned file; Pick / Add / Remove for an unknown
  camera). Repairs emit the existing commands. **Destructive repairs (Discard / Discard file) confirm or
  undo** (Phase 0 `UndoToast` for the reversible ones; a confirm for the irreversible). Nothing silently
  dropped.
- Remaining empty states: any surface not yet given its zero-state (animal with no setup, day with no
  epochs, etc.) — render the [empty-states.html](empty-states.html) onboarding pattern with the right CTA.
- Keyboard-shortcuts help: the sidebar/help affordance listing the global shortcuts (reuse `useGlobalShortcuts`).
- a11y pass (jest-axe + `@axe-core/playwright`): every new surface (Animals home, animal page, day editor +
  4 tabs, export preview, wizard, import, copy, recovery) is **axe-clean**; the click-to-toggle grids
  (channel, DIO) and the epoch caret are keyboard-operable + focus-managed (the standing acceptance criteria
  from the mockup reviews). Add the committed `@playwright/test` specs for the new routes/flows.
- **Retire sweep**: confirm the old day-editor is fully gone — `DayEditorStepper.tsx` and the steps
  `OverviewStep`/`DevicesStep`/`TasksEpochsStep`/`BehavioralEventsStep`/`ValidationStep`/`ExportStep`
  removed (across Phases 3/4/5), no dead `#/day` rendering path, no orphaned imports. Grep for each and
  delete any straggler; update the source-scanning guard tests if they enumerate these files.
- CHANGELOG: recovery review + empty states + shortcuts; note the day-editor redesign is complete.

## Deliberately not in this phase

- The data-directory **binding** (auto-verifying files exist on disk) — explicitly out of scope (overview Non-Goals); the per-day status surface is its future slot.
- New recovery *classification* logic — render `dayRecovery`/`loadWorkspace`, don't extend the classifier.

## Validation slice

| Test | Asserts |
| --- | --- |
| `RecoveryReview.test.tsx` | renders auto-recovered FYI + needs-review records from `dayRecovery`/`loadWorkspace`; each repair emits the right command; Discard confirms/undoes; nothing silently dropped |
| `emptyStates.test.tsx` | each remaining zero-state renders its onboarding CTA |
| `shortcuts.test.tsx` | help lists the global shortcuts; they fire |
| `newSurfaces.a11y.test.tsx` (jest-axe) | every new surface zero violations; grids keyboard-operable |
| `e2e/redesign.spec.ts` (`@playwright/test`) | the core flow end-to-end: Animals home → animal → day editor (epoch grid edit) → export; import-repair; recovery-review |
| `retireSweep.test.ts` | the listed old step/stepper files no longer exist / aren't imported (extend any source-scanning guard) |
| `baselines` | unchanged |

## Fixtures

A `loadWorkspace` result with each recovery class (dangling day, malformed bad_channels, orphaned file,
unknown camera) + an auto-recovered upgrade; zero-state workspaces; the e2e suite drives `npm start`.

## Review

Dispatch `code-reviewer`. Confirm: recovery renders the existing classification (no recompute) and
destructive repairs confirm/undo; every new surface is axe-clean and the grids are keyboard-operable; the old
day-editor steps/stepper are actually removed (retire sweep green, no orphans); e2e covers the core flow;
lint/typecheck/baselines green.
