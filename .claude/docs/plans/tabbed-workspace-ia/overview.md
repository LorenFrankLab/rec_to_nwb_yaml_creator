# Tabbed animal workspace — IA redesign plan

**Status:** Draft for review (no code yet). **Type:** Information-architecture redesign, UI-only.

## The one structural move

Today the app has **three** disconnected surfaces for one animal's data:

1. the **Workspace** (`#/workspace`) — a sidebar of animals + one scrolling *recording-days* pane
   ([AnimalWorkspace/index.jsx](../../../../src/pages/AnimalWorkspace/index.jsx)),
2. the **Animal Editor** (`#/animal/:id/editor`) — a 4-step **wizard** for shared setup
   ([AnimalEditorStepper.jsx](../../../../src/pages/AnimalEditor/AnimalEditorStepper.jsx)), and
3. the **Day Editor** (`#/day/:id`) — a per-day stepper.

This redesign merges (1) and (2) into a single **tabbed animal workspace**: pick an animal, then move
between tabs for its recording days and its reusable animal-level setup. The Day Editor (3) stays as
the per-day drill-down, opened from the Recording Days tab.

The wizard is the wrong pattern: electrodes / cameras / DIO / recording-system are **reference data a
scientist revisits over an animal's life**, not a one-time linear flow. Tabs model revisitable data;
steppers imply "do these in order, once." Replacing the stepper with tabs is the core of this plan;
most of the requested changes are facets of it.

## Target IA

```text
Workspace  (the hub — also the post-cutover landing route, owned by v3-cutover Phase 11)
├─ Top chrome: object-selector "Workspace ▸ <animal> ▾" (animal switcher + "+ New animal…")
│              · "All animals · Batch Export" (chrome-level batch) · legacy escape
└─ Selected animal:
   ├─ Header band: name · subject_id · species · sex · ⋮ (Rename / Delete…)
   └─ LEFT section-nav (navigation landmark — aria-current links, NOT role=tablist; row = name · count · ›):
      ── Day work ──
      ├─ Recording Days        day list + "Add Recording Days" (in this view's header) + per-day ⋮/Delete
      ├─ Validation & Export   this animal's per-day readiness + export (batch lives at chrome level)
      ── Animal setup (revisitable; scope descriptor under each name) ──
      ├─ Electrode Groups      versioned physical identity — "a change here creates a new config version"
      ├─ Channel Maps          channel mapping + bad-channel marking — "edit any time"
      ├─ Recording System      data-acq identity + technical defaults — "shared across ALL days"
      ├─ Cameras               camera catalog — "referenced per day"
      ├─ DIO                   behavioral-events library — "opt in per day"
      └─ Optogenetics          implanted opto setup — status chip when unused (opto-free is valid)
      (Subject/profile facts: the header band above, not a nav item — see Phase 3.)
```

> **Navigation placement (decided this pass):** sections live in a **grouped LEFT section-nav**, and the
> animal is switched via a **top object-selector**, NOT a top tab bar over a left animal rail (that pairing
> is a double-sidebar anti-pattern). See the **Layout — DECIDED** section below for the full rationale, the
> row contract, and the affordance treatment. Routing/a11y/extraction are unchanged — throughout these docs,
> read **"tab"** as **"left section-nav item."**

Routing (decided): keep the animal hub at `#/workspace` (picker + empty state). Selecting an animal
opens the tabbed view at a **linkable per-tab route** `#/animal/:id/:tab` — e.g. `#/animal/remy/days`,
`#/animal/remy/cameras`. This **replaces** `#/animal/:id/editor` (the stepper). `#/day/:id` is
unchanged. `#/animal/:id` (no tab) redirects to the default tab `days`. The section-nav (placed on the
LEFT — see Layout — DECIDED) is a **navigation landmark** (links + `aria-current="page"`), not a
WAI-ARIA `role="tablist"` — each section is its own route, so nav semantics are the honest fit and
avoid the tablist-vs-link spec tension.

**Electrode Groups and Channel Maps are SEPARATE tabs** (decided): electrode-group identity is
versioned/append-once-referenced (a change forks a configuration version), while channel maps /
bad-channel marking are edited routinely — different blast radii, so structurally distinct tabs.

**Setup is NOT mandatory before days.** A recording day can be **behavior-only with no electrodes**
(pure behavioral tracking). The Recording Days tab must NOT gate or strongly nudge "set up electrodes
first"; setup-completeness UI reflects what *this day's content* needs to export, and an
electrode-free day is a valid, non-warning state (mirrors the opto-free-day rule).

## How the six requests map

| Request | Where it lands |
| --- | --- |
| 1. Workspace is the first screen | **Already owned by v3-cutover Phase 11** (default-route flip). Not re-planned here; this redesign just makes the landed-on hub good. |
| 2 + 3. "Add Recording Days" in the Recording Days tab | Phase 2 — the day list becomes the **Recording Days** tab; its "Add Recording Days" button sits in that tab's header (where it already is, now correctly scoped). |
| 4. Channel Maps conveys "map channels + mark bad channels" | **Phase 0 quick win** (copy-only, independent of tabs) and finalized in the dedicated **Channel Maps** tab (separate from Electrode Groups — decision 6). |
| 5. Recording system / cameras / DIO are animal-level, own screens | Phase 3 — each becomes its own tab. The model **already** stores them at the animal level; this is UI surfacing, not a data change. Honesty caveat below. |
| 6. Delete animal near New Animal | Phase 4 — **per-animal ⋮ overflow menu** on each animal card in the picker (the chosen pattern), not flush against "+ New Animal" (destructive-adjacent-to-primary is a misclick anti-pattern). |

### Honesty caveat for request 5
The three "animal-level setup" tabs do **not** apply to days identically — the UI must not imply they do:
- **Cameras** — catalog; each day references the subset it used. Genuinely selective. ✅
- **DIO** — library; a day opts in via "Use on this day." Genuinely selective. ✅
- **Recording System** — currently **one per animal, all days, no per-day version** (the Phase 8.7
  Task 3 limitation, with its "future capability" notice). *Not* selective. Keep its "shared across all
  days" framing; do not group it under a "apply to days as needed" header.

## Other UX issues folded in (beyond the six)

- **Home/Workspace nav redundancy.** "Home" is only a create-animal form, also reachable from the
  picker's "+ New Animal." Once Workspace is the hub, "create animal" becomes an action/modal from the
  picker, and the top-level "Home" tab is dropped (Phase 4 nav cleanup).
- **Validation/Export discoverability.** `#/validation` (cross-day batch readiness + export) isn't in
  the primary nav today. Surface it: a workspace-chrome nav entry and/or a per-animal "Validation &
  Export" tab (Phase 3/4).
- **Inconsistent delete affordances.** Day delete is an inline text button; animal delete is a footer
  button — two patterns for one verb. Unify under ⋮ menus (per-animal in the picker, per-day in the
  Recording Days tab).
- **"Edit Animal Setup" context switch.** The separate stepper route is a jump away from the
  workspace; folding setup into tabs removes it (Phase 5 decommission).

## Phasing

Each phase is **UI/IA-only** (no `mergeDayMetadata`/`encodeYaml`/store-shape change), ships green
(full suite, lint, build, **byte-identical golden baselines**), and lands behind the existing
`animalWorkspace` feature flag.

**Effort reality (corrected after front-end review — do not under-scope this):** the *leaf* sections
(`ElectrodeGroupsStep`, `ChannelMapsStep`, `DataAcqSection`, `CamerasSection`,
`BehavioralEventsSection`, `OptogeneticsStep`) are presentational, but the **stateful wiring lives in
their hosts** — ~290 lines in `HardwareConfigStep` (camera identity-safety, blast-radius,
`findCameraAffectedDays`/`hasUnresolvableDays`, the 3-field `RawCorruptionBanner`) and ~15 handlers in
the 953-line `AnimalEditorStepper` (electrode/channel-map auto-regen, CSV import/export,
copy-from-animal, modals). The real work is **extracting that host wiring into reusable per-tab
containers**, not "re-hosting." Phase 3 leads with the extraction; "re-host the leaf" is the trivial
part. The Phase 8.7 identity-safety / channel-regen behaviors must be preserved byte-for-byte through
the extraction (tested).

- **Phase 0 — Quick wins (independent of tabs).** Channel Maps copy ("map each channel to its
  position, and mark bad channels"); drop "Step N:" prefixes. Pure copy. Ships immediately.
- **Phase 1 — Tab shell.** A tab-bar **navigation landmark** (links + `aria-current="page"`, NOT a
  `role="tablist"`) + `#/animal/:id/:tab` routing; rewrite `useAnimalIdFromUrl` (it hard-matches
  `/editor`). Host the existing Recording Days pane in the `days` tab. The tab widget owns its OWN
  focus/SR-announce (AppLayout's route-change focus fires only on `view` change, not `:tab`). Keep the
  stepper route alive during transition; guard the single `#main-content` id.
- **Phase 2 — Recording Days tab.** "Add Recording Days" in the tab header; per-day delete → per-row ⋮
  menu; the setup checklist becomes a **"what this day needs to export"** strip — NOT a "set up
  electrodes first" gate (behavior-only days are valid).
- **Phase 3 — Setup tabs (the big one — ships as SIX PRs).** EXTRACT the host wiring into per-tab
  containers; split **Electrode Groups** and **Channel Maps** into separate tabs; Recording System /
  Cameras / DIO / Optogenetics tabs (each with a scope descriptor under its name); a home for subject/
  profile facts (`AnimalProfileSection`) and the reconfiguration context; the per-animal **Validation &
  Export** tab (a `buildRows`-filtered-by-animal view) + the mandatory per-day effective-setup review; the
  warning-acknowledgement on export. Apply the recording-system honesty caveat + opto status chip.
  Decomposed into [3-1 extract](phase-3-1-extract-wiring.md) → [3-2 ephys tabs](phase-3-2-ephys-tabs.md) →
  [3-3 catalog tabs](phase-3-3-catalog-tabs.md) → [3-4 profile/context](phase-3-4-profile-context.md) →
  [3-5 validation/export + per-day review](phase-3-5-validation-export-tab.md) →
  [3-6 warning-ack](phase-3-6-warning-ack.md); see the [Phase 3 charter](phase-3-setup-tabs.md).
- **Phase 3a — Repair-routing migration (tracked workstream).** Enumerate every `#/animal/:id/editor?field=…`
  emitter (`validation.js`, `DevicesStep.jsx`, `DayTechnicalSection.jsx`, `AnimalWorkspace/index.jsx`, …),
  redesign `ANIMAL_EDITOR_STEPS` → a **tab-keyed** map (camera and recording-system now resolve to
  DIFFERENT tabs — a deliberate granularity improvement, not a no-op), and preserve the `?field=…`
  scroll-to-and-highlight context end-to-end on the destination tab.
- **Phase 4 — Lifecycle + nav cleanup.** Per-animal ⋮ menu (Delete…/Rename) in the picker (accessible
  menu, keyboard, tooltip; remove the danger-zone footer); **commit** create-animal to an inline panel
  from the picker (not a route to Home); drop the redundant "Home" nav; surface batch Validation/Export
  in the chrome nav.
- **Phase 5 — Decommission the stepper.** Remove/redirect `#/animal/:id/editor`; delete
  `AnimalEditorStepper.jsx`; **re-home the ~1700-line stepper test suite** onto the extracted containers
  (most are handler tests, not nav tests — budget accordingly); drop the post-save `?action=create-day`
  handshake; a11y + scroll-restoration pass; QA + handoff.

## Constraints & guardrails

- **No export/store semantics change.** This is presentation only; the 125 golden baselines stay
  byte-identical and the day-used camera export binding is untouched.
- **Flag-gated.** All of it lives under `animalWorkspace`; legacy stays default until the v3 cutover.
- **Extract, don't fork.** Pull the host wiring into reusable containers both the (temporary) stepper
  and the tabs consume; do not duplicate logic. Preserve the Phase 8.7 ownership cues, blast-radius
  confirms, identity-safety dialogs, and lifecycle confirms verbatim.
- **Accessibility.** Tab bar = `role="navigation"` + `aria-current` links (decided — not a tablist).
  Net-new accessible widgets: the ⋮ overflow menu (`role="menu"`, keyboard) — no existing primitive to
  reuse. The tab widget owns focus management + SR route-change announcement across `:tab` changes.
  Per-route landmark uniqueness preserved (the v3-cutover nav contract); one `#main-content`.

## Relationship to existing plans

- **v3-workspace-cutover** owns the **default-route flip** (Phase 11) and the persistent top-nav
  (Phase 2). This redesign is **additive and flag-gated**, so it lands **before** that cutover (so the
  first impression after cutover is the tabbed hub, not the current scrolling pane). Land Phase 0
  immediately; finish Phases 1–5 before the default-route flip.
- **pre-cutover-export-correctness** (Phase 8.7, just completed) supplies the ownership model this
  redesign must preserve — the tabs are the natural home for its ownership cues.

### Sequencing vs. pre-cutover Phases 9/10/11 (decided: tabs first)

Pre-cutover Phases **9 (Playwright browser QA)**, **10 (usability/behavior audit, scored against
`workflow-screen-map.md`)**, and **11 (professional UX polish)** all audit the UI surface and the
screen map — exactly what this redesign rewrites. So **this redesign (Phases 0–5) runs FIRST**, and
pre-cutover 9/10/11 then audit/polish the **final tabbed IA** once, against the updated screen map.
Running 9/10/11 on the current stepper IA first would validate an IA being replaced and score against
a screen map about to be rewritten.

Because this redesign is **UI-only (125 baselines byte-identical, export untouched)**, the
*export-correctness substance* of pre-cutover 9/10 (validation gates + the deferred
`trodes_to_nwb → nwbinspector --config dandi → dandi validate` round-trip) is IA-agnostic and MAY run
early/in parallel to prove scientific-data safety without waiting on the IA rebuild. Three concrete
reconciliations carry into the phases:

1. **Screen-map ownership.** This redesign **updates `workflow-screen-map.md`** (new tab routes, the
   section nav, ⋮ menus, empty/loading/cold-deep-link states) in **Phase 5**, so pre-cutover 10/11
   score against the real surface, not a stale map.
2. **Unified browser scenarios.** Phase 5 supplies the **tab-based** ownership/lifecycle/repair browser
   scenarios that pre-cutover **Phase 9 (Tasks 4.5/4.6)** then runs — one scenario source, not two
   competing sets written for different IAs.
3. **A11y is built once.** The nav-tabs / ⋮-menu / focus-management a11y is implemented in these phases
   and **audited** (not re-implemented) by pre-cutover Phase 11 and v3-cutover Phase 10 (a11y-keyboard).

Full target order: `8.7 → tabbed 0 → (export-safety substance of 9/10, parallel) → tabbed 1–5
(updates the screen map) → pre-cutover 9/10/11 UX on the tabbed IA → v3-cutover Phase 11 cutover`.

## Resolved decisions

1. **Route shape** — `#/animal/:id/:tab` (linkable per-tab; replaces `#/animal/:id/editor`). ✅
2. **Validation & Export** — **both**: a per-animal "Validation & Export" tab AND a workspace-chrome nav
   entry for cross-animal batch export (batch needs a home above any single animal). ✅
3. **Sequencing vs. cutover** — **finish tabs (Phases 1–5) before** the v3-cutover default-route flip,
   so the first impression after cutover is the tabbed hub. Phase 0 ships immediately. ✅
4. **Day Editor boundary** — `#/day/:id` stays the per-day drill-down, opened from the Recording Days
   tab. Pulling day editing into the tab is explicitly **out of scope** for this plan. ✅
5. **Tab a11y semantics** — the tab bar is a **navigation landmark** (`role="navigation"` + `aria-current`
   links), **not** a WAI-ARIA `role="tablist"` — each tab is its own route, so nav is the honest fit. ✅
6. **Electrode Groups & Channel Maps are separate tabs** — different blast radii (versioned identity vs
   routine bad-channel edits). ✅
7. **No mandatory setup gate** — a behavior-only day with no electrodes is valid; the Recording Days tab
   shows what *this day* needs to export, never a blanket "set up electrodes first." ✅
8. **Setup guidance is preserved, not lost to tabs** — the current app's checklist tells a new user what
   to add (subject / electrodes / cameras / recording system / DIO). Tabs alone would lose that, so a
   **prominent first-run "Set up this animal" checklist** shows on the Recording Days view while setup is
   incomplete, collapsing once established (Phase 2.3), and never-configured sections wear a neutral
   **hollow ○ "todo" ring** in the section-nav. Guidance is strong; it is still not a hard gate (decision
   7 holds). ✅ **Reconciled with decision 11 (dots are blocking-only):** the section-nav does NOT carry
   ambient green "done" / amber "review" completion dots (they manufactured anxiety on established
   animals and duplicated the removed canvas strip). Onboarding signal = hollow ○ on never-configured +
   the first-run checklist; established-animal signal = blocking-red only. *(from prototype review —
   equal-looking empty tabs hid the "what do I need to add?" affordance; the interactive design pass then
   showed colored completion dots over-corrected into ambient homework.)*
9. **Navigation placement: top object-selector + left grouped section-nav** — NOT a top tab bar over a
   left animal rail (double-sidebar anti-pattern). The animal is switched from a top `Workspace ▸ <animal> ▾`
   dropdown; the sections are a grouped left nav. Routing (`#/animal/:id/:tab`), nav-landmark a11y
   (decision 5), scope descriptors, and the Phase 3 extraction all carry over. See Layout — DECIDED. ✅
10. **Section-nav row affordance: name · count · chevron, grouped, with dividers** — each row carries a
    right-aligned **count** (information scent: 8 electrode groups, 2 cameras, …) and a trailing **›**
    so it reads as a navigable button at rest. Icons were tried and dropped (abstract glyphs weren't
    recognizable). Active row = teal fill + inset bar. ✅
11. **Status dots are blocking-only** — a section-nav row shows a colored dot ONLY when it **blocks
    export** (red). No ambient green/amber completion dots. Three states: never-configured ○ (neutral
    todo) · configured-and-fine (no dot) · blocks-export ● red. ✅
12. **Recording-day row = triage, not inspection** — bare **date** (anchor) + muted **session description**
    (if present) + one **plain-language status** (`Draft` / `Ready to export` / `Exported` / `Needs
    fixing — {reason}`) + one **action** + a conditional **older-electrode-setup flag** (only when the day
    is pinned to a non-current config version). `session_id`, camera count, opto state, and the raw config
    version NUMBER move OFF the row into the day / export preflight (the dense "scan line" is retired).
    Date-ordered, newest-first for now. **Depends on the per-day effective-setup review** (Task 3.3a, now
    shipped in [phase 3-5](phase-3-5-validation-export-tab.md)) — that's where the retired scan detail
    relocates; removing it from the row before that review exists would regress the valid-but-wrong defense
    (requirement 1). ✅
13. **Animal delete gets a type-to-confirm gate; day delete does not** — deleting an animal is the
    highest-blast-radius, irreversible action (wipes the whole shared setup + every recording day at once),
    so its confirm disables "Delete animal" until the user types the animal `id`. Per-day delete keeps the
    plain Cancel/Delete confirm — the asymmetry is deliberate (friction matched to stakes; routine actions
    must not train users to ignore confirms). Presentation layer over the existing `deleteAnimal`; cascade
    + downloaded-artifacts caveat unchanged. Shared by the header ⋮ and the selector-dropdown row. ✅
    *(Phase 4 Task 4.1a — a deliberate divergence from "reuse the Phase 8.7 confirm verbatim," animal-only.)*

## Review outcomes (UX + front-end, folded in)

Two independent reviews ran against the draft. Both endorsed the core tabs-over-wizard direction.

- **UX review (rated NEEDS_POLISH → addressed):** the biggest flagged risk — "scientist creates days
  against unconfigured electrodes, fails at export" — was **resolved by a domain correction**: behavior
  -only days need no electrodes, so there is no mandatory-setup failure mode (decision 7). Also folded
  in: scoped names for the dual Validation/Export surfaces ("This animal — readiness & export" vs
  "All animals — batch export"), per-tab scope descriptors visible before clicking, an opto status chip
  so an unused-opto tab doesn't read as an error, a firm per-group bad-channel count (Phase 0), and
  configuration-version legibility (human-readable "changed on [date], days before/after use v1/v2").
- **Front-end review (structure endorsed; effort re-scoped):** "re-host unchanged" understated the
  work — the real task is **extracting host wiring** (Phase 3) and a **wide repair-routing migration**
  (new Phase 3a: `?field=` emitters in 4+ files, `useAnimalIdFromUrl` hard-matches `/editor`, 4-step→
  tab-keyed label remap), and the **~1700-line stepper test suite** must be re-homed, not ported
  (Phase 5). The tab-a11y tension is resolved by decision 5 (nav + `aria-current`, not tablist).
  Net-new ⋮ menu widget; tab widget owns focus across `:tab` changes; one `#main-content`; loading/
  mid-load + unsaved-modal-on-tab-switch states specified per phase.

## Layout — DECIDED (top object-selector + grouped left section-nav)

> **Status:** **decided** after an interactive design pass. Reference renders — the committed source is the
> HTML in [alternatives/](alternatives/); open any file in a browser to view it. (PNG previews are generated
> locally into `screenshots/` and are **gitignored** — not committed, to keep history lean.)
>
> - [recommended-left-nav.html](alternatives/recommended-left-nav.html) — the canonical full screen
>   (chrome, section-nav, Recording Days);
> - [row-treatments.html](alternatives/row-treatments.html) — the day-row contract (decision 12);
> - [nav-affordance.html](alternatives/nav-affordance.html) — the nav-item affordance study (decision 10);
> - [other-screens.html](alternatives/other-screens.html) — Electrode Groups, Cameras, Validation & Export,
>   and the new-animal first-run state;
> - [other-screens-2.html](alternatives/other-screens-2.html) — Channel Maps, Recording System, DIO,
>   Optogenetics (unused);
> - [delete-animal.html](alternatives/delete-animal.html) — the ⋮ menu + type-to-confirm delete (decision 13);
> - [selector-dropdown.html](alternatives/selector-dropdown.html) — the animal switcher open (per-row ⋮ /
>   Rename / Delete · "+ New animal…").
>
> This **supersedes** the earlier "Layout 1 — left rail + top tabs" working assumption. The four-layout
> exploration (left rail + top tabs / animal→sections tree / status dashboard / Days·Setup·Export
> mode-switch) is **closed**, and its superseded skin/layout/nav explorations have been removed from
> `alternatives/`. **Every destination and chrome state is now drawn.**

The committed structure is a **top object-selector for the animal + a grouped LEFT section-nav** (decision
9). It deliberately is **not** a top tab bar over a left animal rail — that pairing puts two competing
columns on the left (double-sidebar anti-pattern) and pushes 8 sections past the ≤5-peer guideline for top
tabs. Promoting the animal switcher to a top selector frees the left column for one clean section-nav.

### Chrome (top bar)

- Brand · **object-selector** `Workspace ▸ <animal> ▾` — a dropdown animal switcher that REPLACES the left
  animal rail. Lists animals with a per-row day count + **"+ New animal…"**.
- Right: **All animals · Batch Export** (chrome-level cross-animal batch, decision 2) · `legacy →` escape.

### Animal header band

Name · `subject_id` badge · **species · sex**. **No DOB**, **no "shared setup · affects all days" cue**
(both removed as clutter this pass). A `⋮` menu carries Rename / Delete animal (decision 6 / Phase 4).

### Left section-nav (replaces the top tab bar — same routes, same a11y)
Grouped under `glabel` headers; each row = **name · count · ›** with hairline dividers, so every row reads
as a navigable button at rest (decision 10 — information scent + chevron signifier; icons were tried and
dropped). Active row = teal fill + `inset 3px` bar.

- **Day work**: Recording Days (count) · Validation & Export (N ready)
- **Animal setup**: Electrode Groups (n) · Channel Maps (n) · Recording System (n) · Cameras (n) · DIO (n)
  · Optogenetics (off / used)

Only **placement** changed from the "tab" decisions — routing (`#/animal/:id/:tab`), nav-landmark +
`aria-current` a11y (decision 5), per-section scope descriptors, and the Phase 3 host-wiring extraction all
carry over. **Read "tab" as "left section-nav item" throughout the phase docs.**

### Status dots — blocking-only (decision 11)

A nav row shows a **red dot only when that section blocks export** (e.g. a camera missing meters/pixel). No
amber "review" or green "done" dots on an established animal (they manufactured ambient anxiety and
duplicated the now-removed canvas setup strip). New-animal onboarding survives via a neutral **hollow ○
todo ring** on never-configured sections + the first-run checklist (decision 8 / Phase 2.3). The per-row
**count** conveys neutral setup state without a colored dot.

### Recording-day row contract (decision 12 — Phase 2)

A list row is for **triage, not inspection**; it answers three questions and no more:

- **which day** → **bare date** (anchor; date-ordered, newest-first for now) + the day's **session
  description** muted underneath *only when present* (bare date alone reads fine — the description is a
  recognition aid, never a hole when absent);
- **what's my job** → one **plain-language status**: `Draft — not yet validated` / `Ready to export` /
  `Exported` / `Needs fixing — {reason}` (blocking reason inline, in the scientist's words);
- **how do I act** → one affordance: **open** / **Fix in {section} →**.
- Conditional: an amber **older-electrode-setup flag**, shown ONLY when the day is pinned to a non-current
  configuration version ("recorded before you lowered the CA1 tetrodes (Jun 20)") — the one silent-bite
  triage must surface unprompted (the valid-but-wrong defense, in plain language — requirement 1/3).

**Moved OFF the row → into the day / export preflight** (inspection, not triage): `session_id`/filename,
camera count, opto state, and the raw **config version NUMBER** ("v2" is meaningless to a scientist —
surface the dated description instead, Phase 3.4). This **retires the dense "scan line"** (`config v2 · N
cameras · opto-state`), which over-served day-to-day diffing at the cost of legibility; the diff power
relocates to the per-day effective-setup review (requirement 1) / an opt-in "Compare days."

> **Parked (not decided):** whether **blocked days float to the top** of the day list regardless of date so
> "needs me" always beats "newest." Date-order (newest-first) holds for now.

The cross-cutting correctness requirements below hold under this layout (they were always layout-independent).

## Cross-cutting correctness requirements (from the journey/failure analysis)

The deeper finding — see [user-journeys-failure-analysis.md](user-journeys-failure-analysis.md) (three
cadences, a mistake/recovery table per cadence, a hypothesis tree with confidence + a calibration log) —
is that **the highest-severity residual risk is layout-independent.** Most bad *values* are already
prevented or canonicalized (controlled `device_type`/`species`/refs; region snapped to canonical on save).
The irreducible residual is **valid-but-wrong**: a value that passes every rule but is semantically wrong
(wrong camera/version/day; misattribution after time passes) — which **no validation can catch, only
review.** These requirements therefore matter more than the layout choice and must be first-class:

1. **Mandatory "effective setup for *this day*" review** — distinct from the animal's *current* setup tabs.
   A historical day is pinned to an older config version; the setup tabs show the latest. The day context
   must surface what *that day* actually used (pinned version, referenced cameras, electrodes, failed
   channels) — read-only, clearly labelled vs. "current shared setup." (Builds on Phase 8.7's
   `DayTechnicalSection`/effective values; the Validation & Export tab is its home — Phase 3.3.)
2. **Close the warning-escape on export** — verified: export gates on errors, **not warnings**, and a
   batch export can ride a non-blocking warning (e.g. an imported region-case issue) across N days. Batch
   export must require **explicit acknowledgement** of warnings, not just a count. (Phase 3.3 / export flow.)
3. **Configuration-version boundaries legible** — "changed [date] — days before use v1, after use v2" — to
   blunt wrong-version attribution. (Phase 3.4, already listed.)
4. **Reduce day↔setup round-trips** — let the day editor's reference pickers **create-new in place**
   ("+ set up a camera" from the day's camera selector) so logging a day doesn't force a trip out to the
   Cameras tab and back. (Day-editor enhancement; note the boundary — `#/day/:id` is the separate
   drill-down per decision 4, so this is a *coordinating* requirement, flagged not owned here.)
5. **Surface the DIO "Use on this day" opt-in** — an animal library event not opted-into a day is silently
   absent from export; weakly surfaced today. (Phase 2 / day editor.)
6. **Reinforce the blast-radius signal on setup tabs** — Layout 1's day/setup seam is a tab-group label, so
   lean on the Phase 8.7 ownership cues + a persistent "shared setup — affects all days" affordance when a
   setup tab is active. (Phase 3.)

## Per-phase detail

See [phase-0-quick-wins.md](phase-0-quick-wins.md), [phase-1-tab-shell.md](phase-1-tab-shell.md),
[phase-2-recording-days-tab.md](phase-2-recording-days-tab.md), and the **Phase 3 charter**
[phase-3-setup-tabs.md](phase-3-setup-tabs.md) — which routes to its six sub-phases
[3-1](phase-3-1-extract-wiring.md) · [3-2](phase-3-2-ephys-tabs.md) · [3-3](phase-3-3-catalog-tabs.md) ·
[3-4](phase-3-4-profile-context.md) · [3-5](phase-3-5-validation-export-tab.md) ·
[3-6](phase-3-6-warning-ack.md) — then [phase-3a-repair-routing.md](phase-3a-repair-routing.md),
[phase-4-lifecycle-nav.md](phase-4-lifecycle-nav.md), [phase-5-decommission-stepper.md](phase-5-decommission-stepper.md).
