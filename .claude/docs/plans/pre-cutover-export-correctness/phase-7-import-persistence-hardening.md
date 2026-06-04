# Phase 7 — Import & persistence hardening

[← back to PLAN.md](PLAN.md) · [overview](overview.md)

Goal: close the two correctness edges outside the export chain — partial import silently keeping invalid
nested objects (Finding H), and persistence edges that crash on an empty blob or drop the unsaved-work
guard after a failed autosave (Finding I).

**Inputs to read first:**

- [src/validation/schemaValidation.js:40-55](../../../../src/validation/schemaValidation.js) — builds the
  error `field`/path; for a nested `required` error it overwrites the instancePath with the bare
  `params.missingProperty` (`:47`), so `cameras[0].camera_name` collapses to `camera_name`.
- [src/features/importExport.js:145-170](../../../../src/features/importExport.js) — partial import derives
  the excluded top-level field from `issue.path.split('[')[0].split('.')[0]` (`:153`); given the collapsed
  path it excludes `camera_name` (a non-field) and imports the invalid `cameras` array anyway (`:165-168`).
- [src/state/persistence.js:55-76](../../../../src/state/persistence.js) — `loadWorkspace`; validates the
  envelope (`schemaVersion`, `workspace` is an object) but not that `animals`/`days` exist (`:62-75`).
- [src/state/useWorkspace.js:88-106](../../../../src/state/useWorkspace.js) — debounced autosave; the
  `finally` clears `hasPendingWrite` even when `saveWorkspace` threw (`:104`).
- [src/hooks/useUnsavedWorkGuard.js:13-24](../../../../src/hooks/useUnsavedWorkGuard.js) and
  [src/layouts/AppLayout.jsx:98-100](../../../../src/layouts/AppLayout.jsx) — the guard keys only on
  `hasPendingWrite`, ignoring `saveError`.
- [src/pages/AnimalWorkspace/index.jsx:37-38](../../../../src/pages/AnimalWorkspace/index.jsx) and
  [src/pages/Home/index.jsx:101,111](../../../../src/pages/Home/index.jsx) —
  `Object.keys(workspace.animals)` crash sites if `animals` is undefined.

## Tasks

- **Task 1 — preserve nested error paths (Finding H).** In `schemaValidation.js`, for a nested `required`
  error, build the field as the full path **joined with** the missing property (e.g.
  `cameras[0].camera_name`), not the bare `missingProperty`. Keep top-level required errors (empty
  instancePath) reporting the bare property. Verify against AJV's `instancePath` + `params.missingProperty`.
- **Task 2 — exclude the right field on partial import (Finding H).** Confirm `importExport.js:153`'s
  top-level extraction now yields `cameras` (from `cameras[0].camera_name`), so the invalid `cameras`
  array is excluded from a partial import instead of imported. If the extraction logic is fragile, make it
  robust to both `a[0].b` and `a.b` and bare `a` forms. The end-to-end behavior: an imported file with an
  invalid camera excludes `cameras` (with a notice), not nothing.
- **Task 3 — guard empty-workspace load (Finding I).** Either have `loadWorkspace` reject a structurally
  empty `workspace` (no `animals`/`days`) as malformed → discard-with-notice, **or** normalize it to the
  full default shape (`animals:{}, days:{}, settings:{…}`) before returning. Recommended: normalize to the
  default shape so a valid-but-empty blob hydrates cleanly. Either way, no consumer should hit
  `Object.keys(undefined)`. Add defensive defaults at the `AnimalWorkspace` / `Home` read sites as belt-and-braces.
- **Task 4 — keep the unsaved-work guard after a failed autosave (Finding I).** Do not clear
  `hasPendingWrite` when `saveWorkspace` throws — move it out of the unconditional `finally`, or have the
  guard also consider `saveError`. After a failed autosave the `beforeunload` guard must still warn. Wire
  `useUnsavedWorkGuard(persistence.hasPendingWrite || !!persistence.saveError)` (or equivalent) in
  `AppLayout`.
- **Task 5 — docs.** Note the import-correctness and persistence-safety fixes in `docs/REFACTOR_CHANGELOG.md`.

## Deliberately not in this phase

- **Persistence-blob forward migration** — out of scope (v3 plan's release-gated item); this phase only
  prevents crashes and false "saved" state, not schema-version migration.
- **Reworking the import UX** beyond correct exclusion — the existing partial-import notice UI is reused.
- **Export-path validation** — phases 1–6.

## Validation slice

| Test | Asserts |
| --- | --- |
| `nested required error keeps its full path` *(unit)* | a camera missing `camera_name` produces field `cameras[0].camera_name` (not `camera_name`); a top-level missing field still reports the bare name. |
| `partial import excludes the invalid nested array` *(integration)* | importing a file with an invalid camera excludes `cameras` (and reports it), and does **not** import the invalid camera. |
| `loadWorkspace handles an empty workspace blob` *(unit)* | `{schemaVersion:1, workspace:{}}` either discards-with-notice or hydrates to the default shape; no consumer sees undefined `animals`/`days`. |
| `AnimalWorkspace/Home render on an empty workspace without crashing` *(integration)* | rendering with an empty/normalized workspace does not throw `Object.keys(undefined)`. |
| `failed autosave keeps the unsaved-work guard armed` *(unit/integration)* | when `saveWorkspace` throws, `saveError` is set and the `beforeunload` guard remains active (guard condition true). |

All Vitest; import + render tests are integration.

## Fixtures

A YAML import fixture with one invalid camera (missing `camera_name`); a `{schemaVersion:1, workspace:{}}`
blob and a normal blob for `loadWorkspace`; a `saveWorkspace` mock that throws for the autosave-failure
test. No new workspace shapes.

## Review

`pr-review-toolkit:code-reviewer`; `pr-review-toolkit:silent-failure-hunter` (persistence/import error
handling and false-success). Confirm: the nested-path fix is verified against real AJV error objects;
partial import excludes the correct field end-to-end; the empty-blob path can't crash a consumer; the
unsaved-work guard survives a failed autosave; no plan/phase strings in code or test names.
