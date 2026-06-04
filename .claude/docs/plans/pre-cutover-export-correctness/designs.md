# Designs

[← back to PLAN.md](PLAN.md)

Algorithmic detail too large for a phase's Tasks block. Phase files reference these by anchor.

- [Device-resolution model](#device-resolution-model) — phase 2 (Finding A). **Decided: model B.**
- [Day bad-channel merge](#day-bad-channel-merge) — phase 2 (Finding B). Unambiguous.
- [Channel-map semantics](#channel-map-semantics) — phases 2, 6. Logical keys vs. probe-electrode-id values.

---

## Device-resolution model

**Problem (Finding A).** `animal.devices` is what the Animal Editor edits, but the export resolves
probes from `configurationHistory` snapshots (`resolveDayConfig`, `src/state/workspaceUtils.js:60-110`).
`createAnimal` seeds `configurationHistory[0].devices` empty (`useWorkspace.js:164`), and
`updateAnimal({devices})` never updates any snapshot (`:206-208`). So configuring probes after creating
the animal leaves the snapshot empty, and days created on it export **empty** `electrode_groups`.

**Decision: model B — snapshots are the source of truth; the day pins a version; reconfiguration forks
before editing.** (Confirmed: mid-study reconfiguration is rare because the probe is implanted, so a
clean per-version pin beats a live-diff workflow. A recording day's probe geometry is a physical fact
fixed at record time — pinning matches the science.)

### The model

- **Source of truth = `configurationHistory[version].devices`** (frozen per-version snapshots).
  `resolveDayConfig` reads the snapshot the day is pinned to — **never live `animal.devices` directly** and
  **never silently falls back** to a different version when the pinned version is missing. A missing pin is
  persisted-state corruption and must fail closed.
- **`animal.devices` is a mirror of the *latest* version's snapshot.** It is the Animal Editor's working
  surface. `updateAnimal({ devices })` writes **both** `animal.devices` **and**
  `configurationHistory[latest].devices`, keeping them in sync. *This is the new behavior that fixes the
  P0:* configuring probes now flows into version 1's snapshot, so days pinned to it export the probes.
- **`createDay`** pins `day.configurationVersion = animal.configurationHistory.length` (the latest
  version) — already its behavior (`useWorkspace.js:410-433`); now that version actually holds the config.
- **Reconfiguration is fork-before-edit** (the explicit freeze the High-severity review finding asked
  for). The wizard's "Reconfigure from day X" action, run **before** the user edits the new geometry:
  1. `addConfigurationSnapshot(animal.id, { devices: clone(latest snapshot), … })` → a new version N+1
     that starts **identical** to the current config (returns N+1 — the v3-plan return-value contract).
  2. `applyConfigurationForward(animal.id, N+1, [day X … end])` → repoints the chosen days to N+1.
  3. Set `animal.devices` to mirror version N+1 (the new latest).

  Now days **before** X stay pinned to version N (its snapshot frozen with the *old* config), and days
  **X…end** are on N+1. When the user then edits geometry in the Animal Editor, `updateAnimal` writes
  `animal.devices` + the N+1 snapshot (the latest) — so **only** the post-fork days change; earlier days
  keep the old config **by construction**, with no diff and no lost configuration.

### Why this resolves the tension the original draft missed

The earlier draft (resolve latest from live + freeze *on commit*) lost the old config because the Animal
Editor writes live devices immediately while days point at the latest version
(`AnimalEditorStepper.jsx:263`, `useWorkspace.js:433`). Model B removes the tension: editing never
silently rewrites a *historical* day's config because historical days are pinned to **earlier** frozen
versions, and the fork that creates a new latest version happens **before** the geometry edit. No
copy-on-write-per-keystroke and no draft layer — the fork is the single, explicit freeze point.

### Reconfiguration wizard reshaping

The Phase-10.5 wizard currently reads already-edited `animal.devices` as `nextConfig` and renders a
live-vs-snapshot diff. Under model B that diff is dropped (your call: "apply the current configuration to
days X–Y" with no diff). The wizard becomes a **fork-point selector**: pick the boundary day + the day
range, confirm, fork (steps 1–3 above); geometry is then edited in the Animal Editor against the new
latest version. Keep the existing `addConfigurationSnapshot` / `applyConfigurationForward` actions and
the returned-version contract; only the wizard's call order and its UI change. Keep
`reconfigWorkflow.integration.test.js` / `ReconfigWizard.test.jsx` green, updated to the model.

### What phase 2 must prove

- `create animal → configure probes → create day → export` (no reconfiguration) exports the configured
  `electrode_groups` and ntrode map. **Direct P0-A reproduction.**
- After a fork-before-edit reconfiguration, earlier days keep the old (frozen) config and later days get
  the new one; `reconfigWorkflow` integration stays green.
- `resolveDayConfig` never mutates a snapshot or `animal.devices`; the mirror write goes through
  `updateAnimal` with `structuredClone`.

---

## Day bad-channel merge

**Problem (Finding B).** `DevicesStep` writes day-level bad channels to
`day.deviceOverrides.bad_channels.{ntrode_id}` (`src/pages/DayEditor/DevicesStep.jsx:137`), but
`resolveDayConfig` never reads that key, so the exported ntrode map keeps the snapshot's `bad_channels`
and loses the day edits. (`computeDevicesStatus` *does* read `deviceOverrides.bad_channels` at
`validation.js:121,138`, so the step status and the export currently disagree — another reason to fix it.)

**Fix.** After resolving the ntrode list (per the device-resolution model), apply day bad-channel
overrides onto each ntrode's `bad_channels`. The override map is keyed by `ntrode_id`; a present entry
**replaces** that ntrode's `bad_channels` (the DevicesStep editor manages the full per-ntrode array).
Clone so the snapshot is never mutated.

```js
// Inside resolveDayConfig, after `ntrodes` is selected and before returning.
const overrides = day.deviceOverrides?.bad_channels; // { [ntrode_id]: number[] } | undefined
const ntrodesWithBadChannels = overrides
  ? ntrodes.map((n) =>
      Object.hasOwn(overrides, String(n.ntrode_id))
        ? { ...n, bad_channels: [...overrides[String(n.ntrode_id)]] }
        : n
    )
  : ntrodes;
return { electrode_groups: groups, ntrode_electrode_group_channel_map: ntrodesWithBadChannels };
```

**Key type:** override keys are object keys (strings); `n.ntrode_id` becomes an integer in phase 4.
Normalize with `String(n.ntrode_id)` (above) so the lookup survives the integer-ID change; add a test
with an integer `ntrode_id` against a string-keyed override map.

**UI must edit the effective list (Finding: bad-channel UI source).** `DevicesStep` currently renders
live `animal.devices` (`DevicesStep.jsx:34`), so on a *historical* day it would edit bad channels against
the wrong ntrode list. Phase 2 makes `DevicesStep` render `resolveDayConfig(animal, day)` (the effective,
pinned config) so the editor and the export agree.

**Converter caveat for multi-ntrode groups.** Current `trodes_to_nwb` `add_electrode_groups` finds only the
first `ntrode_electrode_group_channel_map` entry for an electrode group, then uses that entry's `ntrode_id`
and `bad_channels` while iterating all probe electrodes. That means per-ntrode bad-channel arrays for a
multi-shank probe group may be ignored downstream. Phase 2 must either coordinate a converter fix before
claiming multi-ntrode bad-channel correctness, or explicitly constrain app-side bad-channel guarantees to
single-ntrode electrode groups and prove the multi-shank case in the mandatory round-trip before merge.

---

## Channel-map semantics

Referenced by phases 4 and 6. **Corrected against trodes_to_nwb source + the legacy golden fixture** (an
earlier draft had this wrong — it claimed map values were global hardware channels; they are not).

Each ntrode `map` is `{ logical_position_key : probe_electrode_id_value }`:

- **Keys = logical position** within the ntrode/shank, `0 … (channels_in_this_ntrode - 1)` (local).
  Existing Rule 5 (`rulesValidation.js:122-148`) checks keys are sequential from 0.
- **Values = electrode IDs *within the probe*** (the `device_type`'s bundled probe metadata), **reset per
  electrode group**. The real `.rec` hardware channel comes from the XML header, **not** the YAML
  (`trodes_to_nwb` `convert_rec_header.py:178`); the YAML value is matched to a probe electrode id
  (`convert_yaml.py:273`). **Proof:** the legacy golden `20230622_sample_metadata.yml` maps *every*
  tetrode group `{0:0,1:1,2:2,3:3}` — separate groups reset to `0..3`, they do **not** increment globally.
  So a second standalone tetrode with `{0:4,1:5,2:6,3:7}` is **invalid**; tetrode probe metadata only has
  electrode ids `0..3`. (The `workspace-export.realistic.yml` `4..7` is a *bug* in a new-path fixture, not
  evidence of validity.)
  - **Single-shank device:** values are `0 … getChannelCount(device_type) - 1` (e.g. tetrode `0..3`).
  - **Multi-shank device:** the probe's electrode ids `0 … getChannelCount-1` are **partitioned across
    shanks** — each shank's ntrode covers a contiguous block. A 128-channel 4-shank probe → four ntrodes
    with values `0..31`, `32..63`, `64..95`, `96..127` (legacy `20230622_sample_metadataProbeReconfig.yml`).
    `deviceTypeMap(device_type)` returns the **per-shank** list (e.g. `0..31` for the 128ch), and
    `getShankCount` the shank count — so the per-shank offset is `shankIndex * deviceTypeMap.length`.
- **`bad_channels` = local electrode indices**, `0 … getChannelCount(device_type) - 1` (the
  `ChannelMapEditor` grid is built from `deviceTypeMap`). trodes_to_nwb tests membership against the
  probe-local 0-based electrode index (`electrode_counter_probe in bad_channels`) and **silently ignores**
  out-of-range values, so bounding them in-app is the only protection. See the converter caveat above:
  until `trodes_to_nwb` handles multiple channel-map rows per electrode group for `bad_channels`, the
  round-trip must prove any multi-shank bad-channel behavior the UI claims.

**Therefore the sound channel rules (phase 6) are:** (a) each ntrode's map **values** are integers in
`[0, getChannelCount(device_type))`; (b) within an electrode **group**, the ntrodes' values **partition**
`0 … getChannelCount-1` (unique, complete — catches the missing per-shank offset and cross-shank
collisions); (c) map **keys** are `0 … (ntrode channel count − 1)`; (d) `bad_channels` indices are in
`[0, getChannelCount(device_type))`. The existing within-ntrode value-uniqueness rule stays.

### Multi-shank per-shank offset (generator fix — phase 4)

`generateChannelMapsForGroup` (`src/utils/channelMapUtils.js:61-76`) builds an **identical** map for every
shank (`channels.reduce((acc, channelNum, idx) => (acc[idx]=channelNum)`), so a 4-shank probe emits
`0..31` four times instead of `0..31, 32..63, 64..95, 96..127`. Mirror the legacy hook
(`useElectrodeGroups.js:81`, which offsets by shank): shank `i`'s value for local key `idx` is
`i * deviceTypeMap(device_type).length + deviceTypeMap(device_type)[idx]`. Add a fixture test for a
128-channel 4-shank probe asserting the four expected blocks.
