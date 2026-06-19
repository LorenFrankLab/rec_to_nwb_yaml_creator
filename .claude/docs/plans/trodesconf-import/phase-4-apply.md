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
  `ConfigSnapshotInput = {date, description, devices}` (extend with the two siblings).
- [src/state/workspaceTransitions.ts:240-258](../../../../src/state/workspaceTransitions.ts) —
  `addConfigurationSnapshotToAnimal`: builds the snapshot from `{date,description,devices}` only and
  **does not set `updated.devices`** (the mirror). Extend it to carry the siblings + set the mirror
  (must-fix #1, see Tasks).
- [src/state/workspaceTransitions.ts:155-168](../../../../src/state/workspaceTransitions.ts) —
  `applyAnimalUpdates`' devices-mirror (rewrites only the latest snapshot's `electrode_groups`/`ntrode…`,
  not the siblings) — why `updateAnimal` can't seed v1's siblings (must-fix #2) and why siblings survive
  later edits.
- [src/pages/AnimalEditor/wiring/ElectrodeGroupsContainer.tsx:94](../../../../src/pages/AnimalEditor/wiring/ElectrodeGroupsContainer.tsx)
  — the editor reads `animal.devices` (the mirror); hence the mirror must match the new snapshot.
- [src/state/workspaceTypes.ts:299-322](../../../../src/state/workspaceTypes.ts) —
  `ConfigurationSnapshot` (add optional `dioInventory: ParsedDioChannel[]` + `trodesImport` as
  **siblings** of `devices` so `diffProbeConfigs` is untouched).
- [src/state/persistence.ts:16-20,188](../../../../src/state/persistence.ts) +
  [src/state/workspaceMigrations.ts:70-103](../../../../src/state/workspaceMigrations.ts) — the
  persistence-invariant decision (overview Rollout).
- [src/state/workspaceSelectors.ts](../../../../src/state/workspaceSelectors.ts) — add a defensive
  `getConfigDioInventory(snapshot)` (absent → `[]`).

**Contracts referenced:** [`TrodesconfImportPlan`](shared-contracts.md#4-import-plan).

## Tasks

- **Off-export snapshot siblings + transition.** Add to `ConfigurationSnapshot` (both **siblings** of
  `devices`, so `diffProbeConfigs` and the export — which reads only `devices` — are untouched):
  `dioInventory?: ParsedDioChannel[]` (the shared §1 type — **not** an undefined `DioChannel`) and
  `trodesImport?: { ntrodeChannelCounts: Record<string, number>; sourceName?: string }` (the off-export
  counts the [§3](shared-contracts.md#3-invariant) completion needs while `device_type` is blank). Add
  both to `ConfigSnapshotInput`. Read via defensive selectors (`getConfigDioInventory`,
  `getConfigImportCounts`; absent → `[]`/`{}`).
- **Extend the snapshot transition `addConfigurationSnapshotToAnimal`
  ([workspaceTransitions.ts:248-258](../../../../src/state/workspaceTransitions.ts)) — type alone is
  insufficient (must-fix #1/#2).** Today it builds `newVersion` from only `{date, description, devices}`
  and **does not touch `updated.devices`** (the editable mirror the editor reads at
  [ElectrodeGroupsContainer.tsx:94](../../../../src/pages/AnimalEditor/wiring/ElectrodeGroupsContainer.tsx)).
  Change it to (a) copy `config.dioInventory`/`config.trodesImport` onto `newVersion`, **and** (b) sync
  the new snapshot's **probe fields** into the mirror, **preserving the rest of `animal.devices`**.
  `animal.devices` is a `DeviceConfiguration` that also owns `data_acq_device` + `device`
  ([workspaceTypes.ts:157-166](../../../../src/state/workspaceTypes.ts)) — the snapshot `devices` is a
  probe-only `ProbeConfiguration` ([:299-322](../../../../src/state/workspaceTypes.ts)), and export reads
  `data_acq_device`/`device` from the mirror ([workspaceUtils.ts:425,465](../../../../src/state/workspaceUtils.ts)),
  so a full `updated.devices = newVersion.devices` would **drop the recording-system/device catalog**. Use
  the same merge `applyAnimalUpdates` uses:
  ```ts
  updated.devices = normalizeDevices({
    ...getAnimalDevices(updated),
    electrode_groups: structuredClone(newVersion.devices.electrode_groups),
    ntrode_electrode_group_channel_map: structuredClone(newVersion.devices.ntrode_electrode_group_channel_map),
  });
  ```
  **This is a no-op for the existing `ReconfigWizard` caller** (it passes a *clone of the current* probe
  devices, so the merged mirror is unchanged) and the fix for import (different probe devices) — add a
  `ReconfigWizard` regression test proving no behavior change there. Without (b), after a Trodes re-import the editor would still show the
  stale mirror and a subsequent edit would mirror it back over the imported snapshot (data loss). Note
  `applyAnimalUpdates`'s devices-mirror only rewrites the latest snapshot's `electrode_groups`/`ntrode…`,
  not the snapshot siblings ([workspaceTransitions.ts:161-167](../../../../src/state/workspaceTransitions.ts)),
  so the siblings survive later edits.
- **Apply — re-import vs first-config (must-fix #1/#2).** `applyTrodesconfImport(actions, animalId, plan,
  dayIds)` (e.g. `src/state/trodesconfImportApply.ts`):
  - *Re-import* (`!isFirstConfig`): build `ConfigSnapshotInput = { date, description: "Imported from
    ${plan.sourceName}", devices, dioInventory: plan.dioInventory, trodesImport: { ntrodeChannelCounts:
    plan.ntrodeChannelCounts, sourceName: plan.sourceName } }` and call
    `createConfigurationSnapshotAndApplyForward` (a new version — correct here). With the transition fix
    above, this both appends the snapshot **and** updates the mirror atomically.
  - *First config* (`isFirstConfig`): **import before `createAnimal`** and seed v1 from it.
    `createAnimal` already sets **both** `animal.devices` and `configurationHistory[0].devices` from the
    same `devices` input ([workspaceActions.ts:142,154-161](../../../../src/state/workspaceActions.ts)),
    so passing the imported `devices` makes mirror == v1 == import. **Extend `createAnimal` to also accept
    + set v1's `dioInventory`/`trodesImport`.** Do **not** use the `updateAnimal` fallback: `updateAnimal`
    only mirrors `devices` into the latest snapshot and has **no path** to set the snapshot siblings
    ([workspaceTransitions.ts:155-168](../../../../src/state/workspaceTransitions.ts)) — must-fix #2.
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
| re-import updates the **mirror** (must-fix #1) | after re-import, `animal.devices`'s **probe fields** (`electrode_groups`/`ntrode…`) equal the imported snapshot's, while `data_acq_device` + `device` are **preserved** (not dropped); a subsequent `updateAnimal` edit mirrors into the NEW snapshot, not over it. |
| `addConfigurationSnapshotToAnimal` reconfig regression | the existing reconfig path (config.devices = clone of current) is unchanged — mirror stays equal, no observable behavior change. |
| `ntrode_id` integrity | the persisted snapshot's `ntrode_id`s equal the plan's (== parsed config's); none renumbered on the way to disk. |
| bad channels reset | bad channels on the old version don't carry onto the new (inherent to the bump). |
| persistence | a blob without `dioInventory`/`trodesImport` loads with the defensive selectors → `[]`/`{}`; if bumped, the `vN` fixture hydrates to current. |
| `baselines` | exported YAML byte-identical; **both `dioInventory` and `trodesImport` are off-export** (they sit on the snapshot, outside any `devices`; the export merge never reads them). |

## Fixtures

Phase 2/3 plan + completed-config fixtures; a persistence blob if a bump is taken. No real-data slice.

## Review

Dispatch `code-reviewer`. Confirm: reuses the reconfig/seed actions (no duplicated version logic);
re-import sets **both** the new snapshot **and** the editable `animal.devices` mirror (must-fix #1), with
a passing `ReconfigWizard` no-op regression; first-config seeds **v1** via the extended `createAnimal`
(not a v2, not the sibling-incapable `updateAnimal` fallback — must-fix #2); both siblings (`ParsedDioChannel[]`
`dioInventory` + `trodesImport`) threaded through `addConfigurationSnapshotToAnimal` + defensively read;
persisted `ntrode_id`s preserved; `baselines` byte-identical + both siblings off-export; CHANGELOG
updated; no plan/phase refs in code.
