# Design re-review fixes

Implemented all seven findings in [APP_DESIGN_REREVIEW.md](APP_DESIGN_REREVIEW.md), plus its remaining visual and wording improvements. Changes apply to the modern workspace app. Existing work in the working tree was preserved.

## What changed

| Finding | Implemented behavior |
| --- | --- |
| **R1: optogenetics data loss** | Switching optogenetics off saves its entered setup in a workspace-only draft. Switching it back on restores those values, including after reload or backup/restore. Removing a populated fiber or injection requires confirmation; cancelling retains the record. Existing recording snapshots stay unchanged unless the scientist explicitly applies the animal default to selected days. Removed the misleading notice that every default edit forces all days to be downloaded again. |
| **R2: disappearing file reminders** | Single-day and batch review show expected-but-unlisted statescripts with links to the relevant epochs. The reminder explicitly says these files are optional for export. The epoch drawer says “Review optional log” instead of “Complete” when a log is still expected. Validation warnings are labelled separately. No new file requirement or acknowledgement gate was added. |
| **R3: unfinished setup** | “Save draft & exit” returns to a checklist that includes missing identity/team facts and a **Resume setup** link. Each fact group links to its wizard step. The seeded recording system stays “Review default” until explicitly confirmed; changing that hardware invalidates its review. Applicable hardware is in a disclosure to keep the checklist compact. Resumed setup ends with “Finish setup.” |
| **R4: required fields** | Shared stars, accessible required states and explanatory text distinguish fields needed to save task/camera definitions from fields needed before export. Disabled task/camera saves list what is missing. Blank birth dates ask for the missing date; malformed dates retain their error message. Both continue to block export. |
| **R5: batch comparison** | Each batch entry shows its date, weight, experimenters, epochs/task environments, video count and download status. An expander shows the same calibration/hardware summary as single-day review. Dates stay on one line, generated redundant descriptions are suppressed, and changed-download table badges receive stronger emphasis. |
| **R6: narrow layouts** | Animal grid/navigation can shrink at 320 px. Long checklist summaries wrap, and the configuration heading/button wrap without pushing content outside the page. All seven animal sections were exercised at 320, 390 and 1440 px. |
| **R7: truthful optogenetics progress** | Wizard, animal header and setup classification use required-field completeness. Adding empty records counts only the prefilled software section: **1 of 4 sections complete**. |

### Additional polish

- On phones, the seven setup tabs sit behind a compact “Step N of 7” control; import/copy options are disclosed. The first identity field moved from 729 px to **459 px** from the document top in the 320 px walkthrough.
- Completed optogenetics records start folded when reopened. Completing the last field while typing does **not** close the record.
- Navigation consistently uses **Review & export**.
- Locked recording-day cameras explain their source and link to Daily entry for correction.
- Missing entry is presented as work to finish. This presentation change does not weaken validation or enable incomplete downloads.
- Shortened repeated electrode setup instructions.

## Verification

**5,691 unit tests and 31 browser tests pass.** TypeScript, production build, JavaScript/TypeScript lint, the changed CSS files and whitespace checks pass. [Check details](design-rereview-fixes-evidence/checks.txt).

The browser walkthrough used isolated synthetic data for first-time setup, interrupted setup, recording-system confirmation, follow-up entry, optogenetics recovery/removal, optional-file correction and single/batch review. It produced **18 captured states**, with **zero axe violations, zero page errors and no page-level horizontal overflow** in those captures. Automated browser checks also cover all animal sections at three widths. [Capture inventory](design-rereview-fixes-evidence/verification.json).

The downloaded follow-up YAML contains **458 g**, `Scientist, Alex`, four videos and the selected **Room B** context for epochs 2 and 4. Its optional statescript list remains empty, matching the visible reminder. [Synthetic downloaded YAML](design-rereview-fixes-evidence/20230625_FixRat2_metadata.yml).

Representative evidence:

- [Compact first-time setup](design-rereview-fixes-evidence/01-phone-first-setup-viewport.png), [saved draft and resume path](design-rereview-fixes-evidence/02-saved-draft.png).
- [Optogenetics progress](design-rereview-fixes-evidence/04-opto-honest-progress-viewport.png), [preserved disabled setup](design-rereview-fixes-evidence/05-opto-preserved-off-viewport.png), [removal confirmation](design-rereview-fixes-evidence/06-opto-removal-confirmation-viewport.png).
- [Single-day review](design-rereview-fixes-evidence/08-followup-review-viewport.png), [epoch repair](design-rereview-fixes-evidence/09-reminder-repair-viewport.png), [batch comparison](design-rereview-fixes-evidence/11-batch-review.png).
- [320 px camera screen](design-rereview-fixes-evidence/14-phone-cameras-viewport.png), [task requirements](design-rereview-fixes-evidence/15-task-required-feedback-viewport.png), [unfinished first recording](design-rereview-fixes-evidence/17-first-recording-to-finish-viewport.png).

These checks establish the reviewed entry and recovery behavior using synthetic data. They do not replace observed scientist usability testing or an end-to-end Trodes → NWB → DANDI → Spyglass acceptance run.
