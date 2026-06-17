# Cat-G — Optogenetics in the 1,814-file YAML corpus

**Scope:** optogenetics across `records.jsonl` (1,799 parsed; 1,792 non-suspect) +
raw-YAML value extraction for the 181 non-suspect files that carry any of the 4 opto
sections. Extractor: [`cat_g_opto.py`](../../../../../Downloads/yaml_analysis2/cat_g_opto.py)
→ `cat_g_opto_extract.json` (deterministic, pyyaml, no source mutation). Companion to the
prior corpus study (§5 partial-opto, §6 volume dual-key + `power_in_W:200`); this note
**reconciles and corrects** that study with the larger corpus and raw values.

---

## Summary

1. **Opto is a small minority and essentially one group's data.** 181/1,792 non-suspect
   files (10%) have an opto *key*, but only **71** are real opto experiments — **all
   Denisse Morales-Rodriguez's group** (Emmett, Seth, Charlie, Embry, Aro, Laurent, LF1).
   The other **110** files have all 4 opto keys present but **empty `[]`** (Sharon/sc4712,
   Kyu, Supraja) — non-opto files carrying empty opto scaffolding, not partial opto.
2. **The `power_in_W: 200` error is systematic, not anecdotal: 70/71 excitation blocks.**
   It is a model-number→units confusion: model `LuxX+ 638-200` (200 = max **mW**) copied
   into `power_in_W`. 200 W into a brain fiber is physically absurd; real operating power
   lives in `fs_gui_yamls.power_in_mW` (2–50 mW).
3. **The volume dual-key is conflicting in 49/71 files (99/143 injection blocks):
   `volume_in_uL: 0.45` vs `volume_in_ul: 450`** — a 1000× unit/scale error. The converter
   reads `volume_in_uL` (0.45, correct = 450 nL); the schema-validated/NWB-stored field is
   `volume_in_ul` (450 µL, physically impossible). This is the exact `0.45 vs 450` case the
   prior study predicted, now enumerated.
4. **Coordinates are clean.** AP/ML/DV for both injection and fiber are all within rat
   stereotaxic bounds; DV correctly negative. No sign/scale errors (1 all-zero placeholder
   block out of 143).

**Confidence: HIGH** for 1–4 (deterministic counts + raw spot-checks with file:line).

---

## Findings

### F1 — WHO uses opto (and the empty-scaffold trap)

**Claim:** Opto is one group's data; most "opto-present" files are empty scaffolding.

**Numbers (non-suspect, raw-verified per file):**

| class | files | who |
|---|---:|---|
| 4 sections **populated** (real opto) | 52 | denisse group (all) |
| 3 populated, `fs_gui_yamls` empty (real implant, no protocol that day) | 19 | denisse group (18) + 1 template |
| all 4 sections present but **empty `[]`** (NOT opto) | 110 | sc4712/Sharon (53), kyu/Kyu (31+25), sam/Supraja (1) |
| **real opto total** | **71** | **denisse group only** |

By animal (real opto, file count): Emmett 20, Jacob 20 (suspect-test, excluded from 71),
Seth 8, Charlie 7, Embry 8, plus Aro/Laurent/LF1/54321. By year: 1 (2023) · 31 (2024) ·
101 (2025) · 48 (2026) — opto is recent and growing.

**Raw evidence:** all-empty scaffold —
`sc4712/curated/SC100/generated/20250519_SC100_metadata.yml`: `opto_excitation_source: []`,
`virus_injection: []`, `optical_fiber: []`, `fs_gui_yamls: []`. Real opto —
`denisse/stelmo/Emmett/20251106/20251106_Emmett_metadata.yml:290-344`.

**Correction to prior study:** the prior note attributed opto to "Denisse/Laurent"; Laurent
is one of *Denisse's animals* (3 files), not a separate experimenter. abhijith mankili's
"Banner/Winnie" (medial-septal stimulation) describe stimulation in `experiment_description`
but carry **no** opto sections in the current schema — the only mankili opto file is the
**legacy-schema** `ryan/.../20220912_Wallie.yml` (see F6).

**Confidence: HIGH.**

### F2 — PARTIAL OPTO (some-but-not-all 4) is mostly empty-section, not missing-section

**Claim:** True schema-violating partial opto (a populated section + a *missing* sibling)
is rare; the converter's all-or-nothing rule is satisfied trivially by empty siblings.

**Numbers:** Using raw populated/empty/absent:
- **0** files have a populated section with a sibling section **absent** (except the example
  `sample_metadata.yml`, which has 3 populated + **no** `fs_gui_yamls` key — placeholder).
- **19** files have `opto_excitation_source` + `virus_injection` + `optical_fiber`
  populated but `fs_gui_yamls: []` empty — a *meaningful* partial (implant described, no
  stimulation protocol logged that day). All but one are denisse.
- REPORT2's "partial optogenetics: 2" both = template/example files
  (`sample_metadata.yml`, `{EXPERIMENT_DATE_in_format_mmddYYYY}_54321_metadata.yml`).

**Raw evidence:** `denisse/stelmo/Charlie/20260222/20260222_Charlie_metadata.yml` (3
populated, `fs_gui_yamls: []`).

**Caveat / falsifier:** "all 4 keys present" satisfies a *key-presence* gate but the
converter's exact rule (does it require all 4 *non-empty* if any non-empty?) is not verified
here — read trodes_to_nwb's opto loader to confirm whether `fs_gui_yamls: []` alongside a
populated `optical_fiber` is accepted or rejected. **Confidence: MEDIUM** on the downstream
consequence; HIGH on the corpus counts.

### F3 — `volume_in_uL` vs `volume_in_ul`: 1000× conflict in 49/71 files

**Claim:** The dual-key is a required converter↔schema shim (NOT a bug per se), but
hand-built/imported files hold **conflicting** values, baking a 1000× error into the NWB.

**Numbers:** 143 injection blocks all have **both** keys (0 with only one).
- **44 blocks** agree: `uL=0.45, ul=0.45` (correct, both = 0.45 µL).
- **99 blocks (49 distinct files, 10 distinct animals)** conflict: `uL=0.45, ul=450`.
- 1 block: `uL=0.45, ul=100.0` (the `sample_metadata.yml` example — also inconsistent).

`450` is `0.45` with a µL↔nL slip (450 nL = 0.45 µL written into the µL field). The
converter reads `volume_in_uL` (0.45 ✓) but the value persisted to NWB / validated by
schema is `volume_in_ul` (**450 µL** — a brain-melting, physically impossible injection).

**Raw evidence (file:line):**
`denisse/stelmo/Emmett/20251106/20251106_Emmett_metadata.yml:311-312`
```
    volume_in_uL: 0.45
    volume_in_ul: 450
```
Same pattern on both injection blocks (lines 311-312 and 326-327), across Charlie, Embry,
Emmett, Seth, Aro, Laurent, LF1 (and sambray copies of Emmett/LF1).

**Confidence: HIGH** (enumerated + raw-confirmed).

### F4 — Numeric range sanity: `power_in_W: 200` in 70/71 excitation blocks

**Claim:** The excitation-source power field is systematically wrong by ~10,000×; the real
power is correctly recorded elsewhere.

**Numbers:**
- `opto_excitation_source.power_in_W`: **70× = `200`**, 1× = `0.077` (the example file).
- `wavelength_in_nm`: 70× = `638` (red laser, correct), 1× = `488` (example, correct).
- `intensity_in_W_per_m2`: 70× = `-1` (sentinel/unset), 1× = `1e10` (example).
- `fs_gui_yamls.power_in_mW` (the *real, per-epoch* power): 2–50 mW, mode 30 mW
  (37×), 25 mW (15×); 2 zero-power epochs; 1 empty string.

200 W into an implanted fiber would vaporize tissue (typical optogenetic fiber output is
single-digit-to-tens of **mW**). The `fs_gui` mW values confirm the true operating range.

**Root cause (spot-checked):** `model_name: LuxX+ 638-200` — the "200" is the laser's
**max output in mW**; it was typed into `power_in_W`. The example template used a *correct*
`power_in_W: 0.077` (77 mW), so the field is fillable correctly — users just copied the
model number. **Defensible guards:** `power_in_W` for an implant source ∈ (0, ~1] W (warn
above; >1 W almost always a mW/W confusion); `wavelength_in_nm` ∈ [400, 700] for visible
opto (warn outside [350, 1100]); `fs_gui_yamls.power_in_mW` ∈ (0, ~200] mW (warn above, and
on 0 / empty).

**Confidence: HIGH.**

### F5 — Coordinates & angles: clean

**Claim:** Stereotaxic coordinates are physically plausible; no sign/scale errors.

**Numbers (mm, from bregma):**

| field | n | min | max | within rat bounds? |
|---|---:|---:|---:|---|
| virus_injection.ap_in_mm | 143 | -4.4 | 3.2 | ✓ |
| virus_injection.ml_in_mm | 143 | -2.3 | 2.3 | ✓ (signed L/R) |
| virus_injection.dv_in_mm | 143 | -3.5 | 0.0 | ✓ (negative = below surface) |
| optical_fiber.ap_in_mm | 141 | -3.8 | 3.2 | ✓ |
| optical_fiber.ml_in_mm | 141 | -2.0 | 2.0 | ✓ |
| optical_fiber.dv_in_mm | 141 | -3.35 | 0.0 | ✓ |

Angles (`roll/pitch/yaw_in_deg`) all `0`. `titer_in_vg_per_ml`: 138× `2.3e13`, 4× `-1`
(sentinel), 1× `1e9`. Only **1/143** injection blocks is an all-zero (ap=ml=dv=0)
placeholder. **Confidence: HIGH.** No coordinate guard is urgent; a soft range check
(AP/ML ∈ ±10 mm, DV ∈ [-12, 0] mm) would catch a future typo cheaply.

### F6 — One legacy-schema opto file (different keys entirely)

`ryan/stelmo/frank-lab-optogenetics/data/20220912_Wallie.yml` (mankili, 2022) uses a
**different opto schema**: `lasers`, `optic_fibers`, `optic_fiber_implant_sites`,
`optogenetic_viruses`, `optogenetic_virus_injections`, `optogenetic_experiment_metadata`.
Notably it records `power_in_mW: 77.0` (correct units) and a **single** `volume_in_uL: 0.45`
(no conflict). It would not satisfy the current 4-section schema. One-off historical
artifact — flag on import, don't engineer around it. **Confidence: HIGH** (1 file).

---

## Invariants vs variation

**Invariant (app-generated, uniform):** Every real-opto block has an identical key set
(excitation: name/model_name/description/wavelength_in_nm/power_in_W/intensity_in_W_per_m2;
injection: 15 keys incl. both volume keys; fiber: 13 keys; fs_gui: name/epochs/power_in_mW/
dio_output_name/camera_id/…). Both volume keys are **always** emitted together (the shim
works). → the *structure* is correct; the *values* are wrong.

**Variation (where errors live):** the numeric **values** of `power_in_W` (constant-wrong
200), `volume_in_ul` (conflicts with `volume_in_uL`), and per-epoch `power_in_mW` (the only
genuinely day-varying opto field). This is the corpus's recurring lesson: app-generated
structure is reliable; free-typed numbers in template-prefilled fields are not.

---

## Error classes (ranked by data-integrity impact)

1. **Volume 1000× conflict (`uL 0.45` / `ul 450`) — 49 files, 10 animals.** Persists a
   physically impossible 450 µL into NWB/Spyglass. **Highest impact** (silent, scientific
   value wrong, survives the shim).
2. **`power_in_W: 200` — 70 files.** ~10,000× wrong; absurd on inspection but silent in the
   pipeline (no range guard). Mostly recoverable from `fs_gui.power_in_mW`, but the
   excitation-source record itself is corrupt.
3. **Empty opto scaffolding on 110 non-opto files.** Low integrity impact (empty = no opto
   claimed) but pollutes "who does opto" queries and risks the converter's all-or-nothing
   logic if any one section is later half-filled. Cosmetic-to-medium.
4. **`fs_gui_yamls: []` partial (19 files).** Likely intentional (no stim that day); confirm
   converter tolerance. Low-to-medium.
5. **Legacy-schema opto (1 file) / `titer: -1` sentinels (4) / 0-power epochs (2).** Edge
   cases; flag on import.

---

## App-guard / UX implications

1. **Derive the volume pair from ONE input (already the design — enforce it).** The app
   emits both `volume_in_uL`/`volume_in_ul` from one number
   ([workspaceUtils.ts](../../../src/state/workspaceUtils.ts)). The corpus proves the
   failure mode is **imported/hand-built** files with divergent keys. Guard: on **import**,
   if both keys exist and differ, surface a fix-in-file blocker ("volume_in_uL 0.45 ≠
   volume_in_ul 450 — 1000× unit error; pick one") rather than silently trusting either.
   This is the single highest-value guard (catches the #1 error class).
2. **All-or-nothing opto gate on *non-empty* sections.** Block export if any opto section is
   populated while a sibling is missing/empty (per the all-or-nothing converter rule). But
   treat **all-4-empty** as "no opto" (don't nag the 110 scaffold files). Confirm exact
   converter semantics for `fs_gui_yamls: []` + populated implant before choosing block vs
   warn (F2 falsifier).
3. **Power range guards (warn, with context).** `power_in_W` on an excitation source: warn
   when ≥ 1 W ("Did you mean mW? 200 W is ~10,000× a typical fiber output"); auto-suggest
   dividing by 1000 from the model-name suffix (`LuxX+ 638-200` → 200 mW = 0.2 W).
   `fs_gui.power_in_mW`: warn > ~200 mW, and on 0 / empty.
4. **Wavelength guard.** `wavelength_in_nm` ∈ [400, 700] expected for visible-opsin opto;
   warn outside [350, 1100]. Cheap, catches scale typos.
5. **Coordinate sanity (soft).** AP/ML ∈ ±10 mm, DV ∈ [-12, 0] mm from bregma; warn (don't
   block) outside. Corpus is clean today (F5) — this is preventive, low priority.

---

## Competing hypotheses

- **H (volume): "450 is nL, not a typo."** Falsified — the key is literally `volume_in_ul`
  (µL), and 0.45 µL = 450 nL, so 450 in a µL field is a unit slip, not a deliberate nL value.
  Both injection blocks per file carry the identical pair, consistent with a template default
  copied forward, not per-injection intent.
- **H (power): "200 mW mislabeled W" vs "genuinely 200 W."** 200 W is non-physical for an
  implanted fiber and the model number is `…-200` (mW); `fs_gui` mW values (2–50) confirm the
  true range. The W-vs-mW confusion hypothesis wins decisively.
- **H (who): "opto is widespread (181 files)."** Falsified by raw inspection — 110 are empty
  scaffolding; real opto is 71 files, one group. `opto_present` in records.jsonl flags
  **key presence, including empty `[]`** — do not use it as a real-opto count.

**Overall falsifier for the value errors:** read trodes_to_nwb's opto loader + the NWB it
emits for one denisse file; confirm (a) `volume_in_ul: 450` is what lands in the NWB
`volume` field and (b) `power_in_W: 200` is stored verbatim. If the converter coerces/ignores
either, the integrity impact downgrades from "corrupt NWB" to "corrupt-but-unused metadata".
