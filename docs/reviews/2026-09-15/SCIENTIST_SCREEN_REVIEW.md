# Scientist walkthrough: first setup, first recording, and the next day

> **Follow-up:** S1–S7 and related workflow corrections are implemented. See [changes and verification](SCIENTIST_REVIEW_FIXES.md). This review describes the pre-fix app.

**Reviewed September 15, 2026:** `5c053415`, branch `fix/workflow-review-followup`.

**Conclusion:** The modern app has a useful animal/day structure and several effective correction safeguards. It is not ready for an unassisted first-time scientist pilot. A normal manually created recording reaches an export dead end, a seeded voltage constant has the wrong magnitude for the converter, and manual probe setup cannot express the recording's actual ntrode IDs. These are more consequential than visual polish.

This assessment revises the earlier “close to a pilot” assessment based on a fresh journey through the running UI. It does not reopen the previously fixed F/R findings without new evidence. Application code was not changed in this review.

## 1. What the scientist needs to accomplish

The scientist's job is to describe **what happened on a particular recording date**, using reusable information without accidentally asserting that yesterday's facts are today's measurements. They may enter this immediately or months later.

| Information | Appropriate scope | What the interface should communicate |
| --- | --- | --- |
| Subject identity, species, sex, DOB, genetic background | Animal; corrections can affect historical exports | Stable facts, with an explicit correction preview and affected-day count. |
| Probe layout, anatomical targeting, Trodes IDs/channel maps | A dated configuration | Which setup was physically in use on the recording date; distinguish replacing hardware from moving an existing probe. |
| Recording system, camera identity/calibration, task definitions, DIO wiring | Reusable defaults that can change | Reuse with a visible source; make historical correction versus future change explicit. |
| Weight, actual experimenters, session description, epoch sequence, failures observed | Recording day | Enter or confirm for the selected recording date. Never silently manufacture a measurement. |
| Task room, ordered cameras, file references, stimulation actually delivered | Day and, where applicable, epoch/task instance | Show the effective value and exactly which epochs an edit changes. |
| Save, metadata validation, YAML download, successful conversion | Separate states | Saving a browser draft or generating a filename does not verify a raw file or prove NWB conversion succeeded. |

The supplied [YAML analysis](/Users/edeno/Downloads/yaml_analysis2/REPORT2.md) supports this separation: it reports variation in task names for 77/142 multi-day animal groups, camera names for 41/142, associated-file counts for 95/142, and bad channels for 25/142. Those are the supplied analysis's counts, not a fresh corpus recount. Its experimenter stability statistic is conditioned on grouping by experimenter and subject, so it cannot establish that an animal's team never changes.

**Desired repeat-day flow:** choose animal and recording date → review the previous day's structure and any changes → enter weight/team/epochs/files → inspect the effective metadata → download. Setup and raw YAML details should be available when needed without dominating daily entry.

## 2. Screen-by-screen assessment

### First-time setup

| Screen | Scientist's task | Observed result and recommendation |
| --- | --- | --- |
| Workspace / empty state | Decide whether to import existing metadata, copy a setup, or start fresh | Clear Create/Import choices and an explicit browser-only storage notice. Backup/restore controls are visible. Good foundation. For established labs, lead with importing a known recording or hardware configuration. |
| Identity | Enter the animal ID exactly as used in recording filenames and known subject facts | Fields are usable, unknown DOB and baseline weight can remain blank, and case is preserved. But “RS10 = rs10” describes uniqueness rather than converter matching and can suggest capitalization is irrelevant. Use the profile editor's clearer exact-filename wording here. Show allowed characters before an error. |
| Electrodes | Describe the implanted probes and match acquisition wiring | Anatomical fields and units are present. Automatically generated maps cannot be reconciled to actual Trodes ntrode IDs in this UI: **S3**. Explain the stereotaxic origin/sign convention alongside coordinates. Provide a header-derived preview and editable mapping. |
| Cameras | Register the camera and the spatial calibration used for tracking | Name, hardware, lens, and meters/pixel can be entered. Distinguish camera hardware identity from a dated calibration. A scale example such as “0.00085 m/px = 0.85 mm/px” would make unit mistakes easier to spot. Hardware defaults should visibly require review. |
| Optogenetics | Describe implanted fibers, virus injections, and excitation hardware, if used | Opt-in presentation is appropriate; the form exposes units, hemisphere and coordinate reference. The incomplete-setup gate explains missing sections. However, enabling it immediately says “Opto configured · 2 of 4” despite three incomplete scientific sections. Count valid sections and say “setup incomplete.” The long converter explanation can become secondary help. |
| Task types | Define recognizable lab tasks, descriptions, default room and cameras | These facts can be entered. The subsequent W-track template does not reuse the configured `w_alternation` task: **S6**. Explain that these are reusable definitions; the actual sequence and day context belong to the day. |
| Recording system | Confirm the acquisition system and technical constants | Advanced settings are appropriately separated from routine entry, but the default voltage conversion is wrong for the local converter: **S2**. “Do not change without guidance” reinforces the incorrect default. |
| Team / finish | Establish usual team, lab, institution and experiment description | All are enterable. Daily experimenters can later differ. Add a compact final setup review, including recording-system defaults and when the probe configuration became effective. The seven-step introduction incorrectly says setup is revisited only on re-implant. |
| Existing animal / profile | Correct an animal fact without making another animal | The profile dialog names all affected recording days and asks for confirmation. Correcting imported subject ID `54321` to the sample recording token `sample` changed the downloaded filename correctly. The workspace still prominently shows `54321`; label this retained workspace identifier separately so two apparent animal IDs do not confuse the scientist. |

### First recording and follow-up

| Screen | Scientist's task | Observed result and recommendation |
| --- | --- | --- |
| Recording Days | Choose today's date or backfill an older recording | Both are available; the source is the nearest earlier day. Keep this model. Make the initial configuration's unknown effective date easy to resolve before entering a block of old recordings. |
| Daily log: weight/team | Record this session's actual measurement and personnel | Follow-up weight correctly stays blank and offers the dated previous value as a suggestion. Team carries forward with day-only edit guidance. “Weight measured today” is wrong during backfill: **S7**. |
| Daily log: epochs | Describe the recording blocks, task assignments and files | The sequence is understandable, and details expose task context and filenames. Template/task mismatch adds avoidable work (**S6**). Generated statescripts cannot be made exportable through the shown controls (**S1**). |
| Epoch details | Correct a task, room, cameras or file; declare an epoch had no video | The drawer is usable on desktop and phone. Room edits show “this day” and apply to matching task epochs; make the affected epoch list explicit. “No video” immediately records the declaration and offers Undo. The generated-file description is missing, and “Complete” can coexist with blocking errors. |
| Supplemental files | Enter additional logs/scripts with descriptions and epoch associations | Editable filename, description, path and epoch are available. Generated statescripts are excluded from this editor, which contributes to **S1**. Keep the separation only if every excluded field has another repair surface. |
| Descriptions / data folder / search terms | Add meaningful session details and the raw-data folder | Fields exist behind a disclosure; the folder is also placed near generation when needed. A first recording should invite a useful session description instead of making the autogenerated “Recording session for…” look fully reviewed. |
| Recording Setup | Confirm the rig, camera use, technical overrides and configuration for this date | Necessary controls are present and unknown historical configuration applicability blocks export. This is a useful safeguard. The provenance line later misstates the unknown effective date: **S7**. |
| Failed Channels | Mark hardware failures; correct a carried mark | June 22 channel 2 carried to June 23. Unmarking it required confirmation; June 22 retained its mark. Good protection. On a clean first day, the editing controls are buried under “Other groups” and then the group disclosure. Use “Mark failed channels” and “No failures recorded” rather than declaring all groups clean. |
| DIO Wiring | Name the hardware inputs/outputs used by this rig/session | Din/Dout explanations and a compact named-lines view help. Adding `Din1 → left_poke` persisted. Prefer “Edit mappings” to “edit only if rewired”: correcting a transcription mistake also needs this screen. Include a compact day review of inherited mappings. |
| Next-day creation | Reuse structure without re-entering stable facts | Team, failed channels and a redated folder carry; weight and files reset. However, the previous room override silently resets to the animal default (**S5**). Show the reset and source explicitly. |
| Hardware change | Record a new setup with the correct start date | The modal includes effective date, copy-current option and affected-day policy. Its introduction says existing days keep their version while a later sentence says days from the date forward move to v2. Use one precise explanation. It also offers “repositioning” while unconditionally resetting failed-channel marks; see the scope issue below. |
| Fix & Export | Find actionable errors, check facts, then download | The readable effective-day review and download freshness are valuable. Readiness contradictions and an advisory warning blocking export undermine trust (**S4**). Every blocker must name the field and take the scientist to its actual editable control. |
| Animal validation / bulk export | Identify unfinished days and export a recording block | Readiness table and “Changed since download” are useful. The animal page repeats a large configuration summary above the electrode editor; 32 probes produce two long lists. Compact or collapse this summary. Bulk-download behavior was not re-executed in this pass. |
| Import / repair | Bring in existing files without losing their facts | The real sample exposed duplicate associated-file paths and conflicting virus-volume keys. Both were repairable before import. After fixing a later subject-ID warning and declaring three missing videos absent in the test copy, the app downloaded schema-valid YAML with both task definitions intact. See verification limits below. |

## 3. Prioritized findings

### S1 · P1 · Generated statescripts create an export blocker with no description editor

**Reproduction:** Create an animal, configure `sleep` and `w_alternation`, create a day, assign the tasks, enter a folder, and generate expected statescripts and videos. Select Fix on the resulting description error.

**Observed:** Both generated statescripts have `description: ''`. Export reports “Description cannot be empty or contain only whitespace.” Fix opens an epoch drawer with filename/path editing but no description control. Supplemental files shows zero rows because it deliberately excludes statescripts. The epoch itself says Complete.

**Cause:** [epochGeneratedFiles.ts:134](../../../src/domain/epochGeneratedFiles.ts#L134) and [EpochsTab.tsx:517](../../../src/pages/DayEditor/EpochsTab.tsx#L517) create blank descriptions; [EpochsTab.tsx:1341](../../../src/pages/DayEditor/EpochsTab.tsx#L1341) renders the limited repair UI; [AssociatedFilesEditor.tsx:141](../../../src/pages/DayEditor/AssociatedFilesEditor.tsx#L141) hides these rows from the other editor.

**Correction:** Give generated statescript logs a valid, converter/Spyglass-appropriate file-type description; expose description editing for generated and imported statescripts; include filename and epoch in the error. Do not invent experimental observations to satisfy validation.

**Acceptance:** Complete a fresh recording through ordinary controls, generate its files, and download without editing YAML externally. An imported blank statescript description must also be repairable.

**Evidence:** [Repair drawer](scientist-screen-review-evidence/31-generated-file-repair.png), [saved workspace](scientist-screen-review-evidence/first-day-generated.json).

### S2 · P1 · The default voltage conversion is one million times the expected fallback value

The wizard seeds `raw_data_to_volts: 0.195`, labels it V/bit, and recommends leaving it unchanged. The application's own schema and the supplied real sample use `1.95e-7` V/count. The supplied corpus report records that value in 1,787 files.

In local `trodes_to_nwb`, `add_raw_ephys` multiplies the metadata value by 1e6 to obtain microvolts/count when the recording header lacks `rawScalingToUv`. A probe invoking the actual function with recording I/O and NWB construction stubbed observed **195,000 µV/count** from the app default versus **0.195 µV/count** from `1.95e-7`.

**Condition matters:** A header containing `rawScalingToUv` takes precedence, so this does not imply every current recording is mis-scaled. It is an unsafe fallback default with potentially serious analysis consequences.

**Locations:** [animalCreation.ts:263](../../../src/domain/animalCreation.ts#L263), [DataAcqSection.tsx:168](../../../src/pages/AnimalEditor/DataAcqSection.tsx#L168), [workspaceTransitions.ts:633](../../../src/state/workspaceTransitions.ts#L633). Converter: `trodes_to_nwb/src/trodes_to_nwb/convert_ephys.py:376–383`.

**Correction:** Establish one unit contract. If the UI displays 0.195 µV/count, convert to `1.95e-7` V/count in YAML. Review existing app-created defaults; do not blindly rescale valid imported values. Also verify the “Timestamp Scaling Factor” explanation: the local converter has no runtime Python use of `times_period_multiplier`, despite the UI claiming it derives absolute timestamps.

**Acceptance:** A known sample amplitude survives both header-scaling and metadata-fallback conversion paths. Tests must check physical units, not merely a positive number or schema validity.

**Evidence:** [Technical settings](scientist-screen-review-evidence/14-recording-advanced.png), [converter probe and result](scientist-screen-review-evidence/contract-probes.json).

### S3 · P1 · Manual electrode setup cannot describe arbitrary real Trodes ntrode IDs

Adding the first tetrode generated ntrode ID 0 and a sequential map. The setup screen explains that maps are generated automatically, but has no control for the actual recorded ntrode ID or a different channel mapping.

The supplied sample recording has ntrode IDs 1–32. The converter matches exact IDs. Calling its actual `validate_yaml_header_electrode_map` with the UI-generated map and a four-channel header ntrode 7 raises a missing-ntrode error. Automatic numbering is therefore not a sufficient configuration import or verification mechanism.

**Locations:** [channelMapUtils.ts:62](../../../src/utils/channelMapUtils.ts#L62), [ElectrodeGroupsContainer.tsx](../../../src/pages/AnimalEditor/wiring/ElectrodeGroupsContainer.tsx). Converter: `convert_rec_header.py:103`.

**Correction:** Implement the planned Trodes configuration import with exact IDs/maps preserved through later edits, or provide explicit mapping controls plus a header comparison. A generated map must be labelled unverified until checked against the acquisition configuration.

**Acceptance:** Import or enter nonzero/nonsequential ntrode IDs, edit anatomical metadata, export, and pass the converter's actual header/map check. A mismatch should be discovered before an expensive conversion.

**Evidence:** [Electrode setup](scientist-screen-review-evidence/05-electrodes-filled.png), [actual converter check](scientist-screen-review-evidence/contract-probes.json).

### S4 · P2 · Readiness is contradictory; a non-blocking warning can actually block download

Two independent reproductions:

1. A manual day with weight and confirmed setup but **no epochs** says “Ready to export”; Fix & Export is marked Complete, while the download gate requires tasks.
2. The imported sample, after actual blockers are resolved, has two advisory warnings and no blocking issues. Every section is Complete, and the review explicitly says warnings do not block export, but Download is disabled. The subject-ID placeholder warning makes the overview prerequisite `error`. “Fix in Daily log” does not identify the animal profile field that caused it.

**Cause:** [ReadinessBar.tsx:104](../../../src/components/ReadinessBar.tsx#L104) equates no displayed blocking issues with export readiness. [stepStatus.ts:285](../../../src/domain/stepStatus.ts#L285) treats any overview issue, including a warning, as an error. The navigation, epoch badges and final gate use different predicates.

**Correction:** Derive all readiness displays and actions from one result covering required completeness, blocking errors and advisory warnings. If a warning really must block, classify and explain it consistently. Keep normal unfinished drafts distinct from mistakes. Route repairs using the affected field and its owner.

**Acceptance:** Across blank, incomplete, warning-only and valid days, all surfaces agree with Download availability. No vague prerequisite blocker remains without a concrete repair.

**Evidence:** [Empty-day readiness](scientist-screen-review-evidence/25-epoch-template.png), [all-complete but blocked import](scientist-screen-review-evidence/48-import-ready-export.png), [warning/status probe](scientist-screen-review-evidence/warning-gate-probe.json).

### S5 · P2 · Follow-up creation silently discards the prior day's room override

June 22's `w_alternation` epochs were changed from default Room A to Room B using “Edit for this day.” Creating June 23 from June 22 copied the sequence, but the task environment became Room A again. The page says “Started from Jun 22” without exposing this reset.

This follows the previously accepted reset-to-default policy, rather than being a newly introduced regression. The problem is whether a scientist can correctly predict and notice the result. Camera overrides are stripped by the same [workspaceTransitions.ts:666](../../../src/state/workspaceTransitions.ts#L666) path.

**Correction:** Show “Room A — animal default; previous recording: Room B” when the values differ. Offer deliberate choices to use the default, reuse prior context, or update future defaults. Do not silently assume either room is correct.

**Acceptance:** A follow-up with differing environment or ordered camera context presents that difference before export; the earlier day stays unchanged.

**Evidence:** [Previous-day Room B](scientist-screen-review-evidence/29-day-complete.png), [follow-up Room A](scientist-screen-review-evidence/38-followup-task-context.png), [saved follow-up](scientist-screen-review-evidence/followup-workspace.json).

### S6 · P2 · The W-track template creates an incomplete duplicate task

The animal already had `w_alternation`, its description, Room A and a camera. Applying W-track day created another task named `W-track`, without environment or cameras, and used that instead. The scientist must repair task assignments or configure the duplicate.

[EpochsTab.tsx:980](../../../src/pages/DayEditor/EpochsTab.tsx#L980) matches template tasks by exact case-insensitive name, then creates a minimal definition if missing.

**Correction:** Let the scientist map template roles to existing task definitions in a short sequence preview, and remember that mapping. Do not guess equivalence using fuzzy name matching; similarly named tasks may mean different scientific protocols.

**Acceptance:** A scientist with an existing W-track task can apply the template without duplicate definitions, missing context or unwanted filename changes.

**Evidence:** [Template result](scientist-screen-review-evidence/26-template-applied.png), task catalog in [saved workspace](scientist-screen-review-evidence/first-day-generated.json).

### S7 · P2 · Backfill and provenance wording confuse entry time with recording facts

In a June 2023 recording entered in September 2026:

- Weight is labelled “measured today,” and the previous-weight hint asks for today's measurement.
- Setup v1 has `effectiveDateKnown: false`, but the day line says “effective Sep 15, 2026.” Confirming it for one older day does not establish that effective date.
- Confirming an imported configuration changes the line from import provenance to “Started blank,” because origin and configuration-confirmation source share the same display test.
- The entry date is displayed from the UTC date substring, while “Log today” uses the local date. The walkthrough showed Sep 16 versus Sep 15 without explaining the timezone.

**Locations:** [DayTab.tsx:166](../../../src/pages/DayEditor/DayTab.tsx#L166), [DayProvenanceLine.tsx:34](../../../src/pages/DayEditor/DayProvenanceLine.tsx#L34), [CreateAnimalWizard.tsx:565](../../../src/pages/Home/CreateAnimalWizard.tsx#L565).

**Correction:** Use the selected recording date in entry labels. Keep recording date, setup effective date, entry timestamp and import/copy origin separate. Say “effective date unknown; confirmed for this recording” when that is the stored fact. Ask for the initial setup's effective date, with an honest unknown option, during setup or the first historical entry.

**Acceptance:** Backfilling and confirming a configuration never relabels an unknown date as known or an imported day as blank. Origin survives later repairs.

**Evidence:** [Follow-up day](scientist-screen-review-evidence/37-followup-day.png), [imported day after confirmation](scientist-screen-review-evidence/47-no-video-reason.txt), [configuration card with unknown date](scientist-screen-review-evidence/55-animal-electrodes.txt).

## 4. Design changes beyond the blockers

1. **Put today's work first, using the selected recording date.** A compact date/source header, weight, actual team and epoch list should dominate. Collapse the repeated multi-error summary during entry; retain a clear count and expand it on review. The examined phone daily log was about 4,012 px tall.
2. **Show inherited facts and differences at the point of use.** “From Jun 22,” “animal default,” and “changed for this recording” should distinguish provenance without making users study architecture. The useful analogy to a daily meal log is reusable templates plus dated entries; each reused entry still needs to describe the actual day.
3. **Make status words precise.** Use “Draft,” “Needs information,” “Needs correction,” “Ready to download,” and “Changed since download.” A generated filename is a proposal until checked against the files. “No failures recorded” does not mean the scientist verified every channel.
4. **Put scientific meaning beside controls.** Units, examples, selected date and affected scope should be visible with the input. Keep serialization details and converter internals in help. This follows [W3C's form-instruction guidance](https://www.w3.org/WAI/tutorials/forms/instructions/).
5. **Keep the readable export review and improve its repair links.** Scientists should see the animal, recording date, weight, team, setup, calibration, room/cameras by task, and stimulation before committing the file. Link each item back to its editor with values retained, consistent with the [GOV.UK check-answers pattern](https://design-system.service.gov.uk/patterns/check-answers/).
6. **Distinguish hardware replacement from repositioning.** The new-configuration modal mentions both while always resetting failed-channel marks. Repositioning the same damaged probe does not establish that its channels recovered. Preserve failures for unchanged hardware, or require an explicit, informed reset decision. This is a scientific policy decision to resolve before promoting the flow.
7. **Reduce repeated setup summaries and improve progress navigation.** The seven wizard steps clip horizontally even at 1,440 px; Team can be off-screen. Provide a visible overflow cue or a compact “Step 6 of 7” control. The 32-probe animal page repeats the full probe list above the editable table.
8. **Fix the measured contrast failure.** The wizard's “Pre-filled — review” text measured 4.2:1, below the 4.5:1 requirement for its 11 px text. The four sampled phone surfaces had no page-width overflow and no automated WCAG-tagged violations; that is not a complete accessibility certification.

## 5. Architecture implications

- **A shared readiness result is needed.** Issue presentation, section completion, epoch status and export eligibility currently diverge. Extending independent badge logic will perpetuate S4.
- **Generation and repair need a complete contract.** Every generated field should have valid defaults where scientifically justified and an editor for corrections. Every blocking issue should resolve to a real editable field. S1 escaped component-level correctness because the whole journey was not covered.
- **Scientific units belong in explicit adapters.** UI display units, YAML units and converter units need documented transformations and downstream tests. A schema-valid number is insufficient evidence of scientific correctness.
- **Temporal facts need distinct fields.** Entry time, configuration effective date, copy/import origin and per-day applicability confirmation should not stand in for each other. Likewise, copying a sequence and choosing its context are separate decisions.
- **Configuration import remains functional release work.** The current automatic channel-map generator does not replace importing actual acquisition identifiers. Test preservation through ordinary anatomical edits and reconfiguration, not just initial parsing.

## 6. Verification and limits

### Executed in this review

- Used an isolated Chromium workspace at `http://127.0.0.1:3020`, with a 1,440 × 960 desktop viewport and 390 × 844 phone viewport. No ordinary user browser data or source YAMLs were modified.
- Created `UxRat01` through all seven setup screens; entered June 22; generated files; changed a task environment; marked a failed channel; created June 23; added a DIO mapping; and confirmed removal of the carried failed channel. Saved state confirms the earlier mark and Room B remain on June 22.
- Imported `/Users/edeno/Downloads/trodes_to_nwb_test_data/20230622_sample_metadata.yml` through the real repair UI. In this isolated test copy, supplied a distinct associated-file path, accepted the volume-key reconciliation, confirmed setup applicability, and declared epochs 3–5 to have no video. These declarations exercise the controls and do not establish facts about the real experiment.
- Corrected the sample subject token to `sample` through the profile confirmation, downloaded `20230622_sample_metadata.yml`, and ran the local converter's `metadata_validation.validate`: **valid, zero errors**. Both imported task definitions and their epoch assignments remained present after epoch edits. The original imported voltage constant remained `1.95e-7`.
- Changed weight from 100 to 101 after download: the review updated and the app correctly displayed **Changed since download** with a changed-content disclosure.
- Invoked actual converter functions for the voltage fallback and ntrode matching probes. NWB creation and raw-file reading were stubbed for the amplitude probe; the sample header IDs were read from the actual `.rec` header.
- Ran targeted axe scans. The wizard contrast failure is recorded; sampled mobile wizard, daily log, epoch drawer and validation view had no reported violations or horizontal page overflow. No application page exceptions were observed. Selector retries and a download-test timeout were harness issues; the underlying disabled download was separately reproduced and traced under S4.

### Not established here

This was an expert walkthrough, not a scientist usability study. Full optogenetics authoring from an empty setup, every device type, bulk download, backup restoration, all camera-change scope choices, Firefox/WebKit and screen-reader operation were not exhaustively re-tested. No new full NWB conversion or Spyglass insertion was performed; prior successful integration work remains separate evidence. The local converter inspected was at `6603412`; the app's dev build was used rather than a deployed production build. The full test suite was not rerun for this documentation-only review.

## 7. Release decision and next validation

**Fix S1–S3 before asking a first-time scientist to use manual setup unassisted.** Resolve S4's export/readiness contradiction and S5–S7's misleading reuse/date semantics before a routine pilot. Preserve the working import repairs, explicit history-affecting confirmations, blank follow-up weight, and download-freshness review.

Then run two complete acceptance journeys: (1) a new animal using a real Trodes configuration through its first converted recording, and (2) a follow-up/backfilled day with a different room or calibration, a corrected failure mark and a later metadata correction. Inspect the resulting YAML and physical units in the NWB, then verify the expected Spyglass records. Finally, have a first-time scientist and a frequent user do these tasks without coaching; observe where they hesitate, misinterpret a field, or need external help.

The app needs these specific workflow and scientific-contract fixes before broad use. It does not need a wholesale visual redesign.
