# Screen and element priority review

Date: 2026-09-16  
Scope: the current modern application, after the previous design fixes.  
Question: Is each element necessary, and does its placement match when a scientist needs it?

## Assessment

The daily log has the right foundation: measured weight first, reusable team information behind a short summary, epochs together with their files, and uncommon technical values behind disclosures. Most scientific fields should remain available.

The remaining problem is the allocation of attention. Onboarding and hardware information still occupy too much of the routine recording workflow. Some important day-specific information is less visible than repeated explanations and empty status counters. There is also a functional gap: a scientist can start an optogenetics protocol in the modern epoch editor but cannot supply all the fields required to export it.

This is a review and proposed change list. Application code was not changed in this pass.

## Basis and limits

- Built and opened the current application in an isolated Chromium browser with synthetic animals and recordings. Inspected 57 screen states, including all seven setup steps, animal tabs, all five daily sections, dialogs, expanded details, import, copy, recovery and export. Desktop was 1440 × 960; selected mobile journeys were checked at 390 × 844 and 320 × 780.
- Exercised first-time setup and draft resumption, an established animal, a day with copied context, configuration confirmation, batch review, single-file import preview, and creation of an epoch's stimulation values. Used source inspection for conditional import conflict/recovery branches and some secondary actions.
- The fresh production build passed. The captured states had no browser page exceptions or document-level horizontal overflow. This was not a new automated accessibility audit, conversion test, or Spyglass ingestion test. The absence of overflow is not evidence that the content hierarchy is good.
- Evidence: [capture summary](element-priority-review-evidence/summary.json). Numbered text/JSON files record each visited state; selected screenshots are retained beside them. Review data and browser storage were isolated from the user's running application.
- Frequency judgments are task-based inferences, not measured click rates or a scientist usability study. A control used infrequently can still deserve prominence when a mistake would affect analysis.

### What the supplied YAML analysis supports

The supplied `yaml_analysis2/REPORT2.md` reports variation in 142 multi-day groups, grouped by **experimenter × subject ID**. Associated-file counts vary in 95 groups, task names in 77, weight in 48, session descriptions in 44, camera names in 41, behavioral-event names in 34, and bad channels in 25. Electrode-group counts vary in 5; device types in 7; lab in 3; institution in 1.

These counts support making daily tasks/files easy to review while reusing setup information. They count groups with any difference, not the percentage of days needing an edit. Repeated weights do not justify carrying yesterday's measurement into today. The reported zero changes in experimenter cannot establish stability because experimenter is part of the grouping key. This analysis also does not establish that acquisition systems change frequently.

**Domain clarification from the user:** experimenters rarely change, if at all. Treat experimenters as a stable experiment/animal default: enter once, reuse for recordings, and keep correction available as an exception. Daily entry should not ask for repeated confirmation or place an experimenter editor beside the weight measurement. Put the current names in recording details and export context; draw attention when names are missing or differ from the usual team. A day-only exception and a change to the usual team must remain separate operations, and changing the default must preserve the names already recorded on existing days.

### Placement rule

| Kind of information | Appropriate treatment |
|---|---|
| Enter or check for each recording | Visible in the main daily flow: recording date, measured weight, epoch order, effective task environment, files, relevant stimulation. |
| Set up once, reuse afterward | Full editor during setup; concise current value and Change action during daily entry. |
| Applies only to some experiments | Ask whether it applies, then reveal its editor. Absence should not look like unfinished work when it does not apply. |
| Rare but consequential correction | Discoverable near the value being corrected, with scope/effective-date information at the decision. |
| Technical inspection or recovery | Secondary disclosure or dedicated utility; become prominent when an actual problem occurs. |

This applies progressive disclosure: make primary actions visible and expose secondary detail when it becomes relevant. Consistent terminology, recognition of current values, and actionable error recovery matter as much as reducing the number of controls. See [NN/g: progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/) and [usability heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/).

## Prioritized findings

### E1 — High: the daily optogenetics editor cannot complete a new protocol

**Reproduction:** With a complete implanted setup and no existing day protocols, open epoch 2, enter power `10 mW` and pulse `5 ms`, then open Review & export. The editor creates:

```json
{"name":"","epochs":[2],"power_in_mW":10,"pulseLength":5}
```

Export correctly blocks on missing camera selection, DIO output name and protocol name. The epoch drawer provides only power and pulse. Its repair links return to Daily log, which still has no controls for those missing protocol fields. This is a workflow dead end for creating stimulation metadata in the modern app; an already complete imported protocol is a different case.

**Change:** Make an explicit, conditional stimulation section for an epoch. Include protocol name/file, camera, named DIO output, epoch assignment, power and applicable pulse settings; allow removal/correction. Keep advanced pulse-train parameters collapsed. If a protocol is shared by several epochs, show that scope before editing it. Required-field repair links must open and focus the actual editor.

**Evidence:** [epoch drawer](element-priority-review-evidence/51-epoch-opto-editor-viewport.png), [blocked export](element-priority-review-evidence/52-opto-review-blocked-viewport.png), [repair destination](element-priority-review-evidence/53-opto-repair-destination.txt). Source: `src/pages/DayEditor/EpochsTab.tsx:486` and `:1595`; `TasksFilesSection.tsx:26`. The legacy `OptogeneticsFields.jsx:594` has protocol controls that the modern work surface does not mount.

The existing browser test sets per-epoch power but does not finish that protocol and export it. Its complete-export test seeds an already complete protocol (`e2e/workspace-optogenetics.spec.js:219`). Add a user-flow regression when fixing this: create the protocol through the UI and successfully export its required references.

### E2 — High UX priority: setup and bulk controls displace routine recordings

An established animal with one unconfirmed default shows a full setup card between Log a recording day and its recording history. On a 390 × 844 viewport, the first existing date starts at approximately **y = 1,398 px**. A new draft puts Log today at **y = 1,147 px**, following the setup checklist. A second “Add recording day” entry point appears farther down at **y = 1,628 px**.

Confirming the rig removes the established animal's setup card; this problem is conditional, not present for every fully configured animal. A separate behavior-only/no-video check with identity, team and rig complete still showed “Set up this animal,” with electrodes and cameras marked “To enter.” Those are not necessarily missing requirements.

**Change:** Keep one compact recording-date control near the top, followed immediately by unfinished/recent recordings. Make bulk dates secondary to that control. For existing animals, use a compact, direct setup reminder instead of the full onboarding panel. Keep the detailed checklist in Resume setup. Represent non-applicable hardware honestly. Remove the duplicate empty-state day-creation action and repeated generated session descriptions.

**Evidence:** [established phone page](element-priority-review-evidence/43-phone-established-days.png), [draft phone page](element-priority-review-evidence/45-phone-draft-days.png), [fully configured animal](element-priority-review-evidence/49-established-setup-complete-viewport.png), [behavior-only setup](element-priority-review-evidence/55-behavior-only-setup-viewport.png). Source: `RecordingDaysTab.tsx:438`, `AnimalSetupCard.tsx:74`, `DayList.tsx:202`, `src/viewModels/animalWorkspaceViewModel.ts:172`.

### E3 — Medium: onboarding order gives optional setup priority over required context

The order is Identity → Electrodes → Cameras → Optogenetics → Tasks → Recording system → Team. The last step also contains the required experiment description. A new user encounters an optional stimulation step before reaching the basic experiment/team information. The electrode effective-date field appears even before any electrode group exists.

**Change:** Collect identity and experiment/usual team first. Review the recording system and establish which hardware applies; reveal the applicable probe/camera/task/opto sections. Offer copy/import at the beginning. Keep draft saving available throughout. In each step, remove repeated introductory text that does not change the next action. Put effective probe date with an actual probe configuration.

**Evidence:** captures 01–07; `src/viewModels/createAnimalWizardViewModel.ts:67` and `src/pages/Home/CreateAnimalWizard.tsx`.

### E4 — Medium: export prominence does not match outstanding work

In the same fixture, the workspace highlights **1 ready**, while the animal navigation and batch action offer **4 ready recordings**. One is changed since download; three have current downloads. The counts describe different concepts without explaining that difference. Opening batch review adds another complete list above the existing table. Single-day export also offers “Download all 4 days” directly, without that batch review step.

**Change:** Distinguish “valid metadata” from “needs download.” Default batch review to new/changed recordings, with explicit selection and an option to include current downloads. Present one selected review list. Route all bulk download entry points through that review, retaining validation gates. Keep “Validate All” secondary and explain its specific state-changing purpose; it also clears deferred validation state, so it should not simply be deleted without preserving that behavior.

**Evidence:** [workspace](element-priority-review-evidence/09-populated-workspace-viewport.png), [batch review](element-priority-review-evidence/24-batch-review-viewport.png), [single-day export](element-priority-review-evidence/21-day-export-viewport.png). Source: `ValidationSummary/useValidationSummaryActions.ts:123` and `:200`; `DayEditor/ExportPreview.tsx:157` and `:279`. The direct bulk path still validates files; the missing element is the consistent human review of the selected recordings.

### E5 — Medium: daily context is less visible than low-value status detail

The epoch grid shows “differs from task default,” but the actual environment, such as Room B, is inside Details. “0 videos needed” and “0 custom filenames” remain visible. The data-folder field is grouped with descriptions and search terms even though generated file names depend on it. “Task source: animal catalog” takes space in the drawer without helping the scientist decide what happened in the recording.

**Change:** Show effective environment with each task, keeping cameras and exceptions visible. Display empty filter counts only when they help an active filtering task. Put data folder near file generation; separate session notes from experiment defaults and search metadata. Remove internal storage terminology from the main drawer.

**Evidence:** [daily log](element-priority-review-evidence/17-day-daily-viewport.png), captures 22, 23 and 37. Source: `DayEditor/EpochsTab.tsx:676`, `:1169`, `:1547`; `DayEditor/DayTab.tsx:238`.

### E6 — Medium: profile correction uses a different form language from creation

Creation offers familiar species choices, required markers, and a plain date field. Edit profile is hidden in the animal overflow menu, switches species to scientific-name free text, loses the required-before-export cues, and explains internal workspace keys and ISO datetime storage. A scientist correcting an ordinary fact must understand more implementation detail than when first entering it.

**Change:** Give the animal header an explicit Profile action or clickable summary. Reuse the identity controls and required-before-export guidance. Keep exact subject spelling and the scope of changes visible; move filename-format examples and storage explanations to contextual help. Preserve the warning that shared identity corrections affect existing recordings.

**Evidence:** [profile editor](element-priority-review-evidence/36-profile-edit-viewport.png), [creation](element-priority-review-evidence/01-wizard-identity-viewport.png). Source: `src/components/AnimalProfileDialog.tsx:193` and `src/pages/AnimalView/index.tsx:461`.

### E7 — Lower priority: repeated context and instructions consume space across screens

Animal species and sex appear in both the header subtitle and chips. The animal ID badge, repeated animal title, full setup navigation and multiple scope explanations compete with the editor. Task Types repeats the same ownership explanation. Acquisition setup puts Confirm above the hardware being confirmed and makes Add the strongest action even when the scientist only needs to review one default.

**Change:** Use one compact animal header; retain a visible identifier and useful profile access. Group setup navigation below day work. Put the values before their confirmation action. Give each section one title and one concise scope explanation. Retain contextual warnings at the edit decision rather than repeating broad warnings throughout ordinary viewing.

## Screen-by-screen element decisions

**Keep** means the element is useful in its current role. **Promote** means make it easier to see or reach. **Fold/move** means retain it in a more appropriate place. **Remove** refers to redundant presentation, not deletion of scientific metadata.

### 1. Workspace — empty and populated

| Element | Necessity / likely use | Decision |
|---|---|---|
| Create animal, import existing YAML | Essential first entry; import can avoid extensive setup | Keep both visible; make one clear primary action in the empty state. |
| Animal name/link, search | Main entry point on repeat visits | Keep prominent. |
| Last recording and work remaining | Helps resume delayed entry | Promote relative to static species/genotype columns. Explain pending-download status consistently. |
| Genotype and species columns | Useful identification context, usually stable | Keep compact; avoid making them the main scan targets. |
| Genotype/status filters | Useful with many animals | Keep status accessible; collapse or omit a genotype filter when there is only one available value. Revisit with real multi-genotype users. |
| Row overflow actions | Infrequent administration | Keep secondary; animal name remains the obvious open action. |
| Browser-only storage notice and backup | Essential because storage is local | Keep concise and visible. Backup is a meaningful utility, not clutter. |
| Restore backup / restore checkpoint | Infrequent recovery | Group under recovery/backup utilities; do not give checkpoint restore the same prominence as routine work. Empty workspaces need restore, not an emphasized empty backup download. |
| Global Review & export | Useful cross-animal work | Label its scope clearly, for example “Review all animals,” when an animal-scoped version is also visible. |

### 2. New animal — entry and shared wizard controls

| Element | Necessity / likely use | Decision |
|---|---|---|
| Import/copy choices | High value before starting | Keep on entry; remove the large persistent desktop choice panel after setup begins. Keep a secondary way back. |
| Step navigation | Orientation and return to missing entries | Keep; the compact phone step menu is appropriate. Reorder as in E3. |
| Introductory paragraphs | Useful once | Replace repeated “save a draft later” explanations with one consistent instruction. |
| Back / Next / Save draft & exit | Essential control over interrupted work | Keep a stable footer. Do not hide draft saving behind a menu. |
| Required markers and inline missing-field feedback | Prevent incomplete exports | Keep, with one explanation of required-to-save versus required-before-export. |

### 3. Identity step and profile correction

| Element | Necessity / likely use | Decision |
|---|---|---|
| Subject ID | Essential; exact spelling connects recording files | Keep first, with concise filename-matching guidance. |
| Species, sex, genotype | Required subject facts; entered/reviewed once | Keep together with explicit defaults. Reuse the same controls in Edit profile. |
| Date of birth | Required before export in this app | Keep visible. An unfinished draft may remain blank; do not make it look optional for export. |
| Description | Optional subject annotation | Fold into optional details or make visually secondary. |
| Baseline weight | Does not replace the recording's measurement | Do not introduce a competing weight entry here. The dated daily measurement is the main control. |
| Internal key / ISO storage explanation | Implementation detail during ordinary correction | Move to help. Keep the shared-change warning at save. |

### 4. Experiment and team step

| Element | Necessity / likely use | Decision |
|---|---|---|
| Experiment description | Core reusable context | Promote earlier; call the step “Experiment & team.” |
| Usual experimenters; add/remove names | Stable default; rarely changes, per user clarification | Enter once in experiment/animal setup and reuse automatically. Keep editing available in setup. |
| Lab and institution | Required but usually reused | Prefill and show a compact review of defaults; full controls on Edit or when missing. |
| Day-only team correction | Rare exception | Put in recording details, separate from changing the usual team. Preserve existing days when the default changes. |

### 5. Electrodes — wizard and animal setup

| Element | Necessity / likely use | Decision |
|---|---|---|
| Whether ephys applies | Determines whether this entire editor is needed | Ask before showing empty probe geometry/date controls; retain a non-applicable state. |
| Add first group / copy setup | Frequent during initial setup | Keep prominent in the empty state. Once configured, emphasize reviewing/editing the existing groups. |
| Configuration version, effective date, affected dates | Infrequent but consequential for backfill and hardware changes | Keep concise above the editor; retain a deliberate New configuration action. |
| Separate configuration probe list plus editor table | Same groups displayed twice | Combine into one list with configuration context. |
| Device type, target region and coordinates with units | Core probe description | Keep in the group editor, with a compact coordinate group. |
| Histology-confirmed location and description | Often known later or optional | Secondary details; preserve the ability to correct them later. Explain target versus confirmed location. |
| Channel/shank counts and generated IDs | Useful confirmation, derived from setup | Read-only, compact; prioritize group identity/region and mapping review. |
| Edit / verify Trodes mapping | Critical correctness check despite low frequency | Keep directly associated with the group/configuration. Generated geometry must not imply verified wiring. |
| Mapping ntrode IDs and channel order | Necessary for the recording mapping | Keep in the dedicated editor with reference information and save/cancel. |
| Failed-channel explanation in probe dialog | Helpful ownership distinction | Link to the actual “Failed Channels” label; remove stale “Devices step” wording. |
| Delete | Occasional destructive action | Put in row actions; retain appropriate confirmation/reference checks. |

**New configuration dialog:** effective start date, copy-current option, replacement versus repositioning choice and description all earn their space. Present the expected affected recordings beside the date. These controls protect historical meaning; hiding them to shorten the form would be a mistake.

### 6. Recording system — wizard and animal setup

| Element | Necessity / likely use | Decision |
|---|---|---|
| Current default name/system/amplifier/ADC | Needed to verify acquisition identity | Show the values first, then Confirm. A compact card suits a single system; retain a list for multiple systems. |
| Confirm recording system | One-time review of prefilled hardware | Make this the primary action while unreviewed. |
| Add / edit / choose default / delete | Setup and occasional changes | Keep Edit nearby; make Add and Delete secondary once a default exists. |
| Hardware name and identity guidance | Important when creating/replacing a system | Keep concise in the editor; preserve full details in contextual help. |
| Raw voltage conversion and legacy period multiplier | Uncommon technical settings | Keep in Advanced Settings with current units/defaults and scope. Surface overrides in export review. |

### 7. Cameras — wizard and animal setup

| Element | Necessity / likely use | Decision |
|---|---|---|
| Add camera | Needed if video applies | Primary for the empty state; secondary to reviewing the existing list afterward. |
| Camera name and calibration | Essential selection/analysis context | Keep prominent in the list and editor. |
| Manufacturer, model, lens | Needed to define hardware, rarely edited daily | Keep in setup form; compact combined hardware summary afterward. |
| Automatically assigned ID | Required reference, generally not a decision | Show read-only, subordinate to the name. |
| Same-name/same-hardware guidance | Prevents downstream identity confusion | Keep near naming/calibration changes. Shorten the default helper while retaining the full explanation. |
| Broad “Affects all days” warning | Consequences depend on the operation | Prefer precise affected-day information during edit/save. Adding a distinct camera should not visually read as rewriting all recordings. |
| Status, Edit, Delete | Review/correction and rare removal | Retain status and Edit; move Delete to row actions. |

### 8. Task types — wizard and animal setup

| Element | Necessity / likely use | Decision |
|---|---|---|
| Task name and description | Define the task once | Keep required in the modal. Shorten long descriptions in the list. |
| Default environment and cameras | Often reused; may differ by day | Keep in the list and modal, clearly labeled as defaults. |
| Add task, quick-add during epoch entry | Needed as experiments evolve | Keep both reachable; users should not leave a recording merely to define a new task. |
| Repeated ownership paragraphs | Redundant | Replace with one sentence: define defaults here, record occurrences per day. |
| Identity/scope-change explanation | Prevents accidental edits across days | Show at the edit decision; preserve explicit correction/default scope controls. |
| Delete | Rare and consequential if referenced | Secondary, with reference-aware handling. |

### 9. Animal optogenetics setup

| Element | Necessity / likely use | Decision |
|---|---|---|
| Optogenetics on/off | Determines applicability | Keep as the first decision. Preserve disabled drafts and existing day snapshots. |
| Multiple off-state explanations | Low value once the answer is No | Reduce to a short state and change action; no dedicated required-looking onboarding stop. |
| Complete/to-finish summary | Helpful with long forms | Keep; it now counts completed fields rather than mere array presence. |
| Excitation source name/model/description/wavelength/power/intensity | Required implanted setup | Keep together in a source record, with explicit units. |
| Fiber identity, hardware, location/hemisphere, coordinates/angles/reference | Required when applicable | Group identity and location, then coordinates with units/reference; preserve every required field. |
| Injection identity/description, virus, titer/volume, site/coordinates/reference | Required when applicable | Use the same record structure; show the entry being worked on and a compact summary for completed entries. |
| Stimulation software | Shared setup value | Keep prefilled but reviewable. |
| Add/remove fiber or injection | Repeated only for applicable experiments | Keep next to the relevant collection, with populated-removal confirmation. |
| Day-specific stimulation parameters | Belong to the recording | Expose a complete protocol editor in the epoch flow; see E1. |

### 10. Animal header and recording days

| Element | Necessity / likely use | Decision |
|---|---|---|
| Animal identifier and switcher | Needed continuously for orientation | Keep visible. |
| Species/sex repeated in subtitle and chips; “animal ID” badge | Duplicate context | Remove duplication. Keep a compact profile summary and explicit Profile action. |
| DOB/genotype/probe/team chips | Useful context, rarely the day's main task | Fold most into profile/setup summary; retain changes or missing essentials contextually. |
| Day work versus setup navigation | Useful distinction | Keep the grouping; reduce the visual weight of setup on daily visits. |
| Log today / date / create or open | Main repeated action, including delayed entry | Keep as one compact group. The selected recording date must remain explicit. |
| Carry-forward checkbox and long explanation | Source selection matters; persistent prose is excessive | Show a concise source summary beside the chosen date and a Change action. Retain a clear start-blank option. |
| Add multiple dates and calendar | Useful batch backfill, less common than one day | Place beside the date group as a secondary action. Keep existing dates visibly unavailable. |
| Setup checklist / Resume setup | Necessary for unfinished setup | Compact reminder on daily visits; detailed checklist when resumed. No false “To enter” for non-applicable hardware. |
| Recording dates, actionable status, custom notes | Main history scan | Promote immediately below entry; prioritize unfinished/recent work. Keep actual custom descriptions, suppress generated date/animal boilerplate. |
| Selection checkboxes and bulk action bar | Useful when performing batch work | Keep contextual actions appearing only after selection. Route exports through consistent review. |
| Row overflow, duplicate dialog, delete/undo | Occasional correction and reuse | Keep secondary. Duplicate dialog should retain source date, destination date and copy scope; weight remains a new measurement. |
| Status legend | Useful on demand | Its closed disclosure is appropriate. |
| Empty-state explanation and second Add action | Duplicates the Log panel | Keep a short empty-history message; remove the competing creation workflow. |

### 11. Daily log — main surface

| Element | Necessity / likely use | Decision |
|---|---|---|
| Animal/date and draft/save/download state | Prevents wrong-day entry; confirms saving | Keep compact and persistent enough to orient the user. |
| Weight with grams and measurement date | Daily measurement | Keep first. Previous dated weight is reference only; the new measurement must not be silently filled from it. |
| Experimenter names and Change | Stable default with rare exceptions | Move into recording details; no daily confirmation. Surface missing names or a departure from the usual team. |
| Recording source and setup summary | Useful when copied/backfilled or changed | Keep concise; surface unresolved source/configuration questions without requiring an unrelated tab visit. |
| Epoch grid and Add epoch | Main daily work | Keep prominent. |
| Sequence templates | Efficient for repeated protocols | Keep secondary to the current sequence. Explain whether applying one replaces or adds epochs at the decision. |
| Missing-files generation | High value when files are missing | Keep near the grid, showing the actual missing count and applicable action. |
| Four always-visible filter chips | Some counts add no information | Keep epoch count and meaningful exceptions; de-emphasize zero counts. |
| Supplemental files | Rare extras | Keep collapsed when empty and expanded for relevant content/repair. |
| Session description | Sometimes varies; valuable recording notes | Give it a clearly labeled optional editing area below epochs when a valid default exists. Expand when required content is missing. |
| Data folder | Affects file-generation context | Move near files; display inherited/derived folder with a Change action. |
| Experiment description, lab, institution, keywords | Usually defaulted; occasional corrections | Group under recording metadata/defaults, with missing required entries automatically exposed. |
| Session identity and animal context | Mostly inspection | Keep collapsed/read-only with a clear correction route. |

### 12. Epoch row and details drawer

| Element | Necessity / likely use | Decision |
|---|---|---|
| Epoch order, task name, environment, cameras | Describes what actually happened | Keep visible in the row; promote the actual environment from the drawer. |
| Derived tag | Useful for matching filenames | Secondary readout; do not give it the prominence of task/environment. |
| File presence and stimulation summary | Daily checking | Keep compact summaries; show missing/changed items conspicuously. |
| Details | Main route to files and exceptions | Keep a single clear entry point. |
| Move up/down | Reordering happens during entry | Retain accessible controls; compact on desktop, contextual on narrow layouts. Preserve reference-renumbering safeguards. |
| Delete and overflow | Less frequent than review/edit | Reduce always-visible destructive icon prominence; retain undo/confirmation behavior. |
| Generated filename, manual entry, rename/revert | Generation is common; overrides are exceptional | Generated name first, manual override secondary. Show the actual name so mistakes can be caught. |
| Video camera, remove/add another video | Necessary for multiple/changed camera recordings | Keep next to each video; camera identity should be readable by name. |
| Task selector and quick-add | Correcting an assignment or defining a new task | Keep in the drawer; distinguish task identity from this day's room/cameras. |
| Effective environment/cameras, Edit for this day, Use task default | Needed for changing recording context | Keep together. Preserve explicit save/cancel for this scoped edit. |
| “Task source: animal catalog/day task” | Storage provenance without an ordinary scientific decision | Remove from primary content or put in technical details. |
| Stimulation protocol and power/pulse | Essential for relevant epochs | Promote a complete conditional editor; do not expose two partial controls that lead to E1. |

### 13. Daily Recording Setup

| Element | Necessity / likely use | Decision |
|---|---|---|
| Selected acquisition system | Must be correct, often unchanged | Keep a short current-value summary and Change. Retain full selection when multiple systems exist. |
| Used cameras and linked-camera explanation | Correctness depends on tasks/videos/protocols | Keep clear ownership and the correction link. Prefer a read-only linked-camera list over disabled-looking controls for values that cannot be toggled here. |
| Additional camera selection | Needed for some recordings | Reveal as an explicit add/change action. |
| Technical overrides | Infrequent | Current disclosure is appropriate. Preserve raw voltage scaling, period multiplier, header path and paired units with their distinct scopes. |
| Configuration summary/version and effective date | Important for backfill/hardware changes | Keep concise; expand when unresolved or changing. |
| Shared setup link and “hardware changed starting this day” | Different kinds of correction | Keep distinguishable and explain affected recordings when invoked. |

A separate route can remain useful for complex recordings. The ordinary one-rig, one-camera case should be understandable from the daily summary without feeling like another mandatory form to fill out.

### 14. Failed Channels

| Element | Necessity / likely use | Decision |
|---|---|---|
| Number of failures and recording-day scope | Quickly confirms current state | Keep at the top. |
| Per-group disclosure and failed-channel checkboxes | Needed when failures occur | Keep grouped by probe/ntrode, with existing failures obvious. |
| Hardware failure versus sorting-quality explanation | Prevents a meaningful category mistake | Keep concise near the checkboxes. |
| Channel-map reference and device geometry | Useful during correction, not every visit | Keep in secondary disclosures. |
| Entire section for a non-ephys recording | Not applicable | Use an honest not-applicable state and reduce its navigation prominence. |

### 15. DIO Wiring

| Element | Necessity / likely use | Decision |
|---|---|---|
| Named lines and current mappings | Used during rig setup and changes | Keep as the main content. |
| Type, index and event name | Necessary to define a line | Keep together with clear Din/Dout meanings and unique-name feedback. |
| Add/edit/remove | Occasional changes | Add is primary only when empty; existing names and Edit lead afterward. |
| Three introductory explanations | Repetitive | Use one concise explanation plus contextual help. |
| All ECU lines | Rare inspection | Keep behind Advanced. |
| Protocol output selection | Needed for optogenetics | Link to/use these named outputs from the protocol editor; a named DIO line alone does not fill the missing protocol reference. |

### 16. Single-day Review & export

| Element | Necessity / likely use | Decision |
|---|---|---|
| Blocking issues and field repair links | Necessary whenever incomplete | Keep first, with the recording/epoch and actionable field named. Verify every destination has the requested control. |
| Optional statescript reminders | Useful but not export blockers | Keep distinct from required issues; preserve direct epoch links. |
| Weight, task environments, videos | High value daily checks | Keep visible. |
| Experimenter names | Stable recording context | Include compactly in the summary; emphasize missing names or exceptions without requiring routine confirmation. |
| Probe version, failed channels, camera calibration, rig, stimulation | Low edit frequency but high consequence | Keep in a compact review summary; emphasize changed/overridden values. |
| Duplicate animal/day/session identity | Repeated context | Consolidate into one identifier block; keep converter session ID in details. |
| Technical conversion values | Useful inspection | Keep collapsed unless a warning/override requires attention. |
| Download YAML | Main completion action | Keep primary with filename/destination guidance nearby. |
| Copy YAML | Secondary expert workflow | Keep secondary or in file actions. |
| Download receipt and changed-since-download details | Helps correct already-used metadata | Keep prominent when changed; compact timestamp/filename when current. |
| Pilot-runbook paragraph | Process explanation on every completed recording | Move conversion-verification guidance to help. Do not imply that downloading proves conversion success. |
| Raw YAML preview | Technical inspection | Keep collapsed. |
| Download all days | A different scope from this page's main task | Replace with a link to review/select the animal's other recordings. |

### 17. Animal and global batch Review & export

| Element | Necessity / likely use | Decision |
|---|---|---|
| Animal scope / all-animals navigation | Prevents wrong-scope work | Keep explicit; avoid two indistinguishable “Review & export” navigation labels. |
| Valid/incomplete/error counts | Useful overview | Pair with outstanding-download counts; do not call both concepts “ready.” |
| Validate All | Advanced state/recheck action | Secondary, with an explanation; retain deferred-validation behavior if refactored. |
| Review ready recordings | Main batch task | Default to selected pending downloads; current downloads remain selectable. |
| Date, status, effective setup and corrections | Main scan fields | Keep; hide the redundant Animal column when already scoped to one animal. |
| Internal session identifier | Inspection | Put in details. |
| Preflight weight/task/environment/video summaries | Necessary human review | Keep one selected review list rather than adding a second full list above the first. |
| Experimenter names across the batch | Usually shared across an animal's recordings | Show the common names once per animal and identify exceptions per day. Keep each day's effective names inspectable. |
| Calibration & hardware details | Important conditional inspection | Keep folded; avoid repeating values already displayed outside it. |
| Warning acknowledgment, stale/failed/skipped results | Necessary when conditions arise | Keep contextual and specific; retain validation and changed-since-review protections. |
| Status legend / what is exported | Learning support | Closed disclosures are appropriate. |

### 18. Copy setup from another animal

Source selection, section choices, new subject ID and Copy & continue are necessary and correctly sequenced. The exclusion note correctly distinguishes copied setup from the new subject and its recordings. Keep it concise. Add item counts or a compact summary beside selected sections so the user knows what they are choosing. Continue into identity/setup confirmation. On the established-animal copy dialog, retain the existing reference and identity protections; copying setup is a secondary setup action, not a routine daily CTA.

### 19. Import YAML — selection, repair, preview and result

The drop zone/file chooser is appropriate, and per-file repair keeps complex data entry out of the empty screen. Required repairs, suggested normalizations, unreadable files and cross-file identity/calibration conflicts must remain distinct. Keep technical field paths collapsed and retain explicit import confirmation for consequential conflict choices.

The clean single-file state is overly abstract: it says the existing animal will be reconciled and offers Add recording day, but shows no explicit recording-date/outcome summary apart from the filename. Add a concise “Animal · recording date · new day/already present/conflict” summary before commit. In the inspected case, that date already existed; this review did not execute that import or claim it overwrites the day. The point is to expose the planned outcome before the user acts. After import, prioritize Open recording / Continue missing setup, with normalization details secondary.

### 20. Recovery, backup restoration and shared controls

The clean recovery page should lead with “Nothing needs review” and a return link. The generic paragraph about problematic loaded records is useful only when there are such records. For actual recovery cases, retain affected animal/day, reason, recover/relink choice and destructive-action confirmation; raw stored structures belong in details.

Keep accessible focus styles, keyboard support, semantic field labels, autosave feedback, save/cancel for local modal edits, and undo/reference checks. The review does not recommend hiding errors or destructive consequences to make screens look simpler. The footer and keyboard-shortcut utility can stay visually quiet. Use the same visible destination names in help, navigation and repair actions: currently “Daily entry,” “Daily log,” “Epochs & files” and “Devices step” can describe overlapping or renamed destinations.

## Recommended journeys

| First recording for an animal | Routine or delayed follow-up |
|---|---|
| Choose create / copy / import. | Open the animal and the relevant recording date. |
| Enter identity and experiment/usual team; save draft if facts are missing. | See the source date, effective setup and unresolved questions. |
| Review default rig; indicate applicable ephys/video/opto setup. | Enter the measurement taken for that recording date. |
| Complete applicable setup and verify mapping/calibration. | Review ordered epochs, actual environment, files and stimulation; correct experimenters only for an exception. |
| Open the recording date; enter measurement, epochs and files. | Change failures, wiring or hardware only when necessary. |
| Review consequential values and download when complete. | Review changed/consequential values, then download this day or selected pending days. |

## Implementation order and acceptance checks

1. **Complete the protocol editor (E1).** A scientist can create, correct and remove stimulation metadata entirely in the modern UI. Its required-field links focus usable controls; a newly created complete protocol exports with its camera, DIO and epoch references.
2. **Reorder the daily landing page (E2).** One day-creation group; recent/unfinished recordings immediately afterward. At a representative phone size, setup reminders do not push all routine work off-screen. Behavior-only/no-video setup can be visibly complete.
3. **Align batch scope and review (E4).** The one-pending/three-current fixture offers one pending download by default, allows explicit inclusion of current downloads, and uses the same review path for every bulk entry point.
4. **Reorder onboarding and unify profile controls (E3/E6).** Experiment/team appear before optional hardware detail. Creation and correction use the same field vocabulary and required-state cues.
5. **Improve daily information placement (E5).** Effective environments are visible, data-folder context is near files, and zero-count filters/internal storage labels stop taking priority.
6. **Consolidate repeated presentation (E7 and inventory).** One compact header, one explanation per section, secondary destructive actions, and conditional recovery/help detail.

Before declaring the result easy for scientists, observe representative users completing both a first animal/day and a later/backfilled day without coaching. Include an optogenetics user and a behavior-only user. Record wrong turns, missed changes and time to complete; YAML variation alone cannot establish those usability outcomes.
