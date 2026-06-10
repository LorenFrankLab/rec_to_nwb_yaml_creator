# Phase 2b — Retire the animal-level DIO library; one source of truth

[← back to PLAN.md](PLAN.md) · design rationale: [§3.6–3.7 decisions](PLAN.md#3-decisions), [§6 consistency](PLAN.md#6-consistency-with-the-rest-of-the-app), [§9 migration & edge cases](PLAN.md#9-migration--edge-cases-address-in-the-phase-that-touches-each)

Now that the day editor owns the full editable DIO set ([phase-2a](phase-2a-day-wiring-table.md)),
remove the confusing animal-vs-day split: retire the **animal-level behavioral-events library**
authoring surface and the day editor's **"Use on this day"** inherited mechanism, leaving the
day's set as the single source of truth. Bootstrap a fresh animal's first day via carry-forward
(existing) + `CopyFromAnimalDialog`; standard-set templates arrive in
[phase-3](phase-3-templates-autonumber.md). **No exported-YAML change** — export already reads
`behavioral_events` from the day ([workspaceUtils.js:406-409](../../../../src/state/workspaceUtils.js#L406-L409)), never the animal.

> ⚠ **Open decision before executing the `CopyFromAnimalDialog` task** — see *Open question* below.
> The library-retirement tasks are fully specified and can proceed regardless.

**Inputs to read first:**

- [src/pages/DayEditor/BehavioralEventsDisplay.jsx](../../../../src/pages/DayEditor/BehavioralEventsDisplay.jsx) — remove the inherited read-only block (lines 86-123), `handleUseOnThisDay` (lines 54-56), the `inheritedEvents`/`inheritedNames` derivations (lines 38-44), and the duplicate-vs-inherited name warning (lines 39, 129-135). Keep the day-owned wiring table from [phase-2a](phase-2a-day-wiring-table.md) and the day duplicate-`description` gate (line 48).
- [src/pages/DayEditor/TasksEpochsStep.jsx:360-366](../../../../src/pages/DayEditor/TasksEpochsStep.jsx#L360-L366) — stops passing `inheritedEvents`; the `getAnimalBehavioralEvents(animal)` call (line 124) feeding it is removed here.
- [src/pages/AnimalView/index.jsx:203](../../../../src/pages/AnimalView/index.jsx#L203) — renders `<DioContainer animal=… onFieldUpdate=… />`; the DIO tab is registered in `SECTION_GROUPS` (line 88) and `TAB_FIELD_ANCHOR` (line 119), route `#/animal/:id/dio`. The tab + render are removed here.
- [src/pages/AnimalEditor/wiring/DioContainer.jsx](../../../../src/pages/AnimalEditor/wiring/DioContainer.jsx) and [src/pages/AnimalEditor/BehavioralEventsSection.jsx](../../../../src/pages/AnimalEditor/BehavioralEventsSection.jsx) — the animal-library surface being deleted (and `BehavioralEventsSection.test.jsx`, `BehavioralEventsSection.scss`).
- [src/state/persistence.js](../../../../src/state/persistence.js) — `WORKSPACE_SCHEMA_VERSION = 2` (line 70), `MIGRATABLE_SCHEMA_VERSIONS = new Set([1])` (line 71), `ensureWorkspaceShape` (lines 43-60, required keys `['animals','days','settings']` line 18), load-time migration (lines 122-140). **There is no `workspaceMigrations.js`** — migration is an inline shape-ensure. This is why the default is *vestigial*, not *migrate* ([§9](PLAN.md#9-migration--edge-cases-address-in-the-phase-that-touches-each)).
- [src/pages/AnimalEditor/CopyFromAnimalDialog.jsx](../../../../src/pages/AnimalEditor/CopyFromAnimalDialog.jsx) — `ALL_SECTIONS` (line 26 = `['electrode_groups','cameras','data_acq_device']`), `SECTION_LABELS` (lines 28-33), `buildElectrodeCopy` re-ID (line 221), `handleCopy` (lines 306-344). Cameras/data-acq are identity-keyed and seed only into an **empty** target catalog; electrode groups re-ID and append.

## Tasks

- **Remove the "Use on this day" inherited mechanism from the day editor.** Delete the inherited
  block, `handleUseOnThisDay`, the `inheritedEvents` prop + derivations, and the
  duplicate-vs-inherited name warning from `BehavioralEventsDisplay.jsx`. The wiring table
  (phase-2a) is now the only DIO editor on the day. Update `TasksEpochsStep.jsx` to stop computing
  and passing `inheritedEvents` (remove the `getAnimalBehavioralEvents(animal)` call at line 124).
  Existing days keep their own `behavioral_events` (they already own them) — no data is lost.

- **Delete the animal-level library surface.** Remove `BehavioralEventsSection.jsx` (+ its
  `.test.jsx`, `.scss`) and `DioContainer.jsx`. Remove the **DIO tab**: drop its entry from
  `SECTION_GROUPS` ([AnimalView/index.jsx:88](../../../../src/pages/AnimalView/index.jsx#L88)) and `TAB_FIELD_ANCHOR` (line 119), and the `<DioContainer …>` render (line 203).
  Add a redirect/guard so an old `#/animal/:id/dio` URL doesn't dead-end (route to the animal's
  default tab). Grep for any remaining importers of `BehavioralEventsSection`/`DioContainer` and
  remove them. **Out of scope:** the frozen legacy single-page form has its own DIO surface,
  `src/components/BehavioralEventsFields.jsx` (imported only by `LegacyFormView.jsx`), which also
  calls `behavioralEventsDescription()` — leave it untouched (it already consumes the
  Phase-1-trimmed `['Din','Dout']` list; the legacy form is the frozen safety net).

- **Handle `animal.behavioral_events` data — VESTIGIAL (default).** Per [§9](PLAN.md#9-migration--edge-cases-address-in-the-phase-that-touches-each): stop reading,
  writing, and showing `animal.behavioral_events`, but **leave the field in the persisted blob**.
  No `WORKSPACE_SCHEMA_VERSION` bump and no migrator are needed — export is already day-owned, and
  `ensureWorkspaceShape` only guards `['animals','days','settings']` (it neither requires nor
  strips `behavioral_events`). Add a one-line comment at the former write site / selector noting
  the field is retained-but-unused for backward/forward compatibility. *(Conditional alternative —
  MIGRATE — only if a registered-migrator framework exists by execution time: bump schema to 3,
  register a migrator that seeds an animal's empty first day from its library then deletes the
  field. Do NOT build that framework here; default to vestigial.)*

- **Add `behavioral_events` to `CopyFromAnimalDialog`** *(blocked on the Open question below)*.
  Add `'behavioral_events'` to `ALL_SECTIONS` (line 26) and a `SECTION_LABELS` entry (e.g.
  `behavioral_events: 'Behavioral events (DIO set)'`). Because the set is **day-owned**, define the
  copy semantics per the resolved Open question and implement in `handleCopy` (lines 306-344):
  deep-clone the chosen source set and seed it (identity-keyed seed-into-empty, like cameras —
  never append duplicates). Add the validation/no-op behavior when the target already has the set.

- **CHANGELOG.** Add a "Changed"/"Removed" entry: the animal-level DIO library and the day's "Use
  on this day" step are retired in favor of a single day-owned set; `animal.behavioral_events` is
  retained-but-unused (vestigial) for compatibility; `CopyFromAnimalDialog` can seed a new animal's
  DIO set. State the exported YAML shape is unchanged.

- **Docs.** Update any in-app helper/empty-state copy or onboarding text that still references the
  animal-level "library"/"templates"/"Use on this day" model (e.g. the former
  `BehavioralEventsSection` empty-state strings, and the [§5](PLAN.md#5-ux-design-the-heart)
  section explainer wording) so the UI describes one day-owned set.

## Open question (resolve before the `CopyFromAnimalDialog` task)

`behavioral_events` are **day-owned**, but `CopyFromAnimalDialog` copies **animal→animal**. "Copy
the DIO set from animal X" must define *which* source set and *where* it lands. Proposed default
(confirm before executing): **source** = the most-recent day's `behavioral_events` of the source
animal; **target** = seed into the target animal's most-recent day if it has one and that day's set
is empty, otherwise stash the set so the target animal's *next created day* is seeded from it
(parallel to carry-forward). Alternatives: let the user pick the source day; or **defer this task
entirely** (carry-forward + phase-3 templates already cover bootstrap, so `CopyFromAnimalDialog`
DIO support is a convenience, not a blocker for retiring the library). If unresolved at execution,
**ship the retirement without the copy task** and split the copy bootstrap into its own follow-up.

## Deliberately not in this phase

- **Building a migration framework / bumping the schema version.** Default is vestigial; the
  migrate path is conditional and explicitly out of scope unless the framework already exists.
- **Standard-set templates / per-label auto-numbering** — [phase-3](phase-3-templates-autonumber.md).
- **`comments` field / reconfiguration history** — [phase-4](phase-4-reconfiguration-comments.md).
- **Changing the day wiring table UI** built in [phase-2a](phase-2a-day-wiring-table.md) beyond
  removing the inherited block.

## Validation slice

| Test | Asserts |
| --- | --- |
| inherited block removed | `BehavioralEventsDisplay` no longer renders an inherited list or a "Use on this day" control; the day wiring table is the only DIO editor |
| existing day data preserved | a day that previously held `behavioral_events` still exports them unchanged after the library is removed (export reads the day) |
| DIO tab removed | the animal view exposes no DIO tab; navigating to `#/animal/:id/dio` redirects to the default tab instead of dead-ending |
| no dangling imports | grep finds no remaining import of `BehavioralEventsSection` or `DioContainer` |
| `animal.behavioral_events` vestigial | loading a workspace whose animals still carry `behavioral_events` does not error, does not surface it in the UI, and round-trips the persisted blob (no schema bump, `ensureWorkspaceShape` unaffected) |
| `CopyFromAnimalDialog` seeds the DIO set *(if task included)* | per the resolved semantics: copying from a source animal seeds the target's day set (deep-cloned, no aliasing), and is a no-op/blocked when the target set is non-empty |
| **golden baselines unchanged** *(integration)* | `npx vitest run baselines` byte-identical — retiring the library changes no exported YAML |

## Fixtures

Reuse workspace test factories. Add a persisted-workspace fixture whose animals carry a non-empty
`animal.behavioral_events` **and** whose days carry their own sets, to prove (a) retirement loses
no exported data and (b) the vestigial field round-trips without error. No new YAML golden fixtures
(export shape unchanged).

## Review

Before opening the PR for this phase, dispatch `code-reviewer` against the diff. Confirm:
- The library surface (`BehavioralEventsSection`, `DioContainer`, DIO tab/route) is fully removed with no orphaned imports or dead routes; existing day data is preserved.
- `animal.behavioral_events` is vestigial (retained, unread) — no schema bump, no silent data drop; the migrate path was NOT built.
- The `CopyFromAnimalDialog` task was either implemented per the **resolved** Open question, or explicitly deferred (and the deferral noted in PLAN.md) — not implemented against an unconfirmed guess.
- "Deliberately not in this phase" honored; golden baselines byte-identical; full suite + `npm run lint` + `npm run test:e2e` (functional) green.
- No docstring / test name / module name references "Phase 2b" or this plan; user-facing copy no longer describes the retired library model.
