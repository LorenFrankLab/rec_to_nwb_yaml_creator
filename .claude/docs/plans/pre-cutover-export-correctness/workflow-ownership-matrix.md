# Workflow ownership matrix

[<- back to PLAN.md](PLAN.md) · [ownership/defaults phase](phase-8-7-ownership-defaults-day-configurability.md) · [design spec](../../../../docs/superpowers/specs/2026-06-06-ownership-day-configurability-design.md) · [screen map](workflow-screen-map.md) · [shared contracts](shared-contracts.md#user-mental-model-contract)

Date: 2026-06-06 · Status: Phase 8.7 Task 0 artifact (foundation sub-stream A)

This is the field-level source of truth for Phase 8.7. For every exported workspace section
(plus the high-risk non-exported setup state) it pins one ownership pattern, the day behavior,
the state path, the export source, the edit surface, the repair target, the user-facing label,
the visible ownership cue, the primary next action, the dangerous misconception to prevent,
where the user's attention will likely be, and the test coverage. The screen-level counterpart
is [workflow-screen-map.md](workflow-screen-map.md); the machine-readable counterpart is
[`src/domain/workflowOwnership.js`](../../../../src/domain/workflowOwnership.js).

When this matrix and a surface disagree, this matrix wins for *ownership semantics* and the
screen map wins for *where it appears*; reconcile rather than fork.

## Internal vocabulary vs. what the user sees

The seven ownership patterns are **internal vocabulary**. The user experiences only two
things, per the headline promise (**blast-radius transparency + no silent retroactive change**):

- **"Today-only edit"** — the change stays on the day in front of them.
- **"Heads up — this touches these N days"** — the change reaches past/other days, and those
  days are **enumerated before commit**. Nothing silently rewrites an already-recorded day.

The patterns below decide *which* of those two the user sees, *what cue* sits next to the
control, and *what the safe next action is*. They are risk-tiered: the strongest ownership
language belongs at high-risk decisions, summaries, repair destinations, blast-radius
confirmations, and Export/preflight — not on every ordinary field.

## The seven ownership patterns (internal)

| Pattern (id) | One-line meaning | Default cue | Day behavior the user sees |
| --- | --- | --- | --- |
| `animal_setup` | Defined once for the animal unless explicitly reconfigured | `Shared setup` | Touches **all** N recording days when corrected (blast radius announced) |
| `configuration_version` | A physical setup snapshot pinned by each recording day (append-only) | `Configuration vN` | Past days keep the version they recorded; a physical change is a **new** version |
| `setup_default_to_day` | Default lives in shared/recording-system setup; export reads the **day** value copied at creation or overridden | `Using recording-system default` / `Different from current recording-system default` | Editing the default affects **future** days only unless explicitly applied to named existing days |
| `animal_catalog_reference` | Reusable animal-level item; a day/task/epoch row chooses which item was used | `Selected from animal catalog` | Past days keep the item they referenced; recalibration = a **new** catalog item |
| `day_fact` | Belongs only to one recording day/session | `This day only` | Today-only edit; no propagation |
| `task_epoch_assignment` | Day-owned choice scoped to one or more task epochs | `Used in these epochs` | Today-only edit, scoped to the epochs the task covers |
| `day_exported_list` | Exported from the day; animal-level items are templates/reference only | `Exported with this day` | Today-only list; the animal library is not itself exported |

A repair-only pseudo-pattern, `recovered_data` (cue `Needs review`, action `Repair recovered
data`), is **not** an ownership pattern — it is the state of imported/corrupt data that must be
cleaned up before it is trusted. It exists so every validator issue code resolves to a
descriptor (the completeness invariant in `workflowOwnership.js`); see
[Issue-code ownership](#issue-code-ownership-derived-not-re-tabled).

## Field / section ownership matrix

State paths use the workspace shape in [`src/state/workspaceTypes.js`](../../../../src/state/workspaceTypes.js):
`animal.subject`, `animal.cameras`, `animal.devices.data_acq_device`, `animal.technicalDefaults`,
`animal.optogenetics`, `animal.configurationHistory`; `day.session`, `day.tasks`,
`day.behavioral_events`, `day.associated_video_files`, `day.fs_gui_yamls`, `day.technical`,
`day.configurationVersion`, `day.deviceOverrides`. The export source is the day metadata produced by
`mergeDayMetadata` ([`src/state/workspaceUtils.js`](../../../../src/state/workspaceUtils.js)) unless noted.

### Subject / animal-constant facts

| Field / concept | Pattern | Day behavior | State path | Export source | Edit surface | Repair target | User label | Ownership cue | Primary next action | Misconception to prevent | Attention target | Test coverage |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `subject_id` | `animal_setup` (constant identity) | Not edited per day; a correction announces it affects **all N days** | `animal.subject.subject_id` | merge → top-level `subject_id` | Animal Setup → Animal Profile (read-only identity; recreate to change) | `repairTargetForIssue` → `none` (slash) / `animal` | Animal Profile / Subject | `Shared setup` | Fix shared animal setup | Editing a subject fact thinking it changes one session | Animal Profile; Day Overview inline repair | `workflowOwnership` unit; Animal Editor IA labels; animal-profile component |
| species, sex, DOB, genotype, subject description | `animal_setup` (constant fact) | Correction propagates; **blast radius announced** ("affects all N days") | `animal.subject.{species,sex,date_of_birth,genotype,description}` | merge → top-level subject fields | Animal Setup → Animal Profile; Day Overview inline repair (must name shared scope) | `animal` (species: `invalid_species`); DOB schema → `day`/overview | Animal Profile | `Shared setup` | Fix shared animal setup | Thinking a Day Overview subject edit is day-local | Animal Profile; Day Overview | `invalid_species` ownership; blast-radius component; DOB format test |
| Weight | `day_fact` (animal value is fallback only) | Day Overview is the primary review/edit surface for the **exported session weight**; animal value is a labelled initial/fallback to confirm | `day.session.weight` (export) ← falls back to `animal.subject.weight` | merge → `subject.weight` | Day Editor → Overview | `day` / overview | Recording-day weight | `This day only` | Fix this day's recording weight | Reusing a stale animal-baseline weight across sessions | Day Overview | weight ownership integration (Task 2.5) |

### Physical-configuration identities (append-only)

| Field / concept | Pattern | Day behavior | State path | Export source | Edit surface | Repair target | User label | Ownership cue | Primary next action | Misconception to prevent | Attention target | Test coverage |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Probe / electrode geometry | `configuration_version` | Day **pins** a version; past days keep their geometry | `animal.configurationHistory[v].electrode_groups` (+ live `animal.devices`) | merge resolves the pinned version → `electrode_groups` | Animal Setup → Electrodes & Ephys | `animal` → Electrode Groups | Electrodes & Probes | `Configuration vN` | Pin or fix the configuration version | Rewriting historical geometry by editing latest setup | Animal Setup; Day Setup/Failed-channels | `workflowOwnership` (geometry codes → configuration_version); device override tests |
| Ntrode / channel map | `configuration_version` | Day pins version; wrong map is **silent** scientific corruption | `animal.configurationHistory[v].ntrode_electrode_group_channel_map` | merge → `ntrode_electrode_group_channel_map` | Animal Setup → Channel Maps | `animal` → Channel Maps | Channel Maps | `Configuration vN` | Pin or fix the configuration version | Editing latest map and silently changing past days | Animal Setup → Channel Maps | channel_* codes → configuration_version; baseline tests |
| Bad / failed channels | `day_fact` | Day override applied to the pinned map | `day.deviceOverrides` (bad-channel marks) | merge → per-ntrode `bad_channels` | Day Editor → Setup & Failed Channels | `day` / devices | Day-specific failed channels | `This day only` | Fix this day's failed channels | Marking a failed channel as if it applies to every day | Day Setup & Failed Channels | bad_channel codes → day_fact (failed_channels category) |
| Camera identity / calibration | `animal_catalog_reference` | Day/task/video/FsGUI row selects a catalog camera; recalibration = a **new** camera, past days unchanged (day-used export subset) | `animal.cameras[]` | **day-used subset** via `resolveDayCameraUsage` (Task 5) → `cameras` | Animal Setup → Video Cameras & Calibration; selection on Day task/video/FsGUI | `animal` (identity) / `day` (reference) | Video Cameras & Calibration | `Selected from animal catalog` | Add camera / Select the camera used on this day | Reusing a camera name after zoom/lens/calibration change; assuming one day = one camera | Animal Cameras; Day Tasks/Epochs | camera identity unit; usage/affected-days helpers; export-binding baseline |
| Data-acq device identity (`name`, `system`, `amplifier`, `adc_circuit`) | `animal_setup` (shared; **option B**) | Day inherits; **no per-day binding**. Editing affects **all** days; a mid-study amplifier swap is surfaced as **currently unsupported** | `animal.devices.data_acq_device[]` | merge → `data_acq_device` (index-named downstream) | Animal Setup → Recording System | `animal` → Recording System | Recording System | `Shared setup` | Fix shared recording system | Hiding recording-system changes in a generic "hardware" bucket; assuming a day-level swap exists | Animal Setup → Recording System | `divergent_data_acq_identity` ownership; Recording System IA |

### Setup defaults copied into the day

| Field / concept | Pattern | Day behavior | State path | Export source | Edit surface | Repair target | User label | Ownership cue | Primary next action | Misconception to prevent | Attention target | Test coverage |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `raw_data_to_volts`, `times_period_multiplier` | `setup_default_to_day` | Default copied into `day.technical` at creation; export reads the **day** value. Editing the default affects **future** days unless applied to named existing days | default `animal.technicalDefaults.*` → `day.technical.*` | merge → `day.technical.*` | Animal Setup → Recording System (default); rare day override | `animal` (default) / `day` (override) | Recording System constants | `Using recording-system default` / `Different from current recording-system default` | Override this day's technical value (rare) | Treating rig constants as routine day fields; assuming editing the default rewrites existing days | Day Technical section (read-only effective value); Recording System | day-technical default/override component (Task 4) |
| `default_header_file_path` | `day_fact` | Edited per day | `day.technical.default_header_file_path` | merge → `default_header_file_path` | Day Editor → Setup/Technical | `day` / devices | Day header file path | `This day only` | Fix this day's header path | Treating a recording file path as shared animal setup | Day Technical/Setup section | day-technical header-path test (Task 4) |

### Day facts, catalogs referenced per day, and exported lists

| Field / concept | Pattern | Day behavior | State path | Export source | Edit surface | Repair target | User label | Ownership cue | Primary next action | Misconception to prevent | Attention target | Test coverage |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Session / experiment description | `day_fact` | Edited per day | `day.session.session_description` | merge → `session_description` | Day Editor → Overview | `day` / overview | Day Details | `This day only` | Fix this day's session details | Confusing animal description with session description | Day Overview | overview component tests |
| Tasks (`task_environment` room + `camera_id`), epochs | `task_epoch_assignment` (+ `day_fact`) | Edited per day; within-day setup differs via separate task rows partitioning the epochs; **each epoch belongs to exactly one task** | `day.tasks[]` | merge → `tasks` | Day Editor → Tasks, Epochs & Files | `day` / epochs | Tasks, Epochs & Files | `Used in these epochs` | Set the room/camera/epochs for this task | Looking for recording files in shared setup; hiding within-day room/camera changes; two tasks claiming one epoch | Day Tasks/Epochs | `duplicate_task_epoch`/`divergent_task_identity` → task_epoch_assignment; multi-epoch component |
| Associated video files | `day_fact` (camera ref = catalog) | Edited per day; references a catalog camera by `camera_id` | `day.associated_video_files[]` | merge → `associated_video_files` | Day Editor → Tasks, Epochs & Files | `day` / epochs | Videos | `This day only` | Attach this day's videos | Treating a video as shared animal setup | Day Tasks/Epochs | orphaned_video → day_fact; camera empty-state test |
| Behavioral events / DIO | `day_exported_list` | **Exported from the day**; animal-level events are a reusable library/template only (`Use on this day` copies one in) | `day.behavioral_events[]` (exported); animal-level events are template-only | merge → `behavioral_events` | Day Editor → Tasks, Epochs & Files; animal-level library (template) | `day` / epochs | Behavioral Events / DIO | `Exported with this day` | Use on this day | Editing animal "library" events believing they export; duplicate day events; duplicate `description` (downstream `raise ValueError`) | Day Tasks/Epochs; animal DIO library | duplicate_behavioral_event_* → day_exported_list; behavioral-event ownership (Task 6) |
| Opto implanted setup (`optical_fiber`, `virus_injection`, `opto_excitation_source`, `optogenetic_stimulation_software`) | `animal_setup` | Set once; not edited per day; **all-or-nothing** (`partial_configuration` gate) | `animal.optogenetics.*` | merge → opto setup sections (only when all four present) | Animal Setup → Optogenetics | `animal` → Optogenetics | Optogenetics Setup | `Shared setup` | Complete implanted opto setup | Re-entering implant/virus facts per session; treating implant as a day protocol | Animal Setup → Optogenetics | partial_configuration/multiple_excitation_sources → animal_setup; opto split (Task 7) |
| Opto protocol run (`fs_gui_yamls`: protocol/power/epochs) | `task_epoch_assignment` + `day_exported_list` (**OPTIONAL**) | Recorded for selected task epochs; **a day or epoch with no opto is normal and valid** (never a missing-setup warning or block) | `day.fs_gui_yamls[]` | merge → `fs_gui_yamls` | Day Editor → Tasks, Epochs & Files | `day` / epochs | Opto protocol (per epoch) | `Used in these epochs` / `Exported with this day` | Record opto run for these epochs (only if used) | Forcing opto onto a non-opto day/epoch; assuming an implanted animal stimulated every epoch | Day Tasks/Epochs | orphaned_fs_gui_epoch → task_epoch_assignment; opto-free day/epoch (Task 7) |

### Recovered / corrupt state (repair, not ownership)

| Concept | Pseudo-pattern | State path | Edit surface | Repair target | User label | Cue | Primary action | Misconception to prevent | Test coverage |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Unpinned configuration | `configuration_version` (pin) | `day.configurationVersion` absent | Day Editor → Setup/Devices | `day` / devices | Pin a configuration version | `Configuration vN` | Pin this day to a configuration | Exporting a recovered day against the wrong/no geometry | unpinned_configuration → configuration_version |
| Malformed/stale overrides, malformed day/animal collections, shadowed geometry, missing configuration history | `recovered_data` | various (`day.deviceOverrides`, `animal.configurationHistory`, day/animal collection shapes) | Day or Animal repair banners | `day`/`animal` | Repair recovered data | `Needs review` | Repair recovered data | Trusting imported/corrupt state as if it were clean | malformed_*/stale_*/shadowed_* → recovered_data |

## Issue-code ownership (derived, not re-tabled)

`workflowOwnership.js` must **not** introduce a third parallel `code → meaning` table next to
`SURFACE_BY_CODE` ([validation.js](../../../../src/domain/validation.js)) and `CATEGORY_BY_CODE`
([workflowCategories.js](../../../../src/domain/workflowCategories.js)). Instead it:

1. reuses `repairTargetForIssue` for the **edit surface** (`animal`/`day`/`none`) — never
   re-deciding it;
2. reuses `workflowCategoryForIssue` / `CATEGORY_BY_CODE` for the **workflow category** — never
   re-deciding it;
3. maps the category to a **default ownership pattern**, then applies a **sparse refinement**
   only for the codes whose ownership is finer than their category default (e.g. within
   `animal_setup`: channel/geometry codes → `configuration_version`, camera-identity codes →
   `animal_catalog_reference`; within `day_metadata`: camera refs → `animal_catalog_reference`,
   task-epoch codes → `task_epoch_assignment`, behavioral-event codes → `day_exported_list`;
   within `existing_data`: `unpinned_configuration` → `configuration_version`).

A completeness test (mirroring the existing `CATEGORY_BY_CODE` ↔ `SURFACE_BY_CODE` invariant)
asserts that **every** code in `SURFACE_BY_CODE` resolves to a descriptor with a valid pattern
and full metadata, and that the sparse refinement contains **no** stale code keys. This is how an
ownership descriptor cannot drift from — or omit — a code the validators already produce.

Category → default pattern:

| Workflow category | Default ownership pattern |
| --- | --- |
| `animal_setup` | `animal_setup` |
| `day_metadata` | `day_fact` |
| `failed_channels` | `day_fact` |
| `existing_data` | `recovered_data` |
| `export_preflight` | (not an issue destination) |

## Downstream enforcement reality (why this app is the gate)

trodes_to_nwb's schema check **logs but never raises**, and its converters degrade gracefully, so
almost every constraint below is **silent downstream** — this app is the real gate (verified
2026-06-06; see [phase plan §Downstream enforcement reality](phase-8-7-ownership-defaults-day-configurability.md#downstream-enforcement-reality-trodes_to_nwb--dandi--verified-2026-06-06)):

- **Cameras** resolve by `id`, so the day-used subset is safe and more correct; a dangling
  `camera_id` is a downstream `KeyError`, so the day-used helper includes every referenced id.
- **One-epoch-one-task** is not enforced downstream — the app's `duplicate_task_epoch` error is the
  only gate.
- **Opto** is all-or-nothing and silent — `partial_configuration` (animal setup) is the gate; opto-free
  days/epochs are valid.
- **Rig constants** are silent: `times_period_multiplier` is read by no converter; `raw_data_to_volts`
  is only a `.rec`-header fallback (a wrong value silently mis-scales volts).
- **Species** is app-only — `invalid_species` (Latin binomial / NCBI URI) is the only gate; DANDI
  rejects free text.
- **DIO `description`** uniqueness is one of the few downstream hard `raise ValueError`s — gate it
  in-app.
- **`data_acq_device`** is index-named downstream (`dataacq_device{i}`); never apply camera-style
  subsetting to it.
