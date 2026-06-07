# Phase 5 — Decommission the stepper + QA/handoff

**Remove the now-redundant Animal Editor wizard, migrate its tests, and hand off to QA / the v3
cutover.**

## Goal

Once the tabs own all setup (Phases 3–4), the `#/animal/:id/editor` stepper is dead weight and a second
source of truth. Remove it, migrate its still-relevant tests onto the tabs, and confirm the tabbed hub
is ready to be the post-cutover landing.

## Tasks

- **Task 5.1 — Retire the stepper route.** Remove `#/animal/:id/editor` from the resolver
  ([AppLayout.jsx](../../../../src/layouts/AppLayout.jsx)) (or 301-style redirect it to
  `#/animal/:id/electrodes` for any stale bookmarks/deep-links), and delete
  [AnimalEditorStepper.jsx](../../../../src/pages/AnimalEditor/AnimalEditorStepper.jsx) once nothing
  imports it. The section components it hosted survive (they're now in tabs).
- **Task 5.2 — Re-home the stepper tests (bigger than it sounds).** `AnimalEditorStepper.test.jsx` is
  **~1724 lines** plus three sibling suites (corruptCollections, deepLink, repairBanner). Most of it
  exercises the **handlers** (save-group, channel-map regen, copy-from-animal, CSV, camera identity)
  that Phase 3 relocated into the extracted containers — those assertions don't "port," they must be
  **re-targeted** at the new container/tab harnesses (which mount differently). Budget this as
  re-homing ~1700 lines, not deleting. Ideally the wiring-extraction tests were written in Phase 3
  alongside the extraction, leaving Phase 5 to delete only the now-dead stepper-navigation shell tests.
  Ensure repair deep-link tests target tab URLs (from Phase 3a).
- **Task 5.3 — Remove transition scaffolding.** Any "host the pane in both places" bridges from Phase 1
  (the dual day-pane home) collapse to the tab only; delete the Workspace's old selected-animal
  scrolling pane branch now that `AnimalView` owns it.
- **Task 5.3b — Drop the post-save handshake.** The stepper's `handleSave` routes to
  `#/workspace?animal=…&action=create-day&section=devices` ([AnimalEditorStepper.jsx:289-320](../../../../src/pages/AnimalEditor/AnimalEditorStepper.jsx));
  tabs autosave continuously via `updateAnimal`, so there's no terminal Save/Continue moment. Remove the
  `?action`/`?section` handshake and its success `AlertModal` once nothing reads them (confirm
  `AnimalWorkspace` mount only consumes `?animal=`). Specify **unsaved-modal-on-tab-switch** behavior:
  an open `CameraModal`/`ChannelMapEditor` with pending edits must not be silently dropped when the user
  navigates tabs — either block the switch or hoist the modal above the panels.
- **Task 5.4 — Accessibility + visual pass.** Full keyboard walkthrough of the tabbed hub (the section
  nav + `aria-current`, per-tab content, ⋮ menus, modals); axe pass; confirm per-route landmark
  uniqueness, focus management across tab changes, and **scroll restoration** (returning to a long tab
  resets or restores scroll; SR focus lands on the panel heading).
- **Task 5.5 — Update `workflow-screen-map.md` to the tabbed IA.** The screen map
  ([.claude/docs/plans/pre-cutover-export-correctness/workflow-screen-map.md](../pre-cutover-export-correctness/workflow-screen-map.md))
  is the contract pre-cutover Phases **10 and 11** score against. Rewrite its route/step/modal rows for
  the tabbed IA: the `#/animal/:id/:tab` routes, the section **nav** (links + `aria-current`), the
  per-animal and per-day **⋮ menus**, the create-animal panel, the new empty/loading/cold-deep-link
  states, and the per-tab ownership cues + scope descriptors. Without this, 10/11 audit a stale map.
- **Task 5.6 — Supply the unified browser scenarios.** Produce the **tab-based** ownership /
  discoverability / lifecycle / repair browser scenarios that pre-cutover **Phase 9 (Tasks 4.5/4.6)**
  will run — replacing the stepper-IA scenarios there. One scenario source, keyed to the new routes.
- **Task 5.7 — QA + handoff.** Write a handoff note (like the Phase 8.7 one): the new IA map, the route
  table, a coverage map (which test proves which tab/affordance), and a pointer to the updated screen
  map + the unified scenarios. State explicitly that **pre-cutover 9/10/11 now run against this tabbed
  IA** (per the overview's sequencing) and that the hub is ready to be the **default route** so
  v3-cutover Phase 11 can flip `#/` → workspace onto a finished, audited IA.

## Acceptance

- No `#/animal/:id/editor` stepper remains (or it cleanly redirects); `AnimalEditorStepper.jsx` deleted;
  no dead imports.
- Stepper tests migrated/removed with no net coverage loss for the underlying setup behavior.
- Full keyboard + axe pass on the tabbed hub; full suite, lint, build green; **125 baselines
  byte-identical**.
- `workflow-screen-map.md` rewritten to the tabbed IA; the unified tab-based browser scenarios exist
  and are referenced by pre-cutover Phase 9.
- Handoff note written; **pre-cutover Phases 9/10/11 run against this tabbed IA**; v3-cutover Phase 11
  unblocked to flip the landing route onto the finished, audited hub.

## Exit

This plan is done when the tabbed animal workspace is the complete, accessible home for an animal's days
and setup, the stepper is gone, and the v3 cutover can make it the landing screen with no further IA
work.
