# Phase 2 — Recording Days tab

**Finalize the day list as a first-class tab and make its actions/affordances consistent.**

## Goal

The `days` tab reads as "the recording days for this animal," with "Add Recording Days" in the tab
header, per-day delete on a consistent ⋮ affordance, and the setup checklist reframed as a tab-
completeness overview rather than a competing pane.

## Tasks

- **Task 2.1 — "Add Recording Days" in the tab header.** Keep the calendar toggle button
  ([AnimalWorkspace/index.jsx:364-371](../../../../src/pages/AnimalWorkspace/index.jsx)) but anchored in
  the Recording Days tab's own header, not a shared workspace header. (Functionally it already lives in
  the day header; this scopes it to the tab and drops the now-redundant "Edit Animal Setup" link — that
  destination is now the sibling tabs.)
- **Task 2.2 — Per-day delete via ⋮ menu.** Replace the inline `Delete day…` text button
  ([index.jsx:623-641](../../../../src/pages/AnimalWorkspace/index.jsx)) with a per-row ⋮ overflow menu
  (Delete recording day…, future: Duplicate). Same destructive `ConfirmDialog` (named day + cascade +
  the downloaded-artifacts caveat) — **reuse the Phase 8.7 confirm verbatim**, only the trigger
  affordance changes. This unifies the day-delete and animal-delete patterns (Phase 4 gives animals the
  same ⋮). **Discoverability for non-developers:** the ⋮ trigger carries a visible tooltip ("More
  actions"), is keyboard-operable (`role="menu"`, Enter/Esc/arrows), the destructive item reads
  "Delete this day…" and is colour-differentiated. (Consider a labelled "More" affordance over a bare
  ⋮ glyph for this audience — A/B in the browser pass.)
- **Task 2.3 — Setup-completeness strip = "what this day needs to export", NOT a setup gate.** The
  current "Animal setup" checklist ([index.jsx:410-443](../../../../src/pages/AnimalWorkspace/index.jsx))
  becomes a compact strip linking to the setup tabs (`#/animal/:id/:tab`), keeping the
  `getAnimalSetupChecklist` domain source ([workflowStatus.js](../../../../src/domain/workflowStatus.js)).
  **Critical framing (decided):** a recording day can be **behavior-only with no electrodes** — so the
  strip must NOT block "Add Recording Days" or imply "set up electrodes first." It reflects what *this
  day's content* needs to export (e.g. a day referencing a camera needs that camera's calibration; an
  electrode-free day needs no electrodes and shows no electrode warning). Frame missing items as
  informational with a CTA ("This day references camera 2 — set its calibration"), never a hard gate.
- **Task 2.4 — Empty/first-run state.** When the animal has no days, the tab guides to "Add Recording
  Days"; when setup is incomplete, the checklist strip points at the missing tab. Preserve the existing
  recovered/orphan/wrong-owner day rows and their repairs (Phase 8.7) unchanged.

## Acceptance

- The Recording Days tab shows the day list + "Add Recording Days" in its header; per-day delete is a ⋮
  menu using the existing destructive confirm; the checklist strip links to the setup tabs.
- All Phase 8.7 day-row guarantees intact: recovered/orphan/wrong-owner rows still surface with their
  repairs; delete cascade/caveat copy unchanged; `deleteDay(dayId, ownerAnimalId)` still passed the
  owner.
- Full suite (updated for the ⋮ affordance), lint, build green; **125 baselines byte-identical**.

## Notes

- This phase removes the day pane's "Edit Animal Setup" link (its destinations are now tabs) — confirm
  no test depends on it before deleting.
