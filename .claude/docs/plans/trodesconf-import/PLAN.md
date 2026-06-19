# `.trodesconf` Importer Implementation Plan

**Status:** Not started.

Let users establish an animal's hardware configuration by importing the `.trodesconf` (the SpikeGadgets
workspace XML embedded in every `.rec`) instead of hand-building electrode groups and counting
channels. The import is a **hardware-structure scaffold**: from the config it creates the exact
electrode-group/ntrode structure with per-ntrode channel counts (guaranteeing the YAML matches the
`.rec` so trodes_to_nwb's `len(map)` cross-check can't fail) and records the board's DIO channel
inventory; it deliberately leaves the experiment semantics it cannot know — `device_type`, brain
`location`, stereotax coordinates — blank for the existing validation to drive. It targets the
**animal configuration version** (seed v1 at create-animal; a changed layout makes a new version via
the existing reconfiguration path), feeding the diff/apply machinery the app already has. **Exported
YAML is unchanged** — the importer fills the same fields the user would, and the channel `map` values
still come from `device_type` as today.

## Reading order

For agent invocation, **load only the slice you need**:

1. **Working a specific phase?** Open the matching phase file — each is self-contained.
2. **Need the channel-map contract or the parsed-config type?** [shared-contracts.md](shared-contracts.md).
3. **Need upstream `.trodesconf` XML / trodes_to_nwb line refs?** [appendix.md](appendix.md).
4. **Need scope / risks / rollout / the persistence-migration call?** [overview.md](overview.md).

## Files

- [overview.md](overview.md) — scope, integration points, the byte-identity + persistence invariants, risks, rollout.
- [shared-contracts.md](shared-contracts.md) — the `ParsedTrodesConfig` type, the trodes_to_nwb channel-map contract, and the import-plan shape; referenced by ≥2 phases.
- [appendix.md](appendix.md) — `.trodesconf` XML structure + trodes_to_nwb consumer file:line refs (the authoritative behavior the plan is built against).
- Phases (each ships as a separable PR, in dependency order):
  - [phase-1-parser.md](phase-1-parser.md) — pure `.trodesconf` XML → `ParsedTrodesConfig`.
  - [phase-2-plan.md](phase-2-plan.md) — candidate `ProbeConfiguration` + diff/plan (reuses `diffProbeConfigs`) + count/device_type conflict flags.
  - [phase-3-apply.md](phase-3-apply.md) — apply via the existing reconfig action; add the optional `dioInventory` field.
  - [phase-4-ui.md](phase-4-ui.md) — entry points (create-animal + new-configuration), file upload, diff preview, post-import validation punch-list.
  - [phase-5-dio-day.md](phase-5-dio-day.md) — surface the config DIO inventory as a channel picker in the day DIO editor.
