# Architecture & refactor-safety assessment — rec_to_nwb_yaml_creator

**Date:** 2026-06-10 · **Branch:** `modern` · Companion to
[design-feedback-evaluation.md](./design-feedback-evaluation.md) and [ux-principles.md](./ux-principles.md).

Goal (user's words): *"make sure the code is following best practices for a web application of this kind …
that we can refactor things safely in the future and more easily make changes."* Based on three
read-only codebase investigations (state/layering, component organization, tooling/types/tests) +
web-grounded current best practice.

## Headline verdict

**The foundations are genuinely good — better than the F6 styling sprawl suggests. Refactor-safety ≈ 7/10.**
The codebase already does several things most React apps don't: it **enforces layer boundaries with a
test**, keeps business logic **pure and React-free**, and **locks the data contract with golden
baselines + contract tests**. The weak spots are concentrated and addressable: **no static types**,
**a handful of oversized files/components**, **~2,000 LOC of legacy dead-weight**, **CSS with no scoping
or enforced tokens** (F6), and **deferred lint debt that weakens the build gate**.

### What's already strong (keep / build on)

- **Enforced architecture boundaries.** `src/__tests__/architectureBoundaries.guard.test.js` scans the
  real tree and fails the build on forbidden imports (domain/state → pages; page → sibling page, minus an
  allowlist). This is a rare, high-value guardrail — *the dependency direction can't silently rot.*
- **Pure, layered core.** `domain/`, `validation/`, `io/`, and the export builders in
  `state/workspaceUtils.js` are **React-free pure functions**. `io/yaml.js` is a thin deterministic codec.
  Clean unidirectional flow: components → `useStoreContext` → actions/selectors → pure transitions → persistence.
- **Strong test seams that survive refactors.** 4,522 tests / 299 files / 80% coverage threshold. The
  *contract* tests are the gold: `golden-yaml.baseline.test.js` (byte-identical export over 4 fixtures),
  `store-public-api.test.js` (locks the action/selector surface), `dayValidation.contract.test.js` (pins
  issue codes/ownership/step), plus Playwright e2e. These catch the renames/key-reorders that a type
  system would — *at test time.*
- **Solid CI:** parallel unit/coverage/e2e + a schema-sync check against trodes_to_nwb.

### What makes change hard today (the gaps)

| Gap | Evidence | Why it bites refactoring |
| --- | --- | --- |
| **No static types** ⏳ PARTIAL | Incremental TS underway (`tsc --noEmit` CI gate live): `io/yaml.ts`, `state/workspaceTypes.ts` + the task-catalog modules, `domain/deviceOverrideMerge.ts` + `domain/optoCompleteness.ts`, and the Phase-9a validation leaf modules (`repairRouting`/`geometryProvenance`/`dayOverrideValidation`/`stepStatus`) are `.ts` under `strict`; the **entire `validation/` directory** (leaf predicates + `rules/*` families + `rulesValidation` composer + `index`/`schemaValidation`/`rawShape`/`quickChecks`/`useQuickChecks` + the shared `issueTypes.ts`) is now `.ts` under `strict`; the `state/` migration is underway — the persistence layer (`state/workspaceMigrations.ts` + `state/persistence.ts`) the canonical read layer (`state/workspaceSelectors.ts`, `unknown`-in / typed-container-out), the first selector-consumers (`state/configDiff.ts`, `state/cameraUsage.ts`), the pure transition layer (`state/workspaceTransitions.ts`, the day-creation / configuration-snapshot / apply-config-forward mutators), and the export-merge utilities (`state/workspaceUtils.ts` — `mergeDayMetadata`, `resolveDayConfig`, the `reorderKeys`/`emit*` ordering primitives; byte-identical export, golden-baseline-verified), the store-mutation action factory (`state/workspaceActions.ts` — `createWorkspaceActions`'s 13 animal/day actions over a typed `WorkspaceActionPrimitives` contract), the hydration initializer (`state/workspaceHydration.ts` — `resolveInitialWorkspace`, the pure `useState` initializer), two pure leaf modules (`state/identityDivergence.ts` — Spyglass identity-divergence detection; `state/repairCommands.ts` — the serializable repair-command executor), and the **YAML-import flow** (`state/yamlImport.ts` decompose/recompose, `state/yamlImportPlan.ts` `planImport`, `state/yamlImportApply.ts` `applyImportPlan` — round-trip-byte-identity-verified), and the **React state-shell hooks** (`state/useWorkspacePersistence.ts`, `state/useWorkspace.ts`, `state/useEpochCleanup.ts`, `state/store.ts`, `state/StoreContext.tsx` — the workspace store's hook layer; `StoreContext` dropped runtime PropTypes for a typed props interface) are `.ts`/`.tsx`. **The ENTIRE `state/` directory is now typed except the legacy form (`useLegacyForm.js`).** The `domain/` migration has begun — `domain/rigConstants.ts` / `animalDeleteCascade.ts` / `stepGate.ts` / `optoStatus.ts` / `humanizeValidationMessage.ts` / `dayLifecycle.ts` / `deviceOverrides.ts` (pure display/gate/cleanup utilities) join the already-typed `deviceOverrideMerge`/`optoCompleteness`/`repairRouting`/`geometryProvenance`/`dayOverrideValidation`/`stepStatus`. Remaining: `useLegacyForm` (legacy) + the rest of `domain/` (~11 .js), most components, and the legacy form path stay JS (`checkJs:false`) | Rename a domain fn or change an `Animal`/`Day` shape → **silent until a test happens to exercise it.** No safe IDE rename, no null-safety. Tooling agent scored type-safety **2/10** (improving as the pure core converts). |
| **Oversized files/components** ⏳ PARTIAL | ~~`domain/validation.js` 1142~~ ✅ split (Phase 9a) into routing/provenance/producers/composer/step-status modules · ~~`validation/rulesValidation.js` 1108~~ ✅ split into `validation/rules/*` families (reference / opto / channelMap / electrodeGroup / dandiSubject / identity / behavioralEvent) + a 96-LOC composer · `valueList.js` 1073 · ~~`ValidationSummary/index.jsx` 1033~~ ✅ decomposed (Phase 9c-1) into rows-helpers / batch-action hook / ExportReport / BatchExportPreflight / DayStatusTable (index now 306) · ~~`DevicesStep.jsx` 825~~ ✅ decomposed (Phase 9c-3) into CamerasUsedSection / OverrideCleanupSection / ConfigVersionPanel / ElectrodeGroupsAccordion (step now 424) · `OptogeneticsFields.jsx` 826 · ~~`RecordingDaysTab.jsx` 822~~ ✅ decomposed (Phase 9c-2) into AnimalSetupCard / ExistingDataReview / DayList / DuplicateDayModal (tab now 496) · ~~`useWorkspace.js` 851~~ ✅ split into `workspaceActions` (createWorkspaceActions factory) / `useWorkspacePersistence` (status + autosave + saveNow) / `workspaceHydration` (resolveInitialWorkspace) + a pure `getAnimalDays` in `workspaceSelectors` (hook now 98) | High intrinsic load to change; many concerns per file; merge-conflict magnets. |
| **~2,000 LOC legacy dead-weight** | `OptogeneticsFields.jsx` (826, imported only by `LegacyFormView`), `element/*`, `*Fields`, `LegacyFormView.jsx` — parallel to the workspace path | Every workspace UX/styling change risks needing a legacy twin; or the legacy code rots unmaintained. |
| **CSS: no scoping, partial tokens** (= F6) | Global CSS, `.button-primary` redefined in 6 files, two different error icons, ~60% token adoption, mixed `.css`/`.scss` | Visual inconsistency *and* fragile edits — changing a shared style can leak across components. |
| **Build-gate weakened** ✅ RESOLVED | CI now builds with `CI=true` (Phase 9b) — ESLint warnings fail the build again; a `tsc --noEmit` CI job exists. The former ~130 build-surface warnings were cleared (5 real correctness fixes + turning off the @param/@returns JSDoc *type* rules, redundant with the TS migration). Stylelint error-level ratchet deferred to a dedicated CSS phase. | Problems are warned, not enforced; drift accumulates. |
| **Coupled critical pair** ✅ RESOLVED | `resolveDayConfig` ↔ `dayOverrideIssues` now both build on the shared pure `domain/deviceOverrideMerge.ts` (override > snapshot resolution + shape classification), so the by-comment lock-step is gone | A change to one without the other = silent export corruption (only golden baselines catch some of it). |
| **Prop-drilling in Day Editor** ✅ RESOLVED | `DayEditorStepper` now provides the shared per-day bundle via `DayEditorContext`; sections read it from context instead of the 7-prop drill | Signature changes cascade across 5 components; container pattern exists only in `AnimalEditor/wiring/`. |
| **Persistence migration gap** | `persistence.js` discards on `schemaVersion` mismatch; no forward migration (= Post-v3 #6) | Any persisted-shape change risks discarding real user data — **release-gating.** |

## Target architecture & guardrails (where to steer)

Grounded in current best practice (feature-based organization, container/presentational split, design
tokens + scoped CSS, incremental typing, contract tests) — adapted to what already exists here, *not* a
rewrite. The bar is "follows best practices for a web app of this kind" + "safe, easy future change."

1. **Static types, incrementally (highest leverage).** TS supports `.ts`/`.js` side-by-side. Type the
   **pure core first** where ROI is highest and churn lowest: `io/` → `state/workspaceTypes` +
   `workspaceUtils`/`useWorkspace` → `domain/`+`validation/`. The JSDoc typedefs in `workspaceTypes.js`
   convert almost directly to interfaces. Add a `tsc --noEmit` CI gate. *(Alternative if TS is rejected:
   set `checkJs:true` + enforce JSDoc `@type` via ESLint + fail CI on warnings — weaker, but real.)*
2. **CSS: design tokens + scoping by construction.** Centralize tokens (extend the existing `index.css`
   `:root` with grey scale, `--radius-*`, `--shadow-*`, and a **z-index scale** — which also fixes F3's
   root smell), then adopt **CSS Modules** (CRA-native) for component styles so collisions are
   *impossible*, keeping a lean global layer for layout/typography. Enforce with stylelint. This is the
   structural fix for F6.
3. **Tame the oversized units.** Split `domain/validation.js` into composer / override-validation /
   step-routing; extract a **shared device-override merge module** so `resolveDayConfig` and
   `dayOverrideIssues` can't drift; break `OptogeneticsFields`, `ValidationSummary`, `DevicesStep`,
   `RecordingDaysTab` into sub-components. All behavior-preserving, guarded by the existing contract/golden tests.
   - ✅ **`domain/validation.js` DONE (Phase 9a).** Split into `repairRouting.ts` (step/surface routing),
     `geometryProvenance.ts`, `dayOverrideValidation.ts` (the issue producers), `dayValidationComposer.js`
     (`validateDay`), and `stepStatus.ts` (the export gate); `domain/validation.js` is now a thin barrel
     re-exporting the identical public surface. The shared `deviceOverrideMerge.ts` was already extracted in
     Phase 5. The four pure leaf modules are typed under `strict` (composer/barrel stay `.js` on the untyped
     `validate()` boundary). Baselines byte-identical; contract/guard tests unchanged. **Still pending:** the
     `OptogeneticsFields` / `ValidationSummary` / `DevicesStep` / `RecordingDaysTab` component decomposition (Phase 9c).
4. **Decide the legacy path's fate** (see decisions). Sunsetting deletes ~2,000 LOC and removes the
   "must I update the legacy twin?" tax; keeping it frozen is the conservative safety-net choice.
5. **Spread the container/presentational pattern** from `AnimalEditor/wiring/` to the Day Editor (a
   `DayEditorContext` to kill the 7-prop drill).
6. **Re-arm the build gate** once lint debt is paid: `CI=true` build + `tsc` + stylelint.
7. **Persistence migration framework** (Post-v3 #6) before any persisted-shape change.

**Crucial constraint:** every structural refactor must keep the **golden baselines byte-identical** and
the **contract tests green** — they are exactly what makes this safe. The `resolveDayConfig`/
`mergeDayMetadata`/`validateDay` trio is the minefield; touch only with baselines + a trodes_to_nwb
integration check.

## Prioritized refactor-safety investments (ROI-ranked)

| # | Investment | Effort | Payoff | Notes |
| --- | --- | --- | --- | --- |
| 1 | **Incremental TS on the pure core** (io → state → domain/validation) | ~4–5 d | Eliminates a whole bug class; safe IDE rename; self-documenting | Tooling agent's #1 rec; typedefs already exist |
| 2 | **Design tokens + CSS Modules** (F6) | med–high | Consistency by construction; safe style edits; fixes F3 z-index | Stylelint to enforce |
| 3 | **Pay lint debt + re-arm build gate** ✅ DONE (Phase 9b) | low–med | Build catches drift again | `CI=true` build armed; ESLint build-surface clear; stylelint error-ratchet deferred to a CSS phase |
| 4 | **Split the 5 oversized files/components** | med | Lower change-cost; fewer conflicts | Guarded by contract/golden tests |
| 5 | **Shared device-override merge module** | low–med | Removes the silent-drift coupling | Pairs `resolveDayConfig`/`dayOverrideIssues` |
| 6 | **Persistence forward-migration** (#6) | low–med | Unblocks persisted-shape changes safely | Release-gating |
| 7 | **Sunset legacy path** (if approved) | med | −2,000 LOC maintenance | Tied to the held front-door cutover |
| 8 | **DayEditorContext (kill prop-drill)** | low–med | Easier Day Editor changes | Extend existing container pattern |

## How this intersects with the F1–F6 design changes

- **F1 (remove channel maps)** also lets us delete the legacy `ntrode/ChannelMap.jsx` and the
  `ChannelMapEditor`/container/step (#3 split benefit). Merge-neutral.
- **F4 (Tasks & Epochs)** lands on the *biggest, most prop-drilled* components — do the **#4 split +
  #8 DayEditorContext** here so the UX redesign rides on a cleaner structure (don't redesign on top of an
  825-LOC monolith).
- **F6 (styling)** *is* investment **#2** — the design-token + CSS-Modules decision is the F6 fix.
- **F2/F3** are tiny and ride on top regardless; F3's z-index magic numbers are subsumed by the token scale.
- **F5 (DIO Type+Index)** is a small component change; do it after (or alongside) the element-control decision.

## Sources

- [My approach to React app architecture in 2025 — LaunchDarkly](https://launchdarkly.com/docs/blog/react-architecture-2025) · [React Architecture Patterns & Best Practices — GeeksforGeeks](https://www.geeksforgeeks.org/reactjs/react-architecture-pattern-and-best-practices/)
- [Managing Global Styles in React with Design Tokens — UXPin](https://www.uxpin.com/studio/blog/managing-global-styles-in-react-with-design-tokens/) · [Scalable CSS Architecture — dev.to](https://dev.to/zeeshanali0704/frontend-system-design-scalable-css-architecture-472n) · [CSS Architecture: BEM → Tailwind → Tokens — Superflex](https://www.superflex.ai/blog/css-architecture)
- [Gradual TypeScript Adoption in React — Medium](https://mazenadel19.medium.com/gradual-typescript-adoption-in-react-1bdb2b363722) · [Incremental JS→TS migration — Mixmax](https://www.mixmax.com/engineering/incremental-migration-from-javascript-to-typescript-in-our-largest-service)
