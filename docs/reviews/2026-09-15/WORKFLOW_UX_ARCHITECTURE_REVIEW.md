# Scientist workflow, UX, and architecture review

Reviewed September 15, 2026, at `036b9591` (`feat/first-useful-release`). This is a review of the current product and its fit to the recording workflow, not just the latest commit. Application code was not changed.

## Assessment

**The animal → recording day model is the right direction, and the implementation already has valuable protections. I would fix the historical-data and identity problems below before relying on it for a conversion backlog.** The daily workflow also needs a shorter path and clearer completion states before calling it an efficient replacement for the legacy editor.

The central design rule should be:

> Reuse definitions and suggest previous values; preserve what was actually true on each recording date. Distinguish a correction to history from a change that starts on a particular date.

Three consequential problems were reproduced:

1. Batch import collapses different calibrations of the same named camera onto the first calibration.
2. Copying another animal's setup lowercases the new subject ID and accepts an underscore that the next screen rejects in a locked field.
3. A shared task's environment is read live by historical days; changing it rewrites their effective metadata. The day cannot independently select its task's environment/cameras through the current task editor.

The ordinary test gates pass. That is useful evidence about regression protection, but does not establish that scientists can complete the intended tasks or that exported values faithfully describe past recordings.

## 1. Tasks defined before inspecting the screens

The scientist's deliverable is a correct metadata file for a known recording, eventually used to build an NWB file and insert it into Spyglass. Form completion is an intermediate step.

| Situation | What the scientist needs to accomplish | Success condition |
| --- | --- | --- |
| First animal in an experiment | Enter identity; reuse an experiment/rig setup; supply implant-specific facts | No repeated lab boilerplate and no accidental copying of another animal's identity or failed channels |
| Normal recording day | Choose animal/date; enter weight and actual team; confirm the epoch sequence and exceptions | A short daily log, with the source of carried values visible |
| Recording has started but details are incomplete | Capture known facts and leave | Draft survives without inventing weight, DOB, files, or stimulation parameters |
| Enter last week's recording | Choose its recording date, then the setup and prior day appropriate to that date | Entry time never determines historical hardware or silently becomes recording time |
| Import an existing study | Bring in multiple YAMLs; resolve contradictions; retain each day's original facts | Every file is accounted for and materially different values remain recoverable |
| Rig, calibration, or probe changes | State what changed and when it became effective | Earlier recordings retain their old setup unless explicitly corrected |
| Correct an old mistake | Review exactly which recordings and downloads will change | Deliberate scope selection, visible before/after values, and a record of the correction |
| Prepare conversion | Verify identity/date, hardware, epochs, files, and stimulation; download | The exported file matches the actual recording and its downstream naming conventions |
| Return later or on another computer | Resume unfinished work or transfer it safely | The location and durability of saved work are understandable |

### Ownership of the metadata

“Usually unchanged” is a useful defaulting rule; it is not a sufficient persistence model.

| Metadata | Appropriate owner/lifetime | Safe reuse and change behavior |
| --- | --- | --- |
| Subject ID, species, sex, DOB | Animal identity | Enter once; preserve the ID's spelling. Corrections can intentionally affect history. |
| Genotype, strain/description | Animal facts, with correction history | Reuse; later ascertainment or corrected nomenclature should be explicitly distinguished from a new experimental condition. |
| Lab, institution, experiment description | Experiment defaults, with a copy on each day | Suggest automatically; keep the day's actual team/protocol. A protocol phase can change during one animal's study. |
| Experimenters present | Recording day | Offer the previous team, editable for that date. |
| Weight | Dated observation | Blank for an unmeasured day; display a previous measurement with its date. Baseline weight is optional context. |
| Probe type, channel mapping, implant/reconfiguration | Dated configuration version | Pin each day to the effective version. Distinguish a hardware change from correction of a bad mapping. |
| Target coordinates versus subsequently determined location | Implant plan versus scientific correction | Do not conflate intended target, physical movement, and later histological annotation. |
| Failed channels | Recording day plus configuration identity | Carry earlier marks within the same setup; allow explained corrections. Permanent failure is a workflow assumption, not a universal biological rule. |
| Rig/acquisition device and conversion constants | Versioned rig definition, referenced or copied by day | Reuse defaults; a new rig or corrected scale needs visible scope and provenance. |
| Camera hardware and calibration | Named camera/calibration configuration | Preserve each day's calibration. A new calibration must map safely to Spyglass's camera identity. |
| Task name and description | Reusable task definition | Reuse consistently; correct the definition deliberately. |
| Task environment, cameras, epoch order | Actual task occurrence/day/epoch | Default from the task, but preserve and allow differences for each occurrence. |
| DIO definitions/wiring | Rig defaults with day-specific realization | Reuse known wiring; record substitutions and the actual Trodes channel names. |
| Viral injection and optical-fiber implant | Animal/setup history | Record once with dates; preserve historical state. |
| Stimulation protocol, power, pulse length, epochs | Recording day/epoch | Never equate an implanted animal with stimulation on every day. |
| Statescripts, videos, supplemental files, notes | Recording day/epoch | Derive suggestions from actual recording names; clear or re-date copied file references. |
| Readiness and downloads | Derived validation state plus immutable export artifact | Recompute readiness; retain the exact downloaded bytes and show changes since that download. |

The useful part of the MyFitnessPal analogy is the **daily diary, recent choices, and reusable plans**. Here, the equivalent is “start from this prior recording; confirm what happened.” A suggested plan must remain distinguishable from an observed recording.

## 2. Evidence from the supplied material

I read the supplied [analysis](</Users/edeno/Downloads/yaml_analysis2/REPORT2.md>), independently scanned the three YAML directories, exercised the app's importer, and read the local converter and Spyglass consumers.

- `collected_metadata_yamls`: **1,814 YAML files; 15 parse failures**, independently confirmed.
- For the supplementary variation analysis, I deduplicated file bytes, required `subject.subject_id`, and extracted a compact recording date from the filename. This leaves **1,634 dated records, 145 exact-spelling subject IDs, and 127 IDs with multiple dates**. The 35 files without that exact identity field are excluded from this comparison, not declared to be non-metadata files.
- Within those 127 groups, weight varies in **47**, experimenter representation in **17**, camera definitions in **56**, and associated-file lists in **108**. These are representation differences, not confirmed measurements of real-world change; task arrays can differ because their membership/order changed.
- More specifically, **17 animals have a repeated camera name with multiple calibration values**. In `all_rat_metadata_yaml`, the same check identifies six animals. For example, Emmett's `sleep_camera` is `0.00102` m/px on 2025-11-06, `0.001073` on 2025-12-03, and `0.001173` on 2026-02-02.
- A same-name task/environment example also exists: SC38's `forkTrack_handleAlternation_HaightRight_twoSecondDelay` has `HaightRight` on 2023-06-06 and `HaightLeft` on 2023-06-13. The name itself may be stale; this is a contradiction to investigate, not permission to overwrite either value.
- I assessed all **325 YAML files** in `all_rat_metadata_yaml` through the current repair/planning code: **164 need no responses**, **143 contain repair questions**, and **37 have structures the UI sends back to source-file editing**. The latter categories overlap. These are individual-file assessments before cross-file reconciliation, not a 164-file successful end-to-end import claim.

Two cautions about interpretation matter. The supplied report groups animals by *experimenter × subject ID*, so its zero within-group experimenter variation cannot establish that teams never change. Also, repeated identical weights or setup fields may reflect template copying rather than true stability. Conversely, differences in DOB formatting or resolved genotype are not automatically scientific errors.

The sample recordings demonstrate why hardware validation must use the recording: the sample `.rec` header contains 32 four-channel ntrodes, while `reconfig_probeDevice.trodesconf` contains four 32-channel ntrodes. The behavior-only recording has none. See [corpus results](workflow-review-evidence/corpus.json), [import assessment](workflow-review-evidence/import-survey-summary.json), and [header observations](workflow-review-evidence/recording-headers.json).

## 3. Prioritized findings

P1 means address before routine use for affected workflows; P2 means an important usability/accessibility improvement. These priorities assess the product's intended use, not whether the behavior was introduced by the last commit.

### F1 — P1: Batch import substitutes a camera calibration without resolving the conflict

**Reproduction:** Import two otherwise compatible files for one animal, with `overhead_camera` calibrated at `0.001` on June 22 and `0.002` on June 23. Both files reach the combined preview. It says the camera differs in `meters_per_pixel`, gives no old/new values or resolution control, and enables **Confirm import**. Both imported days subsequently resolve to `0.001`.

This is a disclosed disagreement followed by lossy reconciliation. It is not sufficient that a generic warning was visible. Other setup/video confirmations can still block these imported days; none restores the discarded calibration.

The converter uses this value as the position conversion scale, and Spyglass keys the camera table by camera name. A schema-valid substitution can therefore change spatial units or collide with a previously inserted camera.

**Fix:** Resolve same-name/different-calibration conflicts before commit. Offer a new named calibration/camera version for the affected dates, or an explicit correction of a chosen date range. Show source filename/date and both values, remap dependent references, and retain the original values. An existing catalog entry must not silently settle historical calibration disagreements.

Evidence: [preview screenshot](workflow-review-evidence/16-calibration-import-preview.png), [reproduction results](workflow-review-evidence/domain-findings.json); [camera union](../../../src/state/yamlImportPlan.ts#L454), [preview](../../../src/pages/ImportRepair/index.tsx#L881), [position conversion](/Users/edeno/Documents/GitHub/trodes_to_nwb/src/trodes_to_nwb/convert_position.py:1062), [Spyglass camera identity](/Users/edeno/Documents/GitHub/spyglass/src/spyglass/common/common_device.py:291).

### F2 — P1: Copy-from-animal changes scientific identity and can trap setup

**Reproduction:** Choose a source animal, enter `ReviewCase`, and copy. The next screen shows read-only `reviewcase`. Enter `Review_Rat` instead: copy accepts it, but the wizard rejects the underscore when saving and leaves the ID read-only.

The main creation path already preserves spelling and checks converter-compatible IDs. Copy uses a different implementation. Lowercasing changes the generated filename's animal token relative to mixed-case `.rec` filenames; underscores violate the converter's filename splitting. The second case has no repair in the current wizard step, although the separately accessible animal profile provides an eventual escape.

**Fix:** Reuse one creation/identity boundary for create, copy, and import: preserve entered case, perform case-insensitive duplicate checks, and reject incompatible IDs before creating the animal. Keep identity editable until the initial identity step is accepted.

Evidence: [case changed](workflow-review-evidence/22-copy-changes-case.png), [locked invalid ID](workflow-review-evidence/23-copy-unrepairable-id.png); [copy implementation](../../../src/pages/CopyFromAnimal/index.tsx#L121), [shared identity implementation](../../../src/domain/animalCreation.ts#L132), [converter filename parsing](/Users/edeno/Documents/GitHub/trodes_to_nwb/src/trodes_to_nwb/data_scanner.py:45).

### F3 — P1: Shared task definitions own context that can change by recording

**Reproduction:** Edit the `sleep` task type's environment to “Room B for later recordings.” Save. The effective metadata of the existing June 22 day now uses Room B for its sleep epochs. The edit dialog offers no effective date or affected-day review.

`TaskInstance` references a live task definition. The resolver copies its environment and cameras into each day's exported tasks. The day-level camera checklist is additive: cameras referenced by a task remain selected. Although the TypeScript interface declares a per-instance camera override, the current resolver does not use it, and the epoch UI supplies no equivalent task-context editor.

Spyglass's `Task` identity is name/description; environment and cameras belong to `TaskEpoch`. Requiring a new task name just to use a different room/camera would fragment the scientific vocabulary unnecessarily. The problem is both historical mutation and inability to express a legitimate daily exception.

**Fix:** Keep task identity reusable. Store effective environment/camera selections on task occurrences, defaulting them at creation. Provide “this epoch / this day / change default for future days,” and a separate scoped correction flow for history.

Evidence: [interaction results](workflow-review-evidence/interactions.json), [task edit screenshot](workflow-review-evidence/19-edit-task-environment.png); [resolver](../../../src/state/taskCatalog.ts#L224), [save handler](../../../src/pages/AnimalEditor/wiring/TaskTypesContainer.tsx#L74), [Spyglass epoch fields](/Users/edeno/Documents/GitHub/spyglass/src/spyglass/common/common_task.py:128).

### F4 — P2: “Save draft” requires a measurement that does not belong to animal setup

With a valid subject ID and DOB but no weight, **Save draft** stays on Identity with “Weight is required”; it does not create the draft. DOB is also required by the same gate. This obstructs recording-day preparation and retrospective work where some facts must be obtained later, and encourages placeholder entries. The introduction incorrectly groups weight with facts fixed for the animal's life.

**Fix:** Separate draft validity from export completeness. Require a safe unique identity to create a draft, allow unknown facts, and request weight on the recording day. If baseline weight is retained, label it optional and dated. Keep unresolved required metadata visible at export.

Evidence: [draft screenshot](workflow-review-evidence/15-draft-without-weight.png); [identity validation](../../../src/viewModels/createAnimalWizardViewModel.ts#L163), [draft handler](../../../src/pages/Home/CreateAnimalWizard.tsx#L519).

### F5 — P2: Daily section navigation skips sections with ordinary keyboard controls

Only the active navigation button has `tabIndex=0`; the others are `-1`. There is no arrow-key handler on that navigation. In Chromium, Down Arrow left focus on Daily log; Tab skipped the other sections and moved to Change setup. The separate Alt+Right shortcut works, so the sections are not completely keyboard-inaccessible, but routine navigation depends on discovering a special shortcut.

**Fix:** Use ordinary focusable route links/buttons, or implement the full tab pattern with arrow navigation, semantics, and focus management. Prefer a URL-backed section when Back, reload, and bookmarking should preserve the scientist's place. This is different from the existing animal sidebar, whose links are naturally navigable. [W3C's tab pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/) describes the required pairing of roving focus and arrow-key interaction.

Evidence: [keyboard results](workflow-review-evidence/interactions.json); [navigation buttons](../../../src/pages/DayEditor/DayEditorSectionNav.tsx#L102).

### F6 — P2: The daily log gives contradictory completion signals and hides the required next action

The representative day shows a green **Ready to export** banner together with red **5 statescripts missing**. Statescript absence is not an export blocker; the row model treats missing video as blocking. Thus the file badges imply a different readiness rule from the main status.

The generation button is disabled without a data folder. Its message directs users to “Daily Setup,” but no navigation section has that name. The actual field is in **Descriptions, data folder & search terms**, below the epoch grid and supplemental files. The captured five-epoch example is 2,226 px tall at 1440 px width and 4,412 px tall at 390 px width. This is an observed example, not a timing measurement for a typical session.

**Fix:** Put the folder field or a direct “Set data folder” action next to generation. Define files as *linked / expected but unresolved / not recorded or not needed*, and use the same state in rows and export readiness. Do not force nonexistent statescripts into every recording. Collapse rare supplemental-file editing by default and keep the daily measurements and epoch confirmation close together.

Evidence: [desktop daily log](workflow-review-evidence/08-day-overview.png), [phone daily log](workflow-review-evidence/12-phone-day.png); [misdirecting message](../../../src/pages/DayEditor/EpochsTab.tsx#L730), [folder field](../../../src/pages/DayEditor/DayTab.tsx#L326), [row readiness](../../../src/viewModels/epochGridViewModel.ts#L266).

### F7 — P2: The shortest export path omits the human-readable scientific review

The day editor's Fix & Export page offers Download/Copy, a ready message, download history, and a collapsed YAML preview. On the first download it does not show a compact review of weight/team, epoch assignments, calibrations, failed channels, and stimulation. A scientist must read YAML or navigate elsewhere to catch plausible but wrong values.

The repository already has `EffectiveDayReview` and `buildPreflightSummary` on the validation-summary path. Reuse and extend that work in the single-day path. Keep review inline beside Download; add interruption only for unresolved conflicts or consequential changes. [GOV.UK's check-answers pattern](https://design-system.service.gov.uk/patterns/check-answers/) supports a readable review with direct changes before final submission.

Evidence: [single-day export screenshot](workflow-review-evidence/09-day-section-4.png); [single-day export](../../../src/pages/DayEditor/ExportPreview.tsx#L155), [review component, now shared](../../../src/components/EffectiveDayReview.tsx). At the reviewed revision, the component was at `src/pages/ValidationSummary/EffectiveDayReview.tsx:21`.

### F8 — P2: Import repair still sends meaningful legacy cases outside the application

The individual-file audit found 37 of 325 supplementary files with source-edit blockers. In the real `20200302_chimi.yml` example, the UI says “Associated files must be array” and “Task epochs must be array,” supplies technical field paths, and prevents import. It cannot let the scientist bring the record in as an incomplete draft and repair those structures in the appropriate editor.

The conservative refusal avoids inventing scientific values, which is appropriate. The limitation is that a migration tool still requires YAML-editing expertise for recoverable structures. A file with multiple unknown fields also requires repeated per-file decisions even where an animal's confirmed identity could supply a scoped answer.

**Fix:** Preserve raw source data, normalize genuinely unambiguous forms, and support quarantined/incomplete imports with export blocked. Offer explicit animal-scoped corrections for repeated identity questions, showing affected filenames and values. Keep malformed YAML and genuinely ambiguous mappings visibly unresolved.

Evidence: [real repair screen](workflow-review-evidence/18-real-file-source-repair.png), [per-file results](workflow-review-evidence/import-survey.json); [repair gate](../../../src/pages/ImportRepair/index.tsx#L128).

## 4. Screen-by-screen task walkthrough

The screenshots use isolated browser storage. Most populated screens use the repository's realistic catalog fixture with its current electrode mirror aligned to its snapshot. Real-file import and synthetic conflicting imports are separately identified. Existing browser tests also exercise creation, backfill, reconfiguration, modals, export, and recovery.

| Screen or flow | Can the scientist accomplish the task? | Design assessment / next improvement |
| --- | --- | --- |
| **Default URL / legacy form** | Can edit a single YAML; does not expose the new daily workflow | The empty hash still opens legacy and its header has no workspace entry. This is intentional in code, but release links and onboarding must explicitly lead to the workspace. Update the README's legacy-first instructions. |
| **Empty workspace** | Clear create/import choices | Good starting choices. Add a brief explanation that drafts live in this browser, before users depend on later access. |
| **Populated workspace** | Find animals with search, genotype/status filters; reach backup | Good overview. For habitual work, prioritize recent/active animals and “continue unfinished day”; consider experiment grouping as the workspace grows. |
| **New animal — Identity** | Works when required identity and baseline weight are available | F4 obstructs incomplete setup. “Only revisit on re-implant” is misleading for cameras, teams, tasks, and corrections. |
| **New animal — Electrodes** | Reuses the setup editor; supports behavior-only setup | Good reuse. Actual Trodes ntrode IDs/wiring should be imported and checked, with probe grouping explicitly confirmed. |
| **New animal — Cameras** | Can add named calibrated cameras | Useful calibration guidance. Do not imply one immutable calibration for the animal's lifetime. |
| **New animal — Optogenetics** | Optional; supports deliberate setup | Keep implant facts separate from actual day/epoch stimulation. Show unit conversions near power/volume inputs. |
| **New animal — Tasks** | Reusable definitions reduce typing | Keep definition identity separate from room/camera choices (F3). |
| **New animal — Recording system / Team** | Captures reusable rig/team defaults | Explain that future days copy defaults. These screens should not require repeated lab data for each new animal in the same experiment. |
| **Copy setup from animal** | Selective reuse is available | Good efficiency feature, undermined by F2. Show source configuration/effective date, and verify all copied rig defaults travel together. |
| **Import — pick / repair / preview / result** | Multiple files, per-file repair, exclusions, and grouped results are implemented | Strong foundation. F1 and F8 are the most important remaining gaps. The preview needs resolvable scientific differences, not just descriptions of disagreements. |
| **Animal — Recording Days** | Log today, type an older date, create dates in bulk, reopen days | The direct Log today/backfill path works. Two creation controls and the carry-forward checkbox compete visually; make the simple daily action primary and bulk creation secondary. |
| **Animal profile dialog** | Correct shared identity with an affected-day confirmation | The explicit historical scope is useful. Apply the same clarity consistently to other shared facts. |
| **Electrode Groups / configuration / reconfiguration** | Versioned setup and per-day pins are implemented | Preserve the distinction between “correct this setup” and “hardware changed from this date.” Repeating the full probe list above the editor makes large implants tall. A summary plus expandable detail is easier to scan. |
| **Recording System** | Catalog setup plus per-day selection | Suitable for switching rigs. Make a rig definition encompass relevant conversion constants, rather than leaving scientists to infer their relationship. |
| **Cameras** | CRUD, calibration checks, and name-divergence protection exist | Good mistake prevention during manual editing. F1 shows batch reconciliation does not offer equivalent protection. |
| **Task Types** | Define once and select per day | Efficient for stable definitions; poor fit for occurrence-specific context (F3). Editing also needs affected-day information. |
| **Optogenetics setup** | Enable/disable defaults and configure source/fiber/virus/software | The “Affects all N days” chip conflicts with the newer day-owned-copy policy. Replace it with the actual scope: future-day default, and a separate selected-day correction. |
| **Daily log — weight/team** | Fast entry with a dated previous-weight suggestion | One of the strongest parts. Say “Weight measured for June 22” when backfilling; “today” is ambiguous. |
| **Daily log — epochs/files** | Templates, ordering, duplication, file generation, video/no-video choices | Good reuse and reference-preserving operations. F6 makes resolving files harder than necessary. Room/camera context needs day/epoch editing. |
| **Day — Recording Setup** | Review/select rig, cameras, pinned configuration, technical overrides | Good separation from routine entry. The camera checklist cannot remove a camera inherited from the task; explain and fix that ownership limitation. |
| **Failed Channels** | Per-day marks, same-configuration carry-forward, explicit unmark confirmation | Appropriate protection. Show location/group/ntrode/local-channel identities together. Correct the low-contrast failure badge below. |
| **DIO Wiring** | Day-owned wiring, input/output grouping, reuse | Align choices with the actual header/config inventory. A generic catalog cannot establish which ports this recording used. |
| **Day — Fix & Export** | Blocking issues have repair routes; Copy and Download share a gate | Add the readable final review (F7). State the boundary between metadata checks and actual recording/file checks. |
| **Animal/global Validation & Export** | Triage multiple days, review effective setup, batch export | Useful for backlogs. Use consistent lifecycle terms and show changed-since-download days prominently. |
| **Backup / restore / recovered data** | Portable backup and reviewed replacement exist; tested recovery paths work | Essential for delayed entry. Restore is a transfer/replacement flow, not automatic synchronization or merging between two working computers. Make that distinction easy to understand. |

## 5. Web design and architecture

### Keep the current foundations

- Pure state transitions, a central `mergeDayMetadata`, and a shared day-validation composer are good boundaries for preserving scientific meaning.
- Schema checks are supplemented by reference, identity, channel, optogenetics, and historical-configuration rules. Both Copy and Download use the export gate.
- Dated setup selection, explicit backfill confirmation, weight suggestions, same-configuration bad-channel handling, and per-day team/opto copies address real risks.
- Autosave exposes pending drafts and failures; save/reload, multi-tab handover, backups, and exact-download artifacts have meaningful regression coverage. The main workspace uses localStorage; larger recovery copies and YAML artifacts use IndexedDB.
- The app uses standard controls, landmarks, skip links, focus-managed modals, and responsive layouts. These are useful foundations rather than reasons for a rewrite.

### Improve the implementation in targeted places

**1. Make metadata ownership enforceable.** Store stable task identities separately from dated/occurrence facts. Share the same resolution rules across manual edit, copy, import, migration, and export. F1–F3 are examples of boundaries diverging despite individually tested modules.

**2. Strengthen types at the data boundary.** `strict` TypeScript is enabled, but imported/merged records still rely extensively on permissive shapes. `ElectrodeGroup.targeted_location` is declared as `number[]` while actual metadata uses a location string; coordinate declarations also differ from numeric fixture values. `TaskInstance.camera_id` documents behavior its resolver does not implement. Correct these contracts and distinguish validated internal records from raw recoverable imports. A passing typecheck currently offers less assurance than the setting name suggests.

**3. Consolidate visual styles.** Legacy global SCSS, multiple page-level `:root` token declarations, generic `.status-badge`/`.section-header` rules, and newer CSS modules coexist. This produces inconsistent fonts, spacing, button hierarchy, and warning treatments. Adopt one token source and shared controls; scope remaining legacy selectors. The settled Failed Channels screen has two orange badges measured by axe at **2.46:1** text contrast, below the applicable 4.5:1 threshold. Footer links also receive a target-size finding. Initial camera contrast findings disappeared after finishing animations and were excluded from the final assessment.

**4. Reduce routine visual load.** A large institutional header, breadcrumbs, title, configuration/status chips, animal context, readiness banner, and section navigation all precede daily work. Keep animal/date and save status persistent, but collapse duplicate setup context and rare supplemental forms. Use one obvious next action. The phone layouts tested do not overflow horizontally; their length still impedes quick data entry.

**5. Split the production bundle along route boundaries.** The build emits one JavaScript asset of **1,310.64 kB / 354.51 kB gzip** and CSS of **167.73 kB / 28.13 kB gzip**. `AppLayout` eagerly imports both legacy and workspace screens. Lazy-load legacy, import/repair, and large specialist editors when their routes are visited. React provides a supported [lazy-loading mechanism](https://react.dev/reference/react/lazy). This is an opportunity identified from bundle output, not a measured user-facing latency failure.

**6. Profile growing workspaces before choosing a store rewrite.** The context contains the whole model and persistence state; changes invalidate all context consumers. Whole-workspace serialization is synchronous. View models also perform validation and export-artifact derivation. Memoizing the context object does not isolate subscribers when the workspace actually changes. Measure typing, opening a day, and import with real 100/500/1,000-day workloads; then introduce narrower subscriptions/caches or transactional persistence where the measurements justify it. Retain the tested draft-flush and recovery guarantees.

**7. Test scientific contracts, not only form completion.** Add representative multi-date round trips with calibration changes, same-task/different-environment days, mixed-case IDs through every creation path, no-weight drafts, and stale filenames. Run browser checks in WebKit and Firefox as well as Chromium; the current Playwright configuration only enables Chromium. Add keyboard-journey tests using ordinary Tab/arrow behavior; axe alone did not identify F5.

**8. Keep “saved,” “reviewed,” “downloaded,” and “converted” distinct.** The current receipt/history work is valuable. Add a conversion receipt only if the converter actually reports success, including its version and input metadata hash. A local browser app can be a reasonable first release; it needs a clear transfer workflow when recording and office computers differ. There is no need to add a server merely to modernize the architecture.

The reuse recommendations are consistent with [WCAG's redundant-entry guidance](https://www.w3.org/WAI/WCAG22/Understanding/redundant-entry.html), while recognizing that a new day's weight is new information. Accessibility conformance has not been certified by this review.

## 6. Downstream checks the UI must not overstate

The local app schema and converter schema compare identically apart from the app's additional top-level `version` annotation. That is a useful contract, but it cannot establish that the metadata matches a recording.

- **Identity/date/filenames:** Check the actual `.rec` basename against the metadata filename and subject ID. The supplied sample YAML deliberately has subject `54321` while its filenames contain `sample`; it should not be treated as a scientifically verified identity fixture.
- **Hardware:** Converter header validation checks ntrode IDs and channel counts. Auto-generated maps can be structurally valid without matching a particular recording's wiring.
- **Position calibration:** The converter's current position path takes the first task camera for an epoch. Multiple camera choices need an explicit primary tracking-camera meaning; selection order should not silently choose the scale.
- **Associated files:** The converter catches missing-file errors and can continue with empty associated-file content. A correctly shaped path is not evidence the file exists or was ingested. Generated filenames should be labeled as expected until matched to actual files.
- **Optogenetics:** The local converter requires its complete setup and supports a single excitation source in this path. The app has matching completeness checks; verify units and actual epoch assignments with real opto fixtures.
- **Spyglass:** Task names/descriptions, camera names/calibrations, epoch assignments, and electrode locations influence ingestion and analysis. Local validation cannot know all existing entries in a remote Spyglass database.

The planned Trodes-configuration import is therefore a useful next feature. It is present as planning documents, not a shipped file-reading UI in the reviewed code. Use it to import and check observed IDs/wiring; keep user confirmation for scientific fields the header cannot determine.

## 7. Recommended next iteration

1. **Preserve scientific facts:** Resolve F1, F2, and F3 with cross-date and cross-entry-path tests.
2. **Make incomplete work safe:** Allow animal/day drafts without invented facts; make recoverable imports editable as blocked drafts.
3. **Shorten daily entry:** Animal/date → weight/team → epoch sequence and exceptions → inline review/download. Place file-generation prerequisites beside the file actions.
4. **Make change scope explicit:** “This recording,” “from this date,” or “correct selected earlier recordings.” Reserve a confirmation dialog for consequential scope, not every ordinary edit.
5. **Connect to recording evidence:** Complete header/config import and add a recording-file manifest check before expensive conversion.
6. **Validate with scientists:** Observe representative tetrode, multishank, and optogenetics users completing both a same-day entry and a retrospective entry. Compare task time, repeated typing, missed corrections, wrong-date/setup choices, and successful resume after interruption against the legacy form. Include a transfer between recording and office computers.

A useful pilot acceptance condition is that a normal next-day entry requires only the day's observations and genuine exceptions, while an older recording can be reconstructed without changing another day's facts. No real-user timing study was performed here.

## Verification and limitations

- `npm run typecheck`: passed.
- `npm run build`: passed; bundle-size warning as reported above.
- `npm run lint:ci`: passed; dependency-age/tool notices remain.
- Full Vitest run: **385 files / 5,469 tests passed**, 51.17 seconds.
- Selected existing browser suite: **60 tests passed**, 42.6 seconds, Chromium, two workers, no retries.
- Additional isolated browser walkthrough: legacy, workspace, wizard, copy, imports, every animal sidebar screen, every day section, export, modal states, and 390 px layouts; screenshots, settled axe checks, and targeted interactions saved.
- Read-only corpus scan, per-file import assessment, deterministic reconciliation reproductions, schema comparison, and bounded sample-header inspection completed.
- No full NWB conversion, NWB Inspector/DANDI validation, or live Spyglass database insertion was run. No Safari/Firefox runtime verification or scientist usability session was conducted.

See [evidence and reproduction notes](workflow-review-evidence/README.md). The pre-existing Trodes-import planning edits and revision-6 review files were left intact.
