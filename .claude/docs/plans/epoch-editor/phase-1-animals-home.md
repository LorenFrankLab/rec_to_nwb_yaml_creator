# Phase 1 — Animals home

[← back to PLAN.md](PLAN.md) · [overview](overview.md) · [shared-contracts](shared-contracts.md)

Restyle the workspace picker into the **Animals home** landing: a disambiguating table (genotype, species,
days, last recording, status rollup, opto tag), search + filters, "+ New animal", a load/recovery banner,
and the zero-animals empty state. Design: [animals.html](animals.html) + [empty-states.html](empty-states.html).

**Inputs to read first:**

- [src/pages/AnimalWorkspace/index.tsx](../../../src/pages/AnimalWorkspace/index.tsx) — current picker page to restyle.
- [src/viewModels/animalWorkspaceViewModel.ts](../../../src/viewModels/animalWorkspaceViewModel.ts) — the builder (`buildAnimalWorkspaceViewModel`, ~:410); already returns picker cards, empty-state, existing-data review, `primaryAction:{id:'createAnimal'}`.
- [src/state/workspaceSelectors.ts](../../../src/state/workspaceSelectors.ts) — `getAnimalDays`, `getMostRecentDayId`, `getAnimalSubject` for the row cells.
- [src/domain/workflowStatus.ts](../../../src/domain/workflowStatus.ts) — `getDayRowStatus` to roll a day set up into the per-animal status chip.
- [src/state/persistence.ts:105](../../../src/state/persistence.ts) — the `loadWorkspace` notice path the banner surfaces.

**Contracts referenced:**

- [Status vocabulary](shared-contracts.md#3-status-vocabulary) — the rollup chip ("1 ready", "1 needs review", "All exported") uses `dayLifecycle` labels via Phase-0 `StatusPill`.
- [View-model + command wiring](shared-contracts.md#4-view-model--command-wiring) — extend the builder; the page stays a renderer.

## Tasks

- Extend `buildAnimalWorkspaceViewModel` to return, per animal row: `{ id, genotype, species, dayCount, lastRecording, statusRollup, isOpto }`. `statusRollup` is computed from the animal's days via `getDayRowStatus` (e.g. "1 ready", "1 needs review", "All exported") — **reuse the gate, don't recount**. `isOpto` from `optoFieldsPresence(animal.optogenetics).count > 0` (reuse `src/domain/optoCompleteness.ts:60`). Builder stays pure + unit-tested.
- Rebuild the page render as the mockup table (columns: Animal, Genotype, Species, Days, Last recording, Status). Each animal **name is a real `<a>`** to `#/animal/:id/days` (not row `onclick`) — the accessible-row contract. Opto tag chip beside the name.
- Search box (filters rows by id/genotype client-side) + Genotype/Status filter menus. Pure filter over the view-model list; no store changes.
- "+ New animal" primary button emits the existing `createAnimal` action path (opens the inline create panel / routes to the wizard once Phase 6 lands — until then, the existing `AnimalCreationForm` inline panel).
- Load/recovery banner: when `loadWorkspace` returned a recovered/discarded notice (already surfaced via the persistence status / `loadNotice`), render the "N records need review" banner linking to the recovery-review route (Phase 8 builds the destination; until then link to the existing review surface).
- Empty state (zero animals): the [empty-states.html](empty-states.html) onboarding card — "No animals yet" + "+ New animal" / "Import a YAML…" CTAs. Render from the builder's existing empty-state branch.
- Update CHANGELOG (Animals home replaces the bare picker).

## Deliberately not in this phase

- The recovery-review **destination** screen — Phase 8 (this phase only links to it / the existing surface).
- The new-animal **wizard** — Phase 6 (use the existing inline create form for now).
- Bulk/multi-select on this list (animals aren't bulk-operated; days are, in Phase 2).
- Search/sort/pagination *machinery* beyond a simple client filter — at ≤ a handful of animals it's unnecessary (the scoping decision: an animal lives ~1–2 months; the corpus is small).

## Validation slice

| Test | Asserts |
| --- | --- |
| `animalWorkspaceViewModel.test.ts` (extend) | row VM carries genotype/species/dayCount/lastRecording/isOpto; `statusRollup` matches `getDayRowStatus` over the day set (built, no recount); empty-state branch when zero animals |
| `AnimalsHome.test.tsx` | renders one row per animal; name is an `<a href="#/animal/:id/days">`; opto tag iff `isOpto`; search filters rows; filter menus narrow rows |
| `AnimalsHome.banner.test.tsx` | recovery notice → banner with the "N records need review" copy + review link; no notice → no banner |
| `AnimalsHome.empty.test.tsx` | zero animals → onboarding card with New animal / Import CTAs |
| `AnimalsHome.a11y.test.tsx` (jest-axe) | zero violations; table has header semantics; banner is a landmark/alert as appropriate |
| `baselines` | unchanged (no export touched) |

## Fixtures

A small multi-animal workspace fixture (2–3 animals, mixed day statuses incl. one "ready", one "needs
fixing", one all-exported) under `src/viewModels/__tests__/fixtures` or reuse an existing workspace fixture.
A zero-animal workspace for the empty state. A `loadWorkspace` result with a recovery notice for the banner.

## Review

Dispatch `code-reviewer` against the diff. Confirm: the rollup chip reads `getDayRowStatus` (not a local
recount); names are real links; the builder stays pure (tested without React); empty/banner states covered;
`npx vitest run baselines` byte-identical; lint/typecheck/e2e green; no new global CSS.
