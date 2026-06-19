# `.trodesconf` Importer Implementation Plan

**Status:** Not started.

Let users establish an animal's hardware configuration by importing the `.trodesconf` (the SpikeGadgets
workspace XML embedded in every `.rec`) instead of hand-building electrode groups and counting channels.
The import is a **hardware-structure scaffold**: it creates ntrode rows with the exact channel counts
**and immutable `ntrode_id`s from the config** (so the YAML matches the `.rec` and trodes_to_nwb's
`ntrode_id`/`len(map)` cross-check cannot fail), groups them (default 1 ntrode → 1 group; the user merges
shanks for a multi-shank probe), and records the board's DIO channel inventory. It deliberately leaves
the experiment semantics it cannot know — `device_type`, brain `location`, coordinates — for the user;
when `device_type` is set, a **new import-aware completion path fills the map values into the existing
rows without renumbering** (the central invariant). It targets the **animal configuration version**
(seed v1 at create-animal; a changed layout makes a new version via the existing reconfiguration path).
**Exported YAML is unchanged** — the importer produces the same fields a hand-built config would.

## Reading order

For agent invocation, **load only the slice you need**:

1. **Working a specific phase?** Open the matching phase file — each is self-contained.
2. **Need the invariant, the parsed type, the plan shape, or the DIO mapping?** [shared-contracts.md](shared-contracts.md).
3. **Need upstream `.trodesconf` XML / trodes_to_nwb line refs?** [appendix.md](appendix.md).
4. **Need scope / risks / rollout / the persistence + renumbering integration calls?** [overview.md](overview.md).

## Files

- [overview.md](overview.md) — scope, integration points, the byte-identity + persistence + renumbering invariants, risks, rollout.
- [shared-contracts.md](shared-contracts.md) — `ParsedTrodesConfig`, the channel-map contract, **the ntrode_id-immutability + import-aware-completion invariant**, the import-plan shape, and the DIO id-reconciliation contract.
- [appendix.md](appendix.md) — `.trodesconf` XML structure + trodes_to_nwb consumer file:line refs.
- Phases (each ships as a separable PR, in dependency order):
  - [phase-1-parser.md](phase-1-parser.md) — pure XML → `ParsedTrodesConfig` (+ stricter DIO direction, informational `numChannels`).
  - [phase-2-plan.md](phase-2-plan.md) — candidate config + diff/plan with **id-preserving** ntrode shells + the grouping model.
  - [phase-3-completion.md](phase-3-completion.md) — **the invariant:** `fillImportedNtrodeMaps` (preserve ids) + branch `ElectrodeGroupsContainer` away from the renumbering path.
  - [phase-4-apply.md](phase-4-apply.md) — apply via the existing reconfig action; add the optional `dioInventory` field (+ extend `ConfigSnapshotInput` + the transition).
  - [phase-5-ui.md](phase-5-ui.md) — real file-input + `file.text()`, a **new** diff/preview component, the grouping + device_type step, entry points.
  - [phase-6-dio.md](phase-6-dio.md) — reconcile board ids → editor index + limit the day DIO picker to present channels.
