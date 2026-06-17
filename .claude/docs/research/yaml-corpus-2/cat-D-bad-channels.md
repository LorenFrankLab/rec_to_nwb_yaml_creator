# Category-D — bad_channels in the real-world YAML corpus

Scope: 1,792 real (non-`is_suspect`) parseable files of the 1,814-file
`collected_metadata_yamls` corpus. All numbers below use the **canonical full-document
parse** (`yaml.safe_load`) — i.e. what `trodes_to_nwb` actually sees — unless noted.
Reproduce: `uv run /Users/edeno/Downloads/yaml_analysis2/cat_d_analysis.py`,
`cat_d_q3_v3.py` (monotonicity), and the inline consolidation in this note's session.

`bad_channels` are **probe-local channel indices** scoped to one ntrode/electrode group.
The authoritative per-ntrode valid range is the size of that ntrode's `map` (the `map`
keys are the probe-local indices `0..N-1`). Verified: `map_size` is perfectly consistent
per `device_type` across the corpus — `tetrode_12.5`→4 (all 51,680 ntrodes),
`screw`/`single_electrode`→1, `128c-4s*`→32 per shank, `NET-EBL-128ch-single-shank`→128.
So range = `0..map_size-1` is sound; out-of-range marks are silently ignored downstream.

---

## Summary

- **Bad-channel marking is widespread and tetrode-dominated.** 1,137 / 1,792 files (63%)
  mark at least one bad channel; 34,933 channel-marks total across 13,002 ntrodes. 94% of
  all marks are on `tetrode_12.5`.
- **The dominant pattern is the all-four-bad tetrode (a disabled/dead tetrode), not
  scattered single channels.** Of marked tetrodes, the `#bad` histogram is
  `{1:5065, 2:1207, 3:617, 4:5631}` — i.e. **5,631 tetrodes are marked all-4-bad**, more
  than the 5,065 marked exactly one. "All four dead" is the single most common non-zero
  value.
- **Range errors are real but rare: 2 ntrodes in 1 cleanly-parsed file** (`herman`,
  `bad_channels:[4]` / `[3,4]` on tetrodes whose only valid indices are `0-3`). These are
  silently dropped downstream — the intended bad channel is never excluded.
- **Monotonicity holds for ~95% of multi-day animals.** Of 60 multi-day animals with any
  bad channels, **57 are monotonic, 3 non-monotonic** (consensus parse). All 3 violations
  occur with **no device/electrode-group reconfiguration** → they are data-entry
  corrections/typos, **not** real probe changes. This *validates* the app's monotonic +
  un-mark-confirmation model.
- **A large confounder surfaced and was controlled:** the same recording day is often
  stored as multiple divergent copies across storage locations/hand-edits (11 animals, 76
  date-rows disagree on bad_channels). Naïve date-ordering manufactures fake un-marks; the
  numbers above use cross-copy consensus.

---

## Findings

### F1 — Distribution (Q1)  — confidence: HIGH

| metric | value |
|---|---:|
| real files parsed (canonical) | 1,792 |
| files with ≥1 bad channel | 1,137 (63%) |
| total channel-marks | 34,933 |
| total ntrodes | 63,111 |
| ntrodes with ≥1 bad channel | 13,002 |

Channel-marks per `device_type` (only devices that ever carry marks):
`tetrode_12.5` 32,806 · `128c-4s6mm6cm-15um-26um-sl` 2,322 ·
`128c-4s8mm6cm-20um-40um-sl` 842 · `64c-4s6mm6cm-20um-40um-dl` 352 ·
`NET-EBL-128ch-single-shank` 200 · `64c-3s6mm6cm-20um-40um-sl` 85.
**94% of all marks are on tetrodes** (tetrodes are also 83% of all ntrodes).

`#bad` per tetrode ntrode (the 0..4 distribution requested):
`{0: 39,160, 1: 5,065, 2: 1,207, 3: 617, 4: 5,631}`.
**Bimodal:** the non-zero mass is concentrated at the extremes — exactly one bad channel,
or all four. The "all four" mode (5,631) is the disabled-tetrode pattern (F4).

Evidence: `cat_d_analysis.py` Q1; spot-check
`alison/home/Desktop/20201028_senor.yml` (8 tetrodes each `bad_channels:[0,1,2,3]`).

### F2 — Range validity / silent out-of-range marks (Q2)  — confidence: HIGH

Canonical parse: **2 out-of-range ntrodes in 1 file**:
`sambray/home/Desktop/metadata/20211115_herman_metadata.yml`
— nt21 `bad_channels:[4]`, nt28 `bad_channels:[3,4]`, both on tetrodes whose `map` is
`{0,1,2,3}` (valid indices 0-3). Channel `4` does not exist → **silently ignored by
trodes_to_nwb**; the real failing channel is never excluded from the NWB.
Raw evidence: read of that file (`map: {0:0,1:1,2:2,3:3}`, `bad_channels:[3,4]`).

A second OOR (`alison/home/Downloads/peanut20201111_metadata.yml` nt2 `bad_channels:[4]`,
line 494) is **compounded**: its whole `ntrode_electrode_group_channel_map` resolves to
`None`/empty under `yaml.safe_load` (a structural/indentation defect), so the converter
sees *no* ntrode map at all — the OOR mark is in a section that's dropped wholesale. I
exclude it from the OOR count (different error class: silent whole-section loss) but it
reinforces the same lesson.

**Why so few?** Tetrodes have only 4 indices, and the app/most generators auto-build the
`map` as `{0:0,1:1,2:2,3:3}`, so hand-typed indices rarely stray. The risk is real for
hand-edited files and would grow for high-channel probes (a `128c` shank has indices
0-31; an off-by-one or a global-hardware-channel mistake would be invisible). Range is
**not currently validated** at entry.

### F3 — Per-day evolution / monotonicity (Q3)  — confidence: MEDIUM-HIGH

Method: group by (`experimenter_norm`, `subject_id`), order by `file_date`. **Two
confounders found by spot-check and controlled for:**

1. The `(experimenter=null OR subject_id=None)` bucket lumps **33 distinct
   sessions/animals** into one fake group (verified: 33 distinct `session_id`s) →
   excluded.
2. **Same recording day, multiple divergent copies.** e.g. `CH73` exists in both
   `mcoulter/` and `rhino/` storage with the *same dates* but nt50 = `[0]` (mcoulter) vs
   `[0,1,2,3]` (rhino) on every shared date; `SC1001` has canonical `generated/` files
   with nt26=`[0]` throughout, plus two `Downloads/` hand-edits with nt26=`[0,1,2,3]`.
   Naïve date-ordering interleaves these and reports a spurious un-mark. → I collapse each
   calendar date to a **cross-copy consensus** (per-ntrode majority; ties→most inclusive)
   before testing.

Result (consensus, null-bucket excluded), over **60 multi-day animals with any bad
channels**:

| | animals |
|---|---:|
| monotonic (bad sets only grow) | **57** |
| non-monotonic (a channel un-marked) | **3** |

The 3 non-monotonic animals — **none with a device/electrode-group reconfiguration**
(`dev_variants==1` for all):

- `["guidera jennifer"]/fig` nt26 (a 128c shank, `map_size 25`): 22 channels bad on
  2021-11-15/16 → **just `[18]`** from 11-17 onward, in a single canonical `generated/`
  series. A wholesale re-assessment / correction of an over-marked shank. *Real un-mark.*
- `["abhijith mankili"]/Winnie` nt2: `(2,)` every day **except 2022-07-20**, where copies
  disagree `(1,)` vs `(2,)`, reverting to `(2,)` on 07-22. A single-day **typo (1↔2
  swap)**, not a real recovery.
- `["chiang sharon"]/SC38` nt10: empty → one outlier copy `(0,1,2,3)` on 06-08 → empty →
  `(3,)` on 06-12. Dominated by an outlier copy; marginal.

**Interpretation:** genuine temporal un-marking is rare (~1 clear case / 60 animals) and
is *correction of a prior over-mark*, never electrode "recovery." This is exactly the
regime the app's monotonic model + un-mark acknowledgment is built for. **Separately, 11
animals / 76 date-rows show intra-day cross-copy disagreement on bad_channels** — a real
data-integrity problem (two saved copies of the same day disagree on which channels are
bad) that the app's single-source-of-truth day model would eliminate.

Falsifier: if a non-`null` animal showed a channel going bad→fine→(stayed fine) in one
canonical file series *with no probe change*, that would be true non-monotonicity. Only
`fig` qualifies, and it reads as a correction (22→1), not a recovery.

### F4 — Disabled vs failed: the all-4-bad tetrode (Q4)  — confidence: HIGH (counts), MEDIUM (interpretation)

**5,631 tetrodes** are marked all-4-bad (`{0,1,2,3}`, `map_size 4`). Splitting by the
electrode group's `location`:

| location class | count | reading |
|---|---:|---|
| null-ish (`None`/`NotInBrain`/`""`/`Dead tetrode`) | **1,045** | deliberately-unused / never-implanted tetrode |
| **real brain region** (`hippocampus` 3,805, `Hippocampus` 413, `ca1` 172, …) | **4,586** | tetrode implanted in a region but yielding no usable signal (dead-in-brain) |

This **refines the original hypothesis**. The "disabled group = all-4-bad + NULL location"
pattern is real but is the *minority* (1,045). The majority all-4-bad tetrodes carry a
**legitimate** brain location — they are physically in the region and simply dead, so
all-4-bad is arguably the *correct* representation (the `location` is true; the channels
are genuinely all bad). Spot-check: `Winnie` has exactly 4 all-4-bad tetrodes *in
hippocampus* on **every** one of its 10 days — a persistent dead-tetrode set carried
forward (consistent with the app's carry-forward model), not a per-day data error.

So a first-class "disabled/unused group" flag is most valuable for the **1,045 null-ish**
cases (where all-4-bad + null location is a workaround that also pollutes Spyglass
`BrainRegion` with `None`/`NotInBrain` entries). For the 4,586 dead-in-brain tetrodes, the
better lever is a "dead tetrode" status that still preserves the real `location` (so the
brain region isn't lost) while signaling "expect no units here."

### F5 — Per-experimenter conventions (Q5)  — confidence: HIGH

Marking is **strongly experimenter-dependent** — some always mark, some never do:

| experimenter (norm) | files | % files w/ bad ch | chans marked |
|---|---:|---:|---:|
| coulter/kastner/nevers (rhino) | 375 | **100%** | 11,718 |
| guidera jennifer | 177 | **100%** | 4,345 |
| kastner/nevers | 85 | **100%** | 1,178 |
| gu shijie | 70 | 97% | 1,947 |
| chiang sharon | 332 | 55% | 8,656 |
| alison comrie | 166 | 80% | 4,256 |
| abhijith mankili | 89 | 63% | 1,131 |
| **coulter michael (solo)** | 135 | **10%** | 65 |
| **sun xulu** | 77 | **5%** | 72 |
| **sunrae taloma** | 55 | **0%** | 0 |
| **denisse/gao (+lee)** | 76 | **0%** | 0 |
| **gao/lee** | 25 | **0%** | 0 |

Several experimenters / projects mark **zero** bad channels across all their files
(sunrae taloma 55 files, the denisse/gao opto cohort ~76 files, gao/lee 25). Absence of
marks is therefore **not** evidence of clean electrodes — it reflects workflow, not data
quality. Any "you have N dead channels" surfacing must not assume non-markers have none.

---

## Invariants vs variation

**Invariant (lab-wide, safe to bake in):**
- `bad_channels` are probe-local; per-ntrode valid range = `0..map_size-1`; `map_size` is
  deterministic from `device_type` (tetrode 4, screw/single 1, 128c-shank 32, NET 128).
- All-4-bad on a tetrode = "this tetrode contributes nothing" (whether unused or dead).
- Bad-channel sets are **carried forward** day-to-day and are **near-monotonic** within a
  fixed probe config.

**Variation (must stay per-day / per-experimenter):**
- Whether anyone marks at all (0%→100% by experimenter).
- Which exact channels (genuinely per-day; corrections happen).
- `location` on dead tetrodes (real region vs null-ish) — both occur and mean different
  things.

---

## Error classes, ranked by downstream severity

1. **Out-of-range mark silently dropped** (F2; 2 ntrodes/1 clean file, + 1 compounded).
   The real bad channel is *not* excluded from the NWB — a silent scientific error.
   *Cheap to eliminate: range-validate against `map_size`/`device_type` at entry.*
2. **Whole `ntrode_electrode_group_channel_map` parses to `None`** (peanut20201111) — a
   structural defect that drops *all* maps + bad channels silently. (Out of Cat-D scope to
   fully characterize, but it nukes bad-channel data entirely.)
3. **Intra-day cross-copy disagreement** (F3; 11 animals, 76 date-rows). Two saved copies
   of the same recording day disagree on bad channels → whichever copy the pipeline picks
   up changes the result non-deterministically. *Eliminated by a single source of truth
   per day.*
4. **Non-monotonic data-entry typos** (F3; ~2–3 animals). Channel un-marked by mistake
   (Winnie 1↔2). *Caught by the app's un-mark confirmation.*
5. **all-4-bad + null-ish location** (F4; 1,045 tetrodes) → `None`/`NotInBrain` BrainRegion
   entries in Spyglass + ambiguous "is this dead or unused?" semantics. *Lower severity
   (no signal lost) but pollutes the database.*

---

## App-guard / UX implications

1. **Range-validate bad channels against the device's probe-local range at entry.** A mark
   must be in `0..map_size-1` (tetrode 0-3; 128c-shank 0-31; etc.). Block/flag anything
   else — it is *silently discarded* downstream today, so the entry form is the only gate.
   (Highest value-per-effort; directly prevents F2 silent errors.)
2. **Keep the monotonic + un-mark-confirm model — the corpus validates it.** 95% of
   multi-day animals are monotonic; the rare un-marks are corrections/typos with no probe
   change. The existing in-context confirm + `badChannelRemovalAcks` + export block
   (`bad_channel_unfailed_without_ack`) is exactly right. Reset marks only on
   `configurationVersion` change (corpus shows reconfig and un-mark are independent).
3. **First-class "dead / disabled tetrode" status instead of all-4-bad + NULL location.**
   For the 1,045 null-ish cases, a "disabled group" flag (no fake bad-channels, no null
   `BrainRegion`). For the 4,586 dead-in-brain cases, a "dead tetrode" status that
   **preserves the real `location`** (so Spyglass keeps the region) but signals "no units
   expected." Don't force users to encode either via all-4-bad.
4. **Single source of truth per (animal, day) for bad channels** — kill the multi-copy
   divergence (F3 intra-day, 11 animals). The day-owned bad-channel model already does
   this; surface a per-animal consistency check if importing legacy copies.
5. **Carry forward dead/bad marks from the prior same-config day** (already specified in
   the workspace model) — matches the corpus's stable per-day dead-tetrode sets (Winnie:
   4 dead hippocampal tetrodes every day). Do **not** nudge "you have 0 bad channels" as a
   completeness signal: many experimenters/projects mark zero by convention (F5), so
   absence ≠ clean.

---

## Competing hypotheses & how they were tested

- *"Non-monotonic animals = real probe reconfigurations."* **Rejected.** All 3 consensus
  violations have `dev_variants==1` and unchanged `n_electrode_groups`; the changes are
  corrections/typos in a single device config.
- *"There's lots of temporal un-marking (electrodes recovering)."* **Rejected** as
  artifact. The naïve count (7 animals, 158+ un-mark events) collapsed to 3 once
  same-date multi-copy divergence was controlled; the survivors read as corrections, not
  recoveries. Falsifier would be a bad→fine→fine transition in one canonical file series
  with no probe change — only `fig` approaches it, and 22→1 is a re-assessment.
- *"all-4-bad always means a deliberately-unused tetrode (null location)."* **Partially
  rejected.** Only 1,045/5,631 are null-ish; 4,586 sit in a real brain region and are
  better read as dead-in-brain (location is correct). The disabled-group flag helps the
  former; a location-preserving "dead" status helps the latter.
- *"Files without bad channels have clean electrodes."* **Rejected.** Zero-mark rate is
  experimenter-driven (entire cohorts mark 0%); absence is a workflow signal, not a data
  signal.

Open / unverified: I did not load each probe-shank's true geometry to confirm 128c shanks
are always exactly 32 indices in *every* generator — I relied on the corpus's own
consistent `map_size` (which was uniform). And the peanut "whole-map-is-None" structural
defect (error class 2) was characterized only enough to exclude it from the OOR count; a
full sweep of how many files lose their ntrode map to such structural defects is a
separate Category question.
