# Phase 9 — Architecture cleanup + re-arm the build gate (behavior-preserving)

[← back to PLAN.md](PLAN.md) · [overview](overview.md)

Finish the maintainability work the assessment flagged that Phase 5 didn't already pull forward: split the
1142-LOC validation monolith, decompose the two largest page components, extend TypeScript into the split
modules, and — the research's #3 ROI item the first draft dropped — **re-arm the build gate** (`CI=true` +
error-level lint/stylelint). **Zero behavior change** — golden baselines change by zero bytes; contract/guard
tests stay green. Ships as two sub-PRs: **9a** logic, **9b** UI + gate (9b depends on 9a).

**Inputs to read first:**

- [../../research/architecture-assessment.md](../../research/architecture-assessment.md) — the hotspot list + target structure (the rationale).
- `src/domain/validation.js` (~1142 LOC) — composes schema + rules + override checks + step routing; the split target. (Phase 5 already extracted `deviceOverrideMerge`.)
- `src/pages/ValidationSummary/index.jsx` (~1033 LOC; `deriveChip` ~`:52`) and `src/pages/AnimalWorkspace/RecordingDaysTab.jsx` (~822 LOC) — decomposition targets.
- `src/domain/__tests__/dayValidation.contract.test.js`, `src/state/__tests__/store-public-api.test.js`, `src/__tests__/architectureBoundaries.guard.test.js` — the contracts that must stay green.
- `.github/workflows/test.yml` (~`:201`, `CI=false npm run build`) and `package.json` `"lint"` — the gate to re-arm; the ~275 ESLint warnings to clear.

**Contracts referenced:**

- [C1 — YAML byte-identity](shared-contracts.md#c1) — behavior-preserving ⇒ zero-byte baseline change.
- [C4 — tokens / CSS Modules](shared-contracts.md#c4) — migrate touched component styles to modules; ratchet stylelint to error-level.

## Tasks

**9a — logic (one PR):**

- Split `domain/validation.js` into focused modules (e.g. `validation-composer` / `step-routing`; the
  override-validation already shares Phase 5's `deviceOverrideMerge`), **keeping public exports stable** —
  `dayValidation.contract.test` pins issue codes/ownership/steps and must pass unchanged.
- Continue TypeScript: convert the newly-split pure validation modules and leaf `state/` selectors/transitions to `.ts`; `tsc --noEmit` stays clean.

**9b — UI + build gate (one PR, depends on 9a):**

- Decompose `ValidationSummary/index.jsx` (extract a `ValidationIssueList` + a focus hook) and `RecordingDaysTab.jsx` (extract list/sort/filter state) into sub-components; migrate their styles to CSS Modules (C4). No UI/behavior change.
- **Re-arm the build gate:** clear the ~275 ESLint warnings (the deferred lint debt), flip `CI=false`→`CI=true` in `test.yml` so the build fails on lint errors, and ratchet stylelint from warn to **error** level. This is the research's #3 ROI item ("build catches drift again").

- Documentation (both): CHANGELOG (refactor + gate, no behavior change); update [../../research/architecture-assessment.md](../../research/architecture-assessment.md) to reflect what's now done.

## Deliberately not in this phase

- Any change to validation **rules**, export behavior, or the persisted shape — structure only.
- The frozen legacy path — untouched.
- New features / UX changes.

## Validation slice

| Test | Asserts |
| --- | --- |
| `npx vitest run baselines` | **zero byte diff** (C1). |
| `dayValidation.contract.test` | passes unchanged after the `validation.js` split. |
| `architectureBoundaries.guard.test` + `store-public-api.test` | pass unchanged. |
| `npm run typecheck` | clean over newly-typed modules. |
| `CI=true npm run build` | passes — **zero ESLint warnings** (the gate is now armed). |
| `npm run lint:css` (error-level) | passes. |
| `npx vitest run` (full) + `npm run test:e2e` | green. |

## Fixtures

Reuse existing contract/golden/day fixtures. No new fixtures.

## Review

Before opening each sub-PR (9a, 9b), dispatch `code-reviewer` against the diff. Confirm:
- Baselines change by **zero bytes**; all contract/guard tests pass unchanged.
- `validation.js` split keeps exports stable; decomposed components behave identically; touched styles use modules.
- The build gate is re-armed (`CI=true`, zero warnings, stylelint error-level).
- No rule/export/persisted-shape change crept in; legacy untouched; names don't reference this plan; CHANGELOG + architecture note updated.
