# Category-B: Subject identity & controlled vocabulary

**Corpus:** `/Users/edeno/Downloads/collected_metadata_yamls` (1814 files, 1799 parse-OK).
**Substrate:** `~/Downloads/yaml_analysis2/records.jsonl` (1799 rows) + `REPORT2.md`.
**Analyzer:** `~/Downloads/yaml_analysis2/cat_b_subject_vocab.py` (PEP-723; `uv run`).
**Hygiene:** "real data" = `is_suspect==False` (1792 files; only 7 are test/notebook/placeholder).
Vocab distributions reported on the **real + content-deduped** view (1674 files) to avoid
byte-dup copies inflating counts; DANDI-rejection headlines reported on all 1792 real files (the
unit DANDI actually validates is the file). Spot-checked every surprising claim against ≥1 raw file.
Reconciles the prior 325-file study (`../yaml-corpus-analysis.md` §3–§5); the larger corpus
**confirms every prior finding** and adds two new same-animal conflict classes (species, subject_id
case-split across storage-users).

---

## Summary

The subject block is **animal-static metadata re-typed every recording day**, so its two failure modes
are exactly (a) **free-text vocabulary fragmentation** of fields that should be controlled, and
(b) **copy-forward drift** where a fact that can only have one true value (DOB, genotype, species)
takes ≥2 values across the same animal's days. Both are structural, not careless: ~half the corpus
fails DANDI on `species`/`sex`/`weight` because the *experimenter's house convention* (`Rat`, `Male`,
`"541g"`) is non-compliant, and each experimenter is internally consistent — so the error is uniform,
not random. The strongest evidence for **enter-animal-static-once-and-lock** is that 13 distinct
animals carry impossible self-contradictions across their own days (6 DOB, 6 genotype, 1 species),
several *interleaved* day-to-day (so there is no clean "corrected" version downstream can recover).

---

## Findings

### Q1. Species — 53% DANDI-rejecting; one biologically-wrong binomial on real animals

**Claim:** `species` is dominated by the non-binomial `Rat` (house style), and the few binomials
include a wrong one (`Rattus rattus` = black rat) applied to Long-Evans (`Rattus norvegicus`) rats.

- Real+dedup distribution: `Rat` 938, `Rattus norvegicus` 731, `Rattus rattus` 3, `rat` 1,
  `Rattus pyctoris` 1.
- **DANDI-rejecting** (non-Latin-binomial `Rat`/`rat`): **944 / 1792 real files (53%)**. DANDI
  requires a Latin binomial or NCBI Taxon URI (per `docs/PIPELINE_REQUIREMENTS.md`).
- **`Rattus rattus` is wrong, not just unusual.** All 3 occurrences describe Long-Evans rats
  (`description: Long Evans Rat`), which are *Rattus norvegicus*. `Rattus rattus` is the black rat.
- **`Rattus pyctoris`** (1) is the **golden-sample template** (`sambray/.../20230622_sample_metadata.yml`,
  genotype `Obese Prone CD Rat` — also template-only). Not a real animal.
- **Per-experimenter convention** (the actionable structure): each person is internally consistent —
  chiang/xulu/sunrae/donghoon/denisse/kyu-roster → `Rattus norvegicus`; guidera/mankili/alison and the
  Coulter–Kastner–Nevers "rhino" roster → `Rat`. So species is a *template default per experimenter*,
  not a per-day decision.

**Raw evidence (species conflict + wrong binomial, same animal `bs28`):**
```
rio/cumulus/BS28_raw_old/20231107/20231107_BS28_metadata.yml:13   species: Rattus rattus
mcoulter/cumulus/bs28_raw/20231109/20231109_BS28_metadata.yml      species: Rat
```
Same physical animal (`subject_id: bs28`, both `Long Evans Rat`), stored by two users (rio, mcoulter),
two species strings — **neither is the correct `Rattus norvegicus`.** Confidence: **High.**

### Q2. Sex — 52% non-single-letter; pure per-experimenter convention

**Claim:** `sex` splits `Male`/`M` (+ singleton `male`/`Female`) entirely along experimenter lines; no
same-animal sex conflicts exist.

- Real+dedup: `Male` 931, `M` 655, `F` 86, `male` 1, `Female` 1.
- **Non-single-letter** (DANDI/NWB expect `M`/`F`/`U`/`O`): **938 / 1792 real files (52%)**.
- Per-experimenter: chiang `M`(311)/`F`(21), xulu `M`(52)/`F`(25), gu `M`(64) use single-letter; the
  rhino roster + alison + mankili use `Male`. The mixed-token experimenters (e.g. coulter
  `M`83/`Male`5/`F`47) reflect *merged copies from multiple source dirs*, not animal-level disagreement.
- **Q7 found 0 same-animal sex conflicts** — sex is the *cleanest* animal-static field. The only issue
  is the controlled-vocab mismatch (`Male`→`M`), which is mechanical. Confidence: **High.**

### Q3. Weight — 44% string-with-unit, 8% missing; ~2 absurd; units consistent

**Claim:** weight is split between typed-numeric and `"NNNg"` strings; absurd values are rare; the unit
is uniformly grams where present.

- weight_type (real+dedup): `string-with-unit` 777, `numeric` 755, `missing` 142.
- Full real corpus: **782/1792 (44%) string-with-unit** (`"541g"`, `"600g"`) — fails the schema's
  typed/numeric expectation; **142 (8%) missing.**
- Parseable-to-grams range **0–980 g**; only **2 absurd**: `weight: 0` (`zoldello/.../kf2_20170120`)
  and `weight: 99` (`kkay/.../kf19/20170824_old.yml`) — both old 2017 KF-series files where weight was
  effectively not recorded.
- **Non-numeric placeholders:** `Unknown` 571, `X` 22 (these are *explicit* "not recorded" sentinels,
  distinct from the 142 truly-empty). Units never disagree — every parseable value is grams (no kg/
  oz). Confidence: **High** (weight legitimately *varies day-to-day* — animal weighed each day — so it
  is the one subject field that is day-owned, not lockable; see Q7).

**Raw:** `zoldello/home/Documents/data/yml/kf2_20170120_metadata.yml:18  weight: 0`.

### Q4. date_of_birth — 54% missing; 6 same-animal DOB conflicts (strongest lock evidence)

**Claim:** over half of files omit DOB; among multi-day animals, 6 carry **two different DOBs** — a
fact that is physically impossible and the clearest case for enter-once-and-lock.

- dob_fmt (real+dedup): `missing` 959, `py-datetime` (`...T00:00:00.000Z`) 712, `ISO-date` 3.
- Full real corpus: **964/1792 (54%) missing DOB.** Schema marks DOB `required` under `subject`; DANDI
  needs age or DOB. The legacy/`Rat`-convention files are the missing population.
- **0 future-dated DOBs.** 4 placeholder DOBs (`2000-01-01`), all on template/placeholder files
  (`12345`, `54321`, golden sample) except `amankili/.../Winnie` (a real animal stamped `2000-01-01`).
- **6 same-animal DOB conflicts** (impossible — one birth date per animal):

  | Animal | Experimenter | DOBs across days | Gap |
  |---|---|---|---|
  | **Seth** | denisse | `2025-04-12` ↔ `2025-07-26` | 3.5 mo, **interleaved** |
  | **SC38** | chiang | `2022-01-05` ↔ `2022-07-12` | ~6 mo |
  | **SC100** | chiang | `2024-01-09` ↔ `2024-10-29` | ~10 mo |
  | **L16** | gao/lee | `2024-07-28` ↔ `2024-11-25` | ~4 mo |
  | **ST01** | sunrae | `2024-11-02` ↔ `2025-03-14` | ~4 mo |
  | **ST13** | sunrae | `2025-11-27` ↔ `2025-12-05` | 8 d |

**Raw evidence (Seth — interleaved, so no clean "latest is correct" recovery):**
```
denisse/stelmo/Seth/20251208/...  date_of_birth: 2025-07-26T00:00:00.000Z
denisse/stelmo/Seth/20251210/...  date_of_birth: 2025-04-12T00:00:00.000Z   <- 2 days later, different DOB
denisse/stelmo/Seth/20260121/...  date_of_birth: 2025-07-26T00:00:00.000Z   <- reverts
```
**Raw evidence (SC38 — the outlier filename embeds its own DOB):**
```
sc4712/home/Downloads/20220712_sc38_metadata.yml  date_of_birth: 2022-07-12  (lowercase sc38; dob==filename date)
...34 other SC38 files...                          date_of_birth: 2022-01-05
```
The `20220712` file appears to have had the *recording/created date typed into the DOB field*.
Confidence: **High** (raw-verified two of six).

### Q5. genotype vs strain vs description — strain mis-entered in genotype 19%; many spelling dups

**Claim:** the strain `Long-Evans Rat` is entered into the *genotype* field in ~1/5 of files; real
genotypes have uncontrolled spelling families; `description` splits on a single hyphen.

- **Strain-in-genotype: 332/1792 real files (19%)** carry `genotype: Long-Evans Rat` — that is the
  *strain/background*, not a genotype. (alison/wilbur/senor legacy + others.)
- **Genotype spelling families** (semantic concept → competing strings):
  - wildtype-family (787): `Wild Type` 703, `WT` 82, `wild type` 1, `Wildtype` 1 → **4 spellings, 1 concept.**
  - scn2a-family (455): `Scn2a +/+ or Scn2a +/-` 280, `scn2a` 172, `Scn2a` 3 → **3 spellings.**
  - pv-family (193): `PV+ Cre` 89, `PV-Cre` 71, `PV-CRE` 18, `PV Cre` 13, `PV+ FLP` 2 → **5 spellings.**
- **description Long-Evans hyphen split:** `Long Evans Rat` 1084 vs `Long-Evans Rat` 532 (+ `Long Evans
  adult` 1) — a single hyphen fragments the dominant description into two.
- **The same concept ("Long Evans") legitimately appears in BOTH description and genotype.** The fix is
  not "ban Long-Evans" but: strain belongs in *description* (or a dedicated `strain` field), genotype
  should be a *controlled list* (`Wild Type`, `PV-Cre`, `Scn2a +/+ or +/-`, …). Confidence: **High.**

### Q6. subject_id integrity — 77 case-mismatch vs path; only 3 case-split *within the field*

**Claim:** subject_id frequently disagrees in case with its own filename/dir, but the **field itself**
is mostly internally consistent; the real Spyglass-merge hazard is name *reuse across people/years*.

- **77 real files** have `subject_id` present in their path/filename but with **different case**:
  `Senor`(id) vs `senor`(path) 54, `Army` vs `army` 14, `bs28` vs `BS28` 3, plus `NA9/na9`, `LF1/lf1`,
  `SC18/sc18`, `SC38/sc38`, `Beans/beans`, `KF2/kf2`. Spyglass keys `Subject` on `subject_id`, so the
  *field* value (not the filename) is what matters — these path mismatches are cosmetic **unless** the
  field itself is inconsistent.
- **Only 3 subject_ids are case-split in the field across the corpus:** `J16`/`j16`, `Lewis`/`lewis`,
  `ShyLu`/`shylu`. **Raw spot-check shows these are NAME REUSE, not one animal:** `J16` =
  jguidera 2024 (49 files); `j16` = alison 2021 (16 files) — two different rats, two people, three
  years apart. → Spyglass would either **collide two distinct rats** under one key or split one under
  two, depending on casing. So the hazard is global-key reuse, mitigated by case-folding + a uniqueness
  warning, not by per-file case-correction.
- **Placeholder IDs in real dirs:** `12345` (3 files: kenny+kyu `kf19`, sambray `kf19` — the
  *historical demo* metadata that propagated) and `54321` (2 files: golden sample + the
  `{EXPERIMENT_DATE...}` template). All trace to template/demo provenance, not a real session whose ID
  was forgotten.
- **The 35 "missing subject_id" files are REAL sessions, not lost data** — they use the legacy
  **space-separated key `subject id:`** (wilbur ×24, peanut, chimi, AM3, Jaq, beans ×3, kf2, kib,
  kibbles). The animal is fully recoverable from `session_id`/filename, and species/sex/weight/genotype
  *were* parsed (only the `subject_id` extraction missed the spaced key). These break
  `trodes_to_nwb` (it expects `subject_id`), so they are a **hard-fail format bug**, not absent data.

**Raw evidence (space-key):**
```
alison/home/Downloads/20210326_wilbur.yml:12   subject id:      wilbur
amankili/.../AM320210225_metadata.yml:13       subject id: AM3
```
Confidence: **High.**

### Q7. Same-animal conflicts — 13 animals self-contradict (the lock case)

Across **142 multi-day animals** (experimenter × recovered subject_id, content-deduped), animal-static
fields that took **>1 value** within one animal:

- **date_of_birth: 6** animals (Q4 table) — impossible.
- **genotype: 6** animals — `mec10` (WT↔scn2a), `CH105` (Wild Type ×22 ↔ `Scn2a +/+ or +/-` ×22),
  `CH112`, `CH65` (3 values incl. `Unknown`), `CH73`, `ShyLu` (PV-CRE ×3 ↔ Wild Type ×1). The CHxx set
  is the **Scn2a disease-model roster** where case/control genotype assignment is the *scientific
  variable* — a conflict here mis-labels the experiment.
- **species: 1** — `bs28` (Rat ↔ Rattus rattus, Q1).
- **subject_description: 1** — `jonny` (`Long Evans Rat` ↔ `Long-Evans Rat`, hyphen).
- **sex: 0** — none. **weight: 46** — EXPECTED (animal weighed daily; day-owned, not a conflict).

**Raw evidence (genotype, same animal, case-control hazard):**
```
mcoulter/.../scn2a/20210625_CH105.yml  genotype: Wild Type                 (×22 files)
...other CH105 days...                  genotype: Scn2a +/+ or Scn2a +/-    (×22 files)
mcoulter/.../mec10/20250227_eeg_het/... genotype: scn2a   (the *_het dirs)
mcoulter/.../mec10/20250312/...         genotype: WT
```
Confidence: **High** (raw-verified mec10, CH105, bs28, ShyLu, Seth, SC38).

---

## Invariants vs legitimate variation

**Animal-static — must be identical across all of an animal's days (enforce a single source of truth):**
`species`, `sex`, `genotype`, `date_of_birth`, `subject_description`/strain, `subject_id`. Every
observed cross-day difference in these (13 animals) is a data-entry error, not real change.

**By-experimenter convention — constant per person, differs between people (drive *defaults*, not
validation):** species token (`Rat` vs `Rattus norvegicus`), sex token (`Male` vs `M`), name shape,
`lab` form. Each experimenter is internally consistent → experimenter is the natural axis for template
defaults.

**Legitimately day-owned (do NOT lock):** `weight` (animal weighed each day; 46/142 animals vary — all
real).

---

## Error classes ranked by severity × frequency × cost

| # | Error class | Freq (real files) | Downstream cost | Severity |
|---|---|---|---|---|
| 1 | **species non-binomial** (`Rat`) | 944 (53%) | **DANDI hard-reject** at publication | Critical |
| 2 | **sex non-single-letter** (`Male`) | 938 (52%) | DANDI/NWB validation fail | Critical |
| 3 | **DOB missing** | 964 (54%) | schema-required; DANDI age missing | High |
| 4 | **weight string-with-unit** (`"541g"`) | 782 (44%) | typed-value schema mismatch | High |
| 5 | **strain in genotype field** (`Long-Evans Rat`) | 332 (19%) | wrong genotype semantics in Spyglass | High |
| 6 | **same-animal DOB/genotype/species conflict** | 13 animals | **mislabels the experiment** (esp. Scn2a case/control); irrecoverable when interleaved | Critical (low-freq, high-cost) |
| 7 | **genotype/description spelling dups** (WT/Wild Type; hyphen) | ~1000s of rows | fragments Spyglass queries | Medium |
| 8 | **space-key `subject id:`** → empty subject_id | 35 (real sessions) | `trodes_to_nwb` hard-fail / empty Subject | High |
| 9 | **subject_id case-split / name reuse** (J16/j16) | 3 ids cross-person | Spyglass Subject collide-or-split | Medium |
| 10 | weight absurd (`0`, `99`) / placeholder DOB | ~6 | bad age/weight downstream | Low |

---

## App-guard / UX implications (highest value first)

1. **Controlled dropdowns for species, sex, genotype, brain-region.** Replace free text with enums:
   species → `Rattus norvegicus` (default) / NCBI URI; sex → `M`/`F`/`U`/`O` (store the letter, show the
   word); genotype → a managed list (`Wild Type`, `PV-Cre`, `Scn2a +/+ or Scn2a +/-`, …) with
   "Long-Evans Rat" routed to *description/strain*, not genotype. Kills error classes 1, 2, 5, 7 at the
   source (~half the corpus). This is the single highest-leverage guard.

2. **Enter-animal-static-once-and-lock** for `species`, `sex`, `genotype`, `date_of_birth`,
   `description`, `subject_id`. Set them at the **animal** level; each recording day *derives* (read-only)
   from the animal record. Day-to-day re-entry is what produced all 13 self-contradictions; deriving
   makes the 6 DOB and 6 genotype conflicts **structurally impossible**.

3. **Same-animal consistency check on import / multi-day load.** When ≥2 days for one
   `(experimenter, subject_id)` disagree on any animal-static field, **block with a diff** ("Seth has
   two birth dates: 2025-04-12 vs 2025-07-26 — pick one"). Catches the interleaved cases (Seth) that no
   "use latest" heuristic can resolve, and the Scn2a case/control mislabels (CH105) that silently
   corrupt the science.

4. **Typed weight with unit affordance.** Numeric input + fixed `g` suffix in the UI; store the number.
   Reject `<100` / `>1500 g` and the sentinels `Unknown`/`X`/`0` with a "weight not recorded?" prompt.
   Fixes class 4 (44% of files).

5. **Per-experimenter template defaults.** Because species/sex tokens are a stable house convention per
   person, pre-fill the animal record from the experimenter's last animal — but with the
   *DANDI-compliant* values (`Rattus norvegicus`, `M`), so the convention that currently bakes in
   non-compliance instead bakes in compliance.

6. **subject_id hygiene:** trim + case-fold for the Spyglass key, warn on case-variant collisions and
   on reuse of an existing animal name by a different experimenter (J16/j16); reject the
   space-separated `subject id:` form on import (and emit `subject_id`). Surface placeholder IDs
   (`12345`/`54321`) as a hard warning.

---

## Competing hypotheses & falsifiers

- **H (species/sex is convention, not error):** *Falsifier* — if species/sex varied *within* an
  experimenter's animals at random, it would be carelessness, not convention. **Held:** each
  experimenter is internally consistent (e.g. chiang 332× `Rattus norvegicus`, 0 `Rat`); mixed-token
  cases trace to merged copies. → fix with *defaults*, not just validation.
- **H (case-splits are same-animal Spyglass merges):** *Falsifier* — check whether the two casings are
  the same physical rat. **Refuted for J16/j16** (different people, 2021 vs 2024 = different animals);
  so the hazard is *name reuse across the global Subject key*, not within-animal case drift. The genuine
  within-animal conflicts are the Q7 set instead.
- **H (missing subject_id = lost data):** *Falsifier* — read the raw subject block. **Refuted:** it is
  the `subject id:` space-key; animal is present and recoverable. Reclassified as a *format* bug.
- **H (DOB conflicts are corrections, "latest wins"):** *Falsifier* — check chronological order.
  **Refuted for Seth** (DOB reverts: 07-26 → 04-12 → 07-26 across consecutive days) — interleaved, so no
  positional heuristic recovers the truth; only an explicit user decision can. Strengthens the
  block-on-import guard (#3) over any silent reconciliation.
- **Open / unverified:** the 4 placeholder DOBs and a handful of `Unknown` weights *might* be
  intentional "not recorded" sentinels rather than errors — distinguishing them needs the lab's
  convention, not the corpus. Treat as warn-not-block.
