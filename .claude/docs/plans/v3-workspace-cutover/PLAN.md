# v3.0.0 Workspace Cutover — Implementation Plan

**Status:** Phases 0–2 complete (merged to `modern`). Phase 3 next.

Carries the `modern` branch from its mid-build state (M8a complete; new multi-page workspace exists
but cannot export YAML and loses data on refresh) through to **v3.0.0**, where the workspace UI is a
complete, safe, end-to-end workflow that produces byte-identical YAML, persists work to the browser,
and becomes the default — with the legacy single-page form retained behind a toggle for one release.
This plan integrates the remaining original milestones (M8b–M13 from [docs/TASKS.md](../../../../docs/TASKS.md))
with the safety, accessibility, and tech-debt findings from the [2026-06-03 audit](../../reviews/2026-06-03-modern-branch-audit.md).

## Reading order

For agent invocation, **load only the slice you need**:

1. **Working a specific phase?** Open the matching phase file. Each is self-contained: inputs to
   read, contracts/designs it depends on, tasks, validation slice, fixtures.
2. **Need shared semantics?** [shared-contracts.md](shared-contracts.md).
3. **Closing out a phase (verify + review)?** [review-protocol.md](review-protocol.md).
4. **Need broader scope / risks / rollout / dependency policy?** [overview.md](overview.md).

## Files

- [overview.md](overview.md) — goals, non-goals, integration points, rollout to v3.0.0, risks.
- [shared-contracts.md](shared-contracts.md) — workspace data model, `mergeDayMetadata`, validation
  status, persistence, `<Modal>` primitive, YAML-parity contracts referenced across phases.
- [review-protocol.md](review-protocol.md) — the verify-and-review gate every phase passes:
  self-verification, Playwright UI verification, code review, specialized + UX/a11y reviewers, with a
  per-phase matrix.
- Phases (each ships as a separable PR):
  - [phase-0-setup-ci-hygiene.md](phase-0-setup-ci-hygiene.md) — make the project set up and CI pass
    cleanly for a fresh contributor (README, Node-without-nvm, `yaml` advisory, CI triggers).
  - [phase-1-persistence.md](phase-1-persistence.md) — **safety:** real localStorage autosave,
    truthful SaveIndicator, `beforeunload` guard, clone `mergeDayMetadata` output.
  - [phase-2-navigation-stub-honesty.md](phase-2-navigation-stub-honesty.md) — **safety/a11y:**
    global nav + legacy toggle, fix broken links & dead-ends, honestly mark stub steps, duplicate
    `<main>`/focus-trap fixes, extend landmark tests to new routes.
  - [phase-3-shared-modal-feedback.md](phase-3-shared-modal-feedback.md) — **tech debt:** extract a
    shared accessible `<Modal>`, migrate existing modals, replace `alert()`/`confirm()` with the
    in-app feedback components, single device-type source.
  - [phase-4-tasks-epochs.md](phase-4-tasks-epochs.md) — **M8b:** Day Editor Tasks & Epochs step
    (replaces `EpochsStub`).
  - [phase-5-validation-export.md](phase-5-validation-export.md) — **M9 (critical):** per-day
    Validation step + Export step with shadow-export parity; the new UI can finally produce YAML.
  - [phase-6-store-decomposition-css.md](phase-6-store-decomposition-css.md) — **tech debt:**
    decompose `store.js`, resolve the DayEditor `.css`/`.scss` split-brain, delete dead stubs.
  - [phase-7-validation-summary-batch.md](phase-7-validation-summary-batch.md) — **M10:** cross-day
    Validation Summary + "Validate All" / "Export Valid Only".
  - [phase-8-probe-reconfig-wizard.md](phase-8-probe-reconfig-wizard.md) — **M11:** probe
    reconfiguration diff + apply-forward + snapshot history.
  - [phase-9-a11y-keyboard.md](phase-9-a11y-keyboard.md) — **M12:** global keyboard shortcuts,
    full ARIA/tab-order coverage, automated Axe in CI.
  - [phase-10-cutover-v3.md](phase-10-cutover-v3.md) — **M13:** default route → workspace, legacy
    toggle, flag flip, parity enforcement, tag v3.0.0.
