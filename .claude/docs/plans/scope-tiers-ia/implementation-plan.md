# Implementation plan — post-merge roadmap

Companion to [design-note.md](design-note.md). Sequences the post-cutover work: efficiency wins, the
approved channel-maps split, **import from existing YAMLs**, the decided hybrid day-editor, and the
decision-gated structural changes (task catalog, dataset tier, cutover).

## Operating principles (every phase)

- **The merge is the seam.** `mergeDayMetadata → encodeYaml` is the single export path and the
  golden-baseline contract. Classify each item:
  - 🟢 **merge-neutral** — UI/state only; the emitted YAML is unchanged → baselines untouched, low risk.
  - 🟡 **merge-changing** — alters emitted YAML → TDD + **125 golden baselines byte-identical** + a
    migration for existing data.
  - 🔵 **decision-gated** — blocked on an open product decision (tier, cutover).
- **Discipline:** TDD (failing test first), full `npx vitest run` green, `npx vitest run baselines`
  byte-identical, `npm run lint` 0 errors, `npm run build`, code-review on substantive diffs,
  REFACTOR_CHANGELOG per commit. Branch off `modern`; don't push/merge unless asked.
- **Express new structure as "what `mergeDayMetadata` resolves," never as new exported keys** (keeps
  legacy parity + baselines).

## Open decisions that gate phases

- **D-TIER:** is shared hardware (recording systems, cameras, DIO types, opto) **animal-level** or
  **dataset-level**? Gates Phase F and where the recording-system catalog ultimately lives. (Mockups:
  `mockup-dataset-tier.html`.)
- **D-CUTOVER:** when does `#/workspace` become the default front door / legacy retire? **Held.** Gated
  on the importer (Phase C) being solid.

---

## Phase A — Efficiency quick wins 🟢 (independent, high value, baseline-safe)

Each is self-contained and merge-neutral; ship individually.

- **A1 · Carry-forward day creation.** `createDayRecord` (`workspaceTransitions.js`) currently seeds
  only tech defaults. Add: a new day **seeds tasks / cameras-used / epoch shape / weight from the
  animal's most recent existing day**, *visibly and reviewably* (a "Started from 2026-06-21 — review &
  adjust" notice) with a **"start blank" opt-out**. Wire the choice through `RecordingDaysTab` /
  `CalendarDayCreator` (incl. the bulk path: all calendar-selected dates carry forward).
  - Tests: a carried-forward day still merges → **byte-identical** export to an equivalent hand-entered
    day (baselines unaffected); the opt-out yields today's blank day; carry-forward copies the documented
    day-owned fields only (never animal-owned).
- **A2 · Duplicate-day.** New `duplicateDay(dayId, newDate)` action (clone a day's day-owned content to a
  new date, new id) + a **"Duplicate day…"** item on the day row (`RecordingDaysTab`). Tests: clone
  equals source except date/id/session_id; export parity.
- **A3 · Extend "Copy from animal" to cameras + recording system.** `CopyFromAnimalDialog` today copies
  only electrode groups + channel maps. Add cameras + `data_acq_device` catalog; wire into
  `CamerasContainer` / `RecordingSystemContainer`. Re-run the cross-animal identity guards on copy.
- **A4 · Per-day "cameras used" checklist.** A day-level explicit checklist of the animal's cameras that
  drives `resolveDayCameraUsage` and **narrows** the task/video camera pickers to the day's set. Keep it
  merge-neutral: the resolved exported camera set must equal today's for existing data.

Suggested order within A: **A1 → A2 → A3 → A4** (A1 is the biggest win).

---

## Phase B — Channel-maps split 🟡 (approved)

Goal: animal **Channel Maps** tab = wiring/mapping only; **bad-channel marking = day-only** (one home).

- Remove `bad_channels` editing from `ChannelMapEditor` (animal); keep/strengthen the day
  `BadChannelsEditor` (`DevicesStep`).
- **Merge change:** the animal-base `bad_channels` currently feed `resolveDayConfig` before day
  overrides. Decide the model: (a) all bad-channels are day overrides (no animal base), or (b) keep an
  optional "dead-from-implant baseline". Lean (a).
- **Migration:** existing animal-level `bad_channels` → promote to each affected day's override (or a
  baseline), losslessly. Any fixture with animal-base bad channels must export identically.
- Gate: TDD + **baselines byte-identical** + the migration test.

---

## Phase C — Import from existing YAMLs 🟢 (high value; unblocks onboarding + the cutover)

The killer correctness test: **import a YAML → workspace → export the day → byte-identical to the
original.** The golden fixtures double as import fixtures. Because `mergeDayMetadata` is the forward
map, the importer is its inverse, using the SAME documented inheritance contract.

- **C1 · `decomposeYaml(flatModel) → { subjectId, animalFacts, dayFacts, configuration }`** — the
  inverse of `mergeDayMetadata`:
  - animal ← subject, devices (`data_acq_device` catalog), cameras (catalog), experimenters, optogenetics;
  - day ← session, tasks, files, technical params, weight, + the catalog *references*
    (`data_acq_device_name`, the day's camera/task refs);
  - configuration ← electrode_groups + ntrode channel maps (→ a config version).
  - **Round-trip test (the gate):** for every golden fixture, `encodeYaml(mergeDayMetadata(decompose(parse(yaml))))
    === yaml` (byte-identical). Reuses `decodeYaml` + `validate` (already shared).
- **C2 · Multi-file reconciliation.** Group N files by `subject_id` (+ date). Across a subject's files:
  consistent animal facts → one animal; **differing electrode config across dates → configuration
  versions** (the workspace already models this); other diverging animal facts (cameras, subject) →
  surface a flag and let the user choose (union vs per-day). Conflict with an existing workspace animal
  → options (add days / skip / replace), surfaced — never silent.
- **C3 · Import UI + entry point.** A **"Import YAML…"** action on the workspace (multi-file picker /
  drop zone) → a **preview/confirm** screen ("N files → animal *remy*: 3 days, 2 config versions; animal
  *totoro*: 1 day — review divergences") → on confirm, `createAnimal` + `createDay` (+ config snapshots)
  from the decomposed data. Reuse the legacy parse/validate (`importFiles`), route the result through
  `decomposeYaml` into the workspace instead of `setFormData`.
- Gate: round-trip byte-identical on all golden fixtures + a multi-day/multi-config fixture; a corrupt/
  partial file surfaces a clear, non-destructive error (don't half-import).

---

## Phase D — Hybrid tabbed day editor 🟢 (decided; UI refactor)

Replace `DayEditorStepper`'s linear shell (`StepNavigation` + `currentStep` + `stepGate`) with a
**section-nav** like `AnimalView` — the five step *components* (Overview/Devices/Epochs/Validation/
Export) stay. Per-section status (✓/⚠/✗); **Export stays blocked** until valid (the `stepGate` becomes
the Export tab's disabled state); keep an optional **"Next ▸"** for the guided path. UI-only, merge-
neutral. Mockup: `mockup-tabbed-day-editor-interactive.html`. Keep the existing keyboard shortcuts
(Alt+←/→ map to prev/next section).

---

## Phase E — Task-type catalog 🟡🔵 (overlaps D-TIER)

Animal-level (or dataset, per D-TIER) **task-type catalog**; the day **picks + orders** epochs; merge
**inlines** name+description into `day.tasks[]` at export (→ byte-identical). Kills the Spyglass
`task_name`/description divergence. Migration: existing inline `day.tasks` → catalog entries +
references. Baseline-gated. Sequence **after** the tier decision (so it lands at the right level).

---

## Phase F — Dataset tier 🔵🟡 (biggest; D-TIER first)

Only after **D-TIER = dataset**. New `workspace.sharedHardware` state + a top-level **"Shared
Hardware"** route; animals/days reference catalog entries; `mergeDayMetadata` **inlines** the
referenced entry per day. Recording-system + cameras (+ DIO types, opto) move here. **Migration:** lift
existing per-animal catalogs into the dataset catalog, de-duped by identity (the divergence guards
already assert they're identical), leaving name/id references. Phased, with byte-identical baselines.
Mockup: `mockup-dataset-tier.html`. Replaces "copy per animal + divergence guard" (A3) with "store
once + reference".

---

## Phase G — Cutover 🔵 (HELD; depends on C)

Make `#/workspace` the default front door + retire/relabel the legacy form. **Held** until certain
(D-CUTOVER). Hard prerequisite: **Phase C importer** (users with existing YAMLs must be able to bring
them into the workspace) + a migration/communication plan. Until then the legacy form stays the `#/`
default and the in-app logo/breadcrumb point at the workspace (already done).

---

## Suggested overall order

**A (efficiency wins) → C (importer) → B (channel-maps split) → D (hybrid editor) → [decide D-TIER] →
E + F → [decide D-CUTOVER] → G.**

Rationale: A is safe, independent, immediately useful. C is high-value and unblocks the cutover; its
round-trip test is cheap to make airtight given the existing parity. B is approved and contained. D is
decided and merge-neutral. E/F wait on the tier decision. G is last and held.
