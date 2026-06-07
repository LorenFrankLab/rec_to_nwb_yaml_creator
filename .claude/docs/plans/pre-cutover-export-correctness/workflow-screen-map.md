# Workflow screen map

[<- back to PLAN.md](PLAN.md) · [workflow clarity design](workflow-clarity-design.md) · [ownership/defaults phase](phase-8-7-ownership-defaults-day-configurability.md)

Date: 2026-06-06

This is the screen-level contract for the modern YAML creator. It maps every user-visible
workspace screen to the job the scientist is trying to do, the thing their attention is
likely on, the primary action the screen should offer, and the mistake the screen is
responsible for preventing.

The app is not a schema editor. It is a conversion workbench for recorded data:

1. Create or select the animal.
2. Define the shared setup that existed for that animal.
3. Add or recover recording days.
4. Describe what happened in each day and task epoch.
5. Validate/export one day or a batch.
6. Record a hardware/configuration change at the day where it starts.

Any implementation that adds, removes, renames, or combines screens must update this file
and the Phase 9 browser QA expectations. A route, step, modal, or empty state is coherent
only if a user can answer: "What am I doing here, what does this affect, what is the next
safe action, and what will be exported?"

## Top-level screens

| Screen | Route | User job | User attention | Primary action | Prevented mistake |
| --- | --- | --- | --- | --- | --- |
| Legacy metadata form | `#/` or no hash | Use the frozen pre-workspace editor until cutover | Existing familiar one-page form | Complete/export through legacy path | Confusing legacy safety-net behavior with the modern workspace plan |
| Create Animal | `#/home` | Create the subject and lab/experimenter defaults | Subject id, species, sex, DOB, genotype, experimenters | `Create Animal`, then go to Workspace | Starting with recording-day fields before the subject exists |
| Animal Workspace | `#/workspace` / `#/workspace?animal=<id>` | Operational hub for one animal and batch triage | Selected animal, setup readiness, recording days, existing-data warnings, export readiness | State-specific; see below | Thinking a recording day owns probes/cameras; exporting recovered/imported data without review |
| Animal Setup | `#/animal/:id/editor` | Define shared physical/setup identities for the animal | Electrodes/probes, channel maps, recording system, cameras/calibration, DIO library, implanted opto setup | Save/review shared setup; create a new identity/version when hardware changes | Editing shared setup while believing it is only changing one day; hiding data-acq inside vague hardware |
| Day Editor | `#/day/:id` | Describe one recording day for export | Session/day facts, effective setup, tasks/epochs, rooms, cameras, videos/files, opto protocols, failed channels | Validate/export this day or repair the owning section | Re-entering shared setup as if day-owned; missing within-day setup changes |
| Validation Summary | `#/validation` | Cross-day validation, repair routing, and batch export | Which days are valid/blocked, why, and which repair surface owns the fix | State-specific; see below | Batch-exporting invalid/wrong-owner/recovered days; losing the single-day/export gate contract |

## State-specific primary actions

Each route state should have one dominant next action. Secondary actions can remain visible,
but they must not compete with the safest next step.

| State | Primary visible action | Secondary actions | Coherence rule |
| --- | --- | --- | --- |
| No animals in workspace | `Create Animal` | Legacy form link if still pre-cutover | Do not show empty day/export controls before the user has a subject. |
| Workspace route with animals but none selected (`#/workspace`) | `Select an animal` | `Create Animal` | The primary nav's Workspace link must land in a useful selector state, not a dead end. |
| Selected animal, no electrodes/probes | `Set Up Electrodes` | Add day only if clearly marked as draft/not export-ready | The app should not let users hunt for probes inside a recording day. |
| Selected animal, setup incomplete but electrodes exist | `Finish Animal Setup` / the highest-risk missing setup item | Add/review days | Prioritize the setup item that blocks export or creates the largest silent-science risk. |
| Selected animal, setup complete, no days | `Add Recording Days` | Review Animal Setup | Once setup is safe, the next job is creating the recorded sessions. |
| Selected animal, existing/recovered data present | `Review / Repair Existing Data` | Open day, open validation summary | Recovered or imported data must not look silently trusted. |
| Selected animal, some days invalid | The most actionable repair, or `Open Validation Summary` if multiple days are blocked | Open valid days, add days | A blocked export state should route to the owner of the first meaningful fix. |
| Selected animal, one ready day | `Open Export` / `Export This Day` | Add days, review setup | Same-day workflow should not require batch tooling. |
| Selected animal, multiple ready days | `Export Valid Only` | Validate all, inspect day | Catch-up workflow should let users export ready days without opening every day. |
| Day uses historical configuration | Continue day edits against `Configuration vN` | Reconfigure starting this day | Do not imply latest Animal Setup edits will change this historical day. |
| Hardware changed starting this day | `Hardware changed starting this day` | Edit day failed channels | Reconfiguration is a timeline event and must name affected days before fork. |
| Export blocked | First repair action / `Open Validation` | Back to day/setup | Disabled export must never be the only feedback. |
| Export ready | `Download YAML` | Back to day/workspace | Export is the confidence checkpoint and should summarize what will be encoded. |

## Same-day path

The same-day user has just finished one recording and wants one trustworthy YAML quickly.

1. **Animal Workspace** shows whether shared setup is ready before the user opens the day.
   If electrodes/probes or cameras are missing, the primary action is `Set Up Electrodes`
   or `Set Up Cameras`, not a generic editor link.
2. **Animal Setup** is only visited when shared setup is missing or changed. It must not
   make the user re-enter day facts.
3. **Day Editor** leads with day facts and task-epoch context. The user should see what
   setup this day is using without editing shared setup in the common case.
4. **Validation** and **Export** tell the user whether this one day is safe to download.
   Export repeats the values that matter downstream: subject/session identity, setup
   version, recording system values, camera/task identities, opto state, and failed channels.

Success means a prepared animal can move from `Add Recording Day` to `Export` without
retyping electrodes, cameras, data-acq, or implanted opto setup.

## Catch-up path

The catch-up user has several recorded days waiting and needs to spot differences and
blockers efficiently.

1. **Animal Workspace** is the triage home: days are visible together, setup readiness is
   visible above them, and recovered/corrupt/wrong-owner states are not hidden.
2. **Validation Summary** is the batch surface: it groups issues by user job
   (`Animal setup`, `Day metadata`, `Failed channels`, `Existing data repair`) and routes
   to the owning screen.
3. **Day Editor** repairs only the day/task facts for the selected day. Shared setup repair
   routes back to Animal Setup with a focused destination.
4. **Batch Export Preflight** names which days will export and which were skipped, and it
   uses the same gate as single-day export.

Success means the user can scan many days, repair only the few that need attention, and
export valid days without opening every long form.

### Batch row scan contract

Workspace day rows and Validation Summary rows must expose enough information for catch-up
work without making the user open every day. At minimum, each row or expandable row summary
should show:

- recording date and session id;
- animal/subject label when the view spans animals;
- configuration version and whether it is latest or historical;
- camera set/calibration summary, including enough identity detail to detect a zoom or
  `meters_per_pixel` change;
- opto state: no opto, implanted but no stimulation, or stimulation on selected epochs;
- validation/export state: ready, draft, blocked, exported/validated, recovered/corrupt,
  wrong-owner, or missing record;
- next repair/export action and the owner it will open.

## Animal Setup screen contract

User-facing label target: **Animal Setup** or **Shared Animal Setup**, not merely
`Animal Editor`. The implementation may keep the route/component name, but the page title,
step labels, repair destinations, and empty states should use user language.

| Setup area | User job | Screen/step label target | What must be visible | Primary actions |
| --- | --- | --- | --- | --- |
| Animal profile and lab defaults | Correct animal-wide facts | `Animal Profile` / `Subject` / `Experimenters` | Subject id, species, sex, DOB, genotype, subject description, experimenters/lab/institution, and blast radius for corrections that affect all recording days | Save correction; return to Workspace |
| Electrode groups | Define probes/tetrodes and anatomical locations | `Electrodes & Probes` or `Electrodes & Ephys` | Device type, group id, location/targeted location, configuration version context | Add/edit/copy electrode group |
| Channel maps | Verify ntrode/electrode mapping | `Channel Maps` | Per-group channel map, local channel ids, failed-channel semantics | Edit/import/export channel maps |
| Recording system | Define data-acq identity and rig constants | `Recording System` | Data-acq name/system/amplifier/ADC, `raw_data_to_volts`, `times_period_multiplier`, blast radius for all days | Save recording-system defaults; route unsupported mid-study swap to future versioning |
| Cameras and calibration | Define reusable camera identities | `Video Cameras & Calibration` | `camera_id`, `camera_name`, manufacturer/model/lens, `meters_per_pixel`, reference/affected-day status | Add camera; create new camera identity after zoom/calibration/lens change |
| Behavioral events / DIO | Manage reusable event definitions, if they are not directly day-exported | `Behavioral Events / DIO` | Whether entries are a library/template or exported on a day | Add library event; `Use on this day` from the day flow |
| Implanted opto setup | Record animal-level opto capabilities | `Optogenetics Setup` | Implant/virus/source/software completeness; opto-free days are allowed | Enable/complete implanted setup; leave off when no opto |

Animal Setup must answer "does this change future or existing days?" before save. For
configuration-versioned ephys setup, latest-version edits affect days pinned to latest;
historical days keep their pinned versions. For data-acq today, no per-day binding exists,
so edits are shared and must announce that limitation.

Home remains the creation surface for a new animal, but it must not be the only discoverable
place to correct animal profile facts. **Done (Task 2b ✓):** the Animal Editor now renders an
`AnimalProfileSection` (collapsible, above the device stepper) owning the constant subject facts
(species with Latin-binomial/NCBI guidance, sex, DOB with ISO-8601 note, genotype, description;
`subject_id` read-only) — it names its blast radius ("this animal and all N recording days,
including any already exported") at the edit point AND in a confirmation before commit. Weight is
deliberately excluded (a per-day fact — Task 2.5). The Day Overview keeps inline subject repair and
its inherited-notice now names the day count N too, so it is no longer the only correction path.

## Day Editor screen contract

User-facing label target: **Recording Day** or **Day Editor**, with step labels that name
the user's job. Current internal labels may remain as component ids, but the UI should not
ask the user to infer ownership from `devices`, `epochs`, or schema terms alone.

| Day step | User job | Label target | What must be visible | Primary actions |
| --- | --- | --- | --- | --- |
| Overview | Describe the recording day | `Overview` / `Day Details` | Date, session id, description, recording-day weight, header path, subject facts inherited from animal | Save day facts; repair subject facts if inherited values fail |
| Setup and failed channels | Verify effective setup for this day | `Setup & Failed Channels` | Pinned configuration version, historical/latest status, read-only electrodes/probes, cameras summary, day-specific failed channels | Mark failed channels; `Hardware changed starting this day`; route setup fixes to Animal Setup |
| Tasks, epochs, files | Record what happened by task epoch | `Tasks, Epochs & Files` | Task rows with room/environment, camera(s), epoch set, files/videos, DIO/opto protocol assignments | Add/edit task; attach files/videos; choose camera(s); set opto protocol for selected epochs |
| Validation | Understand and repair blockers | `Validation` | Issues grouped by user job and repair destination | Click repair action; rerun validation |
| Export | Download trustworthy YAML | `Export` | Preflight summary of what will be encoded and why export is allowed/blocked | Download YAML when valid |

The task row is the user's within-day setup unit. If room/camera/opto differs within a
day, the UI represents that as separate task rows that partition the epochs. It should not
offer a day-wide camera/opto choice when the recording story is epoch-specific, and it
should not create a free-floating per-epoch editor that bypasses the task model.

Weight is a recording-day value for export, even though older/current workspace state may
store an animal-level subject weight as an initial/default value. The Day Overview should be
the primary place to review the weight exported for that session; if it falls back to an
animal-created value, the UI should say that plainly and encourage confirming/updating it
for the recording day.

## Specialized flows and modals

| Surface | Opens from | User job | Coherence requirement |
| --- | --- | --- | --- |
| Recording-day calendar | Animal Workspace | Add one or more days | Existing dates are visible; created days inherit current setup/defaults; the next action is opening or validating the new days |
| Reconfiguration wizard | Day Editor setup/failed-channels step | Record hardware change beginning on a day | Names affected contiguous days before fork; after fork, Animal Setup banner explains which version is being edited |
| Electrode group modal | Animal Setup | Add/edit one probe/electrode group | Shows group identity and anatomy fields; adding multiple groups must not obscure generated ids |
| Channel map editor | Animal Setup | Edit local channel mapping and failed-channel-compatible ids | Local channel ids and probe/electrode ids are explicit; invalid/corrupt bad-channel marks are repairable |
| Camera modal | Animal Setup or repair route | Add/edit one camera identity | Different lens/zoom/calibration/`meters_per_pixel` steers to new camera name/identity; affected-day blast radius is visible |
| Task modal | Day Editor tasks/epochs step | Define task identity and epoch assignment | Shows task name/description identity, room, camera choices, and one-epoch-one-task rule |
| File/video editors | Day Editor tasks/epochs step | Attach recorded files/videos | Camera/task/epoch references are controlled choices from known values |
| FsGUI/opto protocol editor | Day Editor tasks/epochs step | Record opto actually run for selected epochs | No-opto day/epoch is a valid empty state; opto protocol requires selected epochs/camera/DIO only when used |
| Behavioral event use surface | Day Editor tasks/epochs step | Make a DIO/event part of the exported day | Animal library entries do not look exported until explicitly used on the day |
| Delete confirmations | Workspace day/animal actions | Remove mistaken local records | Destructive actions are secondary; confirmation names cascade count and says local deletion does not remove already downloaded YAML/NWB/DANDI/Spyglass artifacts |
| Raw/corruption repair banners | Workspace, Animal Setup, Day Editor, Validation Summary | Repair malformed saved state | A corrupt collection never renders as silently empty; reset/repair actions name the damaged section |

## Naming and navigation rules

- The primary navigation should not make `Home` look like the operational hub if it is really
  the create-animal form. After cutover, either Workspace is the home route, or the nav label
  should be `New Animal` / `Create Animal`.
- The logo/header destination must match the active product mode. Before cutover it may return
  to the legacy form as a safety net, but modern-route users need a clearly labeled modern
  Workspace path and must not be bounced into legacy by surprise. After cutover, the logo should
  return to the modern operational home unless an explicit `Use Legacy Editor` escape is enabled.
- `Animal Editor` is implementation language. User-facing copy should say `Animal Setup`,
  `Shared setup`, or the concrete setup area.
- `Hardware Config` is too broad for a scientist's attention. Split or visually separate
  `Recording System`, `Video Cameras & Calibration`, and `Behavioral Events / DIO`.
- `Devices` in a day is not where the user creates devices. If the step remains, the visible
  heading must say it is verifying the day's effective setup and editing day-specific failed
  channels.
- `Epochs` alone undersells the user's work. The visible heading should make tasks, rooms,
  cameras, files/videos, and opto protocol assignments discoverable.
- Every repair action must land where the edit can actually happen, with focus or a visible
  target. A repair route that lands on a read-only summary is a dead end.
- Every screen needs a clear return path: Setup and Day return to Workspace; repair routes
  return or leave a breadcrumb; Validation routes to the owning setup/day screen.
- Ownership cues should be risk-tiered. Put visible cues at high-risk decisions, summaries,
  repair destinations, and preflight; do not badge every ordinary field so heavily that the
  important warnings lose signal.

## Current label reconciliation (verified against code 2026-06-06)

These are the **actual** strings rendered today (with file:line), the **target** user-facing
label, and the later Phase 8.7 sub-stream that owns the change. This subsection makes the map
*current*: the labels above describe the target, this table pins where the code stands so a
relabel task and Phase 9 QA reconcile against reality, not guesswork. The ownership cue for each
control comes from [`workflow-ownership-matrix.md`](workflow-ownership-matrix.md) /
[`src/domain/workflowOwnership.js`](../../../../src/domain/workflowOwnership.js); this foundation
sub-stream (Tasks 0/0.5/1) does **not** relabel anything.

| Surface | Current string (file:line) | Target user-facing label | Owning sub-stream |
| --- | --- | --- | --- |
| Primary nav | `Home`, `Workspace` ([AppLayout.jsx:241-251](../../../../src/layouts/AppLayout.jsx)) | `Create Animal`/`New Animal` for Home; `Workspace` ok | Task 2 / nav (post-cutover) |
| Logo/header link | `#/` with aria-label `Return to metadata form` ([AppLayout.jsx:213](../../../../src/layouts/AppLayout.jsx)) | clearly-labeled modern Workspace path; no surprise legacy bounce | nav (post-cutover) |
| Animal editor route/title | **done (Task 2c ✓)**: page title `Animal Editor:` → **`Animal Setup:`**, and repair-button copy `Fix in Animal Editor →` → **`Fix in Animal Setup →`** (the `#/animal/:id/editor` route + component names stay as implementation identifiers) | — | Task 2 — **done 2c** |
| Animal editor steps | **done (Tasks 2a/2c ✓)**: `Electrode Groups` → **`Electrodes & Ephys`**, `Optogenetics` → **`Optogenetics Setup`**, `Hardware Config` → **`Recording System, Cameras & DIO`**; `Channel Maps` unchanged (already the target). `ANIMAL_EDITOR_STEPS` labels (repair routing) kept in sync | — | Task 2 — **done** |
| Hardware Config step heading | ~~`Cameras, Hardware & Behavioral Events`~~ → **`Recording System, Cameras & DIO Events`**, three ownership-named sections (`Video Cameras & Calibration` / `Recording System` / `Behavioral Events / DIO`) (Task 2a ✓) | full split into separate steps deferred; within-step separation done | Task 2 — **done 2a** (visual separation; separate steps deferred) |
| Data-acq section | ~~`Data Acquisition Device`~~ → **`Recording System`** (Task 2a) + **option-B limitation notice (Task 3 ✓)**: "One recording system per animal — no per-day version yet… a mid-study hardware change can't be represented per day… there is no way to keep earlier days on the old hardware… future capability." Identity blast-radius (all days) + future-days-only defaults copy in place | the DAY-side effective-value display (`Using recording-system default` vs `Different from current default`) is Task 4 | Task 2/3 — **done**; Task 4 for the day-side constants |
| Cameras table | **`lens` column added** between Model and Meters/Pixel (Task 2a ✓) | identity fields now visible in the table, not only the modal | Task 2 — **done 2a** |
| Behavioral-events empty state | claims events "will be inherited by all recording days" ([BehavioralEventsSection.jsx:187](../../../../src/pages/AnimalEditor/BehavioralEventsSection.jsx)) — **FALSE** (never exported) | reusable library/template; `Use on this day` from the day | Task 6 (correctness fix) |
| Day editor steps | `Overview`, `Devices`, `Epochs`, `Validation`, `Export` ([DayEditorStepper.jsx:288-294](../../../../src/pages/DayEditor/DayEditorStepper.jsx)) | `Day Details`, `Setup & Failed Channels`, `Tasks, Epochs & Files`, `Validation`, `Export` | Tasks 2/4/5 |
| Day technical section | **done (Task 4 ✓)**: now shows the rig constants (`raw_data_to_volts`/`times_period_multiplier`) as effective, **read-only** recording-system values labelled `Using recording-system default` vs `Different from current recording-system default (current default: X)`, with an `Edit in Recording System` deep-link (not a routine day edit; a day keeps what it recorded). `default_header_file_path` carries a `This day only` cue and stays editable | — | Task 4 — **done** |
| Day tasks/epochs heading | `Tasks & Epochs` ([TasksEpochsStep.jsx:299](../../../../src/pages/DayEditor/TasksEpochsStep.jsx)) | make tasks/rooms/cameras/files/opto discoverable; per-task room·cameras·epochs mapping | Task 5 |
| Day Overview weight field | **done (Task 2.5 ✓)**: relocated from the inherited-subject section to Session Metadata; now writes `day.session.weight` (the exported value — the merge already preferred it) and no longer mutates `animal.subject.weight` or clears the day value. Labelled `Recording-day weight`; when no day weight is set, the input is empty and the cue names the animal baseline fallback (`N g`) explicitly | — | Task 2.5 — **done** |
| Animal Setup versioning subtitle | **corrected (Task 2a ✓)**: now "electrodes/probes are versioned — each recording day keeps the configuration it was pinned to. Cameras and the recording system are shared animal-level setup: editing them affects all recording days." No longer overpromises per-day versioning for cameras/data-acq | once Task 5's day-used camera export binding lands, refine the camera clause to "past days keep the cameras they referenced" | Tasks 3/5 will refine the camera clause; honest current copy **done 2a** |
| Opto preflight / batch status | Export and Validation Summary report optogenetics "on" from animal IMPLANT metadata even when the day has no `fs_gui_yamls` ([ExportStep.jsx:357](../../../../src/pages/DayEditor/ExportStep.jsx), [ValidationSummary/index.jsx:325](../../../../src/pages/ValidationSummary/index.jsx)) | report the DAY PROTOCOL state per the batch-row scan contract: "no opto / implanted but no stimulation / stimulation on selected epochs" | Tasks 7/10 |
| Lifecycle cleanup | only wrong-owner `Remove from this animal` ([AnimalWorkspace/index.jsx:512](../../../../src/pages/AnimalWorkspace/index.jsx)); **no** discoverable `Delete animal`/`Delete recording day` | secondary/destructive `Delete animal…` / `Delete recording day…` with cascade-count confirmation | Task 8 |

## QA acceptance

Phase 8.7 and Phase 9 should prove this map, not just individual controls:

- Each top-level route has one dominant user job, one primary next action, and a route/heading
  label that matches that job.
- Each state in the state-specific primary-action table has exactly one visually dominant
  next action and secondary actions do not compete with it.
- Workspace and Validation rows satisfy the batch row scan contract for catch-up work.
- Each step/modal names whether the action edits shared setup, a pinned configuration, a
  recording-system default copied into the day, a day/task/epoch fact, or an exported day list.
- Same-day and catch-up paths can both be completed without redundant setup entry or hidden
  repair dead ends.
- Existing/imported data and corrupt saved state are visible as review/repair states, not
  silently trusted or silently scrubbed.
- Downstream identity fields are visibly identity fields at edit time: camera name plus
  calibration/lens/`meters_per_pixel`, data-acq name plus dependent fields, task name plus
  description, DIO/event description, and ephys configuration version.
- Browser QA has at least one assertion per top-level screen that the visible heading,
  primary action, and next/return action match this screen map.
