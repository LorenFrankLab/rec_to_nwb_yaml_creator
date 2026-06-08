# Phase 3-6 — Close the warning-escape on export

[charter](phase-3-setup-tabs.md) · [overview](overview.md) · pairs with [3-5](phase-3-5-validation-export-tab.md)

The export gate keys on `severity === 'error'` only; **warnings do not block** and can ride a batch /
valid-only export across N days (overview cross-cutting req 2). Require an **explicit acknowledgement** of
outstanding warnings — not just a count — so a silent downstream issue (e.g. an imported
`inconsistent_location_case`, an orphaned video/file) can't multiply across days unnoticed.

**Inputs to read first:**

- [validation.js:430-448](../../../../src/domain/validation.js) — `computeStepStatus`: returns only
  `valid`/`error`/`incomplete`, **no `warning` state**; the export gate ([:446](../../../../src/domain/validation.js)) counts error-severity only. Confirms warnings are invisible to the chip.
- [ValidationSummary/index.jsx:50-55](../../../../src/pages/ValidationSummary/index.jsx) — `deriveChip` is 3-state, no warning notion; `buildRows` does **not** carry warnings today (the new plumbing).
- [ExportStep.jsx:151-153](../../../../src/pages/DayEditor/ExportStep.jsx) — the per-day `validateDay(...).filter(i => i.severity === 'warning')` filter that already exists (reuse this exact predicate); [:345-399](../../../../src/pages/DayEditor/ExportStep.jsx) `buildPreflightSummary` (warnings row).
- [ValidationSummary/index.jsx:312](../../../../src/pages/ValidationSummary/index.jsx) `handleExportValidOnly`, [:364](../../../../src/pages/ValidationSummary/index.jsx) `runExport` — the batch/valid-only flow the acknowledgement gates.

## Tasks

- **Plumb per-day warnings into the export flow.** This is **new plumbing, not a free chip read**: extend
  the row build (or compute at preflight) `validateDay(day, merged, animal).filter(i => i.severity ===
  'warning')` ([same predicate as ExportStep.jsx:151-153](../../../../src/pages/DayEditor/ExportStep.jsx))
  for each exportable day, so the batch/valid-only flow knows which days carry outstanding warnings and
  what they are. Keep it read-only over the existing validators.
- **Require explicit acknowledgement.** In `handleExportValidOnly`/`runExport`
  ([:312, :364](../../../../src/pages/ValidationSummary/index.jsx)) — and in the per-animal export tab from
  [3-5](phase-3-5-validation-export-tab.md) — when the set of days to export carries outstanding warnings,
  present them grouped (day → warning message) and require an explicit "I've reviewed these warnings"
  acknowledgement (a checkbox-gated confirm, not just a displayed count) before the download proceeds. No
  outstanding warnings → no extra step.
- **Apply to both export surfaces.** The per-animal tab (3-5) and the chrome-level batch (Phase 4, when it
  lands) must share the acknowledgement component/logic — build it reusable here so Phase 4 inherits it.
- **Docs:** `docs/REFACTOR_CHANGELOG.md` entry noting the export flow now requires warning acknowledgement
  (a behavior change to the export UX — call it out, though export OUTPUT is unchanged).

## Deliberately not in this phase

- **Changing the export GATE** — warnings still don't *block*; this adds an acknowledgement step, it does
  not turn warnings into errors (that would move the 125 baselines' semantics and is out of scope).
- **The chrome-level batch screen itself** — Phase 4; this phase makes the acknowledgement reusable for it.
- **New warning RULES** — this surfaces existing warnings only; no new validation.

## Validation slice

| Test | Asserts |
| --- | --- |
| warnings surfaced per day | a day with an `inconsistent_location_case` warning is reported in the export flow's warning set with its message |
| acknowledgement gates export | valid-only/animal export with outstanding warnings does NOT download until the "reviewed" acknowledgement is given; cancel aborts |
| no warnings → no step | an export with zero outstanding warnings proceeds with no extra confirm |
| gate unchanged | a warning still does not block (an all-warnings day is still "valid"/exportable once acknowledged); an error still blocks |
| `npx vitest run baselines` | 125 byte-identical (export output + gate semantics unchanged) |

## Fixtures

A day carrying a non-blocking warning (e.g. an imported `inconsistent_location_case`) plus a clean day, in a single animal, so the batch path mixes acknowledged-warning and no-warning days.

## Review

Dispatch `pr-review-toolkit:code-reviewer` against the diff. Confirm:

- The acknowledgement is content-explicit (lists day → warning), not a bare count; it gates the actual download.
- The export gate is unchanged — warnings still don't block, errors still do; 125 baselines byte-identical.
- The warning plumbing reuses the existing `severity === 'warning'` predicate (no new/parallel validation).
- The acknowledgement component is reusable by the future batch screen (Phase 4).
- Lint 0 errors; build green; CHANGELOG entry included; names free of plan-milestone references.
