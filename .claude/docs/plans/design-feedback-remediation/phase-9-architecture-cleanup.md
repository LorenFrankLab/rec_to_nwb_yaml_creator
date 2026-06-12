# Phase 9 — Architecture cleanup + re-arm the build gate (behavior-preserving)

[← back to PLAN.md](PLAN.md) · [overview](overview.md)

Finish the maintainability work the assessment flagged that Phase 5 did not already pull forward: split the
validation monolith, decompose the largest workspace/day-editor surfaces, extend TypeScript into split pure
modules, and — the research's #3 ROI item — **re-arm the build gate** (`CI=true` + error-level
lint/stylelint). Default target: **zero behavior change relative to the post-8C app** — golden baselines
change by zero bytes; contract/guard tests stay green.

Re-evaluation after Phase 8C: this phase is still worth doing, but it is too broad as a single PR. Ship it
as three small, reviewable sub-PRs: **9a** logic, **9b** build gate, **9c** UI decomposition. 9b depends on
9a only where the split introduces new lint/type surfaces; 9c depends on neither except that it must preserve
the post-8C UI behavior. If 8C becomes blocked by validation-module size, it is acceptable to run **9a only**
before 8C; in that branch, 9a's preservation target is the then-current post-8A/8B app, and 9b/9c wait until
after 8C unless explicitly re-scoped.

**Inputs to read first:**

- [../../research/architecture-assessment.md](../../research/architecture-assessment.md) — the hotspot list + target structure (the rationale).
- `src/domain/validation.js` (~1200 LOC after 8C) — composes schema + rules + override checks + step routing; the split target. (Phase 5 already extracted `deviceOverrideMerge`.)
- `src/pages/ValidationSummary/index.jsx` (~1100 LOC), `src/pages/AnimalWorkspace/RecordingDaysTab.jsx` (~845 LOC), and `src/pages/DayEditor/DevicesStep.jsx` (~860 LOC after the task-catalog camera/checklist fixes) — decomposition targets. Preserve Phase 8A lifecycle wording, label parity, responsive behavior, and Phase 8C catalog-shape fixes.
- `src/domain/__tests__/dayValidation.contract.test.js`, `src/state/__tests__/store-public-api.test.js`, `src/__tests__/architectureBoundaries.guard.test.js` — the contracts that must stay green.
- `.github/workflows/test.yml` (`CI=false npm run build`) and `package.json` `"lint"` — the gate to re-arm. **Two different ESLint surfaces:** the CRA *build* (`react-app` config) is what `CI=true` gates; `npm run lint` / `npx eslint` report the broader repo warning debt. Clear build-surface warnings first; broader lint can be ratcheted separately.

**Contracts referenced:**

- [C1 — YAML byte-identity](shared-contracts.md#c1) — behavior-preserving ⇒ zero-byte baseline change.
- [C4 — tokens / CSS Modules](shared-contracts.md#c4) — migrate touched component styles to modules; ratchet stylelint to error-level.

## Tasks

**9a — validation/domain logic (one PR):**

- Split `domain/validation.js` into focused modules (e.g. `validation-composer` / `step-routing`; the
  override-validation already shares Phase 5's `deviceOverrideMerge`), **keeping public exports stable** —
  `dayValidation.contract.test` pins issue codes/ownership/steps and must pass unchanged.
- Continue TypeScript: convert the newly-split pure validation modules and leaf `state/` selectors/transitions to `.ts`; `tsc --noEmit` stays clean.

**9b — build gate (one PR):**

- **Re-arm the build gate:** clear the **CRA build-surface** ESLint warnings (~79, the set emitted during `npm run build`), flip `CI=false`→`CI=true` in `test.yml` so the build fails on them, and ratchet stylelint from warn to **error** level. (Clearing the broader `npm run lint` set of 275 is good hygiene but only the build-surface set gates `CI=true`.) This is the research's #3 ROI item ("build catches drift again").
- Normalize the lint scripts so verification can run without mutating the tree (e.g. keep an explicit fix script separate from the non-fixing CI lint command).

**9c — UI decomposition (one or more small PRs):**

- Decompose `ValidationSummary/index.jsx` (extract issue-list/count/batch-export/focus pieces) with no wording or export-eligibility change.
- Decompose `RecordingDaysTab.jsx` (extract setup card, day-list row/actions, filtering/sort state) without changing lifecycle/status semantics or mobile layout.
- Decompose `DevicesStep.jsx` (extract recording-system picker wrapper, cameras-used checklist, config-version/reconfiguration panel, failed-channel groups) while preserving the Phase 8C catalog camera checklist behavior and the device-override repair paths.
- Migrate only touched styles toward CSS Modules/shared primitives where practical (C4). Do not attempt a global style rewrite in this phase.

- Documentation (each sub-PR): CHANGELOG (refactor + gate, no behavior change); update [../../research/architecture-assessment.md](../../research/architecture-assessment.md) to reflect what's now done.

## Deliberately not in this phase

- Any change to validation **rules**, export behavior, or the persisted shape — structure only.
- The frozen legacy path — untouched.
- New features / UX changes, including reconfiguration UX changes and any Workspace default-entry decision.

## Validation slice

| Test | Asserts |
| --- | --- |
| `npx vitest run baselines` | **zero byte diff** (C1). |
| `dayValidation.contract.test` | passes unchanged after the `validation.js` split. |
| `architectureBoundaries.guard.test` + `store-public-api.test` | pass unchanged. |
| `npm run typecheck` | clean over newly-typed modules. |
| `CI=true npm run build` | passes — **zero build-surface ESLint warnings** (the gate is now armed). |
| `npm run lint:css` (error-level) | passes. |
| focused UI tests for decomposed surfaces | pass unchanged; add regression tests only where extraction reveals an uncovered behavior. |
| `npx vitest run` (full) + `npm run test:e2e` | green. |

## Fixtures

Reuse existing contract/golden/day fixtures. No new fixtures.

## Review

Before opening each sub-PR (9a, 9b, 9c), dispatch `code-reviewer` against the diff. Confirm:
- Baselines change by **zero bytes**; all contract/guard tests pass unchanged.
- `validation.js` split keeps exports stable; decomposed components behave identically; touched styles use modules/shared primitives where scoped.
- The build gate is re-armed (`CI=true`, zero build-surface warnings, stylelint error-level).
- No rule/export/persisted-shape change crept in; legacy untouched; names don't reference this plan; CHANGELOG + architecture note updated.
