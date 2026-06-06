# Workflow clarity design

[<- back to PLAN.md](PLAN.md) · [screen map](workflow-screen-map.md) · [shared contracts](shared-contracts.md#user-mental-model-contract)

Date: 2026-06-05

## Problem

The current workspace can be technically correct and still confusing. Users have a hard time finding how to
set electrodes, what order to follow, and what to do when they already have existing data. The app currently
expects users to infer the model from scattered surfaces: Workspace, Animal Editor, Day Editor, Devices,
Reconfigure, Validation, and Export.

That is not a user problem. It is an information architecture problem.
The screen-level contract that operationalizes this design is [workflow-screen-map.md](workflow-screen-map.md).

The UI must teach the workflow directly:

1. Create or select an animal.
2. Configure shared animal hardware, especially electrodes/probes.
3. Create or import recording days.
4. Fill day-specific metadata: tasks, videos, files, failed channels, technical values.
5. Record hardware changes as configuration versions starting on a specific day.
6. Export only after the animal setup and day metadata agree with what will be encoded.

Users should not need to understand `animal.devices`, `configurationHistory`, `day.configurationVersion`,
`deviceOverrides`, or `mergeDayMetadata` to use the app safely.

## User mental model to preserve

- **Animal setup is shared.** Electrodes/probes, cameras/calibrations, data acquisition hardware, and default
  technical values belong to the animal/setup unless explicitly changed over time.
- **A recording day uses a specific hardware configuration.** The day should visibly say which configuration
  version it uses.
- **Failed channels are day-specific.** Users should understand that failed-channel marks apply to this
  recording day, not to all history.
- **A hardware change is a time event.** Reconfiguration should be framed as "hardware changed starting on
  this day", with an explicit affected-day range.
- **Existing data needs review.** If days or imported metadata already exist, the app should guide users to
  review the recovered animal setup before export instead of assuming it is trustworthy.
- **Export is a confidence check.** The final preflight must summarize the animal, day, hardware
  configuration, cameras/calibrations, probes/bad channels, tasks/videos, opto state, and unresolved risks.

## Required workflow shape

### Animal Workspace

The animal workspace should be the user's operational home. It must expose a setup checklist for the selected
animal:

- Subject
- Electrodes / probes
- Cameras / calibration
- Data acquisition
- Recording days

Each checklist item should have a clear state such as `not started`, `needs review`, `has errors`, or
`complete`. The primary action for missing electrodes must be **Set Up Electrodes**. Electrode setup must not
be discoverable only from inside a recording day.

Required states:

- **New animal, no days:** show "Set up shared hardware before creating/exporting days" with `Set Up
  Electrodes` as a prominent action.
- **Animal has days but no electrode setup:** show "These days do not yet have electrode/probe setup" and link
  to `Set Up Electrodes`.
- **Animal has existing/imported setup:** show `Review Electrodes` / `Review Cameras` rather than silently
  treating recovered metadata as trusted.
- **Setup has validation errors:** show the setup item as blocked and route to the exact owning editor step.

### Animal Editor

The Animal Editor should be understood as **shared animal setup**, not as a detached hardware form.

Required behavior:

- The first screen/step labels must make it obvious that electrodes/probes are configured here.
- The electrode setup path should be reachable from Workspace and Day Editor with the same wording.
- Hardware sections should say whether edits affect the latest configuration and future days, or a newly
  forked configuration version.
- Camera naming guidance must explain that a different zoom/calibration/lens/model/id needs a different
  camera name.

### Day Editor Devices Step

The Day Editor Devices step should not feel like the place to "find and create electrodes" from scratch.
It should explain the current day's relationship to animal setup:

- "This day uses animal electrode configuration vN."
- "Edit shared animal electrode setup" for metadata corrections.
- "Hardware changed starting this day" for reconfiguration.
- "Mark failed channels for this recording day" for day-specific failed-channel edits.

Required states:

- **No electrode setup exists:** show a clear empty state with `Set Up Electrodes` and explain that failed
  channels can be marked after electrodes exist.
- **Historical configuration:** show that the day is using a historical version and that edits to latest setup
  will not change this day unless reconfigured.
- **Stale/corrupt overrides:** show repair controls in day language, not schema language.

### Reconfiguration

Reconfiguration should be framed as a physical timeline event:

- Start from a day: "Hardware changed starting on YYYY-MM-DD."
- Show which days will move to the new version.
- Require confirmation before forking/applying the new version.
- After fork, land in the Animal Editor with a banner: "Editing configuration vN for N moved days."
- The user should not have to infer whether they are editing latest, historical, or day-specific geometry.

### Existing data / imports / restored workspaces

When the app loads or imports a workspace with existing days/configuration:

- Show a review banner or checklist state: "We found N recording days and M hardware configuration(s). Review
  electrodes/cameras before export."
- Do not hide recovered/corrupt data behind empty states.
- If recovered data is missing electrodes, cameras, configuration history, or day pins, route to a visible
  repair/setup action.
- Export should remain blocked until the review/setup state is clean or explicitly not required.

### Validation and Export

Validation and Export should classify issues by user workflow, not only by schema path:

- Animal setup issue
- Day metadata issue
- Day-specific failed-channel issue
- Existing data/repair issue
- Export/preflight issue

Each issue should route to the next action in the workflow. The category **headings** carry the
setup-checklist vocabulary; the per-issue repair **buttons** keep the canonical `repairTargetForIssue`
labels and routing ("Fix in Animal Editor → …", "Fix in Devices") rather than being reworded per
category — the heading above each button supplies the workflow context. (As-shipped contract; see
the Phase 8.6 Task 6 note.) The preflight summary must show the same mental model as the setup
checklist: animal setup first, day-specific metadata second, export confidence last.

## Claude-executable implementation tasks

These tasks are suitable for Claude Code. They do not require a human usability study.

1. **Workflow inventory.** Produce a route/state checklist for new animal, existing animal with no electrodes,
   existing animal with days, imported/recovered workspace, historical day, and reconfiguration start day.
   For each state, record primary user goal, expected next action, dangerous misconception, and current UI
   route/control.
2. **Animal setup checklist.** Add or revise the animal workspace setup summary so electrodes/probes are a
   first-class checklist item with a clear primary action.
3. **Electrode setup discoverability.** Ensure a user can find `Set Up Electrodes` from the Workspace and
   from a Day Editor devices empty state without knowing to open the Animal Editor manually.
4. **Day Devices copy and actions.** Rewrite the Devices step around configuration version + day-specific
   failed channels. Keep the two main actions distinct: edit shared setup vs. hardware changed starting this
   day.
5. **Existing-data review state.** Add visible review/repair states for animals/days loaded with existing
   configurations, missing configurations, or recovered/corrupt raw state.
6. **Reconfiguration clarity.** Make the affected-day range, target version, and post-fork edit context visible
   before and after reconfiguration.
7. **Validation grouping.** Ensure repair summaries use workflow categories and action labels that match the
   screens users will see.
8. **Export preflight alignment.** Make the preflight summary echo the setup checklist and the Day Devices
   version context.

## Validation slice

| Test / Artifact | Asserts |
| --- | --- |
| `workflow route/state inventory` | new, existing, imported, historical, and reconfiguration states have a documented user goal, next action, dangerous misconception, and UI route/control. |
| Playwright: new animal electrode setup | starting from a new animal, a user can find and activate `Set Up Electrodes` from the workspace without visiting a day first. |
| Playwright: existing days without electrodes | an animal with days but no electrode setup shows a clear setup-blocked state and routes to electrode setup. |
| Playwright: Day Devices empty state | a day with no electrode setup explains shared setup vs. failed channels and exposes `Set Up Electrodes`. |
| Playwright: day-specific failed channels | after electrodes exist, the Devices step labels failed channels as applying to this recording day. |
| Playwright: reconfiguration clarity | starting from a day, the wizard shows affected future days, creates/forks the version, and lands in Animal Editor with the edited version context visible. |
| Playwright/helper: existing-data review | loaded/imported workspace with existing days/configs shows review state before export and blocks export on missing/corrupt setup. |
| Preflight assertion | Export summary names animal, day, configuration version, electrodes/probes, cameras/calibrations, failed channels, tasks/videos, opto state, and unresolved setup errors. |

## Deliberately not in scope

- Human lab-user usability testing. It is recommended separately, but this plan must be executable by Claude
  Code.
- Rewriting the scientific/export semantics. This phase changes discoverability, wording, routing, and setup
  state presentation; correctness rules remain owned by the earlier phases.
- A full visual design-system rebuild. Small layout and component changes are allowed when needed to make the
  workflow understandable.

## Acceptance

- A first-time user can discover electrode setup before creating/exporting a day.
- A user with existing data is told what was found and what must be reviewed before export.
- The Day Editor no longer implies that shared electrode geometry is primarily configured there.
- Reconfiguration reads as a physical hardware-change event across a day range.
- Validation and Export use the same user-facing workflow categories as the setup checklist.
- No required workflow path depends on schema/internal terms alone.
