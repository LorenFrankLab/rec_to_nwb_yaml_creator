# Overview — Scope, integration, invariants, risks

[← back to PLAN.md](PLAN.md)

## Current codebase integration points

The importer adds pure modules + UI, **modifies the channel-map regeneration path** so imported
`ntrode_id`s survive `device_type` completion, and adds **two** optional off-export persisted snapshot
fields: `trodesImport` (the channel counts the completion needs — defined in Phase 3) and `dioInventory`
(defined in Phase 4).

- [src/state/workspaceTypes.ts:181-208,299-322](../../../../src/state/workspaceTypes.ts) —
  `ElectrodeGroup`, `NtrodeMap` (`ntrode_id, electrode_group_id, map, bad_channels`), `ProbeConfiguration`,
  `ConfigurationSnapshot`. Phase 4 adds optional `dioInventory` to `ConfigurationSnapshot`.
- [src/pages/AnimalEditor/wiring/ElectrodeGroupsContainer.tsx:158-186](../../../../src/pages/AnimalEditor/wiring/ElectrodeGroupsContainer.tsx)
  — **the renumbering path (must-fix #1).** On a `device_type` change it removes the group's maps and
  regenerates with `generateChannelMapsForGroup(group, nextNtrodeId(retainedMaps))` — new ids. Phase 3
  branches **import-backed** groups (permanent property) to the id-preserving fill instead.
- [src/utils/channelMapUtils.ts:62-92](../../../../src/utils/channelMapUtils.ts) —
  `generateChannelMapsForGroup(group, startingNtrodeId)`: one ntrode **per shank** from
  `getProbeShanks`, ids `startingNtrodeId..`, map values = each shank's `electrodeIds`. The non-imported
  path (unchanged); Phase 3's fill mirrors its value-generation but writes into existing rows.
- [src/utils/deviceTypeUtils.ts:43-70](../../../../src/utils/deviceTypeUtils.ts) — `getChannelCount`
  (total electrode ids across shanks) and `getProbeShanks` (per-shank electrode-id partition). **Use
  these**, not `deviceTypeMap.length` (first-shank only — smaller-correction #1).
- [src/ntrode/deviceTypes.ts](../../../../src/ntrode/deviceTypes.ts) +
  [src/ntrode/probeCatalog.ts](../../../../src/ntrode/probeCatalog.ts) — the device_type catalog (TS, not
  the legacy `.js`).
- [src/state/workspaceActions.ts:266-319](../../../../src/state/workspaceActions.ts) —
  `createConfigurationSnapshotAndApplyForward(animalId, config, dayIds)`: the atomic apply hook (Phase 4).
  Bad channels are day-owned and reset on a version bump by this path.
- [src/state/workspaceActions.ts:140-160](../../../../src/state/workspaceActions.ts) — the create-animal
  config-seed path (Phase 4 seeds config v1 here).
- [src/state/workspaceTransitions.ts:74-80](../../../../src/state/workspaceTransitions.ts) —
  `ConfigSnapshotInput = {date, description, devices}` (devices is a `Record`). Adding `dioInventory`
  requires extending this type **and** the snapshot-building transition path, not just the type
  (smaller-correction #2).
- [src/state/configDiff.ts:79](../../../../src/state/configDiff.ts) — `diffProbeConfigs(prev, next):
  ProbeConfigDiff` (pure). **It is not rendered anywhere** — `ReconfigWizard` explicitly has *no*
  diff (it's a fork-point confirmation; [ReconfigWizard.tsx:56-58](../../../../src/pages/DayEditor/ReconfigWizard.tsx)).
  Phase 5 builds a **new** preview component over this pure fn (must-fix #5).
- [src/features/importYaml.ts:36](../../../../src/features/importYaml.ts) — the real file-text read
  pattern (a `<input type=file>` + `await file.text()`) to follow. **Not** `src/element/FileUpload.jsx` —
  it captures only the file *name* and blocks reading contents (must-fix #4).
- [src/pages/Home/CreateAnimalWizard.tsx](../../../../src/pages/Home/CreateAnimalWizard.tsx) +
  [src/pages/AnimalView/NewConfigurationModal.tsx](../../../../src/pages/AnimalView/NewConfigurationModal.tsx)
  — the create-time + re-import entry points (Phase 5).
- [src/pages/DayEditor/BehavioralEventsDisplay.tsx:32-40](../../../../src/pages/DayEditor/BehavioralEventsDisplay.tsx)
  — the day DIO editor: presents the full `Din1…32`/`Dout1…32` range (`ECU_DIGITAL_CHANNELS=32`), user
  names channels. Phase 6 limits this to the reconciled imported inventory.
- [src/state/workspaceMigrations.ts:70-103](../../../../src/state/workspaceMigrations.ts) +
  [src/state/persistence.ts:16-20,188](../../../../src/state/persistence.ts) — `WORKSPACE_SCHEMA_VERSION`
  + migrator registry (**Phase 3** owns the persistence decision — it adds `trodesImport` first;
  Phase 4's `dioInventory` rides it).

## Scope and dependency policy

### Goals

- One action turns a `.trodesconf` into the animal's hardware configuration with **immutable, header-
  matching `ntrode_id`s** — guaranteeing trodes_to_nwb's `ntrode_id`/`len(map)` check
  ([shared-contracts §2](shared-contracts.md#2-channel-map-contract)) cannot fail.
- **Full multi-shank support (decision):** the user groups imported ntrodes into one electrode group and
  assigns a multi-shank `device_type`; the import-aware fill validates shank×channel and writes map
  values into the existing rows, ids preserved.
- Re-import is a diff that preserves the semantics already entered for structurally-unchanged groups.
- The imported DIO inventory **reconciles to the editor's Din/Dout index (decision)** and limits the day
  picker to present channels.

### Non-Goals

- **No change to exported YAML.** Golden baselines (`npx vitest run baselines`) stay byte-identical.
- **No `device_type`/`location`/coords inference** — left blank, validation drives.
- **No `hwChan`/refs in the YAML** — trodes_to_nwb reads them from the `.rec`.
- **No auto-created `behavioral_events`** — DIO inventory only constrains the channel picker.
- **No `.rec` parsing**, **no camera metadata** (verified: not in any trodes config — cameras stay manual).
- Not the separate Tasks & Files plan (`.claude/docs/plans/tasks-files-ux-fixes/`).

### Dependency policy

No new dependencies. XML via browser-native `DOMParser`; file read via `await file.text()`.

## Metrics

- `npx vitest run baselines` byte-identical at every phase boundary.
- After import **and** `device_type` completion, the YAML's `ntrode_id`s equal the parsed config's, and a
  synthetic `.rec`-header fixture mirroring trodes_to_nwb's `validate_metadata` passes (`ntrode_id`
  match + `len(map)`) — asserted in Phase 3, not via live conversion.
- A multi-shank probe (e.g. 4 ntrodes → one 128c group) completes with ids `1..4` preserved and 4
  shank maps.

## Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| `device_type` selection renumbers imported `ntrode_id`s (the bug that motivated the replan). | Phase 3 adds `fillImportedNtrodeMaps` (id-preserving) and branches `ElectrodeGroupsContainer` to it for **import-backed** groups (a permanent property — membership in `trodesImport.ntrodeChannelCounts`), on **every** device-type change incl. re-edits after completion; the generate/`nextNtrodeId` path is untouched for non-import-backed groups. Tested: first completion AND a later device-type change both leave ids unchanged. ([shared-contracts §3](shared-contracts.md#3-invariant)) |
| Multi-shank: `.trodesconf` doesn't say which ntrodes form one probe. | The user groups them in the Phase 5 UI; the fill validates `getProbeShanks(device_type).length === group's ntrode count` and per-shank channel counts, refusing (conflict) on mismatch rather than guessing. |
| DIO id schemes differ (`Din*` vs `MCU_Din*` vs `Controller_Din*`) and direction isn't always on `input`. | Stricter parse rule + `reconcileDioId` mapping ([shared-contracts §1](shared-contracts.md#1-parsedtrodesconfig), [§5](shared-contracts.md#5-dio-reconciliation)); unreconcilable ids are surfaced, not dropped. |
| `diffProbeConfigs` exists but nothing renders it. | Phase 5 budgets a new preview component over the pure fn (no assumed reuse). |
| `FileUpload.jsx` can't read contents. | Use a `<input type=file>` + `await file.text()` (the `importYaml.ts` pattern). |
| A new snapshot sibling breaks old saves / isn't threaded / lost on a fork. | Both siblings are additive-optional + defensively read (Phase 3 owns the persistence decision; `dioInventory` rides it); the snapshot transition is explicitly extended (not just the type) and **carries siblings forward on clone/copy forks** (pruned to present ntrode_ids) so reconfig doesn't shed the import-backed marker. |

## Rollout Strategy

No feature flag. Six phases, each merged to `modern` per the per-phase workflow (branch off `modern` →
TDD → full gate → `code-reviewer` → `git merge --ff-only`, not pushed unless asked). **Persistence
invariant:** both new snapshot siblings are optional + defensively read. **Phase 3 owns the
bump-vs-no-bump decision** (it adds `trodesImport` first) from the load/shape-ensure path
(absent-tolerant ⇒ no bump + a regression test; normalize-touching ⇒ bump + migrator + `vN` fixture per
the project rule); **Phase 4's `dioInventory` rides that same decision** (same additive-optional shape).

## Open Questions

1. **Import-backed tagging (RESOLVED).** A group is import-backed iff its ntrode rows have entries in
   the snapshot's off-export `trodesImport.ntrodeChannelCounts` — a **permanent** property, not a
   transient "incomplete" state. `ElectrodeGroupsContainer` branches such groups to the id-preserving
   fill on **every** device-type change (Phase 3). This is what closes the "second device-type edit
   renumbers" hole; do not regress it to a blank-`device_type`/empty-`map` check.
2. **`numChannels` mismatch is informational** — Trodes hardware capacity can exceed active spike
   ntrodes (smaller-correction #3); surfaced as `severity: 'info'`, never blocks import.
3. **Future: RewardGui/FSGui as a behavioral-event-name source.** `rewardconfig` maps wells → input/
   output DIO bits — the semantic naming `.trodesconf` lacks. Separate per-protocol config, not embedded
   in the `.rec`; out of scope, revisit if labs keep these.

## Estimated Effort

Medium-large; the new Phase 3 (completion + container wiring) is the riskiest. Rough sizing: P1 ~150 LOC
+ fixtures, P2 ~200, P3 ~180 (fill + branch + tests — the invariant), P4 ~120, P5 ~300 (upload + grouping
UI + new preview), P6 ~120 (id reconcile + picker).
