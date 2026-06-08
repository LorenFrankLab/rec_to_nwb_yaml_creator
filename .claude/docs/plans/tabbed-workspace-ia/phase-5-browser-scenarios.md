# Phase 5 — unified tab-based browser scenarios

**The ownership / discoverability / lifecycle / repair browser scenarios for the tabbed IA, keyed to
the `#/animal/:id/:tab` routes. Supplied by tabbed-workspace-ia Phase 5 (Task 5.6); RUN by pre-cutover
[phase-9-playwright-qa-pass.md](../pre-cutover-export-correctness/phase-9-playwright-qa-pass.md) Tasks
4.5/4.6 — these REPLACE the old stepper-IA scenarios there.**

## How to run

Drive **localhost only** (`npm run start` → `http://localhost:3000`) with the Playwright MCP
(`browser_navigate` → `browser_snapshot` → act by `ref` → re-snapshot), or encode as committed
`@playwright/test` specs in `e2e/`. Each scenario names the **goal**, the **misconception it guards**,
the **route(s)**, the **steps**, and the **assertions**. The "Already pinned (jsdom)" line names the
committed Vitest test that already covers the logic, so the browser pass focuses on what jsdom can't
prove (real focus/scroll/layout/visual), not re-proving logic.

Cross-check every scenario against [workflow-screen-map.md](../pre-cutover-export-correctness/workflow-screen-map.md):
each sampled screen must show the expected heading, primary action, ownership cue, next/return path,
and a repair destination that is not a read-only dead end.

Seed: a workspace with one configured animal `remy` (≥1 electrode group + channel map, ≥1 camera,
data-acq, ≥2 recording days, one validated/exported) and a second animal `totoro` (behavior-only,
0 setup). Use the workspace import or the store seed used by the integration fixtures.

---

## S1 — Ownership & discoverability (Phase 9 Task 4.5)

**Goal:** a scientist can tell *shared, versioned* setup from *shared, unversioned* setup from *day*
facts, at the point of action, without opening every form.
**Misconception guarded:** "editing Cameras / Recording System only changes the day I'm on" and
"a recording day owns its probes/cameras."

| Step | Route / action | Assertion |
| --- | --- | --- |
| 1 | `#/animal/remy/days` | Header band shows `remy` · `subject_id` badge · species · sex · a ⋮ menu. The left section-nav is grouped **Day work** / **Animal setup**; each row shows `name · count · ›`. |
| 2 | Open the `electrode-groups` tab | Scope descriptor reads **"Versioned identity — a change here forks a configuration version."** |
| 3 | Open the `recording-system` tab | Scope descriptor reads **"Shared across ALL days (no per-day version)."** (honest: NOT "per day"). |
| 4 | Open the `cameras` tab | Scope descriptor reads **"Catalog — referenced per day."** |
| 5 | Open the `optogenetics` tab for `totoro` (unconfigured) | A neutral **"Not used — no stimulation"** chip — an unused opto tab does not read as an error. |
| 6 | `#/animal/totoro/days` (new animal) | The first-run **"Set up this animal"** card lists the six setup sections with honest hints (`if ephys` / `if video` / `if behavioral events`) and per-section `Set up →` links to the owning tab — **never** a mandatory-setup gate (behavior-only days are valid). |

**Already pinned (jsdom):** `AnimalView.ephysTabs/catalogTabs.test.jsx` (scope descriptors, opto chip,
extracted containers), `RecordingDaysTab.setupCard.test.jsx` (card sections + honest hints + non-gating).
**Browser adds:** the descriptors/chips are visible (not clipped) and the card visually leads the tab on
first run.

---

## S2 — Lifecycle: create / switch / delete (Phase 9 Task 4.6)

**Goal:** create, switch, and delete animals/days from discoverable, misclick-resistant affordances.
**Misconception guarded:** "delete removes my downloaded YAML/NWB"; an accidental whole-animal wipe.

| Step | Route / action | Assertion |
| --- | --- | --- |
| 1 | `#/workspace`, click `+ New Animal` | An **inline create panel** opens on the picker (NOT a route to `#/home`); it hosts the animal creation form. |
| 2 | Fill valid fields, `Create Animal` | Lands on `#/animal/<newid>/days`. |
| 3 | On an animal route, open the top selector `Workspace ▸ <animal> ▾` | A disclosure popup lists every animal (switch link + day count + a per-row ⋮); `+ New animal…` is at the bottom. Esc closes and returns focus to the trigger; Up/Down move between rows. |
| 4 | Selector row ⋮ → `Delete animal…` for a NON-current animal | A type-to-confirm `alertdialog`: the `Delete animal` button is **disabled** until the animal `id` is typed exactly; copy names the cascade day count + the **"does not delete already-downloaded YAML / NWB / DANDI / Spyglass"** caveat. Confirm → that animal is gone, you stay where you were. |
| 5 | Header ⋮ → `Delete animal…` for the **currently-viewed** animal → type id → confirm | The app navigates to `#/workspace` (the picker), **not** a 404-like "Animal not found". |
| 6 | `#/animal/remy/days`, an OK day row → `Delete day…` | A **plain** Cancel/Delete confirm (no typed gate — the per-day blast radius is one day); for a validated/exported day it adds the downloaded-artifacts caveat. |
| 7 | Inspect any ⋮ menu | Items are `Open` / `Delete animal…` (picker + selector) or just `Delete animal…` (header); there is **no** dead disabled `Rename…` placeholder. |

**Already pinned (jsdom):** `AnimalWorkspace.menu/create/lifecycle.test.jsx`, `AnimalSwitcher.test.jsx`,
`AppLayout.switcher.test.jsx`, `AnimalDeleteDialog.test.jsx`, `animalDeleteCascade.test.js`.
**Browser adds:** real focus management across the selector/menu/dialog, and that the post-delete
navigation actually re-renders the picker.

---

## S3 — Repair routing lands on the owning tab (Phase 9 Task 3 / 4.5)

**Goal:** a blocking error routes to the owning setup tab, focused/highlighted — never a read-only
dead end.
**Misconception guarded:** "the export says blocked but I can't find what to fix."

| Step | Route / action | Assertion |
| --- | --- | --- |
| 1 | Seed `remy` so a day references a camera missing `meters_per_pixel` (a camera-owned export blocker) | — |
| 2 | `#/animal/remy/days` | The section-nav `Cameras` row shows a red ● and an accessible name `Cameras — blocks export`; the first-run card (if shown) reads **"Needs fixing"** for Cameras, never "Done". |
| 3 | From the day's Validation, or the animal's `export` tab, click the camera repair action | Navigates to `#/animal/remy/cameras?field=…`; the owning section scrolls into view and briefly highlights (`.repair-target-highlight`). |
| 4 | From the `days` tab review state, click an in-animal "review existing data" link | It targets **this animal's** `#/animal/remy/export` (the scoped tab), not the cross-animal batch `#/validation`. |
| 5 | A reconfiguration deep-link (`?context=reconfigure&version=…`) | Lands on the `electrode-groups` tab with the reconfiguration context banner, params preserved. |

**Already pinned (jsdom):** `AnimalView.blockingDot.test.jsx`, `AnimalView.fieldHighlight.test.jsx`,
`RecordingDaysTab.setupCard.test.jsx` ("Needs fixing"), repair-routing tests.
**Browser adds:** the scroll + highlight are visible and the target is on-screen/reachable.

---

## S4 — Tab navigation, focus & unsaved-edit guard

**Goal:** revisitable tabs with correct focus + an unsaved-edit guard.
**Misconception guarded:** "switching sections silently lost my open edit."

| Step | Route / action | Assertion |
| --- | --- | --- |
| 1 | `#/animal/remy/days`, click each section-nav link | The URL becomes `#/animal/remy/<tab>`; the clicked link is `aria-current="page"`; focus moves onto the panel (a long tab does not leave focus stranded at the top). |
| 2 | Open a setup editor (e.g. the electrode-group modal), then click another section-nav link | A **discard confirm** intercepts the switch ("Discard unsaved changes?" / "Keep editing"); a modifier/middle click is NOT intercepted (it opens a new tab). |
| 3 | A bare `#/animal/remy` or a stale `#/animal/remy/editor` | Both canonicalize/redirect to `#/animal/remy/days`. |
| 4 | A cold deep-link to a missing animal `#/animal/ghost/days` | A non-stranding **"Animal not found"** with a `Back to Workspace` link — never a perpetual "Loading…". |

**Already pinned (jsdom):** `AnimalView.test.jsx` (canonicalization, not-found), `AnimalView.a11y.test.jsx`
(focus-on-tab-change, landmark uniqueness, Axe), `ephysTabs/catalogTabs` (discard guard), `useHashRouter.test.js`
(editor→days redirect).
**Browser adds:** focus + scroll behaviour in a real browser; one main landmark per route under the live chrome.

---

## S5 — Same-day & catch-up export still coherent under the tabs

**Goal:** the same-day and catch-up export paths (the Phase-9 Task 2.5 smoke) work under the tabbed IA.

| Step | Route / action | Assertion |
| --- | --- | --- |
| 1 | Prepared `remy`: `#/animal/remy/days` → `Add Recording Days` → open the new day | Reach a single trustworthy export without retyping shared setup. |
| 2 | `#/animal/remy/export` (the scoped tab) | Per-day valid/error/incomplete chips for THIS animal; `Export Valid Only` exports the ready days; the scoped header links UP to the batch `#/validation`. |
| 3 | `#/validation` (chrome batch) | Cross-animal rows with the batch-row-scan fields (config version, camera/calibration, opto state, validation/recovery state, next action); the preflight names skipped days and uses the same export gate. |

**Already pinned (jsdom):** `AnimalView.exportTab.test.jsx`, `ValidationSummary` suites, the golden
export baselines.
**Browser adds:** the two end-to-end paths are reachable without redundant shared-setup entry, and
the batch row scan fields are visible without opening each day.

---

## Coverage note for Phase 9

The logic behind every scenario above is already pinned in the jsdom/Vitest suite (named per
scenario). Phase 9's browser pass should therefore focus on what jsdom **cannot** prove: real focus
management and scroll/visibility across the selector → menu → dialog → tab transitions, layout at
desktop and narrow widths (modals/nav/export reachable, nothing clipped), and that the documented
navigations (post-delete → picker, repair → owning tab, `editor` → `days`) actually re-render in a
live browser. Automated Axe catches ~30–40% of WCAG issues — pair with a manual keyboard walkthrough.
