# Phase 1 — Presentation, a11y, layout & test hygiene

[← back to PLAN.md](PLAN.md) · [overview](overview.md)

Small, byte-safe fixes (no export semantics). Two of them recover the only two "known-14" e2e
failures that are genuinely fixable (cameras layout; validation-responsive stale selector). The last
four are pure layout/label fixes from the live UX walkthrough
([../../research/yaml-corpus-2/13-ux-live-walkthrough.md](../../research/yaml-corpus-2/13-ux-live-walkthrough.md));
the *validation-timing* walkthrough findings (empty-Cameras warning, pre-greened steps) live in
**Phase 13**, and the wizard required-field gap in **Phase 14** — not here. Each fix is its own commit.

**Inputs to read first:**

- [src/pages/RecoveryReview/index.tsx:113-135](../../../../src/pages/RecoveryReview/index.tsx) — the lede that hardcodes "Nothing was discarded".
- [src/state/useWorkspacePersistence.ts:44-152](../../../../src/state/useWorkspacePersistence.ts) — owns the discard-vs-recover distinction (`initialDiscardRef`/`initialRecoverRef`); exposes `loadNotice` only. Add a `loadOutcome`.
- [src/viewModels/recoveryReviewViewModel.ts](../../../../src/viewModels/recoveryReviewViewModel.ts) — the pure VM the screen renders.
- [src/layouts/AppLayout.tsx:280-370](../../../../src/layouts/AppLayout.tsx) — skip links + the primary nav.
- [src/pages/DayEditor/DayEditorFrame.tsx:412-424](../../../../src/pages/DayEditor/DayEditorFrame.tsx) — the tab bar; the VM is [src/viewModels/dayEditorViewModel.ts:92-105,226](../../../../src/viewModels/dayEditorViewModel.ts) (`DayTabViewModel` carries `status`/`statusLabel`).
- [src/pages/ValidationSummary/DayStatusTable.tsx:52-57](../../../../src/pages/ValidationSummary/DayStatusTable.tsx) + [e2e/workspace-validation-responsive.spec.js:108-120](../../../../e2e/workspace-validation-responsive.spec.js) — the CSS-module class vs the stale e2e selector.
- [src/pages/AnimalEditor/CamerasSection.tsx:154-158](../../../../src/pages/AnimalEditor/CamerasSection.tsx) + [CamerasSection.scss:145-165](../../../../src/pages/AnimalEditor/CamerasSection.scss) + [e2e/workspace-responsive-cameras.spec.js:64](../../../../e2e/workspace-responsive-cameras.spec.js) — the auto-layout table whose Actions column scrolls off-screen.
- [e2e/task-catalog-screenshots.spec.js:1-21,61](../../../../e2e/task-catalog-screenshots.spec.js) — writes committed PNGs; [package.json](../../../../package.json) `test:e2e` = `playwright test`; [playwright.config.js](../../../../playwright.config.js) `testIgnore`.
- [src/pages/AnimalEditor/ElectrodeGroupModal.tsx](../../../../src/pages/AnimalEditor/ElectrodeGroupModal.tsx) + its CSS module — the modal whose AP/ML/DV coordinate fields fall below a ~900px viewport with no internal scroll (re-confirm line numbers).
- [src/pages/Home/CreateAnimalWizard.tsx:245-268](../../../../src/pages/Home/CreateAnimalWizard.tsx) — the 7-tab stepper (wraps to two rows at 1280px; "Team" detaches) and the "Save draft" button (no feedback on click).
- [src/pages/AnimalEditor/wiring/ElectrodeGroupsContainer.tsx](../../../../src/pages/AnimalEditor/wiring/ElectrodeGroupsContainer.tsx) — the electrode-group table that renders the raw `device_type` id (`tetrode_12.5`) instead of the friendly label the modal used. The label source is the probe catalog ([src/ntrode/probeCatalog.ts](../../../../src/ntrode/probeCatalog.ts)) / the same option list the modal's selector uses.

## Tasks

- **Recovery message honesty (Med).** Expose a `loadOutcome: 'recovered' | 'discarded' | null` from
  `useWorkspacePersistence` (set it where `loadNotice` is set, from `initialDiscardRef`/
  `initialRecoverRef`; add it to the memoized `persistence` object + `PersistenceStatus` in
  `workspaceTypes.ts`). Thread it into `buildRecoveryReviewViewModel(workspace, notice, outcome?)` and
  render a conditional lede: for `recovered` keep "Nothing was discarded — your existing data loaded;
  resolve the items below"; for `discarded` say the saved data **could not be restored and was
  discarded** (started empty) — do NOT claim "nothing was discarded". Also make the all-clear branch
  outcome-aware: for `discarded`, do not show "Every recovered record is in good shape"; instead state
  that there are no recovered records to review because the unusable saved workspace was discarded, with
  the normal back-to-workspace action. The needs-review classification itself is unchanged.
- **Dead skip link (High, a11y).** Add `id="navigation"` to the primary `<nav>` in
  `AppLayout.tsx:330` so the existing `href="#navigation"` skip link resolves. (The legacy banner has
  no nav landmark — keep the skip link hidden/no-op only on the legacy route if it already is; on
  workspace routes the nav now has the id.) Verify `handleSkipLinkClick` focuses it; the handler already
  sets `tabindex="-1"` before focus, so the test should click the skip link and assert focus lands on
  the primary nav, not merely that an element with the id exists.
- **Day-editor tab status cue (Med, UX).** In `DayEditorFrame.tsx:414-423`, render the VM's per-tab
  status alongside the label: a status glyph/dot derived from `tab.status` (the `StepStatus` →
  glyph mapping already used by `DayEditorSectionNav`) with `tab.statusLabel` as the accessible text
  (e.g. `aria-label={` `${tab.label}: ${tab.statusLabel}` `}` or a visually-hidden span). No VM change
  — it already computes both. Keep `aria-current` on the active tab.
- **validation-responsive e2e selector (Med, recovers known-14).** The component renders
  `styles.tableScroll` (a hashed CSS-module class) but the spec matches `.validation-summary-table-scroll`.
  Add a stable hook `data-testid="validation-table-scroll"` to the scroll `<div>` in
  `DayStatusTable.tsx:56` and update `e2e/workspace-validation-responsive.spec.js:115` to locate the
  ancestor via `[data-testid="validation-table-scroll"]` instead of the dead class.
- **Cameras Actions reachability (High, recovers known-14).** Keep Edit/Delete reachable at 1280px
  without horizontal scroll. **Default approach (see overview Open Question 3):** make the Actions
  column sticky — add a `position: sticky; right: 0;` rule (with a solid background + a left divider so
  scrolled cells don't bleed through) to the Actions `<th>`/`<td>` in `CamerasSection.scss`, and cap
  the free-text name columns (e.g. `max-width` + `text-overflow: ellipsis` with the full value in a
  `title`) so the table doesn't grow unboundedly. The `.cameras-table-scroll` wrapper stays. Update
  `e2e/workspace-responsive-cameras.spec.js:64` only if its assertion wording needs to match the
  sticky behavior (the first Edit must be on-screen at 1280×720).
- **Screenshot spec opt-in (High, process hazard).** Stop `npm run test:e2e` from regenerating
  committed PNGs: add `e2e/task-catalog-screenshots.spec.js` (and any other `*-screenshots.spec.js`)
  to `testIgnore` in `playwright.config.js`, and add a dedicated `test:e2e:screenshots` script in
  `package.json` for the intentional regeneration. Document the split in the spec's header comment.
- **Electrode-group modal scroll (High, dead-end at small heights).** Give `ElectrodeGroupModal` an
  internal scroll (`max-height: 90vh; overflow-y: auto`) with a **sticky** Cancel/Save footer, so the
  AP/ML/DV coordinate fields and the Device Type selector are both reachable without scrolling the page
  (today the required coordinates fall off-screen at ~900px and the DV label is clipped). Standard
  tall-modal pattern; tokens for spacing/shadow.
- **Wizard stepper single-row (Med).** Keep the 7-step stepper on one row at standard widths — a
  horizontally-scrollable tablist (or a linear "Step N of 7" indicator) so "Team" never detaches onto a
  second row looking like a broken sequence. Preserve roving-tabindex/`aria-current`.
- **Device-type friendly label in the electrode-group table (Med).** Render the same human label the
  modal selector shows ("Tetrode (12.5 µm)") in the table, not the raw enum id — so pick-time and
  review-time presentation agree. Map via the probe catalog / shared option list; the exported value is
  unchanged (the raw id still serializes).
- **Save-draft feedback (Med).** Show a brief inline "Draft saved" confirmation next to the wizard's
  "Save draft" button on click (a transient `role="status"` message), so the user knows work persisted.
- **Duplicate "Add recording day" at zero days (Med).** The zero-days state renders the action twice — a
  header button ([RecordingDaysTab.tsx:409-415](../../../src/pages/AnimalWorkspace/RecordingDaysTab.tsx))
  **and** the EmptyState CTA ([DayList.tsx:78-92](../../../src/pages/AnimalWorkspace/DayList.tsx)), both
  opening the same calendar. Render only one in the empty state (keep the EmptyState CTA, hide/suppress the
  header button when there are zero days), so a new user sees a single clear call to action.
- **Persistent "set up this animal" card (Med).** A fully-configured animal with zero recording days still
  shows the setup card because `showSetupCard = !(subjectPresent && dayCount > 0)`
  ([animalWorkspaceViewModel.ts:546](../../../src/viewModels/animalWorkspaceViewModel.ts)) gates on
  *day-count*, not setup completeness. Gate it on actual section completeness (the same section-status the
  AnimalView SectionNav already computes) so a set-up animal with no days yet is invited to **add a day**,
  not to "set up the animal" again.
- **Docs.** CHANGELOG: a "Fixed" entry for the recovery-message honesty, the skip-link, the cameras
  layout, the tab status cue, the four UX-walkthrough layout/label fixes (electrode-group modal
  scroll, wizard stepper, device-type label, save-draft feedback), and the two zero-state bugs
  (duplicate add-day, persistent setup card) — group as "v3 review fixes — presentation & a11y".

## Deliberately not in this phase

- The export/merge fail-closed changes (Phase 2), task-catalog (Phase 3), import (Phase 4),
  videoless (Phase 5) — all touch export/data semantics and are gated separately.
- Any change to the recovery *classification* or the VM's needs-review rows — only the lede + the new
  `loadOutcome` plumbing.

## Validation slice

| Test | Asserts |
| --- | --- |
| `RecoveryReview.test.jsx` (extend) | for `loadOutcome === 'discarded'`, neither the lede nor the all-clear copy says "Nothing was discarded" / "Every recovered record is in good shape"; it states the data was discarded and no recovered records are available to review. For `recovered`, it keeps the reassurance |
| `useWorkspacePersistence` / store-persistence test (extend) | `persistence.loadOutcome` is `'discarded'` on an unusable blob, `'recovered'` on a missing-section blob, `null` on a clean load |
| `AppLayout.test.jsx` (extend) | on a workspace route the element with `id="navigation"` exists, is the primary nav landmark, and receives focus when the "Skip to navigation" link is activated |
| `DayEditorFrame` test (extend) | each tab button exposes its `statusLabel` (accessible name/title) in addition to the label |
| `e2e/workspace-validation-responsive.spec.js` | passes at 390px (recovered from the known-14 set) using the `data-testid` hook |
| `e2e/workspace-responsive-cameras.spec.js` | first Edit button is on-screen at 1280×720 (recovered from the known-14 set) |
| `ElectrodeGroupModal` test / e2e (new) | at a ~900px-height viewport the AP/ML/DV fields and the Device Type selector are both reachable (modal scrolls internally; footer stays visible) |
| `CreateAnimalWizard` test (extend) | the 7-step stepper stays single-row (no wrapped/detached "Team"); "Save draft" surfaces a transient confirmation |
| electrode-group table (extend) | a group with `device_type: 'tetrode_12.5'` renders the friendly label in the table; the exported/serialized value is still the raw id |
| `baselines` | unchanged (byte-identical) |

## Fixtures

Reuse existing: the recovery workspaces from `RecoveryReview.test.jsx`, the configured workspace from
the e2e helpers (`buildConfiguredWorkspaceBlob`). The discarded-load case seeds an unusable blob
(parse-error/version-mismatch) like `workspace-persistence-recovery.spec.js` already does.

## Review

Before opening the PR, dispatch `code-reviewer` against the diff. Confirm:
- Each task implemented as specified; "Deliberately not in this phase" honored (no export-semantic change).
- Validation slice passes; the two recovered e2e tests now pass and no new e2e regressions appear (baseline drops by exactly 2).
- `npx vitest run baselines` byte-identical; full gate green.
- The `loadOutcome` plumbing doesn't reach YAML (it's persistence status, never serialized).
- The discarded-load RecoveryReview path is honest in both the lede and all-clear branch.
- No trivial tests; docstrings/test names don't reference this plan.
- CHANGELOG updated.
