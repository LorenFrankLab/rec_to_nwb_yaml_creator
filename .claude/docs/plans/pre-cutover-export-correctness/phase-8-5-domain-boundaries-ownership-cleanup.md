# Phase 8.5 — Domain boundaries and ownership cleanup

[← back to PLAN.md](PLAN.md) · [overview](overview.md) · [app code organization review](app-code-organization-review.md) · [domain-boundaries contract](shared-contracts.md#domain-boundaries--ownership-contract)

Goal: make the export-correctness contracts structural before browser QA. Phases 1–8 harden
the model, validation, repair, and UI behavior; this phase moves app-wide domain behavior out
of page components so Playwright and UX audits verify a stable architecture, not page-local
accidents.

This is a narrow pre-QA hardening phase. It is not a redesign, not a legacy removal, and not a
full reducer/type-system rewrite.

**Inputs to read first:**

- [app-code-organization-review.md](app-code-organization-review.md) — refresh it against the current
  branch first; use it as context, not as a stale checklist.
- [src/pages/DayEditor/validation.js](../../../../src/pages/DayEditor/validation.js) — currently owns
  app-wide validation composition, repair ownership/routing, step status, and Animal Editor deep-link
  routing.
- [src/pages/DayEditor/DevicesStep.jsx](../../../../src/pages/DayEditor/DevicesStep.jsx),
  [src/pages/DayEditor/BadChannelsEditor.jsx](../../../../src/pages/DayEditor/BadChannelsEditor.jsx),
  and [src/pages/AnimalEditor/ChannelMapEditor.jsx](../../../../src/pages/AnimalEditor/ChannelMapEditor.jsx)
  — contain bad-channel, multi-shank, and override-repair semantics that should become pure helpers.
- [src/pages/AnimalEditor/AnimalEditorStepper.jsx](../../../../src/pages/AnimalEditor/AnimalEditorStepper.jsx)
  and [src/state/useWorkspace.js](../../../../src/state/useWorkspace.js) — contain device/configuration
  mutation recipes whose invariants should be testable outside React.
- [shared-contracts.md](shared-contracts.md) — especially validation/export, repair, user mental model,
  and domain-boundary contracts.

## Tasks

- **Task 0 — refresh the architecture inventory.** Update
  [app-code-organization-review.md](app-code-organization-review.md) so examples match the current
  implementation (`ValidationStep`/`ExportStep`/`RepairActions`, current bad-channel helpers,
  current repair-command names). Do not expand scope; record what is deferred.
- **Task 1 — move app-wide validation and repair routing out of page code.** Create a domain module
  such as `src/domain/validation` or `src/workspace/validation` for `validateDay`,
  `computeStepStatus`, `dayOverrideIssues`, issue ownership maps, `repairTargetForIssue`, and
  `animalEditorStepForFieldPath`. Leave page-only field-blur helpers in the Day Editor. Preserve
  behavior byte-for-byte except for import paths and tests.
- **Task 2 — extract bad-channel and override semantics into pure helpers.** Move multi-shank
  probe-wide bad-channel rules, later-row migration, invalid/stale bad-channel interpretation, and
  malformed/shadowing override cleanup decisions out of React render bodies. Components should render
  and dispatch; pure helpers decide what the converter/export semantics mean.
- **Task 3 — extract the riskiest workspace transitions.** Pull pure transition helpers for:
  updating animal devices while mirroring the latest configuration snapshot, adding/applying/rebuilding
  configuration history, creating days with the latest pin, and updating malformed nested day records
  safely. Keep hydration, autosave, localStorage, and debounce side effects in `useWorkspace`.
- **Task 4 — add architecture guard tests.** Add structural tests that fail if page modules import
  app-wide domain behavior from sibling page folders. Allowed direction: pages import domain/state
  helpers; domain/state helpers do not import page modules.
- **Task 5 — keep the gate behavior identical.** Re-run the existing validation, repairability,
  device, export, golden-baseline, lint, and build gates. Any changed behavior must be deliberate,
  explained, and covered; accidental semantic drift blocks the phase.

## Deliberately not in this phase

- Removing the legacy form path or changing the default route.
- Rewriting the whole store to a reducer.
- Generating a complete type system from `nwb_schema.json`.
- Redesigning the UI or changing export semantics.
- Broad cleanup of unrelated files, CSS, or test fixtures.

## Validation slice

| Test | Asserts |
| --- | --- |
| `domain validation module preserves issue list` *(unit/integration)* | representative valid/invalid days produce the same issue codes, ownership, repair targets, and step statuses before/after extraction. |
| `repair routing imports only domain helpers` *(unit/structural)* | Day Editor, Animal Editor, Export, and RepairActions consume the new domain module; no page-to-page import owns app-wide validation/routing. |
| `bad-channel helper preserves converter semantics` *(unit)* | single-shank bad channels, multi-shank first-row probe-wide bad channels, later-row ignored marks, invalid probe-local ids, and migration behavior match current tests. |
| `override helper matches dayOverrideIssues` *(unit)* | each malformed/stale/shadowing override shape has the same issue, focus path, and repair action as the Devices UI control. |
| `workspace transitions preserve configuration invariants` *(unit)* | device edits mirror the latest snapshot only, reconfiguration pins days correctly, rebuild history clears the raw issue without pretending stale pins are fixed, and malformed session updates write clean records. |
| `architecture guard` *(unit/structural)* | domain/state modules do not import page modules; pages do not import app-wide domain behavior from sibling page folders. |
| `golden-yaml.baseline.test.js` | legacy baselines remain byte-identical. |
| `npm test`, `npm run lint`, `npm run build` | full test/lint/build gates pass before Phase 9 starts. |

## Review

`pr-review-toolkit:code-reviewer`; `pr-review-toolkit:pr-test-analyzer`; `pr-review-toolkit:silent-failure-hunter`.
Confirm: the phase is behavior-preserving, page components are thinner, domain helpers are pure/tested,
repair ownership still lands on visible/executable controls, and Playwright Phase 9 can treat the extracted
contracts as stable.
