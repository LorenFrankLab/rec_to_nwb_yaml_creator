# Phase 9 — Playwright QA pass: browser-level workspace correctness

[← back to PLAN.md](PLAN.md) · [overview](overview.md) · [shared-contracts](shared-contracts.md#ux-mistake-prevention-contract)

Goal: prove the corrected workspace path works as a user experience in a real browser before cutover. Phases
1–8 add the model, validation, export, and UI correctness pieces; Phase 8.5 stabilizes the domain boundaries
those pieces depend on; Phase 8.6 makes the user workflow/setup path explicit; Phase 8.7 makes field
ownership/default/day-configurability explicit. This phase exercises the
stitched-together flows with Playwright so regressions in routing, focus, modals, disabled states, downloads,
localStorage, workflow clarity, and browser-only behavior cannot hide behind unit/integration coverage.

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
- Phase docs 1–8.7 — especially the validation slices, domain-boundary checks, workflow-clarity states,
  ownership/default/day-configurability states, and UX mistake-prevention
  tests. Phase 9 samples from those flows at the browser level; it does not replace their lower-level tests.

**Contracts referenced:**

- [User mental-model contract](shared-contracts.md#user-mental-model-contract) — browser scenarios should be
  written around user goals and likely mistakes, not only internal schema sections.
- [UX mistake-prevention contract](shared-contracts.md#ux-mistake-prevention-contract) — browser QA must
  verify users are guided away from scientifically dangerous choices, not merely blocked at final export.
- [Validation & export-gate contract](shared-contracts.md#validation--export-gate-contract) — export stays
  fail-closed by button, keyboard, step navigation, and direct Export step interaction.
- [Parity, golden-fixture & round-trip contract](shared-contracts.md#parity-golden-fixture--round-trip-contract)
  — Playwright verifies browser download content shape only; the actual downstream conversion/DANDI/Spyglass
  round-trip is the deferred pre-cutover gate, not part of Phase 9.

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
  day bad-channel edits, technical day overrides/defaults, tasks/videos, and no obvious `[object Object]` /
  empty required placeholders. The preflight assertions should name which values are shared animal setup,
  configuration-version data, recording-system defaults, advanced day overrides, catalog selections, and
  day-only facts.
- **Task 2.5 — same-day and catch-up workflow smoke.** Add two user-story scenarios, not just field-level
  checks. Same-day: a scientist finishes one recording, creates/reviews one day, confirms task-epoch setup,
  validates, and downloads one YAML without re-entering shared setup. Catch-up: a scientist has multiple days
  waiting, scans readiness, spots which days share setup versus need hardware/camera/opto review, validates or
  repairs targeted issues, and batch-exports only ready days. The scenarios must name the user's goal, the
  dangerous mistake being prevented, and the naming identities being protected.
- **Task 3 — fail-closed + repair navigation.** Add browser coverage proving an invalid day cannot reach or
  use Export by clicking the stepper, keyboard next, or the Download button. The visible error must include a
  repair action; clicking it navigates to the owning step and focuses/highlights the target when metadata
  exists, with step-level fallback when it does not.
- **Task 4 — mistake-prevention UX smoke.** Add targeted browser tests for the highest-risk edit surfaces:
  camera name reuse with changed `meters_per_pixel`/`lens` is blocked and offers the new-name path; data-acq
  name reuse with changed dependent fields is blocked; case-only region drift is prevented; task/video camera
  and epoch references use controlled choices and cannot save stale ids; day technical values read as effective
  recording-system values, do not look like routine day edits, and expose an advanced override plus
  reset-to-recording-system-default path; behavioral-event editing cannot be mistaken for non-exported animal
  reference data and inherited/reference events can be used on a day through a visible `Use on this day` path;
  task-name reuse with different description is blocked with old-vs-new context.
- **Task 4.5 — ownership/discoverability scenario smoke.** Add one compact browser scenario or documented
  route-state artifact for each Phase 8.7 attention path: a new user finds electrode setup from the workspace;
  task/video camera empty state routes to `Set Up Cameras`; changing camera zoom/calibration/lens steers to a
  new camera name; data-acq is presented as recording-system setup rather than grouped with cameras; a user
  sees `raw_data_to_volts` / `times_period_multiplier` as using recording-system defaults, can open an advanced
  one-day override only when needed, and sees the override marked as this-day-only; an animal-level
  DIO/reference event is made visible as exported only after `Use on this day`; a multi-epoch day can show
  different rooms/cameras by epoch without implying one day-wide setup; and a user with existing days sees what
  shared-setup edits affect before saving.
- **Task 4.6 — lifecycle cleanup smoke.** Add browser coverage or a documented route-state artifact proving
  animal/day deletion is discoverable but secondary: a selected animal exposes `Delete animal...`; ordinary day
  rows expose `Delete recording day...`; confirmations name the affected animal/day and cascade count; exported
  or validated rows warn that local deletion does not remove previously downloaded YAML/NWB/DANDI/Spyglass
  artifacts; cancel preserves records; confirm removes the intended record only; and wrong-owner day records
  are not destroyed by animal deletion.
- **Task 5 — persistence and recovery QA.** Extend workspace e2e coverage for: autosaved workspace survives
  reload; an empty/malformed workspace blob normalizes or discards with a notice instead of crashing; failed
  autosave keeps the unsaved-work guard armed. Prove the failed-save state in browser by stubbing
  storage/save failure where possible; if the browser harness cannot simulate it, the Phase 9 artifact must
  record why and cite the Phase 7 failed-autosave guard test as alternate proof. No silent skip is allowed.
  Partial import/recovery notices name the damaged section/path where the UI exposes the flow.
- **Task 6 — optogenetics browser smoke.** Add a focused opto flow: opto off exports no-opto state without
  required-field noise; opto on reveals required sections, blocks incomplete state, requires FsGUI camera/epoch
  references, supports opto on only a selected subset of task epochs, and the downloaded YAML includes both
  converter and schema spellings once complete.
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
- **Replacing Vitest or the deferred downstream round-trip** — Playwright covers browser workflows; it does
  not replace unit, integration, golden-baseline, or the deferred pre-cutover `trodes_to_nwb`/DANDI/Spyglass
  round-trip.
- **Brittle visual snapshot expansion** — use screenshots/traces for failure diagnosis and a few intentional
  QA captures if useful, but do not create broad pixel baselines for every page state unless they are stable
  and reviewed.
- **Legacy-form redesign** — existing legacy baseline e2e tests remain; new Phase 9 coverage focuses on the
  workspace path that will be cut over.

## Validation slice

| Test | Asserts |
| --- | --- |
| `workspace happy path downloads corrected YAML` *(Playwright)* | a fully configured workspace day reaches Export, shows preflight, downloads YAML, and the downloaded text includes corrected subject/session, camera/data-acq/device/task/video sections. |
| `same-day and catch-up workflows are efficient` *(Playwright/artifact)* | one fresh single-day export and one multi-day catch-up/batch export path are reachable without redundant shared-setup entry; readiness, targeted repair, batch eligibility, and protected naming identities are visible. |
| `invalid workspace day is fail-closed in browser` *(Playwright)* | stepper click, keyboard next, and download cannot bypass error-severity validation; repair actions navigate/focus as designed. |
| `identity and reference mistakes are blocked before export` *(Playwright)* | camera/data-acq divergent reuse, task-name divergent reuse, region case drift, and stale task/video refs are blocked or repaired at the editing surface. |
| `ownership/default/day-configurability is visible` *(Playwright)* | shared setup, configuration version, using recording-system default, advanced day override, catalog selection, task-epoch setup assignment, exported-with-this-day, and day-only facts are distinguishable in the key workspace/day/export routes at the point of action. |
| `ownership discovery paths are reachable` *(Playwright/artifact)* | `Set Up Electrodes`, `Set Up Cameras`, `Use on this day`, `Override for this day`, `Reset to recording-system default`, `Pin version`, and `Hardware changed starting this day` are present in the states where users naturally look for them. |
| `animal/day cleanup is safe and discoverable` *(Playwright/artifact)* | `Delete animal...` and `Delete recording day...` are reachable as secondary destructive actions; confirmations name cascade/export consequences; cancel preserves state; confirm deletes only the intended owned records. |
| `workspace persistence recovery is browser-safe` *(Playwright)* | reload preserves a valid workspace; empty/malformed blobs recover with a named notice and no crash; failed autosave either keeps the unsaved-work guard active in a browser simulation, or the QA artifact documents why browser simulation is impossible and cites the Phase 7 failed-autosave guard test as alternate proof. |
| `workspace optogenetics is browser-configurable` *(Playwright)* | opto off/on states, required-field blocking, FsGUI camera/epoch references, opto-on-selected-epochs behavior, and downloaded converter/schema key pairs work through the UI. |
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
