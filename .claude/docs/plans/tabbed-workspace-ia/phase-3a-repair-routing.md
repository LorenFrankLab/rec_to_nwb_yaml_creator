# Phase 3a — Repair-routing migration (tracked workstream)

**Split out of Phase 3 because the front-end review showed it's far wider than "update one file."**
Repair buttons across Validation/Export and the Day Editor deep-link into the Animal Editor with
`#/animal/:id/editor?field=…`; all of that must re-target the new per-tab routes while preserving the
canonical repair-target *semantics* (which step/surface owns a fix) — and the 4-step→tab granularity
genuinely changes.

## Why it's bigger than it looks

- **`#/animal/:id/editor` emitters span 7 source files / ~13 call sites** (full enumeration via
  `grep -rn '/editor' src/`, excluding tests). They split into two kinds — **`?field=` repair deep-links**
  AND **bare `/editor` "Edit Animal" / breadcrumb links** (the latter were NOT in the earlier "4 files"
  list and would route to a **dead/redirected route after Phase 5** if missed):
  - [AnimalWorkspace/index.jsx:64](../../../../src/pages/AnimalWorkspace/index.jsx) — the `?field=${fieldHint}`
    repair builder; **:361** — the bare `Edit Animal Setup` link.
  - [DevicesStep.jsx:406,427,443](../../../../src/pages/DayEditor/DevicesStep.jsx) (`?field=electrode_groups`),
    **:570** (`?field=ntrode_electrode_group_channel_map`).
  - [DayTechnicalSection.jsx:129](../../../../src/pages/DayEditor/DayTechnicalSection.jsx) (`?field=data_acq_device`).
  - **[ReconfigWizard.jsx:103](../../../../src/pages/DayEditor/ReconfigWizard.jsx)** — `…/editor?${params}`, a
    **param-carrying deep-link** (the reconfiguration flow). **Highest-risk miss** — drops the reconfig
    context if not migrated; verify which params it sends and where they must land.
  - **[OverviewStep.jsx:139,317,395](../../../../src/pages/DayEditor/OverviewStep.jsx)** — breadcrumb + two
    `Edit Animal` links (bare).
  - **[DayEditorStepper.jsx:171](../../../../src/pages/DayEditor/DayEditorStepper.jsx)** — bare `/editor` base.
  - **[TasksEpochsStep.jsx:322](../../../../src/pages/DayEditor/TasksEpochsStep.jsx)** — bare `/editor` link.
  - Plus `validation.js`'s `animalEditorStepForFieldPath` (the resolver itself, below).
  Bare links with no `?field` should land on a sensible default tab (`days` or the relevant setup tab),
  not 404/redirect-bounce.
- **`useAnimalIdFromUrl` hard-matches `/editor`** (handled in Phase 1, but every repair consumer depends
  on the new parse).
- **The granularity changes.** `ANIMAL_EDITOR_STEPS` ([validation.js:865](../../../../src/domain/validation.js))
  is 4 steps; the label `Fix in Animal Setup → Recording System, Cameras & DIO` covered ONE step that is
  now THREE tabs (recording-system / cameras / dio), and the electrodes step is now TWO tabs
  (electrode-groups / channel-maps). So `animalEditorStepForFieldPath` must resolve a field to the
  RIGHT tab — camera fields → `cameras`, data-acq fields → `recording-system`, channel fields →
  `channel-maps`, geometry/location → `electrode-groups`. This is a deliberate **improvement** in
  routing precision, not a no-op rename. **DIO is asymmetric — it's a NEW branch, not a split:**
  `animalEditorStepForFieldPath` ([validation.js:887](../../../../src/domain/validation.js)) has **no
  `behavioral_events`/`dio` case today** — it routes `ntrode→channel-maps`, `camera|data_acq|configurationHistory→`
  the combined step, `opto→`opto, and **everything else falls through to electrodes (step 0)**. So a DIO
  repair currently mis-routes to Electrodes; the `dio` tab needs an **authored** mapping + a check that a
  DIO-field repair emitter even exists to target it (if none does, the `dio` branch is forward-looking).
  Repair labels referenced by tests
  ([ExportStep.jsx](../../../../src/pages/DayEditor/ExportStep.jsx), `RawCorruptionBanner.jsx`,
  `animalRepairRouting.test.js`) shift accordingly.
- **The `?field=…` scroll-to-and-highlight context must survive.** Today the stepper deep-links to a
  field and focuses/highlights it; landing on a long tab with no orientation is a regression. The tab
  must consume `?field=…` to scroll to and highlight the specific control (preserve the existing
  focus-highlight mechanism, just re-pointed at the tab).

## Tasks

- **Task 3a.1 — Rewrite every `/editor` emitter** (the 7 files / ~13 sites above) — both `?field=` repair
  deep-links → `#/animal/:id/:tab?field=…` AND bare `/editor` links → a sensible default tab. Re-run
  `grep -rn '/editor' src/` to confirm none are missed; pay special attention to `ReconfigWizard.jsx`'s
  param-carrying deep-link (preserve its params to the right destination).
- **Task 3a.2 — Redesign `ANIMAL_EDITOR_STEPS` → a tab-keyed map** and rewrite `animalEditorStepForFieldPath`
  so each field path resolves to its owning tab (the new finer granularity), **adding the missing
  `behavioral_events`/`dio` branch** (today it falls through to electrodes) and **splitting the combined
  camera+data_acq case** into `cameras` vs `recording-system`. Keep `repairTargetForIssue`'s surface/label
  *contract* (the ownership-pattern hints from Phase 8.7 Task 9 stay) — only the target URL + step→tab
  labels change.
- **Task 3a.3 — Preserve `?field=` highlight** end-to-end on the destination tab (scroll + highlight the
  control), matching today's stepper behavior.
- **Task 3a.4 — Sweep the tests.** `animalRepairRouting.test.js` and the ~19 route-referencing test
  files: update to tab URLs + the new finer labels.
- **Task 3a.5 — Wire the section-nav BLOCKING-red dot (carried over from Phase 1 Task 1.1c).** Phase 1
  ships only the hollow-○ todo ring (`getAnimalSectionStatus` → `todo`/`none` in
  [src/domain/sectionStatus.js](../../../../src/domain/sectionStatus.js)). Once this phase has the
  field-path→section attribution, extend that helper (or a sibling) to return a `blocking` state when an
  export-blocking error attributes to a section, and render it as the red dot in `AnimalView`'s section-nav
  (decision 11; accessible name "— blocks export"). **Reuse the SAME attribution** as the repair routing —
  no second mapping.

## Acceptance

- Every repair button routes to the correct tab; a camera repair lands on `cameras`, a data-acq repair
  on `recording-system`, a channel repair on `channel-maps`, a geometry/location repair on
  `electrode-groups` — and the `?field=…` highlight focuses the exact control.
- `repairTargetForIssue`'s ownership semantics (Phase 8.7 Task 9 hints) unchanged; only URLs/labels move.
- Full suite (routing + label tests updated), lint, build green; **125 baselines byte-identical**.

## Risk

- This is the churn-heavy workstream. Do it as one focused pass AFTER the tabs exist (Phase 3), so the
  destination routes are real when the emitters are rewritten.
