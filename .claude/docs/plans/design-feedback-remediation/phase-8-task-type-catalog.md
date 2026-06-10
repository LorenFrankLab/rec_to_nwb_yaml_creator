# Phase 8 — Task-type catalog; days pick/order epochs (F4 full)

[← back to PLAN.md](PLAN.md) · [overview](overview.md)

The model change that fully resolves Tasks & Epochs: define a *task type* **once on the animal**; each day
*selects* the types it ran and *orders* their epochs (recognition over recall). **Merge-changing** — gated
on the Phase 7 migration framework and the golden baselines, and rides on the Phase 5 `DayEditorContext` +
the Phase 6 redesigned screen. The exported YAML shape does **not** change: `mergeDayMetadata` resolves the
catalog back to today's inline `tasks[]`.

**Inputs to read first:**

- [shared-contracts.md#c3](shared-contracts.md#c3) — the catalog model, the **exact dedup algorithm**, the conflict/`task_definition_reconciled` path, and the `TaskType.camera_id`↔`day.cameras_used` reconciliation. **This is the spec; do not deviate or guess.**
- `src/state/workspaceUtils.js:324` `mergeDayMetadata` (`tasks: getDayTasks(day).map(t => reorderKeys(t, TASK_ORDER))` ~`:390`) and `:44` `TASK_ORDER` (`task_name, task_description, task_environment, camera_id, task_epochs`) — the resolution target.
- `src/state/cameraUsage.js` `resolveDayCameraUsage` + `animal.cameras` / `day.cameras_used` — the existing catalog+per-day pattern to mirror, and the camera-reconciliation constraint.
- `src/state/workspaceTypes.ts` — `Animal`/`Day` interfaces to extend (typed in Phase 2).
- `src/pages/AnimalEditor/CamerasSection.jsx` + `wiring/CamerasContainer.jsx` — the catalog UI pattern to mirror for task types.
- `src/pages/DayEditor/TasksEpochsStep.jsx` etc. — the Phase 6 screen that now consumes the catalog (pick + order), via `DayEditorContext`.
- `src/validation/rulesValidation.js` — has `duplicateTaskEpochs` (~`:752`); **no `task_name` uniqueness rule exists** — add it.
- `src/state/workspaceMigrations.js` (Phase 7) — register the v2→v3 migrator here.
- `docs/PIPELINE_REQUIREMENTS.md` — the `nwbinspector --config dandi` / `dandi validate` commands for the integration check.

**Contracts referenced:**

- [C1 — YAML byte-identity](shared-contracts.md#c1) — resolved export byte-identical for a day reproducing its old inline tasks.
- [C2 — schema version + migration](shared-contracts.md#c2) — bump `WORKSPACE_SCHEMA_VERSION` 2→3 with a registered, fixture-tested migrator.
- [C3 — task-type catalog model + merge resolution](shared-contracts.md#c3) — the canonical shape, dedup key, conflict path, and camera rule.

## Tasks

- **Parity capture (first):** confirm `npx vitest run baselines` is green at HEAD — the golden fixtures are the correctness oracle for the merge change.
- **Model:** extend `Animal` with `taskTypes: TaskType[]` and `Day` with ordered `taskInstances` ([C3](shared-contracts.md#c3)) in `workspaceTypes.ts`; add workspace actions (create/update/delete task type; set/order a day's instances) mirroring the camera-catalog actions. Update `store-public-api.test` for the new actions.
- **Merge resolution:** in `mergeDayMetadata`, resolve each `taskInstance` → an inline `tasks[]` entry via its `TaskType`, emitting exactly `TASK_ORDER` (`:44`). **No new exported keys.**
- **Animal catalog UI:** a "Task Types" section in the Animal editor (mirror `CamerasSection`/`CamerasContainer`).
- **Day UI:** in `TasksEpochsStep` (Phase 6 shell, via `DayEditorContext`), pick task types the day ran + order their epochs, with inline quick-add of a new type (writes to the animal catalog).
- **Migrator (C2/C3):** register the v2→v3 migrator in `workspaceMigrations.js`; bump `WORKSPACE_SCHEMA_VERSION` to 3. Implement the **exact** date-ordered dedup-by-`task_name` algorithm from C3 (first-occurrence canonical; matching → reuse; conflicting → reference canonical + flag `task_definition_reconciled`). Non-destructive.
- **Validation rules:** ADD `task_name` uniqueness (catalog-level — new); ADD `task_camera_not_used` (a `TaskType.camera_id` not in a referencing day's `cameras_used` → repairable issue); surface `task_definition_reconciled`; preserve `duplicateTaskEpochs`. A day referencing a deleted task type surfaces a repairable dangling-ref issue.
- **Integration check (new code path):** golden baselines only prove *migrated* days are unchanged; a *freshly-authored* catalog day is a new path. Add a slow/integration task: build a YAML from a catalog-authored day, run `nwbinspector --config dandi` (zero CRITICAL) then `dandi validate` (exit 0) per `docs/PIPELINE_REQUIREMENTS.md`.
- **a11y:** jest-axe zero violations on the Task Types catalog UI and the day pick/order UI.
- **Documentation:** CHANGELOG (model change, export unchanged, schema bump + migration); user docs for the "define once, use per day" workflow; mark scope-tiers Thread 2 (task catalog) done in the design note.

## Deliberately not in this phase

- **Dataset-tier** task catalog — animal-level only (overview Non-Goals).
- Changing the **exported** `tasks[]` shape — export stays inline.
- Camera / DIO catalogs — cameras already use this pattern; DIO out of scope.

## Validation slice

| Test | Asserts |
| --- | --- |
| `npx vitest run baselines` | **byte-identical** — every golden fixture, after migration, exports exactly as before (C1). |
| unit: migrator v2→v3 (slow) | each fixture's inline `day.tasks` promote to catalog + instances; round-trip through `mergeDayMetadata` reproduces prior YAML byte-for-byte. |
| unit: dedup conflict fixtures | "same name / different environment" and "same name / different camera_id" reference the first-occurrence canonical `TaskType` and flag `task_definition_reconciled`; not silently merged. |
| unit: `task_camera_not_used` | a task type listing a camera the day didn't use surfaces a repairable issue (fixture: "task lists camera the day didn't use"). |
| unit: `task_name` uniqueness rule | a duplicate catalog `task_name` is rejected. |
| component: day picks/orders epochs | selecting a type + ordering epochs updates `taskInstances`; quick-add writes the animal catalog. |
| jest-axe | catalog + day pick/order UIs: zero violations. |
| integration (slow): fresh catalog day → trodes_to_nwb | `nwbinspector --config dandi` zero CRITICAL; `dandi validate` exit 0. |
| `store-public-api.test` (updated) + `npx vitest run` (full) + `npm run test:e2e` | green. |

## Fixtures

Golden fixtures (unchanged bytes) = parity oracle. Add a `v2` persisted blob with inline `day.tasks`
covering: one task; multiple tasks; **same `task_name` across days with identical defs** (clean dedup);
**same name / different environment**; **same name / different camera_id**; **task lists a camera the day
didn't use**. Plus a small real-ish dataset for the trodes_to_nwb integration check.

## Review

Before opening the PR, dispatch `code-reviewer` against the diff. Confirm:
- Baselines **byte-identical** post-migration; migrator round-trip reproduces prior YAML for every fixture; the dedup/conflict/camera algorithm matches C3 exactly (not a guess).
- Catalog is animal-level; no new exported keys; `mergeDayMetadata` preserves key order; the fresh-catalog-day integration check passes.
- `WORKSPACE_SCHEMA_VERSION` bumped to 3 with a registered, fixture-tested migrator; new validation rules present; `store-public-api.test` updated intentionally.
- jest-axe clean; names don't reference this plan; CHANGELOG + user docs + scope-tiers note updated.
