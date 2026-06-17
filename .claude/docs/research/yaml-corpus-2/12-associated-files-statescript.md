# Category K — `associated_files` (statescript logs) INTERNAL integrity

**Scope:** the file-reference internals (name / path / description) of every
`associated_files[]` entry across the corpus. The epoch *graph* (which epochs are
declared by tasks vs referenced by files) is owned by the parallel epoch-linkage
agent (`11-epoch-linkage-integrity.md`); here we touch epoch only as a
*file-reference* signal (name-vs-epoch, duplicate-path-per-epoch).

**Substrate / reproducibility:**
- Extractor: `~/Downloads/yaml_analysis2/cat_k_assocfiles.py` →
  `cat_k_records.jsonl` (per-file) + `cat_k_agg.json` (aggregates). Re-parses raw
  YAML (records.jsonl only stores `n_associated_files`), joins to records.jsonl on
  `rel` for hygiene flags. `matched=1799 extracted=1799 parse_fail=0`.
- **Filter applied everywhere below: `is_suspect == False`** (1792 of 1799 files).
- Downstream read from local checkouts (readable this session):
  `trodes_to_nwb/src/trodes_to_nwb/convert_yaml.py`,
  `spyglass/src/spyglass/common/common_behav.py`.

**Population:** 1656 / 1792 non-suspect files carry ≥1 `associated_files` entry
(matches the prompt's 1656/1792); **7983 total entries**; 136 files have zero.

---

## 1. Field presence / typing  *(confidence: HIGH — full parse + raw spot-checks)*

| Field | present / 7983 | empty | non-string | type |
| --- | --- | --- | --- | --- |
| `name` | 7977 | 0 | **1** | string (1 int-coerced) |
| `description` | 7977 | 0 | 0 | string |
| `path` | 7977 | 0 (`path_empty`) | 0 | string |
| `task_epochs` | 7975 | — | — | **scalar int 3247 / list 4728 / missing 2** |

Field presence is excellent: name/description/path are essentially universal
(the ~6 missing-per-field are the handful of non-dict entries). **No empty
strings.** Conventions:

- **`name`** — two camps: `statescript_rN` label style (most experimenters) vs
  `<date>_<animal>_<rec>_<run>.stateScriptLog` *filename* style (chiang sharon
  267/267; kyu mixed). Names are **labels, not paths** — `name != path-basename`
  in 6803 entries (expected, not a defect).
- **`description`** — controlled-ish free text, 76 distinct normalized values but
  3 dominant families, clean per-experimenter (see §6): `Statescript Log` (2796),
  `stateScriptLog epoch rN` (guidera/chiang), `state script log run N`
  (alison/coulter/mankili). Non-statescript descriptions exist for non-log
  attachments: `Behavior timeline` (94, .csv), `Psychopy stim generation
  script…` (141, .py), `fsgui log` (20).
- **`task_epochs` scalar-vs-list** is the same two-typing Cat-F found (3247 scalar
  / 4728 list; 593 scalar-only files / 1055 list-only / 0 within-file mixed). It
  is **load-bearing downstream** — see §5.

`name_nonstring=1`: `zoldello/.../01172024_army_metadata.yml`
`name: 20240117174644` (YAML auto-typed a bare digit-string to **int**) — RAW
verified. `AssociatedFiles(name=<int>)` risks coercion/validation surprises.

---

## 2. `path` integrity  *(confidence: HIGH — full parse + 5 raw spot-checks)*

Paths are **absolute Unix mount paths** almost universally:

| shape | entries | note |
| --- | --- | --- |
| absolute (`/stelmo/…`) | **7948** | the norm |
| relative (no leading `/`) | **27** | same mount, missing `/` — breaks `open()` |
| filename-only | **2** | bare `20230909_…stateScriptLog` |
| empty / missing / non-string | 0 | — |

Path roots are the lab mounts: `stelmo` 4344, `cumulus` 1910, `nimbus` 1233,
`mnt` 244, `squall-f` 201. **Within-file root is consistent** except 4 files with
≥2 roots — RAW-verified the two real ones:
- `…/SC127/20250921_SC127_metadata.yml` — one entry `.stelmo/…` (leading-dot
  typo) among `/stelmo/…`.
- `kyu/.../L16/20250228` & `L14/20240611` — mix `stelmo` + `squall-f`/`nimbus`
  (the *non*-statescript stim `.py` lives on a different mount; plausibly real).

The 27 "relative" entries are real paths **missing the leading `/`** (RAW: e.g.
`cumulus/baibhav/BS28_raw/…` vs sibling `/cumulus/baibhav/…` in the same file).
`trodes_to_nwb` calls `open(file["path"])` **literally** (convert_yaml.py L436), so
a relative path resolves against CWD, not the mount → FileNotFoundError → silent
empty content (§5). Concentrated in `zoldello` (army re-exports) + `kyu/army`.

**One path points at a directory, not the file:**
`sambray/.../20210722_J16_metadata.yml` — every `path` ends `…_01_sleep/`
(trailing slash, directory) while the `name` carries the real
`.stateScriptLog` filename. RAW-verified. `open(dir)` → `IsADirectoryError`
(an OSError) → caught → silent empty content for **all** epochs in that file.

---

## 3. `name` integrity — duplicates & collisions  *(confidence: HIGH — RAW + pynwb repro)*

**Duplicate `name` within a file = 2 files** (NWB processing module
`data_interfaces` is a name-keyed dict). Both RAW-verified as genuine distinct
files sharing a name:

| file | collision | raw evidence |
| --- | --- | --- |
| `amankili/.../Jaq20190827_metadata.yml` | `statescript_r3` ×2 | idx2 → `_06_` (ep6), idx3 → `_08_` (ep8); idx3 should be `statescript_r4`. |
| `sc4712/.../SC127/20250918_SC127_metadata.yml` | `…_03_r1.stateScriptLog` ×2 | name reused for `…_10_r2` path (ep10). Name **and** epoch wrong. |

**Downstream consequence is a HARD-FAIL, not silent** (verified by running
pynwb + `ndx_franklab_novela` this session): `ProcessingModule.add([...])` with a
duplicate name raises `ValueError: Cannot add … 'dup' … to dict attribute
'data_interfaces'`. Because `add_associated_files` adds the whole list in one
call (convert_yaml.py L458), **the entire NWB conversion for that session aborts**
until the name is de-duplicated. (Worse than silent for those 2 days, but
discoverable.)

**Duplicate `path` within a file = 8 files**, but they split into two classes
(RAW-verified):
- **Real behavioral-data loss (statescript):**
  `amankili/.../20230724_Bilbo_metadata.yml` — 6 statescript entries but only
  paths `_02_` and `_04_` appear; r3–r6 (epochs 6/8/10/12) **repeat** `_06_`,
  `_04_`, `_02_`, `_04_`, so epochs 8/10/12 silently point at the **wrong raw
  log** and the true `_06_/_08_/_10_/_12_` logs are never referenced.
  `rio/.../20250522_RS38_metadata.yml` — epoch 4 reuses epoch 2's `_02_r1` path.
  `…/SC127/20250921…` — epoch 6 reuses epoch 4's `_04_r2` path.
- **Legitimate / low-severity reuse:** `kyu/.../L15/2024…` (×4) — a single
  `stim1.py`/`stim3.py` psychopy script genuinely drives multiple epochs (reuse
  is intentional), though `stim4`→`stim3.py` looks like a slip. `sambray/.../
  20230622_sample_metadata.yml` — `path/` is the trodes **test-fixture
  placeholder**, not real data.

Placeholder/template names: **0 empty names**, but
`kkay/.../kf19/20170824_old.yml` ships the **unrendered template literal**
`description: '{description}'` on all 6 entries (RAW-verified) — see §5 gate.

---

## 4. Count / per-day variation  *(confidence: MED-HIGH)*

`n_associated_files` is legitimately day-owned (statescript per epoch): peaks at
1 (421 files), 5 (333), 8 (211); range 0–18 (max
`shijie/.../20240224_shylu.yaml`). Not anomalous on its own.

**0-associated-files anomalies (statescript missing):** 136 non-suspect files
have none. Of those, 76 still have electrode groups + cameras/video. Most are
single-epoch `home`/`rest`/`sleep` days where no statescript is expected
(plausibly legitimate). The **genuinely-suspect subset = 6 files**: ephys days
with a **run / spatial-bandit task** but zero statescript logs (RAW task-name
check) — e.g. `alison/.../20201108_senor.yml` (`sleep`,`spatial bandit task`),
`rio/.../20250804_RS45` (`sleep`,`run`), 4× alison bandit days. Those run epochs
lose their behavioral-protocol record entirely. (Two of the 6 are the same animal
under two export paths — `all_rat_metadata_yaml` copies.)

---

## 5. Downstream consumption — what silently drops  *(confidence: HIGH — source + repro)*

**trodes_to_nwb `add_associated_files` (convert_yaml.py L417-458):**
- Opens `file["path"]`, reads content into an `ndx_franklab_novela.AssociatedFiles`
  (name, description, content, task_epochs). **`FileNotFoundError` / `OSError` are
  caught and only `logger.info`-logged (L438-443)** → the AssociatedFiles object is
  still created with **empty `content`**. So a dangling/relative/directory path =
  **silent behavioral-data loss** (empty log in the NWB, no exception). This is the
  consequence for the 27 relative paths + 1 directory path + any truly-missing file.
- `load_metadata` (L66-68) runs first and **unconditionally wraps**
  `file["task_epochs"] = [file["task_epochs"]]`.
- L445 then joins: `"".join(str(e)+", " for e in task_epochs)`.

**The scalar-vs-list typing becomes a Spyglass silent-drop** (verified by
simulation + reading `common_behav.py`):

| YAML `task_epochs` | after L68 wrap | NWB string (L445) | Spyglass `split(",")` | `str(epoch) in` |
| --- | --- | --- | --- | --- |
| `2` (scalar) | `[2]` | `"2, "` | `["2"," "]` | **✓ match** |
| `[4]` (list) | `[[4]]` | `"[4], "` | `["[4]"," "]` | **✗ FAIL** |
| `[1,2]` (list) | `[[1,2]]` | `"[1, 2], "` | `["[1"," 2]"," "]` | **✗ FAIL** |

**Spyglass `StateScriptFile.make` (common_behav.py L389-448)** ingests into table
`StateScriptFile (-> TaskEpoch; file_object_id)`. It iterates the
`associated_files` processing module and inserts a row **only when BOTH**:
1. `description.upper()` contains `STATESCRIPT` / `STATE_SCRIPT` / `STATE SCRIPT`
   (L436-439), **and**
2. `str(key["epoch"])` ∈ `task_epochs.split(",")` (L440).

If either fails the entry is **silently skipped** (`logger.info("not a statescript
file")`, no row, no error). Consequences:
- **List-typed `task_epochs` (4728 rows / 1055 files) → condition 2 fails** →
  StateScriptFile not ingested for those epochs. This is the **largest silent-drop
  surface** and is purely a typing artifact.
- **Description not matching the keyword gate → condition 1 fails.** Measured:
  **23 statescript-extension entries fail the gate** (`ss_ext_but_desc_no_match`),
  across ~20 files, two causes (RAW-verified):
  - `description: 'state sciript log run 5'` — **typo "sciript"** — j16 era 2021,
    alison/sam (18 files, the r5 epoch of each → ep r5's statescript silently
    dropped from Spyglass for every j16 session that day-range).
  - `description: '{description}'` — kf19 `20170824_old.yml` (unrendered template,
    all 6 epochs dropped).
- Inverse: **13 entries whose description passes the gate but path is NOT a
  `.stateScriptLog`** — `sambray/.../20210722_J16` (paths are directories §2);
  Spyglass would ingest them as statescript with empty content.

**Duplicate name → trodes conversion HARD-FAILS** (`ValueError`, §3) before
Spyglass is reached — blocks the whole NWB for that session.

Spyglass also requires `TaskEpoch` to exist for the epoch (FK), so a dangling
epoch number that has no TaskEpoch row simply never matches → silent skip (the
epoch-graph agent owns that side).

---

## 6. Conventions by experimenter / era  *(confidence: HIGH)*

| experimenter | `name` style | `description` style |
| --- | --- | --- |
| coulter/kastner (david) | `statescript_rN` (+labels) | `Statescript Log` |
| chiang sharon | `…stateScriptLog` filename | `stateScriptLog epoch rN` |
| guidera jennifer | `statescript_rN` | `stateScriptLog epoch rN` |
| alison comrie | `statescript_rN` | `state script log run N` |
| coulter michael | `statescript_rN` | `state script log run N` |
| mankili abhijith | `statescript_rN` | `state script log run N` |
| sun xulu / gu shijie | `statescript_rN` | `Statescript Log` |
| kyu (adenekan/hyun) | mixed (filename + label) | mixed |

Each experimenter is internally consistent. All three dominant description
families pass the Spyglass keyword gate — the gate failures are **isolated typos
/ unrendered templates**, not a whole convention. Era: the j16 `sciript` typo and
kf19 `{description}` template are both **legacy (2017/2021)** hand-authored YAMLs;
the integrity defects skew strongly to pre-app, imported files.

---

## 7. App-guard implications  *(this app is the real gate — downstream is silent)*

The current app already writes the **safe convention**: schema declares
`associated_files[].task_epochs` as `type: integer` (scalar), and the add-item
template uses a scalar value → app-authored files round-trip correctly through
Spyglass. The integrity defects above are overwhelmingly in **legacy / imported**
YAMLs, so the guards matter most on **import** and **re-save normalization**.

Highest-value guards (cheap, each catches a confirmed real silent-loss class):

1. **Normalize `task_epochs` to scalar int on export/re-save; read both
   scalar+list on import.** Kills the list-typed Spyglass epoch-match silent drop
   (4728 rows / 1055 files) — the single largest silent-drop surface, and a pure
   typing fix with no shape change for the common case.
2. **Require `description` to contain a statescript keyword for `.stateScriptLog`
   paths (and offer a controlled default like `"Statescript Log"`).** Block/flag
   `'{description}'` and typos like `'state sciript log'`. Directly prevents the
   23-entry Spyglass-gate silent drop. (Mirror the exact Spyglass keyword set:
   `statescript` / `state_script` / `state script`, case-insensitive.)
3. **Reject duplicate `name` within `associated_files`** (and ideally duplicate
   `path`). Duplicate name HARD-FAILS trodes conversion; duplicate path silently
   re-points an epoch at the wrong raw log (Bilbo: 4 epochs). Both confirmed real.
4. **Path shape guard:** require absolute (leading `/`, or a drive root); flag
   bare-filename, leading-`./.stelmo` typos, and **paths ending in `/`**
   (directory, not file) — each maps to a silent empty-content log downstream.
   Optionally warn when the `_NN_` rec token in `path` disagrees with `name`'s.
5. **Nudge (not block) statescript presence on run/track epochs:** when an epoch's
   task is a run/track/bandit task and no `associated_files` entry references it,
   warn (the 6 zero-statescript run days). Keep it a *nudge* — behavior-only and
   home/rest/sleep epochs legitimately have no statescript.

> Cross-section note (defer the graph): name/path frequently encode a rec-number
> `_NN_` that is **not** the task epoch (sleep epochs shift the run index), so a
> raw `_NN_` vs `task_epochs` mismatch is mostly the legitimate rec≠epoch
> convention — only the **duplicate-path** cases are unambiguous file-reference
> errors. The true epoch referential-integrity check belongs to
> `11-epoch-linkage-integrity.md`.
