# Phase 8 — Import robustness for real-world legacy files

[← back to PLAN.md](PLAN.md) · [overview](overview.md)

The app's Import & Repair flow was validated against an empirical round-trip of **1,674 real lab YAMLs**
(2017–2026): only **16.7%** import cleanly and **~69%** hit a blocker the screen can't fix. Robustness
is otherwise solid — **0 crashes, 0 parse failures, and 0 silent data loss on accepted files** — so this
phase fixes specific, byte-safe defects, not the model. Two are the dominant blockers: a validation-rule
bug that false-positives on list-typed `task_epochs` (blocks ~63% of the corpus), and a filename
date-parser that only understands the *template's* `mmddYYYY` convention (215 files). It also folds in
known legacy space-key normalization (`subject id`, `electrode groups`, `ntrode electrode group channel
map`, `data acq device`) because those files are recoverable and should not read as missing identity or
missing devices. Evidence:
[../../research/yaml-corpus-2/10-app-import-roundtrip.md](../../research/yaml-corpus-2/10-app-import-roundtrip.md).

**Inputs to read first:**

- [src/validation/rules/referenceRules.ts:146-196](../../../../src/validation/rules/referenceRules.ts) — `orphaned_video`; and [:200-228](../../../../src/validation/rules/referenceRules.ts) — `orphaned_file`. Both build `taskEpochSet` from the *flattened* `tasks[].task_epochs` arrays, then test `taskEpochSet.has(epoch)` where `epoch = file/video?.task_epochs` (referenceRules.ts:212). When the referencing item's `task_epochs` is itself a **list** `[2]` (1,050/1,051 real `associated_files`), `has([2])` is always false → a false-positive `orphaned_file`/`orphaned_video`.
- [src/nwb_schema.json:617-623](../../../../src/nwb_schema.json) — `associated_files/items/task_epochs` is `"type": "integer"` (scalar); a list value also trips an AJV `type` error. (`tasks/items/task_epochs` is an array at `:841-852`; `associated_video_files/items/task_epochs` scalar at `:895`.)
- [../../research/yaml-corpus-2/11-epoch-linkage-integrity.md](../../research/yaml-corpus-2/11-epoch-linkage-integrity.md) — video epoch linkage risk: legacy `associated_video_files` rows use both `task_epoch` and `task_epochs`; some files mix keys; many Guidera rows have no epoch key. This phase must regression-test the known singular/plural forms and leave the no-key shape as an explicit Open Question rather than silently inventing an epoch.
- [src/state/yamlImportPlan.ts:94-121](../../../../src/state/yamlImportPlan.ts) — `extractRecordingDate`: PRIMARY regex matches only `mmddYYYY_..._metadata.yml`; FALLBACK only `session_id` ending `_YYYYMMDD`. Real files are `YYYYMMDD_<subject>.yml` with short/non-conforming `session_id` → returns `null` → `planImport` rejects with no fixable field.
- [src/state/importRepair.ts:348-420](../../../../src/state/importRepair.ts) — `detectBenignNormalizations`/`applyBenignNormalizations` (the `task_epoch`→`task_epochs` key shim; the place to add list→scalar value normalization). **Coordinate with Phase 4**, which owns the `task_epoch`/`task_epochs` dual-key *value-conflict* reconcile.
- [src/pages/ImportRepair/index.tsx](../../../../src/pages/ImportRepair/index.tsx) — the repair screen + true-validate gate (where a date input would surface).
- [../../research/yaml-corpus-2/10-app-import-roundtrip.md](../../research/yaml-corpus-2/10-app-import-roundtrip.md) — space-keyed legacy files are currently read as missing canonical fields; normalize only known aliases and list the recovery as benign, visible import repair.

## Tasks

- **Fix the list-vs-scalar `orphaned_file`/`orphaned_video` bug.** In `referenceRules.ts`, when a
  referencing item's `task_epochs` is an array, test **each element** against `taskEpochSet` (and only
  flag the elements that match no task); when scalar, keep today's check. This removes the false positive
  for valid list-typed input without weakening the genuine orphaned-epoch detection. Add the symmetric
  fix to `orphaned_video`.
- **Regression-test legacy video epoch key shapes.** Confirm Import & Repair reads both
  `associated_video_files[].task_epoch` and `.task_epochs`, scalar values and single-element list values,
  and that mixed singular/plural equal values normalize without dropping linkage. A singular/plural
  **value conflict** remains the Phase-4 reconcile path; do not classify it benign here. Rows with no
  epoch key should be preserved as an explicit unresolved/import decision (see Open Question 9), not
  auto-assigned.
- **Normalize list→scalar `associated_files[].task_epochs` on import.** A single-element list `[4]` → `4`
  via the benign-normalization path (so the imported model is the canonical scalar form the schema +
  Spyglass + the app's own export already use — keeps `npx vitest run baselines` byte-identical, since the
  app emits scalar today). A **multi-element** list (one file spanning several epochs) is *not* benign —
  surface it as a repair item (mirror the dual-key reconcile precedent), never silently pick one. Do
  **not** relax the schema's scalar type (see Deliberately-not).
- **Parse `YYYYMMDD_<subject>` filenames + add a manual date fallback.** Extend `extractRecordingDate`
  with a `^(\d{4})(\d{2})(\d{2})_.+\.ya?ml$` (YYYYMMDD) PRIMARY branch (validated through the existing
  `toIsoDate`). When extraction still returns `null`, surface a **recording-date input** in Import &
  Repair as a fixable repair item, so `planImport` no longer dead-ends with nothing to fix.
- **Normalize known legacy space-key schema fields.** Before validation/decision/decompose, map only known
  aliases (`subject id`→`subject_id`, `data acq device`→`data_acq_device`, `electrode groups`→
  `electrode_groups`, `ntrode electrode group channel map`→`ntrode_electrode_group_channel_map`) through
  the benign-normalization path. List the recovery ("recovered subject id", "recovered electrode groups")
  so the import is transparent; never rewrite arbitrary user keys.
- **Make type-coercion blockers repairable, not dead-ends.** `times_period_multiplier: "1.5cd"` (a string
  in a number field; downstream-ignored but app-schema-invalid) and a non-conforming `session_id` should
  become repair rows (coerce/confirm), not unfixable blocks.
- **Docs.** CHANGELOG "Fixed": legacy YAMLs with list-typed `associated_files.task_epochs`,
  `YYYYMMDD_<subject>` filenames, and known space-key schema fields now import (the false-positive
  orphaned-file error, the no-recording-date dead-end, and the missing-field space-key dead-end are gone).

## Deliberately not in this phase

- The `task_epoch`/`task_epochs` **dual-key value conflict** reconcile and the import-onto-existing-animal
  dangling-ref surfacing — **Phase 4** owns both. This phase is the general first-import path.
- Deciding whether `associated_video_files` rows with **no epoch key** are valid workflow markers or
  repair-blocking missing data — tracked as Open Question 9 in [overview.md](overview.md). This phase
  only prevents the known singular/plural forms from being dropped or false-flagged.
- **Relaxing the schema** `associated_files.task_epochs` to accept a list (a cross-repo change to the
  shared `nwb_schema.json`) — see Open Question. We normalize on import instead, leaving the schema and
  the exported form scalar.
- Changing the exported YAML for valid input (the canonical scalar form is unchanged).

## Validation slice

| Test | Asserts |
| --- | --- |
| `referenceRules` (extend) | `associated_files`/`associated_video_files` with `task_epochs: [2]` where task declares epoch 2 → **no** `orphaned_file`/`orphaned_video` (was a false error); `[9]` with no such task → flagged; scalar cases unchanged |
| video epoch legacy keys (new/extend) | `associated_video_files` with `task_epoch: 2`, `task_epochs: 2`, and both keys equal → preserves epoch linkage; both keys different → Phase-4 reconcile item, not benign; no epoch key → explicit unresolved/deferred decision, not silent auto-assignment |
| `importRepair` (extend) | single-element list `task_epochs: [4]` → normalized to `4` (benign); multi-element `[4,5]` → a surfaced repair item, not a silent pick |
| space-key import repair (new/extend) | `subject.subject id`, `electrode groups`, and `ntrode electrode group channel map` normalize to canonical underscore keys, are listed as benign, and import attribution uses the recovered `subject_id` |
| `extractRecordingDate` (extend) | `20231108_bs28.yml` → `2023-11-08`; `mmddYYYY_..._metadata.yml` still parses; unparseable name + non-conforming `session_id` → `null` → a date-input repair row appears |
| import round-trip (new, gated by external path or a small in-repo fixture set) | a handful of representative legacy shapes (list epochs, YYYYMMDD name, `1.5cd`) import without an unfixable blocker |
| `baselines` | byte-identical (the app still emits scalar `task_epochs`; only import normalization + a validation false-positive change) |

## Fixtures

Synthesize inline: `associated_files` items with `task_epochs` as `2`, `[2]`, `[2,3]`, and `[9]` against
`tasks: [{task_epochs:[1,2]}]`; `associated_video_files` items with `task_epoch: 2`, `task_epochs: 2`,
both keys equal, both keys different, and no epoch key; filenames `20231108_bs28.yml` and
`11082023_bs28_metadata.yml`; a model with `subject.subject id`, `electrode groups`, and
`ntrode electrode group channel map`; a model with `times_period_multiplier: "1.5cd"`. Reuse
`buildImportRepairPlan` fixtures.

## Review

Dispatch `code-reviewer` against the diff. Confirm:
- The orphaned-file/video rule no longer false-flags valid list input but still catches genuine orphans (scalar + array paths both covered).
- Legacy video singular/plural key shapes preserve linkage; no-epoch-key video rows are explicitly deferred/unresolved, not silently reinterpreted.
- Import normalization is list→scalar only for single-element lists; multi-element is surfaced, never silently dropped; baselines byte-identical.
- Known space-key aliases are recovered before validation and import decision; arbitrary keys with spaces are not rewritten.
- `extractRecordingDate` gains the YYYYMMDD branch without breaking the template branch; the date-input fallback gates cleanly.
- No schema change to `task_epochs`; the dual-key conflict remains Phase 4's.
- Full gate green; no trivial tests; CHANGELOG updated.
