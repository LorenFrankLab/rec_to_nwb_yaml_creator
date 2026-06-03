# `modern` Branch Audit — 2026-06-03

Independent multi-agent audit of the `modern` branch vs. the original (`main`). Four agents
explored architecture/completeness, code quality, UX/accessibility, and test/build/setup health.
Findings below converged across independent investigations.

Companion implementation plan: [`.claude/docs/plans/v3-workspace-cutover/PLAN.md`](../plans/v3-workspace-cutover/PLAN.md).

---

## What `modern` is

A milestone-driven rewrite ([docs/TASKS.md](../../../docs/TASKS.md), M0–M13) that turns the original
single-page `App.js` form into a multi-page workspace:

**Home** (create animal) → **AnimalWorkspace** (animals + recording days) → **AnimalEditor**
(electrode groups, channel maps, cameras/hardware) and **DayEditor** (per-session stepper). The
original form is preserved intact as `src/pages/LegacyFormView.jsx`.

- Scope vs `main`: 203 files, +45.7k / −22.6k, ~120 commits, diverged at `2fd49d8`.
- Progress: TASKS.md claims through **M8a complete** match the code; **M8b onward are genuinely
  unstarted**.
- Entry chain: `src/index.js` → `src/App.js` (now a 31-line shell) → `src/layouts/AppLayout.jsx`
  → hash router (`src/hooks/useHashRouter.js`).
- State: single Context store (`src/state/store.js`) holding `{ ...formData, workspace }`. Legacy
  uses flat `formData`; new pages use `workspace.{animals,days,settings}`. Bridge is
  `mergeDayMetadata` in `src/state/workspaceUtils.js`.

**No original functionality was dropped or regressed.** The legacy form and its YAML import/export
pipeline are fully preserved, and golden-baseline parity tests still pass.

---

## Setup & health verdict — works, with caveats

| Check | Result |
| --- | --- |
| Tests (`vitest run`) | **PASS** — 2747 passed, 1 skipped, 0 failed (145 files) |
| Production build | **PASS** on Node 26 |
| Lint | **PASS** — 0 errors, 171 warnings |
| Schema check | **PASS** — v1.0.1 |
| Golden baselines | **PASS** |

**Caveats:**
- `.nvmrc` pins **Node v20.19.5**, but the only Node on this machine is **Homebrew v26** with no
  nvm/fnm/volta. The documented `/setup` + `nvm use` path is non-functional here; it happens to
  work on v26 (unpinned, untested runtime). CI is unaffected (reads `.nvmrc`).
- `npm run build` **fails under `CI=true`** (CRA treats warnings as errors); CI works around it with
  `CI=false` (standing TODO in `.github/workflows/test.yml`).
- **58 production npm vulnerabilities** (25 high), incl. a moderate advisory in the core `yaml`
  parser used on user-uploaded files.
- README has **no setup/install/test instructions**; `docs/ENVIRONMENT_SETUP.md` assumes nvm with no
  fallback.
- `modern` branch gets **no CI** — workflows trigger only on `main` / PRs to `main`.

---

## 🔴 Critical — new workflow is not usable end-to-end

Independently flagged by 3 of 4 agents.

1. **The new UI cannot export YAML.** Export, Validation, and Epochs are stubs
   (`src/pages/DayEditor/{ExportStub,ValidationStub,EpochsStub}.jsx`).
   `src/pages/DayEditor/validation.js:61-63` hardcodes `epochs`/`validation` status to
   `'incomplete'`, and `src/pages/DayEditor/StepNavigation.jsx:118-121` requires all steps `'valid'`
   to enable Export — so **the Export button is permanently disabled and unreachable**, and even if
   reached it is a stub. Nothing in the new pages calls `encodeYaml`. Users must fall back to the
   legacy form to produce a file.

2. **No persistence + misleading "Saved ✓".** `src/featureFlags.js:133` sets
   `localStoragePersistence: false`; there is zero `localStorage` usage. Yet every field blur sets
   `lastSaved` and `src/pages/DayEditor/SaveIndicator.jsx` renders "Saved ✓", and
   `src/state/workspaceTypes.js:30` documents persistence that doesn't exist. No `beforeunload`
   guard. **A refresh or closed tab silently destroys all animals/days** — violating the project's
   zero-data-loss mandate. The `exported` status chip can therefore never become true.

3. **The new workspace is undiscoverable.** Default route `#/` → legacy form
   (`src/hooks/useHashRouter.js:46-49`). `src/layouts/AppLayout.jsx` has no nav bar; the logo links
   back to legacy; the legacy view has no link to `#/home` or `#/workspace`. The new UI is reachable
   only by manually typing a hash.

---

## 🟠 High

- **False-success error handling.** `src/pages/AnimalEditor/HardwareConfigStep.jsx:54-68` and
  `src/pages/DayEditor/DayEditorStepper.jsx:63-101` wrap synchronous `setState` in try/catch then set
  "saved" — React setters don't throw synchronously, so the catch is dead and "saved" always fires
  regardless of failure.
- **`alert()`/`confirm()` UX** in the new AnimalEditor (~10 calls in
  `src/pages/AnimalEditor/AnimalEditorStepper.jsx`, plus `ChannelMapEditor.jsx:82`,
  `CalendarDayCreator.jsx:184`, `BehavioralEventsSection.jsx:134`) — inconsistent with the inline
  validation used elsewhere; an `AlertModal` component already exists and is bypassed.
- **Accessibility claims not fully backed.** `src/pages/AnimalEditor/ElectrodeGroupModal.jsx`
  docstrings a focus trap it doesn't implement (CameraModal does). `src/pages/AnimalEditor/index.jsx:22`
  and `AnimalEditorStepper.jsx:531` both render `<main id="main-content">` (duplicate landmark + id).
  The "AA compliance" landmark test (`src/__tests__/integration/aria-landmarks.test.jsx`) only
  exercises the legacy view. Neither modal restores focus to the trigger on close.
- **Broken/dead-end links.** `src/pages/DayEditor/OverviewStep.jsx:62,158,190` link to
  `#/animal/:id` (no `/editor`), an unknown route that falls back to legacy. AnimalEditor has no
  back-to-workspace link; error states ("Animal not found") have no escape hatch.

---

## 🟡 Medium — code smells & tech debt

- **God modules.** `src/state/store.js` (654 lines) mixes legacy form + workspace CRUD + an
  epoch-cleanup effect that suppresses `exhaustive-deps` and only guards legacy `tasks`, not
  workspace `days[].tasks`. `src/pages/AnimalEditor/AnimalEditorStepper.jsx` (584 lines) rebuilds a
  JSX `steps` array (with inline styles) every render.
- **Modal duplication.** CameraModal and ElectrodeGroupModal independently reimplement
  ESC/scroll-lock/focus/init. ElectrodeGroupModal also hardcodes `DEVICE_TYPES` (third source of
  truth vs. `valueList.js`/`deviceTypes.js`).
- **CSS split-brain.** Both `src/pages/DayEditor/DayEditor.css` (877 lines) and `DayEditor.scss`
  (391) exist and are both bundled, imported by different files.
- **`mergeDayMetadata` returns shared references** (`src/state/workspaceUtils.js:62-86`, no clone) —
  latent corruption vector if ever mutated.
- **`DataAcqSection` claims debounce it doesn't do** (`src/pages/AnimalEditor/DataAcqSection.jsx:17,53`).
- **Derived-state-in-state** in modals (unstable dep arrays reset forms mid-edit); stale-snapshot
  guard in batch day creation (`src/pages/AnimalWorkspace/index.jsx:65-87`);
  `setTimeout(…,0)` navigation race (`src/pages/Home/index.jsx:90-92`).

---

## 🟢 Low

- Orphaned dead code `src/pages/DayEditor/DevicesStub.jsx`.
- `key={index}` on editable lists (`BehavioralEventsSection.jsx:223,276`,
  `AnimalCreationForm.jsx:453`).
- Empty `propTypes = {}` (`DayEditorStepper.jsx:162`); missing PropTypes on some wrappers/stubs.
- `console.warn` silent-fallback for undefined `formData` (`store.js:633`).
- Stub steps presented as normal numbered steps; touch-target sizes not verifiable from markup.
- Test hygiene: `act(...)` warnings in `complete-session-creation.test.jsx`; one intentionally
  skipped keyboard-nav test.

---

## What's genuinely good (don't regress)

- `AnimalCreationForm.jsx` — exemplary accessible form (error summary with focus-jump, per-field
  `aria-describedby`/`aria-invalid`, focus-first-error, smart defaults, future-date guards).
- `OverviewStep.jsx` — clean day-level vs inherited-animal-level field distinction.
- `DevicesStep.jsx` — correct `useMemo`/`useCallback` with narrow deps; day edits scoped to
  bad-channels only.
- `CameraModal.jsx:163-176` — correct focus trap (the template ElectrodeGroupModal should copy).
- `AppLayout.jsx` — solid skip links, route announcer, focus-to-main on route change.
- Store workspace reducers consistently use `structuredClone` immutability.
- Pure, well-tested utils (`channelMapUtils`, `csvChannelMapUtils`, `deviceTypeUtils`).

---

## Bottom line

The architecture is sound and the completed work is high quality and well-tested, but the branch is
**mid-build at M8a**: the new UI cannot export the YAML that is the app's entire purpose, and it
silently loses data on refresh while telling users it saved. It is safe today only because the
legacy form remains the real, intact workflow. The most urgent items are the trust-violating gaps
(the "Saved ✓" lie, the unreachable export) — not bugs in finished code.
