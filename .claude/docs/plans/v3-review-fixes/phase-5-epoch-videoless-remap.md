# Phase 5 — Epoch `videolessEpochs` remap & restore

[← back to PLAN.md](PLAN.md) · [overview](overview.md)

When epochs are renumbered (insert/move) or deleted, the day's bound `associated_video_files` /
`associated_files` / `fs_gui_yamls` are remapped in lockstep — but the off-export
`day.state.videolessEpochs` set (the "no video recorded" declarations) is NOT remapped, and the
delete-undo snapshot omits it. A stale videoless number then annotates the WRONG epoch, and the
video-readiness validation treats it as an intentional "no video here" — so an epoch that needs a
video can read as complete (or vice-versa). No exported bytes change (it's `day.state`), but readiness
is wrong.

**Inputs to read first:**

- [src/pages/DayEditor/EpochsTab.tsx:188-225](../../../../src/pages/DayEditor/EpochsTab.tsx) — `renumberCommit` (remaps videos/files/fs_gui via `remapEpochRefs`, NOT videoless), `onInsertAfter`/`onMove` (renumber callers), and `onDelete` (snapshots instances/videos/files for undo, NOT videoless).
- [src/domain/epochOperations.ts](../../../../src/domain/epochOperations.ts) — `remapEpochRefs`, `insertAfterRemap`, `swapEpochRemap`, `removeEpoch` (the pure remap helpers; videoless is currently outside their scope).
- [src/domain/epochVideoValidation.ts:70-80](../../../../src/domain/epochVideoValidation.ts) — `declaredVideoless = new Set(getDayVideolessEpochs(day))`; epochs in it are filtered out of "needs video" (treated as intentional). The consumer of the stale set.
- [src/pages/DayEditor/EpochsTab.tsx:296-304](../../../../src/pages/DayEditor/EpochsTab.tsx) — `setVideoless` writes `state.videolessEpochs` (the shape: `{ ...state, videolessEpochs: number[] }`).

## Tasks

- **Remap `videolessEpochs` in renumber.** Extend `remapEpochRefs` (or `renumberCommit`) so the
  `state.videolessEpochs` numbers are remapped by the same `remap: Map<number,number>` as the bound
  refs — an epoch's "no video" declaration follows it to its new number. Write the remapped
  `state.videolessEpochs` via `onFieldUpdate('state', { ...state, videolessEpochs })` only when it
  actually changes (mirror the existing `JSON.stringify` guards). Numbers not in the remap stay as-is.
- **Drop stale entries on delete.** In `onDelete`, after `removeEpoch`, also drop the deleted epoch's
  number from `state.videolessEpochs` (a deleted epoch can't be "declared videoless"), and **include
  the pre-delete `state.videolessEpochs` in the undo snapshot** so Undo restores it alongside
  instances/videos/files.
- **Decide remap ownership.** Prefer extending the pure `epochOperations` remap so the logic is
  unit-testable without React (the component already delegates remap to it). If videoless must be
  remapped in the component, keep it adjacent to the existing ref-remap block and covered by a
  component test.
- **Docs.** CHANGELOG "Fixed": "no video recorded" declarations now follow their epoch through
  insert/move/delete (and are restored on undo), so video-readiness no longer mis-reports after an
  epoch renumber.

## Deliberately not in this phase

- Any change to the exported YAML shape — `videolessEpochs` is off-export `day.state`; this phase
  must not alter `associated_video_files` bytes (assert baselines).
- The epoch-grid join/write-back logic beyond the videoless set.

## Validation slice

| Test | Asserts |
| --- | --- |
| `epochOperations`/EpochsTab unit (new) | after insert/move that renumbers epoch N→M, a videoless declaration on N becomes M (follows its epoch); unrelated numbers unchanged |
| delete + undo test (new) | deleting an epoch drops its videoless entry; Undo restores the exact pre-delete `videolessEpochs` set (snapshot includes it) |
| `epochVideoValidation` test (new) | after a renumber, the rule reads the REMAPPED videoless numbers (the right epoch is treated as intentionally video-less, not a stale one) |
| `baselines` + an `encodeYaml` assert | exported `associated_video_files` bytes are unchanged by a videoless remap (off-export state only) |

## Fixtures

Synthesize a day with `taskInstances` over epochs 1–3, one bound video on epoch 2, and
`state.videolessEpochs:[1]`; exercise insert-after-1 (1,2,3 → shifts), move 2↔3, and delete 1.

## Review

Dispatch `code-reviewer` against the diff. Confirm:
- The videoless set follows its epoch through insert/move/delete and is restored on undo; the remap is unit-tested (ideally in the pure layer).
- No exported-byte change (`baselines` byte-identical; the `encodeYaml` video-bytes assert passes).
- `epochVideoValidation` now reads the remapped numbers; full gate green; no trivial tests; CHANGELOG updated.
