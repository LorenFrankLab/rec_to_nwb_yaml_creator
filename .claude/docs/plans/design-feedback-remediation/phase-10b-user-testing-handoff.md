# Phase 10B — Selective-testing handoff package (no cutover)

[← back to PLAN.md](PLAN.md) · [overview](overview.md)

Claude-Code implementation phase that prepares the materials needed for selective user testing after Phase
10. This phase does **not** run the study, interpret results, or make Workspace the default entry point. It
packages the app state, routes, scripts, screenshots, and known risks so Phases 11/12 can focus on user
evidence and the cutover decision.

**Do not make Workspace the default entry point.** The root route stays the legacy form. The handoff may
document how testers reach Workspace, but it must not redirect `/`, rename the legacy path as deprecated, or
claim cutover readiness.

**Inputs to read first:**

- [shared-contracts.md#c5](shared-contracts.md#c5) — default-entry gate and pre-test UX invariants.
- [../../research/ux-principles.md](../../research/ux-principles.md) — selective-testing rubric and
  attention-load criteria.
- Current Workspace routes from `src/hooks/useHashRouter.js`, `src/layouts/AppLayout.jsx`, and the relevant
  workspace pages.
- The realistic workspace fixtures used by prior phases, especially the `remy` fixture or its successor.

**Contracts referenced:**

- [C1 — YAML byte-identity](shared-contracts.md#c1) — handoff fixtures must not imply export-shape changes.
- [C5 — pre-test UX hardening + default-entry gate](shared-contracts.md#c5).

## Tasks

- **Testing route map:** document the stable routes testers should use to reach the Workspace path without
  changing the default root route. Include the legacy root route as the current production entry point. Save
  it at `docs/testing/selective-testing-routes.md`.
- **Participant fixture:** provide or identify one realistic seeded workspace state that covers: animal setup,
  several recording days, task types, validation warnings, validated state, and export-ready state. Prefer an
  existing fixture; add only minimal fixture data if needed.
- **Facilitator script:** add a concise script/checklist for selective testing that asks users to complete
  the core workflow without explaining implementation details. Include prompts for where they hesitate,
  what they think animal-level versus day-level data means, and whether status language matches their mental
  model. Save it at `docs/testing/selective-testing-script.md`.
- **Screenshot set:** capture desktop and about-390px screenshots for the tested path: entry into Workspace,
  Animal Days, Animal Setup/Task Types, Day Editor Tasks & Epochs, Validation Summary, and Export. Store
  them under `docs/testing/screenshots/selective-testing/` with stable, descriptive filenames.
- **Known-risks note:** document unresolved risks that should be watched during testing, including any
  deferred Post-v3 items, catalog conflict-repair ambiguity, browser back/forward shortcut uncertainty, and
  places where copy was intentionally reduced. Save it at `docs/testing/selective-testing-risks.md`.
- **No-cutover verification:** add an explicit checklist item proving `/` still opens the legacy form and no
  docs or UI copy describe Workspace as the default production entry point. Save the checklist at
  `docs/testing/no-cutover-checklist.md`.
- **Documentation:** CHANGELOG entry for testing-handoff materials only.

## Deliberately not in this phase

- Running interviews or synthesizing user-testing findings.
- Any Workspace default-entry / legacy cutover decision.
- Product copy that markets Workspace as the primary/default experience.
- New runtime dependencies.

## Validation slice

| Test | Asserts |
| --- | --- |
| route smoke check | `/` still opens the legacy form; documented Workspace test route still opens Workspace. |
| fixture smoke check | seeded testing fixture hydrates without migration discard and can export YAML. |
| screenshot review | desktop and about-390px screenshots cover the intended testing path and show no obvious overlap. |
| handoff doc review | script avoids leading users, names tasks clearly, and includes animal-vs-day ownership probes. |
| `npx vitest run baselines` | byte-identical if any fixture or export-adjacent code was touched. |
| targeted e2e / smoke tests | green for route and fixture paths touched by this handoff. |

## Fixtures

Prefer existing realistic workspace fixtures. If a new participant fixture is needed, keep it small,
representative, and explicitly non-golden unless it is intended to become a long-term regression fixture.

## Review

Before opening the PR, dispatch `code-reviewer` against the diff. Confirm:

- Root route and legacy form are untouched.
- The handoff package is enough for a human facilitator to run Phases 11/12 without implementation spelunking.
- The script tests comprehension rather than teaching the UI.
- Screenshots include desktop and about-390px widths.
- Known risks are explicit; no file claims Workspace is ready to become default before selective testing.
