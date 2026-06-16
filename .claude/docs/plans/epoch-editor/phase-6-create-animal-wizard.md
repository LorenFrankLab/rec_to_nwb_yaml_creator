# Phase 6 — Create-animal wizard

[← back to PLAN.md](PLAN.md) · [overview](overview.md) · [shared-contracts](shared-contracts.md)

The guided new-animal **wizard** — the "deliberate setup" journey: Identity → Electrodes → Cameras →
Optogenetics → Tasks → Recording system → Team, over `createAnimal` and the existing setup forms. Replaces
the single-page `AnimalCreationForm` for the from-scratch path. Design: [create-animal.html](create-animal.html).

**Inputs to read first:**

- [src/pages/Home/AnimalCreationForm.tsx](../../../src/pages/Home/AnimalCreationForm.tsx) — the current one-shot create form (identity fields) to wrap into step 1.
- [src/domain/animalCreation.ts](../../../src/domain/animalCreation.ts) — the create-animal domain helper (validation/shape) the wizard commits through.
- [src/state/workspaceActions.ts:103](../../../src/state/workspaceActions.ts) — `createAnimal(animalId, subject, metadata?)`.
- [src/pages/AnimalEditor/*](../../../src/pages/AnimalEditor/) (ElectrodeGroups/Cameras/Optogenetics/TaskTypes/DataAcq forms + modals) — reuse the field forms for steps 2–6.
- [src/validation/dandiSubject.ts:32,45](../../../src/validation/dandiSubject.ts) — `isValidSpecies`/`idHasSlash` for identity inputs.
- [src/domain/optoCompleteness.ts:60](../../../src/domain/optoCompleteness.ts) — opto step completeness meter + all-or-nothing guard.

**Contracts referenced:**

- [Substrate to reuse](shared-contracts.md#2-substrate-to-reuse) — wizard commits via `createAnimal`/`updateAnimal`; identity inputs reuse the DANDI predicates; opto meter reuses `optoFieldsPresence`.
- [View-model + command wiring](shared-contracts.md#4-view-model--command-wiring) — a wizard view-model builds step state + next/back + the commit command.

## Tasks

- `src/viewModels/createAnimalWizardViewModel.ts` (pure): step order, per-step completeness, the required-for-export markers, and the commit payload. Identity validity reuses `isValidSpecies`/`idHasSlash` + the case-collision/`subject_id` checks the form already does; opto step reuses `optoFieldsPresence` (all-or-nothing meter). Unit-tested.
- Wizard component (7 step pills, Back / Save draft / Next): step 1 wraps `AnimalCreationForm`'s identity fields with the inline guidance (binomial species, single-letter sex, genotype-vs-strain, case-collision warning). Steps 2–6 reuse the `AnimalEditor` field forms (electrode `device_type` picker + targeted_location + coords + replicate-N + behavior-only skip; camera calibration warning; opto 4-field all-or-nothing + power guard + reference-required; task-type catalog). Step 7 = Team.
- Commit: on finish, `createAnimal(id, subject, metadata)` then `updateAnimal` for the device/camera/opto/task/team setup (or the single `createAnimal` metadata payload if it accepts them — read `animalCreation.ts`). Navigate to `#/animal/:id/days`.
- Wire the entry: Animals home (Phase 1) "+ New animal" → wizard; the inline create panel is replaced by / routes to the wizard for the scratch path. ("Import a YAML" and "Copy from another animal" are [Phase 7](phase-7-import-copy.md) — the wizard offers them as start options that route there.)
- Retire the one-shot `AnimalCreationForm` *as the scratch entry* once the wizard covers it (keep the field components it composed; name what's removed).
- CHANGELOG: guided new-animal wizard.

## Deliberately not in this phase

- `dataFolder` — that is **day-level** (Phase 3), not animal setup; the wizard sets no folder.
- Import & copy-from-animal flows — [Phase 7](phase-7-import-copy.md) (the wizard only links to them).
- Re-implant / new-configuration wizard — that lifecycle op already exists (`createConfigurationSnapshotAndApplyForward`); not part of create-animal.

## Validation slice

| Test | Asserts |
| --- | --- |
| `createAnimalWizardViewModel.test.ts` | step order/completeness; required-for-export markers; identity invalid (free-text species, slash id) flagged via `isValidSpecies`/`idHasSlash`; opto step all-or-nothing via `optoFieldsPresence` |
| `CreateAnimalWizard.test.tsx` | step nav (Back/Next/Save draft); identity guidance; commit calls `createAnimal` + setup updates; routes to `#/animal/:id/days`; reuses `AnimalEditor` forms (not reimplemented) |
| `CreateAnimalWizard.a11y.test.tsx` (jest-axe) | step pills are a proper tablist/steps; zero violations |
| `baselines` | unchanged (animal creation doesn't touch export of existing fixtures) |

## Fixtures

In-test wizard state (partial → complete); an opto animal (all-or-nothing meter) and a behavior-only animal
(skip electrodes) to exercise both paths.

## Review

Dispatch `code-reviewer`. Confirm: wizard commits via `createAnimal`/`updateAnimal` (no new create logic);
identity/opto reuse the shared predicates; `AnimalEditor` forms reused; the old scratch form is removed; the
wizard sets no `dataFolder`; lint/typecheck/e2e/axe/baselines green.
