# Shared contracts

[← back to PLAN.md](PLAN.md)

Contracts referenced by more than one phase. Each lives here once; phases link in by anchor. Upstream
file:line evidence for the behavior asserted here is in [appendix.md](appendix.md).

- [1. `ParsedTrodesConfig` (parser output)](#1-parsedtrodesconfig)
- [2. The channel-map contract (trodes_to_nwb)](#2-channel-map-contract)
- [3. `TrodesconfImportPlan` (plan output)](#3-import-plan)

---

## 1. `ParsedTrodesConfig` {#1-parsedtrodesconfig}

**Produced by** Phase 1, **consumed by** Phase 2. Pure data, no app types.

```ts
export interface ParsedNtrode {
  id: number;            // <SpikeNTrode id="..."> (Trodes 1-based)
  channelCount: number;  // number of nested <SpikeChannel> elements
  hwChans: number[];     // ordered hwChan of each <SpikeChannel> (for reference/validation only)
  refNTrodeID?: number;  // <SpikeNTrode refNTrodeID="..."> (reference ntrode; 0/absent => none)
  refChan?: number;      // <SpikeNTrode refChan="..."> (1-based within the ref ntrode)
}

export interface ParsedDioChannel {
  id: string;                  // e.g. "Din1", "MCU_Din3", "Dout2"
  direction: 'in' | 'out';     // from input="1" (in) else out
}

export interface ParsedTrodesConfig {
  ntrodes: ParsedNtrode[];     // in document order
  dio: ParsedDioChannel[];     // digital <Channel> inventory (board-dependent)
  numChannels?: number;        // <HardwareConfiguration numChannels> / <GlobalOptions numChannels> — integrity cross-check
  samplingRate?: number;       // <HardwareConfiguration samplingRate> (Hz) — provenance (app does not store it)
  systemHint?: string;         // 'ECU' | 'MCU' | 'SpikeGadgets' best-effort, for provenance
  sourceName: string;          // uploaded file name, for the preview/provenance
}

export type TrodesconfParseResult =
  | { ok: true; config: ParsedTrodesConfig }
  | { ok: false; error: string };   // total parser: malformed/empty XML returns ok:false, never throws
```

`hwChans` and `refNTrodeID`/`refChan` are carried for completeness + future use, but per
[§2](#2-channel-map-contract) they are **not written to the app's YAML** (trodes_to_nwb reads them from
the `.rec`). The parser's only YAML-affecting outputs are `ntrodes[].id` + `ntrodes[].channelCount` and
the `dio` inventory.

## 2. The channel-map contract (trodes_to_nwb) {#2-channel-map-contract}

**Referenced by** Phase 2 (candidate config + count check) and Phase 3 (apply). This is the authoritative
behavior the importer must not violate; evidence in [appendix §2](appendix.md#2-trodes_to_nwb-consumer).

For each `<SpikeNTrode>` in the `.rec` header, trodes_to_nwb:

1. Requires a YAML `ntrode_electrode_group_channel_map` entry with matching `ntrode_id`; a missing or
   extra ntrode is a **hard error**.
2. Requires **`len(map) == number of <SpikeChannel> in that ntrode`** — else `ValueError`. This is the
   single structural cross-check the importer exists to make safe.
3. Reads `map[str(position)] = nwb_electrode_id` (key = 0-based channel position in the `.rec` ntrode;
   **value = probe-electrode id**), then looks up geometry (`rel_x/y/z`, shank) from the **`device_type`
   `probe_metadata`** and `hwChan` from the **`.rec` header** — keyed by that `nwb_electrode_id`.

**Consequences the importer obeys:**

- The importer sets **structure** — `ntrode_id`, `electrode_group_id`, and the per-ntrode channel
  **count** (so `len(map)` is correct). It does **not** author `map` *values* (probe-electrode ids) or
  `hwChan` — the `map` is generated from `device_type` by the app's existing generator
  (`deviceTypes.js`), exactly as when a user picks a `device_type` today; `hwChan`/refs live in the
  `.rec`.
- `device_type` is **required** for trodes_to_nwb to build electrodes at all (geometry comes from its
  `probe_metadata`). The importer leaves it blank → existing validation flags it (decision #3). Until
  it is set, the group has no generated `map`; the importer records the **expected channel count** from
  the config so that, when `device_type` is chosen, a mismatch between the config count and the
  `device_type`'s channel count is flagged rather than silently producing a wrong-length map.
- **Default grouping: 1 ntrode → 1 electrode group.** Correct for tetrodes (each `<SpikeNTrode>` = 4
  channels = 1 group). A multi-shank probe (several ntrodes → one group) is realized when the user
  selects the multi-shank `device_type`; the importer does not infer the grouping.

**Verification (Phase 2/3, do not skip):** pin the count contract against `src/ntrode/deviceTypes.js`
(per-`device_type` channel count), a golden YAML's `ntrode_electrode_group_channel_map`, and a synthetic
`.rec`-header fixture that reproduces trodes_to_nwb's `len(map)` check
([appendix §2](appendix.md#2-trodes_to_nwb-consumer)). No structure is written that isn't reproduced
from a known-good fixture first.

## 3. `TrodesconfImportPlan` {#3-import-plan}

**Produced by** Phase 2, **consumed by** Phase 3 (apply) and Phase 4 (preview).

```ts
export interface TrodesconfImportPlan {
  candidate: ProbeConfiguration;          // electrode_groups (shells) + ntrode maps sized to count
  dioInventory: ParsedDioChannel[];       // recorded on the new ConfigurationSnapshot (P3)
  diff: ProbeConfigDiff;                   // from diffProbeConfigs(currentConfig, candidate) — null-safe when no current
  preservedGroupIds: number[];             // groups carried forward unchanged (semantics kept)
  conflicts: Array<{                        // surfaced in the preview; non-blocking unless noted
    kind:
      | 'channel_count_vs_device_type'
      | 'ntrode_count_mismatch'
      | 'total_channel_count_mismatch'     // Σ ntrode channelCount ≠ header numChannels
      | 'orphan_reference';
    ntrodeId?: number;
    message: string;
  }>;
  isFirstConfig: boolean;                  // true => seed v1 at create-animal; false => new version
}
```

- `candidate.electrode_groups` are **shells**: `id` assigned, `device_type`/`location`/`targeted_*`
  blank **unless** the group is in `preservedGroupIds` (decision #4 — same `ntrode_id` + channel count
  as the current config → carry its semantics forward).
- `candidate.ntrode_electrode_group_channel_map` entries carry `ntrode_id`, `electrode_group_id`
  (default = its own group), and an **empty or count-sized placeholder** `map` per [§2](#2-channel-map-contract)
  (the real `map` regenerates on `device_type` selection); `bad_channels: []` (reset on version bump).
- `diff` reuses [`diffProbeConfigs`](../../../../src/state/configDiff.ts) so the preview matches the
  existing reconfiguration wizard's rendering.
