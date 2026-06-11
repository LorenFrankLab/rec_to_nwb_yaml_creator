# Overview — Scope, dependencies, integration, risks

[← back to PLAN.md](PLAN.md)

This effort is driven by [../../research/design-feedback-evaluation.md](../../research/design-feedback-evaluation.md)
(the F1–F6 findings + Post-v3 backlog), [../../research/ux-principles.md](../../research/ux-principles.md)
(the Heer-grounded UX rubric every user-facing change must satisfy), and
[../../research/architecture-assessment.md](../../research/architecture-assessment.md) (the refactor-safety
verdict). Five decisions are locked: **incremental TypeScript**, **design tokens + CSS Modules**, **keep
the legacy path frozen**, **do not make Workspace the default before selective user testing**, and **full
Tasks & Epochs redesign** (quick wins + task-type catalog). Three ordering decisions: **quick wins ship
first**, the **DayEditor decomposition lands before the Tasks rewrites**, and **pre-test UX hardening ships
as three small prompts before task-catalog activation** so the study evaluates the intended workflow rather
than avoidable label/copy/responsive friction.

## Current codebase integration points

(All line numbers verified against `modern` at planning time; an executor should still read the file first.)

- `src/state/useWorkspace.js:420` — `createDay` appends `dayId` (`days: [...getAnimalDayIds(animal), dayId]`); **Phase 1** sorts the array by date here. Duplicate-date collision already throws at `:470`.
- `src/state/useWorkspace.js:500` — `duplicateDay` appends identically; **Phase 1** sorts here too.
- `src/state/useWorkspace.js` `getAnimalDays` (~`:735`) and `src/state/workspaceSelectors.js` `getMostRecentDayId` (~`:99`) — sort-on-read; preserved (redundant safety after Phase 1).
- `src/element/SelectInputPairElement.jsx:14-49,77-88,121-137` — legacy DIO **Type select + "Index:" number** control + `splitTextNumber`. **Phase 1 reads it as the reference but does NOT modify it** (frozen); the parse/join logic is *copied* into a new workspace util.
- `src/pages/AnimalEditor/BehavioralEventsSection.jsx` (controlled inputs ~`:262-267`) — workspace DIO library editor (free-text Description today); **Phase 1** adds the structured Type+Index entry.
- `src/index.css:100-143` — `:root` design tokens. **Phase 3** extends with `--color-grey-500`, `--radius-*`, `--shadow-*`, and a `--z-*` scale.
- `src/index.css:25-27` (`.primary-nav { position: relative; z-index: 1 }`) vs `src/App.scss:20` (`.home-region`, no z-index; desktop `position: fixed` ~`:573`) — the F3 occlusion (DOM siblings: `AppLayout.jsx:248` vs `:282`); **Phase 3** fixes via the z-index scale. *Browser-verify before/after.*
- `src/hooks/useHashRouter.js:23`, `src/pages/AnimalWorkspace/RecordingDaysTab.jsx:60`, `src/pages/AnimalView/index.jsx` (~`:59/:85/:116/:186`) — the `'channel-maps'` route + nav entry + tab; **Phase 4** removes all of them.
- `src/pages/AnimalEditor/ChannelMapEditor.jsx`, `ChannelMapsStep.jsx`, `wiring/ChannelMapsContainer.jsx`, `src/utils/csvChannelMapUtils.js` (imported **only** by the container) — **Phase 4** deletes; `src/__tests__/integration/axe-a11y.test.jsx` + `migrated-dialogs-modal-a11y.test.jsx` import `ChannelMapEditor` directly and **must be updated** in Phase 4.
- `src/utils/channelMapUtils.js:51` `generateChannelMapsForGroup` (invoked from `ElectrodeGroupsContainer.handleSaveGroup` ~`:186`) — **Phase 4 preserves**; this produces the exported maps independently of the editor.
- `src/pages/DayEditor/DayEditorStepper.jsx` → `DevicesStep.jsx` (7-prop drill) — **Phase 5** introduces `DayEditorContext`.
- `src/state/workspaceUtils.js:192` `resolveDayConfig` ↔ `src/domain/validation.js:102` `dayOverrideIssues` — coupled "by comment"; **Phase 5** extracts a shared `deviceOverrideMerge` module (before the catalog touches the merge).
- `src/state/workspaceUtils.js:324` `mergeDayMetadata`, `:44` `TASK_ORDER`, `:39-57` `*_ORDER` arrays — export truth; **Phase 8B** rehearses task-catalog resolution here without activation; **Phase 8C** activates it; **golden baselines gate every touch.**
- `src/pages/DayEditor/TasksEpochsStep.jsx`, `TasksTable.jsx` (emoji `:149`), `TaskModal.jsx`, `TaskEpochsEditor.jsx`, `BehavioralEventsDisplay.jsx` (lock `:101`) — **Phase 6** clarity redesign; **Phase 8C** catalog integration.
- `src/state/cameraUsage.js` `resolveDayCameraUsage` (used by `mergeDayMetadata` ~`:336`) + `animal.cameras` / `day.cameras_used` — the **existing** catalog+per-day-reference pattern Phase 8B/8C mirrors; also the constraint for the `TaskType.camera_id`↔`cameras_used` reconciliation ([C3](shared-contracts.md#c3)).
- `src/components/CalendarDayCreator/CalendarDayCreator.jsx` `currentMonth` initialization from `new Date()` — **Phase 8A-1** changes the add-day calendar to open on the animal's recording timeline (last recording month / next likely day), not wall-clock today.
- `src/domain/workflowStatus.js`, `src/pages/DayEditor/ValidationStep.jsx`, `src/pages/DayEditor/ExportStep.jsx`, `src/pages/ValidationSummary/index.jsx`, `src/pages/AnimalWorkspace/RecordingDaysTab.jsx` — readiness/validated/exported wording. **Phase 8A-1** unifies the vocabulary so "ready", "draft", "validated", and "exportable" do not contradict each other.
- `src/pages/AnimalWorkspace/RecordingDaysTab.jsx` Add Recording Days button (`aria-label` currently says "Show calendar") — **Phase 8A-2** aligns visible/accessibility labels.
- `src/pages/AnimalWorkspace/RecordingDaysTab.jsx` mobile day-row layout + carry-forward copy — **Phase 8A-3** prevents narrow-column wrapping and makes the carry-forward behavior scannable.
- `src/state/persistence.js:63,70,71,97-144` — `WORKSPACE_STORAGE_KEY`, `WORKSPACE_SCHEMA_VERSION=2`, `MIGRATABLE_SCHEMA_VERSIONS={1}`, load branch (device-normalizes only, no transform) — **Phase 7** adds versioned migrators.
- `src/domain/validation.js` (~1142 LOC) — **Phase 9** splits it.
- `src/validation/rulesValidation.js` — has `duplicateTaskEpochs` (~`:752`) and `divergent_task_identity` (`identityDivergences`, ~`:982`, flags same-name/different-description on the exported `tasks[]`). No **catalog-level** `task_name` uniqueness rule exists; **Phase 8B** rehearses the rule and **Phase 8C** activates it, reconciled with `divergent_task_identity`.
- `src/valueList.js` `deviceTypes()` — opaque probe IDs; **Phase 8A-2** adds human summaries (option *values* stay selector-stable) because this is recognition-over-recall work needed before testing.
- `src/pages/ValidationSummary/index.jsx` `deriveChip` (~`:52`) — ignores `day.state.validated` (the persisted flag is written ~`:397`); **Phase 8A-1** consumes it (#4) as part of the lifecycle-vocabulary cleanup; **Phase 9** decomposes the component.
- `src/components/CalendarDayCreator/CalendarDay.jsx:93` (`tabIndex={isToday?0:-1}`), `CalendarGrid.jsx:100` (42 cells in one `role="row"`; built by `getCalendarDays`, defined `:19`, called `:80`) — **Phase 8A-2** calendar a11y (#7/#8).
- `src/state/workspaceTransitions.js:190` `applyConfigurationForwardToAnimal` + `appliedToDays` writes (~`:139,:219`) and `src/state/configDiff.js` `reconcileAppliedToDays` — **Phase 10** makes `appliedToDays` derived (#1).
- Selective-testing routes, seeded fixture, facilitator script, screenshot set, and known-risks note — **Phase 10B** packages these without changing the default entry point.
- CI `.github/workflows/test.yml:~201` (`CI=false npm run build`) + `package.json` `"lint": "eslint --fix --ext .js,.jsx ."` — **Phase 9** re-arms the gate (`CI=true`, stylelint error-level, lint `.ts`).
- **Untouched:** `src/io/yaml.js` export *semantics* (Phase 2 only *types* it); the entire frozen legacy path (`LegacyFormView.jsx`, `element/*`, `*Fields`, `OptogeneticsFields.jsx`, `ntrode/ChannelMap.jsx`); `nwb_schema.json`.

## Scope and dependency policy

### Goals

- Ship F1–F6, applying the [ux-principles.md](../../research/ux-principles.md) rubric to every user-facing change.
- Remove the avoidable UX frictions found in the post-Phase-7 review before selective user testing, split
  into small prompts: timeline/lifecycle representation (8A-1), recognition/a11y (8A-2), and copy/responsive
  attention load (8A-3).
- Incremental TypeScript on the pure core (`io/` → `state/` → `domain/`+`validation/`) with a `tsc --noEmit` CI gate.
- Design-token system + CSS Modules (collision-proof scoping), enforced by stylelint; **re-arm the build gate** (`CI=true` + error-level lint) once debt is paid (Phase 9).
- Versioned persisted-blob migration framework (migrate, never discard).
- Task-type catalog (define once, pick/order per day) producing **byte-identical** YAML, verified end-to-end against trodes_to_nwb for a freshly-authored catalog day.
- Decompose the oversized DayEditor surfaces (`DayEditorContext`) and the `resolveDayConfig`/`dayOverrideIssues` coupling **before** the catalog rewrite.

### Non-Goals

- **No legacy-path *behavioral* changes.** `LegacyFormView`/`element/*`/`*Fields`/`OptogeneticsFields`/`ntrode/ChannelMap.jsx` stay frozen. **Phase 1 does NOT edit the legacy `SelectInputPairElement.jsx`** — it copies the parse/join logic into a new workspace util and leaves the legacy inline copy as-is (it is deleted at the eventual cutover). Phase 4 removes the *workspace* channel-maps editor only.
- **No default-entry cutover.** The root route stays the legacy form until the separate user-testing phase
  recommends otherwise. Claude-Code phases may improve labels/help that point to Workspace, but must not
  redirect `/`, demote the legacy form, or rename it as deprecated.
- **No change to the exported YAML shape.** The catalog is an internal model `mergeDayMetadata` resolves to today's inline `tasks[]`.
- **No dataset-tier / shared-hardware migration** (separate scope-tiers effort). The task catalog is **animal-level** only.
- **No big-bang TS or CSS-Modules conversion** — both are incremental ratchets; only files each phase touches are migrated.

### Dependency policy

- **Add (dev):** `typescript`, `@types/react`, `@types/react-dom`, `@types/node`, `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin` (Phase 2); `stylelint` + `stylelint-config-standard-scss` + (for token enforcement) `@csstools/stylelint-...`/`scale-unlimited/declaration-strict-value` (Phase 3). No new *runtime* dependencies.
- CRA `react-scripts@5` compiles `.ts`/`.tsx` (via Babel — so the production build does **not** type-check; only the `tsc --noEmit` CI step does). **Vitest does NOT transform `.ts` under the current `vitest.config.js`** (its custom `esbuild.include` regex matches `.jsx?` only) — Phase 2's first task fixes this.

## Metrics

- **Golden baselines byte-identical** after every phase: `npx vitest run baselines` green (note this filter also runs performance/state/validation baselines — a superset of the 4 golden YAML fixtures, all must pass).
- Full suite green (`npx vitest run`) + e2e green (`npm run test:e2e`) at each phase boundary; `npm run lint` green.
- `tsc --noEmit` clean over migrated files (grows each typing phase); stylelint clean over migrated stylesheets.
- F3: logo + shortcuts trigger not occluded by `.primary-nav` at desktop and narrow widths (Playwright bounding boxes).
- F2: after duplicating a day to an earlier date, `animal.days` is ascending (assert on the **stored** array).
- jest-axe: zero violations on the redesigned Tasks & Epochs step (Phases 6 & 8C) and the calendar (Phase 8A-2).
- Phase 8A-1: Add Recording Days opens near the animal's last day; lifecycle chips distinguish live-valid,
  persisted-validated, and exported states without contradictory equal-weight copy.
- Phase 8A-2: visible labels and accessible names agree for touched controls; calendar keyboard/a11y is fixed;
  device-type labels are recognition-friendly while option values stay stable.
- Phase 8A-3: desktop + 390px screenshots of Workspace/Animal Days/Day Editor show no overlapping controls
  or narrow-column instructional text.
- Phase 8B: task-catalog conversion utilities reproduce inline `tasks[]` byte-for-byte in unit fixtures,
  but do not bump persisted schema or activate the new UI.
- Phase 8C: a migrated day round-trips through `mergeDayMetadata` byte-for-byte; a *freshly-authored*
  catalog day converts under `nwbinspector --config dandi` with zero CRITICAL (per
  `docs/PIPELINE_REQUIREMENTS.md`); empty/normal/conflict/repair/narrow screenshots make animal-vs-day
  ownership and repair locality visible.
- Phase 9: `CI=true npm run build` passes (zero ESLint warnings); stylelint at error-level passes.
- Phase 10B: testing route map, participant fixture, facilitator script, screenshot set, known-risks note,
  and no-cutover verification are present; `/` still opens the legacy form.

## Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| Converting a file to `.ts` breaks the suite (Vitest doesn't transform `.ts`) | Phase 2 task #1 fixes `vitest.config.js` + `test.include` **before** any conversion; verify existing `.jsx` still parse. |
| Channel-maps removal leaves dangling refs / red build | Phase 4 task #1 is a repo-wide grep sweep; router + nav entry + a11y integration-test imports enumerated; DoD = lint + full suite green, zero dangling refs. |
| User testing evaluates avoidable UI friction instead of the intended workflow | Phases 8A-1/8A-2/8A-3 remove known merge-neutral friction first: calendar timeline mismatch, label drift, lifecycle vocabulary contradictions, copy overload, opaque device labels, and mobile wrapping. |
| Task-catalog merge alters exported YAML | Split the work: Phase 8B builds/rehearses pure conversion utilities without activation; Phase 8C activates with golden baselines, byte-identical migrator round-trip, and a trodes_to_nwb conversion check for a fresh catalog day. |
| Catalog dedup/camera reconciliation ambiguity → plausible-but-wrong YAML | [C3](shared-contracts.md#c3) fixes the dedup key (`task_name`) and the `TaskType.camera_id`↔`cameras_used` rule, with explicit "same name / different env / different camera" fixtures. |
| Persisted-shape change discards real blobs | Phase 7 migration framework lands before any shape change (Phases 8C, 10); bump version only with a registered migrator + a `vN` fixture. |
| `resolveDayConfig`↔`dayOverrideIssues` drift during the catalog change | Phase 5 extracts the shared `deviceOverrideMerge` module **before** Phase 8B/8C touches the merge. |
| Redesigning the Tasks monolith repeatedly | Phase 5 (`DayEditorContext` + targeted decomposition) precedes Phases 6 and 8C so the rewrites ride on clean structure. |
| Testing handoff is too vague to enforce the no-default-entry gate | Phase 10B creates the route map, participant fixture, facilitator script, screenshot set, known-risks note, and explicit `/` legacy-route verification before Phases 11/12. |

## Rollout Strategy

Incremental and non-breaking. TypeScript and CSS Modules coexist with JS/global CSS so no phase is a flag
day. The exported YAML and the frozen legacy path are unchanged throughout, and the root route remains the
legacy form until selective user testing recommends a cutover. The persisted-shape changes (task catalog,
Phase 8C; `appliedToDays`, Phase 10) ship **after** the migration framework (Phase 7) and are gated on
passing migration fixtures. Phase 10B packages the no-cutover testing handoff before Phases 11/12. The build
gate is re-armed (`CI=true`) only in Phase 9 once the warning backlog is cleared. No user-facing feature flag
is required for the implementation phases; each phase is independently shippable and reviewable (Phase 9 may
ship as sub-PRs 9a logic / 9b UI with a stated internal dependency).

## Open Questions

1. **Channel-maps tab after removal (Phase 4):** remove vs. read-only reassurance. **Answer:** remove the tab; surface a one-line "maps are auto-generated from each electrode group's device type" reassurance on the electrode-groups surface.
2. **DIO "Index" label wording (Phase 1):** **Answer:** "DIO line index" + the `Din1` example hint.
3. **Task-catalog tier (Phases 8B/8C):** **Answer:** animal-level (dataset tier out of scope).
4. **CHANGELOG.md does not exist yet** (CLAUDE.md references it as if it does). **Answer:** Phase 1 creates it (Keep a Changelog format) and reconciles the CLAUDE.md references; every later phase appends.
5. **Workspace default entry point:** **Answer:** not in this implementation plan. Keep `/` on the legacy
   form until the separate selective user-testing phase produces a cutover recommendation.

## Estimated Effort

Rough diff sizing (no time estimate): Phase 1 ~small. Phase 2 ~small-medium (config + 2–3 conversions + toolchain). Phase 3 ~medium. Phase 4 ~medium (sweep + deletions + test updates). Phase 5 ~medium (context + module extraction, behavior-preserving). Phase 6 ~medium. Phase 7 ~small-medium. Phase 8A-1 ~small-medium (timeline + lifecycle). Phase 8A-2 ~small-medium (recognition + a11y). Phase 8A-3 ~small-medium (copy + responsive screenshots). Phase 8B ~medium (pure model + migration rehearsal, behavior-preserving). Phase 8C ~large (activation + UI + baselines + integration + comprehension screenshots). Phase 9 ~large (refactors + gate). Phase 10 ~small-medium. Phase 10B ~small-medium (testing handoff package).
