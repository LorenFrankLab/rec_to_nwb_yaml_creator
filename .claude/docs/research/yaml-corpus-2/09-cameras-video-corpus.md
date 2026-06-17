# 09 — Cameras & Video Linkage (corpus deep-dive)

**Corpus:** `~/Downloads/collected_metadata_yamls` (1,814 files; 1,799 parse-OK).
**Population:** `is_suspect==False` → **1,792 "real" files**; **1,790** of those have a `cameras[]` block
(2 have none). **4,279 camera rows** total.
**Method:** all figures extracted from **raw YAML** by
`~/Downloads/yaml_analysis2/cat_i_camera.py` (pyyaml; joins to `records.jsonl` on `rel` for
hygiene/identity), aggregated with `cat_i_camera.py --agg`. Reproduce:
`cd ~/Downloads/yaml_analysis2 && uv run cat_i_camera.py && uv run cat_i_camera.py --agg`.
Per-file extraction in `cat_i_records.jsonl`. Every surprising claim is spot-checked against ≥1 raw
file (path:line below). This **builds on** `cat-F-tasks-cameras-epochs.md` (camera_id referential
integrity) and goes deeper on **camera identity** (the Spyglass-CameraDevice-keys-on-name problem).

> **Schema correction (load-bearing).** The per-camera fields in real YAML are
> `id, meters_per_pixel, manufacturer, model, lens, camera_name`. **There is NO `meta_file_path`
> field** — 0/1,735 files (`grep -rl meta_file_path` = 0). The per-camera *calibration/settings* value
> is **`meters_per_pixel`** (present on 100% of rows). This is what changes with **zoom / camera
> height / position** — so "same camera_name, different meters_per_pixel" **is** the
> zoom-needs-a-new-name violation the user described.

> **Data-model recap (from Cat-F).** A camera is identified by `cameras[].id` (int). `tasks[].camera_id`
> is a **list** of ints → `cameras[].id`; `associated_video_files[].camera_id` is a **scalar** int → the
> same. Spyglass `CameraDevice` is keyed on the **`camera_name` string**, not on `id`.

---

## Summary

1. **Names are mostly meaningful position/box descriptors, but identity is name-keyed and the name is
   massively reused — both across animals/rigs AND, for the same animal, across days with different
   calibration.** 118 normalized names; the top names (`HomeBox_camera`, `SleepBox_camera`,
   `HaightRight_HaightLeft_camera`, `MEC_sleep_camera`) are shared by **20–35 animals each** and **2–9
   experimenter groups each**. Because Spyglass keys `CameraDevice` on the name, these all collapse into
   one device row → cross-rig collision. *(verified, high confidence.)*
2. **THE KEY FINDING — same name, different settings, in the wild.** **24 camera names map to ≥2
   distinct `meters_per_pixel`** values; for **15 of them the drift is WITHIN a single animal** (same
   animal + same camera_name, different calibration on different days), not just across animals. The
   spread is often orders of magnitude (`SleepBox_camera`: 19 distinct mpp from `0.001399` to
   `0.2002`). A name-keyed `CameraDevice` therefore stores **one** calibration for what are physically
   different setups. *(verified, high confidence — raw spot-checks below.)*
3. **`meters_per_pixel: 0` is a real silent error class** (16 rows / 5 files; 11 rows in an author's own
   `/bad/` dir). Zero calibration breaks pixel→meters position conversion. *(verified.)*
4. **Descriptor-field completeness is poor below `meters_per_pixel`.** `manufacturer` meaningfully filled
   68%, but `model` only **15.6%** and `lens` only **11.8%** (the rest are literally `unknown`).
   `camera_name` and `meters_per_pixel` are ~100% present. *(verified.)*
5. **Placeholder names persist:** 346/1,790 files (**19.3%**) carry ≥1 placeholder-grade name —
   dominated by `camera_name: 1` (341 rhino/Coulter files) plus `camera`/`XXX`. *(verified.)*
6. **Video→task→epoch linkage is clean on camera_id (Cat-F's gate caught it) but ~20% of avf rows carry
   NO epoch key** (3,410 rows / 179 files, **177 of them Guidera**) — silent for any consumer keying
   video to epoch. Dangling camera_id = **1 file** (Lotus `camera_id: X`); dangling epoch number = **2
   files** (SC65 epoch 6). *(verified.)*

---

## Findings

### I1 — Camera NAMING conventions  *(high confidence)*

- **118 normalized / 121 exact** distinct `camera_name` (real pop, file-distinct). Casing/whitespace
  fragmentation is **minimal** — only **3** normalized names have >1 exact spelling, all a stray double
  space before "camera ticks" (e.g. `HomeBoxSide_camera camera ticks` 42 vs `…_camera  camera ticks` 3).
- **Names predominantly encode position / box / session, not zoom.** Distinct-name token counts: `sleep`
  47, `box` 22, `run` 21, `maze` 11, `side` 11, `home` 10, `overhead` 3, `top` 1. So the convention is
  **`<Place><Position>_camera`** (`HomeBox_camera`, `HomeBoxSide_camera`, `SleepBoxSide_camera`,
  `MEC_run_camera`). **No name encodes zoom/calibration** — the calibration lives only in
  `meters_per_pixel`, which is exactly why same-name/different-mpp happens.
- **Per-experimenter house styles** (each internally consistent):
  - Guidera/Chiang: `HomeBox_camera`, `SleepBox_camera`, `HaightRight_HaightLeft_camera` (+ a parallel
    `… camera ticks` camera, see I1b).
  - Broyles/sc4712 (the SC-series): same `…Box_camera` / `…BoxSide_camera` family.
  - Gu/Xulu/Denisse/Lee group: lowercase `sleep_camera` / `maze_camera`.
  - rhino/Coulter: placeholder `1` or `camera`.
  - Comrie: `<subject> sleep camera` / `<subject> run camera` (`senor sleep camera`, `wilbur run camera`).
- **(I1b) The `… camera ticks` convention** is a distinct second camera per place (47 `HomeBox_camera
  camera ticks`, 42 `HomeBoxSide_camera camera ticks`, …) — a separate logical camera (timestamp/tick
  channel) reusing the place prefix. Worth knowing so a vocab doesn't treat it as a typo of the base name.
- **Raw:** `alison/home/Desktop/20201028_senor.yml:122-133` (`senor sleep camera`/`senor run camera`);
  `rhino/stelmo/implantData/CH105/metadata/yml/20210628_CH105.yml:26-31` (`camera_name: 1`).

### I2 — Name REUSE across animals / rigs / experimenters  *(high confidence — Spyglass collision)*

Spyglass `CameraDevice` is keyed on `camera_name`, so a name shared across rigs is one DB row for many
physical cameras.

- **Reused across >1 `subject_id`: 36 names.** Worst offenders (non-placeholder):
  `homebox_camera` 35 subjects, `mec_sleep_camera` 34, `sleepbox_camera` 31, `haightright_haightleft_camera`
  30, `homeboxside_camera` 29, `sleepboxside_camera` 24, `sleep_camera` 22, `maze_camera` 20.
- **Reused across >1 experimenter group: 22 names.** `sleep_camera` and `maze_camera` span **≥6
  experimenter groups each** (Gu, Xulu, Denisse, Lee, Gao, Chung…); `sleepbox_camera` spans Joshi /
  Chiang / Guidera; `camera` spans the Coulter/Kastner/Nevers cluster.
- **Raw (one file per experimenter group, all literally `camera_name: SleepBox_camera`):**
  - Chiang: `ebroyles/home/yaml/SC1002/generated/sc4712_updated/20231008_SC1002_metadata.yml:42` (mpp 0.1299)
  - Guidera: `jguidera/home/yaml/peanut/generated/peanut20201101_metadata.yml:83` (mpp 0.001399)
  - Joshi: `sambray/home/Downloads/20210722_J16_metadata.yml` (mpp 0.000842)

### I3 — SAME NAME, DIFFERENT SETTINGS (the zoom violation)  *(high confidence — spot-checked)*

For each non-placeholder normalized name, count distinct `meters_per_pixel` across the real corpus.

- **24 names → ≥2 distinct `meters_per_pixel`.** Of these, **15 also vary WITHIN a single animal**
  (same animal, same name, different mpp on different days) and 9 vary only across animals.
- Magnitude of spread is large (these are physically different rigs/zooms behind one name):

  | normalized name | # distinct mpp | example values |
  |---|---:|---|
  | `sleepbox_camera` | 19 | 0.001399 … 0.0842 … 0.1399 … 0.2003 |
  | `homebox_camera` | 17 | 0.000687 … 0.000842 … 0.0846 … 12.4 |
  | `sleepboxside_camera` | 16 | 0.000591 … 0.000629 |
  | `homeboxside_camera` | 15 | 0 … 0.000766 … 0.00101 |
  | `haightright_haightleft_camera` | 9 | 0.00231 … 0.00266 |
  | `maze_camera` | 9 | 0.0016 … 0.00229 |
  | `sleep_camera` | 7 | 0.00046 … 0.01 |

- **Within-animal drift (clean, both mpp physically plausible) — raw:** animal **Lewis**, name
  `maze_camera`:
  - `shijie/cumulus/recording_pilot/lewis/raw/20240105/20240105_lewis.yaml` → `meters_per_pixel: 0.0025`
    (id 2)
  - `xulu/stelmo/recordings/Lewis/raw/20240222/20240222_Lewis_metadata.yml` → `meters_per_pixel: 0.0016`
    (id 1)

  Same animal, same `camera_name: maze_camera`, ~1.5× different calibration 6 weeks apart — and the
  `sleep_camera` on the same two files is **id 1 then id 0** (camera-id reassigned day-to-day too).
- **Cross-animal, large spread — raw:** `peanut20201101_metadata.yml:79,83` `SleepBox_camera` mpp
  `0.001399` vs `ebroyles/home/yaml/SC79/generated/20240827_SC79_metadata.yml:38,42` `SleepBox_camera`
  mpp `0.1399077378` — **same name, 100× different calibration**, different animals/experimenters.
- **Other settings rarely disambiguate:** only 1 name has >1 distinct `model`, 0 names have >1 distinct
  `lens` or `manufacturer` (because those fields are mostly `unknown`). `meters_per_pixel` is the **only**
  field that actually varies — and it's not in the name.

### I4 — Field completeness (per camera row, 4,279 rows)  *(high confidence)*

| field | meaningfully filled | filled-with-anything (incl. `unknown`) |
|---|---:|---:|
| `camera_name` | 4,274 (99.9%) | 100% |
| `meters_per_pixel` | 4,277 (100%) | 100% (key present on 100% of rows) |
| `manufacturer` | 2,917 (68.2%) | 100% |
| `model` | **667 (15.6%)** | 100% |
| `lens` | **505 (11.8%)** | 100% |

"Meaningfully filled" excludes placeholder tokens (`unknown`, `n/a`, `none`, `xxx`, blank). So `model`
and `lens` are present-but-`unknown` ~85–88% of the time.

- **`meters_per_pixel: 0` (16 rows / 5 files)** — meaningless calibration. 11 rows live in an author's own
  `/bad/` dir; the rest do not. Raw: `sc4712/home/yaml/SC38/generated/bad/SC3820230611_metadata.yml:38`
  (`meters_per_pixel: 0`, `camera_name: SleepBox_camera`); also
  `sambray/home/Downloads/20170917_kf19_metadata.yml`.

### I5 — n_cameras distribution & id scheme  *(high confidence)*

- **n_cameras:** 0→2, 1→543, 2→739, 3→28, 4→226, 5→254. The 4–5-camera files (480) are the
  multi-view rigs (place camera + side/overhead + per-box). Sleep-only vs run days drive count variation
  (Cat-F: day-owned tier).
- **camera-id scheme:** 0-based-contiguous **1,618**, 1-based-contiguous **165**, non-contiguous **7**.
  Plus the Lewis evidence (I3) that **ids are reassigned across days** for the same animal/camera. → Any
  referential check must compare against the **actual `id` set**, never `0..n-1`, and must not assume a
  camera's id is stable across days.

### I6 — VIDEO → TASK → EPOCH linkage  *(high confidence)*

- **1,790 files have ≥1 `associated_video_file`; 16,758 avf rows total.**
- **camera_id integrity:** dangling avf camera_id = **1 file** (Lotus) — `camera_id: X` (literal
  placeholder) ×13 rows, `jguidera/home/yaml/lotus/Lotus20190904_metadata.yml`. (Cat-F's gate covers
  task-side dangling refs; nothing new beyond its 13 + this 1.)
- **epoch integrity:** dangling epoch number = **2 files** — SC65 `20240708` (epoch 6 referenced; no task
  declares it): `ebroyles/home/yaml/SC65/generated/20240708_SC65_metadata.yml` (+ sc4712 copy).
- **`avf` rows with NO epoch key at all = 3,410 rows / 179 files** — **177 are Guidera** (her files key
  video to camera but never to epoch). This is silent: a consumer joining video→epoch gets nothing for
  these. (Singular-`task_epoch` vs plural-`task_epochs` typing is fully characterized in Cat-F §F5; not
  re-derived here.)
- **avf `name` convention:** filename-style (`20210628_CH105_01_r1.1.h264`,
  `<date>_<subj>_<epoch>_<sNN>_<task>.h264`) encoding date/epoch/task in the string — i.e. the epoch is
  often *also* embedded in `name`, redundant with (and occasionally contradicting) the `task_epoch` field.

---

## Naming conventions (synthesis)

| convention | who | example | identity risk |
|---|---|---|---|
| `<Place><Position>_camera` | Guidera, Chiang, Broyles/SC | `HomeBoxSide_camera` | name shared across all their animals → Spyglass collision |
| `… camera ticks` second camera | Guidera/Chiang | `SleepBox_camera camera ticks` | distinct camera, place-prefixed (not a typo) |
| lowercase `<session>_camera` | Gu/Xulu/Denisse group | `sleep_camera`, `maze_camera` | shared across ≥6 experimenter groups |
| `<subject> <session> camera` | Comrie | `senor run camera` | subject-scoped → *less* collision-prone |
| placeholder | rhino/Coulter | `1`, `camera`, `XXX` | unnamed; 19.3% of files |

**The one convention nobody uses: encoding zoom/position-specific calibration in the name.** Calibration
lives only in `meters_per_pixel`, which is why the same name maps to many calibrations.

---

## Error / fragmentation classes (ranked: severity × silence × frequency)

1. **Same `camera_name`, different `meters_per_pixel` (24 names; 15 within-animal).** A name-keyed
   Spyglass `CameraDevice` stores one calibration for physically different setups → wrong
   meters/pixel on position data, **silently**. *Highest value.*
2. **Name reuse across animals/experimenters (36 / 22 names).** Cross-rig `CameraDevice` collision;
   fragments/merges device provenance across labs. Silent.
3. **`meters_per_pixel: 0` (16 rows).** Breaks position conversion; silent.
4. **avf rows with no epoch key (3,410 rows / 179 files, mostly Guidera).** Video can't be joined to
   epoch; silent.
5. **Placeholder camera_name (`1`/`camera`/`XXX`, 19.3% of files).** Unnamed device; `XXX`/`X` also
   feeds dangling-ref (Cat-F #1).
6. **camera-id reassignment / 1-based / non-contiguous ids.** Refs must use the real id set, not `0..n-1`.
7. **Whitespace fragmentation (`…_camera  camera ticks`, 3 names).** Cosmetic; trivial trim on export.

---

## App-guard / UX implications (top 4, mapped to error classes)

1. **[#1/#2] Make camera a first-class, animal-level catalog entity keyed by name, and surface
   same-name-different-calibration immediately.** When a day's camera reuses a `camera_name` that the
   animal (or, ideally, the dataset) already has with a **different `meters_per_pixel`**, **warn in
   context**: "Camera `maze_camera` was 0.0025 m/px on 2024-01-05; this day says 0.0016. Spyglass keys
   the camera device on the name — a different zoom/position needs a **distinct name** (e.g.
   `maze_camera_lowzoom`), or confirm this is a recalibration of the *same* physical camera." This is the
   exact failure in the corpus (Lewis `maze_camera`; `SleepBox_camera` 100× spread). Recognition over
   recall: pick the camera from the animal's catalog rather than re-typing name+mpp per day.
2. **[#2] Cross-rig collision awareness + brain-region-style canonical naming.** Don't enforce a closed
   vocab (names are meaningful place descriptors), but autocomplete from the experimenter's own prior
   names, trim whitespace, and — because Spyglass merges on name — at minimum **document/warn** that bare
   `sleep_camera`/`HomeBox_camera` collide across animals/rigs; encourage rig- or animal-qualified names
   for genuinely distinct cameras.
3. **[#1/#3] Validate `meters_per_pixel`:** require it present and **> 0** (reject `0`), and warn on
   physically-implausible magnitudes (the corpus has `12.4`, `6.7` — almost certainly typos). Cheap,
   catches silent position-scale corruption.
4. **[#5/#6] Camera-id auto-assignment + reference-by-name + reject placeholder names/refs.** Auto-assign
   contiguous `id`; make `tasks[].camera_id` and `associated_video_files[].camera_id` **pick-from-defined-
   cameras dropdowns** (so dangling refs and `camera_id: X` are structurally impossible — compare against
   the real id set, never `0..n-1`); reject placeholder names (`1`, `XXX`, blank). *(Reinforces Cat-F
   guard #1.)*

---

## Competing hypotheses & falsifiers

- **H1 (same-name/different-mpp = legitimate per-day recalibration of one physical camera, not an
  error).** Plausible for the *within-animal* cases (15 names): a camera genuinely re-zoomed between days.
  **But it's still a Spyglass problem** — `CameraDevice` is name-keyed, so one name can hold only one
  calibration; the per-day mpp is lost/overwritten downstream regardless of intent. So the **warning** is
  correct under both readings (recalibration → needs a distinct name *or* a day-scoped calibration the DB
  can keep). **Falsifier:** Spyglass storing `meters_per_pixel` per epoch/day rather than per CameraDevice
  — to be confirmed by the parallel Spyglass-source agent. *(The cross-animal cases — `SleepBox_camera`
  spanning 0.0014→0.20 across different animals — are unambiguously distinct physical cameras sharing a
  name; not recalibration.)* Confidence the warning is right: high.
- **H2 (name reuse is harmless because Spyglass disambiguates by something else).** Competing with the
  CameraDevice-keyed-on-name premise (from the task prompt / parallel agent). **Falsifier:** Spyglass
  `CameraDevice` primary key includes more than `camera_name`. If so, #2's collision severity drops to
  "provenance fragmentation" only. Flagged for the parallel agent to confirm the actual PK.
- **H3 (`meters_per_pixel: 0` is just template-default, never converted).** Partly true — 11/16 sit in a
  `/bad/` dir the author excluded. But 5 rows are in non-`/bad/` files (`20170917_kf19`,
  `SC3820230606` under `sambray/Downloads`), so the app should still reject `0`. Confidence: high.
- **Bias watch:** per-file counts over-weight prolific authors (Broyles/sc4712 SC-series, Guidera). The
  *name-reuse* and *same-name-multi-mpp* findings are **subject-distinct / file-distinct**, so they're not
  an artifact of one author re-exporting; the Lewis within-animal example spans **two different drives**
  (shijie, xulu), ruling out single-author duplication.
