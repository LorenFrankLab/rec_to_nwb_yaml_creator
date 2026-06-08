# Phase 3-4 — Subject/profile + reconfiguration context, re-homed onto the AnimalView header

[charter](phase-3-setup-tabs.md) · [overview](overview.md) · depends on [3-1](phase-3-1-extract-wiring.md)

Subject facts and the reconfiguration context are **not tabs** (decision: they belong in the animal header
band). They currently live inside the stepper; re-home them onto `AnimalView` so they survive the stepper's
Phase 5 decommission and are visible regardless of which setup tab is open. Small, low-risk phase.

**Inputs to read first:**

- [AnimalProfileSection.jsx](../../../../src/pages/AnimalEditor/AnimalProfileSection.jsx) — props `{ animal, dayCount, onSave }`; owns its own expand/confirm state + the blast-radius confirm.
- [AnimalEditorStepper.jsx:825-829](../../../../src/pages/AnimalEditor/AnimalEditorStepper.jsx) — current `AnimalProfileSection` render + `onSave → actions.updateAnimal(animalId, { subject })`.
- [AnimalEditorStepper.jsx:76-112](../../../../src/pages/AnimalEditor/AnimalEditorStepper.jsx) — `parseAnimalEditorRouteContext` + `useAnimalEditorRouteContext` (the `?context=reconfigure&version=&fromDay=&movedDays=` parser); [:248-256](../../../../src/pages/AnimalEditor/AnimalEditorStepper.jsx) the context derivation; [:805-816](../../../../src/pages/AnimalEditor/AnimalEditorStepper.jsx) the banner render.
- [AnimalView/index.jsx:116-124](../../../../src/pages/AnimalView/index.jsx) — the header band where these mount; it already shows `animal.id` + subject facts ([:113-122](../../../../src/pages/AnimalView/index.jsx)).
- [ReconfigWizard.jsx:103](../../../../src/pages/DayEditor/ReconfigWizard.jsx) — the emitter of the `?context=` deep link (so the destination must read the same params). Its re-pointing to a tab route is [Phase 3a](phase-3a-repair-routing.md), but the param CONTRACT must be preserved here.

## Tasks

- **Render `AnimalProfileSection` in the `AnimalView` header** (collapsible, as today), passing `animal`,
  `dayCount`, and `onSave → actions.updateAnimal(animalId, { subject })`. It keeps its own blast-radius
  confirm. **Pass the SAME count the stepper passes — `getAnimalDayIds(animal).length`** ([current call:
  AnimalEditorStepper.jsx:826](../../../../src/pages/AnimalEditor/AnimalEditorStepper.jsx)) — NOT the
  recovery-aware day count, so the "affects N days" confirm copy is byte-identical to the stepper's (the
  review item below asserts this). It must render on every `:tab` (it's header, above the panel).
- **Re-home the reconfiguration context banner.** Lift `parseAnimalEditorRouteContext` /
  `useAnimalEditorRouteContext` into a small shared hook (e.g. `src/pages/AnimalView/useReconfigContext.js`
  or reuse the existing parser) and render the banner ([logic at :248-256](../../../../src/pages/AnimalEditor/AnimalEditorStepper.jsx), [render at :805-816](../../../../src/pages/AnimalEditor/AnimalEditorStepper.jsx)) in the `AnimalView` header when
  `context === 'reconfigure'`, with the same "editing latest vN" / "review vN — current latest is vM" copy
  and the warning style for a non-latest version. Read the SAME query params (`context`, `version`,
  `fromDay`, `movedDays`).
- **Keep the stepper's copies until Phase 5.** The stepper still renders its own `AnimalProfileSection` +
  banner (parallel-running invariant) — do NOT delete them here. Extract the parser/banner into a shared
  module both consume so they don't drift; the stepper's deletion is Phase 5.

## Deliberately not in this phase

- **Re-pointing the `?context=`/`?field=` emitters to tab routes** — [Phase 3a](phase-3a-repair-routing.md). This phase only makes `AnimalView` *read* the params; `ReconfigWizard` still deep-links to `/editor` until 3a.
- **Deleting the stepper's profile/banner** — Phase 5 (the stepper stays live).
- **Validation & Export tab / warning ack** — [3-5](phase-3-5-validation-export-tab.md), [3-6](phase-3-6-warning-ack.md).

## Validation slice

| Test | Asserts |
| --- | --- |
| profile in AnimalView header | the subject section renders on `AnimalView` for any `:tab`; editing + save calls `updateAnimal(id,{subject})`; the blast-radius confirm still fires when days exist |
| reconfig banner on AnimalView | with `#/animal/:id/electrode-groups?context=reconfigure&version=1` (latest=2), the header shows the "review v1 — current latest is v2" warning banner; without `context=` it does not render |
| shared parser, no drift | the stepper and AnimalView render the same banner copy for the same params (one parser module) |
| `npx vitest run baselines` | 125 byte-identical |

## Fixtures

`buildRealisticWorkspace()` with a second `configurationHistory` entry (so version 1 is non-latest for the banner test); set `window.location.hash` with the `?context=` params in the test.

## Review

Dispatch `pr-review-toolkit:code-reviewer` against the diff. Confirm:

- Profile + reconfig banner render on `AnimalView` across tabs and keep their confirms/copy.
- The param contract matches `ReconfigWizard`'s emitter (no silently-dropped reconfig context).
- Parser/banner extracted to ONE shared module (stepper + AnimalView both consume) — no forked copy.
- Stepper still renders its own (parallel invariant); nothing deleted prematurely.
- 125 baselines byte-identical; lint 0 errors; build green; names free of plan-milestone references.
