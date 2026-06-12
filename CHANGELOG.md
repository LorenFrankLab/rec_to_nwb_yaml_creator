# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **Typed the validation leaf helpers under strict TS (refactor only, no behavior change).** The four
  pure, dependency-free predicate modules `validation/{paths,dandiSubject,behavioralEvents,taskEpochs}.js`
  are now `.ts` under `strict`: `normalizeAjvPath`, `isValidSpecies` / `idHasSlash`,
  `duplicateBehavioralEventNames` / `duplicateBehavioralEventDescriptions`, and `duplicateTaskEpochs`.
  Signatures take `unknown` and guard internally (matching the `validation/taskCatalogValidation.ts`
  precedent); bodies are verbatim. Every importer already used an extensionless path, so the rename is
  transparent. Validation suites (473) + golden baselines byte-identical; `npm run typecheck` + `CI=true`
  build clean. **Step 1 of typing the `validation/` core** — the `rules/*` families + the `rulesValidation`
  composer follow next.

- **Split the workspace store hook into focused collaborators (refactor only, no behavior change).**
  The ~851-LOC `state/useWorkspace.js` (which inlined hydration, persistence/autosave, all eight
  mutation actions, and the day selector) is now a 98-LOC orchestrator that owns only the wiring and
  the same-tick `commitWorkspace`/`workspaceRef` semantics, composing three extracted modules:
  - [workspaceActions.js](src/state/workspaceActions.js) — `createWorkspaceActions({ commitWorkspace,
    setWorkspace, workspaceRef })`, the eight animal/day mutation actions moved **verbatim** (same
    bodies, same `throw` timing, same `commitWorkspace`-vs-`setWorkspace` choice per action).
  - [useWorkspacePersistence.js](src/state/useWorkspacePersistence.js) — the SaveIndicator/beforeunload
    status, the post-mount load notice (discard/recovery), the 500ms-debounced + single-2s-retry
    autosave, and the Ctrl/Cmd+S `saveNow` — timing unchanged.
  - [workspaceHydration.js](src/state/workspaceHydration.js) — the pure `resolveInitialWorkspace`
    (the `useState` initializer's load-precedence logic), returning `{ workspace, discarded, recovered }`.
  - The bound `getAnimalDays` selector moved to a pure `getAnimalDays(workspace, animalId)` in its
    canonical home [workspaceSelectors.js](src/state/workspaceSelectors.js) (next to `getCopyableDioSources`).
  - **No public-API change:** `useStore` still exposes the exact same `{ model, selectors, actions,
    persistence }` keys (pinned by `store-public-api.test.js`). `commitWorkspace` is now a stable
    `useCallback` so the actions memo declares honest deps (no new lint suppression). The store suite
    (418), full suite (4786), golden baselines (byte-identical), `npm run typecheck`, and `CI=true`
    build all pass unchanged.

- **Split the business-rules validator into rule families (refactor only, no behavior change).** The
  ~1104-LOC `validation/rulesValidation.js` (a single function inlining ~20 rules) is now a 96-LOC
  composer over focused, individually-testable family modules under `validation/rules/`:
  [referenceRules.js](src/validation/rules/referenceRules.js) (camera/file/task-epoch/FsGUI refs),
  [optoRules.js](src/validation/rules/optoRules.js), [channelMapRules.js](src/validation/rules/channelMapRules.js)
  and [electrodeGroupRules.js](src/validation/rules/electrodeGroupRules.js) (probe/channel geometry),
  [dandiSubjectRules.js](src/validation/rules/dandiSubjectRules.js),
  [identityRules.js](src/validation/rules/identityRules.js) (Spyglass identity divergence), and
  [behavioralEventRules.js](src/validation/rules/behavioralEventRules.js). Each rule is now a pure
  `(model) => Issue[]` function; the composer runs them in the **exact same order** (so a direct
  `rulesValidation` caller sees a byte-identical list, even though `validate()` re-sorts the combined
  schema+rules issues). No rule code/severity/ownership/message change. The validation suites (473)
  + golden baselines pass unchanged; `CI=true` build clean.

- **Decomposed the Day Editor Devices step (Phase 9c-3 — refactor only, no behavior change).** The
  ~860-LOC `pages/DayEditor/DevicesStep.jsx` is split into focused sibling components; the step is now
  a 424-LOC module that owns the effective-config resolution + the bad-channel state/handlers and
  composes the pieces. The Phase 8C cameras-used checklist behavior and the device-override repair
  paths are preserved verbatim.
  - **New components:** [CamerasUsedSection.jsx](src/pages/DayEditor/CamerasUsedSection.jsx) (the 8C
    per-day cameras-used checklist + its inferred/explicit toggle logic, self-contained),
    [OverrideCleanupSection.jsx](src/pages/DayEditor/OverrideCleanupSection.jsx) (the malformed/stale/
    shadowing `deviceOverrides` removal controls + the `classifyDeviceOverrides` classification),
    [ConfigVersionPanel.jsx](src/pages/DayEditor/ConfigVersionPanel.jsx) (the config-version indicator
    + unpinned-day pin control + the reconfiguration wizard; owns the `wizardOpen`/`pinVersion` state),
    and [ElectrodeGroupsAccordion.jsx](src/pages/DayEditor/ElectrodeGroupsAccordion.jsx) (the per-group
    failed-channel editors; owns the per-group status-badge derivations).
  - **No behavior change:** `DevicesStep` is still the only export (consumed by `DayEditorStepper` via
    `DayEditorContext`). The DevicesStep suites (incl. stale-override-repair, workflow-copy, and the
    schema-valid-devices integration test) pass unchanged; golden baselines byte-identical; `CI=true`
    build clean.

- **Decomposed the Recording Days pane (Phase 9c-2 — refactor only, no behavior change).** The
  ~848-LOC `pages/AnimalWorkspace/RecordingDaysTab.jsx` is split into focused view components;
  the tab is now a 496-LOC controller that owns the create/duplicate/delete/copy/repair state +
  handlers and composes the pieces. No lifecycle/status semantics, copy, or mobile-layout change.
  - **New components:** [AnimalSetupCard.jsx](src/pages/AnimalWorkspace/AnimalSetupCard.jsx) (the
    first-run "Set up this animal" onboarding card), [ExistingDataReview.jsx](src/pages/AnimalWorkspace/ExistingDataReview.jsx)
    (the recovered/imported "Review existing data" state), [DayList.jsx](src/pages/AnimalWorkspace/DayList.jsx)
    (the empty-state + per-day rows with their statuses/actions; co-locates `humanizeNeedsFixingLabel`),
    and [DuplicateDayModal.jsx](src/pages/AnimalWorkspace/DuplicateDayModal.jsx) (the single-date
    duplicate picker).
  - **Public surface unchanged:** `RecordingDaysTab` is still the only export (the legacy Workspace
    and the tabbed AnimalView render the same implementation). The AnimalWorkspace + AnimalView test
    suites pass unchanged; golden baselines byte-identical; `CI=true` build clean.

- **Decomposed the Validation Summary (Phase 9c-1 — refactor only, no behavior change).** The
  ~1117-LOC `pages/ValidationSummary/index.jsx` is split into focused, individually-testable modules;
  `index.jsx` is now a 306-LOC page composition. No wording, count, status-chip, or export-eligibility
  change — the same `buildRows` chips, the same batch validate/export gates.
  - **New modules:** [validationSummaryRows.js](src/pages/ValidationSummary/validationSummaryRows.js)
    (pure row-building + display helpers — `buildRows`/`buildAnimalRows`/`deriveChip`/`dayChipDisplay`/…),
    [useValidationSummaryActions.js](src/pages/ValidationSummary/useValidationSummaryActions.js) (the
    Validate-All / Export-Valid-Only handlers + their per-run feedback state),
    [ExportReport.jsx](src/pages/ValidationSummary/ExportReport.jsx),
    [BatchExportPreflight.jsx](src/pages/ValidationSummary/BatchExportPreflight.jsx), and
    [DayStatusTable.jsx](src/pages/ValidationSummary/DayStatusTable.jsx) (the cross-day issue-list table).
  - **Public surface unchanged:** `index.jsx` re-exports `buildRows`/`buildAnimalRows`, so the per-animal
    AnimalView tab and the row tests import them from the same place. The full ValidationSummary test
    suite (61) passes unchanged; golden baselines byte-identical; `CI=true` build clean.

- **Re-armed the build gate (Phase 9b — `CI=true`, behavior-preserving).** The CI build now treats
  ESLint warnings as errors again, so the build **fails on new build-surface warnings** (the
  research's #3 ROI item — "build catches drift again"). `.github/workflows/test.yml` flips
  `CI=false` → `CI=true`; the former ~130 build-surface warnings were cleared by:
  - **Fixing the 5 genuine correctness warnings** (behavior-preserving): a write-only `useState`
    value left unbound (`OverviewStep`), a redundant `role="group"` removed from a `<details>`
    (`DayLifecycleLegend`), a deliberately-kept `role="list"` documented + suppressed where
    `list-style: none` makes it non-redundant for Safari/VoiceOver (`RecordingDaysTab`), and two
    `react-hooks/exhaustive-deps` suppressed with intent notes where adding the dep would change
    behavior (the mount-only handshake in `AnimalWorkspace`, the keyboard-shortcut effect in
    `AnimalCreationForm`).
  - **Turning off the @param/@returns JSDoc TYPE rules** (`require-param-type`, `require-returns`,
    `require-returns-type`, `check-types`) in `.eslintrc.js` — redundant with the ongoing .js → .ts
    migration (where they're already off), so requiring JSDoc type annotations on soon-to-be-typed
    files is churn. The doc-presence rules (`require-jsdoc`, `require-param`) and correctness rules
    (`check-param-names`, `valid-types`) are unchanged. (This also dropped the broader `npm run lint`
    debt from ~275 to ~7.)
  - **Lint scripts normalized:** added a non-mutating `lint:check` (CI-style, no `--fix`) alongside
    the existing dev `lint` (`--fix`), plus a `lint:css:fix` helper.
- **Corrected the production `browserslist` to a modern baseline (Phase 9b).** It was the unmodified
  Create React App default (`>0.2%, not dead, not op_mini all`), which silently resolved to include
  iOS Safari 11, UC Browser, and Opera Mobile — never a deliberate support decision. Added
  `not ios_saf < 15.4`, `not safari < 15.4`, `not and_uc > 0`, `not op_mob > 0`: the floor is now
  iOS/Safari 15.4 (29 → 26 targets). This trims unnecessary polyfills/prefixes from the build and lets
  the CSS use modern `inset` + color syntax. No app-behavior change on any supported browser.
- **CSS hygiene — safe auto-fixes (Phase 9b).** Ran the risk-free stylelint auto-fixes (hex shortening
  `#ffffff`→`#fff`, redundant `margin` shorthand, font-family quoting, `0px`→`0`, blank-line
  normalization, modern `rgb(r g b / a%)` color notation, and the `inset` shorthand) — all
  rendering-identical and within the modern browserslist floor above (modern color is Safari 12.1+,
  `inset` is 14.1+). `.stylelintrc.json` keeps the stylelint-config-standard modern defaults but pins
  the two rules whose auto-fix would exceed that floor: `media-feature-range-notation: prefix` (range
  queries need Safari 16.4) and `selector-not-notation: simple` (multi-arg `:not()` needs 16.4). The
  **full error-level ratchet + token work is deferred** to a dedicated CSS phase (~468 remaining
  warnings: `declaration-strict-value` token substitution, specificity ordering, class/keyframe
  renames). No visual change on any supported browser.
- **Validation/domain logic split + incremental TypeScript (Phase 9a — refactor only, no behavior
  change).** The ~1200-LOC `domain/validation.js` monolith is split into five focused, individually
  testable modules; `domain/validation.js` becomes a thin public **barrel** re-exporting the identical
  stable surface (17 exports), so every existing `import … from '.../domain/validation'` is unchanged.
  - **New modules:** [repairRouting.ts](src/domain/repairRouting.ts) (issue → step/surface/animal-tab
    routing), [geometryProvenance.ts](src/domain/geometryProvenance.ts) (geometry-override domain
    classification + provenance re-tag), [dayOverrideValidation.ts](src/domain/dayOverrideValidation.ts)
    (the override / data-acq / bad-channel / unpinned issue producers),
    [dayValidationComposer.js](src/domain/dayValidationComposer.js) (`validateDay` +
    `normalizeIssue`), and [stepStatus.ts](src/domain/stepStatus.ts) (`computeStepStatus`, the
    per-step helpers, and the export gate). No import cycles; the composer + barrel stay `.js` (they
    sit on the untyped `validate()` boundary).
  - **TypeScript under `strict`:** the four pure leaf modules are now `.ts` (the composer/barrel stay
    `.js`), introducing a shared permissive `RepairableIssue` issue-family type. Tolerant inputs keep
    their defensive `?.`/`Array.isArray` guards (typed `unknown` / loose interfaces); the only body
    changes are TS-required narrowing that is semantically identical. `tsc --noEmit` is clean.
  - **No behavior change.** Golden baselines are **byte-identical**; the
    `dayValidation.contract`, `architectureBoundaries.guard`, `store-public-api`, and
    `workspaceSelectors.guard` tests pass **unchanged**. No validation rule, severity, ownership,
    exported YAML key, or persisted-shape change. (The `workflowOwnership` source-scan was widened
    from `.js` to `.js`/`.ts` so its "every emitted code is owned" invariant survives the TS
    migration — a strengthening, not a weakening.)
- **Task-type catalog ACTIVATED — persisted shape + export resolution (Phase 8C, foundation).** The
  Phase 8B model is now live in persistence and export. **The exported YAML is unchanged** — a
  migrated day's `tasks[]` is byte-identical to the legacy inline export (golden baselines stay
  byte-identical), so trodes_to_nwb / DANDI / Spyglass see exactly the same files.
  - **Schema bump v2 → v3 with a registered, fixture-tested migrator.**
    `WORKSPACE_SCHEMA_VERSION` is now `3` and `migrateTasksToCatalogV2ToV3` is registered as
    `MIGRATORS[2]` ([workspaceMigrations.js](src/state/workspaceMigrations.js)). On load, a v1/v2
    blob's inline `day.tasks` is promoted into the animal-level `taskTypes[]` catalog + per-day
    `taskInstances[]` (C3 date-ordered dedup); a checked-in
    [v3 blob fixture](src/state/__tests__/fixtures/persistence/v3-workspace.json) proves v1/v2/v3 all
    hydrate to the same shape with no discard or data loss.
  - **`mergeDayMetadata` resolves the catalog.** The export now prefers a day's `taskInstances`
    (resolved against the animal `taskTypes`) and falls back to legacy inline `day.tasks` when a day
    is not catalog-shaped ([workspaceUtils.js](src/state/workspaceUtils.js)). A migrated day exports
    byte-identically to the equivalent inline day.
  - **Live catalog validation.** `validateDay` now surfaces catalog-level issues with clear
    ownership ([validation.js](src/domain/validation.js)): `duplicate_task_type_name` (animal —
    routes to the new Task Types tab), and `dangling_task_type_ref` / `task_camera_not_used` /
    `task_definition_reconciled` (day — the Epochs step). They reconcile with, and cannot
    double-report alongside, the existing `divergent_task_identity` rule (the catalog dedups by name,
    making that collision structurally impossible). Inline/unmigrated days produce zero catalog
    issues (no false positives).

### Added

- **Task-type catalog UI — define once, pick per day (Phase 8C).** Completes the F4 Tasks & Epochs
  redesign. **The exported YAML is unchanged.**
  - **Animal "Task Types" tab.** A new animal-setup tab
    ([TaskTypesSection](src/pages/AnimalEditor/TaskTypesSection.jsx) +
    [TaskTypeModal](src/pages/AnimalEditor/TaskTypeModal.jsx) +
    [TaskTypesContainer](src/pages/AnimalEditor/wiring/TaskTypesContainer.jsx)) where each behavioral
    task is defined ONCE — name, description, environment, and the cameras it uses — mirroring the
    Camera catalog. A duplicate `task_name` is blocked in-modal (the Spyglass identity is unique per
    name); deleting a referenced type warns that the days using it will need a re-pick.
  - **Per-day pick/order epochs.** The Day Editor's Tasks & Epochs step
    ([TasksEpochsStep](src/pages/DayEditor/TasksEpochsStep.jsx) +
    [TaskInstancesTable](src/pages/DayEditor/TaskInstancesTable.jsx) +
    [TaskInstanceModal](src/pages/DayEditor/TaskInstanceModal.jsx)) now SELECTS the task types a day
    ran from the animal catalog and assigns/orders each one's epochs (`day.taskInstances`) — no more
    retyping a task per day. An inline/imported/legacy day is converted to the catalog on first edit
    ([dayTaskCatalog.ts](src/state/dayTaskCatalog.ts)); an inline "Define a new task type" quick-add
    adds a missing type to the animal catalog without leaving day entry. Repair-before-orphaning of
    associated **video/file** references is preserved (re-keyed off the resolved instance epochs); a
    stale FsGUI epoch surfaces on the Validation screen (unchanged from Phase 6), not via the
    confirm-and-clear dialog.
  - **Fix (silent drop):** `applyDayUpdates` now persists `day.taskInstances`
    ([workspaceTransitions.js](src/state/workspaceTransitions.js)) — without it the store's day
    allow-list silently dropped every Tasks & Epochs edit.
  - *Not run in-sandbox: the spec's `nwbinspector --config dandi` / `dandi validate` fresh-catalog-day
    conversion check is provided as a manual runbook
    ([docs/testing/task-catalog-integration-runbook.md](docs/testing/task-catalog-integration-runbook.md)),
    since the `trodes_to_nwb` checkout and a Python env are unavailable to the agent.*

- **Task-type catalog model rehearsal (Phase 8B).** Behavior-preserving, inert model/utility layer
  for the upcoming "define-once, reuse-per-day" Tasks & Epochs redesign. **The live app is
  unchanged: inline `day.tasks` remains the runtime and export source of truth until Phase 8C
  activates the catalog (persisted shape bump + animal Task-Types UI + the registered v2→v3
  migrator).** No schema-version bump, no registered migrator, no UI or root-route change, and
  `npx vitest run baselines` stays byte-identical.
  - **Pure catalog core** ([taskCatalog.ts](src/state/taskCatalog.ts)): `deriveAnimalTaskCatalog`
    converts date-ordered inline `day.tasks[]` into an animal-level `taskTypes[]` catalog +
    ordered per-day `taskInstances[]`, deduping by `task_name` with first-occurrence
    canonicalization (the Spyglass dataset-unique identity); `resolveTaskInstances` is the
    C1-preserving bridge back to inline `tasks[]` carrying exactly the five `TASK_ORDER` keys (no
    internal `id`/`taskTypeId` leaks). For every non-conflicting fixture, inline → catalog → inline
    round-trips object- and byte-identically; a reused `task_name` with a divergent definition is
    deterministically normalized to the first occurrence with the original preserved for review.
  - **v2→v3 conversion utility** ([taskCatalogMigration.ts](src/state/taskCatalogMigration.ts)):
    `migrateTasksToCatalogV2ToV3`, a pure workspace→workspace transform named so Phase 8C can
    register it directly as `MIGRATORS[2]`. **Not registered and `WORKSPACE_SCHEMA_VERSION` is not
    bumped this phase.** Non-destructive: records same-name conflicts as
    `task_definition_reconciled` entries on the day (originals preserved), never silently dropped.
  - **Pure catalog validation helpers**
    ([taskCatalogValidation.ts](src/validation/taskCatalogValidation.ts)): catalog-level
    `duplicate_task_type_name`, `dangling_task_type_ref`, `task_camera_not_used`, and
    `task_definition_reconciled` — reconciled with (not duplicating) the existing inline
    `divergent_task_identity` rule. Exercised only by catalog-shaped fixtures; not yet wired into
    the live validation pipeline.
  - **Type surface** ([workspaceTypes.ts](src/state/workspaceTypes.ts)): optional `TaskType`,
    `TaskInstance`, and `TaskDefinitionReconciliation` shapes added without forcing runtime
    adoption; runtime readers stay tolerant of old inline `day.tasks`.

- **Responsive + copy hardening (Phase 8A-3).** Merge-neutral, display-only polish for the
  selective-testing path:
  - **Narrow-width Animal Days.** At phone widths (≤640px) the recording-day surface stacks into
    cards: the heading sits over its actions, the **Add Recording Days** primary action sits over
    the carry-forward toggle (which now gets the full row instead of a squeezed column), each day
    row becomes a stacked card with its date/description over its status, and the destructive
    **Delete day** action drops to its own row, divided from and no longer crowding the row's
    navigation card. (Browser-measured: desktop and 390px have no horizontal overflow and no
    overlapping controls — guarded by a new Playwright geometry spec.)
    ([AnimalWorkspace.css](src/pages/AnimalWorkspace/AnimalWorkspace.css)).
  - **Details on demand.** The Validation Summary's full "what gets exported" rules moved behind a
    collapsed *"What gets exported?"* disclosure so the Validate / Export actions and the counts
    stay visually dominant; the task-critical disabled-export reason stays inline.
    ([ValidationSummary/index.jsx](src/pages/ValidationSummary/index.jsx)). No export or schema
    change.

- **Recognition + accessibility hardening (Phase 8A-2).** Three merge-neutral, display-only fixes so
  users can recognize controls and operate the calendar by keyboard:
  - **Visible/accessible label parity.** The Animal Days "Add Recording Days" button no longer
    carries a hidden `aria-label` of "Show calendar" — its accessible name now equals its visible
    text, so screen-reader and voice-control users address it by what it says (`aria-expanded` still
    conveys open/closed). ([RecordingDaysTab.jsx](src/pages/AnimalWorkspace/RecordingDaysTab.jsx)).
  - **Human device-type summaries.** The opaque probe IDs in the electrode-group Device Type selector
    now display a recognition-friendly summary (e.g. `128c-4s8mm6cm-20um-40um-sl` →
    "128-ch, 4-shank, 8 mm (20/40 µm)") via a new pure `deviceTypeLabel`
    ([valueList.js](src/valueList.js)). The option **value** stays the exact probe ID (it keys into
    trodes_to_nwb probe-metadata filenames), so the exported YAML is unchanged.
  - **Calendar keyboard/a11y.** The month grid is now six weekly rows of seven cells (was one
    42-cell row), and uses a **roving tabindex** so Tab always reaches a cell — even on a month that
    does not contain today (it defaults to the first selectable day of the displayed month); the
    arrow keys move focus cell-to-cell. Existing-recording cells are `aria-disabled` (still focusable
    for continuous navigation) rather than removed from the grid.
    ([CalendarGrid.jsx](src/components/CalendarDayCreator/CalendarGrid.jsx),
    [CalendarDay.jsx](src/components/CalendarDayCreator/CalendarDay.jsx)). Resolves the Post-v3
    calendar-a11y follow-ups. No export or schema change.

- **Timeline-aware "Add Recording Days" calendar.** When an animal already has recording days, the
  calendar now opens on the month of the next likely recording day (the latest existing day + 1 — the
  same month for a mid-month latest day, the following month when the latest day ends a month) instead
  of wall-clock today. A 2023 study opened in 2026 lands on June/July 2023, not June 2026.
  **Today** remains an explicit jump in the calendar header. Pure helper `getInitialCalendarMonth`
  ([src/components/CalendarDayCreator/CalendarDayCreator.jsx](src/components/CalendarDayCreator/CalendarDayCreator.jsx)).
  No change to the exported YAML.
- **One shared day-lifecycle vocabulary** ([src/domain/dayLifecycle.js](src/domain/dayLifecycle.js))
  ends the contradictory recording-day status wording across surfaces. A day's status is now named
  once — **Draft → Ready to export → Validated → Exported**, plus **Needs fixing** for a live blocking
  issue — and the distinction between *live readiness* ("Ready to export": passes every check right
  now) and *persisted history* ("Validated"/"Exported": saved) is consistent on **Animal Days**,
  **Day Validation**, **Day Export**, and the **Validation Summary**. The Validation Summary per-day
  chip now consumes `day.state.validated`/`exported`, so a saved validation is visually distinct from a
  merely live-valid day (resolves the Post-v3 "persisted-Validated indicator" follow-up). A new shared,
  collapsible **legend** ([src/components/DayLifecycleLegend](src/components/DayLifecycleLegend))
  explains the status words once and is reused on Animal Days and the Validation Summary. Display-only:
  the exported YAML and golden baselines are byte-identical.

### Changed

- **Recording-day status wording is unified (display-only).** The Animal Days row that previously read
  **"Ready to export"** for a persisted-validated day now reads **"Validated"** (the saved fact);
  "Ready to export" is reserved for live readiness. The Validation Summary per-day chip that read a
  bare **"Valid"** now reads **"Ready to export" / "Validated" / "Exported"** by lifecycle. No export
  or schema change.

- **Design-token + CSS-Modules styling foundation.** Extended the `:root` token set in
  `src/index.css` with a grey-500, a radius scale (`--radius-sm/md`), a shadow scale
  (`--shadow-sm/--shadow-modal`), and a **z-index scale** (`--z-base` … `--z-skip-link`) that is now
  the single source of truth for stacking order. Stood up **CSS Modules** with one canonical,
  token-driven button primitive (`src/components/ui/Button`) replacing the divergent global
  `.button-*` color copies; migration of the rest is incremental. Added **stylelint**
  (`npm run lint:css`) enforcing tokens on `z-index`/`color`/`background-color` at warn-level. No
  change to the exported YAML.
- **Incremental TypeScript support (toolchain only; no runtime or export change).** `.ts`/`.tsx`
  now coexist with `.js`/`.jsx` (`tsconfig.json` with `allowJs`, `checkJs: false`, `strict`). A new
  `npm run typecheck` (`tsc --noEmit`) runs as its own CI job and is the **only** type-check — the
  Babel production build does not type-check. The pure YAML codec (`io/yaml`) and the workspace data
  model (`state/workspaceTypes`) are the first modules typed; the YAML codec's six exports are typed
  under `strict` with no logic change, and the golden baselines stay byte-identical. Linting,
  `lint-staged`, and the vitest transform were extended to handle `.ts`/`.tsx`.
- **Behavioral Events is now its own Day Editor tab.** The DIO channel grid moved out of the
  crowded **Tasks & Epochs** step into a dedicated **Behavioral Events** section in the day-editor
  nav (under "Recording"). It is optional — a day with no behavioral events badges as complete, not
  incomplete — and a duplicate name (Rule 14) or channel (Rule 17) now badges and routes its
  "Fix →" to this tab (as does the corrupt-shape reset control). Tasks & Epochs keeps the FsGUI
  DIO-output reference (which still reads the day's events). The exported YAML is unchanged.
- **Copy a behavioral-events (DIO) setup from another animal.** A blank first day (a new animal on
  the same rig) can reuse another animal's DIO mapping instead of re-keying it: when the day has no
  events and another animal has a set, the grid offers **"Copy from {animal} ({n} events)"**, which
  seeds this day from that animal's most-recent day (carry-forward then propagates it to later
  days). It reuses your own data — not a baked-in preset — and the CTA disappears once the day has
  events. The exported YAML is unchanged.

- **Behavioral-events (DIO) editor is now the ECU hardware channel grid.** The Day Editor
  presents every digital channel of the SpikeGadgets ECU — **Inputs `Din1–32`** and
  **Outputs `Dout1–32`** (the board's real range, verified against Trodes `.trodesconf`) —
  and you type the event name for the channels your rig uses on this day. Which channel
  carries which event is a per-experiment wiring choice, so there is no baked-in preset; the
  grid just mirrors the hardware. **A blank channel is unused and is excluded from the
  exported YAML** (the schema requires a non-empty name). **Event names must be unique** — a
  duplicate is flagged inline and blocks export (it would collide on the Spyglass
  `DIOEvents` primary key). A new day carries the previous day's names forward, so you fill
  the grid in once per experiment and edit only on a rewire. An imported event whose channel
  isn't a standard `Din`/`Dout` line is preserved in an **"Other"** group rather than
  dropped. The exported YAML shape (`behavioral_events: [{ description, name }]`, named
  events only) is unchanged.
- **Per-label auto-numbering when picking a behavioral-event name.** Picking a known name
  from a channel's suggestions appends the next per-label instance number — picking *Poke*
  with no pokes yet yields `Poke1`, the next `Poke2`, and *Light* is counted independently
  (`Light1`). The number uses the no-separator `Label<n>` convention (verified against real
  lab YAMLs) and is a **per-label instance count, not the DIO channel index** (a pump on
  `Dout7` is still `Pump1`). **Typing a name stays verbatim** — free text (e.g. `beam_break`)
  is never auto-numbered. A numbered variant the app itself generates (`Poke1`, `Light1`, …)
  is recognized as a standard name, so it does not trip the "not a standard event name"
  nudge — that fires only for genuinely off-list custom names.

### Removed

- **Removed the manual channel-maps editor (F1).** No one used it, and the exported
  `ntrode_electrode_group_channel_map` is generated automatically when an electrode group is saved
  with a device type — independently of any editor. The **Channel Maps** tab/route/nav entry and the
  editor (ChannelMapEditor / ChannelMapsStep / its container + CSV import-export) are gone. The
  electrode-groups surface now shows a read-only reassurance ("Channel maps are generated
  automatically from each electrode group's device type"), and channel-map (ntrode) validation issues
  route their "Fix" action to the **Electrode Groups** tab (the map's owner). Map auto-generation, the
  exported YAML, bad-channel marking, and the frozen legacy `ntrode/ChannelMap.jsx` are unchanged.
- **Retired the animal-level behavioral-events (DIO) library.** Behavioral events are
  now a single **day-owned** set (the only ones exported); the animal-level "library"
  authoring surface (the **DIO** tab in the Animal view) and the Day Editor's "Use on
  this day" inherited-copy path are removed, ending the confusing animal-vs-day split.
  Existing days keep their own events (no exported data is lost — export already reads
  `day.behavioral_events`). `animal.behavioral_events` is retained-but-unused (vestigial)
  in the persisted blob for compatibility; no workspace schema version bump. An old
  `#/animal/:id/dio` URL resolves to the animal's default tab. The exported YAML shape
  is unchanged.

### Fixed

- **Switching directly between two recording days no longer carries the prior day's field values.**
  The Day Editor is now remounted per routed day id, so a direct `#/day/A` → `#/day/B` change (e.g.
  browser back/forward between days) shows the new day's data — previously the Overview
  Session/Experiment Description fields could keep the prior day's text, and a later edit could
  write it into the wrong day. The same direct day→day change now also moves focus to the new day's
  main region and announces it (with the day id) to screen readers, so keyboard/SR users aren't
  stranded on the prior day's context.
- **Replace-importing onto an animal with a missing/empty hardware-configuration history now pins
  each day to the correct probe configuration.** A version-reservation race could duplicate
  configuration "version 1" during a replace import, silently pinning a reconfigured day to the
  initial probe geometry; configuration versions are now reserved from the freshly-created animal.
- **Importing a legacy/external YAML with optogenetics no longer silently drops the opto metadata.**
  Import detected optogenetics only from the compatibility `opto_software` key; a file with
  `optogenetic_stimulation_software` and populated opto sections (but no `opto_software`) imported as
  non-opto. Import now detects opto from any populated opto section or the stimulation-software key
  (a genuinely non-opto file still round-trips unchanged).
- **Importing a YAML whose `subject_id` isn't a valid animal id is now rejected with a clear reason**
  (the subject id is also the hash-route key, so a space / `?` / `#` would make the animal
  unreachable). The import names the file and the allowed characters (letters, numbers, hyphen,
  underscore) — matching what the create-animal form already requires — instead of creating an
  unreachable animal.
- **A corrupt persisted/imported `optogenetics` value no longer crashes the app.** The Optogenetics
  editor now treats a non-record opto value as OFF and tolerates malformed nested lists (degrading to
  an empty, editable form) instead of throwing and blanking the whole UI.
- **(Internal) The test-coverage CI gate is now actually enforced.** The thresholds were nested one
  level too shallow for the test runner (and so ignored); they are now armed against production
  source, so a coverage regression fails CI.
- **Day Validation tab no longer reads "Ready to export" while Export is actually blocked.** The
  per-day Validation summary computed its issue list and readiness without the animal's other days,
  so a day that silently un-fails an earlier same-configuration bad channel (the bad-channel
  *monotonicity* block) showed no error and read as ready, even though the Export step correctly
  blocked the download and its acknowledge-repair was unreachable from the summary. The summary now
  receives the same cross-day context the Export gate uses, so the two always agree.
- **A recording-system catalog with the same device name but divergent hardware is now caught at
  export.** The Spyglass device-identity rule only saw the single device the export merge resolves,
  so two same-named `data_acq_device` catalog entries with different system/amplifier/adc_circuit
  (from a hand-edited or imported workspace) slipped past the gate; it is now validated against the
  raw animal catalog and surfaced as a repairable Animal-Setup error.
- **The export download filename is now locale-independent** (`toLowerCase`, not
  `toLocaleLowerCase`), so the same metadata yields the same `{date}_{subject_id}_metadata.yml` on
  every machine regardless of OS locale. The YAML contents are unchanged.
- **Persistence hardening (no behavior change for a healthy save).** The one-time bad-channel
  base→day migration no longer re-runs on every autosave — it is a load-time concern, so its
  idempotency is no longer a load-bearing invariant of the hot write path (the migration still runs
  on load). A transient autosave failure now gets one bounded automatic retry before falling back to
  the existing save-error indicator + unsaved-work guard.
- **The workspace header is now a single app bar; the logo and keyboard-shortcuts trigger no longer
  collide with the navigation (F3).** The banner's desktop `position: fixed` pulled it out of flow, so
  the primary nav slid up underneath and the logo + shortcuts overlapped it. The workspace routes now
  render one app-bar row — logo (left), primary nav, keyboard-shortcuts trigger (right) — which at
  narrow widths drops the nav to its own row beneath the logo + shortcuts. The frozen legacy route
  keeps its original fixed banner with the logo + shortcuts grouped. The banner also carries
  `var(--z-banner)` from the new z-index scale as defense-in-depth. Browser-verified at desktop and
  narrow widths and guarded by an e2e spec.
- **Recording days now stay date-ordered (F2).** `createDay` and `duplicateDay`
  previously appended to the stored `animal.days` index without sorting, so a day
  added or duplicated out of chronological order left the index unordered. The
  stored array is now canonically sorted by `date` (ascending, ISO `YYYY-MM-DD`)
  on write, so every reader sees days in chronological order. The exported YAML is
  unchanged.
- **DIO `description` types restricted to the valid digital I/O lines (`Din`/`Dout`).**
  The Type dropdown previously also offered `Accel`/`Gyro`/`Mag`, but those are
  **analog** IMU channels, not digital I/O — a DIO `description` is looked up against
  the `.rec` `ECU_digital` stream during conversion (trodes_to_nwb
  `get_digitalsignal("ECU_digital", …)`), so an analog value would fail that lookup.
  An existing analog `description` no longer crashes the editor: the Type control
  degrades gracefully to `Din` while preserving the parsed line index. The exported
  YAML shape is unchanged. Note: in the legacy single-page form, opening an imported
  event whose `description` is analog (e.g. `Accel2`) and blurring the field rewrites
  it to its `Din`/`Dout` fallback (`Din2`), because that form's control is
  uncontrolled and falls back to the first valid option when the stored one is gone.
- **New behavioral events no longer save an empty `description`.** A freshly-added
  event is now seeded to the default DIO line (`Din1`) so the stored value matches
  what the guided Type/Index controls display. Previously the controls showed
  `Din`/`1` for a new event while the model held an empty string, so saving without
  touching them persisted an empty `description` (which fails the downstream
  `ECU_digital` lookup).

### Changed

- **Versioned forward-migration for the persisted workspace (mechanism only; no behavior change
  yet).** The persistence layer previously *discarded* a localStorage blob whose `schemaVersion` it
  didn't recognize. It now upgrades old blobs **forward** through an ordered registry of pure
  migrators (`src/state/workspaceMigrations.js`, `migrators[n]: vN → vN+1`), applied by
  `migrateWorkspace` in `loadWorkspace` before device-normalization and shape-ensuring, so a future
  persisted-shape change won't throw away saved work. Today's v1→v2 handling is encoded as the first
  registered migrator (current blobs hydrate byte-for-byte as before), and `MIGRATABLE_SCHEMA_VERSIONS`
  is now derived from the registry instead of hand-maintained. No persisted-shape change or version
  bump ships in this entry — the mechanism lands ahead of the first real shape change, which will
  register its own `vN→vN+1` migrator plus a checked-in `vN` blob fixture. (Resolves the release-gated
  persistence-migration follow-up.)
- **Tasks & Epochs screen — clarity redesign (no data-model or export change).** The day editor's
  most-complex screen now opens with a plain-language framing that defines a *task* (one activity
  in one environment, with its cameras) and an *epoch* (a numbered time block of that task, each
  belonging to exactly one task). Decorative emoji are gone, and the glyph status badges (✓/⚠/❌)
  are replaced with token-colored **text labels** — the one badge that overloaded two problems is
  split into distinct "Needs epochs" and "Missing camera" labels (an error like a reused epoch or a
  missing required field reads as text, too). The optional, epoch-linked editors — associated
  videos, associated files, and FsGUI protocols — are now collapsible sections (an empty one is
  collapsed to reduce noise; a section that already holds data stays open so it is never hidden),
  each showing an item count, preceded by a one-line note that they reference a task's epochs and
  that editing or deleting a referenced task asks you to confirm before the link is cleared (so the
  repair dialog is expected, not a surprise). Add-button labels and section heading levels are
  normalized. `day.tasks` and the exported YAML are unchanged (golden baselines byte-identical), and
  the redesigned step has zero automated-accessibility (axe) violations.
- **Day Editor structural refactor (internal; no behavior or export change).** Extracted the day
  device-override merge — the override > snapshot resolution AND the matching "can this override
  be honored cleanly?" shape classification — into one pure module
  (`src/domain/deviceOverrideMerge.ts`) that both the export path (`resolveDayConfig`) and the
  validator (`dayOverrideIssues`) build on, so the two can no longer drift in how they read a day's
  `deviceOverrides`. Introduced a `DayEditorContext` so the day-editor sections read the shared
  per-day bundle (animal, day, merged metadata, the field-update writer, …) from context instead of
  having the same seven props drilled through every section. Golden baselines are byte-identical and
  the day-validation contract is unchanged.
- **Behavioral-event name suggestions are now direction-specific.** Verified against the
  98-file corpus, every recorded event splits cleanly by direction, so a **Din** (input)
  channel now suggests only `Poke` / `Run_Camera_Ticks` and a **Dout** (output) channel only
  `Light` / `Pump` — offering an output name on an input channel (or vice versa) implied a
  physically wrong wiring. The off-list nudge follows suit (a pump named on an input channel
  is flagged). Names that never appear in real data (`Home box camera`, `Sleep`) are no longer
  suggested; `Run Camera Ticks` → `Run_Camera_Ticks` matches the corpus spelling. Free text is
  unaffected and the exported YAML shape is unchanged. (The non-validating `examples` array in
  `nwb_schema.json` still lists the old forms — co-owned with trodes_to_nwb, left for a
  coordinated cross-repo change.)
- **Recording-day dates are validated as ISO `YYYY-MM-DD` on write.** `createDay`
  and `duplicateDay` now reject a non-ISO date, since the date-ordered index relies
  on `YYYY-MM-DD` sorting lexicographically as chronological (the date picker already
  enforces this; the guard covers programmatic callers).

### Added

- **Off-list combobox warning is now linked to its input** via `aria-describedby`
  (merged with any caller-provided value), so screen readers associate the
  standard-options nudge with the field.

- **Accessible suggestion combobox** (`SuggestionCombobox`). An editable combobox
  (WAI-ARIA "combobox with list autocomplete") that replaces the native
  `<datalist>`: opening it browses the **full** suggestion list even after a value
  is chosen (the datalist collapsed to the single match), typing filters, free
  entry is retained, and it supports keyboard navigation. An optional off-list
  nudge encourages standard values.
- **Behavioral-event name suggestions.** The event **Name** field is now this
  combobox, offering the catalog of common names (`Home box camera`, `Poke`,
  `Light`, `Pump`, `Run_Camera_Ticks`, `Sleep`) and warning when a non-standard
  name is entered. Free entry is retained; the stored value is unchanged.
- **Off-list warning for brain regions.** The brain-region autocomplete
  (`BrainRegionAutocomplete`, used in the Electrode Group editor) now uses the same
  combobox and warns when a region is not one of the standard options — reinforcing
  the existing CA1-vs-ca1 canonicalization that keeps Spyglass queries consistent.
