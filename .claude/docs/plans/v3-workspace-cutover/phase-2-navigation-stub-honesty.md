# Phase 2 — Navigation, discoverability & stub honesty (SAFETY / a11y)

[← back to PLAN.md](PLAN.md) · [overview](overview.md)

The new workspace UI is currently reachable only by hand-typing hash routes, has dead-end error
screens, drops users into empty "coming soon" steps, duplicates the `main` landmark, and reports a
fabricated Devices status. This phase makes the new UI **discoverable and free of dead-ends**, makes
stub steps honest, fixes landmark/focus accessibility bugs, and wires the Devices step to its real
status. **The default route stays legacy** — the cutover (flag flip + default route) is
[Phase 10](overview.md#rollout-strategy).

**Inputs to read first:**

- [src/layouts/AppLayout.jsx](../../../../src/layouts/AppLayout.jsx) — `switch (currentRoute.view)`
  at `:116-139`; the banner `<a href="#/">` logo (`:170-174`) is the only persistent chrome today and
  has **no** `role="navigation"`; comment at `:176` says "views provide their own `<main>`".
- [src/hooks/useHashRouter.js:46-49](../../../../src/hooks/useHashRouter.js) — empty/`#/` → `view:'legacy'`;
  `:69` matches `/animal/:id/editor` and returns `params:{ animalId }` (note: **`animalId`, not `id`**);
  `:99-101` unknown route → `view:'legacy', isUnknownRoute:true` with a console warning.
- [src/featureFlags.js](../../../../src/featureFlags.js) — `showLegacyToggle:false` (`:105`),
  `animalWorkspace:false` (`:121`), `newDayEditor:false` (`:149`); `isFeatureEnabled(name)` (`:328`),
  `overrideFlags`/`restoreFlags` (`:381`,`:396`) for tests. **All new-UI flags stay false this phase.**
- [src/pages/DayEditor/OverviewStep.jsx](../../../../src/pages/DayEditor/OverviewStep.jsx) — broken
  `#/animal/${animal.id}` links missing `/editor` at `:62` (breadcrumb), `:158` and `:190` ("Edit
  Animal" links). These resolve to the unknown-route → legacy fallback today.
- [src/pages/DayEditor/validation.js:52-65](../../../../src/pages/DayEditor/validation.js) —
  `computeStepStatus(day, mergedDay)`; `devices` hardcoded `'incomplete'` at `:60`.
- [src/pages/DayEditor/DevicesStep.jsx](../../../../src/pages/DayEditor/DevicesStep.jsx) — real
  component; `getGroupStatus(groupId)` (`:54-75`) returns `'clean'|'warning'|'error'` and the
  per-group `'No channel mapping'` error branch (`:203`). This is the source of truth the step status
  must mirror.
- [src/pages/DayEditor/DayEditorStepper.jsx](../../../../src/pages/DayEditor/DayEditorStepper.jsx) —
  steps array at `:104-110` (Epochs→`EpochsStub`, Validation→`ValidationStub`, Export→`ExportStub`);
  `main#main-content` at `:150`; the back-link already points to `#/workspace?animal=...` (`:132`).
- [src/pages/DayEditor/StepNavigation.jsx](../../../../src/pages/DayEditor/StepNavigation.jsx) —
  `handleNavigate` disabled-guard at `:27-31`; `disabled={isDisabled}` at `:59` (currently only
  `export`); `isExportEnabled` at `:118-121`.
- [src/pages/DayEditor/ErrorState.jsx](../../../../src/pages/DayEditor/ErrorState.jsx) — already has a
  "Return to Workspace" link (`:16`) but renders no landmark and no Home escape.
- [src/pages/DayEditor/{EpochsStub,ValidationStub,ExportStub}.jsx](../../../../src/pages/DayEditor/) —
  placeholder bodies referencing future milestones in copy.
- [src/pages/AnimalEditor/index.jsx:22-26](../../../../src/pages/AnimalEditor/index.jsx) — `<main
  id="main-content" role="main">` wrapper, **and**
  [src/pages/AnimalEditor/AnimalEditorStepper.jsx:531](../../../../src/pages/AnimalEditor/AnimalEditorStepper.jsx)
  — a **second** `<main id="main-content">`. Two `main`s / two `#main-content` on this route.
- [src/pages/AnimalEditor/AnimalEditorStepper.jsx:67-73](../../../../src/pages/AnimalEditor/AnimalEditorStepper.jsx)
  — "no animal specified"/"Animal … not found" error returns are bare `<div className="error-state">`
  with **no navigation escape** (true dead-ends); header at `:504-506` has only an `<h1>`.
- [src/pages/AnimalEditor/ElectrodeGroupModal.jsx:135-177](../../../../src/pages/AnimalEditor/ElectrodeGroupModal.jsx)
  — ESC (`:136-147`), focus-first (`:149-154`), scroll-lock, overlay-click; **no focus trap, no
  focus-return**; `firstFieldRef` exists (`:37`) but there is **no `modalRef`** and the modal root
  `<div>` (`:184`) is unref'd.
- [src/pages/AnimalEditor/CameraModal.jsx:152-182](../../../../src/pages/AnimalEditor/CameraModal.jsx)
  — the **working** focus-trap (Tab/Shift-Tab cycle within `modalRef`) to port verbatim.
- [src/__tests__/integration/aria-landmarks.test.jsx](../../../../src/__tests__/integration/aria-landmarks.test.jsx)
  — renders only `<App />` (legacy default); asserts exactly one `nav`/`main`, `a.nav-link`, a `form`.
- [src/state/StoreContext.js:84-86](../../../../src/state/StoreContext.js) +
  [src/state/store.js:54-68](../../../../src/state/store.js) — `<StoreProvider initialState={{ workspace }}>`
  seeds the workspace slice (used by the Phase 2 fixture helper).
- [src/pages/LegacyFormView.jsx:328-371](../../../../src/pages/LegacyFormView.jsx) — legacy view owns
  `role="navigation"` (`:328`, label "Form section navigation") and `role="main"` (`:371`); the new
  top-nav must use a **distinct** `aria-label` so per-route landmark uniqueness still holds.

**Contracts referenced:**

- [Feature flags & routing contract](shared-contracts.md#feature-flags--routing-contract) — establish
  the flag↔route relationship so Phase 10 is a single switch; default route stays `legacy`, new routes
  stay reachable for dev this phase. Resolves [overview Open Question 1](overview.md#open-questions).
- [Validation & step-status contract](shared-contracts.md#validation--step-status-contract) — wire
  `computeStepStatus(...).devices` to real status; **do not loosen** `isExportEnabled` (every step must
  be `'valid'`); severity policy keeps data-entry steps non-blocking.

## Tasks

- **Persistent top-nav in `AppLayout`.** Add a `<nav role="navigation" aria-label="Primary">` (label
  distinct from legacy's "Form section navigation") into the banner region (`AppLayout.jsx:170-174`),
  containing Home (`#/home`) and Workspace (`#/workspace`) links, plus a "Use Legacy Editor" toggle
  link (`#/`) rendered **only when `isFeatureEnabled('showLegacyToggle')`** (false this phase, so it
  stays hidden until Phase 10). Keep the logo link. Because the legacy view already renders its own
  `role="navigation"`, mark the new nav so per-route uniqueness is preserved: render the primary nav on
  **non-legacy** routes only (or scope landmark-uniqueness tests per route — see Validation slice). Add
  an `aria-current="page"` on the link matching `currentRoute.view`.
- **Flag-aware routing.** Make `AppLayout.renderView()` (`:115-140`) gate the new views: render `Home`/
  `AnimalWorkspace`/`DayEditor`/`AnimalEditor`/`ValidationSummary` when the governing flag is on
  (`animalWorkspace` for home/workspace/animal-editor/validation; `newDayEditor` for day), **otherwise
  redirect to legacy** (set `window.location.hash = '#/'` via an effect and render `LegacyFormView`).
  Keep all new routes **reachable for dev** this phase by also honoring an explicit opt-in: when the
  hash is a known new route, allow it through even with flags off, but **do not** change the default
  (`#/` → legacy) — that flip is Phase 10. Net effect: Phase 10 flips `animalWorkspace`/`newDayEditor`
  and the default route, and nothing else in routing changes. Document the resolved relationship inline
  (JSDoc) referencing the routing contract.
- **Pass the animal id into `AnimalEditor`.** `useHashRouter` returns `params.animalId` (not `params.id`);
  confirm `AnimalEditorStepper` reads it via `useAnimalIdFromUrl` (it does) so the flag-gated render in
  `renderView()` needs no prop wiring — note this so the executor doesn't add a mismatched `id` prop.
- **Fix broken Overview links.** In `OverviewStep.jsx`, change the three `#/animal/${animal.id}` hrefs
  at `:62`, `:158`, `:190` to `#/animal/${animal.id}/editor` so they resolve to the Animal Editor route
  instead of the unknown-route→legacy fallback.
- **Navigation escape hatches on every error state.** In `AnimalEditorStepper.jsx:67-73`, replace the
  two bare `error-state` divs with a small shared error block that includes links to **Workspace**
  (`#/workspace`) and **Home** (`#/home`). In `ErrorState.jsx`, add a **Home** (`#/home`) link
  alongside the existing Workspace link, and wrap the content in a `<main id="main-content" role="main"
  tabIndex="-1" aria-label="Error">` so the error screen still exposes a focus target and landmark
  (DayEditorStepper's normal `main` is not rendered on the error path). Keep messages unchanged.
- **Honest stub steps.** In `DayEditorStepper.jsx` steps array (`:104-110`), mark Epochs/Validation/
  Export as not-yet-available so they are visibly disabled rather than silently opening empty content:
  add a `disabled: true` (or `comingSoon: true`) marker to those three step descriptors, and in
  `StepNavigation.jsx` extend the disabled logic (`:50`, `:59`, and the `handleNavigate` guard `:27-31`)
  to honor `step.disabled` in addition to the existing export gate. Update the stub copy
  (`EpochsStub`/`ValidationStub`/`ExportStub`) to read as a neutral "Coming soon" without
  milestone codenames. **These become real in [Phase 4](overview.md#current-codebase-integration-points)
  (Epochs) and [Phase 5](overview.md#current-codebase-integration-points) (Validation/Export)** — do not
  implement them here.
- **Remove the duplicate `<main>`.** Keep exactly one `<main id="main-content">` per AnimalEditor view.
  Remove the wrapper in `AnimalEditor/index.jsx:22-26` (keep `index.jsx` rendering `AnimalEditorStepper`
  directly) so the only `main` is `AnimalEditorStepper.jsx:531`; verify that one carries `role="main"`
  and `aria-label` (add if missing) since the wrapper that previously supplied them is gone.
- **Focus trap + focus-return in `ElectrodeGroupModal`.** Add a `modalRef` on the modal root `<div>`
  (`:184`), extend the ESC `useEffect` (`:136-147`) to the combined keydown handler from
  `CameraModal.jsx:152-182` (port the Tab/Shift-Tab cycle verbatim), and add focus-return: capture
  `document.activeElement` when the modal opens and restore focus to it on close. **This is an interim
  fix — [Phase 3](shared-contracts.md#modal-primitive-contract) replaces both `CameraModal` and
  `ElectrodeGroupModal` with the shared `<Modal>` primitive; note that in a code comment so Phase 3
  knows this trap is throwaway.**
- **Back-to-workspace link in the AnimalEditor header.** In `AnimalEditorStepper.jsx:504-506`, add a
  "← Back to Workspace" link (`#/workspace?animal=${animal.id}`, `aria-label="Back to workspace"`)
  before the `<h1>`, mirroring the DayEditor header pattern (`DayEditorStepper.jsx:131-138`).
- **Wire real Devices step status.** In `validation.js:60`, replace the hardcoded `'incomplete'` with a
  computed status derived from the same logic `DevicesStep` uses. Extract a pure helper
  `computeDevicesStatus(animal, day)` (new exported function in `validation.js`, or a shared util both
  `validation.js` and `DevicesStep` import) that returns: `'incomplete'` if there are no electrode
  groups or any group has no ntrode channel map (the `DevicesStep.jsx:203` corruption branch);
  `'error'` if any group is all-bad (`getGroupStatus` → `error` / `allBad`); else `'valid'`
  (warnings from bad channels stay non-blocking per the severity policy). Feed `computeStepStatus` the
  `animal` (the merged metadata already carries device data; pass what the helper needs without forking
  validation). **Keep `epochs`/`validation` hardcoded** — they are Phase 4 / Phase 5. Confirm the
  `isExportEnabled` gate is unchanged.
- **Fix the post-create navigation race in Home.** In
  [src/pages/Home/index.jsx:90-92](../../../../src/pages/Home/index.jsx) the navigation after creating
  an animal is deferred via `setTimeout(…, 0)`, which races against the store update. Navigate from the
  confirmed created state (e.g. off the returned/created id once the create action resolves) rather than
  a timer, so the redirect can never run before the new entity exists.
- **Fix the stale-snapshot guard in batch day creation.** In
  [src/pages/AnimalWorkspace/index.jsx:65-87](../../../../src/pages/AnimalWorkspace/index.jsx) the
  batch day-creation loop checks each candidate id against the render-time `days` snapshot, which does
  not reflect ids created earlier in the same batch. Compute the existing-id set once and dedupe
  locally as the loop adds ids (accumulate created ids into the set), instead of re-reading the stale
  `days` snapshot per iteration, so a batch can't collide with its own just-created days.
- **Extend `aria-landmarks` tests to each new route.** Generalize the integration test to render the app
  on each of `#/home`, `#/workspace`, `#/day/:id`, `#/animal/:id/editor` (with the relevant flag(s)
  enabled via `overrideFlags`, restored in `afterEach`, and the Phase 2 fixture seeded) and assert per
  route: exactly one `role="main"` / one `#main-content`, a `role="navigation"` present, and no
  dead-end (an escape link to Home or Workspace exists). Keep the existing legacy-view assertions.

## Deliberately not in this phase

- **Extracting the shared `<Modal>` primitive or removing `alert()`/`window.confirm()`** — that is
  [Phase 3](shared-contracts.md#modal-primitive-contract). The ElectrodeGroupModal trap added here is a
  deliberate interim duplicate that Phase 3 deletes.
- **Making any stub functional** (Epochs in [Phase 4], Validation/Export in [Phase 5]) — this phase only
  makes them honestly disabled.
- **Flipping `animalWorkspace`/`newDayEditor`/`localStoragePersistence`/`showLegacyToggle` on, or
  changing the default route to the workspace** — all of that is [Phase 10](overview.md#rollout-strategy).
  Default route stays `#/` → legacy.
- **Persistence / SaveIndicator truthfulness** — [Phase 1](shared-contracts.md#persistence-contract).
- **Wiring `epochs`/`validation` step status** — Phases 4 / 5.

## Validation slice

| Test | Asserts |
| --- | --- |
| `aria-landmarks` per-route (Home) | with `animalWorkspace` on + seeded workspace, `#/home` renders exactly one `role="main"` and one `#main-content`, a `role="navigation"`, and a link to Workspace. |
| `aria-landmarks` per-route (Workspace) | `#/workspace` renders exactly one `main`/`#main-content`, one+ navigation landmark, escape link to Home. |
| `aria-landmarks` per-route (DayEditor) | `#/day/:id` (`newDayEditor` on, seeded day) renders exactly one `main`/`#main-content`; back-to-workspace link present. |
| `aria-landmarks` per-route (AnimalEditor) | `#/animal/:id/editor` renders **exactly one** `<main>` and one `#main-content` (duplicate removed); back-to-workspace link present. |
| `AnimalEditor` not-found escape | rendering `#/animal/missing/editor` shows links to Home and Workspace (no dead-end). |
| `DayEditor` ErrorState escape + landmark | a missing-day route renders a `role="main"` and both Workspace and Home links. |
| `ElectrodeGroupModal` focus trap | Tab from last focusable wraps to first; Shift-Tab from first wraps to last (mirrors `CameraModal` trap test). |
| `ElectrodeGroupModal` focus return | opening from a trigger button then closing (ESC and overlay-click) restores focus to that button. |
| `OverviewStep` links resolve to editor route | the breadcrumb and "Edit Animal" hrefs equal `#/animal/<id>/editor`, and `parseHashRoute` on that href yields `view:'animal-editor'` (not the `isUnknownRoute` legacy fallback). |
| `StepNavigation` disabled stubs | Epochs/Validation/Export buttons render `disabled`; `handleNavigate` is a no-op for them (no `onNavigate` call). |
| `computeStepStatus` devices — incomplete | no electrode groups → `devices:'incomplete'`; a group missing its ntrode map → `'incomplete'`. |
| `computeStepStatus` devices — error/valid | an all-bad-channels group → `devices:'error'`; healthy groups with no/partial bad channels → `'valid'`. |
| `isExportEnabled` unchanged | with `devices` now real but `epochs`/`validation` still `'incomplete'`, Export stays disabled. |
| flag-aware routing | with `animalWorkspace`/`newDayEditor` off, `#/` still renders legacy; new routes remain reachable for dev; with flags on, new views render without redirect. |
| Home post-create navigation | creating an animal navigates to the new entity from confirmed created state (no `setTimeout`); the redirect target reflects the just-created id and never runs before it exists. |
| AnimalWorkspace batch day creation dedupe | creating a batch of days produces unique ids with no collision against ids created earlier in the same batch (existing-id set computed once and accumulated locally, not re-read from a stale `days` snapshot). |
| golden baselines | `src/__tests__/baselines/golden-yaml.baseline.test.js` byte-identical (no YAML path touched). |

Tests are jsdom Vitest component/integration tests (no separate slow/integration marker needed).

## Fixtures

A minimal workspace seed helper (new, e.g. `src/__tests__/helpers/workspace-fixtures.js`) returning a
`{ workspace }` shape for `<StoreProvider initialState={...}>`: one animal with `id`, `subject`,
`experimenters`, and `devices` containing **one electrode group + its `ntrode_electrode_group_channel_map`
entry** (so `DevicesStep`/`computeDevicesStatus` exercise the real path), and **one day** keyed under
`days` with a matching `animalId` and a `session` block. Provide small variants the status tests need:
no-groups, missing-ntrode-map, and an all-bad-channels day (`day.deviceOverrides.bad_channels`). Match
the field shapes in `src/state/workspaceTypes.js` and the existing
`src/__tests__/unit/state/workspace-day.test.js` / `workspace-animal.test.js`. Seed via
`StoreProvider initialState={{ workspace }}` ([store.js:54-68](../../../../src/state/store.js)); set
the route by assigning `window.location.hash` before render.

## Review

Follow the full gate in [review-protocol.md](review-protocol.md). Phase-specific:

- **Self-verify (§1):** run this phase's Validation slice + `npx vitest run` (no regressions; baseline 2747/1 skipped) + `npx vitest run baselines` (byte-identical). Emphasis: `isExportEnabled` is **not** loosened (gate still requires every step `'valid'`); no flag flips and default route still `#/`→legacy.
- **Playwright UI (§2):** navigate every new route via the new nav (Home/Workspace/AnimalEditor/DayEditor), confirm no dead-ends and that stub steps are disabled / "coming soon"; assert exactly one `<main>` per page; verify the `ElectrodeGroupModal` focus trap and focus-return. 0 console errors.
- **Reviewers:** `pr-review-toolkit:code-reviewer` (always), plus `ux-reviewer` and a WCAG 2.1 AA a11y check (landmarks, focus management).
- **Checklist (§6):** every task implemented; "Deliberately not in this phase" honored; tests non-trivial; no plan/phase/`M`-milestone strings in code/test names/docstrings (scrub leftover "M6/M7/M9/M10" copy); old code flagged for removal is removed (duplicate `<main>` gone from `AnimalEditor/index.jsx`; interim ElectrodeGroupModal trap marked for Phase 3 removal); user-facing docs updated.
