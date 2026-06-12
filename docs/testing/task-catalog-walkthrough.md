# Task-type catalog — cognitive walkthrough (Phase 8C)

This is the comprehension artifact for the "define-once, reuse-per-day" task-type catalog. It walks
the five states a reviewer/tester should see and confirms a user can answer the four ownership
questions **from the UI alone**, without memorizing where a fact lives.

Screenshots live in [screenshots/task-catalog/](screenshots/task-catalog/) (desktop unless noted):
`empty-desktop.png`, `normal-desktop.png`, `conflict-desktop.png`, `repair-desktop.png`,
`normal-390.png`. Capture procedure is at the end.

## The model in one sentence

A **task type** (e.g. `sleep`, `w-track`) is defined **once on the animal** (Animal Setup → **Task
Types** tab); each **recording day** *selects* the types it ran and *orders* their epochs (Day Editor
→ **Tasks & Epochs**). The exported YAML is unchanged — the day's selections resolve back to the same
inline `tasks[]`.

## The four questions a reviewer must be able to answer

| Question | Where the UI answers it |
| --- | --- |
| **Where is this task type defined?** | The animal's **Task Types** tab. Its scope line reads "Define once — each recording day picks and orders its epochs." The Day Editor never lets you retype a definition. |
| **Which days use it?** | Each day's Tasks & Epochs table lists the task types it picked (by name). Deleting a type warns that the days using it will need a re-pick. |
| **What do I fix here vs. on the day?** | Ownership is routed, not memorized: a **duplicate task name** is an *animal* problem → "Fix in Animal Setup → Task Types". A **dangling reference / wrong epochs / a camera the day didn't use / a migration reconciliation** is a *day* problem → "Fix in Epochs". |
| **Can I add/select/reorder without retyping?** | Yes. The day's **+ Add Task** is a controlled *picker* of existing types; ↑/↓ reorder rows; epochs are assigned per day. A missing type is added inline via **Define a new task type** (writes the animal catalog) — never retyped per day. |

## The five states

### 1. Empty (`empty-desktop.png`)
A new animal with no task types. The Task Types tab shows the empty state: "No Task Types Defined",
explaining define-once/reuse-per-day, with **Add First Task Type**. A day for this animal shows "No
tasks recorded for this day" with **Add Task** + **Define a new task type** — proving the user can
start from the day and quick-add into the catalog.

### 2. Normal (`normal-desktop.png`)
An animal with a few task types (name · description · environment · cameras · status ✓). A day that
picked two of them, each with its epochs, ordered. This is the steady state: recognition over recall —
the day shows what it ran by name, not a re-typed form.

### 3. Conflict (`conflict-desktop.png`)
A day migrated from data where the same `task_name` carried two different definitions. The catalog
normalized it to the first occurrence and recorded a **`task_definition_reconciled`** review item on
the day (a *warning*, not a blocker — the export is already the valid canonical form). The user sees
the original-vs-canonical note and confirms. This is the one case migration legitimately changed a
day's export, and it is surfaced, never silent.

### 4. Repair (`repair-desktop.png`)
Two repairable problems with clear ownership:
- **Animal-owned**: two task types share a name → `duplicate_task_type_name` (blocked in-modal when
  adding; flagged red in the catalog table) → "Fix in Animal Setup → Task Types".
- **Day-owned**: a day instance whose type was deleted → `dangling_task_type_ref` ("Unknown task
  type — re-pick", red row) → "Fix in Epochs". A task type listing a camera the day's `cameras_used`
  omits → `task_camera_not_used` → "Fix in Epochs".

### 5. Narrow / ~390px (`normal-390.png`)
The normal state at phone width. The Task Types and instances tables stack into labelled cards
(`data-label` headers); the primary **Add Task** action and the ↑/↓/Edit/Remove controls stay
reachable (≥44–48px touch targets) with no horizontal overflow or overlapping controls.

## Repair-before-orphaning (data integrity)

Removing a task or an epoch that an associated video/file still references prompts a deterministic
cleanup **before** committing (re-keyed off the resolved instance epochs). The repair dialog is
expected, not an error. Covered by `DestructiveEdits.integration` and `AssociatedFiles.integration`.

## Accessibility

`jest-axe` runs clean on the Task Types catalog table (`TaskTypesSection.test.jsx`). The day pick/order
controls are role-correct (combobox type picker, spinbutton epoch inputs, named reorder/edit/remove
buttons); modal focus-trap/return comes from the shared `Modal` primitive (verified in
`TasksEpochsStep.integration`).

## Capturing the screenshots

The five states are reproducible from seeded workspaces. With the dev server running
(`npm run start` → `http://localhost:3000`), seed the relevant workspace blob into `localStorage`
(key `rec_to_nwb_workspace_v1`, `schemaVersion: 3`) and navigate:
- Empty: a fresh animal → `#/animal/<id>/task-types` and `#/day/<dayId>` (Tasks & Epochs).
- Normal / Conflict / Repair: seed an animal with `taskTypes` + a day with `taskInstances`
  (and, for Conflict, `state.taskDefinitionReconciliations`; for Repair, a duplicate name / a
  `taskTypeId` with no matching type).
- Narrow: resize to 390×844 before capturing the Normal state.

Use the Playwright MCP (`browser_navigate` → `browser_take_screenshot`) or extend the committed
`e2e/` suite with a screenshot spec writing to the paths above.
