# Overview — Scope, dependencies, integration, risks

[← back to PLAN.md](PLAN.md)

**Theme:** make the modern UI *render* workflow state instead of *discovering* it. Today each page
recomputes section status, export readiness, blocking-vs-warning, next repair target, button
enabled/disabled reasons, and recovery states inline. This plan inserts a pure **view-model layer**
between the existing `src/domain/*` truth functions and the React pages, plus an **intent-command
layer** for writes, so pages become thin renderers and the workflow logic becomes independently
testable.

## Current codebase integration points

The good news (verified): most decision *rules* already live in pure `src/domain/*` functions. The
logic "trapped in components" is mostly **composition + display assembly + action wiring** on top of
them. View-model builders compose the domain functions; they do not reinvent rules.

Domain truth functions (reused, untouched):
- [src/domain/sectionStatus.ts:92,131](../../../src/domain/sectionStatus.ts) — `getAnimalSectionStatus`,
  `getAnimalBlockingSections`; `SECTION_STATUS` (27).
- [src/domain/workflowStatus.ts:413,490](../../../src/domain/workflowStatus.ts) — `getDayRowStatus`,
  `getDayWorkflowStatus`.
- [src/domain/dayLifecycle.ts:28](../../../src/domain/dayLifecycle.ts) — `DAY_LIFECYCLE` (+ `_LABEL`,
  `_DESCRIPTION`, `_ORDER`).
- [src/domain/dayRecovery.ts:71,131](../../../src/domain/dayRecovery.ts) — `DAY_STATUS`,
  `classifyAnimalDays`, `getPresentDayCount`, `dayHasArtifacts`, `describeOwner`.
- `src/domain/workflowOwnership.ts` — `ownershipForIssue`; `src/domain/repairRouting.ts` —
  `repairTargetForIssue` (consumed by `IssueOwnershipHint` / `RepairActionButton` today).
- [src/state/workspaceUtils.ts:357](../../../src/state/workspaceUtils.ts) — `mergeDayMetadata` (day +
  animal → effective metadata; throws on corrupt config).
- `src/state/workspaceSelectors.ts` — `getDaySession`, `getConfigHistory`, `getAnimalDayIds`.

Composition/display logic that the builders will absorb (the "trapped" logic — Phase 0 maps it fully):
- `src/pages/ValidationSummary/validationSummaryRows.ts` — [buildRows:178, buildAnimalRows:279,
  dayChipDisplay:89, deriveChip:57](../../../src/pages/ValidationSummary/validationSummaryRows.ts) (the
  closest thing to a view-model that exists today — Phase 2a generalizes it).
- `src/pages/ValidationSummary/useValidationSummaryActions.ts:84` — readiness counts, batch-export
  preflight, validate/export action state (the write+derive hook).
- `src/pages/AnimalWorkspace/AnimalSetupCard.tsx` — per-section todo/blocking/done + action verb
  assembly; `DayList.tsx` — per-row status→label, recovery branch, row actions; `index.tsx` — empty
  state, day count, create/import affordances.
- `src/pages/AnimalView/index.tsx` — `SECTION_GROUPS`, per-tab `getAnimalSectionStatus` ring, active-tab
  resolution, `?field=` repair anchor.
- `src/pages/DayEditor/*` — stepper step status, Overview field state, inherited/default display,
  bad-channel blocker/ack, breadcrumb.

Left alone: `src/state/useWorkspace.js` (store + actions), the YAML codec (`src/io/`), `nwb_schema.json`,
the validation core (`src/validation/`), all CSS Modules, the frozen legacy form.

## Scope and dependency policy

### Goals

- A pure, tested `src/viewModels/` layer that reproduces today's statuses/messages/actions for the four
  modern surfaces (ValidationSummary, AnimalWorkspace, AnimalView, DayEditor).
- An intent-level `src/viewModels/commands` (or `src/workflow/commands`) layer where the UI calls user
  intent (`createRecordingDay`, `markBadChannels`, …) rather than editing nested objects.
- Pages become thin renderers of view-models; workflow rules are testable without React.
- A boundary-test matrix that becomes the safety net for later UI experiments.

### Non-Goals

- **No change to YAML output.** The export path (`mergeDayMetadata` → `encodeYaml`) is untouched; the
  golden baselines (`npx vitest run baselines`) MUST stay byte-identical through Phases 0–5.
- **No visible UI/UX redesign in Phases 0–5.** Phase 3 is plumbing — same rendered output, sourced from
  the view-model. Visual/redesign work is Phase 6 and explicitly gated behind the test matrix.
- **No change to the domain truth functions' behavior.** Builders compose them; if a builder needs a rule
  that doesn't exist, that's a domain change called out explicitly, not smuggled into a builder.
- **No new validation rules**, no schema changes, no store/action signature changes in Phases 0–3
  (Phase 4 *wraps* actions; it does not change them).

### Dependency policy

No new runtime dependencies. The view-model + command layers are plain TS composing existing modules.

## Metrics

- Each builder phase: a test proving the builder's output reproduces the current page's
  statuses/messages/actions for a representative workspace (the existing component tests + golden
  baselines remain green).
- Phase 3: golden baselines byte-identical; existing page tests pass with at most query-decoupling edits
  (role/text/`data-testid`), never assertion-weakening.
- End state: the four pages contain no inline readiness/severity derivation — every status/label/action
  they render comes from a `*ViewModel`. (Grep check: no `getDayRowStatus`/`getAnimalSectionStatus`/
  `DAY_LIFECYCLE` imports remain in `src/pages/**/*.tsx` — only in `src/viewModels/**`.)

## Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| Builder silently diverges from the component it replaces (different status/label) | Phase 2 builders are written against the CURRENT component output; each has a test asserting parity on a realistic workspace before Phase 3 wires it. |
| A dead view-model layer accumulates if Phase 3 stalls | Phase 2 builders are tested pure functions (not dead — they're the spec); Open Question 1 offers a per-surface vertical-slice alternative if the team wants no gap. |
| `WorkflowSeverity` can't express a real state discovered mid-build | The 4-value vocabulary is validated across ALL four builders (Phases 2a–2d) before any UI commits to it; a gap surfaces as a contract change in shared-contracts.md, not a silent component workaround. |
| Phase 3 wiring introduces a visual regression | Each page-wiring is its own branch+gate+merge with a Playwright spot-check + golden baselines (the repo's established CSS-track cadence). |
| Command layer drifts from store semantics | Phase 4 commands are thin wrappers over existing `workspaceActions`; they add intent naming, not new write logic, and are covered by the Phase 5 matrix. |

## Rollout Strategy

Incremental, no feature flag. View-models ship as additive internal modules (Phases 1–2, no UI change).
Pages migrate one at a time (Phase 3), each behind its own PR + gate; if a wiring regresses it reverts
independently. Commands (Phase 4) wrap existing actions, so writes behave identically. Nothing is
user-visible until Phase 6, which is opt-in experimentation gated by the Phase 5 test matrix.

## Open Questions

1. **Build-all-then-wire (this plan) vs vertical slices?** This plan follows the requested two-stage
   shape: land all four tested read-models (Phase 2) before wiring any page (Phase 3), so the
   `WorkflowSeverity`/contract vocabulary is proven across all surfaces before UI depends on it. The
   alternative is per-surface vertical slices (build+wire ValidationSummary, then AnimalWorkspace, …),
   which avoids a brief window of unconsumed builders and delivers a migrated surface sooner. Current
   answer: two-stage, per request. Switchable without rework (the builders and wirings are the same units
   either way) — decide before starting Phase 3.
2. **`src/viewModels/` vs `src/workflow/`?** This plan uses `src/viewModels/` (the builders are
   view-models; the command sub-layer lives at `src/viewModels/commands/`). Cosmetic; pick before Phase 1.
3. **Phase 4 command id representation** — string ids resolved by a UI-side map, vs a typed
   `Command` union. Current answer: string ids in the view-model (keeps view-models data-only per the
   contract); the page maps id → bound `workspaceActions` handler. Revisit if the map gets unwieldy.

## Estimated Effort

Net additive. Rough diff sizing: phase-1 ~40 LOC (types); each phase-2 builder ~120–250 LOC + ~150–300
LOC tests (DayEditor largest); phase-3 wirings ~30–80 LOC removed-from-component / re-pointed per page;
phase-4 ~150 LOC wrappers + tests; phase-5 ~300 LOC scenario tests. Phase-6 is open-ended and not sized.
