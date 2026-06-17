# Phase 12 — Statescript & associated-file integrity

[← back to PLAN.md](PLAN.md) · [overview](overview.md)

`associated_files` (statescript logs) are core behavioral data; field presence in the corpus is excellent,
but a few rare-but-high-consequence shapes either **hard-fail** the NWB build or **silently drop** the log.
This phase adds the internal-integrity checks the app lacks (it currently validates only the *epoch
reference*, in `referenceRules`). Evidence + downstream behavior (verified in trodes_to_nwb / Spyglass
source): [../../research/yaml-corpus-2/12-associated-files-statescript.md](../../research/yaml-corpus-2/12-associated-files-statescript.md).

**Inputs to read first:**

- [src/validation/rules/referenceRules.ts:200-228](../../../../src/validation/rules/referenceRules.ts) — `orphaned_file` (the only `associated_files` rule today; epoch-reference only). The new internal-integrity checks belong in the same rule module (or a sibling registered at [src/validation/rulesValidation.ts:29](../../../../src/validation/rulesValidation.ts)). **Phase 8** fixes the list-vs-scalar bug in this rule — sequence after, or coordinate the diff.
- [src/nwb_schema.json:560-625](../../../../src/nwb_schema.json) — `associated_files` item shape (`name`, `description`, `path`, `task_epochs`).
- Downstream facts to encode (from doc 12, source-verified): a **duplicate `name`** within `associated_files` → `pynwb ValueError`, **hard-fails the whole NWB**; a `description` lacking a statescript keyword for a `.stateScriptLog` path → Spyglass `StateScriptFile` **silently not ingested**; a **duplicate `path`** → wrong raw log per epoch (silent); a relative / bare-filename / directory `path` → trodes `open()` logs and writes **empty content** (silent behavioral-data loss).

## Tasks

- **Reject duplicate `name` within `associated_files`** (blocking). Two entries with the same `name`
  hard-fail trodes_to_nwb (`pynwb ValueError`) — the loud one; catch it at the gate with a clear message
  and a per-row action.
- **Reject duplicate `path` within `associated_files`** (blocking). Two entries pointing at the same file
  means at least one epoch gets the wrong raw log — silent downstream; block until one path is corrected
  or the duplicate is removed.
- **Statescript `description` keyword check** (warning). When a `path` ends `.stateScriptLog` (or the
  entry is clearly a statescript log), require the `description` to contain the statescript keyword Spyglass
  gates on (confirm the exact token in `common_behav.py`/`common_nwbfile.py`); otherwise the
  `StateScriptFile` is silently skipped (the `'state sciript log'` typo dropped 18 files' epoch r5).
- **`path`-shape guard** (warning). Flag a `path` that is not shaped like an absolute file path
  (relative, bare-filename, or trailing-separator directory-like value) — trodes silently writes empty
  log content for these. Don't check existence (can't), and don't pretend to prove a path is a real
  file; check shape only.
- **Docs.** CHANGELOG "Added": `associated_files` integrity checks (duplicate name/path, statescript
  description keyword, path shape) that catch hard-fail and silent-drop cases the converter won't report.

## Deliberately not in this phase

- The epoch *reference* consistency (`orphaned_file`/`orphaned_video`) — owned by `referenceRules` and
  fixed in **Phase 8**; this phase is the file-entry internals (name/path/description), not the epoch graph.
- The off-export `videolessEpochs` remap — **Phase 5**.
- `associated_video_files` internals — covered by Phase 4 (refs) / Phase 8 (legacy epoch-key import and
  no-epoch-key decision) / Phase 10 (cameras); this phase is `associated_files` (statescript) only. Apply
  the duplicate-name/path check to videos too only if it's a trivial shared helper — otherwise defer.
- Verifying file existence on disk — out of scope (the app has no filesystem access to the data dir).

## Validation slice

| Test | Asserts |
| --- | --- |
| associated_files integrity (new) | two entries with the same `name` → blocking; same `path` → blocking; unique → clean |
| statescript description (new) | a `.stateScriptLog` entry with `description: 'state sciript log'` (typo, missing keyword) → warning; with the correct keyword → clean |
| path-shape (new) | `path: 'run5.stateScriptLog'` (bare) / `'/data/dir/'` (trailing-separator directory-like value) → warning; `'/abs/path/run5.stateScriptLog'` → clean |
| `baselines` | byte-identical (golden `associated_files` have unique names/paths + valid descriptions) |

## Fixtures

Synthesize `associated_files` with: duplicate `name`; duplicate `path`; a `.stateScriptLog` with a
keyword-less description; a relative/bare/dir path; and a clean control. Confirm the exact statescript
keyword against `spyglass/src/spyglass/common/common_behav.py` before asserting the description rule.

## Review

Dispatch `code-reviewer` against the diff. Confirm:
- Duplicate-name and duplicate-path are blocking; the silent warning cases (missing keyword, bad path shape) are surfaced, not silently passed.
- The statescript keyword matches Spyglass's actual gate (cited from source), not a guess.
- No overlap with the Phase-8 epoch-reference fix or Phase-5 videoless state; baselines byte-identical.
- Full gate green; no trivial tests; CHANGELOG updated.
