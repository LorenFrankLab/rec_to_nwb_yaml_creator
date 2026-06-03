# Phase 1 — Persistence & save-state integrity

[← back to PLAN.md](PLAN.md) · [overview](overview.md)

This is the first feature-bearing phase. Goal: real `localStorage` autosave for the workspace, a
truthful `SaveIndicator`, a `beforeunload` guard, and a non-corrupting `mergeDayMetadata` — so the new
UI stops silently losing data on reload and stops claiming "Saved" for state that lives only in memory.

**Inputs to read first:**

- [src/featureFlags.js:133](../../../../src/featureFlags.js) — `localStoragePersistence: false`. The
  single switch this phase flips to `true`. Note the module exports `FLAGS` (named + default) and
  `isFeatureEnabled(name)` / `overrideFlags` / `restoreFlags` (`:328`, `:381`, `:396`) — code reads the
  flag via `FLAGS.localStoragePersistence`; tests toggle it via `overrideFlags`/`restoreFlags`.
- [src/state/store.js:49](../../../../src/state/store.js) — `useStore(initialState)`. `formData` state at
  `:50`; `workspace` state initialized at `:54-68`; legacy epoch-cleanup effect `:89-145` (guards
  `formData.tasks` only); `workspaceActions` `useMemo` at `:150`; `selectors` `useMemo` at `:519`; model
  assembled `{ ...formData, workspace }` at `:629-646` with the `console.warn` undefined-`formData`
  fallback at `:632-638`; hook return `{ model, selectors, actions }` at `:648-652`.
- [src/state/StoreContext.js:42](../../../../src/state/StoreContext.js) — `StoreProvider` calls
  `useStore` once and memoizes the context value; `useStoreContext` is the consumer hook. Anything this
  phase adds to the store return is reachable here.
- [src/state/workspaceUtils.js:34-103](../../../../src/state/workspaceUtils.js) — `mergeDayMetadata(animal, day)`.
  **Actual signature takes two args** (config is resolved internally from `animal.configurationHistory`
  at `:37-39`), despite the contract writing `mergeDayMetadata(animal, day, config)`. The merged object
  assigns nested animal/config references directly: `data_acq_device`/`device` `:62-63`,
  `cameras` `:66`, `electrode_groups`/`ntrode_electrode_group_channel_map` `:69-72`, `tasks`/
  `behavioral_events`/`associated_files`/`associated_video_files` `:75-80`, optogenetics `:91-94`,
  `fs_gui_yamls` `:99`. Sole non-test caller today: `DayEditorStepper.jsx:45`.
- [src/state/workspaceTypes.js:30](../../../../src/state/workspaceTypes.js) — JSDoc claims "Persisted to
  localStorage with auto-save functionality." Currently false; this phase makes it true and the doc
  accurate.
- [src/pages/DayEditor/SaveIndicator.jsx:21-74](../../../../src/pages/DayEditor/SaveIndicator.jsx) —
  renders "Saved ✓" purely from a `lastSaved` timestamp prop; no knowledge of whether a write occurred.
- [src/pages/DayEditor/DayEditorStepper.jsx:35-101](../../../../src/pages/DayEditor/DayEditorStepper.jsx) —
  `lastSaved`/`saveError` local state (`:35-36`); `handleFieldUpdate` (`:63-101`) wraps a **synchronous**
  `actions.updateDay` in a `try/catch` and sets `lastSaved = now` on `:94` regardless of any real write —
  the false-success pattern. `<SaveIndicator>` rendered at `:140`.
- [src/pages/AnimalEditor/HardwareConfigStep.jsx:46-68](../../../../src/pages/AnimalEditor/HardwareConfigStep.jsx) —
  identical false-success pattern: local `lastSaved` (`:46`), `handleFieldUpdate` sets `lastSaved = now`
  on `:63` after a synchronous parent call. `<SaveIndicator>` rendered at `:92`.

**Verified:** there is currently **zero** `localStorage` access anywhere in `src/state/` (only the stale
doc comment at `workspaceTypes.js:30`). This phase introduces the first real usage.

**Contracts referenced:**

- [Persistence contract](shared-contracts.md#persistence-contract) — establishes the storage key, blob
  shape, versioning, autosave debounce, load/discard policy, and the SaveIndicator-truth rule. This phase
  *creates* this contract's behavior; do not weaken it.
- [`mergeDayMetadata` contract](shared-contracts.md#mergedaymetadata-contract) — the returned object must
  be safe to treat as owned data; this phase makes it return a `structuredClone`d result so downstream
  mutation cannot corrupt animal/config state.
- [Workspace data model & store actions](shared-contracts.md#workspace-data-model--store-actions) —
  persistence serializes the `workspace` slice (`animals`/`days`/`settings`) only, never legacy
  `formData`; immutability discipline (`setWorkspace(prev => …)` + `structuredClone`) is preserved.
- [YAML parity / shadow-export contract](shared-contracts.md#yaml-parity--shadow-export-contract) — golden
  baselines stay byte-identical; the `mergeDayMetadata` clone change must not alter any merged value.

## Tasks

### 1. New module `src/state/persistence.js`

Pure functions over `window.localStorage`. No React. Self-contained so it is trivially unit-testable
under jsdom and mockable. Provide exactly this code:

```js
/**
 * @fileoverview Workspace persistence to localStorage.
 *
 * Serializes ONLY the workspace slice (animals + days + settings). Legacy formData
 * is never persisted, and nothing that is itself YAML output is ever persisted.
 *
 * Stored shape: { schemaVersion: <int>, workspace }. On a missing blob, parse error,
 * or schemaVersion mismatch, loadWorkspace returns null so the caller starts fresh.
 */

/** localStorage key for the persisted workspace blob. */
export const WORKSPACE_STORAGE_KEY = 'rec_to_nwb_workspace_v1';

/**
 * Current persisted-blob schema version. Bump when the stored shape changes in a
 * way that older blobs cannot be safely hydrated into; a mismatch is discarded.
 * @type {number}
 */
export const WORKSPACE_SCHEMA_VERSION = 1;

/**
 * Reason codes returned alongside a discarded load, for a user-visible notice.
 * @readonly
 * @enum {string}
 */
export const LOAD_DISCARD_REASON = {
  PARSE_ERROR: 'parse-error',
  VERSION_MISMATCH: 'version-mismatch',
};

/**
 * Loads the persisted workspace.
 *
 * @returns {{ workspace: object } | { workspace: null, discarded: string } | null}
 *   - `{ workspace }` on a successful, version-matching load.
 *   - `{ workspace: null, discarded: <reason> }` when a blob exists but is unusable
 *     (corrupt JSON or wrong schemaVersion) — caller discards and shows a notice.
 *   - `null` when no blob exists (clean first run; no notice).
 */
export function loadWorkspace() {
  let raw;
  try {
    raw = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
  } catch {
    // Storage unavailable (e.g. private mode / disabled). Treat as clean first run.
    return null;
  }

  if (raw == null) return null;

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { workspace: null, discarded: LOAD_DISCARD_REASON.PARSE_ERROR };
  }

  if (
    !parsed ||
    typeof parsed !== 'object' ||
    parsed.schemaVersion !== WORKSPACE_SCHEMA_VERSION ||
    !parsed.workspace ||
    typeof parsed.workspace !== 'object'
  ) {
    return { workspace: null, discarded: LOAD_DISCARD_REASON.VERSION_MISMATCH };
  }

  return { workspace: parsed.workspace };
}

/**
 * Persists the workspace slice. Throws on failure (e.g. quota exceeded) so the
 * caller can surface an error and avoid claiming a successful save.
 *
 * @param {object} workspace - The workspace slice (animals + days + settings).
 * @returns {void}
 */
export function saveWorkspace(workspace) {
  const blob = JSON.stringify({
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    workspace,
  });
  window.localStorage.setItem(WORKSPACE_STORAGE_KEY, blob);
}

/**
 * Removes the persisted blob. Used when discarding an unusable load.
 * @returns {void}
 */
export function clearWorkspace() {
  try {
    window.localStorage.removeItem(WORKSPACE_STORAGE_KEY);
  } catch {
    // No-op: nothing else to do if storage is unavailable.
  }
}
```

Notes:
- `loadWorkspace` never throws; `saveWorkspace` intentionally **does** throw so the autosave wiring can
  catch it and avoid setting `lastSaved` on a failed write.
- We do not deep-validate the workspace shape here (Phase 6 owns the store split). Version gating plus a
  presence check is the contract's required floor; richer migration is out of scope.

### 2. Wire persistence into `useStore` (`src/state/store.js`)

All changes are inside `useStore` so `StoreProvider` picks them up with no call-site changes.

- **Imports:** add at the top of the file:
  ```js
  import { FLAGS } from '../featureFlags';
  import { loadWorkspace, saveWorkspace } from './persistence';
  ```

- **Hydrate on init.** Replace the `useState` initializer for `workspace` (`:54-68`) with a lazy
  initializer that hydrates from storage when the flag is on, the load succeeds, and no `initialState`
  workspace was supplied (tests still win). Capture any discard reason in a ref for the post-mount
  notice (we cannot call `setState` during render):

  ```js
  const initialDiscardRef = useRef(null);

  const [workspace, setWorkspace] = useState(() => {
    const fallback = {
      version: '1.0.0',
      lastModified: getCurrentTimestamp(),
      animals: {},
      days: {},
      settings: {
        defaultLab: '',
        defaultInstitution: '',
        defaultExperimenters: [],
        autoSaveInterval: 30000,
        shadowExportEnabled: true,
      },
    };

    if (initialState?.workspace) return initialState.workspace;
    if (!FLAGS.localStoragePersistence) return fallback;

    const loaded = loadWorkspace();
    if (loaded == null) return fallback;          // clean first run
    if (loaded.workspace) return loaded.workspace; // hydrated
    initialDiscardRef.current = loaded.discarded;   // unusable blob → notice after mount
    return fallback;
  });
  ```

  Keep using the existing `getCurrentTimestamp` import (`:9`). Reuse `useRef`, already imported (`:1`).

- **Persistence status state**, declared right after the workspace state, drives the truthful indicator
  and the `beforeunload` guard:
  ```js
  const [lastSaved, setLastSaved] = useState(null);   // ISO string of last confirmed write, or null
  const [saveError, setSaveError] = useState(null);   // user-facing save-failure message, or null
  const [hasPendingWrite, setHasPendingWrite] = useState(false); // debounce in flight
  const [loadNotice, setLoadNotice] = useState(null); // discard notice for the UI, or null
  ```

- **Surface the discard notice after mount** (so a brand-new session can warn the user its old data was
  dropped). Add a one-shot effect; clear storage so the bad blob isn't re-read:
  ```js
  useEffect(() => {
    if (initialDiscardRef.current) {
      setLoadNotice(
        'Saved workspace data could not be restored (it was from an incompatible ' +
          'or corrupted version) and was discarded. Starting with an empty workspace.'
      );
      initialDiscardRef.current = null;
      // clearWorkspace() imported alongside load/save; remove the unusable blob.
      clearWorkspace();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  ```
  Add `clearWorkspace` to the import from `./persistence`.

- **Debounced autosave on `workspace` change only.** This effect depends on `workspace` and nothing in
  `formData`, satisfying "no write on legacy-only edits." Mirror the existing epoch-cleanup effect's ref
  discipline. Skip the very first run (the hydration/initial render) so we don't immediately rewrite what
  we just loaded:
  ```js
  const didMountAutosaveRef = useRef(false);

  useEffect(() => {
    if (!FLAGS.localStoragePersistence) return undefined;

    // Don't write on the initial render (hydration / default state).
    if (!didMountAutosaveRef.current) {
      didMountAutosaveRef.current = true;
      return undefined;
    }

    setHasPendingWrite(true);
    const timer = setTimeout(() => {
      try {
        saveWorkspace(workspace);
        setLastSaved(new Date().toISOString());
        setSaveError(null);
      } catch (err) {
        setSaveError(`Could not save workspace: ${err.message}`);
      } finally {
        setHasPendingWrite(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [workspace]);
  ```
  Note: the cleanup cancels the pending timer when `workspace` changes again before 500 ms elapses
  (debounce) and on unmount. `hasPendingWrite` is left `true` across a coalesced edit, which is correct —
  there is still unsaved work.

- **Expose persistence state on the store return.** Extend the return at `:648-652` so consumers
  (`SaveIndicator`, `beforeunload`, the load-notice UI) read real status without prop-drilling timestamps:
  ```js
  return {
    model,
    selectors,
    actions,
    persistence: {
      enabled: FLAGS.localStoragePersistence,
      lastSaved,
      saveError,
      hasPendingWrite,
      loadNotice,
      dismissLoadNotice: () => setLoadNotice(null),
    },
  };
  ```
  Add `dismissLoadNotice` to the `actions` `useMemo` deps only if you route it through `actions` instead;
  the inline closure above is stable enough for a notice banner but if it must be referentially stable,
  wrap it in `useCallback`. Do **not** add `persistence` into the `model` object — it is not form data and
  must never reach `mergeDayMetadata` or YAML.

- **Do not touch** the epoch-cleanup effect (`:89-145`) or the `{ ...formData, workspace }` model
  assembly (`:629-646`) — including the `console.warn` fallback. Persistence is additive.

### 3. Flip the persistence flag

In [src/featureFlags.js:133](../../../../src/featureFlags.js) change `localStoragePersistence: false` to
`localStoragePersistence: true`. This is the single persistence switch (the contract keeps it on through
Phase 10). Leave `animalWorkspace`, `newDayEditor`, and `showLegacyToggle` `false` — those are Phase 10.
Update the existing flag-status assertion in
[src/__tests__/unit/featureFlags.test.js](../../../../src/__tests__/unit/featureFlags.test.js) if it
asserts the default of this specific flag.

### 4. Make `SaveIndicator` truthful and remove the false-success pattern

- **`SaveIndicator.jsx`** — add an `enabled` prop. When persistence is off, the indicator must not claim
  "Saved": render `"Not saved (in memory)"` (or nothing) instead. Status remains derived from a real
  `lastSaved` (which now is only ever set after a confirmed `saveWorkspace`). Suggested prop surface:
  `{ enabled: boolean, lastSaved: string|null, error: string|null, pending: boolean }`. When
  `enabled === false`, short-circuit before the `lastSaved`-driven branches and render a muted
  "Not saved (in memory)" status (role `status`, `aria-live="polite"`). When `pending` is true, show
  "Saving…". Keep `formatTimeAgo` and the error branch.

- **`DayEditorStepper.jsx`** — delete the local `lastSaved`/`saveError` state (`:35-36`) and the
  false-success bookkeeping inside `handleFieldUpdate` (`:93-99` set `lastSaved`/`saveError`). Keep the
  immutable field-update + `actions.updateDay(dayId, updates)` call; that write now flows through the
  store's debounced autosave. Read status from the store instead:
  ```js
  const { model, actions, persistence } = useStoreContext();
  ...
  <SaveIndicator
    enabled={persistence.enabled}
    lastSaved={persistence.lastSaved}
    error={persistence.saveError}
    pending={persistence.hasPendingWrite}
  />
  ```
  Remove the now-dead `try/catch` (the update is synchronous; persistence failure is reported via the
  store, not here). Keep `console.error` only if a genuine programming error can throw during path
  navigation — otherwise drop the wrapper entirely.

- **`HardwareConfigStep.jsx`** — same change: delete local `lastSaved`/`saveError` state (`:46-47`) and
  the `lastSaved = now` assignment (`:63`); pull `persistence` from `useStoreContext` (this component
  currently receives `onFieldUpdate` as a prop — read `persistence` from context, leaving `onFieldUpdate`
  wiring intact) and pass the four props to `<SaveIndicator>` at `:92`.

### 5. `beforeunload` guard for unsaved work

Add a small effect — colocated with the store consumer that owns the top-level layout, or as a tiny hook
`src/hooks/useUnsavedWorkGuard.js` consumed by `AppLayout` — that warns on navigation away when there is
unsaved/in-flight work. "Unsaved work" = persistence enabled **and** a debounce is pending
(`persistence.hasPendingWrite`). Prefer the dedicated hook for testability:

```js
import { useEffect } from 'react';

/**
 * Warns the user before unloading the page while a workspace write is pending.
 * @param {boolean} hasUnsavedWork - true when a debounced save is in flight.
 */
export function useUnsavedWorkGuard(hasUnsavedWork) {
  useEffect(() => {
    if (!hasUnsavedWork) return undefined;
    const handler = (event) => {
      event.preventDefault();
      event.returnValue = ''; // required for the native prompt in Chrome
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedWork]);
}
```

Wire it in [src/layouts/AppLayout.jsx](../../../../src/layouts/AppLayout.jsx):
`useUnsavedWorkGuard(persistence.hasPendingWrite)`, reading `persistence` from `useStoreContext`.

**`AppLayout.jsx` is NOT currently a store consumer** — it does not import `useStore`/`useStoreContext`
today. Making it one is concrete work that belongs to this phase, not a hedge: import the store context
hook (`useStoreContext` from [src/state/StoreContext.js](../../../../src/state/StoreContext.js)) in
`AppLayout`, read `persistence` from it (the `persistence` handle this phase adds to the store return),
and thread the `hasPendingWrite` pending-write state into `useUnsavedWorkGuard`. `StoreProvider`
already wraps the tree, so this adds a consumer to the existing provider — do **not** create a second
store instance. This is the first store consumption in `AppLayout`; budget for it accordingly (and for
any test setup that must now mount `AppLayout` inside `StoreProvider`).

### 6. Make `mergeDayMetadata` return owned data (`src/state/workspaceUtils.js`)

Per the [`mergeDayMetadata` contract](shared-contracts.md#mergedaymetadata-contract), the returned object
must be safe to mutate. Change the function to clone its result so the nested references assigned at
`:62-80`, `:91-94`, `:99` no longer alias `animal`/`config` state. Minimal, parity-preserving change —
clone at the single return point (`:102`):

```js
  // === Conditional: FsGUI YAMLs (only if day has them) ===
  if (day.fs_gui_yamls && day.fs_gui_yamls.length > 0) {
    merged.fs_gui_yamls = day.fs_gui_yamls;
  }

  // Return owned data: downstream mutation (or YAML encoders that sort/normalize in
  // place) must not corrupt animal/config state. See mergeDayMetadata contract.
  return structuredClone(merged);
```

The cloned object is structurally identical to today's output (same keys, same values, same order), so
`encodeYaml(mergeDayMetadata(...))` is byte-identical and golden baselines are unaffected. Do **not**
change merge precedence, key order, or the two-arg signature. (`structuredClone` is already used
throughout the store, e.g. `store.js:122`, so no new dependency.)

### 7. Documentation

- **`src/state/workspaceTypes.js:30`** — the JSDoc now matches reality (the workspace *is* persisted).
  Tighten it to name the mechanism precisely, e.g.:
  `Persisted to localStorage (key "rec_to_nwb_workspace_v1", debounced autosave) when the persistence feature flag is enabled.`
  Do not reference plans/milestones.
- **`docs/REFACTOR_CHANGELOG.md`** — add a dated entry summarizing: real localStorage autosave for the
  workspace, truthful SaveIndicator, `beforeunload` guard, version-gated discard-with-notice on load, and
  the `mergeDayMetadata` clone hardening. (CLAUDE.md says "CHANGELOG.md"; the repo's changelog file is
  `docs/REFACTOR_CHANGELOG.md` — use the existing file, do not create a second one.)

## Deliberately not in this phase

- **YAML export from the new UI** — `mergeDayMetadata`'s consumer for export, the shadow-export parity
  gate, and `ExportStub` replacement are Phase 5. This phase only hardens `mergeDayMetadata`'s return;
  it does not wire it to `encodeYaml`/download.
- **Wiring `computeStepStatus` `devices`/`epochs`/`validation`** off their hardcoded `'incomplete'`
  (`DayEditor/validation.js:60-62`) — Phases 2/4/5. The `stepStatus` block in `DayEditorStepper.jsx:49-60`
  is untouched here.
- **`store.js` decomposition** and deleting `DevicesStub` — Phase 6. Persistence is added inside the
  existing monolithic `useStore`.
- **Cross-day batch tools / bulk operations** — Phase 7.
- **Flipping `animalWorkspace`/`newDayEditor`/`showLegacyToggle` or changing the default route** —
  Phase 10. Only `localStoragePersistence` flips here.
- **Schema migration of old persisted blobs** — out of scope. A version mismatch is discarded with a
  notice, not migrated.
- **Any cloud/server sync** — explicitly a non-goal of the whole plan (localStorage only).

## Validation slice

| Test | Asserts |
| --- | --- |
| `persistence.test.js` — save then load round-trips | `saveWorkspace(ws)` then `loadWorkspace()` returns `{ workspace: ws }` with deep-equal animals/days/settings. *(jsdom localStorage)* |
| `persistence.test.js` — clean first run | With no blob present, `loadWorkspace()` returns `null` (no notice). *(jsdom localStorage)* |
| `persistence.test.js` — corrupt blob discarded | Writing non-JSON under the key yields `{ workspace: null, discarded: 'parse-error' }`. *(jsdom localStorage)* |
| `persistence.test.js` — version mismatch discarded | A blob with `schemaVersion: 999` yields `{ workspace: null, discarded: 'version-mismatch' }`; a valid blob does not. *(jsdom localStorage)* |
| `persistence.test.js` — only workspace persisted | The serialized blob contains `schemaVersion` + `workspace` and **no** legacy `formData` keys (e.g. `session_id`, `subject`). *(jsdom localStorage)* |
| `store.test.js` — hydrate on init | With the flag on and a valid blob present, `useStore()` initializes `model.workspace.animals`/`days` from the blob. *(jsdom localStorage)* |
| `store.test.js` — no legacy write | Mutating only `formData` (e.g. `updateFormData('session_id', …)`) and waiting past the debounce performs **no** `localStorage.setItem`; mutating `workspace` (e.g. `createAnimal`) does write after ~500 ms. *(jsdom localStorage; fake timers)* |
| `store.test.js` — debounced single write | Three rapid `workspace` mutations within 500 ms result in exactly one `setItem` call. *(fake timers)* |
| `store.test.js` — discard surfaces notice | Flag on + corrupt blob ⇒ `persistence.loadNotice` is non-null after mount, the bad blob is cleared, and no crash. *(jsdom localStorage)* |
| `store.test.js` — lastSaved only on confirmed write | `persistence.lastSaved` is `null` until a `saveWorkspace` succeeds; on a thrown `saveWorkspace` (mock quota error) `lastSaved` stays `null` and `saveError` is set. *(fake timers; mocked storage)* |
| `SaveIndicator.test.jsx` — never "Saved" while off | With `enabled={false}`, the component never renders "Saved" (renders "Not saved (in memory)" or nothing) even when `lastSaved` is a timestamp. |
| `SaveIndicator.test.jsx` — "Saved" only after write | With `enabled` + a `lastSaved`, shows "Saved …"; with `enabled` + `pending` shows "Saving…"; with `error` shows the error. |
| `DayEditorStepper.test.jsx` / `HardwareConfigStep.test.jsx` — no optimistic save | A field blur/update no longer sets a local `lastSaved`; the rendered indicator reflects store `persistence` state, not an immediate "Saved". |
| `useUnsavedWorkGuard.test.js` — beforeunload | Registers a `beforeunload` listener only when `hasUnsavedWork` is true; the handler sets `event.returnValue`; unregisters on cleanup/when false. |
| `workspaceUtils.test.js` — merge returns owned data | Mutating a nested array/object on the result of `mergeDayMetadata(animal, day)` leaves the source `animal` and its `configurationHistory[].devices` unchanged. |
| `workspaceUtils.test.js` — merge output unchanged | Output of `mergeDayMetadata` is deep-equal to the pre-clone expectation for a representative animal+day (parity guard at the merge level). |
| `golden-yaml.baseline.test.js` (existing, run unchanged) | All 4 golden fixtures still re-export byte-identical — the clone change introduces no formatting/value drift. |

Every jsdom-`localStorage` and fake-timers test is marked inline above. Use Vitest fake timers
(`vi.useFakeTimers()` / `vi.advanceTimersByTime(500)`) for debounce assertions and restore real timers in
`afterEach`. Reset `localStorage` and call `restoreFlags()` in `afterEach` to keep tests isolated.

## Fixtures

- A `makeTestWorkspace()` helper (in `src/__tests__/helpers/`, e.g. alongside `test-fixtures.js`)
  synthesizing a minimal valid workspace: one animal (with `subject`, `devices`, `cameras`,
  `experimenters`, a single-entry `configurationHistory`, and a `days` array) plus one `Day` keyed under
  `days`, matching the [workspace data model](shared-contracts.md#workspace-data-model--store-actions). Used by
  persistence, store, and `mergeDayMetadata` ownership tests. Keep shared setup in this helper, not
  copy-pasted per test.
- The four existing golden fixtures
  ([src/__tests__/fixtures/golden/](../../../../src/__tests__/fixtures/golden/)) are reused as-is for the
  byte-identical parity guard; do not regenerate them.
- Toggle the flag in tests via `overrideFlags({ localStoragePersistence: true|false })` +
  `restoreFlags()` rather than editing the module, so the suite stays order-independent.

## Review

Follow the full gate in [review-protocol.md](review-protocol.md). Phase-specific:

- **Self-verify (§1):** run this phase's Validation slice + `npx vitest run` (no regressions; baseline 2747/1 skipped) + `npx vitest run baselines` (byte-identical). Emphasis: the `mergeDayMetadata` clone must not change any value or key order — a parity diff is a blocker, never a fixture-regeneration trigger. Persistence must never serialize legacy `formData` or YAML output.
- **Playwright UI (§2):** drive create-animal → edit a field → confirm `SaveIndicator` only says "Saved" after a real write → reload the page → workspace is restored. With the persistence flag off, the indicator must never lie. 0 console errors. Note: extend the committed `e2e/` save-and-reload spec so this guarantee can't regress.
- **Reviewers:** `pr-review-toolkit:code-reviewer` (always), plus `silent-failure-hunter` (false-success try/catch removal), `pr-test-analyzer` (new persistence behavior), and `type-design-analyzer` (persisted blob shape); light UX on `SaveIndicator` copy/a11y.
- **Checklist (§6):** every task implemented; "Deliberately not in this phase" honored; tests non-trivial (assert real `localStorage`/write calls, not configured mocks); no plan/phase strings in code/test names/docstrings; old code flagged for removal is removed (no orphaned `lastSaved`/`saveError` local state in either stepper); user-facing docs updated.
