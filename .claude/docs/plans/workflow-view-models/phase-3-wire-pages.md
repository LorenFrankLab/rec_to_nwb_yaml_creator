# Phase 3 — Wire pages to render the view models

[← back to PLAN.md](PLAN.md) · [overview](overview.md)

Replace each page's inline derived logic with a single `build…ViewModel(...)` call and render the
result. **Plumbing, not redesign** — the rendered output (and the YAML) is identical; only the *source*
of the rendered values changes. Each surface ships as **its own branch → full gate → merge** PR, with the
large DayEditor surface split into smaller branches. Order: ValidationSummary → AnimalWorkspace →
AnimalView → DayEditor sub-slices (mirrors the build order; ValidationSummary proves the wiring recipe first).

**Inputs to read first (per page):** the page's components listed in its matching builder phase
([2a](phase-2a-validation-summary-vm.md) / [2b](phase-2b-animal-workspace-vm.md) /
[2c](phase-2c-animal-view-vm.md) / [2d](phase-2d-day-editor-vm.md)), plus that builder's output type.

**Contracts referenced:** the page VM types from the builder phases; the
[shared parts](shared-contracts.md).

## Wiring recipe (applies to every page below)

1. At the top of the page component, call the builder once:
   `const vm = build<Page>ViewModel(model.workspace, …);`
2. Render straight from `vm` — replace each inline computation (status, label, count, disabled reason,
   recovery branch, action) with the corresponding `vm.*` field. Delete the now-dead inline derivation.
3. **Remove the domain-logic imports from the page** (`getDayRowStatus`, `getAnimalSectionStatus`,
   `DAY_LIFECYCLE`, `classifyAnimalDays`, `dayChipDisplay`, …). After this phase those imports live only
   in `src/viewModels/**`. This is the end-state metric in [overview.md → Metrics](overview.md#metrics).
4. Actions: render `vm.*.action`/`actions` — label, `href`, `command.target`, and `disabledReason`
   (→ disabled + the existing `aria-describedby`/`title`). The `command.id` still maps to the *existing*
   handler for now (the page keeps its current `onClick`); phase-4 swaps the handler resolution. Do not
   change write behavior in this phase.
5. **No layout/markup/CSS change** beyond deleting dead branches and re-pointing values. CSS Modules,
   class names, `data-testid`s stay.
6. **Tests:** existing page tests must pass. Where a test asserted an intermediate computed value that no
   longer exists as component-local state, re-point it to the rendered output (role/text/`data-testid`) —
   never weaken an assertion. Golden baselines stay byte-identical.

## Tasks (each = one PR: branch → gate → merge)

- **3-a ValidationSummary** — wire `index.tsx` + `DayStatusTable.tsx` (+ `BatchExportPreflight`,
  `ExportReport`) to `buildValidationSummaryViewModel`. Remove the inline counts/row/preflight derivation
  now replaced by the builder. This is also where the live derive code in `useValidationSummaryActions`
  is cleaned up or redirected to shared pure helpers; do it under this full page gate, not in additive 2a.
- **3-b AnimalWorkspace** — wire `index.tsx`, `DayList.tsx`, `AnimalSetupCard.tsx`, `ExistingDataReview`,
  `RecordingDaysTab` to `buildAnimalWorkspaceViewModel`. Remove the `DayList` status→label/recovery
  derivation and the setup-card status/verb derivation (now in the builder + shared `dayRowViewModel`).
- **3-c AnimalView** — wire `index.tsx` to `buildAnimalViewModel` for the section-nav groups/rings/counts
  and the active-panel descriptor. Remove the in-component `SECTION_GROUPS` status computation.
- **3-d DayEditor shell/steps/breadcrumb** — wire the stepper shell and breadcrumb to the 2d-1 fields.
- **3-e DayEditor overview sources** — wire Overview's inherited/default values to `vm.overview.fields`.
- **3-f DayEditor issues/export** — wire ValidationStep issue list and ExportStep disabled reason to the
  2d-3 fields.
- **3-g DayEditor bad channels** — wire BadChannelsEditor blocker/ack display to the 2d-4 fields.
  Each DayEditor wiring is its own small branch/gate; remove only the per-component derivation covered by
  that sub-slice.

## Deliberately not in this phase

- No new visible affordances, layout changes, or copy changes (that's [phase-6](phase-6-workflow-ui.md)).
- No change to write handlers / store actions (that's [phase-4](phase-4-commands.md)) — `command` ids
  still resolve to today's handlers.
- Do not migrate a page before its builder phase (2x) has merged.

## Validation slice (per page PR)

| Test | Asserts |
| --- | --- |
| existing page + integration tests | pass unchanged, or with query-decoupling only (role/text/`data-testid`), never weakened. |
| `npx vitest run baselines` | byte-identical YAML. |
| Playwright spot-check (MCP) | the wired surface renders pixel-equivalent to pre-wiring (status colors, labels, counts, disabled states); use `getComputedStyle` for any subtle state. |
| grep guard | the page's `.tsx` no longer imports `getDayRowStatus`/`getAnimalSectionStatus`/`DAY_LIFECYCLE`/`dayChipDisplay`/`classifyAnimalDays` (those now only in `src/viewModels/**`). |

## Fixtures

None new — reuse the builder phases' fixtures and the existing page test fixtures.

## Review (per page PR)

Dispatch `code-reviewer` against each page's diff. Confirm: rendered output unchanged (Playwright +
baselines); domain-logic imports removed from the page (grep guard); no markup/CSS/copy change; tests
re-pointed not weakened; write behavior untouched; no plan-phase strings introduced.
