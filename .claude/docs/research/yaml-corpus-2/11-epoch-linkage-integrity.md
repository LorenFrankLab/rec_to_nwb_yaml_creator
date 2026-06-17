# Category-J — EPOCH as the cross-section linkage substrate

**Corpus:** `~/Downloads/collected_metadata_yamls` (1,799 parse-OK).
**Population after hygiene:** `is_suspect==False` → **1,792 files** ("real"); content-deduped → **1,674**.
**Method:** epoch linkage detail is **not** in `records.jsonl`, so every figure here is re-extracted from
**raw YAML** by `~/Downloads/yaml_analysis2/cat_j_epoch.py` (parses all 1,799 with pyyaml; persists the
per-section epoch SET so a holistic pass is possible — the prior `cat_f_extract.py` kept only derived
broken refs; this extractor reproduces cat-F's typing figures exactly, cross-validating both).
Outputs: `cat_j_records.jsonl` (per-file) + `cat_j_agg.json`. Reproduce:
`cd ~/Downloads/yaml_analysis2 && uv run cat_j_epoch.py`.
Counts are **per-file-distinct, real population** unless "ROWS"/"dedup" is stated. Every defect class is
spot-checked against ≥1 raw file (path + line) **and** traced to its downstream consequence in
trodes_to_nwb / Spyglass source.

---

## The epoch model (in words)

**There is no explicit `epochs:` list in the YAML.** A file's epoch universe is *implied* by the union of
three sections, each of which carries epoch references with **different schema typing**:

| section | key (schema) | type (schema) | role |
|---|---|---|---|
| `tasks[].task_epochs` | `task_epochs` | **array of int** | **declares** which epochs each task spans |
| `associated_files[].task_epochs` | `task_epochs` | **single int** | one statescript log → one epoch |
| `associated_video_files[].task_epochs` | `task_epochs` | **single int** | one video → one epoch |

(Schema: `trodes_to_nwb/src/trodes_to_nwb/nwb_schema.json` — `tasks…task_epochs` is `type: array`;
`associated_files…task_epochs` and `associated_video_files…task_epochs` are `type: integer`. The singular
key **`task_epoch` is not in the schema at all** — it is an *undeclared* legacy key that 4,489 corpus rows
still use.)

**The epoch number is the join key**, but it is NOT resolved against the YAML — it is resolved against the
**`.rec` filenames**. trodes_to_nwb builds `session_df.epoch` by parsing the zero-padded index out of each
`.rec` file name (`{date}_{animal}_{NN}_{tag}.rec`) and creates one NWB epoch interval per `.rec`
(`convert_intervals.py:35-66`, `nwbfile.add_epoch(start,end, f"{epoch:02d}_{tag}")`). The YAML's
`task_epochs` are written into NWB metadata tables (`tasks`, `associated_files`, `video_files`) but do
**not** create the interval — they only *tag* metadata with an epoch number that must later match an
interval. So:

- **The `.rec` files are authoritative for which epochs/intervals exist.** The YAML is authoritative for
  *what each epoch is* (task, video, statescript). A YAML epoch number that has no matching `.rec` resolves
  to nothing; a `.rec` epoch with no YAML metadata exists as a bare IntervalList.
- **Among the three YAML sections, `tasks[].task_epochs` is the declaring/authoritative section** (it is
  the only one schema-typed as a list and the only one that enumerates the full epoch span of each task).
  `associated_files`/`associated_video_files` are *referencing* sections (one row → one epoch).

**Downstream resolution (Spyglass).** `common_task.py:TaskEpoch._process_task_epochs` →
`get_epoch_interval_name(epoch, session_intervals)` (lines 315-385) matches the YAML epoch number to an
`IntervalList` name by trying exact, then 2-digit zero-pad, then 3-digit (`1`→`01`→`001`). If **0 or >1**
intervals match it logs a warning and returns `None` (no link — silent). Video linkage
(`common_behav.py:VideoFile`) then fetches that epoch's interval and requires the video's timestamps to
overlap it by **`_timestamp_overlap_threshold = 0.9`** (line 475): a single-file video is valid if ≥90% of
its frames fall in the epoch interval **or** the video covers ≥90% of the interval's duration
(lines 567-604). A video that fails the 0.9 gate is appended to `failed_videos` and **reported via a
warning, never raised** (lines 717-724, 761-764) → the video is **silently dropped** from the database.

---

## Cross-section integrity — defect table (real population, n=1,792)

| # | defect class | files (real) | dedup | downstream consequence | silent? | confidence |
|---|---|---:|---:|---|---|---|
| **D1** | **dangling `associated_files` epoch** — af references an epoch **no task declares** | **2** | 1 | af metadata tagged with an epoch with no task; if that epoch also lacks a `.rec` it is an orphan interval-less tag | yes | high (spot-checked) |
| **D2** | **dangling `associated_video_files` epoch** — avf references an epoch no task declares | **2** | 1 | video tagged to an epoch with no task row; Spyglass `VideoFile` needs a `TaskEpoch` (Issue #1444) — if epoch has no TaskEpoch the video import is skipped/warned | yes | high (spot-checked) |
| **D3** | **task-only epoch** — task declares an epoch referenced by no af/avf | **200** | 197 | *mostly legitimate* (a sleep epoch with no statescript & no video); NOT a corruption | n/a | high — re-read 4 raw, all benign |
| **D4** | **gap in the union sequence** (interior epoch missing) | **10** | 9 | mixed: some genuine **incomplete YAML** (run epochs exist in `.rec` but undescribed → bare IntervalList, no task metadata), some legitimate odd-only days | partial | high (spot-checked both kinds) |
| **D5** | **0-based numbering** (union epoch set includes 0) | **76** | 76 | self-consistent *within* an author (YAML 0-based ⇆ `.rec` `_00_`), so it links — but breaks any cross-file 1-based assumption & the `_06_`-style 2-digit zero-pad match edge | no (if `.rec` agrees) | high (spot-checked) |
| **D6** | **avf mixes `task_epoch` (sing) + `task_epochs` (plur) within one file** (SC131-class) | **2** | 2 | the singular-key rows **KeyError / are dropped** at `convert_yaml.py:69-71` (keys plural only) → those epochs' videos silently lost | **yes — silent loss** | high (spot-checked) |
| **D7** | af mixes scalar + list typing within one file | **0** | 0 | — (no file mixes; the scalar/list split is *between* files) | — | high |
| **D8** | **avf uses ONLY singular `task_epoch`** (whole-file legacy key) | **821** | 816 | every avf row `KeyError`s at `convert_yaml.py:71` (`file["task_epochs"]`) — the whole file's video linkage breaks on current trodes_to_nwb | **yes — total avf loss** | high (key absent in schema + code) |
| — | malformed epoch scalar (`task_epoch: 2 1` → string, unparseable) | **1** | 1 | YAML parses the value as the string `"2 1"`; `int()` fails downstream → that video's epoch ref lost | yes | high (spot-checked) |
| — | nonnumeric/empty epoch value (placeholder) | (subsumed) | | — | | |

**Headline consistency number.** Of **1,470** files that carry all three epoch-bearing sections, only
**694 agree exactly** on the epoch *set*; 776 "disagree" — but this is **expected**, not a defect: tasks
enumerate the full span (`[1,3,5,7]`) while each af/avf row names a single epoch, so af/avf are naturally
*subsets* of the task set. **The defect is only the reverse direction** (af/avf epoch ∉ task set = D1/D2,
4 files) plus the typing/era classes (D6/D8). No file has zero task-declared epochs.

---

## Spot-checked raw examples (path:line)

- **D1 — `sc4712/curated/SC64/generated/20240915_SC64_metadata.yml`.** Tasks declare
  `sleep`=[1,3,5,7] (L62-66) ∪ `forkTrack`=[2,4,6] (L72-75) → {1..7}. `associated_files` references
  **epoch 8 (L92) and epoch 10 (L96)** — the `_08_r4` / `_10_r5` run statescript logs — which **no task
  declares**. (Same file in `ebroyles/home/yaml/...` is the pre-dedup copy.)
- **D4 (incomplete) — same SC64 file.** Union = {1..8,10}; **epoch 9 missing entirely** (the `_09_s5`
  sleep session was dropped from every section). Genuine gap.
- **D4 (incomplete vs legitimate) — `denisse/stelmo/Jasper/20251013/20251013_Jasper_metadata.yml`.**
  Declares only odd epochs {1,3,5,7,9,11} (sleep s1-s6, L51-71). Filenames are `_01_s1`,`_03_s2`… so the
  **even run epochs `_02_`,`_04_`… exist in the `.rec` but were never described** → those intervals will
  exist downstream with **no task/file/video metadata**. (Distinguish from a legitimately odd-only day:
  here the file naming proves the runs exist.)
- **D2 — `sc4712/curated/SC65/generated/20240708_SC65_metadata.yml`.** Tasks = home{13,14} ∪
  sleep{1,4,7,8,10,12} ∪ fork{2,3,5,7,9,11} (L62-89) = {1-5,7-14}. **Epoch 6 is in no task**, yet the
  `_06_s3` videos are tagged `task_epochs: 6` (L139,142). Dangling avf epoch.
- **D5 — `xulu/stelmo/recordings/Luna/raw/20250219/20250219_Luna_metadata.yml`.** `associated_files`
  `task_epochs: 0` for `_00_s1` (L20-21); whole file is **0-based**, matching the `.rec` `_00_`,`_01_`…
  scheme. 75 of 76 zero-based files are **xulu** (1 is shijie/shylu) — a single-author convention.
- **D6 — `sc4712/curated/SC131/generated/20251204_SC131_metadata.yml`.** avf rows switch
  `task_epochs: 5` (L144) → **`task_epoch: 6` (L146), `task_epoch: 7` (L149), `task_epoch: 8` (L152)** →
  back to plural. Three videos (epochs 6,7,8 = run r3/r4/r5) use the singular key → dropped on import.
- **malformed scalar — `amankili/cumulus/Banner/metadata/20220124_Banner.yml:164`** —
  `task_epoch: 2 1` (two numbers, one space) parses as the **string `"2 1"`** → epoch ref unrecoverable.

---

## Typing / key-naming — ROW + FILE counts (real; reproduces cat-F exactly)

- **`associated_files[].task_epochs` — scalar vs list (same plural key, two types):**
  ROWS **scalar 3,247 / list 4,728**; FILES any-scalar **593** / any-list **1,055**; **mixed-within-a-file
  0**. A file is internally scalar-only or list-only. (Schema declares *single int*, so the **list** form is
  technically off-schema — but trodes_to_nwb's `convert_yaml.py:67-68` wraps a scalar into a list and the
  list form already is one, so both survive there; it is the *singular-key* problem below that breaks.)
- **`associated_video_files` epoch key — `task_epoch` (singular, undeclared) vs `task_epochs` (plural,
  schema):** ROWS **singular 4,489 / plural 8,860 / both-on-one-row 0 / no-epoch-key 3,409**;
  FILES any-singular **823** / any-plural **790** / **avf-singular-ONLY 821 (D8)** / mixed **2 (D6)**.
- **`tasks` block is uniform**: always plural `task_epochs` (singular-on-task = **0 files**). Only the
  *referencing* sections carry the typing inconsistency.

---

## By era & experimenter — convention is per-author + per-era

**Singular→plural flip (`associated_video_files` key) is a clean ~2023 era boundary AND per-experimenter:**

| year | avf singular files | avf plural files | 0-based files |
|---|---:|---:|---:|
| 2017 | 0 | 7 | 0 |
| 2019 | 15 | 0 | 0 |
| 2020 | 146 | 0 | 0 |
| 2021 | 415 | 3 | 0 |
| 2022 | 189 | 3 | 0 |
| **2023** | **31** | **135** | 0 (flip year) |
| 2024 | 22 | 251 | **20** |
| 2025 | 3 | 289 | **42** |
| 2026 | 0 | 92 | **14** |

- **Singular-key authors** (≤2022, internally consistent): Coulter/Kastner/Nevers-rhino (375), Alison
  Comrie (166), Mankili (89), Kastner/Nevers (85), Gu Shijie (70).
- **Plural-key authors** (≥2023): Chiang (332), Coulter (131), Sunrae (55), Adenekan/Lee (48),
  Morales-Rodriguez/Gao (30), Shin (25), Joshi (14).
- **`guidera jennifer` (177 files):** keys epochs **nowhere** in avf (`none`) — avf rows carry no epoch
  key at all.
- **0-based numbering is essentially one author: xulu (75/76 files)** + 1 shijie. Everyone else is
  1-based (min-epoch-1 = 1,701 files; min-epoch-0 = 76; min-other = 13 — those start at 2+ because epoch 1
  is a sleep with no af/avf, see D3).

---

## Invariants vs variation

| axis | Invariant | Variation |
|---|---|---|
| **structure** | no explicit `epochs:` list — always implied by tasks ∪ af ∪ avf; `tasks` block always uses plural `task_epochs`; every file has ≥1 task-declared epoch | which sections reference a given epoch (af/avf are subsets of tasks) |
| **by era** | tasks plural always; epoch numbers integer | avf epoch key flips `task_epoch`(sing)→`task_epochs`(plur) ~2023; `associated_files` typing trends scalar→list |
| **by experimenter** | each author internally consistent on avf key + numbering base | singular-vs-plural camp; **0-based (xulu) vs 1-based (everyone else)**; guidera carries no avf epoch key |
| **by animal/day** | numbering base & key style are author-static | which epochs exist & their task assignment legitimately day-vary (sleep-only vs run days) |

---

## Error classes ranked (severity × silence × frequency)

1. **D8 — avf-singular-only (`task_epoch`), 821 files / 816 dedup.** On *current* trodes_to_nwb,
   `convert_yaml.py:69-71` does `file["task_epochs"] = [file["task_epochs"]]`, keying the plural name
   only → a `KeyError` on every singular row, breaking the *whole file's* video linkage. **Largest silent
   blast radius in the corpus.** (These are mostly archived ≤2022 files, but any re-conversion hits it.)
2. **D6 — singular/plural mix within one file (SC131), 2 files.** A consumer keying plural drops exactly
   the singular rows → **partial** silent video loss (epochs 6,7,8 in SC131). Worse than D8 because it is
   invisible — the file mostly works.
3. **af scalar/list two-typing, 3,247 scalar rows.** A strict list-typed consumer mis-handles scalars;
   trodes tolerates it today, but it is off-schema and fragile.
4. **D1/D2 — dangling epoch (af/avf epoch ∉ any task), 4 files (SC64, SC65).** Silent; a metadata tag
   with no task. Cheap to gate.
5. **D4 — incomplete-YAML gap (SC64 e9, Jasper evens).** Run epochs present in `.rec` but undescribed →
   bare interval-less metadata downstream. Partial, author-dependent.
6. **D5 — 0-based (xulu, 76 files)** and **malformed scalar (`2 1`, 1 file).** D5 self-consistent so
   usually harmless; the malformed scalar is a pure data-entry slip.

---

## App-guard / UX implications (mapped to error classes)

- **[D8/D6 — highest value] Unify epoch typing & key on import↔export.** The app must **READ both**
  `task_epoch` (singular) and `task_epochs` (plural) on import so the 4,489 singular rows / 821
  singular-only files round-trip — but **WRITE only `task_epochs` (plural)**, the schema key and post-2023
  convention. This single change retires D8 (821 files) and D6 (the SC131 within-file mix) going forward
  and makes every re-saved legacy file convert. The exported YAML *shape* is unchanged for files already
  plural; only the legacy key is normalized.
- **[D1/D2] Cross-section epoch-consistency gate.** On export (and live in the day editor), every epoch
  referenced by `associated_files[].task_epochs` or `associated_video_files[].task_epochs` MUST appear in
  some `tasks[].task_epochs`. Warn (not hard-block, since the `.rec` is authoritative) — but surface it:
  "video `_06_s3` is tagged epoch 6, which no task declares." Catches SC64/SC65 for free.
- **[D4] Completeness nudge, not a blocker.** If the day's `.rec`/file set implies epochs the YAML doesn't
  describe (gap in the union where intermediate epochs exist), surface a soft notice
  ("epoch 9 has a recording but no task/video metadata"). Do **not** hard-gate — a sleep epoch with no
  statescript/video is legitimate (D3, 200 files), so task-only and bare-interval epochs are warnings.
- **[D5] Normalize/confirm the numbering base.** Detect 0-based vs 1-based at import and keep it
  consistent within a file; if the app emits epoch numbers, derive them from the `.rec` filename index so
  YAML and `.rec` can never disagree (the only thing that makes 0-based safe). Don't silently *renumber* —
  xulu's 0-based files are internally valid; just don't let the app introduce a base mismatch.
- **[malformed scalar] Type the epoch input as an integer** (numeric field, reject `"2 1"` / empty /
  placeholder) so a video can never carry an unparseable epoch.
- **Structural:** because epoch intervals are authoritative from the `.rec` (not the YAML), the app's job
  is to keep the YAML's epoch *tags* (a) integer, (b) plural-keyed, (c) a subset of the declared task
  epochs, and (d) base-consistent with the recording. None of these change the emitted YAML shape for a
  correct modern file — they only repair the legacy/era variation on re-save.

---

## Competing hypotheses & falsifiers

- **H1 (D8 singular-key is harmless because it is "just legacy").** Falsifier: current
  `convert_yaml.py:69-71` hard-keys `task_epochs`; a singular row `KeyError`s. Confirmed in source — it is
  a *live* break on any re-conversion, not inert. Confidence the read-both/write-plural fix is correct: high.
- **H2 (set-disagreement across sections = corruption).** Rejected: af/avf are one-epoch-per-row and are
  *expected* subsets of the task span; 776/1,470 "disagreements" are this benign direction. The real
  defect is the **reverse** containment (D1/D2), which is 4 files. Confidence: high.
- **H3 (D4 gaps = corruption).** Partly rejected: spot-checks show two kinds — genuine drops (SC64 e9) and
  incomplete-but-recordings-exist (Jasper evens). Neither corrupts existing data; both *under-describe*.
  Hence the guard is a *warn*, not a block. Confidence: high.
- **H4 (0-based is a bug).** Rejected: xulu's YAML 0-based matches the `.rec` `_00_` index, so it links.
  The risk is only an app introducing a base mismatch. Confidence: high.
- **Bias watch:** ROW totals (singular 4,489 / plural 8,860) are dominated by prolific authors
  (rhino/Chiang); the **file** counts (823/790) and the per-experimenter table are the dedup-robust view
  and tell the same singular≤2022 / plural≥2023 story.
