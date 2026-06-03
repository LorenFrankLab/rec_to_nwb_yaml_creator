# Phase 9 — Continuous accessibility & keyboard shortcuts

[← back to overview](overview.md) · [shared contracts](shared-contracts.md)

By this point Phases 2–5 have made the workspace UI feature-complete (nav, modals, epochs,
validation, export all wired). This phase hardens it: complete WCAG AA coverage across every new
page, global keyboard shortcuts with a discoverable help affordance, an un-skipped nested
keyboard-navigation test, and automated Axe checks in CI that fail the build on any violation.
Maps to [docs/TASKS.md](../../../../docs/TASKS.md) "M12 – Continuous Accessibility & Keyboard
Shortcuts" (~:908–920).

**Depends on:** [Phase 2](phase-2-navigation-stub-honesty.md)'s flag-aware routing — new routes stay
renderable in tests with flags toggled, which the Axe, landmark, and keyboard-navigation test
harnesses in this phase's validation slice drive directly via hash.

**Inputs to read first:**

- [src/layouts/AppLayout.jsx](../../../../src/layouts/AppLayout.jsx) — owns skip links (`:145-158`),
  the `#route-announcer` `role="status" aria-live="polite"` region (`:160-167`), focus-to-`#main-content`
  on route change (`:93-109`), and the `renderView` route switch (`:115-140`). Global shortcuts and the
  shortcuts-help affordance attach at this top level so they work on every route.
- [src/__tests__/integration/aria-landmarks.test.jsx](../../../../src/__tests__/integration/aria-landmarks.test.jsx)
  — current landmark assertions render only the **legacy** route (`<App />` defaults to `view:'legacy'`);
  Phase 2 added per-new-route landmark coverage. This phase extends to assert `aria-current`, `aria-live`
  status, and unique landmarks on each new route.
- [src/__tests__/integration/keyboard-navigation.test.jsx](../../../../src/__tests__/integration/keyboard-navigation.test.jsx)
  — the `it.skip` at `:171` ("nested electrode group items") is the skipped test this phase un-skips
  (Task 3). Note the existing patterns: focus a `.nav-link`, `user.keyboard('{Enter}')`/`' '`, assert
  `highlight-region`/`active-nav-link` classes.
- [src/pages/DayEditor/StepNavigation.jsx](../../../../src/pages/DayEditor/StepNavigation.jsx) — stepper
  tab order and ARIA: `aria-current={isCurrent ? 'step' : undefined}` (`:60`), status icon is emoji with
  `aria-hidden="true"` (`:66-68`) plus an `sr-only` label (`:69`), `aria-label` combines label+status
  (`:61`). `isExportEnabled` gate (`:118-121`) — do **not** loosen.
- [src/pages/AnimalEditor/AnimalEditorStepper.jsx:520](../../../../src/pages/AnimalEditor/AnimalEditorStepper.jsx)
  — `aria-current` on its step buttons; `<main id="main-content" tabIndex="-1">` (`:531`). Phase 2 fixed
  the duplicate `<main>`; verify only one remains. No `aria-live` step-change announcer exists here yet.
- [src/pages/DayEditor/SaveIndicator.jsx](../../../../src/pages/DayEditor/SaveIndicator.jsx) — error state
  `role="alert" aria-live="assertive"` (`:39-40`), success `role="status" aria-live="polite"` (`:56-57`),
  emoji icons all `aria-hidden="true"` (`:42,:62,:68`). The model for "status conveyed non-color".
- [src/App.scss](../../../../src/App.scss) — color values are inline hex (no token file); existing AA/AAA
  contrast notes at `:586` (hints `#525252`, 8.31:1) and `:601` (errors `#DC2626`, 5.03:1). Audit target
  for Task 5. Primary button `#2563eb` on white (`:166`), focus outlines `#3b82f6`/`#1976d2`.
- [src/__tests__/helpers/test-fixtures.js](../../../../src/__tests__/helpers/test-fixtures.js) — existing
  YAML fixture helpers (`getMinimalCompleteYaml`, `getCustomizedYaml`). No workspace-object builder exists
  yet — this phase adds one (see Fixtures).
- [.github/workflows/test.yml](../../../../.github/workflows/test.yml) — `test` job runs
  `npm run test:coverage -- run`; separate `e2e` job runs `npm run test:e2e` (Playwright, chromium). CI
  wiring target for Task 4.
- [playwright.config.js](../../../../playwright.config.js) — `testDir: './e2e'`, chromium project,
  `webServer` boots `npm start` on `:3000`. Playwright is available for a11y e2e.
- [e2e/baselines/import-export.spec.js](../../../../e2e/baselines/import-export.spec.js) — reference for
  Playwright spec structure (`import { test, expect } from '@playwright/test'`).

**Contracts referenced:**

- [Feature flags & routing contract](shared-contracts.md#feature-flags--routing-contract) — new routes are
  reachable for testing before cutover; Axe and keyboard tests drive them directly via hash. Do not change
  the default route here (that is Phase 11).
- [`<Modal>` primitive contract](shared-contracts.md#modal-primitive-contract) — focus trap (Tab/Shift-Tab
  cycle) and focus-return on close. This phase re-verifies these still hold (regression guard); it does
  **not** reimplement them.
- [Validation & step-status contract](shared-contracts.md#validation--step-status-contract) — status is
  surfaced through real step states by this point; the audit asserts status is conveyed non-color and via
  `aria-live`, and must not weaken `isExportEnabled`.

## Tasks

- **Global keyboard shortcuts.** Add a `useGlobalShortcuts` hook (e.g.
  `src/hooks/useGlobalShortcuts.js`) mounted once in `AppLayout` (alongside the existing route-focus
  effect, `AppLayout.jsx:93-109`). Bind a small, conflict-free set:
  - **Save** (`Ctrl/Cmd+S`) — `preventDefault` the browser save dialog, trigger the workspace autosave/
    flush wired in Phase 1.
  - **Next / Previous step** (`Alt+ArrowRight` / `Alt+ArrowLeft`) — advance/retreat the active stepper
    (DayEditor `StepNavigation`, AnimalEditor stepper) without overriding screen-reader arrow keys
    (Alt-modified avoids AT virtual-cursor conflicts).
  - **Add epoch / add row** (`Alt+N`) — context-sensitive "add" for the current step (e.g. add an epoch
    on the Epochs step). No-op with no add target.
  - **Show shortcuts help** (`?` / `Shift+/`, and `Esc` to close).
  Guard against firing while focus is in a text input/textarea/`contenteditable` or while a modal is open
  (except the help dialog's own Esc). Each binding is a single, well-known chord — no multi-key sequences,
  no overriding `Tab`, `Enter`, `Space`, `F6`, or single-letter keys that AT reserves.
- **Discoverable shortcuts-help affordance.** Add a `ShortcutsHelp` dialog
  (`src/components/ShortcutsHelp/…`) built on the shared `<Modal>`
  ([contract](shared-contracts.md#modal-primitive-contract)) listing each shortcut and its action, opened
  by `?` and by a visible, keyboard-reachable trigger in the header region (`AppLayout.jsx:169-174`) with
  an accessible name (e.g. "Keyboard shortcuts"). Emoji/icon in the trigger gets `aria-hidden="true"` plus
  an `sr-only`/`aria-label` text label, matching the `SaveIndicator.jsx:42` pattern.
- **Full ARIA / tab-order audit & fixes across new pages.** Working through Home, AnimalWorkspace,
  AnimalEditor, DayEditor (each step), and ValidationSummary, fix any gaps so each page has: exactly one
  `main` landmark and a labelled `navigation` landmark (the duplicate-`<main>` class of bug Phase 2 fixed —
  re-verify across all routes); `aria-current="step"` on the active stepper item (already on
  `StepNavigation.jsx:60` and `AnimalEditorStepper.jsx:520` — confirm and extend if any stepper lacks it);
  step-change/status announced via an `aria-live` region (add an `aria-live="polite"` step announcer to
  `AnimalEditorStepper` to match DayEditor's pattern); logical DOM tab order through each stepper and form;
  every interactive control reachable and operable by keyboard; status never conveyed by color alone (icon
  + `sr-only` text accompanies every color-coded status, per `StepNavigation.jsx:66-69`); and interactive
  target size ≥44×44px (add min-size rules in the relevant `.scss` where buttons/links fall short).
- **Un-skip the nested electrode-group keyboard-navigation test.** Replace the `it.skip` at
  `keyboard-navigation.test.jsx:171` with a real test that renders a workspace containing a configured
  animal with electrode groups (via the new fixture helper, see Fixtures), focuses a nested
  electrode-group nav/step control, drives it with `{Enter}`/`' '` (or Alt-arrow step nav), and asserts
  the expected focus/highlight/navigation outcome — mirroring the existing nav tests' assertions. The
  comment at `:172-175` says it was skipped only because "electrode groups require too much initial
  state"; the fixture removes that blocker. If a specific outcome genuinely cannot be asserted in jsdom,
  document the precise reason inline and cover it in the Playwright e2e instead (do not leave a bare
  `it.skip`).
- **Automated Axe checks in CI.** Add **`jest-axe`** as a dev dependency and run Axe inside the existing
  Vitest integration suite (jsdom) — this reuses the `test`/`e2e` CI jobs already in
  `.github/workflows/test.yml` with no new job, and lets the same fixture render every route. Add
  `src/__tests__/integration/axe-a11y.test.jsx`: render `<App />` with the configured-workspace fixture,
  navigate (via hash) to each new route — Home, AnimalWorkspace, AnimalEditor, DayEditor at **each** step
  (overview, devices, epochs, validation, export), ValidationSummary — run `axe(container)` and
  `expect(results).toHaveNoViolations()`. Wire `toHaveNoViolations` into the Vitest setup file so it is
  available suite-wide. Because these run under `npm run test:coverage -- run`, no `.github/workflows/test.yml`
  change is required beyond confirming the new test is picked up; if jsdom cannot exercise a route's
  interactive a11y faithfully, add a complementary `@axe-core/playwright` check in `e2e/` and document the
  split. (Choosing jest-axe keeps the check in the fast unit/integration lane; the e2e fallback is only
  for cases jsdom can't model.)
- **Verify color-contrast tokens meet AA.** Audit the color pairs used on new pages in `src/App.scss` and
  the per-page `.scss` files (e.g. `DayEditor.scss`, `AnimalEditorStepper.scss`, step/status colors) for
  ≥4.5:1 on normal text and ≥3:1 on large text / UI component boundaries (focus rings, status borders).
  Where a pair fails, adjust the hex value (preferring existing already-documented AA/AAA values like
  `:586`/`:601`) and annotate the ratio in a comment as the existing lines do. Add a lightweight
  unit-level contrast assertion (a small JS check over the audited foreground/background pairs) so a future
  color change that drops below AA fails a test.

## Deliberately not in this phase

- **No new product features** and **no component redesigns** — only a11y fixes, the shortcuts hook, and
  the help dialog. If a stepper needs restructuring beyond a11y, that is out of scope.
- **No legacy-view (`LegacyFormView`) a11y work** beyond what the existing landmark/keyboard tests already
  cover — the legacy form is the safety net, not the cutover target.
- **No `<Modal>` reimplementation** — the help dialog consumes the Phase 3 primitive; trap/focus-return are
  verified, not rebuilt.
- **No cutover / flag flips / default-route change** — that is [Phase 11](overview.md#rollout-strategy).
  Routes remain reachable for testing only.
- **No change to YAML output, schema, or step-status gating** — `isExportEnabled` stays as-is; golden
  baselines stay byte-identical.

## Validation slice

| Test | Asserts |
| --- | --- |
| `axe-a11y.test.jsx › Home has no violations` *(integration, jest-axe/jsdom)* | `axe(container)` on the Home route returns zero violations |
| `axe-a11y.test.jsx › AnimalWorkspace has no violations` *(integration)* | zero Axe violations on the workspace route with a configured animal |
| `axe-a11y.test.jsx › AnimalEditor has no violations` *(integration)* | zero Axe violations on the animal editor route |
| `axe-a11y.test.jsx › DayEditor step <overview/devices/epochs/validation/export> has no violations` *(integration)* | zero Axe violations on **each** DayEditor step (5 cases) |
| `axe-a11y.test.jsx › ValidationSummary has no violations` *(integration)* | zero Axe violations on the validation summary route |
| `useGlobalShortcuts › Ctrl/Cmd+S triggers save and prevents default` *(unit)* | save handler called once; `event.defaultPrevented` is true |
| `useGlobalShortcuts › Alt+ArrowRight / Alt+ArrowLeft move stepper` *(integration)* | active step advances / retreats; no-op at ends |
| `useGlobalShortcuts › Alt+N adds an epoch on the Epochs step` *(integration)* | one new epoch row appears; no-op when no add target |
| `useGlobalShortcuts › shortcuts ignored while typing in an input / modal open` *(unit)* | handlers not invoked when focus is in input/textarea or a non-help modal is open |
| `ShortcutsHelp › ? opens help and Esc closes; trigger has accessible name` *(integration)* | dialog opens on `?`, closes on `Esc`, header trigger exposes "Keyboard shortcuts" name |
| `keyboard-navigation.test.jsx › nested electrode group items` *(integration, previously skipped `:171`)* | now **passes**: nested electrode-group control is keyboard-operable and produces expected focus/navigation |
| `aria-landmarks` (extended) *(integration)* | each new route has exactly one `main` and one labelled `navigation`; active stepper item has `aria-current="step"` |
| `a11y-status.test.jsx › status conveyed non-color` *(integration)* | every color-coded status control also exposes icon + `sr-only` text (no color-only signal) |
| `a11y-tab-order.test.jsx › tab order through a stepper` *(integration)* | sequential focus visits stepper controls in DOM/visual order |
| `modal-a11y` (regression) *(integration)* | shared `<Modal>` trap cycles Tab/Shift-Tab and returns focus to opener on close (re-runs Phase 3 assertions) |
| `contrast.test.js › audited color pairs meet AA` *(unit)* | every audited foreground/background pair computes ≥4.5:1 (text) / ≥3:1 (UI) |

Integration tests run in the Vitest jsdom suite (`npm run test:coverage -- run`); the optional
`@axe-core/playwright` fallback (if needed) runs in the `e2e` job (`npm run test:e2e`). Mark any
Playwright additions clearly as e2e (placed under `e2e/`).

## Fixtures

A reusable **configured-workspace builder** so every new route renders real content (not an empty
state that would hide a11y issues). Add a test helper (e.g. `makeConfiguredWorkspace()` in
`src/__tests__/helpers/test-fixtures.js`, the existing helpers module) that returns a `workspace`
object — one fully-configured `Animal` (subject, devices/electrode groups, cameras, experimenters,
behavioral events) with one `Day` (experimentDate, session, tasks, epochs) — shaped to the
[Workspace data model](shared-contracts.md#workspace-data-model--store-actions) and built **only**
via the documented `workspaceActions` (`createAnimal`, `addConfigurationSnapshot`, `createDay`,
`updateDay`) or an equivalent plain object matching that schema, so it stays valid as the model
evolves. Tests render `<App />` inside `<StoreProvider>` seeded with this workspace and navigate by
hash. Reuse this single helper for the Axe suite, the un-skipped electrode-group keyboard test, the
tab-order test, and the status/non-color test — do not copy-paste workspace shapes across files.

## Review

Follow the full gate in [review-protocol.md](review-protocol.md). Phase-specific:

- **Self-verify (§1):** run this phase's Validation slice + `npx vitest run` (no regressions; baseline 2747/1 skipped) + `npx vitest run baselines` (byte-identical). Emphasis: jest-axe assertions are real — every new route (including each DayEditor step) is actually rendered with the configured-workspace fixture and asserted zero violations, no route silently skipped; the previously-skipped `keyboard-navigation.test.jsx:171` test now passes (or any remaining skip documents the precise jsdom limitation inline and is covered by e2e).
- **Playwright UI (§2):** run Axe on every new route (zero violations), do a keyboard-only walkthrough of a full flow, and confirm the global shortcuts work and the shortcuts help is discoverable. 0 console errors.
- **Reviewers:** `pr-review-toolkit:code-reviewer` (always), plus `pr-test-analyzer` and `ux-reviewer` for the deep WCAG 2.1 AA a11y pass (this is the dedicated a11y gate).
- **Checklist (§6):** every task implemented; "Deliberately not in this phase" honored (no new features/redesigns/flag flips); tests non-trivial (shortcuts tests assert handler invocation **and** `preventDefault`/no-op edges; contrast test computes real ratios); no plan/phase/milestone strings in code/test/module names or docstrings; old code flagged for removal is removed; user-facing docs updated.
