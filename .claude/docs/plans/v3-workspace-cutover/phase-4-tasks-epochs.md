# Phase 4 — Day Editor: Tasks & Epochs

[← back to PLAN.md](PLAN.md) · [overview](overview.md) · [shared-contracts](shared-contracts.md)

Replace the `EpochsStub` placeholder (Day Editor step 3) with a working Tasks & Epochs step.
Tasks are per-day; each task inherits the parent animal's cameras and behavioral events.
A task carries a name, optional description, a multi-select of inherited camera IDs, and a list of
epoch numbers. The step reports real status so the Devices→Epochs→Validation→Export gate can
eventually open. All data-entry validation is **non-blocking** except epoch end-before-start, per the
severity policy.

**Inputs to read first:**

- [src/pages/DayEditor/EpochsStub.jsx](../../../../src/pages/DayEditor/EpochsStub.jsx) — the 22-line
  placeholder being deleted in this phase. Its docstring references a milestone ("M7"); the
  replacement must not carry any such label.
- [src/pages/DayEditor/DayEditorStepper.jsx:104-110](../../../../src/pages/DayEditor/DayEditorStepper.jsx) —
  the `steps` array; `{ id: 'epochs', label: 'Epochs', component: EpochsStub }` at `:107` is the
  render site to repoint. Note the props passed to every step component (`:151-156`):
  `animal`, `day`, `mergedDay`, `onFieldUpdate`. `onFieldUpdate('tasks', nextTasks)` already routes
  through `updateDay` (`:91`); reuse it — do **not** call the store directly.
- [src/pages/DayEditor/validation.js:52-65](../../../../src/pages/DayEditor/validation.js) —
  `computeStepStatus`; `epochs: 'incomplete'` is hardcoded at `:61`. `groupErrorsByStep` (`:117-148`)
  already routes `task`/`behavioral`/`epoch` paths into the `epochs` group (`:138`). This phase
  computes a real `epochs` status here.
- [src/state/workspaceTypes.js:239-247](../../../../src/state/workspaceTypes.js) — `Task` typedef.
  **Persisted field names are `task_name`, `task_description`, `task_environment`, `camera_id`
  (array), `task_epochs` (array).** [src/state/workspaceTypes.js:249-255](../../../../src/state/workspaceTypes.js) —
  `BehavioralEvent` (`{ name, description }`). [:118-128](../../../../src/state/workspaceTypes.js) —
  `Camera` (`id`, `camera_name`, `manufacturer`, `model`, `meters_per_pixel`).
- [src/nwb_schema.json:773-861](../../../../src/nwb_schema.json) — the `tasks` schema. **Critical:**
  `camera_id` is `array<integer>` (`:823-839`), `task_epochs` is `array<integer>` with
  `uniqueItems` (`:841-858`). `task_name`/`task_description`/`task_environment` are required non-blank
  strings. **There are no epoch start/end-time fields in the schema** — epochs persist as plain
  integers. Start/end times in the editor are a UI-only aid for ordering and overlap detection; only
  the integer epoch numbers reach `task.task_epochs`.
- [src/state/store.js:414-460](../../../../src/state/store.js) — `updateDay(dayId, updates)`. It
  replaces `updated.tasks` wholesale when `updates.tasks !== undefined` (`:427-429`) and
  `behavioral_events` likewise (`:430-432`), via `structuredClone` + `setWorkspace`. Persist through
  this only; preserve its immutability.
- [src/state/workspaceUtils.js:75-76](../../../../src/state/workspaceUtils.js) — `mergeDayMetadata`
  assigns `tasks: day.tasks` and `behavioral_events: day.behavioral_events` straight through to the
  flat YAML object. Confirms the persisted task shape is exactly the YAML shape; no transform layer.
- [src/pages/AnimalEditor/CamerasSection.jsx](../../../../src/pages/AnimalEditor/CamerasSection.jsx) and
  [src/pages/AnimalEditor/BehavioralEventsSection.jsx](../../../../src/pages/AnimalEditor/BehavioralEventsSection.jsx) —
  existing table/empty-state/status-badge/inline-edit patterns to mirror (header, `table-actions`,
  `status-badge`, `data-label` responsive cells, `role="status"`/`role="alert"` messaging,
  `autoFocus` on new rows). Reuse these conventions; do not invent new ones.
- [src/pages/AnimalEditor/CameraModal.jsx:155-180](../../../../src/pages/AnimalEditor/CameraModal.jsx) —
  reference focus-trap implementation that Phase 3 ports into the shared `<Modal>`. `TaskModal`
  consumes the shared `<Modal>` instead of re-implementing this.
- [src/pages/AnimalEditor/AnimalEditorStepper.jsx:55-61,441-443](../../../../src/pages/AnimalEditor/AnimalEditorStepper.jsx) —
  the parent-owns-modal-state pattern (`modalOpen`, `modalMode`, `editingGroup`; `onAdd`/`onEdit`/
  `onDelete` handlers) that `TasksEpochsStep` mirrors for `TaskModal`.

**Contracts referenced:**

- [Validation & step-status contract](shared-contracts.md#validation--step-status-contract) — wire the
  `epochs` step (today hardcoded `'incomplete'` at `validation.js:61`) to real task/epoch validity via
  `computeStepStatus`. Honor the **severity policy**: epoch `end > start` is an `error`; overlapping
  epochs and empty-epoch tasks are `warning`s; a task referencing a non-existent camera is `info`.
  Only `error`-severity issues block (here: block the modal Save; everything else still saves). Do not
  fork validation into components for the schema-level checks — reuse `validate(model)` /
  `validateField`; epoch start/end ordering and overlap are UI-only checks that live in this step
  because they have no YAML representation.
- [`<Modal>` primitive contract](shared-contracts.md#modal-primitive-contract) — `TaskModal` is built
  on the shared `src/components/Modal/…` from the start (it does **not** ship its own ESC/scroll/trap
  code). Initialize the modal's form from the edited task via a stable remount key, not an effect
  keyed on the task array. **Depends on Phase 3 having landed the shared `<Modal>`.**
- [Workspace data model & store actions](shared-contracts.md#workspace-data-model--store-actions) —
  per-day tasks live at `days[dayId].tasks`; mutate only through `updateDay` (via the step's
  `onFieldUpdate`). Note the invariant: the orphaned-epoch cleanup effect is **not** extended here —
  Phase 6 owns unifying it across legacy + workspace tasks. This phase only adds workspace tasks.

## Tasks

- **Delete `EpochsStub.jsx`** and repoint `DayEditorStepper.jsx:107` (`steps` array) and its import
  (`:10`) to a new `TasksEpochsStep`. No other stub is touched (ValidationStub/ExportStub stay until
  Phase 5). The new component receives the same props the stub site passes
  (`animal`, `day`, `mergedDay`, `onFieldUpdate`) — verify against `DayEditorStepper.jsx:151-156`.

- **`src/pages/DayEditor/TasksEpochsStep.jsx`** — the step container. Owns `TaskModal` open/edit
  state (mirror `AnimalEditorStepper`'s parent-owns-modal pattern). Renders, top to bottom:
  1. A **camera info banner** (own subtask below) when `animal.cameras` is empty/undefined.
  2. `TasksTable` (animal's tasks for this day, add/edit/delete).
  3. `BehavioralEventsDisplay` showing inherited animal events (read-only) + optional day-specific
     events.
  Persists task changes via `onFieldUpdate('tasks', nextTasks)` and day-specific events via
  `onFieldUpdate('behavioral_events', nextEvents)` (both already supported by `updateDay`). It does
  **not** call the store directly. Reads cameras and inherited events from the `animal` prop, never
  from `mergedDay`.

- **Camera info banner (NON-BLOCKING)** — shown by `TasksEpochsStep` when the animal has no cameras.
  Blue/info styling (not amber). `role="status"`, `aria-live="polite"`. Message conveys that cameras
  are optional but recommended for video linking and spatial tracking. Two actions: a link to the
  Animal Editor cameras step (href to the animal-editor route; verify the route shape used elsewhere
  in DayEditorStepper's back link, `:132`, rather than inventing one) and a session-scoped "Skip"
  dismiss. **Crucially, task creation/saving is allowed while the banner is visible** — the banner
  never gates the table or modal.

- **`src/pages/DayEditor/TasksTable.jsx`** — CRUD table mirroring `CamerasSection`. Columns: task
  name, cameras (count or id list), epochs (count), status badge, actions (Edit/Delete). Status badge
  derived from per-task validity: ✓ valid, ⚠ warning (no epochs, overlapping epochs, or missing-camera
  ref), ❌ error (blank required field). Delete confirms via the shared confirm/AlertModal path used in
  the codebase (do **not** add a raw `window.confirm` — Phase 3 is removing those; follow whatever
  Phase 3 standardized). Empty state with an "Add Task" button, matching `CamerasSection`'s empty
  state. Responsive `data-label` cells.

- **`src/pages/DayEditor/TaskModal.jsx`** — built on the shared `<Modal>`. Body is an accordion using
  native `<details>`/`<summary>` (progressive disclosure: required sections `open`, optional/
  informational collapsed):
  - **Task details** — `<details open>`: `task_name` (text, required, unique within the day),
    `task_description` (textarea, optional), and `task_environment` (text; schema-required non-blank —
    surface it here so saved tasks satisfy the schema).
  - **Cameras** — `<details>` (collapsed): a checkbox multi-select over `animal.cameras`, each option
    labelled by camera id + name. Selected ids are stored as **integers** in `task.camera_id`. If
    `animal.cameras` is empty, show an inline info note + link to the Animal Editor (same target as
    the step banner) — still allow saving.
  - **Behavioral events (inherited)** — `<details>` (collapsed, informational): read-only list of the
    animal's events with lock icons (delegates to `BehavioralEventsDisplay` in read-only mode).
  - **Task epochs** — `<details open>`: embeds `TaskEpochsEditor`.
  Save is disabled only while an **error**-severity issue is present (blank required field, or any
  epoch row with end ≤ start). Warnings (no epochs, overlaps) and missing-camera info do **not**
  disable Save. Cancel discards. Initialize form fields from the edited task via the modal's stable
  remount key (per the Modal contract), not an array-keyed effect.

- **`src/pages/DayEditor/TaskEpochsEditor.jsx`** — dynamic rows; each row has epoch number, start
  time (s), end time (s), and a remove button. "Add epoch" appends a row and auto-focuses its first
  input. Per-row validation: **end ≤ start = ERROR** (inline message "End time must be after start
  time"; blocks the modal Save while present). Cross-row: **overlapping intervals = WARNING**
  (non-blocking, e.g. "Epochs X and Y overlap — may be intentional"). On commit, the editor maps rows
  to the integer epoch numbers stored in `task.task_epochs` (unique, schema-required integers); start/
  end times are editor-local state and are **not** persisted to the day (the schema has no field for
  them — see Inputs). Document this in the component docstring so a later reader doesn't try to persist
  them.

- **`src/pages/DayEditor/BehavioralEventsDisplay.jsx`** — read-only inherited animal events with lock
  icons (used inside `TaskModal` and at the bottom of `TasksEpochsStep`). Optionally renders a
  collapsible day-specific events sub-section (add/edit, mirroring `BehavioralEventsSection`'s inline
  pattern) that writes through `onFieldUpdate('behavioral_events', …)`; a day-specific event whose
  `name` duplicates an inherited animal event is flagged (warning, non-blocking). Inherited events are
  never editable here.

- **Wire `epochs` step status** in `computeStepStatus` (`validation.js:61`): replace the hardcoded
  `'incomplete'` with a real status derived from the day's tasks — `'incomplete'` when there are no
  tasks; `'error'` when any task has an `error`-severity issue (blank required field, or — were they
  representable — an epoch ordering error; since ordering errors are blocked at save, this is mainly
  the schema-required-field check via the `epochs` group from `groupErrorsByStep`); otherwise
  `'valid'`. Keep using `groupErrorsByStep(issues).epochs` for schema errors; add the
  empty-tasks/incomplete check alongside it. Do not loosen `StepNavigation.isExportEnabled()`.

- **Styles** — co-locate `.scss` per existing convention (e.g. `TasksTable.scss`,
  `TaskModal.scss`), reusing the shared `status-badge`, `section-header`, `table-actions`, empty-state,
  and inline-error/warning classes already used by `CamerasSection`/`BehavioralEventsSection` rather
  than duplicating them.

## Deliberately not in this phase

- **YAML export and the per-day Validation step** — `ValidationStub`/`ExportStub` and wiring the
  `validation` step status are Phase 5. This phase only wires the `epochs` step status.
- **Cross-day Validation Summary** — Phase 7.
- **Optogenetics editor UI** — out of scope for the whole plan (overview Non-Goals).
- **Animal-level camera / hardware / behavioral-event editing** — already done in M8a; this phase only
  *reads/inherits* `animal.cameras` and `animal.behavioral_events`. The banner/links route the user to
  the existing Animal Editor; they do not edit animal data here.
- **Extending the orphaned-epoch cleanup effect** to workspace tasks — Phase 6 owns the unified
  cleanup (per the data-model contract invariant). Do not touch the effect in `store.js` here.
- **Replacing the shared `<Modal>` or its trap** — created/owned by Phase 3; consumed here.

## Validation slice

| Test | Asserts |
| --- | --- |
| TaskModal renders accordion sections | Task-details and Task-epochs `<details>` are `open`; Cameras and Behavioral-events `<details>` are collapsed. |
| TaskModal camera multi-select | Checking camera options writes the selected camera ids as **integers** into `task.camera_id`; unchecking removes them. |
| TaskEpochsEditor end ≤ start is error | A row with end ≤ start shows the inline error and disables the modal Save button; fixing it re-enables Save. |
| TaskEpochsEditor overlapping epochs warns | Overlapping intervals surface a warning message but do **not** disable Save (non-blocking). |
| TaskEpochsEditor add row auto-focus | "Add epoch" appends a row and moves focus to its first input. |
| TaskEpochsEditor persists integers only | Saving a task stores `task_epochs` as unique integers; no start/end times are written to the day. |
| Empty-cameras info banner non-blocking | When `animal.cameras` is empty the blue info banner renders (`role="status"`, `aria-live="polite"`) and a task can still be added/saved. |
| Missing-camera reference is info | A task referencing a camera id absent from `animal.cameras` shows an info-level message and still saves. |
| BehavioralEventsDisplay inherited read-only | Inherited animal events render with lock icons and no edit control; the read-only list cannot mutate `animal.behavioral_events`. |
| BehavioralEventsDisplay day-specific dup | A day-specific event duplicating an inherited name is flagged (warning, non-blocking). |
| TasksTable empty state | With no tasks, the empty state and "Add Task" button render. |
| TasksTable status badges | ✓ for a complete task, ⚠ for no-epochs/overlap/missing-camera, ❌ for a blank required field. |
| TasksTable delete | Delete (confirmed via the shared confirm path) removes the task via `onFieldUpdate('tasks', …)`. |
| epochs step status valid | `computeStepStatus` returns `epochs: 'valid'` when the day has ≥1 task with valid required fields; `'incomplete'` with zero tasks; `'error'` on a schema error. |
| TasksEpochsStep keyboard / focus *(integration)* | Modal opens with focus inside, Tab cycles within (shared `<Modal>` trap), ESC closes and returns focus to the trigger. |
| Inheritance integration *(integration)* | Rendering `TasksEpochsStep` with a synthesized animal (2 cameras + behavioral events) shows those cameras as task options and those events as inherited; a saved `day.tasks[].camera_id` references the animal's camera ids. |
| Persistence integration *(integration)* | Saving a task calls `updateDay` (through `onFieldUpdate`) and the resulting `day.tasks` is a fresh object (immutability preserved; input task not mutated). |

Mark the three rows tagged *(integration)* explicitly (Vitest; render via the store/provider).
All other rows are unit tests on the individual components.

**Golden baselines:** the 4 fixtures in
`src/__tests__/baselines/golden-yaml.baseline.test.js` must stay byte-identical — this phase changes
no YAML output (task shape already matches the schema). Run them as a gate.

## Fixtures

A shared test helper (placed under `src/pages/DayEditor/__tests__/`, following the existing test
files there) synthesizes:

- an **Animal** with 2 cameras (distinct integer `id`s + names) and ≥2 `behavioral_events`
  (`{name, description}`), matching the `workspaceTypes` shapes;
- a **Day** belonging to that animal with 1 task whose `camera_id` references one of the animal's
  cameras and whose `task_epochs` has 2 integers;
- the `mergedDay` for that pair via `mergeDayMetadata` (for status-computation tests).

Provide it as an exported factory (e.g. `makeAnimalWithCamerasAndDay(overrides)`) so each test starts
from a clean clone; do not copy-paste the fixture across test files. Integration tests render through
the real store provider used by the existing `DayEditorStepper.test.jsx`.

## Review

Follow the full gate in [review-protocol.md](review-protocol.md). Phase-specific:

- **Self-verify (§1):** run this phase's Validation slice + `npx vitest run` (no regressions; baseline 2747/1 skipped) + `npx vitest run baselines` (byte-identical). Emphasis: severity policy is correct (only epoch end ≤ start and blank required fields block Save; empty cameras / missing-camera refs / no-epochs / overlaps are non-blocking); `task.camera_id` and `task.task_epochs` persist as integer arrays with no epoch start/end times leaking into day data; all writes go through `onFieldUpdate`→`updateDay`.
- **Playwright UI (§2):** add a task, add/remove epoch rows (end > start error shown; overlap warning non-blocking), and confirm the camera-inheritance info banner appears when there are no cameras. 0 console errors.
- **Reviewers:** `pr-review-toolkit:code-reviewer` (always), plus `pr-test-analyzer` (new task/epoch behavior + edge cases), `ux-reviewer`, and a WCAG 2.1 AA a11y check.
- **Checklist (§6):** every task implemented; "Deliberately not in this phase" honored; tests non-trivial; no plan/phase/milestone (M7/M8b/etc.) or "stub" strings in code/test/component/module names or docstrings; old code flagged for removal is removed (`EpochsStub.jsx` deleted, no orphan imports); user-facing docs updated.
