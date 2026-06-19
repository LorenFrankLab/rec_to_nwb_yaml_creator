# Phase 4 — Entry points, upload, diff preview

[← back to PLAN.md](PLAN.md) · [overview](overview.md) · [shared-contracts §3](shared-contracts.md#3-import-plan)

The first end-to-end user value: upload a `.trodesconf`, preview the diff, apply. Two entry points
(create-animal + new-configuration), reusing the existing reconfig diff rendering and the `FileUpload`
control.

**Inputs to read first:**

- [shared-contracts §3](shared-contracts.md#3-import-plan) — the `TrodesconfImportPlan` the preview
  renders (`diff`, `conflicts`, `preservedGroupIds`, `isFirstConfig`).
- [src/element/FileUpload.jsx](../../../../src/element/FileUpload.jsx) — the upload control; reads the
  file text to feed `parseTrodesconf` (accept `.trodesconf,.xml`).
- [src/pages/Home/CreateAnimalWizard.tsx](../../../../src/pages/Home/CreateAnimalWizard.tsx) — add an
  "Import .trodesconf" affordance that seeds config v1 (`isFirstConfig`).
- [src/pages/AnimalView/NewConfigurationModal.tsx](../../../../src/pages/AnimalView/NewConfigurationModal.tsx)
  + [src/pages/DayEditor/ReconfigWizard.tsx](../../../../src/pages/DayEditor/ReconfigWizard.tsx) — the
  existing new-configuration / reconfig flow + its diff rendering to reuse for re-import + preview.
- [src/pages/AnimalView/index.tsx](../../../../src/pages/AnimalView/index.tsx) — the animal view where
  the config/Channel-Maps surface lives (the re-import entry).
- [src/pages/ImportRepair/](../../../../src/pages/ImportRepair/) — the existing import preview/repair
  screen whose structure (preview → confirm/cancel → post-apply punch-list) this mirrors.
- `src/state/trodesconfParse.ts` (Phase 1), `trodesconfImportPlan.ts` (Phase 2),
  `trodesconfImportApply.ts` (Phase 3) — the pipeline this UI drives (built by the prior phases).

**Contracts referenced:** [`TrodesconfImportPlan`](shared-contracts.md#3-import-plan).

## Tasks

- **Upload → parse → plan.** Wire `FileUpload` (accept `.trodesconf,.xml`) to read the file text, call
  `parseTrodesconf(text, file.name)`; on `ok:false` show the parse error inline (no crash); on `ok:true`
  call `buildTrodesconfImportPlan(parsed, currentConfig)` where `currentConfig` is the animal's current
  snapshot (null at create-animal).
- **Preview screen.** Render the plan: the `diff` via the existing reconfig diff component (added/removed/
  changed groups + ntrodes), the `conflicts` as warnings (e.g. "ntrode 31: 32 channels but device_type
  expects 64"), and a clear statement of what stays blank ("device_type + location for N groups — set
  after import"). Primary action **Apply** (label "Create config v1" when `isFirstConfig`, else "Create
  config v<next>"), secondary **Cancel**. Reuse the modal/preview chrome from the reconfig flow / the
  `ImportRepair` page rather than inventing new layout.
- **Entry points.**
  - *Create-animal:* an "Import .trodesconf" option in `CreateAnimalWizard` that runs the flow and seeds
    v1 on confirm (`applyTrodesconfImport(..., isFirstConfig)`), leaving the wizard's other steps
    (subject, etc.) intact.
  - *Re-import:* an "Import .trodesconf" entry in the new-configuration path (`NewConfigurationModal` /
    the AnimalView config surface) that runs the flow against the current config and applies a new
    version on confirm.
- **Post-import punch-list.** After apply, route the user to the config/Channel-Maps surface where the
  existing validation already flags the blank `device_type`/`location` per group (decision #3) — no new
  validation; just ensure the landing makes the punch-list visible. A short inline note ("Set device_type
  + location for each imported group") is enough.
- **Accessibility + e2e.** The preview is keyboard-navigable and labelled; add an e2e (`e2e/`) that
  uploads a fixture `.trodesconf`, previews, applies, and asserts the resulting electrode-group count +
  blank device_types. Automated axe on the preview.
- **Docs.** README/getting-started: a short "Import a .trodesconf to set up hardware" note; CHANGELOG
  entry for the user-facing import.

## Deliberately not in this phase

- The parser/plan/apply logic (Phases 1–3) — this phase only wires + renders them.
- The day-side DIO picker — [Phase 5](phase-5-dio-day.md).
- Inferring device_type/location to pre-fill the punch-list — out of scope (decision #3).
- Reading a `.rec` to extract its embedded config — out of scope.

## Validation slice

| Test | Asserts |
| --- | --- |
| upload → parse error | a malformed file shows the inline parse error; no apply offered; no crash. |
| preview — first import | a tetrode fixture previews 32 added groups + "device_type/location blank for 32"; Apply labelled "Create config v1". |
| preview — re-import diff | against a current config, the preview shows the reconfig diff (changed/new) + any conflict warnings; preserved groups not listed as needing device_type. |
| apply (e2e) | uploading the fixture + Apply creates the config; electrode-group count matches the config; device_types blank; lands on the punch-list. |
| `jest-axe` / `@axe-core/playwright` | preview has no violations. |
| `baselines` | byte-identical. |

## Fixtures

Reuse the Phase 1 `.trodesconf` fixtures (served to the e2e via the upload). A current-config animal
fixture for the re-import path. 

## Review

Dispatch `code-reviewer` against the diff. Confirm:
- Reuses `FileUpload` + the reconfig diff rendering + `ImportRepair` chrome — no parallel preview/diff UI.
- Both entry points apply through `applyTrodesconfImport` (Phase 3); no duplicated version logic.
- Parse errors are surfaced, never thrown to the user; the punch-list (blank device_type/location) is
  reachable post-import.
- e2e + axe pass; README/CHANGELOG updated; `baselines` byte-identical; no plan/phase refs in code.
