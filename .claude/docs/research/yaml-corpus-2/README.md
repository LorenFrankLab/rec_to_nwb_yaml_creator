# YAML corpus-2 investigation — index

A structured, multi-agent analysis of **1,814 real-world NWB-metadata YAML files** (21 storage-users,
**2017→2026**) from Frank Lab network drives, run to find invariants + error classes and translate them
into concrete app guards + data-entry UX for `rec_to_nwb_yaml_creator`. Successor to the 325-file
[../yaml-corpus-analysis.md](../yaml-corpus-analysis.md) (~5.6× larger, 9-year span, many new users).

## Read in this order

| Doc | What's in it |
|---|---|
| [00-plan.md](00-plan.md) | Goal, methodology (deterministic-first + spot-check discipline + data hygiene), phases, biases. |
| [01-hypothesis-tree.md](01-hypothesis-tree.md) | Competing hypotheses with calibrated confidence, resolved through P2. |
| [02-research-log.md](02-research-log.md) | Append-only findings + every raw-file spot-check. |
| **[03-synthesis.md](03-synthesis.md)** | **The master ranked error-class catalogue** + reconciliation vs the 325-set + the three axes. Start here for findings. (Raw-YAML severities; **re-prioritized by 05/06** — see log P5.) |
| [05-downstream-trodes-nwb.md](05-downstream-trodes-nwb.md) | Per-error verdicts vs trodes_to_nwb SOURCE — silent-corruption vs coerced vs loud-fail; authoritative 12-probe list. |
| [06-spyglass-constraints.md](06-spyglass-constraints.md) | How Spyglass ingests the NWB + the upstream constraints it imposes (BrainRegion fragmentation, subject_id collation, name-shape, all-or-nothing electrode columns). |
| [07-current-app-audit.md](07-current-app-audit.md) | Honest current-app state: capability matrix vs the corrected error classes (YES/PARTIAL/NO, file:line), what it does well, the gaps. |
| **[08-ux-and-roadmap.md](08-ux-and-roadmap.md)** | **The capstone** — UX best practices for silent-consequence scientific metadata + the prioritized, gap-aware build roadmap. Start here for action. |
| **[04-design-implications.md](04-design-implications.md)** | The first-pass gap-aware guard table (superseded in priority by 08, which folds in downstream verification). |
| [09-cameras-video-downstream.md](09-cameras-video-downstream.md) + [09-cameras-video-corpus.md](09-cameras-video-corpus.md) | Camera identity (`CameraDevice` keyed on name; re-zoom needs a new name) + the calibration-aliasing silent corruption + video→task→epoch linkage. |
| **[10-app-import-roundtrip.md](10-app-import-roundtrip.md)** | **Empirical:** the app's real import code run over 1,674 real files — 16.7% clean, the `task_epochs` list-vs-scalar BUG blocking 63%, the filename date-parse gap. |
| [11-epoch-linkage-integrity.md](11-epoch-linkage-integrity.md) | Epochs as the cross-section join key; the 821-file singular-`task_epoch` hard KeyError; dangling/gap/base defects. |
| [12-associated-files-statescript.md](12-associated-files-statescript.md) | Statescript-log integrity; the 1,055-file list-typing silent Spyglass drop; duplicate name/path; bad paths → empty logs. |
| `cat-A..H-*.md` | The 8 category deep-dives (provenance/time, subject vocab, electrodes/probes/refs, bad channels, DIO, tasks/cameras/epochs, opto, structural validity). |

## Headline

~80% of every YAML is animal-static boilerplate re-typed each recording day → the two dominant failure
modes are **copy-forward drift** and **free-text fragmentation**, and the worst errors are **silent**
(convert "successfully", corrupt downstream). Downstream validation rarely raises, so **this app is the
real gate.** The format underwent a sharp **2022→2023 legacy→app phase change** and has been stable
since; the app already closes most high-frequency classes. Biggest remaining gap: **`power_in_W: 200`**
(a ~10,000× opto-power error in 70/71 blocks) has no guard today.

## Reproduce

Scratch (NOT committed — real lab data): `~/Downloads/yaml_analysis2/`.

```bash
cd ~/Downloads/yaml_analysis2 && uv run analyze2.py   # → REPORT2.md + records.jsonl (substrate)
# per-category extractors: cat_a_*.py … cat_h_*.py (each writes JSON the notes cite)
```

Every aggregate in these notes was spot-checked against ≥1 raw file; surprising claims got cross-file /
same-animal corroboration. Non-real artifacts (templates/test fixtures, 7 files) are quarantined via
`is_suspect`; real-but-broken files are kept and studied. _Study run 2026-06-17._
