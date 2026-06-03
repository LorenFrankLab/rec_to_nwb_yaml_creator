# Phase 6 — store.js decomposition & CSS consolidation (tech debt)

[← back to PLAN.md](PLAN.md) · [overview](overview.md)

This is a **behavior-preserving refactor**. The full existing test suite (baseline 2747 passed /
1 skipped) and the byte-identical [golden baselines](shared-contracts.md#yaml-parity--shadow-export-contract)
are the correctness proof. No feature, validation, or export behavior changes here. Sequenced after
export works (Phase 5) so there is complete behavior to preserve.

**Inputs to read first:**

- [src/state/store.js](../../../../src/state/store.js) — the whole ~654-line module to split.
  Boundaries to extract: legacy form wiring `:50` + `:70-73` (`useState(formData)`,
  `useArrayManagement`/`useFormUpdates`/`useElectrodeGroups`); the epoch-cleanup `useEffect`
  `:87-145` (note the `eslint-disable-next-line react-hooks/exhaustive-deps` at `:144`, dep array
  `[formData.tasks]` at `:145`, guards legacy only); workspace `useState` `:54-68`; `workspaceActions`
  `useMemo` `:150-513`; `selectors` `useMemo` `:519-579`; combined `actions` `useMemo` `:585-624`;
  model assembly `:629-646` with the `console.warn` fallback at `:633`.
- [src/state/StoreContext.js:84-106](../../../../src/state/StoreContext.js) — `StoreProvider`
  consumes `useStore()` and re-exposes `{ model, actions, selectors }`. The public API surface that
  **must not change**.
- [src/state/__tests__/store.test.js](../../../../src/state/__tests__/store.test.js),
  [src/state/__tests__/StoreContext.test.js](../../../../src/state/__tests__/StoreContext.test.js),
  [src/state/__tests__/store-task-epoch-cleanup.test.js](../../../../src/state/__tests__/store-task-epoch-cleanup.test.js)
  — existing coverage that pins the contract; uses Vitest + `renderHook`/`act`.
- [src/pages/DayEditor/DayEditor.css](../../../../src/pages/DayEditor/DayEditor.css) (~877 lines —
  holds the `:root` design tokens at `:3-33`, `--color-*`/`--spacing-*`) and
  [src/pages/DayEditor/DayEditor.scss](../../../../src/pages/DayEditor/DayEditor.scss) (~391 lines —
  has **no** `:root` block; nested SCSS for `.devices-step`, `.bad-channels-*`). The split-brain.
- Importers (verified): `.css` is imported by
  [src/pages/DayEditor/index.jsx:15](../../../../src/pages/DayEditor/index.jsx) **and** via CSS
  `@import` in [src/pages/Home/Home.css:4](../../../../src/pages/Home/Home.css). `.scss` is imported
  by [src/pages/DayEditor/DevicesStep.jsx:5](../../../../src/pages/DayEditor/DevicesStep.jsx) and
  [src/pages/DayEditor/BadChannelsEditor.jsx:3](../../../../src/pages/DayEditor/BadChannelsEditor.jsx).
  Several AnimalEditor `.scss` files reference DayEditor.css tokens only in comments
  (e.g. `ElectrodeGroupsStep.scss:7`) — they do not import it.
- [src/pages/DayEditor/DevicesStub.jsx](../../../../src/pages/DayEditor/DevicesStub.jsx) — orphaned
  dead code; grep confirms the only match is its own `export default` at `:9`, no importers.
- [package.json:104](../../../../package.json) — `sass: ^1.62.1` is already a dependency (and listed
  in CRA `dependencies` at `:10`), so `.scss` is the supported target.

**Contracts referenced:**

- [Workspace data model & store actions](shared-contracts.md#workspace-data-model--store-actions) —
  the public store API (`model = { ...formData, workspace }`, the eight `workspaceActions`, the
  `setWorkspace(prev => …)` + `structuredClone` immutability discipline) must survive the split
  **unchanged**; consumers must not need edits. This phase **owns the unified epoch-cleanup
  invariant**: cleanup must run for both legacy `formData.tasks` and workspace `days[].tasks`.

## Tasks

- **Decompose `store.js` into focused hooks, recomposed in `useStore`.** Extract into sibling modules
  under `src/state/` so the public shape returned by `useStore` is byte-for-byte the same object
  graph today's consumers see:
  - `useLegacyForm()` — owns `useState(formData)` (`store.js:50`), the three delegated hooks
    (`useArrayManagement`/`useFormUpdates`/`useElectrodeGroups`, `:70-73`), the `itemSelected`
    wrapper (`:606-613`) and the `setFormData` passthrough (`:621`), and the legacy selectors
    `getCameraIds`/`getTaskEpochs`/`getDioEvents` (`:527-560`). Returns `{ formData, setFormData,
    legacyActions, legacySelectors }`.
  - `useWorkspace()` — owns `useState(workspace)` (`:54-68`) and the `workspaceActions` (`:150-513`)
    plus the `getAnimalDays` selector (`:568-576`). Prefer converting the `setWorkspace` state to a
    `useReducer` with explicit action types (`CREATE_ANIMAL`, `UPDATE_ANIMAL`, `DELETE_ANIMAL`,
    `ADD_CONFIGURATION_SNAPSHOT`, `CREATE_DAY`, `UPDATE_DAY`, `DELETE_DAY`, `UPDATE_SETTINGS`) — the
    reducer body is a 1:1 move of each `setWorkspace(prev => …)` callback, preserving the
    `structuredClone` immutability discipline and the duplicate-id `throw`s (`:163`, `:229`, `:274`,
    `:309`, `:353`). Action creators keep the exact signatures listed in the contract. Returns
    `{ workspace, workspaceActions, workspaceSelectors }`. If a reducer would change error-throw
    timing observed by existing tests, keep the `useMemo`+`setWorkspace` form instead and document
    why — correctness over architecture.
  - `useEpochCleanup({ formData, setFormData, workspace, dispatchWorkspace })` — owns the cleanup
    effect (see next task). Returns nothing; runs effects only.
  - `useStore(initialState)` composes the three and assembles the same return value:
    `actions` merges `legacyActions` + `workspaceActions` (same key set, `:585-624`), `selectors`
    merges `legacySelectors` + `workspaceSelectors` (`:519-579`), and `model` is built from
    `formData` + `workspace` (`:629-646`). Keep all `useMemo` dependency arrays equivalent so render
    behavior (the memoization that `StoreContext.js:92-99` relies on) is unchanged.
- **Unify epoch-cleanup across legacy and workspace days** (contract invariant). Today the effect
  (`store.js:89-145`) flatmaps `formData.tasks` and scrubs orphaned `task_epochs` from
  `formData.associated_files`/`associated_video_files`. Extend `useEpochCleanup` so the **same**
  orphan-removal also runs per workspace day: for each `day` in `workspace.days`, compute its valid
  epoch set from `day.tasks[].task_epochs`, and scrub orphaned `task_epochs` from
  `day.associated_files`/`day.associated_video_files`, dispatching through the workspace update path
  (`updateDay`/`UPDATE_DAY`) so immutability + `lastModified` semantics match. Preserve the
  ref-based change-guard pattern (`lastValidEpochsRef`, `:87`/`:99-105`) per slice to avoid update
  loops; key the workspace guard by `dayId`. Keep the `exhaustive-deps` disable narrow and
  documented (`:144`). If, after Phase 4, workspace day tasks/files are stored such that orphans are
  impossible by construction (e.g. cleaned at write time in `updateDay`), then instead of adding the
  effect, **document that decision here** with the file:line where it is enforced — but the default
  is to run the unified cleanup.
- **Resolve the DayEditor CSS split-brain — keep `.scss`, delete `.css`.** Migrate every rule from
  `DayEditor.css` (including the `:root` token block `:3-33`) into `DayEditor.scss`, then:
  - Repoint [src/pages/DayEditor/index.jsx:15](../../../../src/pages/DayEditor/index.jsx) from
    `'./DayEditor.css'` to `'./DayEditor.scss'`.
  - Repoint the CSS `@import` in [src/pages/Home/Home.css:4](../../../../src/pages/Home/Home.css)
    to the SCSS (or, since `@import` of `.scss` from a plain `.css` is unsupported by CRA, instead
    rely on DayEditor's now-`.scss` import for the global `:root` tokens and drop the `@import` line,
    confirming Home still renders with tokens present — Home is always reached via routes that mount
    DayEditor's stylesheet, or relocate the `:root` tokens to an existing global stylesheet imported
    app-wide; pick whichever keeps the rendered tokens identical and note the choice).
  - Delete `DayEditor.css`.
  - **Overlap-resolution approach:** the two files are largely disjoint (`.css` = page/layout +
    `:root` tokens; `.scss` = `.devices-step`/`.bad-channels-*` component rules with no `:root`). For
    any selector present in both, the `.css` rule wins only where it is the sole definition; where
    both define the same property, keep the `.scss` value (it is the one currently applied to those
    components) and record the discarded `.css` declaration in the PR description. Produce a short
    overlap list in the PR. No visual rule may be silently dropped.
- **Delete `src/pages/DayEditor/DevicesStub.jsx`** (orphaned; DayEditor uses the real `DevicesStep`).
  Confirm no importers remain before deletion via grep.
- **Replace the silent `console.warn` undefined-`formData` fallback** at `store.js:633`. `formData`
  is initialized to `defaultYMLValues` (`:50`) and never set to a falsy value, so the fallback can
  only mask a real bug. Replace it with an invariant that fails loudly:
  `if (!formData) throw new Error('useStore: formData is undefined');` (or surface via the app's
  ErrorBoundary). Keep this in whichever module owns model assembly after the split.

## Deliberately not in this phase

- **No feature, validation, or export changes.** `validate()`, `mergeDayMetadata`, `encodeYaml`, the
  shadow-export gate, and step-status wiring are untouched — those are Phases 2/4/5.
- **No AnimalEditor CSS work.** The AnimalEditor `.scss` files that merely *comment* about
  DayEditor.css tokens (`ElectrodeGroupsStep.scss:7`, `BehavioralEventsSection.scss:8`,
  `CamerasSection.scss:8`, `AnimalEditorStepper.scss:8`) are not edited; only their dependency on the
  global `:root` tokens must keep resolving (tokens move into `.scss`, still global).
- **No app-wide `.css → .scss` conversion.** Only the DayEditor stylesheet is consolidated. Other
  `.css` files (including `Home.css` itself) stay `.css`.
- **No change to the persistence/autosave path** (Phase 1) or to `StoreContext.js`'s memoization
  contract — the decomposition must leave `StoreContext.js` unedited.

## Validation slice

| Test | Asserts |
| --- | --- |
| Full existing suite (`vitest run`) | Passes unchanged; baseline 2747 passed / 1 skipped. This is the refactor's primary correctness proof. *(integration — marks the `integration/` and `baselines/` suites)* |
| `golden-yaml.baseline.test.js` (existing, 4 fixtures) | YAML stays byte-identical for all fixtures. *(integration)* |
| `store.test.js` / `StoreContext.test.js` (existing) | `useStore`/`StoreProvider` return the same `{ model, actions, selectors }` shape; all eight `workspaceActions` keep signatures and duplicate-id throws; `model === { ...formData, workspace }`. |
| store public-API contract test (new, extends `store.test.js`) | Snapshot the **key set** of `actions` and `selectors` and the top-level keys of `model`; asserts the decomposition adds/removes no public keys. |
| `store-task-epoch-cleanup.test.js` (existing legacy cases) | Orphaned `formData` `task_epochs` still cleared when a task is removed — unchanged behavior. |
| epoch-cleanup workspace case (new) | A `workspace.days[dayId]` with `tasks` referencing epochs and an `associated_files`/`associated_video_files` entry pointing at an epoch removed from `day.tasks` → the orphaned `task_epochs` is cleared to `''`, valid refs untouched, no other day mutated. (Or, if cleanup is enforced at write-time, this asserts `updateDay` produces no orphan.) |
| importer grep (new or CI check) | No file imports `DayEditor.css` (neither JS `import` nor CSS `@import`); `DayEditor.css` is deleted. |
| dead-code grep (pre-deletion) | `DevicesStub` has no importers before its file is removed. |
| `npm run build` | Production build succeeds with the `.scss`-only DayEditor stylesheet (sass compiles). *(integration)* |

Marked integration/slow: the full-suite run, golden baselines, and the production build.

## Fixtures

- Reuse the existing store/epoch tests as the regression net:
  `src/state/__tests__/store.test.js`, `StoreContext.test.js`,
  `store-task-epoch-cleanup.test.js`.
- Add a small **workspace-day-with-orphan-epoch** helper (alongside the cleanup test, or in the
  existing test's setup): builds a `workspace` with one animal and one day whose
  `tasks: [{ task_epochs: 'epoch1' }]` but whose `associated_files`/`associated_video_files` contain
  a `task_epochs: 'epoch2'` (orphaned). Drives `useStore` via `renderHook` + `act`, matching the
  existing `setFormData`/`updateFormData` pattern in `store-task-epoch-cleanup.test.js`, but through
  the workspace action (`createAnimal`/`createDay`/`updateDay`).
- No new golden fixtures — golden baselines must remain unregenerated (a parity change here is a
  blocker, per CLAUDE.md's Regression Prevention Protocol).

## Review

Follow the full gate in [review-protocol.md](review-protocol.md). Phase-specific:

- **Self-verify (§1):** run this phase's Validation slice + `npx vitest run` (no regressions; baseline 2747/1 skipped, modulo the new public-API and workspace-cleanup tests) + `npx vitest run baselines` (byte-identical) + green production build. This is a **behavior-preserving** refactor: the full suite and byte-identical baselines are the proof. Confirm the public store API/model shape is unchanged (`StoreContext.js` untouched, no consumer modified) and the monolithic `store.js` bodies are moved, not duplicated.
- **Playwright UI (§2):** smoke check — the app still renders and the create→export path still works; do a visual check after the `.css → .scss` merge to confirm no layout regression. 0 console errors.
- **Reviewers:** `pr-review-toolkit:code-reviewer` (always), plus `pr-test-analyzer`; include a visual-regression check.
- **Checklist (§6):** every task implemented; "Deliberately not in this phase" honored; tests non-trivial (public-API test snapshots real key sets; workspace-cleanup test exercises a real orphaned epoch ref); no plan/milestone strings in code/test/module names or docstrings (reword touched `M3`/`M5`/`M6` comments to describe behavior); old code flagged for removal is removed (`DayEditor.css` and `DevicesStub.jsx` gone, no orphan imports); user-facing docs updated and the PR lists CSS overlap-resolution decisions.
