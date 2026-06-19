# Phase 5 — IA & copy polish

[← back to PLAN.md](PLAN.md) · [overview](overview.md)

The remaining lower-impact findings, grouped into one reviewable cleanup PR: redundant
supplemental-files headings/copy (#7), the marginal in-content sub-nav (#9), per-row action density
(#10), and the dead "Camera(s)" column (#11). No behavior changes — markup, copy, and conditional
rendering only.

**Inputs to read first:**

- [src/pages/DayEditor/TasksFilesSection.tsx:50-73](../../../../src/pages/DayEditor/TasksFilesSection.tsx)
  — the supplemental-files `<section>`: an h2 + intro + a "N files" badge, immediately wrapping…
- [src/pages/DayEditor/AssociatedFilesEditor.tsx:166-173](../../../../src/pages/DayEditor/AssociatedFilesEditor.tsx)
  — …a nested h3 "Supplemental file rows" + near-duplicate hint ("Optional files outside generated
  statescripts and videos").
- [src/pages/DayEditor/TasksFilesSection.tsx:39-46](../../../../src/pages/DayEditor/TasksFilesSection.tsx)
  — the in-content sub-nav ("Epochs" / "Supplemental files N") that only smooth-scrolls.
- [src/pages/DayEditor/EpochsTab.tsx:1107-1153](../../../../src/pages/DayEditor/EpochsTab.tsx) — the
  per-row action group (move up / move down / delete / `⋯` menu) and the `⋯` menu items (Insert /
  Duplicate).
- [src/pages/DayEditor/EpochsTab.tsx:781,1101-1106](../../../../src/pages/DayEditor/EpochsTab.tsx) —
  the conditional Opto column header + the always-rendered Camera(s) column.

## Tasks

- **(#7) Collapse the duplicate supplemental headings.** Keep one heading + one hint. Recommended:
  keep the outer `<h2>Supplemental files</h2>` + its intro in `TasksFilesSection` and the count badge;
  drop the inner `<h3>Supplemental file rows</h3>` + its hint in `AssociatedFilesEditor`
  (`AssociatedFilesEditor.tsx:167-173`) — or make the editor headingless and rely on the section's
  `aria-labelledby`. Ensure the editor's `<section aria-labelledby>` still points at a real heading id
  (re-point to the outer h2's id, threaded as a prop) so the landmark stays labelled. Keep exactly one
  count (the section badge); the sub-nav chip count is addressed below.
- **(#9) Drop or demote the in-content sub-nav.** For a two-section surface, the rail already names
  "Tasks & Files". Remove the `tasks-files-subnav` (`TasksFilesSection.tsx:39-46`). If a jump-to-
  supplemental affordance is still wanted, replace it with a single quiet "Jump to supplemental files
  (N)" link shown only when supplemental files exist — not a persistent two-item nav that duplicates
  the page's own headings. (Decide one; don't keep both the nav and a new link.)
- **(#10) Calm the row action group.** Fold "Move up"/"Move down" into the `⋯` menu alongside the
  existing Insert/Duplicate (`EpochsTab.tsx:1148-1153`), leaving the row with Delete + `⋯` (Delete
  stays inline since it's destructive-but-common; or move it into `⋯` too if the team prefers — pick
  one and note it). Keyboard reorder (the move actions) stays available via the menu items with the
  same `aria-label`s. This narrows the `menuCell` width (`EpochsTab.module.css:180-184`).
- **(#11) Conditional Camera(s) column.** The column is `—` for every row when no task defines
  cameras. Render the `Camera(s)` header (`EpochsTab.tsx:780`) and cells (`:1101-1105`) only when some
  row has cameras (`grid.rows.some(r => r.cameras.length > 0)`), exactly as the Opto column is gated
  by `hasOpto` (`:781`). Adjust the `colSpan`/empty-state rows accordingly.
- **Copy pass.** While here, ensure the two intros that survive don't both say "outside generated
  statescripts and videos"; keep that phrase once.

## Deliberately not in this phase

- Any color/severity change — that's [Phase 1](phase-1-status-color-severity.md).
- Restructuring the rail or the section set — out of scope (other IA plans own that).
- Changing the supplemental-file presets or their seeded names.

## Validation slice

| Test | Asserts |
| --- | --- |
| `TasksFilesSection` — single heading | Exactly one supplemental-files heading renders; the editor's landmark is still labelled (`aria-labelledby` resolves). |
| `TasksFilesSection` — sub-nav removed/demoted | The persistent two-item sub-nav is gone; if a jump link exists, it renders only when supplemental files exist. |
| `EpochsTab` — row actions | A row exposes Delete + `⋯`; the menu contains Insert / Duplicate / Move up / Move down with their `aria-label`s; reorder still works via the menu. |
| `EpochsTab` — camera column conditional | A day whose tasks define no cameras renders no "Camera(s)" column; a day with cameras renders it. |
| `baselines` | byte-identical. |

## Fixtures

Reuse existing Tasks & Files fixtures. Add one fixture day whose tasks define a camera (to assert the
column appears) alongside the no-camera default (to assert it's hidden). No real-data slice.

## Review

Dispatch `code-reviewer` against the diff. Confirm:
- One heading, one hint, one count for supplemental files; landmark still labelled (axe clean).
- Reorder remains keyboard-reachable after moving the move-actions into `⋯` (a11y not regressed).
- The Camera(s) column gates exactly like Opto (`colSpan` math correct in empty/filter states).
- "Deliberately not in this phase" honored (no color/IA-structure creep).
- `baselines` byte-identical; no plan references in code/tests.
