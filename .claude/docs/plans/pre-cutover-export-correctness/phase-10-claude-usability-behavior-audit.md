# Phase 10 — Claude-executable usability & proper-behavior audit

[← back to PLAN.md](PLAN.md) · [overview](overview.md) · [shared-contracts](shared-contracts.md#ux-mistake-prevention-contract)

Goal: give Claude Code an executable integrated audit for usability and proper behavior before the professional
UX polish gate. This is not a human usability study. It is a scripted, artifact-producing audit that uses the
codebase, Playwright, screenshots/traces, localStorage inspection, exported YAML, and the phase contracts to
catch confusing or scientifically dangerous behavior that ordinary unit tests can miss.

**Inputs to read first:**

- Phase docs 1–9 — especially each validation slice, the user mental-model contract, and the UX
  mistake-prevention contract.
- [phase-9-playwright-qa-pass.md](phase-9-playwright-qa-pass.md) — browser QA harness and Playwright flows.
- [src/state/workspaceUtils.js](../../../../src/state/workspaceUtils.js) — `mergeDayMetadata`; used for
  UI/state/export triangulation.
- [src/validation](../../../../src/validation) and
  [src/pages/DayEditor/validation.js](../../../../src/pages/DayEditor/validation.js) — validation issues,
  routing, and repair metadata.
- [src/pages/AnimalEditor](../../../../src/pages/AnimalEditor),
  [src/pages/DayEditor](../../../../src/pages/DayEditor), and [src/pages/Home](../../../../src/pages/Home)
  — surfaces audited for labels, defaults, disabled states, modals, and repair flows.
- [e2e](../../../../e2e), [playwright.config.js](../../../../playwright.config.js), and
  [package.json](../../../../package.json) — existing browser automation.

**Contracts referenced:**

- [User mental-model contract](shared-contracts.md#user-mental-model-contract) — the audit must judge flows
  from the scientist's workflow, not only schema correctness.
- [UX mistake-prevention contract](shared-contracts.md#ux-mistake-prevention-contract) — the audit looks for
  places users can still make dangerous mistakes or misunderstand what will export.
- [Spyglass naming-identity contract](shared-contracts.md#spyglass-naming-identity-contract) — especially
  camera zoom/calibration naming, data-acq names, task names, location strings, task/video dependencies.
- [DANDI conformance contract](shared-contracts.md#dandi-conformance-contract) — subject/session fields must
  be understandable and constrained before export.

## Tasks

- **Task 1 — generate the scenario + mental-model matrix.** Create a machine-readable/checklist artifact
  (`docs/qa/pre-cutover-usability-behavior-audit.md` or similar) listing the scripted scenarios, expected UI
  behavior, expected workspace state, expected exported YAML shape, expected validation/preflight result, user
  goal, likely user mental model, dangerous misconception, and UI prevention/repair behavior. Cover at least:
  create animal/session; configure probes; camera same-name/different-zoom; data-acq identity; region
  canonical entry; subject/DANDI fields; task/video references; fail-closed repair; persistence recovery;
  opto off/on; export preflight/download.
- **Task 2 — UI/state/export triangulation.** For each core scenario, use Playwright or a small Node helper to
  capture three views of truth: visible UI summary/labels, `rec_to_nwb_workspace_v1` localStorage state, and
  downloaded/encoded YAML. Fail or record a finding when these disagree (for example, UI shows one camera
  calibration but exported YAML uses another; data-acq appears configured but localStorage/export omit it).
- **Task 3 — mistake-injection audit.** Script likely user mistakes and assert the UI catches them before
  export: reused camera name with changed `meters_per_pixel`/`lens`; reused data-acq name with changed
  fields; task name with different description; region case drift; dangling task/video camera/epoch refs;
  whitespace-only required strings; slash in `subject_id`/`session_id`; partial opto. Record the exact first
  UI surface that catches each mistake.
- **Task 4 — labels, units, and decision clarity scan.** Inspect rendered labels/help/error text via
  Playwright locators and screenshots for ambiguous scientific fields. Required checks: `meters_per_pixel`
  includes unit/context; camera name guidance makes changed zoom/calibration imply new name; species examples
  are Latin binomial/NCBI URI, not `Rat`; region fields show canonical choices; preflight identifies the
  configuration version and camera calibrations; opto enabled/off state is unmistakable. Fix small copy/label
  issues in the owning phase's code when obvious; otherwise log findings with file/route/screenshot.
- **Task 5 — keyboard, focus, and narrow-viewport behavior.** Drive the highest-risk dialogs and repair flows
  by keyboard only, then repeat at a narrow viewport. Assert focus lands in the expected control after repair
  navigation, modals trap/restore focus, primary safe actions are reachable, disabled buttons expose a reason,
  and no critical text/control overlap prevents completion.
- **Task 6 — error-recovery drill.** Start from bad imported/seeded state, then use only visible repair
  actions to reach a valid exportable state. The audit should prove users do not need to know schema paths,
  Spyglass primary keys, or DANDI validator internals to repair a day.
- **Task 7 — produce a findings/fix log.** The phase output is a concise QA artifact with: scenarios run,
  commands run, screenshots/traces/downloads location, pass/fail table, bugs fixed during the phase, residual
  findings with severity, and explicit Phase 11 readiness recommendation (`proceed to Phase 11`, `proceed to
  Phase 11 with tracked follow-ups`, or `block Phase 11`). Dangerous-confusion findings block handoff to Phase
  11 and the cutover path until fixed or explicitly accepted in the artifact.

## Deliberately not in this phase

- **Human usability testing** — strongly recommended separately with lab users, but not part of this
  Claude-executable phase.
- **Broad redesign** — this phase may fix small labels/focus/disabled-state issues, but larger UX redesigns
  should become targeted follow-up issues or PRs.
- **Replacing Phase 9 Playwright regression tests** — Phase 10 may add helper scripts/tests, but its purpose
  is audit and findings, not just expanding the permanent e2e suite.
- **Changing scientific/export rules** — if the audit finds rule ambiguity, fix the owning phase/contract
  deliberately rather than hiding the issue in QA.

## Validation slice

| Test / Artifact | Asserts |
| --- | --- |
| `pre-cutover usability scenario/mental-model matrix` *(QA artifact)* | each core scenario has user goal, likely mental model, dangerous misconception, expected UI behavior, workspace state, exported YAML shape, validation/preflight result, and pass/fail status. |
| `UI/state/export triangulation` *(Playwright/helper)* | visible configured values, localStorage state, and exported YAML agree for cameras/calibration, data-acq, devices, subject/session, tasks/videos, and opto. |
| `mistake injection catches dangerous states early` *(Playwright/helper)* | high-risk mistakes are caught at the editing surface or repair summary before export, with the first catching surface recorded. |
| `labels and units are scientifically clear` *(audit artifact + screenshots)* | camera calibration/zoom, species, region, configuration version, preflight, and opto state have clear labels/examples and no misleading defaults. |
| `keyboard and narrow viewport completion` *(Playwright)* | critical dialogs, repair navigation, and Export can be completed by keyboard and at a narrow viewport without unreachable controls or incoherent overlap. |
| `error recovery reaches valid export` *(Playwright/helper)* | starting from seeded invalid state, visible repair actions lead to a valid preflight/download without schema/internal knowledge. |
| `findings/fix log` *(QA artifact)* | includes commands, artifacts, fixes made, remaining findings by severity, and Phase 11 readiness recommendation. |

## Fixtures

Reuse Phase 9 e2e fixtures and workspace builders. Add small scenario-specific seeds only when needed to
represent bad imported/existing state. Keep fixture values realistic enough to expose naming/identity mistakes:
two cameras with same base name but different `meters_per_pixel`/`lens`, data-acq name reuse with changed
hardware fields, task-name reuse with changed description, and opto partial/complete state.

## Review

`pr-review-toolkit:code-reviewer`; `ux-reviewer`; `pr-review-toolkit:silent-failure-hunter`. Confirm: the
audit is executable by Claude Code from a clean checkout; required scenarios do not silently skip; artifacts
are useful for debugging; findings are severity-ranked and tied to files/routes/screenshots; dangerous
confusion blocks handoff to Phase 11 and the cutover path; manual human usability testing is recommended
separately but not required to execute this phase.
