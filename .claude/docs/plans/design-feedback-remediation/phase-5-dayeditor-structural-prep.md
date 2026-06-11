# Phase 5 — DayEditor structural prep: DayEditorContext + shared deviceOverrideMerge (behavior-preserving)

[← back to PLAN.md](PLAN.md) · [overview](overview.md)

Pure-refactor phase that lands **before** the Tasks-screen rewrites (Phases 6, 8C) so they ride on clean
structure instead of churning an 825-LOC monolith twice. Two targeted moves: kill the Day Editor's 7-prop
drill with a context, and extract the `resolveDayConfig`↔`dayOverrideIssues` merge into one shared module so
the catalog change (Phase 8C) can't reintroduce the drift the assessment flagged. **Zero behavior change** —
golden baselines change by zero bytes and every contract/guard test stays green.

**Inputs to read first:**

- `src/pages/DayEditor/DayEditorStepper.jsx` → `DevicesStep.jsx` — the 7-prop drill (`{ animal, day, mergedDay, onFieldUpdate, animalDays, actions, animalKey }`) and the step components that receive it.
- `src/state/workspaceUtils.js:192` `resolveDayConfig` (override > snapshot > fail) and `src/domain/validation.js:102` `dayOverrideIssues` — the pair coupled "by comment only"; both must produce identical results after extraction.
- `src/__tests__/architectureBoundaries.guard.test.js`, `src/state/__tests__/store-public-api.test.js`, `src/domain/__tests__/dayValidation.contract.test.js` — the contracts that make this refactor safe; must pass **unchanged**.

**Contracts referenced:**

- [C1 — YAML byte-identity](shared-contracts.md#c1) — behavior-preserving ⇒ zero-byte baseline change.

## Tasks

- **Extract `deviceOverrideMerge`** (e.g. `src/domain/deviceOverrideMerge.js`, typed `.ts` since it's pure): a single module encapsulating the override > snapshot resolution + the "can this override be honored cleanly?" check, consumed by **both** `resolveDayConfig` (`workspaceUtils.js:192`) and `dayOverrideIssues` (`validation.js:102`). Replace the by-comment coupling; behavior identical for valid / override / corrupt-override days.
- **Add `DayEditorContext`** providing `{ animal, day, mergedDay, animalDays, onFieldUpdate, actions, animalKey }` from `DayEditorStepper`; refactor `DevicesStep` and sibling steps to consume the context instead of receiving the 7-prop bundle. Behavior identical (same renders, same field-update flow, same focus/repair handling).
- Keep the public store action/selector surface unchanged (`store-public-api.test` stays green) — this phase introduces no new actions.
- Documentation: CHANGELOG (refactor, no behavior change); a one-line update to [../../research/architecture-assessment.md](../../research/architecture-assessment.md) marking the override-merge extraction + DayEditorContext done.

## Deliberately not in this phase

- Decomposing `ValidationSummary`/`RecordingDaysTab` or splitting `domain/validation.js` — [Phase 9](phase-9-architecture-cleanup.md) (this phase is only the two items the Tasks/catalog work depends on).
- Any change to validation **rules**, the export, or the persisted shape — structure only.
- The Tasks & Epochs UI redesign itself — [Phase 6](phase-6-tasks-epochs-redesign.md).

## Validation slice

| Test | Asserts |
| --- | --- |
| `npx vitest run baselines` | **zero byte diff** — behavior-preserving (C1). |
| unit: `deviceOverrideMerge` | identical results to pre-refactor `resolveDayConfig`/`dayOverrideIssues` for valid, bad-channel-override, and corrupt-override days. |
| `dayValidation.contract.test` | passes unchanged — issue codes/ownership/steps stable. |
| `architectureBoundaries.guard.test` | passes — the new module/context introduce no forbidden imports. |
| `store-public-api.test` | passes unchanged. |
| `npm run typecheck` | clean (incl. the new `.ts` module). |
| e2e (Day Editor) | the stepper + DevicesStep behave identically (field edits, navigation, repair focus). |

## Fixtures

Reuse existing day fixtures incl. a `deviceOverrides`/bad-channel day and a corrupt-override day (these
encode the behavior the extraction must preserve). No new fixtures.

## Review

Before opening the PR, dispatch `code-reviewer` against the diff. Confirm:
- Baselines change by **zero bytes**; all contract/guard tests pass unchanged.
- `resolveDayConfig` and `dayOverrideIssues` share **one** merge module (drift eliminated); results provably identical.
- `DayEditorContext` removes the 7-prop drill with no behavior change.
- No rule/export/persisted-shape change crept in; names don't reference this plan; CHANGELOG + architecture note updated.
