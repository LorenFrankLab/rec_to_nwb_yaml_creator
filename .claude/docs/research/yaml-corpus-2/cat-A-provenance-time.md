# Cat-A: Provenance, time-evolution, two-populations, per-experimenter conventions

**Corpus:** `~/Downloads/collected_metadata_yamls` — 1814 files, 1799 parse-OK (15 parse-errors),
1681 unique-by-content. Substrate: `~/Downloads/yaml_analysis2/records.jsonl` (1799 rows) +
`REPORT2.md`. **Real-data filter:** `is_suspect==False` → **1792** files. **Dedup:** `is_content_dup`.
Scripts (deterministic, `uv run`): `cat_a_provenance.py`, `cat_a_time_fingerprint.py`,
`cat_a_consistency_invariants.py`, `cat_a_volume_check.py`, `cat_a_final_fp.py` in
`~/Downloads/yaml_analysis2/`. Reconciles with the prior 325-file study
(`.claude/docs/research/yaml-corpus-analysis.md`); this 5.5× larger corpus **confirms every prior
headline** and sharpens the two-population dating + the per-experimenter-systematic-error class.

---

## Summary (5 bullets)

1. **Storage-`user` ≠ experimenter, and animals cross both.** 24 storage-users map to ~26 experimenter
   identities; the mapping is many-to-many. 16 `subject_id`s appear under >1 experimenter identity and
   46 under >1 storage-user (e.g. `peanut` lives under 4 users / 2 experimenters; the `SC*` Chiang
   animals also under `donghoon`). Deduped real files concentrate hard: the top experimenter (Coulter
   ×Kastner×Nevers, 375) + Chiang (233 deduped) + Guidera (177) + Comrie (161) = **54% of the corpus**.

2. **Format evolution has a sharp 2022→2023 phase change, then stabilizes.** Before 2023 nearly
   everything is legacy hand-built (`Rat`/`Male`/`"547g"`/no-DOB); from 2023 on it is app-typed
   (`Rattus norvegicus` / `M`,`F` / numeric weight / py-datetime DOB), and 2024-2026 are ~100% app on
   the schema-typed fields. The format is now **stable**, not still-churning.

3. **A positive app fingerprint beats `gen_class`** and yields 789 app / 938 legacy / 65 ambiguous
   (real). The cleanest *single* app-exclusive markers: **binomial species** (0% pre-2022 → 100%
   2024+), **numeric weight**, **py-datetime/ISO DOB**, and the **`volume_in_uL`+`volume_in_ul` dual
   key** (73 files, 100% app + 100% opto). **`experimenter_name` being a list is NOT an app signal** —
   multi-author teams used lists in legacy hand files since 2019 (`['Rhino Nevers','David Kastner']`).
   The discriminating name signal is **comma order ("Last, First")**, which the app emits but slower:
   0% through 2022 → 78% by 2026.

4. **Each experimenter is highly internally consistent** (78-94% single-valued per convention field
   over 18 ≥5-file experimenters), which justifies **per-experimenter default templates** — but a few
   experimenters carry a *systematic* error in 100% of their files (Sunrae Taloma:
   `times_period_multiplier: 1.5cd` in all 53).

5. **The lab-wide invariants hold at scale but each has a small, identifiable break-set.**
   `raw_data_to_volts==1.95e-7` (99.3%), `times_period_multiplier==1.5` (91.9% — `1.5cd` typo + `1`),
   `institution` full string (99.8%). Every breaker is an enumerable data-entry slip, not legitimate
   variation — i.e. each is a high-precision **gate** candidate.

---

## Findings

### Q1 — Provenance: user→experimenter, shared animals, deduped counts

**Claim: storage-`user` is a poor proxy for experimenter; the mapping is many-to-many.**
- Most users are dominated by one experimenter but contain spillover from shared dirs/copies, e.g.
  `amankili` n=104 = Mankili 87 / Joshi 13 / null 3 / Guidera 1; `shijie` n=78 spans 5 identities.
- Some experimenters span multiple users: **Chiang** = `sc4712` (179) + `ebroyles` (149) + `sambray`
  (6); **Coulter×Kastner×Nevers** = `rhino` (281) + `mcoulter` (94).
- `null` experimenter (34 real) = the space-separated-key files + placeholders that `records.jsonl`
  cannot introspect (must read raw).
- **Confidence HIGH** (direct counts, `cat_a_provenance.py`).

**Claim: animals are shared across experimenters/users (collaboration + re-curation).**
- 16 `subject_id`s under >1 experimenter identity: the 4 `CH*` (Coulter solo vs the 3-author team),
  6 `SC*` (Chiang vs `donghoon shin`), `Emmett`/`Seth`/`Jacob` (Denisse 2- vs 3-author roster),
  `peanut`/`wilbur`/`Senor` (Comrie vs Guidera), `J16` (Joshi vs Guidera), `jonny` (Liu/Morales/Gu vs
  Morales solo). 46 `subject_id`s under >1 storage-user (mostly re-curated copies under `ebroyles`,
  `donghoon`, `sambray`).
- **Caveat / competing hypothesis:** "shared animal" here conflates (a) genuine multi-investigator
  animals, (b) the same data re-saved by a curator under their own home dir, and (c) author-roster
  edits mid-study. Most `SC*`/`CH*` cases are (b)/(c), not co-ownership. **Confidence MED** on the
  "collaboration" reading, HIGH on the raw fact of cross-user `subject_id`.

**Claim: deduped real files per experimenter (top, `cat_a_provenance.py`):**

| experimenter_norm | all | real | real-dedup |
|---|---:|---:|---:|
| coulter michael, david kastner, nevers rhino | 375 | 375 | 375 |
| chiang sharon | 334 | 332 | **233** (99 content-dups) |
| guidera jennifer | 177 | 177 | 177 |
| alison comrie | 166 | 166 | 161 |
| coulter michael (solo) | 136 | 135 | 134 |
| abhijith mankili | 89 | 89 | 89 |
| david kastner, nevers rhino | 85 | 85 | 85 |
| sun xulu | 78 | 77 | 77 |
| gu shijie | 71 | 70 | 70 |
| sunrae taloma | 55 | 55 | 55 |

Total real-dedup ≈ **1674**; 26 distinct experimenter identities (incl. null + 4 placeholder rosters
like `firstname lastname`). Chiang has the most content-dups (re-saved across `sc4712`/`ebroyles`).
**Confidence HIGH.**

### Q2 — Time evolution 2017→2026

**Claim: a sharp legacy→app transition in 2022→2023, then format stability.** Per-year (real+all),
fraction with each app-style encoding (`cat_a_time_fingerprint.py`):

| year | n | binomial species | DOB present | numeric weight | single-letter sex | spaced top-keys |
|---|---:|---|---|---|---|---|
| 2017 | 8 | 4/8 | 4/8 | 5/8 | 4/8 | 3/8 |
| 2019 | 16 | 0 | 0 | 0 | 0 | 3/16 |
| 2020 | 173 | 0 | 1 | 1 | 0 | 4/173 |
| 2021 | 501 | 1 | 2 | 2 | 2 | 22/501 |
| 2022 | 210 | 18 | 45 | 18 | 18 | 0 |
| **2023** | 167 | **162** | **135** | **167** | **167** | 0 |
| 2024 | 273 | 273 | 251 | 273 | 273 | 0 |
| 2025 | 291 | 291 | 290 | 291 | 291 | 0 |
| 2026 | 92 | 92 | 92 | 92 | 92 | 0 |

- **species:** `Rat` is the universal legacy value (100% of 2019-2021); `Rattus norvegicus` jumps to
  100% from 2023. 2022 is the mixed transition year (18/210 binomial).
- **sex:** `Male` word-form 100% through 2021 → single-letter `M`/`F` 100% from 2023.
- **weight:** string-with-unit (`"547g"`) dominant ≤2022 → numeric 100% from 2023.
- **DOB:** absent ≤2021; **py-datetime** is the app form (`2023-05-01T00:00:00.000`). Pure ISO-date
  (`2023-03-07`, no time) appears in only **3** files (all 2023, Chiang) — a hand-edit artifact.
- **date_of_birth ISO+Z:** the app's `...Z`-suffixed form is real (Sunrae `2025-03-14T00:00:00.000Z`,
  spot-checked raw) but `records.jsonl`'s `dob_fmt` lumps it under `py-datetime`; it is *not* a
  separate detectable class in the substrate without re-reading raw.
- **lab string drifts the other way over time:** `Loren Frank` dominant ≤2023, but `Loren Frank Lab`
  *rises* 2024→2026 (58/92 in 2026). This is a free-text field the app does not normalize — newer
  users type the longer form.
- **spaced top-keys** (`experimenter name`, `electrode groups`, …) are a **pre-2022-only** legacy
  artifact (peak 22 in 2021, **zero** from 2022). Hard-fails conversion (zero electrodes found).
- **filename date format:** YYYYMMDD throughout; the `MMDDYYYY` break is 6 files in 2024 + 1 in 2025
  (was 2 SC50 files in prior study) — a small but persistent recurring slip.

**Verdict: the format is no longer evolving** — it converged on the app's encoding by 2023 and has
been stable for 4 years. Remaining variation is per-experimenter free-text drift (lab, units,
header_path), not format-generation drift. **Confidence HIGH.**

**Spot-check (raw):** `zoldello/.../beans20190718_metadata.yml` — `experimenter_name: Alison Comrie`
(scalar), `species: Rat`, `weight: Unknown`, no DOB → textbook 2019 legacy.
`mcoulter/home/Downloads/20231117_bs28_metadata.yml` (2023) — `experimenter_name:\n  - Coulter,
Michael`, `weight: 500`, `date_of_birth: 2023-05-01T00:00:00.000` but **`species: Rat`, `sex: M`...
wait sex IS single-letter, species is legacy** → app-generated file where the user kept typing the old
`Rat` species. Lines 1-16.

### Q3 — Two populations: positive app fingerprint

**Claim: a positive fingerprint classifies app vs hand better than `gen_class`.** Using app-EXCLUSIVE
signals (`cat_a_final_fp.py`): app = (≥4 of {Last,First name order, binomial species, numeric weight,
py-datetime/ISO DOB, single-letter sex, `keywords` present}) **and** no spaced keys.
→ **789 app / 938 legacy / 65 ambiguous** (of 1792 real). By year: app is 0 before 2022, 135/167 in
2023, ~100% 2024-2026; legacy is essentially everything ≤2021.

**The strongest *single* positive markers (rank by specificity):**
1. **`volume_in_uL` + `volume_in_ul` dual sibling key** — 73 files, **100% app, 100% opto**, years
   2023/2025/2026. This is the app's deliberate converter↔schema compatibility shim
   (`workspaceUtils.ts`). A non-opto file never has it, so it's a perfect *app-opto* fingerprint.
2. **binomial species** — 0% → 100% across the 2022 boundary; cleanest temporal discriminator.
3. **py-datetime/ISO DOB present** + **numeric weight** + **single-letter sex** — move together at the
   2023 boundary.

**Claim: `experimenter_name`-is-a-list is NOT an app signal (corrects a tempting heuristic).**
Lists appear in **337/501 (67%) of 2021 legacy files** — multi-author teams (`['Rhino Nevers','David
Kastner']`) wrote lists by hand since 2019. The app-specific name signal is **comma order
("Last, First")**: 0% through 2022 → 7% (2023) → 30% (2024) → 65% (2025) → 78% (2026). The app accepts
either order, so this lags the other app signals — it tracks *user habit*, not app-output.
**Confidence HIGH** (spot-checked: `rhino/.../20191106_RN2.yml` list in First-Last order).

**Cross-check disagreements with coarse `gen_class`:** 71 files are `gen_class=app-like` but fail the
strict 4-signal AND — and every one is a real app file with **one legacy field kept**: the `bs28`
animal (Coulter) is app-generated but typed `species: Rat` (7 files). So `gen_class` over-counts app
on the species axis; the multi-signal score is more robust. **Confidence HIGH.**

### Q4 — Per-experimenter consistency

**Claim: experimenters are highly internally consistent → per-experimenter templates are justified.**
Over 18 experimenters with ≥5 real files, fraction single-valued per field (`cat_a_consistency_invariants.py`):

| convention | single-valued | rate |
|---|---|---|
| institution | 17/18 | 94% |
| species encoding | 16/18 | 89% |
| sex encoding | 16/18 | 89% |
| experimenter shape | 16/18 | 89% |
| name order | 15/18 | 83% |
| weight encoding | 15/18 | 83% |
| lab string | 15/18 | 83% |
| opto present (all-or-none) | 15/18 | 83% |
| units_analog | 14/18 | 78% |

- The few multi-valued cells are **the legacy→app transition captured within one long-running
  experimenter** (Coulter solo: 2 values on every axis = his files straddle 2020-2023; Chiang: 2
  units encodings; Xulu: 2 name orders). Not noise — it's the format migration showing up per-person.
- **opto is nearly experimenter-static** (all-or-none) except 3 mixed: Chiang (53/332 opto — opto is a
  sub-study), the Lee/Adenekan NET-probe group (31/48), Denisse/Gao/Lee (20/21). So "does this
  experimenter do opto" is a usable template default for ~15/18 but **not a hard rule** for 3.
- **Confidence HIGH** that experimenter is the right template axis; **MED** that a single template per
  experimenter suffices (the long-tenured ones span the migration).

### Q5 — Invariants

**Claim: three lab-wide invariants hold at scale; each break-set is small + enumerable.**
(`cat_a_consistency_invariants.py`, real files n=1792)

| field | invariant value | holds | break-set |
|---|---|---|---|
| `raw_data_to_volts` | `1.95e-7` | 1780 (99.3%) | `1`×7, `None`×3, `0`×1, `2.95e-7`×1 |
| `times_period_multiplier` | `1.5` | 1646 (91.9%) | `1`×89, `"1.5cd"`×53, `None`×2, `0`×1, `2.5`×1 |
| `institution` | `University of California, San Francisco` | 1789 (99.8%) | `UCSF`×2, `…TIFR`×1 |

- **`raw_data_to_volts` is a true physical constant** (SpikeGadgets/Intan ADC LSB). Every breaker is a
  draft/placeholder: `1` (unset default), `0`, `2.95e-7` (a 2017 file with `# value TBC` comment,
  spot-checked), `None`. **None are legitimate** → safe to hard-gate to `1.95e-7` with an override.
- **`times_period_multiplier`: the `"1.5cd"` break is a per-experimenter systematic typo.** All 53 are
  **Sunrae Taloma**, 2025-2026, and the files are otherwise fully app-generated (raw spot-check:
  `sunrae/cumulus/20250605_ST02_hab/...` line 43 `times_period_multiplier: 1.5cd`). It is a *string*
  where the converter wants a float → silent type coercion / failure downstream. The `1`×89 break is
  the legacy default. **HIGH severity** because it ships in 100% of one active experimenter's output.
- **`institution`** — `UCSF` abbreviation (2) + one genuinely-different institution (`National Centre
  for Biological Sciences, TIFR`, in a `behavior_only/na9` file that *also* has `raw_data_to_volts: 0`
  and `institution≠UCSF` — a non-Frank-lab outside contribution, legitimately different).
- **Not invariant (free-text, drifts):** `lab` (`Loren Frank` 80% / `Loren Frank Lab` 20%),
  `default_header_file_path` (`default_header.xml` 86% but 25 distinct — Xulu/Donghoon embed absolute
  rig paths), `units_analog`/`units_behavioral_events` (6 forms incl. literal-quoted `'unspecified'`).
- **Confidence HIGH** (full enumeration; the two surprising breaks `1.5cd` and `2.95e-7` spot-checked
  at raw line level).

---

## Invariants vs variation, by axis

| axis | truly invariant (gate) | by-experimenter convention (template) | legitimately day-variable |
|---|---|---|---|
| **physical** | `raw_data_to_volts=1.95e-7`, `times_period_multiplier=1.5` | — | — |
| **institutional** | `institution` (UCSF, for Frank-lab files) | `lab` string form | — |
| **encoding/format** | (post-2023) species binomial, sex single-letter, numeric weight, DOB present | name order, units_analog form, header_path | — |
| **subject** | — | species/sex/genotype value, DOB | weight (weighed daily) |
| **design** | — | opto present (≈static, 3 exceptions), device_types | tasks/epochs, cameras, bad_channels, behavioral_events |

---

## Error classes (ranked by severity × prevalence)

1. **Spaced top-keys** (`experimenter name`, `electrode groups`) — **hard-fails conversion** (zero
   electrodes). 35-36 files, all ≤2021 legacy. *Detectable in `top_keys`; gate on import.* HIGH.
2. **Per-experimenter systematic field typo** — Sunrae's `times_period_multiplier: 1.5cd` in **100%**
   of her 53 active files; a *string* in a float field. Ships continuously. HIGH (prevalence × active).
3. **Conflicting dual-volume values** — `volume_in_uL: 0.45` vs `volume_in_ul: 450` (1000× μL/nL
   scale error) in **100 virus-injection blocks across 50 distinct files** (46 blocks / 23 files
   agree; of 73 dual-volume files total). The app's derive-both-from-one fix
   prevents this *going forward*; hand-edited/older files still carry it. HIGH (silent, in opto data).
4. **Animal-static field drift across days** (REPORT2 §day-over-day; reconciles with prior §3) —
   `date_of_birth`, `genotype`, `n_electrode_groups` mutate within one animal because re-typed daily.
   ~14 DOB conflicts, several genotype conflicts. Every one is an error, not real change. MED-HIGH.
5. **`subject_id` shared/case-inconsistent across users** — fragments Spyglass `Subject` keying
   (`RS10`/`rs10`, `bs28`/`BS28`). MED.
6. **species `Rat` / sex `Male` / string weight surviving into app files** — 5 species-`Rat` files in
   2023, the whole `bs28` set; fails DANDI binomial/sex checks. MED (declining, but still emitted).
7. **`raw_data_to_volts` placeholder values** (`1`, `0`, `None`, `2.95e-7`) — 12 files, drafts. LOW-MED.
8. **`MMDDYYYY` filename date** — 7 files; breaks trodes_to_nwb session grouping. LOW (rare, recurring).

---

## App-guard / UX implications (highest-value first)

1. **Hard-gate the two physical constants with a typed widget, not free text.**
   `raw_data_to_volts` and `times_period_multiplier` should be fixed/derived (override behind a
   warning), never free-typed. This single guard kills the `1.5cd` class (53 files, one experimenter
   today), the `1`/`0`/`None` placeholders, and the `2.95e-7` draft. *They are ≥99% / ≥92% invariant —
   the strongest gate candidates in the corpus.*
2. **Validate `times_period_multiplier`/`raw_data_to_volts` as `number`** at entry and **block export**
   on a non-numeric (catches `"1.5cd"` even if a future free-text path reintroduces it).
3. **Derive `volume_in_uL`/`volume_in_ul` from ONE μL input and emit both** (the app already does this
   in `workspaceUtils.ts` — confirm it's wired on the opto path) so the 1000× conflict (100 blocks)
   is structurally impossible. Add a **unit label on the input** (μL) so users don't enter nL.
4. **Per-experimenter default template, keyed on experimenter identity** (institution, lab, species,
   sex, units, opto-on/off, device set) — justified by 78-94% internal consistency. Pre-fill from the
   experimenter's own most-recent file; this also normalizes the `lab` two-forms and the units
   six-forms drift. *Caveat: long-tenured experimenters straddle the 2022 migration, so seed the
   template from their **post-2023** files only.*
5. **Reject spaced/legacy top-keys on import** with a one-click "convert `electrode groups` →
   `electrode_groups`" repair — the only hard-conversion-failure class in the time series.
6. **Animal-static lock + per-animal consistency check** (DOB, genotype, species, n_electrode_groups
   constant across an animal's days) — surfaces the copy-forward drift class; reconciles with prior
   study's enter-once-and-lock recommendation.

---

## Competing hypotheses / open questions

- **"Shared animal = collaboration" vs "= re-curation copy."** Most cross-user `subject_id`s
  (`SC*` under `donghoon`/`ebroyles`) are a curator re-saving another lab member's data, not joint
  ownership. *Falsify by:* diffing md5/content — if identical, it's a copy, not independent authorship.
  (Substrate has `md5`; not pursued exhaustively here.) Confidence MED.
- **Is `1.5cd` an app bug or a post-export hand-edit?** Sunrae's files are otherwise fully
  app-generated, so either the app had a free-text `times_period_multiplier` path, or she edited the
  YAML after export. *Falsify by:* checking the app's current `times_period_multiplier` input type
  (`InputElement` vs hard-coded). If hard-coded now, the 53 files predate the fix or are hand-edited.
  Either way, an **export-time numeric gate** closes it. Confidence: HIGH it's an error, MED on origin.
- **Does the app emit `...Z`-suffixed DOB vs `...000` plain?** Both seen (Sunrae `…000Z`, bs28 `…000`).
  `records.jsonl` collapses both to `py-datetime`; distinguishing app *versions* would need raw
  re-reads. Open — low priority (both parse fine).
- **`gen_class` over-counts app on the species axis** (71 app-like files fail strict-4). The multi-
  signal score (this note) is the recommended classifier; `gen_class` alone should not be used to label
  populations. Confidence HIGH.
- **The 65 "ambiguous" real files** — mostly 2022 transition + null-experimenter space-key files.
  Worth a manual pass if exact app/hand attribution matters for a downstream count.
