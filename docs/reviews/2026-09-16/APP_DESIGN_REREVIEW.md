# Design re-review after the first design fixes

## Assessment

**Routine recording entry is substantially clearer. First-time setup, error recovery and final review still need work.** The changes to the daily header, weight entry, camera tables, forms and file actions held up in the browser. This pass found seven remaining issues, including an optogenetics interaction that discards entered data.

The app supports a useful supervised pilot of the ordinary recording workflow. I would fix the optogenetics data-loss interaction before asking scientists to use that setup flow, and address the incomplete-setup and review cues before treating the design as finished.

This is an expert design review of the modern app, not an observed scientist usability study. No application source was changed. The working tree contains the previous fixes; this review adds documentation and synthetic browser evidence.

## Method

I followed these tasks in isolated Chromium browser storage:

1. Start with an empty workspace, enter a new animal, visit all seven setup steps, save an unfinished draft and begin its first recording.
2. Open an existing animal, backfill June 25 from June 24, enter a new weight, decide between prior and default task context, generate video entries, inspect epochs and download YAML.
3. Reopen a downloaded recording, correct its weight and reload; inspect setup, failed-channel, mapping, camera and configuration-change screens.
4. Inspect optogenetics entry and recovery, animal/batch review, and representative 390 px and 320 px layouts.

The production build passed. Key export and layout findings were reconfirmed after rebuilding. There were **49 captured states, zero reported axe violations and no browser page errors**. These checks do not establish full accessibility or usability: the measured horizontal overflow below passed axe. [Evidence inventory](design-rereview-evidence/verification.json).

The follow-up download contained the entered 458 g, the selected Room B context and four videos. Correcting the weight to 460 g survived reload and changed the visible status to “Changed since download.” This pass did not run Trodes → NWB → DANDI → Spyglass or repeat the complete automated test suite.

## Remaining findings

### R1 — High: the optogenetics checkbox silently discards entered setup

**Observed:** I entered source name `Blue source`, wavelength `470` and fiber name `Left CA1`. Unchecking “This animal has optogenetics” and checking it again restored an empty source and removed the fiber. There was no confirmation or Undo.

This checkbox looks like an enable/disable control. A scientist exploring the form or correcting an accidental click can lose substantial setup entry. This reproduction concerns the animal's editable default; it does not demonstrate deletion of existing recording-day snapshots.

**Change:** Preserve entered setup when disabling it, and restore it when re-enabled. If clearing the setup is needed, provide a separately labelled action with recovery or confirmation. Apply equivalent protection to removing populated fibers and injections; their current handlers also remove immediately.

Implementation: [OptogeneticsStep.tsx:97](../../../src/pages/AnimalEditor/OptogeneticsStep.tsx#L97), removal handler at line 115. Evidence: [before](design-rereview-evidence/29-opto-entered-viewport.png), [after](design-rereview-evidence/30-opto-values-lost-viewport.png), [stored values before/after](design-rereview-evidence/opto-toggle-check.json).

### R2 — Medium: expected statescript reminders disappear at final review

**Observed:** The daily log showed “2 statescripts missing.” After entering weight, confirming task context and generating the video entries, the export screen showed “Ready to export” and “Non-blocking warnings: None.” Download succeeded with `associated_files: []`. The epoch drawer also called an epoch “Complete” while its files section said “needs review” and its statescript was “Expected.”

Missing statescripts are deliberately non-blocking in the current policy. The problem is that a known reminder disappears precisely when the scientist is asked to check the recording, increasing the chance of an unintended omission.

**Change:** Carry the expected-but-unlisted statescript count into single and batch review, with links to the relevant epochs. Explain that the files are optional for export. Do not invent files or silently turn this into a new requirement. Distinguish “ready to export” from “all expected files recorded.”

Implementation: [EpochsTab.tsx:581](../../../src/pages/DayEditor/EpochsTab.tsx#L581), [preflightSummary.ts:199](../../../src/domain/preflightSummary.ts#L199). Evidence: [daily reminder](design-rereview-evidence/45-current-build-statescript-reminder-viewport.png), [final review](design-rereview-evidence/46-current-build-export-viewport.png), [download](design-rereview-evidence/review-without-statescripts.yml), [drawer](design-rereview-evidence/34-epoch-phone-viewport.png).

### R3 — Medium: saving a draft loses the guided path through missing setup

**Observed:** I saved `ReviewRat` without DOB, experiment description or experimenters. “Save draft” navigated to Recording Days after 500 ms. The “Set up this animal” checklist listed electrodes, recording system, cameras and optogenetics, but omitted the missing identity/team information and offered no Resume setup action. The recording system changed from “Pre-filled — review” in the wizard to “Done” in the checklist without an explicit review decision.

Starting a recording is allowed, which is useful for day-of entry. But the first recording then introduces red corrections for unfinished setup that the preceding checklist did not mention. DOB is recoverable through a repair action or the header's overflow menu; the user must discover a different path from the wizard.

**Change:** Label the exit “Save draft & exit,” provide Resume setup, and show a concise checklist of remaining required facts alongside applicable hardware. Preserve the distinction between supplied defaults and completed/reviewed setup. Keep draft recording creation available.

Implementation: [CreateAnimalWizard.tsx:520](../../../src/pages/Home/CreateAnimalWizard.tsx#L520), [animalWorkspaceViewModel.ts:160](../../../src/viewModels/animalWorkspaceViewModel.ts#L160), [profile menu](../../../src/pages/AnimalView/index.tsx#L463). Evidence: [wizard default status](design-rereview-evidence/08-wizard-system-viewport.png), [saved draft destination](design-rereview-evidence/10-saved-draft-destination-viewport.png), [first recording review](design-rereview-evidence/14-first-draft-review-viewport.png).

### R4 — Medium: required-field cues remain inconsistent

**Observed:** In Add Task Type, entering a task name leaves Save disabled when Description and Environment are blank. Those labels have no visible required marker or explanation of why Save is unavailable. They have HTML `required` attributes, but a disabled button does not trigger native submit feedback. Camera labels use another convention; optogenetics uses stars, daily weight uses a star, and wizard DOB uses “Required before export.”

A scientist should not have to infer which fields are necessary by experimenting with the disabled action. The shared control sizing improved appearance, but has not supplied a shared field/validation interaction.

**Change:** Establish one visible convention for required fields and one for optional fields. Distinguish requirements for saving a reusable definition from requirements for eventual export. Show a short reason when saving is unavailable, or allow a save attempt to identify the missing fields.

Implementation: [TaskTypeModal.tsx:60](../../../src/pages/AnimalEditor/TaskTypeModal.tsx#L60), [disabled Save](../../../src/pages/AnimalEditor/TaskTypeModal.tsx#L106). Evidence: [name entered, Save unavailable](design-rereview-evidence/13-task-required-feedback-viewport.png), [camera form](design-rereview-evidence/25-camera-dialog-viewport.png).

### R5 — Medium: batch review does not expose the most useful daily comparisons

**Observed:** The four batch-confirmation entries had essentially identical summaries: configuration version, one electrode group, zero failed channels, one camera and no optogenetics. They did not show measured weight, experimenters, task order/environment or camera calibration. Those details are available in the separate per-day review, but the batch confirmation asks the user to review each recording without exposing them there.

The underlying animal review table also wraps ordinary ISO dates across lines at 1440 px, repeats animal identity/session descriptions, and gives “Changed since download” less visual emphasis than the blue Downloaded chips.

**Change:** Give the batch review a compact comparison of date, measured weight, team, epoch/task context and download status. Expand each recording for calibration and hardware details using the same summary as single-day review. Keep dates together and make changed recordings easy to find. This is particularly useful for backfilling a week and checking plausible-but-wrong values that schema validation cannot reject.

Implementation: [BatchExportPreflight.tsx:44](../../../src/pages/ValidationSummary/BatchExportPreflight.tsx#L44), [ValidationSummary.module.css](../../../src/pages/ValidationSummary/ValidationSummary.module.css). Evidence: [animal review table](design-rereview-evidence/31-animal-review-viewport.png), [batch confirmation](design-rereview-evidence/32-batch-review-viewport.png).

### R6 — Medium: the animal setup shell still overflows at 320 px

**Observed:** On the Cameras tab, the document width is **352 px in a 320 px viewport**. The section selector and main panel extend past the right edge. The new camera cards themselves are readable. The same screen fits at 390 px, and the checked daily form fits at both widths.

The measured source of the overflow is the animal shell's navigation/grid sizing, not an inherently wide scientific table. The narrow layout retains a `1fr` grid track with an automatic minimum, and the navigation does not set a shrinking minimum width.

**Change:** Apply the shrinking grid and navigation constraints to the animal shell, then check every animal section at 320 px. Preserve full control visibility without page-level sideways scrolling.

Implementation: [AnimalView.module.css:113](../../../src/pages/AnimalView/AnimalView.module.css#L113), [SectionNav.module.css](../../../src/pages/AnimalView/SectionNav.module.css). Evidence: [fresh-build capture](design-rereview-evidence/44-current-build-overflow-viewport.png), [element measurements](design-rereview-evidence/camera-overflow.json).

### R7 — Medium: optogenetics progress counts empty records as configured

**Observed:** Enabling optogenetics and adding one empty fiber and one empty injection produced **“Opto configured · 4 of 4”** while the form still said to complete the source, fiber and injection. The counter counts non-empty arrays rather than completed scientific fields. Export completeness checks remain separate; this is a misleading progress cue, not a demonstrated export bypass.

**Change:** Use the existing field-level completeness calculation for the header meter and show “1 of 4 sections complete” when only the default software name is present. Use the same calculation in the wizard, animal screen and setup checklist.

Implementation: [AnimalView/index.tsx:192](../../../src/pages/AnimalView/index.tsx#L192), [optoCompleteness.ts:46](../../../src/domain/optoCompleteness.ts#L46); the more complete calculation already exists in [optoEditorFields.ts](../../../src/domain/optoEditorFields.ts). Evidence: [empty fields with 4 of 4](design-rereview-evidence/47-opto-progress-empty-fields-viewport.png).

## Screen-by-screen result

| Screen | Current design judgment |
| --- | --- |
| Import entry | Clear file drop/selection and explanation of animal/date grouping. Post-import conflict resolution was not repeated in this pass. |
| Empty/populated workspace | Clear create/import entry and familiar searchable list. Browser storage and backup instructions are concise. |
| Setup: Identity | Readable fields and explicit DOB draft guidance. Returning to finish identity needs the R3 continuation path. |
| Setup: Electrodes | Add/copy actions and effective-date meaning are clear. Mapping verification is accessible, although the introductory copy repeats itself. |
| Setup: Cameras / recording system | Table readability is much improved. R4 required cues and R6 shell overflow remain. |
| Setup: Tasks | Reusable task definitions and cameras are understandable. Disabled Save needs explanatory feedback (R4). Adding the first epoch can open the task editor directly. |
| Setup: Optogenetics | Labels, units and field styling improved. Recovery and progress are unreliable (R1/R7). |
| Setup: Team | Better field spacing and a usable description area. Finishing later needs a visible route back to these defaults (R3). |
| Recording-day list | Today and typed backfill are easy to find; multiple-date entry is secondary. Incomplete animal setup is poorly represented (R3). |
| Daily log | Strongest improvement: dated measured weight first, previous weight as reference, compact team, explicit reused-context decision and visible Add epoch. |
| Epoch drawer | Familiar side panel, explicit file actions and day-only context editing. “Complete” versus unresolved file reminders needs alignment (R2). |
| Recording Setup | Reused system and camera usage are visible; advanced overrides are disclosed. A link from a locked camera choice to the relevant task/video would help correction. |
| Failed Channels | One expansion exposes channels and the Trodes ntrode ID. Hardware-failure versus sorting-quality guidance is useful. |
| Digital I/O | Named-line entry is compact; Din/Dout meanings and day scope are explained. |
| Mapping / new configuration | Deliberate edit dialogs and visible replacement/repositioning consequences support careful changes. |
| Single-day review | Readable scientific summary and clear Download YAML action. Missing statescript reminders are lost (R2). |
| Animal / batch review | Scope is clear, but comparison content and visual hierarchy need R5. |

### Further visual polish

- **Small-screen setup is still top-heavy.** At 320 px the first identity input begins 729 px from the document top. The seven step pills, repeated introduction and import/copy links consume most of the initial viewport. Use a compact “Step 1 of 7 — Identity” header with an expandable step list on phones. [Capture](design-rereview-evidence/37-wizard-320-viewport.png).
- **Optogenetics remains a long form.** Keep one source/fiber/injection record visibly grouped and allow completed records to collapse to a useful summary. Avoid collapsing fields while the user is entering them.
- **Use one navigation/status vocabulary.** “Validation & Export,” “Review & export,” “Done,” “Complete,” and “Configured” still refer to different levels of completion without consistently explaining the difference.

## Design criteria and next step

The recommendations apply established principles of visible system status, error prevention/recovery, consistency and recognition. [Nielsen Norman Group's usability heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/). Required-field information should be available to the person completing the form, and ordinary content should reflow at narrow widths. [W3C labels/instructions](https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html), [W3C reflow guidance](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html).

Prioritize R1, then truthful progress/review and draft continuation (R2/R3/R7), followed by field guidance, batch comparison and the remaining responsive defect (R4/R5/R6). After that, observe scientists creating an animal, resuming setup, logging a follow-up, backfilling several days and correcting an already downloaded recording. Measure hesitation and correction effort as well as completion time.
