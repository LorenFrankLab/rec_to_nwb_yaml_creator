# Phase 3a — Repair-routing migration (tracked workstream)

**Split out of Phase 3 because the front-end review showed it's far wider than "update one file."**
Repair buttons across Validation/Export and the Day Editor deep-link into the Animal Editor with
`#/animal/:id/editor?field=…`; all of that must re-target the new per-tab routes while preserving the
canonical repair-target *semantics* (which step/surface owns a fix) — and the 4-step→tab granularity
genuinely changes.

## Why it's bigger than it looks

- **`#/animal/:id/editor?field=…` emitters in 4+ source files**, not just `validation.js`:
  [DevicesStep.jsx](../../../../src/pages/DayEditor/DevicesStep.jsx) (`?field=electrode_groups`,
  `?field=ntrode_electrode_group_channel_map`), [DayTechnicalSection.jsx](../../../../src/pages/DayEditor/DayTechnicalSection.jsx)
  (`?field=data_acq_device`), the builder in [AnimalWorkspace/index.jsx](../../../../src/pages/AnimalWorkspace/index.jsx),
  plus `validation.js` itself.
- **`useAnimalIdFromUrl` hard-matches `/editor`** (handled in Phase 1, but every repair consumer depends
  on the new parse).
- **The granularity changes.** `ANIMAL_EDITOR_STEPS` ([validation.js:865](../../../../src/domain/validation.js))
  is 4 steps; the label `Fix in Animal Setup → Recording System, Cameras & DIO` covered ONE step that is
  now THREE tabs (recording-system / cameras / dio), and the electrodes step is now TWO tabs
  (electrode-groups / channel-maps). So `animalEditorStepForFieldPath` must resolve a field to the
  RIGHT tab — camera fields → `cameras`, data-acq fields → `recording-system`, channel fields →
  `channel-maps`, geometry/location → `electrode-groups`. This is a deliberate **improvement** in
  routing precision, not a no-op rename. Repair labels referenced by tests
  ([ExportStep.jsx](../../../../src/pages/DayEditor/ExportStep.jsx), `RawCorruptionBanner.jsx`,
  `animalRepairRouting.test.js`) shift accordingly.
- **The `?field=…` scroll-to-and-highlight context must survive.** Today the stepper deep-links to a
  field and focuses/highlights it; landing on a long tab with no orientation is a regression. The tab
  must consume `?field=…` to scroll to and highlight the specific control (preserve the existing
  focus-highlight mechanism, just re-pointed at the tab).

## Tasks

- **Task 3a.1 — Enumerate + rewrite every `?field=` emitter** to `#/animal/:id/:tab?field=…`.
- **Task 3a.2 — Redesign `ANIMAL_EDITOR_STEPS` → a tab-keyed map** and rewrite `animalEditorStepForFieldPath`
  so each field path resolves to its owning tab (the new finer granularity). Keep `repairTargetForIssue`'s
  surface/label *contract* (the ownership-pattern hints from Phase 8.7 Task 9 stay) — only the target
  URL + step→tab labels change.
- **Task 3a.3 — Preserve `?field=` highlight** end-to-end on the destination tab (scroll + highlight the
  control), matching today's stepper behavior.
- **Task 3a.4 — Sweep the tests.** `animalRepairRouting.test.js` and the ~19 route-referencing test
  files: update to tab URLs + the new finer labels.

## Acceptance

- Every repair button routes to the correct tab; a camera repair lands on `cameras`, a data-acq repair
  on `recording-system`, a channel repair on `channel-maps`, a geometry/location repair on
  `electrode-groups` — and the `?field=…` highlight focuses the exact control.
- `repairTargetForIssue`'s ownership semantics (Phase 8.7 Task 9 hints) unchanged; only URLs/labels move.
- Full suite (routing + label tests updated), lint, build green; **125 baselines byte-identical**.

## Risk

- This is the churn-heavy workstream. Do it as one focused pass AFTER the tabs exist (Phase 3), so the
  destination routes are real when the emitters are rewritten.
