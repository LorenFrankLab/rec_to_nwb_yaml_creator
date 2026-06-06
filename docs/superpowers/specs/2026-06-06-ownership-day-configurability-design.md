# Design — Ownership, defaults, and day configurability (rec_to_nwb_yaml_creator, modern)

Date: 2026-06-06
Status: validated design (brainstorm output), feeds Phase 8.7
Related: [.claude/docs/plans/pre-cutover-export-correctness/phase-8-7-ownership-defaults-day-configurability.md](../../../.claude/docs/plans/pre-cutover-export-correctness/phase-8-7-ownership-defaults-day-configurability.md),
[.claude/docs/plans/pre-cutover-export-correctness/workflow-screen-map.md](../../../.claude/docs/plans/pre-cutover-export-correctness/workflow-screen-map.md)

## Purpose

The modern workspace is the bridge between "we recorded this session" and "the
NWB/Spyglass/DANDI metadata is correct enough to trust." It exists to do three things, in
priority order when they conflict:

1. **Prevent mistakes** before they become silent converter / Spyglass / DANDI / scientific
   identity errors.
2. **Let the scientist work efficiently**, whether they export right after a recording or
   catch up on several days at once.
3. **Enforce consistent naming and identities** so the resulting NWB data joins and queries
   cleanly downstream.

These three are mostly aligned in this tool: set-up-once-and-inherit gives efficiency *and*
consistency *and* fewer mistakes. The design below is the smallest set of rules that keeps
them aligned.

## User and cadences

The operator varies by lab (recording scientist or a lab tech/data manager), so **both
cadences are first-class**:

- **Same-day conversion** — finish a recording, create/review that day, confirm what happened
  per task epoch, fix obvious gaps, export one YAML. Optimize: no repeated setup entry,
  inherited setup easy to verify, the next required action always obvious.
- **Catch-up / batch conversion** — several recorded days waiting. Optimize: scan which days
  are ready, which share setup, which changed hardware/calibration, which task epochs used
  different rooms/cameras/opto, which names would collide; support review, comparison, batch
  validate/export, and targeted repair without forcing every day through a long form when
  only a few facts differ.

The user's attention is on the experiment narrative — animal, recording day, task epoch,
room, cameras/videos, opto/DIO, files, failed channels, export readiness — not on the schema
or the state shape. The screen must translate the stored structure into the user's question:
"What did we record, what setup was used, what names will this create, and is it safe to
export?"

## Core principle: blast-radius transparency + no silent retroactive change

The single user-facing promise:

> **Any change that reaches beyond the day in front of you names exactly which days it
> affects, before you commit — and no change silently rewrites days you already recorded.**

This subsumes the internal ownership vocabulary (animal setup / configuration version /
setup-default→day-value / catalog→day reference / day fact / task-epoch assignment / day
exported list). Users experience two things instead of seven: "this is a today-only edit" or
"heads up — this touches these N days," with the affected days enumerated.

Rationale: silent retroactive change is the worst failure mode because the user will not
notice it (the same "safe to render vs safe to trust" lesson as Phase 8.6). Making blast
radius explicit serves all three goals at once — it prevents the silent mistake (#1), keeps
the common case visibly local and fast (#2), and the blast-radius prompt is exactly where we
steer naming consistency (#3: "recalibrated? that's a new camera, not an edit to this one").

## The identity model (how "no silent retroactive" is delivered)

Every field is one of three kinds:

1. **Physical-configuration identity** — electrode geometry, channel maps, camera
   calibration/lens/zoom/model, recording system/amplifier. Represents *a physical thing that
   was true for a span of recordings*. **Append-only: a physical change is a NEW
   identity/version, never a silent edit of the old one.** Already-recorded days keep what
   they actually recorded.
2. **Truly-constant animal fact** — `subject_id`, species, sex, DOB, genotype, and subject
   description. The same for the animal's whole life; a change is a *correction* that
   legitimately applies to every day — but must still announce its blast radius ("this
   affects all N recording days").
3. **Per-day fact** — session description, tasks/epochs, room (`task_environment`), failed
   channels, `default_header_file_path`, weight, opto protocol run. Local; no propagation
   question.

Touching already-recorded days is never automatic; it is only ever an explicit, blast-radius-
named action ("apply to these N days"), reusing the existing reconfiguration-wizard shape.

### Implementation: approach A — immutable-once-referenced catalog, with explicit export binding

Catalogs stay animal-level. Once any day references a physical-configuration identity, its
identity fields become **append-only**: the UI offers "this is a new camera / recording
system (recalibrated / swapped)" instead of letting the user mutate the live values. A
genuine typo-fix on a referenced identity is the rare explicit "correct the N days using
this" path.

For cameras, this approach is only true if the exported session resolves `cameras` from
the day-owned references (`tasks[].camera_id`, `associated_video_files[].camera_id`,
`fs_gui_yamls[].camera_id`) rather than blindly exporting the entire animal catalog. The
current exporter emits all `animal.cameras` for every day, so merely adding camera 1 for a
future day would change a re-export of an old day by adding an unused camera device. Phase
8.7 must therefore either:

- implement the day-used camera export binding (preferred UX; past days keep their exported
  camera set by construction), with a deliberate baseline/export audit; or
- keep the current all-animal-cameras export as an explicit baseline-safe fallback, in which
  case adding/editing cameras after recorded days is a blast-radius action that affects all
  day exports and the UI must not promise historical exports are unchanged.

The heavier alternative (per-day freeze / version cameras + data-acq like electrodes) is
deferred to its own phase — it changes export resolution and needs baseline regeneration plus
trodes_to_nwb coordination.

### Cameras vs data-acq are NOT symmetric (key constraint)

- **Cameras can do approach A cleanly only with day-used export binding.** Tasks/videos/FsGUI
  reference a camera by `camera_id`, so a past day can keep pointing at camera 0 while a
  recalibration becomes camera 1; past exports are unchanged automatically only when export
  emits the cameras referenced by that day. Without that binding, camera catalog changes have
  all-day blast radius.
- **Data-acq cannot, today** — `data_acq_device` has *no per-day binding*; it is a single
  animal-level record merged into every day. So "past days keep the old amplifier" is not
  representable. For data-acq, approach A degrades to the *principle only*: it is a single
  shared recording-system identity; editing it visibly affects **all** days (blast-radius
  warning), and a genuine **mid-study amplifier swap is surfaced as currently unsupported**
  (its own future versioning phase). This is exactly Phase 8.7 Task 3 **option B**, so the
  model and Task 3 now agree. `raw_data_to_volts` / `times_period_multiplier` (rig constants,
  moved under Recording System) are recording-system defaults copied into each day at creation:
  editing the default affects future days only unless the user explicitly applies the change to
  named existing days. Existing days show their copied effective value, and if it differs from
  the current default the UI says that plainly rather than pretending the value is still
  inherited.

## Within-day setup is task-scoped (not free-floating per epoch)

Setup that differs within a day is carried by the **task**: a `tasks[]` row holds
`task_environment` (room), `camera_id` (array — multiple cameras), and `task_epochs`. **Each
epoch belongs to exactly one task** — the rules enforce this (`duplicate_task_epoch` is an
export-blocking error, since Spyglass keys TaskEpoch by session+epoch). So "epoch 1 in room A
with camera X, epoch 2 in room B with camera Y" = two task rows partitioning the epochs;
opto-per-epoch = `fs_gui_yamls[].epochs`. The UI makes the task → (room, cameras, epochs)
mapping legible and surfaces the one-epoch-one-task rule as a prevented error; it does NOT
build a free-floating per-epoch editor.

## Optional capabilities

Some inherited capabilities are optional per day or epoch — notably optogenetics. An animal
can have opto implanted yet run no stimulation on a given day, or only during some epochs.
"No opto this day / this epoch" is a normal, valid state, never a missing-setup warning or a
blocking error. Optional capabilities are friction-free to leave empty and only prompt for
detail once the user indicates the capability was used.

## How this maps to the surfaces

The screen-level source of truth is
[workflow-screen-map.md](../../../.claude/docs/plans/pre-cutover-export-correctness/workflow-screen-map.md).
This section is the conceptual summary; the screen map is the artifact Phase 8.7/9 use to
verify routes, step labels, modals, empty states, repair paths, and destructive confirmations.

- **Animal Setup / Animal Editor** — owns physical-configuration identities and constant
  animal facts. Information architecture separates Animal Profile / Subject, Electrodes &
  Ephys, Recording System (data-acq + rig constants), Video Cameras & Calibration,
  Behavioral Events / DIO, Optogenetics (implanted setup). Home remains the creation surface,
  but it must not be the only discoverable place to correct shared animal profile facts.
  Editing a referenced identity routes to "new identity" by default.
- **Day Editor** — leads with day facts and task-epoch setup; inherited setup shown as
  compact read-only effective-value summaries (collapsed), with progressive-disclosure
  override by exception. Weight is a recording-day value for export: a current/old
  animal-level weight may seed or fall back, but the day must make the exported session
  weight visible and confirmable. Reconfiguration / "apply to these days" is the only path
  that reaches other days, and it names them.
- **Animal Workspace** — the batch triage surface: which days are ready, which share setup,
  which differ, recovery/wrong-owner states (from Phase 8.6), and discoverable lifecycle
  cleanup (delete animal/day) as secondary destructive actions. Catch-up rows must expose
  date/session, animal when relevant, configuration version, camera/calibration summary,
  opto state, validation/recovery state, export eligibility, and next repair/export action.
- **Validation / Export preflight** — issue copy names the ownership pattern when it prevents
  a mistake; batch and single-day paths agree on language and on the recovery/export policy
  from Phase 8.6.

## Data flow and state implications

- No reducer/store rewrite. Cameras stay an animal catalog referenced by `camera_id`, but the
  implementation must define the export binding explicitly (preferred: export the day-used
  camera subset; fallback: all-animal-cameras with an all-day blast-radius warning). Electrodes
  stay versioned snapshots pinned by day; recording-system technical defaults stay copied-at-creation.
  Weight is resolved as a day/session value for export, with any animal-created value treated as
  an initial/default/fallback that should be confirmed in the Day Editor.
- New behavior is guards + flows + a reusable blast-radius dialog, plus a pure domain
  ownership descriptor (`src/domain/workflowOwnership.js`) that maps field paths / section
  ids / issue codes to ownership pattern + label + cue + edit surface + primary action.
- The descriptor reuses `workflowCategories.js`'s `CATEGORY_BY_CODE` / `SURFACE_BY_CODE` and
  is guarded by a completeness test so no validator code is left unowned. It lives in
  `src/domain/` and does not import from `pages/` (architecture-boundary guard).
- Export bytes for already-valid days are unchanged except for a deliberate, reviewed
  day-used-camera export binding if Phase 8.7 chooses the preferred camera fix. Any such change
  must be covered by a baseline/export audit. Per-day freeze / versioned data-acq is explicitly
  out of scope.

## Error handling and mistake prevention

- Editing a referenced physical identity → "new identity" by default; the rare correction is
  an explicit "apply to these N days" action that enumerates the days.
- Camera reference detection uses a pure affected-days helper that scans task, video, and
  FsGUI camera references; the blast-radius dialog and export binding use the same helper so
  they cannot disagree.
- Editing a constant animal fact (species/DOB) → blast-radius notice ("affects all N days").
- Two tasks claiming one epoch → prevented/surfaced `duplicate_task_epoch` (export-blocking).
- Opto-free day/epoch → valid, no error.
- Naming: any field that becomes a downstream identity/join key is presented as such at the
  edit point; reuse feels safe only when the dependent metadata is identical; changed
  calibration/lens/model/data-acq identity/task description steers to a distinct name before
  export.

## Testing

- `workflowOwnership` unit + completeness cross-check against `CATEGORY_BY_CODE` /
  `SURFACE_BY_CODE`.
- Component: ownership cues at the point of action; blast-radius dialog enumerates affected
  days; "new camera identity" on recalibration; Animal Editor IA labels; day technical
  effective-value/override; multi-epoch day with per-task room/camera mapping; opto setup-vs-
  protocol split and opto-free day/epoch; lifecycle delete confirmations.
- Regression: golden baselines byte-identical unless the preferred day-used-camera export
  binding deliberately changes a covered new-path fixture; architecture guard green; full
  suite + lint + build.
- Playwright-ready scenario artifacts for both cadences (same-day single export; batch triage
  + validate/export; recalibration→new camera; mid-study amplifier swap shows unsupported
  notice; opto-free day).

## Alternatives considered

- **Preferred: animal camera catalog + day-used camera export subset.** Users define reusable
  camera identities once, day/task/video/FsGUI rows choose what was used, and export includes
  only the cameras referenced by that day. This best matches the scientist's mental model and
  the no-silent-retroactive promise. Cost: deliberate export-resolution change and baseline
  audit.
- **Baseline-safe fallback: animal camera catalog exported wholesale.** Minimal implementation
  and byte-stable for existing baselines, but adding a future camera changes old-day re-exports.
  If chosen, the UI must show an all-day blast-radius warning and cannot say past exports are
  unchanged.
- **Versioned camera snapshots pinned by day.** Strong historical model, like electrodes. Cost:
  heavier state, reconfiguration UI, export-resolution changes, and more concepts for the user.
- **Per-day frozen camera copies.** Simple historical export, but duplicates data, makes naming
  consistency harder, and creates drift between the animal setup catalog and day records.
- **Full rig/setup profiles pinned to day or epoch.** Potentially elegant for future rooms,
  cameras, data-acq, opto, and task setup bundles. Too large for Phase 8.7; should wait until
  the simpler catalog/version/day-fact model has been browser-tested.

## Scope and sequencing

Large phase; implement as independently-mergeable sub-streams behind the gates (each lands
green on its own): (A) ownership vocabulary + screen map + IA + cues; (B) recording-system /
technical source-of-truth (data-acq = option B); (C) camera catalog + task-epoch legibility +
approach-A immutable-once-referenced cameras; (D) behavioral events; (E) lifecycle cleanup;
(F) tests/handoff. Task 0 (matrix) and the screen map gate the rest; the data-acq decision
(now settled = option B) shapes B.

## Deliberately not in this phase

- Per-day freeze / versioned snapshots for cameras + data-acq (own phase; export-affecting).
- Reducer/store rewrite; legacy-form changes; new device types.
- Changing export bytes for already-valid sessions.
- Human usability testing (later phase may recommend).

## Open questions / future

- Versioned data-acq (the heavier "approach B" for the recording system) — its own phase if a
  mid-study amplifier swap must be representable per-day rather than flagged unsupported.
- Whether batch triage needs a richer comparison/diff view beyond the required row scan
  contract (date/session, config version, cameras/calibration, opto, validation/recovery,
  export eligibility, next action). Revisit after 8.7 browser QA.
