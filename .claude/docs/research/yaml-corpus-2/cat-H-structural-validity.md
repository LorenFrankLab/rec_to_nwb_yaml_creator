# Category-H — Structural / schema validity (the hard-fail & silent-loss tier)

**Corpus:** 1,814 real-world `*_metadata.yml` files. 1,799 parse (in `records.jsonl`); 15 are
unparseable (only in `BROKEN_YAML_REPORT.tsv` / REPORT2). I own the highest-COST class: errors that
**hard-fail the converter** or **silently drop data** before any value-level validation can run.

Scripts (deterministic, `uv run`, pyyaml): `cat_h_broken.py` (Q1), `cat_h_structural.py` (Q2/Q3/Q5),
`cat_h_typing.py` (Q4) in `/Users/edeno/Downloads/yaml_analysis2/`. Every numeric claim below was
spot-checked against the raw file at the cited path+line.

---

## Summary

Three structural failure modes dominate the cost axis, all REAL (not `is_suspect` artifacts):

1. **36 files lose ALL electrodes silently** — space-separated top-level keys (`electrode groups:`,
   `ntrode electrode group channel map:`). The converter keys on the underscored names, finds the
   space-named keys, and reads **zero** electrode groups. The file "converts"; the ephys is gone.
2. **15 files never parse at all** — 3 distinct YAML-syntax classes, all shallow typos
   (under-indented list item ×2; a dropped `task_epochs:` label replicated across 13 xulu/Lily days;
   1 file absent from disk). These hard-fail at `yaml.load` before conversion starts.
3. **53 files put a string in a numeric field** — `times_period_multiplier: 1.5cd` (sunrae, ST*
   animals). A trailing typo turns a Draft-2020-12 `number` into a string; AJV/jsonschema reject it.

The near-universal invariants hold: `raw_data_to_volts` = `1.95e-07` in 1,787/1,799 (9 real
violators); `times_period_multiplier` = `1.5` in 1,652 (the rest are the `1.5cd` typo, integer `1`, or
a `2.5`). **Zero exact duplicate keys** in the entire corpus. The only case-variant sibling is the
known `volume_in_uL`/`volume_in_ul` shim (146 occurrences, all expected — derive-both, never a bug).

---

## Findings

### Q1 — The 15 unparseable files (3 error classes)

| # | error class | files | mechanism | recoverable? |
|---|---|---|---|---|
| A | under-indented list item | 2 | one `- name:` indented **1 space** where siblings use 2 (`sp=1` vs `sp=2`) → `expected <block end>, but found '<block sequence start>'` | **Yes** — 1-keystroke fix |
| B | dropped mapping key | 13 | `task_epochs:` label omitted; a bare `  - 7` floats under `path:` → `expected <block end>, but found '-'` | **Yes** — insert `task_epochs:` |
| C | absent from disk | 1 | `jhbak/.../kf2_20170201_metadata.yml` cited "could not find expected ':'" @155, but **not present** in the collection (only `kf2_20170120` exists, which parses) | unknown — file not collected |

**Class A — under-indented list item (recoverable typo).** Both are `associated_video_files` rows.
- `ebroyles/home/yaml/SC18/generated/mine/20230517_SC18_metadata.yml` **L113**: `' - name: 20230517_SC18_04_r2.1.h264'` (1 leading space) between two 2-space siblings (L110, L116).
- `sc4712/home/yaml/SC131/to check/20251124_SC131_metadata.yml` **L142**: `' - name: 20251124_SC131_09_h1.2.h264'` (1 space). Note this file's folder is literally `to check/` — the author knew.
Both are pure indentation slips; auto-fixable by re-indenting the orphan to match siblings.

**Class B — dropped `task_epochs:` key (recoverable, replicated 13×).** Every file is
`xulu/stelmo/recordings/Lily/raw/<date>_Lily_metadata.yml`, **identical** structure at L57–60:
```
- description: Statescript log
  name: statescript_r4
  path: /stelmo/xulu/recordings/Lily/raw/<date>/<date>_Lily_07_r4.stateScriptLog
  - 7          # <-- task_epochs: label missing; sibling r3 block (L52-56) has it
```
The preceding statescript blocks (e.g. `statescript_r3`) correctly write `task_epochs:\n  - 5`. Only
the **last** block (`statescript_r4`) lost the `task_epochs:` label. It is the same template error
copy-pasted across 13 recording days (20251208–20251225). One root cause, 13 broken files. The fix is
mechanical: insert `  task_epochs:` before the orphaned `  - 7`. **Confidence: high** (all 13 read).

**Class C — `jhbak/.../kf2_20170201`.** Listed in the TSV (error "could not find expected ':'" @155)
but **`p.exists() == False`** and `rglob('kf2_20170201*')` returns nothing — the file was *not* in the
collected corpus (the collector likely failed to copy it, or it was deduped). Cannot root-cause the
syntax. **Confidence: high that it is uncollected; the error itself is unverifiable.**

> Severity note: Class A/B are *loud* hard-fails — the converter stops, the user gets a stack trace and
> fixes it. They are far **less dangerous** than the Q2 silent loss below. They matter because they
> recur (13 identical) and because the app could prevent them entirely (schema-validate on export).

### Q2 — Space-separated top-level keys (SILENT total electrode loss — top severity)

**Claim: 36 files silently lose all electrodes; 1 more uses a wholly non-standard key.**

| metric | value |
|---|---|
| files with ≥1 space-containing top-level key | **37** |
| files with electrode-LOSS space keys (`electrode groups` / `ntrode electrode group channel map`) | **36** |
| by user | alison 26, jhbak 4, amankili 3, loren 2, jguidera 1, emonroe 1 |
| by year | 2021: 22, 2020: 4, 2017: 3, 2019: 3, undated: 5 |

Distinct space-keys and their counts: `electrode groups` 36, `experiment description` 35, `ntrode
electrode group channel map` 35, `experimenter name` 34, `session description` 34, `data acq device`
32, plus one outlier `ntrode probe channel map` 1.

**Raw evidence (spot-checked):** `alison/home/Downloads/20210326_wilbur.yml`
- L1 `experimenter name: Alison Comrie`, L4 `experiment description:`, L5 `session description:`
- L218 `electrode groups:` followed by **fully-populated** tetrodes (L219 `- id: 0`, `location:
  CorpusCallosum`, `device_type: tetrode_12.5`, … 32 groups), L535 `ntrode electrode group channel
  map:`.

trodes_to_nwb reads `metadata["electrode_groups"]` (underscore). The space-keyed `electrode groups:`
key is never read → **zero electrode groups, zero ntrodes, zero channels** ingested. The file parses,
"converts," and produces an NWB with no ephys. This is the single highest-COST class in the corpus:
*irreversible silent data loss masquerading as success*. (Matches prior study §5 "hard-fail
conversion"; prior study found 3 `Re_round2/*` — this larger corpus has **36**, mostly alison 2021.)

**Outlier — `loren/home/Src/NWB/yaml/chimi_metadata.yml`:** uses `ntrode probe channel map:` (L210),
a name that is *neither* the underscored standard *nor* the space-variant of it — it is a different
phrase entirely (the file even has a comment questioning the name). Same silent-loss outcome for the
ntrode map.

**Falsifier:** if trodes_to_nwb used a space/underscore-insensitive key lookup, these would convert
fine. It does not (the schema and loader use underscored literals); confirmed by prior study reading
the converter source. Re-verify against `trodes_to_nwb` `metadata_validation.py` / `convert_*` if the
converter changes.

### Q3 — Duplicate / case-variant keys

- **Exact duplicate keys: 0** across all 1,799 parseable files (`n_dupe_keys` sums to 0; matches
  REPORT2 and prior study §6 "no exact duplicate keys exist"). The silent-keep-last hazard is **not**
  realized in this corpus. **Confidence: high.**
- **Case-variant sibling keys: 73 files, 146 occurrences, ALL** `('.virus_injection[]',
  'volume_in_uL', 'volume_in_ul')`. This is the **expected** converter↔schema compatibility shim
  (converter reads `volume_in_uL`, bundled schema requires `volume_in_ul`; the app emits both from one
  value — see `workspaceUtils` derive-both). **No other case-variant siblings exist** — no
  `Location`/`location`, no `Device_type`, nothing. **Confidence: high** (`casevar entries not volume
  shim: 0`).

### Q4 — Typing inconsistency (same field, scalar vs list / number vs string)

Types as parsed by pyyaml (counts are row-level for array fields):

| field | distribution | interpretation |
|---|---|---|
| `associated_files[].task_epochs` | **list 4,742 / int 3,276** | genuine scalar↔list split (same field, two shapes) |
| `associated_video_files[].task_epochs` (plural) | int 8,896 / list 28 | overwhelmingly scalar; 28 list outliers |
| `associated_video_files[].task_epoch` (**singular key**) | int 4,502 / str 1 | a *different key name* for the same concept — key-name split, not type split |
| `tasks[].camera_id` | list 4,066 (all) | consistently list |
| `associated_video_files[].camera_id` | int 16,821 / str 13 | mostly scalar; 13 stringly-typed |
| `times_period_multiplier` | float 1,653 / int 91 / **str 53** | the `1.5cd` typo (see Q5) |
| `raw_data_to_volts` | float 1,788 / int 8 | int `1` placeholders (see Q5) |

**Two real problems:** (1) `associated_files[].task_epochs` is scalar in some rows and a list in
others — a downstream consumer that assumes one shape mishandles the other (prior study §6: scalar
1212 / list 463 at file level; here 3276/4742 at row level — same phenomenon, larger corpus).
(2) `task_epoch` (singular) vs `task_epochs` (plural) in video files is a **key-name** divergence
(4,502 singular rows vs 8,896 plural) — a consumer keying on one name drops the other's epoch links.
**Confidence: high** (counted by re-parsing every file).

### Q5 — Value variants & invariants

**Near-universal invariants — and their violators:**

- `raw_data_to_volts`: **1.95e-07 in 1,787** files. Violators (9): seven files write integer `1` (a
  placeholder, not a real gain — `kenny`, `kyu`, `sambray`, `zoldello`, the `kf19`/`L9`/`army`
  files), one writes `0`, and **`2.95e-07`** in `zoldello/home/Documents/data/yml/kf2_20170120_metadata.yml`
  L44 (a *different ADC gain* — plausibly a real alternate hardware value, not a typo; flag, don't
  auto-correct). 3 files have it absent.
- `times_period_multiplier`: **1.5 in 1,652** files. Violators: **53 `'1.5cd'`** (string, sunrae ST*
  animals — `20250605_ST02_hab/...` L43 confirmed; a trailing-typo that breaks the numeric type), 90
  integer `1`, one `2.5`, one `0`. The `1.5cd` set is the most actionable: 53 files, one author,
  consistent typo → a number field silently became a string and **fails AJV/jsonschema `number`**.

**`units.analog` / `units.behavioral_events`** (identical distribution across both):
`'unspecified'` 1,096 · `"'unspecified'"` (literal quotes embedded) 335 · `'-1'` 228 · `'1'` 132 ·
`'Unknown'` 3 · `'unknown'` 3 · null 2. The `"'unspecified'"` form is a **double-quoting bug** — the
file literally contains `analog: "'unspecified'"` (confirmed `sc4712/.../20251124_SC131...` L146), so
the *value* includes the inner single quotes. Plus `-1`/`1` numeric-as-units and `Unknown`/`unknown`
case-variance. 6+ encodings for what should be one canonical value.

**`default_header_file_path`:** `'default_header.xml'` 1,542 (the norm) · **`''` (empty) 128** ·
absolute author-specific paths (xulu `four_probes.xml` 34, etc.). The empty-string 128 is a structural
gap (converter expects a header path); the absolute paths are machine-specific and non-portable.

**`data_acq_device.system`:** `MCU` 899 · `SpikeGadgets` 860 · `Main Control Unit` 6. Three names for
the same acquisition system (prior study §6 noted 3; same here, MCU now slightly more frequent).

---

## Error classes ranked by severity × frequency × COST

| rank | class | files | COST | why |
|---|---|---|---|---|
| 1 | **Space-separated top-level keys** (Q2) | 36 (+1 non-std) | **CRITICAL — silent total electrode loss** | converts "successfully" with zero ephys; irreversible; invisible to the user |
| 2 | **String in numeric field** `1.5cd` (Q5) | 53 | HIGH — schema-reject / silent coercion | breaks Draft-2020-12 `number`; if tolerated, a garbage multiplier |
| 3 | **Unparseable syntax** (Q1 A+B) | 15 | HIGH but **loud** | converter hard-stops; user sees it; 13 are one replicated template typo |
| 4 | **`task_epochs` scalar↔list + `task_epoch` name split** (Q4) | 1000s of rows | MEDIUM — partial epoch-link loss | shape/name mismatch drops some files' epoch associations downstream |
| 5 | **`units` 6-way encoding incl. `"'unspecified'"`** (Q5) | 335 double-quoted + variants | LOW–MED | mostly cosmetic but the embedded-quote value is wrong |
| 6 | **`raw_data_to_volts` placeholders / `2.95e-07`** (Q5) | 9 | LOW–MED | wrong/absent ADC gain → wrong µV scaling |
| 7 | **`default_header_file_path: ''`** (Q5) | 128 | LOW | converter may fall back; non-portable absolute paths a separate nuisance |

(Zero duplicate keys and the volume_in_uL shim are explicitly **non-issues** — don't chase them.)

---

## App-guard / UX implications

1. **Schema-validate on BOTH import and export — and reject space-separated / non-standard top-level
   keys outright.** The app's AJV (Draft-7) check must run on import too, not just export, so a
   hand-edited or legacy `electrode groups:` file is caught at the door instead of silently producing
   an empty workspace. Treat an unknown top-level key (`additionalProperties: false` at the root, or an
   explicit space-key detector) as a **blocking** error with the message "key `electrode groups` should
   be `electrode_groups`." This single guard kills the #1 cost class.
2. **The app is the real gate (downstream validation is silent).** Because trodes_to_nwb reads zero
   electrodes *without erroring*, the app must hard-block export when `electrode_groups` is empty/absent
   on an ephys day — never let a "successful" empty-ephys YAML out.
3. **Derive invariants, don't retype them.** `raw_data_to_volts` (1.95e-07), `times_period_multiplier`
   (1.5), `units.analog/behavioral_events` (single canonical token), `default_header_file_path`
   (`default_header.xml`) should be app-managed constants/defaults, not free-text fields. This
   structurally eliminates `1.5cd`, `"'unspecified'"`, integer-`1` gains, and empty header paths.
   Surface a per-animal consistency check when a managed invariant differs across days (`2.95e-07` is
   the one case to *prompt* rather than silently fix — it may be real alternate hardware).
4. **Unify typing on export.** Always emit `task_epochs` (plural) as a **list** (even for a single
   epoch) and never emit the singular `task_epoch`. Coerce on import. This collapses the 3276-int /
   4742-list split and the singular/plural key split into one canonical shape.
5. **Validate the YAML syntactically before download.** The 15 unparseable files (esp. the 13 replicated
   xulu/Lily `task_epochs:`-drop) would never exist if the app generated and re-parsed its own output —
   the app's encoder can't produce a 1-space-indented list item or a label-less `- 7`. The lesson is to
   **never let users hand-author these structures**; the app's deterministic encoder is the fix.
6. **Controlled vocabulary for `data_acq_device.system`** (one of `SpikeGadgets`/`MCU`) — pick, don't
   type, to stop `Main Control Unit` drift.

---

## Competing hypotheses & falsifiers

- **H (space keys = total loss)** vs **H′ (converter is space-insensitive).** Falsifier: read
  trodes_to_nwb's key access — it uses underscored literals and `additionalProperties` schema, so H
  holds. If a future converter normalizes keys, re-test. *Current confidence in H: high.*
- **`2.95e-07` — typo vs real hardware.** Could be a fat-finger of `1.95e-07`, or a genuinely different
  ADC gain. Falsifier: check the matching `.rec`/hardware config for that animal (kf2). Because it's a
  *plausible physical value*, the app should **prompt**, not auto-rewrite. *Confidence: unresolved —
  flag it.*
- **`1.5cd` — could `cd` be a meaningful unit?** No: `times_period_multiplier` is a dimensionless
  number; `cd` (candela) is nonsensical here and all 53 share one author. It is a typo/auto-correct
  artifact. *Confidence: high.*
- **Class-C jhbak file — corrupt vs uncollected.** It's absent from disk, so I cannot distinguish a
  real syntax bug from a collection miss. Falsifier: locate the original `kf2_20170201` on rhino.
  *Confidence: high it's uncollected; the syntax error itself is unverifiable.*
- **task_epochs scalar↔list — is it actually mishandled downstream?** Falsifier: trace trodes_to_nwb's
  read of `associated_files[].task_epochs`; if it normalizes scalar→list, the split is harmless. Prior
  study §6 flags it as a real consumer hazard; treat as MEDIUM until the converter read is confirmed.
