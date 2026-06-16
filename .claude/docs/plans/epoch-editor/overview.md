# Overview — scope, integration, risks

[← back to PLAN.md](PLAN.md)

## What this is

Turn the reviewed [epoch-editor mockups](README.md) into the live `modern`-branch app, screen by screen,
as a **presentation reshape over the existing workspace substrate** — not a rewrite. The data model
(`useWorkspace`), export merge (`mergeDayMetadata`), validation gate (`validateDay`), the pure view-model +
command layer (`src/viewModels/*`), and the tabbed animal shell (`AnimalView`) already exist; this plan
builds the new input surfaces on top and keeps the exported YAML byte-identical.

## Current codebase integration points

What each phase touches vs. leaves alone (verified against source):

- `src/hooks/useHashRouter.ts:19,36` — route + tab table: **kept**; components restyled, params extended for repair anchors.
- `src/pages/AnimalWorkspace/index.tsx` — animal picker: **restyled** into Animals home (Phase 1).
- `src/pages/AnimalView/index.tsx` — tabbed animal shell + section-nav: **restyled**, scope-card / blast-radius / Days-table affordances added (Phase 2). Tab structure kept.
- `src/pages/AnimalEditor/*` (ElectrodeGroups/DataAcq/Cameras/TaskTypes/Optogenetics + `wiring/*Container`) — setup tabs: **reused** under the restyled Setup surface (Phase 2), wizard-wrapped (Phase 6).
- `src/pages/DayEditor/DayEditorStepper.tsx` + steps (`Overview/Devices/TasksEpochs/BehavioralEvents/Validation/Export`) — the 5-section editor: **replaced** by the new 4-tab frame (Day / Epochs / Failed channels / DIO). Old steps retired across Phases 3–5 (see each phase's "old code path" note).
- `src/pages/ValidationSummary/index.tsx` + `useValidationSummaryActions.ts` — batch export: **reused** behind the new export-preview + batch result (Phase 5).
- `src/state/workspaceUtils.ts:357` (`mergeDayMetadata`), `src/domain/dayValidationComposer.ts:51` (`validateDay`), `src/io/yaml.ts` — **untouched** (export/gate); consumed, never modified.
- `src/state/workspaceTransitions.ts:435` (`createDayRecord`) — **extended once** to carry `dataFolder` (Phase 3, with the day-level field).
- `src/state/{taskCatalog.ts,taskCatalogActions.ts,workspaceUtils.ts}` — task-catalog is **already live** (the day editor writes `day.taskInstances`, `mergeDayMetadata` prefers them, `createDayRecord` carries them, blob is v3 with v1/v2/v3 fixtures): **reused** by the epoch grid; no activation phase.
- `src/domain/dayLifecycle.ts`, `src/domain/workflowStatus.ts`, `DayLifecycleLegend` — status vocabulary: **reused** (Phase 0 wraps, never redefines).
- `src/viewModels/*` + `commands/*` — view-model/command layer: **extended** with new builders (epoch grid, export-preview) and command ids (multi-select export, epoch ops); pattern unchanged.

## Scope and dependency policy

### Goals

- Every mockup screen shipped live: Animals home, Animal page (Days + Setup), Day editor (Day / Epochs / Failed channels / DIO), Export preview, Create-animal wizard, Import & repair, Copy-from-animal, Recovery review, empty states.
- The cross-cutting affordances: scope-boundary card, blast-radius chips, status vocabulary, undo toasts, multi-select bulk export, autosave indicator (exists), issue-driven readiness, field-level repair, generated-files/data-folder, video 3-state, epoch actions.
- The epoch grid reuses the **already-live** task-type catalog (day `taskInstances` → animal `taskTypes`); no activation work.
- Byte-identical YAML throughout.

### Non-Goals

- **No new export/merge logic, and exactly ONE new validation rule** — the off-export *video-declaration readiness rule* (Phase 4), which adds an issue and never reads/writes merged YAML ([shared-contracts §1](shared-contracts.md#1-byte-identity-gate)). The gate and merge are otherwise consumed, not changed.
- **No legacy `App.js` `formData` work** — the legacy single-page form stays frozen as the `#/` fallback.
- **No data-directory *binding*** (auto-verifying files exist on disk). The data folder is user-supplied text (the deferred binding is a future feature; the per-day status surface is its slot).
- **No dataset-tier catalog** (shared hardware across animals) — out of scope per scope-tiers-ia; the redesign is animal + day tiers only.
- **No golden-fixture regeneration.** A baseline diff means the change is wrong.

### Dependency policy

No new runtime dependencies. New component styles are CSS Modules + design tokens (the shell is already on
modules; page-area modules are in progress — follow that, no new globals).

## Metrics

- `npx vitest run baselines` byte-identical after every phase.
- `npm run lint:ci` (eslint `--max-warnings 0`), `npm run typecheck` (tsc `--noEmit`), `npm test -- run`, `npm run check:schema`, `npm run build`, `npm run test:e2e` all green per phase (the CI job set, `.github/workflows/test.yml`).
- View-model builders for new surfaces unit-tested **without React** (the workflow-view-models discipline); runtime descriptor-coverage check stays green when command ids are added.
- New click-to-toggle grids (channel, DIO) and the epoch caret are **keyboard-operable + axe-clean** (the mockup's standing acceptance criteria).

## Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| A presentation edit silently changes merged YAML | Baseline gate every phase; the one merge-adjacent phase (4, data-folder derivation) and the import round-trip (7) assert byte-identity explicitly in their slice. |
| Epoch grid re-derives validation/merge locally → drift | §2/§5 contracts: the grid reads `validateDay`/`mergeDayMetadata`; builders are pure and tested against them. |
| Data-folder derivation diverges from existing stored paths | Phase 4 verifies `deriveVideoName` reproduces the golden `associated_video_files[].name` (the convention-following target); the golden `associated_files` are placeholders → classified `manual`/verbatim; statescript derivation verified against a synthetic fixture. |
| Reorder/delete in the epoch grid orphans file/video refs | Confirm-before-orphaning (orphan-visibility contract); never auto-scrub; `validateDay` surfaces any orphan. |
| Replacing the 5-section editor strands old step components | Each of Phases 3/4/5 names the step file it retires; Phase 8 verifies no orphaned step/route remains. |

## Rollout Strategy

Phased behind the existing routes. The new surfaces **replace** the old components at the same routes as each
phase merges (no parallel v1/v2 — the old `#/day/:id` stepper is retired piece-by-piece across Phases 3–5,
with each phase naming what it removes). The legacy `#/` form stays as the untouched fallback. No feature
flag: each phase is independently shippable and the route it owns is fully migrated at its merge boundary.
**No persistence schema bump is needed:** the blob is already `v3` (catalog shape), and the only new day
field (`dataFolder`, Phase 3) is additive + **off-export** (absent → `undefined`), so old saved workspaces
load unchanged. If any phase later finds it must change a persisted shape, it follows the standing rule
(bump `WORKSPACE_SCHEMA_VERSION` + registered migrator + checked-in vN fixture).

## Open Questions

1. **Exact filename-derivation token order/case** — `{date}` as `YYYYMMDD` (mockup) vs `mmddYYYY` (the
   *download* filename via `formatDeterministicFilename`) for the in-folder file names. **Best answer:**
   verified empirically in Phase 4 — the golden `associated_video_files[].name`
   (`20230622_sample_01_a1.1.h264`) IS a derivation target and pins the token order; the golden
   `associated_files` are placeholders (no statescript target), so statescript derivation is verified against
   a synthetic convention-following fixture and the golden's statescripts stay `manual` (verbatim, baselines
   green). Not a guess baked into the plan.
2. **`absent` (declared no-video) storage** — must be off-export so it can't alter YAML. **Best answer:** a
   `day.state`-level set of videoless epoch numbers (off-export by construction, like
   `badChannelRemovalAcks`); confirm in Phase 4.
3. **Whether Phase 2 also restyles the setup-tab internals or only wraps them** — **Best answer:** Phase 2
   adds the scope-card/blast-radius/Days-table affordances and restyles the *shell*; the setup-tab editors
   (`AnimalEditor/*`) are reused as-is and only fully restyled if a phase touches them (the wizard, Phase 6,
   reuses their forms). Avoids a giant Phase 2.

## Estimated Effort

~9 PRs. Largest: Phase 4 (epoch grid + drill-in + states + `fileNaming` derivation) ≈ 700–1100 LOC incl.
the pure `epochGridViewModel`. Phases 1/2/3/5 ≈ 300–600 LOC each (mostly components + CSS modules +
view-model extensions). Phases 0/6/7/8 ≈ 250–600 LOC each. Net new *logic* is small (the catalog, merge,
gate, and view-model layers already exist); most LOC is presentation + view-model glue + tests.
