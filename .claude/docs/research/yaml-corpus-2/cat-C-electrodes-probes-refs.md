# Category-C — Electrodes, Probes, References, Channel Maps, Schema Drift

**Corpus:** 1,814 real-world NWB-metadata YAMLs (1,799 in `records.jsonl`; 1,792 parsed after
dropping 7 `is_suspect`). Row-weighted electrode-group counts unless noted.
**Substrate:** `cat_c_out.json` (device/map/null-loc/mismatch), `cat_c_out2.json` (location
fragmentation, references, keys-by-experimenter), `cat_c_q4.json` (mismatch root-cause).
Scripts: `cat_c_extract.py`, `cat_c_extend.py`, `cat_c_q4.py` (all in `/Users/edeno/Downloads/yaml_analysis2/`).
**Reconciles with** the prior 325-file study (`.claude/docs/research/yaml-corpus-analysis.md` §3–5):
all patterns confirmed at ~5.5× scale; no contradictions.

---

## Summary (5 bullets)

1. **The electrode-group / ntrode schema is astonishingly stable.** Across 2017→2026, every real
   electrode-group row uses the same 9 keys and every ntrode row the same 4 keys — **zero**
   experimenter-specific or year-specific key drift. The only drift is a **key-naming dialect**: 36
   files use space-separated top-level keys (`electrode groups`) that yield **zero electrodes
   downstream**. (HIGH)
2. **References are NOT structured data anywhere in the corpus.** There is no `ref_elect_id` /
   `ref_ntrode_id` / `reference_electrode` field in any of 1,792 files. The reference electrode is
   encoded only as free-text `description: 'tetrode_reference'`/`'reference'` (448 groups, 264 files)
   or `# reference` YAML comments (366 lines, 164 files — stripped on parse). The `ndx_franklab_novela`
   `ref_elect_id` column named in CLAUDE.md is generated **downstream** by trodes_to_nwb, not authored
   here. (HIGH)
3. **`device_type` is mostly clean but has 6 unresolvable values that hard-fail conversion** — most
   importantly `screw` + `single_electrode` (1,040 rows each, **65 files, 17 animals, 2 users**), which
   are not in the app's 12-probe catalog and cause `FileNotFoundError`. (HIGH)
4. **Channel maps are probe-local (`0..N-1`, reset per ntrode) and the channel-count-per-ntrode is a
   near-perfect probe fingerprint** (tetrode→4, single shank of a 128c-4s→32). **n_eg ≠ n_nt is NOT a
   bug** — 789/800 mismatches are correct multi-shank expansion (one ntrode row per shank). Only ~11
   files have genuine structural defects. (HIGH)
5. **Location fragmentation is the highest-frequency data-quality problem and directly fragments
   Spyglass `BrainRegion`.** 52 distinct raw `location` spellings collapse to 45 normalized; case-only
   splits (`hippocampus` 33,992 vs `Hippocampus` 5,558; `ca1` 3,519 vs `CA1` 78) plus a real typo
   `hippcoampus` (103) and garbage values (`'` apostrophe, `Dead tetrode`) all become distinct
   BrainRegion rows. (HIGH)

---

## Findings

### Q1 — `device_type` distribution and unresolvable values

App catalog = exactly the 12-value enum in `src/nwb_schema.json`
(`/properties/electrode_groups/items/properties` `device_type.enum`), matching CLAUDE.md. A value not
in this set hard-fails trodes_to_nwb with `FileNotFoundError` (case-sensitive probe-file lookup).

Row-weighted counts (`cat_c_out.json` `device_type_counter`):

| device_type | rows | resolvable? |
|---|---:|---|
| `tetrode_12.5` | 52,619 | ✅ |
| `128c-4s6mm6cm-15um-26um-sl` | 1,208 | ✅ |
| **`screw`** | **1,040** | ❌ unresolvable |
| **`single_electrode`** | **1,040** | ❌ unresolvable |
| `128c-4s8mm6cm-20um-40um-sl` | 978 | ✅ |
| `128c-4s8mm6cm-15um-26um-sl` | 113 | ✅ |
| `128c-4s6mm6cm-20um-40um-sl` | 66 | ✅ |
| `32c-2s8mm6cm-20um-40um-dl` | 36 | ✅ |
| `A1x32-6mm-50-177-H32_21mm` | 33 | ✅ |
| **`tetrode`** | **32** | ❌ (legacy, 1 file) |
| `64c-4s6mm6cm-20um-40um-dl` | 28 | ✅ |
| `128c-4s4mm6cm-20um-40um-sl` | 22 | ✅ |
| `NET-EBL-128ch-single-shank` | 14 | ✅ |
| **`128c-4s8mm6cm-15um-40um-sl`** | **7** | ❌ typo (`15um-40um` ≠ catalog `15um-26um`/`20um-40um`) |
| `64c-3s6mm6cm-20um-40um-sl` | 4 | ✅ |
| **`tetrode_12.5_3channel`** | **2** | ❌ (1 legacy file) |
| **`tetrode_12.5_2channel`** | **1** | ❌ (1 legacy file) |
| `128c-4s4mm6cm-15um-26um-sl` | 1 | ✅ |

**Unresolvable totals: 2,122 rows across ~66 files.** Breakdown:

- **`screw` + `single_electrode`** — always co-occur (verified: `20250218_wtpre4ap_metadata.yml`
  has 32 of these two combined). **65 files, 17 animals, 2 users** (`mcoulter`: mec10, wtpre4ap;
  `sunrae`: ST01–ST11). These are deliberate EEG/skull-screw + single-wire hardware that the app simply
  **cannot express** — a genuine feature gap, not a typo. Every one of these 65 files hard-fails
  conversion as written. *(Spot-check: `mcoulter/cumulus/20250218_4ap_pre_2/20250218_wtpre4ap_metadata.yml`.)*
- **`128c-4s8mm6cm-15um-40um-sl`** — 7 files, animal SC127, user sc4712 (e.g.
  `sc4712/curated/SC127/generated/20250912_SC127_metadata.yml`). A **typo**: the `15um-40um` spacing pair
  does not exist; catalog has `15um-26um` and `20um-40um`. Already flagged in the prior 325-file study (§5).
- **`tetrode`, `tetrode_12.5_2channel`, `tetrode_12.5_3channel`** — 35 rows in 2 legacy hand-written
  files (`loren/.../chimi_metadata.yml`, `kkay/stelmo/metadata/kf19/20170824_old.yml`).

Confidence **HIGH** — exact string match against the schema enum; deterministic counts.

### Q2 — location / targeted_location fragmentation

**`location` (active groups only — all-bad/disabled groups excluded):** 52 distinct raw spellings →
45 normalized clusters; **6 clusters are case/spacing-fragmented** (`cat_c_out2.json`):

| normalized | raw spellings (counts) |
|---|---|
| hippocampus | `Hippocampus` 5,558 · `hippocampus` 33,992 |
| ca1 | `CA1` 78 · `ca1` 3,519 |
| cortex | `Cortex` 341 · `cortex` 493 |
| corpus callosum | `corpus callosum` 287 · `Corpus callosum` 75 · `Corpus Callosum` 2 |
| cerebral cortex (cx) | `Cerebral cortex (Cx)` 265 · `cerebral cortex (cx)` 56 |
| right mpfc | `Right mPFC` 7 · `right mPFC` 1 |

Plus **non-case problems** that are NOT clustered (so each is a separate BrainRegion):
- **`hippcoampus` (103 rows)** — real typo. *Spot-check:* `ebroyles/home/yaml/SC1002/generated/mine/20231008_SC1002_metadata.yml:294 → `location: hippcoampus`.*
- **`'` (single apostrophe, 25 rows)** — corrupt/empty value, YAML-escaped `''''`. *Spot-check:*
  `sambray/home/Desktop/metadata/20211115_herman_metadata.yml:200 → `location: ''''`.* Becomes a junk BrainRegion.
- **`Dead tetrode` (53 rows)** — a *status* in the anatomy field. *Spot-check:*
  `xulu/stelmo/recordings/RunnerLu/raw/20241013_RunnerLu_metadata.yml:337 → `location: Dead tetrode`*
  (note: its `targeted_location` is the real `Cornu ammonis 1 (CA1)`). The disabled-electrode concept is
  being smuggled into `location` because there's no first-class flag.

Each distinct spelling → a separate Spyglass `BrainRegion` row, fragmenting cross-lab queries
(the hippocampus case alone splits one structure across ≥2 rows representing ~39,550 electrodes).

**`targeted_location`:** 58 distinct raw → 53 normalized; 5 fragmented clusters (`CA1` 12,694 vs `ca1`
37; `Left mPFC` 22 vs `left mPFC` 52; etc.). Top values are an ad-hoc shorthand vocabulary —
`dCA1` 14,153, `iCA1` 12,903, `CA1` 12,694, `rightHC_CA1`, `Callosum_above_leftHC_CA1` — plus junk
values `x` (96) and `'` (apostrophe). No controlled vocabulary; each lab invents its own scheme.

**NULL-like `location` — active vs. deliberately-unused (`cat_c_out.json`):**
- **2,024 NULL-like rows total** (`None`/`NotInBrain`/empty). Of these, **1,272 are on
  deliberately-unused tetrodes** (all channels in `bad_channels` ⇒ disabled) and **752 are on ACTIVE
  groups** (≥1 good channel) — these 752 are the real defects: an active electrode with no anatomy →
  Spyglass "Unknown" region, breaks spatial queries. *Spot-check:* `alison/home/Downloads/20210326_wilbur.yml`
  uses `location: NotInBrain` on active tetrode_12.5 groups (ids 12–23).

> Reconciliation: this 752/1,272 split *refines* the prior study's flat "1,130 NULL-like rows" (§4) —
> the larger corpus shows the majority of NULL-like locations are intentional disabled-tetrode markers,
> so a naive "no NULL location" gate would over-fire. The gate must be **active-group-scoped**.

Confidence **HIGH** — deterministic spelling counts; raw spot-checks for typo/junk/status values.

### Q3 — References (under-studied — now characterized)

**There is no structured reference field anywhere in the corpus.** Corpus-wide grep for
`ref_elect_id|ref_ntrode_id|probe_shank|probe_electrode|ref_electrode|reference_electrode` → **0 files**.
The extractor's `ref_field_presence` and `ref_self_count` are empty/zero for the same reason.

How references ARE encoded (`cat_c_out2.json`):
- **`description: 'tetrode_reference'`** — 310 groups; **`description: 'reference'`** — 138 groups.
  Total **448 electrode groups flagged-as-reference via free-text, in 264 files.** *Spot-check:*
  `sam/stelmo/j16/metadata/20210719_j16.yml:235–238` — eg id 2, `device_type: tetrode_12.5`,
  `description: 'tetrode_reference'`.
- **`# reference` YAML comments** — 366 comment lines in 164 files annotating which ntrode/eg is the
  reference (`- ntrode_id: 13    # reference`). These are **dropped by every YAML parser** — invisible
  to trodes_to_nwb, Spyglass, and this app.
- **`reference: Bregma at the cortical surface`** (282 occurrences) is a *stereotaxic coordinate-system*
  field inside opto `virus_injection`/`optical_fiber` sections — **NOT** an electrode reference.
  *Spot-check:* `denisse/stelmo/Laurent/20260507/20260507_Laurent_metadata.yml:633`.

**Implication:** the electrode-reference relationship (which electrode is the reference for a given
group) is **not machine-readable** in the YAML at all. It survives only as prose a human must read, or
as comments that are silently lost. There is no out-of-range / self-ref to check because there is no
field to validate — the gap is *absence of structure*, not *invalid structure*.

Competing hypothesis (falsifier): "maybe references live in the `.rec` XML header, not the YAML, so
YAML absence is correct." Plausible — the `# reference` comments suggest authors know it belongs in the
hardware config. But the 448 `tetrode_reference` *descriptions* show authors WANT to record it in the
metadata and have no field for it. Falsifier: if trodes_to_nwb derives `ref_elect_id` purely from the
XML and never reads YAML for it, then a YAML reference field would be redundant — verify against
trodes_to_nwb's electrode-table builder before adding one.

Confidence **HIGH** for "no structured field exists"; **MED** for whether one is needed (depends on
trodes_to_nwb's XML-vs-YAML reference source).

### Q4 — Channel maps

**Map structure (`cat_c_out.json` `map_value_style`):** every `map` is `{"<channel_str>": <int>}`.
Values are **probe-local and reset per ntrode**: 55,208 ntrodes have values exactly `0..N-1`;
9,410 have a contiguous non-zero start (multi-shank probes partition `0..N-1` across shanks, so shank 2
starts at 32). **Zero** ntrodes use global hardware channel numbering — confirming the CLAUDE.md
invariant that map values are probe electrode IDs, not global channels.

**Channel-count-per-ntrode is a probe fingerprint** (`map_len_vs_expected`): `tetrode_12.5`→4
(52,619/52,619), `A1x32`→32, `NET-EBL-128ch-single-shank`→128, each 128c-4s **shank**→32,
`32c-2s`→16, `64c-4s`→16. One anomaly: 64 rows of `128c-4s8mm6cm-20um-40um-sl` have `maplen=4` —
isolated to one malformed legacy file (`loren/home/Src/NWB/yaml/beans_metadata.yml`).

**n_eg vs n_nt — NOT a bug (`cat_c_q4.json`):** 800 files have `n_eg ≠ n_nt`; **789 are fully
explained by the shank model** (ntrodes-per-eg == probe shank count: tetrode 1, 128c-4s 4, 64c-4s 4,
32c-2s 2, 64c-3s 3). *Spot-check:* `alison/home/Desktop/20201028_senor.yml` = 32 tetrodes (1:1) + 2×
`128c-4s` (1:4 each) = 34 eg, 40 nt. **The prompt's "(=bug)" framing is FALSIFIED** for the dominant
multi-shank case.

**Genuine structural defects are rare** (all legacy/hand-edited):
- **Orphan ntrode** (references a non-existent `electrode_group_id`): 2 files.
  *Spot-check:* `sambray/home/Downloads/SC3820230606_metadata.yml` — eg ids are `0,1,2,4,…,31`
  (id **3 is missing**) but ntrode_id 4 has `electrode_group_id: 3` → dangling reference (off-by-one).
- **eg with zero ntrodes:** 1 file (`loren/.../chimi_metadata.yml`, eg ids 0–4 have no map).
- **Duplicate `ntrode_id`:** 1 file (`jhbak/.../kibbles20170216_metadata.yml`).

Confidence **HIGH** — deterministic shank model validated against 52,619 tetrode rows + multi-shank.

### Q5 — Schema drift (eg_keys / nt_keys) by time and experimenter

**No drift in field set.** `cat_c_out.json` `eg_keys_by_year` shows the identical 9 keys
(`id, location, device_type, description, targeted_location, targeted_x, targeted_y, targeted_z, units`)
for **every** year 2017–2026, at full row counts. `nt_keys_by_year` shows the identical 4 keys
(`ntrode_id, electrode_group_id, bad_channels, map`) every year. `cat_c_extend.py`'s per-experimenter
scan found **zero** experimenters with extra or missing canonical eg keys.

The one structural variant: the **`None`-year (undated/legacy)** bucket adds `probe_id` to 64 ntrode
rows (an old field) and is missing `targeted_*` on ~33 eg rows — confined to old hand-written files.

The *only* real "drift" is the **key-naming dialect** (`cat_c_out.json` `eg_key_variants`):
- **36 files use space-separated keys** (`electrode groups`, `ntrode electrode group channel map`) — see
  `space_key_files`. `records.jsonl` reports `n_electrode_groups=0` for these (its key lookup expects
  underscores), and they yield **ZERO electrodes downstream**. Concentrated in `alison` (wilbur/chimi/
  peanut "old_nounderscore_metadata"), `jhbak`, `amankili`, `emonroe`, `loren`. 1 file uses
  `ntrode probe channel map`; 1 file is missing both sections entirely.

Confidence **HIGH** — exact key-set comparison across 1,792 files.

---

## Invariants vs. variation

**Invariants (hold across time, experimenter, animal):**
- Electrode-group key set = 9 canonical keys; ntrode key set = 4 canonical keys. (Stable 2017→2026.)
- `map` values are **probe-local** integers (`0..N-1` per shank); never global hardware channels.
- Channels-per-ntrode == probe geometry (tetrode 4; each 128c-4s shank 32; etc.).
- ntrodes-per-electrode-group == probe **shank count** (so n_nt = Σ shank_count, ≥ n_eg).
- References are **never** structured fields — only `description` text or comments.

**Variation:**
- *By experimenter:* key-naming dialect (underscore vs space) — `alison`/`jhbak`/`amankili`/`emonroe`/
  `loren` legacy files; `targeted_location` vocabulary (`dCA1`/`iCA1` vs `CA1` vs `leftHC_CA1`) is
  per-lab. `screw`/`single_electrode` is `mcoulter`+`sunrae` only.
- *By time:* none in field set; only legacy `probe_id` + space-keys cluster in pre-2020 / undated files.
- *By animal:* `device_type` typo `128c-4s8mm6cm-15um-40um-sl` is SC127-specific.

---

## Error classes (ranked by severity × frequency × cost)

| # | Error class | Sev | Freq | Cost | Evidence |
|---|---|---|---|---|---|
| 1 | **Unresolvable `device_type`** (`screw`, `single_electrode`, `tetrode`, `…15um-40um…`, `tetrode_12.5_Nchannel`) → trodes_to_nwb `FileNotFoundError`, conversion **hard-fails** | CRITICAL | 2,122 rows / 66 files / 18 animals | Entire session blocked; silent until conversion | `cat_c_out.json` `device_type_unresolvable` |
| 2 | **Space-separated top-level keys** (`electrode groups`) → **zero electrodes** in NWB (silent) | CRITICAL | 36 files | All electrodes lost; passes as "valid YAML" | `space_key_files` |
| 3 | **NULL-like `location` on ACTIVE group** → Spyglass "Unknown" BrainRegion, breaks spatial queries | HIGH | 752 active rows | DB pollution; silent | `nulllike_active=752` |
| 4 | **`location` fragmentation** (case + `hippcoampus` typo + `'`/`Dead tetrode` junk) → duplicate/garbage BrainRegion rows | HIGH | ~45 normalized → 52 raw; 103 typo; thousands case-split | Fragments cross-lab queries; permanent in DB | `location_fragmented_clusters` |
| 5 | **Orphan / dangling ntrode `electrode_group_id`** (off-by-one) | HIGH | 2 files | Electrode mis-assignment, silent | `sambray/.../SC3820230606` |
| 6 | **`targeted_location` fragmentation / junk** (`x`, `'`, case splits) | MED | 58 raw spellings | Weaker DB impact than `location` | `targeted_top40` |
| 7 | **References unrecorded** (lost in comments / prose) | MED | 366 comment-lines + 448 desc-tags | Reference electrode not machine-readable | Q3 |
| 8 | **Malformed map length / dup ntrode_id / eg-zero-ntrode** | LOW | 1 file each (legacy) | Rare; legacy only | `cat_c_q4.json` |

---

## App-guard / UX implications

1. **Validate `device_type` against the 12-probe catalog at entry, gate at export** (already a dropdown
   in the app, but imported YAML can carry off-catalog values). Block export on any off-catalog
   `device_type`; show the catalog. **Separately: add first-class support (or an explicit "non-probe
   device" path) for `screw` / `single_electrode`** — 17 animals across 2 active users need it, and
   it's a recurring real hardware setup, not user error. Coordinate the probe file with trodes_to_nwb.
2. **No-NULL-location gate scoped to ACTIVE groups only.** Block export when an electrode group with ≥1
   non-bad channel has empty/`None`/`NotInBrain` `location`. Do **not** fire on all-bad (disabled)
   tetrodes — 1,272 such rows are intentional, so a blanket gate would be a false-positive nuisance.
   Pair with a **first-class "disabled/unused electrode group" flag** so authors stop overloading
   `location` with `Dead tetrode`/`NotInBrain`.
3. **Controlled-vocabulary autocomplete for `location` (and `targeted_location`)** with case
   normalization — collapse `hippocampus`/`Hippocampus`/`hippcoampus` to one canonical region before it
   reaches Spyglass `BrainRegion`. Reject single-char/garbage values (`'`, `x`).
4. **Reference-integrity check** on import/export: every `ntrode.electrode_group_id` must match an
   existing `electrode_group.id` (catches the sambray off-by-one orphan); flag duplicate `ntrode_id`;
   flag electrode groups with zero ntrodes. (Cheap, catches the rare-but-corrupting structural bugs.)
5. **Channel-count vs probe check** (low effort, high confidence): assert each ntrode's `map` length ==
   the probe's expected per-shank channel count, and ntrodes-per-eg == shank count. This is a clean
   fingerprint (52,619/52,619 tetrodes matched) and catches malformed maps like the beans `maplen=4`
   case. Do **not** treat `n_eg ≠ n_nt` as an error — it's the correct multi-shank signal.
6. **First-class reference field** (optional, pending trodes_to_nwb check): give authors a structured
   way to mark "this group/ntrode is the reference" instead of `description: 'reference'` text and
   `# reference` comments that are silently dropped. Verify first whether trodes_to_nwb sources
   `ref_elect_id` from the YAML or only the `.rec` XML (Q3 falsifier).

---

## Competing hypotheses & falsifiers

- **H1 (accepted): `n_eg ≠ n_nt` is correct multi-shank, not a bug.** 789/800 explained by shank model;
  falsifier would be a mismatch with no multi-shank probe present and no orphan — found only 11, all
  tracing to unresolvable device_types or legacy files. *Falsified the prompt's "(=bug)" assumption.*
- **H2: NULL-like location is mostly intentional (disabled tetrodes), not error.** 1,272/2,024 are
  all-bad groups. Falsifier: an all-bad group that is later re-enabled would need its location back —
  check Cat-D's bad-channel monotonicity for re-enable events before auto-suppressing the gate.
- **H3: references belong in the `.rec` XML, so YAML absence is fine.** Supported by `# reference`
  comments; falsifier = trodes_to_nwb reading YAML for `ref_elect_id`. Resolve before building a field.
- **H4: `screw`/`single_electrode` are user error.** *Rejected* — consistent across 17 animals / 2
  users / multiple years; it's a genuine hardware class the app can't express (feature gap).

---

*Cross-refs: Cat-D owns bad-channel monotonicity (informs the disabled-group / location-suppression
gate). Cat-H owns structural-validity counting (the 36 space-key files show n_electrode_groups=0 but
hide real device/location data in raw). Prior 325-file study §3–5 corroborated at 5.5× scale.*
