# Phase 8 — Probe reconfiguration wizard

[← back to overview](overview.md) · [shared contracts](shared-contracts.md)

Detect and apply mid-experiment device/electrode reconfigurations across recording
days. When a probe is lowered, an electrode group is added/removed, or a channel map
changes part-way through a study, this phase lets the user (a) see a structured diff of
what changed between two days' effective device configs, and (b) version that change as a
new `ConfigurationSnapshot` and apply it forward to the affected days — without disturbing
days that did not change.

This phase only **diffs and versions** existing device configuration. It does **not** edit
electrode geometry or channel maps (the Animal Editor already owns that — see
[`ElectrodeGroupsStep.jsx`](../../../../src/pages/AnimalEditor/ElectrodeGroupsStep.jsx),
[`ChannelMapsStep.jsx`](../../../../src/pages/AnimalEditor/ChannelMapsStep.jsx)).

**Inputs to read first:**

- [src/state/workspaceUtils.js:34-103](../../../../src/state/workspaceUtils.js) —
  `mergeDayMetadata(animal, day)`. **Establishes where device config "lives" for a day.**
  Note the three sources and their precedence (`:66-72`):
  day `deviceOverrides.electrode_groups` / `ntrode_electrode_group_channel_map` >
  the snapshot picked by `day.configurationVersion` (`:37-39`) > animal defaults. The
  snapshot lookup (`:37-39`) matches `c.version === day.configurationVersion`, else falls
  back to the **last** snapshot, else the first. **The wizard's "effective config" for a
  day must use exactly this resolution** — do not re-derive it differently.
- [src/state/workspaceTypes.js:180-200](../../../../src/state/workspaceTypes.js) —
  `ConfigurationSnapshot { version, date, description, devices, appliedToDays }` and
  `ProbeConfiguration { electrode_groups, ntrode_electrode_group_channel_map }`. The
  snapshot's `devices` is a `ProbeConfiguration` (electrode groups + channel map only — no
  cameras / data_acq_device). [`:225`](../../../../src/state/workspaceTypes.js) —
  `Day.configurationVersion` links to a snapshot version; [`:221`,
  `:304-313`](../../../../src/state/workspaceTypes.js) — `Day.deviceOverrides`.
- [src/state/store.js:305-334](../../../../src/state/store.js) —
  `addConfigurationSnapshot(animalId, config)`. Pushes a new snapshot with
  `version = configurationHistory.length + 1`, `appliedToDays: []`, and `config.devices`
  used verbatim. **Versions are sequential and 1-based.**
- [src/state/store.js:344-405](../../../../src/state/store.js) — `createDay`; note
  `configurationVersion: animal.configurationHistory.length` (`:387`) — new days default to
  the **latest** snapshot version at creation time.
- [src/state/store.js:414-460](../../../../src/state/store.js) — `updateDay`. **Verify:** it
  currently merges `session`, `tasks`, `behavioral_events`, `associated_files`,
  `associated_video_files`, `technical`, `deviceOverrides`, `state` — but **does not handle
  `configurationVersion`**. This phase adds that branch.
- [src/state/store.js:194-205](../../../../src/state/store.js) — `createAnimal` seeds
  `configurationHistory[0]` (version 1, `appliedToDays: []`). Confirms `appliedToDays` is
  **never maintained today** (it is initialized to `[]` in three places and never updated:
  [`:203`](../../../../src/state/store.js), [`:319`](../../../../src/state/store.js)).
  This phase makes it authoritative.
- [src/pages/DayEditor/DevicesStep.jsx:27-47](../../../../src/pages/DayEditor/DevicesStep.jsx)
  — the day's device view. **Reads `animal.devices.electrode_groups` directly** (`:28`,
  `:32`), i.e. the live editable config, **not** the day's resolved snapshot. This is the
  surface where the wizard entry point and version legibility belong.
- [docs/TASKS.md:892-905](../../../../docs/TASKS.md) — M11 acceptance: device-structure diffs
  detected & applied; snapshot history updates; tests simulate a multi-day workflow.

**Contracts referenced:**

- [Workspace data model & store actions](shared-contracts.md#workspace-data-model--store-actions)
  — all snapshot/day mutation goes **only** through `addConfigurationSnapshot` and
  `updateDay` with `setWorkspace(prev => …)` + `structuredClone` immutability. Do not mutate
  `configurationHistory`, `appliedToDays`, or `configurationVersion` outside store actions.
- [`mergeDayMetadata` contract](shared-contracts.md#mergedaymetadata-contract) — the wizard's
  notion of a day's "effective config" derives from the same snapshot-selection logic; the
  parity invariant (`encodeYaml(mergeDayMetadata(...))` byte-identical) must hold after any
  version reassignment.
- [YAML parity / shadow-export contract](shared-contracts.md#yaml-parity--shadow-export-contract)
  — golden baselines stay byte-identical; reassigning `configurationVersion` for a day must
  not change its merged output unless the snapshot it resolves to actually differs.

## Tasks

- **Add a pure config-diff utility.** New module
  `src/state/configDiff.js` (co-located with the other workspace state utilities). Export
  `diffProbeConfigs(prevConfig, nextConfig)` where each argument is a `ProbeConfiguration`
  (`{ electrode_groups, ntrode_electrode_group_channel_map }`). Returns a structured,
  serializable result, e.g.:
  ```
  {
    electrodeGroups: {
      added:   ElectrodeGroup[],          // groups in next not in prev (by id)
      removed: ElectrodeGroup[],          // groups in prev not in next (by id)
      changed: Array<{ id, fields: string[], before, after }>, // same id, differing fields
    },
    channelMaps: {
      added:   NtrodeMap[],               // ntrode_id present only in next
      removed: NtrodeMap[],               // ntrode_id present only in prev
      changed: Array<{ ntrode_id, electrode_group_id,
                       mapChanged: boolean, badChannelsChanged: boolean,
                       before, after }>,
    },
    hasChanges: boolean,                  // true iff any add/remove/change is non-empty
  }
  ```
  Match electrode groups by `id` and ntrodes by `ntrode_id`. Detect `map` changes via deep
  equality on the `map` object, `bad_channels` via array-as-set comparison. The function must
  be pure (no store access), order-independent for matching, and stable (sort outputs by
  id / ntrode_id) so the diff renders deterministically. Add a sibling
  `resolveDayConfig(animal, day)` helper (or reuse the merge module) that returns the day's
  **effective** `ProbeConfiguration` using the *same* snapshot-selection rule as
  `mergeDayMetadata` (`workspaceUtils.js:37-39`) plus `deviceOverrides` precedence
  (`:66-72`) — factor the selection out of `mergeDayMetadata` into a shared helper rather
  than duplicating it, and have `mergeDayMetadata` call it, so the two cannot drift.

- **Extend `updateDay` to accept `configurationVersion`.** In
  [src/state/store.js:414-460](../../../../src/state/store.js), add a branch:
  `if (updates.configurationVersion !== undefined) { updated.configurationVersion = updates.configurationVersion; }`
  following the existing immutability pattern. (Verify the absence of this branch before
  editing.)

- **Add an `applyConfigurationForward` store action.** New action in `workspaceActions`
  (`src/state/store.js`), signature
  `applyConfigurationForward(animalId, snapshotVersion, dayIds)`. In a single
  `setWorkspace(prev => …)` with `structuredClone` of the affected animal + days, it must:
  (1) set each listed day's `configurationVersion` to `snapshotVersion`;
  (2) add those day ids to the target snapshot's `appliedToDays` (dedup);
  (3) remove those day ids from **every other** snapshot's `appliedToDays`, so
  `appliedToDays` is a partition (each day appears in at most one snapshot's list);
  (4) update `lastModified` timestamps. Throw on unknown `animalId` or unknown
  `snapshotVersion`, consistent with the existing actions. This is the single mutation the
  wizard's "apply forward" calls — it does **not** create the snapshot (the wizard calls
  `addConfigurationSnapshot` first, then `applyConfigurationForward` with the new version).
  Keeping creation and assignment separate mirrors the existing action granularity and keeps
  each action's `setWorkspace` self-contained.

- **Backfill `appliedToDays` reconciliation (optional but recommended).** Because today's
  `appliedToDays` is never maintained, add a pure helper
  `reconcileAppliedToDays(animal)` in `configDiff.js` (or a new `snapshotUtils.js`) that
  derives each snapshot's `appliedToDays` from the days' current `configurationVersion`
  values, used by the UI to render version usage without depending on stale stored lists.
  The wizard's legibility view should prefer this derived view as the source of truth, while
  `applyConfigurationForward` keeps the stored lists in sync going forward.

- **Build the reconfiguration wizard component.** New
  `src/pages/DayEditor/ReconfigWizard.jsx` (+ `.scss`), built on the shared `<Modal>`
  primitive ([contract](shared-contracts.md#modal-primitive-contract)). Props: `animal`,
  `day` (the day being reconfigured), `prevDay` (the chronologically previous day for this
  animal, or `null`), and the store actions. Flow:
  1. Compute `prevConfig = resolveDayConfig(animal, prevDay ?? <baseline>)` and
     `nextConfig = resolveDayConfig(animal, day)` (or, when the user is declaring a new
     change, the current `animal.devices` probe config as `nextConfig`). Run
     `diffProbeConfigs(prevConfig, nextConfig)`.
  2. Render the structured diff: electrode groups added / removed / changed, and channel-map
     adds / removes / changes (map and bad-channel deltas). When `hasChanges` is false, show
     a clear "no configuration change detected" state and disable apply.
  3. "Apply forward": prompt for a snapshot `description` and effective `date`, call
     `addConfigurationSnapshot(animalId, { date, description, devices: nextConfig })`, then
     `applyConfigurationForward(animalId, newVersion, selectedDayIds)` where the default
     selected day ids are the chosen day **and all chronologically later days** for the
     animal (user may narrow the set via checkboxes).
  4. "Update animal baseline" (optional checkbox): when checked, also call
     `updateAnimal(animalId, { devices: { ...animal.devices, ...nextConfig } })` so the live
     editable animal config matches the newly versioned snapshot. Off by default.
  All confirmation/error UX uses the shared modal/alert primitives — **no `alert()` /
  `window.confirm()`** (Phase 3 removed those).

- **Surface version legibility in the day device view.** In
  [src/pages/DayEditor/DevicesStep.jsx](../../../../src/pages/DayEditor/DevicesStep.jsx), add
  a small, read-only "Configuration version" indicator showing which snapshot version this
  day uses (`day.configurationVersion`), the snapshot's `description`/`date`, and a button to
  open `ReconfigWizard`. Add a compact per-snapshot "applied to N days" summary (sourced from
  `reconcileAppliedToDays`) so the user can see which days share each version. This is the
  only change to `DevicesStep`'s behavior; its existing device-rendering path is untouched.

- **Tests for the diff utility, the store action, and the wizard** (see Validation slice).

## Deliberately not in this phase

- **Editing electrode geometry or channel maps.** The Animal Editor
  (`ElectrodeGroupsStep`, `ChannelMapsStep`, `ChannelMapEditor`) already owns config
  editing. This phase consumes the resulting config; it never mutates electrode/ntrode
  *contents*, only versions and assignments.
- **Validation summary / step-status wiring** — Phase 7. The wizard does not compute or
  display validation issues.
- **Export changes / shadow-export** — Phase 5. This phase must not touch the export path; it
  only relies on the existing parity invariant holding.
- **Optogenetics** — out of plan scope entirely.
- **Bad-channels editing** — `DevicesStep`'s existing `BadChannelsEditor` flow
  (`deviceOverrides.bad_channels`) is unchanged; the wizard reads bad-channel deltas for the
  diff but does not provide a bad-channel editor.
- **Auto-detecting reconfigurations on import or day creation.** The wizard is user-invoked;
  no background diffing pipeline.

## Validation slice

| Test | Asserts |
| --- | --- |
| `diffProbeConfigs: group added` | A group present only in `nextConfig` appears in `electrodeGroups.added`; `hasChanges === true`. |
| `diffProbeConfigs: group removed` | A group present only in `prevConfig` appears in `electrodeGroups.removed`. |
| `diffProbeConfigs: group changed` | Same `id`, differing `location`/`device_type` → one `electrodeGroups.changed` entry naming the differing `fields` with correct `before`/`after`. |
| `diffProbeConfigs: channel-map map change` | Same `ntrode_id`, differing `map` object → `channelMaps.changed` entry with `mapChanged: true`, `badChannelsChanged: false`. |
| `diffProbeConfigs: bad-channels change` | Differing `bad_channels` (set-wise) → `badChannelsChanged: true`. |
| `diffProbeConfigs: identical configs` | Identical inputs (any key order) → all add/remove/changed empty, `hasChanges === false`. |
| `diffProbeConfigs: deterministic ordering` | Same inputs in shuffled array order produce identical (sorted) output. |
| `resolveDayConfig: snapshot selection` | A day resolves to the snapshot matching `configurationVersion`; falls back to latest when version unmatched — matching `mergeDayMetadata` selection. |
| `resolveDayConfig: deviceOverrides precedence` | Day `deviceOverrides.electrode_groups` overrides the snapshot's groups. |
| `updateDay: configurationVersion` | `updateDay(dayId, { configurationVersion: 2 })` sets the field and bumps `lastModified`; other day fields untouched. |
| `applyConfigurationForward: reassigns versions` | After the action, each listed day's `configurationVersion === snapshotVersion`. |
| `applyConfigurationForward: appliedToDays partition` | Target snapshot's `appliedToDays` contains exactly the listed days; no day appears in two snapshots' lists. |
| `applyConfigurationForward: out-of-scope days unchanged` | Days not in `dayIds` keep their prior `configurationVersion`. |
| `applyConfigurationForward: throws on unknown version` | Unknown `snapshotVersion` (or `animalId`) throws, no state mutation. |
| `reconcileAppliedToDays` | Derives each snapshot's day list purely from days' `configurationVersion`, ignoring stale stored lists. |
| **(integration)** `multi-day reconfig workflow` | Synthesized animal: snapshot v1 applied to days 1–2, then wizard creates v2 and applies forward from day 3 → days 1–2 stay v1, days 3–4 become v2; `addConfigurationSnapshot` + `applyConfigurationForward` produce the expected `configurationHistory` and per-day versions. |
| **(integration)** `unchanged days export byte-identical` | For days whose resolved snapshot is unchanged by a reassignment, `encodeYaml(mergeDayMetadata(animal, day))` is byte-identical before vs after the wizard runs (no reflow). |
| **(integration)** `ReconfigWizard apply forward` | Rendering the wizard against the synthesized fixture, filling description/date, and confirming triggers `addConfigurationSnapshot` then `applyConfigurationForward` with the new version and the correct day ids; "no change" state disables apply. |
| `golden baselines` | `src/__tests__/baselines/golden-yaml.baseline.test.js` — all 4 fixtures byte-identical (run, do not modify). |

Mark the four rows above as integration tests (`describe('… [integration]')` or equivalent);
the rest are unit tests. All tests are Vitest.

## Fixtures

Add a test helper (e.g. `src/state/__tests__/fixtures/reconfigWorkspace.js`, or extend the
existing workspace fixture helpers if present) that synthesizes:

- One animal with **two** `ConfigurationSnapshot`s (v1 and v2) whose `devices` differ by a
  clear, asserted delta (e.g. v2 adds one electrode group and changes one ntrode `map`).
- **Four** days spanning the change: days 1–2 on `configurationVersion: 1`, days 3–4 on
  `configurationVersion: 2`, with valid `session` / `technical` data so `mergeDayMetadata`
  produces encodable output.
- A factory that returns a fresh deep clone per call (no shared mutable state across tests).

Reuse this helper across the unit and integration tests rather than rebuilding workspace
shapes inline. Do not check in new YAML golden files; the byte-identity assertions reuse the
existing golden fixtures and the synthesized workspace.

## Review

Follow the full gate in [review-protocol.md](review-protocol.md). Phase-specific:

- **Self-verify (§1):** run this phase's Validation slice + `npx vitest run` (no regressions; baseline 2747/1 skipped) + `npx vitest run baselines` (byte-identical, **not** regenerated). Emphasis: snapshot/day mutations go only through store actions with `structuredClone` immutability; `appliedToDays` stays a partition with no shared-reference leaks; config-selection logic is one shared helper used by both `mergeDayMetadata` and `resolveDayConfig` (no rule that can drift).
- **Playwright UI (§2):** trigger the wizard, confirm the config diff renders, apply-forward, and confirm later days adopt the new snapshot version while unchanged days still export byte-identical. No `alert()`/`window.confirm()` introduced — modal/alert primitives only. 0 console errors.
- **Reviewers:** `pr-review-toolkit:code-reviewer` (always), plus `pr-test-analyzer`, `type-design-analyzer` (config snapshot/versioning shapes), and `ux-reviewer`.
- **Checklist (§6):** every task implemented; "Deliberately not in this phase" honored; tests non-trivial (diff classification, partition invariant, byte-identity — not mock echoes); no plan/phase/milestone strings in code/test/module names or docstrings; old code flagged for removal is removed; user-facing docs updated.
