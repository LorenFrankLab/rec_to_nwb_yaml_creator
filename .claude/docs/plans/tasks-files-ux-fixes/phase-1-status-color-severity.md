# Phase 1 — Severity-driven status & color (calm the wall of red)

[← back to PLAN.md](PLAN.md) · [overview](overview.md) · [shared-contracts §1](shared-contracts.md#1-severity-vocabulary)

Make every color on the grid mean its export consequence — for the **non-video** dimensions. Two
corrections at once: (a) stop using **error-red** for things that don't block export (the drawer pill
reads "Complete" on epochs the gate fails; duplicate/undeclared-video states under-signal), and (b)
treat a missing **statescript** as the loud warning it is — corpus shows run statescripts are
near-universal and missing ones are genuine omissions — **without** screaming on the sleep epochs that
labs intentionally leave unlogged. Findings #1 (statescript), #4 (pill), #8 (zero-count filters), #6
(statescript-add gating).

**Statescript = warning, expectation is carry-forward** (see
[shared-contracts §1](shared-contracts.md#1-severity-vocabulary), "Statescript expectation"): a missing
statescript is a **loud warning (amber, not red, never a hard block)** on every **run/task** epoch, and
on **sleep** epochs **only when this animal's prior same-config days logged sleep statescripts**;
otherwise sleep stays quiet ("optional"). This is presentation-only — **not** a new `validateDay` rule.

The **video camera** dimension of the color/pill story is owned wholly by
[Phase 2](phase-2-video-camera-repair.md) — see "Deliberately not in this phase". This keeps each PR a
complete unit (no "Select camera" blocker shipped without its control).

**Inputs to read first:**

- [shared-contracts §1](shared-contracts.md#1-severity-vocabulary) — the tiers + `gateState`; note the
  phasing line (P1 implements `status`/`duplicate`/`manual`; video terms are P2).
- [shared-contracts §3](shared-contracts.md#3-parity) — the parity rule for any `blocking` dimension.
- [src/viewModels/epochGridViewModel.ts:231-298](../../../../src/viewModels/epochGridViewModel.ts) —
  the per-row build; where `gateState` is derived. `status`/`videoPresence`/`statescriptNaming` exist
  and stay as-is.
- [src/pages/DayEditor/EpochsTab.tsx:1032-1156](../../../../src/pages/DayEditor/EpochsTab.tsx) —
  `EpochRowBlock`: collapsed file-summary chips (`:1042-1053`).
- [src/pages/DayEditor/EpochsTab.tsx:606-682](../../../../src/pages/DayEditor/EpochsTab.tsx) — the
  summary filter strip (always-rendered chips, incl. zero counts; statescript chip uses the red
  `summaryNeedsAttention`).
- [src/pages/DayEditor/EpochsTab.tsx:1179-1226](../../../../src/pages/DayEditor/EpochsTab.tsx) — the
  drawer-header file-state labels + the `EpochStatusPill` use at `:1226`.
- [src/components/ui/StatusPill.tsx:53-87](../../../../src/components/ui/StatusPill.tsx) —
  `EpochStatusPill` vocabulary (`complete|incomplete|needs_video`).
- [src/pages/DayEditor/EpochsTab.tsx:662-663,1273](../../../../src/pages/DayEditor/EpochsTab.tsx) — the
  bulk "Statescripts (N)" disabled-without-data-folder gate vs the always-enabled per-epoch "Add
  expected statescript".
- [src/pages/DayEditor/EpochsTab.tsx:918-930](../../../../src/pages/DayEditor/EpochsTab.tsx) —
  `priorDayInstances()`: the existing prior-same-`configurationVersion`-day walk over `animalDays`.
  Reuse this shape to compute `expectSleepStatescripts` (does any prior same-config day bind a
  statescript to a sleep epoch?).
- [src/viewModels/epochGridViewModel.ts:147-178,226](../../../../src/viewModels/epochGridViewModel.ts)
  — `tagShortCode` (`/\bsleep\b/i`) and the per-row task — the sleep test `statescriptExpected` reuses.

**Contracts referenced:** [Severity vocabulary](shared-contracts.md#1-severity-vocabulary) (implement
the non-video terms; do not weaken `blocking`); [parity](shared-contracts.md#3-parity).

## Tasks

- **View-model — `statescriptExpected` + `gateState`.** Add both to `EpochGridRow` (type at
  `epochGridViewModel.ts:60-95`). `statescriptExpected = isSleepTask(taskName) ? expectSleepStatescripts
  : true`, where `isSleepTask` reuses `tagShortCode`'s `/\bsleep\b/i` test and `expectSleepStatescripts`
  is a new input to `buildEpochGrid` (default `false` → sleep quiet on day 1 / no history). Compute
  `gateState` in the row map (`:231-295`) from the dimensions P1 owns: `blocking` ⇐ `status ===
  'needs_video' || duplicate`; `review` ⇐ `statescriptNaming === 'manual' || (statescript == null &&
  statescriptExpected)`; else `ok` if `status === 'complete'`, else `todo`. Mark the seam where P2 adds
  the `videoCameraState` terms (a comment, not a stub). Existing fields unchanged.
- **EpochsTab computes `expectSleepStatescripts` (carry-forward).** Reusing the `priorDayInstances()`
  walk (`EpochsTab.tsx:918-930`): `expectSleepStatescripts` = across the animal's prior
  same-`configurationVersion` days, does any sleep epoch have a bound statescript? (resolve each prior
  day's grid via `resolveDayCatalogView` + its `associated_files`/sleep tasks.) Pass it into
  `buildEpochGrid`. This is the only cross-day read P1 adds.
- **Statescript chip — expectation-driven (loud warning, not red, not silent).** In `EpochRowBlock`
  (`EpochsTab.tsx:1042-1047`) and the drawer-header file-state (`:1179-1201`): `generated` →
  `fileSummaryReady`; `manual` → `fileSummaryReview` (amber); **missing + `statescriptExpected`** →
  `fileSummaryReview` (amber) "Statescript: Missing"; **missing + not expected** (sleep, no history) →
  neutral `fileSummaryTodo` "Statescript: optional". Never the error-red `fileSummaryMissing` for a
  statescript (statescript-missing does not block export).
- **Section-level loud signal + repair.** When any epoch has a missing **expected** statescript, show a
  prominent amber warning strip in the Epochs section (near the toolbar): "N expected statescripts not
  added" with the existing "Generate missing → Statescripts (N)" as the one-click repair
  (`EpochsTab.tsx:654-668`). This is the "loud" part — visible without opening a drawer — and stays
  presentation-only (no `validateDay` rule, export not blocked). Count = epochs with `statescript ==
  null && statescriptExpected`.
- **Drawer header pill from the gate (#4), non-video dims.** Feed `EpochStatusPill` the gate-aware
  state instead of raw `row.status`. Add a `needs_fixing` member to `EpochStatusPill`
  (`StatusPill.tsx:53-66`, label "Needs fixing", error/warning class) and map `row.gateState`:
  `blocking` → `needs_fixing`; `todo`/`incomplete` → `incomplete`; `ok` → `complete`; (`needs_video`
  is folded into `blocking`). After P1 the pill no longer reads "Complete" for a duplicate epoch or an
  undeclared-missing video; P2 extends `blocking` to also catch the camera case.
- **Statescript-missing count = expected-only (#1 + #8).** Redefine `missingStatescriptCount`
  (`EpochsTab.tsx:531`) from `row.statescript == null` to `row.statescript == null &&
  row.statescriptExpected` — so the count and its `missing-statescript` filter cover *omissions*, not
  intentionally-unlogged sleep. Tone the chip `summaryReview` (amber warning), not red.
- **Hide zero-count filter chips (#8).** In the summary strip (`EpochsTab.tsx:619-651`) render the
  `needs-video`, `missing-statescript`, and `custom-filenames` chips only when their count `> 0`
  (always keep the "N epochs" total). `needs-video` keeps `summaryNeedsAttention` (blocking);
  `missing-statescript` + `custom-filenames` use `summaryReview` (warning). The existing `changeFilter`
  (`:562-567`) already falls back to `all` when the active filter empties.
- **CSS (`EpochsTab.module.css`):** add `fileSummaryTodo` (neutral `--color-grey-*`, for the "optional"
  sleep statescript) beside the existing chip classes, and a `statescriptWarning` strip class
  (`--color-warning*`) for the section-level loud signal. Reuse `summaryReview` (already warning-toned)
  for the toolbar chip. No new magic numbers; tokens only (stylelint).
- **(#6) statescript-add gating consistency.** The per-epoch "Add expected statescript"
  (`EpochsTab.tsx:1273`) is enabled while the bulk "Statescripts (N)" is disabled when
  `!grid.dataFolder` (`:662-663`). Gate the per-epoch add the same way (disabled + tooltip "Set the
  data folder in Daily Setup first"); keep "Enter manually" enabled (a manual path needs no folder).

## Deliberately not in this phase

- **The entire video camera dimension** — `videoCameraState`, the "Select camera"/"Camera missing"
  chip states, the in-drawer camera select, and folding the camera terms into `gateState`/the pill —
  is [Phase 2](phase-2-video-camera-repair.md). P1's `gateState` intentionally omits the camera terms
  (the seam comment marks where P2 adds them); the pill therefore catches duplicate + needs-video now,
  and the camera case after P2. This split is deliberate so neither phase ships a blocker without its
  fix control.
- The tag-vs-task `review` state — [Phase 4](phase-4-filename-reconciliation.md) folds it in.
- Any change to `validateDay` or the export.

## Validation slice

| Test | Asserts |
| --- | --- |
| `epochGridViewModel` — `statescriptExpected` | run/task epoch → `true`; sleep epoch with `expectSleepStatescripts=false` → `false`; sleep epoch with `expectSleepStatescripts=true` → `true`. |
| `epochGridViewModel` — `gateState` (P1 dims) | `needs_video`/duplicate → `blocking`; `manual` statescript → `review`; missing **expected** statescript → `review`; missing **un-expected** (sleep, no history) → `todo`; complete + convention → `ok`. |
| `epochGridViewModel` — parity (P1 dims) | Epochs the model marks `blocking` for needs-video/duplicate ⇔ `validateDay` emits `epochVideoUndeclared`/`duplicate_task_epoch` ([§3](shared-contracts.md#3-parity)). (Statescript warning is presentation-only — explicitly NOT in the parity set.) |
| `epochGridViewModel` — existing fields unchanged | `status`/`videoPresence`/`statescriptNaming`/`tag` snapshot for a fixture day is byte-identical to pre-change. |
| `EpochsTab` — `expectSleepStatescripts` carry-forward | An animal whose prior same-config day binds a statescript to a sleep epoch → sleep epochs flag missing; an animal with no such history → sleep stays "optional" (quiet). Different `configurationVersion` is not consulted. |
| `EpochsTab` — run omission is loud, not red | A fresh day's run epochs with no statescript render the **amber** "Statescript: Missing" chip + the section "N expected statescripts not added" strip; **0** error-red statescript chips; export not blocked. |
| `EpochsTab` — sleep quiet by default | Day 1 (no history): sleep epochs show neutral "Statescript: optional", not a warning. |
| `EpochsTab` — pill honest | A duplicate / undeclared-missing-video epoch shows the pill "Needs fixing", not "Complete". |
| `EpochsTab` — zero-count filters hidden | With 0 needs-video + 0 custom-filenames, only "N epochs" (+ any non-zero) chips render. |
| `baselines` | `npx vitest run baselines` byte-identical. |

## Fixtures

Reuse the existing epoch-grid view-model fixtures + golden fixtures. Add synthesized fixtures for: a
day with a duplicate epoch + a missing run statescript (exercises `blocking` + the expected-statescript
`review`); a sleep epoch on **day 1** (no history → `todo`/quiet); and a **two-day animal** whose day-1
sleep epoch carries a statescript, asserting day 2's sleep epochs then flag missing
(`expectSleepStatescripts` carry-forward). No real-data slice (pure presentation/logic).

## Review

Dispatch `code-reviewer` against the diff. Confirm:
- Non-video `gateState` dims correct; the P2 seam is a marked comment, not a half-stub.
- Statescript severity matches the corpus rule: run-missing = amber warning; sleep-missing = warning
  **only** with carry-forward history, else quiet; **never** red; **never** a hard block / `validateDay`
  rule (export still allowed with missing statescripts).
- `expectSleepStatescripts` consults only prior **same-`configurationVersion`** days.
- "Deliberately not in this phase" honored — no camera state/control, no `validateDay` edit.
- The parity test for P1's *blocking* dims passes (no drift); the statescript warning is excluded from
  parity (presentation-only); `baselines` byte-identical.
- The loud-not-red test counts error-class elements = 0 on a fresh run day (not a mock assertion).
- No plan references in code/tests; new CSS uses tokens (stylelint clean).
