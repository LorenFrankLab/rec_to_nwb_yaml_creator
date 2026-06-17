# YAML corpus-2 investigation — plan

**Date:** 2026-06-17 · **Corpus:** `~/Downloads/collected_metadata_yamls` (1,814 files,
21 storage-users, **2017→2026**, 15 unparseable). Successor to the committed 325-file study
[../yaml-corpus-analysis.md](../yaml-corpus-analysis.md) — this is **~5.6× larger**, spans 9 years,
and includes many users absent from the first study (rhino 364, jguidera 177, rio, amankili, xulu,
sunrae, kyu, …).

## Goal

From real neuroscientist-authored metadata, identify **invariants vs variation across time /
experimenter / animal**, catalogue **error classes by severity × frequency × cost**, and translate
each into a concrete **app guard + efficient data-entry UX**. Accuracy is paramount: conversions take
hours and mistakes surface late, downstream in NWB → DANDI → Spyglass.

## Methodology (the load-bearing decisions)

1. **Deterministic-first.** One Python analyzer parses *all* files →
   `~/Downloads/yaml_analysis2/REPORT2.md` + `records.jsonl` (one row/file, all extracted fields).
   Aggregates come from code over the full corpus, never from LLM sampling. Reproducible
   (`uv run analyze2.py`). Scratch lives outside the repo (real lab data is **not** committed).
2. **Data hygiene — quarantine non-real, keep real-but-broken.** `is_suspect` (filename/path-based
   ONLY) removes templates/test fixtures from "what real data looks like" stats. We **never**
   quarantine on data values (that would hide real errors) and **never** quarantine experimenter
   `/bad/`, `/old/`, "to check" dirs — those are real sessions with known problems, exactly what we
   study. Placeholder-ID (`54321`/`12345` in a real session) and missing-subject_id are **findings**,
   kept in real stats.
3. **Spot-check discipline (per user directive).** No aggregate is trusted until verified against ≥1
   raw file. Surprising claims get **cross-file / same-animal** corroboration (e.g. the `Rattus rattus`
   "black rat" scare resolved by within-file description contradiction + same-animal cross-file
   disagreement). Watch continuously for bad/example data masquerading as real.
4. **Two views, always.** (a) *per-file* = what actually gets produced; (b) *content-deduped +
   per-(experimenter × animal)* = who does what, and day-over-day drift. Storage-user ≠ experimenter
   (same animal appears under collaborators), so key identity analysis on `experimenter_name` +
   `subject_id`, not the directory.
5. **Confidence + competing hypotheses.** Every claim carries a confidence level; we maintain a
   [hypothesis tree](01-hypothesis-tree.md) with ≥2 competing explanations per major question and
   update confidence each phase. Self-critique (biases, survivorship) recorded in the
   [research log](02-research-log.md).

## Known biases / threats to validity (mitigations)

- **Storage-user imbalance** (rhino 364 … emonroe 1) → per-file stats over-weight a few people. *Mitigate:*
  per-(experimenter × animal) and per-experimenter-normalized views.
- **Cross-user content duplicates** (1,814 → 1,681 unique by md5). *Mitigate:* dedup for "what real data
  looks like"; keep multiplicity for provenance/collaboration.
- **Space-separated-key files** (`experimenter name`, `electrode groups`) read as near-empty records
  (the extractor keys on underscored names). *Their real content is invisible in `records.jsonl`.*
  *Mitigate:* Category H handles these from raw text; treat missing-experimenter/subject as a
  space-key signal, not absence.
- **`gen_class` (legacy vs app) is a coarse heuristic**, not ground truth — corroborate before relying.
- **Survivorship:** the 15 unparseable files are excluded from parsed stats but are themselves a
  top-severity finding — analyzed separately from `BROKEN_YAML_REPORT.tsv`.

## Phases

- **P0 — recon + foundation** ✅ (done). Corpus shape, prior-work reuse, `analyze2.py`, hygiene pass,
  first spot-checks. Headline numbers in the [research log](02-research-log.md).
- **P1 — substrate** ✅ (done). `REPORT2.md` + `records.jsonl` produced and verified.
- **P2 — category deep-dives** (parallel agents). Each consumes `records.jsonl` + spot-checks raw
  files, and writes `cat-<X>-*.md` with findings, confidence, raw evidence, and competing hypotheses:
  - **A** Provenance · time-evolution (2017→2026) · two-populations · per-experimenter conventions
  - **B** Subject identity & controlled vocab — species, sex, weight, dob, genotype vs strain vs
    description, `subject_id` ↔ filename/animal, placeholder/missing IDs
  - **C** Electrode groups · `device_type` resolvability · `location`/`targeted_location` · references
    (`ref_elect_id` etc.) · ntrode channel maps · channel-count integrity
  - **D** Bad channels — per-day evolution & monotonicity, ranges, per-experimenter conventions,
    disabled-vs-failed
  - **E** DIO / `behavioral_events` — set diversity, name↔channel stability, per-experimenter/day,
    unnamed `din/dout`
  - **F** Tasks · cameras · epochs · `associated_files` · `associated_video_files` — typing
    (scalar/list), `task_epoch(s)` naming, camera_id linkage integrity
  - **G** Optogenetics — partial-opto, numeric range sanity (`power_in_W`), `volume_in_uL/ul` shim,
    coordinates
  - **H** Structural / schema validity — root-cause the 15 broken files, space-key batch, duplicate /
    case-variant keys, scalar/list typing, units, misc invariants
- **P3 — synthesis.** Reconcile vs the 325-set (generalized / changed / new); resolve the hypothesis
  tree; rank error classes by severity × frequency × cost; full data-hygiene census.
- **P4 — design implications.** Map each confirmed error class → a concrete app guard + UX lever,
  cross-referenced to the current app and [../ux-principles.md](../ux-principles.md) /
  [../../plans/scope-tiers-ia/](../../plans/scope-tiers-ia/). This is the payoff.

## Outputs

- Committed: this dir (`00-plan`, `01-hypothesis-tree`, `02-research-log`, `cat-*`, `03-synthesis`,
  `04-design-implications`) — aggregates + redacted examples only.
- Scratch (not committed): `~/Downloads/yaml_analysis2/{analyze2.py, REPORT2.md, records.jsonl, …}`.

## Reproduce

```bash
cd ~/Downloads/yaml_analysis2 && uv run analyze2.py   # writes REPORT2.md + records.jsonl
```
