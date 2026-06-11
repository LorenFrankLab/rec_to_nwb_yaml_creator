# Phase 8A-1 — Timeline + lifecycle hardening

[← back to PLAN.md](PLAN.md) · [overview](overview.md)

Merge-neutral UX hardening before selective user testing. This phase fixes two representation problems:
recording-day creation should follow the animal's timeline, and status language should distinguish live
readiness from persisted validation/export history. Keep the scope narrow so the PR answers one question:
"Can users tell where they are in the recording workflow?"

**Do not make Workspace the default entry point.** The root route stays the legacy form until the separate
testing/cutover phases decide otherwise.

**Inputs to read first:**

- [shared-contracts.md#c5](shared-contracts.md#c5) — the pre-test UX invariants and default-entry gate.
- [../../research/ux-principles.md](../../research/ux-principles.md) — the Heer-grounded rubric.
- `src/components/CalendarDayCreator/CalendarDayCreator.jsx` — initializes the displayed month from
  `new Date()`; should instead honor the animal recording timeline when `existingDays` exist.
- `src/domain/workflowStatus.js`, `src/pages/DayEditor/ValidationStep.jsx`,
  `src/pages/DayEditor/ExportStep.jsx`, `src/pages/ValidationSummary/index.jsx`, and
  `src/pages/AnimalWorkspace/RecordingDaysTab.jsx` — readiness/validated/exported wording and status chips.

**Contracts referenced:**

- [C1 — YAML byte-identity](shared-contracts.md#c1) — no export change; baselines must stay byte-identical.
- [C5 — pre-test UX hardening + default-entry gate](shared-contracts.md#c5).

## Tasks

- **Timeline-aware Add Recording Days calendar:** when `existingDays` is non-empty, initialize the calendar
  near the latest existing recording-day month, or the next likely recording day if that crosses into the
  following month. Keep Today as an explicit jump. Add tests for a seeded 2023 animal while wall-clock today
  is much later.
- **Lifecycle vocabulary model:** establish one shared wording helper/legend for:
  - computed export readiness,
  - persisted `day.state.validated`,
  - exported/history state.
  Update Animal Days, Day Validation, Day Export, and global Validation Summary so they do not show
  contradictory status phrases with equal weight.
- **Persisted validated indicator:** have the validation-summary chip/helper consume `day.state.validated`
  so persisted validation is visually distinct from merely live-valid readiness. This was formerly Phase 10.
- **No cutover:** do not touch root-route behavior, legacy-form behavior, or docs in a way that implies
  Workspace has become the default.
- **Documentation:** CHANGELOG entry for timeline/lifecycle hardening; update `docs/POST_V3_FOLLOWUPS.md`
  only for the persisted validation indicator if it is actually resolved here.

## Deliberately not in this phase

- Label parity, device summaries, and calendar keyboard/a11y — Phase 8A-2.
- Copy diet and responsive layout work — Phase 8A-3.
- Task-type catalog model or persisted schema change — Phase 8B/8C.
- Workspace default route / cutover / legacy deprecation — separate testing/cutover phases.

## Validation slice

| Test | Asserts |
| --- | --- |
| unit/component: calendar initial month | seeded 2023 animal opens around the last recording day / next likely day, not wall-clock today. |
| unit/component: lifecycle helper/chips | live-valid, persisted-validated, and exported states are distinct and do not produce contradictory text. |
| e2e screenshot: lifecycle states | Animal Days / Validation Summary show one dominant next action and no conflicting equal-weight status phrases. |
| `npx vitest run baselines` | byte-identical — no export behavior changed. |
| `npx vitest run` + targeted e2e | green. |

## Fixtures

Reuse the realistic `remy` workspace fixture plus a focused calendar fixture with dates far from the current
wall-clock date. No persisted-schema fixture changes.

## Review

Before opening the PR, dispatch `code-reviewer` against the diff. Confirm:

- Root route and legacy form are untouched.
- No YAML baseline bytes changed.
- Add Recording Days opens on the animal timeline.
- Lifecycle language is consistent across Animal Days, Day Validation, Day Export, and global Validation.
- CHANGELOG and resolved follow-up docs reflect only what actually changed.
