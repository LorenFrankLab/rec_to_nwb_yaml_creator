# Phase 6b — YAML import: multi-file reconciliation + UI

[← PLAN.md](PLAN.md) · [overview](overview.md) · [shared-contracts](shared-contracts.md)

Consume `decomposeYaml` (phase 6a) to import a SET of YAML files into the workspace as animals + days, grouping by subject, turning differing electrode configs across dates into configuration versions, and surfacing every divergence/conflict in a preview before writing. **🟢** (writes pieces that re-merge to the originals).

**Inputs to read first:**

- `src/state/yamlImport.js` (phase 6a) — `decomposeYaml`.
- `src/features/importExport.js` — `importFiles` (the legacy parse+validate path) → reuse the parse/validate, route the result through `decomposeYaml` instead of `setFormData`.
- `src/state/useWorkspace.js` — `createAnimal` (≈ :144), `createDay` (≈ :392), and the configuration-snapshot/version mechanism (`workspaceTransitions.js` — how `createDayRecord` pins a version; how a snapshot is appended to `configurationHistory`).
- `src/pages/AnimalWorkspace/index.jsx` — the workspace surface where an "Import YAML…" entry sits beside "Create Animal".
- `src/pages/AnimalEditor/identitySafety.js` — `findIdentityDivergence` (flag a subject whose animal-level facts diverge across files).

## Tasks

- **Group + reconcile (pure function)**: given N `decomposeYaml` results, group by `subjectId`. Within a subject: if the `configuration` differs across dates, assign each day a **configuration version** (ordered by date) and build one `configurationHistory`; if `animalFacts` diverge (cameras/subject/devices), surface a flag (use `findIdentityDivergence` for catalog identities) and pick a resolution policy (default: union catalogs, latest-wins for scalar subject fields) that the user can see in the preview. Output: a plan of `{ animalsToCreate, daysToCreate, conflictsWithExisting, divergenceFlags }`.
- **Conflict with an existing workspace animal**: detect `subjectId` already present; offer per-animal options — add the new days to the existing animal / skip / replace. Never silently overwrite.
- **Import UI**: an "Import YAML…" action on the workspace → a multi-file picker / drop zone → a **preview/confirm** screen ("N files → animal *remy*: 3 days, 2 config versions; animal *totoro*: 1 day", with divergence/conflict flags inline) → on confirm, call `createAnimal` + `createDay` (+ append config snapshots) per the reconciliation plan. On cancel, write nothing.
- **Failure handling**: a file that fails `decomposeYaml`/`validate` is listed as un-importable in the preview with its reason; the rest still import. Never half-import a single file.
- **Round-trip guard at import**: after import, the round-trip property still holds — re-exporting an imported day equals the source file (reuse the phase-6a gate as an integration test over the import path).
- **Docs**: CHANGELOG; a short "Importing existing YAML files" section in the user-facing docs/README (this is a user-facing capability).

## Deliberately not in this phase

- Making the workspace the default landing (the **cutover**) — held; this phase is its prerequisite, not the cutover itself.
- Editing during import (the user reviews/edits AFTER import in the normal editors).

## Validation slice

| Test | Asserts |
| --- | --- |
| group by subject | 3 files for `remy` + 1 for `totoro` → 2 animals, 4 days |
| config versions from differing configs | two `remy` days with different electrode_groups → 2 config versions, each day pinned correctly |
| diverging animal facts flagged | two files for `remy` with different cameras → a divergence flag in the plan (not silent) |
| conflict with existing animal | importing `remy` when `remy` exists → options surfaced; chosen action applied |
| cancel writes nothing | preview → cancel → store unchanged |
| import round-trip | re-export each imported day == its source file (byte-identical) |
| partial-failure | one invalid file listed un-importable; the valid ones import |

## Fixtures

The golden fixtures as multi-file inputs (e.g. the sample + probe-reconfig fixtures as two dates of one animal → exercises config versions). Synthesize a divergent-cameras pair and an existing-animal conflict. UI via `StoreProvider` + the multi-file picker; reconciliation tested as a pure function.

## Review

Dispatch `code-reviewer`. Confirm: grouping/config-versioning is correct; divergences and conflicts are SURFACED (never silent); cancel is a true no-op; the import round-trip holds (re-export == source); partial failures don't half-import; user-facing import docs are included (not deferred); names don't reference this plan.
