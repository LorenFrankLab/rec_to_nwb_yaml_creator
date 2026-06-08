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

## Decision log

- 2026-06-08: User chose **"discuss / capture for later"** over building any of the four. This note is
  the capture. Nothing scheduled.
