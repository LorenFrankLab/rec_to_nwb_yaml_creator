# Overview — Scope, dependencies, integration, risks

[← back to PLAN.md](PLAN.md)

This plan integrates two inputs: the remaining milestones of the original refactor
([docs/TASKS.md](../../../../docs/TASKS.md) M8b–M13) and the [2026-06-03 audit](../../reviews/2026-06-03-modern-branch-audit.md).
It assumes the reader has zero prior context on this codebase.

## Background the executor needs

- This is **scientific infrastructure**. Generated YAML feeds `trodes_to_nwb` → NWB → Spyglass. A
  formatting regression can corrupt months of irreplaceable experiments. The golden-baseline YAML
  parity tests (`src/__tests__/baselines/golden-yaml.baseline.test.js`) are a hard gate; see
  CLAUDE.md "Regression Prevention Protocol."
- The app currently ships **two parallel UIs in one store**: the original single-page form (now
  `src/pages/LegacyFormView.jsx`, the only path that can produce YAML today) and the new multi-page
  workspace (Home → AnimalWorkspace → AnimalEditor/DayEditor). They share one Context store but
  operate on disjoint slices (`formData` vs `workspace`).
- The new UI is mid-build at M8a. It can configure animals/days but **cannot export YAML** and
  **does not persist** — see audit Criticals.

## Current codebase integration points

Verified file:line refs the plan touches. Anchor to these so the executor doesn't drift.

- `src/index.js` → `src/App.js` → `src/layouts/AppLayout.jsx` — entry chain; AppLayout `switch`es on
  `currentRoute.view` and owns skip links / route announcer / focus-to-`#main-content`.
- `src/hooks/useHashRouter.js:46-49` — empty/`#/` → `view:'legacy'` (default landing). `:69`
  matches `/animal/:id/editor`; `:99-101` unknown route → silent fallback to legacy. **Phase 2 & 11
  change the default and add nav; Phase 2 fixes the broken `#/animal/:id` (no `/editor`) links.**
- `src/featureFlags.js` — `animalWorkspace:false` (`:121`), `localStoragePersistence:false`
  (`:133`), `newDayEditor:false` (`:149`), `showLegacyToggle:false` (`:105`). **All new-UI flags are
  off; routing currently does not gate on them.** Phase 1 flips persistence; Phase 11 flips the rest.
- `src/state/store.js` — single `useStore` hook (~654 lines): legacy `formData` state, `workspace`
  state ({animals, days, settings}), `workspaceActions` CRUD, selectors, and an epoch-cleanup
  `useEffect` (~`:89-145`) that suppresses `exhaustive-deps` and guards only legacy `formData.tasks`.
  Model assembled as `{ ...formData, workspace }`. **Phase 1 adds persistence here; Phase 7
  decomposes it.**
- `src/state/workspaceUtils.js:34-100` — `mergeDayMetadata(animal, day)` builds the flat metadata
  object (deriving the config snapshot internally from `day.configurationVersion`); **assigns nested
  animal/config references without cloning** (`:62-72`). Phase 1 clones the output; Phase 5 consumes
  it to produce YAML.
- `src/state/workspaceTypes.js:30` — JSDoc claims "Persisted to localStorage" (currently false).
  Phase 1 makes it true.
- `src/pages/DayEditor/validation.js:58-64` — `computeStepStatus` hardcodes `devices`, `epochs`,
  `validation` to `'incomplete'`. **Phase 2** wires `devices` to real status; **Phase 4** wires
  `epochs`; **Phase 5** wires `validation`.
- `src/pages/DayEditor/StepNavigation.jsx:118-121` — `isExportEnabled()` requires all steps
  `'valid'`; with the hardcoded `'incomplete'`s the Export tab is permanently disabled. Unblocked by
  Phases 2/4/5.
- `src/pages/DayEditor/{EpochsStub,ValidationStub,ExportStub,DevicesStub}.jsx` — stubs. EpochsStub
  replaced in Phase 4; ValidationStub/ExportStub in Phase 5; DevicesStub is dead code (DayEditor uses
  the real `DevicesStep`) deleted in Phase 7.
- `src/pages/DayEditor/SaveIndicator.jsx` + `DayEditorStepper.jsx:63-101` +
  `src/pages/AnimalEditor/HardwareConfigStep.jsx:54-68` — render "Saved ✓" on every blur and wrap
  synchronous `setState` in dead try/catch. Phase 1 makes the indicator truthful and removes the
  false-success try/catch.
- `src/pages/AnimalEditor/{CameraModal,ElectrodeGroupModal}.jsx` — duplicated modal infra; CameraModal
  has a real focus trap (`:163-176`), ElectrodeGroupModal does not. Phase 3 extracts a shared `<Modal>`.
- `~10 alert()` + `window.confirm()` calls — `src/pages/AnimalEditor/AnimalEditorStepper.jsx`,
  `ChannelMapEditor.jsx:82`, `src/components/CalendarDayCreator/CalendarDayCreator.jsx:184`,
  `src/pages/AnimalEditor/BehavioralEventsSection.jsx:134`. `src/components/AlertModal` already
  exists. Phase 3 replaces them.
- `src/pages/AnimalEditor/index.jsx:22` and `AnimalEditorStepper.jsx:531` — duplicate
  `<main id="main-content">`. Phase 2 fixes.
- `src/io/yaml.js` — `encodeYaml`, `decodeYaml`, `formatDeterministicFilename`, `downloadYamlFile`.
  The export path Phase 5 wires into. **Not called by any new page today.**
- `src/validation/` — `validate()`, `schemaValidation()`, `rulesValidation()`. Reused, not rebuilt.
- `.github/workflows/test.yml` — CI reads `.nvmrc` (Node 20.19.5); build uses `CI=false` workaround
  (standing TODO); triggers only on `main`. Phase 0 addresses.
- `README.md`, `docs/ENVIRONMENT_SETUP.md` — setup docs (nvm-only, README lacks install/test). Phase 0.

## Scope and dependency policy

### Goals

- The workspace UI becomes a complete workflow: create animal → configure devices/hardware → create
  day(s) → enter tasks/epochs → validate → **export YAML** → persists across reloads. The exported YAML
  is **semantically parity-equal** to the legacy export from Phase 5, and **byte-for-byte** identical to
  it from [Phase 6](phase-6-legacy-byteorder-parity.md) (before cutover).
- Make the new UI safe and honest *before* extending it: no data loss, no false "Saved", no
  unreachable/dead-end paths, accessibility claims backed by markup and tests.
- Pay down the audit's tech debt (god modules, modal duplication, CSS split-brain, `alert()` UX) in
  dedicated phases, sequenced so later feature work benefits.
- Cut over to the new UI as default at v3.0.0, keeping legacy behind a toggle for one release.

### Non-Goals

- **No change to YAML output format or schema.** The `encodeYaml` formatting must stay byte-identical
  (the within-path `golden-yaml.baseline.test.js` guard); the schema is frozen. Any divergence there is a
  bug, not a feature. (Note: the *new* export path is not byte-identical to the legacy path until
  [Phase 6](phase-6-legacy-byteorder-parity.md) — see Metrics and the parity contract — but it is
  semantically equivalent throughout, and the encoder/schema themselves never change.)
- **Do not delete `LegacyFormView` in this plan.** It is the safety net; removal is scheduled
  post-v3.0.0 (named in Phase 11, not executed).
- **No optogenetics editor UI** (original M8.5) — deferred; out of scope here.
- **No backend/server, no cloud sync.** Persistence is localStorage only.
- Not chasing all 171 lint warnings to zero except where Phase 0 needs them gone to drop `CI=false`.

### Dependency policy

- No new runtime dependencies expected. Phase 0 bumps `yaml` to clear the advisory (within semver if
  possible; golden baselines must still pass byte-for-byte after the bump — treat a parity change as
  a blocker). Avoid `npm audit fix --force` (breaks `react-scripts`).
- Routing stays library-free (hash router). Do not add `react-router`.

## Backwards compatibility

Confirmed required for the **YAML file format** (downstream `trodes_to_nwb`/Spyglass) and for
**existing `#/` bookmarks** during the cutover. The new UI's in-memory data model is internal and
may change freely. Legacy form runs in parallel through v3.0.0 + one release (Phase 11).

## Metrics

- Golden-baseline parity (within-path encoder/format guard): byte-identical for all 4 fixtures, every
  phase.
- Full test suite green at every phase boundary.
- New-UI export semantic parity (Phase 5+): import legacy YAML → build workspace → export → parses to the
  same metadata (order-independent deep-equal); plus a checked-in new-path byte snapshot.
- New-UI export byte-for-byte legacy parity (Phase 6+, before cutover): the new path's bytes equal the
  legacy export's bytes, proven by a legacy-export reference harness.
- A user can complete create→configure→export entirely in the new UI without touching legacy.
- Reload mid-edit restores all workspace state (Phase 1 onward).
- Axe: zero violations on every new route (Phase 10).

## Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| New export path diverges from legacy YAML byte-for-byte | Expected pre-cutover and benign downstream (semantic parity holds; `trodes_to_nwb`/Spyglass parse order-independently). Phase 5 proves semantic parity + a new-path snapshot and gates download on an encoder-stability check; **Phase 6** reorders `mergeDayMetadata` to the legacy key order so the bytes match; cutover (Phase 11) is **hard-gated** on Phase 6 byte parity. Within-path golden baselines run every phase. |
| `store.js` decomposition (Phase 7) silently changes behavior | Behavior-preserving refactor done *after* export works, so full-suite + golden baselines cover it; no feature change in that phase. |
| localStorage schema (Phase 1) outlives its shape and breaks on reload after model changes | Version the persisted blob; on version mismatch, discard with a user-visible notice rather than crash. **Once real users have v1 blobs, discard-on-mismatch loses their work** — a forward-migration path is a named deferred follow-up (see Deferred follow-ups), out of scope for v3.0.0. |
| Flipping flags at cutover (Phase 11) exposes half-tested paths | Each feature phase ships its flag-on path tested; Phase 11 only flips after parity confirmed. |
| `mergeDayMetadata` shared-reference mutation corrupts animal state | Phase 1 clones output and/or freezes it; contract documented. |

## Rollout Strategy

Feature-flagged, phased. Through Phases 1–10 the default route stays legacy (`#/`); new-UI work lands
behind the existing flags and hash routes, reachable for testing. Byte-divergence between the new and
legacy export is acceptable **only** during this flag-gated window; Phase 6 eliminates it before the
flip. **Phase 11** flips
`animalWorkspace`/`newDayEditor`/`localStoragePersistence` on, sets the default route to the
workspace, exposes the "Use Legacy Editor" toggle (`showLegacyToggle`), keeps shadow-export parity
enforced for one further release, and tags **v3.0.0**. `#/` bookmarks still resolve (to a redirect or
the toggle target). Legacy code removal is named in Phase 11 with a post-v3.0.0 revisit trigger,
not executed here.

## Open Questions

1. **Do routing/AppLayout currently gate on the feature flags, or ignore them?** All flags are
   `false` yet the new pages render via hash routes. Phase 2 must establish the intended
   relationship (flag-gated vs always-on routes) before Phase 11 can flip safely. Best answer:
   Phase 2 makes routes flag-aware so Phase 11's flip is the single switch.
2. **localStorage persistence scope** — persist the whole `workspace` slice (animals+days+settings)
   only, never the legacy `formData`, and never anything exported into YAML. Best answer: yes,
   `workspace` only, versioned. Confirmed in [shared-contracts.md](shared-contracts.md#persistence-contract).
3. **`#/` bookmark behavior at cutover** — redirect old `#/` to workspace, or keep `#/` = legacy and
   move workspace to `#/home`? Decide in Phase 11; default best-answer: `#/` → workspace home, legacy
   moves behind the toggle + `#/legacy`.

## Deferred follow-ups (named, out of scope for v3.0.0)

- **Persistence-blob migration.** Phase 1 versions the localStorage blob and *discards with a notice*
  on schemaVersion mismatch — no migration. That is acceptable for v3.0.0 (no real users have v1 blobs
  yet). **Follow-up:** once real users have v1 blobs in the wild, a future model change that bumps the
  schemaVersion will silently discard their saved work. A migration path (transform old blobs forward
  instead of discarding) is **out of scope for v3.0.0** but is a named follow-up to schedule before the
  first post-v3.0.0 model change that touches the persisted shape.
- **Two audit Mediums handled in Phase 2 (not dropped).** The `setTimeout(…, 0)` post-create
  navigation race in `src/pages/Home/index.jsx` and the stale-`days`-snapshot guard in batch day
  creation in `src/pages/AnimalWorkspace/index.jsx` are fixed in
  [Phase 2](phase-2-navigation-stub-honesty.md), not silently dropped.
- **Remaining dialogs not yet on the shared `<Modal>` primitive.** Phase 3 created the primitive and
  migrated `CameraModal`, `ElectrodeGroupModal`, and `AlertModal`. Three other overlay surfaces still
  use bespoke markup and lack the full dialog a11y contract (focus trap / focus return / ESC / proper
  ARIA): `src/pages/AnimalEditor/ChannelMapEditor.jsx`, `src/pages/AnimalEditor/CopyFromAnimalDialog.jsx`
  (uses `<dialog open>` without `showModal()`), and `src/components/CalendarDayCreator/CalendarDayCreator.jsx`
  (inline card carrying `role="dialog"`). These were **out of scope for Phase 3** (its task list named
  only the three migrated modals). **Follow-up:** migrate them onto `<Modal>` (or fix in place) — a
  natural fit for the [Phase 10](phase-10-a11y-keyboard.md) accessibility pass, which should also sweep
  the pre-existing color-contrast issues (inline-warning text, channel-map select focus rings, calendar
  day-number contrast) flagged in the Phase 3 UX review.
- **Phase 4 UX/a11y items deferred to the Phase 10 sweep.** The Phase 4 reviewers surfaced three items
  that are app-wide or shared-component concerns, out of scope for Phase 4's local change:
  1. **Primary-button contrast.** `--color-primary` (`#2196f3`) with white text is ~3.1:1 — below
     WCAG AA — and is the app-wide primary-button color (Home, Animal Editor, Day Editor all reuse it).
     Phase 4 left it unchanged to avoid fragmenting the palette; fix it once, centrally, in the Phase 10
     color-contrast sweep (alongside the inline-warning/focus-ring/calendar items already named above).
     (Phase 4's own *new* inline-warning / `status-⚠` colors were bumped to AA-compliant values.)
  2. **`role="alertdialog"` for destructive confirms.** `src/components/Modal/ConfirmDialog.jsx` (the
     shared Phase 3 primitive) renders `role="dialog"`; ARIA recommends `alertdialog` for a destructive
     confirm. Changing it touches the shared component used by every delete flow → defer to the Phase 10
     a11y pass so it lands once for all callers.
  3. **Inherited behavioral events vs. the YAML merge.** The Tasks & Epochs step shows the animal's
     `behavioral_events` as inherited/read-only, but `mergeDayMetadata` (`src/state/workspaceUtils.js`)
     emits only `day.behavioral_events` — it does not concatenate the animal's inherited events into the
     exported metadata. This is a **pre-existing** merge gap (not introduced by Phase 4) that Phase 4's
     UI now makes visible. **Follow-up:** reconcile the inheritance UI with the merge contract (either
     merge animal events into the day output, or relabel the display) before cutover — a natural fit for
     [Phase 5](phase-5-validation-export.md), which owns the export/merge path, or the Phase 8 summary.
- **Phase 8 review items deferred (out of scope for the summary phase).** The Phase 8 reviewers
  surfaced two enhancements left for a later pass:
  1. **A persisted-"Validated" indicator in the summary table.** The status chip already shows
     live-computed status, and "Validate All" persists `day.state.validated`, but the table does not
     visually distinguish a day whose validated flag is persisted from one that is merely live-valid.
     Phase 8 added a button `title` explaining the persistence purpose; a dedicated column/badge is a
     UX enhancement best landed alongside the [Phase 10](phase-10-a11y-keyboard.md) pass (and is partly
     redundant once the AnimalWorkspace per-day chips consume the same flag).
  2. **Structured error logging for export skips/failures.** Phase 8 logs parity skips and export
     failures via `console.error` (the app has no Sentry/structured-logging infra today). Routing these
     through a real logging path with error IDs is a cross-app concern, out of scope for the summary.

- **Phase 9 review items deferred (out of scope for the wizard phase).** The Phase 9
  reviewers surfaced three follow-ups left for later, all low practical risk:
  1. **Cross-action atomicity of versioning.** The wizard calls `addConfigurationSnapshot`
     then `applyConfigurationForward` as two sequential store actions, predicting the new
     version as `configurationHistory.length + 1`. The calls are synchronous on the current
     animal, so the version is correct in practice; but if the second action ever threw, an
     orphan empty snapshot would remain. **Follow-up:** have `addConfigurationSnapshot`
     return the created version (or add a combined create-and-apply action) so the two can't
     desynchronize. Out of scope here (the plan deliberately kept creation and assignment
     as separate actions).
  2. **`appliedToDays` as a derived value.** It is currently a denormalized cache kept in
     sync by `applyConfigurationForward`, with `reconcileAppliedToDays` providing the
     trustworthy derived view (`updateDay({configurationVersion})` bypasses the stored
     lists). **Follow-up:** consider dropping the stored field entirely and always deriving
     it, removing the partition-maintenance burden. A data-model change, out of scope here.
  3. **Wizard UX niceties for long studies.** Select-all/deselect-all controls and
     relative/human-readable day labels for animals with 60–200+ days, and an explicit
     success confirmation. Deferred to the [Phase 10](phase-10-a11y-keyboard.md) pass.

- **Phase 10 review item deferred.** The `Alt+←` / `Alt+→` stepper shortcuts (the
  chord the phase spec prescribed) collide with the browser's Back/Forward navigation
  on Windows/Linux; the handler `preventDefault`s, so in-app it advances the stepper
  rather than navigating history. **Follow-up:** consider `Alt+PageUp/PageDown` (or
  `Alt+Shift+Arrow`) for cross-platform safety, or add a platform note in the shortcuts
  help. Kept as specified for now; revisit before v3.0.0 if user feedback warrants.

## Plan revisions

- **2026-06-03 — parity model corrected; a byte-parity phase inserted after export.** Pre-Phase-5
  verification found that `encodeYaml` preserves key insertion order and that `mergeDayMetadata`, the
  legacy `formData`, and the hand-authored golden fixtures each use **different** key orders/sets — so
  the new export path is *not* byte-identical to the legacy fixtures, contradicting the original
  "byte-for-byte parity" premise of Phase 5 and the `mergeDayMetadata` contract. Resolution: Phase 5 now
  proves **semantic** parity (parse-back deep-equal) + a new-path byte snapshot, and a new dedicated
  [Phase 6 — byte-for-byte legacy parity](phase-6-legacy-byteorder-parity.md) (reorder `mergeDayMetadata`
  to the legacy key order, verified against a legacy-export reference harness) was inserted
  **immediately after export** so every later phase inherits byte parity and there is no byte-divergence
  window. The previously-numbered Phases 6–9 (store decomposition, validation summary, probe wizard,
  a11y) each shifted **down by one** to 7–10; cutover remains the final phase, **Phase 11**.
  `shared-contracts.md`, `phase-5`, this file, and the review matrix were updated accordingly; the
  within-path golden baselines are unchanged.

- **2026-06-03 — Phase 5 scope: root-cause export-reachability fix (in-scope deviation, owner-approved).**
  Implementing Phase 5 surfaced a structural blocker: `mergeDayMetadata` always emitted `keywords: []`,
  `units: {}`, and an empty `default_header_file_path`, all of which the schema rejects when
  present-but-empty (keywords `minItems`, units required `analog`, non-empty pattern). Because the
  workspace model had **no `keywords` field at all**, *no* day — however complete — could validate clean,
  so the (now-real) `validation` step was permanently in error and the Export gate could never unlock.
  The phase doc's guard "do not modify `mergeDayMetadata`" was about not changing its **key order**
  (that is Phase 6); fabricating schema-invalid empty values is a correctness bug. Resolution (approved):
  the merge now **omits** `keywords`/`units`/`default_header_file_path` when empty (matching a clean
  hand-authored file), a `keywords` field was added to the `Day` model + a Keywords editor in the
  Overview step, and the new-path snapshot + `REALISTIC_ALWAYS_ON_KEYS` were updated (now only `device`
  is always added beyond the fixture). The within-path golden baselines remain byte-identical, the
  encoder/schema are unchanged, and `isExportEnabled` was not loosened. **Phase 6 note:** legacy
  `exportAll` emits `keywords: []` from `defaultYMLValues`, so byte-for-byte legacy parity must reconcile
  present-vs-absent for empty optional keys, not only key order.
- **Follow-up (deferred):** `units` and `default_header_file_path` still have no dedicated workspace
  editor — they are simply omitted when empty (valid), but a future phase may add entry fields for labs
  that set them. Tracked here so the omission is not mistaken for full coverage.
- **Phase 5 review follow-ups (out of scope, deferred):**
  - **Validation message quality:** the per-day Validation step surfaces `validate()` messages verbatim;
    raw AJV phrasing ("must have required property 'lab'") and dot-notation paths are domain jargon. A
    user-facing message-translation pass belongs in the validation module, not this phase.
  - **`shadowExportStrict` hardening:** the strict flag is a runtime-mutable global; if flipped off in a
    deployed build, an encoder-stability failure downgrades to warn-and-proceed. Consider pinning it
    `true` outside dev/test at cutover (**Phase 11**, which already keeps shadow-export strict for one
    release).
  - **Imported-keyword validation:** the `KeywordsEditor` trims/de-dupes at entry, but an imported day
    could carry blank/duplicate keywords straight through the merge (`keywords.length > 0` only). The
    Validation step surfaces these as errors and blocks export (the correct, non-silent behavior);
    adding entry-layer parity for imports is an optional nicety, deliberately not silent-filtered.

## Estimated Effort

Large. Rough diff sizing per phase: P0 small (~docs + config + 1 dep bump); P1 medium (~300–500 LOC
incl. tests); P2 medium; P3 medium-large (shared primitive + ~12 call-site migrations); P4 large
(M8b, ~5 components + tests, original estimate 63+ tests); P5 large (export, critical); P6 medium
(behavior-preserving `mergeDayMetadata` key-order reorder + legacy-export reference harness); P7 large
(store split, mechanical but broad); P8 medium; P9 medium-large; P10 medium; P11 small-medium (flags +
default route + docs). Test count expected to grow from 2748 toward ~3000+.
