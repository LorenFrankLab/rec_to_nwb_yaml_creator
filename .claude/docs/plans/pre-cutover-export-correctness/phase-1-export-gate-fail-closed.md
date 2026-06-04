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
  isn't staring at an inert button. Small copy + a pointer to the Validation step.
- **Docs.** Add a short entry to `docs/REFACTOR_CHANGELOG.md` noting the export path now fails closed on
  validation errors across button, keyboard, and step.

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
check is preserved alongside the new schema re-check; no plan/phase strings in code or test names; the
changelog entry is updated. Also dispatch `pr-review-toolkit:silent-failure-hunter` (this phase is all
error-handling/gating).
