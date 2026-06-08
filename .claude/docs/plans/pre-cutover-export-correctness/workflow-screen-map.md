# Workflow screen map

[<- back to PLAN.md](PLAN.md) · [workflow clarity design](workflow-clarity-design.md) · [ownership/defaults phase](phase-8-7-ownership-defaults-day-configurability.md)

Date: 2026-06-08

> **Tabbed IA update (tabbed-workspace-ia Phase 5).** The Animal Editor **wizard/stepper** and its
> `#/animal/:id/editor` route are **removed**. An animal's shared setup now lives in a **tabbed Animal
> View** at `#/animal/:id/:tab` (a left section-nav of links with `aria-current`, NOT a stepper). The
> animal is switched from a **top object-selector** (`Workspace ▸ <animal> ▾`), create-animal is an
> **inline panel on the workspace picker** (not a separate `#/home` screen), and animal/day lifecycle
> lives in **per-object ⋮ menus**. This file is rewritten to that IA; the "Tabbed Animal View screen
> contract" replaces the old "Animal Setup screen contract", and the route/step/modal/naming rows
> below describe the tabbed surfaces. Read **"step"** as **"section-nav tab"** throughout.

This is the screen-level contract for the modern YAML creator. It maps every user-visible
workspace screen to the job the scientist is trying to do, the thing their attention is
likely on, the primary action the screen should offer, and the mistake the screen is
responsible for preventing.

The app is not a schema editor. It is a conversion workbench for recorded data:

1. Create or select the animal.
2. Define the shared setup that existed for that animal.
3. Add or recover recording days.
4. Describe what happened in each day and task epoch.
5. Validate/export one day or a batch.
6. Record a hardware/configuration change at the day where it starts.

Any implementation that adds, removes, renames, or combines screens must update this file
and the Phase 9 browser QA expectations. A route, step (tab), modal, or empty state is coherent
only if a user can answer: "What am I doing here, what does this affect, what is the next
safe action, and what will be exported?"

## Top-level screens

| Screen | Route | User job | User attention | Primary action | Prevented mistake |
| --- | --- | --- | --- | --- | --- |
| Legacy metadata form | `#/` or no hash | Use the frozen pre-workspace editor until cutover | Existing familiar one-page form | Complete/export through legacy path | Confusing legacy safety-net behavior with the modern workspace plan |
| Animal Workspace (picker) | `#/workspace` / `#/workspace?animal=<id>` / `#/workspace?create=1` | Pick an animal, create one, or triage the workspace | Animal cards (name + day count + ⋮), the empty state, or the inline create panel | `Open` an animal card → its tabbed view; `+ New Animal` → inline create panel | Thinking a recording day owns probes/cameras; a dead-end empty state with no create path |
| Create Animal (inline panel) | `#/workspace` (panel) / `#/home` (legacy redirect-equivalent, still live) | Create the subject + lab/experimenter defaults | Subject id, species, sex, DOB, genotype, weight, experimenters | `Create Animal` → land on the new animal's `days` tab | Starting with recording-day fields before the subject exists; routing first-animal creation through a different pattern than everything else |
| Tabbed Animal View | `#/animal/:id/:tab` (`:tab` ∈ days, export, electrode-groups, channel-maps, recording-system, cameras, dio, optogenetics; bare `#/animal/:id` and any unknown/stale tab — incl. the removed `editor` — redirect to `days`) | Manage ONE animal's recording days + shared setup, revisitably | The header band (name · `subject_id` · species · sex · ⋮), the grouped left section-nav, and the active tab's panel | Tab-specific; see the Tabbed Animal View contract | Editing shared setup while believing it changes one day; landing on a 404-like dead end after a delete |
| Day Editor | `#/day/:id` | Describe one recording day for export | Session/day facts, effective setup, tasks/epochs, rooms, cameras, videos/files, opto protocols, failed channels | Validate/export this day or repair the owning section | Re-entering shared setup as if day-owned; missing within-day setup changes |
| Validation & Export (batch) | `#/validation` | Cross-animal/cross-day validation, repair routing, batch export | Which days are valid/blocked, why, and which repair surface owns the fix | State-specific; see below | Batch-exporting invalid/wrong-owner/recovered days; losing the single-day/export gate contract |

## Chrome (top bar + object-selector)

The chrome is rendered on every non-legacy route by `AppLayout`.

| Element | Where | User job | Coherence requirement |
| --- | --- | --- | --- |
| Primary nav: `Workspace · Validation & Export` | All non-legacy routes | Reach the hub and the cross-animal batch screen | Exactly one navigation landmark per route; no redundant standalone `Home`; `Validation & Export` is the discoverable batch surface |
| Object-selector `Workspace ▸ <animal> ▾` | Only the `animal-view` route (there is a current animal to switch from) | Switch the current animal, or act on one | A **disclosure** popup (NOT listbox/menu): each row is a switch link (→ `#/animal/:id/days`, current `aria-current`) + a day count + a per-row ⋮ (`Open` / `Delete animal…`); `+ New animal…` opens the create panel via `#/workspace?create=1`. Keyboard: Esc closes → trigger, Up/Down rove rows, focus enters the popup on open |
| Legacy escape | Flag-gated (`showLegacyToggle`) | Return to the frozen legacy form | Hidden until cutover enables it; never a surprise bounce |

## State-specific primary actions

Each route state should have one dominant next action. Secondary actions can remain visible,
but they must not compete with the safest next step.

| State | Primary visible action | Secondary actions | Coherence rule |
| --- | --- | --- | --- |
| No animals in workspace (picker empty state) | `Create Animal` (opens the inline create panel) | Legacy form link if still pre-cutover | Do not show empty day/export controls before the user has a subject; the empty state must open the create panel, not dead-end. |
| Picker with animals | `Open` an animal card (→ its `days` tab) | `+ New Animal` (inline panel); per-card ⋮ → `Delete animal…` | Each card opens the animal's tabbed view; the destructive Delete is in the ⋮, never flush against `+ New Animal`. |
| Animal View, new/under-configured animal (days tab) | The first-run **"Set up this animal"** card's per-section `Set up →` (or `Fix →` for a blocking section) | `Add Recording Days`; open a setup tab | The card is honest + NON-gating (behavior-only days are valid); it agrees with the section-nav (a blocking section reads "Needs fixing", never "Done"). |
| Animal View, established animal | `Add Recording Days` (days tab) / open the tab the user came to revisit | Any section-nav tab; header ⋮ | Tabs are revisitable reference data, not a one-time linear flow. |
| Selected animal, existing/recovered data present | `Review / Repair Existing Data` (the days-tab review state) | Open a day; open **this animal's** `Validation & Export` tab | Recovered or imported data must not look silently trusted; in-animal review links stay within the animal (`#/animal/:id/export`), not the batch screen. |
| Selected animal, some days invalid | The most actionable repair (a `?field=` deep-link to the owning tab), or this animal's `export` tab | Open valid days, add days | A blocked export routes to the owner of the first meaningful fix; the section-nav shows a red ● on the owning setup tab. |
| Selected animal, one ready day | `Open Export` / `Export This Day` | Add days, open a setup tab | Same-day workflow should not require batch tooling. |
| Selected animal, multiple ready days | `Export Valid Only` (this animal's `export` tab, or the batch `#/validation`) | Validate all, inspect day | Catch-up workflow should let users export ready days without opening every day. |
| Day uses historical configuration | Continue day edits against `Configuration vN` | Reconfigure starting this day | Do not imply latest Animal Setup edits will change this historical day. |
| Hardware changed starting this day | `Hardware changed starting this day` | Edit day failed channels | Reconfiguration is a timeline event and must name affected days before fork; the reconfig deep-link lands on the `electrode-groups` tab with the context banner. |
| Export blocked | First repair action / `Open Validation` | Back to day/setup | Disabled export must never be the only feedback. |
| Export ready | `Download YAML` | Back to day/workspace | Export is the confidence checkpoint and should summarize what will be encoded. |
| Animal not found (bad/cold deep-link, or just-deleted) | `Back to Workspace` | — | A missing animal renders a non-stranding "Animal not found", never a perpetual "Loading…"; deleting the **viewed** animal navigates to the picker rather than landing here. |

## Same-day path

The same-day user has just finished one recording and wants one trustworthy YAML quickly.

1. **Animal Workspace (picker)** lists the animal; opening its card lands on the `days` tab, whose
   first-run card shows whether shared setup is ready before the user opens a day. If electrodes/probes
   or cameras are missing, the card's per-section `Set up →` links lead to the owning tab — not a
   generic editor link.
2. **Setup tabs** are visited only when shared setup is missing or changed. They never make the user
   re-enter day facts; each carries a scope descriptor naming its blast radius.
3. **Day Editor** leads with day facts and task-epoch context. The user should see what setup this day
   is using without editing shared setup in the common case.
4. **Validation** and **Export** (this animal's `export` tab, or `#/day/:id`'s Export step) tell the
   user whether this one day is safe to download. Export repeats the values that matter downstream:
   subject/session identity, setup version, recording system values, camera/task identities, opto
   state, and failed channels.

Success means a prepared animal can move from `Add Recording Day` to `Export` without
retyping electrodes, cameras, data-acq, or implanted opto setup.

## Catch-up path

The catch-up user has several recorded days waiting and needs to spot differences and
blockers efficiently.

1. **Animal Workspace (picker)** + the animal's `days` tab are the triage home: days are visible
   together, the first-run/review state surfaces recovered/corrupt/wrong-owner states, and the
   section-nav counts give per-section information scent.
2. **Validation & Export** — the animal's own `export` tab for one animal, and the chrome-level
   `#/validation` for the cross-animal batch — groups issues by user job and routes to the owning tab.
3. **Day Editor** repairs only the day/task facts for the selected day. Shared setup repair routes
   back to the owning **tab** (`?field=` deep-link) with a focused, highlighted destination.
4. **Batch Export Preflight** names which days will export and which were skipped, and it uses the
   same gate as single-day export.

Success means the user can scan many days, repair only the few that need attention, and
export valid days without opening every long form.

### Batch row scan contract

Workspace day rows and Validation Summary rows must expose enough information for catch-up
work without making the user open every day. At minimum, each row or expandable row summary
should show:

- recording date and session id (session id off the row, in the day / preflight — decision 12);
- animal/subject label when the view spans animals;
- configuration version and whether it is latest or historical;
- camera set/calibration summary, including enough identity detail to detect a zoom or
  `meters_per_pixel` change;
- opto state: no opto, implanted but no stimulation, or stimulation on selected epochs;
- validation/export state: ready, draft, blocked, exported/validated, recovered/corrupt,
  wrong-owner, or missing record;
- next repair/export action and the owner it will open.

The per-day recording-day **row** itself is triage, not inspection (decision 12): bare **date** +
muted **session description** (when present) + one **plain-language status** + one **action**
(`Delete day…` outside the navigation link); the retired dense "scan line" detail relocates to the
day / the export preflight / the `Validation & Export` Setup column.

## Tabbed Animal View screen contract

User-facing surface: the **tabbed Animal View** at `#/animal/:id/:tab`. It replaces the removed
Animal Editor stepper. Structure: a **header band** (animal name · `subject_id` badge · species · sex
· a ⋮ menu with `Delete animal…`), the shared **profile/subject** editor + reconfiguration-context
banner in that band (not a tab), a **3-field corruption banner** hoisted above the panels (cameras /
data_acq_device / configurationHistory — visible from every tab), and a **grouped left section-nav**.

The section-nav is a **navigation landmark** (links + `aria-current`, NOT a `role="tablist"`). Each
row reads **name · count · ›** (decision 10 — information scent + a navigable-at-rest chevron), with a
**blocking-only** status dot: red ● when that section holds an export-blocking error (decision 11),
neutral hollow ○ when never-configured, no dot otherwise. The count + chevron are aria-hidden visual
cues; the accessible name carries "— blocks export" / "— not set up". Switching tabs moves focus onto
the labelled panel; an open setup editor guards a tab switch with a discard confirm (decision 2).

| Tab (route `:tab`) | Group | User job | Scope descriptor (shown under the heading) | What must be visible | Primary actions |
| --- | --- | --- | --- | --- | --- |
| Recording Days (`days`) | Day work | Manage this animal's recording days | — | Day list (triage rows), the first-run "Set up this animal" card or the existing-data review state, the calendar creator | `Add Recording Days`; open a day; `Delete day…` per OK row |
| Validation & Export (`export`) | Day work | This animal's per-day readiness + export | — (scoped header "This animal — readiness & export"; links UP to the batch `#/validation`) | Per-day valid/error/incomplete chips, the same batch actions filtered to this animal | `Validate All`, `Export Valid Only` (this animal) |
| Electrode Groups (`electrode-groups`) | Animal setup | Define probes/tetrodes + anatomical locations | "Versioned identity — a change here forks a configuration version." | Device type, group id, location/targeted location, configuration-version context; channel-map auto-regen on device_type change | Add/edit/copy/delete electrode group |
| Channel Maps (`channel-maps`) | Animal setup | Verify ntrode/electrode mapping + bad channels | "Edit any time — map channels, mark bad channels." | Per-group channel map, local channel ids, per-group bad-channel count, failed-channel semantics | Edit/import/export channel maps |
| Recording System (`recording-system`) | Animal setup | Define data-acq identity + rig constants | "Shared across ALL days (no per-day version)." | Data-acq name/system/amplifier/ADC, `raw_data_to_volts`, `times_period_multiplier`, divergent-name identity guard | Save recording-system defaults |
| Cameras (`cameras`) | Animal setup | Define reusable camera identities | "Catalog — referenced per day." | `camera_id`, `camera_name`, manufacturer/model/lens, `meters_per_pixel`; divergent-name + immutable-once-referenced guards | Add camera; create new identity after zoom/calibration/lens change |
| DIO (`dio`) | Animal setup | Manage the reusable behavioral-events library | "Library — opt in per day." | Whether entries are a library/template (not exported until used on a day) | Add library event; `Use on this day` from the day flow |
| Optogenetics (`optogenetics`) | Animal setup | Record animal-level opto capabilities | — (a "Not used — no stimulation" status chip when unconfigured) | Implant/virus/source/software completeness; opto-free days are valid | Enable/complete implanted setup; leave off when no opto |

Each setup tab answers "does this change future or existing days?" via its scope descriptor. For
configuration-versioned ephys setup, latest-version edits affect days pinned to latest; historical
days keep their pinned versions. Recording-system + cameras + DIO are animal-level (shared), and the
descriptors say so honestly. The subject/profile facts live in the header band (not a tab) and name
their blast radius ("this animal and all N recording days, including any already exported") before
commit.

## Day Editor screen contract

User-facing label target: **Recording Day** or **Day Editor**, with step labels that name
the user's job. Current internal labels may remain as component ids, but the UI should not
ask the user to infer ownership from `devices`, `epochs`, or schema terms alone. (The Day Editor is
still a stepper — only the *Animal* editor became tabs.)

| Day step | User job | Label target | What must be visible | Primary actions |
| --- | --- | --- | --- | --- |
| Overview | Describe the recording day | `Overview` / `Day Details` | Date, session id, description, recording-day weight, header path, subject facts inherited from animal | Save day facts; repair subject facts if inherited values fail |
| Setup and failed channels | Verify effective setup for this day | `Setup & Failed Channels` | Pinned configuration version, historical/latest status, read-only electrodes/probes, cameras summary, day-specific failed channels | Mark failed channels; `Hardware changed starting this day`; route setup fixes to the owning Animal View tab |
| Tasks, epochs, files | Record what happened by task epoch | `Tasks, Epochs & Files` | Task rows with room/environment, camera(s), epoch set, files/videos, DIO/opto protocol assignments | Add/edit task; attach files/videos; choose camera(s); set opto protocol for selected epochs |
| Validation | Understand and repair blockers | `Validation` | Issues grouped by user job and repair destination | Click repair action (deep-links to the owning Animal View tab); rerun validation |
| Export | Download trustworthy YAML | `Export` | Preflight summary of what will be encoded and why export is allowed/blocked | Download YAML when valid |

The task row is the user's within-day setup unit. If room/camera/opto differs within a
day, the UI represents that as separate task rows that partition the epochs.

Weight is a recording-day value for export, even though older/current workspace state may
store an animal-level subject weight as an initial/default value. The Day Overview is the primary
place to review the weight exported for that session.

## Specialized flows and modals

| Surface | Opens from | User job | Coherence requirement |
| --- | --- | --- | --- |
| Inline create-animal panel | Workspace picker (`+ New Animal` / empty-state `Create Animal` / selector `+ New animal…`) | Create a new animal in place | Hosts the same `AnimalCreationForm` as the legacy `#/home`; on success lands on the new animal's `days` tab; cancel returns to the picker |
| Recording-day calendar | Animal View `days` tab | Add one or more days | Existing dates are visible; created days inherit current setup/defaults; the next action is opening or validating the new days |
| Reconfiguration wizard | Day Editor setup/failed-channels step | Record hardware change beginning on a day | Names affected contiguous days before fork; after fork, the Animal View `electrode-groups` tab shows a context banner explaining which version is being edited |
| Electrode group modal | Animal View `electrode-groups` tab | Add/edit one probe/electrode group | Shows group identity + anatomy; bulk add must not obscure generated ids; deleting a group cascades its channel maps |
| Channel map editor | Animal View `channel-maps` tab | Edit local channel mapping + failed-channel-compatible ids | Local channel ids + probe/electrode ids explicit; invalid/corrupt bad-channel marks repairable |
| Camera modal | Animal View `cameras` tab (or repair route) | Add/edit one camera identity | Different lens/zoom/calibration/`meters_per_pixel` steers to a new camera name/identity; a referenced-camera edit offers a new-vs-correct decision naming affected days |
| Per-animal ⋮ menu | Picker card · Animal View header · selector row | Open / Delete an animal | Accessible menu-button (aria-haspopup="menu", roving focus, Esc-return); the destructive `Delete animal…` is the only real item on the header surface |
| Animal delete (type-to-confirm) | Any per-animal ⋮ `Delete animal…` | Irreversibly delete the animal + its owned days | One shared `alertdialog` (decision 13): the Delete button stays disabled until the user types the animal `id`; names the cascade count (OK days only) + preserved wrong-owner / surviving recovered records + the "does not delete downloaded YAML/NWB/DANDI/Spyglass" caveat; deleting the viewed animal navigates to the picker |
| Per-day delete (plain confirm) | Each OK day row in the `days` tab | Remove one recording day | A plain Cancel/Delete `alertdialog` (decision 13 asymmetry — friction matched to stakes); names the day + the downloaded-artifacts caveat when validated/exported |
| Task modal | Day Editor tasks/epochs step | Define task identity + epoch assignment | Shows task name/description identity, room, camera choices, one-epoch-one-task rule |
| File/video editors | Day Editor tasks/epochs step | Attach recorded files/videos | Camera/task/epoch references are controlled choices from known values |
| FsGUI/opto protocol editor | Day Editor tasks/epochs step | Record opto actually run for selected epochs | No-opto day/epoch is a valid empty state; opto protocol requires selected epochs/camera/DIO only when used |
| Behavioral event use surface | Day Editor tasks/epochs step | Make a DIO/event part of the exported day | Animal library entries do not look exported until explicitly used on the day |
| Raw/corruption repair banners | Picker, Animal View (above panels), Day Editor, Validation Summary | Repair malformed saved state | A corrupt collection never renders as silently empty; reset/repair actions name the damaged section |

## Naming and navigation rules

- The primary nav is `Workspace · Validation & Export`. There is no standalone `Home` entry —
  create-animal lives in the workspace. After cutover, Workspace is the home/landing route.
- The logo/header destination must match the active product mode. Before cutover it may return to the
  legacy form as a safety net; after cutover the logo should return to the modern Workspace unless an
  explicit `Use Legacy Editor` escape is enabled.
- `Animal Editor` / `Animal Setup stepper` is dead language — setup is the **tabbed Animal View**.
  User-facing copy says the concrete tab (`Electrode Groups`, `Cameras`, …) or `shared setup`.
- The Animal View section-nav splits hardware into ownership-named tabs (`Electrode Groups`,
  `Channel Maps`, `Recording System`, `Cameras`, `DIO`, `Optogenetics`); there is no broad
  `Hardware Config` surface anymore.
- `Devices` in a day is not where the user creates devices. The visible heading verifies the day's
  effective setup and edits day-specific failed channels.
- Every repair action lands where the edit can happen — a `?field=` deep-link scrolls to and
  highlights the owning Animal View tab's section. A repair route that lands on a read-only summary
  is a dead end.
- Every screen needs a clear return path: setup tabs and the Day Editor return to Workspace; repair
  routes deep-link to the owning tab; Validation routes to the owning tab/day.
- Ownership cues are risk-tiered: scope descriptors under each tab heading, the blocking-only red ●,
  and the type-to-confirm animal delete carry the weight; ordinary fields are not over-badged.

## Tabbed-IA reconciliation (verified against code 2026-06-08, tabbed-workspace-ia Phases 1–5)

These rows pin where the code stands for the tabbed IA, superseding the Phase-8.7 stepper-era
reconciliation (kept for history in git). Phase numbers are tabbed-workspace-ia phases.

| Surface | Current behaviour (verified) | Phase |
| --- | --- | --- |
| Animal route | `#/animal/:id/:tab` tabbed Animal View; `editor`/unknown/bare redirect to `days` ([useHashRouter.js](../../../../src/hooks/useHashRouter.js)) | 1, 5 |
| Section-nav | Grouped landmark of `aria-current` links; row = name · count · › with blocking-● / todo-○ ([AnimalView/index.jsx](../../../../src/pages/AnimalView/index.jsx)) | 1, 3a, 4 (decisions 10/11) |
| Setup tabs | Each renders an extracted container (electrode-groups / channel-maps / recording-system / cameras / dio / optogenetics) — same impl the legacy stepper used, no fork ([wiring/](../../../../src/pages/AnimalEditor/wiring/)) | 3 |
| Scope descriptors | Per-tab one-line blast-radius under the heading; opto "Not used" chip when unconfigured | 3 |
| Primary nav | `Workspace · Validation & Export`; no standalone Home ([AppLayout.jsx](../../../../src/layouts/AppLayout.jsx)) | 4 |
| Object-selector | `Workspace ▸ <animal> ▾` disclosure popup on animal routes (switch link + per-row ⋮ + "+ New animal…") ([AnimalSwitcher.jsx](../../../../src/components/AnimalSwitcher.jsx)) | 4 (deferred → done) |
| Create animal | Inline panel on the picker (`#/workspace?create=1`); `#/home` stays a live redirect-equivalent ([AnimalWorkspace/index.jsx](../../../../src/pages/AnimalWorkspace/index.jsx)) | 4b |
| Animal delete | Type-to-confirm shared `AnimalDeleteDialog` from card ⋮ / header ⋮ / selector row; honest cascade + downloaded-artifacts caveat ([AnimalDeleteDialog.jsx](../../../../src/components/AnimalDeleteDialog.jsx)) | 4 (decision 13) |
| Day delete | Plain Cancel/Delete confirm on each OK day row ([RecordingDaysTab.jsx](../../../../src/pages/AnimalWorkspace/RecordingDaysTab.jsx)) | 4 (decision 13 asymmetry) |
| Repair deep-links | `?field=` → owning tab, scroll + highlight; blocking ● uses the same resolver ([3a](phase-3a-repair-routing.md)) | 3a |
| Stepper | Removed (`AnimalEditorStepper` + `#/animal/:id/editor` deleted); the Day Editor stepper is unchanged | 5 |

> The Phase-8.7 stepper-era label-reconciliation table (Tasks 2a–2c, etc.) is preserved in git history
> at the prior revision of this file; those relabels landed on the now-deleted stepper. Their intent
> carried forward into the tab labels above.

## QA acceptance

Phase 9 should prove this map, not just individual controls:

- Each top-level route has one dominant user job, one primary next action, and a route/heading
  label that matches that job.
- Each state in the state-specific primary-action table has exactly one visually dominant
  next action and secondary actions do not compete with it.
- The section-nav rows satisfy the name · count · › affordance with blocking-only dots, and the
  setup card agrees with the nav (no "Done" over a blocking section).
- Each tab/modal names whether the action edits shared setup, a pinned configuration, a
  recording-system default copied into the day, a day/task/epoch fact, or an exported day list.
- Same-day and catch-up paths can both be completed without redundant setup entry or hidden
  repair dead ends; deleting the viewed animal lands on the picker, never a 404-like dead end.
- Existing/imported data and corrupt saved state are visible as review/repair states, not
  silently trusted or silently scrubbed.
- Downstream identity fields are visibly identity fields at edit time: camera name plus
  calibration/lens/`meters_per_pixel`, data-acq name plus dependent fields, task name plus
  description, DIO/event description, and ephys configuration version.
- Browser QA has at least one assertion per top-level screen that the visible heading,
  primary action, and next/return action match this screen map. See the tab-based browser
  scenarios in [phase-5-browser-scenarios.md](../tabbed-workspace-ia/phase-5-browser-scenarios.md)
  (run by [phase-9-playwright-qa-pass.md](phase-9-playwright-qa-pass.md) Tasks 4.5/4.6) and the QA
  handoff in [phase-5-tabbed-ia-qa-handoff.md](../tabbed-workspace-ia/phase-5-tabbed-ia-qa-handoff.md).
