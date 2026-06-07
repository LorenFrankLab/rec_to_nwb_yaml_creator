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
- **Task 3.3a — Mandatory "effective setup for THIS day" review** *(the valid-but-wrong defense — see
  [journeys analysis](user-journeys-failure-analysis.md))*. The top residual risk is a value that passes
  every rule but is semantically wrong (wrong camera/version/day, misattribution after time passes) — only
  REVIEW catches it. Each day's row/preflight must surface what *that day actually used* — pinned config
  version, referenced cameras, electrodes, failed channels — **read-only and clearly distinct from the
  animal's *current* setup tabs** (a historical day is pinned to an older version; the setup tabs show the
  latest). Builds on Phase 8.7's `DayTechnicalSection`/effective values + the batch-row scan contract.
  **This is a hard prerequisite for Phase 2 Task 2.5 / decision 12** (retiring the day-row scan line): the
  scan detail relocates HERE, so this review must exist before the row loses it — otherwise the
  valid-but-wrong defense regresses.
- **Task 3.3b — Close the warning-escape on export.** Verified: the export gate keys on `severity ==='error'`
  only; warnings (`inconsistent_location_case` on imports, orphaned video/file) **do not block** and can
  ride a **batch** export across N days. Batch/valid-only export must require an **explicit acknowledgement**
  of outstanding warnings (not just a count), so a silent downstream issue can't multiply across days.
  - **Derivation note:** `deriveChip(computeStepStatus(...))` ([ValidationSummary/index.jsx:50-55](../../../../src/pages/ValidationSummary/index.jsx))
    is **3-state (`valid`/`error`/`incomplete`) with no "warning" notion**, and `buildRows` does NOT carry
    warnings today. Surfacing per-day outstanding warnings into the batch preflight means plumbing
    `validateDay(...).filter(severity === 'warning')` (the per-day filter [ExportStep.jsx:151](../../../../src/pages/DayEditor/ExportStep.jsx)
    already does) into the batch flow / an extended `buildRows`. Still UI-layer + read-only over the
    existing validators — but it is **new plumbing, not a free read** of the current chip.
- **Task 3.4 — Config-version legibility.** Wherever a configuration version appears (this tab, the
  Recording Days strip), show human-readable context: "Electrode configuration changed on [date] — days
  before use v1, days after use v2," so a scientist isn't left decoding "v2."
- **Task 3.5 — Subject/profile + reconfig home.** Re-home `AnimalProfileSection` (subject facts, with
  its Phase 8.7 blast-radius confirm) and the `isReconfigurationEdit` context banner (`?context=…`) onto
  the `AnimalView` header / a route-context equivalent — they have no tab and must not be lost.
- **Task 3.6 — Unsaved-edit guard on section switch (moved up from Phase 5).** Once the modals
  (`CameraModal`/`ChannelMapEditor`) are extracted into switchable section-nav panels *here*, an open
  modal with pending edits must not be silently dropped when the user changes sections (the nav exists
  from Phase 1, so the gap opens as soon as these modals live under it — earlier than Phase 5). Either
  block the section switch with a confirm or hoist the modal above the panels. Specify and test this in
  the phase that introduces the switchable modals, not at decommission time.

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
