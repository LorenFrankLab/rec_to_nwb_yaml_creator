# Phase 8.6 — Workflow clarity and setup UX

[<- back to PLAN.md](PLAN.md) · [overview](overview.md) · [workflow clarity design](workflow-clarity-design.md) · [mental-model contract](shared-contracts.md#user-mental-model-contract) · [UX contract](shared-contracts.md#ux-mistake-prevention-contract)

Goal: make the corrected workspace path understandable before browser QA. Phases 1-8 fixed
export correctness; Phase 8.5 moved the risky contracts into domain/state helpers. This phase
uses those contracts to make the intended user workflow visible: animal setup first, recording-day
metadata second, day-specific failed channels, hardware changes by day range, then export.

This is a workflow/information-architecture phase, not a scientific-semantics rewrite. The app
should become harder to use in the wrong order, but exported YAML semantics must stay owned by the
earlier correctness phases.

**Inputs to read first:**

- [workflow-clarity-design.md](workflow-clarity-design.md) — the source design note for the
  user mental model, required states, and Claude-executable implementation tasks.
- [shared-contracts.md](shared-contracts.md#user-mental-model-contract) and
  [shared-contracts.md](shared-contracts.md#ux-mistake-prevention-contract) — the cross-phase
  mental-model and mistake-prevention contracts.
- [phase-8-5-domain-boundaries-ownership-cleanup.md](phase-8-5-domain-boundaries-ownership-cleanup.md)
  — the domain/state boundaries this phase should build on, not undo.
- `src/domain/validation.js`, `src/state/workspaceTransitions.js`,
  `src/state/workspaceUtils.js`, and `src/state/workspaceSelectors.js` — current sources of
  validation ownership, configuration versions, export resolution, and safe raw-state reads.
- `src/pages/AnimalWorkspace`, `src/pages/AnimalEditor`, `src/pages/DayEditor/DevicesStep.jsx`,
  `src/pages/DayEditor/ValidationStep.jsx`, and `src/pages/DayEditor/ExportStep.jsx` — the
  user-facing surfaces this phase aligns around one workflow.

## Mental-model rule for every task

Before changing a screen, write down:

- the user's goal,
- the likely misconception,
- the dangerous mistake that misconception can cause,
- the next safe action the UI should offer.

The implementation should encode those answers in visible state, labels, action text, repair
routing, and tests. Do not add hidden schema/internal language as a substitute for workflow
clarity.

## Tasks

- **Task 0 — route/state workflow inventory.** Create or refresh a short artifact from
  [workflow-clarity-design.md](workflow-clarity-design.md) that covers at least:
  new animal, animal with no electrodes, animal with existing days, imported/recovered workspace,
  historical day, and reconfiguration start day. For each state, record user goal, expected next
  action, dangerous misconception, current route/control, and required change. This is the map the
  rest of the phase implements.

- **Task 1 — add a workflow-status domain helper.** Add a pure helper such as
  `src/domain/workflowStatus.js` for user-facing setup/readiness state. It should derive, from
  animal/day/workspace state and existing validation issues, stable categories such as:
  `needs_electrodes`, `review_electrodes`, `needs_camera_calibration`, `needs_data_acq`,
  `has_existing_days`, `uses_historical_configuration`, `ready_for_failed_channels`,
  `blocked_by_repair`, and `ready_for_export_preflight`. It should return labels/action targets
  in user workflow terms, not AJV paths. Components render and dispatch; this helper decides the
  workflow state.

- **Task 2 — animal workspace setup checklist.** Make the Animal Workspace the operational home
  for setup. Add or revise a setup summary with first-class items for Subject, Electrodes/Probes,
  Cameras/Calibration, Data Acquisition, and Recording Days. The missing-electrode primary action
  must be `Set Up Electrodes`; imported/existing setup should say `Review Electrodes` /
  `Review Cameras`; setup errors should route to the owning Animal Editor step.

- **Task 3 — Animal Editor setup context.** Make the Animal Editor read as shared animal setup,
  not a detached hardware form. Ensure the first-step labels and banners make electrodes/probes
  discoverable. Camera guidance must teach the Spyglass identity rule: a camera with different
  zoom/calibration/lens/model/id needs a different camera name. Reconfiguration context banners
  should say when the user is editing configuration `vN` and how many moved days use it.

- **Task 4 — Day Devices workflow rewrite.** Make the Day Editor Devices step explain the current
  day's relationship to animal setup:
  `This day uses animal electrode configuration vN`, `Edit shared animal electrode setup`,
  `Hardware changed starting this day`, and `Mark failed channels for this recording day`.
  Empty/no-electrode state must route to `Set Up Electrodes` and explain that failed channels can
  be marked only after electrodes exist. Historical configurations must be visibly historical.
  Stale/corrupt overrides must use day-language repair controls, not schema-language controls.

- **Task 5 — existing-data review state.** When a loaded/imported workspace has days,
  configuration history, recovered data, missing electrodes, missing cameras, missing day pins, or
  raw-shape repair issues, show a review/checklist state before export. Do not let recovered data
  look silently trusted. Export remains blocked by the existing validation gate until required
  repair/setup state is clean.

- **Task 6 — validation and export workflow categories.** Group Validation and Export repair
  summaries by user workflow category: Animal setup, Day metadata, Day-specific failed channels,
  Existing data repair, and Export/preflight. The setup-checklist vocabulary is carried by the
  category **headings** over each repair group (and by the checklist action verbs `Set Up
  Electrodes` / `Review Cameras` on the Workspace + Day Devices empty state); the per-issue repair
  **buttons** keep the canonical `repairTargetForIssue` labels and routing from
  `src/domain/validation.js` ("Fix in Animal Editor → …", "Fix in Devices") — the heading above
  each button supplies the workflow context, so the button text is not reworded per category. This
  is the single contract (the `workflow-clarity-design.md` "Validation and Export" section matches
  it; see also the Phase 8.6 entry in `docs/REFACTOR_CHANGELOG.md`).

- **Task 7 — preflight alignment.** Make Export preflight echo the setup checklist and Day Devices
  context: animal/day/session, configuration version and historical/current status, probes and
  failed channels, cameras/calibrations, data-acq device, tasks/videos, optogenetics, and unresolved
  review/repair risk. Preflight should read as a confidence check for conversion/DANDI/Spyglass,
  not only as a schema summary.

- **Task 8 — tests, QA handoff, and artifact.** Add focused unit/component tests for the workflow
  helper and rendering states, plus Playwright-ready route/state coverage where practical. Update
  `docs/REFACTOR_CHANGELOG.md` or a linked QA note with the workflow inventory, screenshots or
  route-state notes, and any debt that should be checked in Phase 9/10/11.

## Deliberately not in this phase

- Changing export semantics, schema/rule validation, or downstream converter behavior.
- Removing the legacy form path or changing the default route.
- Rewriting the whole store to a reducer or introducing a full design system.
- Broad visual polish that is not needed for workflow clarity.
- Human lab-user usability testing. Recommended separately, but this phase must be executable by
  Claude Code with code inspection, tests, screenshots, and browser checks.

## Validation slice

| Test / artifact | Asserts |
| --- | --- |
| `workflow route/state inventory` *(artifact)* | new, existing, imported/recovered, historical, and reconfiguration states have user goal, next action, dangerous misconception, and route/control mapped. |
| `workflowStatus helper` *(unit)* | setup/readiness categories derive consistently from animal/day/workspace state and validation issues without reading page components. |
| `animal workspace setup checklist` *(component/Playwright-ready)* | a new animal and an animal with days but no electrodes show `Set Up Electrodes` as the primary action; existing setup shows review actions. |
| `electrode setup discoverability` *(component/Playwright-ready)* | users can reach electrode setup from Workspace and Day Devices empty state without guessing that the Animal Editor owns probes. |
| `day devices mental model` *(component)* | current/historical configuration, shared setup edit, reconfiguration, and day-specific failed-channel actions are distinct and correctly labeled. |
| `existing data review` *(unit/component)* | imported/recovered workspaces with days/configurations or missing/corrupt setup show review/repair state and do not hide data behind empty states. |
| `validation/export workflow grouping` *(unit/component)* | issues group by user workflow category while repair actions still route through the canonical domain repair target. |
| `preflight alignment` *(component)* | preflight names animal/day/configuration version, probes, failed channels, cameras/calibrations, data-acq, tasks/videos, opto state, and unresolved review risk. |
| `npm test`, `npm run lint`, `npm run build` | full gates pass before Phase 9 starts; Phase 9 Playwright scenarios are updated to include the new workflow states. |

## Review

`pr-review-toolkit:code-reviewer`; `ux-reviewer`; `pr-review-toolkit:pr-test-analyzer`.
Confirm: the workflow state is derived from domain helpers, not page-local guesses; user-facing
actions name the next safe step; electrode setup is discoverable before day export; existing data
has an explicit review state; validation/export categories match the setup checklist; and Phase 9
can test the integrated workflow in a browser without inventing missing mental-model context.
