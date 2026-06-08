# Phase 3-1 — Extract the animal-setup wiring (behavior-preserving)

[charter](phase-3-setup-tabs.md) · [overview](overview.md)

**The spine. Ships invisibly: no route or UI change.** Extract the stateful wiring out of the two host
components into a shared layer (per-section containers + shared hooks), then refactor the **still-live
stepper** to render those containers. If the stepper behaves identically afterward, the extraction is
lossless and the tabs (3-2…3-4) can mount the same containers without forking logic.

**Inputs to read first:**

- [charter → "The extraction contract"](phase-3-setup-tabs.md) — the container/leaf/wiring mapping this phase implements.
- [AnimalEditorStepper.jsx](../../../../src/pages/AnimalEditor/AnimalEditorStepper.jsx) — 985-line host; the handlers/modals/state to extract (charter table has the line refs).
- [HardwareConfigStep.jsx](../../../../src/pages/AnimalEditor/HardwareConfigStep.jsx) — 309-line host; camera identity-safety + `dataAcqRegistry` + the 3-field banner.
- [identitySafety.js](../../../../src/pages/AnimalEditor/identitySafety.js) (`findIdentityDivergence` :40-51, `collectDataAcqIdentities` :149-170) and [cameraUsage.js:101-108](../../../../src/state/cameraUsage.js) (`findCameraAffectedDays`) — the pure helpers the wiring calls; do NOT change them, just relocate their callers.

## Tasks

- **Capture behavior snapshots BEFORE touching code (the gate).** The camera identity-safety and
  channel-map auto-regen flows are the highest-value Phase 8.7 guarantees. Before extracting, ensure
  characterization tests exist that drive the *current* stepper through: (a) editing a group's
  `device_type` and asserting channel maps regenerate to local ids ([handleSaveGroup:355-436](../../../../src/pages/AnimalEditor/AnimalEditorStepper.jsx)); (b) saving a camera with a diverging
  identity and asserting the in-modal block ([handleSaveCamera:103-123](../../../../src/pages/AnimalEditor/HardwareConfigStep.jsx)); (c) editing a referenced camera's identity and asserting the
  immutable-once-referenced decision dialog ([:125-178](../../../../src/pages/AnimalEditor/HardwareConfigStep.jsx)); (d) CSV import with an invalid `electrode_group_id` and asserting the error
  ([handleCSVFileSelect:626-675](../../../../src/pages/AnimalEditor/AnimalEditorStepper.jsx)); (e) copy-from-animal append ([handleCopyConfirm:516-544](../../../../src/pages/AnimalEditor/AnimalEditorStepper.jsx)). Check existing coverage in `src/pages/AnimalEditor/__tests__/`; add any missing characterization test against the stepper FIRST so the same assertions can re-run after extraction.
- **Extract the shared hooks** (cross-section concerns from the charter): a `useKnownRegions(workspace)` hook ([from :218-225](../../../../src/pages/AnimalEditor/AnimalEditorStepper.jsx)), a `useAnimalAlert()` hook wrapping `AlertModal` + `showAlert` ([:165, :197-209, :944-950](../../../../src/pages/AnimalEditor/AnimalEditorStepper.jsx)), and a `useAnimalFieldUpdate(animalId)` exposing `handleFieldUpdate`/`handleRepair` ([:485-503](../../../../src/pages/AnimalEditor/AnimalEditorStepper.jsx)). Place under `src/pages/AnimalEditor/wiring/` (new dir).
- **Extract one container per section** (charter table), each `({ animalId })` → owns its modals/handlers/state and renders the existing presentational leaf unchanged: `ElectrodeGroupsContainer`, `ChannelMapsContainer`, `CamerasContainer`, `RecordingSystemContainer`, `DioContainer`, `OptogeneticsContainer`. Move the handler bodies verbatim (the channel-regen math, the identity-divergence branch, the immutable-once-referenced flow) — relocate, don't rewrite. The CSV wiring is the whole export/import block `handleExportCSV`/`handleImportCSV`/`handleCSVFileSelect` ([:601-675](../../../../src/pages/AnimalEditor/AnimalEditorStepper.jsx)) — the charter cites the same range.
- **Refactor `AnimalEditorStepper` to render the extracted containers** in its existing step slots ([step composition :694-769](../../../../src/pages/AnimalEditor/AnimalEditorStepper.jsx)) instead of inlining the wiring. The stepper keeps its step-nav, `activeStep`, keyboard shortcuts, and the reconfiguration banner + `AnimalProfileSection` (those move in 3-4); only the per-section wiring moves out.
- **Refactor `HardwareConfigStep` similarly** — it becomes a thin composition of `RecordingSystemContainer` + `CamerasContainer` + `DioContainer` (its camera/data-acq wiring now lives in the containers). The 3-field `RawCorruptionBanner` stays rendered by the stepper/HardwareConfigStep **for now** (it moves to the AnimalView level in 3-3); leave its current render in place this phase.
- **Re-run the behavior snapshots** and confirm byte-for-byte identical behavior. Any diff is a bug in the extraction, not a baseline to update.

## Deliberately not in this phase

- **No tab mounting, no `AnimalView` change, no route change.** The containers exist but only the stepper
  renders them. Tabs come in 3-2/3-3/3-4. (Mounting a container in a tab now would couple the riskiest
  refactor to a UI change and muddy the snapshot gate.)
- **The 3-field corruption banner stays where it is.** It moves to the AnimalView level in 3-3.
- **`AnimalProfileSection` + reconfig banner stay in the stepper.** They re-home in 3-4.

## Validation slice

| Test | Asserts |
| --- | --- |
| `electrodeGroups.regen` characterization (before & after) | changing `device_type` regenerates channel maps to local ids `0..n`; map count + ntrode ids match pre-extraction output exactly |
| `cameraIdentity.divergence` characterization | saving a diverging camera identity blocks in-modal; name field re-focused |
| `cameraIdentity.immutableReferenced` characterization | editing a referenced camera surfaces the decision dialog; "create new" vs "correct in place" behave as before |
| `channelMapCsv.invalidGroup` characterization | CSV import with an unknown `electrode_group_id` shows the error and does NOT mutate the store |
| `copyFromAnimal.append` characterization | copy appends groups + maps with normalized ids; success alert shown |
| existing AnimalEditorStepper suite | unchanged — passes against the refactored stepper |
| `npx vitest run baselines` | 125 byte-identical |

## Fixtures

Reuse `buildRealisticWorkspace()` ([src/__tests__/fixtures/workspaceBuilders.js](../../../../src/__tests__/fixtures/workspaceBuilders.js)) for the multi-group/multi-camera animal; seed a second animal for copy-from-animal. No new fixtures needed.

## Review

Before opening the PR, dispatch `pr-review-toolkit:code-reviewer` against the diff. Confirm:

- Every handler body moved **verbatim** (channel-regen math, identity-divergence, immutable-once-referenced) — no behavior rewrite hidden in the move.
- "Deliberately not in this phase" honored — no tab/route/`AnimalView` change; banner + profile still in the stepper.
- The before/after characterization tests assert real behavior (not tautologies) and pass identically.
- 125 baselines byte-identical; lint 0 errors; build green.
- New module/hook/test names do **not** reference plan milestones or phase numbers.
