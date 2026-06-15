# Data-change scope model: day / animal / experimenter

**Date:** 2026-06-15 · **Branch:** `wvm-phase3c-animal-view` · Companion to
[yaml-corpus-analysis.md](./yaml-corpus-analysis.md), [ux-principles.md](./ux-principles.md), and
[scope-tiers-ia/design-note.md](../plans/scope-tiers-ia/design-note.md).

Purpose: define, field by field, **what can change at the day level, the animal level, and the
experimenter level** — so the app can store each fact at the scope where it actually lives, enter it
once, and prevent the copy-forward drift seen in the corpus. Change-frequency is grounded in the
per-animal variance measured across 325 real files (see the corpus analysis).

## The relationships are NOT a strict tree

The three scopes are real, but they do **not** nest cleanly. The critical fact:

- **experimenter ⟷ animal is many-to-many.** Several people work on one animal, and the *set* can change
  across days. Evidence: denisse's animals `Emmett` and `Seth` have days authored by
  `[Morales-Rodriguez, Gao]` and other days by `[Morales-Rodriguez, Gao, Lee]` — a third author joined
  mid-study. So "who ran this session" is a **day-level set**, not a parent of the animal.
- **animal → day is one-to-many.** A day belongs to exactly one animal and one *configuration version*
  (see below).
- **experimenter → conventions is the only thing experimenter "owns"** — vocabularies, lab string, units
  encoding, naming style, default templates. It is a *source of defaults*, not a container for an
  animal's data.

```
experimenter (person + conventions) ──< runs >──┐         (many-to-many: shared animals)
                                                 ▼
                            animal (identity + implant)  ──one-to-many──>  day (session)
                                       │                                      ▲
                                       └── configuration version ────────────┘  (which implant is live)
```

**Why this matters for storage:** because animals are shared, the animal record must be a **single
lab-wide source of truth** — never namespaced under an experimenter. When copies exist per-experimenter,
they diverge. Direct corpus evidence: `chimi` appears in both `chimi metadata/` and
`Re _metadata_round_2-/` (a corrections pass), and `mec10` is scattered across `mec10/`, `mec10/raw/…`,
and the `*_het/` dirs — **with a conflicting genotype (`WT` vs `scn2a`) across those copies.** Two
locations for one animal ⇒ drift.

### Configuration version (the event that lets animal-static data change)

Implant facts (electrode geometry, `device_type`, opto hardware) are constant **within a configuration
version** and change only on a re-implant / probe-reconfiguration event. That event starts a *new config
version*; bad-channel marks reset and old/new versions are never compared. Evidence: `SC92`/`SC127`
change `eg_device_types` mid-study (re-config); the workspace model already encodes this
(`day.configurationVersion`).

## Change-frequency legend

| Tag | Meaning |
|---|---|
| **Fixed** | Set once at animal creation; never changes (identity). A change = an error. |
| **Per-config** | Constant within a configuration version; changes only on re-implant/re-config. |
| **Rare** | Usually stable per animal, but *can* legitimately change day-to-day. |
| **Per-day** | Expected to differ each session — this is the day's real work. |
| **Lab-const** | Same across the whole lab/rig; boilerplate (should be a fixed default, not asked). |

## Field-by-field scope map

| YAML field | Scope | Frequency | Evidence / note |
|---|---|---|---|
| `subject.subject_id` | Animal | **Fixed** | Spyglass Subject key. Case must be canonical (corpus: `RS10`/`rs10`, `Senor`/`senor`). |
| `subject.species` | Animal | **Fixed** | constant in 38/38 multi-day animals. Must be binomial. |
| `subject.sex` | Animal | **Fixed** | constant in 38/38. |
| `subject.genotype` | Animal | **Fixed** | constant in 37/38; the 1 exception (`mec10` `WT`↔`scn2a`) is an error. |
| `subject.description` (strain) | Animal | **Fixed** | constant in 38/38. |
| `subject.date_of_birth` | Animal | **Fixed** | constant in 37/38; the 1 exception (`Seth`, two DOBs) is an error. |
| `subject.weight` | **Day** | **Per-day** | varies in 32/38 — animal weighed each session. *(Nested under `subject` but day-owned — see split fields.)* |
| `experiment_description` | Animal / Project | **Fixed** | constant in 38/38 (study-level). |
| `keywords` | Animal / Project | **Fixed** | study-level; stable where present. |
| `electrode_groups[]` (geometry, `device_type`, `location`, `targeted_*`, coords) | Animal | **Per-config** | constant within a config; `SC92`/`SC127` change on re-config. |
| `ntrode_electrode_group_channel_map[].map` | Animal | **Per-config** | derived from `device_type` + implant; auto-generated. |
| `ntrode_…[].bad_channels` | **Day** | **Per-day** | monotonic-growing within a config; varies in 8/38. *(Nested in the map but day-owned — split field.)* |
| `data_acq_device[]` | Animal / Rig | **Per-config** | which acquisition rig; stable per animal. Normalize `system` (`MCU`/`Main Control Unit`/`SpikeGadgets`). |
| `opto_excitation_source`, `optical_fiber`, `virus_injection` | Animal | **Per-config** | the injection/implant hardware; constant per animal. All-or-nothing with opto. |
| `behavioral_events[]` (DIO map) | Animal-typical | **Rare** | usually fixed per animal but **can change day-to-day** (board-dependent; e.g. a `Poke3` split). Varies in 8/38. Offer one carry-forward template + auto-numbering. |
| `cameras[]` (catalog) | Animal / Rig | **Per-config / Rare** | the camera set is rig-stable; *which* cameras are used differs by day (sleep vs run). `camera_names` varies in 11/38. |
| `experimenter_name[]` | **Day** | **Rare** | *who ran this session* — a set, shared across people; usually stable per animal but can change (Lee added on `Emmett`/`Seth`). **Not** an animal owner. |
| `session_id` | **Day** | **Per-day** | date-derived (`animal_YYYYMMDD`). |
| `session_description` | **Day** | **Per-day** | varies in 11/38. |
| `tasks[]` (+ `task_epochs`) | **Day** | **Per-day** | the day's epoch structure; `task_names` varies in 26/38, `n_tasks` in 20/38 — the biggest real day-to-day signal. |
| `associated_files[]` (statescript) | **Day** | **Per-day** | per-epoch logs; `n_associated_files` varies in 33/38. |
| `associated_video_files[]` | **Day** | **Per-day** | per-epoch videos. |
| `fs_gui_yamls[]` (opto power schedule) | **Day** | **Per-day** | per-epoch power ramps differ each session (e.g. Laurent 0→4→7→12 mW). |
| `lab`, `institution` | Experimenter / Lab | **Lab-const** | `institution` identical in all 325; `lab` should be one canonical string (corpus has 2). |
| `device.name` (`Trodes`) | Lab | **Lab-const** | boilerplate. |
| `units`, `times_period_multiplier`, `raw_data_to_volts`, `default_header_file_path` | Lab / Rig | **Lab-const** | `raw_data_to_volts`/`times_period_multiplier` byte-identical in all 325. Don't ask; default + derive. |
| `optogenetic_stimulation_software` / `opto_software` | Lab | **Lab-const** | tool name; constant. |
| `session_start_time` | — | n/a | **not a YAML field**; derived from the `.rec` timestamp downstream. |

## Split fields — where one YAML block spans two scopes

These are the subtle cases. Tier them by *observed behavior*, not by where they sit in the YAML tree:

- **`subject`** — identity is **Animal/Fixed**, but **`weight` is Day/Per-day**. Don't lock all of
  `subject`, or users will unlock daily and learn to ignore the lock.
- **`ntrode_…_channel_map`** — `map` structure is **Animal/Per-config** (auto-generated), but
  **`bad_channels` is Day/Per-day** (monotonic). The app already models this (`day.deviceOverrides.bad_channels`).
- **`cameras`** — the *catalog* is **Animal/Rig/Per-config**; *which cameras a given epoch uses* is **Day**.
- **opto** — hardware + injection are **Animal/Per-config**; the **`fs_gui_yamls` power schedule is Day**.
- **`behavioral_events` (DIO)** — **Animal-typical but Rare**: carry forward, allow a per-day edit.

## Implications for the app

1. **Animal record = single lab-wide source of truth.** Shared by all experimenters; never duplicated
   per person. This is what prevents the `mec10`/`chimi` divergence.
2. **Day record references** (a) its animal, (b) its configuration version, (c) the experimenter *set*
   who ran it. The experimenter set is editable per day (roster changes), defaulting to carry-forward.
3. **Experimenter = defaults + conventions only** — seeds controlled-vocabulary pickers and default
   templates; the stored canonical values are lab-wide, not per-experimenter.
4. **Lock by frequency, not by tree position:** Fixed/Per-config fields are read-only on the day view
   (unlock = a deliberate re-config event); Per-day/Rare fields are the editable surface, pre-filled by
   carry-forward + diff.
5. **Rare fields (DIO, camera selection, experimenter set) carry forward but stay editable** — never
   silently locked, never silently auto-filled.
