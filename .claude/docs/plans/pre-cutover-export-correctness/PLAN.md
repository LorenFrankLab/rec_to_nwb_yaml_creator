# Pre-cutover Export Correctness Implementation Plan

**Status:** Phases 1–3 complete (export gate fails closed; device resolution / day bad-channel merge; Hardware Config wiring + identity safety). Phases 4–11 not started.

The new multi-page workspace UI can currently hand `trodes_to_nwb` a YAML file that is
silently wrong — missing electrode probes, missing day-level bad-channel marks, schema-invalid
device IDs, or a date-of-birth the schema rejects — with no error shown to the user. This plan
closes those export-correctness defects so the workspace path produces valid, complete metadata,
and hardens the surrounding import and persistence edges. **Scope note:** phases 1–8 are the
export-correctness fixes; phases 9–11 extend the plan to pre-cutover **QA and UX readiness** (browser
regression QA, a Claude-executable usability/behavior audit, and a professional-UX-polish audit) so the
workspace is not only correct but coherent and safe for repeated scientific use. It is the correctness
prerequisite for the v3 cutover (the [v3-workspace-cutover](../v3-workspace-cutover/PLAN.md) Phase 11),
which must not flip the default route to the workspace until the export path is trustworthy.

## Reading order

For agent invocation, **load only the slice you need**:

1. **Working a specific phase?** Open the matching phase file. Each is self-contained: inputs to read,
   contracts/designs it depends on, tasks, validation slice, fixtures.
2. **Need shared semantics or user mental model?** [shared-contracts.md](shared-contracts.md).
3. **Need the device-resolution design?** [designs.md](designs.md).
4. **Need broader scope / risks / rollout / parity policy?** [overview.md](overview.md).

## Files

- [overview.md](overview.md) — goals, non-goals, integration points, parity/golden-fixture policy, rollout, risks, open questions.
- [shared-contracts.md](shared-contracts.md) — user mental model, export-resolution source-of-truth, schema device-output, validation/export-gate, UX quality, and parity contracts referenced across phases.
- [designs.md](designs.md) — the device-resolution model (live config vs. configuration snapshots) — the one genuinely contested design decision.
- Phases (each ships as a separable PR):
  - [phase-1-export-gate-fail-closed.md](phase-1-export-gate-fail-closed.md) — **safety first:** make the per-day Download gate, the Export step, and keyboard nav all respect full validation, so a schema/rule-invalid day can no longer be exported. No output bytes change.
  - [phase-2-device-resolution.md](phase-2-device-resolution.md) — **P0 data loss:** export the *configured* probes by resolving the day's pinned configuration snapshot (`animal.devices` only mirrors the latest snapshot) and merge day-level bad-channel edits into the exported ntrode map.
  - [phase-3-hardware-config-wiring.md](phase-3-hardware-config-wiring.md) — **P0:** wire the Animal Editor Hardware Config step's camera add/edit/delete and route data-acq / technical-default edits to the locations the export actually reads.
  - [phase-4-schema-valid-devices.md](phase-4-schema-valid-devices.md) — **P1:** integer electrode-group / ntrode IDs, required `description`/`targeted_location`, `device.name`, **per-shank electrode-ID offsets** for multi-shank probes, drop stray non-schema keys, and guard ntrode-ID collisions.
  - [phase-5-subject-session-completeness.md](phase-5-subject-session-completeness.md) — **P0/P1:** the missing required + DANDI-blocking subject/session fields — non-empty subject `description`, `weight`, timestamp `date_of_birth`, **`species` as a Latin binomial**, no-slash `subject_id`/`session_id`, and non-empty `experiment_description`.
  - [phase-6-validation-completeness.md](phase-6-validation-completeness.md) — **P1:** the missing validation rules and task/video mistake-prevention UX — controlled task/video camera + epoch references, corrected **probe-electrode-ID channel bounds**, non-empty/canonical locations, behavioral-event-name uniqueness, video↔task dependency, and the Spyglass/DANDI identity rules across the workspace/dataset.
  - [phase-7-import-persistence-hardening.md](phase-7-import-persistence-hardening.md) — **P2:** the shared nested-error-path fix (workspace gate messages) + the explicitly scoped legacy partial-import exception; guard the empty-blob load crash and the failed-autosave unsaved-work gap.
  - [phase-8-optogenetics-correctness.md](phase-8-optogenetics-correctness.md) — **P1 (opto sessions):** add/verify the workspace opto entry path, fix the trodes_to_nwb opto key mismatches (`optogenetic_stimulation_software`, `volume_in_uL`) with a schema-safe transition, and validate all-or-nothing completeness so an opto session isn't silently dropped.
  - [phase-9-playwright-qa-pass.md](phase-9-playwright-qa-pass.md) — **browser regression QA:** add a Playwright workspace regression suite and runbook that exercise the corrected Phases 1–8 flows in a real browser: mistake-prevention UX, repair navigation, export gating/preflight/download, persistence recovery, and opto on/off behavior.
  - [phase-10-claude-usability-behavior-audit.md](phase-10-claude-usability-behavior-audit.md) — **Claude-executable usability/proper-behavior audit:** run scripted scenario matrices, mistake injection, UI/state/export triangulation, keyboard/viewport checks, and produce a findings/fix log before cutover.
  - [phase-11-professional-ux-polish-audit.md](phase-11-professional-ux-polish-audit.md) — **professional UX polish audit (not the v3 cutover phase):** run a Claude-executable design-system, interaction-consistency, accessibility, content, responsive-layout, and perceived-performance pass with fixes/findings.
