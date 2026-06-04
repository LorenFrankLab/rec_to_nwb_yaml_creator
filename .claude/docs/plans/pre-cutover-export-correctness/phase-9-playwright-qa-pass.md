# Phase 9 — Playwright QA pass: browser-level workspace correctness

[← back to PLAN.md](PLAN.md) · [overview](overview.md) · [shared-contracts](shared-contracts.md#ux-mistake-prevention-contract)

Goal: prove the corrected workspace path works as a user experience in a real browser before cutover. Phases
1–8 add the model, validation, export, and UI correctness pieces; this phase exercises the stitched-together
flows with Playwright so regressions in routing, focus, modals, disabled states, downloads, localStorage, and
browser-only behavior cannot hide behind unit/integration coverage.

**Inputs to read first:**

- [playwright.config.js](../../../../playwright.config.js) — existing Playwright setup (`testDir: ./e2e`,
  Chromium project, `npm start` web server, HTML/JSON/list reporters, screenshots on failure).
- [package.json](../../../../package.json) — `npm run test:e2e` and `npm run test:e2e:ui`; Playwright is
  already installed (`@playwright/test`).
- [.github/workflows/test.yml](../../../../.github/workflows/test.yml) — existing CI e2e job installs
  Chromium and uploads Playwright artifacts.
- [e2e/workspace-persistence.spec.js](../../../../e2e/workspace-persistence.spec.js) — current workspace e2e
  smoke; reuse its localStorage reset pattern.
- [e2e/baselines](../../../../e2e/baselines) — legacy baseline specs. Keep them as legacy coverage, but do
  not model new workspace QA after their conditional/skip-if-visible style; Phase 9 tests must fail when a
  required workspace control is missing.
- Phase docs 1–8 — especially the validation slices and UX mistake-prevention tests. Phase 9 samples from
  those flows at the browser level; it does not replace their lower-level tests.

**Contracts referenced:**

- [User mental-model contract](shared-contracts.md#user-mental-model-contract) — browser scenarios should be
  written around user goals and likely mistakes, not only internal schema sections.
- [UX mistake-prevention contract](shared-contracts.md#ux-mistake-prevention-contract) — browser QA must
  verify users are guided away from scientifically dangerous choices, not merely blocked at final export.
- [Validation & export-gate contract](shared-contracts.md#validation--export-gate-contract) — export stays
  fail-closed by button, keyboard, step navigation, and direct Export step interaction.
- [Parity, golden-fixture & round-trip contract](shared-contracts.md#parity-golden-fixture--round-trip-contract)
  — Playwright verifies browser download content shape only; downstream conversion/DANDI/Spyglass remains
  the external gate from phases 2–5 and 8.

## Tasks

- **Task 1 — workspace e2e fixture harness.** Add deterministic Playwright helpers under `e2e/` for:
  clearing/priming `rec_to_nwb_workspace_v1`; creating a valid workspace animal/day through UI where
  practical; seeding complex state through localStorage only when the UI path would obscure the assertion;
  capturing downloaded YAML text for structural assertions; and disabling animations for screenshots. Name
  helper scenarios around the user's workflow goal and dangerous misconception (for example, "changed camera
  zoom needs a new camera name"), not only around field names. Avoid waiting by fixed sleeps except where
  Playwright has no event to observe.
- **Task 2 — happy-path browser export.** Add a `workspace-export.spec.js` flow that creates or loads a
  fully configured non-opto workspace session, visits each editor step, confirms the preflight summary, downloads
  YAML, and asserts the downloaded text contains the corrected high-risk sections: subject/session fields,
  configured cameras with `lens`, data-acq array with `name`, electrode groups + ntrode maps with integer IDs,
  day bad-channel edits, tasks/videos, and no obvious `[object Object]` / empty required placeholders.
- **Task 3 — fail-closed + repair navigation.** Add browser coverage proving an invalid day cannot reach or
  use Export by clicking the stepper, keyboard next, or the Download button. The visible error must include a
  repair action; clicking it navigates to the owning step and focuses/highlights the target when metadata
  exists, with step-level fallback when it does not.
- **Task 4 — mistake-prevention UX smoke.** Add targeted browser tests for the highest-risk edit surfaces:
  camera name reuse with changed `meters_per_pixel`/`lens` is blocked and offers the new-name path; data-acq
  name reuse with changed dependent fields is blocked; case-only region drift is prevented; task/video camera
  and epoch references use controlled choices and cannot save stale ids; task-name reuse with different
  description is blocked with old-vs-new context.
- **Task 5 — persistence and recovery QA.** Extend workspace e2e coverage for: autosaved workspace survives
  reload; an empty/malformed workspace blob normalizes or discards with a notice instead of crashing; failed
  autosave keeps the unsaved-work guard armed if that state can be simulated from the browser harness; partial
  import/recovery notices name the damaged section/path where the UI exposes the flow.
- **Task 6 — optogenetics browser smoke.** Add a focused opto flow: opto off exports no-opto state without
  required-field noise; opto on reveals required sections, blocks incomplete state, requires FsGUI camera/epoch
  references, and the downloaded YAML includes both converter and schema spellings once complete.
- **Task 7 — responsive/accessibility smoke.** Run the critical workspace flows at the default desktop
  viewport and at one narrow viewport (e.g. 390x844) for navigation, modals, validation summary, and Export.
  Assert no critical controls are off-screen/unreachable, focus is trapped/restored in modals, and repair
  actions are keyboard reachable. Keep this as behavioral accessibility smoke, not a full axe audit.
- **Task 8 — CI/runbook/artifacts.** Keep CI Chromium-only unless runtime proves acceptable, but add a local
  runbook for `npm run test:e2e`, `npm run test:e2e:ui`, and optional cross-browser/manual screenshot review.
  Ensure Playwright HTML report, traces, screenshots, and downloaded YAML artifacts are retained for failures.
  Document the Phase 9 QA result in `docs/REFACTOR_CHANGELOG.md` or a linked QA note.

## Deliberately not in this phase

- **Changing export semantics** — failures found here should open/fix targeted bugs in the owning phase code,
  but Phase 9's planned work is QA coverage and runbook hardening.
- **Replacing Vitest or downstream gates** — Playwright covers browser workflows; it does not replace unit,
  integration, golden-baseline, DANDI, `trodes_to_nwb`, or Spyglass smoke gates.
- **Brittle visual snapshot expansion** — use screenshots/traces for failure diagnosis and a few intentional
  QA captures if useful, but do not create broad pixel baselines for every page state unless they are stable
  and reviewed.
- **Legacy-form redesign** — existing legacy baseline e2e tests remain; new Phase 9 coverage focuses on the
  workspace path that will be cut over.

## Validation slice

| Test | Asserts |
| --- | --- |
| `workspace happy path downloads corrected YAML` *(Playwright)* | a fully configured workspace day reaches Export, shows preflight, downloads YAML, and the downloaded text includes corrected subject/session, camera/data-acq/device/task/video sections. |
| `invalid workspace day is fail-closed in browser` *(Playwright)* | stepper click, keyboard next, and download cannot bypass error-severity validation; repair actions navigate/focus as designed. |
| `identity and reference mistakes are blocked before export` *(Playwright)* | camera/data-acq divergent reuse, task-name divergent reuse, region case drift, and stale task/video refs are blocked or repaired at the editing surface. |
| `workspace persistence recovery is browser-safe` *(Playwright)* | reload preserves a valid workspace; empty/malformed blobs recover with a named notice and no crash; unsaved-work guard remains active after simulated save failure where feasible. |
| `workspace optogenetics is browser-configurable` *(Playwright)* | opto off/on states, required-field blocking, FsGUI camera/epoch references, and downloaded converter/schema key pairs work through the UI. |
| `critical flows fit desktop and narrow viewports` *(Playwright)* | modals, step navigation, validation summary, repair actions, and Export remain reachable without incoherent overlap at desktop and narrow widths. |
| `npm run test:e2e` *(CI/local)* | Playwright Chromium suite passes with reports/traces/screenshots available on failure. |

## Fixtures

Prefer UI-created state for one happy-path flow. For high-complexity cases, seed `rec_to_nwb_workspace_v1`
with explicit workspace objects built from the same concepts as `makeConfiguredWorkspace()`; keep e2e fixture
builders local to `e2e/` or import only stable test helpers that do not pull Vitest globals. Use small,
realistic YAML/download assertions rather than full byte snapshots.

## Review

`pr-review-toolkit:code-reviewer`; `ux-reviewer`; `pr-review-toolkit:pr-test-analyzer`. Confirm: tests fail
when required controls are absent; no conditional "if visible" skips for required workspace flows; selectors
prefer roles/labels over CSS; waits are event/locator based; downloaded YAML assertions cover the corrected
sections without becoming a duplicate golden baseline; artifacts and runbook make failures reproducible.
