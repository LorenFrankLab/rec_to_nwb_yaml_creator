# Design review fixes

Implemented the eight findings in [APP_DESIGN_REVIEW.md](APP_DESIGN_REVIEW.md), with the daily scientist workflow as the organizing principle: identify the recording, enter its measurement, check epochs and files, handle exceptions, then review and download.

## What changed

| Finding | Implemented change |
| --- | --- |
| D1 — crowded daily screen | Compact animal/date header; quiet save feedback; setup/source information below the daily measurement in a disclosure; compact team summary with Change. Missing entries use “To finish” and neutral navigation indicators. Invalid values retain error treatment. Supplemental files collapse when empty. |
| D2 — narrow-screen overflow | Form grids allow their contents to shrink and wrap; repeated nested padding is removed; page chrome and navigation fit narrow widths. Wizard footer wraps after saving a draft. Tested 320 px and 390 px. |
| D3 — unreadable equipment tables | Cameras combine manufacturer, model and lens into a readable Hardware column. Camera and recording-system tables share a layout that responds to the width of their container, including the wizard. Narrow tables become labelled cards. Column headers have explicit scope, including hardware-conflict comparisons. |
| D4 — inconsistent controls | Shared modern form styles give inputs, selects and text areas consistent borders, spacing, focus and sizing. Applied to optogenetics, wizard Team, daily fields and dialogs. Optogenetics labels identify required fields. Hardware changes use visible radio choices with their consequences. |
| D5 — unclear actions and scope | Visible Add epoch beside Templates; secondary Add multiple dates… on the recording list; repair labels refer to Epochs & files. Recording review uses Download YAML and Copy YAML; batch review identifies the animal and number of recordings. |
| D6 — dense/misleading review | Statescript counts say “missing.” Repeated video issues become one group with a bulk destination and individual epoch links. The export summary has larger, spaced labels and values, shows epochs in recording order, and discloses technical conversion values separately. Zero-error counts are neutral. |
| D7 — previous weight shortcut | Removed the action that turned the previous measurement into this day’s weight. The earlier value and date remain reference text; the new day requires its own entry. |
| D8 — inconsistent saving and navigation | Open Save/Cancel editors say “Editing — Save or Cancel.” Pending field drafts and failed persistence retain their distinct feedback and navigation protection. Animal/day navigation share blue/grey styling; redundant per-item status text is removed visually while accessible status labels remain. Download history remains visible. |

Additional screen cleanup removes repeated wizard empty-state headings, reduces failed-channel disclosure nesting, gives the DIO screen a title that explains both digital I/O and behavioral events, and makes workspace backup guidance shorter.

### Scientific safeguards

These presentation changes do not waive export requirements. DOB may be missing in a saved draft but still blocks export. Recording-day weight is never filled from a previous day. Copied room/camera differences require a decision. Hardware replacement and repositioning retain different failed-channel policies. A hardware step error or unreadable configuration continues to require attention.

The export review reads the same merged metadata used by the exporter. Sorting the displayed epoch sequence does not reorder or change the YAML model.

## Browser evidence

The walkthrough used synthetic animals and both new setup and existing recording data. The follow-up example still has a missing weight, four missing videos and a room/camera decision before entry.

- [Daily log, desktop](design-fixes-evidence/24-final-followup-desktop.png)
- [Daily log, 390 px](design-fixes-evidence/25-final-followup-phone.png) and [320 px](design-fixes-evidence/26-final-followup-320.png)
- [Grouped recording repairs](design-fixes-evidence/27-final-blocked-review-phone.png)
- [Camera catalog](design-fixes-evidence/06-cameras.png), [phone layout](design-fixes-evidence/08-cameras-phone.png), [Save/Cancel editor](design-fixes-evidence/07-camera-dialog.png)
- [Wizard identity](design-fixes-evidence/09-wizard-identity.png), [electrodes](design-fixes-evidence/28-final-wizard-electrodes.png), [recording system](design-fixes-evidence/14-wizard-system.png), [team](design-fixes-evidence/15-wizard-team.png), [saved draft at 320 px](design-fixes-evidence/29-final-wizard-saved-320.png)
- [Optogenetics form](design-fixes-evidence/30-final-opto-form.png), [hardware-change choices](design-fixes-evidence/23-new-configuration.png)
- [Recording setup](design-fixes-evidence/20-recording-setup.png), [failed channels](design-fixes-evidence/21-failed-channels.png), [DIO](design-fixes-evidence/22-dio.png)
- [Completed recording review](design-fixes-evidence/19-final-export.png) and [animal review](design-fixes-evidence/31-animal-review.png)

At 390 px, the follow-up weight field moved from roughly **975 px to 459 px** below the document top. It appears at **558 px** at 320 px. Both final examples have **zero horizontal page overflow**. These are layout measurements, not measured improvements in scientists’ task-completion time.

The completed browser flow entered **455 g**, retained the confirmed Room B context for run epochs 2 and 4, generated two statescript entries and four video entries, then downloaded [the YAML](design-fixes-evidence/20230624_FixRat2_metadata.yml). The [parsed download check](design-fixes-evidence/download-check.json) verifies these values, subject identity, DOB and the voltage conversion value.

## Verification

- Full Vitest run: **5,680 tests passed across 391 files**. Subsequent targeted checks passed after the final table, navigation and accessibility edits: **131 tests**.
- **38 browser scenarios passed** across the final suite and targeted reruns. Coverage includes first-time draft saving, backfill, autosave/reload, two-tab protection, backup/restore, changed-since-download status, invalid hardware identities, statescript repair focus, single/batch YAML download, responsive navigation, dialog focus, and the new design regressions. The final targeted run passed all **14** scenarios.
- **19 retained screen audits, zero axe violations**. Manual checks supplemented axe for wrapping, readable values and visual hierarchy.
- TypeScript, ESLint and production build passed. Stylesheet lint reported **zero errors** and **205 warnings in older styles**; the newly shared form/table/workspace styles passed their targeted check.
- `git diff --check` passed.

[Verification data](design-fixes-evidence/verification.json). Browser regression coverage is in [workspace-design-entry.spec.js](../../../e2e/workspace-design-entry.spec.js).

## Remaining validation

The design findings are addressed. A scientist pilot is still needed to establish speed, comprehension and comfort in real use. This pass verified metadata entry and YAML download; it did not repeat a full Trodes → NWB → DANDI → Spyglass run with a real recording. The earlier workflow fixes and their pipeline limitations remain documented in [SCIENTIST_REVIEW_FIXES.md](../2026-09-15/SCIENTIST_REVIEW_FIXES.md).
