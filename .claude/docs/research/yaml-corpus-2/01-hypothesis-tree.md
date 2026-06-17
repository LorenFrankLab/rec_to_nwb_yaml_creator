# YAML corpus-2 — hypothesis tree

Confidence is a calibrated subjective probability, updated each phase. `↑/↓` = moved since last update.
Format: **Hn** (claim) — *confidence* — evidence / what would falsify it. Competing siblings **Hn'**.

_Last updated: 2026-06-17, after **P2** (8 category deep-dives complete; all raw-spot-checked)._

> **P2 resolution at a glance.** H1 ✅0.9, H1′ ✅0.95, H2 ✅0.85 (experimenter axis confirmed), H2′ ✅0.8
> **but refined** — time is a *sharp 2022→2023 phase transition* (app adoption), then stable, not gradual
> drift. H3a/b/c all confirmed (ranking → 03-synthesis). H4 ✅0.8 (app fixes the big vocab classes:
> post-2023 app files are DANDI-compliant on species/sex/weight/dob). H4′ ⚠0.6 — app-era *does* carry a
> residual: **camera_id dangling refs (13 files, 2023-25)**; the `volume_in_uL/ul` dual key is a benign
> derived shim. H5 ✅0.9 (67 DIO sets; `RightMilk_Pump`→8 channels; `Din1`→21 names). H6 ✅0.85
> (66 files unresolvable device_type; 752 *active*-group NULL locations; `hippocampus` 33,992 vs
> `Hippocampus` 5,558). **New surprise:** structured reference fields (`ref_elect_id`) **don't exist** in
> any file — references live only in free-text `description`/`# comments` that are dropped on parse.

---

## H1 — The 325-set structural findings generalize to 1,814 files
*(three-tier static/day/convention model; copy-forward drift; free-text fragmentation; two
populations; unstable DIO name↔channel)*
**Confidence: 0.85 (HIGH).** Already replicated at scale: species split (`Rat` 943 / `Rattus
norvegicus` 849), sex (`Male` 936 / `M` 768), weight (string-with-unit 782 / numeric 875), dob
(missing 965 / py-datetime 831), location fragmentation (5 normalized clusters over 50 spellings),
52 animal-static drift events across 142 multi-day animals.
*Falsify if:* category deep-dives find the model breaks down for >1/3 of the new users.

- **H1′ — The larger/older corpus reveals NEW error classes the curated set missed.**
  **Confidence: 0.85 (HIGH) ↑.** Already true: space-separated-key batch (≥35 files, mostly Alison
  2020–21 `old_nounderscore_metadata/`), real files shipping placeholder IDs `54321`/`12345` (4),
  35 real files missing `subject_id`, exotic-species mislabels (`Rattus rattus` on Long-Evans rats),
  `MMDDYYYY` filenames (7), `Rattus pyctoris`/sample artifacts. P2 will quantify severity.

## H2 — Experimenter is the dominant axis of *convention* variation
**Confidence: 0.6 (MEDIUM).** 325-set showed each experimenter internally consistent. Not yet
re-confirmed at scale; storage-user ≠ experimenter muddies the per-file view.
*Falsify if:* within-experimenter variance ≈ across-experimenter variance after normalization.

- **H2′ — Time/era is a comparably strong axis (format evolved 2017→2026).**
  **Confidence: 0.6 (MEDIUM).** Year spread is real (2017:8 … 2021:501 … 2026:92); space-key files
  cluster in 2020–21; app-style ISO dob/binomial species rise later. P2-A tests `gen_class`-by-year
  and key-style-by-year. Likely **both** experimenter and era matter (not mutually exclusive).

## H3 — Which error MECHANISM dominates?
Three non-exclusive competitors; the question is relative frequency **and** cost.
- **H3a — Copy-forward drift of animal-static fields.** *Confidence 0.6.* 52 drift events seen.
- **H3b — Free-text fragmentation of controlled-vocab fields** (location, species, sex, genotype,
  lab, DIO names). *Confidence 0.75 (MEDIUM-HIGH).* Pervasive across every vocab field measured.
- **H3c — Structural/format errors that HARD-FAIL conversion** (space keys, broken YAML, placeholder
  IDs, unresolvable `device_type`). *Confidence 0.8 (HIGH) for cost; frequency lower but nonzero.*
  These are the most expensive (silent or hours-late failure) even if rarer.
*Resolution:* P3 ranks by severity × frequency × cost; all three likely earn guards.

## H4 — The app already eliminates legacy error classes; app-gen files have a small residual set
**Confidence: 0.55 (MEDIUM).** 325-set argued the 98 legacy files show the very errors the app
prevents. Need a clean app-gen vs hand-built split (`gen_class` is coarse) before trusting the
residual-error estimate.
- **H4′ — App-gen files introduce their OWN systematic issues** (a wrong default propagated, the
  `volume_in_uL/ul` shim, scalar/list typing). **Confidence: 0.4 (LOW-MED).** P2 tests per-class.

## H5 — DIO name↔channel mapping is unstable → no lab-wide template is possible
**Confidence: 0.8 (HIGH).** Strong in the 325-set (21 name-sets; `RightWell_Poke` on 4 Din,
`Din14` carried 9 names). Re-verify at 1,814 scale (P2-E). Design consequence: stems + autocomplete +
carry-forward, **not** a fixed preset.

## H6 — `device_type` / probe + `location` integrity is a top *silent* corruption risk
**Confidence: 0.7 (MEDIUM-HIGH).** 15 distinct `device_type` values vs 12 known probes (typos =
`FileNotFoundError`); 262 NULL-like location rows fragment Spyglass `BrainRegion`. P2-C quantifies how
many are genuinely active groups vs deliberately-unused tetrodes.

---

## Open methodological questions (self-critique)
- Are space-key files double-counted as "missing experimenter/subject" when really the whole file is
  spaced? (→ Category H must parse them from raw; don't infer absence.)
- Does content-dedup change the population balance materially? (1,814→1,681; re-run key stats deduped.)
- Is `gen_class` conflating "old hand-built" with "old app version"? Need a positive app-output
  fingerprint (e.g. the `volume_in_uL`+`volume_in_ul` dual key, ISO+Z dob) to identify true app output.
