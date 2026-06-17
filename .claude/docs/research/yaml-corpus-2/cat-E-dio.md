# Category-E — DIO / behavioral_events (corpus-2, 1,814 YAMLs)

Scope: `behavioral_events` (the DIO event list) across the full
`collected_metadata_yamls` corpus. Substrate: `/Users/edeno/Downloads/yaml_analysis2/records.jsonl`
(1,799 parsed; 1,792 non-suspect after `is_suspect==False`). Script:
`/Users/edeno/Downloads/yaml_analysis2/cat_e_dio.py` (`uv run`). All surprising claims
spot-checked against ≥1 raw file (paths + line numbers below).

This is a **5.5×-larger replication** of the prior study (§8 of
`.claude/docs/research/yaml-corpus-analysis.md`, 325 files). Every headline of the prior
study **holds and strengthens**: no lab-wide template, unstable name↔channel mapping,
day-owned carry-forward, per-person naming philosophy.

---

## Summary (TL;DR)

1. **No lab template is possible** (replicated, stronger). **67 distinct name-sets**
   (vs prior 21) across 1,792 files; **66 distinct non-empty sets**. The single most
   common set covers only **341/1,792 (19%)** of files. A preset full template would be
   wrong for ~80% of the corpus. **Confidence: very high.**
2. **Name↔channel mapping is unstable in BOTH directions** (replicated, stronger).
   Max name→channel fan-out: `RightMilk_Pump` → **8 channels** (and across both Din and
   Dout). Max channel→name fan-out: `Din1` → **21 names**. `Poke1` alone lives on
   `Din1/Din5/Din8`. **A fixed "Poke1 = Din1" template is impossible.** Confidence: very high.
3. **behavioral_events is day-owned, not animal-static** (replicated). **34 animals**
   have a behavioral_event_names set that varies across their days; **18 animals** show a
   within-animal name→channel *split* (same name, different channel on different days). The
   canonical "Senor split" (`Poke3` → `Din3` until 20201110, then `Din18`) is verified in raw
   YAML with the experimenter's own inline `#ends`/`#starts` comments. Confidence: very high.
4. **Three naming philosophies coexist, per person**: semantic (1,367 files / 55 sets),
   generic-positional (224 / 6), raw-unnamed `din1..dout32` (132 / 5, almost all mcoulter),
   empty (69). Naming style is an experimenter attribute, not a lab convention. Confidence: high.
5. **Stems are real and direction-correlated**: `poke`→input(Din), `pump`/`light`/`laser`→
   output(Dout) holds for >99% of pairs. `poke` appears in 1,578 files, `pump` 1,473,
   `light` 937, `laser` 139; camera-tick events in 1,562 files. This is the basis for
   stem-autocomplete + auto-numbering + a soft direction check — **not** a preset. Confidence: high.

---

## Findings

### F1 — Set diversity at scale (Q1)

**Claim:** distinct DIO name-sets grew from 21 → **67** (66 non-empty) as the corpus grew
325 → 1,792, but the *concentration* is unchanged: a handful of per-person sets dominate.

| set (representative) | files | style | whose |
|---|---:|---|---|
| `poke_arm_1..6 / poke_box_1..4 / door_box_* / light_* / camera_ticks` (36 names) | 341 | semantic | coulter+kastner+nevers |
| `Poke1..6 / Light1..6 / Pump1..6 / Run_Camera_Ticks` (19) | 196 | generic-positional | Alison (+null app-exports) |
| `HaightLeft/Right_poke/pump_* + *camera ticks` (21) | 169 | semantic | Sharon (chiang) |
| `cameraTicks / door_box1.. / light_arm1..` (36, no-underscore variant) | 123 | semantic | coulter+kastner+nevers |
| `din1..din32 / dout1..dout32` (64 raw) | 122 | raw-unnamed | mcoulter |
| `light1..5 / poke1..5 / reward1..3 / stim / *_camera_ticks` (16) | 88 | semantic | mankili |
| `HaightLeft/Right_*_SA_* …` (20) | 87 | semantic | guidera |
| `Arm1..4_{light,milk_pump,poke} / Home_* / Camerasync*` (17) | 71 | semantic | gu shijie |
| `[]` empty | 69 | empty | sunrae (55), chiang (13), mcoulter (1) |

- **events-per-file clusters**: 36 (464 files), 21 (274), 19 (237), 20 (130), 64 (122),
  16 (88), 17 (83), 0 (69 empty). Two big modes: the ~19–21 "positional/Haight" world and
  the ~36 "arm/box" world; plus a 64-wide raw-channel tail (mcoulter).
- **Distinct sets *within* one experimenter** (content-deduped): chiang **16**, coulter
  (solo) **6**, guidera **6**, denisse-group **5**, sun xulu **5**, adenekan+lee **5**,
  null/app-exports **7**. Confirms the prior "even one person varies by task/rig" finding —
  and chiang's 8 grew to 16. Some experimenters are single-set (gu shijie 1, donghoon 1,
  sunrae 1-but-empty).

Evidence: `cat_e_dio.py` Q1 block. Spot-check (mcoulter raw-unnamed):
`mcoulter/cumulus/bs28_raw/20231109/20231109_BS28_metadata.yml` lines 101–111 —
`- description: Din1 / name: din1`, i.e. the "name" is a lowercased copy of the channel.
**Confidence: very high** (deterministic count; raw-verified).

### F2 — Name↔channel stability (Q2, the key finding)

**Claim:** the name→channel map is unstable in *both* directions; no positional name pins
to one channel.

- 497 distinct names, 92 distinct channels seen in maps.
- **100 names map to >1 channel**; **64 channels map to >1 name**.
- **Max name→channel fan-out:** `RightMilk_Pump` → **8 channels**
  `[Din11, Din2, Din8, Dout11, Dout13, Dout2, Dout6, Dout8]` — note it spans **both Din and
  Dout** (a pump is an output, yet some files wired it to a Din input).
- `LeftMilk_Pump` → 8; `RightWell_Poke`/`LeftWell_Poke`/`CenterWell_Poke`/`Laser`/
  `CenterMilk_Pump` → 4 each.
- **Max channel→name fan-out:** `Din1` → **21 names** (incl. `Poke1`, `RightWell_Poke`,
  `LeftWell_Poke`, `Poke Left`, `SARight_poke_right`, `Light_1`, …); `Din2` → 20; `Din14`/
  `Din15` → 17; `Din3`/`Dout5`/`Dout7`/`Dout8`/`Dout11` → 15.
- **Fixed-template falsifier check** — the would-be "standard" positional names:
  `Poke1`→`{Din1,Din5,Din8}`, `Poke2`→`{Din2,Din9,Din11}`, `Poke3`→`{Din3,Din18,Din29}`,
  `Pump1`→`{Dout7,Dout10,Dout24}`, `Laser`→`{Din4,Dout4,Dout7,Dout18}`,
  `Run_Camera_Ticks`→`{Din13,Din32}`. Only `Light1`→`{Dout1}` is single-valued. **A fixed
  preset would mis-assign the channel for the majority of users.**

Evidence: `cat_e_dio.py` Q2 block. Spot-check (`RightMilk_Pump` two directions, same
experimenter group denisse):
- `denisse/stelmo/Charlie/20260222/20260222_Charlie_metadata.yml` lines 126–127:
  `- description: Dout8 / name: RightMilk_Pump` (output).
- `denisse/stelmo/Laurent/20260507/20260507_Laurent_metadata.yml` lines 135–136:
  `- description: Din2 / name: RightMilk_Pump` (input — direction-inverted).

**Confidence: very high.**

### F3 — Per-day variation within an animal (Q3)

**Claim:** behavioral_events is **day-owned carry-forward**, not animal-static.

- 167 animal-groups (experimenter × subject_id); 140 have >1 distinct day.
- **34 animals** vary their behavioral_event_names set across days; **18 animals** have a
  within-animal name→channel *split* (same name → different channel on different days).
- Top variers: SC18 (4 sets / 10 days), SC38 (4 / 24), peanut (3 / 26), J16 (3 / 50),
  Jacob (3 / 15), Senor (2 / 53).
- **Senor split (verified, canonical):** same animal, `Poke3` moves `Din3` → `Din18`
  mid-experiment, with the experimenter's own inline change-log comments:
  - `alison/home/Desktop/20201028_senor.yml` lines 224–225:
    `- description: Din3 #ends 20201110` / `name: Poke3`.
  - `alison/nimbus/all_rat_metadata_yaml/senor metadata/20201111_senor.yml` lines 224–225
    (commented out) `# - description: Din3 #ends 20201111 / # name: Poke3_r1`, and lines
    258–259 `- description: Din18 #starts on 20201111 / name: Poke3`.
  This is a **board-dependent re-wire on a real recording day**, exactly the carry-forward
  scenario the workspace model already assumes for bad channels.

Evidence: `cat_e_dio.py` Q3 block + raw lines above. **Confidence: very high.**

> Note: corpus-2 `records.jsonl` has no per-channel board field, so I cannot prove *every*
> split is a SpikeGadgets-board change vs a data-entry slip. The Senor inline comments make
> the board-change interpretation near-certain for that case; for the 18-animal set I treat
> "split = legitimate day-owned change OR error" as a *single* design conclusion: the app must
> support per-day editing either way.

### F4 — Empty behavioral_events (Q4)

**Claim:** 69/1,792 files declare **no** behavioral events.

- **56** have the top-level `behavioral_events` key **absent entirely**; **13** have it
  present-but-empty `[]`.
- Who: **sunrae taloma 55**, chiang sharon 13, mcoulter 1.
- When: 2025 (48), 2026 (19) — concentrated in the most recent app-era files.
- Spot-check: `sunrae/cumulus/20250605_ST01_hab/20250605_ST01_metadata.yml` — top-level
  `behavioral_events` list is genuinely absent; the only `behavioral_events` token (line 46)
  is `units.behavioral_events: "-1"` (the units block, unrelated). The `_hab` (habituation)
  path suggests these are behavior-light habituation sessions. Empty DIO is **valid** — do
  not force it. **Confidence: high.**

### F5 — Stems & direction (Q5)

**Claim:** a small stem vocabulary covers most names, and stem ⇒ channel-direction is
strongly consistent (basis for autocomplete + a *soft* direction check).

| stem | files | input(Din) pairs | output(Dout) pairs |
|---|---:|---:|---:|
| `poke` | 1,578 | 11,244 | 34 |
| `pump` | 1,473 | 18 | 10,651 |
| `light` | 937 | 32 | 7,037 |
| `home` | 561 | 902 | 128 |
| `laser` | 139 | 1 | 138 |
| `well` | 138 | 409 | 507 |
| `milk` | 136 | 17 | 534 |
| `reward` | 102 | 0 | 305 |

- `poke` is ~99.7% input; `pump`/`light`/`laser`/`reward`/`milk` are ~98–100% output.
  `well`/`home` are mixed (they appear in both poke- and pump-style compound names).
- **camera-tick** events in **1,562 files** — near-universal; deserves its own
  one-click "add camera-ticks event".
- Overall map-pair channel class: 19,129 input / 24,508 output / 68 other.
- **Direction-inversion (soft error signal):** 42 files have an output-stem name
  (`pump`/`light`/`laser`/…) on a `Din` input channel (51 pairs); 34 pairs have a `poke`
  on a `Dout`. Sample: `denisse/.../Emmett/20251109_Emmett_metadata.yml`,
  `shijie/.../molly/raw/20220415_molly.yaml`. **Low confidence that all are errors** — some
  rigs legitimately read a pump-feedback line on a Din — so this is an *advisory*, never a block.

Evidence: `cat_e_dio.py` Q5 block. **Confidence: high** for prevalence; **low** for the
direction-inversion-as-error interpretation.

---

## Invariants vs variation

**Invariant (stable across the whole corpus):**
- The **shape**: `behavioral_events: [ {description: <channel>, name: <label>}, … ]`.
  `description` is the DIO channel (`Din*`/`Dout*`), `name` is the human label. (Counter-
  intuitive: the *channel* is the YAML `description`, not the `name`.)
- **Stem→direction** correlation (poke=input, pump/light/laser=output) ≈ a physical law.
- **camera-tick events** are present in ~87% of files.

**Varies by experimenter:** naming philosophy (semantic vs positional vs raw vs empty);
the specific name vocabulary; the set size (16 vs 19 vs 21 vs 36 vs 64).

**Varies by time:** empties are a 2025–2026 phenomenon (sunrae habituation sessions); the
36-name "arm/box" sets are the high-throughput coulter/kastner/nevers era.

**Varies by animal/day:** the actual name↔channel assignment (board-dependent), and even the
set membership — 34 animals change their set across days. **behavioral_events is day-owned.**

---

## Error classes (ranked by downstream impact)

1. **Wrong channel for a carried-forward name (silent, high impact).** When a board is
   re-wired mid-experiment (Senor `Poke3`: Din3→Din18) but a copied/carried-forward day keeps
   the old channel, the DIO event is silently attached to the wrong hardware line → wrong
   behavioral timestamps in NWB/Spyglass. The 18 within-animal splits are exactly where this
   bites. **Guard: G2 (channel-collision/diff on carry-forward).**
2. **Duplicate channel within one file (silent).** With 64 channels→many names and free
   editing, two events can claim the same `description` channel. Not directly counted here
   but structurally enabled by the fan-in (`Din1`→21 names). **Guard: G3.**
3. **Direction-inverted assignment (soft).** Pump/light on a Din (42 files). Usually but not
   always an error. **Advisory only.**
4. **Raw-unnamed names (`din1`) (low, cosmetic-ish).** mcoulter's 122 files lose semantic
   meaning downstream (an analyst can't tell which poke is which) but convert fine.
5. **Unintended empty set.** 69 files have none; most are legitimate (habituation) — the risk
   is only the *accidental* empty, which a non-blocking nudge ("no DIO events — is this a
   behavior-light session?") covers without forcing entry.

---

## App-guard / UX implications

**G0 — No fixed full preset (hard rule).** The current fixed `Poke/Light/Pump` suggestion is
Alison-legacy; it fits ~11% of files. Do **not** ship a "standard DIO template". (F1, F2)

**G1 — Stem autocomplete + auto-numbering + free entry.** Offer stems as recognition-not-
recall suggestions: **input** stem `Poke`; **output** stems `Light`, `Pump`, `Laser`,
`Reward`; plus a one-click **camera-ticks** event. Auto-number within a stem
(`Poke`→`Poke1, Poke2, …`). Always allow free custom names (semantic `RightWell_Poke`,
apparatus `HaightLeft_pump_center`, raw `din1`). Personalize the suggestion list with **the
experimenter's own prior names** (their 1–16 historical sets). (F5, F1)

**G2 — Carry-forward / copy-from is the primary reuse, with a channel diff.** behavioral_events
is day-owned: a new day carries forward the prior same-config day's set (like bad channels).
When carrying forward, **surface a diff and let the user re-point a name to a new channel**
(the Senor Din3→Din18 case) — don't silently freeze the old channel. Offer
**copy-from-another-animal** for setup. (F3)

**G3 — Channel-collision check (advisory, in-app).** Within one day, warn if two events share
the same `description` channel (`Din*`/`Dout*`). Cheap, deterministic, catches the silent
duplicate the fan-in enables. (Error class 2)

**G4 — Soft direction hint.** When a `pump`/`light`/`laser` name is assigned a `Din`, or a
`poke` a `Dout`, show a dismissible hint ("pumps are usually outputs — Dout"). Never block:
42 real files do this and some are legitimate. (F5)

**G5 — Empty is allowed; nudge, don't gate.** Behavior-light/habituation days legitimately
have no DIO events (69 files, 2025–26). A non-blocking "no behavioral events — intended?"
note is the most it warrants. Mirrors the existing "behavior-only days need no electrodes" rule.

**Clarify the field labels in the UI:** the YAML `description` is the **channel** and `name`
is the **label** — counter-intuitive enough that the form should label them
"Channel (Din/Dout)" and "Event name", not "description/name".

---

## Competing hypotheses & falsifiers

- **H1 (adopted): no lab template; per-person + day-owned.** Falsifier: a single name-set
  covering >60% of files, or `Poke1` pinned to one channel corpus-wide. **Refuted** — top set
  = 19%; `Poke1` spans 3 channels.
- **H2: the *app-era* (post-2023) converged on one set even if legacy didn't.** Partially
  testable: app-era is dominated by the 36-name coulter set + Haight sets — still ≥3 large
  competing sets and the 2025–26 empties. **Not converged.** (Could be re-checked by filtering
  `gen_class=='app-like'` in records.jsonl — left as a cheap follow-up.)
- **H3: within-animal splits are data-entry errors, not real re-wires** (would weaken the
  "day-owned" claim). Falsifier: change-log comments in the raw files. **The Senor file's own
  `#ends 20201110` / `#starts on 20201111` comments confirm a deliberate re-wire** for at
  least the canonical case; the design conclusion (support per-day editing) is robust to which
  it is for the other 17.
- **H4: stem→direction is an artifact of one big experimenter.** Falsifier: the correlation
  holds within multiple experimenters' sets. It holds across positional (Alison), well-based
  (denisse), arm-based (gu) and box-based (coulter) vocabularies — i.e. across ≥4 independent
  naming schemes — so it reflects physical wiring, not one person's habit.

---

## Reproduce

```bash
cd /Users/edeno/Downloads/yaml_analysis2 && uv run cat_e_dio.py
```

Filters `is_suspect==False`; reports both all-files and content-deduped (`is_content_dup`)
views. Re-run after corpus changes; spot-check any new surprising count against the raw file
(this note cites paths + line numbers for every headline).
