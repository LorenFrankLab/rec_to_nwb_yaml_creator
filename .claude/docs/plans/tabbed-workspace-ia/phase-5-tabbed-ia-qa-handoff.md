# Phase 5 → pre-cutover 9/10/11 QA handoff (tabbed IA)

**tabbed-workspace-ia — the stepper→tabs migration.** Status: **Phases 0–5 complete** (incl. the two
Phase-4 deferred pieces + the pre-Phase-5 review remediation), each commit verified (full suite, lint,
build, byte-identical golden baselines) and code-reviewed. This is the Phase-5 Task 5.7 handoff: what
was built, where it's proven, the new IA/route map, what's deferred, and a statement that **pre-cutover
Phases 9/10/11 now run against this tabbed IA**.

Binding promise of the migration: **an animal's days + setup are managed in a revisitable tabbed hub,
not a linear wizard** — without regressing any export-correctness guarantee (125 golden baselines stay
byte-identical throughout).

## Source-of-truth artifacts

- **Screen map** — [workflow-screen-map.md](../pre-cutover-export-correctness/workflow-screen-map.md):
  rewritten to the tabbed IA (Task 5.5). Per route/tab/modal/empty-state, the user job, attention,
  primary action, next/return path, ownership cue, and prevented mistake. Its "Tabbed-IA reconciliation"
  table pins where the code stands.
- **Browser scenarios** — [phase-5-browser-scenarios.md](phase-5-browser-scenarios.md): the unified
  tab-based ownership / discoverability / lifecycle / repair / navigation scenarios (Task 5.6), keyed to
  `#/animal/:id/:tab`, that pre-cutover [phase-9-playwright-qa-pass.md](../pre-cutover-export-correctness/phase-9-playwright-qa-pass.md)
  Tasks 4.5/4.6 run. These REPLACE the old stepper-IA scenarios.
- **Plan + decisions** — [overview.md](overview.md) (Target IA + the 13 numbered decisions + "Layout —
  DECIDED") and the phase docs ([phase-1](phase-1-tab-shell.md) … [phase-5](phase-5-decommission-stepper.md),
  [phase-3a](phase-3a-repair-routing.md), [phase-4](phase-4-lifecycle-nav.md)).
- **Refactor changelog** — [docs/REFACTOR_CHANGELOG.md](../../../../docs/REFACTOR_CHANGELOG.md): one
  entry per commit across Phases 1–5 + the deferred pieces + the pre-Phase-5 remediation.

## New IA / route table

| Route | View | Owns | Notes |
| --- | --- | --- | --- |
| `#/` (or no hash) | Legacy form | The frozen pre-workspace editor | Safety net until the v3 cutover flips the default |
| `#/workspace` | Animal picker | Animal cards (name · day count · ⋮), empty state, inline create panel | `?animal=<id>` → that animal's days; `?create=1` → open the create panel |
| `#/home` | Create Animal (legacy) | The `AnimalCreationForm` route | Still live; create now primarily lives in the workspace inline panel |
| `#/animal/:id/:tab` | Tabbed Animal View | One animal's days + setup | `:tab` ∈ days · export · electrode-groups · channel-maps · recording-system · cameras · dio · optogenetics; bare `#/animal/:id`, unknown tabs, and the **removed** `editor` all redirect to `days` |
| `#/day/:id` | Day Editor (stepper, unchanged) | One recording day's facts/tasks/export | Only the *Animal* editor became tabs |
| `#/validation` | Validation & Export (batch) | Cross-animal readiness + batch export | The per-animal `export` tab links UP to here |

**Chrome (all non-legacy routes):** primary nav `Workspace · Validation & Export` (no standalone Home);
on animal routes, the top object-selector `Workspace ▸ <animal> ▾` (disclosure popup: switch link +
per-row ⋮ + "+ New animal…"). **Animal View:** header band (name · `subject_id` · species · sex · ⋮
Delete animal…) + the subject/reconfig banners; a grouped left section-nav (`name · count · ›`,
blocking-● / todo-○, `aria-current`); per-tab scope descriptors; the 3-field corruption banner above the
panels; the "Animal not found" non-stranding fallback.

## Coverage map (which test proves which tab/affordance — jsdom/Vitest)

| Tab / affordance | Proven by |
| --- | --- |
| Tabbed shell: nav landmark, `aria-current`, canonicalization, not-found, focus-on-tab-change, Axe | [AnimalView.test.jsx](../../../../src/pages/AnimalView/__tests__/AnimalView.test.jsx), [AnimalView.a11y.test.jsx](../../../../src/pages/AnimalView/__tests__/AnimalView.a11y.test.jsx) |
| Recording Days tab (rows, setup card, existing-data review, calendar) | [RecordingDaysTab.dayRow.test.jsx](../../../../src/pages/AnimalWorkspace/__tests__/RecordingDaysTab.dayRow.test.jsx), [RecordingDaysTab.setupCard.test.jsx](../../../../src/pages/AnimalWorkspace/__tests__/RecordingDaysTab.setupCard.test.jsx) |
| Electrode Groups + Channel Maps tabs (regen, bulk-add, delete-cascade, next-id, copy) | [AnimalView.ephysTabs.test.jsx](../../../../src/pages/AnimalView/__tests__/AnimalView.ephysTabs.test.jsx), [wiring/__tests__/ElectrodeGroupsContainer.test.jsx](../../../../src/pages/AnimalEditor/wiring/__tests__/ElectrodeGroupsContainer.test.jsx), [utils channelMapUtils](../../../../src/utils/__tests__/channelMapUtils.test.js) |
| Recording System / Cameras / DIO / Optogenetics tabs (render + store-write + identity safety) | [AnimalView.catalogTabs.test.jsx](../../../../src/pages/AnimalView/__tests__/AnimalView.catalogTabs.test.jsx), [wiring/__tests__/CamerasContainer.test.jsx](../../../../src/pages/AnimalEditor/wiring/__tests__/CamerasContainer.test.jsx), section/modal tests (`DataAcqSection`, `BehavioralEventsSection`, `CameraModal`, `identitySafety`) |
| Validation & Export tab (scoped) + uplink | [AnimalView.exportTab.test.jsx](../../../../src/pages/AnimalView/__tests__/AnimalView.exportTab.test.jsx) |
| Section-nav blocking ● + count/chevron affordance | [AnimalView.blockingDot.test.jsx](../../../../src/pages/AnimalView/__tests__/AnimalView.blockingDot.test.jsx), AnimalView.test.jsx (decision-10 block), [sectionCounts.test.js](../../../../src/domain/__tests__/sectionCounts.test.js) |
| `?field=` repair-landing highlight | [AnimalView.fieldHighlight.test.jsx](../../../../src/pages/AnimalView/__tests__/AnimalView.fieldHighlight.test.jsx) |
| Picker: cards, ⋮ menu, inline create, lifecycle | [AnimalWorkspace.test.jsx](../../../../src/pages/AnimalWorkspace/__tests__/AnimalWorkspace.test.jsx), AnimalWorkspace.menu/create/lifecycle.test.jsx |
| Top object-selector + chrome wiring + post-delete landing | [AnimalSwitcher.test.jsx](../../../../src/components/__tests__/AnimalSwitcher.test.jsx), [AppLayout.switcher.test.jsx](../../../../src/layouts/__tests__/AppLayout.switcher.test.jsx) |
| `⋮` overflow menu (APG keyboard) | [OverflowMenu.test.jsx](../../../../src/components/__tests__/OverflowMenu.test.jsx) |
| Animal delete (type-to-confirm) + cascade | [AnimalDeleteDialog.test.jsx](../../../../src/components/__tests__/AnimalDeleteDialog.test.jsx), [animalDeleteCascade.test.js](../../../../src/domain/__tests__/animalDeleteCascade.test.js) |
| Create glue (shared with Home) | [animalCreation.test.js](../../../../src/domain/__tests__/animalCreation.test.js) |
| Route redirect (`editor` → `days`) + nav | [useHashRouter.test.js](../../../../src/hooks/__tests__/useHashRouter.test.js), [AppLayout.test.jsx](../../../../src/layouts/__tests__/AppLayout.test.jsx) |
| Export correctness (regression) | [src/__tests__/baselines/](../../../../src/__tests__/baselines/) — 125 byte-identical (`npx vitest run baselines` for the live count) |

## Deferred / unresolved (carry into pre-cutover 9/10/11 and the cutover)

1. **Cutover landing route.** The default route is still `#/` (legacy). The tabbed hub is ready to be the
   landing screen; v3-cutover Phase 11 flips `#/` → workspace onto this audited IA. Not done here.
2. **Scroll restoration is browser-only.** `.focus()` scrolls the panel into view on a tab change; jsdom
   can't compute scroll, so it is documented (Phase-5.4) and left for the live Playwright pass — see
   [phase-5-browser-scenarios.md](phase-5-browser-scenarios.md) S4.
3. **Live keyboard/axe walkthrough.** The committed jest-axe + APG keyboard tests cover the structure;
   automated Axe catches ~30–40% of WCAG. A manual browser keyboard walkthrough of the
   selector→menu→dialog→tab transitions remains for Phase 9 (scenarios S1–S5).
4. **Workspace day rows lack the batch scan fields** (carried from 8.7): the `Validation & Export` rows
   carry config/camera/opto scan; the picker/day rows show triage status only (decision 12). Optional.
5. **`#/home` lives on** as a redirect-equivalent create route; it can be removed (and
   `AnimalCreationForm` relocated to `src/components`, dropping its arch-guard allowlist entry) in a
   later cleanup, once nothing links to it.

## Pre-Phase-5 whole-branch review — outcomes (folded in)

A 6-agent review (deletion-safety / spec-fulfillment / UX / code / silent-failure / test-coverage) ran
against the full branch before Phase 5. Verdict: Phases 0–4 + all 13 decisions delivered; IA matches the
revisitable-not-linear goal. Remediated before the stepper deletion (commits `ec5e15e`…`e568d85`):
fork→extract dedup (delete copy / `dayHasArtifacts` / day count), two correctness fixes (setup card
can't say "Done" over a blocking section; create-nav gated on success), a UX cluster (post-delete
landing, header-⋮ Open dropped, dead Rename removed, in-animal links → the animal's export tab), and the
**coverage migration** that made the stepper-test deletion safe (`ElectrodeGroupsContainer` +
`CamerasContainer` identity-safety + recording-system store-write + `animalDeleteCascade` unit tests).
Phase 5 (`4aa6acb`) then deleted the stepper + route with deletion-safety + coverage verified by review.

## Statement for pre-cutover 9/10/11

**Pre-cutover Phases 9/10/11 now run against this tabbed IA** (per the overview's sequencing): Phase 9
runs the [phase-5-browser-scenarios.md](phase-5-browser-scenarios.md); Phases 10/11 audit against the
rewritten [workflow-screen-map.md](../pre-cutover-export-correctness/workflow-screen-map.md). The hub is
ready to be the **default route** so v3-cutover Phase 11 can flip `#/` → workspace onto a finished,
audited IA.

## Gates (all green at handoff)

`npx vitest run` (full suite), `npx vitest run baselines` (125 byte-identical), `npm run lint`
(0 errors), `npm run build`. Run at the start of pre-cutover Phase 9.
