# Phase 2 — Video references: correct state + complete repair

[← back to PLAN.md](PLAN.md) · [overview](overview.md) · [shared-contracts §1](shared-contracts.md#1-severity-vocabulary) · [§2](shared-contracts.md#2-repair-anchor) · [§3](shared-contracts.md#3-parity)

The whole video-reference story in one PR, so nothing ships a blocker without its control. Today: the
readiness bar's "Fix video camera" lands on a control that doesn't exist (the drawer video row has only
Rename/Remove); a *blank* camera looks ready but the schema blocks it; an **orphaned** video (epoch no
task defines) has no editing surface at all; and the bulk "Generate missing → Videos (N)" mints videos
pointing at a non-existent camera `0`. Findings #1 (video half), #2, #3.

**Trodes confirmation (authoritative):** the cameraModule writes `{recording-base}.{cameraInstance}.h264`
(`trodes/Modules/cameraModule/src/mainwindow.cpp:2401-2434`, `videoDisplay.cpp:6502`) + a
`{base}.videoTimeStamps` sidecar, co-located with the recording — matching `deriveVideoName` (93.6%
corpus). The `.{N}.` index is the **camera module instance** (i.e. *which camera*), not a free counter,
so a video's camera is intrinsic to its filename — reinforcing that `camera_id` is a first-class,
required field (not an afterthought). Trodes can also emit `.mp4` (`videoDisplay.cpp:6502`) but the
corpus is ~100% `.h264` (16754 vs 2) — so keep `.h264` as the derived default and merely **tolerate a
stored `.mp4` name** as valid (don't flag it) in `isDerivedVideo`/validation; do not change the default.

**Inputs to read first:**

- [shared-contracts §1](shared-contracts.md#1-severity-vocabulary) — the 3-state `videoCameraState`
  (`valid`/`unselected`/`dangling`) and how it folds into `gateState`. **Blank `camera_id` is
  `unselected` = blocking** (schema requires `camera_id`), not "valid".
- [shared-contracts §2](shared-contracts.md#2-repair-anchor) — the two video anchors, where each must
  land, and the fact that `AssociatedVideosEditor` is dead code to be revived.
- [shared-contracts §3](shared-contracts.md#3-parity) — the camera/epoch parity assertions.
- [src/pages/DayEditor/AssociatedVideosEditor.tsx:90-242](../../../../src/pages/DayEditor/AssociatedVideosEditor.tsx)
  — the dead-but-complete editor: camera `<select>` (`:129-163`), task-epoch `<select>` (`:165-197`),
  stale-id handling, both `data-field-path` anchors. Revive + factor.
- [src/pages/DayEditor/EpochsTab.tsx:1290-1363](../../../../src/pages/DayEditor/EpochsTab.tsx) — the
  drawer video editor row (`present` branch: name + static `cameraName(...)` note + Remove). The camera
  select goes here.
- [src/pages/DayEditor/EpochsTab.tsx:496-516](../../../../src/pages/DayEditor/EpochsTab.tsx) —
  `addVideo` (the `?? 0` phantom-camera seed) + `writeVideoName`; add `writeVideoCamera`.
- [src/pages/DayEditor/EpochsTab.tsx:161-173,213-221,1203-1215](../../../../src/pages/DayEditor/EpochsTab.tsx)
  — the focus-effect parser + `openFileEditor`/`pendingFileFocus`; add a `'camera'` target.
- [src/domain/epochGeneratedFiles.ts:35-118](../../../../src/domain/epochGeneratedFiles.ts) —
  `fallbackCameraId` (returns `0`), `expectedCameraIds`, `addMissingGeneratedVideos`,
  `countMissingGeneratedVideos`.
- [src/pages/DayEditor/TasksFilesSection.tsx:37-74](../../../../src/pages/DayEditor/TasksFilesSection.tsx)
  — where the Unassigned-videos surface mounts (beside Supplemental files).
- [src/validation/rules/referenceRules.ts:217-231,274-297](../../../../src/validation/rules/referenceRules.ts)
  — `dangling_camera_ref` (video) + `orphaned_video`.

## Tasks

- **View-model `videoCameraState` + `gateState`.** In `buildEpochGrid` read the defined-camera-id set
  via `getAnimalCameras(animal)`. For each row compute `videoCameraState` over its **present** videos
  ([shared-contracts §1](shared-contracts.md#1-severity-vocabulary)): any `unselected` or `dangling`
  video → the row's worst is that; else `valid`; `null` when the row has no present video. Extend
  `gateState`'s `blocking` term (the P1 seam) to include `videoCameraState ∈ {unselected, dangling}`.
- **Extract `VideoCameraSelect`** (new `src/components/ui/VideoCameraSelect.tsx` or a Day-Editor-local
  component) from `AssociatedVideosEditor.tsx:129-163`: props `{ cameras, value, fieldPath, ariaLabel,
  onChange }`; renders the "— select camera —" option, the disabled "Missing camera — previously id N"
  stale option, `aria-invalid`, the "no cameras defined" inline-info, and carries `data-field-path`.
  Refactor `AssociatedVideosEditor` to use it (no behavior change — its tests must still pass).
- **Drawer camera select.** In the `present`-branch video row (`EpochsTab.tsx:1311-1325`), render
  `<VideoCameraSelect value={v.entry.camera_id} fieldPath={`associated_video_files[${v.index}].camera_id`}
  cameras={cameras} onChange={(val)=>writeVideoCamera(v.index,val)} />` in place of the static
  `cameraName(...)` note. Add `writeVideoCamera(videoIndex, value)` beside `writeVideoName`
  (`EpochsTab.tsx:511-516`) with the `unresolvedTaskCatalogDivergence` guard + `clearDeferredEpoch`,
  writing `camera_id: value === '' ? '' : Number(value)`. Thread `onVideoCameraChange` through
  `EpochDetailsPanelProps`.
- **Video chip from `videoCameraState`.** In `EpochRowBlock` (`EpochsTab.tsx:1048-1053`) and the
  drawer-header video state (`EpochsTab.tsx:1186-1201`): `present` + `valid` → `fileSummaryReady`
  ("Video: N"); `present` + `unselected` → blocking red "Select camera"; `present` + `dangling` →
  blocking red "Camera missing"; `needs_video` → red "Needs video"; `missing` (not needs_video) →
  neutral `fileSummaryTodo` "No video yet"; `absent` → `fileSummaryMuted`.
- **`addVideo` seeds `''`, not `0`.** `EpochsTab.tsx:496-506`: replace `?? 0` so when no camera is
  resolvable the new row gets `camera_id: ''` (shows "— select camera —", chip "Select camera"). When
  a real camera *is* resolvable (task's `camera_id[0]` or the animal's first camera), seed that.
- **Bulk generator fix (`epochGeneratedFiles.ts`).** Stop minting camera `0`: `expectedCameraIds`
  should use only the row's real `cameras` (drop the `[fallback]` branch that injects `0`), so an
  epoch whose task has no camera contributes **no** expected video. Remove `fallbackCameraId`'s `0`
  return path (or make callers treat "no camera" as "nothing to generate"). Update
  `countMissingGeneratedVideos` to match. In `EpochsTab`, disable the "Videos (N)" button when the
  count is 0 / no resolvable camera, with a tooltip ("Add a camera to this animal first").
- **Unassigned videos repair surface (closes `orphaned_video`).** Add an `unassignedOnly?: boolean`
  prop to `AssociatedVideosEditor` mirroring `AssociatedFilesEditor`'s `supplementalOnly`
  ([AssociatedFilesEditor.tsx:139-141](../../../../src/pages/DayEditor/AssociatedFilesEditor.tsx)):
  filter visible rows to videos whose `task_epochs` is blank or matches **no** current task epoch,
  keeping absolute indices for write-back. In `TasksFilesSection` (`:37-74`), render
  `<AssociatedVideosEditor unassignedOnly videos={getDayAssociatedVideos(day)} cameras={...}
  tasks={tasks} onChange={(next)=>onFieldUpdate('associated_video_files', next)} />` as an "Unassigned
  videos" section that appears only when such videos exist (count badge like Supplemental files). These
  rows carry both `associated_video_files[i].camera_id` and `…task_epochs` anchors, so both repairs
  land here.
- **Focus routing.** Extend the EpochsTab focus effect (`EpochsTab.tsx:161-173`): parse
  `associated_video_files[<vi>].camera_id` → find the row whose `videos.some(v=>v.index===vi)` →
  `setActiveEpoch(row.epoch)` + `setPendingFileFocus({epoch,target:'camera',token})`; add `'camera'`
  to `FileFocusTarget` (`:70`) and focus the camera select in the drawer effect (`:1203-1215`). For
  `associated_video_files[<vi>].task_epochs` (and any `camera_id` whose video is **not** on a row), the
  Unassigned-videos editor already renders the anchor — the frame's focus effect
  ([DayEditorFrame.tsx:243-266](../../../../src/pages/DayEditor/DayEditorFrame.tsx)) finds it; ensure
  the section is rendered (not behind a collapsed disclosure) so the element is on-screen.

## Deliberately not in this phase

- Adding/defining cameras (Animal Editor's job) — the selects only pick from existing cameras and say
  "add cameras in the Animal Editor" when there are none.
- Re-deriving the video *name* — [Phase 4](phase-4-filename-reconciliation.md).
- Auditing non-video repair routes — supplemental-file orphans already have `AssociatedFilesEditor`'s
  epoch select. The "no dead-ends" claim is scoped to **video references** ([§2](shared-contracts.md#2-repair-anchor)).

## Validation slice

| Test | Asserts |
| --- | --- |
| `epochGridViewModel` — `videoCameraState` | blank `camera_id` → `unselected`; id absent from cameras → `dangling`; defined id → `valid`; no present video → `null`. |
| `epochGridViewModel` — `gateState` + parity | `unselected`/`dangling` → `blocking`; the blocking set ⇔ `validateDay` camera issues (schema-required + `missing_camera`/`dangling_camera_ref`) per [§3](shared-contracts.md#3-parity). |
| `VideoCameraSelect` | Renders cameras + stale option + `aria-invalid`; `AssociatedVideosEditor`'s existing tests still pass after the refactor. |
| `EpochsTab` — drawer camera change | Selecting a camera writes `associated_video_files[i].camera_id` (numeric) on the right index; no other row changes. |
| `EpochsTab` — addVideo no phantom camera | With no resolvable camera, `addVideo` seeds `''`; with one, seeds the real id. |
| `epochGeneratedFiles` — no camera-0 | `addMissingGeneratedVideos`/`countMissingGeneratedVideos` generate/count **nothing** for an epoch whose task has no camera; never emit `camera_id: 0` from a fallback. |
| `EpochsTab` — bulk button gated | "Videos (N)" disabled with tooltip when no resolvable camera. |
| `AssociatedVideosEditor` — `unassignedOnly` | Shows only videos whose epoch matches no task (or blank), editing by absolute index. |
| `TasksFilesSection` / `EpochsTab` — repair landings | `…camera_id` for an on-row video opens the drawer + focuses the camera select; `…task_epochs` (orphaned) focuses the Unassigned-videos row's epoch select. |
| integration | After picking a valid camera/epoch, the corresponding `validateDay` issue clears. |
| `baselines` | byte-identical (new affordances; storage shape unchanged). |

## Fixtures

A synthesized day with: (a) a present video bound to a removed camera id (`dangling`), (b) a present
video with blank camera (`unselected`), (c) an **orphaned** video whose `task_epochs` matches no task,
and an animal with ≥1 camera and a task with no camera. Exercises all three states, the bulk-generator
no-camera path, the Unassigned surface, and both repair landings. Reuse `getAnimalCameras` fixtures. No
real-data slice.

## Review

Dispatch `code-reviewer` against the diff. Confirm:
- Blank camera is treated as blocking everywhere (chip, pill via `gateState`, gate parity) — no
  "looks ready while schema blocks".
- `VideoCameraSelect` is the single source of the camera select (drawer + `AssociatedVideosEditor`); no
  divergent re-implementation; `AssociatedVideosEditor` tests pass after extraction.
- Both video repair anchors land on a real control (drawer or Unassigned surface); `orphaned_video` is
  no longer a dead-end.
- `epochGeneratedFiles` never mints camera `0`; the bulk button is gated.
- The camera/epoch parity tests pass ([§3](shared-contracts.md#3-parity)).
- "Deliberately not in this phase" honored; `baselines` byte-identical; no plan references; a11y names
  on every select.
