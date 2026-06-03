# Verification & Review Protocol

[← back to PLAN.md](PLAN.md)

The gate every phase passes **before its PR is opened/merged**. Each phase's `## Review` section links
here and then lists only what is *phase-specific* (the exact Playwright flow to drive and which
optional reviewers apply). This file is the single home for the shared protocol — do not restate it
in phase files.

Run the steps **in order**. Steps 1–3 are mandatory for every phase; steps 4–5 apply per the
[review matrix](#per-phase-review-matrix). Evidence (command output, reviewer verdicts) goes in the PR
description — claims without evidence don't count (`verification-before-completion`).

## 1. Self-verification (every phase)

- Run the phase's **Validation slice** tests and paste results.
- Run the **full suite**: `npx vitest run` — baseline is **2747 passed / 1 skipped**; a phase may add
  tests but must not regress existing ones.
- Run **golden baselines**: `npx vitest run baselines` — MUST be byte-identical. A diff is a blocker,
  never regenerate to "make it pass" (CLAUDE.md Regression Prevention Protocol).
- `npm run lint` — no new errors.

## 2. Playwright UI verification (UI-bearing phases)

For any phase that changes rendered UI, verify the real flow in a browser before review — the
committed tests prove *regressions are caught*; this proves *the change actually works for a user*.
See CLAUDE.md "Using Playwright (for Claude)".

- Start the app: `npm run start` (→ `http://localhost:3000`). Requires `npx playwright install chromium` once.
- Drive the phase-specific flow with the **Playwright MCP**, accessibility-tree-first:
  `browser_navigate` → `browser_snapshot` → act by `ref` (`browser_click`/`browser_fill_form`) →
  `browser_snapshot` to confirm the resulting state. Use `browser_take_screenshot` only for visual
  confirmation. Check `browser_console_messages` shows **0 errors**. `browser_close` when done.
- **Durability:** if the flow is a guarantee that must not regress, add/extend a committed
  `@playwright/test` spec in `e2e/` (run `npm run test:e2e`). MCP verification is not a substitute for
  a committed test.

## 3. Code review (every phase)

Dispatch **`pr-review-toolkit:code-reviewer`** against the diff (`git diff` of the phase branch). It
checks adherence to CLAUDE.md, style, and correctness. Then apply feedback via
`superpowers:receiving-code-review` — verify each point technically; don't blindly implement.

## 4. Specialized reviewers (per matrix)

Dispatch only those marked for the phase:

- **`pr-review-toolkit:silent-failure-hunter`** — phases with error handling, persistence, export, or
  fallback logic. Hunts swallowed errors / false-success.
- **`pr-review-toolkit:pr-test-analyzer`** — feature phases. Confirms tests cover new behavior + edge
  cases, not tautologies.
- **`pr-review-toolkit:type-design-analyzer`** — phases introducing new types/contracts (persisted
  shapes, the Modal API, config snapshots).
- **`pr-review-toolkit:comment-analyzer`** — phases adding substantial docstrings/comments.

## 5. UX / accessibility review (UI-bearing phases)

- **`ux-reviewer`** — new/changed user-facing flows: clarity, error prevention, no dead-ends, feedback,
  data-loss safety. Critical for this app's domain-scientist users.
- **`ui-designer`** — visual/Material-Design consistency where layout/styling changed.
- **Accessibility (WCAG 2.1 AA):** every UI phase confirms landmarks, focus management, keyboard nav,
  non-color status cues, ≥44px targets. **Phase 9** is the deep, automated-Axe pass; earlier UI phases
  do the baseline manual check so debt doesn't accumulate.

## 6. Template checklist (every phase)

Confirm the items already in each phase's `## Review` block: every task implemented; "Deliberately not
in this phase" honored (no scope creep); slow/integration tests marked; tests non-trivial
(`testing-anti-patterns`); no plan/milestone/phase strings in code/test names/docstrings; old code
flagged for removal is actually removed; user-facing docs updated, not deferred.

## Per-phase review matrix

| Phase | Playwright UI (§2) | silent-failure | test-analyzer | type-design | ux/ui (§5) | Notes |
| --- | :---: | :---: | :---: | :---: | :---: | --- |
| 0 — setup/CI | — | — | — | — | — | No UI. §1 emphasizes build + baselines + CI-on-`modern`. |
| 1 — persistence | ✓ (save → reload restores; indicator truthful) | ✓ | ✓ | ✓ (persisted blob shape) | light (SaveIndicator copy/a11y) | |
| 2 — nav/stub/a11y | ✓ (nav all routes; no dead-ends; stub steps disabled) | — | — | — | ✓ + a11y (landmarks/focus) | |
| 3 — shared modal/feedback | ✓ (modal open/trap/ESC/focus-return; confirm dialog; no `alert`) | — | — | ✓ (Modal API) | ✓ + a11y | |
| 4 — tasks/epochs | ✓ (task CRUD; epoch editor; camera-inheritance banner) | — | ✓ | — | ✓ + a11y | |
| 5 — validation/export | ✓ (validate → export downloads file; gate blocks on mismatch) | ✓ (export/shadow gate) | ✓ | — | ✓ | Parity is the headline — §1 golden round-trip is mandatory. |
| 6 — store/CSS refactor | smoke (app still renders/works; visual check after CSS merge) | — | ✓ | — | visual-regression check | Behavior-preserving: full suite + baselines are the proof. |
| 7 — validation summary/batch | ✓ (validate-all; export-valid-only; reload recovery) | ✓ (batch export) | ✓ | — | ✓ | |
| 8 — probe wizard | ✓ (config diff; apply-forward across days) | — | ✓ | ✓ (snapshot/versioning) | ✓ | |
| 9 — a11y/keyboard | ✓ + **Axe zero-violations per route**; keyboard-only walkthrough | — | ✓ | — | ✓ deep a11y (`ux-reviewer`) | The dedicated a11y gate. |
| 10 — cutover v3 | ✓ **full E2E** (create→configure→day→tasks→validate→export with flags on; legacy toggle) | ✓ | ✓ | ✓ | Final release/parity sign-off. |
