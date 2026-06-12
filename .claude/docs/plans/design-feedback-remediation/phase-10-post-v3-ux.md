# Phase 10 — Remaining post-v3 UX/shape backlog (appliedToDays v3→v4 + focused UX polish)

[← back to PLAN.md](PLAN.md) · [overview](overview.md)

The still-open, independently-shippable items from `docs/POST_V3_FOLLOWUPS.md` that survived re-evaluation
after Phases 8A-1 through 8C moved the testing-critical UX fixes earlier. Re-evaluation after Phase 8C:
this phase is still worth doing, but it should be split into a shape/migration PR and one or more focused
UX-polish PRs. The only persisted-shape change (`appliedToDays`→derived) rides on the Phase 7 migration
framework; the user-facing work is limited to reconfiguration clarity and small setup-surface polish before
the selective-testing handoff.

**Inputs to read first:**

- `src/pages/DayEditor/ReconfigWizard.jsx` — no long-study list controls / human labels / success confirmation today (#2). Read the current contiguous-suffix semantics before adding selection controls.
- `src/state/workspaceTransitions.js:190` `applyConfigurationForwardToAnimal` (+ `appliedToDays` writes ~`:139,:219`) and `src/state/configDiff.js` `reconcileAppliedToDays` — the denormalized field vs the trustworthy derivation (#1).
- `src/state/workspaceMigrations.js` (Phase 7) — register the migrator that drops `appliedToDays`.
- `src/pages/DayEditor/DevicesStep.jsx` and `src/pages/DayEditor/ReconfigWizard.scss` — reconfiguration entry point + wizard UI.
- `src/pages/AnimalEditor/*Section.jsx`, `src/pages/AnimalWorkspace/RecordingDaysTab.jsx`, and their tests — residual setup empty-state headings/copy.
- `docs/POST_V3_FOLLOWUPS.md` — confirm Phases 8A-1/8A-2 already resolved device_type summaries, validated
  indicator, and calendar a11y before marking them done here.

**Contracts referenced:**

- [C2 — schema version + migration](shared-contracts.md#c2) — dropping stored `appliedToDays` is a persisted-shape change → bump version with a migrator that removes the field.
- [C4 — tokens / CSS Modules](shared-contracts.md#c4) — style touched UI with tokens/modules.

## Tasks

**10a — `appliedToDays` → derived (shape/migration PR):**

- Drop the stored field from new snapshots; always derive usage with `reconcileAppliedToDays`.
- Update `applyConfigurationForwardToAnimal`, `createSnapshotAndApplyForward`, `addConfigurationSnapshotToAnimal`, `rebuildConfigurationHistoryForAnimal`, import creation, tests, and TS types so they no longer maintain or require `appliedToDays`.
- Register a v3→v4 migrator (C2) that removes `appliedToDays` from persisted snapshots and bump `WORKSPACE_SCHEMA_VERSION` from 3 to 4. Internal-only — **not exported**, so baselines are unaffected.
- Keep `reconcileAppliedToDays` as the one UI-facing usage view and add tests proving stale stored lists are ignored before migration and absent after migration.

**10b — Reconfig wizard UX (focused UI PR):**

- Improve long-study readability: compact/human day labels, visible moved-day count, and a scannable range summary.
- Be careful with selection controls: hardware reconfiguration currently applies to a contiguous suffix from the selected day onward. Do **not** add arbitrary non-contiguous checkboxes unless the domain semantics are explicitly changed. Prefer "start day / range" clarity, collapse/expand, search/filter, and select-all/deselect-all only if they preserve a contiguous range.
- Add explicit success feedback after apply-forward. If the wizard immediately navigates to Animal Setup, surface the success in the destination reconfiguration banner/toast rather than closing silently.
- Preserve the existing fork-before-edit semantics and owner-key routing.

**10c — Residual pre-test UI polish (small PR, optional if 10b stays tiny):**

- Normalize remaining Animal Setup empty-state headings/copy/CTA hierarchy so Cameras, Recording System, Electrode Groups, and Task Types read as one system.
- Continue replacing touched global `.button-*`/`.btn-*` drift with the shared button primitive where practical; do not attempt a global styling rewrite.
- Keep this as polish only: no export, validation, persisted-shape, or default-entry changes.

**Documentation (each sub-PR):**

- Mark #1, #2, and residual heading items **resolved** in `docs/POST_V3_FOLLOWUPS.md` only when the corresponding PR lands.
- Verify #4, #7, #8, and device_type summaries are already marked by the relevant 8A split phase if they landed there. Update CHANGELOG.

## Deliberately not in this phase

- **#3** (Alt+←/→ vs browser Back/Forward) — deferred pending user feedback.
- **#5** (structured error logging) — cross-app concern, deferred.
- **#10** — already moot (atomic snapshot action).
- Broad Day Editor decomposition — belongs in Phase 9c.
- A full design-system/global CSS rewrite — Phase 10 only cleans touched UI.
- Any Workspace default-entry / legacy cutover decision.

## Validation slice

| Test | Asserts |
| --- | --- |
| unit: `appliedToDays` derivation + v3→v4 migrator | derived partition equals `reconcileAppliedToDays`; new snapshots omit `appliedToDays`; the migrator removes the stored field and the blob hydrates cleanly (C2). |
| component/e2e: ReconfigWizard | long-study labels/range summary are readable; range controls preserve contiguous-suffix semantics; apply-forward shows explicit success feedback. |
| component/a11y: residual headings/buttons | remaining setup empty states use consistent heading levels, landmarks, CTA labels, and accessible names. |
| `npx vitest run baselines` | byte-identical — none of these touch the export. |
| `npx vitest run` (full) + `npm run test:e2e` | green. |

## Fixtures

A v3 persisted blob carrying `appliedToDays` (pre-#1) for the v3→v4 migrator test; existing
reconfiguration/day fixtures otherwise. For 10b, add or adapt a long-study fixture (60+ days can be
synthetic) only for wizard readability/range tests. No YAML fixture changes.

## Review

Before opening each PR, dispatch `code-reviewer` against the diff. Confirm:
- `appliedToDays` is derived with a registered v3→v4 migrator (C2) and no export change (baselines byte-identical).
- Reconfig wizard improves readability/feedback without accidentally allowing non-contiguous hardware reconfiguration unless explicitly intended.
- UI polish stays small and uses shared primitives/tokens where touched.
- Deferred items (#3, #5) left alone; resolved items marked in `docs/POST_V3_FOLLOWUPS.md`.
- Names don't reference this plan; CHANGELOG updated.
