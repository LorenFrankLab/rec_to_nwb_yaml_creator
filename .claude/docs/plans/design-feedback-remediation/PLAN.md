# Design-Feedback Remediation Implementation Plan

**Status:** Not started.

This plan turns six pieces of user design feedback plus a re-evaluated backlog into shippable work:
it guarantees recording days stay date-ordered, restores guided DIO entry (a Type + Index control),
un-hides the lab logo and keyboard-shortcuts affordance, removes the unused channel-maps editor, and
makes the confusing Tasks & Epochs screen comprehensible — first with in-place clarity fixes, then with
a "define-once, reuse-per-day" task-type catalog. Underneath the UX work it lays the foundations the
team chose for long-term maintainability: **incremental TypeScript** on the pure core, a **design-token +
CSS-Modules** styling system, a **persisted-data migration framework** so future shape changes never
discard saved work, and targeted **architecture decompositions** that the later UX phases ride on.

Ordering: the small, high-value bug fixes ship **first** (they prevent silent data loss and have no
foundation dependency); the structural decomposition lands **before** the Tasks-screen rewrites so those
don't churn an 825-LOC monolith twice.

## Reading order

For agent invocation, **load only the slice you need**:

1. **Working a specific phase?** Open the matching phase file — each is a self-contained execution prompt.
2. **Need shared semantics?** [shared-contracts.md](shared-contracts.md).
3. **Need broader scope / risks / dependency policy?** [overview.md](overview.md).
4. **Need the UX/architecture rationale behind a choice?** The research notes in
   [../../research/](../../research/): `design-feedback-evaluation.md`, `ux-principles.md`, `architecture-assessment.md`.

## Files

- [overview.md](overview.md) — scope, integration points, risks, rollout, open questions.
- [shared-contracts.md](shared-contracts.md) — YAML byte-identity, persisted-schema/migration, task-catalog model, design-token + CSS-Modules conventions.
- Phases (each ships as a separable PR unless noted):
  - [phase-1-quick-wins-day-order-dio.md](phase-1-quick-wins-day-order-dio.md) — day sort-on-write (F2) + restore DIO Type+Index control (F5).
  - [phase-2-typescript-bootstrap.md](phase-2-typescript-bootstrap.md) — TS toolchain (Vitest transform fix first) + type the pure I/O core.
  - [phase-3-design-tokens-css-modules.md](phase-3-design-tokens-css-modules.md) — token scale (incl. z-index) + CSS-Modules scaffolding + fix hidden logo/shortcuts (F3).
  - [phase-4-remove-channel-maps-editor.md](phase-4-remove-channel-maps-editor.md) — delete the workspace channel-maps editor (F1), full reference sweep.
  - [phase-5-dayeditor-structural-prep.md](phase-5-dayeditor-structural-prep.md) — `DayEditorContext` (kill prop-drill) + shared `deviceOverrideMerge` module; behavior-preserving.
  - [phase-6-tasks-epochs-redesign.md](phase-6-tasks-epochs-redesign.md) — Tasks & Epochs in-place clarity redesign (F4 quick wins) + a11y.
  - [phase-7-persistence-migration.md](phase-7-persistence-migration.md) — versioned persisted-blob forward migration (Post-v3 #6).
  - [phase-8-task-type-catalog.md](phase-8-task-type-catalog.md) — animal-level task-type catalog; days pick/order epochs (F4 full) + trodes_to_nwb integration check.
  - [phase-9-architecture-cleanup.md](phase-9-architecture-cleanup.md) — split `validation.js`; decompose `ValidationSummary`/`RecordingDaysTab`; continue TS; **re-arm the build gate**.
  - [phase-10-post-v3-ux.md](phase-10-post-v3-ux.md) — device_type summaries, reconfig wizard, validated indicator, calendar a11y, appliedToDays→derived.
