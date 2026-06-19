# Phase 4 — Apply via the reconfig action + `dioInventory` field

[← back to PLAN.md](PLAN.md) · [overview](overview.md) · [shared-contracts §4](shared-contracts.md#4-import-plan)

Turn a (grouped, possibly device_type-completed) `TrodesconfImportPlan` into a committed configuration
version via the existing atomic reconfiguration action, and add the optional `dioInventory` field —
including the transition path, not just the type. No UI; tested at the workspace level with the
byte-identity gate.

**Inputs to read first:**

- [shared-contracts §4](shared-contracts.md#4-import-plan) — the plan this consumes; the candidate config
  (id-preserving) it writes.
- [src/state/workspaceActions.ts:266-319](../../../../src/state/workspaceActions.ts) —
  `createConfigurationSnapshotAndApplyForward(animalId, config: ConfigSnapshotInput, dayIds)`: the apply
  hook; reuse it (don't duplicate version/day-pin logic). Bad channels reset on the bump.
- [src/state/workspaceActions.ts:140-160](../../../../src/state/workspaceActions.ts) — the create-animal
  config-seed path for `isFirstConfig` (seed v1).
- [src/state/workspaceTransitions.ts:74-80](../../../../src/state/workspaceTransitions.ts) —
  `ConfigSnapshotInput = {date, description, devices}`. **Extend the type AND the snapshot-building
  transition** so `dioInventory` reaches the persisted `ConfigurationSnapshot` (smaller-correction #2:
  type alone is insufficient).
- [src/state/workspaceTypes.ts:299-322](../../../../src/state/workspaceTypes.ts) —
  `ConfigurationSnapshot` (add optional `dioInventory` as a **sibling** of `devices` so `diffProbeConfigs`
  is untouched).
- [src/state/persistence.ts:16-20,188](../../../../src/state/persistence.ts) +
  [src/state/workspaceMigrations.ts:70-103](../../../../src/state/workspaceMigrations.ts) — the
  persistence-invariant decision (overview Rollout).
- [src/state/workspaceSelectors.ts](../../../../src/state/workspaceSelectors.ts) — add a defensive
  `getConfigDioInventory(snapshot)` (absent → `[]`).

**Contracts referenced:** [`TrodesconfImportPlan`](shared-contracts.md#4-import-plan).

## Tasks

- **Off-export snapshot siblings + transition.** Add to `ConfigurationSnapshot` (both **siblings** of
  `devices`, so `diffProbeConfigs` and the export — which reads only `devices` — are untouched):
  `dioInventory?: DioChannel[]` and `trodesImport?: { ntrodeChannelCounts: Record<string, number>;
  sourceName?: string }` (the off-export counts the [§3](shared-contracts.md#3-invariant) completion
  needs while `device_type` is blank). Add both to `ConfigSnapshotInput` **and** thread them through the
  snapshot-building transition (`workspaceTransitions.ts`) — the type alone is insufficient
  (smaller-correction #2). Read via defensive selectors (`getConfigDioInventory`,
  `getConfigImportCounts`; absent → `[]`/`{}`).
- **Apply — re-import vs first-config (must-fix #2).** `applyTrodesconfImport(actions, animalId, plan,
  dayIds)` (e.g. `src/state/trodesconfImportApply.ts`):
  - *Re-import* (`!isFirstConfig`): build `ConfigSnapshotInput = { date, description: "Imported from
    <plan.sourceName>", devices, dioInventory, trodesImport }` and call
    `createConfigurationSnapshotAndApplyForward` (a new version — correct here).
  - *First config* (`isFirstConfig`): **do NOT** call `createConfigurationSnapshotAndApplyForward` —
    `createAnimal` already creates `configurationHistory[0]` (v1)
    ([workspaceActions.ts:154-161](../../../../src/state/workspaceActions.ts)), so that would make **v2**.
    Instead **seed v1 from the import**: either (preferred) build the parsed config *before* `createAnimal`
    and pass `devices` + the two siblings into the create path (extend `createAnimal`/its v1-snapshot
    construction to accept `dioInventory`/`trodesImport`), **or** replace v1 in place via `updateAnimal`
    immediately after create (overwrite `configurationHistory[0].devices` + set the siblings; no new
    version). Pick one in the PR; the result is a single v1 == the import.
  - **The written `ntrode_id`s are the plan's preserved ids** ([§3](shared-contracts.md#3-invariant)) —
    never re-derived here.
- **Persistence decision (from the code).** Determine if the load/shape-ensure path tolerates a snapshot
  without `dioInventory`/`trodesImport`. Absent-tolerant ⇒ no schema bump + a regression test loading a
  current blob unchanged. Normalize-touching ⇒ bump `WORKSPACE_SCHEMA_VERSION` + forward migrator
  backfilling the absent fields + a `vN` blob fixture. State which in the PR.
- **CHANGELOG.** Note the config-level DIO inventory + that exported YAML is unchanged.

## Deliberately not in this phase

- Upload/entry/preview UI — [Phase 5](phase-5-ui.md) (this phase is driven by tests calling
  `applyTrodesconfImport`).
- The day DIO picker — [Phase 6](phase-6-dio.md).
- Changing `createConfigurationSnapshotAndApplyForward`'s versioning/day-pinning — reuse as-is.

## Validation slice

| Test | Asserts |
| --- | --- |
| `applyTrodesconfImport` — first config seeds **v1** | after import-at-create, `configurationHistory.length === 1` and `version === 1` (NOT 2); the snapshot's `devices` = the import, with `dioInventory` + `trodesImport.ntrodeChannelCounts` set. |
| `applyTrodesconfImport` — re-import | new version via the reconfig action; preserved groups keep `device_type`/`location` + grouping; days re-pin. |
| `ntrode_id` integrity | the persisted snapshot's `ntrode_id`s equal the plan's (== parsed config's); none renumbered on the way to disk. |
| bad channels reset | bad channels on the old version don't carry onto the new (inherent to the bump). |
| persistence | a blob without `dioInventory`/`trodesImport` loads with the defensive selectors → `[]`/`{}`; if bumped, the `vN` fixture hydrates to current. |
| `baselines` | exported YAML byte-identical; **both `dioInventory` and `trodesImport` are off-export** (export reads only `devices`). |

## Fixtures

Phase 2/3 plan + completed-config fixtures; a persistence blob if a bump is taken. No real-data slice.

## Review

Dispatch `code-reviewer`. Confirm: reuses the reconfig/seed actions (no duplicated version logic);
`dioInventory` threaded through the transition (not just typed) + defensively read; persisted
`ntrode_id`s preserved; `baselines` byte-identical + `dioInventory` off-export; CHANGELOG updated; no
plan/phase refs in code.
