# Phase 11 — Cutover to v3.0.0 (default workspace, legacy behind a toggle)

[← back to PLAN.md](PLAN.md) · [overview](overview.md#rollout-strategy) · [shared contracts](shared-contracts.md#feature-flags--routing-contract)

This is the single switch that exposes everything built in Phases 1–10. The new workspace UI becomes
the **default**; the legacy single-page form stays reachable behind a "Use Legacy Editor" toggle (and
an explicit `#/legacy` route) for one release; shadow-export parity stays **strictly enforced** for one
more release; and the package is tagged **v3.0.0**. No legacy code is deleted here — removal is named
below with a post-v3.0.0 revisit trigger
([overview Non-Goals](overview.md#non-goals)).

**Hard release gate (do not weaken):** cutover MUST NOT flip the default route until
[Phase 6](phase-6-legacy-byteorder-parity.md) has landed and its **byte-for-byte legacy parity** tests
pass. Before cutover the new UI is flag-gated/non-default, so a session exported via the new UI vs the
legacy form may differ *textually* (semantically-equal, key-order-different) YAML — acceptable only while
the new path is not the default a user lands on. Making the new path default while it still emitted
byte-different files would surface that divergence to users who diff/commit/eyeball `.yml` files. The
review §1 checklist below asserts Phase 6 parity is in place.

This phase assumes Phases 1–10 have landed: persistence is on
([Persistence contract](shared-contracts.md#persistence-contract)), routing is flag-aware
([Phase 2](phase-2-navigation-stub-honesty.md) per the
[Feature flags & routing contract](shared-contracts.md#feature-flags--routing-contract)), the new
UI can complete create→configure→day→tasks→validate→**export YAML**
([Phase 5](phase-5-validation-export.md)), and that export is **byte-for-byte identical to the legacy
export** ([Phase 6](phase-6-legacy-byteorder-parity.md)).

**Inputs to read first:**

- [src/featureFlags.js](../../../../src/featureFlags.js) — flags to flip: `showLegacyToggle:false`
  (`:105`), `animalWorkspace:false` (`:121`), `newDayEditor:false` (`:149`). `localStoragePersistence`
  (`:133`) is **already true** from [Phase 1](phase-1-persistence.md) — do not touch it. Keep
  `shadowExportStrict:true` (`:60`) and `shadowExportLog:true` (`:72`) as-is. `isFeatureEnabled(name)`
  (`:328`), `overrideFlags`/`restoreFlags` (`:381`,`:396`) drive tests.
- [src/hooks/useHashRouter.js:37-101](../../../../src/hooks/useHashRouter.js) — `parseHashRoute`.
  Today empty/`#/` → `view:'legacy'` (`:46-49`) and the unknown-route fallback returns `view:'legacy'`
  (`:99-101`). **Phase 2 makes this flag-aware** per the
  [routing contract](shared-contracts.md#feature-flags--routing-contract); this phase changes the
  default and fallback **target** once `animalWorkspace` is on (see Task 2). There is no `#/legacy`
  branch yet — `parseHashRoute` has no case for it (`:55-97`); this phase adds one.
- [src/layouts/AppLayout.jsx:115-140](../../../../src/layouts/AppLayout.jsx) — `renderView()`
  `switch (currentRoute.view)`; `legacy`/`default` → `<LegacyFormView />` (`:136-138`). Phase 2 adds
  the top nav / `role="navigation"` landmark here; this phase surfaces the legacy toggle in that
  chrome and ensures a `legacy` view case remains.
- [src/App.js:27-29](../../../../src/App.js) — shell; renders `<AppLayout />`. No change expected.
- [src/pages/LegacyFormView.jsx](../../../../src/pages/LegacyFormView.jsx) — the only path that can
  export YAML pre-Phase-5; the safety net. **Named for deletion below, not deleted here.**
- [package.json:3](../../../../package.json) — `"version": "2.3.0"` → `3.0.0`.
- [README.md:5-9](../../../../README.md) — describes the single guided form as the workflow; must be
  updated to describe the workspace as default and the legacy toggle.
- [.github/workflows/test.yml:142-173](../../../../.github/workflows/test.yml) — the `build` job
  (`CI=false npm run build`, `:166`); the place to add the revert+rebuild rollback check
  ([docs/TASKS.md](../../../../docs/TASKS.md), "Maintain rollback test in CI (revert + rebuild check)").

**Contracts referenced:**

- [Feature flags & routing contract](shared-contracts.md#feature-flags--routing-contract) — this phase
  performs the documented "single switch": flip `animalWorkspace`/`newDayEditor` on
  (`localStoragePersistence` already on), set default route to workspace home, expose
  `showLegacyToggle`, keep shadow-export strict. `#/` bookmarks must still resolve.
- [YAML parity / shadow-export contract](shared-contracts.md#yaml-parity--shadow-export-contract) —
  **do not weaken.** `shadowExportStrict` stays `true`; the export gate from Phase 5 still blocks
  mismatched downloads; the 4 golden baselines stay byte-identical.
- [Persistence contract](shared-contracts.md#persistence-contract) — `localStoragePersistence` stays
  on; this phase neither flips nor re-implements it, and must not change the persisted shape.

## Tasks

- **Flip the remaining new-UI flags on.** In [src/featureFlags.js](../../../../src/featureFlags.js)
  set `animalWorkspace: true` (`:121`), `newDayEditor: true` (`:149`), and `showLegacyToggle: true`
  (`:105`). Leave `localStoragePersistence` (`:133`) at its Phase-1 value (`true`) and
  `shadowExportStrict`/`shadowExportLog` (`:60`,`:72`) at `true`. Update each flipped flag's JSDoc
  `Default:` line to reflect the new default and add a one-line note that `showLegacyToggle` is a
  one-release transitional flag scheduled for removal (see Task 6). Do **not** flip unrelated still-
  unbuilt flags (`newNavigation`, `inlineValidation`, `channelMapEditor`, etc.) — they are out of
  scope.

- **Resolve overview [Open Question 3](overview.md#open-questions): make `#/` → workspace home, keep
  legacy reachable.** In [src/hooks/useHashRouter.js](../../../../src/hooks/useHashRouter.js):
  - When `animalWorkspace` is enabled, the empty/`#/` branch (`:46-49`) resolves to the workspace home
    view rather than `legacy`, and the unknown-route fallback (`:99-101`) follows the same default
    target (per the routing contract: "after cutover the fallback target follows the default route").
    Keep the existing console warning on unknown routes. When the flag is off (legacy still default),
    behavior is unchanged — gate on `isFeatureEnabled('animalWorkspace')` so the default is driven by
    one flag, not duplicated.
  - Add an explicit `#/legacy` route: a new exact-match branch (alongside `:55-67`) returning
    `{ view: 'legacy', params: {} }`. This is unconditional (legacy is always reachable by URL while it
    exists), independent of the flag.
  - **Existing `#/` bookmarks still resolve sanely:** with the flag on, an old `#/` bookmark lands on
    workspace home (the new default) rather than 404/blank; with the flag off it still lands on legacy.
    Assert both in tests. (The banner logo link `#/` in
    [AppLayout.jsx:171](../../../../src/layouts/AppLayout.jsx) consequently points at the new home — keep
    its `aria-label` accurate; update from "Return to metadata form" to the home destination.)

- **Expose the "Use Legacy Editor" toggle in AppLayout for one release.** In the nav chrome Phase 2
  added to [src/layouts/AppLayout.jsx](../../../../src/layouts/AppLayout.jsx), render a control (link or
  button styled as a link) that switches to the legacy editor when `isFeatureEnabled('showLegacyToggle')`
  is true; hide it entirely when false (so removing the flag later cleanly removes the control). The
  control navigates to `#/legacy` (forward) and, from the legacy view, offers a way back to the
  workspace home (`#/` or `#/home`). Label it "Use Legacy Editor" / "Return to new editor" and keep it
  inside the existing `role="navigation"` landmark with an accessible name. Do not introduce new global
  state — drive it purely off the hash route + the flag.

- **Keep shadow-export strict (do not relax parity).** No code change to the Phase-5 export gate or to
  `shadowExportStrict` (stays `true`,
  [src/featureFlags.js:60](../../../../src/featureFlags.js)). Add/keep a guard test asserting the flag
  is `true` at cutover so a future accidental relaxation fails CI. This satisfies the M13 DoD "Shadow
  export still enforced for one additional release."

- **Bump version and update user-facing docs.** Two doc tasks (not a vague "update docs"):
  - [package.json:3](../../../../package.json): `"2.3.0"` → `"3.0.0"`.
  - [README.md](../../../../README.md): rewrite "Introduction"/"Running Locally" so the **workspace
    workflow is the default** (create animal → configure devices/hardware → create day(s) → enter
    tasks/epochs → validate → export YAML; autosaves to the browser), and document the **"Use Legacy
    Editor" toggle** as a transitional fallback available for one release at `#/legacy`. Keep the
    deployment/`gh-pages` note. In `docs/REFACTOR_CHANGELOG.md`, add a `3.0.0` entry stating the new
    default UI, the legacy toggle, that YAML output is unchanged/byte-identical, and the post-v3.0.0
    legacy-removal plan.

- **Name the legacy-removal path explicitly (do not execute it here).** Document — in this phase file
  and in the `docs/REFACTOR_CHANGELOG.md`/README note above — the files to delete in the post-v3.0.0 removal PR
  (original plan's "PR14 for flag removal"):
  - [src/pages/LegacyFormView.jsx](../../../../src/pages/LegacyFormView.jsx) and its tests.
  - The `legacy` view case in [src/layouts/AppLayout.jsx](../../../../src/layouts/AppLayout.jsx)
    (`:136-138`) and the `#/legacy` branch + flag-gated default in
    [src/hooks/useHashRouter.js](../../../../src/hooks/useHashRouter.js) (the `default` becomes
    unconditional workspace home).
  - The `showLegacyToggle` flag ([src/featureFlags.js:105](../../../../src/featureFlags.js)) and the
    toggle control added in Task 3.
  - Any element/component code used **only** by `LegacyFormView` (identify at removal time by
    import-graph reachability from `LegacyFormView.jsx`; do not assume the list now). The legacy
    `formData` slice of the store may then also be retired — coordinate with the store owner.
  - **Revisit trigger:** schedule the removal PR for the release **after one full release with the
    legacy toggle shipped and no fallback usage** (e.g. vX.Y, one minor after v3.0.0). Do **not** remove
    while shadow-export parity is still the only proof the new path matches legacy.

- **Maintain the CI rollback test (revert + rebuild check).** In
  [.github/workflows/test.yml](../../../../.github/workflows/test.yml) add a job (or step in `build`)
  that verifies the app still builds with the cutover **reverted** — i.e. with the new-UI flags forced
  off — so legacy remains a working fallback for the one-release window. Implement it without a real git
  revert: run the production build with the flags overridden to legacy defaults via an env-gated path
  the build already honors, or a minimal script that temporarily sets `animalWorkspace`/`newDayEditor`/
  `showLegacyToggle` to `false` and runs `npm run build`, then restores. Keep the existing `CI=false`
  workaround note ([:161-166](../../../../.github/workflows/test.yml)) intact unless Phase 0 already
  removed it. If a clean flag-override build hook does not exist, scope this to a build-only smoke check
  rather than inventing new app code.

## Deliberately not in this phase

- **Deleting `LegacyFormView` or any legacy-only code.** Named above with a post-v3.0.0 revisit
  trigger; executing it now removes the safety net while parity is still the only proof of correctness
  ([overview Non-Goals](overview.md#non-goals)).
- **Relaxing or removing shadow-export parity.** `shadowExportStrict` stays `true` for one more release
  ([shadow-export contract](shared-contracts.md#yaml-parity--shadow-export-contract)).
- **Removing the `showLegacyToggle` flag.** It must survive one release; removal is part of the same
  post-v3.0.0 PR.
- **New features** (optogenetics editor, batch export, probe-reconfig wizard, etc.) — out of scope; this
  phase only flips defaults and updates docs.
- **Changing the persisted localStorage shape or the export/filename logic** — owned by Phases 1 and 5;
  any change here would risk silent data corruption.

## Validation slice

Mark integration / e2e tests explicitly. Unit tests use `overrideFlags`/`restoreFlags`
([src/featureFlags.js:381,396](../../../../src/featureFlags.js)) in `beforeEach`/`afterEach` so the
real flag flip is exercised without leaking across tests.

| Test | Asserts |
| --- | --- |
| `featureFlags` cutover defaults | `FLAGS.animalWorkspace === true`, `FLAGS.newDayEditor === true`, `FLAGS.showLegacyToggle === true`, `FLAGS.localStoragePersistence === true`. |
| `featureFlags` parity guard | `FLAGS.shadowExportStrict === true` (regression guard — parity stays enforced this release). |
| `parseHashRoute` default with flag on | with `animalWorkspace` true, `parseHashRoute('#/')` and `parseHashRoute('')` resolve to the workspace home view (not `legacy`). |
| `parseHashRoute` default with flag off | with `animalWorkspace` false, `parseHashRoute('#/')` still resolves to `legacy` (no behavior change when flag off). |
| `parseHashRoute` explicit legacy route | `parseHashRoute('#/legacy')` → `{ view: 'legacy', params: {} }` regardless of flag. |
| `parseHashRoute` unknown-route fallback | with flag on, an unknown route falls back to the workspace home (default target) and still warns; with flag off, falls back to `legacy`. |
| `AppLayout` legacy toggle visibility | with `showLegacyToggle` on, a "Use Legacy Editor" control renders inside the navigation landmark with an accessible name; with it off, the control is absent. |
| `AppLayout` toggle navigation (integration) | clicking "Use Legacy Editor" routes to `#/legacy` and renders `LegacyFormView`; the return control routes back to workspace home. |
| `version` bump | `package.json` `version === '3.0.0'`. |
| golden baselines | `golden-yaml.baseline.test.js` — all 4 fixtures byte-identical (no parity drift from the flip). |
| **e2e** full new-UI flow with flags on | with cutover flags on, landing on `#/` shows workspace home; user completes create→configure→day→tasks→validate→export end-to-end in the new UI and downloads YAML; the shadow-export gate still blocks a deliberately mismatched export. |
| **e2e** legacy toggle round-trip | toggle to legacy editor and back to the new editor; an old `#/` bookmark resolves to workspace home. |
| **e2e** persistence survives reload | enter workspace data, reload, state is restored (Persistence contract, flag on). |
| **integration** build-with-flags-off (CI) | production build succeeds with cutover flags forced to legacy defaults (rollback fallback still builds). |

## Fixtures

- **End-to-end workspace built from scratch.** An integration test constructs a workspace via the store
  actions ([Workspace data model & store actions](shared-contracts.md#workspace-data-model--store-actions):
  `createAnimal` → `addConfigurationSnapshot` → `createDay` → `updateDay` for tasks/epochs/session) such
  that `encodeYaml(mergeDayMetadata(animal, day))` reproduces one of the existing golden fixtures'
  YAML byte-for-byte ([src/\_\_tests\_\_/fixtures/golden/](../../../../src/__tests__/fixtures/golden/),
  e.g. `realistic-session.yml`). This proves the now-default UI's export equals the locked-in golden
  output — the metric "import legacy YAML → build workspace → export → byte-identical"
  ([overview Metrics](overview.md#metrics)). Reuse the Phase-5 export/parity helpers; do not fork the
  encode path.
- No new golden fixtures are added or regenerated; the 4 existing fixtures stay authoritative.
- e2e tests run under the existing Playwright setup
  ([.github/workflows/test.yml:56-94](../../../../.github/workflows/test.yml)).

## Review

Follow the full gate in [review-protocol.md](review-protocol.md). Phase-specific:

- **Self-verify (§1):** run this phase's Validation slice + `npx vitest run` (no regressions) + `npx vitest run baselines` (byte-identical). **Release gate: confirm [Phase 6](phase-6-legacy-byteorder-parity.md) byte-for-byte legacy parity has landed and its parity tests pass before flipping the default route** — do not cut over on semantic-only parity. Emphasis: `shadowExportStrict` is still `true` and the Phase-5 export gate is untouched — parity is **not** relaxed; tests use real behavior (actual flag flip via `overrideFlags`, real `parseHashRoute` output, real toggle render).
- **Playwright UI (§2):** with flags ON, run a full E2E in a browser — `#/` lands on the workspace → create animal → configure → create day → tasks → validate → export a real file; flip the legacy toggle and back; confirm old `#/` bookmarks still resolve. 0 console errors.
- **Reviewers:** `pr-review-toolkit:code-reviewer` (always), plus `silent-failure-hunter`, `pr-test-analyzer`, and `ux-reviewer`; this PR also carries the final release / parity sign-off.
- **Checklist (§6):** every task implemented (all four flags at cutover values; `#/`→workspace with flag on and legacy fallback off; `#/legacy` resolves; version `3.0.0`; rollback CI check); "Deliberately not in this phase" honored (no legacy code deleted — removal path documented with a post-v3.0.0 revisit trigger; `legacy` view case and `LegacyFormView` still exist); tests non-trivial; no plan/phase/milestone strings in code/test/module names or docstrings; user-facing docs (README, `docs/REFACTOR_CHANGELOG.md`) updated in this phase, not deferred.
