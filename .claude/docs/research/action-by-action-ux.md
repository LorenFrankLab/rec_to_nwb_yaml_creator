# Action-by-action UX best practices

**Date:** 2026-06-15 · **Branch:** `modern` · Companion to
[export-journey-and-error-states.md](./export-journey-and-error-states.md),
[mental-model-and-ui.md](./mental-model-and-ui.md), [data-change-scope-model.md](./data-change-scope-model.md),
and [ux-principles.md](./ux-principles.md).

Purpose: for every user action in the export journey, state the **best-practice UX move and why**,
grounded in the established rubric and the corpus evidence — and prove **completeness** by mapping all
26 schema fields to the action that captures them.

Two principles carry through everything:
- **Error-prevention ladder** — climb to the highest rung that fits each field: *make impossible
  (derive/lock) > constrain (pickers) > gate at export > warn*.
- **Reward early, punish late** — validate inline on blur, clear errors instantly on fix, run
  empty-required checks at Save/Export, never block mid-type.

## Complete field-coverage map (all 26 schema top-level fields)

Every field maps to a scope (see [scope model](./data-change-scope-model.md)) and the action that
captures it. `*` = schema-required.

| Field | Scope | Captured in action | Control / best practice |
|---|---|---|---|
| `experimenter_name`* | Day (default from team) | Team / experimenters | multi-select of known people; defaults from animal team |
| `lab`* / `institution`* | Lab-const | Defaults | pre-filled; one canonical value |
| `experiment_description` | Animal/project | Animal setup | text; carried to all days |
| `keywords` | Animal/project | Animal setup | tag picker + free-add |
| `session_id` | Day (derived) | Auto-derived | built `{subject_id}_{YYYYMMDD}` — never hand-typed |
| `session_description` | Day | Day note | short text; carry-forward + edit |
| `subject.subject_id`* | Animal (Fixed) | Identity | format-validated; warn on case/collision |
| `subject.species`* | Animal (Fixed) | Identity | binomial **picker** (kills `Rat`) |
| `subject.sex`* | Animal (Fixed) | Identity | M/F/U/O **picker** (kills `Male`) |
| `subject.genotype`* | Animal (Fixed) | Identity | genotype picker, **separate from** strain |
| `subject.description`* (strain) | Animal (Fixed) | Identity | strain picker; labeled distinctly |
| `subject.date_of_birth`* | Animal (Fixed) | Identity | date picker; one value (cross-day check) |
| `subject.weight`* | **Day** | Day delta | number + fixed unit `g`; plausibility guard |
| `data_acq_device`* | Animal/rig (Per-config) | Rig setup | normalized `system` value; default |
| `device`* | Lab-const | Defaults | pre-filled (`Trodes`) |
| `units`* | Lab-const | Defaults | pre-filled; standardized |
| `times_period_multiplier`* / `raw_data_to_volts`* | Lab-const | Defaults | pre-filled constants; collapsed |
| `default_header_file_path` | Lab/rig-const | Defaults | pre-filled |
| `cameras`* | Animal/rig catalog | Camera setup | catalog; **`meters_per_pixel` calibration** flagged if placeholder |
| `electrode_groups`* | Animal (Per-config) | Implant setup | `device_type` picker (12-probe catalog), `location` vocab, coords + units; replicate-N |
| `ntrode_electrode_group_channel_map`* | Animal (`map`) + **Day** (`bad_channels`) | Auto-derive + bad-channel grid | maps auto-generated (read-only); bad channels = visual grid, monotonic |
| `behavioral_events`* (DIO) | Animal-typical (**Rare**) | DIO setup | one template + auto-numbering; per-day editable |
| `tasks`* | Day (types → animal catalog) | Epoch editor | pick task-type from catalog; assign epochs + camera |
| `associated_files`* | Day (per epoch) | Epoch editor | **derive** path from convention; one per epoch |
| `associated_video_files`* | Day (per epoch/camera) | Epoch editor | **derive** name; link camera; `task_epochs` (plural) |
| `opto_excitation_source` | Animal (Per-config) | Opto hardware | `power_in_W` **range guard** |
| `optical_fiber` | Animal (Per-config) | Opto hardware | coords + hemisphere; link to source |
| `virus_injection` | Animal (Per-config) | Opto hardware | coords, `virus_name`, `titer`; canonical `volume_in_ul` |
| `opto_software` | Lab-const | Defaults | pre-filled |
| `fs_gui_yamls` | **Day** (per-epoch schedule) | Epoch editor | per-epoch power (mW) + range guard; carry shape |

## Actions — the move → why

### Orientation
- **Find & open an animal** → searchable colony list showing *disambiguating* facts (id, genotype, #
  days, last recorded). *Recognition over recall; animal id anchors every screen.*

### Animal setup (rare, deliberate)
- **Enter identity** → species / sex / genotype are **pickers from the first keystroke**; *strain*
  (`description`) and *genotype* are separate labeled fields with examples. *Constrain at source — kills
  `Rat`/`Male`/"genotype = Long-Evans Rat" (rung 2).*
- **subject_id** → format-validate + **warn on case-variant / collision immediately**. *Corpus
  `RS10`/`rs10`, `Senor`/`senor` became duplicate Spyglass subjects.*
- **Electrode groups** → `device_type` picker with **human summaries** ("128-ch · 4-shank · 8 mm") from
  the 12-probe catalog (typo/unknown unselectable); `location` controlled vocab; coords numeric +
  units; **"add N identical, then tweak."** *Rung 1/2 for the biggest hard-fail + fragmentation sources;
  corpus chimi had 32 identical tetrodes.*
- **Channel maps** → **auto-derived** from `device_type`; a read-only confirmation line, never
  hand-entered. *Rung 1 — derive, don't ask.*
- **Cameras (catalog)** → define each camera once (name, manufacturer, model, lens) with
  **`meters_per_pixel` calibration**; flag obvious placeholders. *Corpus values were literal
  "PLACEHOLDER … NEED TO VERIFY"; calibration is error-prone and copied forward.*
- **DIO template** → one canonical template + auto-numbering, editable. *Per the DIO note — usually
  stable, occasionally board-dependent.*
- **Opto hardware (if any)** → excitation source (`power_in_W` **range guard** — corpus had `200`),
  virus injection (coords, `virus_name`, `titer`, canonical `volume_in_ul`), optical fiber (coords,
  link to source). *All-or-nothing with opto; range guards catch absurd values.*
- **Rig / boilerplate** → `data_acq_device`, `units`, constants, `device`, `default_header` pre-filled
  and **collapsed under "rarely changed,"** visible-and-overridable. *Byte-identical in all 325 files —
  don't ask; but never silent (rubric 6).*
- **Team** → multi-select of known people; seeds each day's experimenters.
- **experiment_description / keywords** → entered once; carried to every day.

### Day actions (frequent — the 95%)
- **Pick date(s)** → one date **or** a range **or** scattered multi-select in one control; show existing
  dates; reject bad formats; store/emit YYYYMMDD. **`session_id` auto-derives** from subject_id + date.
  *Serves the day-by-day+batch mix; prevents MMDDYYYY (`03112024_SC50`) and the `session_id` format drift.*
- **Carry-forward + confirm** → pre-fill from the **last same-config day** (not calendar-yesterday — gaps
  work), with **"carried from <date>" + diff highlight**. *Eye goes to what's new; never a silent
  auto-fill.*
- **Define epochs (spend the UX budget here)** → one **row per epoch** (epoch # = order, indexed-from-1).
  Per epoch: pick task-type (from catalog) → assign camera → **statescript file and video file derive**
  from `{date}_{animal}_{epoch:02d}_{tag}` (show derived names, allow correction; not every epoch needs a
  video). *The epoch is the join hub for tasks/files/videos/opto; this is the corpus's biggest redundant
  typing. One screen, progressive disclosure — the F4 anti-pattern lesson.*
- **Videos specifically** → each epoch's `associated_video_files` row links a **camera** (from the
  catalog) and the **epoch**; filename derives (`…_02_r1.1.h264`). Normalize to `task_epochs` (plural).
  *Corpus split `task_epoch`/`task_epochs` 98/225 — a consumer keying on one drops the other.*
- **session_description** → short per-day note; carry-forward + edit.
- **Weight** → number + fixed unit `g`, surfaced **on the day** (not buried in identity); plausibility
  guard. *The one `subject` field that's day-owned (varies 32/38).*
- **Mark bad channels** → visual channel **grid**, click-to-toggle, carry yesterday's marks (monotonic);
  un-marking a previously-bad channel → in-context confirm + ack, else export blocks. *Already exists.*
- **Opto schedule (if opto)** → per-epoch power (mW) + **range guard**; carry the schedule shape.

### Validate & export
- **Validate** → continuous, inline, **in the user's language** ("Epoch 3 has no statescript file"),
  located on the offending field; empty-required at Save/Export. *Reward-early/punish-late.*
- **Export** → single **or batch** (select days → export all); **gate** cost-of-error fields (block, not
  warn); filename auto-built to convention; explicit success feedback (which files, where).

### Corrections (secondary states)
- **Edit animal-static later** → edit once → propagates to all days; show **"used by N days"** blast
  radius; user re-exports what they need. *Single-source-of-truth makes the fix safe and drift-proof.*
- **Import & repair** → parse → new-animal-vs-existing-day → **flag every non-conforming field with a
  suggested fix** (`Rat→Rattus norvegicus`, `Male→M`, `"541g"→460 g`, space-keys, NULL locations,
  conflicting `volume_in_uL`/`volume_in_ul` values, unknown `device_type`) → accept/edit → fill gaps.
  *Teaching validation, not silent dropping.* **Do NOT auto-launder corruption** — the existing app
  preserves malformed values verbatim so validation surfaces them ([deviceNormalization.ts](../../../src/utils/deviceNormalization.ts)); the redesign must keep that.
- **Reassign / delete / undo / drafts** → reversibility everywhere; confirm destructive acts on exported
  data; drafts persist.

## The epoch is the hub

`tasks`, `associated_files`, `associated_video_files`, and `fs_gui_yamls` all key off the **epoch**
(`task_epochs` / `epochs`), and `tasks` / videos / `fs_gui` all reference a **`camera_id`**. So the
correct day-tier unit is the epoch, and one **epoch-centric row** (task → camera → statescript → video →
opto) consolidates four schema sections — the structural reason the epoch-centric editor is right.

## Fields that look "extra" but are load-bearing (do NOT drop on import)

**Correction (verified against the app's business rules — these are exactly the lessons a redesign
must not lose):**

- **`optogenetic_stimulation_software`** is **required**, not extraneous — it's one of the four
  all-or-nothing opto gate keys; missing it makes `trodes_to_nwb` silently drop *all* optogenetics
  ([optoRules.ts:24-25](../../../src/validation/rules/optoRules.ts#L24-L25)). (There is a real bundled-schema
  vs converter naming question here — resolve it, but never *drop* the field.)
- **`volume_in_uL`** must **not** be dropped — it and `volume_in_ul` are emitted together as a deliberate
  converter↔schema compatibility shim ([workspaceUtils.ts:124-154](../../../src/state/workspaceUtils.ts#L124-L154)).
  Repair = reconcile *conflicting values*, not delete a key.
- **`optical_fiber.excitation_source`** (empty `""` in corpus) — verify against the current schema/rules
  before treating as droppable; don't assume.
