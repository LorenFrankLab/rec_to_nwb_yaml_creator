# Phase 3-5 — Per-animal Validation & Export tab + effective-setup-for-THIS-day review

[charter](phase-3-setup-tabs.md) · [overview](overview.md)

Make the `export` tab real: a per-animal slice of the Validation Summary (readiness + repairs + export
scoped to one animal), and the **mandatory "effective setup for THIS day" review** — the valid-but-wrong
defense ([overview cross-cutting req 1](overview.md)). This review is a **hard prerequisite for retiring
the day-row scan line** (overview decision 12), because the scan detail relocates here.

Independent of the setup-tab extraction (3-1…3-4) — it only touches `ValidationSummary` + `AnimalView` —
so it MAY be built in parallel with, or even before, the extraction if a lower-risk start is wanted.

**Inputs to read first:**

- [ValidationSummary/index.jsx:82](../../../../src/pages/ValidationSummary/index.jsx) — `buildRows(workspace)`: **workspace-global, NO animal param** (the refactor target). [:50-55](../../../../src/pages/ValidationSummary/index.jsx) `deriveChip`; [:57](../../../../src/pages/ValidationSummary/index.jsx) `CHIP_LABEL`; [:132-137](../../../../src/pages/ValidationSummary/index.jsx) the per-row scan fields (version/historical/cameras/opto); [:312](../../../../src/pages/ValidationSummary/index.jsx) `handleExportValidOnly`, [:364](../../../../src/pages/ValidationSummary/index.jsx) `runExport`.
- [ExportStep.jsx:144](../../../../src/pages/DayEditor/ExportStep.jsx) `getDayWorkflowStatus` usage; [:345-399](../../../../src/pages/DayEditor/ExportStep.jsx) `buildPreflightSummary` (the 10-row effective-setup summary to mirror read-only); [DayTechnicalSection.jsx:24-31](../../../../src/pages/DayEditor/DayTechnicalSection.jsx) `resolveRigConstant` (effective per-day rig constants).
- [workflowStatus.js](../../../../src/domain/workflowStatus.js) — `getDayWorkflowStatus` (config version, historical flag) + `getDayRowStatus` (the Phase 2 row status).
- [AnimalView/index.jsx:160-170](../../../../src/pages/AnimalView/index.jsx) — the `export` placeholder to replace.

## Tasks

- **Add an animal-scoped entry point to `buildRows`.** Either add `buildRows(workspace, { animalKey })` or
  a thin `buildAnimalRows(workspace, animalKey)` that filters `buildRows`' output by `animalKey`
  ([:82](../../../../src/pages/ValidationSummary/index.jsx)). "Reuse, don't re-derive" — the validation/chip
  logic ([deriveChip:50-55](../../../../src/pages/ValidationSummary/index.jsx)) is untouched; only the row
  set is scoped. The existing workspace-global Validation Summary (the future chrome-level "All animals —
  batch export", Phase 4) keeps working off the unscoped path.
- **Render the per-animal Validation & Export tab in `AnimalView`** for `:tab === 'export'`, replacing the
  placeholder. Persistent scoped header: "This animal — readiness & export · Showing: {id} — {N} days".
  Per-day rows show readiness chip ([CHIP_LABEL:57](../../../../src/pages/ValidationSummary/index.jsx)),
  the ownership-pattern repair hints (Phase 8.7 Task 9), and single/animal export
  ([runExport:364](../../../../src/pages/ValidationSummary/index.jsx)).
- **Config-version legibility on the rows (Task 3.4, validation slice).** Replace bare "v2" with the dated
  context from `getDayWorkflowStatus` + `getConfigHistory` ("recorded under the config from [date]"). Pairs
  with the ephys-tab slice in [3-2](phase-3-2-ephys-tabs.md).
- **Effective-setup-for-THIS-day review (Task 3.3a) — the valid-but-wrong defense.** For each day, surface
  read-only what *that day actually used*, **clearly labelled vs. the animal's CURRENT setup tabs**: pinned
  configuration version (+ dated description), referenced cameras, electrode groups, failed channels, and
  the effective rig constants ([resolveRigConstant:24-31](../../../../src/pages/DayEditor/DayTechnicalSection.jsx)).
  Reuse `buildPreflightSummary` ([ExportStep.jsx:345-399](../../../../src/pages/DayEditor/ExportStep.jsx))
  rather than re-deriving — render it (or its data) read-only in the day's row/expander. A historical day is
  pinned to an older version; this view must show *that day's* values, not the latest setup tab's. This is
  the surface the day-row scan line (overview decision 12) relocates into.
- **Docs:** add a `docs/REFACTOR_CHANGELOG.md` entry for the per-animal Validation & Export tab + the
  effective-day review (note it unblocks the decision-12 day-row scan retirement, to be done later).

## Deliberately not in this phase

- **Retiring the day-row scan line** in `RecordingDaysTab` — that's a follow-on once this review exists
  (overview decision 12 / a later phase); this phase only builds the destination, it does not remove the row detail.
- **Warning acknowledgement on export** — [3-6](phase-3-6-warning-ack.md).
- **The chrome-level "All animals — batch export"** — Phase 4 (this is the per-animal surface only).
- **Repair button re-routing to tabs** — [Phase 3a](phase-3a-repair-routing.md); repair hints still link to the legacy editor here.

## Validation slice

| Test | Asserts |
| --- | --- |
| animal-scoped rows | `buildAnimalRows(workspace,'remy')` returns ONLY remy's days; chips match the unscoped `buildRows` for the same days (no re-derivation drift) |
| export tab renders | `#/animal/remy/export` shows the scoped header "Showing: remy — N days" and the per-day readiness rows (not the placeholder) |
| single/animal export | exporting from the tab downloads the animal's valid days (reuses `runExport`); a blocked day is skipped with its reason |
| config-version legibility | a historical (pinned older-version) day shows the dated config context, not bare "v2" |
| effective-day review | a day pinned to v1 (animal latest = v2) shows v1's cameras/electrodes/failed-channels read-only, labelled distinct from current setup; values come from `buildPreflightSummary` (not re-derived) |
| `npx vitest run baselines` | 125 byte-identical (export output unchanged) |

## Fixtures

`buildRealisticWorkspace()` for the happy path; a two-version animal with one day pinned to v1 and one to v2 for the historical/effective-day tests; a day with a blocking error for the skip test.

## Review

Dispatch `pr-review-toolkit:code-reviewer` against the diff. Confirm:

- The animal scope is a FILTER over `buildRows`, not a parallel validation path (chips identical to unscoped for the same days).
- The effective-day review reuses `buildPreflightSummary`/`resolveRigConstant` (read-only) and is clearly distinguished from the current setup tabs (no implication a historical day uses the latest config).
- Export output is byte-identical (125 baselines); no store/schema change.
- "Deliberately not in this phase" honored — the day-row scan line is NOT yet removed; no batch screen; no repair re-routing.
- Lint 0 errors; build green; the CHANGELOG entry is included; names free of plan-milestone references.
