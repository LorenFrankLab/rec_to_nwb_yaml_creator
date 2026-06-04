# Phase 1 — Export gate fails closed

[← back to PLAN.md](PLAN.md) · [overview](overview.md) · [shared-contracts](shared-contracts.md#validation--export-gate-contract)

Goal: make every route to "Download YAML" for a day consult the single authoritative
`computeStepStatus(...).export` status, so a schema/rule-invalid day cannot be exported by clicking,
keyboard, or trusting the step. This lands **first** because it makes the new path *fail closed* — the
safest immediate posture while phases 2–5 fix the underlying output. Until those land, valid sessions
that currently produce invalid YAML will (correctly) be blocked from export.

**Inputs to read first:**

- [src/pages/DayEditor/validation.js:52-70](../../../../src/pages/DayEditor/validation.js) —
  `computeStepStatus`; `export` is `'valid'` iff full validation has zero error-severity issues (`:68`).
- [src/pages/DayEditor/StepNavigation.jsx:25-43,118-143](../../../../src/pages/DayEditor/StepNavigation.jsx)
  — `handleNavigate` click gate (`:29`) and `isExportEnabled` (`:139`), which checks only
  overview/devices/epochs/validation and ignores `export`.
- [src/pages/DayEditor/DayEditorStepper.jsx:39-50](../../../../src/pages/DayEditor/DayEditorStepper.jsx)
  — the `Alt+Right`/`Alt+Left` stepper shortcut handler, which advances unconditionally.
- [src/pages/DayEditor/ExportStep.jsx:28-76](../../../../src/pages/DayEditor/ExportStep.jsx) —
  `handleDownload`; runs only `checkShadowExport` (encoder stability), never `validate`.
- [src/pages/DayEditor/shadowExport.js](../../../../src/pages/DayEditor/shadowExport.js) — the
  encoder-stability check that stays (it is not a schema check).

**Contracts referenced:**

- [Validation & export-gate contract](shared-contracts.md#validation--export-gate-contract) — the gate
  consults `computeStepStatus(...).export`; `ExportStep` re-checks it; the shadow-export check stays.
- [UX mistake-prevention contract](shared-contracts.md#ux-mistake-prevention-contract) — blocked export
  must expose repair actions, and valid export shows a preflight summary before download.

## Tasks

- **Gate the step-nav on `export`.** In `StepNavigation.jsx:139`, make `isExportEnabled(stepStatus)`
  also require `stepStatus.export === 'valid'` (it already requires the four prerequisite steps).
  The click gate at `:29` then blocks navigation to Export for an error day.
- **Make keyboard nav respect the gate.** In `DayEditorStepper.jsx` the stepper-shortcut `next` handler
  must not advance into `export` when `isExportEnabled` is false. Compute the same gate the click path
  uses (lift `isExportEnabled` to a shared helper, e.g. export it from `validation.js` or a small
  `stepGate.js`, and have both `StepNavigation` and `DayEditorStepper` import it — do not duplicate the
  step-id list). `Alt+Right` from `validation` with an error day stays on `validation`.
- **Re-validate at download (defense in depth).** In `ExportStep.jsx:handleDownload`, before the
  shadow-export check, recompute `computeStepStatus(day, mergedDay)` (or call `validate(mergedDay)`) and
  if there is any error-severity issue, block the download and surface the errors inline (reuse the
  existing `blockingError` UI). Keep the shadow-export encoder-stability check after it. The two checks
  are distinct (one is schema/rule validity, one is encoder determinism) — keep both.
- **Surface why export is blocked.** Where the Export step is rendered disabled, show the blocking
  reason (e.g. "Resolve N validation errors before exporting") sourced from the same status, so the user
  isn't staring at an inert button. Brief copy plus the repair-action list below replaces a generic pointer
  to the Validation step.
- **Make blocked export actionable.** Render each error-severity issue with a repair action that navigates to
  the owning step and focuses/highlights the relevant control when the issue carries a path/field target.
  Fall back to the owning step when a precise field target is unavailable. Reuse this action model in the
  Validation step/summary so the two surfaces agree. *Dependency:* this phase routes with the issue metadata
  that exists today (`step`, optional `field`) and degrades to step-level; phase 6's Task 9b extends the
  issue shape (`path`/`actionLabel`) so field-level coverage for the new rules completes there.
- **Show a valid-day preflight summary.** When export is valid, the Export step shows a compact read-only
  summary derived from the same `mergedDay` that will be encoded: subject/session readiness, configuration
  version, cameras/calibrations, probes/bad-channel count, tasks/videos, optogenetics on/off, and downstream
  identity warnings. This is the user's final confidence check before download. *Build the scaffold here from
  whatever `mergedDay` already carries; sections fill in as later phases land (configuration version → phase 2,
  cameras → phase 3, opto state → phase 8, identity warnings → phase 6).*
- **Docs.** Add a short entry to `docs/REFACTOR_CHANGELOG.md` noting the export path now fails closed on
  validation errors across button, keyboard, and step, with repair actions/preflight.

## Deliberately not in this phase

- **Fixing the underlying invalid output** (empty probes, string IDs, bad DOB) — phases 2–5. This phase
  only ensures invalid days can't slip out; making them valid comes next.
- **Adding new validation rules** — phase 6. This phase gates on the *existing* `validate` result.
- **Changing the shadow-export / encoder-stability mechanism** — out of scope; it stays as-is.

## Validation slice

| Test | Asserts |
| --- | --- |
| `isExportEnabled returns false when export status is error` *(unit)* | given a `stepStatus` with the four prereqs `'valid'` but `export: 'error'`, the gate is false (and true when `export: 'valid'`). **The fixture must isolate this:** use a day whose error routes past the prereq status computations — e.g. an electrode group missing schema-required `description`, which leaves `devices: 'valid'` (completeness-based) while `export: 'error'`. A blank `session_description` does **not** isolate it (it trips `overview` completeness and the old prereqs block anyway). |
| `step-nav click cannot reach Export on an error day` *(integration)* | clicking the Export step button with an error-day status does not navigate (`onNavigate` not called for `export`). |
| `Alt+Right does not advance into Export on an error day` *(integration)* | firing the stepper `next` shortcut from the `validation` step with an error day keeps `currentStep === 'validation'`; on a valid day it advances to `export`. |
| `ExportStep blocks download when validation has errors` *(integration)* | with an error-day `mergedDay`, `handleDownload` does not produce a file and renders the blocking error; with a valid day it proceeds to the shadow-export check. |
| `blocked export offers repair actions` *(integration)* | each rendered error has an owning-step repair action; clicking it navigates to the intended step and focuses/highlights the field when target metadata is available. |
| `valid export shows preflight summary` *(integration)* | a valid day renders the preflight sections from `mergedDay` before download: subject/session, configuration version, cameras, probes/bad channels, tasks/videos, and opto state. |
| `golden-yaml.baseline.test.js` (existing) | unchanged — no output bytes change in this phase. |

All Vitest; integration tests render the stepper/export step with a seeded day and reset state between runs.

## Fixtures

Reuse `makeConfiguredWorkspace()` ([test-fixtures.js](../../../../src/__tests__/helpers/test-fixtures.js))
for a valid day. Derive the error day so that **the prereq steps stay valid but `export` is error** —
e.g. drop `description` from an electrode group (a device-field schema error that
`computeDevicesStatus` ignores). Do not use a blank `session_description` (it makes `overview`
incomplete, so the old prereq gate blocks regardless and the test proves nothing about the new gate). No
new fixture shapes.

## Review

Dispatch `pr-review-toolkit:code-reviewer` against the diff before merging. Confirm: every task
implemented; the "Deliberately not" list honored; the shared `isExportEnabled` helper is used by both
nav paths (no duplicated step-id list); tests exercise real blocking (not tautologies); the shadow-export
check is preserved alongside the new schema re-check; repair links are field-targeted where possible; the
preflight summary is derived from `mergedDay` rather than duplicate state; no plan/phase strings in code or
test names; the changelog entry is updated. Also dispatch `pr-review-toolkit:silent-failure-hunter` (this
phase is all error-handling/gating).
