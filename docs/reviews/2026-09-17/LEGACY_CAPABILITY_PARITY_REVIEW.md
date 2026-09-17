# Scientist workflow and legacy capability audit

Date: 2026-09-17. Reviewed `modern` at `6907de8e`. This is a new audit, not a restatement of the earlier fixes. Application code was not changed.

Consumer checkouts: `trodes_to_nwb` at `66034121` (tracked source clean; existing untracked `uv.lock`) and Spyglass at `827096d5` (existing worktree changes, primarily spike-sorting work). Consumer repositories were read only. The audit uses their local code, not an assumed published package version.

> **Follow-up:** C1–C8 are now fixed. See [fixes and verification](FIXES.md) for the changes, regression results, and downstream acceptance limits. The findings below preserve the original audit.

## Decision

**The main workflow can produce usable metadata, but the modern app is not yet a dependable replacement for every legacy editing workflow.** Ordinary corrections can strand files outside the editor; DIO entry can omit or replace a line; a partial units entry can be reported saved and then disappear.

A real sample conversion succeeded using YAML downloaded from the modern UI: 128 electrodes, 32 electrode groups, two recording epochs, two videos, and both statescript contents. This establishes a working path, not general acceptance of every recording or optogenetics configuration.

## What the scientist needs to accomplish

1. Establish the animal's identity and reusable experiment, team, rig, probe, camera, task, and optional implant information once. Copying another animal must still require the new animal's own facts.
2. Select the actual recording date, whether entering it immediately or much later. Use the configuration that applied then.
3. Enter that day's measured weight, actual epoch order, task context, files, failed electrodes, and any stimulation protocols. Stable experimenters should remain a default, with a reachable day-only exception.
4. Leave an unfinished draft and resume it without losing partially entered values. Move between computers using an explicit backup.
5. Correct a wrong epoch, camera, filename, wiring label, measurement, or shared default without silently changing unrelated history. Every retained export-blocking record must have an editor or removal action.
6. Review the actual values, export the correct dated YAML, and supply the referenced recording files and device metadata to the converter. Later edits must identify stale downloads.

## Confirmed findings

### C1 — P1: Deleting an epoch strands its files and blocks export

**Reproduction:** Create two epochs with generated statescripts and videos. Open epoch 2's actions, choose **Delete epoch 2**, then accept **Clear references**. Open Review & export.

**Observed:** Two `must be integer` errors block download. The stored statescript and video still exist with `task_epochs: ''`. Both **Fix in Daily log** buttons lead to a screen with no control for those rows. The remaining epoch shows only its own files. Undo can reverse the deletion while the toast is available; it does not let the scientist finish the intended correction. Re-adding an epoch does not reconnect a blank reference.

**Cause:** [EpochsTab.tsx](../../../src/pages/DayEditor/EpochsTab.tsx) lines 285–297 clear the references but retain the records. The grid displays records matched to existing epochs; there is no unassigned-video editor, and statescripts are excluded from the supplemental editor. Legacy exposes the independent file rows and their epoch selectors.

**Required fix:** Offer an explicit choice to remove the affected file rows or keep them in a visible **Unassigned files** area. That area must support reassignment and removal for both files and videos. Include the filename in each validation message. Test deletion through the real buttons, then complete a valid export without undoing the deletion.

Evidence: [export errors](evidence/45-deleted-epoch-blocks-export.png), [repair destination](evidence/46-deleted-epoch-dead-end.png).

### C2 — P1: A statescript can disappear from its editor while the scientist types

**Reproduction:** On a day with a statescript already linked to epoch 1, add a Custom file, select epoch 1, and type `statescript extra` into its name.

**Observed:** The row immediately vanishes. Supplemental files reports zero. The hidden row remains saved with blank description/path, blocks export, and its repair link cannot open an editor. This also exposes a wider limitation: only the first statescript for an epoch is reachable. The epoch panel has a path override and description, but no independent statescript name, epoch selector, or removal action. **Override name** actually edits the stored path.

**Cause:** [AssociatedFilesEditor.tsx](../../../src/pages/DayEditor/AssociatedFilesEditor.tsx) line 141 filters every row classified as a statescript, based on editable name/description/path text. [epochGridViewModel.ts](../../../src/viewmodels/epochGridViewModel.ts) line 279 chooses only the first matching statescript. [EpochsTab.tsx](../../../src/pages/DayEditor/EpochsTab.tsx) line 517 updates only its path.

**Corpus check:** Five of the 1,799 parsed collected YAMLs contain multiple statescript-like rows referencing the same epoch. Some appear to be incorrect references, which is precisely why an accessible correction path matters. The separate `all_rat_metadata_yaml` folder contains 325 parsed YAMLs, with one such case; these collections overlap and should not be combined as independent observations. These counts do not establish that multiple logs per epoch are routinely intended.

**Required fix:** Keep an actively edited row mounted. Provide a complete file-management surface for every retained row, including statescripts and duplicate/orphaned imports. Keep the quick generated-file workflow, but give it reachable rename, reassign, and remove actions. Do not require editing JSON or rebuilding the recording day.

Evidence: [row disappears](evidence/23-vanished-file.png), [repair dead end](evidence/25-file-repair-dead-end.png).

### C3 — P2: Partial units entry is reported saved but is lost

**Reproduction:** Recording Setup → Day-only technical overrides. Enter `millivolts` in Analog units, leave Behavioral-event units blank, and save. Go to Review & export, download, then return.

**Observed:** The screen says **Saved just now** and **Ready to export** alongside the instruction to complete both units. The download succeeds without `units`. Analog units is blank on return. This is a draft-preservation failure even though the omitted block is optional.

**Cause:** [DayTechnicalSection.tsx](../../../src/pages/DayEditor/DayTechnicalSection.tsx) lines 53–64 returns without writing partial units. [useDraftField.ts](../../../src/hooks/useDraftField.ts) marks the draft clean before calling that writer.

**Required fix:** Persist partial drafts, expose their incomplete state to the export gate, and retain both typed values across navigation/reload. Clear the entire optional block only when the user clears both fields. Include the case of clearing one member of an already complete pair.

Evidence: [saved partial entry](evidence/19-partial-units-before.png). The browser reproduction observed the returned input value `''` and downloaded YAML with no units block.

### C4 — P2: The first Add line click can do nothing for a custom DIO name

**Reproduction:** On empty DIO Wiring, select Dout, index 1, type `reward_left`, and click **Add line** directly from the input.

**Observed:** The custom-name warning appears, but no line is added. A second click adds it. In the first end-to-end pass, immediately navigating onward after the first click produced YAML with `behavioral_events: []`. This was reproduced again independently.

**Cause:** On blur, [SuggestionCombobox.tsx](../../../src/components/SuggestionCombobox.tsx) lines 160 and 225 reveals the warning. The bottom-aligned add row in [BehavioralEventsDisplay.scss](../../../src/pages/DayEditor/BehavioralEventsDisplay.scss) line 72 moves the button during the pointer interaction, interrupting the click.

**Required fix:** Keep the action stationary when feedback appears and make one deliberate click reliably add the line. Test a free-text value outside the suggestions using a real pointer, including immediate navigation afterward.

Evidence: [after first click](evidence/27-dio-after-add.png), [after second click](evidence/28-dio-second-click.png).

### C5 — P1: Add line silently replaces an existing DIO mapping

**Reproduction:** Add Din1 named `Poke1`. The add form keeps index 1. Enter `Poke2` and click **Add line** again.

**Observed:** `Poke1` disappears; only Din1 → `Poke2` remains. No overwrite confirmation or undo is offered. This is especially easy while quickly entering consecutive channels.

**Cause:** [BehavioralEventsDisplay.tsx](../../../src/pages/DayEditor/BehavioralEventsDisplay.tsx) lines 141–146 uses the same replacement operation as editing an existing row and only clears the name field. It does not advance the index or identify an occupied channel.

**Required fix:** Default to the next unused channel. If an occupied index is selected, identify the existing mapping and offer an explicit replacement action, or direct the scientist to edit that row. **Add** should not silently overwrite recorded wiring.

Evidence: [replacement result](evidence/64-add-dio-overwrites.png); observed store transition was `Din1/Poke1` → `Din1/Poke2`, with the existing Dout1 unchanged.

### C6 — P2: Supplemental-file fields say optional when export requires them

**Reproduction:** Add a Custom file, enter a name and task epoch, and leave Description and Path blank as their `optional` placeholders suggest.

**Observed:** Export blocks on both fields. Task epoch is also required but lacks the required cue used for the name.

**Cause:** [AssociatedFilesEditor.tsx](../../../src/pages/DayEditor/AssociatedFilesEditor.tsx) lines 201–230 contradicts [nwb_schema.json](../../../src/nwb_schema.json) lines 574–630. The legacy form marked description and path required.

**Required fix:** Distinguish **adding a file is optional** from **these fields are required once a file is added**. Mark all four fields and show useful inline errors. Explain that the path must be readable on the conversion computer; the browser cannot establish that merely from a typed path.

Evidence: [entry fields](evidence/21-supplemental-optionals.png), [blocked export](evidence/22-supplemental-blocked.png).

### C7 — P2: The modern animal editors cannot choose the supported sex value O

The legacy selector exposes M, F, U, and O; the schema permits all four. Both [CreateAnimalWizard.tsx](../../../src/pages/Home/CreateAnimalWizard.tsx) lines 705–710 and [AnimalProfileDialog.tsx](../../../src/components/AnimalProfileDialog.tsx) lines 247–250 omit O. The legacy and modern selectors were inspected in the browser. There were no O values in the collected corpus scan; this remains a concrete capability gap, not a claim about frequency.

**Required fix:** Use one shared enum/label catalog and expose **Other (O)** in both modern editors. Preserve and visibly represent that value on import/edit.

### C8 — P2: The header-path help promises behavior the current converter does not implement

[DayTechnicalSection.tsx](../../../src/pages/DayEditor/DayTechnicalSection.tsx) lines 183–186 implies that entering Default header file path changes the header used for the recording. The local converter does not read the YAML key `default_header_file_path`; `convert.py` lines 326–329 instead uses the separate `header_reconfig_path` conversion argument.

**Required fix:** Clearly describe this as a recorded legacy value and explain the required conversion argument, or implement and verify an agreed converter integration. Do not imply that the YAML field alone changes the mapping/header used. This is a consumer-contract mismatch also relevant to legacy output, not a newly demonstrated conversion regression.

## Screen-by-screen result

The [field coverage CSV](FIELD_COVERAGE.csv) inventories all 98 leaf-field families in the app schema, grouping the 128 possible local-channel map keys into one family. The [control inventory](evidence/control-inventory.json) records the actual visible controls in the captured UI states. Neither artifact labels every possible combination as tested.

| Screen / surface | Entry and actions checked | Result |
| --- | --- | --- |
| Workspace | Empty/populated states, animal table, filters, import/create entry, backup/restore, overflow actions | Clear entry points. Browser-only storage and transfer route are explicit. Backup download and replacement restore completed. |
| New animal: Identity | ID, species, sex, genotype, DOB, optional description, Back/Next/draft exit | Created from empty storage. Required DOB may remain draft-only, not export-ready. Sex O missing (C7). |
| Experiment & team | Multiple experimenters, lab, institution, experiment description | Entered once and preserved in exported daily metadata. Correct ownership for a rarely changing team. |
| Recording system | Default device, system/amplifier/ADC, explicit review, library/edit controls, advanced constants | Setup and daily selection are separate. Voltage uses V/count. Imported sample exported and converted successfully. Header-path wording remains wrong (C8). |
| Electrodes | Bulk add, device type, target and measured location, coordinates/units, description, effective date, edit and overflow | Two groups created through UI; 32-group sample imported. Shared correction and hardware-change actions reviewed. Header mapping checked against the real sample header. |
| Channel mapping | Trodes IDs, local-channel electrode order, header comparison, Cancel/Save | Nonsequential IDs and a permuted electrode order entered and exported. Real sample comparison matched 32 four-channel ntrodes. UI correctly says header comparison cannot prove physical probe wiring. |
| Cameras | Name, manufacturer, model, lens, calibration, assigned ID, Add/Edit/delete/reference safeguards | All schema fields have a place. Required calibration and downstream identity guidance are visible. Existing browser checks cover identity/reference guards. |
| Task types | Name, description, environment, cameras, Add/Edit/delete, scope dialog | First task created. Changing its default environment and choosing “Keep earlier days” preserved the earlier day values in the store. |
| Optogenetics setup | Enable/off, all source/fiber/injection fields, coordinates/reference, software, add/remove, apply to selected days | All fields entered through the UI, including zero angles. Applied only to June 23; June 22 retained no optogenetics. |
| Recording Days | Actual-date entry, follow-up creation, previous-data source, multiple-date entry and row actions | First, follow-up, and duplicate days created; day deletion and Undo exercised. Weight stays blank with a dated prior suggestion. New day retains task sequence/DIO/failures and requires new files. |
| Daily log | Weight, epochs, notes, experiment/team exceptions, keywords, read-only context | Routine fields are prominent; rare fields are disclosures. Both dated YAML downloads reflect their own measurements. Draft units elsewhere violate the same save promise (C3). |
| Epoch grid and details | Add, task/context/cameras, generated paths, video add/remove/rename, statescript override/description, ordering/actions, templates | Normal generation works. Epoch deletion creates unreachable invalid rows (C1). Statescript management lacks full correction/removal coverage (C2). |
| Supplemental files | Presets/custom, name/description/path/epoch, Remove | Actual data entry exposed disappearing rows (C2) and misleading requirements (C6). |
| Stimulation protocol | Filename, mW, stimulated epoch subset, camera, DIO output, all five pulse/train values, Done/remove | Entered and downloaded a protocol for epoch 2 only; all values survived. Complete setup alone does not falsely assert that every epoch was stimulated. |
| Daily Recording Setup | Saved rig, inferred cameras, technical overrides, configuration choice/history/reconfiguration | Required setup confirmation works on imported historical data. Paired units and header-path issues remain (C3/C8). |
| Failed Channels | Expand group, mark electrode, view map, carry-forward and reversal confirmation | Electrode 2 exported as failed; the follow-up carried it forward. Unmarking prompted for confirmation and Cancel retained it. Multi-shank semantics reviewed against the converter and existing tests. |
| DIO Wiring | Type/index/name, suggestions/custom name, add, inline edit, full ECU grid, imported Other rows | Custom-name first click can fail (C4); Add can overwrite an occupied channel (C5). No general claim of support for every custom Trodes hardware configuration. |
| Review & export | Effective values, required corrections, read-only YAML, download/copy gate, changed-since-download | Successful regular and optogenetics YAML downloads. Changed download status updates. C1/C2 repair links lead to dead ends; generic `must be integer` omits useful context. |
| Animal/all-animal batch review | Selection, include downloaded, preflight, setup/status comparison, selected download | Changed recording selected while current downloaded recording was excluded. Preflight and one-file batch download completed. |
| Import & repair | Choose YAML, original value, field repair, import-as-new, setup confirmation | Imported the prepared sample, corrected DOB formatting through the date control, explicitly confirmed historical setup, and exported. Does not substitute for testing every legacy corpus import. |
| Copy from another animal | Source, section choices, new ID, copied-setup review, draft exit | Copy reached guided identity confirmation; source recording days were not copied. |
| Profile and correction dialogs | Subject facts, scope text, Cancel/Save; task-default scope; opto day selection | Affected-day scope is visible. O enum gap remains. Direct subject facts are intentionally shared; daily weight is separate. |
| Backup / recovery | Download, restore preview, counts/differences, cancel/replace, checkpoint/original-copy controls | Actual downloaded backup restored successfully. Recovery corruption commands were source-reviewed; this audit did not manually inject every corruption class. |
| Narrow layout / keyboard | 390×844 daily log and epoch drawer; existing focus/navigation/export checks | Captured daily/epoch layouts fit the viewport. Eight manually captured states passed axe. This is not exhaustive accessibility certification. |

## Output and downstream verification

- A production build completed, and the manual browser journey used that build on a separate local preview server.
- The from-scratch `ParityRat` journey produced two downloadable YAMLs. The second includes the full optogenetics setup and an epoch-2 protocol with all pulse/train fields.
- For the real-recording test, a **copy** of the provided sample metadata was prepared for the two available sample epochs: subject/file token `sample`, two Sleep epochs using camera 0, real statescript paths, and no optogenetics. The source data was not edited. This prepared YAML was imported, repaired in the UI, downloaded, and then passed unchanged to the converter.
- The local `trodes_to_nwb` metadata validator accepted that downloaded YAML. `create_nwbs` completed against the two provided `.rec` files and associated position/video data.
- Reopening the resulting NWB confirmed 128 electrodes, 32 electrode groups, two epochs, raw electrophysiology, task/position/video processing, and two nonempty statescripts (4,289 and 3,755 characters).
- PyNWB schema validation returned no errors. The initial Inspector run flagged the external videos because the audit supplied a separate output directory; placing the copied videos beside the NWB resolved those findings. The DANDI-configured Inspector then returned **53 suggestions, no critical findings or best-practice violations**. Suggestions concern descriptions (43), module names (7), compression (1), keywords (1), and a single-row table (1).
- Results are in [converter-result.json](evidence/converter-result.json). The 208 MB NWB and full conversion logs remain under `/tmp/app-parity-conversion`; they are not repository changes.
- Spyglass's local ingestion code was reviewed for subject/task/camera/file identity and statescript handling. **No Spyglass database insertion or DANDI upload/CLI validation was performed.** The complete optogenetics export was inspected, but was not included in the raw-recording conversion run.

## Regression coverage gap

The broader run selected 59 existing browser checks across lifecycle, ownership, persistence, entry, optogenetics, responsiveness, export gates and workflows: **48 passed, 11 failed**. All 11 stopped on obsolete selectors/content assumptions before their intended assertions completed:

- Old descriptions disclosure and field names (1).
- Old create-animal helper/heading (2).
- Removed animal-ID badge, scope panels, setup card, or recording-days heading (4).
- Renamed primary review link at two viewports (2).
- Old batch-table columns and “errors” classification for an incomplete record (2).

The current production UI was exercised independently above. The stale tests must still be updated and rerun; their unexecuted assertions are not passes. Full log: [browser-regression-log.txt](evidence/browser-regression-log.txt).

The existing “legacy parity” tests compare prepared data/export objects. They cannot establish that users can create, reach, correct, or remove every represented value. Likewise, a validator having a repair command does not prove that its destination mounts the offending input. C1/C2 demonstrate that distinction.

## Recommended completion order

1. Repair file/epoch deletion and provide complete management for retained statescripts and unassigned files/videos (C1/C2).
2. Make DIO Add reliable and prevent silent replacement (C4/C5).
3. Preserve incomplete units, correct required-field cues, restore the missing sex option, and correct header-path guidance (C3/C6/C7/C8).
4. Add browser regressions that reproduce these specific user actions, repair the stale workflow tests, and run them to their final export assertions.
5. Repeat the real sample conversion and complete an optogenetics conversion plus a representative Spyglass ingestion before declaring the downstream workflow accepted.

The design direction is useful: daily work is compact, shared setup is reusable, and scope is usually explicit. The remaining problems are concentrated in **correction, saving and adding records**, where a scientist reasonably expects a familiar web form to preserve what they typed and provide a way back from mistakes.
