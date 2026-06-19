# Shared contracts

[← back to PLAN.md](PLAN.md)

Contracts referenced by more than one phase. Each lives here once; phases link in by anchor. Upstream
file:line evidence is in [appendix.md](appendix.md).

- [1. `ParsedTrodesConfig` (parser output)](#1-parsedtrodesconfig)
- [2. The channel-map contract (trodes_to_nwb)](#2-channel-map-contract)
- [3. ntrode_id immutability + import-aware completion (THE invariant)](#3-invariant)
- [4. `TrodesconfImportPlan` (plan output)](#4-import-plan)
- [5. DIO id reconciliation (board id → editor index)](#5-dio-reconciliation)

---

## 1. `ParsedTrodesConfig` {#1-parsedtrodesconfig}

**Produced by** Phase 1, **consumed by** Phase 2. Pure data, no app types.

```ts
export interface ParsedNtrode {
  id: number;            // <SpikeNTrode id="..."> (Trodes 1-based) — IMMUTABLE downstream (see §3)
  channelCount: number;  // number of nested <SpikeChannel> elements
  hwChans: number[];     // ordered hwChan of each <SpikeChannel> (reference only; not written to YAML)
  refNTrodeID?: number;
  refChan?: number;
}

export interface ParsedDioChannel {
  id: string;                          // board-native, verbatim: "Din1" | "MCU_Din3" | "Controller_Din1" | "Dout2"
  direction: 'in' | 'out' | 'unknown'; // see direction rule below
}

export interface ParsedTrodesConfig {
  ntrodes: ParsedNtrode[];
  dio: ParsedDioChannel[];
  numChannels?: number;     // <HardwareConfiguration>/<GlobalOptions numChannels> — INFORMATIONAL only
  samplingRate?: number;    // Hz — provenance only (app does not store it)
  systemHint?: string;      // 'ECU' | 'MCU' | 'SpikeGadgets' best-effort
  sourceName: string;
}

export type TrodesconfParseResult =
  | { ok: true; config: ParsedTrodesConfig }
  | { ok: false; error: string };       // total parser — malformed XML returns ok:false, never throws
```

**DIO direction rule (stricter — must-fix #3).** Resolve direction by, in order: (a) if an `input` attr
is present, `input="1"` ⇒ `in`, **`input="0"` (or any non-`1`) ⇒ `out`** — matching
`convert_dios.py` (`direction = "input" if input_flag=="1" else "output"`); (b) else (no `input` attr —
real configs like `BlankWorkspace.trodesconf` have `Controller_Din*` with none) by id token, **after
stripping a leading board prefix** (`ECU_`/`MCU_`/`Controller_`): `…Din…` ⇒ `in`, `…Dout…` ⇒ `out`;
(c) else `'unknown'` (matches `convert_dios`'s "no direction" warning). Do **not** treat a missing
`input` as output. Keep the id **verbatim** (`ECU_Din1`, `Controller_Din1`, `MCU_Din3`); normalization to
the editor's `Din/Dout` index is a separate step ([§5](#5-dio-reconciliation)).

## 2. The channel-map contract (trodes_to_nwb) {#2-channel-map-contract}

**Referenced by** Phases 2–4. Authoritative behavior; evidence in
[appendix §2](appendix.md#2-trodes_to_nwb-consumer).

For each `<SpikeNTrode>` in the `.rec` header, trodes_to_nwb requires a YAML
`ntrode_electrode_group_channel_map` entry with a **matching `ntrode_id`** (missing/extra ⇒ hard error),
**`len(map) == that ntrode's channel count`** (else `ValueError`), `map[str(position)] =
nwb_electrode_id` (value = probe-electrode id, used to look up `device_type` geometry + `.rec` `hwChan`).
⇒ The YAML owns `ntrode_id` + `electrode_group_id` + the `map`'s **length**; `device_type` owns the
`map` **values**; the `.rec` owns `hwChan`/refs (never in the YAML).

## 3. ntrode_id immutability + import-aware completion {#3-invariant}

**THE invariant. Referenced by** Phases 2, 3, 4. Violating it produces YAML whose `ntrode_id`s no longer
match the `.rec` header → conversion `KeyError`/`ValueError` ([§2](#2-channel-map-contract)).

**Problem:** the current device-type-selection path renumbers. `ElectrodeGroupsContainer`
([src/pages/AnimalEditor/wiring/ElectrodeGroupsContainer.tsx:165-186](../../../../src/pages/AnimalEditor/wiring/ElectrodeGroupsContainer.tsx))
removes a group's maps and regenerates via `generateChannelMapsForGroup(group, nextNtrodeId(retainedMaps))`
([src/utils/channelMapUtils.ts:62-92](../../../../src/utils/channelMapUtils.ts)) — new ids after the
current max, one ntrode per `getProbeShanks` shank. So selecting `device_type` after an import would
**discard the imported `ntrode_id`s** and re-shape grouping.

**Invariant:** an imported ntrode's `id` is **fixed at import and never reassigned**. Completion fills
`map` **values** into the **existing** imported rows, keyed by `ntrode_id` — it does not allocate rows or
ids.

**Import-aware completion path (new — Phase 3).** `NtrodeMap` has **no** channel-count field, and
exported-YAML key reordering is **lossless** ([workspaceUtils.ts:66](../../../../src/state/workspaceUtils.ts))
— so a per-row expected count cannot ride on the `NtrodeMap`. The caller passes the imported ntrode rows
**in the intended shank order** plus their expected channel counts (resolved from the off-export
`trodesImport.ntrodeChannelCounts`, [§4](#4-import-plan)):
```ts
fillImportedNtrodeMaps(
  ordered: Array<{ row: NtrodeMap; expectedChannels: number }>,  // group's rows, in user-chosen shank order
  deviceType: string,
): { ok: true; rows: NtrodeMap[] } | { ok: false; reason: string };
//   shanks = getProbeShanks(deviceType)                 (src/utils/deviceTypeUtils.ts)
//   require shanks.length === ordered.length              (one imported ntrode per shank)
//   require shanks[k].electrodeIds.length === ordered[k].expectedChannels   (== required len(map))
//   then rows[k] = { ...ordered[k].row, map: {0: shanks[k].electrodeIds[0], …} }  — id/electrode_group_id UNCHANGED
//   mismatch ⇒ ok:false with a precise reason (surfaced as a conflict; never silently renumber)
```
Shank↔ntrode pairing follows the **caller-supplied order**, not a hard-coded ascending `ntrode_id` — the
Phase 5 grouping UI lets the user order ntrodes within a merged multi-shank group (default: ascending).

**Wiring:** `ElectrodeGroupsContainer`'s device-type-change branch must route an **imported,
not-yet-completed** group through `fillImportedNtrodeMaps` (preserve ids) instead of
`generateChannelMapsForGroup`/`nextNtrodeId` (renumber). A group is "imported-incomplete" when its
ntrode rows exist with empty `map` and a `trodesImport.ntrodeChannelCounts` entry but its `device_type`
is blank (Phase 2 records the counts; Phase 4 persists them off-export). **Do not weaken:** non-imported
groups keep the existing generate path unchanged.

## 4. `TrodesconfImportPlan` {#4-import-plan}

**Produced by** Phase 2, **consumed by** Phases 3–5.

```ts
export interface TrodesconfImportPlan {
  ntrodeShells: NtrodeMap[];          // one per parsed ntrode, ntrode_id PRESERVED, map: {}, bad_channels: []
  ntrodeChannelCounts: Record<string, number>;  // ntrode_id → expected channel count (OFF-EXPORT; never on the NtrodeMap row)
  groups: Array<{                     // grouping: see rule below
    electrode_group_id: number;
    ntrodeIds: number[];               // imported ids in this group, IN SHANK ORDER (≥1; >1 = multi-shank)
    deviceType: string;                // '' on first import (decision #3); carried-forward on a preserved re-import group
  }>;
  dioInventory: ParsedDioChannel[];
  diff: ProbeConfigDiff;
  preservedGroupIds: number[];         // re-import: groups whose ntrode set is unchanged → grouping + semantics carried
  conflicts: Array<{
    kind:
      | 'ntrode_count_mismatch'             // header ntrode set differs from current — REVIEW (a normal reconfig), not blocking
      | 'channel_count_vs_device_type'      // a preserved/assigned device_type's shanks ≠ imported structure — ERROR
      | 'total_channel_count_info'          // Σ channelCount ≠ numChannels — INFO (capacity ≥ active)
      | 'orphan_reference';                 // INFO
    ntrodeId?: number;
    severity: 'error' | 'review' | 'info';
    message: string;
  }>;
  isFirstConfig: boolean;
}
```
- `ntrodeShells` carry **`ntrode_id` verbatim** ([§3](#3-invariant)) with `map: {}`. Expected channel
  counts live **only** in `ntrodeChannelCounts` (and, post-apply, the off-export
  `ConfigurationSnapshot.trodesImport` — [phase-4](phase-4-apply.md)); **never** a field on the
  `NtrodeMap` row, since exported-key reordering is lossless and would leak it
  ([workspaceUtils.ts:66](../../../../src/state/workspaceUtils.ts)).
- **Grouping rule:** **first import** → default 1 ntrode → 1 group. **Re-import** → for each current
  electrode group whose ntrode set is unchanged, **keep that group's existing grouping** (a multi-shank
  `{1,2,3,4}` stays one group, not four) and carry its `device_type`/`location` (→ `preservedGroupIds`);
  genuinely-new ntrodes default 1:1. The Phase 5 UI lets the user merge/order ntrodes for new multi-shank
  groups, then assign `device_type` (→ [§3](#3-invariant) fill).
- **`ntrode_count_mismatch` is `severity:'review'`, not blocking** — a changed layout on re-import is the
  normal reconfiguration case (a new version), surfaced in the diff; it does not prevent apply.
- `diff` reuses [`diffProbeConfigs`](../../../../src/state/configDiff.ts) (a pure fn — **not** rendered
  anywhere today; the preview component is new, see Phase 5).

## 5. DIO id reconciliation (board id → editor index) {#5-dio-reconciliation}

**Referenced by** Phase 6. The day DIO editor presents the full standard `Din1…Din32` / `Dout1…Dout32`
range with `ECU_DIGITAL_CHANNELS = 32`
([src/pages/DayEditor/BehavioralEventsDisplay.tsx:32-40](../../../../src/pages/DayEditor/BehavioralEventsDisplay.tsx)),
but the config's ids are board-native (`Din1`, `ECU_Din1`, `MCU_Din1`, `Controller_Din1`). To "limit the picker to
present channels" we need a mapping:

```ts
// board-native id → { type: 'Din'|'Dout', index: 1..32 } | null (unmappable)
reconcileDioId(id: string): { type: 'Din' | 'Dout'; index: number } | null;
//   strip a leading board prefix ('ECU_' | 'MCU_' | 'Controller_' | '') then parse Din<N>/Dout<N>.
//   VERIFIED against the trodes Resources samples AND the trodes_to_nwb test fixtures
//   (Din*, ECU_Din*/ECU_Dout*, MCU_Din*, Controller_Din* — appendix §1); an id that doesn't
//   reconcile is surfaced (not silently dropped).
```
The day editor only has `dayEvents` on `BehavioralEventsDisplay`; **`DioTab` (which has day + animal
context) resolves the day's config-version inventory, reconciles it, and passes the available-channel
list down** as a prop ([phase-6](phase-6-dio.md)) — `BehavioralEventsDisplay` does not read the workspace
itself. An unreconcilable inventory id is shown as an informational note, not hidden.
