# Phase 14 — First-run completeness & day-view scope boundary

[← back to PLAN.md](PLAN.md) · [overview](overview.md)

Two UX-walkthrough findings
([../../research/yaml-corpus-2/13-ux-live-walkthrough.md](../../research/yaml-corpus-2/13-ux-live-walkthrough.md)):
(a) a new animal's **first day is born with blocking errors** because the Create-Animal wizard never
collects `experiment_description` and leaves `lab`/`institution` blank despite defaults existing; (b) the
Day tab lets the user **silently edit animal-static fields for all days** via a disclosure with only a
grey "UPDATES ALL DAYS" label — the exact scope-boundary violation the mental model warns against. Both
are byte-safe (they prevent guaranteed errors / accidental edits; they don't change valid export).

**Inputs to read first:**

- [src/pages/Home/CreateAnimalWizard.tsx:108-204](../../../../src/pages/Home/CreateAnimalWizard.tsx) — `TeamStep` collects `lab`/`institution` but seeds from `initialLab`/`initialInstitution` (blank); `experiment_description` is collected nowhere in the wizard.
- [src/domain/animalCreation.ts:134,149,157](../../../../src/domain/animalCreation.ts) — defaults exist (`institution: 'University of California, San Francisco'`, `settings.defaultInstitution`, `lastExperimenters`) but don't reach the Team step's initial values. Confirm the `lab` default source (and add one if absent).
- [src/viewModels/createAnimalWizardViewModel.ts](../../../../src/viewModels/createAnimalWizardViewModel.ts) — wizard step model + per-step status / required-field gating.
- [src/pages/DayEditor/DayTab.tsx:400-433](../../../../src/pages/DayEditor/DayTab.tsx) — the "View / edit inherited subject metadata" disclosure that writes the animal record (species/DOB) and propagates to all days; the "UPDATES ALL DAYS" label.
- [src/pages/AnimalView/index.tsx](../../../../src/pages/AnimalView/index.tsx) — the existing "Edit animal setup" path (the correct place to edit animal-static data).
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
- **Day-view scope boundary → read-only.** Replace the DayTab "view/edit inherited subject metadata"
  disclosure with a **read-only summary card** of the animal-static facts (species · sex · genotype ·
  DOB · probes · config version · team) and a single **"Edit animal setup"** link to `AnimalView` (the
  mental-model "the scope boundary is a physical thing on screen"). If an inline edit path is retained,
  gate it behind an explicit **"This changes all N days — continue?"** confirm (blast-radius visible),
  never a silent write. The animal-static data is still single-source-of-truth on the animal.
- **Docs.** CHANGELOG: new animals collect `experiment_description` and pre-fill lab/institution (no
  first-day errors on un-asked fields); the day view shows animal-static facts read-only with an explicit
  "Edit animal setup" path (no silent all-days edits).

## Deliberately not in this phase

- The wizard **stepper layout** (wrap/Team-detached) and other pure-presentation bugs — **Phase 1**.
- The validation **presentation/timing** (grouping, DRAFT) — **Phase 13**; this phase removes a *cause*
  of first-day errors, Phase 13 changes *when/how* remaining errors surface.
- Re-architecting the animal-static editing model — single-source-of-truth already exists; this only
  fixes where it's editable on the day view + the wizard's coverage gap.

## Validation slice

| Test | Asserts |
| --- | --- |
| wizard coverage (extend) | completing the wizard yields an animal whose first day passes the export gate's `experiment_description` / `lab` / `institution` required checks (no blocking error on a field the wizard never asked); leaving `experiment_description` blank surfaces the required hint *in the wizard*, not at day creation |
| lab/institution defaults (new) | a fresh wizard Team step shows the default lab/institution (not blank); they are overridable; a second animal inherits the last-used values |
| DayTab scope card (extend) | the day view renders animal-static facts **read-only** with an "Edit animal setup" link; there is no control that writes species/DOB from the day view without an explicit "changes all N days" confirm |
| `baselines` | byte-identical (defaults/derivation already match the golden values; this prevents errors + accidental edits, doesn't change valid output) |

## Fixtures

Reuse the `CreateAnimalWizard` + `DayTab` test fixtures; a settings blob with default lab/institution; an
animal used by N>1 days for the blast-radius confirm.

## Review

Dispatch `code-reviewer` against the diff. Confirm:
- A wizard-completed animal's first day has no blocking error on `experiment_description`/`lab`/`institution`; the defaults match the golden values (baselines byte-identical).
- The day view cannot silently edit animal-static data; the only edit path is the explicit AnimalView link (or a confirmed blast-radius modal).
- Single-source-of-truth is preserved (no per-day copy of animal-static facts introduced).
- Full gate green; no trivial tests; CHANGELOG updated.
