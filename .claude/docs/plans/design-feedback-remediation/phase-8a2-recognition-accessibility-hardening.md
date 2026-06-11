# Phase 8A-2 — Recognition + accessibility hardening

[← back to PLAN.md](PLAN.md) · [overview](overview.md)

Merge-neutral UX hardening before selective user testing. This phase fixes recognition and operability
issues without changing layout density or workflow structure. The PR should answer one question: "Can users
recognize the available controls and operate the calendar without hidden naming or keyboard traps?"

**Do not make Workspace the default entry point.** The root route stays the legacy form until the separate
testing/cutover phases decide otherwise.

**Inputs to read first:**

- [shared-contracts.md#c5](shared-contracts.md#c5) — the pre-test UX invariants and default-entry gate.
- `src/pages/AnimalWorkspace/RecordingDaysTab.jsx` — Add Recording Days button
  (`aria-label` currently says "Show calendar").
- `src/valueList.js` `deviceTypes()` and the animal electrode-group UI — opaque probe IDs need human labels;
  option values must stay unchanged.
- `src/components/CalendarDayCreator/CalendarDay.jsx` and `CalendarGrid.jsx` — calendar keyboard/a11y issues
  from the old Phase 10 backlog.
- Existing responsive/a11y specs: `e2e/workspace-responsive-a11y.spec.js`,
  `e2e/workspace-validation-responsive.spec.js`, `e2e/workspace-banner-occlusion.spec.js`.

**Contracts referenced:**

- [C1 — YAML byte-identity](shared-contracts.md#c1) — no export change; baselines must stay byte-identical.
- [C5 — pre-test UX hardening + default-entry gate](shared-contracts.md#c5).

## Tasks

- **Visible/accessibility label parity:** fix touched controls whose visible labels and accessible names
  diverge, starting with the Add Recording Days button. Add a small guard test for the main Animal Days
  actions.
- **Device-type human summaries:** add recognition-friendly labels for opaque probe IDs (for example,
  "128-ch, 4-shank, 8 mm") while keeping option **values** exactly the same probe IDs.
- **Calendar keyboard/a11y:** replace today-only `tabIndex` with roving tabindex that defaults to the first
  selectable cell when today is absent; split the single 42-cell row into six weekly rows of seven cells.
- **No cutover:** do not touch root-route behavior, legacy-form behavior, or docs in a way that implies
  Workspace has become the default.
- **Documentation:** CHANGELOG entry for recognition/a11y hardening; update `docs/POST_V3_FOLLOWUPS.md`
  only for calendar a11y and device-type summaries if they are actually resolved here.

## Deliberately not in this phase

- Timeline-aware calendar initialization and lifecycle vocabulary — Phase 8A-1.
- Copy diet and responsive layout work — Phase 8A-3.
- Task-type catalog model or persisted schema change — Phase 8B/8C.
- Workspace default route / cutover / legacy deprecation — separate testing/cutover phases.

## Validation slice

| Test | Asserts |
| --- | --- |
| unit/component: label parity | touched actions are discoverable by their visible names, including Add Recording Days. |
| unit/component: device type labels | displayed label differs from opaque value; option value remains the exact probe ID. |
| unit/component: calendar a11y | roving tabindex works when today is absent; grid exposes weekly rows of seven cells. |
| a11y | jest-axe/Playwright a11y specs remain clean for touched surfaces. |
| `npx vitest run baselines` | byte-identical — no export behavior changed. |
| `npx vitest run` + targeted e2e | green. |

## Fixtures

Reuse existing workspace/device fixtures. No persisted-schema fixture changes.

## Review

Before opening the PR, dispatch `code-reviewer` against the diff. Confirm:

- Root route and legacy form are untouched.
- No YAML baseline bytes changed.
- Touched controls have visible-name/accessibility-name parity.
- Device-type option values are unchanged.
- Calendar keyboard behavior works when today is absent from the displayed month.
- CHANGELOG and resolved follow-up docs reflect only what actually changed.
