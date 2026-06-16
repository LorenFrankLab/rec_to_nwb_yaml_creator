# Designs — epoch-editor implementation

[← back to PLAN.md](PLAN.md) · [shared-contracts](shared-contracts.md)

Per-component design detail that outgrows a phase's task list. Visual reference for every screen is the
committed mockup set in this directory ([README.md](README.md) indexes them); this file is the *logic*
behind the screens.

- [Epoch grid — join + write-back](#epoch-grid-join)
- [Data-folder + filename derivation](#data-folder-derivation)
- [Generated-files states + video 3-state](#generated-files)
- [Issue-driven readiness + field-level repair](#issue-driven-readiness)

---

## Epoch grid — join + write-back {#epoch-grid-join}

**Mockup:** [day-editor.html](day-editor.html) Epochs tab + the drill-in. **Contract:**
[shared-contracts §5](shared-contracts.md#5-epoch-grid--join-view).

The grid is a pure view-model over the day's arrays. Build it in a new pure module
`src/viewModels/epochGridViewModel.ts` (React-free, unit-tested), consumed by the Epochs tab component.

**Join (read):** one row per distinct epoch number, ascending.

```text
buildEpochGrid(animal, day):
  tasks      = resolveDayTasks(animal, day)          // catalog-aware already (taskInstances→tasks); reuse merge's resolver
  videos     = getDayAssociatedVideos(day)
  files      = getDayAssociatedFiles(day)
  fsgui      = getDayFsGuiYamls(day)
  epochs     = sortedUnique(flatMap(tasks, t => normalizeEpochs(t.task_epochs)))   // Number()-normalized
  for each epoch e, row = {
    epoch: e,
    task:        tasks.find(t => includesEpoch(t, e)),     // the task whose task_epochs contains e
    tag:         deriveTag(task, e, occurrenceIndexOf(task, e)),   // e.g. 's1','r1' — see below
    cameras:     task?.camera_id ?? [],
    statescript: files.find(f => epochMatches(f.task_epochs, e)),       // by epoch
    videos:      videos.filter(v => epochMatches(v.task_epochs, e)),    // 0..n per epoch
    optoPower:   fsgui.find(g => epochMatches(g.task_epochs, e)),       // opto animals only
    status:      rowComplete(...) ? 'Complete' : 'Incomplete',
  }
```

- `epochMatches` honors the `task_epoch`(singular)/`task_epochs`(plural) tolerance the validation rules
  already model (`referenceRules.taskEpochReferences`, `src/validation/rules/referenceRules.ts:141`) — read
  raw, compare `Number()`-normalized. The grid does NOT rewrite the stored key spelling (that would touch
  byte-identity); it only *reads* tolerantly.
- `deriveTag`: the per-type tag (`s1`,`r1`,`s2`…) is the task's short code + its 1-based occurrence among
  that task's epochs in date/epoch order. Tag derivation feeds the *filename* derivation (below) and the
  displayed tag; it is display/derivation only — never stored as a separate field.
- Uniqueness badge reuses `duplicateTaskEpochs(tasks)` (`src/validation/taskEpochs.ts:19`).
- **Collapsed display = state, not names** — and each file column shows its *most informative* axis:
  - **Statescript → naming state** (`Generated` / `Manual`, from `isDerivedStatescript`). A statescript is
    expected for **every** epoch, so presence is uninteresting; what matters is whether the name follows the
    convention or was overridden. An Override/Revert flips this cell live.
  - **Video → presence state** (`N video` / `No video` / `Missing`, from the video 3-state). A video is
    **optional**, so the high-value grid question is "is there one (and is it intended)?" — not whether its
    name is auto vs manual. A manual video *rename* therefore does **not** change the collapsed label
    (`1 video` stays `1 video`); the generated/manual naming detail is a drill-in concern only. This
    asymmetry is intentional, not a missed wire.
  The actual filenames live only in the drill-in, so the grid stays scannable and never asks the user to
  parse paths in prime space.

**Write-back (edit):** every edit maps to an `updateDay(dayId, { … })` patch over the *same arrays*.

| Grid edit | Patch |
|---|---|
| Add epoch (task picked) | append/extend the chosen task's `task_epochs`; re-derive nothing stored |
| Reorder / move | reassign `task_epochs` integers across tasks; **confirm if it orphans** a file/video ref |
| Delete epoch | remove the epoch from its task's `task_epochs`; **confirm** before orphaning bound files/videos |
| Edit cameras | update `task.camera_id` (or the catalog task type's — animal-owned, blast-radius) |
| Per-epoch opto power/pulse | update the matching `fs_gui_yamls` row (`task_epochs`) |
| Statescript / video name | see [generated-files](#generated-files) — writes `associated_files[].path` / `associated_video_files[].name` |

Reorder/delete route through a confirm when `validateDay` *would* gain an `orphaned_file`/`orphaned_video`
issue — i.e. compute the prospective merged day and diff the gate, OR (simpler) check the bound refs
directly before applying. Never auto-scrub (orphan-visibility contract). The grid surfaces existing orphans
as rows/badges from `validateDay`, it does not erase them.

**Per-epoch drill-in** (3 groups — *What happened* / *Generated files* / *Optogenetics*) is the mockup's
restructured editor; the grouping is purely presentational (the data still lives in the day arrays). The
`⋯` row menu (Insert after / Duplicate / Move up·down / Delete) emits the same write-back patches.

---

## Data-folder + filename derivation {#data-folder-derivation}

**Contract:** [shared-contracts §6](shared-contracts.md#6-data-folder--filename-derivation). New pure module
`src/domain/fileNaming.ts` (TypeScript, strict, unit-tested):

```ts
// Convention: {experimentDate}_{subjectId}_{epoch:02d}_{tag}{ext}
//   The in-folder file names use YYYYMMDD (NOT the mmddYYYY of the DOWNLOAD filename via
//   formatDeterministicFilename). Pin the token order against the golden associated_video_files[].name
//   (20230622_sample_01_a1.1.h264 = YYYYMMDD_subject_epoch_tag.1.h264 — the convention-following target);
//   the golden associated_files are placeholders (no statescript target), so verify statescript derivation
//   against a synthetic convention-following fixture and leave the placeholders `manual`.
export function deriveStatescriptName(p: { date: string; subjectId: string; epoch: number; tag: string }): string;
export function deriveVideoName(p: { date: string; subjectId: string; epoch: number; tag: string; index?: number }): string;
export function deriveStatescriptPath(dataFolder: string, name: string): string; // join(dataFolder, name)
// Inverse: does a stored path/name match what we'd derive? (drives the generated-vs-manual chip)
export function isDerivedStatescript(file: { path?: string }, ctx): boolean;
export function isDerivedVideo(video: { name?: string }, ctx): boolean;
```

**The exact token order/case is a verification task, not a guess** — see the Phase 4 validation slice. The
verifiable golden target is the **video name**: `associated_video_files[].name = 20230622_sample_01_a1.1.h264`
= `{YYYYMMDD}_{subject}_{epoch:02d}_{tag}.1.h264`. The golden `associated_files` are **placeholders**
(`associated1.txt`, `path/`) that do NOT follow the convention, so there is no golden statescript to pin
against: `isDerivedStatescript` classifies them `manual` and they round-trip verbatim. The derivation must
reproduce, for any *convention-following* stored file, its stored value; everything else is `manual`
(explicit) and left verbatim. Either way the export is unchanged.

**Authoring flow:** when the user picks/reorders a task in the grid, for each affected epoch the editor
proposes `deriveStatescriptName`/`deriveVideoName`; on accept it writes `associated_files[].path =
deriveStatescriptPath(day.dataFolder, name)` and `associated_video_files[].name = name`. "Override name"
switches that one file to a `manual` value (stored verbatim, chip flips to `manual`). "Revert to generated"
recomputes. Scope is one file on one epoch.

---

## Generated-files states + video 3-state {#generated-files}

**Mockup:** drill-in "Generated files" panel. Three video states the UI must distinguish (the mockup proved
these under stress):

| State | Meaning | Export effect |
|---|---|---|
| `present` | a video file is bound (derived or manual name) | normal |
| `missing` | a task epoch with no bound video AND no `absent` declaration | **blocks export** — flagged by the ONE new authorized rule (`epochVideoUndeclared`, below); row status → "Needs video" |
| `absent` | the user explicitly marked "no video" for this epoch | **valid** — intentional; no issue |

`missing` vs `absent` is the crux: an epoch with no video is only a problem if it wasn't *declared*
videoless. Model `absent` as a `day.state`-level set of epoch numbers declared videoless — **off-export by
construction** (`mergeDayMetadata` reads no `day.state`, so it cannot alter exported YAML, like
`badChannelRemovalAcks`). There is **no existing rule** for "an epoch should have a video but doesn't"
(`orphaned_video`, `referenceRules.ts:188`, is the *inverse* — a video pointing at a non-existent epoch), so
Phase 4 adds the single authorized off-export rule `epochVideoUndeclared(day)`
([shared-contracts §1](shared-contracts.md#1-byte-identity-gate)): it reads the day's task epochs +
`associated_video_files` + the off-export `absent` set, and returns a blocking `RepairableIssue` per
`missing` epoch — it never touches the merged YAML. Statescript uses the generated/manual chip only (no
3-state, no new rule — a statescript is expected for every epoch; a genuine gap is an existing
`orphaned_file`/schema concern).

The "Data folder" row in the panel renders `day.dataFolder` (read-only reference; the editable field is on
the Day tab) so the panel honestly shows *where* the derived names resolve (files are not "fully
generated" — the user supplies the folder).

---

## Issue-driven readiness + field-level repair {#issue-driven-readiness}

**Mockup:** the day-editor readiness bar (quiet when clean, loud + field-linked when blocking) and
export-preview's blocked state. **Both read `validateDay`** — never a local check.

- Compute `issues = validateDay(day, mergeDayMetadata(animal, day), animal, animalDays)`.
- Blocking issues (severity error) → the loud bar lists them; each issue already carries
  `repairSurface`/`focusPath`/`step` (the `RepairableIssue` shape, normalized in `validateDay`). Render each
  as a "Fix in …" link whose target is resolved by `src/domain/repairRouting.ts`.
- Field-level landing: the link navigates to the owning surface and focuses the exact control. The
  AnimalView/DayEditor focus handlers already honor `?field=…` deep links (see `useReconfigContext`,
  `src/hooks/useReconfigContext.ts`, and the AnimalView focus effect). The redesign threads the same param;
  the cross-page case (export-preview "Fix in Epoch 1" → day editor) lands on the epoch's video control and
  scrolls/flashes it (the mockup demonstrated `#fix-e1-video`; the real version resolves the epoch+field via
  `repairRouting`).
- Export disabled while blocking: the export button's `disabledReason` comes from the gate (a non-empty
  error list), mirroring how `ExportStep`/`ValidationSummary` already gate. No new gate logic.

Day-status rollups (Animals home, Days table) read the same gate via `workflowStatus.getDayRowStatus`
(`src/domain/workflowStatus.ts`) → `dayLifecycle` labels. One gate, every surface.
