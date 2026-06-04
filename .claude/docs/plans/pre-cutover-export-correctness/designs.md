# Designs

[← back to PLAN.md](PLAN.md)

Algorithmic detail too large for a phase's Tasks block. Phase files reference these by anchor.

- [Device-resolution model](#device-resolution-model) — phase 2 (Finding A). **Decided: model B.**
- [Day bad-channel merge](#day-bad-channel-merge) — phase 2 (Finding B). Unambiguous.
- [Channel-map semantics](#channel-map-semantics) — phases 2, 6. Local keys vs. global hardware values.

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
  `resolveDayConfig` reads the snapshot the day is pinned to — **never live `animal.devices` directly.**
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

---

## Channel-map semantics

Referenced by phases 2 and 6. Establishes what is and isn't bounded, so validation rules don't flag valid
data (the High-severity review finding).

Each ntrode `map` is `{ logical_channel_key : physical_hardware_channel_value }`:

- **Keys = logical/local channels**, `0 … getChannelCount(device_type) - 1`. For `tetrode_12.5`,
  `getChannelCount` is 4, so keys are `0,1,2,3` — this is exactly `deviceTypeMap('tetrode_12.5')`
  (`src/ntrode/deviceTypes.js:7`). Existing Rule 5 (`rulesValidation.js:122-148`) checks keys are
  sequential from 0; the count can also be checked against `getChannelCount`.
- **Values = physical/global hardware channels** in the `.rec` acquisition space. They are **not** bounded
  by the device's local channel count: the second tetrode legitimately maps to hardware channels `4,5,6,7`
  and the third to `8…` (see `workspace-export.realistic.yml:181-195`). The app generally **cannot** bound
  the upper end (it depends on the rec file's total channel count, which is not in the YAML). Existing
  Rule 4 (`rulesValidation.js:91-117`) checks values are unique *within* an ntrode.
- **`bad_channels` = logical/local channel indices**, `0 … getChannelCount(device_type) - 1` (the
  `ChannelMapEditor` checkbox grid is built from `deviceTypeMap`, so these are local). These **are**
  app-boundable.

**Therefore (phase 6):** the only sound channel-bound rules are (a) `bad_channels` indices within
`[0, getChannelCount(device_type))`, and (b) optionally map-**key** cardinality/identity
(`Object.keys(map)` equals `0 … count-1`). **Do not** add a "map value within device channel count" rule —
it would flag valid global hardware channels. A "map values are non-negative integers" check is safe; a
cross-ntrode global-uniqueness check is possible but out of scope unless requested.
