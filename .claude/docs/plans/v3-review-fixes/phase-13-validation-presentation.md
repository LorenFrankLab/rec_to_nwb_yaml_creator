# Phase 13 — Validation presentation & reward-early/punish-late (keystone)

[← back to PLAN.md](PLAN.md) · [overview](overview.md)

**Sequence this BEFORE Phases 8–12.** A live UX walkthrough
([../../research/yaml-corpus-2/13-ux-live-walkthrough.md](../../research/yaml-corpus-2/13-ux-live-walkthrough.md))
found that a misconfigured animal already fills the Day Editor banner with ~11 errors, and that fresh
days/epochs fire blocking errors *before the user has opened them*. Phases 8–12 add ~8–10 more issue
types — onto a flat, punish-early banner that would become a ~20-row wall users learn to ignore,
defeating the accuracy work. This phase makes the presentation **absorb** new guards (group + tier +
collapse, with a Warnings tier) and stops firing errors **before the user acts**. No export semantics;
byte-identity holds.

**Inputs to read first:**

- [src/pages/DayEditor/DayEditorFrame.tsx:144-157,407](../../../../src/pages/DayEditor/DayEditorFrame.tsx) — `readinessIssues` (from `validateDay`) feeds the `ReadinessBar`. The banner is the `ReadinessBar` component (locate it under `src/pages/DayEditor/` or `src/components/`) — the surface to group/tier/collapse.
- [src/pages/ValidationSummary/index.tsx:200-302](../../../../src/pages/ValidationSummary/index.tsx) — the **existing** grouped/collapsed-disclosure + `warningsAcknowledged` pattern to mirror onto the day banner (do not invent a new one).
- [src/domain/humanizeValidationMessage.ts](../../../../src/domain/humanizeValidationMessage.ts) — `HUMANIZE_LABELS` + the leading-token sentence-caser; **applied at display** in [src/viewModels/dayEditorViewModel.ts:545](../../../../src/viewModels/dayEditorViewModel.ts). CRITICAL: the file warns the raw AJV `message` is parsed by downstream consumers, so **humanize only the displayed text, never mutate `issue.message`**.
- [src/domain/dayLifecycle.ts:28-34](../../../../src/domain/dayLifecycle.ts) — `DAY_LIFECYCLE` **already has `DRAFT`**; the punish-late fix is to *use* it for untouched days, not invent it.
- [src/viewModels/animalWorkspaceViewModel.ts:62-170](../../../../src/viewModels/animalWorkspaceViewModel.ts) — the day-row status rollup "reuses the export gate, never a recount" → a fresh day shows `Needs fixing` because the gate runs immediately. The place to gate on "touched yet?".
- [src/pages/AnimalEditor/CamerasSection.tsx:154-158](../../../../src/pages/AnimalEditor/CamerasSection.tsx) — the camera calibration warning that fires on an **empty** Cameras step (a punish-early instance). [createAnimalWizardViewModel](../../../../src/viewModels/createAnimalWizardViewModel.ts) — step status (a pre-populated step shows the same green as a user-completed one).

## Tasks

- **Group + tier + collapse the Day Editor banner** (the keystone). Refactor the `ReadinessBar` issue
  list to: (1) **group by section** (Day / Epochs / Failed-channels / DIO / Animal-setup); (2) a
  **severity tier** — `error` shown, `warning` behind a collapsible "N warnings" disclosure with an
  acknowledge affordance (mirror `ValidationSummary`'s `warningsAcknowledged`), `info`/nudge **inline on
  the field only**, never in the banner; (3) a bounded summary ("3 things to fix in Epochs · 2 warnings")
  so the visible list stays ~3 regardless of total. New guard codes slot into a tier by severity — the
  visible banner does **not** grow with guard count. Reuse the existing per-issue "Fix" routing.
- **Reward-early / punish-late: DRAFT until touched.** A freshly created day (and a freshly added epoch)
  starts as `DRAFT` and does **not** run the export-gate "Needs fixing" display until the user first
  opens/edits it (or explicitly Validates/Exports). Thread a "touched/opened" signal (day-state flag) so
  `animalWorkspaceViewModel`'s rollup and the in-tab banner show `Draft / Incomplete`, not `error`, for
  untouched items. Keep the export gate itself unchanged — only *when* its result is surfaced changes.
  **Guardrail:** this suppression applies only to app-created empty scaffolds; imported legacy days,
  loaded existing workspaces, and any day with user-authored/imported metadata must surface validation
  results immediately even if the user has not opened that day in the current session. (Apply the same to
  the empty-Cameras calibration warning: suppress only while there are zero cameras.)
- **Extend `humanizeValidationMessage` coverage** for the leaking AJV shapes — `must have required
  property '<X>'` → the `<X>` label ("A brain region/location is required" etc., reusing `HUMANIZE_LABELS`
  + the field-label helper); `must NOT have fewer than 1 items` → "Add at least one <thing>". Apply at
  the **display layer** only; assert the raw `issue.message` is unchanged so the downstream parser still
  works (add a test pinning that invariant).
- **Status-signal consistency.** (a) A row that shows "Complete" while the global banner shows a blocking
  error is contradictory — derive the row status from the same gate as the banner. (b) Pre-populated
  wizard steps (e.g. Recording-system with SpikeGadgets defaults) must render as **"Pre-filled — review"**
  (distinct glyph), not the same green as a user-completed step.
- **Docs.** CHANGELOG: validation findings are grouped + tiered + collapsible; fresh days/epochs no
  longer show errors before they're opened; more AJV messages are humanized; status signals are
  consistent.

## Deliberately not in this phase

- Adding the new guard *rules* themselves (Phases 8–12) — this phase makes the presentation **ready** for
  them; they land after.
- Changing validation *logic* / the export gate result — only grouping, severity tiering, and the
  *timing* of when a result is surfaced (DRAFT) change.
- The discrete layout/label bugs (modal scroll, stepper wrap, device_type label, save-draft feedback) —
  **Phase 1**. The first-run required-field gap + scope-boundary card — **Phase 14**.

## Validation slice

| Test | Asserts |
| --- | --- |
| `ReadinessBar` / day-banner (new/extend) | errors group by section; warnings collapse behind an ack disclosure; info/nudge never appear in the banner; the visible count stays bounded as issue count grows (feed 20 mixed issues → ~3 visible groups) |
| punish-late (new) | a freshly created day → `DRAFT` (no "Needs fixing"); after first open/edit → the gate result shows; an untouched fresh epoch → row "Incomplete", not a global error; imported/loaded days with validation issues surface immediately; empty Cameras step → no calibration warning |
| `humanizeValidationMessage` (extend) | `must have required property 'institution'` and `must NOT have fewer than 1 items` render friendly; **`issue.message` raw value is unchanged** (parser invariant pinned) |
| status consistency (extend) | row status and banner agree on the same day; a pre-filled wizard step renders "Pre-filled — review", not user-complete green |
| `baselines` | byte-identical (presentation + timing only; no export change) |

## Fixtures

Reuse `ValidationSummary` / `DayEditorFrame` test fixtures; synthesize a day with a mix of
error/warning/info issues across sections to prove the bounded-summary; a freshly-created day + epoch
for the DRAFT path; an imported/loaded day with issues to prove it is not hidden as draft; a workspace
with an empty Cameras step.

## Review

Dispatch `code-reviewer` against the diff. Confirm:
- The day banner reuses the ValidationSummary grouping/ack pattern (not a parallel implementation); visible noise is bounded and new guard severities tier correctly.
- DRAFT timing changes only *when* the gate result surfaces, never the gate itself; export remains blocked on real errors once the day is touched, and imported/loaded invalid days are not hidden as draft.
- `humanizeValidationMessage` changes are display-only; the raw-message parser invariant has a test.
- Baselines byte-identical; full gate green; no trivial tests; CHANGELOG updated.
