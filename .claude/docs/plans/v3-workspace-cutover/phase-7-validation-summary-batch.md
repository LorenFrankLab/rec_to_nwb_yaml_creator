# Phase 7 — Validation Summary & batch tools

[← back to PLAN.md](PLAN.md) · [overview](overview.md) · [shared-contracts](shared-contracts.md)

Goal: replace the Validation Summary stub with a working cross-day overview page that lists every day
across all animals with a per-day validation status chip, a **Validate All** action that recomputes
status for every day, and an **Export Valid Only** action that batch-exports each fully-valid day
through the **same** shadow-export gate the single-day Export step uses (Phase 5) — skipping and
reporting any day that fails parity, never bypassing the gate. Counts (N valid / N with errors) are
surfaced and each row links to its DayEditor. Autosave/persistence (Phase 1) must restore the
workspace and therefore the summary on reload; an integration test proves recovery.

**Depends on:** [Phase 2](phase-2-navigation-stub-honesty.md)'s flag-aware routing — new routes stay
renderable in tests with flags toggled, which the summary-render and recovery integration tests in
this phase's validation slice rely on.

**Inputs to read first:**

- [src/pages/ValidationSummary/index.jsx](../../../../src/pages/ValidationSummary/index.jsx) — the
  current stub (`ValidationSummary` at `:13`, rendered as `<main id="main-content">`). This whole file
  is replaced. Keep the `<main id="main-content" tabIndex="-1" role="main">` landing element and a
  labelled `<h1>` so the AppLayout focus-to-`#main-content` and skip-link behavior keep working.
- [src/layouts/AppLayout.jsx:133-134](../../../../src/layouts/AppLayout.jsx) — `case 'validation':
  return <ValidationSummary />;`. The `#/validation` route already resolves here; no routing change is
  needed in this phase. (`validation: 'Validation Summary'` label at `:32`.)
- [src/hooks/useHashRouter.js:64-66](../../../../src/hooks/useHashRouter.js) — `#/validation` →
  `{ view: 'validation' }`; `#/day/:id` → `{ view: 'day', params:{ id } }` (`:86-96`). Row links
  target `#/day/${day.id}` so they resolve to the DayEditor.
- [src/state/store.js:519-579](../../../../src/state/store.js) — `selectors` (memoized).
  `getAnimalDays(animalId)` (`:568-576`) maps `animal.days` → `workspace.days[dayId]`, filters falsy,
  and sorts by `a.date.localeCompare(b.date)`. The store exposes `model.workspace.animals` and
  `model.workspace.days` (`:629-646`); `updateDay(dayId, updates)` is in `workspaceActions` (`:414`).
  Consume the store via `useStoreContext` ([src/state/StoreContext.js](../../../../src/state/StoreContext.js)),
  matching `DayEditorStepper`'s pattern.
- [src/state/store.js:359-388](../../../../src/state/store.js) — `Day` shape as created: has both
  `date` (`YYYY-MM-DD`) and `experimentDate` (mmddYYYY), `animalId`, `session`, and a `state`
  sub-object `{ draft, validated, exported }` (`:380-384`). **Note the field is `day.state`, not
  `day.status`** — this phase reads/writes `day.state.validated` via `updateDay` after Validate All.
- [src/pages/DayEditor/validation.js:52-65](../../../../src/pages/DayEditor/validation.js) —
  `computeStepStatus(day, mergedDay)` returns `{ overview, devices, epochs, validation, export }`.
  After Phase 5, `validation` reports real status. **Do not fork** this; the summary derives a single
  per-day chip from these step statuses (see Tasks for the rule).
- [src/pages/DayEditor/DayEditorStepper.jsx:39-60](../../../../src/pages/DayEditor/DayEditorStepper.jsx)
  — the canonical "load day+animal, merge, compute status" sequence the summary mirrors per row:
  `day = workspace.days[dayId]`, `animal = workspace.animals[day.animalId]`,
  `mergedDay = mergeDayMetadata(animal, day)`, `computeStepStatus(day, mergedDay)`.
- [src/state/workspaceUtils.js:34-103](../../../../src/state/workspaceUtils.js) —
  `mergeDayMetadata(animal, day)` (2-arg) → flat metadata. After Phase 1 the result is safe to own.
- [src/io/yaml.js:37,107,127](../../../../src/io/yaml.js) — `encodeYaml(model)` (`:37`),
  `formatDeterministicFilename(model)` (`:107`), `downloadYamlFile(fileName, content)` (`:127`).
  Batch export computes one filename + content per valid day.
- [src/pages/DayEditor/shadowExport.js](../../../../src/pages/DayEditor/shadowExport.js) **(introduced
  in [Phase 5](phase-5-validation-export.md))** — `checkShadowExport(animal, day)` returns
  `{ ok, yaml, legacyYaml, diff }`. Batch export reuses this exact helper per day; it does not
  reimplement parity comparison. Read Phase 5's handler shape
  ([phase-5 lines 84-147](phase-5-validation-export.md)) so the batch path mirrors it.
- [src/state/persistence.js](../../../../src/state/persistence.js) and the autosave wiring
  **(introduced in [Phase 1](phase-1-persistence.md))** — `WORKSPACE_STORAGE_KEY`,
  `loadWorkspace()`, `saveWorkspace(workspace)`. This phase **reuses** persistence (does not rebuild
  it); the recovery test exercises the load-on-init path.

**Contracts referenced:**

- [Validation & step-status contract](shared-contracts.md#validation--step-status-contract) — reuse
  `validate()` / `computeStepStatus()`; never fork validation into the summary. Only `error`-severity
  issues block export; data-entry incompleteness is non-blocking. A day is "exportable" only when
  every step status is `'valid'` (the same condition `isExportEnabled` enforces).
- [YAML parity / shadow-export contract](shared-contracts.md#yaml-parity--shadow-export-contract) —
  every batch download routes through `checkShadowExport`; on byte mismatch the day is **skipped and
  reported**, never downloaded. `shadowExportStrict` (default true) gates only the debug override.
  Golden baselines stay byte-identical.
- [`mergeDayMetadata` contract](shared-contracts.md#mergedaymetadata-contract) —
  `encodeYaml(mergeDayMetadata(animal, day))` equals the legacy export byte-for-byte; the summary
  consumes the merged object read-only.
- [Persistence contract](shared-contracts.md#persistence-contract) — persist `workspace` only; on
  reload, hydrate from `localStorage` when the flag is on and `schemaVersion` matches; discard with a
  user-visible notice on mismatch. The recovery test asserts the summary reflects the restored
  workspace.
- [Workspace data model & store actions](shared-contracts.md#workspace-data-model--store-actions) —
  mutate days only through `updateDay`; preserve `setWorkspace(prev => …)` + `structuredClone`
  immutability (Validate All writes `day.state.validated` via `updateDay`, never by mutation).

## Tasks

- **Replace the `ValidationSummary` stub with a working overview page**
  ([src/pages/ValidationSummary/index.jsx](../../../../src/pages/ValidationSummary/index.jsx)).
  Read the store via `useStoreContext`. Flatten all days across animals — iterate
  `Object.values(model.workspace.animals)` and, for each, its `days`, resolving each `dayId` to
  `model.workspace.days[dayId]` (or reuse `selectors.getAnimalDays(animalId)` per animal and
  concatenate). For each day build `mergedDay = mergeDayMetadata(animal, day)` and
  `stepStatus = computeStepStatus(day, mergedDay)` — the **identical** sequence
  `DayEditorStepper` uses (`:43-60`); do not duplicate validation logic. Render a table with one row
  per day showing: animal subject id, day date (`day.date`), session id, and a **status chip** derived
  from `stepStatus` by this rule (single source, no fork):
  - every step `'valid'` → `valid`
  - any step `'error'` → `error`
  - otherwise (any `'incomplete'`/`'pending'`, no errors) → `incomplete`

  Each row links to its editor via `<a href={`#/day/${day.id}`}>`. Keep the page's outer
  `<main id="main-content" tabIndex="-1" role="main" aria-labelledby="validation-heading">` and the
  `<h1 id="validation-heading">` so AppLayout's focus/skip-link contract holds. When the workspace has
  no days, render an empty-state message (and no table).

- **Surface counts.** Above the table, render a summary line of `N valid / N with errors`
  (and optionally `N incomplete`) computed from the derived chips. Expose these counts in a way the
  tests can assert (e.g., a `role="status"` region with text, or stable `data-testid`s). Counts must
  update reactively when the underlying workspace changes (they are recomputed from `model.workspace`
  on render — no separate cached state).

- **Add a "Validate All" action.** A button that recomputes status for **every** day (re-running
  `mergeDayMetadata` + `computeStepStatus` over the current workspace) and reflects the results in the
  chips/counts. Because chips are derived from `model.workspace` on render, "validation" is effectively
  always-current; the button's job is to **persist** the outcome onto each day so reload/other views
  agree: for each day call `actions.updateDay(day.id, { state: { ...day.state, validated: <isValid> } })`
  where `isValid` is true iff the derived chip is `valid`. Use `updateDay` only (no direct mutation;
  preserve immutability). Announce completion via the same `role="status"` region (e.g., "Validated
  N days"). Do not loosen any export gate here — Validate All only computes/persists status.

- **Add an "Export Valid Only" action** that batch-exports every day whose derived chip is `valid`,
  routing **each** through the Phase 5 shadow gate. For each valid day:
  1. `const { ok, yaml, diff } = checkShadowExport(animal, day)` (reuse Phase 5's helper verbatim).
  2. If `ok` (or `ok === false` but `isFeatureEnabled('shadowExportStrict') === false`, the debug
     override): compute `fileName = formatDeterministicFilename(mergeDayMetadata(animal, day))` and
     trigger `downloadYamlFile(fileName, yaml)`.
  3. If `!ok` and strict mode is on: **skip** the day and collect it into a reported list
     `{ dayId, subjectId, date, diff }`. Never call `downloadYamlFile` for a parity-mismatch day in
     strict mode.

  After the loop, render a result region listing how many files were exported and a per-day report of
  any skipped days (with their first-line `diff` shown in a `<pre>` inside an alert region, matching
  Phase 5's blocking-error presentation). Days that are not `valid` are simply not in the export set
  (no shadow check needed for them).

  **Download UX — sequential downloads (chosen).** Trigger one `downloadYamlFile` per valid day in
  sequence. Rationale: zip output would require a new runtime dependency (JSZip), which the
  [dependency policy](overview.md#dependency-policy) forbids ("No new runtime dependencies expected");
  the deterministic per-day filename already disambiguates files. Trigger downloads in a stable order
  (the same flattened/sorted order the table uses) so behavior is reproducible. Do not introduce a zip
  library.

- **Wire the recovery integration test to existing persistence.** No new persistence code — Phase 1
  owns `src/state/persistence.js` and the autosave/load-on-init wiring. This phase adds an integration
  test (see Validation slice) that seeds `localStorage[WORKSPACE_STORAGE_KEY]` with a valid versioned
  blob, mounts the app/summary with the persistence flag on, and asserts the summary renders the
  restored days and counts. If Phase 1's load path is keyed such that an explicit `initialState`
  suppresses hydration, the test must mount without `initialState` so the load-on-init path runs (per
  [phase-1 line 183](phase-1-persistence.md)).

- **Documentation.** Add a short note to `docs/REFACTOR_CHANGELOG.md` describing the Validation Summary page with
  Validate All and Export Valid Only, and that batch export routes every file through the same
  byte-for-byte shadow-export parity gate (skipping and reporting any mismatched day). No
  README/getting-started change is required this phase — the new UI remains behind flags until
  [Phase 11](overview.md#rollout-strategy).

## Deliberately not in this phase

- **The probe-reconfiguration wizard** — that is [Phase 8](overview.md#estimated-effort) (original
  M11). Do not add device-diff or "apply forward" UI here.
- **Any change to the export encoder, `mergeDayMetadata`, the shadow-export gate, or the schema.** This
  phase only *consumes* `encodeYaml` / `checkShadowExport` / `mergeDayMetadata`. A parity change is a
  blocker requiring explicit fixture regeneration per CLAUDE.md's protocol — never to make a test pass.
- **Per-day editing UI** (session fields, tasks, devices, the single-day Export step). Editing lives in
  the DayEditor; the summary only links out to it.
- **Building or modifying persistence/autosave** — owned by [Phase 1](phase-1-persistence.md). This
  phase reuses it and tests recovery.
- **Flipping `localStoragePersistence` / `animalWorkspace` defaults or the default route** —
  [Phase 11](overview.md#rollout-strategy). New routes stay reachable only for testing this phase.
- **Adding a zip dependency or any new runtime dependency.** Sequential downloads only.

## Validation slice

| Test | Asserts |
| --- | --- |
| `summary: lists all days across animals with correct chips` | Seed a workspace with 3 days (one fully valid, one with an `error`-severity issue, one incomplete/missing required session fields) across one or more animals; the rendered table has 3 rows whose chips are `valid` / `error` / `incomplete` respectively, derived from `computeStepStatus`. |
| `summary: counts reflect chip breakdown` | The summary line / `role="status"` region reports `1 valid` and `1 with errors` (and `1 incomplete`) for the 3-day fixture. |
| `summary: each row links to its DayEditor` | Each row contains an anchor with `href="#/day/<dayId>"` for the matching day. |
| `summary: empty workspace renders empty state` | With no days, no table is rendered and an empty-state message is shown. |
| `validate-all: recomputes and persists status for every day` | Clicking "Validate All" calls `updateDay` for each day with `state.validated` true only for the valid day; chips/counts are unchanged (already derived) and the status region announces completion. |
| `export-valid-only: exports only valid days through the shadow gate` | Clicking "Export Valid Only" invokes `checkShadowExport` for the valid day and calls `downloadYamlFile` exactly once with `formatDeterministicFilename(merged)`; the error and incomplete days trigger no download. |
| `export-valid-only: parity mismatch is skipped and reported, never downloaded` | With `checkShadowExport` returning `{ ok:false, diff }` for an otherwise-valid day under `shadowExportStrict=true`, `downloadYamlFile` is **not** called for it and the result region reports the skipped day with its `diff`. |
| `export-valid-only: sequential downloads, one file per valid day` | With two valid days, `downloadYamlFile` is called twice in the table's stable order with the two distinct deterministic filenames. |
| `recovery: reload restores workspace and summary` *(integration)* | Seed `localStorage[WORKSPACE_STORAGE_KEY]` with a valid versioned blob (3-day workspace), mount with the persistence flag on and no `initialState`; the summary renders 3 rows and the correct counts from the restored workspace. |
| `golden-yaml.baseline.test.js` (existing) | All 4 golden fixtures stay byte-identical (unchanged this phase; run to prove no regression). |

Integration tests are marked *(integration)*; the recovery test touches `localStorage` + app mount and
must reset storage between runs. All tests use Vitest.

## Fixtures

- A `makeSummaryWorkspace()` test helper (add to
  [src/__tests__/helpers/integration-test-helpers.js](../../../../src/__tests__/helpers/integration-test-helpers.js)
  or a sibling helper module) that synthesizes a `workspace` (`{ version, lastModified, animals, days,
  settings }`) containing **three days**: (1) fully valid (passes `validate()` with zero
  `error`-severity issues and all steps `'valid'`), (2) with at least one `error`-severity issue, and
  (3) incomplete (missing a required session field such as `session_id`/`session_description` so the
  overview step is `'incomplete'`). Days follow the store-created shape
  ([store.js:359-388](../../../../src/state/store.js)) including `date`, `experimentDate`, `animalId`,
  `session`, and `state`. Reuse the existing animal/day builders already in the helpers where possible
  rather than hand-rolling shapes.
- The recovery test serializes that workspace into the Phase 1 blob shape
  `{ schemaVersion, workspace }` under `WORKSPACE_STORAGE_KEY` before mount.
- The shadow-gate tests mock `checkShadowExport` and `downloadYamlFile` (module mocks) to assert call
  counts and arguments without producing real downloads. Do not mock `validate`/`computeStepStatus` —
  exercise the real validation so chips are genuine, not tautological.

## Review

Follow the full gate in [review-protocol.md](review-protocol.md). Phase-specific:

- **Self-verify (§1):** run this phase's Validation slice + `npx vitest run` (no regressions; baseline 2747/1 skipped) + `npx vitest run baselines` (byte-identical, all 4 fixtures). Emphasis: the summary never forks validation (`validate`/`computeStepStatus` reused) and never bypasses the shadow gate (`checkShadowExport` reused per day); days mutate only via `updateDay`.
- **Playwright UI (§2):** open the Validation Summary → Validate All → Export Valid Only (only valid days export, each through the shadow gate) → reload and confirm the summary is restored. 0 console errors.
- **Reviewers:** `pr-review-toolkit:code-reviewer` (always), plus `silent-failure-hunter` (batch export), `pr-test-analyzer`, and `ux-reviewer`.
- **Checklist (§6):** every task implemented; "Deliberately not in this phase" honored; tests non-trivial (chips derived from real `computeStepStatus`; skip-on-mismatch test proves `downloadYamlFile` is not called; recovery test marked *(integration)* and resets `localStorage`); no plan/milestone strings in code/test/module names or docstrings; old code flagged for removal is removed; user-facing docs updated.
