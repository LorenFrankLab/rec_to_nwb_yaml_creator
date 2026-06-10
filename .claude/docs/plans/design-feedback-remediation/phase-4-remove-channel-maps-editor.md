# Phase 4 — Remove the workspace channel-maps editor (F1)

[← back to PLAN.md](PLAN.md) · [overview](overview.md)

No one uses the manual channel-maps editor. Remove the workspace **editing** surface (tab + route + nav
entry + editor + container) while **preserving** the auto-generated maps and the export — the exported
`ntrode_electrode_group_channel_map` is required and is produced independently of the editor. The reference
graph is wider than the three obvious components, so the phase **starts with a sweep** to avoid a red build.

**Inputs to read first:**

- **Run first:** `grep -rln "ChannelMapEditor\|ChannelMapsStep\|ChannelMapsContainer\|'channel-maps'\|csvChannelMapUtils" src` — this is the authoritative removal worklist (~30 files; triage each below).
- `src/hooks/useHashRouter.js:23` — registers the `'channel-maps'` route (+ its test).
- `src/pages/AnimalWorkspace/RecordingDaysTab.jsx:60` — a setup-tab nav entry `{ key: 'channel-maps', label: 'Channel Maps' }`.
- `src/pages/AnimalView/index.jsx` (~`:59/:85/:116/:186`) — the tab list / `TAB_FIELD_ANCHOR` / route case.
- `src/pages/AnimalEditor/ChannelMapEditor.jsx`, `ChannelMapsStep.jsx`, `wiring/ChannelMapsContainer.jsx`, `src/utils/csvChannelMapUtils.js` (imported **only** by the container — verify, then delete) — the components to delete (+ co-located `.scss`/tests).
- `src/__tests__/integration/axe-a11y.test.jsx` and `src/__tests__/integration/migrated-dialogs-modal-a11y.test.jsx` — both `import ChannelMapEditor` directly; they **fail to compile** on deletion and must be updated.
- `src/domain/sectionStatus.js`, `src/domain/badChannels.js`, `src/domain/validation.js` — reference channel-map *concepts*; **triage carefully**: the auto-generated `ntrode_electrode_group_channel_map` and bad-channel logic are **preserved**; only editor-UI references are removed.
- `src/utils/channelMapUtils.js:51` `generateChannelMapsForGroup` (invoked from `ElectrodeGroupsContainer.handleSaveGroup` ~`:186`) — **preserve**; this produces the exported maps.
- `src/state/workspaceUtils.js:192` `resolveDayConfig` / `:324` `mergeDayMetadata` — **preserve**; export byte-identical.

**Contracts referenced:**

- [C1 — YAML byte-identity](shared-contracts.md#c1) — the exported maps must be unchanged; baselines byte-identical.

## Tasks

- **Task #1 — sweep.** Run the grep above; classify every hit as *delete* (editor UI), *update* (router/nav/tests that reference the editor), or *preserve* (auto-gen map / bad-channels / export). Produce the worklist before editing.
- Delete `ChannelMapEditor.jsx`, `ChannelMapsStep.jsx`, `wiring/ChannelMapsContainer.jsx` + co-located `.scss`/`__tests__`. If `csvChannelMapUtils.js` is used only by the container (verify), delete it + its tests.
- Remove the `'channel-maps'` **route** (`useHashRouter.js:23` + its test), the **nav entry** (`RecordingDaysTab.jsx:60`), and the **AnimalView tab** (list + `TAB_FIELD_ANCHOR` + route case) + any tab-count reference.
- Update `axe-a11y.test.jsx` and `migrated-dialogs-modal-a11y.test.jsx` to drop the `ChannelMapEditor` import/render (they currently fail to compile otherwise).
- **Preserve** map auto-generation and export: verify `ElectrodeGroupsContainer.handleSaveGroup` still calls `generateChannelMapsForGroup` and persists `ntrode_electrode_group_channel_map`; do **not** touch `channelMapUtils.js`, `resolveDayConfig`, `mergeDayMetadata`, or the bad-channel (`badChannels.js`/`badChannelMonotonicity`) logic.
- Add a **read-only reassurance** on the electrode-groups surface (`ElectrodeGroupsContainer` / the AnimalView electrode-groups tab): "Channel maps are generated automatically from each electrode group's device type." Token-styled; no editing affordance.
- **Do NOT remove** the legacy `src/ntrode/ChannelMap.jsx` — frozen path.
- Documentation: mark Post-v3 #9 (+ the ChannelMapEditor empty-state heading inconsistency) **resolved** in `docs/POST_V3_FOLLOWUPS.md`; CHANGELOG entry.

## Deliberately not in this phase

- Removing/altering the legacy `ntrode/ChannelMap.jsx` or any legacy form code — frozen.
- Any change to map generation, `resolveDayConfig`, `mergeDayMetadata`, the exported YAML, or bad-channel marking.

## Validation slice

| Test | Asserts |
| --- | --- |
| **Definition of done:** `npx vitest run` + `npm run lint` | both **green with zero dangling references** to the deleted modules/route/tab (the explicit gate for the sweep). |
| `npx vitest run baselines` | byte-identical — `ntrode_electrode_group_channel_map` unchanged for all fixtures. |
| existing electrode-group / channel-map generation tests | a device-type selection still generates the correct identity maps. |
| `AnimalView` / router / `RecordingDaysTab` tests (updated) | no `channel-maps` tab, route, or nav entry is reachable; other tabs/routes unaffected. |
| `axe-a11y.test.jsx` (updated) | passes without the `ChannelMapEditor` import. |
| e2e | the animal view shows no channel-maps tab; electrode-groups shows the reassurance line. |

## Fixtures

Existing golden fixtures (all identity maps) are the regression guard. No new fixtures.

## Review

Before opening the PR, dispatch `code-reviewer` against the diff. Confirm:
- The sweep was done; **zero dangling references** (lint + full suite green); router, nav entry, AnimalView tab, and both a11y integration tests are all handled — not just the three components.
- Auto-generation + export intact (baselines byte-identical; generation test passes); legacy `ntrode/ChannelMap.jsx` untouched.
- Reassurance line present; `docs/POST_V3_FOLLOWUPS.md` #9 marked resolved; names don't reference this plan; CHANGELOG updated.
