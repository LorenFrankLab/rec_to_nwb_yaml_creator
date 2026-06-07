# Phase 2 — Recording Days tab

**Finalize the day list as a first-class tab and make its actions/affordances consistent.**

> **Layout locked (overview → Layout — DECIDED, decisions 9–12):** this is a **left section-nav item**, not
> a top tab. The day **row contract is decided** — see Task 2.5. The reference render is
> [alternatives/recommended-left-nav.html](alternatives/recommended-left-nav.html) /
> [alternatives/row-treatments.html](alternatives/row-treatments.html).

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
- **Task 2.3 — Setup guidance: a prominent first-run checklist that collapses when established.** The
  current "Animal setup" checklist ([index.jsx:410-443](../../../../src/pages/AnimalWorkspace/index.jsx))
  is what makes "you need to add subject / electrodes / cameras / recording system / DIO" unmistakable;
  the tabbed IA must **keep that guidance, not lose it to equal-looking empty tabs.** So:
  - **When setup is incomplete** (esp. a new animal with no days), the Recording Days tab leads with a
    prominent **"Set up this animal"** card: a per-item grid (Subject / Recording System / Electrode
    Groups / Channel Maps / Cameras / DIO) each showing state (`not started` / `complete` / `needs
    review`) and a **"Set up →"** CTA linking to its tab. It pairs with the section-nav's neutral
    **hollow ○ "todo" rings** on never-configured sections (decision 11 — NOT colored completion dots).
  - **When established** (setup done, days exist), it collapses to the compact strip linking to the tabs.
  - **Behavior-only stays honest (decided):** the card frames items as "only the pieces your sessions
    use" (`Electrode Groups — if ephys`, `Cameras — if video`, `DIO — if behavioral events`), and the
    per-day readiness reflects what *that day's content* needs to export — never a hard gate or a blanket
    "set up electrodes first." A behavior-only, electrode-free day shows no electrode warning.
  - All states read from the same `getAnimalSetupChecklist`
    ([workflowStatus.js](../../../../src/domain/workflowStatus.js)) — display change only.
- **Task 2.4 — Empty/first-run state.** When the animal has no days, the tab guides to "Add Recording
  Days"; when setup is incomplete, the checklist strip points at the missing tab. Preserve the existing
  recovered/orphan/wrong-owner day rows and their repairs (Phase 8.7) unchanged.
- **Task 2.5 — Day-row contract (decided — overview decision 12).** Each healthy day row is **triage, not
  inspection**: bare **date** (anchor) + the day's **`session.session_description`** muted underneath *only
  when present* (truncate with ellipsis); one **plain-language status** derived from the Phase 8.7 chip
  (`Draft — not yet validated` / `Ready to export` / `Exported` / `Needs fixing — {reason}`, the blocking
  reason inline); one **action** (`open` / `Fix in {section} →` deep-linking via Phase 3a); and a
  conditional amber **older-electrode-setup flag** ONLY when the day is pinned to a non-current
  `configurationVersion` (plain-language, dated — "recorded before {description} ({date})", Phase 3.4).
  - **Retire the dense scan line.** `session_id`/filename, **camera count**, **opto state**, and the raw
    **config-version number** move OFF the row — they are inspection detail surfaced inside the day / at
    export preflight (requirement 1), not triage. (This supersedes the Phase 8.7 Task 10 batch-row scan as
    a *row* surface; the scan fields still exist for the per-day effective-setup review.)
  - Status is **display-only** over the existing `deriveChip(computeStepStatus(...))` + `describeDayOptoState`
    — no new validation, no store change. List stays **date-ordered (newest-first)**; "blocked floats to
    top" is parked (overview).
- **Task 2.6 — Recording-day row: no `session_id` on the row.** Inside a single animal the `remy_20230622`
  string is just the date restated with the animal prefix (redundant in-context); its only value is the
  downstream filename, which belongs in the day / preflight. Confirm no row test asserts the session_id
  string before removing it from the row surface.

## Acceptance

- The Recording Days tab shows the day list + "Add Recording Days" in its header; per-day delete is a ⋮
  menu using the existing destructive confirm; the checklist strip links to the setup tabs.
- Each day row matches the decided contract (date · description-if-present · plain status · one action ·
  conditional older-setup flag); the dense scan line / `session_id` are gone from the row; status is
  display-only over the existing chip derivation (no validation/store change).
- All Phase 8.7 day-row guarantees intact: recovered/orphan/wrong-owner rows still surface with their
  repairs; delete cascade/caveat copy unchanged; `deleteDay(dayId, ownerAnimalId)` still passed the
  owner.
- Full suite (updated for the ⋮ affordance), lint, build green; **125 baselines byte-identical**.

## Notes

- This phase removes the day pane's "Edit Animal Setup" link (its destinations are now tabs) — confirm
  no test depends on it before deleting.
