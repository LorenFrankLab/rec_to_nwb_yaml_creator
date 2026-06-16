# Phase 5 — Export preview + batch

[← back to PLAN.md](PLAN.md) · [overview](overview.md) · [shared-contracts](shared-contracts.md)

Reshape the day's Export step into the **export-preview** screen: the readiness gate (issue-driven,
blocking issues field-linked, **Download/Copy disabled** while blocked — both produce the YAML), the derived filename, a read-only YAML
preview, Download/Copy with success toasts, and the **batch** "export all days" result (exported N · skipped
M, each skipped day linked to its issue). Retires the old `ExportStep`/`ValidationStep`. Design:
[export-preview.html](export-preview.html).

**Inputs to read first:**

- [src/pages/DayEditor/ExportStep.tsx](../../../src/pages/DayEditor/ExportStep.tsx) + [ValidationStep.tsx](../../../src/pages/DayEditor/ValidationStep.tsx) — the steps replaced here (export gate + parity check + preflight).
- [src/pages/ValidationSummary/index.tsx](../../../src/pages/ValidationSummary/index.tsx) + [useValidationSummaryActions.ts](../../../src/pages/ValidationSummary/useValidationSummaryActions.ts) — the batch "Export Valid Only" + preflight/report; reuse for the batch result.
- [src/domain/dayValidationComposer.ts:51](../../../src/domain/dayValidationComposer.ts) — `validateDay` (the gate).
- [src/state/workspaceUtils.ts:357](../../../src/state/workspaceUtils.ts) — `mergeDayMetadata` (the preview body).
- [src/io/yaml.ts](../../../src/io/yaml.ts) — `encodeYaml:38`, `formatDeterministicFilename:102`, `downloadYamlFile:122` (verbatim).

**Contracts referenced:**

- [Issue-driven readiness](designs.md#issue-driven-readiness) — gate reads `validateDay`; Download `disabledReason` = non-empty error list.
- [Byte-identity gate](shared-contracts.md#1-byte-identity-gate) — the preview body IS `encodeYaml(mergeDayMetadata(...))`; never a hand-built approximation. Phase 0 `UndoToast`/toast host, `ReadinessBar`.

## Tasks

- New export-preview surface (route reuse: the day's Export action / `#/day/:id` export, or a small `?export=1` panel — match the existing entry). Header: "Export — {date}" + breadcrumb.
- Readiness gate: compute `issues = validateDay(day, mergeDayMetadata(animal, day), animal, animalDays)`. Quiet "✓ Ready to export" when no errors; loud "N issues block export" with each blocking issue field-linked (`repairRouting`) when present. **BOTH Download AND Copy disabled while blocking** — both produce the YAML, so Copy is not an escape hatch around the gate (`disabledReason` from the gate on each).
- Filename: `formatDeterministicFilename` over the merged model (verify the model carries `EXPERIMENT_DATE_in_format_mmddYYYY` + `subject.subject_id`, or build the filename from `day.experimentDate` + subject id the way `ExportStep` does today — read its call site).
- YAML preview: render `encodeYaml(mergeDayMetadata(animal, day))` read-only (the real bytes). Download → `downloadYamlFile(filename, yaml)` + success toast "✓ Downloaded {filename}". Copy → clipboard + "✓ YAML copied".
- Batch: "Export all {N} days" → reuse `useValidationSummaryActions` "Export Valid Only" path; render the result panel "Exported N · Skipped M", each skipped day linked to its blocking issue **via the field-level repair route (`repairRouting`) — the same "Fix in …" target as the single-day gate, not a bare day link**. Same parity/skip semantics as today — one exporter.
- Retire `ExportStep.tsx` + `ValidationStep.tsx` (the readiness bar on the Day frame, Phase 3, replaced the inline Validation step's role; this screen replaces Export). Name the removals.
- CHANGELOG: export-preview screen + batch result + success feedback.

## Deliberately not in this phase

- A second exporter or parity check — reuse `encodeYaml`/`mergeDayMetadata`/the `ValidationSummary` batch path. No new export logic.
- Async progress UI for very large batches — the corpus is small (≤~60 days/animal); a result panel suffices. If a future large batch needs progress, that's its own phase.

## Validation slice

| Test | Asserts |
| --- | --- |
| `ExportPreview.test.tsx` | clean day → quiet "Ready to export" + enabled Download/Copy; blocking day → loud field-linked issues + **both Download AND Copy disabled** (no Copy bypass); Copy/Download fire success toasts when clean |
| `ExportPreview.preview.test.tsx` | preview body === `encodeYaml(mergeDayMetadata(animal, day))` (the real bytes); filename === the existing `ExportStep` filename for the golden day |
| `batchResult.test.tsx` | batch reuses `useValidationSummaryActions`; result shows exported/skipped counts; each skipped day links to its issue via `repairRouting` (field-level, same target as the single-day gate) |
| `baselines` | downloaded YAML byte-identical to the golden fixture; batch export of a valid day === single export |

## Fixtures

The golden day (preview byte-identity + filename); a blocking day (missing video / empty probe location) for
the blocked gate + disabled Download; a multi-day animal with one invalid day (batch exported-N/skipped-M).

## Review

Dispatch `code-reviewer`. Confirm: preview body is the real `encodeYaml(mergeDayMetadata)` (not an
approximation); gate reads `validateDay`; **both Download and Copy** disabled strictly from the gate (no Copy bypass); batch reuses the shared
exporter (no second path); `ExportStep`/`ValidationStep` removed; `npx vitest run baselines` byte-identical;
lint/typecheck/e2e green.
