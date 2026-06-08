# Phase 3-2 — Ephys tabs (Electrode Groups + Channel Maps) + unsaved-edit guard

[charter](phase-3-setup-tabs.md) · [overview](overview.md) · depends on [3-1](phase-3-1-extract-wiring.md)

Mount the two hardest-wired containers from 3-1 into their tabs, replacing the placeholder. These are the
ephys pair: versioned electrode identity (forks a config version) and routine channel/bad-channel editing
— **separate tabs** by decision. Because these are the first switchable modals under the section-nav, this
phase also lands the **unsaved-edit guard** (charter decision 2).

**Inputs to read first:**

- [charter → tab→content map + decision 2](phase-3-setup-tabs.md).
- [AnimalView/index.jsx:160-170](../../../../src/pages/AnimalView/index.jsx) — the `tab === 'days' ? … : placeholder` conditional to extend; [:27-46](../../../../src/pages/AnimalView/index.jsx) `SECTION_GROUPS`; [:73-79](../../../../src/pages/AnimalView/index.jsx) the panel-focus effect (keep it working for the new panels).
- `ElectrodeGroupsContainer` + `ChannelMapsContainer` from [3-1](phase-3-1-extract-wiring.md).
- [Modal.jsx](../../../../src/components/Modal.jsx) — `ConfirmDialog` reused for the unsaved guard.

## Tasks

- **Render the `electrode-groups` and `channel-maps` containers in `AnimalView`.** Extend the panel
  conditional ([AnimalView/index.jsx:160-170](../../../../src/pages/AnimalView/index.jsx)) so those two
  `:tab` values render their container instead of the placeholder. Keep the single `#main-content` and the
  `:tab`-change panel focus ([:73-79](../../../../src/pages/AnimalView/index.jsx)) intact.
- **Add the scope descriptors** under each tab name in the section-nav: electrode-groups → "Versioned
  identity — a change here forks a configuration version"; channel-maps → "Edit any time — map channels,
  mark bad channels". (Render under the nav-item name in `SECTION_GROUPS` rendering, or in the panel header
  — match where Phase 1 placed the nav-item label.)
- **Config-version legibility on electrode groups (Task 3.4, ephys slice).** Where the electrode-groups
  panel surfaces the active configuration version, show human-readable context ("Electrode configuration
  changed on [date] — days before use v1, after use v2") sourced from `getConfigHistory` rather than a bare
  "v2". (The validation/export-row slice of 3.4 lands in [3-5](phase-3-5-validation-export-tab.md).)
- **Unsaved-edit guard (charter decision 2).** When a `ChannelMapEditor` (or the `ElectrodeGroupModal`) has
  pending edits and the user activates another section-nav link, intercept the navigation and show a
  `ConfirmDialog` ("Discard unsaved changes?"). On confirm, allow the route change and drop the edit; on
  cancel, stay. The container exposes a "has pending edits" signal; `AnimalView` (which owns the nav)
  consults it before allowing a `:tab` change. Keyboard-accessible (the confirm traps focus per the
  existing `Modal`).

## Deliberately not in this phase

- **The other four setup tabs** (recording-system, cameras, dio, optogenetics) — [3-3](phase-3-3-catalog-tabs.md).
- **The AnimalView-level 3-field corruption banner** — [3-3](phase-3-3-catalog-tabs.md) (it stays in the stepper until then).
- **Subject/profile header + reconfig banner** — [3-4](phase-3-4-profile-context.md).
- **Repair `?field=` deep-link landing/highlight** on these tabs — [Phase 3a](phase-3a-repair-routing.md). Until then, repair links still target the legacy stepper.

## Validation slice

| Test | Asserts |
| --- | --- |
| `AnimalView` renders electrode-groups container | navigating to `#/animal/:id/electrode-groups` shows the groups table (not the placeholder); add/edit/delete + copy work via the container |
| `AnimalView` renders channel-maps container | `#/animal/:id/channel-maps` shows the channel-map view; opening `ChannelMapEditor` + save persists; CSV import/export work |
| channel-regen still correct via the tab | editing `device_type` from the electrode-groups tab regenerates maps to local ids (same assertion as 3-1, now through the tab) |
| scope descriptors present | both tabs show their scope descriptor text |
| config-version legibility | a multi-version animal shows the dated "changed on …" context, not a bare "v2" |
| unsaved-edit guard | with a dirty `ChannelMapEditor`, clicking another section-nav link shows the discard confirm; cancel keeps the tab + edit; confirm navigates and drops it |
| `npx vitest run baselines` | 125 byte-identical |

## Fixtures

`buildRealisticWorkspace()` (multi-group, multi-version via an added `configurationHistory` entry for the legibility test). No new fixtures.

## Review

Dispatch `pr-review-toolkit:code-reviewer` against the diff. Confirm:

- Both ephys tabs render their container; the legacy stepper still works (parallel-running invariant).
- The unsaved-edit guard actually blocks a `:tab` switch with pending edits (test exercises a real dirty modal, not a mock).
- Channel-regen behavior is unchanged through the tab path; 125 baselines byte-identical.
- "Deliberately not in this phase" honored (no other tabs, no banner move, no profile move).
- Lint 0 errors; build green; names free of plan-milestone references.
