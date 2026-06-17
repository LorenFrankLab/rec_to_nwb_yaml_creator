# UX Live Walkthrough — rec_to_nwb_yaml_creator (modern branch)

**Date:** 2026-06-17  
**Branch:** `epoch-editor-phase-8`  
**Method:** Playwright MCP browser drive of http://localhost:3000 (Vite dev server).  
**Test animal created:** `UXTEST01` (throwaway; existing `remy` not modified).  
**Reference documents read:** `action-by-action-ux.md`, `ux-principles.md`, `mental-model-and-ui.md`, `07-current-app-audit.md`.

Screenshots saved to `.playwright-mcp/` (gitignored). Screen/snapshot refs cited inline.

---

## Verification corrections (main-thread spot-check of source)

Three high-impact findings were re-checked against the live source and **refined** (the rest hold):

1. **"Default route is the legacy form" (J1, H) — reclassify from defect to *known pending cutover*.**
   `src/layouts/AppLayout.tsx:201-202` documents it: the v3 cutover is a deliberate later switch that
   flips `animalWorkspace`/`newDayEditor` and changes the *default* route to the workspace; today it's
   reachable at `#/workspace`. So this is "flip the cutover flag when ready," not a UX bug. (It does mean
   all UX evaluation here is of the `#/workspace` app, which is correct.)
2. **"11 AJV strings leak verbatim" (J3, M) — the humanize layer EXISTS; the gap is *coverage*.**
   `humanizeValidationMessage` (`src/domain/humanizeValidationMessage.ts`) is wired into the Day Editor
   view-model (`src/viewModels/dayEditorViewModel.ts:545`). So the fix is **extend its mapping** to the
   AJV patterns it misses (`must NOT have fewer than 1 items`, `must have required property '…'`), not
   build a translation layer from scratch.
3. **Guard-noise fix — the grouped/collapsible/warning-ack pattern ALREADY EXISTS in the batch screen.**
   `src/pages/ValidationSummary/index.tsx` has collapsed disclosures + a `warningsAcknowledged` tier +
   a collapsed status legend. The *per-day Day Editor banner* is what lacks it. So the fix is **bring
   that existing pattern to the day banner** (and add the Warnings tier there), not invent it.

---

## Journey 1 — First-run / onboarding + animal setup

### Friction table

| Screen / Action | Issue | Why confusing / inefficient | Severity | Concrete fix |
|---|---|---|---|---|
| Workspace home → landing at `#/` (legacy form) | **Default route lands on the legacy form**, not the workspace. A new user arriving at http://localhost:3000 sees a sprawling single-page form with no orientation. The workspace is only reached via `#/workspace`. | Zero onboarding — user has no idea the workspace exists. First impression is ~25 unlabeled form fields. | **H** | Make `#/workspace` the default route (already gated by `newDayEditor` feature flag per AppLayout — enable it). |
| Wizard stepper row | **7 tabs wrap to a second row** at 1280px wide viewport. "Team" (step 7) lives alone on row 2, visually detached from the numbered sequence. | Fragmented IA — the sequence looks broken. User may not see step 7 at all. | **M** | Use a scrollable single-row stepper, or show a linear "Step N of 7" text instead of all tabs simultaneously. |
| Step 1 — Identity | Step 6 (Recording system) shows a **green checkmark before the user visits it** — it's pre-populated with SpikeGadgets defaults. | Users see step 6 as "done" before doing anything; the green signal is not earned and teaches them to ignore step status badges. | **M** | Mark pre-populated steps as "Pre-filled — review" (e.g. a grey checkmark or "defaults set") rather than the same green as user-completed steps. |
| Step 1 — Identity | **`experiment_description` is not collected** in the wizard. It's a required export field. First thing the user sees after creating an animal + day is a blocking error about this field. | Wizard fails to surface a required field; forces the user to discover the gap at day-creation time, not setup time. Punishes late. | **H** | Add `experiment_description` (and `lab` / `institution` if not pre-filled) to Step 1 or Team step with a clear "required for export" label. |
| Step 1 — Identity | **`lab` and `institution` are collected on Team step but have no defaults** — left blank they produce AJV "must have required property" errors later. | No hint that these are required; they look optional alongside "Experimenter names". | **H** | Pre-fill lab/institution from a lab-level config (persisted in localStorage) or at minimum mark them required with asterisks and validate on step save. |
| Step 2 — Add Electrode Group modal | **Modal does not have internal scroll** — at default viewport height (~900px), the coordinate fields (AP/ML/DV) fall below the visible modal area. The Device Type selector disappears when user scrolls the page to reach the coordinates. | Users cannot see what device type they selected while filling coordinates; the DV field label is clipped ("DV (Dorsal-Ventral) (r…"). At smaller screens this is a complete dead-end — required fields are unreachable without scrolling. | **H** | Give the modal `max-height: 90vh; overflow-y: auto` with a sticky Cancel/Save footer. This is the standard pattern for tall modals. |
| Step 2 — Electrode group table | **Device type reverts to raw ID in the table** (`tetrode_12.5`) after the modal used the friendly label ("Tetrode (12.5 µm)"). | Inconsistency between pick-time (human label) and review-time (raw schema ID). Users can't confirm they picked the right probe from the table. | **M** | Display the same human label in the table, not the raw enum value. |
| Step 3 — Cameras | **Calibration warning fires before any camera is defined.** "Verify each camera's meters-per-pixel calibration" orange banner appears on an empty Cameras step. | Warning about calibrating cameras that don't exist yet is confusing and noise. Violates "punish late, not early." | **M** | Show the calibration warning only after a camera is added (or when any camera has a placeholder value). |
| Step 4 — Optogenetics | Step correctly gated behind a checkbox — no issues. Progressive disclosure works well here. | — | — | — |
| Step 5 — Tasks | Empty-state copy is clear and helpful ("Define each behavioral task once here"). | — | — | — |
| Step 6 — Recording system | Pre-populated SpikeGadgets default with an "Advanced Settings" disclosure. Good progressive disclosure. | — | — | — |
| Step 7 — Team | Lab / Institution fields have no default, no asterisk, no required hint. They are quietly left blank and will cause errors in export. | See row above — these must be required here or pre-filled globally. | **H** | (Same as Identity fix above.) |
| Overall wizard | **No "Save draft" feedback** — clicking "Save draft" has no visible confirmation (no toast, no status change). The "Save draft" button is secondary to "Next →" but equally present at every step. | Users don't know if draft was saved. Pressing browser Back after "Save draft" may lose work. | **M** | Show a brief inline confirmation ("Draft saved") next to the button for 2s on click. |

---

## Journey 2 — Day-log / epoch editor

### Friction table

| Screen / Action | Issue | Why confusing / inefficient | Severity | Concrete fix |
|---|---|---|---|---|
| Recording Days tab — after creating day | **Blocking error fires immediately** when the day is created, before the user opens the editor. Status cell shows "Needs fixing — Experiment description cannot be empty…" on a freshly created day. | Violates "reward early, punish late." The user hasn't had a chance to open the form. The error should be deferred until the user visits the day. | **H** | Newly created days should start in "Draft" (no validation run) until the user first opens the day editor. Run validation on first open or on explicit "validate" action. |
| Day Editor — banner | The "Fix" button in the error banner scrolls to and focuses the correct field — good UX. | — | — | — |
| Day Editor — Day tab | **"View / edit inherited subject metadata" disclosure has an "UPDATES ALL DAYS" badge** in grey text at far right — easy to miss, no confirmation when opened. The audit notes (`DayTab.tsx:400-433`) that editing species/DOB from here writes the animal record and propagates to ALL days silently. | Users who open this disclosure to "check" values may accidentally edit an animal-static field, changing every day's export. The "UPDATES ALL DAYS" text is not a warning — it's an afterthought label. | **H** | Replace the disclosure with a read-only summary card. Place an "Edit animal setup" link (already in the UI) as the only path to edit. If edits from here are kept, gate them behind a modal: "Editing this changes all N days — are you sure?" |
| Day Editor — Epochs tab | **"+ from template" vs "+ Add an epoch"**: two entry points with different semantics but no clear explanation of when to use each at first glance. The template concept is only explained in the empty-state body text. | Users making their first epoch may click the wrong button and get confused. First-time users especially. | **M** | Rename "+ from template" to a more descriptive label like "Fill from yesterday's day" or "Copy day template" and explain the difference in one line above the button pair. |
| Epoch added — Epochs tab | **Error banner fires immediately** after adding an epoch ("Epoch 1 has a task but no video file linked"). The epoch was just created; the user hasn't had a chance to open the row. | Same "punish early" pattern. The epoch-level required fields (video) are only accessible by expanding the row. | **H** | Defer the video-required error until the epoch row is first saved/collapsed after being edited, or until the user clicks Export. Show "Incomplete" status on the row, not a blocking error in the global banner. |
| Epoch expanded — video chicken-and-egg | **Adding a video auto-assigns camera id 0** but if no cameras are configured, this immediately produces a blocking error: "references camera id 0, but no camera with that id is defined." The epoch row status says "Complete" (green) while the global banner says "Needs fixing" — contradictory. | Classic chicken-and-egg: user must add cameras first, but there's no in-context link to add cameras. The row-level status and global banner are contradictory. | **H** | When no cameras exist: (a) suppress auto-camera-assignment on video add, (b) show an inline nudge: "No cameras configured — [Set up cameras →]" instead of assigning camera id 0. Also reconcile row-level vs global status. |
| Epoch expanded — error message language | **"references camera id 0, but no camera with that id is defined"** — internal schema language. Also: "must NOT have fewer than 1 items" (on remy). | Schema/code language, not user language. Neuroscientists do not think in terms of camera IDs or JSON schema constraints. | **H** | Translate every AJV error string before surfacing. "camera id 0" → "a camera that hasn't been added yet." "must NOT have fewer than 1 items" → "This day needs at least one [task / recording system / …]." |
| Epoch expanded — cross-tab data dependency | "Data folder: not set — add it on the Day tab" cross-references another tab with no link. | User must navigate to Day tab to fix, losing their place in the epoch editor. | **M** | Make "Day tab" a link: "Data folder: not set — [set it on the Day tab →]." |
| Day Editor — remy's 11-error wall | **11 errors listed in a flat list**, all with identical "Fix" buttons — overwhelming. The list includes both AJV schema errors ("must have required property 'lab'") and business-rule errors ("Epoch 1 has no video"). No grouping, no severity differentiation, no categories. | 11 identical error rows with identical "Fix" buttons is the maximum cognitive overload scenario. The user cannot determine which to fix first, or what category of problem they have. Adding 8–10 more guard types would produce ~19–21 error rows. | **H** | See Guard-noise assessment below for the full presentation recommendation. |
| DIO tab | Not visited in depth but the carry-forward summary ("carried from — unchanged") is clean per the existing `DioTab.tsx:51-52` pattern. | — | — | — |
| Failed channels tab | Not driven in this session (no channels to mark). Architecture is sound per audit. | — | — | — |

---

## Journey 3 — Validate & Export + Import-repair

### Friction table

| Screen / Action | Issue | Why confusing / inefficient | Severity | Concrete fix |
|---|---|---|---|---|
| Validation Summary (`#/validation`) | **Clean, scannable table** — Animal / Date / Session / Setup / Status / Editor. "0 valid / 2 with errors / 0 incomplete" summary at top. "No valid days to export — fix errors first." — all clear. | — | — | — |
| Validation Summary | "What gets exported?" and "What do these statuses mean?" disclosures — good progressive disclosure. | — | — | — |
| Validation Summary | **"ERROR" badge** is red text on white background with no icon — passes casual inspection but the badge is small and color-only at a glance. | Minor a11y concern — no shape/icon to distinguish from a green "VALID" badge for colorblind users. | **L** | Add a triangle icon to ERROR and a checkmark to VALID so status is not color-only. |
| Day Editor error banner | **"Fix" button correctly focuses the offending field** — the best UX pattern in the error presentation. This is the "reward" for having located the error. | — | — | — |
| Day Editor error banner — multiple errors | **When 11 errors exist, the banner becomes a wall** of 11 rows × identical "Fix" buttons. No grouping or priority order. | The user's eye can't parse which error to start with, and repeated identical "Fix" buttons cause decision paralysis. | **H** | See Guard-noise assessment. |
| Import screen (`#/import`) | **Minimal but clear** — "We read the file, map its fields, and flag anything that won't validate — with a suggested fix. Nothing is changed until you import; you accept or edit each one." Good framing. | — | — | — |
| Import screen | **No example or sample file** offered — "Choose File" is the only affordance. | New users don't know what a valid YAML looks like; a "Download sample" link would help. | **L** | Add a "Download sample YAML" link next to the file picker (the legacy form already links to a sample). |

---

## Journey 4 — Navigation & IA

### Friction table

| Screen / Action | Issue | Why confusing / inefficient | Severity | Concrete fix |
|---|---|---|---|---|
| Animal Workspace table | **Genotype column shows "—"** for remy (no genotype set). The disambiguating facts column shows missing data rather than "not set" or the strain. | A user scanning for "which animal is the wild-type" gets no signal. | **M** | Show "WT" or "not set" rather than "—"; or replace genotype column with a more useful disambiguating fact (e.g. species + sex + probe count). |
| Nav breadcrumb in Day Editor | **Breadcrumb shows "Workspace › Animal: uxtest01 › Day: 2026-06-17"** — clean, correct, clickable. | — | — | — |
| Animal switcher in nav | **Animal switcher shows name + day count** — enough to orient. The "New animal…" bottom item is clear. | — | — | — |
| Animal switcher — status | Switcher does NOT show per-animal error status (e.g. "remy — 1 error"). | User must click into each animal to learn its health. In a 10-animal lab this adds friction to prioritizing what to fix. | **L** | Show a small error indicator next to each animal name in the switcher (e.g. a red dot with count). |
| Animal summary bar | **Summary chip bar** (Wild-type, M, Rattus norvegicus, b. 2023-01-15, 1 probe — CA1, Config v1, Team: Test, Researcher) is clear and space-efficient. This is the "scope boundary is a physical thing on screen" design working well. | — | — | — |
| Left sidebar — Animal setup section | **Cameras and Optogenetics show "○" (empty circle)** — the meaning of this icon is not immediately obvious (is it a status? a count?). The label "Cameras — not set up" is in the accessibility tree but may not be visually prominent. | Users rely on visual scanning; the ○ icon has no label next to it in the visual rendering. | **M** | Replace ○ with "Not set up" text or a distinct unfilled badge like "TODO" so status is text-readable, not icon-only. |
| Recording System — remy | **Recording System shows "• 0 ›" with a red dot** in remy's sidebar — 0 recording systems configured, which is a structural error. | The red dot + 0 is a signal, but no tooltip or inline text explains what's wrong. | **M** | Add an inline status text: "Recording System — 0 configured · set up →" rather than just a red dot. |
| DayList — "What do these statuses mean?" disclosure | Collapsible explanation available on the days list — good progressive disclosure. | — | — | — |
| "Copy from another animal…" | Wizard has this shortcut prominently available — excellent for the common case of setting up animal #2 from #1. | — | — | — |
| Carry-forward checkbox | "Start each new day from the last day (2026-06-17) — review & adjust per day" checkbox on the days tab is visible and explained. This is the key "pre-fill + diff" mechanism and it's in the right place. | — | — | — |

---

## Cross-cutting themes

### Theme 1: Punish-too-early validation

The most consistent friction across all journeys. Errors fire at moments the user hasn't acted yet:
- The "Needs fixing" badge appears on a freshly created day row before the user has opened it.
- The global error banner fires when an epoch row is created (video missing), before the row is expanded.
- The camera calibration warning fires on an empty Cameras step.

The app's underlying validation engine is excellent and thorough; the problem is **when** errors are surfaced, not whether they're surfaced. The fix is uniform: defer required-field errors until first save/close of the section, or until the user explicitly requests validation / export. Show "Incomplete" instead of "Error" for unsaved new items.

### Theme 2: AJV schema language leaks into user-facing messages

Several blocking errors are raw AJV strings or internal identifiers:
- "must NOT have fewer than 1 items"
- "must have required property 'experimenter_name'"
- "references camera id 0, but no camera with that id is defined"

None of these are in a neuroscientist's vocabulary. The app correctly maps these in the `importRepair` screen (with suggested fixes), but the Day Editor error banner shows them raw. A translation layer (rule code → human message) applied to the error banner would fix this globally.

### Theme 3: Wizard does not collect all required export fields

The 7-step wizard successfully separates animal-static from day data, but leaves three required export fields uncollected:
- `experiment_description` (required, discovered only at day-creation time)
- `lab` and `institution` (required, collected in Team step but not marked required and have no defaults)

This causes immediate blocking errors on the very first day created — exactly the "new user first-run" failure mode.

### Theme 4: Status signal inconsistency

Row-level and global-level status disagree in the epoch editor:
- An epoch row shows "Complete" (green) while the global banner shows a blocking error about that same epoch's video camera reference.
- Step badges in the wizard pre-green for recording system (defaults loaded) even before visiting.
- The "○" sidebar icon vs the textual "not set up" label is visual-only.

A single status-computation path should drive all views of the same record's health.

### Theme 5: Electrode group modal overflow (layout bug)

At default viewport height (~900px), the Add Electrode Group modal's required coordinate fields (AP/ML/DV) fall below the visible area and require page scroll. When the user scrolls to the coordinates, the Device Type selector disappears off-screen. This is a hard usability barrier (required fields invisible without non-obvious scroll) and the most severe layout issue found.

---

## Blunt new-user first-run verdict

A new user who navigates to http://localhost:3000 sees the legacy form — a wall of unlabeled fields with no orientation. The workspace (`#/workspace`) is not the default route, so first-run is effectively broken unless the user knows to navigate there. Even with the correct URL, the wizard does not surface three required export fields, guaranteeing a blocking-error experience on the first day created. The electrode group modal has a viewport-clipping bug on coordinate entry. These three issues together mean a new user cannot complete a first successful export without hitting confusing dead-ends.

The **core experience** — once setup is complete and the animal has cameras — is solid: the epoch-centric row is well-structured, carry-forward is visible, the animal summary bar anchors context, and the "Fix" button navigation is excellent. The architecture is right. The friction is concentrated at first-run and in the error presentation layer.

---

## Guard-noise assessment and recommended presentation change

### Current error presentation (observed)

The Day Editor error banner is a flat list of `N` rows, each with the error message text and a "Fix" button. There is:
- **No grouping** (AJV schema errors mixed with business-rule errors mixed with reference errors)
- **No severity differentiation within "error"** (all are blocking export; none are warnings)
- **No category or source label** (which section / tab owns this error?)
- **No dismissal or "I'll fix later"** pathway for non-blocking items
- **Identical "Fix" buttons** regardless of whether fixing requires navigating to another tab, editing inline, or adding a missing entity

At 11 errors (observed on `remy`), the banner occupies the full visible viewport height, pushing the form content below the fold.

### The scaling problem

The existing ~21 business rules + AJV schema generate up to 11+ errors for a misconfigured animal. Adding the planned 8–10 new guards (opto power range, camera calibration aliasing, experimenter name-shape, statescript dup-name/path, location typo, placeholder-id, genotype-vs-strain, the list/scalar import fix) could produce ~19–21 error rows in the worst case. At that volume the banner becomes a wall that users will learn to ignore — defeating its purpose.

### Recommended presentation change: grouped, severity-tiered, collapsible

**Tier 1 — "Blocks export" (errors):** Show as a compact badge count + collapsible list, grouped by tab/section:

```
▲ 5 issues block export     [Show all]

  Day tab (2)               Session metadata
    • Experiment description is empty       [Fix]
    • Lab name is required                  [Fix]

  Epochs (2)
    • Epoch 1: no video — add or mark no-video   [Fix in Epoch 1]
    • Epoch 1: video linked to an unconfigured camera  [Fix camera →]

  Animal setup (1)
    • Recording system: no system configured   [Go to recording system]
```

**Tier 2 — "Worth checking" (warnings):** Shown only when errors are cleared, or in a collapsed "Warnings" section below errors. New guards (opto power range, location typo, genotype-vs-strain) should land here rather than as blocking errors — they prevent likely mistakes but don't always indicate corruption.

**Tier 3 — "Nudges" (informational):** Shown inline on the field, never in the global banner. Placeholder-id, experimenter name-format suggestion.

**Key properties of this approach:**
1. **The banner stays bounded** — always shows the count and top 2–3 items; the rest collapse
2. **Grouping by section** — user knows which tab to go to first
3. **Severity separation** — errors vs warnings vs nudges are visually distinct (red / amber / grey) with text labels, not just color
4. **New guards fit naturally** — adding a new warning doesn't extend the error count; it goes in the warnings tier
5. **"Fix" buttons are contextual** — "Fix in Epoch 1", "Go to Day tab", "Set up cameras" — not identical

This presentation scales to 21 guard types without overwhelming the user.

---

## Good UX patterns found

- **Animal summary chip bar** (Wild-type, M, Rattus norvegicus, b. 2023-01-15, 1 probe — CA1, Config v1, Team) on the Day Editor — perfect "scope boundary is a physical thing on screen" implementation. Read-only, compact, always visible.
- **"Fix" button → focus** — clicking Fix in the error banner correctly scrolls to and focuses the exact offending field. This is the right pattern.
- **Calendar date picker for recording days** — the calendar grid with "today" highlighted, multi-select, and "Create N Days" is efficient and appropriate for the batch-day use case.
- **Epoch row auto-populates task from catalog** — adding an epoch immediately picks the only defined task (w-track), generating the correct file name convention. This is "recognize, don't recall."
- **Technical parameters collapsed under disclosure** — hiding raw_data_to_volts / times_period_multiplier behind "Advanced Settings" is correct progressive disclosure; showing the values and "Using recording-system default" when expanded is transparent.
- **"Copy from another animal"** — prominent in both the wizard and the animal days tab. Critical for the real workflow (lab sets up animal 2 from animal 1).
- **Optogenetics gated behind checkbox** — "This animal has optogenetics" checkbox with all-or-nothing warning is correct and well-framed.
- **"behavior-only animal — skip electrodes"** — the escape hatch in Step 2 is in the right place.
- **Validation Summary table** — clean, scannable, with "0 valid / N with errors / 0 incomplete" summary count at top.
- **Import screen framing** — "Nothing is changed until you import; you accept or edit each one" — honest and clear.
- **Recovery screen** — clean empty state with "Nothing to review" in green; schema-migration recovery is non-destructive and clearly surfaced.
- **Keyboard shortcuts dialog** — functional, visible, and the `?` shortcut to open it is discoverable.

---

## Overall Assessment

Rating: **NEEDS_POLISH**

The workspace architecture, data model, epoch-centric editor, and validation foundation are structurally correct and well above average for scientific software. Three issues require immediate attention before the workspace can be the default experience: (1) the default route still lands on the legacy form, (2) the wizard omits required export fields causing guaranteed first-run errors, and (3) the electrode group modal clips required fields at standard viewport heights. The error presentation layer is functionally correct but needs grouping and severity tiering to handle the existing error volume and scale cleanly to the planned new guards. None of these are architectural changes — they are presentation and routing changes.
