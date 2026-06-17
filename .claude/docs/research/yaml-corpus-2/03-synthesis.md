# YAML corpus-2 — P3 synthesis (the decision-ready document)

**Date:** 2026-06-17 · **Inputs:** the 8 category deep-dives (`cat-A`…`cat-H`), the running docs
(`00-plan`, `01-hypothesis-tree`, `02-research-log`), and the prior 325-file study
([../yaml-corpus-analysis.md](../yaml-corpus-analysis.md)). **Population:** 1,814 files →
1,799 parse-OK → **1,792 "real"** (`is_suspect==False`) → **1,674 content-deduped**. Substrate:
`~/Downloads/yaml_analysis2/{records.jsonl, REPORT2.md}` + per-category extracts. Nothing was
re-analyzed here except a handful of reconciliation re-derivations (noted inline); this is synthesis.

> **Population convention used throughout** (and the source of most apparent numeric "conflicts"
> between notes): **DANDI-rejection / "what ships" headlines are on all 1,792 real files** (the file is
> the unit DANDI validates); **vocabulary-distribution headlines are on the 1,674 content-deduped view**
> (so byte-identical cross-user copies don't inflate a token count). Where two notes disagree, it is
> almost always real-full vs real-dedup — both are correct for their stated population. I re-derived the
> three that mattered (volume conflict, species/sex reject, DOB/weight) against `records.jsonl`; see §2
> and the reconciliation footnotes.

---

## 1. Executive summary (the through-line)

1. **~80% of every YAML is animal-static boilerplate re-typed every recording day.** This single
   structural fact (confirmed at 5.6× scale) generates *both* dominant failure modes: **copy-forward
   drift** of facts that can only have one true value, and **free-text fragmentation** of fields that
   should be controlled. Everything else in this report is a consequence of it.

2. **The format stopped evolving.** There is a sharp **2022→2023 legacy→app phase change** (not gradual
   drift), after which 2024-2026 are ~100% app-typed on the schema fields. The app already eliminated
   the big legacy vocab classes for new files — so the live question is the **residual** app-era error
   set, and the legacy archive that still has to import cleanly.

3. **Half the corpus fails DANDI on subject vocabulary** because the *house convention* is
   non-compliant, not because users are careless: **species non-binomial (`Rat`) 944/1,792 (53%)**,
   **sex non-single-letter (`Male`) 938/1,792 (52%)**, **DOB missing 964 (54%)**, **weight
   string-with-unit 782 (44%)**. Each experimenter is internally consistent, so the error is *uniform*,
   which is exactly why per-experimenter **defaults** (seeded with compliant values) fix it at the
   source.

4. **The worst errors are SILENT** — they convert "successfully" and corrupt the NWB/Spyglass
   downstream. The top three by cost are all silent: **space-separated top-level keys → total electrode
   loss (36 files)**, **`volume_in_uL 0.45` vs `volume_in_ul 450` 1000× injection error (49 files)**,
   and **`power_in_W: 200` ~10,000× opto-power error (70 files)**. Downstream validation is mostly
   non-raising, so **this app is the real gate.**

5. **Three lab-wide invariants are gate-grade** (≥99% / ≥92% / 99.8%) and every violator is an
   enumerable data-entry slip, not legitimate variation: `raw_data_to_volts=1.95e-7`,
   `times_period_multiplier=1.5`, `institution=University of California, San Francisco`. "Derive, never
   ask" for these is the single highest-confidence guard family in the corpus.

6. **No lab-wide DIO template is possible and never will be.** 67 distinct behavioral-event name-sets;
   the most common covers 19%; `RightMilk_Pump`→8 channels, `Din1`→21 names. Naming is per-person and
   the name↔channel binding is **day-owned** (board re-wires mid-experiment — the verified Senor
   `Poke3: Din3→Din18` case). The lever is stems + autocomplete + carry-forward-with-diff, **never** a
   preset.

7. **Several "bugs" were falsified and must NOT be guarded as errors:** `n_electrode_groups ≠ n_ntrode`
   is correct multi-shank expansion (789/800); NULL `location` is intentional on disabled tetrodes
   (1,272 of 2,024) so the gate must be **active-group-scoped**; all-4-bad tetrodes are mostly
   dead-in-brain with a correct location (4,586 of 5,631), not "disabled"; the `volume_in_uL/ul` dual
   key itself is a *deliberate shim*, not a bug (only conflicting *values* are). Guarding these would
   be a false-positive nuisance.

8. **A real confound was found and controlled:** the same recording day exists as **divergent copies**
   across storage drives (11 animals, 76 date-rows disagree on bad_channels; Chiang re-saves inflate
   her dedup). Naïve date-ordering manufactured 158 fake bad-channel "un-marks" (consensus → 3). This
   is itself a finding (single-source-of-truth guard) and a warning to anyone re-running: dedup and
   cross-copy-reconcile before trusting any temporal claim.

---

## 2. Reconciliation vs the 325-file study

The prior study's every headline **held**. The larger/older/9-year corpus mostly *sharpened* the
numbers and added structural error classes the curated 325-set never contained.

| GENERALIZED (held at 5.6× scale) | CHANGED (different at scale / refined) | NEW (only in the larger/older corpus) |
|---|---|---|
| **Two populations** legacy↔app, splitting across ~8 independent fields. (325: 98 legacy / 227 app.) Now **789 app / 938 legacy / 65 ambiguous** by a positive fingerprint. | **The split is a sharp 2022→2023 phase change, then STABLE** — not the gradual "two populations" framing. Format converged by 2023 and hasn't moved in 4 years. | **Space-key total electrode loss is a *batch*, not a curiosity:** 325 found 3 (`Re_round2/*`); corpus-2 finds **36** (alison 26, jhbak 4, amankili 3, loren 2; mostly 2021). |
| **Three-tier model** (animal-static / day-owned / by-experimenter-convention) — confirmed field-by-field. | **`experimenter_name`-is-a-list is NOT an app signal** (325 used it as one). 67% of 2021 *legacy* files use lists; the real app marker is comma `Last, First` order (0%→78% 2017→2026). | **Per-experimenter *systematic* field typo:** Sunrae's `times_period_multiplier: 1.5cd` (string in a number field) in **100% of her 53 files**. A net-new "uniform-wrong-per-author" class. |
| **Copy-forward drift = error.** 325 found ~6 animal-static drifts. Corpus-2: **52 drift events across 142 multi-day animals; 13 animals self-contradict** (6 DOB, 6 genotype, 1 species). | **NULL-location nuance quantified:** 325 said "1,130 NULL-like, many intentional." Corpus-2 splits it: **752 active-group (defect) vs 1,272 disabled (intentional)** → gate must be active-scoped. | **Same-animal genotype case/control mislabel in a disease model:** CH105 = 22 files `Wild Type` vs 22 `Scn2a +/+ or +/-`. Mislabels the *scientific variable*, not just metadata. Interleaved DOBs (Seth: 07-26↔04-12 day-to-day) defeat any "latest wins" heuristic. |
| **Free-text fragmentation** of location/species/sex/genotype/lab. `hippocampus`/`Hippocampus`/`hippcoampus` confirmed (325: 2694/1937/31 → corpus-2: **33,992 / 5,558 / 103**). | **`volume_in_uL/ul` conflict enumerated:** 325 *predicted* "0.45 vs 450"; corpus-2 confirms **49 files / 99 injection blocks** (re-derived from the opto extract; agree=44). | **`power_in_W: 200` is systematic (70/71), not anecdotal** (325 saw 1, "Laurent"). Root cause: model `LuxX+ 638-200` (200 = max mW) typed into the W field. Real power lives in `fs_gui.power_in_mW` (2-50 mW). |
| **DIO: no lab template; unstable name↔channel; per-person.** 325: 21 sets, top 97/325. Corpus-2: **67 sets, top 341/1,792 (19%)**; `RightMilk_Pump`→8, `Din1`→21. Senor `Poke3` split re-verified with the author's own inline `#ends/#starts` comments. | **Opto is *narrower* than it looks:** `opto_present` overcounts ~2.5× — 110 "opto" files are **empty `[]` scaffolding**; **real opto = 71 files, one group (Denisse)**. | **No structured reference field exists anywhere** (`ref_elect_id`/`ref_ntrode_id` = 0 files in 1,792). References survive only as `description:'tetrode_reference'` (448 groups) + `# reference` comments (366 lines, dropped on parse). Reframes "reference integrity" entirely. |
| **`task_epoch`(sing.)/`task_epochs`(pl.) + scalar/list typing.** 325: scalar 1212/list 463; sing 98/pl 225. Corpus-2: **scalar 3,247 / list 4,728 rows; sing 4,489 / pl 8,860 rows**; clean 2022→2023 key flip. | **`device_type` typo class generalized to a hardware-gap class:** `screw`+`single_electrode` is **65 files / 17 animals / 2 users**, a real EEG/skull-screw setup the app *cannot express* — feature gap, not user error. | **15 unparseable files (3 syntax classes)** — esp. **13 identical xulu/Lily `task_epochs:`-label-drop** copies (one template typo × 13 days). The 325-set had 0 parse errors. |
| **Invariants** `raw_data_to_volts`/`times_period_multiplier`/`institution`. 325: identical in all 325. Corpus-2: 99.3% / 91.9% / 99.8%, each with a small enumerable break-set. | **`device_type` 15 distinct values → 6 unresolvable** (2,122 rows / 66 files), quantified vs the 12-probe catalog. | **camera_id dangling references — 13 app-era files (2023-25)** (e.g. SC127 task `camera_id:[0,1]` but only camera `id:0` exists). The clearest residual error the *current app still permits*. |

**Net:** the structural model is fully validated; the new value is (a) the **silent value-error
classes** now enumerated (volume, power, space-keys), (b) the **app-era residual** (camera_id dangling,
`1.5cd`, empty-opto scaffolding), and (c) the **per-experimenter systematic-error** mechanism.

---

## 3. The master error-class catalogue (the centerpiece)

One ranked table, **real-only** counts. Ranked by **severity × frequency × cost**. "Silent" classes
(look fine, wrong downstream) are the dangerous ones and sort to the top within a severity band; "loud"
classes (the user sees a stack trace) are far cheaper even when frequent.

**Severity legend:** HARD-FAIL = conversion stops/throws · SILENT-CORRUPT = converts, wrong NWB ·
DANDI-REJECT = fails publication validation · SPYGLASS-FRAGMENT = pollutes/splits the DB ·
COSMETIC = harmless drift. **Cost** = how late + how expensive to discover.

| # | Error class | What it is | Frequency (real) | Severity | Cost (how late) | Conf. | Source |
|---:|---|---|---|---|---|---|---|
| **1** | **Space-separated top-level keys** | `electrode groups:` / `ntrode electrode group channel map:` (spaces). Converter keys on underscores → reads **zero electrodes**; file "converts" with no ephys. | **36 files** (alison 26, jhbak 4, amankili 3, loren 2); 2021-heavy | **SILENT-CORRUPT (total electrode loss)** | Worst: irreversible, invisible — discovered only when ephys is missing in analysis | HIGH | C, H |
| **2** | **Volume 1000× conflict** | `volume_in_uL: 0.45` vs `volume_in_ul: 450` in one injection block (µL/nL slip). Schema-stored `volume_in_ul`=450 µL is physically impossible. | **49 files / 99 blocks / 10 animals** (re-derived) | **SILENT-CORRUPT (DANDI-reject if validated)** | Late: wrong injected volume in NWB/Spyglass; survives the shim | HIGH | G, A |
| **3** | **`power_in_W: 200`** | Laser model number `LuxX+ 638-200` (200 = max mW) typed into the watts field; ~10,000× too high. Real power in `fs_gui.power_in_mW` (2-50). | **70 / 71 opto files** | **SILENT-CORRUPT** | Late: corrupt excitation-source record; recoverable from fs_gui but the field itself is wrong | HIGH | G |
| **4** | **Unresolvable `device_type`** | Value not in the 12-probe catalog → trodes_to_nwb `FileNotFoundError`. `screw`+`single_electrode` (real hardware gap), `…15um-40um…` typo, legacy `tetrode`. | **66 files / 18 animals** (2,122 rows) | **HARD-FAIL** | Hours-late (at conversion) but **loud** when it fires | HIGH | C |
| **5** | **species non-binomial** (`Rat`) | House style; DANDI requires Latin binomial / NCBI Taxon URI. | **944 / 1,792 (53%)** | **DANDI-REJECT** | Very late (publication); blocks archive | HIGH | B |
| **6** | **sex non-single-letter** (`Male`) | DANDI/NWB expect `M`/`F`/`U`/`O`. | **938 / 1,792 (52%)** | **DANDI-REJECT** | Very late (publication) | HIGH | B |
| **7** | **Same-animal DOB / genotype / species conflict** | One animal's static fact takes ≥2 values across its own days (re-typed daily). 6 DOB, 6 genotype (incl. CH105 case/control mislabel), 1 species. Interleaved cases (Seth) defeat "latest wins". | **13 animals** | **SILENT-CORRUPT (mislabels the experiment)** | Late + irrecoverable when interleaved; for disease models, corrupts the science | HIGH | B, A |
| **8** | **DOB missing** | Schema-`required` under `subject`; DANDI needs age or DOB. The legacy/`Rat` population. | **964 / 1,792 (54%)** | **DANDI-REJECT / schema** | Late (publication / re-author) | HIGH | B |
| **9** | **weight string-with-unit** (`"541g"`) | Typed-numeric field carrying a unit string; +142 missing (8%). | **782 / 1,792 (44%)** | **DANDI-REJECT / schema** | Medium-late | HIGH | B |
| **10** | **NULL-like `location` on ACTIVE group** | Active electrode (≥1 good channel) with empty/`None`/`NotInBrain`/`Dead tetrode` location → Spyglass "Unknown" BrainRegion, breaks spatial queries. (NOT the 1,272 disabled-tetrode rows.) | **752 active rows** | **SPYGLASS-FRAGMENT** | Late (DB) + silent | HIGH | C |
| **11** | **`location` fragmentation** | Case splits (`hippocampus` 33,992 / `Hippocampus` 5,558; `ca1` 3,519 / `CA1` 78), typo `hippcoampus` (103), junk (`'`, `Dead tetrode`) → duplicate/garbage BrainRegion rows. | thousands of rows; 52 raw → 45 norm spellings; 103 typo | **SPYGLASS-FRAGMENT** | Late (DB), permanent | HIGH | C |
| **12** | **strain in genotype field** (`Long-Evans Rat`) | Strain/background entered as genotype; mislabels genotype semantics in Spyglass. | **332 / 1,792 (19%)** | **SPYGLASS-FRAGMENT / wrong semantics** | Late (DB / analysis) | HIGH | B |
| **13** | **`times_period_multiplier: 1.5cd`** | String typo in a numeric field; one author (Sunrae), **100% of her 53 active files**. Fails AJV/jsonschema `number`; if tolerated, garbage multiplier. | **53 files** | **HARD-FAIL (schema) / SILENT coercion** | Medium; ships continuously from an active author | HIGH | H, A |
| **14** | **`task_epoch`/`task_epochs` key split + scalar/list typing** | `associated_video_files` keys epochs as singular (4,489 rows) or plural (8,860); `associated_files[].task_epochs` scalar (3,247) or list (4,728). 2 files mix both within one file (SC131 → partial video-link loss). | 1000s of rows; 2 files mixed | **SILENT (partial epoch-link loss)** | Late + silent for the dropped population | HIGH | F, H |
| **15** | **camera_id dangling reference** | `tasks[].camera_id` / `avf[].camera_id` points at a `cameras[].id` that doesn't exist → video/position can't resolve. **App-era (2023-25).** | **14 files / 4 animals** (SC127, SC18, Frodo, Lotus) | **SILENT-CORRUPT (broken video/position link)** | Late + silent; live residual in current app output | HIGH | F |
| **16** | **Space-key wholesale (missing `subject_id`)** | Legacy `subject id:` space-key → extractor sees empty `subject_id`; real session, but trodes_to_nwb expects `subject_id`. (Subset overlaps #1's files.) | **35 files** | **HARD-FAIL / empty Subject** | Medium; loud at conversion | HIGH | B |
| **17** | **Out-of-range bad_channel** | `bad_channels:[4]` on a 4-index tetrode (valid 0-3); silently dropped → the real failing channel is **not** excluded from the NWB. | 2 ntrodes / 1 clean file (+1 compounded) | **SILENT-CORRUPT** | Late + silent (wrong channel kept); rare today, scales with high-channel probes | HIGH | D |
| **18** | **Unparseable YAML syntax** | Under-indented list item (×2) + dropped `task_epochs:` label (×13 identical xulu/Lily) + 1 uncollected. | **15 files** | **HARD-FAIL** | Early + **loud** (yaml.load throws); cheapest to fix | HIGH | H |
| **19** | **Intra-day cross-copy disagreement** | Two saved copies of the *same* recording day disagree on bad_channels → pipeline result is non-deterministic by which copy it ingests. | 11 animals / 76 date-rows | **SILENT (non-deterministic)** | Late + silent; eliminated by single-source-of-truth day | MED-HIGH | D |
| **20** | **`raw_data_to_volts` placeholder / `2.95e-7`** | `1`/`0`/`None` drafts (wrong µV scaling) + one plausibly-real alternate ADC gain `2.95e-7` (flag, don't auto-fix). | 9-12 files | **SILENT-CORRUPT (wrong scaling)** | Late + silent | HIGH | A, H |
| **21** | **`units.analog/behavioral_events` 6-way encoding** | `'unspecified'` / `"'unspecified'"` (double-quoted, value includes the quotes) / `-1` / `1` / `Unknown`. | 335 double-quoted + variants | **COSMETIC → MED** (the double-quote value is wrong) | Low | HIGH | H |
| **22** | **DANDI-tolerant free-text drift** | `lab` (`Loren Frank` / `…Lab`), `default_header_file_path: ''` (128) / absolute paths, `data_acq_device.system` (`MCU`/`SpikeGadgets`/`Main Control Unit`), task-name casing (`sleep`/`Sleep` 986/153). | hundreds | **COSMETIC / SPYGLASS-FRAGMENT (mild)** | Low | HIGH | A, F, H |
| **23** | **Orphan/dangling ntrode `electrode_group_id`** | ntrode references a non-existent electrode group (off-by-one); + dup `ntrode_id`; + eg-with-zero-ntrodes. | 2 + 1 + 1 files (legacy) | **SILENT (electrode mis-assignment)** | Late + silent; rare | HIGH | C |
| **24** | **MMDDYYYY filename** | Breaks trodes_to_nwb date-based session grouping. | 7 files | **HARD-FAIL (grouping)** | Medium; loud-ish | HIGH | A |
| **25** | **Placeholder subject_id** (`12345`/`54321`) in a real dir | Shipped template default in a real session. | 4-5 files | **SPYGLASS-FRAGMENT** | Medium | HIGH | B |

> **Silent vs loud, restated:** the *cost* ranking is dominated by silence. #1, #2, #3, #7, #10, #14,
> #15, #17, #19, #20, #23 all produce a "successful" conversion with wrong/missing data — they are the
> ones the app must gate because **downstream validation does not raise** (trodes_to_nwb logs and
> continues; Spyglass logs ingestion errors to a side table; NWB Inspector findings don't fail the run).
> The loud classes (#4, #13, #16, #18, #24) are cheaper because someone sees them.

---

## 4. Invariants — "derive, never ask"

Fields **truly constant across all real files**; every violator is an enumerable data-entry slip
(verified at raw line level for the surprising ones). These are the highest-confidence gate/derive
candidates in the corpus.

| Field | Invariant value | Holds (real) | Break-set (all enumerable errors) | Action |
|---|---|---:|---|---|
| `raw_data_to_volts` | `1.95e-7` | **1,780 / 1,792 (99.3%)** | `1`×7, `None`×3, `0`×1, `2.95e-7`×1 (the last *maybe* real alt-hardware → **prompt**, don't auto-fix) | derive/lock with override |
| `times_period_multiplier` | `1.5` | **1,646 / 1,792 (91.9%)** | `"1.5cd"`×53 (Sunrae), `1`×89 (legacy default), `None`×2, `0`×1, `2.5`×1 | derive/lock; **type-check `number` on export** |
| `institution` | `University of California, San Francisco` | **1,789 / 1,792 (99.8%)** | `UCSF`×2, `…TIFR`×1 (genuine non-Frank-lab outside file) | default + warn on differ |
| **electrode-group key set** | the 9 canonical keys | every real eg row, 2017-2026 | only the 36 space-key files | encoder owns the keys |
| **ntrode key set** | the 4 canonical keys | every real nt row | same | encoder owns the keys |
| **`map` value space** | probe-local `0..N-1`, reset per ntrode/shank | 64,618 ntrodes; **0** use global hardware channels | — (lab-wide law) | derive from device geometry |
| **channels-per-ntrode** | = probe geometry (tetrode 4; 128c-4s shank 32; NET 128; …) | 52,619/52,619 tetrodes | 1 malformed legacy file (`beans`, maplen=4) | assert on export |
| **ntrodes-per-eg** | = probe **shank count** (so n_nt = Σ shanks ≥ n_eg) | 789/800 mismatches explained | 11 (all unresolvable-device / legacy) | **do NOT** flag n_eg≠n_nt |
| **behavioral_events shape** | `[{description: <Din/Dout channel>, name: <label>}]` | whole corpus | — (note: channel is `description`, not `name`) | label the form correctly |
| **opto block key set** | identical key set per section incl. the `volume_in_uL`+`volume_in_ul` shim | every real-opto block | — (the shim is correct; only *values* err) | derive both volumes from one input |
| **session_start_time** | **absent by design** (derived from `.rec` timestamp) | 100% | — | do NOT add/require it |

**Per-animal invariants (not lab-wide, but one true value *per animal*):** `species`, `sex`,
`genotype`, `date_of_birth`, `subject_description`/strain, `subject_id`. Cross-day difference = error
(the 13 self-contradicting animals). Enter-once-at-animal-level-and-derive makes them impossible.

---

## 5. The three axes (how data varies, and which axis governs which fields)

### Axis 1 — TIME (the 2022→2023 phase change, then stable)
Not gradual drift — a **step**. Pre-2023 ≈ legacy hand-built (`Rat`/`Male`/`"547g"`/no-DOB,
space-keys); from **2023** the schema-typed fields flip to ~100% app form (binomial species, `M`/`F`,
numeric weight, py-datetime DOB); 2024-2026 are stable. Era-flips: `associated_video_files` epoch key
`task_epoch`→`task_epochs` (~2023), `associated_files` epoch typing scalar→list. **Governs:** encoding
*format* of the schema-typed subject fields + the epoch key/typing. Two free-text fields drift the
*other* way over time (newer users type the longer form): `lab` (`Loren Frank Lab` rises 2024→26),
`default_header_file_path`.

### Axis 2 — EXPERIMENTER (per-person house conventions; high internal consistency)
Over 18 experimenters with ≥5 files, each is **78-94% single-valued** per convention field
(institution 94%, species/sex/shape 89%, name-order/weight/lab/opto-presence 83%, units 78%). The few
multi-valued cells are the **2022 migration captured within one long-tenured person** (Coulter solo
straddles 2020-2023), not noise. **Governs:** species/sex *token*, name order/shape, `lab` form, units
encoding, DIO naming *philosophy* (semantic/positional/raw/empty), whether they do opto (≈static, 3
exceptions), task-epoch key style, whether they mark bad channels at all (0%→100% by person — so
absence of marks ≠ clean electrodes). → **Experimenter is the right axis for *default templates*** (seed
from their own most-recent **post-2023** file, with DANDI-compliant values).

### Axis 3 — ANIMAL / DAY (the static / day-owned / drift three-tier model)
- **Animal-static (lock + derive):** species, sex, genotype, DOB, strain/description, subject_id,
  n_electrode_groups, device_types, eg locations, opto implant. *Any* cross-day variance here = error.
- **Day-owned (legitimately varies — never lock):** `weight` (animal weighed daily — 46/142 animals
  vary, all real), tasks/`n_tasks`/task_names (40-76/140), cameras, `n_associated_files` (94/140),
  bad_channels (carry-forward, near-monotonic), behavioral_events (34/140 vary; name↔channel binding is
  board-dependent and day-owned — the Senor split), session_description.
- **Drift = the error signal:** the 13 self-contradicting animals are the proof that daily re-entry of
  the static tier produces only drift.

**One-line rule:** TIME governs *format*, EXPERIMENTER governs *convention/defaults*, ANIMAL governs
*static facts (lock)*, DAY governs *the small real delta (carry-forward)*.

---

## 6. Data-hygiene census (for anyone re-running)

- **The 7 non-real files** (`is_suspect==True`, quarantined from "what real data looks like" stats,
  kept nowhere in the headlines): `20230622_sample_metadata.yml` (golden template — source of the
  `Rattus pyctoris` + `volume_in_ul:100` + `power_in_W:0.077` oddities), `{EXPERIMENT_DATE…}_54321`,
  `…_bs28` template, `…_sc92` placeholder, `denisse_test/…Jacob` (the 20 "Jacob" opto files are
  test fixtures — excluded from the 71 real-opto count), `nwb_test/…eliot_test`,
  `recording_pilot/…isaactest`. **Quarantine was filename/path-based ONLY** — never on data values
  (that would hide real errors). This was a corrected mistake: an early pass wrongly flagged
  `subject_id: None`/`12345`/`54321` as non-real and hid findings.

- **Placeholder / missing IDs are kept as findings, not quarantined:** `12345`×3 + `54321`×2 shipped in
  **real** dirs (template defaults that propagated, e.g. `kf19/raw/.../20170917_kf19`); **35 real files
  have an empty `subject_id`** because they use the legacy space-key `subject id:` — the animal is fully
  recoverable, so these are a **format bug, not lost data**.

- **15 unparseable files** are excluded from parsed stats but ARE a top finding (error class #18),
  analyzed from `BROKEN_YAML_REPORT.tsv`/raw, not `records.jsonl`. One (`jhbak/.../kf2_20170201`) is
  **absent from disk** — uncollected, syntax error unverifiable.

- **Cross-copy duplicates (the big methodological trap):** 1,814 → 1,681 unique-by-content. The same
  recording day is re-saved by curators under their own home dirs (Chiang under `sc4712`/`ebroyles`;
  CH73 under `mcoulter` *and* `rhino` with *different* bad_channels). **Two views are mandatory:**
  per-file (what ships) vs content-deduped + per-(experimenter × animal) (who does what / drift).
  `records.jsonl` **cannot see inside space-key files** (it keys on underscored names) — those 36 files
  read as near-empty and must be parsed from raw (Category H/C did this). **Reconciliation note:** most
  cross-note count differences are real-full (1,792) vs real-dedup (1,674); I re-derived species/sex
  (944/938 on full), DOB/weight (964/782 on full), and the volume conflict (**49 files/99 blocks**,
  reconciling Cat-A's looser "50/100" which folded in the suspect `sample_metadata` 0.45/100 block).

---

## 7. Open questions / falsifiers (what would confirm or overturn the headlines)

The whole report leans on the **assumption that downstream is silent** and that wrong YAML values land
verbatim in the NWB. The single highest-value falsifier is to **read the NWB a denisse opto file
produces** and a space-key file's NWB:

1. **Does `volume_in_ul: 450` land verbatim in the NWB `volume` field, and `power_in_W: 200` in the
   excitation source?** (THE load-bearing check.) If trodes_to_nwb reads `volume_in_uL` (0.45) and
   ignores `volume_in_ul`, the volume error downgrades from "corrupt NWB" to "corrupt-but-unused
   metadata." If it persists `volume_in_ul`, error class #2 is confirmed critical. Same for `power_in_W`
   vs the per-epoch `fs_gui.power_in_mW`. **Verify:** run `create_nwbs` on one denisse file →
   `nwbinspector --config dandi` and read the stored `volume`/`power` (per `docs/PIPELINE_REQUIREMENTS.md`).
   *Confidence the YAML is wrong: HIGH; confidence it corrupts the NWB: MEDIUM until read.*

2. **Does the converter require all 4 opto sections non-empty if any is non-empty, or accept
   `fs_gui_yamls: []` beside a populated `optical_fiber`?** Decides block-vs-warn for the 19
   `fs_gui:[]` files. Read trodes_to_nwb's opto loader.

3. **Does trodes_to_nwb source `ref_elect_id` from the YAML or only the `.rec` XML?** If only the XML,
   the *absence* of a structured reference field (0/1,792) is correct and no field is needed; if it
   reads YAML, the 448 free-text `tetrode_reference` descriptions + 366 dropped `# reference` comments
   are an unrecorded-data gap. Read the electrode-table builder.

4. **Is `task_epochs` scalar↔list actually mishandled downstream, or normalized?** If trodes_to_nwb
   coerces scalar→list, error class #14 is harmless (downgrade to COSMETIC). Trace its read of
   `associated_files[].task_epochs`.

5. **Are space-keyed files truly read as zero electrodes** (vs a space/underscore-insensitive lookup)?
   Prior study read the converter source and confirmed underscored literals; re-verify if the converter
   changes. *Confidence: HIGH.*

6. **`2.95e-7` raw_data_to_volts — typo or real alternate ADC gain?** Check the matching `.rec` hardware
   config for that animal (kf2). Because it's a plausible physical value, the app should **prompt**, not
   auto-rewrite. *Unresolved — flag.*

7. **Is `1.5cd` an app free-text path or a post-export hand-edit?** Sunrae's files are otherwise fully
   app-generated. Check the current app's `times_period_multiplier` input type. Either way an
   export-time numeric gate closes it; this only affects whether the app *introduced* it.

8. **"Shared animal = collaboration vs re-curation copy."** Most cross-user `subject_id`s are a curator
   re-saving another member's data (diff md5 to confirm), not co-ownership — matters only for provenance
   counts, not guards.

---

*Feeds P4 design-implications. Cross-refs: per-category app-guard sections (each `cat-*.md` "App-guard
/ UX implications"), [../ux-principles.md](../ux-principles.md),
[../../plans/scope-tiers-ia/](../../plans/scope-tiers-ia/). Reconciliation re-derivations run against
`~/Downloads/yaml_analysis2/{records.jsonl, cat_g_opto_extract.json}`; aggregates unchanged.*
