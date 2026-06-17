# YAML corpus-2 — research log

Running, append-only log for transparency. Each entry: what was run, what it showed, what was
spot-checked, confidence. Newest at bottom of each phase.

---

## P0/P1 — foundation (2026-06-17)

**Corpus shape.** 1,814 files; parsed OK **1,799**; **15 unparseable**; **1,681 unique by content**.
Storage-users: rhino 364, alison 184, sc4712 181, jguidera 177, ebroyles 150, mcoulter 123, rio 107,
amankili 104, xulu 93, shijie 78, kyu 66, denisse 60, sunrae 55, sambray 26, donghoon 23, zoldello 15,
jhbak 4, + singletons. Drives: stelmo/cumulus/nimbus/home/… Years: 2017:8, 2019:16, 2020:173,
**2021:501**, 2022:210, 2023:167, 2024:273, 2025:291, 2026:92, undated:68.

**Headline aggregates (per-file, pre-dedup unless noted).**
- experimenter_name shape: list 1,191 / scalar 574 / **missing 34** (key spelled `experimenter name`).
- `gen_class` heuristic: legacy-like 884 / app-like 794 / ambiguous 121 (coarse — corroborate).
- species: `Rat` 943 / `Rattus norvegicus` 849 / `Rattus rattus` 4 / `Rattus pyctoris` 2 / `rat` 1.
  **species-not-binomial: 944/1799** (DANDI-rejecting).
- sex: `Male` 936 / `M` 768 / `F` 93 / `male` 1 / `Female` 1. **sex-not-single-letter: 938.**
- weight type: string-with-unit 782 / numeric 875 / missing 142.
- dob: missing 965 / py-datetime 831 / ISO-date 3.
- date filename format: YYYYMMDD 1,582 / embedded 142 / none 68 / **MMDDYYYY 7**.
- electrode `location`: 50 spellings, 5 fragmentation clusters, **262 NULL-like rows**.
- `device_type`: 15 distinct values (vs 12 known probes → typos to find in P2-C).
- partial-opto: 2. duplicate-keys: 0. (case-variant `volume_in_uL/ul` shim expected — P2-G.)
- day-variation (deduped, 142 multi-day animals): top varying = n_associated_files 95, task_names 77,
  weight 48, session_description 44, camera_names 41, n_tasks 40, behavioral_event_names 34,
  **bad_channels 25**; animal-static **drift events: 52**.

**Data hygiene (after fixing an over-flag).** `is_suspect` non-real files: **7** (templates/test
fixtures: `20230622_sample_metadata.yml`, `{EXPERIMENT_DATE…}_54321`, `_EXPERIMENT_DATE…_bs28`,
`…_sc92` placeholder, `denisse_test/…Jacob`, `nwb_test/…eliot_test`, `recording_pilot/…isaactest`).
REAL files shipping placeholder IDs `54321`/`12345`: **4**. REAL files missing `subject_id`: **35**.

### Spot-checks performed (raw-file verified)
1. **`Rattus rattus` / `Rattus pyctoris` = mostly non-real or mislabel, NOT black rats.**
   - `Rattus pyctoris` ×2 = the golden-sample fixture (`subject_id 54321`) + an unsubstituted template
     filename. Quarantined.
   - `Rattus rattus` genuine ×3 (rio/bs28 2 days, mcoulter/arthur) all have `description: Long Evans
     Rat` + `genotype: Wild Type` in the **same** subject block → contradiction (Long-Evans is
     *R. norvegicus*). Same animal **bs28** = `Rattus rattus` in `rio/BS28_raw_old/` but `Rat`
     elsewhere (mcoulter, sambray). Verdict: **free-text species mislabel**; copy-pasted block
     (arthur+bs28 share identical weight 500 / Wild Type / Long Evans). *Confidence: 0.9.*
2. **"missing experimenter_name" (34) = space-separated keys, not absent.** Raw `top_keys` show
   `experimenter name`, `experiment description`, `session description` (spaces). 24 are Alison's
   2021 wilbur/peanut files under `old_nounderscore_metadata/`. These **hard-fail trodes_to_nwb**
   (zero electrodes). *Confidence: 0.9.* → records.jsonl under-reads these whole files (caveat logged).
3. **Placeholder IDs are real-session errors.** `kf19/raw/20170917/20170917_kf19_metadata.yml`
   (kenny + kyu copies) carries `subject_id: 12345` in a real raw dir → shipped template default.

### Methodology notes / corrections this phase
- Initial `is_suspect` wrongly counted `subject_id: None` and `12345`/`54321` as "non-real",
  hiding real errors. Fixed: quarantine on **filename/path only**; placeholder/missing IDs are
  **kept as findings**. (Generalizable lesson: never quarantine on data values.)
- `records.jsonl` cannot see inside space-key files — Category H must read those from raw.

**Confidence after P1:** H1 0.85, H1′ 0.85, H3b 0.75, H3c 0.80 (cost), H5 0.80 (carry-over). See
[hypothesis tree](01-hypothesis-tree.md).

---

## P2 — 8 category deep-dives (2026-06-17). Full notes: `cat-A..H-*.md`. All claims raw-spot-checked.

**New / sharpened findings beyond the 325-set (each verified against raw files):**
- **[H] `times_period_multiplier: 1.5cd`** — a string typo in a numeric field, **53 sunrae files**
  (100% of that experimenter's active files). Breaks AJV/jsonschema. Net-new class.
- **[H] Space-separated top-level keys = silent TOTAL electrode loss — 36 files** (alison 26, jhbak 4,
  amankili 3, loren 2; mostly 2021). `alison/…/20210326_wilbur.yml:218` has 32 populated tetrodes under
  `electrode groups:` (space) → converter reads `electrode_groups` → **0 electrodes, "converts" anyway.**
- **[G] Volume 1000× conflict — 49 files / 99 injection blocks:** `volume_in_uL: 0.45` vs
  `volume_in_ul: 450`. Exactly the predicted unit/scale error; silent.
- **[G] `power_in_W: 200` in 70/71 excitation blocks** — ~10,000× wrong (200 = max *mW* of the LuxX
  laser model, typed into the W field). Opto is sparse + one group (Denisse); `opto_present` overcounts
  2.5× because empty `[]` scaffolding counts as present (110 non-opto files).
- **[F] camera_id dangling references — 13 files, APP-ERA 2023-25** (SC127 task lists `camera_id:[0,1]`
  but only camera `id:0` exists). The one clear residual error the *current app* still permits.
- **[C] Unresolvable `device_type` — 66 files / 17 animals:** `screw`+`single_electrode` (co-occur,
  65 files, mcoulter+sunrae — a real hardware class the app can't express) + typo
  `128c-4s8mm6cm-15um-40um-sl`. Hard-fail FileNotFoundError.
- **[C] No structured reference field exists anywhere** (`ref_elect_id`/`ref_ntrode_id` = 0 files).
  References live only in `description:'tetrode_reference'` (448 groups) + `# comments` (366 lines,
  dropped on parse). Reframes "reference integrity" as a smaller, different problem than assumed.
- **[B] 13 animals self-contradict across their own days** (strongest enter-once-lock evidence):
  **CH105 — 22 files `Wild Type` vs 22 `Scn2a +/+ or +/-`** (case/control mislabel in a disease model —
  scientifically serious); Seth DOB `2025-04-12`↔`2025-07-26` interleaved day-to-day; bs28 species.
- **[D] Bad channels:** 63% of files mark ≥1; ~95% monotonic across days (validates the app model);
  out-of-range marks real but rare (herman); all-4-bad ≠ disabled — **4,586 all-4-bad tetrodes sit in a
  real brain region** (dead-in-brain, location correct) vs 1,045 truly unused.
- **[A] Sharp 2022→2023 legacy→app phase change, then STABLE.** Positive app fingerprint: 789 app /
  938 legacy / 65 ambiguous. Corrected a tempting heuristic: **list-experimenter is NOT an app signal**
  (67% of 2021 legacy files use lists); the real app marker is comma `Last, First` order.
- **[C] location case-fragmentation huge:** `hippocampus` 33,992 vs `Hippocampus` 5,558 vs `hippcoampus`
  103 (typo); 752 *active*-group NULL locations (defect) vs 1,272 unused (intentional) → NULL gate must
  be active-group-scoped.
- **[E] DIO confirms no-template:** 67 distinct sets; `RightMilk_Pump`→8 channels; `Din1`→21 names.
  The YAML `description` field IS the channel (counter-intuitive form labeling).

**Methodology note:** Cat-D caught a real confound — the same recording day exists as divergent copies
across storage drives; naïve date-ordering manufactured 158 fake bad-channel un-marks (consensus → 3).
Cross-copy disagreement is itself a finding (single-source-of-truth guard). Cat-C corrected a false
alarm: `n_electrode_groups ≠ n_ntrode` is **correct** multi-shank expansion, not a bug (only 11 real
defects). Both reinforce: spot-check before trusting an aggregate.

---

## P5 — downstream verification vs trodes_to_nwb + Spyglass SOURCE (2026-06-17). Notes: `05-*`, `06-*`.

Both repos read locally (the CLAUDE.md EPERM note no longer holds this session): trodes_to_nwb HEAD
`65ec81a`, Spyglass `spikesorting-v2`. These **re-prioritize the catalogue** — priority must reflect
*what actually happens downstream*, not the YAML alone. Corrections (each cited file:line in 05/06):

- **`power_in_W: 200` → CONFIRMED P0 silent corruption.** `convert_optogenetics.py:131` does
  `float()` → ndx `ExcitationSource.power_in_W = 200 W` verbatim, **no range check**; lands in the
  archived/DANDI NWB. (Real power is `power_in_mW` on the epochs table.) **Top guard.**
- **Volume `0.45`/`450` → DOWNGRADED (harmless).** Converter (`:290`) AND Spyglass
  (`common_optogenetics.py:303`) both read `volume_in_uL` = **0.45 (correct: 0.45 µL = 450 nL)**;
  `volume_in_ul: 450` is **dead — never read**. App already derives both. Risk only if hand-edited.
- **Space-separated keys → RECLASSIFIED loud, not silent.** Current trodes_to_nwb raises `KeyError`
  on `ntrode_electrode_group_channel_map` before any NWB for a normal ephys run
  (`convert_rec_header.py:122`); silent only if `behavior_only=True`. `metadata_validation.validate`
  only **logs**, never raises (`convert_yaml.py:59-61`). Still prevent/one-click-repair on import (the
  36 files exist), but it's a loud hard-fail, not silent electrode loss.
- **`times_period_multiplier "1.5cd"` → DOWNGRADED.** Field has **zero non-test consumers**; schema
  `number` mismatch only logged. `raw_data_to_volts` is only a fallback when the `.rec` lacks
  `rawScalingToUv` (`convert_ephys.py:378-383`). App's own AJV rejects non-numeric anyway → low priority.
- **Unresolvable `device_type` → LOUD `FileNotFoundError`** (`convert_yaml.py:218-221`); **authoritative
  known-probe set = exactly 12** (matched case-sensitively on the `probe_type` field). App CLAUDE.md
  catalog is **missing 4 of the 128-ch variants → widen it.**
- **MMDDYYYY filename → silent session mis-order** (`data_scanner.py:104-119` parses date as int + sorts).
- **Spyglass #1 DB win = `location` controlled-vocab + case-lock.** `BrainRegion.fetch_add`
  (`common_region.py:44-53`) auto-inserts a row per spelling, case-sensitive, no normalization →
  `hippocampus`/`Hippocampus`/`hippcoampus` = 3 rows, fragmented spatial queries.
- **`subject_id` case → CORRECTION vs 325-doc.** MySQL default collation is case-INsensitive → `RS10`
  and `rs10` **merge into ONE subject** (not two); consequence = same-animal static conflict hits
  `validate1_duplicate` → first-write-wins (silent value loss), not a fork. *(MED — depends on DB collation.)*
- **Experimenter name format → NEW Spyglass constraint.** `decompose_name` **raises** unless exactly
  `First Last` or `Last, First` (`common_lab.py:386-405`) → 3-token / middle-initial names lose
  experimenter linkage. The app should enforce/normalize name shape.
- **Electrode ndx columns all-or-nothing** (`common_ephys.py:157-181`): missing any of
  `probe_shank/probe_electrode/bad_channel/ref_elect_id` silently drops bad-channel marks AND probe
  linkage for the whole file. (These are trodes-generated — verify the app's export always yields them.)
- **`sex`/`species` are DANDI-only, NOT Spyglass** (sex normalized to M/F/U on ingest; species stored
  verbatim). Re-scope those guards as archive/DANDI compliance, not DB integrity.
- **Confirmed silent (app is the only gate):** out-of-range `bad_channel` never flags
  (`convert_ephys.py:286-289`); dangling `camera_id` silently dropped (`common_task.py:155-168`);
  all subject vocab logged-only → ships verbatim.

**Net:** opto value-errors are narrower than feared (only `power_in_W` truly corrupts the NWB); the
durable top guards are `power_in_W` range, `location` controlled-vocab+case-lock (Spyglass #1),
device_type-against-12-probes, experimenter name-shape, camera_id integrity, and same-animal static lock.

---

## P6 — cameras & video deep-dive (2026-06-17, user-flagged gap). Notes: `09-cameras-video-{downstream,corpus}.md`.

Cat-F treated cameras shallowly (id integrity + name casing). The user flagged the real complexity:
Spyglass keys `CameraDevice` on the **name**, a re-zoomed camera needs a distinct name, and the
video→task→epoch chain is fragile. Two agents (Spyglass/trodes source + corpus mining) confirmed it.
**Schema correction:** there is **no `meta_file_path`** field (0 files); the per-camera calibration is
**`meters_per_pixel`** (present in 100%).

- **CameraDevice PK = `camera_name` alone** (`common_device.py:291-300`) — a **global, lab-wide
  namespace**, no session/animal in the key. Reusing `camera 1` across rigs/animals **MERGES into one
  row** (`_expected_duplicates=True`), not a collision-fork.
- **NEW HIGH-SEVERITY SILENT CLASS — camera-name calibration aliasing.** Same `camera_name` + a
  *different* `meters_per_pixel` (a re-zoom / reposition) on second ingest → `validate1_duplicate`
  (`ingestion.py:367-444`): non-interactive → `DuplicateError` (hard fail); interactive-accept →
  **first-write-wins, the new calibration silently discarded** → wrong px→cm for the re-zoomed session
  (→ wrong position/velocity → wrong place fields). The schema never enforces unique-per-settings; only
  a **new distinct name** gives a re-zoomed camera its own calibration. **In the wild: 24 names map to
  ≥2 distinct `meters_per_pixel`; 15 vary WITHIN one animal across days** (e.g. Lewis `maze_camera`
  0.0025 vs 0.0016; `SleepBox_camera` 0.0014→0.20, 100× spread). Plus **`meters_per_pixel: 0` in 16
  rows** (silent position-conversion break).
- **Naming reality:** 118 names; convention `<Place><Position>_camera` (`HomeBox_camera`,
  `SleepBoxSide_camera`) encodes place/box but **never zoom**; 19.3% placeholder (`1` ×341, `camera`,
  `XXX`). 36 names reused across >1 animal, 22 across >1 experimenter (`HomeBox_camera` spans 35 animals,
  `sleep_camera` ≥6 groups) → real cross-rig merge exposure given the global namespace.
- **Video→task→epoch join + break points.** video→camera: `associated_video_files[].camera_id` → NWB
  `camera_device{id}` → `camera_name` → `CameraDevice.camera_name`. video→epoch: `task_epochs` →
  `TaskEpoch.epoch` → IntervalList + **≥0.9 timestamp overlap**. Breaks: dangling video `camera_id` =
  **hard KeyError at convert** (`convert_position.py:1291-1293`); missing `camera_name` in Spyglass =
  **silent skip** (`common_behav.py:502-509`); epoch with no TaskEpoch / <0.9 overlap = **silent drop**.
  `tasks[].camera_id` with no matching `cameras[].id` is **silently filtered** (warning, TaskEpoch still
  imports) — gentler than the video path.
- **Linkage in the corpus:** dangling video `camera_id` 1 file (Lotus `X`); dangling epoch 2 (SC65 ep 6);
  **3,410 video rows / 177 files (almost all Guidera) carry NO epoch key** → unlinked videos (Spyglass
  silently drops the link) — confirm whether that's a real convention vs a gap before gating.

**App state:** guards exist for camera_id uniqueness, dangling id, orphaned epoch
(`src/validation/rules/referenceRules.ts`); **nothing guards `camera_name` / `meters_per_pixel`** — the
aliasing + zero-calibration + cross-rig-merge cases are unguarded. This is the camera roadmap.

---

## P7 — empirical import test + epoch & statescript integrity (2026-06-17). Notes: `10`/`11`/`12`.

The most actionable phase: ran the app's **real** import code over the corpus + traced epochs and
statescript files end-to-end. The through-line of all three: **`task_epochs` typing (scalar-vs-list
value, singular-vs-plural key) is the single most consequential issue in the whole study.**

**[10] App import round-trip — ran the app's actual `decodeYaml → validate → buildImportRepairPlan →
applyImportRepairs → planImport` over 1,674 unique real files:**
- **Clean-import rate is only 16.7% (279/1,674).** 14.3% repairable in-app; **69.1% (1,156) hit a
  blocker the Import & Repair screen can't fix** (hand-edit required). Robustness IS good: **0 crashes,
  0 parse errors, 0 throws; and 0 top-level keys / 0 scalar values dropped on the files that DO import**
  (no silent loss on accepted files).
- **#1 blocker = a BUG in the current app, not bad data (`orphaned_file`, 1,051 files; 380 have no other
  blocker).** `associated_files[].task_epochs` is a **list `[2]`** in 1,050/1,051 real files, but
  `referenceRules.ts:200-228` does `Set.has([2])` (array vs scalar) → always false → false-positive
  "orphaned file"; the same array also trips a schema `type` error (schema declares scalar `integer`).
  **One shape mismatch blocks ~63% of the corpus.**
- #2: **No recording date (215)** — `extractRecordingDate` only parses the *template's* `mmddYYYY_..._
  metadata.yml`; real files are `YYYYMMDD_<subject>.yml` with short numeric `session_id` → rejected with
  no fixable field. (Ironic test-data-vs-real-data gap, exactly the trap flagged early.) #3 space-keys
  (35). Species/sex/weight ARE caught via suggestions; `1.5cd`/`unknown_device_type`/multishank missed.

**[11] Epoch linkage — epochs are implied (no `epochs:` list): union of `tasks[].task_epochs` (declaring,
schema array-int) ∪ `associated_files`/`avf[].task_epochs` (referencing, schema single-int). Intervals
are authoritative from the `.rec` filenames (`convert_intervals.py:35-66`); YAML epoch #s only tag
metadata Spyglass matches by ≥0.9 timestamp overlap (`common_behav.py:475`) — fail = silent drop.**
- **D8: `associated_video_files` singular-key-only `task_epoch` — 821 files.** `convert_yaml.py:71` does
  `file["task_epochs"]` (subscript) → **hard KeyError on the whole file** on current trodes_to_nwb.
  Biggest blast radius; ≤2022 era (singular→plural key flips ~2023, per-era).
- D6 singular/plural mixed in one file — 2 (SC131): singular rows silently dropped. D1/D2 dangling
  epoch — 4 (SC64/SC65). D4 gap — 10. D5 0-based — 76 (75 = xulu alone, self-consistent with `.rec`).
  D3 task-only epoch — 200 (benign sleep epochs; nudge not block).

**[12] associated_files (statescript) — field presence excellent (name/description/path ~all present,
0 empty, paths 7948/7977 absolute); defects rare but high-consequence, skewing legacy/imported:**
- **`task_epochs` scalar(3247)/list(4728) — 1,055 list-only files = the largest SILENT-drop surface.**
  trodes wraps unconditionally → list `[4]` becomes NWB string `"[4], "` → Spyglass `split(",")`
  epoch-match FAILS → **StateScriptFile never ingested** (verified by simulation).
- Description keyword-gate failures — 23 entries / 18 files (`'state sciript log'` typo j16; `'{description}'`
  template kf19) → silently skipped, no StateScriptFile row. Duplicate `name` in a file — 2 (Jaq,
  SC127) → **HARD-FAILS trodes** (pynwb ValueError, reproduced). Duplicate `path` — 3 (Bilbo points 4
  epochs at wrong logs) → silently wrong raw log. 27 relative + 2 bare-filename + 1 dir path → trodes
  `open()` logs + writes **empty content** → silent behavioral-data loss.

**Canonical fix (the highest-leverage single change in the study):** **read both `task_epoch`/`task_epochs`
keys and both scalar/list values on import; emit ONE convention on export** (associated_files value →
scalar to match schema + Spyglass `split(",")`; video epoch key → plural `task_epochs` to avoid the
KeyError) — and **fix `referenceRules.ts` to compare list-vs-scalar correctly** (unblocks 63% of imports).
This one axis touches the app's #1 import bug, the 821-file hard KeyError, and the 1,055-file silent
Spyglass drop.
