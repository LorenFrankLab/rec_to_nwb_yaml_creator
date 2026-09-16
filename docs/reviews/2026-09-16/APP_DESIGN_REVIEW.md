# Rendered app design review

## Assessment

The app has a useful workflow foundation, but the visual and interaction design needs another focused pass before broad rollout. Daily entry requires too much reading and scrolling. Form styling varies sharply between screens, and there are reproducible layout defects with ordinary data.

The recent fixes improved data correctness and repairability. They did not finish the design work. A supervised pilot remains useful, with these issues recorded as limitations rather than treating passing functional or accessibility checks as evidence that the interface is easy to use.

This review concerns the current **rendered modern app**, built from the working tree on September 16, 2026, based on `5c053415` plus the uncommitted scientist-workflow fixes. No application source was changed during this review.

## Method and scientist tasks

I built the app and inspected it in an isolated Chromium session using the previous walkthrough's synthetic animals and recording days. I created a new backfilled follow-up through the interface. I inspected empty and populated home screens, all seven setup steps, animal setup screens, daily entry, epoch details, hardware changes, import entry, and blocked and successful export views. Desktop captures use 1440 × 960 and 1280 × 800; narrow-screen checks use 390 × 844 and 320 × 800.

The design should support three priorities:

1. **First setup:** enter identity and reusable equipment/task definitions, understand required versus optional information, and resume an unfinished draft.
2. **Routine recording:** choose the actual recording date, enter its measured weight, confirm or adjust epochs and files, record exceptions, and finish quickly.
3. **Correction:** identify the affected animal/day/configuration, understand which other recordings change, fix the value, and know whether a new download is needed.

The assessment combines direct visual observations, measurements, interaction checks, and source inspection. The evidence includes **38 captured states and 35 automated accessibility scans with zero reported violations**; manual inspection still found the layout defects below. Usability predictions are expert judgments; no scientist was observed or timed during this review. This was not another end-to-end converter test or a complete WCAG audit. See [capture inventory and scan results](design-evidence/verification.json).

## Prioritized findings

### D1 — High: normal daily entry begins with too much chrome and an error state

**Observed:** Creating June 24 from June 23 immediately displays a red “6 issues block export” panel, “Needs attention,” and “Has errors.” The six items are ordinary unfinished work: weight, four videos, and a task-context decision. Before editing, the user must scan the app bar, breadcrumbs, Export action, title, configuration/source/status chips, animal context, readiness panel, section navigation, and provenance text.

At desktop width, the collapsed team panel stretches to the height of the weight panel and occupies approximately two thirds of that row. The epoch list begins below several layers of headings and cards. At phone width, the first weight input starts approximately **975 px from the document top**.

**Effect:** The interface gives normal drafting the visual severity of a mistake and puts routine data entry behind information that changes infrequently. Repeated red warnings can also reduce the salience of actual invalid data.

**Recommended design:** Use one compact animal/date header with save state and one review action. Put measured weight and epochs immediately below it. Show reused setup/team as a compact summary with Change. Represent incomplete drafting with an actionable message such as “To finish: weight, 4 videos, task context.” Preserve the export gate; use strong error styling for invalid values, contradictory data, or an attempted export with omissions.

Evidence: [new follow-up](design-evidence/20-new-followup-viewport.png), [phone entry](design-evidence/26-phone-stable-viewport.png). Relevant implementation: [DayEditorFrame](../../../src/pages/DayEditor/DayEditorFrame.tsx), [DayTab](../../../src/pages/DayEditor/DayTab.tsx), [ReadinessBar](../../../src/components/ReadinessBar.tsx).

### D2 — High: the phone layout overflows and wastes its available width

**Observed:** The follow-up page's document width is **404 px in a 390 px viewport**, and **402 px in a 320 px viewport**. The 390 px overflow includes the “Descriptions, data folder & search terms” summary. At 320 px, the weight/team groups and epoch content also extend beyond the viewport. This is ordinary form content, not an intrinsically two-dimensional scientific table.

Nested page/card/section/list padding pushes the context comparison far inward. The two context choices wrap into tall, narrow buttons. The app bar and vertically stacked breadcrumbs consume substantial space before any input appears.

**Recommended design:** Use a single level of containment on phones, 16 px outer gutters, full-width fields, and stacked decision buttons. Remove intrinsic minimum widths from nested grid children; include padding and borders in declared widths. Compact the header/breadcrumbs while retaining animal and recording date. Recheck the actual follow-up state at 320 and 390 px, including the previous-weight suggestion and context decision.

Evidence: [phone context decision](design-evidence/27-phone-weight-context-viewport.png), [320 px page](design-evidence/34-phone-320-stable-viewport.png), [390 px measurements](design-evidence/layout-phone-followup-stable.json), [320 px measurements](design-evidence/layout-320-followup-stable.json). Relevant implementation: [DayEditor.scss](../../../src/pages/DayEditor/DayEditor.scss), especially `.daily-log-primary-grid` and `.inherited-metadata-toggle`.

### D3 — High: ordinary camera and recording-system tables are hard to read

**Observed at 1440 px:** Camera headings **MANUFACTURER** and **MODEL** overlap. The eight-character name `overhead` is truncated to `overh…`. The narrower setup wizard makes this substantially worse: several headings overlap and name/manufacturer/model/lens values shrink to single-character ellipses. In the recording-system table, adjacent name/system values visually run together as `SpikeGadgetsSpikeGadgets`. Meanwhile, status and action columns receive generous space.

**Effect:** Scientists cannot reliably scan equipment identity and calibration information without extra inspection. These are values whose meaning matters downstream.

**Recommended design:** Give identifier/name columns enough space for ordinary values. Allow headings to wrap. Combine manufacturer/model/lens into a secondary equipment description if necessary, and label calibration compactly as `m/px` with an explanation. Use content-based sizing and a deliberate narrow-screen layout; keep any necessary horizontal scrolling inside the table. Make full values available through a usable detail view rather than relying on hover titles.

Evidence: [cameras](design-evidence/16-cameras-viewport.png), [wizard cameras](design-evidence/36-wizard-cameras-viewport.png), [recording system](design-evidence/15-animal-rig-viewport.png). The camera table uses fixed layout, fixed status/action widths, and non-wrapping headings in [CamerasSection.scss](../../../src/pages/AnimalEditor/CamerasSection.scss).

### D4 — High for optogenetics users: there is no consistently applied form design

**Observed:** Camera and task dialogs have comfortable, aligned fields. Optogenetics renders largely as native fieldsets with labels touching small inline inputs and inconsistent input start positions. Its description input is no wider than its numeric inputs. The new-configuration hardware-choice select and epoch statescript-description input also use much smaller native styling than the surrounding buttons. The initial identity form uses a third sizing/layout pattern. The Team step has a tiny native experiment-description textarea, and its Lab/Institution input borders touch despite the separated labels.

The repository defines `opto-field` and `opto-section` class names in the component, but this inspection found no corresponding CSS rules. Merely having global design tokens has not produced consistent forms.

**Recommended design:** Apply shared field, select, textarea, help-text, and field-group components across these screens. Use labels above fields, a consistent readable type scale, clear units outside disappearing placeholders, and control widths appropriate to the value. Use a comfortable 40–44 px control-height product target, with roomier touch controls. The consequential replacement/repositioning choice should use two visible radio options with their effects stated beside them.

Evidence: [optogenetics enabled](design-evidence/30-opto-enabled-viewport.png), [new configuration](design-evidence/14-new-configuration-viewport.png), [epoch drawer](design-evidence/07-epoch-details-viewport.png), [camera dialog](design-evidence/28-camera-editor-viewport.png), [wizard Team](design-evidence/40-wizard-team-viewport.png). Relevant implementation: [OptogeneticsStep](../../../src/pages/AnimalEditor/OptogeneticsStep.tsx), [NewConfigurationModal](../../../src/pages/AnimalView/NewConfigurationModal.tsx), [EpochsTab](../../../src/pages/DayEditor/EpochsTab.tsx).

### D5 — Medium: navigation and action labels do not consistently describe their destinations

- **Recording days:** “Add Recording Days” opens a calendar, while a second prominent panel already offers “Log today” and “Create & open.” Rename the calendar action to “Add multiple dates…” and make the single-date entry the clear primary path.
- **Epochs:** Adding one epoch lives under **Templates → Blank**. Make **Add epoch** visible beside a secondary Templates menu; keep reorder/duplicate controls near the sequence.
- **Repairs:** Error messages say **“Fix in Tasks & Files”**, but the visible day navigation has **Daily log** and no Tasks & Files section. The repair can navigate into the embedded editor, but its label makes the user search for a section that is not present. Use “Review epoch files” or a precise epoch action matching the destination.
- **Export:** Global and animal navigation both say “Validation & Export”; the day adds “Export,” “Fix & Export,” “Download,” and “Copy.” Identify scope in page headings and actions: “Review recording,” “Download YAML,” “Download 2 ready recordings.”

Evidence: [recording-day entry](design-evidence/05-recording-days-viewport.png), [epoch menu](design-evidence/33-epoch-actions-viewport.png), [blocked export](design-evidence/25-blocked-export-viewport.png), [animal export](design-evidence/19-animal-export-viewport.png).

### D6 — Medium: review summaries are too dense and occasionally misleading

**Observed:** A completed four-epoch recording with two generated statescripts shows **“0 statescripts expected.”** The implementation counts rows still in the unresolved `expected` state; the wording sounds like the recording requires no statescripts. Use “0 statescripts missing” or “All expected statescripts added.”

The blocked export repeats the same video paragraph, ownership hint, and repair button four times. The successful export uses a small, dense key/value summary, including internal names such as `raw_data_to_volts` and `times_period_multiplier`. Configuration and source information are repeated in multiple places. Routine recording-system and optogenetics pages include long explanations of internal conversion/export behavior.

**Recommended design:** Group problems by the action needed: “4 epochs need video files” with epoch links and one relevant bulk action. Review the most consequential values in a readable summary: recording date, measured weight, epoch order and environment, cameras/calibration, probe setup, and failed channels. Put detailed provenance and legacy technical parameters in expandable sections. Keep concise scientific guidance next to inputs and move implementation explanations to help.

Evidence: [completed daily log](design-evidence/06-daily-log-viewport.png), [successful export](design-evidence/11-export-viewport.png), [blocked export](design-evidence/25-blocked-export-viewport.png). The statescript count and label are in [EpochsTab](../../../src/pages/DayEditor/EpochsTab.tsx).

### D7 — Medium: copying a prior weight is easier than entering a new measurement

**Observed:** A new recording has a prominent **“Use 452 g”** button beside the blank measured-weight input. The explanation correctly identifies the old measurement's date and says a new measurement is needed, but the action directly makes that previous value the new recording's weight.

**Effect:** This is an avoidable error opportunity during repetitive entry, especially backfilling many days. The design encourages the shortcut that its help text cautions against. No observed scientist error is claimed here.

**Recommended design:** Show the previous value and date as reference text. Require entry of the current recording's measurement. If the product intentionally supports carrying a measurement forward, represent that provenance explicitly instead of treating it as a newly measured value.

Evidence: [follow-up weight](design-evidence/27-phone-weight-context-viewport.png). Relevant implementation: [DayTab](../../../src/pages/DayEditor/DayTab.tsx), the `Use {suggestion.weight} g` action.

### D8 — Medium: save feedback and visual conventions need one consistent system

**Observed:** Simply opening the camera or mapping editor displays **“Unsaved edits”** in the underlying page before any value changes. Modal Save/Cancel, autosaved fields, wizard Save draft, and drawer Close coexist without an equally clear explanation of which behavior applies. Animal navigation uses teal and warm dividers; day navigation uses blue and grey, with different spacing and status treatments. Nested accordions range from strong black outlines to subtle card borders.

**Recommended design:** Keep deliberate Save/Cancel for consequential dialogs and clear automatic-save feedback for daily fields. Reserve “Unsaved edits” for changed data; opening an editor can still participate in navigation protection without making that claim. Use one navigation pattern, one set of field sizes, one card/accordion treatment, and consistent status badges across all scopes. Retain visible keyboard focus.

Evidence: [camera dialog](design-evidence/28-camera-editor-viewport.png), [mapping editor](design-evidence/13-mapping-viewport.png), [animal navigation](design-evidence/05-recording-days-viewport.png), [day navigation](design-evidence/06-daily-log-viewport.png).

## Screen-by-screen design judgment

| Screen | What works | Main design change |
| --- | --- | --- |
| Empty workspace | Clear create/import paths and explicit browser-only storage. | Make backup maintenance quieter while retaining storage awareness. The byte-capacity explanation is too prominent for first use. |
| Populated workspace | Familiar searchable list and visible recording status. | Emphasize continuing an animal's work; keep maintenance actions secondary. |
| Setup: Identity | Sensible grouping, species/sex choices, DOB draft guidance. | Standardize field sizes, mark required-before-export clearly, shorten hints explaining formats already handled by dropdowns. |
| Setup: Electrodes | Reusable groups and mapping verification are exposed. | Reduce repeated card/section headings; integrate mapping status with the group summary. |
| Setup: Cameras | Dedicated camera editor and calibration explanation. | Fix the table; preserve room for camera names and units. |
| Setup: Optogenetics | Optional entry and explicit scientific field names. | Apply the shared form design and reduce explanatory prose. |
| Setup: Tasks | Reusable definitions and explicit default cameras/environment. | Keep “default” visible; align spacing and help text with other forms. |
| Setup: Recording system | Reuse matches the expected infrequent-change workflow. | Shorten the introduction and improve table spacing. |
| Setup: Team | Reusable experimenters and editable names. | Use the same field rhythm and footer behavior as other steps. |
| Recording-day list | Today and backfill are both supported; download history is visible. | One primary new-recording path, secondary multiple-date calendar. |
| Daily log | Weight, team and epochs are brought together. | Put the daily work first; compact context; use a neutral unfinished state. |
| Epoch list and drawer | Ordered epochs, file generation, per-epoch edits, and visible file names. | Visible Add epoch; clearer file counts; consistent fields; less badge repetition. |
| Recording Setup | Separate day-specific setup and advanced overrides. | Compact read-only summaries and preserve the distinction between changing defaults and correcting this day. |
| Failed Channels | Explicit “No failures recorded” wording is appropriately cautious. | Reduce nested disclosure levels and repeated empty-state messages. |
| DIO Wiring | Add a named line without first completing every ECU line. | Match navigation and page title: currently “DIO Wiring” opens “Behavioral events.” |
| New probe configuration | Effective date and hardware continuity consequences are explicit. | Visible radio choices, consistent fields, concise affected-date summary. |
| Mapping editor | Clear units/ID meaning, affected-day count, and Save/Cancel footer. | Retain this deliberate review pattern; integrate verification visibility with the parent screen. |
| Fix & Export | Actionable repairs and a human-readable pre-download review. | Group repetitive issues and make the scientific summary easier to scan. |
| Animal/global export | Batch views and downloadable-record filtering. | Make scope and counts explicit; avoid displaying zero-error counts in alarm colors. |
| Import entry | Simple file selection and clear grouping by animal/date. | Strong entry surface; post-import conflict resolution was not repeated in this design pass. |

## Design direction and order of work

The useful lesson from daily diary apps is a short recurring loop: **choose recording → enter measurements → confirm the familiar sequence → handle exceptions → finish**. Keep the date visible and make reuse explainable. Team and rig should remain compact defaults with Change; the earlier YAML analysis does not support turning them into repeated daily questions.

1. Fix camera/table readability, narrow-screen overflow, and optogenetics/native-control styling.
2. Simplify the day header and card hierarchy; distinguish unfinished drafts from invalid entries; make Add epoch visible.
3. Unify navigation, action names, statuses, and save feedback. Group repair messages and improve the export summary.
4. Observe scientists creating an animal, logging the next recording, backfilling a date, and correcting a previously downloaded recording. Measure time to first input, task completion, unnecessary navigation, and uncertainty about save/change scope.

Avoid a broad decorative redesign before resolving these task-level problems. A consistent, calm interface with readable scientific values would be a substantial improvement.

## External design criteria

Consistency, visible system status, recognition, and error prevention are established usability principles; the priorities above apply them to the observed screens. [Nielsen Norman Group's usability heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/).

WCAG's reflow guidance uses a 320 CSS-pixel width and distinguishes ordinary content from components that need a two-dimensional layout. The observed overflowing form content should be corrected against that criterion. [W3C reflow guidance](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html).

The suggested 40–44 px form controls are a comfort/consistency target for this app. WCAG 2.2 AA's minimum target-size criterion is 24 × 24 CSS pixels with exceptions, including spacing; a small measured control alone does not establish a violation. [W3C target-size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).
