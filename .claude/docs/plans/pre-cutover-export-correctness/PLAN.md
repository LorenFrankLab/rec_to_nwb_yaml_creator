# Pre-cutover Export Correctness Implementation Plan

**Status:** Not started.

The new multi-page workspace UI can currently hand `trodes_to_nwb` a YAML file that is
silently wrong — missing electrode probes, missing day-level bad-channel marks, schema-invalid
device IDs, or a date-of-birth the schema rejects — with no error shown to the user. This plan
closes those export-correctness defects so the workspace path produces valid, complete metadata,
and hardens the surrounding import and persistence edges. It is the correctness prerequisite for the
v3 cutover (the [v3-workspace-cutover](../v3-workspace-cutover/PLAN.md) Phase 11), which must not flip
the default route to the workspace until the export path is trustworthy.

## Reading order

For agent invocation, **load only the slice you need**:

1. **Working a specific phase?** Open the matching phase file. Each is self-contained: inputs to read,
   contracts/designs it depends on, tasks, validation slice, fixtures.
2. **Need shared semantics?** [shared-contracts.md](shared-contracts.md).
3. **Need the device-resolution design?** [designs.md](designs.md).
4. **Need broader scope / risks / rollout / parity policy?** [overview.md](overview.md).

## Files

- [overview.md](overview.md) — goals, non-goals, integration points, parity/golden-fixture policy, rollout, risks, open questions.
- [shared-contracts.md](shared-contracts.md) — export-resolution source-of-truth, schema device-output, validation/export-gate, and parity contracts referenced across phases.
- [designs.md](designs.md) — the device-resolution model (live config vs. configuration snapshots) — the one genuinely contested design decision.
- Phases (each ships as a separable PR):
  - [phase-1-export-gate-fail-closed.md](phase-1-export-gate-fail-closed.md) — **safety first:** make the per-day Download gate, the Export step, and keyboard nav all respect full validation, so a schema/rule-invalid day can no longer be exported. No output bytes change.
  - [phase-2-device-resolution.md](phase-2-device-resolution.md) — **P0 data loss:** export the *configured* probes (resolve the current config from live `animal.devices`) and merge day-level bad-channel edits into the exported ntrode map.
  - [phase-3-hardware-config-wiring.md](phase-3-hardware-config-wiring.md) — **P0:** wire the Animal Editor Hardware Config step's camera add/edit/delete and route data-acq / technical edits to the locations the export actually reads.
  - [phase-4-schema-valid-devices.md](phase-4-schema-valid-devices.md) — **P1:** emit integer electrode-group / ntrode IDs, the schema-required `description` and `targeted_location`, and guard against ntrode-ID collisions on incremental add.
  - [phase-5-dob-format.md](phase-5-dob-format.md) — **P1:** store a schema-valid timestamp date-of-birth at animal creation and give the new editor a repair path for existing date-only values.
  - [phase-6-validation-completeness.md](phase-6-validation-completeness.md) — **P1:** add the missing cross-reference (dangling camera / electrode-group IDs) and channel-bound (out-of-range map / bad-channel) validation rules.
  - [phase-7-import-persistence-hardening.md](phase-7-import-persistence-hardening.md) — **P2:** fix the nested-error path that makes partial import keep invalid objects; guard the empty-blob load crash and the failed-autosave unsaved-work gap.
