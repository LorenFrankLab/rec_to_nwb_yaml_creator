# User journeys & failure-mode analysis (tabbed-workspace IA)

**Purpose:** trace what a user actually does across the three cadences, enumerate the mistakes they can
make, and for each: *would they know? how is it surfaced? how do they recover?* — then map that onto the
four layout designs. **Method:** competing hypotheses with explicit confidence (0–1), self-critique, and
a hypothesis tree, so the reasoning is transparent and re-checkable. This is analysis, not a spec.

---

## Foundations

**Mental model.** Neuroscientist (not a developer): *an animal* (subject, recorded over weeks) → *recording
days* (sessions — the thing converted) → on top of mostly-shared *rig setup* (electrodes, recording system,
cameras, DIO, opto) that occasionally changes. Dangerous misconception: *"am I editing this one day or all
of them?"*

**Three cadences** (the real jobs): (1) **same-day** — log today's session, frequent/dominant; (2) **return**
— add one more session, setup already exists; (3) **catch-up** — many days after time has passed; triage +
batch. Setup/reconfig is episodic, cutting across all three.

**Stated goals:** days = unit of work, setup = revisitable reference (not a wizard); blast-radius
transparency + no silent retroactive change; behavior-only valid → guide not gate; batch-row scan/triage;
ownership cues at the point of action.

### The three safety layers (verified against the code, June 2026 — confidence noted)

| Layer | What it covers | Examples (verified) |
|---|---|---|
| **Prevented at entry** (controlled input) | can't easily type a bad value | `device_type` = `<select>` from `deviceTypes()`; `species` = known list + `isValidSpecies`/`invalid_species`; day-side camera/epoch/DIO refs = controlled selects (Phase 8.7) — *conf 0.8* |
| **Detection — blocking error** (validation gate, fail-closed export) | caught before export, can't export | channel range/partition/row-count, duplicate ids/epochs/descriptions, dangling camera/epoch/DIO refs, `empty_location`, `partial_configuration`, `*_slash`, `unknown_device_type` — *conf 0.85* |
| **Detection — WARNING only** (non-blocking) | flagged but **export still allowed** | **`inconsistent_location_case`** (brain-region capitalization), orphaned video/file — *conf 0.8* |
| **Silent downstream** (this app is the only gate) | nothing flags it here or downstream | wrong-but-VALID attribution (memory errors); region fragmentation if the case warning is ignored; `bad_channels` out-of-range silently ignored by trodes_to_nwb; species free-text rejected only at DANDI — *conf 0.75 (per CLAUDE.md)* |

> **~~Pivotal finding (RETRACTED — see Calibration log)~~:** ~~brain-region `location` is free text, so
> capitalization consistency is warning-only.~~ **CORRECTED:** the Animal Editor modal **canonicalizes**
> region fields on save (`canonicalizeRegion` vs `BRAIN_REGIONS` + workspace `knownRegions`), so "ca1" →
> "CA1" at the write boundary. Region drift is **prevented for direct entry**; `inconsistent_location_case`
> is a backstop for **imported/recovered** data only. (conf 0.85 after verification)

### Calibration log (data-gathering updates)

| Q | Verified | Result | Hypothesis update |
|---|---|---|---|
| Q1 — does export gate on warnings? | `ExportStep.jsx:91` filters `severity==='error'`; warnings "do not block export" | **Warnings never block** (conf 0.9) | strengthens the *batch-rides-a-warning* risk (#18) |
| Q2 — is region a controlled input? | `ElectrodeGroupModal` `canonicalizeRegion()` on save + `targeted_location` autocomplete + `knownRegions` | **Region is canonicalized on save** (conf 0.85) | **downgrades** region-case from H-A's headline example to an *imports-only* backstop |
| Q3 — case-rule scope | Rule 12 covers `location` + `targeted_location` (empty + case), Spyglass keys BrainRegion off `location` | both covered (conf 0.8) | minor |

**Net recalibration:** H-A's *worst-case example shifts* from "region capitalization (weakly caught)" to
**valid-but-wrong / uncatchable** (memory misattribution #14, wrong config version #12/#17). The UI already
*prevents or canonicalizes* most bad VALUES; the irreducible residual is values that are **valid but
semantically wrong**, which no validation can catch — only scientist review. This *sharpens* the design
implication toward **review aids**, not more validation.

---

## Journey 1 — First session (brand-new user)

**Goal:** nothing → one valid, exported YAML. In Option 4 a new animal lands in **Setup** mode on the
setup overview/checklist.

**Steps:** create animal (subject facts) → configure the setup *their* session uses (electrodes→channel maps
if ephys; recording system; cameras; DIO) → **Recording Days**: add a day → fill it (session, tasks/epochs,
cameras used, videos, opto?, failed channels) → **Validation & Export**: check → export.

| # | Mistake | Likelihood | Severity | Caught as | Surfaced / Recovery |
|---|---|---|---|---|---|
| 1 | Doesn't know what to set up; thinks *everything* is required | High | Low–Med | — | setup checklist + tab/section dots; behavior-only framing ("if ephys / if video"). Recover: follow checklist. **No hard gate.** |
| 2 | Species as free text ("rat") | Med | High (DANDI reject) | prevent + error | known-list input; custom → `invalid_species` blocks export. Recover: pick canonical. |
| 3 | **Brain region capitalization ("ca1")** | **High** (free text) | **High** (Spyglass fragments, silent) | **warning only** | `inconsistent_location_case` — *non-blocking*. A first-timer may ignore a warning and export. **Weakest link.** |
| 4 | Wrong/garbled channel map or out-of-range bad channels | Med | High | error (map) / warn or silent (bad ch) | `channel_*_out_of_range`, `bad_channel_out_of_range`, `multishank_bad_channels_ignored`. Recover: fix in Channel Maps. |
| 5 | References a camera not set up / forgets day's cameras / camera missing m/pixel | Med | High | error | `dangling_camera_ref` / `missing_camera`. Recover: add camera or select used one (ownership hint). |
| 6 | Partial optogenetics (some fields) | Low–Med | High | error | `partial_configuration`. Recover: complete all-or-nothing, or clear. |
| 7 | session_id / subject_id with "/" | Low | Med | error | `*_slash`. Recover: rename. |
| 8 | Picks a `device_type` with no probe file (rare/legacy) | Low | High (FileNotFound downstream) | prevent (dropdown) + error | dropdown limits it; `unknown_device_type` catches imports. |

**Net:** the export gate + repair routing handle most first-timer errors well. **The residual hole is #3
(region case): high-likelihood, high-severity, only a warning.** (conf 0.8)

---

## Journey 2 — Return, one more session

**Goal:** add one day; setup is inherited (don't re-enter it). Option 4 opens on **Recording Days**.

**Steps:** open animal (→ Recording Days) → Add Recording Days (new date) → fill the day → Validation & Export.

| # | Mistake | Likelihood | Severity | Caught as | Surfaced / Recovery |
|---|---|---|---|---|---|
| 9 | **Blast-radius:** edits shared Setup to change *this* day → retroactively changes prior days (recalibrate camera, change rec-system value, edit geometry) | High (intent) | High | confirm-time (not validation) | camera → *new-identity default* + "affects N days"; rec-system "affects all days"; reconfig confirm enumerates days. Recover: back out / new identity. **In Option 4, you must deliberately leave Recording Days for the Setup mode — structural friction that reduces the accidental version.** |
| 10 | Forgets to "Use on this day" a DIO/behavioral event (library ≠ exported) | Med | Med | ~silent | day's `behavioral_events` empty → only caught if a rule references it. **Opt-in is easy to forget.** Surfaced weakly. |
| 11 | Duplicate task epoch / behavioral-event description | Med | High (downstream `raise`) | error (inline + export) | `duplicate_task_epoch` / `duplicate_behavioral_event_description` (shared helper, inline badge). Recover: rename. |
| 12 | Uses the wrong configuration version (hardware changed but day pinned to old, or vice-versa) | Low–Med | High (wrong geometry, *valid*) | ~silent (valid but wrong) | version shown on the day + preflight scan (`config vN`); reconfig wizard. Recover: re-pin. **Validation can't catch valid-but-wrong.** |
| 13 | Weight: enters animal-baseline thinking it's the day, or vice-versa | Low | Low–Med | — | Phase 8.7 made weight day-owned + labelled fallback. Recover: edit day weight. |

**Net:** the return journey is dominated by **#9 (blast-radius)** and the **valid-but-wrong** pair (#10, #12)
that the system *cannot* block. Layout matters here: separating Setup from day work reduces #9. (conf 0.7)

---

## Journey 3 — Catch-up, several sessions (time has passed)

**Goal:** create/enter many days, triage readiness, batch export. Option 4: Days mode (calendar batch-create
+ per-day fill) → Validation & Export mode (scan + triage + repair) → batch export.

**Steps:** add many days (calendar) → fill each (the bulk) / review recovered-imported days → Validation &
Export: scan readiness (config version · cameras · opto · chips) → repair the not-ready → batch export ready.

| # | Mistake | Likelihood | Severity | Caught as | Surfaced / Recovery |
|---|---|---|---|---|---|
| 14 | **Memory error:** misattributes which day used which camera/epoch/room/opto (time passed) | High | High (*valid but wrong* — uncatchable) | **silent** | only the scan line + effective-setup review let the scientist self-check. **No system can catch a plausible wrong value.** Recover: review + edit. **This is the single least-defendable class.** |
| 15 | Consistency drift across many entries (region case, camera naming) | High (volume) | High | warning / identity-guard | `inconsistent_location_case` (warn); camera identity-divergence guard. Compounds with volume. |
| 16 | Recovered/imported corruption (dangling refs, wrong-owner, malformed shapes) | Med | High | error/recovery rows | `RawCorruptionBanner`, dangling/orphan/wrong-owner day rows + repair commands. Recover: in-place repairs (Phase 8.7). |
| 17 | Reconfiguration boundary wrong (which days are v1 vs v2 after a hardware change) | Med | High (wrong geometry, valid) | ~silent + confirm | reconfig wizard enumerates affected days; version scan. Recover: re-run reconfig / re-pin. |
| 18 | **Batch-exports a warning-level issue** (region case ignored) across many days | Med | High (silent fragmentation ×N) | warning (non-blocking) | export-valid-only gates on **errors, not warnings** → a region-case warning rides along. Preflight shows it but doesn't stop it. **Volume multiplies the silent harm.** |

**Net:** catch-up is where **silent / valid-but-wrong** classes dominate (#14, #15, #17, #18), amplified by
volume. Triage/scan + mandatory pre-export review are the only real defenses. (conf 0.75)

---

## Hypothesis tree — the dominant failure classes (ranked by likelihood × severity)

- **H-A — VALID-BUT-WRONG is the highest-severity residual class** *(recalibrated)*. Core examples after
  verification: **memory misattribution (#14)** and **wrong config version (#12/#17)** — values that pass every
  rule but are semantically wrong; **no UI can catch them**. (Region capitalization is *de-escalated* — it's
  canonicalized on save; only imports/recovered data + non-blocking warnings #18 remain.) **conf 0.8** that
  valid-but-wrong is the top residual class.
  - *Implication (sharpened):* the lever is **review aids**, not more validation — a dense, comparison-friendly
    **scan + effective-setup review** that the user can't skip before export, and **legible config-version
    boundaries**. Also: ensure **imported/recovered** data gets the same canonicalization (or its warning is
    surfaced unavoidably), since the modal-entry path is already safe.
- **H-B — Blast-radius (edit shared setup → retroactive change) is the highest-FREQUENCY risk** on return/catch-up,
  but Phase 8.7 already mitigates it heavily (new-identity defaults, confirms). **Residual conf 0.6.**
  - *Implication:* structural separation of Setup from day work further reduces the *accidental* case.
- **H-C — First-timer discoverability/orientation** is real but one-time and well-mitigated by the checklist +
  intent-named structure. **conf 0.55.**
- **H-D — Catch-up volume + memory + triage friction.** **conf 0.65.** *Implication:* a status-first triage
  surface + consistency aids.

### Competing DESIGN hypotheses

- **HD-1 — Option 4 (mode-switch) best supports the mistake/recovery lifecycle:** Setup mode structurally
  dampens H-B; Validation & Export mode is the H-A/H-D triage+recovery hub; intent-modes serve H-C; "Fix in
  <mode>" recovery routing is clean. **conf 0.6.**
- **HD-2 — Option 3 (dashboard) best for H-A/H-D detection** (status-first) but worst for the frequent same-day
  and weaker on H-B (no structural setup separation). Best *overall*: **conf 0.3.**
- **HD-3 (the self-critique) — Layout is SECONDARY to prevention + surfacing.** The highest-severity class
  (H-A: region case, memory misattribution, valid-but-wrong) is **not solved by any of the four layouts** — it
  needs controlled vocabularies + a mandatory pre-export review + the scan contract. Layout meaningfully affects
  only H-B (blast-radius, via setup separation) and H-C (discoverability). **conf 0.75.**

---

## Mapping the designs to *recovery* (where the user meets the surfacing)

Surfacing/recovery mechanisms (validation chips, ownership hints, repair routing, blast-radius confirms, scan)
live in the **domain/components, not the layout** — so all four inherit them. Layout changes *where the user
encounters them*:

| | error chips appear | repair routes to | blast-radius edit lives | triage/scan home |
|---|---|---|---|---|
| 1 Rail+Tabs | Days / Val tab | one of 8 tabs | a setup tab (label-separated) | Val tab |
| 2 Tree | tree-node dots | a tree node | a tree section (flat sibling) | (weak — open Days) |
| 3 Dashboard | overview cards | from a card | a deep section | **the overview (strong)** |
| 4 Mode-switch | Days / Val mode | "Fix in Setup → X" (mode switch) | **Setup mode (structurally separate)** | **Validation mode (strong)** |

Option 4 is the only one where the *recovery route* and the *blast-radius boundary* both align with a
top-level structural seam.

---

## Self-critique & open questions (to keep calibration honest)

1. **I'm over-weighting severity vs. likelihood in places.** Region case is high×high → genuinely top. Memory
   misattribution is high×high but *uncatchable by any UI* — so it's not a design failure, it's a review-aid
   problem; don't let it dominate the layout decision. (adjusts H-A's design pull downward slightly)
2. **Unverified surfacing claims** (lower confidence until checked): does the **Export preflight force the user
   to acknowledge warnings** before download, or can they ignore them? Does region `location` have *any*
   autocomplete I missed? Is "Use on this day" forgetting (#10) caught anywhere? Does `targeted_location`
   (which IS validated for emptiness) also have a case rule? **These determine how bad H-A really is.** (conf
   that they're currently un-forced: 0.5 — needs a look)
3. **HD-3 is the most decision-relevant finding and I hold it at 0.75** — if true, we should not over-invest in
   the layout debate before fixing the controlled-vocabulary + mandatory-review gaps. A skeptic would say
   layout still shapes whether users *reach* the review; fair, but that's H-D, not H-A.
4. **Confidence in the cadence frequencies** (same-day dominant) is assumed, not measured — conf 0.6. If most
   real use is catch-up (batch), the dashboard's (Option 3) status-first bias gains weight.

---

## Implications (what this analysis actually argues for)

1. **Layout: Option 4** remains the best *structural* fit (aligns recovery routing + the blast-radius seam +
   intent-modes), **but** —
2. **The bigger wins are layout-independent first-class requirements** *(reordered after verification —
   most VALUE prevention already exists; the gap is VALID-BUT-WRONG review + imports + warning escape):**
   - **Make the scan / effective-setup review the unavoidable pre-export step** — it is the *only* defense
     against valid-but-wrong (memory misattribution, wrong version). Dense, comparison-friendly, per the
     batch-row scan contract. *Highest leverage now.*
   - **Keep configuration-version boundaries legible** ("changed [date] — days before/after use v1/v2") to
     blunt #12/#17.
   - **Close the warning escape on batch export** — export-valid-only gates on errors, **not warnings**
     (verified). Batch export should not silently ride a warning across N days without explicit
     acknowledgement (matters mainly for imported/recovered days now that direct entry is canonicalized).
   - **Apply the modal's region canonicalization to imported/recovered data too** (direct entry is already
     safe; imports are the remaining region-drift path).
   - **Surface the "Use on this day" opt-in for DIO events** (#10) — easy to forget; weakly surfaced today.
3. **Layout choice (Option 4)** mainly buys H-B (blast-radius seam) + H-C (orientation) + clean recovery
   routing. It does **not** address the top residual (H-A valid-but-wrong) — that is review-aid work. Don't
   let the layout debate crowd out the review/imports requirements above.
