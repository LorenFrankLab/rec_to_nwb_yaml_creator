# v3 Review Fixes Implementation Plan

**Status:** Not started.

A comprehensive multi-agent review of the `modern` branch (the full v3 rewrite, vs `main`) surfaced no
unprotected export-corruption bug, but did find a set of real release-blocking issues: a few
merge/import paths that fail open or silently change/drop scientific metadata, an off-export
epoch-state remap gap, a misleading recovery message, two genuine presentation/a11y bugs (which also
account for two of the "known-14" pre-existing e2e failures), and a batch of type-safety + test + CI
hardening gaps. The original review fixes land in seven independently-shippable phases, ordered
low-risk-first, with the exported-YAML **byte-identity** guarantee as the cross-cutting constraint
every export-touching phase must re-prove. Additional non-blocking UX/a11y findings from the review
are explicitly tracked as deferred follow-ups in [overview.md](overview.md), not silently dropped.

**Phases 8–12 (data-grounded app improvements)** were added from a separate study of **1,814 real
neuroscientist-authored YAMLs** (2017–2026) and its downstream verification against trodes_to_nwb +
Spyglass source — see [../../research/yaml-corpus-2/](../../research/yaml-corpus-2/) (README → `08-ux-and-roadmap`).
They hold the **same byte-identity gate** — every one is import-side normalization, a new validation rule,
or a validation-rule bug fix; none change exported YAML for valid input. They are scoped with explicit
handoffs rather than hidden overlap: Phase 8 precedes or coordinates with Phase 12 (`referenceRules`);
Phase 10 coordinates with Phase 4 (existing-animal catalog merge); and Phase 9 should rebase on Phase 2
if the opto rule helper changes first. Each was verified against the live tree before writing, which
trimmed several research recommendations that the app already implements (the within-file camera
calibration-aliasing guard, the 12-probe catalog, the free-text-species reject).

## Reading order

For agent invocation, **load only the slice you need**:

1. **Working a specific phase?** Open the matching phase file — each is self-contained (inputs to read,
   tasks, validation slice, fixtures, review).
2. **Need broader scope / risks / the byte-identity gate / open design questions?** [overview.md](overview.md).

## Files

- [overview.md](overview.md) — scope, integration points, byte-identity gate, risks, open design decisions.
- Phases (each ships as a separable PR):
  - [phase-1-hygiene.md](phase-1-hygiene.md) — presentation/a11y/layout/test hygiene (recovers both known-14 e2e failures).
  - [phase-2-export-fail-closed.md](phase-2-export-fail-closed.md) — fail-closed data-acq merge + the opto-presence DRY fix.
  - [phase-3-task-catalog-collision.md](phase-3-task-catalog-collision.md) — stop the silent task-metadata swap on inline→catalog name reuse.
  - [phase-4-import-existing-animal.md](phase-4-import-existing-animal.md) — import-onto-existing-animal: surface dangling refs; reconcile `task_epoch`/`task_epochs` conflicts.
  - [phase-5-epoch-videoless-remap.md](phase-5-epoch-videoless-remap.md) — remap/restore `state.videolessEpochs` across epoch renumber/delete/undo.
  - [phase-6-type-safety.md](phase-6-type-safety.md) — derive the closed status unions (`DAY_STATUS`/`StepStatus`/`DAY_LIFECYCLE`) + a boundary guard.
  - [phase-7-test-ci-hardening.md](phase-7-test-ci-hardening.md) — validation/migration/divergence test gaps, e2e self-skip, CI schema-sync fail-open, guard fragility.
  - **Data-grounded app improvements (from the `yaml-corpus-2` study):**
    - [phase-8-import-robustness.md](phase-8-import-robustness.md) — fix the list-vs-scalar `orphaned_file`/`orphaned_video` bug (blocks ~63% of real-file imports) + `YYYYMMDD_<subject>` date parsing + repairable coercions. *(highest value)*
    - [phase-9-opto-power-guard.md](phase-9-opto-power-guard.md) — `power_in_W` range warn-to-confirm (the one unguarded silent NWB corruption) + fix the misleading placeholder.
    - [phase-10-camera-calibration.md](phase-10-camera-calibration.md) — `meters_per_pixel > 0`, placeholder camera names, cross-day calibration-aliasing on import (within-file aliasing already guarded).
    - [phase-11-vocab-nudges.md](phase-11-vocab-nudges.md) — experimenter name-shape (Spyglass), genotype-vs-strain, placeholder-id, `location` typo nudge (catalog + species already done).
    - [phase-12-statescript-integrity.md](phase-12-statescript-integrity.md) — `associated_files` duplicate name/path + statescript description-keyword + path-shape guards.
  - **UX efficiency & clarity (from the live UX walkthrough, [../../research/yaml-corpus-2/13-ux-live-walkthrough.md](../../research/yaml-corpus-2/13-ux-live-walkthrough.md)):**
    - [phase-13-validation-presentation.md](phase-13-validation-presentation.md) — *(keystone; sequence BEFORE 8–12)* group/tier/collapse the Day Editor banner + reward-early/punish-late (use the existing `DRAFT` status for untouched days) + extend `humanizeValidationMessage` coverage + status-signal consistency. Makes the presentation absorb the new guards instead of becoming a ~20-row wall.
    - [phase-14-first-run-scope.md](phase-14-first-run-scope.md) — wizard collects `experiment_description` + pre-fills lab/institution (no first day born with errors). *(Its day-view read-only task moves into Phase 15 — trim Phase 14 to the wizard.)*
    - [phase-15-day-editor-ia-realign.md](phase-15-day-editor-ia-realign.md) — *(largest UX phase; the daily path)* realign the Day Editor to the finalized mock: grouped **vertical rail** (SESSION/RECORDING/FINISH), single-column sections, subject + technical params **inherited read-only**, DIO folded into RECORDING, day view scoped to the day-delta. Fixes the smushed/wrapping nav + the crammed "Day" tab at the root.

> **Sequencing note:** Phase 13 should land **before** the guard phases 8–12 — adding ~8–10 new issue
> types onto today's flat, punish-early banner would degrade the UX even as the data gets safer. Phases
> 1 is independent and can land any time; 14 is independent of the guard rules but pairs naturally with
> 13. **Phase 15 is the highest-leverage UX work** (the daily screen) and depends on Phase 13's
> per-section status model; it absorbs Phase 14's day-view read-only task. The original 1–7 keep their
> low-risk-first order.
