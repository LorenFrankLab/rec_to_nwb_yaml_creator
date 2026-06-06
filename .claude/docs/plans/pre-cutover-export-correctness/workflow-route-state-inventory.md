# Workflow route/state inventory (Phase 8.6 Task 0)

[← back to PLAN.md](PLAN.md) · [workflow clarity design](workflow-clarity-design.md) · [mental-model contract](shared-contracts.md#user-mental-model-contract)

Date: 2026-06-05

This is the map the rest of Phase 8.6 implements. For each workflow state it records the
user's **goal**, the **next safe action** the UI should offer, the **dangerous
misconception** that the old UI allowed, the **current route/control**, and the **required
change** (the surface that Phase 8.6 changes and the domain helper it derives from).

The intended workflow order (from [workflow-clarity-design.md](workflow-clarity-design.md)):

1. Create / select an animal.
2. Configure shared animal hardware — **especially electrodes/probes**.
3. Create / import recording days.
4. Fill day-specific metadata: tasks, videos, files, **failed channels**, technical values.
5. Record hardware changes as configuration versions starting on a specific day.
6. Export only after animal setup and day metadata agree with what will be encoded.

Routes (hash router, `src/hooks/useHashRouter.js`):

| Hash | View | Component |
| --- | --- | --- |
| `#/home` | home | `pages/Home` |
| `#/workspace?animal=<id>` | workspace | `pages/AnimalWorkspace` |
| `#/animal/:id/editor?context=reconfigure&version=<n>&fromDay=<id>&movedDays=<n>` | animal-editor | `pages/AnimalEditor` |
| `#/day/:id` | day | `pages/DayEditor` |
| `#/validation` | validation | `pages/ValidationSummary` |

All readiness/category state below is derived from the new domain helpers
`src/domain/workflowStatus.js` (`getAnimalSetupChecklist`, `getDayWorkflowStatus`) and
`src/domain/workflowCategories.js` (`workflowCategoryForIssue`), which are pure functions of
the existing `computeStepStatus` / `validateDay` (`src/domain/validation.js`) and the
shape-safe reads in `src/state/workspaceSelectors.js`. No surface recomputes readiness or
re-guesses a category.

---

## 1. New animal, no days

- **Goal:** start describing a new subject's recordings.
- **Next safe action:** configure shared hardware before creating/exporting any day —
  primarily **Set Up Electrodes**.
- **Dangerous misconception:** "I create a recording day first, then find electrodes inside
  it." Electrode geometry is shared animal setup; a day pins a configuration version, it does
  not own probe geometry. Creating/exporting days before electrodes exist produces a
  day whose Devices step is an empty dead-end and whose export is blocked with no obvious
  cause.
- **Current route/control:** `AnimalWorkspace` showed only a day list + an "Edit Devices"
  button (ambiguous; does not read as "this is where probes live"). No setup checklist.
- **Required change (Task 2):** Animal Workspace shows a **setup checklist** (Subject,
  Electrodes/Probes, Cameras/Calibration, Data Acquisition, Recording Days). The
  Electrodes item is `not started` with the primary action **Set Up Electrodes**
  (→ `#/animal/:id/editor`). Checklist state from `getAnimalSetupChecklist(animal)`.

## 2. Animal with days but no electrode setup

- **Goal:** finish/export days that already exist on an animal whose probes were never set up.
- **Next safe action:** **Set Up Electrodes** for the shared animal configuration, then
  return to the day; failed channels can only be marked once electrodes exist.
- **Dangerous misconception:** "The Devices step inside the day is empty because I haven't
  added probes *to this day*." The user hunts for an add-probe control in the Day Editor and
  doesn't find one — probes are animal-level.
- **Current route/control:** `DayEditor/DevicesStep` empty state linked to "Configure
  Electrode Groups at Animal Level" (schema-ish wording); the Workspace gave no signal that
  setup was blocking.
- **Required change (Tasks 2 + 4):** the Workspace checklist shows Electrodes `not started`
  even when days exist ("These days don't have electrode/probe setup yet"); the Day Devices
  empty state routes to **Set Up Electrodes** and explains that failed channels come after
  electrodes. Both use the same wording so the action is recognisable.

## 3. Animal with existing / imported setup (review)

- **Goal:** continue work on an animal whose setup was created earlier or imported/recovered.
- **Next safe action:** **review** the recovered electrodes/cameras before trusting them for
  export — `Review Electrodes` / `Review Cameras`.
- **Dangerous misconception:** "If it loaded without an error, the recovered setup is
  correct." Recovered/imported metadata can be silently wrong (wrong probe, stale
  calibration) and would publish to DANDI/Spyglass as fact.
- **Current route/control:** load/recovery notice (`AppLayout` load notice) + per-editor
  `RawCorruptionBanner`, but the Workspace itself showed recovered setup as if freshly
  trusted (no review affordance).
- **Required change (Tasks 2 + 5):** when setup is present, the checklist item state is
  `needs review` with a **Review …** action; the Workspace shows an existing-data review
  summary ("N recording days, M hardware configuration(s) — review before export") that
  **reuses** the already-shipped raw-shape issues / `RawCorruptionBanner` / ValidationSummary
  rows. Export stays blocked by the existing validation gate; the review state never weakens
  or replaces that gate, it just makes recovered data visible.

## 4. Imported / recovered workspace with corruption

- **Goal:** recover and repair a workspace whose saved blob was incomplete or whose
  collections are malformed.
- **Next safe action:** repair the named corrupt section using the existing executable repair
  controls (reset cameras, rebuild configuration history, remove stale override), then review.
- **Dangerous misconception:** "The empty section means there's simply nothing there," when in
  fact a corrupt value is being ignored in favour of an empty default and silently dropped.
- **Current route/control:** `RawCorruptionBanner` (Animal Hardware Config / Day Overview),
  `ValidationSummary` "cannot read" / "missing day record" rows, `loadNotice`. These already
  exist and are correct — the gap was discoverability from the Workspace.
- **Required change (Task 5):** surface the same raw-shape issues in the Workspace review
  summary and route to the existing repair controls. **Do not invent a parallel recovery
  surface** — categorise existing issues via `workflowCategoryForIssue` → `existing_data`.

## 5. Historical day (uses a non-latest configuration version)

- **Goal:** edit metadata for a day that records an earlier hardware configuration.
- **Next safe action:** edit day-specific metadata / failed channels against the **pinned
  historical** version; to change geometry for this day, reconfigure — do not assume editing
  the latest animal setup changes this day.
- **Dangerous misconception:** "Editing the animal's electrodes now will fix this old day,"
  when the day is pinned to a historical snapshot and latest-setup edits won't touch it.
- **Current route/control:** `DevicesStep` already labels latest vs historical and explains
  pinned snapshots (good). The Workspace/validation surfaces did not reflect the version.
- **Required change (Tasks 4 + 7):** keep the historical labelling; `getDayWorkflowStatus`
  exposes `isHistoricalConfiguration` / `configurationVersion` so the Export preflight echoes
  "Configuration vN (historical)" and the Devices copy stays consistent with it.

## 6. Reconfiguration start day (hardware changed starting on a day)

- **Goal:** record a physical hardware change that begins on a specific recording day.
- **Next safe action:** start reconfiguration from the day ("Hardware changed starting on
  YYYY-MM-DD"), confirm the affected day range, fork the version, then edit the new geometry
  in the Animal Editor with the moved-day context visible.
- **Dangerous misconception:** "Changing the probes rewrites all my days' geometry," or "this
  only affects this one day." Reconfiguration forks a new version applied to a contiguous
  day range; earlier days keep their configuration.
- **Current route/control:** `ReconfigWizard` already frames the change as a timeline event
  with the affected-day list and a confirm button; the post-fork Animal Editor banner already
  says "Editing configuration vN … Moved N day(s)". Both are good.
- **Required change (Task 3):** verify and keep the post-fork banner; ensure the Devices
  reconfiguration entry point reads as "Hardware changed starting this day" and is visibly
  distinct from "Edit shared animal electrode setup". No new mechanics.

---

## Validation / Export workflow categories (Task 6)

Every blocking issue is grouped for the user by `workflowCategoryForIssue(issue)` (domain),
while the repair button still routes through the canonical `repairTargetForIssue` (domain).
Categories:

| Category | Means | Example codes |
| --- | --- | --- |
| `animal_setup` | shared hardware/subject setup | `channel_*`, `empty_location`, `unknown_device_type`, `divergent_camera_identity`, `partial_configuration`, `invalid_species`, `subject_id_slash` (subject identity is a setup item) |
| `day_metadata` | this day's session/tasks/videos/files | `dangling_camera_ref`, `duplicate_task_epoch`, `orphaned_video`, AJV session/task/epoch errors |
| `failed_channels` | day-specific failed-channel marks | `bad_channel_out_of_range`, `multishank_bad_channels_ignored` |
| `existing_data` | recovered/imported/corrupt repair | `malformed_*`, `missing_configuration_history`, `stale_bad_channel_override`, `shadowed_geometry_override` |
| `export_preflight` | export-confidence readiness | (readiness state, not an issue code) |

The action label for each category matches the setup-checklist wording (`Set Up Electrodes`,
`Review Cameras`, `Fix day failed channels`, …) so a user sees the same next-step name in the
checklist, the Day Devices step, Validation, and Export.
