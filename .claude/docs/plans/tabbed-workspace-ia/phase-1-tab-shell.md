# Phase 1 — Tab shell

**Introduce the tabbed animal view scaffold and the per-tab routing, hosting only the existing
Recording Days pane to start.** Additive and flag-gated — the stepper route stays alive as a fallback.

> **Placement locked (overview → Layout — DECIDED, decisions 9–11):** the section-nav is a **grouped LEFT
> nav** (two groups: Day work / Animal setup; row = name · count · ›; blocking-only red dots; active = teal
> fill + inset bar), and the **animal is switched from a top object-selector**, not a left animal rail. The
> a11y contract here (navigation landmark + `aria-current` links, NOT `role=tablist`) is unchanged by the
> placement. "TabBar" below = the left section-nav component. Reference render:
> [alternatives/recommended-left-nav.html](alternatives/recommended-left-nav.html).

## Goal

An accessible animal view at `#/animal/:id/:tab` whose tab bar is a **navigation landmark** (links +
`aria-current="page"` — **not** a `role="tablist"`; decided), with the current recording-days pane
re-hosted unchanged in the `days` tab. No setup migration yet (Phase 3), no lifecycle change yet
(Phase 4). This phase is the skeleton everything else hangs on.

## Routing

- New route `#/animal/:id/:tab` (`tab ∈ days | export | electrode-groups | channel-maps |
  recording-system | cameras | dio | optogenetics`). Phase 1 only renders `days`; unknown/absent tab →
  redirect to `days`.
- `#/animal/:id` (no tab) → `#/animal/:id/days`.
- Add to the route resolver in [AppLayout.jsx:84-182](../../../../src/layouts/AppLayout.jsx) (the hash
  parser + the `renderView` switch). Keep `#/animal/:id/editor` (the stepper) working in parallel.
- **Rewrite `useAnimalIdFromUrl`** ([src/hooks/useAnimalIdFromUrl.js](../../../../src/hooks/useAnimalIdFromUrl.js)) —
  it hard-matches `^/animal/([^/]+)/editor$` and returns `null` for `#/animal/:id/:tab`, so every
  consumer (the stepper, repair routing) breaks until it parses the new shape. Consider folding
  animal-id parsing into [useHashRouter](../../../../src/hooks/useHashRouter.js).
- Selecting an animal in the Workspace picker navigates to `#/animal/:id/days` (today it sets local
  `selectedAnimalId` state; that becomes a route).

## Tasks

- **Task 1.1 — `AnimalView` container + `TabBar` (as a nav).** New `src/pages/AnimalView/` with the tab
  bar rendered as `<nav aria-label="Animal sections">` of `<a href="#/animal/:id/:tab"
  aria-current={active ? 'page' : undefined}>` links — **not** `role="tablist"` (decided: each tab is a
  route, so nav semantics are honest and avoid the tablist-vs-link spec fight). No existing tab/menu
  primitive exists in `src/components/` (verified by review) — this is net-new, but as a nav it's
  simple links + `aria-current`, not a roving-tabindex widget.
- **Task 1.1b — Focus & SR announcement on tab change.** `AppLayout`'s route-change focus/announcer
  ([AppLayout.jsx:125-141](../../../../src/layouts/AppLayout.jsx)) only fires when the `view` changes —
  it will NOT fire on a `:tab` change (same `view`). `AnimalView` must move focus to the active panel's
  heading and announce the section on tab navigation itself.
- **Task 1.1c — Section-nav status: blocking-only dots + a hollow-○ onboarding ring (decision 11).**
  **Superseded the old four-state dot design.** A section-nav row shows a colored dot **only when that
  section blocks export** (red), plus a neutral **hollow ○ "todo" ring** on a **never-configured** section
  (onboarding). **No green "done" or amber "review" ambient dots** — they manufactured anxiety on
  established animals and duplicated the (removed) canvas strip (decision 11). The row's right-aligned
  **count** (decision 10) carries neutral setup state instead. The indicator must carry an accessible
  text label (`aria-label="Cameras — blocks export"` / `"Electrode Groups — not set up"`), not colour
  alone. Pair with the first-run checklist panel (Phase 2.3).
  - **Derivation reality (correcting the earlier "display change only" claim):** `getAnimalSetupChecklist`
    ([workflowStatus.js:179](../../../../src/domain/workflowStatus.js)) returns exactly **5 items —
    `subject, electrodes, cameras, data_acq, days`** — with `electrodes` **combined** (not split) and
    **no DIO / Channel Maps / Optogenetics item**. So the hollow-○ "not set up" state for **Channel Maps,
    DIO, and Optogenetics**, and the split of `electrodes` into **Electrode Groups vs Channel Maps**
    (decision 6), require **new (trivial) per-section derivation** — this is NOT "display change only."
    The *counts* are all derivable read-only from existing selectors (`getAnimalElectrodeGroups`,
    `getAnimalCameras`, `getDataAcqDevices`, **`getAnimalBehavioralEvents`** for DIO —
    [workspaceSelectors.js](../../../../src/state/workspaceSelectors.js)); only the per-section
    *todo-state* needs the new glue. Owner: this task (define a `getAnimalSectionStatus(animal, section)`
    helper) — still UI/derivation-only, no store/export change.
  - **Phase 1 scope (shipped):** the **hollow-○ todo ring** only — `getAnimalSectionStatus`
    ([src/domain/sectionStatus.js](../../../../src/domain/sectionStatus.js)) returns `todo` for a
    never-configured setup section (empty electrode-groups / channel-maps / recording-system / cameras /
    DIO / optogenetics, via existing selectors), else `none`. Rendered as a colour-free `○` with an
    accessible "— not set up" name. The **blocking-red** state is deferred to **Phase 3a**: it needs the
    per-section validation attribution (which export-blocking error belongs to which section) that 3a
    builds for repair routing — there is no honest way to compute it before that mapping exists.
- **Task 1.2 — Host the Recording Days pane in the `days` tab.** Render the existing day-management
  pane (the `selectedAnimal` branch of [AnimalWorkspace/index.jsx](../../../../src/pages/AnimalWorkspace/index.jsx))
  inside the `days` `TabPanel`, unchanged in behavior. Extract it into a `RecordingDaysTab` component if
  that keeps `AnimalWorkspace` and `AnimalView` from duplicating it; otherwise import it.
- **Task 1.3 — Picker → route.** The Workspace animal cards navigate to `#/animal/:id/days` instead of
  setting local state. The Workspace remains the picker + empty state; `AnimalView` owns the selected
  animal. **No persistent left animal rail (decision 9):** inside `AnimalView` the animal is switched via
  the **top object-selector** (`Workspace ▸ <animal> ▾`), which frees the left column for the single
  section-nav. (The selector dropdown is the net-new switcher — its a11y is specified in Phase 4.)
- **Task 1.4 — Landmark/a11y contract.** Preserve per-route landmark uniqueness (the v3-cutover nav
  contract): **exactly one `#main-content`** per rendered route — during the transition the stepper and
  `AnimalView` both render `<main id="main-content">` today, and `AppLayout`'s focus effect targets that
  id, so a duplicate breaks focus-on-route-change. The animal-sections nav uses a distinct `aria-label`
  from the primary nav. No focus traps.
- **Task 1.5 — Cold deep-link / mid-load state.** A deep-link to `#/animal/remy/days` before the store
  hydrates from persistence must show a loading state, NOT the stepper's current "Animal not found"
  error path (which would wrongly fire on a cold load). Define the loading/empty/not-found trichotomy.
- **Task 1.6 — Responsive section-nav.** The section-nav is a **vertical LEFT column** (decision 9), not a
  top tab row — so the narrow-window degrade is **collapse, not horizontal scroll**: below ~1040px the
  left nav collapses to a toggle/drawer (an off-canvas panel or a compact icon-less list), the canvas
  takes full width, and day rows reflow their action cluster below the status line. Keep the group
  headers + counts + blocking dot when collapsed; the per-section scope descriptors may truncate. (The
  earlier "single horizontally-scrollable tab row" spec was for the superseded top-tab layout — do not
  build it.)

## Acceptance

- `#/animal/remy/days` renders the recording-days pane; the section nav is keyboard-reachable (Tab to
  the links, Enter activates) with `aria-current="page"` on the active tab; focus moves to the panel
  heading on tab change.
- Deep-linking to a tab works; back/forward moves between tabs; `#/animal/remy` redirects to `…/days`;
  `useAnimalIdFromUrl` resolves the new shape.
- A deep-link to a missing animal shows a non-stranding "Animal not found" (with a Back-to-Workspace
  link), never a perpetual "Loading…" — the store hydrates SYNCHRONOUSLY (no async cold-load gap), so an
  empty/emptied workspace is genuinely empty, not loading. Exactly one `#main-content`.
- The stepper (`#/animal/:id/editor`) still works (fallback during transition).
- Behind `animalWorkspace`; legacy unaffected. Full suite + new nav a11y tests + lint + build green;
  **125 baselines byte-identical** (no export/store touch).

## Risks

- **Two homes for the day pane** during transition (Workspace pane vs. `days` tab). Decide explicitly
  (and state in acceptance) that selecting an animal navigates **entirely** into `AnimalView`, hiding
  the old Workspace selected-animal pane — the two must not render the same content simultaneously.
  Mitigate drift by extracting one shared `RecordingDaysTab` imported in both.
- Nav-as-tabs a11y: ensure `aria-current` is the only "selected" signal (no `role="tab"` leakage), and
  that focus management on tab change is owned here (not by AppLayout). Write these tests first (TDD).
- **Cross-page coupling via the shared `RecordingDaysTab`.** It lives under `pages/AnimalWorkspace/` and is
  imported by `AnimalView` through the `CROSS_PAGE_ALLOWLIST` (architectureBoundaries guard). This is
  intentional ("extract, don't fork"), but **track relocating it to a neutral home** (e.g. `src/components/`)
  when that opens up, so the allowlist doesn't silently accumulate page→page coupling. (Follow-up — Phase 5
  cleanup or whenever `src/components` relocation is in scope.)
