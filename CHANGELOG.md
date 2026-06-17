# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Guided create-animal wizard.** Creating a new animal from scratch is now a seven-step guided
  setup — Identity → Electrodes → Cameras → Optogenetics → Tasks → Recording system → Team — instead
  of a single long form. Identity (the subject) is committed through `createAnimal` on the first
  advance, then each setup step edits the live animal through the **same** Animal-View setup
  containers (electrode groups, cameras, optogenetics, task types, recording system) — no
  reimplementation. Identity reuses the DANDI predicates (Latin-binomial / NCBI species, no-slash
  subject id) and the case-insensitive uniqueness check; the optogenetics step shows the
  all-or-nothing "Opto configured · N of 4" meter; electrodes offers a behavior-only skip. "Save
  draft" leaves a valid-but-partial animal; finishing lands on the new animal's days. The wizard also
  offers "Import a YAML…" and "Copy from another animal…" as start options that route to the existing
  entry points. Exported YAML is unchanged — animal creation moves no export bytes (the golden
  baselines stay byte-identical).
- **Export preview — the day's export surface.** The day editor's Export action now opens an
  export-preview screen: an issue-driven readiness gate (quiet "✓ Ready to export" when clean; a loud
  "N issues block export" listing each blocking issue with a field-linked "Fix in …" route when not),
  the derived download filename, and a read-only preview of the **real export bytes**
  (`encodeYaml(mergeDayMetadata(animal, day))` — never an approximation). **Download** and **Copy** are
  BOTH gated while blocking — both emit the YAML, so Copy is not a way around the gate — and each emits
  a success toast ("✓ Downloaded {filename}" / "✓ YAML copied"). The gate is the authoritative
  `validateDay`/export gate (`vm.export`) every other readiness surface already reads — no new gate
  logic. A new **"Export all {N} days"** batch reuses the shared `exportDayFile` core (same
  parity/skip semantics as "Export Valid Only" — not a second exporter) and reports "Exported N ·
  Skipped M", each skipped day linked to its blocking issue via the same field-level repair route as
  the single-day gate. (A valid day that still carries a non-blocking *warning* is not shipped
  unacknowledged by the batch; it is skipped and linked to the per-animal Validation & Export surface,
  which owns the acknowledgement flow — matching the animal Days-tab quick export.) Replaces the
  transitional `ExportStep` (the per-day download moves off the DayEditor header panel onto this
  surface).
- **Epoch grid — the day editor's spine.** The Epochs tab is now a per-epoch grid: one row per epoch
  joining the day's tasks + statescript/video files + opto schedule (columns #, Task, Camera(s),
  Statescript, Video(s), Opto mW, Pulse ms, Status), with a per-epoch drill-in (What happened /
  Generated files / Optogenetics), an epoch ⋯ menu (insert / duplicate / move / delete-with-undo), and
  a "+ from template" starter menu (Sleep day / W-track day / Copy structure from a prior day / Blank).
  It is a pure join-view (`buildEpochGrid`) + pure write-back transforms (`epochOperations`) over the
  day's existing arrays — storage and **exported YAML are unchanged** (the golden baselines stay
  byte-identical). A reorder or delete that would strand a bound file/video reference confirms first
  (never silently scrubbing). Replaces the transitional Tasks &amp; Epochs step; the leaf sub-editors it
  superseded (`AssociatedVideosEditor`, `AssociatedFilesEditor`, `TaskInstancesTable`, `FsGuiSection`,
  `TaskInstanceModal`) are now unused and slated for removal in a follow-up.
- **Per-epoch filename derivation + a day data folder.** Statescript / video filenames derive from the
  `{YYYYMMDD}_{subject}_{epoch:02d}_{tag}` convention inside the day's data folder (`day.dataFolder`,
  set on the Day tab); the drill-in shows each file as `generated` (derived) or `manual` (overridden),
  with Override / Revert. Derivation is additive — it reproduces the values the export already stored,
  and existing/imported files keep their explicit paths (`manual`).
- **Video declaration (the one new validation rule).** Each task epoch must either bind a video or be
  explicitly marked "no video recorded" (the video 3-state: present / missing / absent). An undeclared
  videoless epoch is a blocking readiness issue (`epoch_video_undeclared`) and the row reads "Needs
  video". The "no video" declaration is stored off-export (`day.state.videolessEpochs`), so it never
  reaches the YAML and cannot move a baseline. **Known consequence:** because the declaration lives in
  `day.state` (not the YAML), a previously-valid day with legitimately video-less epochs that is
  *re-imported from YAML* (or arrives via a state-losing transfer) will flag those epochs until they
  are re-affirmed as "no video" in the grid — the exported YAML is unchanged; only the readiness gate
  is stricter.
- **Shared redesign primitives (internal — no user-facing behavior yet).** A small, tested kit of
  CSS-Module + design-token components that the day/animal editor redesign builds on: `StatusPill`
  (a renderer over the existing `dayLifecycle` vocabulary — it coins no new status words) and its
  sibling `EpochStatusPill` (the epoch-row scope: `Complete` / `Incomplete` / `Needs video`),
  `UndoToast` + the `useUndoToast` host hook (reversible-action confirmation), `BlastRadiusChip`
  ("affects all N days"), `GeneratedValue` (derived-vs-manual file value), `AnimalScopeCard` (the
  read-only animal-static scope boundary), and `ReadinessBar` (issue-driven export readiness, a pure
  renderer of issues it is handed). Shipped with unit + `jest-axe` accessibility tests; not yet wired
  into any screen.

### Changed

- **Day editor: a new frame with day chips, an issue-driven readiness bar, and a four-tab body.** The
  day editor's six-section stepper chrome is replaced by `DayEditorFrame`: a header carrying the
  Workspace › Animal › Day breadcrumb, the date title, day chips (configuration version · an opto
  badge · "↩ carried from &lt;date&gt;" · the lifecycle `StatusPill`), the autosave indicator, the
  read-only `AnimalScopeCard` (the animal-static scope boundary, summarized from the animal
  view-model), and the issue-driven `ReadinessBar` — fed the authoritative `validateDay` output, so
  it never re-checks readiness locally. The body is a four-tab bar — **Day / Epochs / Failed channels
  / DIO** — with free navigation and `Alt+←/→`. The former `OverviewStep`, `DevicesStep`, and
  `BehavioralEventsStep` are folded into the **Day**, **Failed channels**, and **DIO** tabs
  respectively and removed; `TasksEpochsStep` is kept as the **Epochs** tab bridge (the epoch grid
  lands in a later phase); `ValidationStep`/`ExportStep` are retained until the export-preview screen
  arrives (the readiness bar replaces the inline Validation step, and a transitional header **Export**
  action reveals the kept Export step). The **DIO** tab opens on a read-only carry-forward summary
  (Din/Dout in two columns, "carried from &lt;date&gt; · unchanged") and reveals the full ECU channel
  editor only on "Edit · rewired the rig"; collision gates reuse the existing
  `duplicateBehavioralEvent*` helpers. **No change to exported YAML.**

- **Day editor: a per-day data folder.** The **Day** tab adds an editable `Data folder` field (the
  directory on disk where this day's recording files live). It is set once and carried forward to the
  next same-block day (`createDayRecord`). The field is **off-export** — `mergeDayMetadata` never
  reads `day.dataFolder`, so the YAML is byte-identical (no schema bump; the golden baselines are
  unchanged). Per-epoch filename derivation inside the folder lands in a later phase.

- **Animals home: the animal picker is now a disambiguating table.** Each animal is a row with its
  genotype, species, recording-day count, last recording date, an `opto` tag, and a rolled-up day
  status (e.g. "1 ready" / "2 need review" / "All exported" — computed via the SAME export gate the
  day editor reads, never a separate recount). Each name is a real link to the animal's days. A
  client-side search + genotype/status filters narrow the (small) list. The load/recovery notice
  continues to be surfaced globally (by the app shell). Create / import / delete / edit-profile keep
  their existing behavior. No change to exported YAML.

- **Animal page: the recording-days list is now a multi-select table, and the animal-static setup
  surfaces name their re-export blast radius.** The Days tab renders a table with a checkbox column +
  select-all, a contextual bulk bar ("N selected · Export selected · Delete"), real date + chevron
  links, the status via the shared `StatusPill`, and a per-row ⋯ menu (Open / Duplicate / Export this
  day / Delete). **Per-day delete is now undo-able** (it deletes immediately and offers Undo, which
  re-creates the day) rather than a hard confirm dialog — the catastrophic *animal* delete keeps its
  type-to-confirm. **"Export selected"** reuses the same per-day export/parity path the Validation
  Summary uses (no second exporter), showing an inline "Exported N · Skipped M" result with each
  skipped day linked to its issue. The animal-static sections that force affected days to re-export —
  Identity, Cameras, Optogenetics — carry a `BlastRadiusChip` ("Affects all N days"); the Optogenetics
  tab adds an "Opto configured · N of N" completeness meter; and committing one of those edits surfaces
  the consequence "N already-exported days now need re-export". The Electrode Groups configuration card
  gains a **"New configuration…" (re-implant)** action — an effective-date + copy-from-current modal
  that forks a new configuration version (days from that date forward move to it; earlier days keep
  theirs) through the existing reconfiguration action. No change to exported YAML.

- **Migrated the build tool from Create React App (`react-scripts`) to Vite — behavior-preserving;
  the app remains a client-side SPA on GitHub Pages.** CRA was deprecated (Feb 2025). The repo was
  already half on Vite (Vitest), so this consolidated the two toolchains into one `vite.config.ts`
  that drives both the app build and the test lane.
  - `vite.config.ts` (former `vitest.config.js` merged in + app build config): conditional `base`
    (`/rec_to_nwb_yaml_creator/` for the production build, `/` for dev so Playwright is unaffected),
    `build.outDir: 'build'` (keeps `gh-pages -d build` + the CI artifact path), dev/preview port 3000.
  - `index.html` moved `public/` → repo root (Vite entry) with a module `<script src="/src/index.tsx">`.
  - `process.env.NODE_ENV` → `import.meta.env.MODE` (ErrorBoundary); `react-app-env.d.ts` references
    `vite/client`; scripts: `start`/`build` → `vite`, added `preview`.
  - **Bug fixed in the move:** `schemaValidation.ts` used `const Ajv = require('ajv')` (CommonJS),
    which webpack tolerated but Vite (native ESM) does not — it crashed the app to a blank root with
    `require is not defined`. Converted to `import Ajv from 'ajv'`. It was the only `require()` in source.
  - **ESLint gate:** CRA's `CI=true react-scripts build` treated warnings as errors; Vite's build does
    not run ESLint, so that strictness moved to a `lint:ci` script (`eslint --max-warnings 0`) wired into
    the CI lint job (whole-repo scope — stricter than CRA). Fixed the 7 pre-existing warnings it surfaced.
  - Verified each phase: typecheck, full suite (4787), `vite build`, the production bundle rendering with
    zero console errors served exactly as GitHub Pages does, and e2e (104).

### Removed

- **Retired the one-shot `AnimalCreationForm` as the from-scratch create entry.** The guided
  create-animal wizard replaces it everywhere (the Home `#/home` route, the Animals home's
  "+ New animal", and the top selector's "+ New animal…"); the inline create panel on the Animals
  home and the `#/workspace?create=1` handshake are gone (the selector now routes to `#/home`). The
  component and its tests are deleted, and its identity validation moved into the pure
  `createAnimalWizardViewModel` (which still reuses the shared `buildAnimalFromForm` glue, so every
  entry builds an identical animal). The lower-level field components and `domain/animalCreation` are
  kept.
- **Retired the Day Editor's `ExportStep` and `ValidationStep`.** The Phase-3 readiness bar already
  replaced the inline Validation step's role, and the new export-preview surface replaces Export — so
  both components (and their tests) are removed. The single-day export gate is unchanged (it lives in
  the shared `vm.export` / `validateDay` gate the new surface reads); the per-day export's "preflight
  summary" is replaced by the read-only YAML preview (the real bytes the user is about to download).
- **Removed `react-scripts` and its ~927-package transitive tree (CRA toolchain — webpack, Babel, Jest).**
  Promoted to direct deps what react-scripts had provided transitively but the project still needs:
  `eslint` + `eslint-config-react-app` (the `.eslintrc.js` `"react-app"` preset; same versions, no behavior
  change), and `ajv-formats` (imported in source). Removed the `eject` script. `.npmrc legacy-peer-deps`
  is left in place for now — its removal (no longer forced by react-scripts' TS peer pin) is a separate
  follow-up that needs a clean `npm ci` validation.

- **Deleted dead code `src/components/rawPropTypes.ts` + its test.** The tolerant custom PropTypes
  validators (`rawArray`/`rawRecord`) were used only by repair-destination components that dropped
  PropTypes when they became TypeScript, leaving the module orphaned (only its own test imported it).
  No live or legacy source referenced it. `npm run typecheck` + `CI=true` build clean; full suite
  green (4787, −6 from the removed test).

### Changed

- **Live TypeScript migration COMPLETE — the entire live app is now TypeScript; only the frozen legacy single-page form (slated for deletion) remains `.jsx`/`.js` — cycles 15–16.**
  A post–app-root audit found live (non-legacy) JS the page-by-page conversion had missed; cycles 15–16
  finish it (all refactor-only, behavior-preserving):
  - **Cycle 15 (live glue / barrels):** `components/Modal/index.ts`, `components/ShortcutsHelp/index.ts`,
    `pages/DayEditor/stepGate.ts` (pure re-export barrels — no content change); `pages/DayEditor/validation.ts`
    (the page-local on-blur `validateField` wrapper, typed `mergedData: ValidationModel`); `components/rawPropTypes.ts`
    (tolerant custom PropTypes validators, typed via a `RawValidator` alias + erased delegate casts — this file is
    orphaned, only its own test imports it, and is a deletion candidate).
  - **Cycle 16 (live components):** the whole `components/CalendarDayCreator/` subtree (`CalendarDayCreator` +
    `CalendarGrid` + `CalendarDay` + `CalendarHeader` + `CalendarLegend`) and `components/DayLifecycleLegend/`.
    Props→interfaces; PropTypes/defaultProps dropped (defaults preserved as destructure defaults); JSDoc trimmed;
    the date-select callback typed `(date: string, event: { shiftKey: boolean }) => void` across the three files
    (the consumer reads only `shiftKey`); `useRef<HTMLButtonElement>` roving-focus chain; `(error as Error).message`
    in the create-days catch (byte-identical to the original `error.message`); the exported pure `getInitialCalendarMonth`
    keeps its malformed-input tolerance with a `string[]` param.
  After these cycles, **every live `.js`/`.jsx` under `src/` is TypeScript**; the only remaining JS is the legacy
  form path (`useLegacyForm`, `LegacyFormView`, `element/*`, `*Fields.jsx`, `OptogeneticsFields`, `ChannelMap`, the
  legacy-only hooks/glue, and the legacy-exclusive `ArrayUpdateMenu`/`HintDisplay`) plus test files. `npm run typecheck`
  and `CI=true` build clean; golden baselines, the affected suites with the 3 source-scanning guards, full suite (4793),
  and e2e (104) pass each cycle; code-reviewer found no ≥80-confidence issues on the component cycle.
- **Typed the app root — `App.js`/`index.js`→`.tsx`, `setupTests.js`→`.ts` (refactor only, behavior-preserving) — cycle 14.**
  The React entry (`index`), the root component (`App`), and the global Vitest setup (`setupTests`).
  Dropped stray `import React`; `createRoot(document.getElementById('root') as HTMLElement)` (the
  `#root` mount is guaranteed by `public/index.html`); the in-memory `localStorage` polyfill's
  params are typed (`key: string`, `value: string`, `index: number`) over a `Map<string, string>`.
  Added a `declare module 'jest-axe';` shim to `src/react-app-env.d.ts` (jest-axe ships no types and
  there is no `@types/jest-axe`, so a `.ts` setup file importing `toHaveNoViolations` would fail
  TS7016). `vitest.config.js` `setupFiles` + coverage excludes updated `.js`→`.ts`/`.tsx`;
  react-scripts auto-detects `src/index.tsx` as the build entry. `npm run typecheck` and `CI=true`
  build clean; full suite (4793, exercising `setupTests.ts` globally) + e2e (104) pass.
- **Typed `pages/AnimalView` + `layouts/AppLayout` — all 3 files `.jsx`→`.tsx` (refactor only, behavior-preserving) — page cycle 13. `pages/` and `layouts/` are now 100% TypeScript.**
  The tabbed animal shell (`pages/AnimalView/index`, `ConfigVersionContext`) and the app routing
  layout (`layouts/AppLayout`). Props→interfaces; the pure helpers (`shouldInterceptNavDiscard`,
  `renderPanel`) got typed context interfaces (`NavDiscardContext`/`RenderPanelContext`); PropTypes
  dropped; JSDoc trimmed; stray `import React` removed. Behavior-equivalent non-type changes only:
  `tabIndex={-1}` (was `'-1'`, DOM-identical, 3 sites); `panelRef = useRef<HTMLElement>(null)` and
  `querySelectorAll<HTMLElement>` / `querySelector<HTMLElement>` (erased generics) for the `?field=`
  repair-highlight DOM walk; `useState<string | null>`; `getAnimalBlockingSections(animal as Animal, …)`
  in the pre-not-found-guard `useMemo` (the callee has its own `if (!animal)` guard, so the cast is
  runtime-sound); `useMemo<Record<string, string> | null>` for `sectionCounts` (the object-spread of
  `Object.fromEntries` drops its index signature, so the annotation restores `[item.key]` indexing —
  every value is provably a string). AppLayout's workspace destructure stays maximally faithful to the
  original per-key defaults via `const { animals = {}, days = {} } = model?.workspace ?? {}` (`??` is
  value-identical to the original `||` for a never-falsy `Workspace` object — no cast). `AnimalView`
  props typed required (`{ animalId: string; tab: string }`) to match its sole caller (AppLayout, from
  the `Record<string,string>` route params). `npm run typecheck` and `CI=true` build clean (net +18 B);
  golden baselines, AnimalView + AppLayout suites with the 3 source-scanning guards, full suite 4793,
  e2e 104 all pass. code-reviewer: no findings ≥80 confidence; its one sub-50 note (the AppLayout
  destructure) was adopted (cast removed in favor of the faithful per-key-default form).
- **Typed `pages/Home` + `pages/AnimalWorkspace` — all 9 files `.jsx`→`.tsx` (refactor only, behavior-preserving) — page cycle 12.**
  Home (`AnimalCreationForm`, `index`) and the workspace pane pieces (`AnimalSetupCard`,
  `DuplicateDayModal`, `ExistingDataReview`, `DayList`, `ImportYamlDialog`, `RecordingDaysTab`, `index`).
  Props→interfaces; PropTypes/defaultProps dropped; JSDoc trimmed; stray `import React` removed.
  `domain/animalCreation` gained `export` on `AnimalCreationFormData` so Home/workspace type their
  create handlers against it. Behavior-equivalent non-type changes only: tolerant-boundary casts
  (`… as unknown as Animal/Day`, `record as Record<string, unknown>` in the non-dangling day branches,
  `rec.date as string | undefined`); `(today.getTime() - dob.getTime())` (Date arithmetic, value-
  identical); `tabIndex={-1}` (was `'-1'`, DOM-identical); `?? undefined` where a `null`-when-closed
  prop meets a `?:`-typed dialog (`AnimalDeleteDialog`) and where a repair-ctx `animal` is read only
  for its id; `.filter((x): x is string => Boolean(x))` type-guards. The copy-from-animal ntrode
  normalize stays POINT-FREE via a function-signature cast — preserving the original `.map`'s 3-arg
  call exactly (a 2-arg rewrite would have changed the corrupt-input `fallbackGroupId` from the array
  to `0`; the latent point-free quirk is left untouched, not "fixed", to keep the migration runtime-
  identical). `npm run typecheck` and `CI=true` build clean (net ≈0 B); golden baselines, Home +
  AnimalWorkspace suites with the 3 source-scanning guards, full suite 4793, e2e 104 all pass.
  code-reviewer surfaced the ntrode-map point-free subtlety (now preserved exactly); no other findings.
- **Typed the `pages/ValidationSummary` directory — all 7 files `.jsx`/`.js`→`.tsx`/`.ts` (refactor only, behavior-preserving) — page cycle 11.**
  The pure row-builder/display helpers (`validationSummaryRows`), the batch-action controller hook
  (`useValidationSummaryActions`), and the presentational pieces (`ExportReport`, `EffectiveDayReview`,
  `BatchExportPreflight`, `DayStatusTable`, `index`). Props→interfaces; PropTypes/defaultProps dropped;
  JSDoc trimmed. This surface works with TOLERANT corrupt-shape-resistant data (`Record<string,unknown>`
  / `unknown`) but calls STRICT domain functions (`mergeDayMetadata(animal: Animal, day: Day)`,
  `checkShadowExport`), so the only non-type changes are behavior-equivalent tolerant-boundary casts:
  `… as unknown as Animal/Day` at the strict calls; `day.id as string` (ids/dates are strings at runtime);
  `isRecord(workspace) && isRecord(workspace.x)` replacing `isRecord(workspace?.x)` (identical for a
  non-object workspace); `.filter((d): d is Day => Boolean(d))` type-guards (runtime-identical to
  `.filter(Boolean)`); `configurationVersion ?? undefined` (buildPreflightSummary treats null/undefined
  alike); `tabIndex: -1` (was `'-1'`, DOM-identical). `components/WarningAcknowledgement` widened its
  item `warnings` `message` to optional (honest — the source `RepairableIssue.message` is optional; the
  render tolerates it). `npm run typecheck` and `CI=true` build clean (+12 B); golden baselines,
  ValidationSummary suites with the 3 source-scanning guards, full suite 4793, e2e 104 all pass.
  code-reviewer found no behavior-changing defects.
- **Typed the `pages/AnimalEditor/wiring` container tier — the 5 store-bound containers + 3 hooks `.jsx`/`.js`→`.tsx`/`.ts`; `pages/AnimalEditor` is now 100% TypeScript (refactor only, behavior-preserving) — page cycle 10.**
  `CamerasContainer`, `ElectrodeGroupsContainer`, `OptogeneticsContainer`, `RecordingSystemContainer`,
  `TaskTypesContainer` (the store→section wiring) plus `useAnimalAlert`, `useAnimalFieldUpdate`,
  `useKnownRegions`. Each gets a typed props interface; runtime PropTypes/defaultProps dropped; JSDoc
  trimmed; stray `import React` removed. Three already-typed cycle-9 files gained small consumer-forced
  edits: `cameraIdentityChanged` widened to accept `Camera` (and `CAMERA_IDENTITY_FIELDS` →
  `(keyof Camera)[]`); `ElectrodeGroupInput`/`ElectrodeGroupSaveData`/`CopyPayload` got `export` so the
  containers can type their save/copy handlers against them. Behavior-equivalent non-type changes only:
  `setEditingGroup(group ?? null)` (a find-miss stores null vs undefined — both falsy in the modal's
  `mode==='edit' && group` gate); `handleCopyConfirm` destructures `electrode_groups = []` (dead
  defensive default — this host always supplies the section); `editingGroup as unknown as
  ElectrodeGroupInput` bridges the canonical `ElectrodeGroup` to the editor's region-string input shape;
  `.filter((d): d is Day => Boolean(d))` type-guards (runtime-identical to `.filter(Boolean)`);
  `parseInt(String(g.id), 10)`; `!`/`as keyof Camera` reads inside callbacks. `npm run typecheck` and
  `CI=true` build clean (−18 B); golden baselines, AnimalEditor suites with the 3 source-scanning guards,
  full suite 4793, e2e 104 all pass. code-reviewer found no behavior-changing defects.
- **Typed the `pages/AnimalEditor` LARGE leaf tier — the 10 presentational components plus the pure `identitySafety` identity-drift hub `.jsx`/`.js`→`.tsx`/`.ts` (refactor only, behavior-preserving) — page cycle 9.**
  The first AnimalEditor cycle: `identitySafety` (re-exports `findIdentityDivergence` plus the
  `IdentityDivergence`/`IdentityRegistryEntry` types), `CameraReferenceDialog`, `CamerasSection`,
  `ElectrodeGroupsStep`, `TaskTypesSection`, `TaskTypeModal`, `CameraModal`, `ElectrodeGroupModal`,
  `DataAcqSection`, `OptogeneticsStep`, `CopyFromAnimalDialog`. Each gets a typed props interface;
  runtime PropTypes/defaultProps dropped (each non-undefined default preserved as a destructure
  default); JSDoc trimmed; stray `import React` removed. One shared-vocabulary fix:
  `workspaceTypes.Camera.camera_name` `?: number` → `?: string` — a latent type bug (the schema, the
  form default, and every typed reader treat it as a string), which unblocks the identity-registry
  name typing. Behavior-equivalent non-type changes only: `TaskTypeModal.onSave` reuses the canonical
  `TaskTypeDefinitionInput` so it stays compatible with its one typed cross-dir consumer
  (`DayEditor/TasksEpochsStep`); `ElectrodeGroupModal` keeps LOCAL input/form/save types whose
  `targeted_location` is a region string (faithful to the original PropTypes, deliberately diverging
  from canonical `ElectrodeGroup`); `OptogeneticsStep` narrows the tolerant-`unknown` opto block via
  an `optoRecord` intermediate and swaps `enabled`-to-`opto` truthiness gates (provably equivalent:
  `enabled === (opto !== null)`); erased casts (`!` after guards, `field as keyof X` index reads,
  `parseInt(String(id), 10)`, `camera.camera_name as string`) preserve exact runtime. No
  source-scanning-guard surgery (no `code:` literals, no raw qualified reads). `npm run typecheck` and
  `CI=true` build clean (−98 B from PropTypes removal); golden baselines, AnimalEditor suites with the
  3 source-scanning guards, full suite 4793, e2e 104 all pass.
- **Typed the DayEditor orchestrator `DayEditorStepper` + route entry `index` `.jsx`→`.tsx` — the entire `pages/DayEditor` directory is now TypeScript (refactor only, behavior-preserving) — page cycle 8.**
  `DayEditorStepper` is the provider of the `DayEditorContext` bundle every step consumes; it resolves
  the day/animal/owner-key from the store, builds the typed `DayEditorBundle` value, and owns the
  field-update / repair / subject-update handlers and the dynamic section render. Drop runtime
  PropTypes; trim JSDoc. Behavior-equivalent non-type changes only: the dynamic
  `<CurrentStepComponent>` is cast to `ComponentType<StepSectionProps>` (the active step reads its
  shared bundle from context, so the render passes only the section-specific props — the cast drops
  each step's required-bundle-prop contract); the assembled repair context is cast
  `as unknown as RepairCommandContext` (preserving the exact runtime values — store actions + possibly
  -null ids — that `applyRepairCommand` tolerates by no-op'ing the absent surface); the bundle value
  casts `mergedDay`/`actions`/`animalKey` to their bundle types (`mergedDay` keeps its null
  fail-closed value, which every section guards with `|| {}`); `dayId`/`ownerKey` (`string | null`)
  are cast `as string` at the index/selector/write sites that keep the null runtime value (selectors
  return `[]`, indexes miss to `undefined`) or sit behind a resolved-owner invariant; the dynamic
  path-write clones the day as `Record<string, unknown>`; `querySelectorAll<HTMLElement>` makes
  `.focus()`/`.classList` callable; `tabIndex="-1"` → `tabIndex={-1}` (DOM-identical). `index`'s
  unused `dayId` prop became `_props: DayEditorProps`. `npm run typecheck` + `CI=true` build clean
  (+5 B); golden baselines, the DayEditor suites + the 3 source-scanning guards + the emoji guard
  pass; full suite 4793; e2e 104.
- **Typed the 2 HEAVY `pages/DayEditor` Tier-2 step components `DevicesStep` + `TasksEpochsStep` `.jsx`→`.tsx` (refactor only, behavior-preserving) — page cycle 7.**
  Both read all seven shared fields from `useDayEditorContext(props)` with no section-specific props, so each is typed
  `props: DayEditorBundle` directly. Runtime PropTypes/defaultProps dropped; JSDoc trimmed; the bad-channel / task-catalog
  handlers, the orphan-repair helpers, and the modal/quick-add/pending-repair state got typed signatures + state
  interfaces. Behavior-equivalent non-type changes only: `DevicesStep` casts the loose bundle `actions`
  (`Record<string, unknown>`) to the now-exported `ReconfigActions` for `<ConfigVersionPanel>` and `day` to
  `Record<string, unknown>` for `<OverrideCleanupSection>`, casts `group?.device_type as string` at the two badChannels
  domain calls (which tolerate undefined), and adds `if (version == null) return null` to the `reconfig` memo — unobservable
  because a `null` configuration version occurs only on the configError path, which early-returns before the panel renders
  (it narrows the version to the `number` the panel contract requires). `TasksEpochsStep` casts the loose `actions.updateAnimal`
  to its call signature and `day` to `Record<string, unknown>` for `<MalformedCollectionNotice>`. The `ReconfigActions`
  interface gained an `export`; the no-emoji guard's `GUARDED_FILES` entry was updated `TasksEpochsStep.jsx` → `.tsx` to
  track the rename. `npm run typecheck` + `CI=true` build clean; golden baselines, the DayEditor suites + the 3
  source-scanning guards + the emoji guard pass; full suite 4793; e2e 104.
- **Typed the 4 `pages/DayEditor` Tier-2 "display" step components `.jsx`→`.tsx` (refactor only, behavior-preserving) — page cycle 6.**
  `BehavioralEventsStep`, `ValidationStep`, `OverviewStep`, and `ExportStep` → `.tsx`. Each step's props now `extends
  DayEditorBundle` (so `useDayEditorContext(props)` — whose fallback param is the full bundle — typechecks) plus its
  section-specific extras (`copyableDioSources?`; `onNavigate?`/`onRepair?`; `onSubjectUpdate?`/`focusRequest?`).
  `BehavioralEventsDisplay`'s local `CopyableDioSource` interface was exported so `BehavioralEventsStep` can type its
  forwarded prop. Runtime PropTypes/defaultProps dropped (non-undefined defaults preserved as destructure defaults:
  `copyableDioSources = []`, `onNavigate = () => {}`, `onSubjectUpdate = () => {}`, `focusRequest = null`); JSDoc trimmed.
  Behavior-equivalent non-type changes only: `day as unknown as Record<string, unknown>` at the two
  `MalformedCollectionNotice` sites (a clean `Day` interface has no index signature, but is a valid input to that
  tolerant corrupt-shape reader); `{mergeError && …}` → `{Boolean(mergeError) && …}` (an `unknown` truthiness gate →
  `ReactNode`); `rows="3"` → `rows={3}` and `aria-describedby={… : null}` → `: undefined` (DOM-identical); a `keyof
  typeof DAY_LIFECYCLE_LABEL` dynamic-index cast; `onNavigate!` where a `repairable` guard proves it. One `ValidationStep`
  test that asserted the removed `defaultProps` was rewritten to assert the actual contract (a render with `animal`
  omitted does not throw). `npm run typecheck` + `CI=true` build clean (−70 B); golden baselines, the DayEditor suites +
  the 3 source-scanning guards + the emoji guard pass; full suite 4793; e2e 104.
- **Typed the 5 `pages/DayEditor` Tier-1 components `.jsx`→`.tsx` and widened two source-scanning guards to cover the TS source (refactor only, behavior-preserving) — page cycle 5.**
  `ConfigVersionPanel` (`reconfig`/`actions` typed to match the now-`.tsx` `ReconfigWizard`), `ElectrodeGroupsAccordion`
  (`ElectrodeGroup[]`/`NtrodeMap[]`/`Record<string, number[]>` props), `RepairActions` (`RepairableIssue` params; a local
  `RepairCommand` cast for the `unknown` `repairCommand`; `navTarget as string`), `TaskInstanceModal`, and `TaskModal` (the
  task form — guarded optional chains, a `meters_per_pixel as number | string` cast preserving a corrupt-empty-string
  guard, `TaskResult` payload type) → `.tsx`. `ReadOnlyDeviceInfo`'s group prop was widened from its cycle-3 local guess to
  the canonical `ElectrodeGroup & { units?: string }` (the real shape its consumer passes). Runtime PropTypes/defaultProps
  dropped (non-undefined defaults preserved as destructure defaults); JSDoc trimmed.
- **Two source-scanning guards now scan the TypeScript source.** The migration converted enough `.jsx`/`.js` that both
  guards' vacuous-pass floors (`expect(files.length).toBeGreaterThan(100)`) tripped (98 / 97 scanned). The
  `architectureBoundaries.guard` walk was widened `.jsx?` → `.jsx?|tsx?` (its classifier was already extension-agnostic),
  restoring the count (98 → 236) and extending the import-boundary contract to `.ts`/`.tsx`. The `workspaceSelectors.guard`
  walk was widened to `.ts`/`.tsx` with its definer/detector exemptions made extension-agnostic (`workspaceSelectors`/
  `deviceNormalization`/`domain/validation` now match `.ts`), plus three born-`.ts` raw-shape detectors/producers added to
  the exemption (`state/taskCatalog`, `state/taskCatalogMigration`, `domain/stepStatus` — they DETECT/PRODUCE canonical
  shape, like the existing `deviceNormalization` exemption). Both are strengthenings: the converted `.tsx` consumers are
  now actively guarded and pass. `npm run typecheck` + `CI=true` build clean; golden baselines, the DayEditor suites + the
  3 source-scanning guards + the emoji guard pass; full suite 4793; e2e 104.

- **Typed the 4 COMPLEX `pages/DayEditor` React components `.jsx`→`.tsx` (refactor only, behavior-preserving) — page cycle 4; the DayEditor leaf tier is now complete.**
  `DayEditorContext` (the React Context provider — `createContext<DayEditorBundle | null>(null)`, a new exported
  `DayEditorBundle` interface, typed `DayEditorProvider` props, `useDayEditorContext(fallbackProps): DayEditorBundle`),
  `TaskEpochsEditor` (`useRef<Array<HTMLInputElement | null>>` + `useRef<number | null>`, `useState<EpochRow[]>`, a
  computed-key `as EpochRow` cast), `BehavioralEventsDisplay` (the DIO grid — `Map<string, BehavioralEvent>`, `GROUPS`/
  `renderGroup`/`renderNameField` tightened to the `'Din' | 'Dout'` literals), and `BadChannelsEditor` (the 520-LOC
  multi-shank editor — `NtrodeMap[]` / `Record<string, number[]>` props, a typed `PendingUnmark` state, `useState`
  generics) → `.tsx`. Runtime PropTypes/defaultProps dropped (non-undefined defaults preserved as destructure defaults,
  e.g. `errors = {}`, `initialEpochs = []`); JSDoc trimmed. Behavior-equivalent non-type changes only: `BadChannelsEditor`
  guards its optional `onBatchUpdate?.()` (only reached in the multi-shank branch, where the parent always provides it)
  and casts `deviceType as string` at three domain calls that declare `deviceType: string` (erased; the fns tolerate
  undefined); `BehavioralEventsDisplay`'s `onDayEventsChange` becomes a required prop (the dead `null` default dropped —
  the body always calls it). The `tasksEpochs.noEmoji.guard` test list was updated (`BehavioralEventsDisplay.jsx` → `.tsx`)
  to track the rename. `npm run typecheck` + `CI=true` build clean; golden baselines, the DayEditor suites + the 3
  source-scanning guards + the emoji guard pass; full suite 4793; e2e 104.

- **Typed 12 more LIVE `pages/DayEditor` React leaf components `.jsx`→`.tsx` (refactor only, behavior-preserving) — page cycle 3.**
  `KeywordsEditor`, `DayRecordingSystem`, `TaskInstancesTable`, `AssociatedVideosEditor`, `AssociatedFilesEditor`,
  `FsGuiSection`, `TasksTable`, `DayTechnicalSection`, `CamerasUsedSection`, `OverrideCleanupSection`, `ReconfigWizard`,
  and `ReadOnlyDeviceInfo` → `.tsx`. Props become typed interfaces; runtime PropTypes/defaultProps dropped (non-undefined
  defaults preserved as destructure defaults, e.g. `catalog = []`, `technical = {}`); component JSDoc trimmed to
  descriptions; the unused default `import React` dropped from `DayRecordingSystem`/`FsGuiSection` (JSX-only, react-jsx).
  Editor row shapes use local interfaces that deliberately diverge from the canonical types (the empty-string-sentinel
  reality: `VideoRow`/`FileRow` `camera_id`/`task_epochs` are `number | string`; `FsGuiItem` is a distinct shape from
  `FsGuiYaml`). The only non-type-token changes are behavior-equivalent: two guarded optional chains
  (`mergedDay?.tasks`, `overridesRecord?.[key]` — both reached only when the value is provably defined) and erased casts
  on computed-key spreads / a narrowing-resistant indexed-access ternary. `OverrideCleanupSection`'s `day` is typed
  `Record<string, unknown>` (assignable to `classifyDeviceOverrides`); `DayTechnicalSection` reuses `Partial<TechnicalParameters>`/
  `Partial<TechnicalDefaults>` (the exact `resolveRigConstant` param types). The `tasksEpochs.noEmoji.guard` test's
  hardcoded file list was updated (`TasksTable.jsx` → `.tsx`) to track the rename and keep the emoji guard covering the
  file. `npm run typecheck` + `CI=true` build clean; golden baselines, the DayEditor suites + the 3 source-scanning
  guards + the emoji guard pass; full suite 4793; e2e 103 pass + 1 pre-existing hash-router timing flake (unrelated).

- **Typed 3 more LIVE `pages/DayEditor` React leaf components `.jsx`→`.tsx` (refactor only, behavior-preserving) — page cycle 2.**
  [pages/DayEditor/IssueOwnershipHint.jsx](src/pages/DayEditor/IssueOwnershipHint.tsx) (`issue?: RepairableIssue | null`,
  the exact param type of the `ownershipForIssue` it forwards to — a type-only import from `domain/repairRouting`),
  [pages/DayEditor/MalformedCollectionNotice.jsx](src/pages/DayEditor/MalformedCollectionNotice.tsx) (`day?:
  Record<string, unknown> | null`; the one non-annotation change is `day[f.key]` to `day![f.key]` — an erased non-null
  assertion guarded at runtime by the preceding `isRecord` check, so byte-identical for `null`/`[]`/corrupt-field/`{}`
  inputs), and [pages/DayEditor/DayEditorSectionNav.jsx](src/pages/DayEditor/DayEditorSectionNav.tsx) (`stepStatus:
  Record<string, StepStatus>` — the arbitrary-`item.id`-indexed map, reusing the canonical `StepStatus` union; helpers
  retyped `(status: StepStatus): string`, `default:` branches preserved) to `.tsx`. Runtime PropTypes/defaultProps dropped
  (the only defaults were `null`/`undefined`, becoming optional props, behavior-equivalent); component JSDoc trimmed to a
  description. `npm run typecheck` + `CI=true` build clean; golden baselines, the leaf suites + repairability matrix (206),
  and the 3 source-scanning guards pass; full suite 4793; e2e 103 pass + 1 pre-existing hash-router timing flake
  (unrelated — a type-only change cannot alter runtime navigation).

- **Typed the first 4 LIVE `pages/` React leaf components `.jsx`→`.tsx` (refactor only, behavior-preserving) — the first page cycle.**
  [pages/DayEditor/Breadcrumb.jsx](src/pages/DayEditor/Breadcrumb.tsx) (`BreadcrumbItem`/`BreadcrumbProps`),
  [pages/DayEditor/ReadOnlyField.jsx](src/pages/DayEditor/ReadOnlyField.tsx) (`value=''` default preserved from
  the dropped `defaultProps`), [pages/DayEditor/SaveIndicator.jsx](src/pages/DayEditor/SaveIndicator.tsx)
  (`persistence?: Partial<PersistenceStatus> | null` — type-only import of the canonical persistence type), and
  [pages/DayEditor/ErrorState.jsx](src/pages/DayEditor/ErrorState.tsx) → `.tsx`. Two type-required changes, both
  behavior-equivalent: `SaveIndicator`'s `Date.now() - new Date(iso)` became `…- new Date(iso).getTime()` (TS rejects a
  `Date` as a `-` operand; `.getTime()` is value-identical to the implicit `valueOf()`, NaN-case included), and
  `ErrorState`'s `tabIndex="-1"` became `tabIndex={-1}` (TS types `tabIndex` as `number`; React renders the identical
  `tabindex="-1"`). Runtime PropTypes/defaultProps dropped for the typed interfaces; component JSDoc trimmed to a
  description. `npm run typecheck` + `CI=true` build clean (bundle −8 B); golden baselines, the leaf suites +
  `DayEditorStepper` consumer (229), and the 3 source-scanning guards pass; full suite 4793; e2e 104.

- **Typed 3 LIVE animal-dialog components `.jsx`→`.tsx` (refactor only, behavior-preserving) — component cycle 4.**
  [components/AnimalDeleteDialog.jsx](src/components/AnimalDeleteDialog.tsx) (type-to-confirm delete; the one
  non-annotation change is erased boundary casts on the `getAnimalDeleteCascade(animalId as string, animal as Animal,
  days as Record<string, Day>)` call — NOT `??`-coalesced, so the function receives identical runtime values),
  [components/AnimalProfileDialog.jsx](src/components/AnimalProfileDialog.tsx) (subject-facts editor — local `ProfileForm`
  type; `onSave: (changedFields: Partial<ProfileForm>) => void`), and
  [components/AnimalSwitcher.jsx](src/components/AnimalSwitcher.tsx) (the object-selector disclosure popup — roving-focus
  refs typed `Array<HTMLElement|null>`, `indexOf(document.activeElement as HTMLElement|null)` preserves reference
  equality) → `.tsx`. Runtime PropTypes/defaultProps dropped (the `days = {}` default preserved as a destructure
  default); unused default `import React` dropped. **The component leaf + shared/dialog tiers are complete; only the
  `pages/**` + `layouts/AppLayout` + `App.js` remain.** `npm run typecheck` + `CI=true` build clean (bundle −42 B);
  golden baselines, the dialog suites + consumers (200), and the 3 source-scanning guards pass; full suite 4793; e2e 104.

- **Typed 4 LIVE Tier-2 React components `.jsx`→`.tsx` (refactor only, behavior-preserving) — component cycle 3.**
  [components/Modal/ConfirmDialog.jsx](src/components/Modal/ConfirmDialog.tsx) (`title`/`message: ReactNode`),
  [components/ShortcutsHelp/ShortcutsHelp.jsx](src/components/ShortcutsHelp/ShortcutsHelp.tsx) (kept `import React`
  for `<React.Fragment>`), [components/AlertModal.jsx](src/components/AlertModal.tsx) (`AlertType` union;
  `message: ReactNode` widens the old PropTypes `string` — can't break a string-passing caller), and
  [components/BrainRegionAutocomplete.jsx](src/components/BrainRegionAutocomplete.tsx) (`canonicalizeRegion(value:
  string, knownRegions: string[])`; typed `memo` comparator) → `.tsx`. Each is a thin wrapper over the now-typed
  `Modal`/`SuggestionCombobox`. Runtime PropTypes/defaultProps dropped (non-undefined defaults preserved as destructure
  defaults); the unused default `import React` dropped where the component has no `React.` reference (JSX uses
  `react-jsx`). `npm run typecheck` + `CI=true` build clean (bundle −32 B); golden baselines, the component suites +
  consumer (ElectrodeGroupModal, 272), and the 3 source-scanning guards pass; full suite 4793; e2e 104.

- **Typed 4 more LIVE leaf React components `.jsx`→`.tsx` (refactor only, behavior-preserving) — component cycle 2.**
  [components/RawCorruptionBanner.jsx](src/components/RawCorruptionBanner.tsx) (`animal`/`day` typed `unknown` to
  match `validateRawAnimal`/`validateRawDay`; `onRepair?: (issue: RawShapeIssue) => void`; one `issue.repairCommand!`
  assertion justified by the preceding `.filter(... && issue.repairCommand)`),
  [components/ReconfigurationContextBanner.jsx](src/components/ReconfigurationContextBanner.tsx) (local `RouteContext`
  prop shape; `getConfigHistory` takes `unknown`), [components/WarningAcknowledgement.jsx](src/components/WarningAcknowledgement.tsx)
  (`WarningAcknowledgementItem[]`), and the editable combobox [components/SuggestionCombobox.jsx](src/components/SuggestionCombobox.tsx)
  (`SuggestionComboboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value'|'onChange'|'onKeyDown'|'onBlur'|'onSelect'>`
  so custom-signature props win and `...inputProps` spreads onto `<input>`; `inputRef` as a callback-or-`MutableRefObject`
  union; `useRef`/`useState` generics; portal/keyboard/off-list logic byte-identical) → `.tsx`. Runtime PropTypes dropped
  for the typed interfaces; non-undefined `defaultProps` preserved as destructure defaults (`value=''`/`suggestions=[]`/
  `required=false`/`warnOffList=false`); behavior-equivalent erased casts only (`e.relatedTarget as Node|null`). `npm run
  typecheck` + `CI=true` build clean (bundle −79 B); golden baselines, the component suites + consumers
  (BrainRegionAutocomplete/AnimalView/ReconfigWizard, 281), and the 3 source-scanning guards pass; full suite 4793; e2e 104.

- **Typed 4 LIVE leaf React components `.jsx`→`.tsx` and added the standard `react-app-env.d.ts` (refactor only, behavior-preserving) — the first component cycle.**
  [components/ui/Button.jsx](src/components/ui/Button.tsx) (the token-driven button primitive —
  `ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>`), [components/ErrorBoundary.jsx](src/components/ErrorBoundary.tsx)
  (class component — `Component<ErrorBoundaryProps, ErrorBoundaryState>`, `getDerivedStateFromError`/`componentDidCatch`
  typed with `Error`/`ErrorInfo`), [components/Modal/Modal.jsx](src/components/Modal/Modal.tsx) (the accessible dialog —
  focus-trap / ESC / overlay-click / scroll-lock, `useRef<HTMLDivElement|null>`, `querySelectorAll<HTMLElement>`), and
  [components/OverflowMenu.jsx](src/components/OverflowMenu.tsx) (the WAI-ARIA menu-button — `OverflowMenuItem`/`OverflowMenuProps`,
  roving-focus refs, keyboard handlers) → `.tsx`. Runtime PropTypes dropped in favor of the typed prop interfaces
  (prod-stripped; `react/prop-types` doesn't fire on a typed component); behavior-equivalent erased casts only
  (`document.activeElement as HTMLElement|null`, `e.target as HTMLElement`/`Node|null`). Added
  [src/react-app-env.d.ts](src/react-app-env.d.ts) (the CRA-standard file, previously missing) so `.tsx` components
  type-check their CSS imports: it references `react-scripts` (which declares `*.module.css`/`*.module.scss`) and adds
  bare `declare module '*.css'`/`'*.scss'` for side-effect stylesheet imports. All `element/*` and `*Fields.jsx`
  components are legacy-only and remain `.jsx` (skipped). `npm run typecheck` + `CI=true` build clean (bundle +9 B);
  golden baselines, the component suites (Button / ErrorBoundary / Modal + its consumers / OverflowMenu, 326), and the
  3 source-scanning guards pass; full suite 4793; e2e 104.

- **Typed `utils/deviceNormalization.js` (the corruption-preserving "Normalization Contract", 646 LOC) under strict TS (refactor only, value-identical).**
  [utils/deviceNormalization.js](src/utils/deviceNormalization.ts) is the device-shape normalizer plus the
  one-time bad-channel base→day migration; it is golden-baseline-relevant (its output flows into export).
  Helpers (`parseExactInteger`/`cleanString`/`toFiniteNumber`/`normalizeNumberList`/`normalizeMap`) are typed
  `unknown`-in / `unknown`-out — honest about corruption preservation; `isPlainObject` is a
  `value is Record<string, unknown>` guard. The 5 `.ts`-consumed public normalizers return the canonical
  workspace types (`DeviceConfiguration`/`ElectrodeGroup`/`NtrodeMap`/`DeviceOverrides`/`Record<string, unknown>`)
  via documented `as unknown as` TOLERANT-BOUNDARY casts, so the consumers (`workspaceUtils`/`workspaceTransitions`/
  `workspaceHydration`/`persistence`) keep compiling unchanged. Behavior-equivalent transforms only (every one an
  erased cast or a provably-equal restructure): two `Object.hasOwn` → `Object.prototype.hasOwnProperty.call` swaps
  (the lib is ES2020), three cast-based local extractions (`rawName` / `rawHistory`+`dayVersion` / `overridesBag`)
  replacing `?.` chains on `unknown`, and a few erased `as` casts on template/index expressions. Proven by a
  temporary deep-compare of EVERY export across clean + corrupt + migration inputs, then deleted. With this typed,
  the live non-component glue layer is complete. `npm run typecheck` + `CI=true` build clean (bundle +2 B); golden
  baselines, the deviceNormalization/badChannelMigration suites, and 3 source-scanning guards pass; full suite 4793;
  e2e 104; code-reviewer-verified (independent 268-check parity harness, 0 failures).

- **Typed 3 live glue modules under strict TS — `featureFlags`, `features/importYaml`, root `utils` (refactor only, behavior-preserving).**
  [featureFlags.js](src/featureFlags.ts) (feature-flag registry + `isFeatureEnabled`/`overrideFlags`; the
  `FLAGS` object body is byte-identical, so the `shadowExportStrict`/`shadowExportLog` export-integrity gate
  is unchanged), [features/importYaml.js](src/features/importYaml.ts) (the live workspace YAML-import parse
  helper `parseImportFiles`), and root [utils.js](src/utils.ts) (`useMount`/`titleCase`/`isNumeric`/
  `showCustomValidityError`/`stringToInteger`/`isProduction` + the `stringFormatting` re-exports) → `.ts`.
  Behavior-equivalent transforms, each an erased cast (runtime no-op): `(element as HTMLInputElement)` after
  the `tagName === 'INPUT'` guard in `showCustomValidityError`; `FLAGS[featureName as keyof typeof FLAGS]`
  after the `in`-guard; and `(error as Error)?.message ?? String(error)` in `importYaml`'s catch blocks —
  kept (not `instanceof Error`) so the duck-typed `.message` read is byte-identical. Root `utils.js` had ZERO
  `.ts` consumers, so nothing tightens. Deferred (legacy-only): `features/importExport.js` (consumed only by
  `LegacyFormView.jsx`), `utils/errorDisplay.js`, `utils/labelFormatters.js`. `npm run typecheck` + `CI=true`
  build clean (bundle unchanged); golden baselines, the targeted suites (featureFlags 41, importYaml,
  utils.test), and the 3 source-scanning guards pass; full suite 4793; e2e 104.

- **Typed 7 LIVE React hooks under strict TS (refactor only, behavior-preserving).**
  [hooks/useStableId.js](src/hooks/useStableId.ts) (stable form-element ids),
  [hooks/useDayIdFromUrl.js](src/hooks/useDayIdFromUrl.ts) (day id from hash),
  [hooks/useUnsavedWorkGuard.js](src/hooks/useUnsavedWorkGuard.ts) (`beforeunload` guard),
  [hooks/useReconfigContext.js](src/hooks/useReconfigContext.ts) (reconfig route-context parser),
  [hooks/useHashRouter.js](src/hooks/useHashRouter.ts) (hash routing — `parseHashRoute`/`RouteInfo`),
  [hooks/useGlobalShortcuts.js](src/hooks/useGlobalShortcuts.ts) (app keyboard shortcuts), and
  [hooks/stepperShortcuts.js](src/hooks/stepperShortcuts.ts) (the stepper-shortcut event bridge) → `.ts`.
  Hook generics typed (`useRef<string | null>`, `useState<RouteInfo>`, `useState<string | null>`); DOM
  event params typed (`KeyboardEvent`, `BeforeUnloadEvent`, `CustomEvent`); new local interfaces
  `RouteInfo`/`ReconfigContext`/`ShortcutHandlers`. Five behavior-equivalent transforms, each a runtime
  no-op or provably equal: a `movedDays !== null &&` relational-null guard (`null > 0` is already `false`),
  three erased casts/non-null assertions (`(event as CustomEvent)`, `(animalTabMatch || animalNoTabMatch)!`,
  `stableIdRef.current!`), and an `e.target as HTMLElement | null` call-site cast. Deferred (consumed ONLY by
  `useLegacyForm.js`, so they die with the legacy form): `hooks/useArrayManagement.js`,
  `hooks/useElectrodeGroups.js`, `hooks/useFormUpdates.js`. `npm run typecheck` + `CI=true` build clean;
  golden baselines + the 4 targeted hook suites + 3 source-scanning guards (258) pass; full suite 4793; e2e 104.

- **Typed 5 pure leaf `utils/` modules under strict TS (refactor only, behavior-preserving).**
  [utils/dioDescription.js](src/utils/dioDescription.ts) (DIO `description` split/join),
  [utils/stringFormatting.js](src/utils/stringFormatting.ts)
  (`isInteger`/`sanitizeTitle`/`formatCommaSeparatedString`/`commaSeparatedStringToNumber`),
  [utils/deviceTypeUtils.js](src/utils/deviceTypeUtils.ts)
  (`getDeviceTypes`/`getChannelCount`/`getShankCount`/`validateDeviceType`),
  [utils/channelMapUtils.js](src/utils/channelMapUtils.ts)
  (`generateChannelMapsForGroup`/`generateAllChannelMaps`/`nextNtrodeId`), and
  [utils/behavioralEventSet.js](src/utils/behavioralEventSet.ts)
  (`nextInstanceNumber`/`isStandardEventName`/`setChannelName`) → `.ts`. All five are pure leaves (no DOM,
  no React) — the first non-component glue cycle. `deviceTypeUtils` params are typed `unknown` (matching the
  `probeCatalog` convention; the two `.ts` consumers `validation/rules/electrodeGroupRules` and `channelMapRules`
  pass `group?.device_type` straight through). `channelMapUtils` returns the canonical `NtrodeMap[]` and gains a
  tolerant local `ElectrodeGroupInput` (`id: number | string`); its ONLY runtime-token change is two
  behavior-equivalent `parseInt(String(id), 10)` wraps (`parseInt` already string-coerces its first arg —
  independently verified value-identical). `behavioralEventSet.setChannelName` keeps its now-dead
  `typeof name !== 'string'` runtime guard so behavior is unchanged. Deferred: the legacy-only
  `utils/labelFormatters.js` (slated for deletion with the legacy form) and the DOM/`utils.js`-coupled
  `utils/errorDisplay.js`. `npm run typecheck` + `CI=true` build clean; golden baselines + the 4 targeted util
  suites + `utils.test` + 3 source-scanning guards (354) pass; full suite 4793; e2e 104.

- **Typed the pure `ntrode/` catalog + the `domain/validation` barrel under strict TS, and tightened the `dayRecovery` consumer (refactor only, behavior-preserving).**
  [ntrode/probeCatalog.js](src/ntrode/probeCatalog.ts) (the verified per-shank electrode-id catalog —
  `getProbeMetadata`/`getProbeShanks`/`getProbeElectrodeIds`/`isProbeCatalogConsistent`, now with `ProbeShank`/
  `ProbeMetadata` interfaces and `Record<string, ProbeMetadata>` for the catalog; the PROBE_CATALOG data incl. the
  UNEVEN 64c-3s 21/21/22 partition is byte-identical) and [ntrode/deviceTypes.js](src/ntrode/deviceTypes.ts)
  (`deviceTypeMap`/`getShankCount`) → `.ts`; all `deviceType` params typed `unknown` (each routes through
  `getProbeMetadata`'s `typeof !== 'string'` guard). [domain/validation.js](src/domain/validation.ts) (the
  re-export barrel) → `.ts` — a pure rename (diff is empty; value re-exports are extension-agnostic), completing
  the `domain/` migration (**`domain/` is now 25 .ts / 0 .js**). The 3 already-typed probeCatalog consumers
  (`badChannels`, `validation/rules/electrodeGroupRules`, `validation/rules/channelMapRules`) now receive real
  types instead of `any` and stay green. Also tightened [domain/animalDeleteCascade.ts](src/domain/animalDeleteCascade.ts):
  dropped the 4 `(d: any)` casts (its `classifyAnimalDays` rows now infer `DayClassificationRow`). Typecheck and the
  `CI=true` build are clean; golden baselines + ntrode/validation/cascade tests + 3 source-scanning guards (341) pass;
  full suite 4793; e2e 104.

- **Split + typed the legacy `valueList.js` (~1122 LOC) into 6 focused TS modules + a compatibility barrel (refactor only, value-identical).**
  The catalog/default values that feed the form, dropdowns, and the export moved out of one ~1122-LOC file into
  [defaults.ts](src/defaults.ts) (`defaultYMLValues`/`emptyFormData`/`arrayDefaultValues`),
  [deviceCatalog.ts](src/deviceCatalog.ts) (`device`/`dataAcqDevice*`/`cameraManufacturers`/`deviceTypeLabel`/`deviceTypes`/`units`),
  [subjectCatalog.ts](src/subjectCatalog.ts) (`genderAcronym`/`genders`/`labs`/`genotypes`/`species`),
  [locations.ts](src/locations.ts) (the brain-region list), [dioCatalog.ts](src/dioCatalog.ts)
  (`behavioralEventsNames`/`behavioralEventsDescription`), and [optoCatalog.ts](src/optoCatalog.ts)
  (`optoExcitationModelNames`/`opticalFiberModelNames`/`virusNames`). [valueList.js](src/valueList.ts) becomes a
  thin compatibility **barrel** (`export *` from the 6) so all 36 existing `from '.../valueList'` importers keep
  working unchanged. (A 6th module `subjectCatalog.ts` beyond the plan's 5 names holds the subject/lab catalogs
  that fit none of device/dio/opto/locations/defaults.) The data blocks were extracted **byte-for-byte** (no
  re-typing of the ~300-entry `labs`/`locations` arrays); only 3 type annotations were added —
  `deviceTypeLabel(id: unknown): string`, `behavioralEventsNames(direction?: string): string[]`, and
  `DEVICE_TYPE_LABEL_OVERRIDES: Readonly<Record<string, string>>` (so the runtime-narrowed `id` can index it);
  the form-default object literals are left inferred (no `.ts` consumer imports valueList, so the inferred
  `never[]` on empty arrays constrains nothing). A temporary runtime deep-compare proved every export — objects,
  function results, `behavioralEventsNames` across all directions, and `deviceTypeLabel` across every device type
  and edge input — `toEqual`s the pre-split module, with identical export key sets. `npm run typecheck` + `CI=true`
  build clean; golden baselines + value-specific tests (deviceTypeLabel / behavioralEventNames / optoCatalogNames /
  schema-device-type-sync / dioDescription) + 3 source-scanning guards (267) pass; full suite 4793; e2e 104.

- **Typed the `domain/` workflow/readiness layer (5 modules) under strict TS (refactor only, behavior-preserving).**
  [domain/sectionStatus.js](src/domain/sectionStatus.ts) (per-section nav status + animal blocking-section
  attribution), [domain/dayRecovery.js](src/domain/dayRecovery.ts) (the `DAY_STATUS` recovery classifier —
  `classifyAnimalDays`/`classifyWorkspaceDays`/`dayHasArtifacts`), [domain/workflowCategories.js](src/domain/workflowCategories.ts)
  (`CATEGORY_BY_CODE` + `workflowCategoryForIssue`/`groupIssuesByWorkflowCategory`),
  [domain/workflowOwnership.js](src/domain/workflowOwnership.ts) (the ownership-pattern descriptors +
  `ownershipForIssue`/`ownershipForFieldPath`/`ownershipForSection`), and
  [domain/workflowStatus.js](src/domain/workflowStatus.ts) (`getAnimalSetupChecklist`/`getDayRowStatus`/`getDayWorkflowStatus`)
  → `.ts`. Boundary types follow precedent: `unknown`-in for the shape-safe readers (`isRecord` type-guards),
  `ValidationModel` (= `Record<string, any>`) for the merged-model day inputs (`workflowStatus`), canonical
  `Animal`/`Day` where `mergeDayMetadata` is called (`sectionStatus.getAnimalBlockingSections`), and the
  closed-enum tables typed `Readonly<Record<string, X>>` (matching their original `@type`). Behavior-equivalent
  transforms (each commented): `dayRecovery`'s `record?.state` → `isRecord(record) ? record.state : undefined`
  and two `isRecord(workspace?.x)` → `isRecord(workspace) && isRecord(workspace.x)`; `workflowStatus`'s
  `Boolean(mergedDay)` → `mergedDay != null` (TS-narrowing), `computeStepStatus(day, mergedDay!, …)` (the
  `firstBlockingReason`-returned-null invariant guarantees non-null), and `.filter((area): area is SetupArea =>
  Boolean(area))`; the established `[issue?.code as string]` index casts and `byCategory.get(category)!` (guarded
  by the preceding `has`/`set`). **One supporting type-only fix in the already-typed
  [domain/stepStatus.ts](src/domain/stepStatus.ts):** `interface StepStatusMap` → `type StepStatusMap` so it
  carries an implicit string index signature and is assignable to the export gate's `Record<string, string>`
  param (`stepGate.isExportEnabled`) — a latent incompatibility the conversion exposed (never type-checked while
  `workflowStatus` was `.js`); purely type-level, runtime unchanged. None of the 5 emit `code:` literals, so the
  `workflowOwnership` `emittedCodesIn` floor is unaffected (`workflowOwnership` itself is converted and re-scanned).
  `npm run typecheck` + `CI=true` build clean; golden baselines + targeted tests + 3 source-scanning guards (293)
  pass; full suite 4793; e2e 104. **This completes the `domain/` migration except the `validation.js` barrel —
  `domain/` is now 24 .ts / 1 .js.**

- **Typed 6 pure `domain/` utility modules (batch 2b) under strict TS (refactor only, behavior-preserving).**
  [domain/badChannels.js](src/domain/badChannels.ts) (the bad-channel converter semantics: probe-wide
  toggle / later-row migration / invalid-mark interpretation),
  [domain/badChannelMonotonicity.js](src/domain/badChannelMonotonicity.ts) (`priorBadChannels` /
  `badChannelRegressions` / `getBadChannelRemovalAcks` — the cross-day monotonic contract),
  [domain/shadowExport.js](src/domain/shadowExport.ts) (`checkShadowExport` pre-download encoder-stability
  check), [domain/animalCreation.js](src/domain/animalCreation.ts) (`buildAnimalFromForm` /
  `getDefaultExperimenters`), [domain/preflightSummary.js](src/domain/preflightSummary.ts)
  (`buildPreflightSummary` export-readiness rows), and
  [domain/dayValidationComposer.js](src/domain/dayValidationComposer.ts) (`validateDay` — the authoritative
  per-day issue list) → `.ts`. Boundary types follow the established precedent: `unknown`-in for the
  tolerant shape-safe readers (`isRecord` is now a type-guard in `badChannelMonotonicity`),
  `ValidationModel` (= `Record<string, any>`) for the merged-model inputs (`validateDay.day/mergedDay`,
  `buildPreflightSummary.merged`), and canonical `Animal`/`Day`/`WorkspaceSettings` where load-bearing
  (`checkShadowExport`, `animalCreation`). Four small **behavior-equivalent** transforms (each commented):
  `getBadChannelRemovalAcks`'s `day?.state` → `isRecord(day) ? day.state : undefined` (param is now
  `unknown`), `buildPreflightSummary`'s `warningCount` gains a `= 0` destructure default
  (`0 > 0 === undefined > 0`), `normalizeIssue`'s `next: Record<string, unknown>` (so `delete next.repairStep`
  is legal) + `return next as RepairableIssue`, and `translateLaterRowMarks`'s `map` local widened to
  `Record<string, number | null | undefined>` (keeps the `=== undefined || === null` fallback live under
  strict). `validateDay`'s only typed consumer (`stepStatus.ts`) stays green untouched — `groupErrorsByStep`
  already wants `RepairableIssue[]`. No `code:` literals moved, so the `workflowOwnership` `emittedCodesIn`
  floor is unaffected. `npm run typecheck` + `CI=true` build clean; golden baselines + targeted tests + 3
  source-scanning guards (241) pass; full suite 4793; e2e 104. **`domain/` is now 19 .ts / 6 .js.**

- **Typed `domain/dayLifecycle` + `domain/deviceOverrides` under strict TS (refactor only, behavior-preserving).**
  [domain/dayLifecycle.js](src/domain/dayLifecycle.ts) (the lifecycle vocabulary enums +
  `lifecycleForValidDay`) and [domain/deviceOverrides.js](src/domain/deviceOverrides.ts)
  (`classifyDeviceOverrides`, the day-override cleanup classifier) → `.ts`. **Bodies byte-identical.**
  `lifecycleForValidDay(state: unknown): string` (with an `isRecord` type-predicate narrowing `s`);
  `classifyDeviceOverrides(day: Record<string, any>, …): DeviceOverrideClassification` keeps `isRecord` a
  plain `boolean` so the loose-data classification flows as `any` without per-access casts. Zero `.ts`/`.tsx`
  consumers. `npm run typecheck` + `CI=true` build clean; targeted + 3 source-scanning guards (732) pass; full
  suite 4793; e2e 104.

- **Typed 5 pure `domain/` utility modules under strict TS (refactor only, behavior-preserving).**
  [domain/rigConstants.js](src/domain/rigConstants.ts) (`resolveRigConstant` + `RigField`/`RIG_FALLBACK`),
  [domain/animalDeleteCascade.js](src/domain/animalDeleteCascade.ts) (`getAnimalDeleteCascade`),
  [domain/stepGate.js](src/domain/stepGate.ts) (`isExportEnabled` / `exportBlockReason`),
  [domain/optoStatus.js](src/domain/optoStatus.ts) (`describeDayOptoState`), and
  [domain/humanizeValidationMessage.js](src/domain/humanizeValidationMessage.ts) → `.ts`. Bodies are
  behavior-identical apart from small narrowing accommodations: `rigConstants` extracts `defaultVal` and
  inlines the `display` typeof (both exactly equal to the prior `hasDay` boolean — the const didn't narrow);
  `humanizeValidationMessage` adds a `pop()!` (a `split('.')` always yields ≥1 element) + `Record<string,string>`
  + `message: unknown` (narrowed by the existing guard); `animalDeleteCascade` reads its rows as `(d: any)`
  because `dayRecovery` is still `.js` (workflow-layer phase); `optoStatus` types `asArray(value: unknown): any[]`.
  Zero `.ts`/`.tsx` consumers. `npm run typecheck` + `CI=true` build clean; targeted tests + 3 source-scanning
  guards (175) pass; full suite 4793; e2e 104. Begins the `domain/` migration.

- **Typed the React state-shell hooks under strict TS (refactor only, behavior-preserving).**
  [state/useWorkspacePersistence.js](src/state/useWorkspacePersistence.ts),
  [state/useWorkspace.js](src/state/useWorkspace.ts), [state/useEpochCleanup.js](src/state/useEpochCleanup.ts),
  [state/store.js](src/state/store.ts) → `.ts`, and [state/StoreContext.js](src/state/StoreContext.tsx) → `.tsx`
  (the workspace store's hook layer). React-hook typing: `useState<string|null>` / `useRef<…|null>` generics,
  `ReturnType<typeof setTimeout>` for the retry timer, param interfaces (`UseWorkspacePersistenceParams` /
  `UseEpochCleanupParams`), `WorkspacePersistence extends PersistenceStatus`, and `StoreProviderProps` /
  `StoreContextValue = ReturnType<typeof useStore>`. **Hook bodies — effect timing, the 500ms debounce + single
  2s retry, the `commitWorkspace` ref-lockstep, the memo deps — are unchanged.** One shape-trust cast
  (`initialWorkspace as unknown as Workspace` at the `useState` initializer — the boundary where the loosely
  typed hydration result becomes the canonical `Workspace`), `(err as Error).message` catch casts, `any` on the
  still-untyped `useLegacyForm` destructure, and loose `(file: any)`/`(task: any)` over legacy form data. The one
  runtime change: **`StoreContext` drops its runtime `PropTypes`** in favor of the typed `StoreProviderProps`
  interface — redundant in `.tsx`, and React strips PropTypes in production, so prod behavior is unchanged
  (only dev-time prop warnings for `.jsx` callers are superseded by compile-time types). Zero `.ts`/`.tsx`
  consumers. **This completes the `state/` directory's TS migration except the legacy form (`useLegacyForm`).**
  `npm run typecheck` + `CI=true` build clean; the full store-consuming suite (845 across 81 files) + 3
  source-scanning guards pass; full suite 4793; e2e 104.

- **Typed the YAML-import flow under strict TS (refactor only, round-trip byte-identity preserved).**
  [state/yamlImport.js](src/state/yamlImport.ts), [state/yamlImportPlan.js](src/state/yamlImportPlan.ts),
  and [state/yamlImportApply.js](src/state/yamlImportApply.ts) → `.ts` (the import is the inverse of the
  export merge, guarded by round-trip tests).
  - `yamlImport` (`decomposeYaml` + `recomposeDayModel`): function bodies byte-identical; the decode result
    is a discriminated `DecomposeResult` (`{ ok: true, … } | { ok: false, issues }`). The flat YAML model is
    typed `ValidationModel` (the established `Record<string, any>` boundary that `validate` already takes).
  - `yamlImportPlan` (`planImport` + `extractRecordingDate`): the JSDoc `@typedef`s become real exported
    interfaces (`ImportPlan` / `ImportPlanDay` / `ImportPlanAnimal` / `ConfigVersion` / `Divergence`); helpers
    typed.
  - `yamlImportApply` (`applyImportPlan` + `preflightAnimal`): typed `ImportActions` / `ApplyImportResult`;
    the `targetId!` / `existingAnimalId!` non-null assertions rest on the preflight invariant (replace/add
    only run after preflight confirmed the animal exists; create uses the validated `subjectId`).
  - Behavior-affecting body changes are all byte-equivalent: `Object.hasOwn` → `Object.prototype.hasOwnProperty.call`
    (ES2020-lib-safe; `hasOpto`'s opto-presence gate + `findExistingAnimalId`), one `stableStringify` cast on a
    post-guard index, a `?.message` on a condition-guaranteed access, and `(error as Error)` catch casts. Zero
    `.ts` consumers. `npm run typecheck` + `CI=true` build clean; import-flow tests incl. both round-trips (48)
    + 3 source-scanning guards (49) + golden baselines (125) pass; full suite 4793; e2e 104.

- **Typed two pure `state/` leaf modules under strict TS (refactor only, no behavior change).**
  [state/identityDivergence.js](src/state/identityDivergence.ts) and
  [state/repairCommands.js](src/state/repairCommands.ts) → `.ts`.
  - `identityDivergence` (`valuesEqual` + `findIdentityDivergence`, the Spyglass-keyed identity-divergence
    detector): function bodies are **byte-identical**; added `IdentityRegistryEntry` / `IdentityDivergence`
    interfaces and typed signatures.
  - `repairCommands` (`REPAIR_COMMAND_TYPES` + `applyRepairCommand`, which executes serializable repair
    commands as store writes): typed `RepairCommand` / `RepairCommandActions` / `RepairCommandContext`
    interfaces (the action update methods take `Record<string, unknown>` because the executor builds
    dynamic-key updates like `{ [command.field]: [] }`; the id params are `string | undefined` because the
    surface→id guard — not the type system — ensures presence). `isRecord` became a type predicate; `ctx.day`
    / `ctx.animal` typed `Day` / `Animal` (the pre-existing defensive guards are now type-redundant but
    unchanged at runtime). The ONLY behavior-touching body change is `COMMAND_SURFACE[command.type]` →
    `command.type ? COMMAND_SURFACE[command.type] : undefined` — byte-equivalent (an empty/undefined type
    yields `undefined` either way), preserving the "unknown/malformed/missing-id command → no-op, never a
    throw, never a partial write" contract across all 10 cases.
  Both have zero real `.ts` consumers. `npm run typecheck` + `CI=true` build clean; repairCommands +
  repairabilityMatrix + 3 source-scanning guards (142) pass; full suite 4793; e2e 104.

- **Typed the workspace hydration initializer under strict TS (refactor only, no behavior change).**
  [state/workspaceHydration.js](src/state/workspaceHydration.ts) → `.ts`: `resolveInitialWorkspace` (the
  pure `useState` initializer for the workspace slice). The function body is **byte-identical** — only a
  `InitialWorkspaceState { workspace?: unknown }` param interface (extracted to dodge
  `jsdoc/check-param-names`) and a `InitialWorkspaceResolution { workspace: Record<string, unknown>;
  discarded: LoadDiscardReason | null; recovered: { missingKeys: string[] } | null }` return interface were
  added. The already-typed `loadWorkspace(): LoadWorkspaceResult` union narrows cleanly through the existing
  `loaded == null` / `if (loaded.workspace)` guards, so the five-branch hydration precedence (tests-win →
  persistence-off → clean-first-run → restored-with-recovered → discarded-default) and the at-most-one
  non-null `discarded`/`recovered` invariant are unchanged. No `workspaceTypes.ts` / tsconfig change.
  `npm run typecheck` + `CI=true` build clean; hydration test + 3 source-scanning guards (56) pass; full
  suite 4793; e2e 104.

- **Typed the workspace mutation-action factory under strict TS (refactor only, no behavior change).**
  [state/workspaceActions.js](src/state/workspaceActions.ts) → `.ts`: `createWorkspaceActions` and its 13
  store-mutation methods (createAnimal / updateAnimal / deleteAnimal /
  createConfigurationSnapshotAndApplyForward / rebuildConfigurationHistory / createDay / duplicateDay /
  updateDay / deleteDay / removeDayReference / relinkDayReference / unlinkDayReference /
  updateWorkspaceSettings). The injected primitives get a `WorkspaceActionPrimitives` interface
  (`commitWorkspace` / `setWorkspace` as `(updater: (prev: Workspace) => Workspace) => void`,
  `workspaceRef: { current: Workspace }`); each method's params are typed from the canonical types
  (`AnimalUpdates` / `DayUpdates` / `ConfigSnapshotInput` from `workspaceTransitions`; `SessionMetadata` /
  `WorkspaceSettings` / …). **No method body changed** — the action bodies, their exact `throw` timing, and
  the defensive corrupt/wrong-owner-record guards are byte-identical (the guards are now type-redundant but
  still run). The only executable-affecting change is one type-only cast: `createAnimal`'s `subject`
  sub-literal `{ subject_id, weight, description, ...subject } as SubjectMetadata` (the body seeds
  schema-required fallbacks because callers may pass a `Partial<SubjectMetadata>`; validation gates true
  completeness). Two small input interfaces extracted (`CreateAnimalMetadata`, `CreateDayOptions`). No
  `workspaceTypes.ts` / tsconfig change; the conversion is the **cast-removal payoff** of the now-typed
  transitions. `npm run typecheck` + `CI=true` build clean; store/workspace + 3 source-scanning guards
  (133) pass; full suite 4793; e2e 104.

- **Typed the workspace export-merge utilities under strict TS (refactor only, byte-identical export).**
  [state/workspaceUtils.js](src/state/workspaceUtils.ts) → `.ts`: the last and most export-sensitive
  `state/` module — `mergeDayMetadata` (the legacy-parity YAML merge), `resolveDayConfig` (effective
  probe-config resolution), `resolveDayDataAcqDevice`, the `reorderKeys`/`reorderItems`/`emit*` ordering
  primitives, and the date/id/default-workspace leaf helpers. Params are typed `Animal`/`Day`; corruption
  tolerance is unchanged (it lives in the body's `unknown`-accepting selectors). The merge body's 28-key
  insertion order, the four `delete merged.*` omissions, and `structuredClone(merged)` are **untouched**
  — the golden baselines (125) and merge-parity suites (workspace-merge / exportParity / legacyParity, 67)
  confirm byte-identity. The only executable-affecting change is in `reorderKeys`: `Object.hasOwn(obj,k)` →
  `Object.prototype.hasOwnProperty.call(record,k)` (the ES2020-lib-safe pre-`Object.hasOwn` form;
  `record` aliases `obj`, identical boolean for plain JSON records — no tsconfig `lib` bump needed). Type
  tokens otherwise: `merged: Record<string, unknown>` (so the `delete`s are legal) + `Record<string,
  unknown>` return; one `as TechnicalParameters` cast on the malformed-`technical` guard (the `as DayState`
  pattern); `isPlainRecord` is now a type predicate; `resolveDayConfig` casts its JS-normalized maps `as
  ElectrodeGroup[]`/`as NtrodeMap[]`; `createDefaultWorkspace` returns `Record<string, unknown>` (kept
  loose so persistence's section-bag cast stays cast-free). No `workspaceTypes.ts` / tsconfig change; the
  prior `.ts` consumers (`configDiff` re-export, `persistence`, `workspaceTransitions`) still compile.
  `npm run typecheck` + `CI=true` build clean; full suite 4793; e2e 104.

- **Typed the workspace state transitions under strict TS (refactor only, no behavior change).**
  [state/workspaceTransitions.js](src/state/workspaceTransitions.ts) → `.ts`: the pure-mutation heart of
  the workspace model — `applyAnimalUpdates`, `createDayRecord`, `applyDayUpdates`,
  `addConfigurationSnapshotToAnimal` / `createSnapshotAndApplyForward` /
  `applyConfigurationForwardToAnimal`, `rebuildConfigurationHistoryForAnimal`, `nextConfigurationVersion`,
  `sortDayIdsByDate` — now take the canonical `Animal`/`Day` interfaces and a typed `Record<string, Day>`
  days map (matching the `configDiff.reconcileAppliedToDays` precedent) and return them;
  `nextConfigurationVersion(history: unknown)` stays shape-agnostic. **Corruption tolerance is unchanged**
  — it lives in the body's `unknown`-accepting selectors (`getConfigHistory` / `getAnimalDevices` /
  `getDayTasks` / `getDayBadChannelOverrides` / …), exactly as before. Update payloads are three new named
  interfaces (`AnimalUpdates` / `ConfigSnapshotInput` / `DayUpdates`). The only executable changes are
  four type-level no-ops: a `carryFrom!.technical` non-null assertion (the `carryTechnical` guard already
  proves it), two `as SessionMetadata` / `as DayState` casts on the malformed-`session`/`state` guard
  merges (the inline corruption-recovery behavior is byte-identical), and a `Record<string, number[]>`
  annotation. Two **`Animal`** type gaps are closed: `optogenetics` is widened to `OptogeneticsConfig |
  null` (the editor's disable sentinel that `applyAnimalUpdates` writes) and the vestigial
  `behavioral_events?: BehavioralEvent[]` is declared (it was already written by `applyAnimalUpdates` and
  read by `getAnimalBehavioralEvents`, never typed). transitions (48) + store-public-api (5) + the three
  source-scanning guards (`architectureBoundaries` / `workspaceSelectors.guard` / `workflowOwnership`) +
  golden baselines (125) pass; `npm run typecheck` + `CI=true` build clean; full suite 4793; e2e 104.

- **Typed the optogenetics-completeness predicate under strict TS (refactor only, no behavior change).**
  [domain/optoCompleteness.js](src/domain/optoCompleteness.ts) → `.ts`: `optoFieldsPresence` (the single
  source of truth for "which of the four opto fields count as present") now takes a permissive
  `OptoFields` and returns a typed `OptoFieldsPresence` (`{ …four booleans, count }`); the `isOptoList…`
  / `isOptoSoftware…` helpers take `unknown`. Body equivalent — the `presence.count = …` post-assignment
  is rewritten as four `const`s + a single returned object (same values). As a **payoff, the consumer
  `validation/rules/optoRules.ts` drops its `model as Parameters<typeof optoFieldsPresence>[0]` cast** —
  a `Record<string, any>` model is assignable to `OptoFields` directly. The other consumer
  (`domain/sectionStatus.js`) is JS, so the rename is transparent. Validation (incl. opto rules) +
  `sectionStatus` + golden baselines (483) pass; `npm run typecheck` + `CI=true` build clean; full suite
  4793; e2e 104.

- **Typed the day camera-usage helpers under strict TS (refactor only, no behavior change).**
  [state/cameraUsage.js](src/state/cameraUsage.ts) → `.ts`: `inferredCameraKeys` / `referencedCameraKeys`
  / `resolveDayCameraUsage` (→ `Camera[]`) / `findCameraAffectedDays` and the `cameraKey` helper are
  typed (`unknown` for the raw animal/day inputs). The day collections are now read through the typed
  selectors (`getDayTasks` / `getDayAssociatedVideos` / `getDayFsGuiYamls`) instead of inline
  `Array.isArray(day?.x) ? day.x : []` — behavior-equivalent and removes the raw `day?.x` access.
  `task.camera_id` is read back as `unknown` to keep the stray-scalar tolerance honest. Two small,
  documented reads remain: the `FsGuiYaml` interface omits `camera_id` (a pre-existing type gap — that
  field is read tolerantly), and `refs.has(cameraKey(...) as string)` keeps the exact `has(null) →
  false` behavior without a redundant null branch. cameraUsage suite (20) + golden baselines pass;
  `npm run typecheck` + `CI=true` build clean; full suite 4793; e2e 104.

- **Typed the probe-config diff utility under strict TS (refactor only, no behavior change).**
  [state/configDiff.js](src/state/configDiff.ts) → `.ts`: `diffProbeConfigs` now returns the defined
  `ProbeConfigDiff` and consumes the newly-typed selectors (`getProbeElectrodeGroups` → `ElectrodeGroup[]`,
  `getProbeNtrodeMaps` → `NtrodeMap[]`, `getConfigHistory` → `ConfigurationSnapshot[]`) — the first
  payoff of the typed read-layer boundary. `stableStringify`/`deepEqual`/`setEqual` are typed (`unknown`
  in); the sort comparators are structural (`{ id: number }` / `{ ntrode_id: number }`) so they sort
  both the element arrays and the `changed` entries; `reconcileAppliedToDays` takes `(animal: unknown,
  daysById: Record<string, Day> | null | undefined)`. Bodies are behavior-equivalent (the only body-adjacent change is a
  `value[k]` index cast for the dynamic structural-stringify walk + tuple annotations on the `new Map`
  entries). configDiff suite (13) + golden baselines pass; `npm run typecheck` + `CI=true` build clean;
  full suite 4793; e2e 104.

- **Typed the canonical workspace read layer under strict TS (refactor only, no behavior change).**
  [state/workspaceSelectors.js](src/state/workspaceSelectors.ts) → `.ts`: the ~25 shape-safe selectors
  now take `unknown` and return the app's canonical container types (`Camera[]`,
  `ConfigurationSnapshot[]`, `Day[]`, `Record<string, number[]>`, …). The single shape-trust assertion
  lives in the generic `asArray<T>` / `asRecord<T>` helpers, with a documented module rule: **selectors
  guarantee container SHAPE, not deep element validity — element validity stays validation's job.** That
  centralizes the one unavoidable assertion in the layer that owns it, so consumers no longer repeat
  `getX(animal) as Foo[]` at each call site. Inputs are `unknown` (raw state can be corrupt); behavior
  is preserved — fields are read through the typed `asRecord` (behavior-equivalent to the prior
  optional-chain), proven by the 48 selector tests + golden baselines. One consumer adapted
  (`domain/dayOverrideValidation.ts`: dropped a now-unneeded `as object`, constrained a dynamic key
  array with `as const`). The generic helpers are function declarations (a `.ts` generic *arrow* is
  mis-parsed as JSX by the vitest/esbuild transform; `tsc` accepts it but the test transform does not).
  Selector + guard suites + golden baselines (174) pass; `npm run typecheck` + `CI=true` build clean;
  full suite 4793; e2e 104.

- **Typed the workspace persistence layer under strict TS (refactor only, no behavior change).**
  [state/persistence.js](src/state/persistence.ts) → `.ts`: `loadWorkspace` / `saveWorkspace` /
  `clearWorkspace` / `ensureWorkspaceShape` / `isPlainObject` are typed, with a precise
  `LoadWorkspaceResult` union (success / recovered / discarded / `null`) and a `LoadDiscardReason`
  derived from an `as const` `LOAD_DISCARD_REASON`. Body is verbatim — only type tokens plus two
  behavior-neutral casts (`defaults as Record<string, unknown>` for the keyed default lookup, and
  `as const` on the reason enum). Also refined the consumed `migrateWorkspace` return into a proper
  discriminated union (type-only) so the loader reads `.discarded` / `.workspace` without a cast. The
  persistence + store-persistence + migration suites and golden baselines (174) stay byte-identical;
  `npm run typecheck` + `CI=true` build clean; full suite 4793; e2e 104.

- **Started typing `state/` under strict TS: the persisted-blob migration registry (refactor only, no
  behavior change).** [state/workspaceMigrations.js](src/state/workspaceMigrations.ts) → `.ts`:
  `migrateWorkspace`, the `MIGRATORS` registry, `migrateV1ToV2`, and `isPlainObject` are typed (the input
  is the naturally-`unknown` parsed blob, already guarded). Body is verbatim — only type tokens plus two
  behavior-neutral casts (`parsed.schemaVersion as number` after the integer guard, `let workspace:
  object`). A clean leaf: it imports only the already-`.ts` `migrateTasksToCatalogV2ToV3`, and its sole
  consumer (`persistence.js`) is untyped JS, so the rename is transparent. The migration + persistence
  suites and golden baselines (165) stay byte-identical; `npm run typecheck` + `CI=true` build clean; full suite 4793;
  e2e 104. Next `state/` leaf: `persistence.js` (which consumes this), then the larger
  `workspaceSelectors` / `workspaceUtils` / `workspaceTransitions`.

- **Finished typing the `validation/` core under strict TS (refactor only, no behavior change).** The
  last five `.js` modules are now `.ts`: [index](src/validation/index.ts) (the unified `validate()` /
  `validateField()` sort boundary), [schemaValidation](src/validation/schemaValidation.ts) (AJV),
  [rawShape](src/validation/rawShape.ts) (the raw-shape export gate), [quickChecks](src/validation/quickChecks.ts),
  and [useQuickChecks](src/validation/useQuickChecks.ts) (the debounced instant-feedback hook). **The
  entire `validation/` directory is now TypeScript.** Bodies are verbatim — only type tokens plus
  behavior-preserving casts (`value as string` where a `RegExp.test` / `parseFloat` already coerces at
  runtime; `error: any` for the untyped `require('ajv')` chain). `ValidationIssue` gained optional
  `instancePath?` / `schemaPath?` so it covers AJV schema issues too (the unified Issue shape `index`
  documented); `rawShape` keeps its own `RawShapeIssue` (the ownership-contract shape, like
  `taskCatalogValidation`'s `CatalogValidationIssue`); `quickChecks` exposes `QuickCheckResult`.
  Validation suites + golden baselines (473) byte-identical; `npm run typecheck` + `CI=true` build
  clean; full suite 4793. **Step 3 (final) of typing the `validation/` core.**

- **Typed the custom business-rules validation layer under strict TS (refactor only, no behavior change).**
  The seven `validation/rules/*` families (reference / opto / channelMap / electrodeGroup / dandiSubject /
  identity / behavioralEvent) and the `rulesValidation` composer are now `.ts` under `strict`, producing a
  shared, strictly-typed `ValidationIssue` (new [issueTypes.ts](src/validation/issueTypes.ts)). Function
  **bodies are byte-identical** (verified by diff) — only type tokens were added: `(model: ValidationModel):
  ValidationIssue[]` signatures, a typed `issues` accumulator, and localized annotations on the corrupt-data
  lambdas/`Set`s the strict checker required. The input is typed `ValidationModel = Record<string, any>` — a
  deliberate, documented permissive-boundary choice: the rules defensively probe ARBITRARY external form
  data at runtime, so the typed guarantee is the produced issue list, not the input. `ValidationIssue` is
  structurally assignable to `domain/repairRouting`'s `RepairableIssue`, so `validate()`'s output flows into
  the routing/status consumers unchanged. No guard-glob change was needed — `workflowOwnership` already
  scans `.ts` for emitted codes. Validation suites + golden baselines (473) byte-identical; `npm run
  typecheck` + `CI=true` build clean; full suite 4793; e2e 104. **Step 2 of typing the `validation/` core**
  — the remaining `index` / `schemaValidation` / `rawShape` / `quickChecks` modules stay JS for now.

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
