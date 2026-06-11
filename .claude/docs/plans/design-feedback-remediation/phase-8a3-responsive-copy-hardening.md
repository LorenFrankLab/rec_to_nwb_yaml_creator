# Phase 8A-3 — Responsive + copy hardening

[← back to PLAN.md](PLAN.md) · [overview](overview.md)

Merge-neutral UX hardening before selective user testing. This phase reduces attention load and verifies the
testing path at a narrow mobile width. The PR should answer one question: "Can users scan the primary action
and current state without fighting dense copy or broken narrow layouts?"

**Do not make Workspace the default entry point.** The root route stays the legacy form until the separate
testing/cutover phases decide otherwise.

**Inputs to read first:**

- [shared-contracts.md#c5](shared-contracts.md#c5) — the pre-test UX invariants and default-entry gate.
- [../../research/ux-principles.md](../../research/ux-principles.md) — the Heer-grounded rubric.
- `src/pages/AnimalWorkspace/RecordingDaysTab.jsx` — day rows, mobile layout, carry-forward copy, and
  destructive/primary action placement.
- Day Editor high-traffic screens touched by Phase 6: Devices & Failed Channels, Tasks & Epochs,
  Validation Summary, and Export.
- Existing responsive/a11y specs: `e2e/workspace-responsive-a11y.spec.js`,
  `e2e/workspace-validation-responsive.spec.js`, `e2e/workspace-banner-occlusion.spec.js`.

**Contracts referenced:**

- [C1 — YAML byte-identity](shared-contracts.md#c1) — no export change; baselines must stay byte-identical.
- [C4 — design tokens / CSS Modules](shared-contracts.md#c4) — touched styles use tokens/modules when practical.
- [C5 — pre-test UX hardening + default-entry gate](shared-contracts.md#c5).

## Tasks

- **Copy diet / details on demand:** reduce long inline explanations on high-traffic workflow screens
  (Animal Days, Devices & Failed Channels, Tasks & Epochs, Validation Summary). Keep safety-critical facts,
  but make the primary action and current state visually dominant; move background rationale behind details
  or concise "Why?" text.
- **Responsive rescue for the testing path:** at about 390px width, Animal Days and Day Editor must not
  collapse into narrow columns. Convert day rows to stacked cards, keep the carry-forward checkbox below/near
  the Add Recording Days action, and visually separate destructive actions from primary actions.
- **Screenshot review states:** capture desktop and about-390px screenshots for Animal Days, Day Editor, and
  Validation Summary after representative seeded data is loaded.
- **No cutover:** do not touch root-route behavior, legacy-form behavior, or docs in a way that implies
  Workspace has become the default.
- **Documentation:** CHANGELOG entry for responsive/copy hardening.

## Deliberately not in this phase

- Timeline-aware calendar initialization and lifecycle vocabulary — Phase 8A-1.
- Label parity, device summaries, and calendar keyboard/a11y — Phase 8A-2.
- Task-type catalog model or persisted schema change — Phase 8B/8C.
- Workspace default route / cutover / legacy deprecation — separate testing/cutover phases.

## Validation slice

| Test | Asserts |
| --- | --- |
| e2e responsive screenshots | 1440px and about-390px Animal Days / Day Editor / Validation Summary have no overlapping controls or one-word-column instructional text. |
| e2e: action hierarchy | primary action remains visually and DOM-order dominant; destructive actions do not compete with it. |
| a11y | changed copy/structure preserves landmarks, headings, and reachable controls. |
| `npx vitest run baselines` | byte-identical — no export behavior changed. |
| `npx vitest run` + targeted e2e | green. |

## Fixtures

Reuse the realistic `remy` workspace fixture plus seeded states for empty, normal, validation-warning, and
export-ready days. No persisted-schema fixture changes.

## Review

Before opening the PR, dispatch `code-reviewer` against the diff. Confirm:

- Root route and legacy form are untouched.
- No YAML baseline bytes changed.
- 390px screenshots are usable; controls do not overlap and prose does not collapse into one-word columns.
- Copy changes preserve safety-critical facts while reducing attention load.
- Destructive actions are visually separated from the primary workflow.
- CHANGELOG reflects only what actually changed.
