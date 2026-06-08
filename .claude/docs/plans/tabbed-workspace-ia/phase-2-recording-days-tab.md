# Phase 2 — Recording Days tab (re-scoped after Phase 1)

**Polish the `days`-tab content: day-row legibility + first-run onboarding.** Phase 1 already did the
heavy lifting this phase originally assumed (extracting the pane, hosting it in the tab, the empty/
recovered states, and the onboarding *signal*), so Phase 2 is now **smaller and more focused** than the
original draft.

> **Layout locked (overview → Layout — DECIDED, decisions 9–12).** Reference renders:
> [alternatives/recommended-left-nav.html](alternatives/recommended-left-nav.html) /
> [alternatives/row-treatments.html](alternatives/row-treatments.html).

## What Phase 1 already delivered (do NOT redo)

- The recording-days pane is **[src/pages/AnimalWorkspace/RecordingDaysTab.jsx](../../../../src/pages/AnimalWorkspace/RecordingDaysTab.jsx)**
  (shared via the architecture cross-page allowlist), hosted by `AnimalView` at `#/animal/:id/days`.
  **"Add Recording Days" is already in its header.**
- The empty-days state, the recovered / orphan / wrong-owner day rows and their repairs, and BOTH delete
  confirms (animal + day, with the downloaded-artifacts caveat) carried over **verbatim** — Phase 8.7
  guarantees intact.
- The section-nav already shows the onboarding signal: **hollow-○ todo rings** via
  [getAnimalSectionStatus](../../../../src/domain/sectionStatus.js) (decision 11).

## Corrected premises (the original draft was stale — read before trusting old task text)

1. **File/line refs that pointed at `AnimalWorkspace/index.jsx` now target `RecordingDaysTab.jsx`** (the
   pane moved in Phase 1; `AnimalWorkspace` is now a ~90-line picker).
2. **"All states read from `getAnimalSetupChecklist` — display change only" is FALSE.** That helper has
   **5** items (subject / electrodes / cameras / data_acq / days), not the 6 split sections. Use Phase 1's
   **`getAnimalSectionStatus`** for the per-section todo state.
3. **The "dense scan line" the old Task 2.5 wanted to "retire" was never in these rows.** `config v2 · N
   cameras · opto` lived in the **ValidationSummary batch rows** (Phase 8.7 Task 10); the days-tab rows only
   ever showed `date + session_id + state chips` ([RecordingDaysTab.jsx:524-533](../../../../src/pages/AnimalWorkspace/RecordingDaysTab.jsx)).
   Retiring that scan line + its "hard dependency on Task 3.3a" belongs to **Phase 3.3** (the per-animal
   Validation & Export tab), NOT here.

## Tasks — DO NOW (independent, real value)

- **Task 2.1 — Remove the "Edit Animal Setup" link from the day-tab header.**
  [RecordingDaysTab.jsx:279](../../../../src/pages/AnimalWorkspace/RecordingDaysTab.jsx) still has it
  (extracted verbatim); its destinations are the setup tabs now. Drop it; keep "Add Recording Days".
- **Task 2.5a — Plain-language day-row status.** Replace the `Draft / Validated / Exported` status-chip
  cluster ([RecordingDaysTab.jsx:531-533](../../../../src/pages/AnimalWorkspace/RecordingDaysTab.jsx)) with
  ONE plain-language status. The stored-state mapping is **display-only** (`draft → "Draft — not yet
  validated"`, `validated && !exported → "Ready to export"`, `exported → "Exported"`).
  - **Live "Needs fixing — {reason}" is the one new bit:** today the row shows *stored* flags, which can go
    stale (a day validated before a camera broke still reads "Validated"). An honest `Needs fixing` needs a
    per-row read of `computeStepStatus(record, mergeDayMetadata(animal, record), animal)` — **read-only**,
    the SAME validation `collectAnimalSetupIssues` already runs at the animal level; just per-row. If that
    grows the task, it MAY slip to Phase 3.3 (which validates per day anyway) — decide at build time, but
    prefer doing it here so the row is honest.
- **Task 2.5b — Muted session description.** Show `session.session_description` muted under the date *only
  when present* (truncate with ellipsis) — a recognition aid. Bare date alone must still read fine.
- **Task 2.6 — Drop `session_id` from the row.** [:524](../../../../src/pages/AnimalWorkspace/RecordingDaysTab.jsx)
  — inside one animal it's just the date with the animal prefix (redundant); its only value (the downstream
  filename) belongs in the day / preflight. Confirm no row test asserts the `session_id` string first.
- **Task 2.3 — First-run "Set up this animal" card, de-duped against the nav rings.** For a NEW/
  under-configured animal, lead the days tab with a prominent **"Set up this animal"** card: a per-section
  grid (Subject · Recording System · Electrode Groups · Channel Maps · Cameras · DIO · Optogenetics), each
  showing todo-vs-done via **`getAnimalSectionStatus`** + a "Set up →" link to that section's tab. Honest,
  non-gating framing ("Electrode Groups — if ephys", "Cameras — if video", "DIO — if behavioral events");
  **behavior-only days are valid** (no "set up electrodes first" gate; an electrode-free day shows no
  electrode warning).
  - **Reconcile with the section-nav (don't show "todo" three ways):** the card is the LOUD first-run
    affordance; the nav rings are the persistent ambient one. **When established** (setup done + days
    exist), the card disappears — the nav rings + setup tabs suffice; do **not** add a redundant
    "established strip".
  - This **replaces/reframes** the existing in-pane `getAnimalSetupChecklist` "Animal setup" section
    ([:310](../../../../src/pages/AnimalWorkspace/RecordingDaysTab.jsx)). Keep the separate **"Review
    existing data"** state (recovered/imported review) — that's a different concern from onboarding.

## Tasks — DEFER / MERGE (depend on later phases — do NOT build standalone here)

- **Per-day delete via ⋮ menu** (orig. Task 2.2) → **merge into Phase 4 (Task 4.1's ⋮ widget).** The
  current inline "Delete day…" button stays until the shared, accessible `role="menu"` widget is built
  once; then BOTH day- and animal-delete adopt it (consistent affordance, one widget, one a11y pass).
  Building a net-new menu for a single action, standalone, isn't worth it.
- **`Fix in {section} →` row action** (part of orig. Task 2.5) → **after Phase 3a** (repair-routing-to-tabs).
  Until then a `needs-fixing` row links to the day editor as today.
- **Older-electrode-setup flag** (part of orig. Task 2.5) → **with Phase 3.4 / 3a.** Needs new derivation
  (join the day's `configurationVersion` to the *next* `ConfigurationSnapshot.{date,description}`); valuable
  (the silent-bite defense) but it pairs naturally with the config-version legibility work in Phase 3, and
  it does not block the legibility work here.

## Acceptance (re-scoped)

- Day-tab header: "Add Recording Days", **no** "Edit Animal Setup" link.
- Each day row: **bare date (anchor) + muted session description (if present) + one plain-language status**;
  no `session_id`, no status-chip cluster. The draft/validated/exported mapping is display-only; if the
  live `Needs fixing` state lands here, it's read-only over `computeStepStatus` (no validation/store change).
- A new/under-configured animal leads with the **"Set up this animal"** card (per-section via
  `getAnimalSectionStatus`, honest if-ephys/if-video framing, links to tabs); it's de-duped against the nav
  rings and **absent once established**. Behavior-only days raise no electrode warning.
- All Phase 8.7 day guarantees intact: recovered/orphan/wrong-owner rows + repairs; both delete confirms +
  cascade/caveat copy; `deleteDay(dayId, ownerAnimalId)` still passed the owner.
- Full suite, lint, build green; **125 golden baselines byte-identical** (UI-only — no store/export change).

## Notes

- Deferred-and-tracked: per-day ⋮ (Phase 4), `Fix in {section}` action (Phase 3a), older-setup flag
  (Phase 3/3a). The day-row scan-line retirement is Phase 3.3 (ValidationSummary), not this phase.
- Reuse, don't re-derive: status over `computeStepStatus` (the day editor's own gate), per-section state
  over `getAnimalSectionStatus`. No new validation logic, no store/export touch.
