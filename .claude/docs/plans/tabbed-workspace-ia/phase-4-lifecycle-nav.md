# Phase 4 — Lifecycle + navigation cleanup

**Put animal lifecycle in the picker (⋮ menu), make "create animal" an action of the workspace, and
clean up the redundant/under-discoverable nav.**

## Goal

Create and delete an animal from the same place (the animal picker), via discoverable but
non-misclick-prone affordances; remove the Home/Workspace redundancy; surface batch Validation & Export
in the chrome nav.

## Tasks

- **Task 4.1 — Per-animal ⋮ overflow menu** on each animal card in the picker
  ([AnimalWorkspace/index.jsx:321-343](../../../../src/pages/AnimalWorkspace/index.jsx)): `Delete
  animal…` (and a placeholder for `Rename`). This is the chosen pattern — discoverable next to each
  animal, **not** flush against "+ New Animal" (destructive-adjacent-to-primary is a misclick
  anti-pattern). Reuse the Phase 8.7 destructive `ConfirmDialog` verbatim (names animal + cascade count
  excluding wrong-owner/recovered-unlinked + the downloaded-artifacts caveat). **Remove** the
  danger-zone footer ([index.jsx:652-665](../../../../src/pages/AnimalWorkspace/index.jsx)); the ⋮ menu
  replaces it. Keep `deleteAnimal`'s store guard and the robust `deleteDay(dayId, ownerAnimalId)` from
  the Phase 8.7 PR-review fix.
- **Task 4.2 — Create animal as a workspace action (committed).** "+ New Animal" opens the existing
  `AnimalCreationForm` as an **inline panel / modal from the picker** — NOT a route to a separate
  `#/home` screen (the UX review flagged that routing-to-Home leaves first-animal creation on a
  different pattern than everything else). It need not be a polished modal; a simple inline panel is
  fine. On success, land on `#/animal/:id/days`. This is a **blocker to Phase 5** (the stepper/Home
  split can't be removed until create lives in the workspace). If it must split for size, ship 4a
  (⋮ + nav) then 4b (create panel) — but 4b is not optional.
- **Task 4.3 — Nav cleanup.** With Workspace as the hub and create-animal folded in, drop the redundant
  top-level **"Home"** nav entry ([AppLayout.jsx:239-259](../../../../src/layouts/AppLayout.jsx)). Add a
  **"Validation & Export"** chrome nav entry → `#/validation` (the cross-animal batch screen — today it
  isn't in the nav at all). Net primary nav: `Workspace · Validation & Export` (+ the flag-gated legacy
  toggle).
- **Task 4.4 — Cross-animal batch export lives at chrome level.** The per-animal Validation & Export tab
  (Phase 3.3) handles one animal; `#/validation` remains the home for batch/cross-animal export and the
  batch preflight. Make their relationship explicit (the tab links up to the batch screen).

## Acceptance

- Each animal card has a ⋮ menu with Delete animal… using the existing confirm; the danger-zone footer
  is gone; no destructive control sits adjacent to "+ New Animal".
- Primary nav is de-duplicated (no standalone Home) and Validation & Export is discoverable.
- All Phase 8.7 delete guarantees intact (cascade exclusions, owner passed, recovered records disclosed).
- Full suite (lifecycle + nav tests updated), lint, build green; **125 baselines byte-identical**.

## Risks

- **Menu a11y.** The ⋮ menu needs proper `aria` menu semantics + keyboard (Esc/arrows) — write tests
  first. A bare div-on-click is not acceptable.
- **Home consolidation scope.** Folding create-animal into a modal may be larger than the rest of Phase
  4; it's acceptable to split it into 4a (⋮ + nav) and 4b (create-animal modal) if needed.
