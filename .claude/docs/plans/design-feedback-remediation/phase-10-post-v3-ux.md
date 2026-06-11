# Phase 10 — Remaining post-v3 UX/shape backlog (reconfig wizard, appliedToDays v3→v4, residual polish)

[← back to PLAN.md](PLAN.md) · [overview](overview.md)

The still-open, independently-shippable items from `docs/POST_V3_FOLLOWUPS.md` that survived re-evaluation
after Phases 8A-1 through 8A-3 moved the testing-critical UX fixes earlier. Small, mostly self-contained;
the only shape change (`appliedToDays`→derived) rides on the Phase 7 migration framework.

**Inputs to read first:**

- `src/pages/DayEditor/ReconfigWizard.jsx` — no select-all / human labels / success confirmation today (#2).
- `src/state/workspaceTransitions.js:190` `applyConfigurationForwardToAnimal` (+ `appliedToDays` writes ~`:139,:219`) and `src/state/configDiff.js` `reconcileAppliedToDays` — the denormalized field vs the trustworthy derivation (#1).
- `src/state/workspaceMigrations.js` (Phase 7) — register the migrator that drops `appliedToDays`.
- `docs/POST_V3_FOLLOWUPS.md` — confirm Phases 8A-1/8A-2 already resolved device_type summaries, validated
  indicator, and calendar a11y before marking them done here.

**Contracts referenced:**

- [C2 — schema version + migration](shared-contracts.md#c2) — dropping stored `appliedToDays` is a persisted-shape change → bump version with a migrator that removes the field.
- [C4 — tokens / CSS Modules](shared-contracts.md#c4) — style touched UI with tokens/modules.

## Tasks

- **Reconfig wizard UX** (#2): add select-all / deselect-all and human-readable day labels for long studies, and an explicit success confirmation after apply-forward. `ReconfigWizard.jsx`.
- **`appliedToDays` → derived** (#1): drop the stored field; always derive via `reconcileAppliedToDays`. Update `applyConfigurationForwardToAnimal`/`updateDay` to stop maintaining the partition. Register a v3→v4 migrator (C2) that removes `appliedToDays` from persisted snapshots and bump `WORKSPACE_SCHEMA_VERSION` from 3 to 4. Internal-only — **not exported**, so baselines are unaffected.
- **Residual heading polish** (pre-cutover): finish normalizing any remaining inconsistent setup-tab empty-state headings that Phases 8A-1/8A-2/8A-3 or 9 did not touch.
- Documentation: mark #1, #2, and residual heading items **resolved** in `docs/POST_V3_FOLLOWUPS.md`; verify #4, #7, #8, and device_type summaries are already marked by the relevant 8A split phase if they landed there. CHANGELOG.

## Deliberately not in this phase

- **#3** (Alt+←/→ vs browser Back/Forward) — deferred pending user feedback.
- **#5** (structured error logging) — cross-app concern, deferred.
- **#10** — already moot (atomic snapshot action).
- Any Workspace default-entry / legacy cutover decision.

## Validation slice

| Test | Asserts |
| --- | --- |
| unit: `appliedToDays` derivation + v3→v4 migrator | derived partition equals `reconcileAppliedToDays`; the migrator removes the stored field and the blob hydrates cleanly (C2). |
| component/e2e: ReconfigWizard | select-all/deselect-all works, long-study labels are readable, apply-forward shows explicit success confirmation. |
| component/a11y: residual headings | remaining setup empty states use consistent heading levels and landmarks. |
| `npx vitest run baselines` | byte-identical — none of these touch the export. |
| `npx vitest run` (full) + `npm run test:e2e` | green. |

## Fixtures

A v3 persisted blob carrying `appliedToDays` (pre-#1) for the v3→v4 migrator test; existing
reconfiguration/day fixtures otherwise. No YAML fixture changes.

## Review

Before opening the PR (or per-item PRs), dispatch `code-reviewer` against the diff. Confirm:
- `appliedToDays` is derived with a registered v3→v4 migrator (C2) and no export change (baselines byte-identical).
- Reconfig wizard improves selection/readability/feedback without changing reconfiguration semantics.
- Deferred items (#3, #5) left alone; resolved items marked in `docs/POST_V3_FOLLOWUPS.md`.
- Names don't reference this plan; CHANGELOG updated.
