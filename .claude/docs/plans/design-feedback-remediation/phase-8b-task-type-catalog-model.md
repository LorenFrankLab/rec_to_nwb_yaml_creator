# Phase 8B — Task-type catalog model rehearsal (behavior-preserving)

[← back to PLAN.md](PLAN.md) · [overview](overview.md)

Build and test the pure task-catalog model/conversion utilities before activating the persisted shape or UI.
This phase exists to shrink the blast radius of the full task-catalog change: prove the dedup, conflict,
camera-reconciliation, and merge-resolution algorithms against fixtures while the running app still uses the
existing inline `day.tasks` model.

**Behavior-preserving:** do not bump `WORKSPACE_SCHEMA_VERSION`, do not register an active v2→v3 migrator,
do not change the live Tasks & Epochs UI, and do not make Workspace the default entry point.

**Inputs to read first:**

- [shared-contracts.md#c3](shared-contracts.md#c3) — task-catalog shape, dedup key, conflict path, and
  camera reconciliation. This is the spec.
- [shared-contracts.md#c1](shared-contracts.md#c1) — export byte-identity.
- `src/state/workspaceUtils.js` `mergeDayMetadata`, `TASK_ORDER`, and task reordering.
- `src/state/cameraUsage.js` — existing animal-catalog + per-day-reference pattern.
- `src/state/workspaceTypes.ts` — model interfaces to extend in a way that does not force runtime adoption.
- `src/validation/rulesValidation.js` and `src/domain/validation.js` — existing task epoch and identity rules.
- `src/state/workspaceMigrations.js` — read the migration framework, but do not register an active bump yet.

**Contracts referenced:**

- [C1 — YAML byte-identity](shared-contracts.md#c1).
- [C2 — persisted migration](shared-contracts.md#c2), rehearsal only in this phase.
- [C3 — task-type catalog model + merge resolution](shared-contracts.md#c3).

## Tasks

- **Pure model module:** add task-catalog conversion/resolution utilities in a pure state/domain module
  (prefer TypeScript if consistent with the touched area). Suggested responsibilities:
  - derive `taskTypes[]` and `taskInstances[]` from date-ordered inline `day.tasks[]`,
  - resolve catalog instances back to inline `tasks[]` with exactly the five `TASK_ORDER` keys,
  - detect same-name conflicts and produce `task_definition_reconciled` metadata without silently dropping
    the original conflicting values,
  - detect `TaskType.camera_id` references not included in a day’s camera usage.
- **Type surface:** extend `workspaceTypes.ts` with optional `taskTypes` / `taskInstances` shapes, but keep
  current runtime readers tolerant of old inline `day.tasks`.
- **Migration rehearsal:** implement the v2→v3 conversion function as a pure utility and test it with
  fixtures, but do **not** wire it into persistence or bump schema. Name it so Phase 8C can register it
  directly.
- **Merge rehearsal:** add unit tests proving catalog-authored data resolves to the same inline task objects
  that `mergeDayMetadata` expects. If a small helper in `workspaceUtils` is needed, keep current inline-task
  behavior as the default path.
- **Validation rehearsal:** add pure validation helpers/tests for catalog-level duplicate `task_name`,
  dangling task type references, `task_camera_not_used`, and `task_definition_reconciled`. Do not yet surface
  them in the live UI unless they are only exercised by explicitly catalog-shaped fixtures.
- **Fixtures:** add focused task-conversion fixtures:
  - one task,
  - multiple tasks,
  - same `task_name` across days with identical definitions,
  - same name / different environment,
  - same name / different `camera_id`,
  - task lists a camera the day did not use.
- **Documentation:** CHANGELOG entry saying model utilities were added but the live app remains on inline
  tasks until Phase 8C.

## Deliberately not in this phase

- No active persisted schema bump.
- No registered production migrator.
- No animal Task Types UI.
- No day pick/order UI.
- No default-entry cutover.
- No exported YAML shape change.

## Validation slice

| Test | Asserts |
| --- | --- |
| unit: inline → catalog → inline | every non-conflicting fixture resolves byte/object-identically to current inline tasks. |
| unit: conflict fixtures | first occurrence wins deterministically; conflict metadata preserves original vs canonical values. |
| unit: camera reconciliation | `task_camera_not_used` is produced for a referenced camera outside the day’s camera usage. |
| unit: duplicate catalog names | duplicate `task_name` is rejected by the pure helper/rule. |
| `npx vitest run baselines` | byte-identical — live export behavior unchanged. |
| `npm run typecheck` + `npx vitest run` | green. |

## Fixtures

Add small checked-in fixtures under the existing state/domain test fixture conventions. Do not alter golden
YAML fixtures in this phase.

## Review

Before opening the PR, dispatch `code-reviewer` against the diff. Confirm:

- No active schema version bump or registered persistence migration.
- No live UI change or root-route change.
- Conversion utilities implement C3 exactly, especially first-occurrence canonicalization and conflict
  surfacing.
- Baselines are byte-identical and old inline `day.tasks` remains the runtime source of truth.
