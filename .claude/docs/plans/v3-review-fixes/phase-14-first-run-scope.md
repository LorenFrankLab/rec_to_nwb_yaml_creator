# Phase 14 — First-run completeness

[← back to PLAN.md](PLAN.md) · [overview](overview.md)

One UX-walkthrough finding
([../../research/yaml-corpus-2/13-ux-live-walkthrough.md](../../research/yaml-corpus-2/13-ux-live-walkthrough.md)):
a new animal's **first day is born with blocking errors** because the Create-Animal wizard never collects
`experiment_description` and leaves `lab`/`institution` blank despite defaults existing. This phase is
byte-safe: it prevents guaranteed errors on unasked fields; it does not change valid export.

**Inputs to read first:**

- [src/pages/Home/CreateAnimalWizard.tsx:108-204](../../../../src/pages/Home/CreateAnimalWizard.tsx) — `TeamStep` collects `lab`/`institution` but seeds from `initialLab`/`initialInstitution` (blank); `experiment_description` is collected nowhere in the wizard.
- [src/domain/animalCreation.ts:134,149,157](../../../../src/domain/animalCreation.ts) — defaults exist (`institution: 'University of California, San Francisco'`, `settings.defaultInstitution`, `lastExperimenters`) but don't reach the Team step's initial values. Confirm the `lab` default source (and add one if absent).
- [src/viewModels/createAnimalWizardViewModel.ts](../../../../src/viewModels/createAnimalWizardViewModel.ts) — wizard step model + per-step status / required-field gating.
- [src/defaults.ts](../../../../src/defaults.ts) / workspace settings — where lab/institution defaults live / should be persisted.

## Tasks

- **Collect `experiment_description` in setup.** Add it to the wizard (Identity or a dedicated
  animal-scope step) with a clear "required for export" hint; it's animal-level and carries to every day.
  A new animal must not produce a first day that fails the export gate on a field the wizard never asked.
- **Pre-fill `lab` / `institution` from defaults.** Seed the Team step's initial values from the
  workspace settings / `animalCreation` defaults (`Loren Frank` / `University of California, San
  Francisco`), shown and overridable, with required markers. Persist a lab-level default so subsequent
  animals inherit the last-used values. (Recognition over recall; these are byte-stable in 100% of the
  corpus — pre-fill, never blank.)
- **Docs.** CHANGELOG: new animals collect `experiment_description` and pre-fill lab/institution (no
  first-day errors on un-asked fields).

## Deliberately not in this phase

- The wizard **stepper layout** (wrap/Team-detached) and other pure-presentation bugs — **Phase 1**.
- The validation **presentation/timing** (grouping, DRAFT) — **Phase 13**; this phase removes a *cause*
  of first-day errors, Phase 13 changes *when/how* remaining errors surface.
- The Day Editor animal-static scope boundary / read-only inherited summary — **Phase 15** owns it as
  part of the day-editor IA realignment.

## Validation slice

| Test | Asserts |
| --- | --- |
| wizard coverage (extend) | completing the wizard yields an animal whose first day passes the export gate's `experiment_description` / `lab` / `institution` required checks (no blocking error on a field the wizard never asked); leaving `experiment_description` blank surfaces the required hint *in the wizard*, not at day creation |
| lab/institution defaults (new) | a fresh wizard Team step shows the default lab/institution (not blank); they are overridable; a second animal inherits the last-used values |
| `baselines` | byte-identical (defaults/derivation already match the golden values; this prevents errors + accidental edits, doesn't change valid output) |

## Fixtures

Reuse the `CreateAnimalWizard` fixtures; a settings blob with default lab/institution; one fresh animal
creation path and one second-animal path that inherits last-used values.

## Review

Dispatch `code-reviewer` against the diff. Confirm:
- A wizard-completed animal's first day has no blocking error on `experiment_description`/`lab`/`institution`; the defaults match the golden values (baselines byte-identical).
- No Day Editor scope-boundary changes are included here; that work remains Phase 15.
- Full gate green; no trivial tests; CHANGELOG updated.
