# Phase 2 — Animal page (Days + Setup)

[← back to PLAN.md](PLAN.md) · [overview](overview.md) · [shared-contracts](shared-contracts.md)

Restyle the tabbed animal shell to the mockup: scope-boundary summary chips + configuration card in the
header, a **Days table** with multi-select + "Export selected" + undo-able delete, and a **Setup** surface
whose animal-static section cards carry blast-radius chips. The tab structure (`AnimalView` section-nav)
already exists; this adds the affordances and restyles the shell. Design: [animal-page.html](animal-page.html).

**Inputs to read first:**

- [src/pages/AnimalView/index.tsx](../../../src/pages/AnimalView/index.tsx) — the tabbed shell + section-nav + header (restyle target).
- [src/viewModels/animalViewModel.ts](../../../src/viewModels/animalViewModel.ts) — `buildAnimalViewModel` (header, section-nav groups, status rings) to extend with the scope summary + config card data.
- [src/pages/AnimalWorkspace/RecordingDaysTab.tsx](../../../src/pages/AnimalWorkspace/RecordingDaysTab.tsx) — the existing Days table (multi-select + bulk export added here).
- [src/pages/AnimalEditor/wiring/](../../../src/pages/AnimalEditor/wiring/) — setup containers (ElectrodeGroups/RecordingSystem/Cameras/TaskTypes/Optogenetics) reused under Setup.
- [src/viewModels/commands/commandCatalog.ts](../../../src/viewModels/commands/commandCatalog.ts) + [commandHandlers.ts](../../../src/viewModels/commands/commandHandlers.ts) — add the bulk-export command id.
- [src/state/workspaceActions.ts:444](../../../src/state/workspaceActions.ts) — `deleteDay`/`duplicateDay` for the row + undo.

**Contracts referenced:**

- [View-model + command wiring](shared-contracts.md#4-view-model--command-wiring) — bulk export is a new command id + thin handler; delete is undo-able via Phase-0 `UndoToast`.
- [Status vocabulary](shared-contracts.md#3-status-vocabulary) — Days-table status column + legend reuse `dayLifecycle`.
- Phase 0 primitives: `AnimalScopeCard` summary input, `BlastRadiusChip`, `StatusPill`, `UndoToast`.

## Tasks

- Extend `buildAnimalViewModel` to return an `AnimalSummaryVM` (id · genotype · sex · species · DOB · probe summary `L CA1, R CA1, L mPFC` · `config v{n}` · team) and a `configCard` (`v{n} · current · since {date} · {N} days`, probe list, "New configuration…" action). The probe summary derives from `getAnimalElectrodeGroups` (locations) + `getConfigHistory`. Pure + tested. Render the summary as the header **scope chips** and the config card on the Setup tab.
- Days tab (`RecordingDaysTab`): add a **checkbox column** + select-all, and a contextual bulk bar ("N selected · ⬇ Export selected · Delete") that appears on selection. Date cells are real `<a>` to `#/day/:id`; chevron is a real link too (accessible-row contract — no row-level `onclick`).
- **Bulk export**: add `WorkflowCommand` id `exportSelectedDays` to the catalog + a handler that batches the existing per-day export (reuse `ValidationSummary`'s `Export Valid Only` path / `useValidationSummaryActions` so the parity gate and skip-on-invalid behavior are shared). Result shows "Exported N · Skipped M" with skipped days linked to their issue (the batch-result pattern; full preview screen is Phase 5).
- **Undo-able delete**: row/bulk Delete fires `deleteDay` then shows `UndoToast` (Phase 0) with an Undo that re-creates the day from the captured record (or, simpler and safe: capture the day record before delete and re-`createDay`+`updateDay` to restore). **Delete-animal keeps a hard confirm** (the existing `AnimalDeleteDialog`) — undo for the frequent reversible action, confirm for the catastrophic one.
- Setup surface: render the section cards (Identity, Configuration, Cameras, Tasks, Optogenetics, Team, Recording system) reusing the existing setup containers; add a **`BlastRadiusChip`** ("affects all N days") at the *edit affordance* of the re-export-forcing sections — **Identity, Cameras, Optogenetics** (not Team — past days keep recorded experimenters; not additive "Add task type"). The Optogenetics card shows the `optoFieldsPresence` meter ("Opto configured · N of N", reusing `src/domain/optoCompleteness.ts:60`). Setup-section "Edit" affordances render as buttons/links (not text).
- The Days table must NOT carry search/filter/sort/pagination (the ≤~60-days scoping decision); the day's status legend reuses `DayLifecycleLegend`.
- CHANGELOG: animal page restyle + multi-select export + undo.

## Deliberately not in this phase

- The day editor itself (Phases 3–4) — Days rows link to the existing `#/day/:id` until then.
- Fully restyling the setup-tab editor internals — they're reused as-is; the wizard (Phase 6) reuses their forms. This phase restyles the *shell* + adds the chips/cards.
- The standalone export-preview screen (Phase 5) — the bulk-export result here is the inline batch-result pattern.

## Validation slice

| Test | Asserts |
| --- | --- |
| `animalViewModel.test.ts` (extend) | `AnimalSummaryVM` carries identity + probe summary + `config v{n}` + team; `configCard` version/date/day-count; blast-radius section list = {Identity, Cameras, Optogenetics} |
| `RecordingDaysTab.test.tsx` | checkbox column + select-all; bulk bar appears on selection; date/chevron are real links; no row-level `onclick`; status column uses `StatusPill`/`dayLifecycle` |
| `bulkExport.test.ts` | `exportSelectedDays` command resolves to the batch export; invalid days skipped with a linked reason; valid days exported byte-identical |
| `deleteUndo.test.tsx` | delete shows `UndoToast`; Undo restores the day record; delete-animal still routes to the hard confirm dialog |
| `setupCards.test.tsx` | `BlastRadiusChip` on Identity/Cameras/Optogenetics only; opto meter reads `optoFieldsPresence`; edit affordances are buttons |
| `baselines` | unchanged; bulk export of the golden day is byte-identical to single export |

## Fixtures

The Phase-1 multi-day workspace fixture (mixed statuses) for the Days table + bulk export; an opto animal +
a non-opto animal for the opto meter and blast-radius chips; a day record captured-and-restored for the undo
test.

## Review

Dispatch `code-reviewer`. Confirm: bulk export reuses the shared export/parity path (no second exporter);
blast-radius chips are on the correct sections only; undo restores faithfully; delete-animal still confirms;
builder pure + tested; `npx vitest run baselines` byte-identical; lint/typecheck/e2e green.
