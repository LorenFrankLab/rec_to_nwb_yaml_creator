# Phase 4 — Lifecycle + navigation cleanup

**Put animal lifecycle in the picker (⋮ menu), make "create animal" an action of the workspace, and
clean up the redundant/under-discoverable nav.**

> **Placement locked (overview → Layout — DECIDED, decision 9):** the "animal picker" is now the **top
> object-selector** (`Workspace ▸ <animal> ▾` dropdown), NOT a left animal rail. So the per-animal
> lifecycle ⋮ (Task 4.1) lives in **two** places that must stay consistent: the **selector dropdown rows**
> (each animal + count, with ⋮ / or a per-row menu) AND the **animal header band ⋮** for the
> currently-selected animal. "+ New animal…" is an item at the bottom of the selector dropdown. Same
> destructive confirm and store guards as below — only the host surface changes from a card-rail to the
> selector + header.

## Goal

Create and delete an animal from the same place (the animal picker), via discoverable but
non-misclick-prone affordances; remove the Home/Workspace redundancy; surface batch Validation & Export
in the chrome nav.

## Tasks

- **Task 4.1 — Per-animal ⋮ overflow menu** on each animal card in the picker
  ([AnimalWorkspace/index.jsx:321-343](../../../../src/pages/AnimalWorkspace/index.jsx)): `Delete
  animal…` (and a placeholder for `Rename`). This is the chosen pattern — discoverable next to each
  animal, **not** flush against "+ New Animal" (destructive-adjacent-to-primary is a misclick
  anti-pattern). Build on the Phase 8.7 destructive `ConfirmDialog` (names animal + cascade count
  excluding wrong-owner/recovered-unlinked + the downloaded-artifacts caveat). **Remove** the
  danger-zone footer ([index.jsx:652-665](../../../../src/pages/AnimalWorkspace/index.jsx)); the ⋮ menu
  replaces it. Keep `deleteAnimal`'s store guard and the robust `deleteDay(dayId, ownerAnimalId)` from
  the Phase 8.7 PR-review fix.
- **Task 4.1a — Type-to-confirm gate for animal delete (decided — overview decision 13).** Deleting an
  animal is the highest-blast-radius, irreversible action in the app (it wipes the animal's entire shared
  setup AND all its recording days at once), so its confirm **adds a typed-name gate**: the "Delete animal"
  button stays disabled until the user types the animal's `id` (matched exactly, trimmed). This is a
  deliberate **divergence from "reuse verbatim"**, scoped to **animal delete only** — per-day delete
  (Phase 2 Task 2.2) keeps the plain Cancel/Delete confirm (its blast radius is one day, and adding
  friction to a routine action would train users to ignore it). The gate is a presentation layer over the
  same `deleteAnimal` action; the cascade summary + downloaded-artifacts caveat are unchanged. Reference
  render: [alternatives/delete-animal.html](alternatives/delete-animal.html). A11y: the typed field is
  labelled, the disabled button has an accessible reason, focus opens on the field. (The same gate applies
  wherever animal delete is triggered — the selector-dropdown row and the header ⋮ share one dialog.)
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
- **Task 4.5 — Animal-selector dropdown widget + a11y (net-new — decision 9).** The top object-selector
  (`Workspace ▸ <animal> ▾`) is a **disclosure popup, NOT a `role="listbox"` and NOT a `role="menu"`**
  (an early mockup used listbox-with-buttons-plus-nested-menu — that ARIA is invalid: options/menuitems
  can't host secondary controls). Spec:
  - Trigger = a `<button aria-haspopup="true" aria-expanded aria-controls>`; the popup is a labelled
    region (`aria-label="Switch animal"`).
  - Each row has a **primary switch control** (a link/button → `#/animal/:id/days`, the current animal
    marked `aria-current`) **and a secondary ⋮ `menubutton`** (`aria-haspopup="menu"`) opening that
    animal's `role="menu"` (Open / Rename… / Delete animal… — the SAME dialog as the header ⋮, incl. the
    decision-13 type-to-confirm). "+ New animal…" is a `<button>` (opens Task 4.2's create panel).
  - Keyboard: Esc closes; Up/Down move between rows; the ⋮ submenu has its own roving focus + Esc.
    Open/close moves focus correctly (into the popup on open, back to the trigger on close). No focus trap.
  - Reference render: [alternatives/selector-dropdown.html](alternatives/selector-dropdown.html).

## Acceptance

- Animal delete requires a typed-name confirmation (button disabled until `id` matches); per-day delete
  keeps the plain confirm — the asymmetry is intentional (decision 13).
- Each animal card has a ⋮ menu with Delete animal… using the existing confirm; the danger-zone footer
  is gone; no destructive control sits adjacent to "+ New Animal".
- Primary nav is de-duplicated (no standalone Home) and Validation & Export is discoverable.
- All Phase 8.7 delete guarantees intact (cascade exclusions, owner passed, recovered records disclosed).
- Full suite (lifecycle + nav tests updated), lint, build green; **125 baselines byte-identical**.

## Risks

- **Menu a11y.** The ⋮ menu needs proper `aria` menu semantics + keyboard (Esc/arrows) — write tests
  first. A bare div-on-click is not acceptable.
- **Selector-dropdown a11y (Task 4.5).** Two net-new popup widgets nest here (the switcher disclosure +
  per-row ⋮ menu). Use the disclosure-with-links pattern, NOT listbox/menu-with-controls; get focus
  management and the nested submenu right (the earlier mockup's `role="listbox"` was invalid).
- **Home consolidation scope.** Folding create-animal into a modal may be larger than the rest of Phase
  4; it's acceptable to split it into 4a (⋮ + nav) and 4b (create-animal modal) if needed.
