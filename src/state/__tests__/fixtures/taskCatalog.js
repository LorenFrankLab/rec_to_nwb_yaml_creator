/**
 * @fileoverview Focused fixtures for the Phase 8B task-type catalog model rehearsal.
 *
 * Each scenario is expressed as an ORDERED array of day records carrying inline `tasks[]`
 * (the current runtime shape) — the input the conversion utilities consume. The conversion
 * scans days in date order and dedups task definitions by `task_name` (see C3 in
 * `.claude/docs/plans/design-feedback-remediation/shared-contracts.md`).
 *
 * Coverage (the six required cases):
 *  - `oneTask`                     — a single day, single task.
 *  - `multipleTasks`               — a single day, several distinct task names.
 *  - `sameNameIdenticalDefs`       — same `task_name` across days, identical definitions (reuse).
 *  - `sameNameDifferentEnvironment`— same name, different `task_environment` (conflict).
 *  - `sameNameDifferentCamera`     — same name, different `camera_id` (conflict).
 *  - `taskCameraNotUsedDay`        — a task referencing a camera the day's `cameras_used` omits.
 *
 * Every task carries all five schema-required fields (`task_name`, `task_description`,
 * `task_environment`, `camera_id`, `task_epochs`), so the inline→catalog→inline round-trip is a
 * faithful byte-identity rehearsal. Definitions are deliberately CONSISTENT except where a
 * scenario name says otherwise, so only the conflict fixtures exercise the reconciliation path.
 */

/**
 * Build a well-formed inline task (all five schema-required fields present).
 *
 * @param {object} overrides - Field overrides.
 * @param overrides.task_name
 * @param overrides.task_description
 * @param overrides.task_environment
 * @param overrides.camera_id
 * @param overrides.task_epochs
 * @returns {object} A task object.
 */
export const task = ({
  task_name = 'sleep',
  task_description = 'The animal rests in a box',
  task_environment = 'SleepBox',
  camera_id = [0],
  task_epochs = [1],
} = {}) => ({ task_name, task_description, task_environment, camera_id, task_epochs });

/**
 * Build a recording-day record carrying inline tasks (the conversion input shape).
 *
 * @param {string} date - ISO date (YYYY-MM-DD).
 * @param {Array<object>} tasks - Inline tasks for the day.
 * @param {object} [extra] - Extra day fields (e.g. `cameras_used`).
 * @returns {object} A day record with `id`, `date`, `tasks`, and any extras.
 */
export const day = (date, tasks, extra = {}) => ({
  id: `remy-${date}`,
  date,
  tasks,
  ...extra,
});

// --- Canonical task definitions reused across scenarios -------------------------------------

const SLEEP = task({ task_name: 'sleep', task_description: 'Rests in a box', task_environment: 'SleepBox', camera_id: [0], task_epochs: [1] });
const WTRACK = task({ task_name: 'w-track', task_description: 'Forages on a W maze', task_environment: 'WTrack', camera_id: [1], task_epochs: [2] });

// --- Scenario 1: one task -------------------------------------------------------------------

export const oneTask = {
  days: [day('2023-06-01', [{ ...SLEEP }])],
};

// --- Scenario 2: multiple tasks (one day, distinct names) -----------------------------------

export const multipleTasks = {
  days: [day('2023-06-01', [{ ...SLEEP }, { ...WTRACK }])],
};

// --- Scenario 3: same name across days, identical definitions (reuse) -----------------------

export const sameNameIdenticalDefs = {
  days: [
    // Day 2 reuses "sleep" with an IDENTICAL definition but its own epochs ([3]).
    day('2023-06-01', [{ ...SLEEP, task_epochs: [1] }]),
    day('2023-06-02', [{ ...SLEEP, task_epochs: [3] }]),
  ],
};

// --- Scenario 4: same name, different environment (conflict) --------------------------------

export const sameNameDifferentEnvironment = {
  days: [
    day('2023-06-01', [{ ...SLEEP, task_environment: 'SleepBox', task_epochs: [1] }]),
    // Day 2 reuses "sleep" but with a DIFFERENT environment — first occurrence wins.
    day('2023-06-02', [{ ...SLEEP, task_environment: 'QuietRoom', task_epochs: [3] }]),
  ],
};

// --- Scenario 5: same name, different camera_id (conflict) ----------------------------------

export const sameNameDifferentCamera = {
  days: [
    day('2023-06-01', [{ ...SLEEP, camera_id: [0], task_epochs: [1] }]),
    // Day 2 reuses "sleep" but with a DIFFERENT camera_id — first occurrence wins.
    day('2023-06-02', [{ ...SLEEP, camera_id: [1], task_epochs: [3] }]),
  ],
};

// --- Scenario 6: task references a camera the day's cameras_used omits -----------------------

export const taskCameraNotUsedDay = {
  // The day explicitly marks only camera 0 used, but its task references cameras 0 AND 1.
  days: [
    day('2023-06-01', [{ ...WTRACK, camera_id: [0, 1], task_epochs: [2] }], { cameras_used: [0] }),
  ],
};

/**
 * Wrap an ordered day array into a minimal single-animal workspace blob (the shape the
 * v2→v3 conversion utility consumes). The animal carries the date-ordered `days` index and
 * `workspace.days` is keyed by day id.
 *
 * @param {Array<object>} days - Ordered day records (each with `id`, `date`, `tasks`).
 * @param {object} [animalExtra] - Extra animal fields.
 * @returns {object} A workspace blob `{ animals, days }`.
 */
export const workspaceFromDays = (days, animalExtra = {}) => ({
  animals: {
    remy: {
      id: 'remy',
      days: days.map((d) => d.id),
      ...animalExtra,
    },
  },
  days: Object.fromEntries(days.map((d) => [d.id, { animalId: 'remy', ...d }])),
});
