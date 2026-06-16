# Phase 4 — Epoch grid (the spine)

[← back to PLAN.md](PLAN.md) · [overview](overview.md) · [shared-contracts](shared-contracts.md) · [designs](designs.md#epoch-grid-join)

Replace the Epochs-tab bridge with the **epoch grid** — the mockup's spine. A pure join-view over the day's
arrays (and the already-live task catalog), one row per epoch, with the per-epoch drill-in (3 groups),
filename derivation, generated/manual file states, the video 3-state, epoch row actions, the template menu,
and field-level repair landing. The largest phase. Design:
[day-editor.html](day-editor.html) Epochs tab + [designs.md](designs.md#epoch-grid-join).

**Inputs to read first:**

- [designs.md#epoch-grid-join](designs.md#epoch-grid-join), [#data-folder-derivation](designs.md#data-folder-derivation), [#generated-files](designs.md#generated-files), [#issue-driven-readiness](designs.md#issue-driven-readiness).
- [src/pages/DayEditor/TasksEpochsStep.tsx](../../../src/pages/DayEditor/TasksEpochsStep.tsx) — the bridge this replaces; **shows how `day.taskInstances` is read/written** (`:125-155`) — reuse that write path.
- [src/state/workspaceUtils.ts:371](../../../src/state/workspaceUtils.ts) — `resolveDayTasks` (the catalog→inline resolver the merge uses; the grid joins on its output).
- [src/state/workspaceSelectors.ts](../../../src/state/workspaceSelectors.ts) — `getAnimalTaskTypes`, `getDayAssociatedVideos/Files`, `getDayFsGuiYamls`, `getDayTaskInstances`.
- [src/state/taskCatalogActions.ts](../../../src/state/taskCatalogActions.ts) — "+ new task type".
- [src/validation/taskEpochs.ts:19](../../../src/validation/taskEpochs.ts) — `duplicateTaskEpochs` (uniqueness badge).
- [src/validation/rules/referenceRules.ts:141](../../../src/validation/rules/referenceRules.ts) — `taskEpochReferences` (the `task_epoch`/`task_epochs` tolerance the grid must read the same way).
- [src/domain/repairRouting.ts](../../../src/domain/repairRouting.ts) + [src/hooks/useReconfigContext.ts](../../../src/hooks/useReconfigContext.ts) — field-level repair landing.
- [src/io/yaml.ts:102](../../../src/io/yaml.ts) (`formatDeterministicFilename`) + the golden `associated_video_files[].name` in `src/__tests__/fixtures/golden/20230622_sample_metadata.yml` (the convention-following target; the file's `associated_files` are placeholders) — to pin the derivation token order.

**Contracts referenced:**

- [Epoch grid = join-view](shared-contracts.md#5-epoch-grid--join-view) — storage/export unchanged; do not weaken.
- [Data-folder + derivation](shared-contracts.md#6-data-folder--filename-derivation) — derivation is additive; existing paths preserved.
- [Byte-identity gate](shared-contracts.md#1-byte-identity-gate). Phase 0 `GeneratedValue`, `EpochStatusPill`, `UndoToast`.

## Tasks

- `src/viewModels/epochGridViewModel.ts` (pure, TS, React-free): `buildEpochGrid(animal, day)` per [designs.md#epoch-grid-join](designs.md#epoch-grid-join) — joins resolved tasks + videos + files + fs_gui by epoch into `{ epoch, task, tag, cameras, statescript, videos, optoPower, status }[]`. Read `task_epochs` tolerantly (`Number()`-normalized; honor singular/plural like `taskEpochReferences`) — **never rewrite the stored key spelling**. Uniqueness via `duplicateTaskEpochs`. Unit-tested against fixtures incl. the golden day (the join must round-trip the golden `tasks`/`files`/`videos` without reshaping them).
- `src/domain/fileNaming.ts` (pure, TS): `deriveStatescriptName`/`deriveVideoName`/`deriveStatescriptPath` + `isDerivedStatescript`/`isDerivedVideo` per [designs.md#data-folder-derivation](designs.md#data-folder-derivation). **Pin the token order/case empirically (open-question #1):** the golden `associated_video_files[].name` IS a derivation target (`20230622_sample_01_a1.1.h264` = `{YYYYMMDD}_{subject}_{epoch:02d}_{tag}.1.h264`) — assert `deriveVideoName` reproduces it. **The golden `associated_files` are placeholders (`associated1.txt`, `path/`) that do NOT follow the convention**, so there is no golden statescript to pin against: `isDerivedStatescript` (correctly) classifies them `manual` and they round-trip verbatim (baselines stay green). Verify statescript derivation against an added fixture day whose statescripts DO follow the convention (or, if none is added, document that statescript derivation is exercised only by synthetic fixtures, not the golden baseline).
- Epochs-tab grid component: render the grid (columns #, Task, Camera(s), Statescript, Video(s), Opto mW, Pulse ms, Status). Caret is a real `<button aria-expanded aria-controls>`; task cell also activates expand (keyboard-operable). **The Statescript/Video cells show file STATE labels, NOT filenames** — and each shows its *most informative* axis ([designs.md#epoch-grid-join](designs.md#epoch-grid-join)): **Statescript → naming** (`Generated` / `Manual`, since a statescript is expected for every epoch); **Video → presence** (`N video` / `No video` / `Missing`, since a video is optional). Names live only in the drill-in. `EpochStatusPill` for the row status (`Complete`/`Incomplete`/`Needs video`).
- Per-epoch drill-in (3 groups — *What happened* / *Generated files* / *Optogenetics*): the restyled editor. *What happened* = task picker (`getAnimalTaskTypes` + "+ new task type" via `taskCatalogActions`), environment, cameras. *Generated files* = the tinted panel: read-only data-folder reference (`day.dataFolder`), statescript `GeneratedValue` (derived/manual + Override name), video 3-state. *Optogenetics* = per-epoch power/pulse (writes the matching `fs_gui_yamls` row) + protocol context (read-only, set on Day tab).
- Write-back: each edit maps to an `updateDay` patch over the existing arrays per the [designs table](designs.md#epoch-grid-join). Picking/reordering a task writes `day.taskInstances` (reuse the `TasksEpochsStep` write path). **The collapsed grid's file-state cells re-derive from the same source as the drill-in** — a statescript Override/Revert **must update the collapsed `Generated`↔`Manual` cell immediately**, and a video presence change (present/missing/absent) **must update the collapsed `N video`/`No video`/`Missing` cell** (collapsed grid and drill-in never disagree on *their* axis). A video *rename* does **not** change the video cell — it's presence-only by design (above). **Confirm-before-orphaning** on reorder/delete that would strand a file/video ref (compute the bound refs; never auto-scrub). The grid surfaces existing orphans from `validateDay`, doesn't erase them.
- Video 3-state ([designs.md#generated-files](designs.md#generated-files)): `present` (bound name) · `missing` (a task epoch with no bound video AND no `absent` declaration) · `absent` (explicit "no video", valid). Store `absent` as a `day.state`-level set of videoless epoch numbers (**off-export** — `mergeDayMetadata` reads no `day.state`, so it cannot move a baseline; resolves open-question #2).
- **Video-declaration readiness rule** (the ONE authorized new rule — [shared-contracts §1](shared-contracts.md#1-byte-identity-gate)): add a day-scoped check `epochVideoUndeclared(day)` that returns a blocking issue for each `missing` epoch (task epoch with no `associated_video_files` entry and not in the `absent` set). It **adds an `RepairableIssue` only — it reads `day` arrays + the off-export `absent` set, never the merged YAML** — so it cannot change export. Surface it through the same path as other day issues (compose it into the day's readiness; if `validateDay` is the composition point, add it there as a day-readiness issue that the existing severity machinery already carries — confirm it does not enter `validate(mergedDay)`, which is export-shaped). Row status for a `missing` epoch → `Needs video` ([§3](shared-contracts.md#3-status-vocabulary)). `present`/`absent` are clean. Statescript uses the generated/manual chip only (no 3-state, no new rule — a statescript is expected for every epoch and any genuine gap is an existing `orphaned_file`/schema concern).
- Epoch row `⋯` menu (Insert after / Duplicate / Move up·down / Delete) — plain text, no emoji; Delete fires `UndoToast`. Template menu (`+ from template ▾`: Sleep day / W-track day / Copy structure from {date} / Blank) writes the corresponding `taskInstances`/`task_epochs`.
- Field-level repair: a blocking-issue "Fix in Epoch N" link (from the readiness bar / export-preview) lands on the epoch, expands it, and focuses + flashes the offending control, resolving epoch + field via `repairRouting` (the cross-page case is the mockup's `#fix-…` made real).
- Retire `TasksEpochsStep.tsx` (the bridge) + `TaskInstancesTable.tsx`/`CamerasUsedSection.tsx` if fully subsumed by the grid (name them in the PR; keep any still used elsewhere).
- CHANGELOG: epoch grid + data-folder filename derivation.

## Deliberately not in this phase

- The export-preview screen ([Phase 5](phase-5-export-preview.md)) — the in-grid readiness lives on the Day frame (Phase 3); export download is Phase 5.
- Day / Failed-channels / DIO tabs ([Phase 3](phase-3-day-frame-tabs.md)).
- Import-side file authoring ([Phase 7](phase-7-import-copy.md)) — imported days keep explicit paths (`manual`).

## Validation slice

| Test | Asserts |
| --- | --- |
| `epochGridViewModel.test.ts` | join builds one row/epoch; tag derivation (`s1`/`r1`); tolerant `task_epoch(s)` read; golden day round-trips arrays unchanged; uniqueness badge from `duplicateTaskEpochs` |
| `fileNaming.test.ts` | `deriveVideoName` **reproduces the golden `associated_video_files[].name`** (token order pinned); the golden `associated_files` (placeholders) classify `manual` (`isDerivedStatescript=false`) and round-trip verbatim; statescript derivation verified against a synthetic convention-following fixture; `deriveStatescriptPath` joins folder+name |
| `epochGrid.writeback.test.tsx` | each grid edit emits the expected `updateDay` patch; pick/reorder writes `taskInstances`; reorder/delete that would orphan a ref prompts confirm; no auto-scrub |
| `epochVideoUndeclared.test.ts` | `missing` epoch → a blocking readiness issue; `present`/`absent` → none; **the rule reads no `mergedDay`** and the day's `mergeDayMetadata` output is byte-identical with and without the issue present |
| `epochGrid.video3state.test.tsx` | `present`→normal; `missing`→blocked + row `Needs video`; `absent`→valid; toggling video state never changes the day's merged YAML |
| `epochGrid.a11y.test.tsx` (jest-axe) | caret is a focusable `<button aria-expanded>`; grid keyboard-operable; zero violations |
| `baselines` | **byte-identical**: editing the golden day through the grid (then `mergeDayMetadata`) reproduces the golden YAML; derivation produces the stored paths; `absent`/`dataFolder`/`taskInstances` don't leak into export |

## Fixtures

The golden `20230622_sample_metadata.yml` parsed into a workspace day (for derivation + byte-identity); a
catalog-shaped day (`taskInstances`) and an inline day (legacy `tasks`) to prove the join handles both; an
opto day (per-epoch power column + fs_gui rows); a day with a deliberately orphaned file ref (confirm-flow).

## Review

Dispatch `code-reviewer`. Confirm: the grid is a pure view-model + thin component (no merge/validation
reimpl); derivation is verified against the golden **video name** + a synthetic convention-following statescript fixture (not a placeholder `associated_files` path); reorder/delete confirm-before-
orphan and never auto-scrub; video 3-state distinguishes missing (blocking) from absent (valid) and `absent`
is off-export; `npx vitest run baselines` **byte-identical**; the bridge step is removed; lint/typecheck/
e2e/axe green.
