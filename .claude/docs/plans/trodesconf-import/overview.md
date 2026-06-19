# Overview — Scope, integration, invariants, risks

[← back to PLAN.md](PLAN.md)

## Current codebase integration points

The importer is a new read/plan/apply pipeline that **feeds existing config-version machinery**; it adds
pure modules + UI and one optional persisted field.

- [src/state/workspaceTypes.ts:299-322](../../../../src/state/workspaceTypes.ts) — `ConfigurationSnapshot`
  (`{date, version, description, devices: ProbeConfiguration, appliedToDays}`) and `ProbeConfiguration`
  (`{electrode_groups, ntrode_electrode_group_channel_map}`). The import builds a candidate
  `ProbeConfiguration`. P3 adds an optional `dioInventory` to `ConfigurationSnapshot`.
- [src/state/workspaceTypes.ts:181-208](../../../../src/state/workspaceTypes.ts) — `ElectrodeGroup`
  (`id, location, device_type, description, targeted_*`) and `NtrodeMap` (`ntrode_id,
  electrode_group_id, map: Record<string,number>, bad_channels`). The shells the import creates; the
  fields it leaves blank (`device_type`/`location`/`targeted_*`) are decision #3.
- [src/state/workspaceActions.ts:266-319](../../../../src/state/workspaceActions.ts) —
  `createConfigurationSnapshotAndApplyForward(animalId, config, dayIds)`: the **atomic reconfiguration
  entry point** P3 reuses to write a new version + pin days. Bad channels are day-owned and reset on a
  version bump by this path (no separate reset needed).
- [src/state/workspaceActions.ts:140-160](../../../../src/state/workspaceActions.ts) — the create-animal
  path that seeds `configurationHistory`; P3/P4 seed config **v1** here when importing at create time.
- [src/state/configDiff.ts:79](../../../../src/state/configDiff.ts) — `diffProbeConfigs(prev, next):
  ProbeConfigDiff` (electrode groups matched by `id`, ntrodes by `ntrode_id`; added/removed/changed).
  P2 reuses this for the preview; P4 reuses the reconfig diff rendering.
- [src/pages/DayEditor/ReconfigWizard.tsx](../../../../src/pages/DayEditor/ReconfigWizard.tsx) +
  [src/pages/AnimalView/NewConfigurationModal.tsx](../../../../src/pages/AnimalView/NewConfigurationModal.tsx)
  — the existing new-configuration UI; P4's re-import entry + diff preview extend these.
- [src/pages/Home/CreateAnimalWizard.tsx](../../../../src/pages/Home/CreateAnimalWizard.tsx) — P4's
  create-time import entry point.
- [src/pages/DayEditor/DioTab.tsx](../../../../src/pages/DayEditor/DioTab.tsx) — the day `behavioral_events`
  editor; P5 adds a channel picker limited to the imported DIO inventory.
- [src/element/FileUpload.jsx](../../../../src/element/FileUpload.jsx) — the upload control P4 reuses
  (accept `.trodesconf,.xml`).
- [src/ntrode/probeCatalog.ts](../../../../src/ntrode/probeCatalog.ts) +
  [src/ntrode/deviceTypes.js](../../../../src/ntrode/deviceTypes.js) — `device_type` catalog + the
  channel-count/`map` generator (`deviceTypeMap`/`getShankCount`). P2 reads the per-`device_type`
  channel count for the count-vs-config conflict check; the `map` itself is generated on `device_type`
  selection as today (the executor confirms the exact generator entry point — it is not changed).
- [src/state/yamlImport.ts](../../../../src/state/yamlImport.ts) /
  [yamlImportPlan.ts](../../../../src/state/yamlImportPlan.ts) /
  [yamlImportApply.ts](../../../../src/state/yamlImportApply.ts) — the existing parse→plan→apply import
  pipeline whose **separation** (not code) this importer mirrors.
- [src/state/workspaceMigrations.ts:70-103](../../../../src/state/workspaceMigrations.ts) +
  [src/state/persistence.ts:16-20,188](../../../../src/state/persistence.ts) — `WORKSPACE_SCHEMA_VERSION`
  (=3) + the migrator registry. P3's `dioInventory` is additive-optional (see Persistence invariant).

## Scope and dependency policy

### Goals

- One action turns a `.trodesconf` into the animal's hardware configuration: exact electrode-group/ntrode
  **structure** + per-ntrode **channel counts** + the **DIO inventory**.
- Guarantee the YAML structure matches the `.rec` so trodes_to_nwb's `len(map)` / ntrode-id cross-check
  ([appendix](appendix.md)) cannot fail at conversion.
- Re-import is a first-class **diff** that preserves the semantics the user already entered for unchanged
  groups (decision #4).

### Non-Goals

- **No change to exported YAML.** The import fills the same fields the user would; the channel `map`
  values still come from `device_type`. Golden baselines (`npx vitest run baselines`) stay byte-identical.
- **No `device_type`/`location`/coords inference** (decision #3) — left blank, validation drives. The
  `.trodesconf` does not contain them ([appendix](appendix.md)).
- **No `hwChan` or references written to the YAML** — trodes_to_nwb reads those from the `.rec` header at
  convert time ([shared-contracts §2](shared-contracts.md#2-channel-map-contract)); the importer never
  stores them.
- **No auto-created `behavioral_events`** (decision #5) — DIO inventory is reference only; days author
  events and pick channels from it.
- **No `.rec` parsing** — only the standalone `.trodesconf` XML (same content as the `.rec`'s embedded
  config). Reading the embedded config out of a `.rec` is a possible later convenience, not in scope.
- **No camera metadata from trodes** — verified the cameraModule/config carry only camera name +
  runtime resolution; `meters_per_pixel`, manufacturer, model, and coordinates are experimenter
  calibration in no trodes config. Cameras stay manual; the importer does not touch them.
- Not the broader Tasks & Files fix plan (separate: `.claude/docs/plans/tasks-files-ux-fixes/`).

### Dependency policy

No new dependencies. XML parsing uses the browser-native `DOMParser` behind the pure parser module.

## Metrics

- `npx vitest run baselines` byte-identical at every phase boundary.
- Importing a real `.trodesconf` yields electrode groups whose ntrode count + per-ntrode channel counts
  exactly match the config; a synthetic `.rec` header with the same config passes trodes_to_nwb's
  `validate_yaml_header` `len(map)` check (asserted via the contract fixture, not a live conversion).
- After import + the user setting `device_type`/`location`, the day exports with **zero** new validation
  errors attributable to structure.

## Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| The channel-`map` contract is misimplemented → silent data corruption. | The map is **not** authored by the importer — `device_type` generates it as today; the importer only sets structure (counts/ids/grouping). The count↔`device_type` consistency is pinned by [shared-contracts §2](shared-contracts.md#2-channel-map-contract) against `deviceTypes.js` + a golden YAML + a synthetic `.rec`-header fixture mirroring trodes_to_nwb's `len(map)` check. Byte-identity baselines gate every phase. |
| Multi-shank probes: one electrode group spans several ntrodes, but the config is a flat ntrode list. | Default grouping is **1 ntrode → 1 electrode group** (correct for tetrodes, the corpus-dominant case). Multi-shank grouping is established when the user picks the probe `device_type` (which knows shank count); the importer flags a count mismatch rather than guessing the grouping. |
| Re-import wipes semantics the user painstakingly entered. | P2 marks structurally-unchanged ntrodes (same `ntrode_id` + channel count) and P3 carries their `device_type`/`location`/coords forward into the new version (decision #4); only new/changed groups are blank. |
| Adding `dioInventory` breaks loading old saves. | It is **additive-optional**, read via a defensive selector (default `[]`); P3 adds a test that a current-version blob without the field loads unchanged. See Persistence invariant. |
| Malformed / partial / MCU-vs-ECU configs crash the parser. | The parser is total: it surfaces a structured parse error (never throws to the UI), tolerates MCU-only (`MCU_Din*`) vs ECU (`Din*`) digital ids, and missing camera/DIO sections. |

## Rollout Strategy

No feature flag. New, additive import path; merges to `modern` per the per-phase workflow (branch off
`modern` → TDD → full gate → `code-reviewer` → `git merge --ff-only`, not pushed unless asked).

**Persistence invariant:** `dioInventory` is an **optional** field on `ConfigurationSnapshot`, read
defensively (absent → `[]`). Per the project's migration discipline, a *shape* change pairs with a
`WORKSPACE_SCHEMA_VERSION` bump + migrator + `vN` fixture; an absent-tolerant optional addition does
**not** require a bump. P3 verifies which applies against the load/shape-ensure path
([persistence.ts](../../../../src/state/persistence.ts) + `workspaceMigrations.ts`): if the
shape-ensure backfills or the field participates in normalize/diff, bump + migrator + fixture; if purely
absent-tolerant, no bump, plus a regression test that a v3 blob loads unchanged. The decision is made in
P3 from the code, not assumed here.

## Open Questions

1. **Exact `map`-generation entry point in the modern workspace.** `deviceTypes.js` holds
   `deviceTypeMap`/`getShankCount`; the modern equivalent of the legacy `nTrodeMapSelected` (which
   generates a group's `map` on `device_type` selection) is confirmed in P2/P4 from the code rather than
   cited here, since the importer reuses it unchanged (it only needs the per-`device_type` channel count
   for the conflict check).
2. **Where `dioInventory` lives** — on `ConfigurationSnapshot` (per-version; the board can change with a
   reconfig) is the default; P3 confirms it stays a sibling of `ProbeConfiguration` so `diffProbeConfigs`
   is untouched.
3. **Future: a second import source for behavioral-event *names*?** The `.trodesconf` has only raw
   `Din*`/`Dout*` ids. The lab's **RewardGui/FSGui** protocol configs (e.g. `trodes/Modules/RewardGui/
   rewardconfig`) map *wells* → input/output DIO bits (well 0 → `inputBit 0` poke / `outputBit 2`
   reward), i.e. the semantic poke/reward→channel mapping. A separate "import RewardGui/FSGui config"
   path could seed `behavioral_events` with conventional names — but those configs aren't embedded in
   the `.rec`, names are conventional not literal, and save-habits vary. **Out of scope here; revisit if
   labs reliably keep these configs.** (`fs_gui_yamls` already references FSGui protocol files per epoch.)

## Estimated Effort

Medium, front-loaded into P1–P2 (pure logic + tests). Rough sizing: P1 ~150 LOC + fixtures, P2 ~200 LOC
(candidate builder + plan, reusing `diffProbeConfigs`), P3 ~120 LOC (apply wiring + field + persistence
test), P4 ~250 LOC (upload + entry points + preview UI), P5 ~80 LOC (day DIO picker). No phase is large;
P4 is the biggest (UI).
