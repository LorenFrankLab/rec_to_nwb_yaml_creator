# YAML corpus-2 — current-app audit (the build-state ground truth)

**Date:** 2026-06-17 · **Branch:** `modern` (HEAD `b863272d`, Phase 8 redesign complete — past the
Jun-13 architecture-assessment, which is stale on specifics). **Method:** read the live source in
`src/` (state / validation / domain / pages / io). Every claim is file:line-cited; "PARTIAL" / "NO"
are reported honestly. Companion to [03-synthesis.md](./03-synthesis.md) (error catalogue),
[04-design-implications.md](./04-design-implications.md) (guard table — this audit *re-verifies* its
"already?" column), and the P5 downstream re-prioritization in [02-research-log.md](./02-research-log.md).

> **Headline:** the app already structurally prevents the large majority of the corpus error classes
> — the validation layer is unusually thorough (~21 business rules + AJV schema, all export-gating).
> The one genuine **silent-corruption gap is `power_in_W` (#3)**: a plain number input
> (`OptogeneticsStep.tsx:56`), default `0.077` (`defaults.ts:161`), **no range guard anywhere**
> (`optoRules.ts` has none). The next tier is import-side: **no explicit space-key repair** (#1/#16),
> and **same-animal divergence is resolved latest-date-wins, never surfaced for a human pick** on the
> Import screen (#7). Everything else in the top-15 is YES or a cheap warning.

---

## 1. Architecture in brief (current, cited)

**Data model — three tiers, enforced by where state lives:**

- **Animal-static (entered once, locked, derived into every day).** Subject identity + experimenters +
  device configuration live on the `Animal` record. `applyAnimalUpdates` deep-merges subject/devices
  and **mirrors device edits into the latest configuration snapshot** (`workspaceTransitions.ts:145`,
  `:60-71` `AnimalUpdates`). A day never re-stores species/sex/genotype; `createDayRecord` reads them
  off the animal at export-merge time. *Cross-day drift of these is structurally impossible for
  app-authored data — the corpus's #1 structural failure is designed out.*
- **Day-owned, carried-forward from the prior same-config day.** `createDayRecord(..., carryFrom)`
  seeds tasks/taskInstances, behavioral_events, keywords, technical, weight, and **bad_channels** from
  the previous day (`workspaceTransitions.ts:412-525`). Bad-channel carry is **version-guarded**: it
  only carries when `carryFrom.configurationVersion === latestVersion` (`:476-478`) — a reconfig
  resets marks, never compares across versions (matches synthesis §5 Axis-3).
- **Recording-system catalog + per-day ref.** Rig constants (`raw_data_to_volts`,
  `times_period_multiplier`) are seeded at day creation from `technicalDefaults` and **copied** onto the
  day; `resolveRigConstant` reports `default | differs | unset` honestly rather than silently relabeling
  (`rigConstants.ts:40-51`).

**Entry flow:** `CreateAnimalWizard` (identity + subject) → Animal Setup tabs (electrode groups,
recording system, cameras, task types, optogenetics — the static tier) → per-day Day Editor (Day /
Epochs / Failed-channels / DIO tabs) → Export Preview (per-day gate) / ValidationSummary (batch). Import
is a separate `ImportRepair` screen that turns the validator's findings into per-field repair items.

**Export:** `validateDay` composes raw-shape + AJV schema + ~21 business rules + override/monotonicity
checks; `ExportPreview` blocks download on any `error`-severity issue and routes each to its repair
surface; a post-gate **shadow-export parity check** (`shadowExport.ts`) guards encoder stability.
Filename is **derived** (`fileNaming.ts` / `io/yaml.ts`), never typed.

**Persistence:** `{schemaVersion, workspace}` to localStorage; an **ordered forward-migrator registry**
upgrades old blobs (`workspaceMigrations.ts:51-113`), with `recovered` / `discarded` notice paths
(`persistence.ts:88-133`). *(The stale architecture-assessment listed this as an open "discards on
mismatch" gap — it is now built.)*

**Schema:** `device_type` enum = **exactly the 12 trodes_to_nwb probes** (`nwb_schema.json`
`electrode_groups.items.device_type.enum`); subject `required` includes `date_of_birth`, `weight`
(`type:number, minimum:0`), `sex` (`enum: M/F/U/O`); root requires `times_period_multiplier` /
`raw_data_to_volts` (both `type:number`). *(The CLAUDE.md "catalog missing 4 of the 128-ch variants"
concern is already resolved in the schema enum.)*

---

## 2. Capability matrix vs the corrected top error classes (P5 priorities)

| # | Error class | Prevented? | Where (file:line) | Mechanism / gap |
|--:|---|:--:|---|---|
| **3** | **`power_in_W: 200`** (~10,000×, P5-confirmed P0) | **NO** | input `OptogeneticsStep.tsx:56`; default `defaults.ts:161` (`0.077`); `optoRules.ts` (no range rule) | Plain `type:number` input, no min/max, no warn, no confirm. The **one unaddressed silent-corruption class.** Power lands verbatim in the NWB `ExcitationSource.power_in_W`. |
| **2** | **Volume 1000× (`uL 0.45`/`ul 450`)** | **YES** (downgraded harmless by P5) | export emits both keys from one input (`workspaceUtils.ts` `emitVirusInjections` / `OPTO…ORDER`); import reconciles `importRepair.ts:369-401`, `:430-432` | Editor stores `volume_in_uL` only; import flags a `uL≠ul` conflict for confirm. Converter reads `uL` anyway. |
| **17** | **Out-of-range `bad_channel`** | **YES** | `channelMapRules.ts:220-239` (`bad_channel_out_of_range`, day-routed) | Range-checked against probe channel count; export-gated. |
| **19** | **bad_channels on later shank dropped** | **YES** | `channelMapRules.ts:349-388` (`multishank_bad_channels_ignored`) + first-row consolidation | Gate + the Failed-Channels grid writes probe-local indices to the first row. |
| **15** | **camera_id dangling ref** | **YES** | `referenceRules.ts:74-132` (tasks + scalar video) ; FsGUI `:298-314` | Ref-check + export gate; editor uses controlled camera pickers. |
| **1/16** | **Space-separated top-level keys** (electrode loss / missing `subject_id`) | **PARTIAL** | encoder owns underscored keys (`workspaceUtils.ts` emit order); import: `importRepair.ts:292-318` makes missing `subject_id` a fix-in-file blocker; **no `electrode groups`→`electrode_groups` key-normalize** (none in `yamlImport.ts` / `io/yaml.ts:73` raw `YAML.parse`) | New output can't recur. **Gap: a legacy spaced file imports as zero electrodes with no one-click repair / electrode-count recovery.** (P5: now a *loud* KeyError downstream, not silent — but the 36 files still import wrong here.) |
| **7** | **Same-animal DOB/genotype/species drift** | **PARTIAL** | lock prevents *new* drift (`workspaceTransitions.ts:145`); import detects it (`yamlImportPlan.ts:25,309-320` via `identityDivergence.ts`) | **Gap: import resolves latest-date-wins and records a `divergence`, but the Import screen does NOT surface it as a human pick** (the prompt the design calls for). Interleaved DOBs (Seth) silently take the latest. |
| **5** | **species non-binomial (`Rat`)** | **YES** | gate `dandiSubjectRules.ts:27-37` (`isValidSpecies` `dandiSubject.ts:32`); wizard dropdown `CreateAnimalWizard.tsx:484-537`; import `SPECIES_SUGGESTIONS importRepair.ts:44-59` | Binomial/NCBI-URI regex; dropdown + "Other (binomial)" ; import suggests `Rat→Rattus norvegicus`. |
| **6** | **sex non-single-letter (`Male`)** | **YES** | schema enum `M/F/U/O`; wizard dropdown `CreateAnimalWizard.tsx:502-513` (M/F/U); import `SEX_SUGGESTIONS importRepair.ts:62-73`, gate `:249` | Dropdown + enum gate + import map. (Wizard omits `O`, in schema — minor.) |
| **8** | **DOB missing** | **YES** | schema `subject.required` includes `date_of_birth`; wizard date input `CreateAnimalWizard.tsx:582-597` (`max=today`) | Required field; export blocks if absent. |
| **9** | **weight string-with-unit (`"541g"`)** | **YES** | schema `weight type:number,minimum:0`; import parse `importRepair.ts:259-267`, gate `:260` | Numeric input; import parses `"541g"→541`. |
| **10** | **NULL `location` on ACTIVE group** | **YES** (active-scoped in spirit) | `electrodeGroupRules.ts:110-179` (`empty_location` / `empty_targeted_location`) | Both required + export-gated. **Note:** flags *any* empty location, not strictly ≥1-good-channel-scoped — verify it doesn't nag the 1,272 disabled-tetrode rows on import (anti-rec §5). |
| **11** | **location fragmentation (`CA1`/`ca1`/typo)** | **PARTIAL** | datalist `BrainRegionAutocomplete.tsx` (16 canonical) + case-snap on blur `:110-116`; cross-group case warning `electrodeGroupRules.ts:149-175` | Datalist + canonical-case snap + mixed-case warning. **Gap: no "one edit away from a known region" typo nudge** (`hippcoampus`). |
| **12** | **strain in genotype (`Long-Evans Rat`)** | **NO** | genotype free-text `CreateAnimalWizard.tsx:541-558` (hint only) | Informal placeholder hint; **no warning rule.** |
| **13** | **`times_period_multiplier: "1.5cd"`** | **YES** (P5-downgraded) | derived/seeded (`rigConstants.ts`, day copy); AJV `type:number` rejects non-numeric | Value is derived not free-typed; schema gate rejects a string. (No separate "numeric-or-derive" export assertion, but AJV covers it.) |
| **20** | **`raw_data_to_volts` placeholder / alt gain** | **PARTIAL** | seeded + `differs`/`unset` status `rigConstants.ts:40-51`; read-only in day `DayTechnicalSection.tsx:95-99` | Derived + honest differ-status. **Gap: no explicit "are you sure?" confirm** on a hand-changed plausible alt value (`2.95e-7`). |
| **4** | **Unresolvable `device_type`** | **YES** (12-probe set) / **NO** (`screw`/`single_electrode`) | enum (`nwb_schema.json`) + `electrodeGroupRules.ts:187-255` (`unknown_device_type` + `inconsistent_probe_catalog`); dropdown `ElectrodeGroupModal.tsx:190-211` | Dropdown of 12; unknown blocks. **`screw`/`single_electrode` is an unexpressible hardware gap (open product decision).** |
| **14** | **`task_epoch`/`task_epochs` split + scalar/list** | **YES** | encoder canonicalizes; import rename `importRepair.ts:353-367`, `:411-419`; epoch ref-integrity `referenceRules.ts:141-232` | Single canonical key+shape on export; `task_epoch→task_epochs` is a listed benign normalization. |
| **18** | **Unparseable YAML** | **YES** | `io/yaml.ts:73` `YAML.parse` throws (loud) | Parser error surfaced; cheapest class. |
| **23** | **Orphan ntrode `electrode_group_id`** | **YES** | `channelMapRules.ts:311-340` (`dangling_electrode_group_ref`) | Ref-check + export gate. |
| **24** | **MMDDYYYY filename** | **YES** | `fileNaming.ts` / `io/yaml.ts` derive canonical name | Filename generated, can't recur for app output. |
| **25** | **Placeholder `subject_id` (`12345`)** | **NO** | wizard free-text `CreateAnimalWizard.tsx:459-480` (uniqueness + no-slash only) | **No placeholder-id warning.** |
| — | **camera id / ntrode id / electrode-group id uniqueness** | **YES** | `referenceRules.ts:365-394`, `channelMapRules.ts:105-132`, `electrodeGroupRules.ts:22-50` | All export-gated. |
| 16 (Spyglass) | **identity divergence (camera/data-acq/task reuse)** | **YES** | `identityRules.ts:18-73`; editor-time dialogs (`CameraModal`, `DataAcqSection`, `TaskTypeModal`) | Same-name-different-metadata gated + proactive editor dialogs (Spyglass `decompose_name`/identity). |
| — | **experimenter name-shape (Spyglass `decompose_name`)** | **PARTIAL/unverified** | not found as a dedicated rule | P5 NEW constraint (`First Last`/`Last, First` only). **No rule located — verify and likely add.** |
| — | **opto all-or-nothing + single source + refs** | **YES** | `optoRules.ts:20-104` | Partial config / multi-source / missing reference all blocked. |
| — | **FsGUI requires complete opto + valid dio/camera/epoch** | **YES** | `referenceRules.ts:242-356` | Strong: catches the stale-fs_gui-after-opto-off case. |

---

## 3. What the app does WELL (real, structural)

1. **Animal-static lock kills the corpus's #1 structural failure.** Species/sex/genotype/DOB are entered
   once and derived; `applyAnimalUpdates` mirrors device edits into the config snapshot
   (`workspaceTransitions.ts:145`). The 13 self-contradicting animals (synthesis #7) cannot be authored.
2. **A genuinely thorough export gate.** ~21 business rules (`rulesValidation.ts:74-96`), each tied to a
   *named downstream failure* with a citation, all `severity:'error'` and routed to a repair surface.
   This is the corpus's central thesis ("the app is the gate, downstream is silent") implemented well.
3. **Channel-map correctness against the verified probe catalog.** Bounds, per-shank key counts,
   per-group coverage (every electrode id exactly once), row-count = shank-count, dangling-group refs,
   multishank bad-channel consolidation — all enforced (`channelMapRules.ts:146-388`). It correctly does
   **not** flag `n_eg≠n_ntrode` (anti-rec respected).
4. **Bad channels are day-owned, version-guarded, and monotonic.** Carry-forward only within a config
   version (`workspaceTransitions.ts:476`); un-marking a prior-bad channel needs an in-context ack
   (`badChannelMonotonicity.ts`, Failed-Channels tab); unacknowledged regression blocks export. Exported
   YAML shape unchanged.
5. **Import is corruption-preserving and single-importer.** Every suggested fix is gated by the predicate
   that flagged it; unmappable values surface as user-input rows, never laundered (`importRepair.ts:1-20`
   header contract); the screen calls the *same* `validate()` as the export gate — no second validator.
6. **DIO done right per the data.** No preset template; carry-forward summary ("carried from <date> ·
   unchanged", `DioTab.tsx:51-52`) + direction-aware autocomplete + auto-numbering + duplicate
   name/description gates — exactly the "stems + autocomplete + carry-forward, never a preset"
   recommendation (anti-rec §5).
7. **Derived invariants:** filename, both volume keys, canonical epoch key/shape, rig constants — all
   generated, not free-typed.

---

## 4. What's MISSING / weak (each with smallest fix + effort)

| Gap | Class | Smallest fix | Effort |
|---|---|---|---|
| **No `power_in_W` range guard** | #3 (P0) | Add a rule in `optoRules.ts`: warn-to-confirm when `power_in_W > 1` (implant fibers are < 0.1 W; message names mW/W confusion + `fs_gui.power_in_mW`). Mirror as an inline warn on `OptogeneticsStep.tsx:56`. | **M** |
| **No space-key import repair** | #1/#16 | Detect `electrode groups:` / `ntrode electrode group channel map:` / `subject id:` in the raw text before parse; offer one-click normalize reporting **N electrodes / subject_id recovered**. | **M** |
| **Same-animal divergence not surfaced on Import** | #7 | The data exists (`yamlImportPlan` `divergences`); render it on `ImportRepair` as a human pick instead of latest-date-wins. | **M** |
| **No experimenter name-shape enforcement** | Spyglass NEW | Add a rule/normalizer requiring `First Last` or `Last, First` (Spyglass `decompose_name` raises otherwise). Verify none exists first. | **S–M** |
| **No genotype-vs-strain warning** | #12 | Soft warn when genotype matches a strain token (`Long-Evans`, `Sprague-Dawley`) → suggest moving to description. Don't block. | **S** |
| **No placeholder-id warning** | #25 | Soft warn in `CreateAnimalWizard` / import when `subject_id ∈ {12345, 54321}`. | **S** |
| **No typo-distance location nudge** | #11 | Edit-distance warn when a typed region is one edit from a canonical region (`hippcoampus`→`hippocampus`). | **S** |
| **No raw_data_to_volts hand-change confirm** | #20 | On a value differing from default that is a plausible alt-gain, prompt-don't-autofix (synthesis open-Q #6). | **S** |
| **No `units` controlled vocab / `"'unspecified'"` import-normalize** | #21 | Dropdown for analog/behavioral units; normalize double-quoted value on import. Low value. | **S** |
| **No `data_acq_device.system` vocab / task-name casing canonicalize** | #22 | Short pick-list for system; canonicalize task-name casing. Lowest value. | **S** |
| **`screw` / `single_electrode` hardware** | #4 (gap) | Product decision: add first-class device type (needs trodes_to_nwb probe-metadata) or keep blocking. | **L** + pipeline coord |

---

## 5. UX friction in the current flow (grounded in the page components)

- **Mixed ownership on the Day tab is the sharpest footgun.** Editing `subject.species` /
  `date_of_birth` from the "inherited subject metadata" disclosure writes the **animal** record and
  silently changes **all days** (`DayTab.tsx:400-433,454`) — the label says "Updates all days" but
  there's no confirm. Recognition-over-recall + destructive-action-confirm both apply.
- **Free-text paths with no completion/validation:** data-folder (`DayTab.tsx:213-228`) and manual
  statescript/video names (`EpochsTab.tsx:756-771,794-801`). Typo-prone; no existence check.
- **`power_in_W` unit ambiguity is a UX trap, not just a missing guard** — labeled "Source power (W)"
  with placeholder "e.g. 10" (`OptogeneticsStep.tsx:56`), which actively invites the 10,000× error the
  corpus documents (laser-model "200" → W). The placeholder should be sub-1-W and the help should name mW.
- **Carry-forward is all-or-nothing for DIO/epochs.** To rewire one DIO channel the user declares
  "rewired the rig" and re-enters the grid; no per-channel diff (`DioTab.tsx`). Tolerable (DIO rarely
  changes) but a friction point for the real board-rewire case (Senor split).
- **Epoch renumbering remaps refs silently** (`EpochsTab.tsx:193-210`) — no diff/confirm; correct but
  opaque.
- **Device-type dropdown assumes the user knows probe IDs** (`ElectrodeGroupModal.tsx:190-211`) — no
  inline description of geometry/channel count. Recall-heavy for a 12-item catalog.
- **Export parity check runs *after* the gate** (`ExportPreview.tsx` post-gate `shadowExport`) — in
  strict mode a mismatch blocks the download *after* the user clicked, with a confusing message.
- **Wizard omits sex `O`** (`CreateAnimalWizard.tsx:502-513`) though the schema allows it — minor recall gap.

**Done well (recognition-over-recall):** brain-region autocomplete + case-snap; camera/data-acq
identity-divergence side-by-side tables with "use a new name"; controlled epoch/camera/recording-system
pickers in associated files/videos; honest 3-state setup cards (no false-green while nav is red).

---

## 6. Tech-debt / correctness risks noted (not fixed)

- **`electrodeGroupLocations` (#10) flags *every* empty location, not strictly active-group-scoped.** On
  import of legacy files this risks nagging the 1,272 intentional disabled-tetrode NULL rows (anti-rec
  §5). Verify it's only reached for active groups, or scope it.
- **`badChannelRemovalAcks` is off-export** (Failed-Channels tab) — the deliberateness of an un-mark is a
  UI artifact, absent from the downloaded YAML. Intentional per the model, but no audit trail in the file.
- **Two `optoComplete` definitions.** `optoRules.ts` uses the shared `optoFieldsPresence` predicate, but
  `referenceRules.ts:275-280` (FsGUI) re-derives opto-completeness inline. These can drift; consolidate
  on the shared predicate.
- **Stale architecture-assessment doc.** `.claude/docs/research/architecture-assessment.md` (Jun-10) is
  now wrong on the persistence-migration gap (built) and the TS-migration state (entire live app is now
  TS). Mark it superseded.
- **`O` in sex enum but not the wizard** — minor inconsistency between schema and entry UI.
- **No detected experimenter-name-shape guard** despite the P5 Spyglass `decompose_name` finding — likely
  a real missing rule (verify).

---

*Feeds the UX/improvement roadmap. The single highest-value build item remains the `power_in_W` range
guard (#3, the only unaddressed P0); the next two are import-side (space-key repair #1, divergence
surfacing #7). Everything else is a cheap warning or an open product decision.*
