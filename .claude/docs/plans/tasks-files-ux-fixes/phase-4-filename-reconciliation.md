# Phase 4 — Reconcile derived filenames on task reassignment

[← back to PLAN.md](PLAN.md) · [overview](overview.md) · [shared-contracts §1](shared-contracts.md#1-severity-vocabulary)

Reassigning an epoch's task changes its expected tag (Sleep→`s`, run→`r`), but the epoch's
**auto-derived** statescript/video filenames keep the old tag — and because the grid derives the
displayed tag *from the existing filename first*
([epochGridViewModel.ts:247-250](../../../../src/viewModels/epochGridViewModel.ts)), a Sleep epoch can
display tag `w1` and ship a video named `..._w1...` with no warning (observed live). Finding #5. This
phase detects the mismatch, surfaces it as a `review` state, and offers a one-click re-derive that
touches only `generated` files (never `manual` ones).

**Inputs to read first:**

- [shared-contracts §1](shared-contracts.md#1-severity-vocabulary) — the `review` tier this phase
  feeds (`filenameTagMismatch`).
- [src/viewModels/epochGridViewModel.ts:147-178,220-250](../../../../src/viewModels/epochGridViewModel.ts)
  — `extractFileTag`, `tagFromExistingFiles`, `tagShortCode`, and the `fallbackTagByEpoch` map. The
  **fallback** tag (task-derived: `tagShortCode(taskName) + occurrence`) is the "correct for the
  current task" tag; the displayed `tag` may be the stale file tag. The mismatch is
  `fallbackTagByEpoch.get(epoch) !== tagFromExistingFiles(statescript, videos)` when the latter is
  non-null.
- [src/domain/fileNaming.ts](../../../../src/domain/fileNaming.ts) — `deriveStatescriptName/Path`,
  `deriveVideoName`, `isDerivedStatescript`, `isDerivedVideo`. Re-derive uses these with the
  **fallback** tag.
- [src/pages/DayEditor/EpochsTab.tsx:313-316,460-516](../../../../src/pages/DayEditor/EpochsTab.tsx) —
  `reassignTask`, and the statescript/video write helpers + `GeneratedValue` "Revert to generated"
  path that already re-derives a single file (`onStatescriptRevert`/`onVideoRevert`,
  `EpochsTab.tsx:830-873`) — the re-derive arithmetic to reuse.
- [src/pages/DayEditor/EpochsTab.tsx:893-912](../../../../src/pages/DayEditor/EpochsTab.tsx) — the
  `ConfirmDialog` + `pendingOrphan` pattern; the reconcile confirm mirrors it.

## Tasks

- **Detect the mismatch (view-model).** In `buildEpochGrid` add a derived row field
  `filenameTagMismatch: boolean` = there exists a `generated`/derived statescript or video on the
  epoch whose embedded tag differs from `fallbackTagByEpoch.get(epoch)` (the current task's expected
  tag). Use `extractFileTag` on the stored names and compare to the fallback tag. A `manual` file
  never counts (its name is intentional). Fold `filenameTagMismatch` into `gateState`'s `review`
  branch ([shared-contracts §1](shared-contracts.md#1-severity-vocabulary)).
- **Surface it.** On the row, when `filenameTagMismatch`, show a `review`-tone badge "Name ≠ task"
  near the task identity (`EpochsTab.tsx:1064-1074`, beside the `duplicate` badge) with a title
  explaining "This epoch's files are named for a different task (tag `<old>`); the task is now
  `<taskName>` (expected `<new>`)." In the drawer Files section header (`EpochsTab.tsx:1239-1243`),
  when mismatched, replace "needs review" with an actionable line + a "Rename files to match task"
  button.
- **Repair is an explicit action, detection is deferred to the next render (avoids stale grid).**
  Do **not** read the current `grid`/`fallbackTagByEpoch` synchronously inside `reassignTask`
  (`EpochsTab.tsx:313-316`) to decide whether to prompt — after `commit(...)` the local `grid` is still
  the *pre-reassignment* render (the `updateDay` is async). Instead: the view-model field
  `filenameTagMismatch` (recomputed every render from current state) becomes `true` on the next render,
  which surfaces the badge + the drawer "Rename files to match task" button. **That button is the
  repair entry point** — it reads the now-current row.
- **Re-derive on the button (confirm-gated, generated-only, undoable).** "Rename files to match task"
  opens a confirm (reuse the `ConfirmDialog` + `pendingRederive` pattern at `EpochsTab.tsx:893-912`) —
  *not* an auto-rewrite. Message: "Epoch N is now <task>. Rename its auto-named files from
  `…_<oldtag>…` to `…_<newtag>…`? Manually-named files are left as-is." Confirm → for each `generated`
  statescript/video on the epoch, recompute name/path with the **current** expected tag via
  `deriveStatescriptPath`/`deriveVideoName` (the single-file arithmetic in `onStatescriptRevert`/
  `onVideoRevert`, applied across the epoch's derived files) and `onFieldUpdate` the arrays, wrapped in
  an `useUndoToast` snapshot. Cancel → names kept; the `review` badge persists.
- **Optional proactive prompt — if added, compute from the proposed task, not the grid.** If a
  prompt-on-reassign is wanted (rather than waiting for the badge), compute the new expected tag inside
  `reassignTask` from the **proposed** task name (`tagShortCode(taskTypeFor(nextTaskTypeId).task_name)`
  plus occurrence) and compare to the existing files' `extractFileTag`. Never derive it from the stale
  `grid`. Default recommendation: ship the deferred badge + button only; add the prompt later if users
  miss the badge.

## Deliberately not in this phase

- Changing how the *displayed* tag is derived (file-first vs task-first) — that file-first rule is
  intentional ("imported names are authoritative"); this phase makes the consequence **visible and
  fixable**, it does not flip the precedence.
- Renaming on *every* task edit automatically — re-derive is always user-confirmed (a derived name the
  user already accepted is not silently rewritten).
- Touching `manual` files — they are never re-derived.

## Validation slice

| Test | Asserts |
| --- | --- |
| `epochGridViewModel` — `filenameTagMismatch` | A Sleep epoch whose only video is named `…_w1…` (run tag) → `true`; a Sleep epoch with a `…_s1…` video → `false`; a `manual`-named file → `false`; no files → `false`. |
| `epochGridViewModel` — `gateState` review | A mismatch with no blocking state → `gateState === 'review'`. |
| `EpochsTab` — reassign raises confirm | Reassigning an epoch with a derived stale-tag file opens the reconcile confirm; cancelling leaves names unchanged and the "Name ≠ task" badge present. |
| `EpochsTab` — confirm re-derives generated only | Confirming rewrites the `generated` statescript/video names to the new tag; a `manual` file in the same epoch is untouched; an undo toast restores the prior arrays. |
| `baselines` | byte-identical (re-derive only fires on user action; no fixture triggers it). |

## Fixtures

A synthesized day where epoch 1 is assigned `Sleep` but carries a `generated` video named with a `w`
(run) tag, plus a sibling `manual`-named file on the same epoch — exercises detect, the confirm, and
the manual-preservation guarantee. No real-data slice (pure logic + component).

## Review

Dispatch `code-reviewer` against the diff. Confirm:
- Re-derive touches only `isDerived*`-classified files; `manual` names are provably preserved (test).
- The reconcile is confirm-gated and undoable; nothing auto-rewrites.
- The mismatch is visible (badge) even when the user declines — no silent stale tag.
- "Deliberately not in this phase" honored (tag-precedence rule unchanged).
- `baselines` byte-identical; no plan references in code/tests.
