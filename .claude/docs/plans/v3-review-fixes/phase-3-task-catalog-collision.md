# Phase 3 — Task-catalog name-collision integrity

[← back to PLAN.md](PLAN.md) · [overview](overview.md)

The most consequential finding: a legacy day's inline task metadata can be **silently replaced** by an
animal catalog task type with the same `task_name` but different description/environment/cameras —
and the swap is not caught by validation (both are "valid"), so an innocuous epoch edit can change
exported scientific metadata. This phase stops the *silent* part.

> **Read overview.md Open Question 1 and confirm the resolution before implementing.** The phase
> boundary is fixed; the fix *shape* is a product decision. The tasks below assume the recommended
> default (surface-and-confirm; never silently overwrite). If the decision is "auto-mint a distinct
> type", adjust the Tasks accordingly — the validation slice still applies.

**Inputs to read first:**

- [src/state/dayTaskCatalog.ts:61-100](../../../../src/state/dayTaskCatalog.ts) — `resolveDayCatalogView`: the inline→catalog conversion. The reuse-by-name is at `:74` (`byName.get(name)`); the mint-new branch is the `else` that calls `addTaskType`. **This is where divergence must be detected.**
- [src/pages/DayEditor/EpochsTab.tsx:134-160](../../../../src/pages/DayEditor/EpochsTab.tsx) — `applyCommit`: clears inline `day.tasks` (`onFieldUpdate('tasks', [])`) once `view.derived`, which is what makes the swap permanent on the next edit.
- [src/state/workspaceUtils.ts:308-356](../../../../src/state/workspaceUtils.ts) — `mergeDayMetadata` resolving `taskInstances → tasks` (the exported bytes).
- [src/state/taskCatalog.ts:227](../../../../src/state/taskCatalog.ts) — `resolveTaskInstances` (how a catalog instance becomes an exported task).
- [src/state/__tests__/mergeTaskCatalogResolution.test.js](../../../../src/state/__tests__/mergeTaskCatalogResolution.test.js) — the existing test proving a *non-colliding* migrated day exports the same bytes; **must stay green** (the no-divergence path is unchanged).

## Tasks

- **Detect divergence in `resolveDayCatalogView`.** When converting an inline task whose `task_name`
  matches a catalog `TaskType` (`dayTaskCatalog.ts:74`), compare the inline task's exported-relevant
  fields (`task_description`, `task_environment`, `camera_id`, and any other field `resolveTaskInstances`
  emits) against the catalog type. Add a `divergences` array to the returned `DayCatalogView`
  (alongside `taskTypes`/`taskInstances`/`derived`) describing each `{ taskName, inline, catalog }`
  mismatch. The no-divergence path returns `divergences: []` and behaves exactly as today (so
  `mergeTaskCatalogResolution.test.js` is unchanged). Pure function; unit-test the detection directly.
- **Surface, don't silently overwrite (default per Open Q1).** In `EpochsTab` (and any surface that
  derives the catalog view from an inline day), when `view.divergences` is non-empty, render a notice
  (reuse the existing recovery/notice pattern — `MalformedCollectionNotice`/`ExistingDataReview` style)
  that names the diverging task(s) and offers: **Keep the catalog definition** (proceed — the inline
  metadata is replaced, now explicitly acknowledged) or **Keep this day's values** (mint a distinct
  task type from the inline task so the day's metadata is preserved). **Do not auto-clear inline
  `day.tasks` (`applyCommit`) while an unacknowledged divergence exists** — i.e. an epoch edit must not
  silently commit the swap; require the choice first.
- **Wire the "keep day's values" repair through an action.** Minting a distinct type is an
  `updateAnimal({ taskTypes })` + re-pointed instance write — route it through the existing command/
  action layer (no new business logic in the component). If a new command id is needed, add it to
  `src/viewModels/commands/commandCatalog.ts` + a thin handler, keeping the descriptor-coverage ratchet
  green.
- **Docs.** CHANGELOG "Fixed": importing/opening a day whose inline task name matches an animal task
  type with different details no longer silently replaces the day's task metadata — the difference is
  surfaced and the user chooses.

## Deliberately not in this phase

- The data-acq fail-close (Phase 2) and the import-onto-existing-animal refs (Phase 4) — different mechanisms.
- Redesigning the task catalog. Only the *collision* edge changes; the define-once model stands.

## Validation slice

| Test | Asserts |
| --- | --- |
| `dayTaskCatalog` unit (new) | inline task name == catalog type, SAME metadata → `divergences: []`, conversion unchanged; name match with DIFFERENT description/camera → one `divergences` entry naming both values |
| `mergeTaskCatalogResolution.test.js` | unchanged — a non-colliding migrated day still exports byte-identical `tasks[]` |
| `EpochsTab` test (new) | with a divergence present, the notice renders and an epoch edit does NOT auto-clear inline `tasks`/commit until the user chooses; "Keep day's values" mints a distinct type (instances re-pointed) and preserves the day's exported metadata; "Keep catalog" proceeds |
| merge/export test (new) | after "Keep day's values", `encodeYaml(mergeDayMetadata(...))` preserves the day's original task_description/camera (no silent swap); after "Keep catalog", it uses the catalog values (now an explicit choice) |
| `baselines` | byte-identical |

## Fixtures

Synthesize: an animal with catalog `TaskType` `{task_name:'Run', task_description:'A', camera_id:[1]}`
and a day with inline `tasks:[{task_name:'Run', task_description:'B', camera_id:[2], task_epochs:[1]}]`
(the divergent case), plus a matching-metadata variant (the no-divergence control).

## Review

Dispatch `code-reviewer` against the diff. Confirm:
- The no-divergence path is byte-for-byte unchanged (`mergeTaskCatalogResolution.test.js` + baselines green); detection is pure + unit-tested.
- An epoch edit cannot silently commit the swap; both user choices behave as specified and route through actions/commands (no new component business logic; ratchet green).
- The chosen Open-Q1 resolution matches what was confirmed.
- Full gate green; no trivial tests; CHANGELOG updated; no plan-milestone references in code/test names.
