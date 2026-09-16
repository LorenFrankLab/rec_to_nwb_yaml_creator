# Review of the workflow fixes

**Reviewed:** `036b9591..dd62f6ed` on `feat/first-useful-release`, September 15, 2026.

**Result:** Five findings remain: two P1 scientific-data risks and three P2 integration issues. The reported passing test results are reproducible, but do not cover these failures. F1–F7 and architecture items 2, 3 and 5 should not yet be marked collectively complete.

This review follows the scope and rulings in the supplied implementation response. The previously deferred work remains deferred. I changed only review documents and evidence; no application source, committed fixtures, or snapshots.

## Findings

### R1 · P1 · Cancelling the task scope dialog replaces the original comparison value with an unsaved edit

**Location:** [TaskTypesContainer.tsx:344](../../../src/pages/AnimalEditor/wiring/TaskTypesContainer.tsx#L344), with the comparison at [line 180](../../../src/pages/AnimalEditor/wiring/TaskTypesContainer.tsx#L180).

**Reproduction:**

1. Open an animal with an existing recording day whose sleep task follows the `home cage` default.
2. Edit that task type's environment to `Room B` and save. The scope dialog correctly appears.
3. Choose **Cancel**. The task form correctly retains the typed `Room B`.
4. Save the form again without changing anything.

**Observed:** The second save closes immediately, without another scope decision. The existing day's merged/export metadata now says `Room B` for its sleep epochs. No historical correction was approved and no old context was pinned.

On cancel, `modal.taskType` becomes `{ ...pendingContext.taskType, ...pendingContext.definition }`. `handleSave` then treats this edited object as the original when it calls `contextChangeFor`. Comparing `Room B` with `Room B` produces no change, even though the persisted default is still `home cage`.

This also makes further editing unsafe: after returning from the scope dialog, the form's unsaved values can become the values offered for preserving history. The original persisted definition and the form draft must remain separate.

**Required correction:** Compare against the actual saved catalog definition, or retain an immutable original alongside the reopened draft. Cancelling and reopening must never advance the baseline used for preservation or scope detection.

**Regression coverage:** Save → cancel scope → save again must ask again. Save → cancel scope → edit again → keep history must retain the original historical values for both environment and camera fields.

**Evidence:** [Before cancellation](workflow-fix-review-evidence/01-task-scope-before-cancel.png), [second save](workflow-fix-review-evidence/02-task-scope-second-save.png), and `cancelScope` in [recheck.json](workflow-fix-review-evidence/recheck.json).

### R2 · P1 · Saving day context silently reorders cameras and can change position calibration

**Location:** [EpochsTab.tsx:1594](../../../src/pages/DayEditor/EpochsTab.tsx#L1594).

**Reproduction:**

1. Use a valid task with `camera_id: [1, 0]` and an animal camera catalog ordered `[0, 1]`.
2. Open epoch 2's details and select **Edit for this day**.
3. Change only the environment to `Second room`; leave both camera checkboxes selected.
4. Select **Save for this day**.

**Observed:** The effective task camera list changes from `[1, 0]` to `[0, 1]`. The task instance acquires this reordered camera override, although the user edited only its room.

The form initializes `selected` in the effective task order, but saves by filtering the **animal catalog**. That loses the recorded order. This is scientifically significant: the local converter explicitly uses the first task camera for an epoch's position scale, at [convert_position.py:1062](/Users/edeno/Documents/GitHub/trodes_to_nwb/src/trodes_to_nwb/convert_position.py:1062). In the reproduction, that selects `0.00085` instead of `0.0009` meters per pixel.

The new calibration split flow can naturally create this condition: its later task can reference `[2, 1]` while the animal catalog is `[0, 1, 2]`. Sorting selected cameras by catalog order would promote camera 1 ahead of the newly split camera 2.

**Required correction:** Preserve the existing effective order for cameras that remain selected. Append newly selected cameras under an explicit policy. A room-only save, or a save with no changes, must preserve camera references exactly. If the app offers a primary-camera change, make that a deliberate action with the converter meaning explained.

**Regression coverage:** Assert exact ordered camera IDs and the resulting first-camera calibration after a room-only edit, both for reversed source order and for a day created by split-calibration import.

**Evidence:** [Before save](workflow-fix-review-evidence/03-day-context-before-save.png), [after save](workflow-fix-review-evidence/04-day-context-after-save.png), and `cameraOrder` in [recheck.json](workflow-fix-review-evidence/recheck.json). These checks inspect the real persisted workspace and `mergeDayMetadata`; no NWB conversion was run.

### R3 · P2 · Incremental calibration imports still encounter the old mandatory mapping gate

**Location:** [ImportRepair/index.tsx:116](../../../src/pages/ImportRepair/index.tsx#L116), [blockingReason:138](../../../src/pages/ImportRepair/index.tsx#L138), and the retained camera repair logic in [importRepair.ts:700](../../../src/state/importRepair.ts#L700).

**Reproduction:**

1. Import two files for a new animal, with `overhead_camera` calibrated at `0.001` on June 22 and `0.002` on June 23.
2. Accept the default split. This works: each day retains its own calibration, and the second camera becomes `overhead_camera_20230623`.
3. Re-import the same June 23 file. Alternatively, import a June 24 file with a third calibration, `0.003`.

**Observed:** Both cases stop at **Needs repair** with **Add recording day** disabled. The only camera repair asks the user to edit `camera_name` in the source YAML or map it to an existing camera ID. The new split choices are not displayed at this point. Even the exact calibration already stored under its split name asks for this response.

The planner's new conflict detection and rerouting work, but readiness still requires resolving every old `divergent_camera_identity` item. `handleSingleImport` reaches the new conflict preview only after `assessment.ready` is true. Consequently, the scientist must first provide an unrelated mapping or edit the source file to get past the earlier gate. This is especially confusing when the intended operation is to keep a new calibration as a separate camera.

**Required correction:** Reconcile the repair assessment with the new camera analysis. A calibration conflict safely handled by split/unify should route directly to that decision; a recognized existing split should not require another identity mapping. Continue to require repair for genuinely unresolved or dangling references.

**Regression coverage:** Use the complete file-picker → assessment → preview → commit path for initial import, later calibration, and repeat import. Planner-only idempotency tests do not exercise this gate.

**Evidence:** [Working batch preview](workflow-fix-review-evidence/20-camera-batch-preview.png), [repeat import](workflow-fix-review-evidence/22-camera-reimport-repair.png), [third calibration](workflow-fix-review-evidence/23-camera-next-calibration.png), and [import-recheck.json](workflow-fix-review-evidence/import-recheck.json).

### R4 · P2 · Lazy-loading the legacy route also defers styles required by the application shell

**Location:** [AppLayout.tsx:52](../../../src/layouts/AppLayout.tsx#L52), [LegacyFormView.jsx:38](../../../src/pages/LegacyFormView.jsx#L38), and shared styles in [App.scss:479](../../../src/App.scss#L479) and [App.scss:654](../../../src/App.scss#L654).

**Reproduction:** Open the production build directly at `#/workspace` in a fresh browser context. Then visit the legacy route and return to the same workspace URL.

**Observed:** Before visiting legacy, the shell has a large logo/header, both skip links appear inline at the top, and footer links are only 18 px tall. After visiting legacy, the header becomes compact, skip links acquire their focus-only placement, and the footer links become 24 px tall. The same workspace screen changes appearance according to route history.

`App.scss` is imported by `LegacyFormView`, which used to be eager. The shell still relies on that stylesheet for its logo/banner, skip-link and footer presentation. Making the route lazy therefore removes those styles from a direct workspace load. This also defeats the footer target-size fix on the primary workspace entry paths. Axe reproduced a footer target-size failure in the affected views.

**Required correction:** Move shared shell styles into an eagerly imported shell stylesheet. Keep legacy-specific form rules with the legacy route. Do not depend on visiting another route to initialize the shell.

**Regression coverage:** Compare the production workspace shell after a direct load, a reload, and legacy → workspace navigation. Assert the same logo/banner geometry, skip-link behavior and footer target dimensions in each case.

**Evidence:** [Direct production workspace](workflow-fix-review-evidence/30-production-cold-workspace.png), [same workspace after visiting legacy](workflow-fix-review-evidence/31-production-workspace-after-legacy.png), and computed styles in [shell-and-forms.json](workflow-fix-review-evidence/shell-and-forms.json).

### R5 · P2 · The new export review reports “None” for warnings that the export gate counts

**Location:** [EffectiveDayReview.tsx:37](../../../src/components/EffectiveDayReview.tsx#L37), used on the new single-day path at [ExportPreview.tsx:220](../../../src/pages/DayEditor/ExportPreview.tsx#L220).

**Reproduction:** Add two statescript logs whose descriptions omit the keyword needed by Spyglass, producing two real non-blocking warnings. Open **Fix & Export**.

**Observed on one screen:**

- Readiness: **Ready to export · 2 warnings to review**.
- Scientific review: **Non-blocking warnings — None**.

`EffectiveDayReview` calls `buildPreflightSummary` without `warningCount`; the helper defaults it to zero. The adjacent readiness panel uses the actual issue list. The summary's reassuring “None” is therefore false precisely when the scientist is being asked to review warnings.

**Required correction:** Pass the authoritative warning count/issues into the shared review, or remove the warning row from a component that does not receive them. The gate and review must use the same warning set.

**Regression coverage:** Assert agreement between the gate and summary on a real day with advisory issues. The current test checks only the readiness text.

**Evidence:** [Export screen](workflow-fix-review-evidence/05-export-review.png) and its [captured text](workflow-fix-review-evidence/05-export-review.txt).

## What is working

| Original item | Verification and status |
| --- | --- |
| F1: calibration preservation | New-animal batch preview displays both values and default split preserves `0.001` and `0.002` in the respective days. Incremental UI remains incomplete under R3. |
| F2: subject ID | Browser check preserves `ReviewCase`; `Review_Rat` is rejected before creation. Shared boundary is used by create and copy. |
| F3: day context | Normal **Keep earlier days as recorded** preserves `home cage` while changing the default to `New default`. Imported/day context overrides are present. R1 and R2 remain. |
| F4: drafts | Browser-created `ReviewDraft` has neither a `weight` nor a `date_of_birth` key. Store and validation tests cover clearing facts and the missing-DOB export repair. |
| F5: keyboard access | Actual Tab sequence reaches Daily log, Recording Setup, Failed Channels, DIO Wiring, then Fix & Export. |
| F6: daily files | Folder entry is adjacent to generation; expected statescripts are amber, with sleep without precedent marked not expected. Counts and bulk generation share the expectation model. Warning-summary contradiction is R5. |
| F7: readable export review | Weight, semicolon-separated team names, task rooms, calibration and other effective-day facts appear before Download. Warning row needs R5. |
| Architecture 2: type contracts | Coordinate types match the schema; ML/AP labels now match their keys; group units are used in the coordinate summary. No additional defect found in these changes. |
| Architecture 3: accessibility styles | No warning-text contrast violation appeared in the reviewed settled screens. The footer fix is unavailable on direct workspace loads because of R4. |
| Architecture 5: route splitting | Build splits route code; lazy loading/focus tests pass. Shell CSS ownership needs R4. |

The prior coordinate-label correction should remain a documented manual audit for values entered through those old labels. Automatically swapping stored coordinates would also alter correct imports. The new-day reset-to-default policy remains the accepted R12 tradeoff, with its previously identified usability follow-up.

## Verification and limits

- `npx vitest run`: **387 files, 5,644 tests passed** in 77.2 seconds. This includes **125 baseline tests**, of which 18 are in `golden-yaml.baseline.test.js`. No committed fixtures or snapshots differ across the reviewed range.
- `npm run typecheck`, `npm run lint:ci`, and `npm run build`: **passed**. Lint prints existing dependency-age/tool notices; exit status is zero.
- Selected Playwright workflow, export, mistake-prevention, persistence, ownership, optogenetics and responsive-accessibility suites: **60 passed**, two workers, zero retries, 50.1 seconds.
- Repeated the 23-view desktop/mobile walkthrough and added targeted interaction checks and production-build checks. No page exceptions were reported by the walkthrough. Phone screens checked at 390 px had no horizontal overflow. Legacy accessibility findings from the first review remain outside this fix scope.
- Main JS entry: **429.16 kB**, gzip **135.00 kB**. A cold production workspace additionally loads shared/route chunks: approximately **822.7 kB of decoded JS in total**, excluding CSS and images. The entry reduction is real, but it should not be presented as the complete initial-page download reduction.
- Browser reproductions use isolated local workspaces based on the repository fixture and controlled copies of valid metadata. They verify UI, persistence and merged export values, with downstream interpretation checked against the supplied converter source. No real NWB conversion, NWB Inspector/DANDI run, live Spyglass insertion, Firefox/WebKit run or scientist usability session was performed.

### Legacy screenshot decision

**Leave the committed snapshots unchanged in this review.** Fix the shell-style regression first, then deliberately review and refresh the intended baseline changes in a separate visual-baseline change. Do not accept the current appearance by bulk regeneration. The seven previously reported failures were not independently compared against the pre-branch checkout in this pass, so their pre-existing status remains the implementation response's report.

### Reproduction artifacts

All new evidence is in [workflow-fix-review-evidence](workflow-fix-review-evidence/). The targeted scripts are [recheck.cjs](workflow-fix-review-evidence/recheck.cjs), [import-recheck.cjs](workflow-fix-review-evidence/import-recheck.cjs), and [shell-and-forms.cjs](workflow-fix-review-evidence/shell-and-forms.cjs). The first two use Vite at port 3018; the last also uses the production preview at port 3019 with `--base /rec_to_nwb_yaml_creator/`. The [walkthrough](workflow-fix-review-evidence/walkthrough.cjs) and [Playwright configuration](workflow-fix-review-evidence/playwright.config.cjs) are retained as well. Original review evidence remains intact.
