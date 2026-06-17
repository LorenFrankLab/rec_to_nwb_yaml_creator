# YAML corpus-2 — P4 design implications (the build list)

**Date:** 2026-06-17 · **Input:** [03-synthesis.md](./03-synthesis.md) (the ranked error catalogue) +
the 8 `cat-*` notes' "App-guard/UX implications" sections + the prior
[../yaml-corpus-analysis.md](../yaml-corpus-analysis.md) §7. **Verified against source** (every
"already implemented?" cell was checked in `src/` on this branch — see the per-row file refs). This is
the payoff phase: confirmed error classes → prioritized, **gap-aware** app guards + UX levers.

Cross-references the app's UX rubric ([../ux-principles.md](../ux-principles.md), items 1–10) and the
must-preserve substrate ([../existing-app-invariants.md](../existing-app-invariants.md)).

> **The headline finding for the build:** the app **already covers most of the high-frequency classes**
> (species/sex/weight, camera dangling, bad-channel range, multishank consolidation, device_type gate,
> location fragmentation, volume dual-key, opto all-or-nothing, invariant seeding). The **largest
> remaining silent-corruption gap is `power_in_W: 200` (#3) — completely unguarded today.** The next
> tier is a small set of numeric range/type guards and a few legacy-import normalizers.

---

## 1. Strategy (the philosophy the data forces)

- **The app is the gate, because downstream is silent.** trodes_to_nwb logs-and-continues, Spyglass logs
  ingestion errors to a side table, NWB Inspector findings don't fail the run. A YAML that "converts
  without error" can still be wrong. So every silent-corruption class (synthesis #1,#2,#3,#7,#10,#14,
  #15,#17,#19,#20,#23) must be **gated at export**, not merely warned (rubric 10).
- **Derive-don't-ask for invariants.** The ≥99%/≥92%/99.8% lab-wide constants (`raw_data_to_volts`,
  `times_period_multiplier`, `institution`) and the structural invariants (key sets, `map` value space,
  channels-per-ntrode) should be *generated*, never free-typed. This is the single highest-confidence
  guard family. The app already does most of it via the recording-system catalog + the encoder owning
  keys; the residual is a **numeric-type export gate** so a reintroduced `"1.5cd"` can never ship.
- **Controlled-vocab + recognition-over-recall for fragmentation** (rubric 4). Location, species, sex,
  units, `data_acq_device.system` should be picked/confirmed from visible options, not retyped — kills
  the `hippocampus`/`Hippocampus`/`hippcoampus` and `Rat`/`Male` fragmentation at the source.
- **Enter-once-lock + same-animal consistency for static-field drift** (rubric 1,4). The animal-static
  tier (species, sex, genotype, DOB, devices, locations) is entered once on the animal and *derived*
  into every day; cross-day variance = the error signal (the 13 self-contradicting animals). The
  workspace model already locks this — keep it, and add an explicit same-animal consistency check for
  imported/legacy data that bypasses the lock.
- **Per-experimenter templates seed compliant defaults.** 78–94% per-person internal consistency means
  the cheapest fix for the *uniform* house-convention errors (`Rat`/`Male`/no-DOB) is to **pre-fill from
  the experimenter's own most-recent post-2023 file** with DANDI-compliant values. Partly built
  (institution/lab seeding); extend to species/sex/units.
- **Range-guard the physically-bounded numbers.** Opto power, wavelength, volume, and coordinates have
  physical envelopes. A soft range warning (numeric-or-derive) catches the 10,000× `power_in_W` and
  1000× `volume` slips that are otherwise invisible until the NWB is read.

---

## 2. The guard table (one row per confirmed error class)

Mechanism legend: **derive** (generate, don't ask) · **lock** (enter-once at animal, derive into days) ·
**gate-export** (block the export on the raw + normalized model) · **validate-entry** (inline at the
field) · **vocab** (controlled list / datalist) · **ref-check** (referential integrity) · **range**
(numeric envelope) · **import-repair** (one-click normalize on import). Priority: **P0** silent-corrupt ·
**P1** hard-fail · **P2** DANDI-reject · **P3** cosmetic/fragment.

| # | Error class | Mechanism | WHERE (surface / file) | Already? | User-facing UX | Pri | Effort |
|--:|---|---|---|---|---|:--:|:--:|
| 3 | **`power_in_W: 200`** (~10,000×) | range (numeric-or-confirm) | opto excitation-source editor + a new export rule in `src/validation/rules/optoRules.ts` | **NO** | On entry > 1 W: "200 W would vaporize tissue — fiber output is mW. Did you mean 0.2 W (200 mW)? The laser model's '200' is its max mW." Confirm-to-keep; warn at export. | P0 | M |
| 2 | **Volume 1000× conflict** (`uL 0.45`/`ul 450`) | derive (one µL input → both keys) | `emitVirusInjections` in `src/state/workspaceUtils.ts` (editor stores `volume_in_uL` only) | **YES** (derive wired; `uL` authoritative on import) | Single µL-labelled input; import flags a `uL≠ul` conflict for confirm. | P0 | — |
| 17 | **Out-of-range `bad_channel`** | range + gate-export | `channelBounds` (`bad_channel_out_of_range`), `src/validation/rules/channelMapRules.ts` | **YES** | Day-routed error naming the valid 0–N range. | P0 | — |
| 19/multishank | **bad_channels on a later shank row dropped** | gate-export + derive (first-row consolidation) | `multishankBadChannels` rule + `buildProbeWideBadChannelMap` | **YES** | Failed-channels grid writes probe-local indices to the first row. | P0 | — |
| 15 | **camera_id dangling ref** | ref-check + gate-export | `danglingCameraReferences`, `src/validation/rules/referenceRules.ts` | **YES** | "Task N references camera id X, none defined — pick an existing camera." | P0 | — |
| 1 | **Space-separated top-level keys** (total electrode loss) | import-repair (key normalize) + gate-export | import path (`src/state/yamlImportPlan.ts` / `yamlImport.ts`); export covered by encoder owning underscored keys | **PARTIAL** (encoder owns keys; import infers via filename, but no explicit "convert `electrode groups`→`electrode_groups`" repair surfaced) | One-click "This file uses old spaced keys — convert to `electrode_groups` (N electrodes recovered)?" with a before/after count. | P0 | M |
| 7 | **Same-animal DOB/genotype/species drift** | lock + consistency-check | animal-static lock (`workspaceTransitions.ts` carry-forward); `src/state/identityDivergence.ts` for imports | **PARTIAL** (lock prevents new drift; verify imported multi-day animals get a divergence check) | On import of a 2nd day with a conflicting static fact: "Day 0712 says DOB 04-12, Day 0726 says 07-26 — which is correct?" (interleaved cases defeat latest-wins). | P0 | M |
| 5 | **species non-binomial** (`Rat`) | validate-entry + vocab + import-repair | `isValidSpecies` (`src/validation/dandiSubject.ts`), `dandiSubjectConformance` rule, `SPECIES_SUGGESTIONS` (`src/state/importRepair.ts`) | **YES** (gate + suggestion) | Animal form rejects free text; import offers "Rat → Rattus norvegicus". **Gap: no override path** for genuine non-norvegicus (see §6). | P2 | — |
| 6 | **sex non-single-letter** (`Male`) | vocab (enum) + import-repair | schema enum `M/F/U/O`, `SEX_SUGGESTIONS` | **YES** | Dropdown on the animal form; import "Male → M". | P2 | — |
| 8 | **DOB missing** | validate-entry (required) | schema `required` under `subject`; animal-creation form | **YES** (schema-required) | Required field on the animal form; export blocks if absent. | P2 | — |
| 9 | **weight string-with-unit** (`"541g"`) | validate-entry (numeric) + import-repair | schema `type:number`; weight import-repair parses `"541g"→541` | **YES** | Numeric input labelled "(g)"; import suggests the parsed number. | P2 | — |
| 10 | **NULL location on ACTIVE group** | gate-export (active-scoped) + vocab | `electrodeGroupLocations` (`empty_location`/`empty_targeted_location`), location datalist | **YES** (empty blocked) | Required brain-region datalist per group; export blocks empty. (Note: must stay active-scoped — don't flag the 1,272 disabled-tetrode NULLs.) | P2/Fragment | — |
| 11 | **location fragmentation** (`CA1`/`ca1`/typo) | vocab + validate-entry (warn) | `locations()` datalist (`src/locations.ts`); `inconsistent_location_case` warning rule | **PARTIAL** (datalist + case-warning across groups; no typo/canonical-casing nudge) | Datalist suggests canonical spellings; warn on mixed case. **Gap: no warn when a typed value is one edit away from a known region** (`hippcoampus`). | Fragment | S |
| 12 | **strain in genotype field** (`Long-Evans Rat`) | validate-entry (warn) | genotype field (animal form); no rule today | **NO** | Soft warning "'Long-Evans' is a strain, not a genotype — put strain in subject description." Don't block (it's semantics). | Fragment | S |
| 13 | **`times_period_multiplier: "1.5cd"`** | derive + gate-export (numeric type) | seeded from recording-system catalog (`rigConstants.ts`); needs an export-time `number` assertion | **PARTIAL** (seeded numeric; no explicit non-numeric export gate) | The value is derived (not free-typed); add an export gate that blocks a non-numeric rig constant so a reintroduced/imported `"1.5cd"` can't ship. | P1 | S |
| 20 | **`raw_data_to_volts` placeholder / alt gain** | derive + validate-entry (confirm on differ) | `rigConstants.ts` seeds 0.195; `resolveRigConstant` reports `differs` | **PARTIAL** (seeded + differ-status; no explicit "are you sure?" on a hand-changed value) | Show "differs from default" honestly; on a value like `2.95e-7` (plausible alt-ADC) prompt-don't-autofix (synthesis open-Q #6). | P0 | S |
| 4 | **Unresolvable `device_type`** | vocab (enum) + gate-export | schema enum + `knownDeviceTypes`/`consistentProbeCatalog` rules | **YES** for the 12-probe set; **NO** for the `screw`/`single_electrode` hardware gap (65 files) | Dropdown of supported probes; unknown blocks with "contact pipeline maintainer". **Gap: `screw`/`single_electrode` is a real feature gap** (see §6). | P1 | (probe: S; hardware gap: L) |
| 14 | **`task_epoch`/`task_epochs` key split + scalar/list** | derive (encoder canonicalizes) + ref-check | encoder emits canonical keys; epoch ref-integrity in `referenceRules.ts` | **YES** (single canonical shape on export) | Epoch picker; encoder owns the key + list shape, so the split can't be reintroduced. | P0 | — |
| 16 | **Space-key wholesale (missing `subject_id`)** | import-repair | subset of #1; import surfaces missing `subject_id` as a fix-in-file blocker | **PARTIAL** (recent commit made missing `subject_id` a blocker) | Same one-click key-normalize as #1 recovers the id. | P1 | (folded into #1) |
| 18 | **Unparseable YAML syntax** | import (loud parse error) | YAML parse boundary | **YES** (parser throws — loud, cheapest) | "This file isn't valid YAML (line N) — fix and re-import." No app change needed. | P1 | — |
| 21 | **units 6-way encoding** (`"'unspecified'"`, `-1`, `1`) | vocab + import-repair | units field; no controlled list / normalize today | **NO** | Dropdown for analog/behavioral units; import normalizes the double-quoted `"'unspecified'"` → `unspecified`. | P3 | S |
| 22 | **DANDI-tolerant free-text drift** (`lab`, header path, `system`, task casing) | vocab + derive | per-experimenter seeding (`lab`/`institution`); `data_acq_device.system` + task-name casing uncontrolled | **PARTIAL** (lab/institution seeded; no `system` vocab; no task-name canonical casing) | Pick `system` from a short list (`SpikeGadgets`/`MCU`); canonicalize task-name casing on entry. Low value. | P3 | S |
| 23 | **Orphan ntrode `electrode_group_id`** | ref-check + gate-export | `danglingElectrodeGroupRefs` rule | **YES** | "Ntrode N references group X, none exists — remove or add the group." | P0 | — |
| 24 | **MMDDYYYY filename** | derive (filename) | `formatDeterministicFilename` (`src/io/yaml.ts`) | **YES** (app emits canonical `mmddYYYY`) | Filename is generated, not typed — can't recur for app-authored files. | P1 | — |
| 25 | **Placeholder `subject_id`** (`12345`/`54321`) | validate-entry (warn) | animal-creation form; no placeholder-id check | **NO** | Soft warning "12345 looks like the template placeholder — is this the real animal id?" | Fragment | S |
| — | **institution invariant** | derive + validate-entry (warn) | seeded `University of California, San Francisco` (`animalCreation.ts`) | **YES** | Pre-filled; warn (don't block) on a different value (genuine outside collaborators exist). | P3 | — |
| — | **`n_eg ≠ n_ntrode`** | **DO NOT GUARD** | — | n/a | Correct multi-shank expansion (789/800). Flagging is a false-positive nuisance. | — | — |

---

## 3. Top recommendations, sequenced (value × low effort first)

The app already closes most classes. The remaining work is small and clusters by mechanism:

1. **[P0, M] Add the `power_in_W` range guard (#3).** The biggest *unaddressed* silent class — 70/71
   opto files wrong by 10,000×. New rule in `optoRules.ts`: warn-to-confirm when `power_in_W > 1` for an
   implant source, with a message that names the mW/W confusion and points at `fs_gui.power_in_mW`.

2. **[P1/P0, S — one mechanism] Numeric-or-derive export gate for the physical-constant + power fields.**
   One small family of guards kills several classes at once: a **non-numeric export gate** on
   `times_period_multiplier`/`raw_data_to_volts` (#13 `"1.5cd"`, #20 placeholders) plus the `power_in_W`
   range check (#3) plus the soft volume/coordinate envelopes. Group them: "a numeric field that's wrong
   by orders of magnitude or carries a non-number must not ship." Builds on the existing
   `rigConstants.ts` derive + `resolveRigConstant` differ-status.

3. **[P0, M] Surface the space-key one-click repair on import (#1, #16).** The encoder already prevents
   *new* space-key output; the gap is the **import** of the 36 legacy files. Add an explicit "convert
   `electrode groups` → `electrode_groups` (N electrodes recovered)" repair with a before/after electrode
   count, so the total-electrode-loss class is visibly fixed rather than silently inferred.

4. **[P0, M] Same-animal static-fact consistency check on import (#7).** The lock prevents new drift;
   confirm imported multi-day animals run through `identityDivergence` so a DOB/genotype/species conflict
   across days is surfaced for a human pick (interleaved cases defeat latest-wins).

5. **[Fragment, S] Genotype-vs-strain soft warning (#12) + placeholder-id warning (#25) + canonical-casing
   nudge for location typos (#11).** Three cheap validate-entry warnings that reduce Spyglass
   fragmentation without blocking. Share the "soft warning, recognition-over-recall" pattern.

6. **[P2, S] Extend per-experimenter seeding to species/sex/units.** Institution/lab are already seeded;
   adding species/sex/units (from the experimenter's most-recent **post-2023** file) makes the uniform
   `Rat`/`Male` house-convention errors structurally rare for new files (rubric 4,6).

7. **[P3, S] Controlled vocab for `units` and `data_acq_device.system`; normalize the double-quoted
   `"'unspecified'"` on import (#21,#22).** Low value, low effort — do last.

**Already done — do NOT re-propose:** volume dual-key derivation (#2), bad-channel range + monotonicity +
multishank consolidation (#17,#19), camera dangling refs (#15), species/sex/weight gate + import-repair
(#5,#6,#9), device_type enum gate (#4 for the 12-probe set), location empty/case (#10,#11 partial),
opto all-or-nothing, epoch-key canonicalization (#14), filename derivation (#24), invariant seeding
(institution / rig constants).

---

## 4. Import-repair flows (the legacy corpus will be imported)

The 938 legacy files *will* be imported as users backfill old studies. One-click normalize-on-import
should (building on the existing `importRepair.ts` + `yamlImportPlan.ts`):

- **Space-keys → underscores (#1,#16).** Detect `electrode groups:`/`ntrode electrode group channel map:`/
  `subject id:` and offer one-click key-normalize, reporting **how many electrodes/the subject_id were
  recovered** (the value is load-bearing — show it). This is the only hard-conversion class in the time
  series; surface it loudly. *Gap today — the encoder owns underscored keys but no explicit import repair
  is surfaced.*
- **`Rat`/`Long-Evans` → `Rattus norvegicus` (#5).** Already wired (`SPECIES_SUGGESTIONS`). Keep.
- **`Male`/`Female` → `M`/`F` (#6).** Already wired (`SEX_SUGGESTIONS`). Keep.
- **`"541g"` → `541` (#9).** Already wired (weight parse). Keep.
- **Strain-in-genotype (`Long-Evans Rat` in `genotype`) → suggest moving to subject description (#12).**
  *Gap* — add as a suggestion, not a silent move.
- **MMDDYYYY filename (#24).** The app re-derives the canonical filename on export; on import, parse the
  date robustly and warn if the source filename was non-canonical.
- **Conflicting `volume_in_uL`/`volume_in_ul` (#2).** On import, when the two spellings disagree, flag a
  confirm ("file says uL 0.45 / ul 450 — keep 0.45 µL?") rather than silently taking `uL`.
- **Double-quoted `"'unspecified'"` units (#21).** Normalize on import.

**Principle (already followed in `importRepair.ts`):** every *suggested* value is gated by the predicate
that flagged the original (a species suggestion must pass `isValidSpecies`); nothing is laundered — an
unmappable value surfaces as a user-input row, and corruption is preserved visible, never silently
dropped (matches the load-time orphan-visibility contract).

---

## 5. Anti-recommendations (what the data says NOT to do)

- **No fixed DIO/behavioral-events template.** 67 distinct name-sets; top covers 19%; the name↔channel
  binding is **day-owned and board-dependent** (the verified Senor `Poke3: Din3→Din18` split). Offer
  stems + autocomplete + carry-forward-with-diff, **never** a preset (synthesis #6).
- **Don't gate behavior-only days on electrodes.** A recording day can be ephys-free; don't nudge
  electrode setup as mandatory before adding/exporting a behavior-only day.
- **Don't flag `n_electrode_groups ≠ n_ntrode`.** Correct multi-shank expansion (789/800). A guard here
  is pure false-positive nuisance.
- **Don't flag NULL `location` on DISABLED tetrodes.** 1,272 of 2,024 NULL locations are intentional
  (disabled/dead tetrodes). The location gate must stay **active-group-scoped** (≥1 good channel) —
  which `electrodeGroupLocations` already is in spirit (verify it doesn't flag all-bad rows).
- **Don't nag the empty-opto scaffolding files.** ~110 "opto" files are empty `[]` placeholders; real
  opto is 71 files / one group. The all-or-nothing rule correctly treats *all-empty* as "no opto" (not a
  partial). Keep zero-opto silent; only block genuine partials.
- **Don't auto-rewrite a plausible alternate `raw_data_to_volts`.** `2.95e-7` may be a real alt-ADC gain
  (open-Q #6) — **prompt, don't autofix**.
- **Don't hard-block species for genuine non-norvegicus** — allow an override-with-confirm (see §6).

---

## 6. Open product decisions (need a human)

1. **`screw` / `single_electrode` hardware (#4, 65 files / 17 animals / 2 users).** This is a real
   EEG/skull-screw setup the app *cannot express* — a feature gap, not user error. Decision: add a
   first-class "screw / single-electrode" device type (needs a trodes_to_nwb probe-metadata entry too),
   or keep blocking and tell those users the format is unsupported. **Effort L; needs pipeline-team
   coordination.**
2. **Species: hard-block vs warn-with-override.** The gate is correct for the lab (Rattus norvegicus),
   but genuine non-norvegicus work exists (marmoset/macaque/mouse appear in `SPECIES_SUGGESTIONS`).
   Decision: allow a free-binomial override behind a confirm (any value passing `isValidSpecies` is
   already accepted — so really this is "should non-suggested binomials need an extra confirm?").
3. **`power_in_W` — warn vs block (#3).** Recommendation: warn-to-confirm (a value > 1 W is *almost
   always* a mW/W confusion, but not provably so). Decide the threshold (the data says implant fibers are
   single-digit-to-tens of mW, i.e. < 0.1 W; the example template used 0.077 W) and whether to block or
   confirm.
4. **Rig-constant representation: `0.195` (app) vs `1.95e-7` (corpus invariant).** The app seeds
   `raw_data_to_volts: 0.195`; the corpus invariant is `1.95e-7`. These differ by 1e6 (µV vs V scaling) —
   **verify which the converter expects** before adding any equality-to-invariant check, or a "derive"
   guard could lock in the wrong scale. (Flagged, not assumed — confirm against trodes_to_nwb.)
5. **The load-bearing falsifier (synthesis open-Q #1).** Does `volume_in_ul: 450` / `power_in_W: 200`
   land *verbatim* in the NWB? If the converter reads only `volume_in_uL` and the per-epoch
   `fs_gui.power_in_mW`, #2/#3 downgrade from "corrupt NWB" to "corrupt-but-unused metadata" — which
   changes #3 from P0 to P2. **Verify by reading one denisse opto file's NWB** before sinking L-effort
   into either. The guards are still worth building (the YAML field is wrong either way), but the
   priority depends on this read.

---

*Feeds the build queue. Source-verification refs are inline in §2; the substrate to preserve is
[../existing-app-invariants.md](../existing-app-invariants.md). The single most valuable next research
step before building is open-decision #5 (read the NWB) — it sets the P0/P2 line for #3.*
