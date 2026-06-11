# Design-Feedback Remediation Implementation Plan

**Status:** Phases 1–7 complete (merged into `modern`); Phases 8A-1–10B not started. Phases 11–12
are intentionally reserved for selective user testing + the default-entry cutover decision and are
not Claude-Code implementation phases in this plan.

This plan turns six pieces of user design feedback plus a re-evaluated backlog into shippable work:
it guarantees recording days stay date-ordered, restores guided DIO entry (a Type + Index control),
un-hides the lab logo and keyboard-shortcuts affordance, removes the unused channel-maps editor, and
makes the confusing Tasks & Epochs screen comprehensible — first with in-place clarity fixes, then with
a "define-once, reuse-per-day" task-type catalog. After Phase 7, the remaining implementation work is
split so obvious UX friction is removed before user testing in small Claude-Code prompts, and the
task-catalog model is rehearsed before activation. Underneath the UX work it lays the foundations the
team chose for long-term maintainability: **incremental TypeScript** on the pure core, a **design-token +
CSS-Modules** styling system, a **persisted-data migration framework** so future shape changes never
discard saved work, and targeted **architecture decompositions** that the later UX phases ride on.

**Important rollout constraint:** do **not** make the Workspace the default entry point in any Claude-Code
phase here. Keep the legacy root route as-is until the separate selective user-testing phase produces a
cutover recommendation.

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
- [shared-contracts.md](shared-contracts.md) — YAML byte-identity, persisted-schema/migration, task-catalog model, design-token + CSS-Modules conventions, pre-test UX/default-entry gate.
- Phases (each ships as a separable PR unless noted):
  - [phase-1-quick-wins-day-order-dio.md](phase-1-quick-wins-day-order-dio.md) — day sort-on-write (F2) + restore DIO Type+Index control (F5). ✅ **Complete (merged)**.
  - [phase-2-typescript-bootstrap.md](phase-2-typescript-bootstrap.md) — TS toolchain (Vitest transform fix first) + type the pure I/O core. ✅ **Complete (merged)**.
  - [phase-3-design-tokens-css-modules.md](phase-3-design-tokens-css-modules.md) — token scale (incl. z-index) + CSS-Modules scaffolding + fix hidden logo/shortcuts (F3). ✅ **Complete (merged)**. F3 grew into a single-row app-bar redesign (logo · nav · shortcuts) per user feedback.
  - [phase-4-remove-channel-maps-editor.md](phase-4-remove-channel-maps-editor.md) — delete the workspace channel-maps editor (F1), full reference sweep. ✅ **Complete (merged)**.
  - [phase-5-dayeditor-structural-prep.md](phase-5-dayeditor-structural-prep.md) — `DayEditorContext` (kill prop-drill) + shared `deviceOverrideMerge` module; behavior-preserving. ✅ **Complete (merged)**.
  - [phase-6-tasks-epochs-redesign.md](phase-6-tasks-epochs-redesign.md) — Tasks & Epochs in-place clarity redesign (F4 quick wins) + a11y. ✅ **Complete (merged)**.
  - [phase-7-persistence-migration.md](phase-7-persistence-migration.md) — versioned persisted-blob forward migration (Post-v3 #6). ✅ **Complete (merged)**.
  - [phase-8a-pretest-ux-hardening.md](phase-8a-pretest-ux-hardening.md) — coordination index for 8A-1/8A-2/8A-3; do not use as a single execution prompt.
  - [phase-8a1-timeline-lifecycle-hardening.md](phase-8a1-timeline-lifecycle-hardening.md) — timeline-aware Add Recording Days + lifecycle/validated-state vocabulary; no export or schema change.
  - [phase-8a2-recognition-accessibility-hardening.md](phase-8a2-recognition-accessibility-hardening.md) — label parity, device-type summaries, and calendar keyboard/a11y; no export or schema change.
  - [phase-8a3-responsive-copy-hardening.md](phase-8a3-responsive-copy-hardening.md) — copy diet and 390px responsive rescue for the testing path; no export or schema change.
  - [phase-8b-task-type-catalog-model.md](phase-8b-task-type-catalog-model.md) — behavior-preserving task-catalog model utilities + migration rehearsal; no schema bump yet.
  - [phase-8c-task-type-catalog-ui.md](phase-8c-task-type-catalog-ui.md) — activate the animal-level task-type catalog; days pick/order epochs (F4 full) + trodes_to_nwb integration check.
  - [phase-8-task-type-catalog.md](phase-8-task-type-catalog.md) — superseded index pointing to 8A/8B/8C; do not use as an execution prompt.
  - [phase-9-architecture-cleanup.md](phase-9-architecture-cleanup.md) — split `validation.js`; decompose `ValidationSummary`/`RecordingDaysTab`; continue TS; **re-arm the build gate**.
  - [phase-10-post-v3-ux.md](phase-10-post-v3-ux.md) — remaining post-v3 UX/shape backlog after 8A-1/8A-2/8A-3 move the testing-critical items earlier: reconfig wizard, appliedToDays→derived, residual heading polish.
  - [phase-10b-user-testing-handoff.md](phase-10b-user-testing-handoff.md) — assemble the no-cutover selective-testing handoff package: stable routes, fixture, script, screenshots, known risks.
