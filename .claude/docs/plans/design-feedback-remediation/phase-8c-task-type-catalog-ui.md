# Phase 8C — Activate task-type catalog; days pick/order epochs (F4 full)

[← back to PLAN.md](PLAN.md) · [overview](overview.md)

Activate the animal-level task-type catalog after Phase 8B has proven the model utilities. A *task type* is
defined once on the animal; each day selects the types it ran and orders their epochs. The exported YAML
shape stays unchanged: `mergeDayMetadata` resolves the catalog back to today's inline `tasks[]`.

**Do not make Workspace the default entry point.** This phase changes the Workspace workflow, but it does
not decide cutover.

**Inputs to read first:**

- [shared-contracts.md#c3](shared-contracts.md#c3) — canonical catalog model, dedup algorithm, conflict
  path, and camera reconciliation.
- Phase 8B output — pure conversion utilities, migration rehearsal, fixtures, and tests.
- `src/state/workspaceMigrations.js` and `src/state/persistence.js` — register v2→v3 and bump schema here.
- `src/state/workspaceUtils.js` `mergeDayMetadata` and `TASK_ORDER` — resolution target; no leaked internal
  keys.
- `src/pages/AnimalEditor/CamerasSection.jsx` + `wiring/CamerasContainer.jsx` — catalog UI pattern to mirror.
- `src/pages/DayEditor/TasksEpochsStep.jsx`, `TasksTable.jsx`, `TaskModal.jsx`, `TaskEpochsEditor.jsx` —
  Phase 6 shell to replace/extend with pick/order behavior.
- `src/validation/rulesValidation.js` — existing task epoch and divergent identity rules; reconcile new
  catalog-level rules with them.
- `docs/PIPELINE_REQUIREMENTS.md` — fresh-catalog-day trodes_to_nwb / DANDI integration check.

**Contracts referenced:**

- [C1 — YAML byte-identity](shared-contracts.md#c1).
- [C2 — persisted schema version + migration](shared-contracts.md#c2).
- [C3 — task-type catalog model + merge resolution](shared-contracts.md#c3).
- [C5 — default-entry gate](shared-contracts.md#c5).

## Tasks

- **Activate persisted shape:** register the v2→v3 migrator from Phase 8B and bump
  `WORKSPACE_SCHEMA_VERSION` to 3. The migrator promotes inline `day.tasks` into animal `taskTypes[]` plus
  day `taskInstances[]` using the exact C3 date-ordered dedup algorithm.
- **Workspace actions/selectors:** ~~add public store actions for create/update/delete task type and set/reorder
  a day’s task instances. Update `store-public-api.test`.~~ **Superseded during implementation (logic half):**
  the catalog is written through the EXISTING `updateAnimal({ taskTypes })` / `updateDay({ taskInstances })`
  path — exactly mirroring the camera catalog (`CamerasContainer` writes `onFieldUpdate('cameras', …)`), which
  has no dedicated store actions. This keeps the pinned `store-public-api` contract stable (no
  `store-public-api.test` change). The catalog invariants live in pure, tested mutation helpers
  ([`taskCatalogActions.ts`](../../../src/state/taskCatalogActions.ts): `nextTaskTypeId`,
  `add/update/deleteTaskType`, `add/remove/setEpochs/reorderTaskInstance`) plus selectors
  `getAnimalTaskTypes` / `getDayTaskInstances`. Do NOT add dedicated task-type store actions.
- **Merge resolution:** update `mergeDayMetadata` to prefer catalog `taskInstances` when present, resolving
  each instance into exactly `{ task_name, task_description, task_environment, camera_id, task_epochs }`
  before reordering. Legacy inline `day.tasks` may remain a compatibility fallback for old/unmigrated test
  fixtures, but the current persisted shape should use the catalog.
- **Animal Task Types UI:** add a Task Types catalog section in Animal Setup. Mirror the Camera catalog pattern
  where possible: list defined types, show completeness/status, edit/add/delete, and expose camera references
  as recognition-based controls. Make ownership visible: catalog definition problems live on the animal,
  while epoch/order problems live on the day.
- **Day Tasks & Epochs UI:** replace per-day retyping with "pick task types this day ran" + ordered epoch
  assignment. Include inline quick-add of a new type when the user discovers a missing one during day entry.
  Preserve recognition over recall: users should see the available animal-level definitions and select them,
  not remember names from another screen.
- **Repair/conflict UI:** surface `task_definition_reconciled`, dangling task type references, and
  `task_camera_not_used` as repairable issues with clear ownership: task definition problems live on the
  animal catalog; epoch-order problems live on the day.
- **Validation rules:** activate catalog-level `task_name` uniqueness, dangling refs, camera reconciliation,
  and reconciled-definition issues. Preserve `duplicateTaskEpochs`; avoid duplicate/contradictory
  `divergent_task_identity` output.
- **Integration check:** add a slow/integration path that builds a YAML from a freshly-authored catalog day
  and runs `nwbinspector --config dandi` with zero CRITICAL, then `dandi validate` exit 0 per
  `docs/PIPELINE_REQUIREMENTS.md`.
- **a11y:** jest-axe zero violations on Task Types catalog UI and day pick/order UI.
- **UX comprehension gates:** add screenshot/cognitive-walkthrough coverage for the empty, normal,
  migration-conflict, repair, and narrow-width states. The walkthrough should verify that a reviewer can
  answer: "Where is this task type defined?", "Which days use it?", "What do I fix here versus on the day?",
  and "Can I add/select/reorder without retyping an existing definition?" Save the artifact at
  `docs/testing/task-catalog-walkthrough.md`, with screenshots under `docs/testing/screenshots/task-catalog/`
  using filenames `empty-desktop.png`, `normal-desktop.png`, `conflict-desktop.png`,
  `repair-desktop.png`, and `normal-390.png`.
- **Documentation:** CHANGELOG (schema bump, migration, export unchanged), user docs for define-once/use-per-day,
  and scope-tiers/design notes if they track task-catalog completion.

## Deliberately not in this phase

- Dataset-tier task catalog — animal-level only.
- Changing exported `tasks[]` shape.
- Workspace default route / cutover.
- Camera / DIO catalog redesign outside the task-camera reconciliation needed here.

## Validation slice

| Test | Asserts |
| --- | --- |
| `npx vitest run baselines` | migrated days export byte-identically for all non-conflicting golden fixtures (C1). |
| unit: active v2→v3 migrator | registered migrator hydrates v2 blobs into current v3 shape without discard. |
| unit: conflict fixtures | same name / different environment or camera references canonical first occurrence and surfaces `task_definition_reconciled`. |
| unit: `task_camera_not_used` | task type listing a camera the day did not use surfaces a repairable issue. |
| unit: catalog `task_name` uniqueness | duplicate catalog names are rejected. |
| component: Animal Task Types UI | add/edit/delete type writes animal catalog and preserves option values. |
| component: day pick/order epochs | selecting a type and ordering epochs updates `taskInstances`; quick-add writes the animal catalog. |
| e2e screenshots/walkthrough | empty, normal, conflict, repair, and about-390px states make animal-vs-day ownership and repair locality visible. |
| jest-axe | catalog + day pick/order UIs: zero violations. |
| integration: fresh catalog day → trodes_to_nwb | `nwbinspector --config dandi` zero CRITICAL; `dandi validate` exit 0. |
| `store-public-api.test` + `npx vitest run` + `npm run test:e2e` | green. |

## Fixtures

Reuse Phase 8B fixtures. Add a v2 persisted blob for migration activation and a small real-ish freshly
authored catalog day for the trodes_to_nwb integration check.

## Review

Before opening the PR, dispatch `code-reviewer` against the diff. Confirm:

- `WORKSPACE_SCHEMA_VERSION` bumped with a registered, fixture-tested migrator.
- No new exported YAML keys; `mergeDayMetadata` emits only the legacy inline `tasks[]` shape.
- Golden baselines are byte-identical except any explicitly documented conflict fixture outside the golden set.
- Catalog is animal-level; day UI is pick/order, not retype.
- Empty/normal/conflict/repair/narrow screenshots show the ownership model clearly; no user has to memorize
  whether a fix belongs on Animal Setup or the day.
- Root route and legacy form remain untouched.
