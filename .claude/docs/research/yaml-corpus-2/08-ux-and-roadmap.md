# UX best practices for this data class + improvement roadmap (capstone)

Synthesizes the whole study ([03-synthesis](03-synthesis.md) catalogue, downstream verification
[05](05-downstream-trodes-nwb.md)/[06](06-spyglass-constraints.md), and the [07 app audit](07-current-app-audit.md))
into (1) the design principles this kind of data demands and (2) a prioritized, gap-aware build list.
Priorities here use **downstream-verified** severity (what actually happens in the NWB/Spyglass), not the
raw YAML appearance — see the P5 corrections in [02-research-log](02-research-log.md).

---

## Part 1 — UX best practices for silent-consequence scientific metadata

The defining property of this data: **errors are silent, expensive, and late.** A wrong value converts
without complaint, sits in a multi-hour NWB build, lands in a public archive (DANDI) and a shared
database (Spyglass), and is noticed weeks later — if ever. That single fact dictates the design:

1. **The app is the gate.** trodes_to_nwb's schema check only *logs*; NWB Inspector doesn't fail the
   build; Spyglass logs ingestion errors and continues. So validation deferred downstream is validation
   that never happens. Every silent-corruption class must be caught **here** — validate at entry, and
   **hard-gate at export** for the classes that corrupt silently.
2. **Derive, don't ask.** Anything constant or computable should never be a typeable field. ~80% of each
   YAML is animal-static boilerplate; three constants (`raw_data_to_volts`, `times_period_multiplier`,
   `institution`) are identical across ~all files. Deriving them eliminated whole error classes at once
   (the `1.5cd` string typo, the `volume_in_uL/ul` pair, the empty `default_header_file_path`). *If a
   field can drift, it will — so don't let it be a field.*
3. **Recognition over recall + controlled vocabularies** for every fragmentation field. Free text
   fragmented one concept into many: `location` had 50 spellings (`hippocampus` 33,992 vs `Hippocampus`
   5,558 vs `hippcoampus` 103), species/sex/genotype each split several ways. Spyglass's `BrainRegion`
   keys *case-sensitively* with no normalization — every spelling is a new row that fragments spatial
   queries. Pick-or-confirm from visible options, canonical casing, autocomplete seeded from prior use.
   Reserve free text for genuinely open domains (task names, custom DIO labels).
4. **Match the data's tier structure: enter-once + lock + carry-forward.** Facts live at a natural
   scope — *dataset* (lab/institution), *animal* (subject identity, implant/probes), *day* (weight,
   tasks, files, bad channels, DIO). Enter each at its scope, lock the static tiers, and **carry the
   day-owned delta forward** from the prior same-config day. This makes the daily job a one-minute
   *confirm-the-delta*, not a re-author of a 1,200-line file — and makes copy-forward drift (the 13
   self-contradicting animals) structurally impossible.
5. **Surface the consequence, not just "invalid".** The strongest error messages name the downstream
   failure ("this creates a second `CA1` brain region in Spyglass" / "trodes_to_nwb will throw
   FileNotFoundError on this probe"). Scientists act on *why it matters*, not on a schema path.
6. **Calibrate the response: gate / warn-to-confirm / nudge.** Hard-gate silent corruption + hard-fail
   (space keys, unresolvable probe, dangling camera_id, out-of-range bad channel). **Warn-to-confirm**
   plausible-but-suspicious values where the user might be right (`power_in_W` ≫ 1, a genuine non-
   *norvegicus* species, un-marking a previously-bad channel). **Nudge** cosmetic/likely-typo
   (genotype-looks-like-strain, location edit-distance, placeholder IDs). Over-gating trains users to
   bypass; under-gating ships corruption.
7. **Import-repair is first-class.** Users carry 9 years of legacy files; they *will* import them.
   Normalize on import with a **visible diff + recovered-count**, never silently: spaced keys →
   underscores ("recovered 32 electrodes"), `Rat`→`Rattus norvegicus`, `Male`→`M`, `MMDDYYYY`→`YYYYMMDD`,
   strain-in-genotype → strain field. The legacy corpus IS the test set for this flow.
8. **Cross-file / same-animal consistency as a check, surfaced for a human.** When the same animal's
   static facts disagree across days/copies, show the divergence as a pick — don't silently let
   latest-write-win (which is exactly what Spyglass's `validate1_duplicate` does downstream).
9. **Personalize.** Each experimenter is 78–94% internally consistent in their conventions; experimenter
   is the natural axis for default templates and autocomplete history. Seed a new animal from that
   person's prior animals.
10. **Be honest about provenance.** Show what's derived, what's carried-forward, and what differs from
    the `.rec` header (the app's "differ status" for gain is good practice). Trust comes from
    transparency, not hidden autofix.

**Anti-patterns the data explicitly warns against** (don't over-engineer): no fixed DIO template (67
distinct name-sets; `Din1` carried 21 names — a preset is wrong ~80% of the time); don't gate
behavior-only days on electrode setup; don't flag `n_electrode_groups ≠ n_ntrode` (correct multi-shank
expansion); don't nag the all-4-bad disabled tetrodes or empty-opto scaffolding; don't auto-rewrite a
plausible alternate gain (`2.95e-7`) — confirm it; scope the empty-`location` gate to *active* groups
(1,272 deliberately-unused rows must not be nagged).

## Part 2 — Where the app stands

**Strong, and structurally so.** The app already implements the hardest principles: animal-static
enter-once-and-lock (kills the #1 class), carry-forward day model, a thorough export gate (~21 business
rules, each citing a named downstream failure), full channel-map validation against the verified
12-probe catalog (bounds/coverage/multishank/dangling-ref), monotonic day-owned bad channels with
ack-to-unmark, and the DIO design done right (stems + autocomplete + auto-number + carry-forward, no
preset). Most high-frequency corpus errors **cannot be authored** in the current app — the legacy files
are largely a museum of problems it already prevents.

The residue is a short list of gaps, dominated by one true P0 and a set of import-side and soft-warn
items.

## Part 3 — Roadmap (priority = downstream severity × frequency ÷ effort)

### Tier 0a — current bugs that block real-file import (found by the empirical round-trip, [10])
The app imports only **16.7%** of real legacy files cleanly; **69%** hit a blocker the Import & Repair
screen can't fix. Robustness is otherwise solid (0 crashes, 0 silent loss on accepted files) — these are
specific, fixable defects, not a rewrite.
- **Fix the `task_epochs` list-vs-scalar bug** *(BUG; S–M; unblocks ~63% of the corpus).*
  `referenceRules.ts:200-228` compares an array `[2]` to scalar epochs (`Set.has([2])` → always false) →
  false-positive `orphaned_file` on 1,051 files (380 have no other blocker); the schema also declares
  scalar `integer` so the same list trips a `type` error. Fix the comparison **and** settle the canonical
  typing (see the cross-cutting fix below).
- **Parse `YYYYMMDD_<subject>.yml` filenames + offer a date input** *(M; unblocks 215).* `extractRecordingDate`
  only reads the *template's* `mmddYYYY_..._metadata.yml` form, so real-world files have "no recording
  date" with nothing to fix. (A test-data-vs-real-data gap.)
- **Make `times_period_multiplier`/`session_id` coercions repairable, not blocking** *(S)*, and give the
  multi-error legacy files (`unknown_device_type`, multishank, space-keys) an in-app repair path rather
  than a dead end *(M)*.

### THE cross-cutting fix — unify epoch typing (highest leverage in the whole study; [10]/[11]/[12])
One axis — `task_epochs` **value** (scalar vs list) and **key** (`task_epoch` singular vs `task_epochs`
plural) — drives the app's #1 import bug, an 821-file hard `KeyError` on current trodes_to_nwb
(`convert_yaml.py:71` subscripts `["task_epochs"]`; singular-only video files die), AND a 1,055-file
silent Spyglass `StateScriptFile` drop (list `[4]` → NWB `"[4], "` → `split(",")` match fails). **Fix:**
read *both* keys and *both* value types on import; emit **one** convention on export — `associated_files`
epoch value as **scalar** (matches schema + Spyglass), video epoch **key** as plural `task_epochs`.
Pin the exact canonical forms against trodes_to_nwb source during implementation. *(M; retires D8+D6 +
the import bug + the statescript silent-drop at once.)*

### Tier 0 — the one unaddressed silent corruption
- **`power_in_W` range guard** *(NO today; M)*. Confirmed silent: `power_in_W: 200` lands as 200 W in
  the archived NWB (`convert_optogenetics.py:131`, no range check), ~10,000× off, in 70/71 real opto
  blocks. Add a warn-to-confirm in `optoRules` when `power_in_W > ~1` ("≈10,000× typical mW — confirm
  Watts"), and fix the misleading placeholder. Opto is one group (Denisse), but it's published data.

### Tier 1 — import-repair for the 9-year legacy corpus (high value; users will import)
- **Space-key normalize on import** *(PARTIAL; M)*. Detect spaced top-level keys pre-parse; one-click
  rewrite to underscores; report "recovered N electrodes." (36 files; loud KeyError downstream now, but
  the files exist and users re-import.)
- **Vocabulary repair on import** *(PARTIAL; M)*. `Rat`→`Rattus norvegicus`, `Male`→`M`,
  `MMDDYYYY`→`YYYYMMDD` filename, strain-in-genotype → strain — all with a visible diff. Closes the
  DANDI-reject classes (species 53%, sex 52%) for imported files in one flow.
- **Same-animal divergence as a human pick** *(PARTIAL; M)*. The app already *detects* `divergences` but
  resolves latest-date-wins, unshown. Render them on import as a pick (the only way to resolve an
  interleaved DOB conflict like Seth, or the CH105 WT-vs-Scn2a case/control mislabel).

### Tier 1.5 — cameras & video (newly surfaced; silent position-calibration corruption)
See [09-cameras-video-downstream.md](09-cameras-video-downstream.md) + [09-cameras-video-corpus.md](09-cameras-video-corpus.md).
Spyglass `CameraDevice` is keyed on **`camera_name` alone, in a global lab-wide namespace** — so the
camera's px→cm calibration (`meters_per_pixel`) is bound to the *name*, not to the session. The app
guards camera *id* (uniqueness, dangling ref, orphaned epoch) but **nothing guards the name or
calibration** — the actual high-severity case.
- **Camera-name calibration aliasing** *(NO today; M).* Same `camera_name` with a *different*
  `meters_per_pixel` (a re-zoom/reposition) → on Spyglass ingest either a `DuplicateError` (hard fail)
  or **first-write-wins, new calibration silently discarded** → wrong position/velocity downstream.
  Seen in the wild: 24 names map to ≥2 calibrations, **15 vary within one animal across days**. Guard:
  an **animal-level camera catalog**; when a day reuses a catalog name but the calibration differs,
  warn-to-confirm *"re-zoomed? give this camera a distinct name"* (the lab's own convention is a new
  name per setup — the app should make that the easy path).
- **Require `meters_per_pixel > 0`** *(NO; S)* — 16 rows have `0` (silent position-conversion break);
  nudge on implausible magnitudes (the corpus spans 0.0014–0.20).
- **Cross-rig name-collision awareness** *(NO; S)* — because the namespace is global, a generic
  `camera 1`/`sleep_camera` reused across animals merges into one CameraDevice. Reference cameras by
  **dropdown from the animal catalog**, auto-assign ids, reject placeholder names (`1`/`camera`/`XXX`,
  19.3% of files), and nudge toward qualified names.
- **Video→epoch linkage** *(PARTIAL; S)* — dangling video `camera_id` is a **hard convert KeyError**
  (gate it); a video epoch with no matching TaskEpoch is **silently dropped** (warn). Note: 177 files
  (mostly one experimenter) attach videos with **no epoch key at all** — confirm whether that's a real
  workflow before gating it (anti-pattern risk).

### Tier 2 — Spyglass/DANDI integrity hardening (cheap, high-leverage)
- **Location controlled-vocab + case-lock — finish it** *(PARTIAL; S)*. Datalist + case-snap exist; add
  an edit-distance nudge (catches `hippcoampus`) and **scope the empty-location gate to active groups**
  (also fixes a real over-flag bug that would nag 1,272 disabled tetrodes on import). This is the #1
  Spyglass DB win.
- **Experimenter name-shape rule** *(PARTIAL/unverified; S–M)*. Spyglass `decompose_name` *raises*
  unless `First Last` or `Last, First` (`common_lab.py:386-405`) → 3-token/middle-initial names lose
  experimenter linkage. Add a format rule/normalizer.
- **Widen the device_type catalog to the full 12** *(S)*. The app/CLAUDE.md catalog is missing 4 of the
  128-ch probe variants that trodes_to_nwb actually supports (verified against
  `device_metadata/probe_metadata/`). Missing entries force users into typos → FileNotFoundError.

### Tier 3 — soft nudges (S each)
- Genotype-looks-like-strain warning; placeholder-id (`12345`/`54321`) warning;
  `raw_data_to_volts` hand-change → prompt-don't-autofix on a plausible alternate gain.

### Tech debt noted (not user-facing)
- Opto-completeness predicate is defined twice (`optoRules` vs inline in `referenceRules.ts:275-280`) —
  consolidate to avoid drift.

### Shared-mechanism grouping (build efficiently)
- **One "numeric-or-derive + range" pass** covers `power_in_W`, the constants, and any future numeric
  field — same validator shape.
- **One import-repair pipeline** covers space-keys + vocab + date + divergence-pick — same surface, same
  diff/recovered-count UX.
- **One "controlled-vocab field" component** (datalist + canonical-case + edit-distance nudge + prior-use
  history) covers location, genotype, species, task-name, brain region.

## Open product decisions (need a human)
- **`screw` / `single_electrode`** (66 files / 17 animals, mcoulter+sunrae) is a *real hardware class*
  the app can't express and trodes_to_nwb can't resolve. Add a first-class non-probe electrode path
  (needs pipeline coordination) vs. document as unsupported.
- **Species**: hard-block non-binomial vs warn-to-confirm (must allow a genuine non-*norvegicus*).
- Whether to verify the app's export always emits all four ndx electrode columns
  (`probe_shank/probe_electrode/bad_channel/ref_elect_id`) — Spyglass drops the whole file's
  bad-channel + probe linkage if any is missing (`common_ephys.py:157-181`).
