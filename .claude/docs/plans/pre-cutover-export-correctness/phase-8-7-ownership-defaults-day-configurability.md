# Phase 8.7 — Ownership defaults and day configurability UX

[<- back to PLAN.md](PLAN.md) · [overview](overview.md) · [workflow clarity design](workflow-clarity-design.md) · [screen map](workflow-screen-map.md) · [shared contracts](shared-contracts.md#user-mental-model-contract) · [device design](designs.md)

Goal: make it obvious, at the point where the user is making a decision, which metadata
is shared animal setup, which metadata is a versioned hardware configuration, which
metadata is copied from setup/recording-system defaults into a recording day, which
metadata is merely selected/referenced on a day, and which metadata is truly day-specific.
Phase 8.6 made the workflow discoverable; this phase removes the remaining ambiguity
around "where do I edit this?", "will this change old data?", and "will this be exported
for this day?"

This is a field-ownership and information-architecture phase. It may change labels,
section grouping, help text, repair routing, setup summaries, and small reset/select
controls. It must not silently change export semantics. If this phase discovers that a
field needs a new source-of-truth model, record the decision and either implement the
smallest covered change or mark it as a blocker before Phase 9.

## User story and product principles

The user is a scientist who has recorded data and needs to convert it to NWB. The YAML
creator is not the scientific goal; it is the bridge between "we recorded this session"
and "the NWB/Spyglass/DANDI metadata is correct enough to trust." The modern workspace
exists for three reasons:

1. **Prevent mistakes** before they become silent converter, Spyglass, DANDI, or scientific
   identity errors.
2. **Let the scientist do their job efficiently** whether they export immediately after a
   recording or catch up on several days at once.
3. **Enforce consistent naming and identities** so the resulting NWB data can be joined,
   queried, and interpreted consistently downstream.

Design every ownership decision around two common cadences:

- **Same-day conversion.** The user finishes a recording, creates/reviews that day, confirms
  what happened in each task epoch, fixes obvious missing metadata, and exports one YAML.
  The UI should avoid repeated setup entry, make inherited setup easy to verify, and keep
  the next required action obvious.
- **Catch-up / batch conversion.** The user has several recorded days waiting. They need to
  scan which days are ready, which share setup, which changed hardware or camera calibration,
  which task epochs used different rooms/cameras/opto protocols, and which names would collide
  downstream. The UI should support review, comparison, batch validation/export, and targeted
  repair without forcing every day through the same long form when only a few facts differ.

The user's attention is usually on the experiment narrative, not the schema: animal, recording
day, task epoch, room/environment, cameras/videos, opto/DIO, files, failed channels, and export
readiness. The app may store animal-level catalogs, day-owned lists, and configuration snapshots,
but the screen must translate that structure into the user's question: "What did we record, what
setup was used, what names will this create, and is it safe to export?"

Naming is a first-class UX responsibility. Any field that becomes a downstream identity or join key
must be presented as such at the edit point, not only at export validation. Reusing a name should
feel intentionally safe only when the dependent metadata is the same; a changed camera zoom,
calibration, lens, model, data-acq identity, task description, or other downstream key material
must steer the user to a distinct name before export.

## Design decisions (from the 2026-06-06 brainstorm)

Full design: [docs/superpowers/specs/2026-06-06-ownership-day-configurability-design.md](../../../../docs/superpowers/specs/2026-06-06-ownership-day-configurability-design.md). The decisions that bind this phase:

- **Both cadences are first-class.** Same-day conversion and batch catch-up each get a real
  path; neither is the stepchild (operator varies by lab).
- **Headline user-facing promise: blast-radius transparency + no silent retroactive change.**
  Any change that reaches beyond the day in front of you names exactly which days it affects,
  before you commit; nothing silently rewrites already-recorded days. The six ownership
  patterns become INTERNAL vocabulary — the user experiences only "today-only edit" vs "heads
  up, this touches these N days (enumerated)". Silent retroactive change is the worst failure
  mode (the user won't notice it).
- **Identity model.** Three kinds of field: (1) **physical-configuration identity** (electrode
  geometry, channel maps, camera calibration/lens/zoom/model, recording system/amplifier) is
  **append-only — a physical change is a NEW identity/version, never a silent edit of the old
  one**, so past days keep what they recorded; (2) **truly-constant animal fact**
  (`subject_id`, species, sex, DOB) may propagate as a correction but must **announce its
  blast radius**; (3) **per-day fact** is local. Touching past days is only ever an explicit
  "apply to these N days" action (the reconfiguration-wizard shape).
- **Implementation = approach A (immutable-once-referenced catalog), with explicit export
  binding.** Catalogs stay animal-level; once a day references an identity, recalibration/swap
  creates a NEW identity rather than mutating the live values. For cameras, this only preserves
  historical exports if export emits the day-used camera subset; the current merge emits all
  `animal.cameras`, so Task 5 must either implement the preferred day-used export binding with
  a baseline/export audit, or choose the baseline-safe fallback and warn that camera catalog
  changes affect all day exports. The heavier per-day-freeze / versioned-snapshot alternative
  is deferred to its own phase.
- **Cameras vs data-acq are not symmetric.** Cameras can do approach A cleanly only once the
  day-used export binding is fixed (`camera_id` references; recalibration = new camera, past
  days unchanged). Data-acq has NO
  per-day binding, so it follows the principle only: a single shared recording-system
  identity, editing it shows it affects ALL days, and a mid-study amplifier swap is surfaced
  as currently unsupported — i.e. **Task 3 is decided as option B**, and the rig constants
  (`raw_data_to_volts` / `times_period_multiplier`) are recording-system defaults copied into
  days at creation. Editing those defaults affects future days unless the user explicitly applies
  the change to named existing days.

## Inputs to read first

- [docs/superpowers/specs/2026-06-06-ownership-day-configurability-design.md](../../../../docs/superpowers/specs/2026-06-06-ownership-day-configurability-design.md)
  — the validated design this phase implements.
- [workflow-clarity-design.md](workflow-clarity-design.md) — the current workflow model:
  animal setup, recording-day metadata, failed channels, reconfiguration, and export
  confidence.
- [workflow-screen-map.md](workflow-screen-map.md) — the screen-to-user-job contract:
  every top-level route, step, modal, empty state, and repair path must have a coherent
  user job, primary action, next/return path, and mistake-prevention role.
- [shared-contracts.md](shared-contracts.md) — especially export-resolution,
  user mental-model, UX mistake-prevention, and Spyglass naming-identity contracts.
- [designs.md](designs.md#device-resolution-model) — configuration-history/day-pin
  semantics for electrodes and channel maps.
- [phase-8-6-workflow-clarity-setup-ux.md](phase-8-6-workflow-clarity-setup-ux.md) and
  [workflow-route-state-inventory.md](workflow-route-state-inventory.md) — current route
  and setup-readiness expectations.
- `src/state/workspaceTypes.js`, `src/state/workspaceUtils.js`,
  `src/state/workspaceTransitions.js`, and `src/domain/workflowStatus.js` — current state
  shape, export bridge, mutation helpers, and setup status model.
- `src/pages/AnimalWorkspace`, `src/pages/AnimalEditor`,
  `src/pages/DayEditor/DevicesStep.jsx`, `src/pages/DayEditor/DayTechnicalSection.jsx`,
  `src/pages/DayEditor/ValidationStep.jsx`, and `src/pages/DayEditor/ExportStep.jsx` —
  user surfaces that must agree on ownership language.

## Ownership rule for every task

For every edited field or section, classify it as exactly one of:

- **Animal setup** — defined once for the animal unless explicitly reconfigured.
- **Configuration version** — a physical setup snapshot pinned by each recording day.
- **Setup default -> day value** — default lives in shared setup/recording-system
  settings; export reads the day value copied at day creation or deliberately overridden
  for that recording day.
- **Animal catalog -> day/task/epoch reference** — reusable animal-level item; a day-owned
  task/video/FsGUI/epoch row chooses which item was used.
- **Day recording fact** — belongs only to one recording day/session.
- **Task-epoch setup assignment** — day-owned choice scoped to one or more task epochs;
  used when rooms, cameras, files/videos, DIO/opto protocols, or other setup context
  changes within the same recording day.
- **Day exported list** — exported from the day, with animal-level items serving only as
  templates/reference.

Do not use "configurable at the day level" without saying which of those patterns applies,
and do not use "day-level" when the user's real decision is scoped to one or more task epochs.
Those phrases are the root of the confusion.

## Attention and discoverability contract

Users do not experience the ownership matrix directly. They experience screen headings,
empty states, button labels, badges, summaries, tables, and confirmations. Therefore every
implementation task must prove the ownership model is visible where the user's attention
already is.

- **Put the cue next to the action.** A user should not need to read a separate doc,
  hover tooltip, schema path, or far-away help panel to know whether a control edits shared
  animal setup, a configuration version, a copied default, an override, a catalog
  selection, an epoch-specific setup assignment, or a day-only fact.
- **Use small, repeated ownership cues.** High-risk controls and summaries should use stable
  visible labels such as `Shared setup`, `Configuration vN`, `This day only`, `Using
  recording-system default`, `Different from current recording-system default`,
  `Overridden for this day` only when provenance exists, `Selected from animal catalog`,
  `Used in these epochs`, and `Exported with this day`.
- **Make the primary next action match the user's goal.** Empty states and blocked states
  must expose the setup or repair action the user is looking for: `Set Up Electrodes`,
  `Set Up Cameras`, `Use on this day`, `Override for this day`, `Reset to recording-system
  default`, `Pin version`, or `Hardware changed starting this day`.
- **Name the consequence before the save.** When a change can affect future days, a pinned
  configuration, shared animal setup, or exported day metadata, the UI must say what will
  change before or at the save/confirm action, not only after validation fails.
- **Do not rely on advanced/collapsed sections for required discovery.** Advanced panels may
  hide rarely edited numeric fields, but the screen must still show whether defaults exist,
  whether the current day uses or overrides them, and where to change them.
- **Empty and review states are teaching moments.** When a required setup object is absent,
  the UI should explain what it is for and route to the owner. When an imported/recovered
  object exists, the UI should say what was found and what to review.

## Dominant pattern: set once -> inherit per day -> override by exception

Most fields follow ONE shape, and the UX should be optimized for it rather than treating every
pattern as equally common. The user's mental model is: "I configure my rig and my animal once;
then each recording day I mostly just record what happened that day." Design to that:

- **Lead the Day Editor with genuine day facts and task-epoch setup** (session description,
  tasks/epochs, per-epoch room/camera/opto/file context, failed channels, header path) —
  the things that truly differ per day or within a day.
- **The task is the working unit when setup differs within a day; each epoch belongs to exactly one
  task.** The scientist's attention is often on "epoch 1 in room A with camera X" versus "epoch 2 in
  room B with camera Y" or "opto only during epoch 3". The model already represents this directly: a
  `tasks[]` row carries `task_environment` (the room), `camera_id` (an array — multiple cameras), and
  `task_epochs` (the epochs it covers), and the rules enforce that **each epoch number belongs to one
  and only one task** (`duplicate_task_epoch` is an export-blocking error, since Spyglass keys
  TaskEpoch by session+epoch). So "different room/camera per epoch" = separate task rows that
  partition the epochs; opto-per-epoch = `fs_gui_yamls[].epochs` (with its own `camera_id`/
  `dio_output_name`/power). Do not make room/camera/opto choices look day-wide when they are
  task-scoped, do NOT build a free-floating per-epoch editor, and do NOT let two tasks claim the same
  epoch. The UI's job is to make the task -> (room, cameras, epochs) mapping legible and to surface
  the one-epoch-one-task rule as a prevented error, not a mystery.
- **Render inherited setup as compact, read-only "effective value" summaries**, collapsed by
  default, so the common-case day editor stays short and low-cognitive-load (e.g.
  `Recording system: SpikeGadgets - 0.195 uV/bit - x1.5 - using setup defaults`).
- **Make override progressive disclosure, not a flat field.** If an override path is built, a
  secondary `Override for this day` reveals the editable control; once set it flips to a day-only
  state plus `Reset to setup default`. Use `Overridden for this day` only when explicit override
  provenance exists; otherwise use honest copy such as `Different from current recording-system
  default`. The reveal point is where you "name the consequence before the save". If an audit
  shows a field has no real day-to-day need, prefer NOT building a day override at all — show the
  effective value read-only with an `Edit in <setup owner>` link.
- **Define "overridden" honestly.** `day.technical` (and similar day records) currently store
  values, not per-field provenance. Without explicit provenance, the UI may say `Matches current
  recording-system default` or `Different from current recording-system default`, but it must not
  claim `Overridden for this day`. If this phase adds explicit override provenance, then and only
  then may the UI use `Overridden for this day` without retroactively relabelling old days when a
  setup default later changes (the same "safe to render vs safe to trust" trap Phase 8.6 fought).
- **Some inherited capabilities are OPTIONAL per day or epoch.** Notably optogenetics: an animal can have
  opto implanted yet run no stimulation on a given day, or only during selected epochs. "No opto this day"
  and "no opto for this epoch" are normal, valid states — never missing-setup warnings or blocking errors.
  Optional day/epoch capabilities must be friction-free to leave empty and only prompt for detail once the
  user indicates the capability was used.

## Expected ownership matrix

Task 0 owns the final artifact, but this is the starting contract:

| Field / concept | Primary owner | Day behavior | User danger to prevent |
| --- | --- | --- | --- |
| Subject identity (`subject_id`, species, sex, DOB) | Animal setup | Not edited per day | Editing a subject fact while thinking it only changes one session |
| Weight | Day recording fact | Edited per day; export the actual day value (there is no animal-level weight default) | Reusing a stale weight across sessions |
| Experiment/session description | Day recording fact | Edited per day | Confusing animal description with session description |
| Probe/electrode geometry | Configuration version | Day pins version | Rewriting historical geometry by editing latest setup |
| Ntrode/channel map | Configuration version | Day pins version | Same as geometry; wrong channel map is silent scientific corruption |
| Bad/failed channels | Day recording fact | Day override applied to pinned map | Marking a failed channel as if it applies to every day |
| Data-acq device identity (`name`, `system`, `amplifier`, `adc_circuit`) | Recording System setup (animal-wide unless Task 3 proves versioning is required) | Day inherits; no ad hoc day edit | Hiding recording-system changes in a generic hardware bucket |
| `raw_data_to_volts`, `times_period_multiplier` | Recording System setup (amplifier/clock constants) | Day shows the effective value, read-only by default; override is a rare advanced escape (or omitted) | Treating rig constants as per-day fields, or assuming editing the setup value rewrites already-created days |
| `default_header_file_path` | Day recording fact | Edited per day | Treating a recording file path as shared animal setup |
| Camera identity/calibration (`camera_name`, id, lens, model, `meters_per_pixel`) | Animal catalog -> task/video/FsGUI/epoch reference | Day-owned task/video/FsGUI rows select known camera(s); cameras can differ across epochs within one day | Reusing a camera name after zoom/calibration/lens changes, or assuming one day has only one camera setup |
| Tasks (incl. `task_environment` room + `camera_id`), epochs, files, videos | Day recording fact; the task carries room + cameras + its epoch set | Edited per day; setup can differ per epoch via separate task rows partitioning the epochs | Looking for recording files in shared setup; hiding within-day room/camera changes behind a day-wide field; or letting two tasks claim the same epoch (export-blocking `duplicate_task_epoch`) |
| Behavioral events / DIO | Must be made explicit in this phase | Either day exported list or animal catalog -> day selection | Editing animal reference events that never export, or duplicating day events unknowingly |
| Opto implanted/surgical setup (`optical_fiber`, `virus_injection`, `opto_excitation_source`, stimulation software) | Animal setup | Set once; not edited per day | Re-entering implant/virus facts per session, or treating them as a day protocol |
| Opto protocol actually run (`fs_gui_yamls`: protocol/power/epochs) | Task-epoch setup assignment + day exported list, OPTIONAL | Recorded for one or more task epochs; many days or epochs run no opto — an empty opto protocol is a normal, valid day | Forcing opto onto a non-opto day/epoch, or assuming an implanted animal stimulated every epoch |

## Tasks

This is a large phase; treat the tasks as sub-streams that can be implemented and merged
independently behind the gates, not one monolith. Suggested grouping and order: (A) ownership
vocabulary + screen map + IA + cues — Tasks 0, 0.5, 1, 2, 9, 10; (B) recording-system/technical source-of-truth —
Tasks 3, 4; (C) camera catalog + task-epoch legibility — Tasks 5, 7; (D) behavioral events — Task 6;
(E) lifecycle cleanup — Task 8; (F) tests/handoff — Task 11. Task 0 (matrix) and Task 0.5 (screen map) gate the rest, and the
Task 3 decision (data-acq ownership) should be settled early because it shapes B's UI. Each
sub-stream must land green on its own (full suite, lint, build, and byte-identical legacy
baselines; Task 5's optional day-used-camera export binding also needs its named baseline/export
audit).

- **Task 0 — create the ownership/default/override matrix artifact.** Add a short doc
  such as `workflow-ownership-matrix.md` covering every exported workspace section plus
  high-risk non-exported setup state. For each row include: primary owner, day behavior
  pattern, current state path, export source, edit surface, repair target, user-facing
  label, visible ownership cue, primary next action, dangerous misconception, where the
  user's attention will likely be, and test coverage. Reconcile contradictions rather than
  listing them indefinitely.

- **Task 0.5 — maintain the screen-to-user-job map.** Keep
  [workflow-screen-map.md](workflow-screen-map.md) current while implementing this phase.
  It is the product-level counterpart to the ownership matrix: for every top-level route,
  step, modal, empty state, repair path, and destructive confirmation, record the user job,
  likely attention target, primary action, next/return path, ownership cue, and dangerous
  mistake being prevented. If a field is technically owned correctly but appears on the
  wrong screen, under the wrong heading, or behind a misleading action label, treat that as
  a Phase 8.7 issue rather than a cosmetic nit. Reconcile current labels such as `Home`,
  `Animal Editor`, `Hardware Config`, `Devices`, and `Epochs` against the screen map's
  user-facing labels before Phase 9.

- **Task 1 — add a domain ownership descriptor.** Add a pure helper such as
  `src/domain/workflowOwnership.js` that maps field paths/section ids/issue codes to the
  ownership pattern, plain-language label, visible cue text, edit surface, day-behavior
  copy, and suggested primary action. Components should render these descriptors instead
  of inventing local explanations. Keep it small: this is a vocabulary/ownership helper,
  not a new schema engine. It lives in `src/domain/` and must not import from `pages/`
  (the architecture-boundary guard enforces this). For the issue-code mapping, do NOT spin
  up a third parallel `code -> meaning` table: reuse `workflowCategories.js`'s
  `CATEGORY_BY_CODE` / `SURFACE_BY_CODE`, and add a completeness test (mirroring the existing
  `CATEGORY_BY_CODE` <-> `SURFACE_BY_CODE` invariant test) so an ownership descriptor cannot
  drift from — or omit — a code the validators already produce.

- **Task 2 — fix Animal Editor information architecture.** Stop presenting cameras, data
  acquisition, and behavioral events as one vague "Hardware & Behavioral Events" bucket.
  Use labels that match the ownership matrix, for example:
  `Electrodes & Ephys`, `Recording System`, `Video Cameras & Calibration`,
  `Behavioral Events / DIO`, and `Optogenetics`. Data acquisition belongs with the
  recording/ephys system, not with cameras. Update stepper labels, page headings,
  section headings, aria labels, and primary buttons together so the user does not see
  old "hardware" language in the places they scan first. Match the route/step labels and
  next actions in `workflow-screen-map.md`; implementation component names may stay stable,
  but user-facing navigation should read as `Animal Setup` / shared setup, not a detached
  schema editor. Cameras must visibly show the
  identity fields that make a camera different, including `lens` and `meters_per_pixel`,
  in tables/summaries as well as the edit modal.

- **Task 3 — implement the decided recording-system ownership.** Audit the current
  `data_acq_device` source of truth against `configurationHistory`, `animal.devices`,
  `mergeDayMetadata`, and existing reconfiguration behavior, then implement the decided
  option-B UI contract below. Because the app cannot currently represent mid-study data-acq
  hardware changes, the UI must not imply that a day-level edit is available.

  DECISION (from the brainstorm): option B (animal-wide/shared recording-system identity + a
  visible blast-radius notice that editing it affects ALL days + an explicit "currently
  unsupported" notice for a mid-study amplifier swap). Data-acq has no per-day binding, so the
  append-only identity model cannot keep "past days kept the old amplifier" without versioning;
  option B honors the no-silent-retroactive principle while staying UI-only and byte-identical.
  Option A (a versioned data-acq source pinned per day) is the only way to represent a mid-study
  swap directly; it changes `mergeDayMetadata` resolution, can change export bytes, and needs
  golden-baseline regeneration plus trodes_to_nwb coordination — scoped as its own future phase,
  not here.

  The Recording System owner also holds `raw_data_to_volts` and `times_period_multiplier` — amplifier
  and clock constants that normally do not change day to day. In the current state model these are
  **defaults for new days** copied into `day.technical` at creation; export still reads
  `day.technical.*`. Editing the Recording System default therefore must not silently rewrite existing
  days. Existing days show their copied effective value; if the value differs from the current default,
  label it as `Different from current recording-system default` (or equivalent), not as inherited. Any
  "apply current default to existing days" action must enumerate the affected days before commit.

- **Task 4 — make day technical values read as effective recording-system values.** In
  the Day Editor technical section, show the effective `raw_data_to_volts` and
  `times_period_multiplier` values for this day. These are rig constants, so in the normal
  case they should read as `Using recording-system default` only when the copied day value still
  matches the current default; otherwise they should read as a day-owned copied value that differs
  from the current default. These fields must not look like routine day edits. The day-level override
  is for a rare exception and is OPTIONAL to
  build: if the Task 3 audit shows no real day-to-day need, show the values read-only with
  an `Edit in Recording System` link instead of a day override. If an override IS offered,
  use progressive disclosure — a secondary `Override for this day` reveals the control, and
  once set it shows a day-only state plus a safe `Reset to recording-system default`. Use
  `Overridden for this day` only if explicit override provenance is stored; otherwise use copy
  such as `Different from current recording-system default`. Do not show only
  `default_header_file_path` / `units` while implying day-specific numeric values exist.
  `default_header_file_path` must read as day-only, not animal setup.

- **Task 5 — clarify camera catalog vs task-epoch/day usage.** Anywhere a task/video/FsGUI/day
  refers to a camera, say that the day-owned task/video/FsGUI/epoch row is selecting from the
  animal camera catalog. The camera editor must explain at the moment of edit that a different
  zoom/calibration/lens/model/id is a different camera identity.

  First resolve the export-binding mismatch: current `mergeDayMetadata` exports the whole
  `animal.cameras` catalog for every day, so adding a new camera for a future recording changes
  a re-export of old days by adding an unused camera device. Approach A's "past days keep what
  they used" promise is true only if export emits the day-used camera subset. Preferred fix:
  add a pure helper such as `resolveDayCameraUsage(animal, day)` that scans `tasks[].camera_id`,
  `associated_video_files[].camera_id`, and `fs_gui_yamls[].camera_id`, returns referenced camera
  ids plus affected day ids, and is used by both export/preflight and blast-radius UI. Update the
  source-of-truth docs/tests accordingly and run a baseline/export audit. If Phase 8.7 deliberately
  keeps the baseline-safe all-animal-cameras export, the UI must say camera catalog changes affect
  all day exports and must not promise old-day exports are unchanged.

  Apply the approach-A immutable-once-referenced rule after that decision: once any day references
  a camera, recalibrating/changing its identity is a NEW camera by default, not a silent edit of
  the live values. A genuine correction to a referenced camera is the rare explicit "apply to the
  N days using this camera" action that enumerates the affected days; an unreferenced camera is
  freely editable. Existing camera tables/summaries must show enough identity detail that users
  can tell cameras apart without opening every row.
  Task/video/FsGUI camera empty states must offer `Set Up Cameras` and explain that cameras are
  shared animal catalog entries selected by recording-day tasks, videos, and opto/FsGUI protocols.
  Make within-day setup differences legible at the TASK level (no source-of-truth gap exists): a
  `tasks[]` row carries `task_environment` (room), `camera_id` (array), and `task_epochs`, and each
  epoch belongs to exactly one task, so "different rooms/cameras across epochs" is expressed as
  separate task rows partitioning the epochs. The UI must show the task -> (room, cameras, epochs)
  mapping (e.g. per task: "Room A · cameras 1,2 · epochs 1,3"), and must surface the
  `duplicate_task_epoch` rule as a prevented error (two tasks cannot share an epoch) rather than
  letting the user create a silent collision. Do not build a free-floating per-epoch camera editor;
  edit cameras/room on the task.

- **Task 6 — resolve behavioral-events ownership in the UI.** The docs currently say the
  exported source is day-level while animal-level events are reference/template data. Make
  the UI match that decision exactly. If animal-level behavioral events remain editable,
  label them as a reusable library/template and provide a day-level `Use on this day`
  action that copies/selects a reference event into the exported day-specific list. The
  exported day list must stay visible after the action. If there is no real use path,
  remove or hide the animal-level editor before Phase 9 so users cannot edit a
  non-exported object and think they are done.

- **Task 7 — separate opto implanted setup from per-day protocol (and allow opto-free days).**
  Opto is already split in the data model: the implanted/surgical/source/software setup
  (`optical_fiber`, `virus_injection`, `opto_excitation_source`, stimulation software) is read from
  `animal.optogenetics`, while the protocol actually run (`fs_gui_yamls`) is read from the day and
  scoped to selected task epochs. Make the UI match that split: edit the implanted setup ONCE in
  the Animal Editor Optogenetics step (animal setup); edit the protocol run in the recording day's
  task/epoch flow as an epoch-scoped exported list. Critically, opto on a day or epoch is OPTIONAL —
  an animal can have opto implanted yet run no stimulation on a given day, or only during a subset
  of that day's epochs. An empty day opto protocol must be a normal, valid state, never surfaced as
  missing setup or a blocking error; make "no opto this day" and "no opto for this epoch" friction-free
  explicit states and only prompt for protocol detail once the user indicates opto was run. Respect
  the existing animal-level all-or-nothing opto
  completeness contract (if any opto setup is present, all required opto setup sections must be
  present) — that is an animal-SETUP rule, not a per-day requirement, and must not force opto onto a
  day or epoch. This is the cleanest existing example of the set-once-record-per-epoch pattern; use
  it as the model the other surfaces follow.

- **Task 8 — add discoverable lifecycle cleanup actions.** The store already exposes
  `deleteAnimal` and `deleteDay`, but ordinary users cannot discover safe animal/day
  deletion from the Workspace. Add secondary/overflow lifecycle actions where users
  naturally look for cleanup: an animal-level `Delete animal...` action near selected
  animal management, and a recording-day `Delete recording day...` action on each ordinary
  day row or day action menu. These must be visually secondary/destructive, never adjacent
  to the primary setup/export action. Confirmations must name the animal/day, date/session,
  cascade count, and consequence: deleting an animal removes that animal and its owned
  recording days from this workspace; deleting a day removes it from this workspace and
  export lists. If a day/animal has `validated` or `exported` state, the confirmation must
  say deleting local workspace metadata does not delete any previously downloaded YAML,
  NWB file, DANDI asset, or Spyglass rows. Deleting an animal must preserve wrong-owner
  day records, matching the existing store guard. Do not introduce "archive" language
  unless an archive/restore model is actually implemented.

- **Task 9 — align repair actions and validation grouping with ownership.** Validation and
  Export issue groups should continue using Phase 8.6 workflow categories, but issue copy
  should additionally name the ownership pattern when it prevents mistakes: "Fix shared
  animal setup", "Select the camera used on this day", "Override this day's technical
  value", "Pin this day to the correct configuration", or "Repair recovered data".
  Repair routing still goes through canonical domain repair targets.

- **Task 10 — update workflow/status/preflight summaries.** The Animal Workspace checklist,
  Day Devices version bar, Day Technical section, Validation summary, batch export
  preflight, and single-day Export preflight must all agree on ownership language. A user
  should be able to answer: what is shared, what belongs only to this day, what version is
  pinned, what was selected from a catalog, which setup each task epoch used, whether the
  day is using recording-system defaults or an override, whether opto was run for this
  day/epoch, and what will be exported. Cross-check every changed route/step/modal against
  `workflow-screen-map.md`: visible heading, primary action, next/return action, and repair
  target must match the user job for that screen.

- **Task 11 — tests, QA notes, and Phase 9 handoff.** Add focused unit/component tests for
  the ownership descriptor, Animal Editor section labels, day technical default/review/
  advanced-override state, camera identity summaries and task/video camera empty states,
  behavioral-event `Use on this day`, multi-epoch days with different rooms/cameras, opto
  setup-vs-protocol split plus opto-free days/epochs, lifecycle delete confirmations, and
  preflight ownership wording. Add or update scenario artifacts proving the screen map:
  same-day path, catch-up path, setup repair path, reconfiguration path, and destructive
  cleanup path. Update `docs/REFACTOR_CHANGELOG.md` or a linked QA note with the ownership
  matrix, screen map, unresolved ownership decisions, and the exact Phase 9 browser
  scenarios to sample.

## Deliberately not in this phase

- A broad visual redesign or design-system rebuild.
- A reducer/store rewrite.
- Changing legacy-form behavior.
- Adding new scientific device types.
- Changing export bytes for already-valid sessions except a deliberate, reviewed day-used-camera
  export-binding fix from Task 5. Versioned data-acq remains out of scope.
- Human usability testing. Phase 10/11 can recommend it, but this phase must be executable
  by Claude Code with code inspection, tests, and browser-ready route states.

## Validation slice

| Test / artifact | Asserts |
| --- | --- |
| `workflow-ownership-matrix.md` *(artifact)* | every exported workspace section has owner, day behavior, state path, export source, edit surface, repair target, misconception, and test coverage. |
| `workflow-screen-map.md` *(artifact)* | every top-level route, major step, modal/confirmation, empty state, and repair path has a user job, likely attention target, primary action, next/return action, ownership cue, and mistake-prevention responsibility; current labels are reconciled with target user-facing labels before Phase 9. |
| `workflowOwnership helper` *(unit)* | high-risk field paths/issue codes map to one ownership pattern and stable user-facing labels/actions; a completeness test cross-checks issue-code coverage against `CATEGORY_BY_CODE`/`SURFACE_BY_CODE` so no validator code is left unowned. |
| `camera usage / affected-days helper` *(unit)* | a pure helper scans task, associated-video, and FsGUI camera references; export/preflight and blast-radius UI consume the same result; scalar/array camera refs, duplicate refs, missing refs, and unreferenced catalog cameras are covered. |
| `Animal Editor IA labels` *(component)* | cameras, recording system/data-acq, behavioral events, opto, and electrodes are separate enough that data-acq is not hidden in a camera-like hardware bucket. |
| `ownership cues at point of action` *(component)* | shared setup, configuration version, day-only, task-epoch setup assignment, using-recording-system-default, provenance-backed override/different-from-current-default, catalog-selection, and exported-with-this-day cues appear near the relevant controls/actions, not only in docs. |
| `blast-radius transparency / no silent retroactive` *(component)* | a change reaching past days enumerates them before commit; editing a referenced camera defaults to a NEW identity and either past-day exports are unchanged through day-used camera export or the all-animal-cameras fallback warns all days are affected; editing a constant animal fact (species/DOB) shows it affects all N days; editing data-acq shows it affects all days and a mid-study swap shows the unsupported notice; no edit path silently rewrites an already-recorded day. |
| `day technical defaults vs overrides` *(component/unit)* | effective day values are visible; copied day values read as using the current default only when equal; values that differ from the current default are labelled honestly; advanced overrides are distinguishable; reset/apply-to-existing-days behavior enumerates affected days; header path remains day-only. |
| `camera catalog identity` *(component/export/unit)* | camera tables/modals/summaries show name/id/lens/`meters_per_pixel`; changed zoom/calibration guidance says to create/use a different camera name; task/video/FsGUI empty states route to `Set Up Cameras`; camera export binding is either day-used subset with baseline audit or explicit all-day blast-radius fallback; a multi-epoch day with different cameras/rooms makes the per-task room/camera/epoch mapping visible, and two tasks claiming the same epoch surfaces the export-blocking `duplicate_task_epoch` error. |
| `behavioral event ownership` *(component/integration)* | animal-level event editing cannot be mistaken for exported day events; `Use on this day` makes an inherited/reference event appear in the exported day-specific list. |
| `opto ownership` *(component/integration)* | implanted/surgical opto setup (`optical_fiber`/`virus_injection`/`opto_excitation_source`/software) reads as animal setup; protocol rows (`fs_gui_yamls`) are day-owned but scoped to selected task epochs and OPTIONAL — a day or epoch with no opto protocol is valid and raises no missing-setup/blocking error; the animal-level all-or-nothing opto contract is not applied per day/epoch. |
| `lifecycle cleanup actions` *(component/unit)* | animal/day delete actions are discoverable but secondary; confirmations name the animal/day, cascade count, exported/validated consequence, and call the existing guarded `deleteAnimal` / `deleteDay` actions. |
| `repair/preflight ownership wording` *(component)* | Validation, batch preflight, and Export preflight distinguish shared setup, configuration version, catalog selection, task-epoch setup assignment, day override, and day-only facts. |
| `scenario artifacts` *(component/Playwright-ready)* | new user finds electrodes; user changes camera zoom and is steered to a new name; user creates a multi-epoch day with different rooms/cameras and can see the setup used by each epoch; user reviews effective recording-system values and either edits them in Recording System or uses an advanced one-day override only when that path exists; user uses an animal DIO event on a day; an opto-implanted animal records a day with no stimulation and another day with opto only on selected epochs without hitting false opto errors; user with existing days sees what shared-setup edits affect; user can clean up a test animal/day through safe destructive controls. |
| `same-day and catch-up story artifacts` *(component/Playwright-ready)* | same-day conversion shows one fresh recording moving efficiently from day review to export without repeated setup entry; catch-up conversion shows multiple days with readiness, shared-setup review, targeted repair, batch eligibility, and naming-identity risks visible before export. |
| `golden baselines` *(regression)* | the 4 golden fixtures stay byte-identical unless Task 5 deliberately implements day-used camera export and the audited fixture set proves/updates the expected bytes; versioned data-acq remains a future named exception with regenerated fixtures and trodes_to_nwb coordination. |
| `npm test`, `npm run lint`, `npm run build` | full gates pass before Phase 9; Phase 9 scenarios are updated to cover ownership/default/override UX. |

## Review

`pr-review-toolkit:code-reviewer`; `ux-reviewer`; `pr-review-toolkit:silent-failure-hunter`;
`pr-review-toolkit:pr-test-analyzer`.

Confirm: no screen asks the user to infer source of truth from implementation structure; data-acq is not
grouped with cameras merely because both are animal-level; changed camera calibration/zoom is visibly a
new identity; within-day setup differences are represented at task-epoch scope rather than flattened into
a day-wide camera/opto/room choice; day technical values read as effective recording-system values with an
advanced override path rather than routine day-by-day edits; behavioral events cannot be edited in a
non-exported place by accident; opto implanted setup and per-epoch protocol are clearly separate and
opto-free days/epochs are valid, friction-free states (no forced opto, no false missing-setup error);
animal/day cleanup is discoverable without making
destructive actions primary; every route/step/modal in `workflow-screen-map.md` has a coherent heading,
primary action, next/return action, and repair destination; the user's likely attention path has been checked for each high-risk screen; and
Phase 9 can test the integrated browser flow with stable labels instead of reverse-engineering the app model.
