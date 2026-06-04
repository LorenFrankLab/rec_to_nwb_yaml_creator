# Phase 10.5 — Pre-cutover cleanup

[← back to PLAN.md](PLAN.md) · [overview](overview.md) · [shared-contracts](shared-contracts.md)

Goal: clear the small accessibility and correctness follow-ups that Phases 3–9 deferred and that Phase
10 did not absorb, so [Phase 11](phase-11-cutover-v3.md) flips the cutover on a clean base. This phase
is a **grab-bag of independent fixes**, not a feature: finish migrating the last dialogs onto the shared
`<Modal>`, give destructive confirms the right role, close one contrast gap, and resolve the two
correctness items that touch data integrity (inherited behavioral events in the YAML merge; the
reconfig versioning two-action atomicity). The remaining tech-debt/UX niceties are explicitly **not**
in scope (they may slip past v3.0.0) — see "Deliberately not in this phase".

These items are the consolidated **Phase 10.5** list in [overview.md](overview.md#deferred-follow-ups).

**Depends on:** [Phase 3](phase-3-shared-modal-feedback.md) (the `<Modal>` / `ConfirmDialog` primitives),
[Phase 5/6](phase-6-legacy-byteorder-parity.md) (the byte-parity export path — Task 4 must preserve or
deliberately regenerate it), and [Phase 9](phase-9-probe-reconfig-wizard.md) (the reconfig store actions
for Task 5).

**Inputs to read first:**

- [src/components/Modal/Modal.jsx](../../../../src/components/Modal/Modal.jsx) and
  [src/components/Modal/index.js](../../../../src/components/Modal/index.js) — the shared dialog
  primitive (focus trap, focus return, ESC, scroll-lock, `role` prop accepting `'dialog'|'alertdialog'`)
  and its [contract](shared-contracts.md#modal-primitive-contract). Tasks 1–2 consume it; they do **not**
  modify it.
- [src/components/Modal/ConfirmDialog.jsx](../../../../src/components/Modal/ConfirmDialog.jsx) — already
  has a `destructive` prop but renders `role="dialog"`. Task 2 makes it pass `role="alertdialog"` when
  `destructive` is true. Grep every caller (`ConfirmDialog`, `confirm`-style usages) to confirm no
  caller relies on `role="dialog"`.
- [src/pages/AnimalEditor/ChannelMapEditor.jsx](../../../../src/pages/AnimalEditor/ChannelMapEditor.jsx),
  [src/pages/AnimalEditor/CopyFromAnimalDialog.jsx](../../../../src/pages/AnimalEditor/CopyFromAnimalDialog.jsx)
  (uses `<dialog open>` without `showModal()`), and
  [src/components/CalendarDayCreator/CalendarDayCreator.jsx](../../../../src/components/CalendarDayCreator/CalendarDayCreator.jsx)
  (inline card carrying `role="dialog"`) — the three overlay surfaces Task 1 migrates onto `<Modal>`.
  Compare against an already-migrated example: [src/pages/AnimalEditor/CameraModal.jsx](../../../../src/pages/AnimalEditor/CameraModal.jsx).
- [src/components/CalendarDayCreator/CalendarDayCreator.css](../../../../src/components/CalendarDayCreator/CalendarDayCreator.css)
  — Phase 10 swept the `#2196f3` literal to `var(--color-primary)`; Task 3 audits the remaining
  day-number / muted-text pairs against AA.
- [src/state/workspaceUtils.js:101+](../../../../src/state/workspaceUtils.js) — `mergeDayMetadata`. It
  emits `behavioral_events: day.behavioral_events` only; it does **not** concatenate
  `animal.behavioral_events`. Task 4 reconciles this with the Tasks & Epochs UI. **Parity-critical: any
  change here can alter export bytes** (see Contracts).
- [src/pages/DayEditor/TasksEpochsStep.jsx](../../../../src/pages/DayEditor/TasksEpochsStep.jsx) and
  [src/pages/DayEditor/BehavioralEventsDisplay.jsx](../../../../src/pages/DayEditor/BehavioralEventsDisplay.jsx)
  — where the animal's `behavioral_events` are shown as inherited/read-only. Task 4 either makes the
  merge match this display, or relabels the display to match the merge.
- [src/state/useWorkspace.js](../../../../src/state/useWorkspace.js) — `addConfigurationSnapshot`
  (assigns `version = configurationHistory.length + 1`) and `applyConfigurationForward`. Task 5 makes
  `addConfigurationSnapshot` return the created version.
- [src/pages/DayEditor/ReconfigWizard.jsx](../../../../src/pages/DayEditor/ReconfigWizard.jsx) — the
  `handleApply` path that predicts `newVersion = configurationHistory.length + 1` then calls the two
  actions in sequence (the orphan-snapshot risk Task 5 removes).

**Contracts referenced:**

- [`<Modal>` primitive contract](shared-contracts.md#modal-primitive-contract) — Tasks 1–2 consume the
  primitive (trap / focus-return / ESC / ARIA); they must not reimplement or weaken it.
- [`mergeDayMetadata` contract](shared-contracts.md#mergedaymetadata-contract) and
  [YAML parity / shadow-export contract](shared-contracts.md#yaml-parity--shadow-export-contract) —
  **Task 4 is the only parity-sensitive task.** If reconciliation means *relabeling the UI* (animal
  events are not exported), `mergeDayMetadata` is unchanged and golden baselines stay byte-identical. If
  it means *merging animal events into the day's export*, that changes output bytes and is a deliberate
  schema/format change requiring fixture regeneration per CLAUDE.md's Regression Prevention Protocol and
  coordination with `trodes_to_nwb`. **Pick the relabel option unless the team confirms inherited events
  must be exported.** Either way, golden baselines must end byte-identical to a deliberately-regenerated
  (and reviewed) reference — never silently changed to make a test pass.
- [Workspace data model & store actions](shared-contracts.md#workspace-data-model--store-actions) —
  Task 5 keeps snapshot creation and version assignment as store actions with `structuredClone`
  immutability; returning the version from `addConfigurationSnapshot` must not change its mutation
  semantics or the existing public-API key set beyond the documented action.

## Tasks

- **Task 1 — Migrate the last three dialogs onto `<Modal>`.** Replace the bespoke overlay markup in
  `ChannelMapEditor.jsx`, `CopyFromAnimalDialog.jsx`, and `CalendarDayCreator.jsx` with the shared
  `<Modal>` (mirroring `CameraModal.jsx`): pass `isOpen`, `onClose`, `title`, a `useId()` `titleId`, and
  render the existing body as children. Delete each surface's hand-rolled ESC / scroll-lock / focus code
  (the primitive owns it). Preserve each dialog's current behavior and styling hooks. `CopyFromAnimalDialog`
  must stop using `<dialog open>` (which is not a focus-trapping modal without `showModal()`).

- **Task 2 — `role="alertdialog"` for destructive confirms.** In `ConfirmDialog.jsx`, pass
  `role={destructive ? 'alertdialog' : 'dialog'}` (or always `alertdialog` if every `ConfirmDialog` use
  is a consequential confirm) through to `<Modal>`, and wire `aria-describedby` to the message so the
  prompt is announced. Verify every delete/confirm caller still reads correctly; do not change the
  primitive's focus/ESC behavior.

- **Task 3 — Close the `CalendarDayCreator` contrast gap.** Audit the day-number, muted-text, and any
  remaining foreground/background pairs in `CalendarDayCreator.css` for ≥4.5:1 (text) / ≥3:1 (UI). Fix
  any failing pair (prefer the existing AA tokens) and **add the audited pair(s) to
  `src/__tests__/unit/a11y/contrast.test.js`** so a regression fails a test. Annotate the ratio in a
  comment as the other token lines do.

- **Task 4 — Reconcile inherited behavioral events with the YAML merge.** Decide (per the parity
  contract above, defaulting to **relabel**):
  - *Relabel (no parity change, preferred):* update `TasksEpochsStep` / `BehavioralEventsDisplay` so the
    animal's `behavioral_events` are clearly shown as *animal-level reference, not part of this day's
    export*, removing the implication that they are merged. `mergeDayMetadata` is unchanged; golden
    baselines stay byte-identical.
  - *Merge (parity change, only with team sign-off):* concatenate `animal.behavioral_events` into the
    merged `behavioral_events` in `mergeDayMetadata`, then regenerate the four golden fixtures via the
    documented generator, review the byte diff, update CHANGELOG/REFACTOR_CHANGELOG, and confirm
    `trodes_to_nwb` still converts. Add a merge test asserting the concatenated output.

- **Task 5 — Reconfig versioning atomicity.** Make `addConfigurationSnapshot(animalId, config)` **return
  the created version number** (computed inside its `setWorkspace` updater). Update `ReconfigWizard.jsx`'s
  `handleApply` to use the returned version for `applyConfigurationForward` instead of re-deriving
  `configurationHistory.length + 1`, removing the cross-action desync / orphan-snapshot risk. Keep the
  two actions separate (the wizard still calls create-then-apply); only the version source changes. If
  the store's public-API key set is asserted, leave it unchanged (the action keeps its name; only its
  return value is added).

- **Documentation.** Note the cleanup in `docs/REFACTOR_CHANGELOG.md`. If Task 4 takes the merge option,
  document the format change and fixture regeneration prominently.

## Deliberately not in this phase

- **The "not blocking the cutover" follow-ups** — UX niceties (reconfig wizard long-study controls,
  persisted-"Validated" indicator), behavior-preserving tech-debt (making `appliedToDays` derived,
  structured error logging), the `Alt+←`/`Alt+→` chord question, and the release-gated persistence-blob
  forward migration. All tracked in [post-v3-followups.md](post-v3-followups.md); they can ship after
  v3.0.0.
- **Any new feature, route, schema change, flag flip, or default-route change** — Phase 11 owns cutover.

## Validation slice

| Test | Asserts |
| --- | --- |
| `modal-a11y: ChannelMapEditor / CopyFromAnimalDialog / CalendarDayCreator trap + focus-return + ESC` *(integration)* | each migrated dialog opens via `<Modal>`, traps Tab/Shift-Tab, returns focus to its opener on close, and closes on ESC (one parameterized test per dialog). |
| `ConfirmDialog: destructive confirm exposes role="alertdialog"` *(unit)* | a destructive `ConfirmDialog` renders `role="alertdialog"` with the message wired via `aria-describedby`; a non-destructive one stays `role="dialog"`. |
| `axe-a11y: no new violations on routes hosting the migrated dialogs` *(integration)* | opening each migrated dialog on its route yields zero Axe violations (extends the Phase 10 `axe-a11y` suite). |
| `contrast: CalendarDayCreator pairs meet AA` *(unit)* | the audited day-number/muted pairs compute ≥4.5:1 (text) / ≥3:1 (UI) in `contrast.test.js`. |
| `behavioral-events: UI and merge agree` | **Relabel path:** `encodeYaml(mergeDayMetadata(animal, day))` is unchanged (golden baselines byte-identical) and the UI no longer implies inherited events are exported. **Merge path:** the merged `behavioral_events` equals day-then-animal concatenation and the regenerated golden fixtures match the reviewed reference. |
| `addConfigurationSnapshot returns the created version` *(unit)* | the action returns `configurationHistory.length + 1` (e.g. `2` for a one-snapshot animal) and the workspace gains that snapshot. |
| `ReconfigWizard uses the returned version` *(integration)* | applying a reconfiguration calls `addConfigurationSnapshot` then `applyConfigurationForward` with the **returned** version (not a re-derived one); a stale-prop scenario can no longer mis-target. |
| `golden-yaml.baseline.test.js` (existing) | all 4 fixtures byte-identical — unchanged unless Task 4 takes the merge option, in which case they equal the deliberately-regenerated, reviewed reference. |

All tests are Vitest; integration tests touch render + a real route and reset state between runs.

## Fixtures

Reuse existing helpers — no new workspace shapes:

- `makeConfiguredWorkspace()` ([test-fixtures.js](../../../../src/__tests__/helpers/test-fixtures.js)) for
  the route/dialog a11y + axe tests.
- `makeReconfigWorkspace()` ([reconfigWorkspace.js](../../../../src/state/__tests__/fixtures/reconfigWorkspace.js))
  for Task 5.
- The existing golden fixtures for the parity assertion (regenerated only if Task 4 takes the merge path).

## Review

Follow the full gate in [review-protocol.md](review-protocol.md). Phase-specific:

- **Self-verify (§1):** this phase's Validation slice + `npx vitest run` (no regressions) + `npx vitest run baselines`
  (byte-identical — or, for the merge option only, equal to the deliberately-regenerated reference) +
  `npm run lint` (0 errors). Emphasis: Task 4 does not silently change export bytes; Tasks 1–2 consume
  the `<Modal>` primitive without weakening it.
- **Playwright UI (§2):** open each migrated dialog (trap / ESC / focus-return), trigger a destructive
  confirm (alertdialog announced), and run a reconfiguration end-to-end. 0 console errors.
- **Reviewers:** `pr-review-toolkit:code-reviewer` (always), plus `ux-reviewer` (the dialog-migration +
  alertdialog + contrast a11y), `pr-review-toolkit:silent-failure-hunter` **if** Task 4 takes the merge
  path (export/parity), and `pr-review-toolkit:pr-test-analyzer`.
- **Checklist (§6):** every task implemented; "Deliberately not in this phase" honored; tests non-trivial;
  no plan/phase/milestone strings in code/test names or docstrings; bespoke dialog ESC/trap/scroll code
  removed (not left dead alongside `<Modal>`); user-facing docs updated.
