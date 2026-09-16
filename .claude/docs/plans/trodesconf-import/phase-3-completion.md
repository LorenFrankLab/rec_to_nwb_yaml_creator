# Phase 3 — Import-aware channel-map completion (the invariant)

[← back to PLAN.md](PLAN.md) · [overview](overview.md) · [shared-contracts §3](shared-contracts.md#3-invariant)

The linchpin. Today, setting `device_type` on a group **renumbers** its ntrodes (allocates new ids via
`nextNtrodeId`), which would break the imported `ntrode_id ↔ .rec` match. This phase adds an
**id-preserving completion path** and routes **import-backed** groups through it — on **every**
`device_type` change, including re-edits after completion, not just the first. Pure fill logic + the
`trodesImport` sibling it reads + the container wiring; no UI, no import pipeline yet (Phase 5 drives it).

**Inputs to read first:**

- [shared-contracts §3](shared-contracts.md#3-invariant) — the invariant + the `fillImportedNtrodeMaps`
  contract this phase implements.
- [src/pages/AnimalEditor/wiring/ElectrodeGroupsContainer.tsx:158-186](../../../../src/pages/AnimalEditor/wiring/ElectrodeGroupsContainer.tsx)
  — the device-type-change branch (`groupsToGenerateMapsFor` → `generateChannelMapsForGroup(group,
  nextNtrodeId(retainedMaps))`). This is where the branch is added.
- [src/utils/channelMapUtils.ts:62-92](../../../../src/utils/channelMapUtils.ts) —
  `generateChannelMapsForGroup`: mirror its value generation (`getProbeShanks(device_type)` →
  per-shank `electrodeIds` → `map`) but write into existing rows instead of allocating ids.
- [src/utils/deviceTypeUtils.ts:43-70](../../../../src/utils/deviceTypeUtils.ts) — `getProbeShanks`
  (per-shank electrode ids) + `getChannelCount` for validation.
- [shared-contracts §2](shared-contracts.md#2-channel-map-contract) +
  [appendix §2](appendix.md#2-trodes_to_nwb-consumer) — the `ntrode_id`/`len(map)` rule the result must
  satisfy.
- [src/state/workspaceTypes.ts:299-322](../../../../src/state/workspaceTypes.ts) — `ConfigurationSnapshot`
  (this phase adds the off-export `trodesImport` sibling here) +
  [src/state/workspaceSelectors.ts](../../../../src/state/workspaceSelectors.ts) (add `getConfigImportCounts`) +
  [src/state/persistence.ts](../../../../src/state/persistence.ts) /
  [workspaceMigrations.ts:70-103](../../../../src/state/workspaceMigrations.ts) (the persistence decision,
  [overview Rollout](overview.md#rollout-strategy)).

**Contracts referenced:** [the invariant + `fillImportedNtrodeMaps`](shared-contracts.md#3-invariant).

## Tasks

- **`fillImportedNtrodeMaps` (new pure fn, e.g. in `src/utils/channelMapUtils.ts`).** Signature +
  semantics per [§3](shared-contracts.md#3-invariant): `(ordered: Array<{ row: NtrodeMap;
  expectedChannels: number }>, deviceType) → { ok:true; rows } | { ok:false; reason }`. The caller passes
  the group's ntrode rows **in shank order** with each row's expected channel count (counts come from the
  off-export `trodesImport.ntrodeChannelCounts`, **not** from the row — `NtrodeMap` has no count field).
  - `shanks = getProbeShanks(deviceType)`.
  - **Validate** `shanks.length === ordered.length` (one imported ntrode per shank) and, for each shank
    `k`, `shanks[k].electrodeIds.length === ordered[k].expectedChannels` (== the `len(map)` the `.rec`
    requires).
  - On success, `rows[k] = { ...ordered[k].row, map: shanks[k].electrodeIds.reduce((m,eid,idx)=>({...m,
    [idx]:eid}),{}) }` — **`ntrode_id`/`electrode_group_id` unchanged**. On mismatch, `{ ok:false, reason }`
    naming expected vs actual shank/channel counts.
  - **Pairing follows the caller's order**, not a hard-coded ascending `ntrode_id` — the Phase 5 grouping
    UI sets the per-group shank order (default ascending). Document that the caller owns the order.
- **Define the off-export `trodesImport` sibling here (the fill's dependency).** Add
  `trodesImport?: { ntrodeChannelCounts: Record<string, number>; sourceName?: string }` to
  `ConfigurationSnapshot` ([workspaceTypes.ts:299-322](../../../../src/state/workspaceTypes.ts)) as a
  **sibling** of `devices` (off-export — export reads only the merged `devices`), plus a defensive
  `getConfigImportCounts(snapshot)` selector (absent → `{}`). This lives in Phase 3, not Phase 4, because
  the container wiring below depends on it; Phase 4 (apply) is what populates it. Make the persistence
  decision for it per [overview Rollout](overview.md#rollout-strategy) (additive-optional ⇒ likely no
  schema bump + a regression test; the same decision covers Phase 4's `dioInventory`).
- **Branch the container (`ElectrodeGroupsContainer.tsx:158-186`) on `import-backed`, not "incomplete".**
  When a `device_type` change applies to an **import-backed** group — its current ntrode rows have
  entries in `trodesImport.ntrodeChannelCounts` (a **permanent** property; **independent** of whether the
  `map` is empty or `device_type` was already set) — resolve the group's ordered rows + their expected
  counts (from `getConfigImportCounts`) and route to `fillImportedNtrodeMaps`, splicing the returned rows
  back **by `ntrode_id`**, instead of the `retainedMaps` + `generateChannelMapsForGroup(…, nextNtrodeId)`
  path. This must fire **even when the group was already completed** (a second device-type edit re-fills
  in place / refuses on shank mismatch — never renumbers). A `{ ok:false }` surfaces the reason (no
  write, no renumber). **Non-import-backed groups keep the existing generate path verbatim**
  (regression-guard it).
- **Distinguish the two paths cleanly.** Factor the branch so the import-backed vs normal decision is one
  readable predicate (membership in `trodesImport.ntrodeChannelCounts`); add a code comment pointing at
  the invariant (no plan/phase reference in the code).
- **No user-facing doc changes** (internal logic); the user-facing behavior ships in Phase 5.

## Deliberately not in this phase

- The grouping UI (merging ntrodes into a multi-shank group) — [Phase 5](phase-5-ui.md); this phase
  assumes the group's ntrode rows are already assigned (Phase 2 default or Phase 5 regroup).
- Parsing + the import plan — Phases 1/2. The apply **write path** + the `dioInventory` sibling +
  *populating* `trodesImport` — Phase 4. (Phase 3 only **defines** `trodesImport` + its selector, and
  reads it for the routing; it can be tested with a hand-built fixture snapshot.)
- Changing the normal (non-import-backed) `generateChannelMapsForGroup` path.

## Validation slice

| Test | Asserts |
| --- | --- |
| `fillImportedNtrodeMaps` — tetrode | a single imported ntrode (id 7, 4 ch) + `tetrode_12.5` → one row, `ntrode_id` still 7, `map {0:0,1:1,2:2,3:3}`. |
| `fillImportedNtrodeMaps` — multi-shank | 4 imported ntrodes (ids 1–4, 32 ch each) + a 128c-4shank type → 4 rows, ids 1–4 preserved, per-shank electrode-id maps with offsets. |
| `fillImportedNtrodeMaps` — mismatch | a device_type whose shank count or per-shank channels ≠ the imported structure → `{ok:false, reason}`; no rows written. |
| container — first completion keeps ids | setting `device_type` on an import-backed group (empty map) via the container leaves its `ntrode_id`s unchanged. |
| container — **re-completion** keeps ids | changing `device_type` on an **already-completed** import-backed group (map already filled, device_type already set) **again** preserves `ntrode_id`s — does NOT renumber. (The hole the import-backed predicate closes.) |
| container — incompatible re-completion | changing an import-backed group to a device_type whose shank structure ≠ its ntrodes → `{ok:false}` surfaced, no write, no renumber. |
| container — normal group unchanged | a non-import-backed group's device-type change still uses `generateChannelMapsForGroup`/`nextNtrodeId` (no behavior change). |
| header-match contract | the filled rows satisfy a synthetic `.rec`-header check mirroring trodes_to_nwb `validate_metadata` (`ntrode_id` match + `len(map)`), [appendix §2](appendix.md#2-trodes_to_nwb-consumer). |
| `baselines` | byte-identical. |

## Fixtures

Synthesized imported-ntrode rows (tetrode + 4-shank) + the catalog device types; a synthetic
`.rec`-header element (ids + `<SpikeChannel>` counts) for the contract test; and a **hand-built fixture
animal** whose config snapshot has `trodesImport.ntrodeChannelCounts` set — both an empty-`map` group
(first completion) and an already-completed group (re-completion) — to drive the container tests without
the Phase 4 apply path. No real-data slice.

## Review

Dispatch `code-reviewer`. Confirm: import-backed completion **never** changes `ntrode_id`/`electrode_group_id`,
**including a second `device_type` edit after completion** (the import-backed predicate is permanent, not
"empty map / blank device_type"); mismatches refuse (no silent renumber); the non-import-backed path is
provably untouched (regression test); the header-match contract test passes; `trodesImport` is off-export;
no plan/phase refs in code; `baselines` byte-identical.
