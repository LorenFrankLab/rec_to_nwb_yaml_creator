# Phase 5 — Upload, grouping + device_type, diff preview, entry points

[← back to PLAN.md](PLAN.md) · [overview](overview.md) · [shared-contracts §3](shared-contracts.md#3-invariant) · [§4](shared-contracts.md#4-import-plan)

The end-to-end user flow: upload a `.trodesconf`, (for multi-shank) group ntrodes + assign `device_type`,
preview the diff, apply. Two entry points. Builds a **new** preview component (none exists to reuse) and
reads file **contents** (not the name-only `FileUpload`).

**Inputs to read first:**

- [shared-contracts §4](shared-contracts.md#4-import-plan) — the `TrodesconfImportPlan` (groups, shells,
  diff, conflicts) the UI renders; [§3](shared-contracts.md#3-invariant) — the completion the
  device_type step triggers (ids preserved).
- [src/features/importYaml.ts:36](../../../../src/features/importYaml.ts) — the file-text read pattern
  (`<input type=file>` + `await file.text()`) to follow. **Do NOT use** `src/element/FileUpload.jsx` (name-only;
  blocks content reads — must-fix #4).
- [src/state/configDiff.ts:79](../../../../src/state/configDiff.ts) — `diffProbeConfigs` (pure).
  [src/pages/DayEditor/ReconfigWizard.tsx:56-58](../../../../src/pages/DayEditor/ReconfigWizard.tsx) — note
  it renders **no** diff; build a new preview component over the pure fn (must-fix #5).
- [src/pages/Home/CreateAnimalWizard.tsx](../../../../src/pages/Home/CreateAnimalWizard.tsx) +
  [src/pages/AnimalView/NewConfigurationModal.tsx](../../../../src/pages/AnimalView/NewConfigurationModal.tsx)
  — the create-time + re-import entry points.
- [src/pages/ImportRepair/](../../../../src/pages/ImportRepair/) — modal/preview chrome to mirror.
- Phases 1–4 modules: `trodesconfParse`, `trodesconfImportPlan`, `fillImportedNtrodeMaps`,
  `applyTrodesconfImport`.

**Contracts referenced:** [the invariant](shared-contracts.md#3-invariant);
[`TrodesconfImportPlan`](shared-contracts.md#4-import-plan).

## Tasks

- **Upload → parse → plan.** A real `<input type="file" accept=".trodesconf,.xml">` → read contents with
  **`await file.text()`** (the `importYaml.ts` pattern — not `FileReader`, and not the name-only
  `FileUpload.jsx`) → `parseTrodesconf(text, file.name)`; `ok:false` → inline error (no crash);
  `ok:true` → `buildTrodesconfImportPlan(parsed, currentConfig)`.
- **Grouping + device_type step (multi-shank).** Render `plan.groups`; let the user **merge** several
  ntrode ids into one electrode group (default 1:1) **and order the ntrodes within a merged group**
  (the order = shank order for the fill; default ascending `ntrode_id` but user-reorderable — not hard-
  coded). Assign each group a `device_type`; on assignment run `fillImportedNtrodeMaps` for the group's
  ordered rows + their counts from `plan.ntrodeChannelCounts` ([§3](shared-contracts.md#3-invariant)) and
  show the result (filled / `{ok:false}` reason). Groups may be left blank (decision #3) → completed
  later in the Channel Maps editor (Phase 3 routes that correctly). Surface `plan.conflicts`: `error`
  blocks apply; `review` (e.g. `ntrode_count_mismatch` — a normal reconfig) and `info` (e.g. the
  `numChannels` note) are advisory, non-blocking.
- **Diff preview (new component).** Render `plan.diff` (added/removed/changed groups + ntrodes) over
  `diffProbeConfigs` output — a new presentational component (reuse `ImportRepair` chrome, not a
  non-existent reconfig diff). State what stays blank ("device_type/location for N groups — set after
  import").
- **Apply.** Primary action calls `applyTrodesconfImport` (label "Create config v1" when
  `isFirstConfig`, else "Create config v<next>"); route to the Channel Maps / config surface where the
  existing validation flags blank `device_type`/`location` (decision #3 punch-list).
- **Entry points.** *Create-animal:* an "Import .trodesconf" option in `CreateAnimalWizard` (seeds v1).
  *Re-import:* an entry in the new-configuration path (`NewConfigurationModal` / AnimalView config
  surface) against the current config.
- **a11y + e2e.** Keyboard-navigable, labelled; an `e2e/` spec uploads a fixture, groups (multi-shank
  case), assigns device_type, previews, applies, and asserts electrode-group + **preserved ntrode_id**
  results. Axe on the preview.
- **Docs.** README "Import a .trodesconf to set up hardware"; CHANGELOG.

## Deliberately not in this phase

- Parser/plan/completion/apply logic (Phases 1–4) — wire + render only.
- The day DIO picker — [Phase 6](phase-6-dio.md).
- Inferring device_type/location — out of scope (decision #3).

## Validation slice

| Test | Asserts |
| --- | --- |
| upload reads contents | a selected `.trodesconf` is parsed from its **text** (via `await file.text()`), not its name; malformed → inline error, no apply. |
| grouping + multi-shank | merging 4 ntrodes into one group + a 128c-4shank device_type fills 4 shank maps with ids 1–4 preserved; a wrong device_type shows the `{ok:false}` reason and blocks. |
| diff preview | first import previews N added groups + the "blank for N" note; re-import shows changed/new + conflicts. |
| apply (e2e) | upload → group → assign → Apply creates the config; **electrode-group count + ntrode_ids match the config**; blanks land on the punch-list. |
| axe | preview has no violations. |
| `baselines` | byte-identical. |

## Fixtures

Phase 1 `.trodesconf` fixtures (tetrode + a multi-shank/128c config) served to the e2e upload; a
current-config animal for re-import.

## Review

Dispatch `code-reviewer`. Confirm: reads file **contents** via `await file.text()` (not `FileUpload`); the diff
preview is a new component over `diffProbeConfigs` (no assumed reuse); device_type assignment goes through
`fillImportedNtrodeMaps` (ids preserved, multi-shank validated); both entry points apply via
`applyTrodesconfImport`; e2e asserts preserved `ntrode_id`s; axe + `baselines` pass; README/CHANGELOG
updated; no plan/phase refs in code.
