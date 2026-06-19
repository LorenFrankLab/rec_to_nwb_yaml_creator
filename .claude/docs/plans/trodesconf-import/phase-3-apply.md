# Phase 3 — Apply via the reconfig action + `dioInventory` field

[← back to PLAN.md](PLAN.md) · [overview](overview.md) · [shared-contracts §3](shared-contracts.md#3-import-plan)

Turn a `TrodesconfImportPlan` into a committed configuration version by feeding the **existing** atomic
reconfiguration action, and add the optional `dioInventory` field to the snapshot. No UI yet — this is
the write path + persistence, tested at the workspace level with the byte-identity gate.

**Inputs to read first:**

- [shared-contracts §3](shared-contracts.md#3-import-plan) — the `TrodesconfImportPlan` this consumes.
- [src/state/workspaceActions.ts:266-319](../../../../src/state/workspaceActions.ts) —
  `createConfigurationSnapshotAndApplyForward(animalId, config: ConfigSnapshotInput, dayIds)`: the apply
  hook. Read the `ConfigSnapshotInput` type it expects and how it derives the version + resets day-owned
  state on a bump.
- [src/state/workspaceActions.ts:140-160](../../../../src/state/workspaceActions.ts) — the create-animal
  config-seed path (for `isFirstConfig` → seed v1).
- [src/state/workspaceTypes.ts:299-322](../../../../src/state/workspaceTypes.ts) —
  `ConfigurationSnapshot` (add optional `dioInventory`) + `ProbeConfiguration`.
- [src/state/persistence.ts:16-20,188](../../../../src/state/persistence.ts) +
  [src/state/workspaceMigrations.ts:70-103](../../../../src/state/workspaceMigrations.ts) —
  `WORKSPACE_SCHEMA_VERSION` + the migrator registry + `migrateWorkspace`; the persistence-invariant
  decision is made here (see overview).
- [src/state/workspaceSelectors.ts](../../../../src/state/workspaceSelectors.ts) — add a defensive
  `getConfigDioInventory(snapshot)` selector (absent → `[]`), matching the file's tolerant-read style.

**Contracts referenced:** [`TrodesconfImportPlan`](shared-contracts.md#3-import-plan).

## Tasks

- **`dioInventory` field.** Add `dioInventory?: ParsedDioChannel[]` (or a workspace-local `DioChannel`
  type mirroring it) to `ConfigurationSnapshot` (`workspaceTypes.ts:299-314`), as a **sibling** of
  `devices: ProbeConfiguration` so `diffProbeConfigs` is untouched. Read it everywhere via a defensive
  selector defaulting to `[]`.
- **Apply function.** Add `applyTrodesconfImport(actions, animalId, plan, dayIds)` (a thin wiring fn,
  e.g. in `src/state/trodesconfImportApply.ts`) that:
  - builds the `ConfigSnapshotInput` the existing action expects — `{ date, description:
    "Imported from <plan source>", devices: plan.candidate }` plus `dioInventory: plan.dioInventory`;
  - calls `createConfigurationSnapshotAndApplyForward(animalId, input, dayIds)` for a re-import
    (`!isFirstConfig`), OR seeds **v1** via the create-animal config path when `isFirstConfig`
    (confirm which entry the create flow uses; reuse it, don't duplicate version logic);
  - returns the created version for navigation.
  Bad-channel reset is **inherent** to the version bump (day-owned, carried-forward state resets on a new
  `configurationVersion` per the existing model) — do not add a separate reset.
- **Persistence decision (make it from the code, per overview invariant).** Determine whether the
  load/shape-ensure path (`persistence.ts` + `workspaceMigrations.ts`) tolerates a snapshot without
  `dioInventory`. If yes (absent-tolerant) → **no schema bump**; add a regression test loading a current
  `v3` blob (no `dioInventory`) unchanged. If the shape-ensure normalizes snapshots (would drop/require
  the field) → bump `WORKSPACE_SCHEMA_VERSION`, register a forward migrator that backfills
  `dioInventory: []`, and add the `vN` blob fixture per the project rule
  (`src/state/__tests__/fixtures/persistence/`). State which path was taken in the PR description.
- **CHANGELOG.** Add an entry (the importer is user-facing once P4 lands, but the model/field change
  ships here): note the new config-level DIO inventory + that exported YAML is unchanged.

## Deliberately not in this phase

- The upload control, entry points, and preview UI — [Phase 4](phase-4-ui.md). This phase is exercised
  by tests calling `applyTrodesconfImport` directly.
- Surfacing `dioInventory` to the day editor — [Phase 5](phase-5-dio-day.md).
- Any change to `createConfigurationSnapshotAndApplyForward`'s versioning/day-pinning logic — reuse it
  as-is.

## Validation slice

| Test | Asserts |
| --- | --- |
| `applyTrodesconfImport` — first config | seeds version 1 with the candidate `electrode_groups` + ntrode maps + `dioInventory`; `configurationHistory` has one snapshot. |
| `applyTrodesconfImport` — re-import | creates a new version via `createConfigurationSnapshotAndApplyForward`; preserved groups keep `device_type`/`location`; the targeted days re-pin to the new version. |
| bad channels reset | a day with bad channels on the old version shows none carried onto the new version (inherent to the bump). |
| persistence | a current-version blob **without** `dioInventory` loads with `getConfigDioInventory → []` (no data loss); if a bump was needed, the `vN` fixture hydrates to the current shape. |
| `baselines` | exported YAML byte-identical — the candidate produces the same `electrode_groups`/`ntrode_electrode_group_channel_map` a hand-built config would once `device_type` is set; `dioInventory` is off-export. |

## Fixtures

Reuse Phase 2's plan fixtures. Add (if a bump is taken) a `vN` persistence blob under
`src/state/__tests__/fixtures/persistence/`. No real-data slice.

## Review

Dispatch `code-reviewer` against the diff. Confirm:
- Apply reuses `createConfigurationSnapshotAndApplyForward` / the create-seed path — no duplicated
  version or day-pin logic.
- `dioInventory` is additive-optional + defensively read; the persistence decision is justified from the
  code and tested (old blob loads; or migrator + fixture present).
- `baselines` byte-identical; `dioInventory` provably off-export.
- CHANGELOG updated; no plan/phase references in code/test names.
