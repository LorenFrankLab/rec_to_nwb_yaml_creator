# Phase 10 — Post-v3 UX backlog (device_type summaries, reconfig wizard, validated indicator, calendar a11y, appliedToDays)

[← back to PLAN.md](PLAN.md) · [overview](overview.md)

The still-open, independently-shippable items from `docs/POST_V3_FOLLOWUPS.md` that survived re-evaluation,
each grounded in the [UX rubric](../../research/ux-principles.md). Small, mostly self-contained; the only
shape change (`appliedToDays`→derived) rides on the Phase 7 migration framework.

**Inputs to read first:**

- `src/valueList.js` `deviceTypes()` — opaque probe IDs; option **values** must stay selector-stable (they key trodes_to_nwb probe-metadata filenames).
- `src/pages/DayEditor/ReconfigWizard.jsx` — no select-all / human labels / success confirmation today (#2).
- `src/pages/ValidationSummary/index.jsx` `deriveChip` (~`:52`) — takes only `stepStatus`, ignores `day.state.validated` (persisted ~`:397`) (#4). (Post-Phase-9 this may live in the extracted `ValidationIssueList`/chip helper — confirm on read.)
- `src/components/CalendarDayCreator/CalendarDay.jsx:93` (`tabIndex={isToday ? 0 : -1}`) and `CalendarGrid.jsx:100` (the single 42-cell `role="row"`; `role="grid"` at `:90`, weekday-header row at `:91`; 42 cells built by `getCalendarDays` ~`:50`) — a11y (#7/#8).
- `src/state/workspaceTransitions.js:190` `applyConfigurationForwardToAnimal` (+ `appliedToDays` writes ~`:139,:219`) and `src/state/configDiff.js` `reconcileAppliedToDays` — the denormalized field vs the trustworthy derivation (#1).
- `src/state/workspaceMigrations.js` (Phase 7) — register the migrator that drops `appliedToDays`.

**Contracts referenced:**

- [C2 — schema version + migration](shared-contracts.md#c2) — dropping stored `appliedToDays` is a persisted-shape change → bump version with a migrator that removes the field.
- [C4 — tokens / CSS Modules](shared-contracts.md#c4) — style touched UI with tokens/modules.

## Tasks

- **device_type human summaries** (pre-cutover item): add display labels to `deviceTypes()` options (e.g. `128c-4s8mm6cm-20um-40um-sl` → "128-ch · 4-shank · 8 mm"). Render the label; keep the **value** (the probe ID) unchanged (recognition over recall). 
- **Reconfig wizard UX** (#2): add select-all / deselect-all and human-readable day labels for long studies, and an explicit success confirmation after apply-forward. `ReconfigWizard.jsx`.
- **Persisted-"Validated" indicator** (#4): have `deriveChip` (or its Phase-9 successor) consume `day.state.validated` so a persisted-validated day is visually distinct from a merely live-valid one.
- **Calendar a11y** (#7): replace `tabIndex={isToday?0:-1}` (`CalendarDay.jsx:93`) with a **roving tabindex** defaulting to the first selectable cell of the displayed month when today is absent. (#8): split the single 42-cell `role="row"` (`CalendarGrid.jsx:100`) into **one `role="row"` per week** (chunks of 7).
- **`appliedToDays` → derived** (#1): drop the stored field; always derive via `reconcileAppliedToDays`. Update `applyConfigurationForwardToAnimal`/`updateDay` to stop maintaining the partition. Register a migrator (C2) that removes `appliedToDays` from persisted snapshots and bump `WORKSPACE_SCHEMA_VERSION`. Internal-only — **not exported**, so baselines are unaffected.
- **Empty-state heading levels** (pre-cutover): finish normalizing any remaining inconsistent setup-tab headings.
- Documentation: mark #1, #2, #4, #7, #8 + the pre-cutover items **resolved** in `docs/POST_V3_FOLLOWUPS.md`; CHANGELOG.

## Deliberately not in this phase

- **#3** (Alt+←/→ vs browser Back/Forward) — deferred pending user feedback.
- **#5** (structured error logging) — cross-app concern, deferred.
- **#10** — already moot (atomic snapshot action).

## Validation slice

| Test | Asserts |
| --- | --- |
| a11y: CalendarDay roving tabindex | with today absent, the first selectable cell of the displayed month is tabbable; arrows move focus across cells. |
| jest-axe: CalendarGrid rows | the grid exposes 6 weekly `role="row"`s of 7 cells, not one 42-cell row. |
| unit: `deriveChip` | a `state.validated` day yields a distinct chip from a live-valid-but-unpersisted day. |
| unit: deviceType labels | the rendered label differs from the value; the option **value** still matches the probe ID exactly. |
| unit: `appliedToDays` derivation + migrator | derived partition equals `reconcileAppliedToDays`; the migrator removes the stored field and the blob hydrates cleanly (C2). |
| `npx vitest run baselines` | byte-identical — none of these touch the export. |
| `npx vitest run` (full) + `npm run test:e2e` | green. |

## Fixtures

A persisted blob carrying `appliedToDays` (pre-#1) for the migrator test; existing calendar/validation/day
fixtures otherwise. No YAML fixture changes.

## Review

Before opening the PR (or per-item PRs), dispatch `code-reviewer` against the diff. Confirm:
- device_type option **values** unchanged (labels added only); calendar is keyboard-reachable off-month and exposes weekly rows (jest-axe clean).
- `deriveChip` distinguishes persisted vs live validity; `appliedToDays` is derived with a registered migrator (C2) and no export change (baselines byte-identical).
- Deferred items (#3, #5) left alone; resolved items marked in `docs/POST_V3_FOLLOWUPS.md`.
- Names don't reference this plan; CHANGELOG updated.
