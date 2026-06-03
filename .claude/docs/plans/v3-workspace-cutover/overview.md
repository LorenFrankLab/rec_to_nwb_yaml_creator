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
  matches `/animal/:id/editor`; `:99-101` unknown route → silent fallback to legacy. **Phase 2 & 10
  change the default and add nav; Phase 2 fixes the broken `#/animal/:id` (no `/editor`) links.**
- `src/featureFlags.js` — `animalWorkspace:false` (`:121`), `localStoragePersistence:false`
  (`:133`), `newDayEditor:false` (`:149`), `showLegacyToggle:false` (`:105`). **All new-UI flags are
  off; routing currently does not gate on them.** Phase 1 flips persistence; Phase 10 flips the rest.
- `src/state/store.js` — single `useStore` hook (~654 lines): legacy `formData` state, `workspace`
  state ({animals, days, settings}), `workspaceActions` CRUD, selectors, and an epoch-cleanup
  `useEffect` (~`:89-145`) that suppresses `exhaustive-deps` and guards only legacy `formData.tasks`.
  Model assembled as `{ ...formData, workspace }`. **Phase 1 adds persistence here; Phase 6
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
  the real `DevicesStep`) deleted in Phase 6.
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
  day(s) → enter tasks/epochs → validate → **export byte-identical YAML** → persists across reloads.
- Make the new UI safe and honest *before* extending it: no data loss, no false "Saved", no
  unreachable/dead-end paths, accessibility claims backed by markup and tests.
- Pay down the audit's tech debt (god modules, modal duplication, CSS split-brain, `alert()` UX) in
  dedicated phases, sequenced so later feature work benefits.
- Cut over to the new UI as default at v3.0.0, keeping legacy behind a toggle for one release.

### Non-Goals

- **No change to YAML output format or schema.** Output must stay byte-identical to legacy (golden
  baselines). Any divergence is a bug, not a feature.
- **Do not delete `LegacyFormView` in this plan.** It is the safety net; removal is scheduled
  post-v3.0.0 (named in Phase 10, not executed).
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
may change freely. Legacy form runs in parallel through v3.0.0 + one release (Phase 10).

## Metrics

- Golden-baseline parity: byte-identical for all 4 fixtures, every phase.
- Full test suite green at every phase boundary (baseline today: 2747 passed / 1 skipped).
- New-UI export round-trips: import legacy YAML → build workspace → export → byte-identical.
- A user can complete create→configure→export entirely in the new UI without touching legacy.
- Reload mid-edit restores all workspace state (Phase 1 onward).
- Axe: zero violations on every new route (Phase 9).

## Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| New export path diverges from legacy YAML byte-for-byte | Phase 5 gates download on a shadow-export parity check; golden baselines run every phase. |
| `store.js` decomposition (Phase 6) silently changes behavior | Behavior-preserving refactor done *after* export works, so full-suite + golden baselines cover it; no feature change in that phase. |
| localStorage schema (Phase 1) outlives its shape and breaks on reload after model changes | Version the persisted blob; on version mismatch, discard with a user-visible notice rather than crash. **Once real users have v1 blobs, discard-on-mismatch loses their work** — a forward-migration path is a named deferred follow-up (see Deferred follow-ups), out of scope for v3.0.0. |
| Flipping flags at cutover (Phase 10) exposes half-tested paths | Each feature phase ships its flag-on path tested; Phase 10 only flips after parity confirmed. |
| `mergeDayMetadata` shared-reference mutation corrupts animal state | Phase 1 clones output and/or freezes it; contract documented. |

## Rollout Strategy

Feature-flagged, phased. Through Phases 1–9 the default route stays legacy (`#/`); new-UI work lands
behind the existing flags and hash routes, reachable for testing. **Phase 10** flips
`animalWorkspace`/`newDayEditor`/`localStoragePersistence` on, sets the default route to the
workspace, exposes the "Use Legacy Editor" toggle (`showLegacyToggle`), keeps shadow-export parity
enforced for one further release, and tags **v3.0.0**. `#/` bookmarks still resolve (to a redirect or
the toggle target). Legacy code removal is named in Phase 10 with a post-v3.0.0 revisit trigger,
not executed here.

## Open Questions

1. **Do routing/AppLayout currently gate on the feature flags, or ignore them?** All flags are
   `false` yet the new pages render via hash routes. Phase 2 must establish the intended
   relationship (flag-gated vs always-on routes) before Phase 10 can flip safely. Best answer:
   Phase 2 makes routes flag-aware so Phase 10's flip is the single switch.
2. **localStorage persistence scope** — persist the whole `workspace` slice (animals+days+settings)
   only, never the legacy `formData`, and never anything exported into YAML. Best answer: yes,
   `workspace` only, versioned. Confirmed in [shared-contracts.md](shared-contracts.md#persistence-contract).
3. **`#/` bookmark behavior at cutover** — redirect old `#/` to workspace, or keep `#/` = legacy and
   move workspace to `#/home`? Decide in Phase 10; default best-answer: `#/` → workspace home, legacy
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
  natural fit for the [Phase 9](phase-9-a11y-keyboard.md) accessibility pass, which should also sweep
  the pre-existing color-contrast issues (inline-warning text, channel-map select focus rings, calendar
  day-number contrast) flagged in the Phase 3 UX review.

## Estimated Effort

Large. Rough diff sizing per phase: P0 small (~docs + config + 1 dep bump); P1 medium (~300–500 LOC
incl. tests); P2 medium; P3 medium-large (shared primitive + ~12 call-site migrations); P4 large
(M8b, ~5 components + tests, original estimate 63+ tests); P5 large (export + parity, critical); P6
large (store split, mechanical but broad); P7 medium; P8 medium-large; P9 medium; P10 small-medium
(flags + default route + docs). Test count expected to grow from 2748 toward ~3000+.
