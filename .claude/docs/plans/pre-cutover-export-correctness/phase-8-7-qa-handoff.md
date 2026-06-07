# Phase 8.7 → Phase 9 QA handoff

**Phase 8.7 — Ownership defaults & day configurability UX.** Status: **complete** (Tasks 0–11),
each task verified (full suite, lint, build, byte-identical golden baselines) and code-reviewed.
This note is the Task 11 handoff: what was built, where it's proven, what's deliberately deferred,
and the exact browser scenarios Phase 9 should sample.

Binding promise of the phase: **blast-radius transparency + no silent retroactive change.** Every
ownership decision is legible at the point of action, and no edit path silently rewrites an
already-recorded day.

## Source-of-truth artifacts

- **Ownership matrix** — [workflow-ownership-matrix.md](workflow-ownership-matrix.md): per exported
  section, the owner, day behavior, state path, export source, edit surface, repair target,
  misconception, and test coverage.
- **Screen map** — [workflow-screen-map.md](workflow-screen-map.md): per route/step/modal/empty
  state/repair path, the user job, attention target, primary action, next/return action, ownership
  cue, and mistake-prevention responsibility. The reconciliation table at the bottom records each
  row's done/deferred status against the target labels.
- **Ownership descriptor (code)** — [src/domain/workflowOwnership.js](../../../../src/domain/workflowOwnership.js):
  the single `OWNERSHIP_PATTERN_META` table mapping issue codes / field paths / sections to the
  ownership pattern, plain-language label, visible cue, edit surface, day-behavior copy, and safe
  primary action. UI reads this; it never invents local ownership copy.

## Acceptance-row coverage map (jsdom/Vitest)

| Acceptance row | Proven by |
| --- | --- |
| `workflowOwnership helper` (unit + completeness) | [src/domain/__tests__/workflowOwnership.test.js](../../../../src/domain/__tests__/workflowOwnership.test.js) |
| `camera usage / affected-days helpers` (unit, incl. golden full-set regression) | [src/state/__tests__/cameraUsage.test.js](../../../../src/state/__tests__/cameraUsage.test.js) |
| `Animal Editor IA labels` (component) | [AnimalEditorStepper.test.jsx](../../../../src/pages/AnimalEditor/__tests__/AnimalEditorStepper.test.jsx) |
| `ownership cues at point of action` (component) | AnimalProfileSection, DataAcqSection, DayTechnicalSection, CamerasSection tests |
| `blast-radius transparency / no silent retroactive` (component) | AnimalProfileSection, HardwareConfigStep tests (the latter exercises CameraReferenceDialog); [cameraUsage.test.js](../../../../src/state/__tests__/cameraUsage.test.js) (`findCameraAffectedDays`) |
| `day technical defaults vs overrides` (component/unit) | [DayTechnicalSection.test.jsx](../../../../src/pages/DayEditor/__tests__/DayTechnicalSection.test.jsx) |
| `animal profile and weight ownership` (component/integration) | [AnimalProfileSection.test.jsx](../../../../src/pages/AnimalEditor/__tests__/AnimalProfileSection.test.jsx), [OverviewStep.test.jsx](../../../../src/pages/DayEditor/__tests__/OverviewStep.test.jsx) |
| `camera catalog identity` (component/export/unit) | CameraModal.identityGuidance, CamerasSection, TasksTable, cameraUsage tests; golden baselines |
| `behavioral event ownership` (component/integration) | [BehavioralEventsDisplay.test.jsx](../../../../src/pages/DayEditor/__tests__/BehavioralEventsDisplay.test.jsx), [BehavioralEventsSection.test.jsx](../../../../src/pages/AnimalEditor/__tests__/BehavioralEventsSection.test.jsx), [src/validation/__tests__/behavioralEvents.test.js](../../../../src/validation/__tests__/behavioralEvents.test.js) |
| `opto ownership` (component/integration) | [FsGuiSection.test.jsx](../../../../src/pages/DayEditor/__tests__/FsGuiSection.test.jsx), [rulesValidation.test.js](../../../../src/validation/__tests__/rulesValidation.test.js) (opto-free day valid), [optoStatus.test.js](../../../../src/domain/__tests__/optoStatus.test.js) |
| `lifecycle cleanup actions` (component/unit) | [AnimalWorkspace.lifecycle.test.jsx](../../../../src/pages/AnimalWorkspace/__tests__/AnimalWorkspace.lifecycle.test.jsx) |
| `repair/preflight ownership wording` (component) | [IssueOwnershipHint.test.jsx](../../../../src/pages/DayEditor/__tests__/IssueOwnershipHint.test.jsx), RepairActions + ValidationStep tests |
| `batch row scan contract` (component) | [ValidationSummary.test.jsx](../../../../src/pages/ValidationSummary/__tests__/ValidationSummary.test.jsx) (Setup column), [ExportStep.test.jsx](../../../../src/pages/DayEditor/__tests__/ExportStep.test.jsx) (preflight), [optoStatus.test.js](../../../../src/domain/__tests__/optoStatus.test.js) |
| `golden baselines` (regression) | [src/__tests__/baselines/](../../../../src/__tests__/baselines/) — 125 assertions byte-identical; `resolveDayCameraUsage` full-set regression in cameraUsage.test.js |

## Deferred / unresolved ownership decisions (carry into Phase 9+)

1. **Versioned recording system (data-acq).** One recording system per animal; a mid-study hardware
   swap cannot yet be represented per day. The Animal Editor shows an explicit "future capability"
   notice (Task 3); there is no per-day data-acq version. Future named exception with regenerated
   fixtures + trodes_to_nwb coordination (see ownership matrix).
2. **Workspace day rows lack scan fields.** The Validation Summary rows now carry the batch-row scan
   fields (config version · cameras · opto state — Task 10); the **Animal Workspace** day rows still
   show only state chips (Draft/Validated/Exported). A smaller catch-up if desired (screen-map row).
3. **Opto preflight vs. editor copy** is now consistent (Task 10 shared `describeDayOptoState`), but
   the three-state label wording is new — Phase 9 should eyeball it in-browser against the FsGUI
   editor copy for tone match.

## Exact Phase 9 browser scenarios to sample

Phase 9 ([phase-9-playwright-qa-pass.md](phase-9-playwright-qa-pass.md), Tasks 4.5/4.6) should run
these against `npm run start` (localhost). Each lists the route + the 8.7 behavior to confirm
visually (jsdom proves the logic; the browser pass proves it reads right and nothing is clipped).

1. **Same-day path** — create one animal, set up electrodes from the Workspace checklist
   (`#/workspace` → "Set Up Electrodes"), add one recording day, review it (`#/day/:id`), export.
   Confirm: no repeated setup entry; the Export preflight (`Export` step) shows the scan summary
   incl. `Optogenetics: No optogenetics` and `Configuration version: Version 1 (current)`.
2. **Catch-up path** — animal with several days; open the Validation Summary (`#/validation`).
   Confirm: each readable row's **Setup** column shows `config vN · N cameras · <opto state>`; days
   are comparable without opening each; the batch-export preflight lists the same per-day scan line.
3. **Setup-repair path** — a day with an export-blocking error (e.g. empty electrode location). In
   the day `Validation` step, confirm: the issue shows the ownership hint
   `Pin or fix the configuration version` **+ "Affects more than this day"**, grouped under its
   workflow category, with the canonical `Fix in Animal Setup → Electrodes & Ephys` route button.
   A non-blocking warning shows NO ownership hint.
4. **Reconfiguration path** — edit electrode geometry mid-study; confirm the reconfiguration confirm
   enumerates the affected day range before commit (no silent retroactive rewrite), and a referenced
   camera edit defaults to a NEW identity (CameraReferenceDialog) leaving past-day exports unchanged.
5. **Destructive cleanup path** — from `#/workspace`, the secondary `Delete animal…` (danger zone)
   and per-row `Delete day…`. Confirm: the destructive `alertdialog` names the animal/day + cascade
   count + the "workspace metadata only — does not delete downloaded YAML / NWB / DANDI / Spyglass"
   caveat for an exported day; cancelling leaves everything intact.
6. **Opto-free day (no false errors)** — an opto-implanted animal records a day with empty
   `fs_gui_yamls`. Confirm: the day's `Optogenetics run this day (FsGUI protocols)` section reads
   "No optogenetic stimulation recorded for this day — a normal, valid state", validation raises NO
   opto error, and the Export preflight reads `Implanted, no stimulation this day`. A second day with
   FsGUI on selected epochs reads `Stimulation on epoch(s) …`.

## Gates (all green at handoff)

`npx vitest run` (full suite), `npx vitest run baselines` (125 byte-identical), `npm run lint`
(0 errors), `npm run build`. Run before merging Phase 8.7 and again at the start of Phase 9.
