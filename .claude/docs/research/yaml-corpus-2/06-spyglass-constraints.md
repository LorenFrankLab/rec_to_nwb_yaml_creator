# YAML corpus-2 — Spyglass ingestion constraints (grounding the "Spyglass-fragment" severity)

**Date:** 2026-06-17 · **Source repo:** `/Users/edeno/Documents/GitHub/spyglass` branch
`spikesorting-v2` (the local checkout WAS readable here despite the CLAUDE.md EPERM note — every
`file:line` below is from this checkout, not GitHub). **Inputs:** the master error catalogue in
[03-synthesis.md](03-synthesis.md) §3, read against `src/spyglass/common/*.py` +
`src/spyglass/utils/mixins/ingestion.py`.

> **Major branch caveat (read first).** This is the *new* `SpyglassIngestion` ingestion model
> (per-table `table_key_to_obj_attr` + auto-registration + `accept_divergence`), NOT the older
> `insert_sessions` model the app CLAUDE.md describes. Two consequences flip prior assumptions:
> (1) **Optogenetics IS fully ingested** (`common_optogenetics.py` has real `make`/`table_key_to_obj_attr`
> for `Virus`, `VirusInjection`, `OpticalFiberDevice/Implant`, `OptogeneticProtocol`) — opto errors
> reach Spyglass. (2) **Catalog tables (`Subject`, `*Device`, `ProbeType`, `Probe`, `Virus`, …) now do a
> case-INSENSITIVE secondary-key consistency check** (`_unequal_vals` → `a.lower() != b.lower()`,
> `ingestion.py:447-452`) and on real divergence either **prompt** or **raise** — they do not silently
> fork. The fragmentation story therefore concentrates in tables that DON'T go through that path:
> **`BrainRegion`** (free auto-insert, case-SENSITIVE distinctness) and the PK itself.

---

## 0. The two ingestion paths (decides "silent fork" vs "raise")

| Path | Tables | Duplicate behavior | Source |
|---|---|---|---|
| **`SpyglassIngestion` + `_expected_duplicates=True`** | Subject, DataAcquisitionDevice(+System/Amplifier), CameraDevice, ProbeType, Probe(+Shank/Electrode), Virus, OpticalFiberDevice, Institution, Lab, LabMember | On PK match, `validate1_duplicate` compares every secondary key **case-insensitively**; if unequal → `accept_divergence` → **prompt** in interactive, **raise `DuplicateError`** in test_mode/non-interactive. Equal (incl. case-only differences) → skip, no new row. | `ingestion.py:367-452`; `accept_divergence` `dj_helper_fn.py:679-717` |
| **plain `make` / `fetch_add` / `insert(skip_duplicates)`** | **BrainRegion** (`fetch_add`), ElectrodeGroup, Electrode, Task, TaskEpoch, DIOEvents, SensorData, VideoFile | No consistency check. New distinct value → new row (BrainRegion) or skip-on-PK (others). **This is where free-text fragmentation lands.** | `common_region.py:18-53`; `common_ephys.py:43-69` |

`populate_all_common` wraps each table group in a try/except that **logs to `InsertError` and continues**
unless `raise_err=True` (`populate_all_common.py:118-124, 150-156, 265-272`) — confirming the synthesis's
"Spyglass logs ingestion errors to a side table and continues" claim. So even a *raising* table failure is
silent at the batch level (one session's table is skipped; the rest ingest).

---

## 1. Subject — `common_subject.py`

```
subject_id: varchar(80)          # PK
age=NULL, description=NULL, genotype=NULL, sex="U":enum(M,F,U), species=NULL
```

- **PK = `subject_id`**, `varchar(80)`. DataJoint declares string columns under MySQL `utf8mb4` with the
  server's default collation, which is **case-INSENSITIVE** (`utf8mb4_general_ci`/`_0900_ai_ci`).
  → **`RS10` and `rs10` collide on the PK — they do NOT create two subjects.** The *first* spelling
  written wins the stored casing; the second is treated as the same row and runs through
  `validate1_duplicate`. **Confidence: HIGH** on "they collide" (MySQL default-collation behavior is
  well-established); **MEDIUM** that no deployment overrides collation to `_bin`/`_cs`. *Verify:* `SHOW
  FULL COLUMNS FROM common_subject.subject FROM <db>` and read `Collation`.
- **`sex` is the only enum/lookup-constrained field** — `enum("M","F","U")`, default `"U"`. But it is
  **normalized on ingest**, not rejected: `standardized_sex_string` takes `sex_field[0].upper()`
  (`common_subject.py:39-52`), so `"Male"→"M"`, `"male"→"M"`, `"female"→"F"`, anything else → `"U"` with
  an `info` log. → **The corpus's "sex non-single-letter `Male`" (#6) does NOT fragment or fail Spyglass**
  — `Male`/`M`/`male` all land as `M`. This is a **DANDI-only** problem (DANDI validates the NWB string
  before normalization). `"Unknown"`/`""` → `"U"` silently (loses real info, but no fork).
- **`species`, `genotype`, `description`, `age` are free-text `varchar`, stored VERBATIM** — no enum, no
  lookup, no normalization. BUT they are not PKs and not their own tables, so they don't *fragment* a
  table; they just attach a wrong/variant string to the (single) Subject row.
  - `species` `Rat` vs `Rattus norvegicus` → **DANDI-reject only** (#5); Spyglass stores either verbatim.
  - `genotype` carrying strain `Long-Evans Rat` (#12) or case/control mislabel (CH105, #7) → **wrong
    semantics on the Subject row**, but only one row per `subject_id` so no fragmentation; it corrupts the
    *scientific variable* for anyone querying `Subject.genotype`. SPYGLASS-FRAGMENT rating for #12 should
    be re-read as **"wrong-value, single-row"** not "duplicate-row".
- **Same-animal DOB/genotype/species conflict (#7):** because `subject_id` is the PK and case-collides,
  the SECOND day's divergent static fact hits `validate1_duplicate` on the existing Subject row. In
  interactive ingest → **prompt** ("accept existing `genotype` over new?"); in batch/test → **raises
  `DuplicateError`** → logged to `InsertError`, that session's Subject insert skipped (but Subject already
  exists from day 1, so the session's other tables may still link to the day-1 Subject). Net Spyglass
  effect: **first-write-wins + a logged conflict**, not two subjects. **Confidence: HIGH** (code path
  explicit `ingestion.py:425-443`).

**App-upstream takeaway:** enforce single-valued `species`/`sex`/`genotype`/`DOB` *per animal* and a
canonical `subject_id` casing — not because Spyglass forks (it doesn't) but because the conflict either
**blocks ingest (raise)** or **silently keeps whichever day was ingested first**.

---

## 2. BrainRegion — `common_region.py` (THE fragmentation table)

```
region_id: smallint auto_increment   # PK (surrogate)
region_name: varchar(200), subregion_name=NULL, subsubregion_name=NULL
```

- **PK is an auto-increment surrogate**; distinctness is on `(region_name, subregion_name,
  subsubregion_name)`. `fetch_add` does `query = BrainRegion & {region_name=...}`; **if no exact match,
  `insert1` a new row** (`common_region.py:44-53`). **No `_expected_duplicates`, no `accept_divergence`,
  no normalization, case-SENSITIVE string compare** (a plain DataJoint restriction on a `varchar` uses
  the column collation for *equality* — but there is no lowering step, and any spelling/typo difference is
  a guaranteed new row).
- Populated from **`electrode_group.location`** at `common_ephys.py:53` (ElectrodeGroup) AND per-electrode
  at `common_ephys.py:128-134` / `252` (Electrode) — the SAME `location` string feeds both, so a variant
  spelling fragments in two tables' FKs at once.
- → **`hippocampus` (33,992) vs `Hippocampus` (5,558) vs `hippcoampus` (103) DO create THREE+ BrainRegion
  rows** (#11). `ca1`/`CA1`, junk (`'`, `Dead tetrode`) each add rows. Every electrode group/electrode
  then FK-links to a *different* `region_id`, so a spatial query `BrainRegion & {region_name:'CA1'}` misses
  the `ca1`/`Ca1` electrodes → **fragmented spatial queries**. **This is the canonical SPYGLASS-FRAGMENT
  class and the code confirms it exactly.** **Confidence: HIGH.**
- **NULL / `None` / `NotInBrain` location:** `fetch_add(region_name=None)` →
  inserts a row with `region_name = NULL`. `ElectrodeGroup.region_id` is **NOT nullable** (`-> BrainRegion`
  is a required FK, `common_ephys.py:37`), so the group still links — to a "NULL-named" BrainRegion row.
  `NotInBrain` / `Dead tetrode` / `''` each become their own literal region row.
  → corpus #10 ("NULL-like location on ACTIVE group") is confirmed: it does not fail, it manufactures a
  junk/NULL BrainRegion that pollutes the region vocabulary and breaks `JOIN`s on real regions.
  **Confidence: HIGH** (FK is non-nullable; `fetch_add(None)` inserts). *Caveat:* whether `region_name`
  can physically be `NULL` vs empty depends on how `electrode_group.location` is serialized into the NWB
  (pynwb usually coerces to `""`); either way a non-real region row is created.

**App-upstream takeaway (highest-value guard):** `location` MUST be a controlled vocabulary with locked
casing, enforced on **active** groups (the 752 active-row defect, #10) — disabled-tetrode NULLs (1,272)
are fine to leave because their groups carry no good channels. This is the single biggest Spyglass-DB win.

---

## 3. Probe / ProbeType / DataAcquisitionDevice / CameraDevice — `common_device.py`

- **ProbeType IS auto-registered from the ndx Probe** (confirms the app CLAUDE.md note):
  `ProbeType` is `SpyglassIngestion, _expected_duplicates=True`, `_source_nwb_object_type="Probe"`,
  PK `probe_type` varchar(80) (`common_device.py:334-373`). It is **not** a pre-existing controlled table
  — it's populated from `nwbf` Probe objects, with `num_shanks = len(probe.shanks)`.
- **`Probe.probe_id = probe.probe_type`** (`common_device.py:494`) and `Probe -> ProbeType`. So a probe's
  identity in Spyglass is the `probe_type` string. The upstream `device_type` resolution risk is therefore
  **two-staged**: (a) `device_type` must resolve to a real probe-metadata file in trodes_to_nwb (else
  `FileNotFoundError`, corpus #4 — HARD-FAIL *before* Spyglass), and (b) IF conversion succeeds, the NWB
  must contain a proper `ndx_franklab_novela.Probe` with `probe_type` + `shanks` + geometry.
- **ElectrodeGroup.probe_id when the device is NOT a proper ndx Probe:** `common_ephys.py:56-59`:
  ```python
  if probe_type := getattr(electrode_group.device, "probe_type", None):
      key["probe_id"] = probe_type
  ```
  `ElectrodeGroup -> [nullable] Probe`. → if the group's `device` lacks `probe_type` (not an ndx Probe),
  **`probe_id` is left NULL** — the group ingests but is **not linked to any Probe**. Same at Electrode
  (`common_ephys.py:163-181`): the `extra_cols` guard (`probe_shank`/`probe_electrode`/`bad_channel`/
  `ref_elect_id` all present AND device is a Probe) gates whether `probe_id`/geometry/bad_channel are set;
  otherwise it logs `"Electrode did not match expected novela format"` and inserts with **NULL probe link
  and `bad_channel="False"` default**. This is exactly the corpus's silent-degradation path for
  non-probe hardware (`screw`/`single_electrode`, #4) — **if** it somehow converts, the electrodes land
  unlinked. **Confidence: HIGH** (both guards explicit).
- **DataAcquisitionDevice:** PK `data_acquisition_device_name` varchar(80), nullable FKs to System &
  Amplifier (`common_device.py:60-87`). `_add_system` renames **`"MCU" → "SpikeGadgets"`** and
  `_add_amplifier` title-cases `Intan` (`common_device.py:236-237, 275-277`). → corpus #22's
  `system: MCU` vs `SpikeGadgets` drift is **auto-reconciled** for the *system* sub-field; but the device
  *name* itself (`data_acq_device.name`) is the PK and is **case-insensitively** de-duped via the
  `SpyglassIngestion` path. Low fragmentation risk.
- **CameraDevice:** PK `camera_name` varchar(80); `camera_id` is a *secondary* int derived from the camera
  NWB object name by `get_camera_id` (`common_device.py:323-331`, parses the integer out of the name;
  returns **-1 + warning** if none). So Spyglass keys cameras by **name**, not the YAML `cameras[].id`.
- **camera_id dangling reference (#15)** is handled in **TaskEpoch**, not CameraDevice:
  `_get_valid_camera_names` filters `task.camera_id` to those present in the file's camera map and
  **`logger.warning` + drops the missing ones** (`common_task.py:137-169`, `155-168`). → a task pointing
  at a non-existent `camera_id` ingests **with no camera linkage** (silent video/position break),
  confirming #15 as SILENT-CORRUPT at the Spyglass layer too. **Confidence: HIGH.**

---

## 4. ElectrodeGroup / Electrode — `common_ephys.py`

- **ElectrodeGroup** PK `(nwb_file_name, electrode_group_name)`; required `-> BrainRegion`,
  `-> [nullable] Probe`, `description` (NOT nullable), `target_hemisphere` enum default `"Unknown"`
  (derived from `targeted_x` sign, `common_ephys.py:61-68`).
- **Electrode** ingests the ndx_franklab_novela columns **only behind a guard** (`common_ephys.py:157-176`):
  needs `is_nwb_obj_type(device,"Probe")` AND all of `["probe_shank","probe_electrode","bad_channel",
  "ref_elect_id"]` present in the electrodes table. If satisfied:
  - `bad_channel` → `"True"/"False"` enum (`common_ephys.py:171-173`).
  - **`original_reference_electrode = elect_data.ref_elect_id`** (`common_ephys.py:174`). ← **Spyglass DOES
    read `ref_elect_id`** from the NWB electrode table. **This answers synthesis open-question #3:** the
    corpus found **zero structured `ref_elect_id`** in any of the 1,792 YAMLs (refs are free-text
    `description:'tetrode_reference'` / `# reference` comments). So either (a) trodes_to_nwb derives
    `ref_elect_id` from the `.rec` XML (not the YAML), and Spyglass gets it that way, or (b) the column is
    absent → the **entire `extra_cols` guard fails** → electrode falls to the `else` branch:
    `bad_channel` defaults to `"False"`, `original_reference_electrode` stays `-1`, `probe_id` NULL, and a
    warning is logged. **This is the load-bearing risk:** if the NWB electrodes table is missing ANY of
    the four columns, **bad_channel marking AND probe linkage are silently lost for the whole file.**
    **Confidence: HIGH that the guard is all-or-nothing; MEDIUM on which branch real Frank-lab NWBs take
    — must read one converted NWB's electrodes table.** *Verify:* open a trodes_to_nwb NWB,
    `nwbf.electrodes.to_dataframe().columns` ⊇ the four.
- → **Out-of-range `bad_channel` (#17):** Spyglass reads `bad_channel` as a per-electrode boolean from the
  NWB electrode row; it never re-validates the index range. If trodes_to_nwb already dropped the
  out-of-range `bad_channels:[4]` upstream, Spyglass simply ingests every electrode with
  `bad_channel="False"` → **the genuinely-failing channel is marked good in the DB.** SILENT-CORRUPT
  confirmed end-to-end.
- **bad_channels are NOT a fragmentation risk** — they're per-electrode enum values, single-valued, no
  vocabulary. The corpus's day-owned bad-channel model only matters for *which* NWB ships.

---

## 5. Task / TaskEpoch / DIO / Sensors

- **Task** PK `task_name` varchar(80); free-text descriptions. Duplicate `task_name` → secondary-key
  consistency check with `accept_divergence` (`common_task.py:67-96`). `sleep` vs `Sleep` (#22): the
  custom `unequal_vals` here does NOT lowercase (`common_task.py:67-69`) → `sleep`≠`Sleep` are **two
  Task rows** (mild fragmentation). **Confidence: HIGH.**
- **TaskEpoch** PK `(nwb_file_name, epoch)`; `-> Task`, `-> [nullable] CameraDevice`, `-> IntervalList`,
  `camera_names` blob. Epoch↔interval matching is fuzzy (`get_epoch_interval_name`, zero-pad variants,
  `common_task.py:314-384`) and **`task_epochs` scalar-vs-list (#14) is normalized away**: the NWB
  `task_epochs` is iterated (`_process_task_epochs`, `common_task.py:171-204`) — a scalar comes through as
  a 1-element iterable from the DynamicTable. → **#14 (task_epoch/task_epochs key split) is largely
  COSMETIC at the Spyglass layer** *provided trodes_to_nwb wrote the epochs into the tasks table at all*;
  the real loss (synthesis SC131) is upstream where the wrong KEY (`task_epoch` vs `task_epochs`) means
  the value never reaches the NWB tasks table. **Confidence: MEDIUM** (depends on trodes_to_nwb's key
  handling, not visible here).
- **DIOEvents** PK `(nwb_file_name, dio_event_name)`; reads `behavioral_events` BehavioralEvents,
  one row per `time_series` name (`common_dio.py:66-82`). **Events with zero timestamps are skipped with a
  warning** (`common_dio.py:70-74`). No vocabulary constraint — DIO names land verbatim, keyed per file,
  so the corpus's "no lab DIO template / unstable name↔channel" (#6 in synthesis exec-summary) does **not**
  fragment a shared table (PK includes `nwb_file_name`). The *binding* correctness is upstream.
- **SensorData** (`common_sensors.py`): reads the `analog` BehavioralEvents; **raises `ValueError` if the
  description column-count ≠ data column-count** (`common_sensors.py:65-71`) → logged to InsertError, sensor
  skipped. The `units.analog` 6-way encoding (#21) is unrelated to this (it's a units string, not column
  count) and isn't read here.

---

## 6. Optogenetics — `common_optogenetics.py` → **YES, opto reaches Spyglass**

This branch fully ingests opto (overturns the "does opto even reach Spyglass" question):

| Table | Reads | Volume/power field |
|---|---|---|
| `Virus` | ndx `ViralVector` | — |
| `VirusInjection` | ndx `ViralVectorInjection` | **`volume = volume_in_uL`** (`common_optogenetics.py:303`), `titer=titer_in_vg_per_ml`, AP/ML/DV/angles |
| `OpticalFiberDevice` / `OpticalFiberImplant` | ndx `OpticalFiber*` (needs `ndx-ophys-devices>=0.3.0`, else warn+skip, `:329,383`) | core_diameter, NA, coords |
| `OptogeneticProtocol` (+Ripple/Theta/Speed/Spatial parts) | `intervals['optogenetic_epochs']` | **`stimulus_power = power_in_mW`** (`common_optogenetics.py:38`) |

- **Volume 1000× error (#2) — DECISIVE:** `VirusInjection` reads **`volume_in_uL`** (the µL key, the
  *correct* one = 0.45), NOT `volume_in_ul` (the wrong one = 450). **So IF the NWB carries the
  `ndx ViralVectorInjection.volume_in_uL` attribute sourced from the YAML's `volume_in_uL` key, Spyglass
  stores the correct 0.45** and the `volume_in_ul: 450` is ignored. This **downgrades #2's Spyglass
  consequence** from "corrupt DB" to "corrupt-but-unread metadata" *for the µL-keyed value* — BUT this
  hinges entirely on which key trodes_to_nwb maps into the ndx attribute. If trodes_to_nwb maps the
  `volume_in_ul` (450) key into `volume_in_uL`, Spyglass stores 450. **Confidence: HIGH that Spyglass
  reads `volume_in_uL`; MEDIUM on the trodes_to_nwb mapping** — this is the load-bearing check
  (synthesis open-Q #1). *Verify:* read a denisse NWB's `ViralVectorInjection.volume_in_uL`.
- **Power error (#3):** `OptogeneticProtocol.stimulus_power = power_in_mW` — Spyglass reads the
  **per-epoch `power_in_mW`** (the real 2-50 mW value), NOT `opto_excitation_source.power_in_W` (the
  bogus 200). → **the `power_in_W: 200` error (#3) likely does NOT reach the Spyglass `OptogeneticProtocol`
  table** (that table uses mW from the opto epochs). Whether `power_in_W` lands anywhere in Spyglass
  depends on whether an excitation-source table reads it — **none exists in `common_optogenetics.py`**
  (no `ExcitationSource`/`power_in_W` table). → **#3 is a NWB/DANDI-layer error, not a Spyglass-table
  error.** **Confidence: HIGH** (no consuming table in the file).
- **Opto block all-or-nothing:** `OptogeneticProtocol.make` returns early with a warning if
  `intervals['optogenetic_epochs']` is missing (`common_optogenetics.py:54-59`); `OpticalFiberImplant`
  warns+skips if `ndx-ophys-devices` extension absent. So **empty-opto scaffolding (`fs_gui_yamls:[]`,
  the 110 over-counted files) simply yields no opto rows — silent, not an error.**

---

## 7. Session — `common_session.py`

```
-> Nwbfile (PK)
-> [nullable] Subject/Institution/Lab
session_id=NULL, session_description (NOT NULL), session_start_time (NOT NULL),
timestamps_reference_time (NOT NULL), experiment_description=NULL
```

- **Required non-NULL for the Session insert to succeed:** `session_description`,
  `session_start_time`, `timestamps_reference_time`. `session_id` is **nullable**, as are the Subject /
  Institution / Lab FKs (`common_session.py:26-34`). → a missing `session_description` or
  `session_start_time` would fail the Session insert (logged to InsertError). `session_start_time` is
  derived from the `.rec` timestamp downstream (synthesis confirms it's absent-by-design in the YAML), so
  the app should NOT add it.
- **Experimenter** part table calls `decompose_name` (`common_session.py:96-104`, `common_lab.py:64`),
  which **`raise ValueError` unless the name is exactly `First Last` (one space) or `Last, First` (one
  comma+space)** (`common_lab.py:386-405`). → a free-text experimenter like `"Loren M. Frank"` (two
  spaces) or a bare `"Loren"` **raises** → Session.Experimenter insert logged to InsertError, **experimenter
  linkage lost** for that session. The corpus's name-order/list drift (Axis-2) intersects here:
  `Last, First` is accepted, plain `First Last` is accepted, but middle initials / 3-token names break.
  **Confidence: HIGH** (explicit raise).
- **Institution / Lab** are `_expected_duplicates` catalog tables (case-insensitive de-dupe). `UCSF` vs
  `University of California, San Francisco` (#22, the institution invariant) → on PK match prompt/raise;
  on distinct PK → two rows (mild). The invariant guard upstream is the real fix.

---

## 8. Error-class → Spyglass-consequence crosswalk (the deliverable)

| # | Synthesis error class | Spyglass table & path | Consequence | Conf. | file:line |
|---:|---|---|---|---|---|
| 1 | Space-key total electrode loss | (upstream) no electrodes in NWB → ElectrodeGroup/Electrode populate **nothing** | **Silent empty ephys** in DB | HIGH | `common_ephys.py:50` (loop over empty `electrode_groups`) |
| 2 | Volume 1000× (`volume_in_ul:450`) | `VirusInjection.volume = volume_in_uL` | **Spyglass reads the µL key (0.45)** → likely NOT corrupted *iff* trodes maps correctly; else 450 | MED | `common_optogenetics.py:303` |
| 3 | `power_in_W:200` | **no consuming table** (protocol uses `power_in_mW`) | **Does NOT reach Spyglass** (NWB/DANDI only) | HIGH | `common_optogenetics.py:38` |
| 4 | Unresolvable `device_type` / non-probe HW | HARD-FAIL upstream; IF converted → Electrode `else` branch | NULL `probe_id`, `bad_channel="False"`, geometry NULL | HIGH | `common_ephys.py:163-181` |
| 5 | species `Rat` | `Subject.species` verbatim | **DANDI-only**; Spyglass stores it | HIGH | `common_subject.py:18` |
| 6 | sex `Male` | `standardized_sex_string` → `"M"` | **Normalized; DANDI-only, no Spyglass effect** | HIGH | `common_subject.py:39-52` |
| 7 | same-animal DOB/genotype conflict | Subject PK case-collides → `validate1_duplicate` | **prompt / raise → first-write-wins**, conflict logged | HIGH | `ingestion.py:425-443` |
| 10 | NULL/`NotInBrain` location on active group | `BrainRegion.fetch_add(location)` | **junk/NULL BrainRegion row**, breaks region JOINs | HIGH | `common_region.py:44-53`; `common_ephys.py:53` |
| 11 | `location` case/typo fragmentation | `BrainRegion.fetch_add` (no normalize, case-sensitive distinct) | **multiple region rows → fragmented spatial queries** | HIGH | `common_region.py:44-53` |
| 12 | strain in genotype | `Subject.genotype` verbatim, single row | **wrong-value (not duplicate-row)** | HIGH | `common_subject.py:18` |
| 14 | task_epoch/epochs scalar/list | TaskEpoch iterates `task_epochs` | **normalized → COSMETIC** at Spyglass; loss is upstream (wrong KEY → not in NWB) | MED | `common_task.py:171-204` |
| 15 | camera_id dangling | `TaskEpoch._get_valid_camera_names` drops missing + warns | **silent no-camera linkage** → broken video/position | HIGH | `common_task.py:155-168` |
| 16 | missing `subject_id` | Session `-> [nullable] Subject` | Session ingests with **NULL subject link** | HIGH | `common_session.py:27` |
| 17 | out-of-range bad_channel | Electrode `bad_channel` from NWB row (no range recheck) | **failing channel stored as good** | HIGH | `common_ephys.py:171-173` |
| 22 | `system:MCU`, `sleep/Sleep`, institution | MCU→SpikeGadgets auto; Task no-lowercase; Inst case-insensitive | MCU/Inst reconciled; **`sleep`≠`Sleep` → 2 Task rows** | HIGH | `common_device.py:236`; `common_task.py:67`; `ingestion.py:447` |
| 25 | placeholder `subject_id` (`12345`) | `Subject` PK | **real placeholder Subject row** in DB | HIGH | `common_subject.py:11` |
| — | experimenter 3-token / middle-initial | `decompose_name` | **raises** → experimenter linkage lost | HIGH | `common_lab.py:386-405` |
| — | ref_elect_id absent | Electrode `extra_cols` all-or-nothing guard | **bad_channel + probe link lost for whole file** | HIGH/MED | `common_ephys.py:157-181` |

---

*Re-verification commands when the spyglass branch moves: re-read the `file:line` anchors above plus
`git -C ~/Documents/GitHub/spyglass log -1 --oneline src/spyglass/common/`. Load-bearing NWB-read checks
(volume key, ref_elect_id columns) require opening a real converted NWB — see
[03-synthesis.md](03-synthesis.md) §7 open-questions #1 and #3.*
