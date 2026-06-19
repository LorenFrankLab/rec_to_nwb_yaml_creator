# Phase 2 — Candidate config + import plan (pure)

[← back to PLAN.md](PLAN.md) · [overview](overview.md) · [shared-contracts §3](shared-contracts.md#3-invariant) · [§4](shared-contracts.md#4-import-plan)

Turn a `ParsedTrodesConfig` + the animal's current configuration into a `TrodesconfImportPlan`:
**id-preserving** ntrode shells, a default grouping, the diff vs current (reusing `diffProbeConfigs`),
the preserved-semantics set, the DIO inventory, and conflict flags. Pure, fully unit-tested. No UI, no
writes, no completion (that's Phase 3).

**Inputs to read first:**

- [shared-contracts §3](shared-contracts.md#3-invariant) — **the invariant:** ntrode shells carry the
  parsed `ntrode_id` verbatim; nothing here allocates or renumbers ids.
- [shared-contracts §4](shared-contracts.md#4-import-plan) — the `TrodesconfImportPlan` shape to produce.
- [shared-contracts §2](shared-contracts.md#2-channel-map-contract) — the `len(map)` contract the
  recorded channel count satisfies.
- [src/state/workspaceTypes.ts:181-208,299-322](../../../../src/state/workspaceTypes.ts) — `NtrodeMap`,
  `ProbeConfiguration`, `ConfigurationSnapshot`.
- [src/state/configDiff.ts:79](../../../../src/state/configDiff.ts) — `diffProbeConfigs(prev, next)` for
  `plan.diff` (pure fn; rendered by Phase 5's new component, not by anything today).
- [src/utils/deviceTypeUtils.ts:43-70](../../../../src/utils/deviceTypeUtils.ts) — `getChannelCount` /
  `getProbeShanks` for the conflict checks (NOT `deviceTypeMap.length`).
- [src/state/workspaceSelectors.ts:97](../../../../src/state/workspaceSelectors.ts) — defensive read of
  the current `configurationHistory`/latest snapshot.

**Contracts referenced:** [the invariant](shared-contracts.md#3-invariant);
[`TrodesconfImportPlan`](shared-contracts.md#4-import-plan).

## Tasks

- **New pure module `src/state/trodesconfImportPlan.ts`** exporting `buildTrodesconfImportPlan(parsed:
  ParsedTrodesConfig, currentConfig: ProbeConfiguration | null): TrodesconfImportPlan`.
- **`ntrodeShells` (id-preserving) + `ntrodeChannelCounts`:** one `NtrodeMap` per `parsed.ntrodes[i]`
  with `ntrode_id = parsed.ntrodes[i].id` **verbatim** ([§3](shared-contracts.md#3-invariant)),
  `electrode_group_id` = its group, `bad_channels: []`, `map: {}`. Record each expected channel count in
  `plan.ntrodeChannelCounts[ntrode_id] = parsed.ntrodes[i].channelCount` — **NOT** as a field on the
  `NtrodeMap` row (export key-reordering is lossless and would leak it,
  [workspaceUtils.ts:66](../../../../src/state/workspaceUtils.ts)). No `map` values here.
- **`groups` (grouping rule, [§4](shared-contracts.md#4-import-plan)):** **first import** → one group per
  ntrode (`deviceType: ''`), `ntrodeIds` ascending. **Re-import** → for each current electrode group
  whose ntrode set is unchanged, **reuse that group's existing grouping** (its `ntrodeIds` and id) — so a
  current multi-shank group `{1,2,3,4}` stays one group, not four — and carry `device_type`; only
  genuinely-new ntrodes default 1:1. (The 1:1 default must not shatter a preserved multi-shank group.)
- **Preserve semantics on re-import (decision #4):** for the reused groups above, carry
  `device_type`/`location`/`description`/`targeted_*` onto the candidate group and add the id to
  `preservedGroupIds`. New/changed groups stay blank.
- **Diff:** `plan.diff = diffProbeConfigs(currentConfig ?? emptyConfig, candidateProbeConfig)` where
  `candidateProbeConfig` is `{electrode_groups: groups→ElectrodeGroup shells, ntrode_electrode_group_channel_map: ntrodeShells}`.
  `isFirstConfig = currentConfig == null || empty history`.
- **Conflicts ([§4](shared-contracts.md#4-import-plan) shape, with `severity`):**
  - `ntrode_count_mismatch` (**`review`**, NOT blocking): re-import where the header's ntrode-id set
    differs — the normal reconfiguration case (new version); shown in the diff, does not prevent apply.
  - `channel_count_vs_device_type` (`error`): a **preserved/assigned** group whose `device_type`'s
    `getProbeShanks` structure no longer matches its imported ntrodes (count or per-shank channels).
  - `total_channel_count_info` (`info`, **non-blocking**): `parsed.numChannels` present and ≠ Σ
    `channelCount` — hardware capacity can exceed active ntrodes; informational only.
  - `orphan_reference` (`info`): a `refNTrodeID` with no present ntrode.
- **`dioInventory = parsed.dio`** (verbatim; reconciled later in Phase 6).

## Deliberately not in this phase

- Filling `map` values / validating a chosen `device_type` — [Phase 3](phase-3-completion.md) owns the fill.
- Any allocation/renumbering of `ntrode_id` — forbidden ([§3](shared-contracts.md#3-invariant)).
- Writing to the workspace — [Phase 4](phase-4-apply.md). The grouping UI — [Phase 5](phase-5-ui.md).

## Validation slice

| Test | Asserts |
| --- | --- |
| `buildTrodesconfImportPlan` — ids preserved | 32 ntrodes ids `1..32` → 32 shells `ntrode_id` exactly `1..32` (verbatim), `map: {}`; no id reassigned. |
| counts off-row | `plan.ntrodeChannelCounts[id] === parsed.ntrodes[i].channelCount`; **no** count field appears on any `NtrodeMap` row (assert the row keys are exactly `ntrode_id`/`electrode_group_id`/`map`/`bad_channels`). |
| first-import grouping | first import → one group per ntrode, `deviceType: ''`, `isFirstConfig: true`, diff all-added. |
| re-import preserves grouping | a current multi-shank group `{1,2,3,4}` whose ntrode set is unchanged stays **one** group (not split 1:1) with its `device_type`/`location` carried → `preservedGroupIds`. |
| changed layout is review | a re-import whose ntrode-id set differs yields `ntrode_count_mismatch` with `severity:'review'` (not `error`); apply is not blocked. |
| conflicts severity | `numChannels` ≠ Σ counts → one `total_channel_count_info` `severity:'info'`; a preserved group whose device_type no longer fits → `channel_count_vs_device_type` `severity:'error'`. |
| `baselines` | no exported-YAML change (pure module). |

## Fixtures

Phase 1's parsed configs + a synthesized `currentConfig` (filled `device_type`/`location` for 30 of 32
groups) for the preserve/conflict paths. No real-data slice.

## Review

Dispatch `code-reviewer`. Confirm: shells carry parsed `ntrode_id`s **verbatim** (no allocation);
expected counts recorded for Phase 3; preserve-semantics covers only structurally-unchanged groups;
conflicts carry the right `severity` (count-info is non-blocking); `plan.diff` is `diffProbeConfigs`
output; no plan/phase refs in code; `baselines` byte-identical.
