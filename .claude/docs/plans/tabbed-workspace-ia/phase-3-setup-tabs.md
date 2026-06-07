# Phase 3 — Setup tabs (extract host wiring, then re-host the leaves)

**This is the heaviest phase.** The leaf section components are presentational, but the stateful
machinery lives in their HOSTS — extracting it is the real work; "re-hosting the leaf" is trivial.
Repair-routing migration is split out to [Phase 3a](phase-3a-repair-routing.md).

## Goal

Replace the 4-step setup wizard with discoverable, revisitable **navigation tabs** (links +
`aria-current`), each owning the extracted wiring for its section, keeping every Phase 8.7 ownership
cue, blast-radius confirm, and identity-safety dialog verbatim.

## What must be EXTRACTED (not re-hosted)

| Source host | Wiring that has no current tab home |
| --- | --- |
| [HardwareConfigStep.jsx](../../../../src/pages/AnimalEditor/HardwareConfigStep.jsx) (~290 lines) | `CameraModal`, `CameraReferenceDialog`, identity-divergence (`findIdentityDivergence`), blast-radius (`findCameraAffectedDays`, `hasUnresolvableDays`), immutable-once-referenced flow, camera delete confirm; the `dataAcqRegistry`; the **3-field `RawCorruptionBanner`** (`cameras`/`data_acq_device`/`configurationHistory`) that now spans THREE tabs |
| [AnimalEditorStepper.jsx](../../../../src/pages/AnimalEditor/AnimalEditorStepper.jsx) (~953 lines, ~15 handlers) | `handleSaveGroup` (channel-map auto-regen), `handleDeleteGroup`, `handleCopyConfirm`, `handleEditChannelMap`/`handleSaveChannelMap`, CSV import/export + validation, `ElectrodeGroupModal`, `ChannelMapEditor`, `CopyFromAnimalDialog`, `knownRegions` memo, the reconfiguration context banner, subject editing |

**Task 3.1 (primary): extract a shared "animal setup wiring" layer** (hooks/containers) that BOTH the
temporary stepper and the new tabs consume — so logic isn't forked and the Phase 8.7 camera-identity /
electrode-channel-regen behaviors are preserved byte-for-byte (tested before and after extraction).
The 3-field corruption banner needs a home that spans its tabs (render it at the `AnimalView` level,
above the tab panels, or scope each field to its tab — decide during extraction).

## Tab → content map

| Tab (`:tab`) | Hosts | Scope descriptor (shown under the tab name) |
| --- | --- | --- |
| `electrode-groups` | `ElectrodeGroupsStep` + the electrode handlers/modals/CSV | "Versioned identity — a change here forks a configuration version" |
| `channel-maps` | `ChannelMapsStep` + `ChannelMapEditor` (mapping + bad-channels) | "Edit any time — map channels, mark bad channels" |
| `recording-system` | `DataAcqSection` | "**Shared across ALL days** (no per-day version)" — honesty caveat |
| `cameras` | `CamerasSection` + camera identity-safety machinery | "Catalog — referenced per day" |
| `dio` | `BehavioralEventsSection` | "Library — opt in per day" |
| `optogenetics` | `OptogeneticsStep` | status chip when unused ("Not used — no stimulation") so an empty tab doesn't read as an error |
| `export` (Validation & Export) | per-animal slice of [ValidationSummary](../../../../src/pages/ValidationSummary/index.jsx) | "This animal — readiness & export" |

Electrode Groups and Channel Maps are **separate tabs** (decided — different blast radii). Subject/
profile facts (`AnimalProfileSection`) and the reconfiguration context render as a **header on the
`AnimalView`**, not a tab.

## Tasks

- **Task 3.2 — Recording-system honesty.** The `recording-system` tab keeps the Phase 8.7 Task 3
  "one per animal, shared, future per-day capability" framing and its scope descriptor; it does NOT sit
  under any "apply to days as needed" grouping. Cameras/DIO MAY use selective-per-day language.
- **Task 3.3 — Per-animal Validation & Export tab.** A view of the Validation Summary scoped to the
  selected animal: per-day scan rows (config version · cameras · opto state — Phase 8.7 Task 10),
  readiness chips, ownership-pattern repair hints (Task 9), single/animal export. `buildRows(workspace)`
  is **workspace-global with no animal param** — add an animal-scoped entry point or filter its output
  by `animalKey` (a thin refactor; "reuse, don't re-derive" still holds for the validation logic). Name
  it **"This animal — readiness & export"**; the chrome-level batch screen is **"All animals — batch
  export"** (Phase 4). Each surface shows its scope in a persistent header ("Showing: remy — 4 days").
- **Task 3.4 — Config-version legibility.** Wherever a configuration version appears (this tab, the
  Recording Days strip), show human-readable context: "Electrode configuration changed on [date] — days
  before use v1, days after use v2," so a scientist isn't left decoding "v2."
- **Task 3.5 — Subject/profile + reconfig home.** Re-home `AnimalProfileSection` (subject facts, with
  its Phase 8.7 blast-radius confirm) and the `isReconfigurationEdit` context banner (`?context=…`) onto
  the `AnimalView` header / a route-context equivalent — they have no tab and must not be lost.

> Repair deep-link routing (the `?field=…` migration, `ANIMAL_EDITOR_STEPS` → tab-keyed map, the
> camera-vs-recording-system granularity change) is **Phase 3a** — it's wider than this phase and
> tracked separately.

## Acceptance

- Each setup tab renders its section with all Phase 8.7 behavior intact (ownership cues, blast-radius/
  identity confirms, opto split, lifecycle); a regression test proves camera-identity + channel-regen
  behavior is unchanged after the wiring extraction.
- Electrode Groups and Channel Maps are distinct tabs; each tab shows its scope descriptor; recording
  system keeps the shared-across-all-days framing; an unused Optogenetics tab shows a status chip.
- Validation & Export tab shows this animal's readiness + repairs + export with a scoped header; the
  3-field corruption banner still surfaces across its (now multiple) tabs.
- Subject facts + reconfig context have a home and keep their confirms.
- Full suite (extraction regression tests), lint, build green; **125 baselines byte-identical**.

## Risks

- **Extraction regression surface.** The camera identity-safety and channel-regen flows are the
  highest-value Phase 8.7 guarantees; extracting their wiring risks subtle drift. Snapshot the behavior
  in tests BEFORE extracting, run them after.
- **The 3-field corruption banner** now spans three tabs — don't let a per-tab render hide a sibling
  field's corruption.
