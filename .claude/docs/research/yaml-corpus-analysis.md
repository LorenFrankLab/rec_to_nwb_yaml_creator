# Real-world metadata YAML corpus analysis (325 files)

**Date:** 2026-06-15 · **Branch:** `wvm-phase3c-animal-view` · Companion to
[ux-principles.md](./ux-principles.md), [scope-tiers-ia/design-note.md](../plans/scope-tiers-ia/design-note.md),
and [docs/PIPELINE_REQUIREMENTS.md](../../../docs/PIPELINE_REQUIREMENTS.md).

Purpose: characterize what *real* neuroscientist-authored metadata looks like across
**experimenter / animal / day**, surface naming + DANDI/Spyglass compliance issues, and translate
the findings into concrete UX/data-entry implications for the app. These YAMLs were partly hand-built
(not via the legacy app), so they are a faithful sample of *what users actually produce* — including
their mistakes.

> **Corpus:** `~/Downloads/all_rat_metadata_yaml/` (325 `*.yml`, 8 dataset dirs, **not** committed — it
> is real lab data). **Analyzer:** `~/Downloads/yaml_analysis/analyze.py` (PEP-723, run `uv run
> analyze.py`); full output `~/Downloads/yaml_analysis/REPORT.md`. Every surprising claim below was
> spot-checked against the raw files. All 325 parsed cleanly (0 parse errors).

---

## 1. The headline: 80% of every file is animal-static, re-typed every day

The metadata format forces the scientist to **re-author the entire implant + rig description every
recording day**, even though the implant is a one-time event. Three near-universal constants prove how
much is pure boilerplate: `raw_data_to_volts: 1.95e-7`, `times_period_multiplier: 1.5`, and
`institution: University of California, San Francisco` are **identical in all 325 files**. The genuinely
new daily information is small (today's epochs/tasks, the statescript/video files for them, the animal's
weight, any newly-dead channels).

This single structural fact explains both failure modes seen throughout the corpus:

1. **Copy-forward drift** — an animal-static field that *should never change* mutates between days
   because it was re-typed (see §3).
2. **Free-text fragmentation** — controlled-vocabulary concepts entered as prose, so one concept appears
   under many spellings (see §4).

## 2. Two populations (the dominant signal)

The corpus splits cleanly into **98 legacy hand-built files** (Alison Comrie: chimi/senor/wilbur/peanut +
`Re_round2`) and **227 app/script-generated files**. The split recurs across ~8 *independent* fields,
which is what makes it a real fingerprint:

| Signal | Legacy (98) | App/script (227) |
|---|---|---|
| `experimenter_name` | scalar string (`Alison Comrie`) | list (`- Morales-Rodriguez, Denisse`) |
| name order | First Last | Last, First |
| `subject.species` | `Rat` (99*) | `Rattus norvegicus` (226) |
| `subject.sex` | `Male` (98) | `M` (219) / `F` (8) |
| `subject.weight` | `"541g"` string+unit (98) | `460` number (227) |
| `subject.date_of_birth` | **absent** (98) | ISO `2025-12-03T…` (227) |
| `keywords` | absent | present |
| `associated_video_files` epoch key | `task_epoch` singular (98) | `task_epochs` plural (225) |
| `units.analog` | `unspecified` / `'unspecified'` | `"1"` / `"-1"` |

\* one app-set file (`bs28`) also uses `Rat`, so species `Rat` = 99.

Files-per-dataset: `sc4712` 153 · `denisse` 59 · `chimi` 30 · `senor` 26 · `wilbur` 23 · `peanut` 16 ·
`mcoulter` 15 · `Re_round2` 3. Experimenters (by `experimenter_name`): Sharon Chiang 153, Alison Comrie
98, Morales-Rodriguez/Gao 59, Lee Kyu Hyun 30, Coulter 15, Liu 15.

**The legacy files exhibit exactly the problems the app exists to prevent** — the strongest evidence the
app works. The actionable question is what the **227 app-generated files still get wrong**.

## 3. What changes by experimenter / animal / day — a three-tier model

Per-animal variance across days (38 multi-day animals of 46 groups). High "varies" = day-specific in
practice; low = animal-static in practice.

**Animal-static** (constant in 36–38 / 38): `lab`, `institution`, `experiment_description`,
`subject.species`, `subject.sex`, `subject.genotype`, `subject.date_of_birth`, `n_electrode_groups`,
`eg_device_types`, `eg_locations`. → implant/subject facts; copy-pasted daily.

**Day-owned** (varies — *legitimate* per-day work):

| field | varies in | interpretation |
|---|---|---|
| `subject.weight` | 32/38 | animal weighed daily — real |
| `n_associated_files` | 33/38 | statescript logs differ per day |
| `task_names` / `n_tasks` | 26/38 · 20/38 | protocol evolves across the study |
| `session_description` | 11/38 | per-day session note |
| `camera_names` / `n_cameras` | 11/38 · 6/38 | rig differs (sleep vs run days) |
| `behavioral_events` | 8/38 | DIO set can change per day (board-dependent) |
| `bad_channels` | 8/38 | electrodes degrade monotonically over days |

**By-experimenter convention** (not data): name shape/order, `lab` (`Loren Frank` 252 / `Loren Frank
Lab` 73), `units` encoding, whether opto sections exist. Each experimenter is internally consistent →
experimenter is the natural axis for *default templates*.

### The key inference: when an animal-static field varies, it is almost always an error

Every animal-static field that drifted across days is a data-entry mistake, not real change:

| Animal | Field | Values | Verdict |
|---|---|---|---|
| `mcoulter/mec10` | `genotype` | `WT` (3 days) vs `scn2a` (2 days, the `*_het` dirs) | **conflict** — one rat, two genotypes |
| `denisse/Seth` | `date_of_birth` | `2025-07-26` vs `2025-04-12` | **conflict** — impossible |
| `denisse/Emmett`, `Seth` | `experimenter` | 2-author vs 3-author list | roster edit mid-study |
| `sc4712/SC127` | `eg_device_types` | includes `128c-4s8mm6cm-15um-40um-sl` | **typo** — no such probe (§5) |
| `sc4712/SC92` | `eg_device_types` | probe present some days, absent others | re-config or omission |
| `chimi` | `n_electrode_groups` | `33` vs `0` | the `Re_round2` space-key files (§5) |

→ Empirical justification for **enter-animal-static-data-once-and-lock/derive**: daily re-entry of those
fields produces only drift.

## 4. Naming mistakes & fragmentation

**Brain region `electrode_groups[].location` — 28 distinct spellings** for a handful of structures
(row-weighted; each tetrode is a row). Directly fragments Spyglass `BrainRegion`:

- `hippocampus` (2694) vs `Hippocampus` (1937) vs **`hippcoampus`** (31, typo) — three BrainRegion rows.
- `Cortex`/`cortex`; `Cerebral cortex (Cx)`/`cerebral cortex (cx)` — case-only splits.
- CA1 appears as `Cornu ammonis 1 (CA1)`, `Left CA1 Hippocampus`, `Right CA1 Hippocampus`; in
  `targeted_location` (33 distinct values) as `CA1` (2919), `leftHC_CA1`, plus a leading-space
  `" corpus callosum"` (6).

**`subject_id` case/spelling disagrees with its own folder/filename:** `Senor` (id) in `senor/…_senor`;
`RS10` vs dir `rs10`; `bs28` (id) vs filename `BS28`; `mec10` lowercase. Spyglass keys `Subject` on
`subject_id` → `RS10` and `rs10` are two subjects.

**`genotype` misused as strain/description:** `Long-Evans Rat` (153 files) sits in the *genotype* field
(it's the strain). Real genotypes: `Wild Type` (99) / `WT` (4) — uncontrolled duplicates — `PV-Cre`
(59), `scn2a` (10). `subject.description` also splits `Long-Evans Rat` (226) vs `Long Evans Rat` (99,
hyphen).

**Other free-text drift:** `lab` (2 forms); `units.analog`/`behavioral_events`
(`'unspecified'`-with-literal-quotes 153 / `unspecified` 98 / `"1"` 59 / `"-1"` 15);
`default_header_file_path` (`default_header.xml` 266 / `''` 59); task-name casing (`home`, `Sleep`).
**Filename date format is MMDDYYYY in 2 SC50 files** (`03112024_SC50`) vs YYYYMMDD elsewhere — breaks
`trodes_to_nwb`'s date-based session grouping.

## 5. DANDI / Spyglass compliance flags (ranked by severity)

**Hard-fail conversion:**

- **Space-separated key names** — `Re_round2/*` (3 files) use `electrode groups:` and `ntrode electrode
  group channel map:` (spaces, not underscores). `trodes_to_nwb` finds *zero* electrodes. *(verified by
  reading the file)*
- **Unresolvable `device_type`** — `screw`, `single_electrode` (6 mec10 files) and
  `128c-4s8mm6cm-15um-40um-sl` (SC127, a typo) are **not** among the 12 probe YAMLs in
  `trodes_to_nwb/.../probe_metadata/` *(verified against GitHub)* nor the app's schema enum /
  `probeCatalog.ts`. Per PIPELINE_REQUIREMENTS these throw `FileNotFoundError`.

**Fail DANDI/NWB validation:**

- **`species: Rat`** (99) — DANDI rejects non-Latin-binomial; needs `Rattus norvegicus`.
- **`sex: Male`** (98) — NWB/DANDI expect single-letter `M`/`F`/`U`/`O`.
- **`date_of_birth` absent** (98 legacy) — schema-`required` under `subject`; DANDI needs age/DOB. *(App
  already enforces this on the 227.)*
- **`weight: "541g"`** (98) — string-with-unit where schema requires a typed value.

**Silently degrade Spyglass:**

- **NULL-like `location`** — 1130 electrode-group rows: `None` (768) + `NotInBrain` (362). *Nuance:* many
  are deliberately-unused tetrodes (e.g. chimi tetrodes 24–31, all `bad_channels:[0,1,2,3]`), so impact
  < raw count — but each still creates a `None`/`NotInBrain` BrainRegion entry.
- **`peanut/20201202_peanut.yml` has no `subject_id`** → empty Subject key.

**Explicitly NOT a problem (so nobody chases it):** `session_start_time` is missing in **100%** of files
**because it is not in the schema** — `trodes_to_nwb` derives it from the `.rec` timestamp. Correctly
absent.

## 6. Silent / structural quirks

- **118 occurrences of `volume_in_uL` *and* `volume_in_ul` as sibling keys** in the same
  `virus_injection` block, with *conflicting* values (`0.45` vs `450` — a µL/scale confusion). The
  consumer reads one; the other is silently ignored. (No *exact* duplicate keys exist — good.)
- **`associated_files[].task_epochs` typing:** scalar in 1212 rows, list in 463 — same field, two types.
- **`task_epoch` (singular, 98) vs `task_epochs` (plural, 225)** in `associated_video_files` — a consumer
  keying on one name drops the other population's epoch links.
- **`power_in_W: 200`** for a laser (Laurent) — physically absurd (~mW expected); a numeric field with no
  range guard.
- **`data_acq_device.system`:** `SpikeGadgets` (226) / `MCU` (98) / `Main Control Unit` (1) — three names
  for the same/related thing.

## 7. UX & data-entry implications

Findings → the existing [ux-principles.md](./ux-principles.md) rubric (recognition-over-recall,
gate-don't-warn, carry-forward, mental-model-first) and [scope-tiers](../plans/scope-tiers-ia/design-note.md).
Details and rationale in the response that produced this doc; summary of the levers, by mechanism:

1. **Enter-once + carry-forward + lock for the animal tier.** Eliminates copy-forward drift structurally
   (would have caught *every* §3 error). Surface a per-animal consistency check ("this rat has 2
   date_of_birth values across days").
2. **Controlled vocabularies for every fragmentation field** — `location`/`targeted_location` (28→~6),
   `species` (binomial), `sex` (M/F/U/O), `genotype` (separate from strain/`description`), `lab`. Pick/
   confirm from visible options; autocomplete from prior use; canonical casing. (recognition-over-recall)
3. **Validate at the point of entry, gate at export** for the cost-of-error fields — `device_type`
   against the 12 known probes, no NULL `location` on active groups, `subject_id` case consistency with
   filename/animal, binomial species, single-letter sex. (gate-don't-warn; rubric 10)
4. **Kill silent-loss structures** — one canonical `volume_in_uL` (no case-variant sibling), unified
   `task_epochs` naming + scalar/list typing on export, numeric range guards (`power_in_W: 200`).
5. **Day editor = the small delta only** (weight, files, tasks/epochs, bad_channels) pre-filled from
   carry-forward — turns "copy a 1200-line YAML and hope" into a one-minute confirm. (working-memory
   budget; the epoch-centric editor direction is correct — variance shows tasks/epochs/files are what
   actually move.)
6. **First-class "disabled/unused" electrode-group flag** instead of fake `None`/`NotInBrain` locations.

## Reproduce

```bash
cd ~/Downloads/yaml_analysis && uv run analyze.py   # writes REPORT.md; prints condensed summary
```

Analyzer covers: parse inventory + node-tree duplicate/case-variant-key detection; provenance
(experimenter/animal/date + filename date-format); top-level & subject field-presence matrices;
per-animal day-over-day variance; brain-region/`device_type` distributions; DANDI/Spyglass compliance
checks. Re-run after corpus changes; spot-check any new surprising count against the raw file before
trusting it.
