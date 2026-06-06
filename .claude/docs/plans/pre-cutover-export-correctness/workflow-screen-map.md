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
| Animal Workspace | `#/workspace?animal=<id>` | Operational hub for one animal and batch triage | Which animal, setup readiness, recording days, existing-data warnings, export readiness | `Set Up/Review Animal Setup`, `Add Recording Days`, `Open Validation Summary` | Thinking a recording day owns probes/cameras; exporting recovered/imported data without review |
| Animal Setup | `#/animal/:id/editor` | Define shared physical/setup identities for the animal | Electrodes/probes, channel maps, recording system, cameras/calibration, DIO library, implanted opto setup | Save/review shared setup; create a new identity/version when hardware changes | Editing shared setup while believing it is only changing one day; hiding data-acq inside vague hardware |
| Day Editor | `#/day/:id` | Describe one recording day for export | Session/day facts, effective setup, tasks/epochs, rooms, cameras, videos/files, opto protocols, failed channels | Validate/export this day or repair the owning section | Re-entering shared setup as if day-owned; missing within-day setup changes |
| Validation Summary | `#/validation` | Cross-day validation, repair routing, and batch export | Which days are valid/blocked, why, and which repair surface owns the fix | `Validate All`, `Export Valid Only`, or targeted repair | Batch-exporting invalid/wrong-owner/recovered days; losing the single-day/export gate contract |

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

## Animal Setup screen contract

User-facing label target: **Animal Setup** or **Shared Animal Setup**, not merely
`Animal Editor`. The implementation may keep the route/component name, but the page title,
step labels, repair destinations, and empty states should use user language.

| Setup area | User job | Screen/step label target | What must be visible | Primary actions |
| --- | --- | --- | --- | --- |
| Subject and lab defaults | Correct animal-wide facts | `Subject` / `Experimenters` where present | Blast radius: subject corrections affect all recording days | Save correction; return to Workspace |
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

## Day Editor screen contract

User-facing label target: **Recording Day** or **Day Editor**, with step labels that name
the user's job. Current internal labels may remain as component ids, but the UI should not
ask the user to infer ownership from `devices`, `epochs`, or schema terms alone.

| Day step | User job | Label target | What must be visible | Primary actions |
| --- | --- | --- | --- | --- |
| Overview | Describe the recording day | `Overview` / `Day Details` | Date, session id, description, weight, header path, subject facts inherited from animal | Save day facts; repair subject facts if inherited values fail |
| Setup and failed channels | Verify effective setup for this day | `Setup & Failed Channels` | Pinned configuration version, historical/latest status, read-only electrodes/probes, cameras summary, day-specific failed channels | Mark failed channels; `Hardware changed starting this day`; route setup fixes to Animal Setup |
| Tasks, epochs, files | Record what happened by task epoch | `Tasks, Epochs & Files` | Task rows with room/environment, camera(s), epoch set, files/videos, DIO/opto protocol assignments | Add/edit task; attach files/videos; choose camera(s); set opto protocol for selected epochs |
| Validation | Understand and repair blockers | `Validation` | Issues grouped by user job and repair destination | Click repair action; rerun validation |
| Export | Download trustworthy YAML | `Export` | Preflight summary of what will be encoded and why export is allowed/blocked | Download YAML when valid |

The task row is the user's within-day setup unit. If room/camera/opto differs within a
day, the UI represents that as separate task rows that partition the epochs. It should not
offer a day-wide camera/opto choice when the recording story is epoch-specific, and it
should not create a free-floating per-epoch editor that bypasses the task model.

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

## QA acceptance

Phase 8.7 and Phase 9 should prove this map, not just individual controls:

- Each top-level route has one dominant user job, one primary next action, and a route/heading
  label that matches that job.
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
