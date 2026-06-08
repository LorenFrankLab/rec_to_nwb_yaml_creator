# Scope-tiers IA — design note (captured, NOT scheduled)

**Status:** Discussion captured for later. **No implementation.** Written 2026-06-08 after the
recording-system catalog work, prompted by the user's observations about channel maps, tasks, and
cameras/DIO/opto scope. Revisit before committing to any of this — especially the dataset-level tier,
which is a large architectural change.

## The core idea: one question, not four

The user raised four things; they're all the same question — **what scope does each concern live at?**
There's a clean three-tier model:

| Tier | What belongs | Cadence |
| --- | --- | --- |
| **Dataset** (spans animals) | shared *hardware*: recording systems, cameras, DIO event types, opto hardware | set up once per rig |
| **Animal** (the implant/subject) | subject facts; electrode groups + geometry + channel **mapping** (versioned) | per surgery |
| **Day** (the session) | which systems/cameras/tasks were used, **bad channels**, epoch order, files, weight | every recording |

Guiding heuristic: **identity that is global in Spyglass wants to live at the dataset tier**; things
tied to one surgery live at the animal tier; things that vary session-to-session live at the day tier.

## Thread 1 — Channel maps conflate two tiers (mapping vs bad channels)

**Current state (verified):** `bad_channels` are editable in TWO places —
- Animal: [ChannelMapEditor.jsx](../../../../src/pages/AnimalEditor/ChannelMapEditor.jsx) edits
  `bad_channels` on each group's FIRST ntrode row (animal-level base, versioned with the config).
- Day: [DevicesStep.jsx](../../../../src/pages/DayEditor/DevicesStep.jsx) "Setup & Failed Channels"
  writes `day.deviceOverrides.bad_channels.<ntrodeId>`; `mergeDayMetadata` applies the day override
  onto the resolved ntrode map.

**The awkwardness:** the *mapping/reorganization* (which probe channel → which hardware channel) is
animal-level + rare + versioned; *bad-channel marking* is day-level + frequent (channels fail over the
experiment). The Channel Maps tab mixes both, and bad channels have two homes.

**Recommendation:** make bad-channel marking **day-only**. Animal Channel Maps tab = wiring/mapping
only. **Open question:** is there a real "dead-from-implant baseline" worth keeping at the animal
level, or is *all* bad-channel marking per-day? Lean day-only.

**Blast radius:** touches the **export merge** (the animal base `bad_channels` currently feed the
resolved map before day overrides). Removing the animal base changes the merge → **golden baselines
must be re-checked byte-for-byte**; existing data with animal-level bad_channels needs a migration
story (promote to day overrides, or treat as baseline). NOT a pure-UI change.

## Thread 2 — Tasks → a task-TYPE catalog + per-day ordering

**Current state:** tasks are day-only (`getDayTasks(day)` → `tasks[]` with `task_name`,
`task_description`, `task_epochs`). Every day re-enters task definitions.

**Recommendation:** promote task *types* (sleep, w-track, open-field, … each with description +
environment/camera) to a **catalog** (animal, possibly dataset), and have each day **select + order**
its epochs from that catalog — same shape as the cameras catalog (catalog + per-day usage/order).

**Bonus:** kills the Spyglass `tasks[].task_name` secondary-key divergence (same name + different
`task_description` → **raises** in `common_task.py`) by defining each task once.

**Blast radius:** medium. New catalog + per-day reference/order model + merge resolution. Baselines
preserved if an unreferenced/default day reproduces today's inline tasks.

## Thread 3 — Cameras / DIO / opto (and recording systems) span animals → dataset tier

**Current state:** stored per-animal, but they already carry **cross-animal divergence guards**
(`collectCameraIdentities` / `collectDataAcqIdentities` + `findIdentityDivergence`) precisely because
their identities are **global in Spyglass** (camera_name, data_acq name are primary keys). The guards
are evidence the data is mis-scoped: we store per-animal and then police consistency.

**Recommendation:** promote shared hardware to a **dataset/workspace-level catalog** that animals/days
reference. "Store once, reference everywhere" replaces "copy per animal + guard divergence" — no
divergence is even *possible*, single source of truth, matches the Spyglass reality.

**⚠️ Consistency flag (important):** the **recording-system catalog just built is ANIMAL-level**
([DataAcqSection.jsx](../../../../src/pages/AnimalEditor/DataAcqSection.jsx),
`animal.devices.data_acq_device`, day refs `day.data_acq_device_name`). By the user's own grouping,
recording systems are shared hardware like cameras → they belong at the SAME tier. **Decide the tier
before building more shared-hardware features**, or the recording-system work will need to move.

**Blast radius:** the **largest** — a new state tier in [useWorkspace.js](../../../../src/state/useWorkspace.js),
a reference model, **data migration** of existing per-animal cameras/DIO/opto/data-acq into the shared
catalog, and merge-resolution changes (merge inlines the referenced dataset entries per day). Deserves
a dedicated design pass (brainstorming skill) + meticulous baseline preservation. NOT an improvised build.

## Sequencing & risk (if/when pursued)

1. **Decide the shared-hardware tier** (animal vs dataset) — a prerequisite that affects everything,
   including where the just-built recording-system catalog belongs. Cheap to decide, expensive to get
   wrong. Do this first, as a written decision.
2. **Channel-maps split** (bad channels → day-only) — clarifies a real confusion; small surface but
   **touches the export merge**, so baseline-gated.
3. **Task-type catalog** — medium; reuses the cameras pattern.
4. **Dataset-level shared catalogs** — the big one; only after (1). Phased, with migration + baselines.

## Hard constraints any implementation must honor

- **125 golden baselines byte-identical** (`npx vitest run baselines`). The export YAML shape is the
  contract; trodes_to_nwb / DANDI / Spyglass depend on it.
- trodes_to_nwb: one acquisition device per session/YAML; `data_acq_device` `minItems:1`; cameras
  emitted filtered-by-day-usage; brain-region/`task_name` exact-string identities.
- Don't add exported keys that fixtures lack (e.g. internal ids) — would break baselines. Reference by
  the Spyglass identity field (`camera_name`, data-acq `name`, `task_name`).
- Migration: existing per-animal data must convert losslessly to whatever tier moves.

## Architecture & integration with the legacy app (verified 2026-06-08)

Two architectures coexist (confirmed by code audit):

- **LEGACY (feature-frozen):** `useLegacyForm` flat `formData`, route `#/`, **not persisted**,
  `exportAll(formData) → encodeYaml`, `importFile → setFormData` (the ONLY YAML import path).
- **WORKSPACE (active):** `useWorkspace` animals → days → config versions, **persisted to localStorage**,
  `mergeDayMetadata(animal, day) → encodeYaml`.

They are **two independent stores** (composed as siblings in `store.js`; no sync — editing one never
touches the other). They share **only the I/O + validation contract**: `encodeYaml` (`io/yaml.js`),
`nwb_schema.json`, `validate()` (schema + rules), and `valueList.js` key order. **That shared layer is
exactly what the 125 golden baselines lock.** The workspace adds *day-level* validation (`validateDay`,
`computeStepStatus`) on top of the shared schema rules — additive, not a fork. Only the form *controls*
(`element/*`) are legacy-only; `io` / `validation` / `schema` / `valueList` / `utils` are shared.

**The bridge — `mergeDayMetadata`** flattens an animal+day into a dict *isomorphic to legacy
`formData`*, so **one workspace day exports byte-identical YAML to the legacy form** for the same
session. This parity is the whole game (and what makes a YAML importer tractable — see the plan).

**Gaps:** YAML import is **legacy-only** — there is no path to import a YAML *into* the workspace, and
no legacy↔workspace converter. Relevant to onboarding efficiency + the held cutover.

**The integration seam is the merge.** Every feature is either:

- 🟢 **MERGE-NEUTRAL** (UI/state only; baselines untouched; low risk): hybrid day editor, carry-forward,
  duplicate-day, copy-from-animal, per-day cameras-used checklist.
- 🟡 **MERGE-CHANGING** (alters the emitted YAML; TDD + byte-identical baselines + migration): task
  catalog, channel-maps split, dataset tier.

**Design rule:** express new structure as *"what `mergeDayMetadata` resolves"*, NOT as new exported
keys — that preserves legacy parity + the baselines.

| Mockup element | Lands on | Touches | Merge output? |
| --- | --- | --- | --- |
| Hybrid tabbed editor | `DayEditorStepper` shell → section-nav (step components stay) | UI only | 🟢 No |
| Carry-forward / duplicate / bulk | `CalendarDayCreator` + `RecordingDaysTab` + `createDay`/`createDayRecord`; new `duplicateDay` | useWorkspace | 🟢 No |
| Per-day cameras-used | new day control → `resolveDayCameraUsage` | `updateDay` | 🟢 No (same resolved set) |
| Extend copy-from-animal | `CopyFromAnimalDialog` + Cameras/RecordingSystem containers | `updateAnimal` | 🟢 No |
| Task-type catalog | new catalog + `TasksEpochsStep`; merge inlines | useWorkspace + **merge** | 🟡 Yes |
| Channel-maps split | `ChannelMapEditor` (drop bad-ch) + day `BadChannelsEditor`; `resolveDayConfig` | **merge** | 🟡 Yes |
| Dataset tier | new route + `workspace.sharedHardware` + merge resolution | useWorkspace + **merge** | 🟡 Yes |
| Import from existing | new importer (inverse of merge) + workspace entry | new `decomposeYaml` + createAnimal/Day | 🟢 No (round-trip parity) |

See **[implementation-plan.md](implementation-plan.md)** for the phased build (incl. the YAML importer).

## Data-entry efficiency (2026-06-08)

North star (user): **"the user can add information in the most efficient way possible."** Days are the
high-frequency unit and ~90% repeat day-to-day, so efficiency = **minimize keystrokes per day** by
pushing work up a ladder: **inherit (animal/dataset) → carry-forward (last day) → smart-default → quick-enter the deltas.**

**Audit — what already exists (do NOT rebuild):**
- Bad-channel marking is already a compact **checkbox grid** (`BadChannelsEditor.jsx`; probe-wide + per-ntrode).
- Cameras & recording-system are already **catalog + per-day reference** (`cameraUsage.js`; `data_acq_device_name`).
- **Type-+-Enter** quick-add exists for simple lists (`ListElement.jsx` — keywords, experimenters, regions).
- **Keyboard shortcuts** exist (`ShortcutsHelp.jsx` — Ctrl/Cmd+S, Alt+←/→, Alt+N add-row, ?, Esc).
- **Copy-from-animal** exists but **only electrode groups + channel maps** (`CopyFromAnimalDialog.jsx`).

**Gaps mocked in [mockup-efficiency-patterns.html](mockup-efficiency-patterns.html):**
1. **Carry-forward / duplicate-day / bulk-template** — *biggest win.* New days are blank except tech
   defaults (`workspaceTransitions.js:312`); duplicate-day ABSENT; calendar makes N blank days. Proposed:
   new day **starts from your last day** (reviewable, with a "blank" opt-out), a **Duplicate day** row
   action, and a bulk "start from last day" on calendar-selected dates.
2. **Task-type catalog** — tasks are re-typed inline every day (ABSENT catalog; Spyglass divergence risk).
   Proposed: define task types once → each day **picks + orders** epochs (quick-add). Overlaps the tier decision.
3. **Per-day "cameras used" checklist** — implicit today (a camera is "used" only if a task/video references
   it). Proposed: explicit day-level checklist that drives export + narrows downstream pickers.
4. **Extend copy-from-animal** to cameras + recording system (today: electrode/channel-map only). Largely
   moot if the dataset tier is adopted.

**UX principles applied:** recognition over recall (pick/confirm, don't retype); smart defaults that are
**visible + overridable** (never a silent auto-fill of scientific data — carry-forward is reviewable with an
opt-out); explicit over implicit; consistency-by-construction (one definition ⇒ no divergence); edit-once
correction (catalog edit propagates); reversibility; progressive disclosure; keyboard-first for power users.

**Efficiency sequencing (impact ÷ effort):** ① carry-forward/duplicate (high, self-contained) → ③ cameras-used
+ ④ copy-from-animal (small) → ② task catalog (medium, overlaps the tier decision). Larger structural pieces:
the hybrid tabbed editor (decided) + the dataset tier.

## Decision log

- 2026-06-08: User chose **"discuss / capture for later"** over building any of the four. This note is
  the capture. Nothing scheduled.
- 2026-06-08: Concrete issues 1 (⋮ menu) + 3 (in-app nav, scoped to NOT change the default landing) fixed
  on `modern`. Design answers: **hybrid** tabbed day-editor preferred; channel-maps **split** approved;
  dataset-tier + day-editor mockups requested; cutover (front door) **held**. Efficiency emphasized.
  Mockups: `mockup-dataset-tier.html`, `mockup-tabbed-day-editor-interactive.html`, `mockup-efficiency-patterns.html`.
- 2026-06-08: Verified legacy↔workspace relationship (two independent stores, shared I/O+validation
  contract, `mergeDayMetadata` parity bridge, import legacy-only). Captured the architecture + the
  merge-seam integration map above. Wrote the phased **[implementation-plan.md](implementation-plan.md)**
  including a YAML **importer** (Phase C — round-trip byte-identical as the correctness gate). Nothing
  built yet from the plan; awaiting a go on the first phase.
