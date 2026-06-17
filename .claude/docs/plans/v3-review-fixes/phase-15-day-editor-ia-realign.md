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
Export), one clean **single-column** section per panel, **subject + recording-system inherited read-only**,
the day view scoped to the **day-delta only**.

This is presentation/IA only — **byte-identity holds**: every field still serializes the same; only the
nav shape, section grouping, layout, and *edit affordances* change (animal-static facts are already derived
from the animal at export-merge, so making them read-only on the day view doesn't change valid output).

**Inputs to read first:**

- [src/pages/DayEditor/DayEditor.scss:84-88](../../../src/pages/DayEditor/DayEditor.scss) — `.day-editor-body { grid-template-columns: 230px 1fr }` (the vestigial rail column the horizontal tabs are jammed into); [:254-258](../../../src/pages/DayEditor/DayEditor.scss) — `.form-grid { repeat(auto-fit, minmax(250px,1fr)) }` (the 3-column session cram).
- [src/pages/DayEditor/DayEditorFrame.module.css:60-66](../../../src/pages/DayEditor/DayEditorFrame.module.css) — `.tabBar { flex-direction:row; flex-wrap:wrap }` (wraps into the 230px column).
- [src/viewModels/dayEditorViewModel.ts:89-105,161-198](../../../src/viewModels/dayEditorViewModel.ts) — `DayTabKey = 'day'|'epochs'|'channels'|'dio'`; the `STEP_ORDER` + tab→step join (`:193-198`, DIO at `:197`). This is the gate/validation substrate to **regroup, not discard**.
- [src/pages/DayEditor/DayEditorFrame.tsx:48,414-423,449-455](../../../src/pages/DayEditor/DayEditorFrame.tsx) — the tab-bar render + the DIO tab.
- [src/pages/DayEditor/DayTab.tsx:374-510](../../../src/pages/DayEditor/DayTab.tsx) — the editable Date-of-Birth/Species/Description that write through to the animal; [DayTechnicalSection.tsx](../../../src/pages/DayEditor/DayTechnicalSection.tsx) — the editable header-path/units (rig-const).
- [src/pages/AnimalView/SectionNav.tsx](../../../src/pages/AnimalView/SectionNav.tsx) + `SectionNav.module.css` — the **existing grouped vertical-rail with status rings** to reuse (don't build a new rail).
- **Coordination:** Phase 13 provides the per-section status model (rollup + DRAFT) the rail renders; **Phase 14's "day-view subject read-only card" task is absorbed here** → trim Phase 14 to wizard first-run completeness only.

## Tasks

- **Render the nav as a grouped vertical rail** (fixes points 1, 4, 5 together). Replace the wrapping
  horizontal `.tabBar` with a vertical rail in the 230px column, reusing the AnimalView `SectionNav`
  pattern (grouped headers SESSION / RECORDING / FINISH, one section per row, per-section status badge
  from Phase 13's rollup, roving-tabindex + `aria-current`). Keep the `STEP_ORDER` gate substrate; this
  is a *view* change over the same steps.
- **Regroup the sections to the mock's five** — **Overview** (session_id read-only, session_description,
  experiment_description, day note), **Files & Weight** (associated files + recording-day weight),
  **Devices & Failed Channels** (the device/rig summary **+** bad-channels grid — consolidate today's
  split "Setup & Failed Channels" tab and the Day-tab rig-constants into one section), **Tasks & Epochs**
  (the epoch grid), **Validation & Export** (the per-day gate). Map each to the existing steps; no new
  validation logic.
- **Single-column section panels** — drop the 3-column `.form-grid` for these forms (single-column,
  spacious, like the mock); keep grids only where a grid is genuinely right (e.g. the epoch table).
- **Subject + technical params → inherited read-only on the day view** (fixes point 3; absorbs Phase 14's
  day-view scope-card). Render animal-static facts as a **read-only summary** (Session ID greyed,
  "Subject + recording system inherited from the animal") with an **"Edit animal setup"** link to
  AnimalView; remove the day-view write-through to species/DOB/description and the editable
  `DayTechnicalSection` (technical constants are derived/displayed, not edited per day). The day view's
  **editable** body is the day-delta only.
- **Demote DIO out of the top tabs** (point 5) — fold behavioral-events into the RECORDING group (a
  sub-section or a collapsed panel), since DIO is rare/animal-typical (carry-forward, seldom changed). It
  stays reachable and day-owned; it is not a peer of Overview/Epochs.
- **Remove animal-static "setup" nudges from the day view** — "Set Up Electrodes"/recording-system
  prompts belong on AnimalView, not the day screen (point 4 / point 7).
- **Docs.** CHANGELOG: the day editor now matches the mock — a grouped vertical rail, single-column
  sections, subject/recording-system inherited read-only, DIO folded into RECORDING, and the day view
  scoped to the day-delta. Update the relevant mockup-reference note if one is cited in code (don't cite
  this plan in code).

## Deliberately not in this phase

- The validation **presentation/timing** (grouping, DRAFT, humanize) — **Phase 13** (this phase *renders*
  its status in the rail).
- The **wizard** first-run completeness — **Phase 14** (now scoped to the wizard only; its day-view
  read-only task moves here).
- The zero-days duplicate "Add recording day" + the setup-card gating — **Phase 1** (AnimalView/days-list,
  not the day editor).
- Any change to the exported YAML, the validation rules, or the gate substrate (`STEP_ORDER`).

## Validation slice

| Test | Asserts |
| --- | --- |
| `DayEditorFrame` (extend) | the nav renders as a vertical grouped rail (SESSION/RECORDING/FINISH), one section per row, no horizontal wrap; each section shows its status; `aria-current`/roving-tabindex preserved |
| section regrouping (extend) | the five mock sections render; each maps to its existing step/gate; the export gate result is unchanged for the same day |
| read-only animal-static (extend) | the day view shows subject + technical params **read-only** with an "Edit animal setup" link; there is **no** control that writes species/DOB/description or technical constants from the day view |
| DIO placement (extend) | DIO is not a top-level rail item; it is reachable within RECORDING and stays day-owned/carry-forward |
| layout (e2e/visual) | at 1280×720 the rail does not wrap and the Overview is single-column |
| `baselines` | byte-identical (presentation/IA + edit-affordance only; no export or rule change) |

## Fixtures

Reuse `DayEditorFrame` / `DayTab` test fixtures + the configured-workspace e2e helper; a day on a
fully-configured animal to exercise the read-only inherited section and each regrouped section.

## Review

Dispatch `code-reviewer` against the diff. Confirm:
- The nav matches the mock (grouped vertical rail, no wrap); sections regrouped to the mock's five; single-column panels.
- Subject + technical params are read-only on the day view (no write-through); the only edit path is AnimalView; the day view surfaces the day-delta.
- The `STEP_ORDER` gate substrate + every validation result is unchanged; `npx vitest run baselines` byte-identical.
- Coordinated with Phase 13 (status rollup) and Phase 14 (read-only task moved here, not duplicated).
- Full gate green; no trivial tests; code/docstrings don't cite this plan; CHANGELOG updated.
