# Phase 15 — Day Editor IA realignment (to the finalized mock)

[← back to PLAN.md](PLAN.md) · [overview](overview.md)

The largest UX phase, and the highest-leverage: the day editor is the **daily** path, and it was left
**mid-refactor** — diverged from the finalized mockup
([../../plans/scope-tiers-ia/tabbed-day-editor-mockup.png](../scope-tiers-ia/tabbed-day-editor-mockup.png),
`mockup-tabbed-day-editor.html`). A horizontal tab bar was dropped into the *vestigial* 230px grid column
that used to hold the vertical rail, so the nav crams/wraps; the "Day" tab piles session + files + weight
+ **editable technical params** + **editable inherited subject metadata** into one cramped panel; DIO is a
top-level tab the mock doesn't have; and animal-static "setup" nudges leak onto the day view. Full visual
diagnosis + screenshots + measured geometry:
[../../research/yaml-corpus-2/14-day-screen-vs-mock.md](../../research/yaml-corpus-2/14-day-screen-vs-mock.md).

**Intended (mock):** a **left vertical rail**, sections stacked one-per-row, grouped **SESSION** (Overview ·
Files & Weight) / **RECORDING** (Devices & Failed Channels · Tasks & Epochs) / **FINISH** (Validation &
Export), one clean **single-column** section per panel, **subject + recording-system rig constants
inherited read-only**, day-owned technical fields still editable, and the day view scoped to the
**day-delta only**.

This is presentation/IA only — **byte-identity holds**: every field still serializes the same; only the
nav shape, section grouping, layout, and animal-static *edit affordances* change. Day-owned facts
(`default_header_file_path`, `units`, DIO, files, tasks/epochs, weight, etc.) stay editable on the day.

**Inputs to read first:**

- [src/pages/DayEditor/DayEditor.scss:84-88](../../../../src/pages/DayEditor/DayEditor.scss) — `.day-editor-body { grid-template-columns: 230px 1fr }` (the vestigial rail column the horizontal tabs are jammed into); [:254-258](../../../../src/pages/DayEditor/DayEditor.scss) — `.form-grid { repeat(auto-fit, minmax(250px,1fr)) }` (the 3-column session cram).
- [src/pages/DayEditor/DayEditorFrame.module.css:60-66](../../../../src/pages/DayEditor/DayEditorFrame.module.css) — `.tabBar { flex-direction:row; flex-wrap:wrap }` (wraps into the 230px column).
- [src/viewModels/dayEditorViewModel.ts:89-105,161-198](../../../../src/viewModels/dayEditorViewModel.ts) — `DayTabKey = 'day'|'epochs'|'channels'|'dio'`; the `STEP_ORDER` + tab→step join (`:193-198`, DIO at `:197`). This is the gate/validation substrate to **regroup, not discard**.
- [src/pages/DayEditor/DayEditorFrame.tsx:48,414-423,449-455](../../../../src/pages/DayEditor/DayEditorFrame.tsx) — the tab-bar render + the DIO tab.
- [src/pages/DayEditor/DayTab.tsx:374-510](../../../../src/pages/DayEditor/DayTab.tsx) — the editable Date-of-Birth/Species/Description that write through to the animal; [DayTechnicalSection.tsx](../../../../src/pages/DayEditor/DayTechnicalSection.tsx) — rig constants are already read-only, while `default_header_file_path` and `units` are editable day facts. [workflowOwnership.ts:240-267](../../../../src/domain/workflowOwnership.ts) pins that ownership split.
- [src/pages/DayEditor/DayEditorSectionNav.tsx](../../../../src/pages/DayEditor/DayEditorSectionNav.tsx) + [src/pages/AnimalView/SectionNav.module.css](../../../../src/pages/AnimalView/SectionNav.module.css) — existing section-nav implementation/styles to reuse (don't build a parallel rail).
- **Coordination:** Phase 13 provides the per-section status model (rollup + DRAFT) the rail renders; Phase 14 is wizard-only; this phase owns the day-view read-only animal-static summary.

## Tasks

- **Render the nav as a grouped vertical rail** (fixes points 1, 4, 5 together). Replace the wrapping
  horizontal `.tabBar` with a vertical rail in the 230px column, reusing the AnimalView `SectionNav`
  pattern (grouped headers SESSION / RECORDING / FINISH, one section per row, per-section status badge
  from Phase 13's rollup, roving-tabindex + `aria-current`). Keep the `STEP_ORDER` gate substrate; this
  is a *view* change over the same steps.
- **Regroup the sections to the mock's five** — **Overview** (session_id read-only, session_description,
  experiment_description, day note), **Files & Weight** (associated files + recording-day weight),
  **Devices & Failed Channels** (the device/rig summary **+** day-owned `default_header_file_path`/`units`
  **+** bad-channels grid — consolidate today's split "Setup & Failed Channels" tab and the day technical
  block into one section), **Tasks & Epochs** (the epoch grid), **Validation & Export** (the per-day gate).
  Map each to the existing steps; no new validation logic.
- **Single-column section panels** — drop the 3-column `.form-grid` for these forms (single-column,
  spacious, like the mock); keep grids only where a grid is genuinely right (e.g. the epoch table).
- **Animal-static facts + rig constants → inherited read-only; day-owned technical stays editable.**
  Render animal-static facts as a **read-only summary** ("Subject + recording system inherited from the
  animal") with an **"Edit animal setup"** link to AnimalView; remove the day-view write-through to
  species/DOB/description and keep recording-system rig constants derived/displayed, not edited per day.
  Keep `default_header_file_path` and `units` editable on the day because they are day facts. The day
  view's **editable** body is the day-delta only.
- **Demote DIO out of the top tabs** (point 5) — fold behavioral-events into the RECORDING group as a
  clearly labeled carry-forward/diff sub-section. DIO is common, but usually reviewed as a day-owned
  delta rather than authored from scratch; keep an obvious "changed wiring today" path and show the
  carried-forward source so it stays auditable without becoming a top-level rail peer of Overview/Epochs.
- **Remove animal-static "setup" nudges from the day view** — "Set Up Electrodes"/recording-system
  prompts belong on AnimalView, not the day screen (point 4 / point 7).
- **Docs.** CHANGELOG: the day editor now matches the mock — a grouped vertical rail, single-column
  sections, subject/recording-system rig constants inherited read-only, day-owned technical fields still
  editable, DIO folded into RECORDING, and the day view scoped to the day-delta. Update the relevant
  mockup-reference note if one is cited in code (don't cite this plan in code).

## Deliberately not in this phase

- The validation **presentation/timing** (grouping, DRAFT, humanize) — **Phase 13** (this phase *renders*
  its status in the rail).
- The **wizard** first-run completeness — **Phase 14** (wizard only).
- The zero-days duplicate "Add recording day" + the setup-card gating — **Phase 1** (AnimalView/days-list,
  not the day editor).
- Any change to the exported YAML, the validation rules, or the gate substrate (`STEP_ORDER`).

## Validation slice

| Test | Asserts |
| --- | --- |
| `DayEditorFrame` (extend) | the nav renders as a vertical grouped rail (SESSION/RECORDING/FINISH), one section per row, no horizontal wrap; each section shows its status; `aria-current`/roving-tabindex preserved |
| section regrouping (extend) | the five mock sections render; each maps to its existing step/gate; the export gate result is unchanged for the same day |
| read-only animal-static / technical ownership (extend) | the day view shows subject facts + rig constants **read-only** with an "Edit animal setup" link; there is **no** control that writes species/DOB/description or rig constants from the day view; `default_header_file_path` and `units` remain editable day facts |
| DIO placement (extend) | DIO is not a top-level rail item; it is reachable within RECORDING, shows carried-forward source/diff, and stays day-owned with an obvious changed-wiring path |
| layout (e2e/visual) | at 1280×720 the rail does not wrap and the Overview is single-column |
| `baselines` | byte-identical (presentation/IA + edit-affordance only; no export or rule change) |

## Fixtures

Reuse `DayEditorFrame` / `DayTab` / `DayTechnicalSection` test fixtures + the configured-workspace e2e
helper; a day on a fully-configured animal to exercise the read-only inherited section, editable
day-owned technical fields, and each regrouped section.

## Review

Dispatch `code-reviewer` against the diff. Confirm:
- The nav matches the mock (grouped vertical rail, no wrap); sections regrouped to the mock's five; single-column panels.
- Subject facts and rig constants are read-only on the day view (no write-through); `default_header_file_path` and `units` remain editable day facts; the day view surfaces the day-delta.
- The `STEP_ORDER` gate substrate + every validation result is unchanged; `npx vitest run baselines` byte-identical.
- Coordinated with Phase 13 (status rollup) and Phase 14 (wizard-only; no duplicated day-view task).
- Full gate green; no trivial tests; code/docstrings don't cite this plan; CHANGELOG updated.
