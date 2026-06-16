# Mental model & UI design note

**Date:** 2026-06-15 · **Branch:** `modern` · Companion to
[yaml-corpus-analysis.md](./yaml-corpus-analysis.md), [data-change-scope-model.md](./data-change-scope-model.md),
[ux-principles.md](./ux-principles.md), and [scope-tiers-ia/design-note.md](../plans/scope-tiers-ia/design-note.md).

Purpose: state the **mental model** the user should hold, and how the UI/UX/IA should embody it — the
conceptual north star that the scope-tiering and IA work serves. Grounded in the 325-file corpus
analysis and the scope model; it explains *why* the workspace is shaped the way it is and where it
should go next.

## Decisions captured (this session)

1. **Single-user UI now; lab-shared later.** Design the UI for one editor at a time, but model the
   **animal as a person-independent shared record** so multi-user is a later UI/sync layer, not a
   data re-model. Reality to honor: several people (tech / grad student / postdoc) may author metadata
   for the *same* animal, and an animal may pass **between people / experiments sequentially** (one
   study finishes, another begins on the same animal).
2. **No data-directory binding yet**, but design so it can plug in later as a **mistake-prevention
   source** (verify `associated_files` paths exist, epoch counts match the `.rec`, channel counts match
   hardware). The per-day status surface is the slot for it.
3. **Lock animal-static data by best practice** (drift is rare but real): resolved structurally — see §5.
4. **Animal-level team.** The animal carries a team (set of people); each day's "who ran it" **defaults
   from the team** and is editable per day.

## 1. The mental model

> **"I have an animal. I implanted it once. I record it most days for weeks or months. Each day I log
> what it did and where the files are. The app turns that into something convertible."**

Nouns the user thinks in: **animal, day, implant (configuration), team.** Verbs: **set up** (rare),
**log a day** (constant). Unit of work: **the day.** Protagonist: **the animal.** *Not* in their model:
"a YAML file," "the `tasks[]` array," "channel maps," "the schema" — those are our artifacts.

**The mismatch we are correcting:** a file-shaped UI ("fill out one form per day") forces users to copy
yesterday's file and edit a few fields. The corpus proves the cost: ~80% of every file is byte-stable
boilerplate, and the only animal-static fields that ever change across days are **errors** (mec10's
genotype `WT`↔`scn2a`, Seth's two birthdays). **The file-shaped UI causes the drift.** The fix is to
make the UI shaped like the *experiment*, not the *file*.

## 2. The object model

The data model is relational and person-independent *now*, even though the UI is single-user:

```
Animals (every animal in the lab)
  └── Animal  ── identity (Fixed) + team[] (people) + experiment/keywords
        └── Configuration version  ── the implant/wiring (Per-config; new version on re-implant)
              └── Day (session)  ── date, experimenters[] (default = team), tasks/epochs,
                                     files, weight, bad_channels, DIO(rare), opto schedule
```

- **Animal is the single source of truth**, shared, not "owned by me." Identity + implant live here
  *once*. This is what makes multi-user a later addition rather than a re-model, and it is the
  structural cure for divergence (the corpus has `chimi` in two dirs and `mec10` across several, with a
  *conflicting genotype* — the symptom of per-copy editing).
- **Team is animal-level** (answer 4). `day.experimenters` defaults from `animal.team`, editable per day
  for the "only X ran today" case. A roster change edits the animal and carries forward to new days;
  past days keep their recorded set. This makes the corpus's "Lee joined on Emmett/Seth" a *legitimate*
  roster event, not drift.
- **Configuration version** is the named event that lets Per-config implant data change (re-implant /
  reconfiguration); days are stamped with it; bad-channel marks reset across versions.
- **Sequential experiments on one animal** (future): an animal may host more than one study over its
  life. For now `experiment_description`/`keywords` are animal-level (corpus: constant in 38/38). If
  per-animal *phases* become real, they slot in as a coarse grouping between animal and day — not built
  now.

This object model already exists in skeleton (`useWorkspace`, AnimalView, DayEditor, configuration
versions). This note sharpens the *mental-model alignment*, not a greenfield build.

## 3. Two journeys, made to feel different

| Journey | Frequency | UI mode | Feel |
|---|---|---|---|
| **Set up an animal** | ~once per animal | guided **wizard** (identity → implant/probes → rig → opto/team) | deliberate, careful |
| **Log a day** | most days, for months | **pre-filled confirm-and-tweak** of the day-delta | fast, light, repetitive |

If "log a day" feels as heavy as "set up an animal," users revert to copy-pasting files. **The felt
weight difference is the design.** (Aligns with `whole-user-process` and the two-journeys framing.)

## 4. How the model becomes UI

- **Navigation IS the mental model.** Animals → Animal (home base) → its Days. The user *navigates their
  experiment*, never "opens a file." The animal's name/id anchors every screen.
- **The scope boundary is a physical thing on screen.** On the day view, animal-static facts render as a
  compact **read-only summary card** (*"Laurent · PV-Cre · M · Rattus norvegicus · 3 probes (L/R CA1,
  L mPFC) · config v1 · team: Denisse, Scott"*) with a quiet "Edit animal setup" link. The **editable
  body is only the day-delta** (tasks/epochs, files, weight, bad channels). The user *sees* the line
  between "the animal" and "today." Recognition (rubric 4) + visible state (rubric 5) made structural.
- **Carry-forward + diff** (largely *shipped*): a new day pre-fills from the previous same-config day,
  with "carried from <date>" and changes highlighted. Embodies "today is mostly like yesterday," gives
  the efficiency win, and surfaces accidental carry-forward (a newly-dead channel left unmarked).
- **Configuration version as a visible noun:** *"Wiring v2 — since re-implant 2026-03-14."* Days show
  which config they used. Matches the user's real event ("different setup now").
- **The Animals dashboard** answers "where am I in a 200-day study?" — animals, days-per-animal, per-day
  status (complete / needs attention / converted). **Future (answer 2):** a data-directory binding fills
  the status column with real checks (paths exist, epoch/channel counts match the `.rec`).

## 5. Mistake-prevention model (resolves the locking question)

Climb to the **highest rung that fits** each field (Norman: design the error out; prevention > messages):

1. **Make it impossible (structural).** Derive or hide: channel maps (auto from `device_type`),
   `raw_data_to_volts`/`times_period_multiplier`/`units`/`device`, `session_start_time` (from `.rec`).
2. **Single source of truth = the locking answer (answer 3).** Animal-static facts are stored **once on
   the animal**, not copied per day. Two consequences fall out for free:
   - **Typo fixes are low-friction:** edit the animal once → correct on every day. No per-day hunting,
     no ceremony. (Mistakes are rare; don't punish the rare legitimate edit.)
   - **Drift is impossible:** there is only one value, so days *cannot* disagree.
   So we need **no heavy gate** to prevent drift — storage prevents it. The day-view "lock" is just
   *"this isn't where you edit it → go to the animal"* (prevents accidental edits, points the right
   way), not a barrier. The **only** ceremonial action is **starting a new configuration version**
   (physical re-wiring) — rare, meaningful, and appropriately deliberate because it reinterprets all
   later days. That friction is correct, not annoying.
3. **Constrain the input (recognition over recall).** Controlled-vocabulary pickers seeded from canon +
   prior use for region, species, sex, genotype, `lab`, `device_type` — the keyboard can't produce
   `hippcoampus`, `Rat`, `Male`, or `screw`.
4. **Gate at export (cost-of-error).** Block the download for the silent-failure fields: binomial
   species, single-letter sex, `device_type` ∈ 12 known probes, no NULL `location` on active groups,
   `subject_id` case, no case-variant unit keys. Validation framed in the user's language ("Epoch 3 has
   no statescript file"), not the schema's.
5. **Surface live consistency.** Per-animal banner if a Fixed field somehow holds two values across days
   (the late net under rung 2). Future: data-directory cross-checks (answer 2).

## 6. Deferred / hidden by design

Channel maps (auto; one reassurance line), lab boilerplate, `session_start_time`, full electrode
geometry on the day view, and the YAML itself — the YAML is an **export artifact**, offered as
"Preview / Export," never the thing the user thinks in.

## 7. Relationship to current state & plans

- **Shipped (don't rebuild):** carry-forward, duplicate/import days, day-owned bad channels,
  channel-maps split, hybrid tabbed Day Editor (per `scope-tiers-ia` status).
- **Live & unbuilt in [scope-tiers-ia](../plans/scope-tiers-ia/design-note.md):** the **dataset tier**
  (shared hardware across animals) and the **task-type catalog**. Both are pieces of this mental model
  (recognition-over-recall for tasks; "set up the rig once").
- **Genuinely new from the mental-model lens (not yet planned):** the **animal-as-home IA** + the
  **two distinct journeys** (setup wizard vs day-log), the **visible scope-boundary summary card**, the
  **animal team**, **configuration version as a first-class visible noun**, and the **Animals dashboard**
  (with a future data-dir status source).

## 8. Proposed next step

A single new plan — *mental-model-driven workspace IA* — that uses this note as its north star and
sequences: (a) animal-as-home navigation + the two journeys, (b) the visible scope-boundary day view,
(c) absorb `scope-tiers-ia`'s remaining threads (dataset tier, task catalog), (d) controlled-vocabulary
pickers + export gates (§5), (e) Animals dashboard (data-dir validation later). It is a large
architectural change (the scope-tiers note flags the dataset tier as such) — phase it, baseline-gate
each step, and keep the exported YAML shape unchanged.

**Open items to settle before/within the plan:** how coarse "sequential experiments per animal" needs
to be (phase grouping vs animal-level for now); exact wizard step order; whether the Animals dashboard
ships before or after the data-dir binding that gives it real status.
