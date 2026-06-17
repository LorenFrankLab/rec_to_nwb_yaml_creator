# Category-F — Tasks · Cameras · Epochs · Associated files/videos

**Corpus:** `~/Downloads/collected_metadata_yamls` (1,814 files; 1,799 parse-OK).
**Population after hygiene:** `is_suspect==False` → **1,792 files** ("real"); content-deduped → **1,674**.
**Method:** epoch/camera linkage is **not** in `records.jsonl`, so every figure here is extracted from
**raw YAML** (`cat_f_extract.py` parses all 1,799 parse-OK files with pyyaml, joins to `records.jsonl`
on `rel` for hygiene/identity; `cat_f_agg.py` aggregates). Reproduce:
`cd ~/Downloads/yaml_analysis2 && uv run cat_f_extract.py && uv run cat_f_agg.py`.
Counts are **per-file-distinct** unless "ROWS" is stated. Every surprising claim is spot-checked against
≥1 raw file (path + lines below).

> **Data-model note (load-bearing).** A camera is identified by `cameras[].id` (an integer) — **not**
> `camera_id`. `tasks[].camera_id` is a **list** of ints referencing `cameras[].id`;
> `associated_video_files[].camera_id` is a **scalar** int referencing the same. So "broken camera
> reference" = a `camera_id` value with no matching `cameras[].id`.

---

## Summary

1. **Camera-reference referential integrity is the headline silent bug.** 13 real files have a
   `tasks[].camera_id` pointing at a camera that does not exist in `cameras[]`; 1 file has the same in
   `associated_video_files`. Small in count but **100% silent** today and concentrated in 4 animals
   (SC127, SC18, Frodo, Lotus) — and **app-era** files (2023–2025), so it is a live failure mode, not a
   legacy relic. *(verified, high confidence.)*
2. **Epoch typing is genuinely two-typed at scale, exactly as the 325-set predicted.**
   `associated_files[].task_epochs` is **scalar in 3,247 rows / list in 4,728 rows**;
   `associated_video_files` keys epochs as **`task_epoch` (singular) in 4,489 rows vs `task_epochs`
   (plural) in 8,860 rows**. The singular/plural split is a clean **era + experimenter** signal
   (singular ≤2022, plural ≥2023) — a consumer keying on one name drops the other population. *(verified,
   high confidence.)*
3. **Task-name casing fragmentation is real but modest** (6 normalized names have >1 spelling;
   `sleep`/`Sleep` = 986/153 is the big one). The bigger task-name story is **legitimate per-day/per-study
   variation**, not error: 68 distinct normalized task names, `task_names` varies across days in 76/140
   multi-day animals.
4. **Camera vocab is heavily free-text** (121 distinct names) with placeholder-grade values in real data
   (`camera_name: 1` in 341 rhino/Coulter files; `XXX` in lotus). Camera-id scheme is mostly 0-based
   contiguous (1,618) but 165 files are 1-based and 7 are non-contiguous — so refs cannot assume `0..n-1`.
5. **Epoch-number referential integrity (avf epoch ∉ any task's `task_epochs`) is rare** (2 files,
   SC65 epoch 6) — but it exists and is silent.

---

## Findings

### F1 — Task-name vocabulary & casing fragmentation  *(high confidence)*

- **75 exact spellings → 68 normalized** task names (case/whitespace-insensitive), file-distinct, real pop.
- **Casing/spelling fragmentation clusters (6):**
  - `sleep`: **986** vs `Sleep` **153**
  - `run`: 126 vs `Run` 24
  - `lineartrack`: 71 vs `Lineartrack` 8
  - `maze`: 73 vs `Maze` 2
  - `w-track`: `W-track` 25 / `w-track` 6 / `W-Track` 3  (3 spellings)
  - `linear track`: `Linear Track` 14 / `linear track` 2
- The corpus also has **semantically-equivalent-but-not-normalizable** drift the casing-normalizer
  *misses*: `w-track` (34) vs `wtrack` (18) vs `lineartrack` (79) vs `linear track` (16) are the same
  protocols spelled with/without separators — a controlled vocab would collapse these too.
- Top names are dominated by **legitimate semantic protocol names** (`forkTrack_…_HaightRight_…`,
  `spatial bandit task (regular)`), i.e. task_name doubles as a protocol descriptor — so a *closed* vocab
  is wrong; an **autocomplete + canonical-casing** vocab is right.

### F2 — n_tasks variation  *(high confidence)*

- Distribution (real): n_tasks=1 → 634, 2 → 698, 3 → 240, 4 → 64, 5 → 25, 6 → 61, 7 → 18, 8 → 42, 10 → 7.
- **`n_tasks` varies across days in 40/140** multi-day animals; **`task_names` (normalized set) varies in
  76/140.** This is *expected* day-owned variation (protocol evolves; sleep-only vs run days) — reconciles
  with the 325-set's day-owned tier. Not an error class.

### F3 — Camera vocabulary, count, id scheme  *(high confidence)*

- **n_cameras:** 1 → 543, 2 → 739, 3 → 28, 4 → 226, 5 → 254, **0 → 2**. Multi-probe rigs (4–5 cameras)
  are common (480 files).
- **121 distinct camera_name** (no case-collisions at the exact level — the fragmentation is whole-name
  free text, not casing). Real placeholder-grade names in the corpus:
  - `camera_name: 1` — **341 files** (rhino / Coulter-Kastner-Nevers group; a single unnamed camera).
    *Spot-check:* `rhino/stelmo/implantData/CH105/metadata/yml/20210628_CH105.yml:24-30`.
  - `camera_name: XXX` — lotus template never filled (see F5).
- **camera-id scheme:** 0-based-contiguous **1,618**, 1-based-contiguous **165**, non-contiguous **7**
  (`[0,2,3]` ×6, `[0,2]` ×1), no-int-id 2. **No file is missing a camera `id`.** → A referential-integrity
  check must compare against the actual `id` set, never assume `0..n-1`.

### F4 — CAMERA_ID REFERENTIAL INTEGRITY (the silent linkage bug)  *(high confidence — spot-checked)*

Extracted from raw; "broken" = a `camera_id` value absent from this file's `cameras[].id` set.

| reference site | files (real) | broken ROWS | after content-dedup |
|---|---:|---:|---:|
| `tasks[].camera_id` → `cameras[].id` | **13** | 14 | 11 |
| `associated_video_files[].camera_id` → `cameras[].id` | **1** | 13 | 1 |

- **All 13 task-side breaks are "dangling ref" (camera block exists, ref points outside it)** — none are
  "no cameras block at all". 12 are **numeric** dangling, 1 is a **placeholder** (`X`, lotus).
- Affected animals: **SC127, SC18, Frodo, Lotus** (4 animals). The SC127/SC18 cluster is **2023 & 2025**
  app-era files → a *live* failure mode.
- **Spot-checks (path:lines):**
  - `sc4712/curated/SC127/generated/20250914_SC127_metadata.yml:24-44` — one camera `id: 0`; task `home`
    lists `camera_id: [0, 1]`. **Camera 1 does not exist.** (The `- id: 0..3` lower in the file are
    electrode-group ids, not cameras — parser correctly used only the `cameras:` block.)
  - `amankili/cumulus/Frodo/metadata/20230814_Frodo_metadata.yml` — cameras `id: 0,1`; task `W-Track`
    lists `camera_id: [1, 2]`. **Camera 2 does not exist.**
  - `jguidera/home/yaml/lotus/Lotus20190904_metadata.yml` — `camera_id: X` (literal placeholder) in both
    tasks and all 13 avf rows; cameras are `id: 0,1` with `camera_name: XXX`. A template that was never
    completed (real jguidera file, not is_suspect-flagged).

  These are **silent**: trodes_to_nwb/Spyglass key video & position data off `camera_id`; a dangling ref
  cannot resolve the camera's `meters_per_pixel` / geometry → either a crash deep in conversion or a
  mislinked / dropped video stream. This app is the only realistic gate.

### F5 — EPOCH TYPING  *(high confidence — replicates & scales the 325-set)*

**(a) `associated_files[].task_epochs` — scalar vs list (same field, two types):**

- **ROWS: scalar 3,247 / list 4,728** (missing-epoch 2).
- **FILES: any-scalar 593 / any-list 1,055 / mixed-within-a-file 0.** A file is internally consistent
  (scalar-only or list-only) — the split is **between** files, by author/era.
- 325-set said scalar 1212 / list 463 (file counts ~266 files); the larger corpus confirms the two-typing
  and shows **list is now the majority** (app-era default). *Spot-check (scalar):*
  `sc4712/home/Downloads/20240910_SC79_metadata.yml` `associated_files: … task_epochs: 2`.

**(b) `associated_video_files` epoch key — `task_epoch` (singular, legacy) vs `task_epochs` (plural):**

- **ROWS: singular 4,489 / plural 8,860 / both-on-one-row 0 / no-epoch-key 3,409.**
- **FILES: any-singular 823 / any-plural 790 / mixed-within-file 2 / both-keys-on-a-row 0.**
- **Clean era signal:**

  | year | singular | plural | none/mixed |
  |---|---:|---:|---|
  | 2019–2022 | 765 | 9 | (singular era) |
  | 2023 | 31 | 135 | flip year |
  | 2024 | 22 | 251 | plural |
  | 2025 | 1 | 287 | + 2 mixed |
  | 2026 | 0 | 92 | plural |

  → The app switched the emitted key from `task_epoch`→`task_epochs` ~2023. Both populations are large and
  permanent in the archive.
- **By experimenter (each is internally consistent → convention, not randomness):** Alison, Coulter-Kastner-
  Nevers (375), Mankili, Gu → **singular**; Chiang, Xulu, Sunrae, Adenekan-Lee, Denisse, Donghoon →
  **plural**. Guidera's 177 files key epochs nowhere in avf (`none`).
- **Mixed-within-one-file (2 files):** `sc4712/curated/SC131/generated/2025120{4,5}_SC131_metadata.yml` —
  rows visibly switch `task_epochs`→`task_epoch` at epochs 6/7/8 then back. *Spot-check:*
  `…20251204_SC131_metadata.yml` avf rows: `task_epochs: 5` then `task_epoch: 6` then `task_epochs: 9`. A
  consumer keying on plural **drops epochs 6,7,8's video links** in this file.
- **tasks block** itself is uniform: `task_epochs` (plural) in all 4,051 task rows — only `associated_*`
  carries the typing inconsistency.

### F6 — Associated files/videos counts + epoch-number integrity  *(high/medium)*

- **n_associated_files** is highly day-variable (0 → 136 files, peaks at 1, 5, 8) and **varies across days
  in 94/140** multi-day animals — *legitimate* (statescript logs differ per epoch/day; day-owned tier).
- **avf epoch ∉ any task's `task_epochs` (dangling epoch number): 2 files** —
  `…/SC65/generated/20240708_SC65_metadata.yml` (×2 copies), where `_06_s3_` videos are tagged
  `task_epochs: 6` but no task declares epoch 6 (`sleep`=[1,4,7,8,10,12], `home`=[13,14],
  `fork`=[2,3,5,7,9,11]). *Spot-checked.* Rare, but silent — a guard catching it costs nothing.

---

## Invariants vs variation

| axis | Invariant | Variation |
|---|---|---|
| **by time (era)** | tasks block always uses plural `task_epochs`; cameras always have an `id`. | **avf epoch key flips singular→plural ~2023**; `associated_files` epoch typing trends scalar→list (app-era). |
| **by experimenter** | each experimenter is internally consistent on avf epoch-key style and task/camera naming. | singular-vs-plural camp; camera naming style (semantic `HomeBox_camera` vs placeholder `1`/`XXX`); whether avf carries an epoch key at all (Guidera: none). |
| **by animal/day** | camera-id set & camera names are animal-static; task block uses plural. | n_tasks, task_names, n_cameras, n_associated_files all **legitimately day-vary** (day-owned tier). |

These reconcile with the 325-set: tasks/cameras/files/epochs are the **day-owned tier** (§3 there); the
typing inconsistencies (§6 there) are confirmed and now quantified at 5.5× scale.

---

## Error classes (ranked by severity × silence × frequency)

1. **Dangling `camera_id` (task or avf → nonexistent `cameras[].id`)** — 14 files, 4 animals, **app-era,
   100% silent**, breaks video/position linkage in Spyglass. *Highest value: pure referential check.*
2. **`task_epoch`/`task_epochs` key disagreement in `associated_video_files`** — 4,489 singular rows live
   in the archive; a consumer keying on plural drops them. **2 files mix both within one file** (partial
   silent loss). Unify on export.
3. **`associated_files[].task_epochs` scalar/list two-typing** — 3,247 scalar rows; a strict list-typed
   consumer mis-handles them. Normalize typing on export.
4. **Dangling epoch number (avf `task_epoch` ∉ any task's epochs)** — 2 files; silent; cheap to gate.
5. **Task-name casing fragmentation** (`sleep`/`Sleep` 986/153, +5 clusters) — fragments downstream
   grouping; low severity, easy canonical-casing fix.
6. **Placeholder camera metadata** (`camera_name: 1` ×341, `XXX`) — low (cosmetic/unnamed), but `X`-as-
   `camera_id` (lotus) is a special case of error class #1.

---

## App-guard / UX implications (mapped to error classes)

- **[#1] Camera referential-integrity gate (highest value).** On export (and live in the day editor),
  every `tasks[].camera_id` and `associated_video_files[].camera_id` MUST be ∈ the file's `cameras[].id`
  set. **Compare against the actual id set — not `0..n-1`** (165 files are 1-based, 7 non-contiguous).
  Better: make `camera_id` a **pick-from-defined-cameras dropdown** (recognition over recall) so a
  dangling ref is structurally impossible. Reject literal placeholders (`X`, `XXX`).
- **[#2/#3] Unify epoch typing & naming on export.** Emit **one** canonical shape: `associated_video_files`
  uses **`task_epochs`** (plural) — the post-2023 app convention and current majority — never `task_epoch`;
  and choose one scalar-or-list convention for `associated_files[].task_epochs` and apply it uniformly. The
  app must **read both** legacy keys on import (so the 4,489 singular-row files round-trip) but **write
  one**. This kills the within-file mix (SC131) and the era split going forward. The exported YAML shape
  for *new* files becomes single-typed; legacy files are normalized on re-save.
- **[#4] Epoch-linkage validation.** Warn/gate when an `associated_video_files` (or `associated_files`)
  `task_epoch(s)` value is not declared in any task's `task_epochs` — a dangling epoch number. Cheap,
  catches real data-entry slips (SC65).
- **[#1] Camera-id auto-assignment + name required.** Auto-assign contiguous `id` and require a non-
  placeholder `camera_name` so `1`/`XXX` don't ship; reference cameras by selecting the named camera, not
  by typing an integer.
- **[#5] Task-name autocomplete with canonical casing** (NOT a closed list — names are protocol
  descriptors). Suggest the experimenter's own prior task names + canonical casing for the common
  fragmentable stems (`sleep`, `run`, `w-track`, `lineartrack`). Collapse `sleep`/`Sleep` on suggest.

---

## Competing hypotheses & falsifiers

- **H1 (camera dangling = data-entry error).** Competing: *the extra `camera_id` is a real camera the
  author forgot to add to `cameras[]`*. Either way the file is broken (Spyglass can't resolve the camera);
  the gate is correct under both. **Falsifier:** a downstream tool that tolerates extra camera_ids by
  ignoring them — checked PIPELINE_REQUIREMENTS: camera/position linkage keys on `camera_id`, so a
  dangling ref does not resolve. Confidence the *gate* is right: high.
- **H2 (singular/plural is purely temporal).** Competing: *purely per-experimenter*. Evidence shows
  **both** — era is the dominant axis (clean 2022→2023 flip) and experimenter is the secondary axis
  (each person internally consistent). The unify-on-export remedy is invariant to which dominates.
  **Falsifier:** a post-2023 experimenter still emitting singular en masse — only 22 (2024) + 1 (2025)
  singular rows remain, consistent with tail/legacy re-exports. Confidence: high.
- **H3 (`task_names` variation = error).** Rejected: spot-checks show day-legitimate protocol changes
  (sleep-only vs run days), not animal-static drift — unlike genotype/dob. Confidence: high.
- **Bias watch:** per-file counts over-weight high-volume users (rhino 364, Chiang 334), so ROW totals
  (singular 4,489 / plural 8,860) are dominated by a few prolific authors; the **file** counts
  (823 / 790) and the per-experimenter table are the dedup-robust view and tell the same story.
