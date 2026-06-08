# Phase 3 — Setup tabs (charter + sub-phase router)

[overview](overview.md) · followed by [Phase 3a — repair routing](phase-3a-repair-routing.md)

**This is the heaviest phase, so it ships as SIX independently-reviewable PRs, not one.** This file is
the **charter**: the cross-cutting context every Phase 3 sub-phase needs (the extraction contract, the
tab→content map, the two baked-in design decisions, the invariants). Each `phase-3-N-*.md` file is a
self-contained execution prompt that links back here; read this once, then execute the sub-phase.

The leaf section components are presentational — the stateful machinery lives in their HOSTS
([AnimalEditorStepper.jsx](../../../../src/pages/AnimalEditor/AnimalEditorStepper.jsx), 985 lines;
[HardwareConfigStep.jsx](../../../../src/pages/AnimalEditor/HardwareConfigStep.jsx), 309 lines).
**Extracting that wiring is the real work; "re-hosting the leaf" is trivial.** Repair-routing migration
(`?field=` deep links → tab routes) is a separate workstream — [Phase 3a](phase-3a-repair-routing.md).

## Goal

Replace the 4-step setup **wizard** with discoverable, revisitable **navigation tabs** (links +
`aria-current`, already shipped in Phase 1), each owning the extracted wiring for its section, keeping
every Phase 8.7 ownership cue, blast-radius confirm, and identity-safety dialog **byte-for-byte**.

## Sub-phase sequence (each one PR; flag-gated; 125 baselines byte-identical)

| Sub-phase | Ships | Risk |
| --- | --- | --- |
| [3-1 Extract wiring](phase-3-1-extract-wiring.md) | The shared setup-wiring layer (containers + hooks), consumed by the **still-live stepper**. No route/UI change. | Extraction regression (high) / UX (none — invisible) |
| [3-2 Ephys tabs](phase-3-2-ephys-tabs.md) | `electrode-groups` + `channel-maps` tabs (the hardest wiring: channel-map auto-regen, CSV, modals) + the unsaved-edit guard. | Medium |
| [3-3 Catalog/library tabs](phase-3-3-catalog-tabs.md) | `recording-system` + `cameras` + `dio` + `optogenetics` tabs + the AnimalView-level 3-field corruption banner + opto status chip. | Medium |
| [3-4 Profile + reconfig header](phase-3-4-profile-context.md) | `AnimalProfileSection` (subject facts) + the reconfiguration context banner, re-homed onto the `AnimalView` header. | Low |
| [3-5 Validation & Export tab + per-day review](phase-3-5-validation-export-tab.md) | The per-animal `export` tab (animal-scoped `buildRows`) **and** the mandatory "effective setup for THIS day" review (Task 3.3a — the valid-but-wrong defense). | Medium |
| [3-6 Close the warning-escape on export](phase-3-6-warning-ack.md) | Explicit acknowledgement of outstanding **warnings** on batch / valid-only export (Task 3.3b). | Low–medium (new plumbing) |

Do them in order: **3-1 is the spine** (nothing else starts until its snapshots are green), and
[Phase 3a](phase-3a-repair-routing.md) runs **after** all six (the destination routes must be real before
the `?field=` emitters are re-pointed).

> **Numbering note (read this).** "**Task 3.x**" labels refer to the *original* Phase 3 task list and do
> **NOT** map 1:1 to the `phase-3-x` filenames. Use this mapping, not the digits:
> Task 3.1 → [3-1]; re-host leaves → [3-2] (electrode-groups, channel-maps) + [3-3] (recording-system,
> cameras, dio, optogenetics); Task 3.2 (rec-sys honesty) → [3-3]; Task 3.4 (config-version legibility) →
> **split** across [3-2] (ephys) + [3-5] (rows); Task 3.5 (subject/profile + reconfig) → [3-4]; Task 3.6
> (unsaved-edit guard) → [3-2]; Task 3.3 (Validation & Export tab) + 3.3a (per-day effective-setup review)
> → [3-5]; Task 3.3b (warning-escape) → [3-6].

[3-1]: phase-3-1-extract-wiring.md
[3-2]: phase-3-2-ephys-tabs.md
[3-3]: phase-3-3-catalog-tabs.md
[3-4]: phase-3-4-profile-context.md
[3-5]: phase-3-5-validation-export-tab.md
[3-6]: phase-3-6-warning-ack.md

## The extraction contract (Task 3.1 — read by 3-1, 3-2, 3-3, 3-4)

Create a shared **animal-setup-wiring layer** that BOTH the temporary stepper and the new tab panels
consume, so logic is never forked and the Phase 8.7 behaviors are preserved byte-for-byte. The model is
**one container component per section** (each takes `animalId`, owns its modals + wiring, renders the
existing presentational leaf), plus shared hooks for cross-section concerns.

| New container (suggested) | Wraps leaf | Owns this wiring (current home → line) |
| --- | --- | --- |
| `ElectrodeGroupsContainer` | [ElectrodeGroupsStep.jsx](../../../../src/pages/AnimalEditor/ElectrodeGroupsStep.jsx) | `handleAddGroup`/`handleEditGroup` ([AnimalEditorStepper.jsx:326-347](../../../../src/pages/AnimalEditor/AnimalEditorStepper.jsx)), **`handleSaveGroup` channel-map auto-regen on `device_type` change** ([:355-436](../../../../src/pages/AnimalEditor/AnimalEditorStepper.jsx)), `handleDeleteGroup`/`confirmDeleteGroup` ([:449-478](../../../../src/pages/AnimalEditor/AnimalEditorStepper.jsx)), `handleCopyFromAnimal`/`handleCopyConfirm` ([:508-544](../../../../src/pages/AnimalEditor/AnimalEditorStepper.jsx)); `ElectrodeGroupModal` + `CopyFromAnimalDialog` + delete `ConfirmDialog` ([:902-942](../../../../src/pages/AnimalEditor/AnimalEditorStepper.jsx)) |
| `ChannelMapsContainer` | [ChannelMapsStep.jsx](../../../../src/pages/AnimalEditor/ChannelMapsStep.jsx) + [ChannelMapEditor.jsx](../../../../src/pages/AnimalEditor/ChannelMapEditor.jsx) | `handleEditChannelMap`/`handleSaveChannelMap` ([:558-588](../../../../src/pages/AnimalEditor/AnimalEditorStepper.jsx)), CSV export/import + validation ([:601-675](../../../../src/pages/AnimalEditor/AnimalEditorStepper.jsx), via [utils/csvChannelMapUtils](../../../../src/utils/csvChannelMapUtils.js)) |
| `RecordingSystemContainer` | [DataAcqSection.jsx](../../../../src/pages/AnimalEditor/DataAcqSection.jsx) | `dataAcqRegistry` memo ([HardwareConfigStep.jsx:75-78](../../../../src/pages/AnimalEditor/HardwareConfigStep.jsx), via `collectDataAcqIdentities` [identitySafety.js:149-170](../../../../src/pages/AnimalEditor/identitySafety.js)) |
| `CamerasContainer` | [CamerasSection.jsx](../../../../src/pages/AnimalEditor/CamerasSection.jsx) | `handleSaveCamera` identity-divergence ([HardwareConfigStep.jsx:103-123](../../../../src/pages/AnimalEditor/HardwareConfigStep.jsx), via `findIdentityDivergence` [identitySafety.js:40-51](../../../../src/pages/AnimalEditor/identitySafety.js)), **immutable-once-referenced** decision flow ([:125-178](../../../../src/pages/AnimalEditor/HardwareConfigStep.jsx), via `findCameraAffectedDays` [cameraUsage.js:101-108](../../../../src/state/cameraUsage.js)), `CameraModal`/`CameraReferenceDialog`/delete `ConfirmDialog` ([:248-285](../../../../src/pages/AnimalEditor/HardwareConfigStep.jsx)) |
| `DioContainer` | [BehavioralEventsSection.jsx](../../../../src/pages/AnimalEditor/BehavioralEventsSection.jsx) | Already self-contained (inline edit/delete) — thin container |
| `OptogeneticsContainer` | [OptogeneticsStep.jsx](../../../../src/pages/AnimalEditor/OptogeneticsStep.jsx) | `onUpdate → actions.updateAnimal` ([AnimalEditorStepper.jsx:745-752](../../../../src/pages/AnimalEditor/AnimalEditorStepper.jsx)) |

**Shared cross-section concerns** (extract to hooks/shared modules, not duplicated per container):

- `knownRegions` memo ([AnimalEditorStepper.jsx:218-225](../../../../src/pages/AnimalEditor/AnimalEditorStepper.jsx)) — feeds `ElectrodeGroupModal`'s region autocomplete.
- The `AlertModal` + `showAlert` helper ([:165, :197-209, :944-950](../../../../src/pages/AnimalEditor/AnimalEditorStepper.jsx)).
- `handleFieldUpdate` ([:485-490](../../../../src/pages/AnimalEditor/AnimalEditorStepper.jsx)) and `handleRepair` ([:500-503](../../../../src/pages/AnimalEditor/AnimalEditorStepper.jsx), via [repairCommands](../../../../src/state/repairCommands.js)).

## Tab → content map (verified component anchors)

| Tab (`:tab`) | Container → leaf | Scope descriptor (under the tab name) |
| --- | --- | --- |
| `electrode-groups` | `ElectrodeGroupsContainer` → [ElectrodeGroupsStep.jsx](../../../../src/pages/AnimalEditor/ElectrodeGroupsStep.jsx) | "Versioned identity — a change here forks a configuration version" |
| `channel-maps` | `ChannelMapsContainer` → [ChannelMapsStep.jsx](../../../../src/pages/AnimalEditor/ChannelMapsStep.jsx) + `ChannelMapEditor` | "Edit any time — map channels, mark bad channels" |
| `recording-system` | `RecordingSystemContainer` → [DataAcqSection.jsx](../../../../src/pages/AnimalEditor/DataAcqSection.jsx) | "**Shared across ALL days** (no per-day version)" — honesty caveat (Task 3.2) |
| `cameras` | `CamerasContainer` → [CamerasSection.jsx](../../../../src/pages/AnimalEditor/CamerasSection.jsx) | "Catalog — referenced per day" |
| `dio` | `DioContainer` → [BehavioralEventsSection.jsx](../../../../src/pages/AnimalEditor/BehavioralEventsSection.jsx) | "Library — opt in per day" |
| `optogenetics` | `OptogeneticsContainer` → [OptogeneticsStep.jsx](../../../../src/pages/AnimalEditor/OptogeneticsStep.jsx) | status chip when unused ("Not used — no stimulation") so an empty tab doesn't read as an error |
| `export` | per-animal slice of [ValidationSummary](../../../../src/pages/ValidationSummary/index.jsx) | "This animal — readiness & export" |

All seven `:tab` keys already exist in [`ANIMAL_VIEW_TABS`](../../../../src/hooks/useHashRouter.js) ([useHashRouter.js:19-28](../../../../src/hooks/useHashRouter.js)) and currently render the placeholder at
[AnimalView/index.jsx:160-170](../../../../src/pages/AnimalView/index.jsx) — that conditional is what
each sub-phase replaces, tab by tab. The `SECTION_GROUPS` nav structure is at [AnimalView/index.jsx:27-46](../../../../src/pages/AnimalView/index.jsx).

Electrode Groups and Channel Maps are **separate tabs** (decided — different blast radii). Subject/
profile facts and the reconfiguration context render as a **header on `AnimalView`**, not a tab (3-4).

## Design decisions (BAKED IN — do not re-litigate)

1. **The 3-field `RawCorruptionBanner` renders at the `AnimalView` level, ABOVE the tab panels** — not
   per-tab. It covers `cameras` / `data_acq_device` / `configurationHistory`
   ([current render: HardwareConfigStep.jsx:203-207](../../../../src/pages/AnimalEditor/HardwareConfigStep.jsx)),
   which now span THREE different tabs; a per-tab render would let a sibling field's corruption hide when
   that field's tab isn't open (the documented risk). Hoisting it above the panels makes corruption in any
   of the three visible from every setup tab. Owned by **3-3** (the phase that first mounts those tabs).
2. **The unsaved-edit guard BLOCKS the section switch with a `ConfirmDialog`** (reuse the existing
   [Modal](../../../../src/components/Modal.jsx) primitive), rather than hoisting the modals above the
   panels. When a `CameraModal`/`ChannelMapEditor` has pending edits and the user clicks another section-nav
   link, intercept and confirm ("Discard unsaved changes?"). Owned by **3-2** (the phase that first puts a
   switchable modal under the nav). Simpler and lower-risk than re-parenting the modals.

## Invariants (every sub-phase)

- **Flag-gated.** All of it lives under the `animalWorkspace` flag ([featureFlags.js:123](../../../../src/featureFlags.js); `isFeatureEnabled` [featureFlags.js:330-336](../../../../src/featureFlags.js)). The legacy stepper at `#/animal/:id/editor` **stays live** until Phase 5 — these phases are additive and run in parallel with it. That is exactly why the extraction (3-1) must keep the stepper working off the shared layer.
- **No store/export/schema change.** Presentation only; the **125 golden baselines stay byte-identical** and the day-used-camera export binding is untouched. Run `npx vitest run baselines` every sub-phase.
- **Preserve Phase 8.7 behavior byte-for-byte.** Camera identity-safety, channel-map auto-regen, blast-radius confirms, lifecycle confirms, ownership cues — snapshot in tests BEFORE extracting, prove unchanged after (3-1's gate).
- **One `#main-content`.** `AnimalView` already owns it ([AnimalView/index.jsx:117](../../../../src/pages/AnimalView/index.jsx)); the legacy stepper renders a different route, so they never co-exist.

## Risks

- **Extraction regression surface (3-1).** The camera identity-safety and channel-regen flows are the
  highest-value Phase 8.7 guarantees; extracting their wiring risks subtle drift. The 3-1 gate (behavior
  snapshots before/after) is non-negotiable.
- **The 3-field corruption banner spanning three tabs (3-3).** Decision 1 above resolves it; verify a
  sibling field's corruption is visible from every setup tab, not just its own.
- **Unsaved edits lost on section switch (3-2).** Decision 2 above resolves it; the nav has existed since
  Phase 1, so the gap is open the moment a switchable modal lands under it.

## Acceptance (whole phase, proven across the six PRs)

- Each setup tab renders its section with all Phase 8.7 behavior intact; a regression test proves
  camera-identity + channel-regen behavior is unchanged after the wiring extraction (3-1).
- Electrode Groups and Channel Maps are distinct tabs; each tab shows its scope descriptor; recording
  system keeps the shared-across-all-days framing; an unused Optogenetics tab shows a status chip.
- Validation & Export tab shows this animal's readiness + repairs + export with a scoped header; the
  3-field corruption banner surfaces across its (now multiple) tabs from the AnimalView level.
- Subject facts + reconfig context have a home and keep their confirms.
- Per-day "effective setup" review exists (3-5) so the day-row scan retirement (decision 12) is unblocked.
- Batch / valid-only export requires explicit warning acknowledgement (3-6).
- Full suite (extraction regression tests), lint, build green; **125 baselines byte-identical**.
