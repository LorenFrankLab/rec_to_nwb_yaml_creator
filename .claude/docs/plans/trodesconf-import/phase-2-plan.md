# Phase 2 — Candidate config + import plan (pure)

[← back to PLAN.md](PLAN.md) · [overview](overview.md) · [shared-contracts §2](shared-contracts.md#2-channel-map-contract) · [§3](shared-contracts.md#3-import-plan)

Turn a `ParsedTrodesConfig` + the animal's current configuration into a `TrodesconfImportPlan`: a
candidate `ProbeConfiguration` (electrode-group shells + count-sized ntrode maps), the diff vs the
current config (reusing `diffProbeConfigs`), the preserved-semantics set, the DIO inventory, and
conflict flags. Pure, fully unit-tested. No UI, no writes.

**Inputs to read first:**

- [shared-contracts §2](shared-contracts.md#2-channel-map-contract) — what the importer may/​may not set
  (structure yes; `map` values + `hwChan` no; `device_type` blank; default 1 ntrode→1 group).
- [shared-contracts §3](shared-contracts.md#3-import-plan) — the `TrodesconfImportPlan` shape to produce.
- [appendix §2](appendix.md#2-trodes_to_nwb-consumer) — the `len(map)` / `ntrode_id` cross-check this
  plan exists to make safe.
- [src/state/workspaceTypes.ts:181-208,299-322](../../../../src/state/workspaceTypes.ts) —
  `ElectrodeGroup`, `NtrodeMap`, `ProbeConfiguration`, `ConfigurationSnapshot`.
- [src/state/configDiff.ts:79](../../../../src/state/configDiff.ts) — `diffProbeConfigs(prev, next):
  ProbeConfigDiff` to reuse for `plan.diff`.
- [src/state/workspaceSelectors.ts:97](../../../../src/state/workspaceSelectors.ts) —
  `getConfigHistory`-style defensive read of `configurationHistory` (find the current/latest snapshot).
- [src/ntrode/probeCatalog.ts](../../../../src/ntrode/probeCatalog.ts) +
  [src/ntrode/deviceTypes.js](../../../../src/ntrode/deviceTypes.js) — per-`device_type` channel count
  for the conflict check (the executor confirms the exact accessor; `deviceTypeMap` length is the count).

**Contracts referenced:** [channel-map contract](shared-contracts.md#2-channel-map-contract) (do not
author `map` values or `hwChan`); [`TrodesconfImportPlan`](shared-contracts.md#3-import-plan).

## Tasks

- **New pure module `src/state/trodesconfImportPlan.ts`** exporting `buildTrodesconfImportPlan(parsed:
  ParsedTrodesConfig, currentConfig: ProbeConfiguration | null): TrodesconfImportPlan`.
- **Candidate `ProbeConfiguration`:** one `ElectrodeGroup` shell per ntrode (default 1:1 grouping,
  [§2](shared-contracts.md#2-channel-map-contract)): `id` = a stable index (0-based, matching the app's
  existing group-id convention — confirm against how `createConfigurationSnapshotAndApplyForward`/the
  reconfig path assigns `electrode_groups[].id`); `device_type`/`location`/`description`/`targeted_*`
  **blank**. One `NtrodeMap` per ntrode: `ntrode_id = parsed.id`, `electrode_group_id = the group id`,
  `bad_channels: []`, and a `map` that is **empty or count-sized placeholder** (NOT hwChan) — record the
  expected channel count so the count check (below) can run before `device_type` is chosen. Document
  that the real `map` regenerates on `device_type` selection.
- **Preserve semantics on re-import (decision #4):** when `currentConfig` is non-null, for each
  candidate group whose ntrode (`ntrode_id`) exists in the current config with the **same channel
  count**, copy the current group's `device_type`/`location`/`description`/`targeted_*` onto the
  candidate, and add its id to `preservedGroupIds`. New or count-changed ntrodes stay blank.
- **Diff:** `plan.diff = diffProbeConfigs(currentConfig ?? {electrode_groups:[],ntrode_electrode_group_channel_map:[]},
  candidate)`. `isFirstConfig = currentConfig == null` (or empty history).
- **Conflicts (non-blocking flags for the preview):**
  - `channel_count_vs_device_type`: only computable for `preservedGroupIds` (which have a `device_type`)
    — if the preserved `device_type`'s expected channel count ≠ the parsed ntrode `channelCount`, flag
    it (the probe changed shape under the same ntrode id).
  - `ntrode_count_mismatch`: if `currentConfig` had ntrodes now absent / vice-versa (also visible in the
    diff) — summarize for the header.
  - `total_channel_count_mismatch`: if `parsed.numChannels` is present and ≠ Σ `ntrodes[].channelCount`,
    flag it — a truncated/partial config or an unparsed channel block (catches a bad import early).
  - `orphan_reference`: a `refNTrodeID` pointing at an ntrode not present (reference-only; informational).
- **DIO inventory:** `plan.dioInventory = parsed.dio` (verbatim; consumed by P3/P5).
- **No app-facing docs** (internal module + the [shared-contracts](shared-contracts.md) entry).

## Deliberately not in this phase

- Writing anything to the workspace — [Phase 3](phase-3-apply.md) owns apply.
- Generating `map` **values** or grouping multi-shank ntrodes into one group — that happens on
  `device_type` selection via the existing generator (the plan only sizes/structures + flags conflicts).
- The preview UI — [Phase 4](phase-4-ui.md).

## Validation slice

| Test | Asserts |
| --- | --- |
| `buildTrodesconfImportPlan` — first import | 32 tetrode ntrodes → 32 group shells (device_type blank), 32 ntrode maps with `ntrode_id` 1..32 + correct expected counts; `isFirstConfig === true`; diff = all-added. |
| count contract | each candidate ntrode's recorded expected count == the parsed `channelCount` (the `len(map)` the consumer requires, [§2](shared-contracts.md#2-channel-map-contract)). |
| preserve semantics | re-import onto a config where ntrodes 1–30 are unchanged (same count) carries their `device_type`/`location` forward (`preservedGroupIds` = those 30); ntrode 31 with a changed count is blank + flagged `channel_count_vs_device_type`. |
| diff reuse | `plan.diff` equals `diffProbeConfigs(current, candidate)` (added/removed/changed match). |
| conflicts | a preserved group whose `device_type` count ≠ parsed count yields exactly one `channel_count_vs_device_type` conflict. |
| integrity check | a config whose `numChannels` ≠ Σ ntrode channel counts yields a `total_channel_count_mismatch`; a consistent config yields none. |
| `baselines` | no exported-YAML change (pure planning module). |

## Fixtures

Reuse Phase 1's parsed configs. Add a synthesized `currentConfig` (`ProbeConfiguration` with filled
`device_type`/`location` for 30 of 32 groups) to exercise preserve + conflict. No real-data slice.

## Review

Dispatch `code-reviewer` against the diff. Confirm:
- The candidate never sets `map` **values** or `hwChan`; only structure + counts ([§2](shared-contracts.md#2-channel-map-contract)).
- Preserve-semantics carries forward exactly the unchanged groups; changed/new are blank.
- `plan.diff` is the existing `diffProbeConfigs` output (no parallel diff impl).
- The count contract test pins against `deviceTypes.js` + the consumer's `len(map)` rule.
- No plan/phase references in code/test names; `baselines` byte-identical.
