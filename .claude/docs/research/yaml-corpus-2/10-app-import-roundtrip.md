# App import round-trip against 1,674 real legacy YAMLs

**What this is:** an empirical robustness test of the app's *own* import code against the real lab
corpus. Not a reimplementation — it calls the exact functions the Import & Repair UI calls.

- **Repo / branch / commit:** `rec_to_nwb_yaml_creator`, branch `modern`, commit `b863272d`.
- **Corpus:** `/Users/edeno/Downloads/collected_metadata_yamls/**/*.{yml,yaml}`.
- **Selection:** `/Users/edeno/Downloads/yaml_analysis2/records.jsonl` — 1,799 records → drop 7
  `is_suspect` → dedup by `md5` → **1,674 unique files** (all 1,674 resolved on disk).

## Method — exact entry points called

A throwaway Vitest spec (run under the project's vite/vitest env so TS + the `@/` alias resolve;
**deleted after the run**, never committed — it references the external real-data path) fed each file
through the real pipeline, in the order the UI uses it (`src/pages/ImportRepair/index.tsx`):

1. `decodeYaml(text)` — `src/io/yaml.ts` (the `yaml` library parse).
2. `validate(model)` — `src/validation/index.ts` (AJV schema + business rules; the export gate's own
   validator).
3. `buildImportRepairPlan(model, sourceName, workspace)` — `src/state/importRepair.ts` (the repair
   spine: `items` / `blockers` / `benign` / `decision` / `hasErrors`).
4. `applyImportRepairs(model, {})` then `planImport([{sourceName, flatModel}], {animals:{}})` —
   `src/state/yamlImportPlan.ts` (the **true import gate**: subsumes `decomposeYaml` → `validate`,
   plus the importer-only preconditions a validator can't see — derivable recording date,
   route-safe subject_id, intra-batch dedup).

A second spec round-tripped every **gate-accepted** file through the export path
(`decomposeYaml` → `recomposeDayModel` → `mergeDayMetadata` → re-export) and diffed the re-exported
model's key-set and scalar values against the raw decoded model (field-fidelity / silent-drop check).

**"Clean import"** is defined as: `buildImportRepairPlan().hasErrors === false` **and**
`planImport` yields exactly one animal with one importable day and zero unimportable — i.e. the user
could import with no edits and no fix-in-file.

## Headline results

| Metric | Count | % of 1,674 |
| --- | --- | --- |
| **Clean import (no edits needed)** | **279** | **16.7%** |
| Repairable in-app **with edits** (no blockers, decision not blocked) | 239 | 14.3% |
| **Cannot repair in-app** (≥1 blocker or decision=blocked → must edit the file) | **1,156** | **69.1%** |
| Parse errors (`decodeYaml` threw) | **0** | 0% |
| Non-object / scalar / array documents | **0** | 0% |
| `validate` threw | **0** | 0% |
| `buildImportRepairPlan` threw | **0** | 0% |
| `planImport` threw | **0** | 0% |

**No crashes, no parse failures, no silent type-confusion explosions anywhere.** The pipeline is
defensively solid against malformed input — every one of the 1,674 files was handled and routed to a
typed outcome. The robustness problem is **not** crashes; it is that **83% of real files don't import
without intervention, and 69% can't be fixed in the Import & Repair screen at all** (they bounce the
user back to hand-edit the YAML).

## Failure taxonomy

Real files fail **many rules simultaneously** (a single file commonly trips `type` + `required` +
`enum` + `invalid_species` + `orphaned_file` at once), so "first error" understates each rule. Below
is the **file count each error code appears in** (deduped per file), plus the headline root cause.

| Code | Files | Root cause | In-app fixable? |
| --- | ---: | --- | --- |
| `type` | 1,126 | mostly `associated_files[].task_epochs` is a **list** (schema wants scalar `integer`); also `subject.weight` string, `experimenter_name` scalar, `session_id` numeric, `times_period_multiplier` typo | partial |
| **`orphaned_file`** | **1,051** | **FALSE POSITIVE** (see below) — `associated_files[].task_epochs` is a list `[2]`, compared `Set.has([2])` against scalar epochs → never matches | **NO (blocker)** |
| `required` | 1,024 | `subject.date_of_birth` missing (959); `tasks[0].task_environment` missing (836); `associated_video_files[].task_epochs` missing | partial |
| `enum` | 1,006 | `subject.sex = "Male"/"Female"` (933); legacy `electrode_groups[].device_type` not in enum | partial |
| `invalid_species` | 939 | `subject.species = "Rat"` (DANDI rejects free text) | suggestion |
| `multishank_bad_channels_ignored` | 129 | multi-shank probe with `bad_channels` on ntrode rows | **NO (blocker)** |
| `unknown_device_type` | 73 | legacy / retired probe `device_type` strings | **NO (blocker)** |
| `pattern` | 72 | `electrode_groups[].location` regex; some `date_of_birth` | partial |
| `empty_location` | 58 | electrode group with empty `location` | input |
| `duplicate_behavioral_event_description` | 39 | two DIO events share a description | **NO (blocker)** |
| `channel_partition_invalid` | 15 | multi-shank channel-map partition | **NO (blocker)** |
| `dangling_camera_ref` | 11 | task references an undefined camera id | **NO (blocker)** |
| others (`duplicate_task_epoch`, `orphaned_video`, `channel_row_count_mismatch`, `partial_configuration`, `bad_channel_out_of_range`, `fs_gui_requires_optogenetics`, `divergent_camera_identity`, `dangling_electrode_group_ref`) | 1–4 each | genuine cross-field issues | mostly NO |

Separately, **215 files** are rejected by `planImport` with **"could not determine the recording
date"** — not a validation error, an importer precondition (see below).

### The dominant failure is a bug, not bad data: `task_epochs` list vs scalar

- **1,050 of 1,051** `orphaned_file` failures are because `associated_files[].task_epochs` is a
  **list** (`- 2`) in the real file, while `src/validation/rules/referenceRules.ts:200-228` does
  `taskEpochSet.has(epoch)` with `epoch = file.task_epochs` — i.e. `Set([2,3,5]).has([2])`, which is
  **always false**. So a perfectly valid file that points file `r1` at epoch `[2]` is reported as
  referencing a non-existent epoch.
- The schema (`src/nwb_schema.json`) declares `associated_files[].task_epochs` / `associated_video_files[].task_epochs`
  as scalar `"type": "integer"`, but **1,050 / 1,051 real files use a list** — so the *same array*
  also trips a schema `type` error (`must be integer`) at the same path, which becomes a second
  blocker. The two errors are the same underlying list-vs-scalar mismatch.
- Net effect: this single shape mismatch blocks ~63% of the entire corpus, and **380 files have *no
  other* blocker** — fix this one class and those import immediately.
- *Spot-check (raw):* `alison/home/Desktop/20201028_senor.yml:21-31` — `associated_files` entry
  `statescript_r1` has `task_epochs:` → `- 2`, and `tasks` (`:137-157`) define `task_epochs` as lists
  too. The reference is valid; the app reports it orphaned.
- **Open question for the schema owners:** does trodes_to_nwb actually want a scalar or a list here?
  The corpus is ~unanimously a list; the schema says scalar. One of them is wrong and they disagree
  with reality. This needs to be resolved against trodes_to_nwb before "fixing" either side.

## What the Import & Repair flow CATCHES vs MISSES vs CRASHES

**CRASHES:** none. Zero files threw at any stage.

**CATCHES (offers a one-click suggestion):** the per-field shims work and fire on real data —

- `subject.species "Rat"` → `Rattus norvegicus` (939 files have free-text species; canon covers
  `rat/rats/long evans/sprague dawley/mouse/...`).
- `subject.sex "Male"/"Female"` → `M`/`F` (933 files).
- `subject.weight "547g"` → `547` (parses the leading number). **But 593 string-weights are the
  literal `"Unknown"`** → no suggestion, surfaces as a user-input row (correct, not a drop).
- `experimenter_name` scalar string → single-item list.
- `task_epoch` → `task_epochs` rename and `volume_in_uL`/`volume_in_ul` fill are listed as benign
  normalizations (93 files hit the volume-shim reconcile).

**MISSES (forces "fix in the file, then re-import"):** 1,156 files (69%) carry ≥1 blocker the screen
can't repair in place. The big systematic ones:

- `orphaned_file` (1,051) — the list-vs-scalar bug above; the user is told to "point it at an existing
  epoch" for a reference that is already valid. **Most damaging miss.**
- `multishank_bad_channels_ignored` (129), `unknown_device_type` (73),
  `duplicate_behavioral_event_description` (39), `channel_partition_invalid` (15),
  `dangling_camera_ref` (11) — genuine issues, but all dead-end the user with no in-app path.
- **Space-keyed legacy files (35) are silently un-attributable.** Files like
  `alison/home/Downloads/20210326_wilbur.yml:7-13` use **`subject id:` / `data acq device:` with
  spaces** instead of `subject_id` / `data_acq_device`. The app reads `subject.subject_id` as
  `undefined` → decision **blocked** ("no subject_id"). The id (`wilbur`) is right there in the file
  under a space-key the app never reads. These are flagged `missing_subject_id` in records.jsonl but
  are really a key-spelling variant. *(Spot-check: weight on that file is `540g`, species `Rat`, sex
  `Male` — a textbook legacy file.)*

**A real UX dead-end the screen doesn't surface well:** **168 files pass the repair screen with zero
flags (no items, no blockers, `hasErrors=false`) but `planImport` still refuses them** — all 168 on
**"could not determine the recording date."** The button correctly stays disabled (the
`importBlockReason` fall-through shows the reason), but the screen offers nothing to act on: there is
no date field to fill. Root cause is the **filename-convention mismatch** —

- Importer primary date source (`extractRecordingDate`, `yamlImportPlan.ts:94-121`) expects
  `{mmddYYYY}_{subject}_metadata.yml`. Real files are `{YYYYMMDD}_{subject}.yml`
  (e.g. `20230722_Bilbo_metadata.yml`): `20230722` parses as month=20 → invalid, and the regex also
  requires the literal `_metadata.yml` suffix that many files lack.
- Fallback is `session_id` ending in `_YYYYMMDD`. That rescues `senor_20201028` but **fails the 215**
  whose `session_id` is a short counter — e.g. `amankili/cumulus/Bilbo/metadata/20230724_Bilbo_metadata.yml:7`
  has `session_id: "2"`.
- The date *is* in the filename as `YYYYMMDD`; the importer just doesn't read that layout.

## Field fidelity (silent data loss)

For the **277 gate-accepted files** that round-tripped through the full export path:

- **0 files dropped any top-level key.**
- **0 files changed any spot-checked scalar** (`subject_id`, `species`, `sex`, `weight`,
  `date_of_birth`, `genotype`, `session_id`, `session_description`, `experimenter_name`, `lab`,
  `institution` all survived verbatim).
- 75 are byte-identical (key-order-normalized); the other 202 differ **only by the app ADDING** empty
  scaffolding keys trodes_to_nwb expects (`opto_excitation_source: []`, `optical_fiber: []`,
  `virus_injection: []`, `fs_gui_yamls: []`, `optogenetic_stimulation_software: ''`). Additive, not
  lossy.

**Conclusion on fidelity:** for files that *do* import, the importer is faithful — no silent drops or
mis-typing observed. The risk is entirely on the *gate* side (files that should import but don't),
not the *attribution* side.

## Clean-rate by legacy variant

| Variant | Clean / total | Note |
| --- | --- | --- |
| `species = "Rat"` (938 files) | low | needs the suggestion (caught) |
| `sex = "Male"` (931) | low | needs the suggestion (caught) |
| weight string-with-unit (777) | low | `"547g"` caught; `"Unknown"` (593) → input |
| DOB missing (959) | — | required input, blocks until supplied |
| DOB py-datetime (712) | mixed | `yaml` decodes `2022-12-17 00:00:00` → ISO string `"…T00:00:00.000Z"`, which passes (only 13 `pattern@date_of_birth` errors corpus-wide) |
| MMDDYYYY filename (7) | 5/7 (71%) | the *only* layout the importer's primary date parser reads |
| YYYYMMDD filename (1,461) | 274/1,461 (19%) | the real-world norm; date relies on session_id fallback |
| missing/space-key subject_id (35) | 0/35 | space-key variant `subject id:` → un-attributable |
| placeholder_id (3) | 0/3 | correctly blocked |
| opto present (176) | 95/176 (54%) | opto path is comparatively healthy |
| 0 electrode groups / behavior-only (78) | 40/78 (51%) | behavior-only files import fine when other fields are clean — no false electrode gating |
| `times_period_multiplier: 1.5cd` (the prompt's string) | blocked | `sunrae/cumulus/20260415_ST10_01_etx/20260415_ST10_metadata.yml:50` — a typo'd number decodes to the string `"1.5cd"` → `type` blocker, no suggestion |

## Recommendations (highest-value import-hardening fixes)

1. **Fix the `task_epochs` list-vs-scalar handling (unblocks ~63% of the corpus, 380 files
   single-handedly).** Resolve the schema/reality disagreement *with trodes_to_nwb first* (does it
   want a list or a scalar at `associated_files[].task_epochs`?), then make both the schema and the
   `orphaned_file` rule (`referenceRules.ts:200-228`) treat the value as a list consistently — the
   rule must check *each* element against the epoch set, not the whole array. This is the single
   biggest lever and is a correctness bug, not just UX.

2. **Read the `{YYYYMMDD}_{subject}` filename layout in `extractRecordingDate` (unblocks 215 files).**
   The current primary parser only accepts `{mmddYYYY}_{subject}_metadata.yml`. Add the YYYYMMDD
   leading-date layout (with/without the `_metadata` suffix). When the date still can't be derived,
   the repair screen should surface an explicit **"recording date"** input rather than a disabled
   button with a passive reason.

3. **Normalize space-keyed legacy keys on decode (unblocks 35+ files, prevents silent
   un-attribution).** Map `subject id`→`subject_id`, `data acq device`→`data_acq_device`, etc. as a
   benign normalization (listed, not silent). A file that has `wilbur` under `subject id:` must not
   read as "no subject_id."

4. **Make the common type-coercions repairable instead of blocking.** `times_period_multiplier` /
   `raw_data_to_volts` string-with-typo (`"1.5cd"`) and `session_id` numeric should get the same
   parse-to-number suggestion treatment that `subject.weight` already has, instead of becoming
   fix-in-file `type` blockers.

5. **Give the multi-error legacy files a path forward, or set expectations.** `unknown_device_type`
   (73), `multishank_bad_channels_ignored` (129), and `duplicate_behavioral_event_description` (39)
   are real but currently dead-end the user. At minimum, batch these into the repair screen with a
   device-type remap picker / a "clear ignored multi-shank bad_channels" action, so a legacy file
   isn't an all-or-nothing fix-in-a-text-editor task.

**Bottom line:** the importer never crashes and never silently loses data on the files it accepts —
those are genuine strengths. But only **16.7%** of real legacy files import without intervention, and
the largest single cause (~63%) is a **list-vs-scalar bug** in the `task_epochs` schema/rule, not bad
data. Fixing recommendations 1–3 would plausibly move clean-or-trivially-repairable from ~31% to a
large majority of the corpus.
