# Phase 11 — Professional UX polish audit (Claude-executable)

[← back to PLAN.md](PLAN.md) · [overview](overview.md) · [screen map](workflow-screen-map.md) · [shared-contracts](shared-contracts.md#professional-ux-quality-contract)

Goal: apply the kind of final professional web-product polish a senior frontend/UX engineer would do before
cutover. Phase 10 proves behavior is correct and recoverable; this phase proves the workspace UI is coherent,
predictable, accessible, and visually/interactionally consistent enough for repeated scientific use. This is
this plan's Phase 11, **not** the separate v3-workspace-cutover Phase 11 default-route flip.

**Inputs to read first:**

- Phase docs 1–10, especially Phase 9/10 artifacts and any screenshots/traces/finding logs.
- [workflow-clarity-design.md](workflow-clarity-design.md) — required workflow/information architecture for
  electrode setup discoverability, existing-data review, Day Devices meaning, reconfiguration clarity, and
  export preflight alignment.
- [workflow-screen-map.md](workflow-screen-map.md) — screen-to-user-job contract for route labels, step labels,
  modals, empty states, repair paths, and destructive confirmations. The polish pass should refine against
  this map, not rebuild a competing inventory; include its state-specific primary actions and batch-row scan
  contract.
- [src/pages/Home](../../../../src/pages/Home), [src/pages/AnimalWorkspace](../../../../src/pages/AnimalWorkspace),
  [src/pages/AnimalEditor](../../../../src/pages/AnimalEditor), and
  [src/pages/DayEditor](../../../../src/pages/DayEditor) — primary workspace screens.
- [src/components/Modal](../../../../src/components/Modal), shared form controls, table/list components, and
  editor SCSS files — component/interaction consistency surfaces.
- [playwright.config.js](../../../../playwright.config.js) and [e2e](../../../../e2e) — screenshot and
  browser-driving harness.
- Existing docs on testing/CI for artifact retention if a polish run adds screenshots or reports.

**Contracts referenced:**

- [User mental-model contract](shared-contracts.md#user-mental-model-contract) — polish decisions must support
  how users understand animals, recording days, rigs, configurations, and export readiness.
- [UX mistake-prevention contract](shared-contracts.md#ux-mistake-prevention-contract) — dangerous mistakes
  stay hard to make accidentally.
- [Professional UX quality contract](shared-contracts.md#professional-ux-quality-contract) — consistency,
  accessibility, layout, content, and perceived-performance requirements added for this phase.

## Tasks

- **Task 0 — workflow and screen-coherence gate.** Before general polish, verify and fix the core user workflow
  from [workflow-clarity-design.md](workflow-clarity-design.md) and the screen/user-job contract from
  [workflow-screen-map.md](workflow-screen-map.md). A user must be able to discover electrode setup
  from the animal workspace, understand that Animal Editor hardware is shared animal setup, understand that
  Day Editor Devices is the current day's configuration version plus day-specific failed channels, and know
  what to do when existing/imported data already has days/configurations. Required states: new animal with no
  days; animal with days but no electrodes; imported/recovered animal with existing configuration; Day Devices
  empty state; historical configuration; reconfiguration starting from a day. Fix small routing/copy/layout
  gaps immediately; log larger information-architecture gaps as `blocks safe use` unless explicitly accepted.
- **Task 1 — screen/state inventory.** Generate a checklist of every workspace screen and major state:
  Home create/edit, Animal Workspace, Animal Editor steps, Day Editor steps, modals, empty states, validation
  summary, Export/preflight, persistence/recovery notices, opto off/on, and destructive confirmations. Start
  from `workflow-screen-map.md`; mark which mapped states have screenshots and which have direct tests. For
  each screen, record the user's likely goal, the mental model the UI should reinforce, and the most dangerous
  misconception the screen must prevent. Include `#/workspace` with no selected animal, missing setup,
  setup-complete/no-days, recovered data, invalid days, ready days, historical configuration, reconfiguration,
  export-blocked, export-ready, and batch row scan states.
- **Task 2 — design-system and interaction consistency audit.** Compare Add/Edit/Delete/Save/Cancel/Close,
  modal titles/actions, table actions, segmented/checkbox/select/radio controls, validation summaries,
  disabled states, status badges, save indicators, and repair links across screens. Fix small inconsistencies
  where obvious; otherwise log them with route/component/severity. Required: safe primary action must be
  visually primary in dangerous identity/reconfiguration/opto flows.
- **Task 3 — form quality audit.** For each high-risk form field, verify label, unit, example, required vs.
  optional state, validation timing, disabled-state reason, and persisted/exported meaning. Required fields:
  `meters_per_pixel`, `lens`, camera name, data-acq name/system/amplifier/adc_circuit, species, DOB, weight,
  region/location, device type, bad channels, task/video camera/epoch refs, optogenetics enabled sections, and
  technical voltage/time fields.
- **Task 4 — visual hierarchy and context audit.** Verify users always know the active animal, day/session,
  configuration version, saved/unsaved state, validation state, and export readiness. The preflight summary
  must be scannable and must not bury cameras/calibrations, probes/bad channels, task/video refs, or opto
  state. Hierarchy should match the user's mental model: animal/day first, recording configuration next,
  scientific sections next, schema/downstream details only where needed. Fix hierarchy/copy issues that are
  small and local.
- **Task 5 — responsive layout and overflow audit.** Use Playwright screenshots at desktop, tablet-ish, and
  narrow mobile widths. Check for clipped labels, text overflow in buttons/badges/cards/tables, modals taller
  than viewport without usable scrolling, table action wrapping, overlapping validation/preflight content, and
  nested-card clutter. Add focused regression assertions for any fixed layout bug.
- **Task 6 — objective accessibility polish audit.** Beyond basic keyboard reachability, run named
  route/state checks for at least: Home create form; Animal Editor camera, data-acq, and electrode modals; Day
  Editor task/video editor, validation summary, Export/preflight; and the opto-enabled editor. For each
  route/state assert keyboard path order to primary/cancel/destructive actions, visible focus, modal focus
  trap/return, accessible names for icon/compact buttons, required/invalid field label + error associations,
  save/validation/export status changes through `role="status"`, `aria-live`, `role="alert"`, or another
  documented accessible announcement pattern, status text/icon semantics beyond color alone, computed contrast
  of at least 4.5:1 for text and 3:1 for focus/non-text status indicators, reduced-motion behavior, and no
  keyboard-only dead ends.
- **Task 7 — content-design pass.** Replace schema/internal jargon with user-facing scientific language where
  possible while preserving precision. Check that error messages name the consequence and next action; empty
  states tell users what to do next; destructive confirmations preview what will change; and help text is close
  to the relevant control rather than buried in docs.
- **Task 8 — perceived-performance and confidence audit.** Confirm autosave/validation/export feedback is
  timely and unambiguous; long or complex editors do not appear frozen; repeated validation does not flicker;
  download/export has clear progress/failure states; and users can tell whether changes are saved before
  navigation/reload.
- **Task 9 — produce UX polish report and fix log.** Create `docs/qa/pre-cutover-professional-ux-polish.md`
  or equivalent with screenshot links, commands run, pass/fail checklist, fixes made, remaining UX debt by
  severity (`blocks safe use`, `likely confusion`, `polish`), and cutover recommendation. Block cutover on
  `blocks safe use` findings.

## Deliberately not in this phase

- **Human usability study** — still recommended separately, but this phase must be executable by Claude Code.
- **Large redesign or design-system rebuild** — this phase may fix small consistency, layout, copy, and
  accessibility issues; large redesigns become targeted follow-up work.
- **Changing scientific/export semantics** — this phase improves presentation and interaction quality; rule
  changes go back to the owning correctness phase/contract.
- **Broad visual snapshot baseline expansion** — screenshots are audit artifacts and targeted regressions, not
  a blanket pixel-test suite.

## Validation slice

| Test / Artifact | Asserts |
| --- | --- |
| `workflow and screen-coherence gate` *(QA artifact + fixes)* | new/existing/imported/historical/reconfiguration states from `workflow-clarity-design.md` and top-level route/step/modal/batch-row states from `workflow-screen-map.md` expose the correct visible heading, primary next action, ownership cue, return path, and repair destination. |
| `workspace screen/state mental-model inventory` *(QA artifact)* | every major screen/state from `workflow-screen-map.md` is accounted for with test or screenshot coverage plus user goal, intended mental model, and dangerous misconception. |
| `interaction consistency checklist` *(QA artifact + fixes)* | common actions, modal patterns, destructive confirmations, disabled states, repair links, and status badges behave consistently. |
| `form quality checklist` *(QA artifact + fixes)* | high-risk fields have clear labels, units, examples, required/optional state, validation timing, and disabled-state reasons. |
| `responsive screenshot sweep` *(Playwright/artifacts)* | desktop/tablet/narrow screenshots show no clipped critical controls, incoherent overlap, or unusable modals/tables. |
| `objective accessibility polish sweep` *(Playwright/manual-by-script)* | named route/state list is covered; keyboard path assertions, accessible-name assertions, error-association checks, status-announcement checks, status text/icon semantics, contrast checks at 4.5:1 text and 3:1 focus/non-text thresholds, and reduced-motion/no-animation checks pass or have logged blockers. |
| `content-design audit` *(QA artifact + fixes)* | errors, empty states, help text, confirmations, and preflight summary use clear scientific/user language and next actions. |
| `perceived-performance audit` *(QA artifact + fixes)* | save/validation/export feedback is visible, stable, and confidence-building. |
| `professional UX polish report` *(QA artifact)* | includes commands, screenshots/artifacts, fixes, remaining debt by severity, and cutover recommendation. |

## Fixtures

Reuse Phase 9/10 scenario fixtures and screenshots. Add only small fixture variants needed to expose layout,
content, and interaction states: long subject/session names, long camera/task names, many cameras/tasks,
historical configuration labels, validation summaries with several errors, and opto enabled with all sections.

## Review

`ux-reviewer`; `pr-review-toolkit:code-reviewer`; accessibility-focused review if available. Confirm: fixes
stay scoped and do not change export semantics; required controls are understandable and consistent; screenshots
cover desktop and narrow widths; accessibility checks are more than "can tab"; remaining UX debt is severity
ranked; screen-map mismatches are fixed or severity-ranked; `blocks safe use` findings block cutover.
