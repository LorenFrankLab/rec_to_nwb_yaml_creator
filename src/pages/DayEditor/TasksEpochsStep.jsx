import { useState, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import { ConfirmDialog } from '../../components/Modal';
import TasksTable from './TasksTable';
import TaskModal from './TaskModal';
import BehavioralEventsDisplay from './BehavioralEventsDisplay';
import AssociatedVideosEditor from './AssociatedVideosEditor';
import { useStepperShortcut } from '../../hooks/stepperShortcuts';
import './TasksEpochsStep.scss';

/**
 * Collect the valid task-epoch numbers across a set of tasks.
 * @param {Array} tasks Tasks to scan.
 * @returns {Set<number>} The valid epoch numbers.
 */
function validEpochSet(tasks) {
  const set = new Set();
  (tasks || []).forEach((task) => {
    (task.task_epochs || []).forEach((epoch) => {
      const n = Number(epoch);
      if (Number.isInteger(n)) set.add(n);
    });
  });
  return set;
}

/**
 * Find associated_video_files / associated_files entries whose `task_epochs`
 * reference is no longer present in `nextTasks`.
 *
 * @param {object} day The day (reads associated_video_files / associated_files).
 * @param {Array} nextTasks The task set that WOULD result from the edit.
 * @returns {{ videos: Array, files: Array }} Affected entries (with their names).
 */
function findOrphanedReferences(day, nextTasks) {
  const valid = validEpochSet(nextTasks);
  const isOrphan = (entry) =>
    entry.task_epochs !== '' &&
    entry.task_epochs != null &&
    !valid.has(Number(entry.task_epochs));
  return {
    videos: (day.associated_video_files || []).filter(isOrphan),
    files: (day.associated_files || []).filter(isOrphan),
  };
}

/**
 * Produce a copy of an associated array with orphaned `task_epochs` cleared to ''.
 * @param {Array} entries associated_video_files / associated_files.
 * @param {Set<number>} valid Valid epoch numbers.
 * @returns {Array} The repaired array.
 */
function clearOrphans(entries, valid) {
  return (entries || []).map((entry) =>
    entry.task_epochs !== '' &&
    entry.task_epochs != null &&
    !valid.has(Number(entry.task_epochs))
      ? { ...entry, task_epochs: '' }
      : entry
  );
}

/**
 * TasksEpochsStep - Day Editor step for per-day tasks and epochs.
 *
 * Tasks inherit the parent animal's cameras and behavioral events (read from the
 * `animal` prop, never `mergedDay`). All persistence flows through
 * `onFieldUpdate('tasks', …)` / `onFieldUpdate('behavioral_events', …)` /
 * `onFieldUpdate('associated_video_files', …)`, which the stepper routes to the
 * store's `updateDay`; this component never touches the store directly.
 *
 * Repair-before-orphaning (Phase 6 Task 0c): a task delete or an epoch-removing
 * task edit that would leave an `associated_video_files` / `associated_files`
 * entry pointing at a now-missing epoch surfaces the affected rows and requires an
 * explicit, deterministic cleanup BEFORE the orphan is committed — the day's
 * validation summary never sees a dangling reference without a visible action. The
 * silent `useEpochCleanup` scrub remains as a backstop but is not the user's signal
 * on this surface.
 *
 * @param {object} props
 * @param {object} props.animal - Parent animal (source of cameras + behavioral events).
 * @param {object} props.day - The day being edited (tasks + day-specific events).
 * @param {object} [props.knownTaskDescriptions] - Map of task_name -> canonical
 *   task_description across the workspace (excluding this day's tasks), for the
 *   Spyglass task-name identity guard in the modal.
 * @param {Function} props.onFieldUpdate - `(fieldPath, value)` updater.
 * @returns {JSX.Element}
 */
export default function TasksEpochsStep({ animal, day, knownTaskDescriptions, onFieldUpdate }) {
  const tasks = day.tasks || [];
  const cameras = animal.cameras || [];

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [editingIndex, setEditingIndex] = useState(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  // Pending repair-before-orphan state. When a destructive task edit would orphan
  // associated videos/files, the committing tasks are stashed here with the affected
  // entries until the user confirms the deterministic cleanup.
  const [pendingRepair, setPendingRepair] = useState(null);

  const showCameraBanner = cameras.length === 0 && !bannerDismissed;
  const editingTask = modalMode === 'edit' && editingIndex != null ? tasks[editingIndex] : null;

  // Combine cross-workspace descriptions with this day's OTHER tasks so the modal's
  // identity guard sees siblings too (its own logic gives siblings precedence; the
  // editing task is excluded by reference inside the modal).
  const dayKnownDescriptions = { ...(knownTaskDescriptions || {}) };
  tasks.forEach((task) => {
    if (task !== editingTask && task.task_name) {
      dayKnownDescriptions[task.task_name] = task.task_description ?? '';
    }
  });

  /**
   * Open the modal to add a task.
   */
  function handleAddTask() {
    setModalMode('add');
    setEditingIndex(null);
    setModalOpen(true);
  }

  // Alt+N (global "add" shortcut) opens the add-task modal while this step is on
  // screen. A ref keeps the subscriber stable across renders.
  const addTaskRef = useRef(handleAddTask);
  addTaskRef.current = handleAddTask;
  useStepperShortcut(
    useCallback((action) => {
      if (action === 'add') addTaskRef.current();
    }, [])
  );

  /**
   * Open the modal to edit the task at `index`.
   * @param {number} index Task index.
   */
  function handleEditTask(index) {
    setModalMode('edit');
    setEditingIndex(index);
    setModalOpen(true);
  }

  /**
   * Commit a task array, then either repair orphaned associated references in the
   * same breath (when the caller pre-approved cleanup) or open a repair prompt.
   *
   * @param {Array} nextTasks The new task array.
   * @returns {void}
   */
  function commitTasks(nextTasks) {
    const { videos, files } = findOrphanedReferences(day, nextTasks);
    if (videos.length === 0 && files.length === 0) {
      onFieldUpdate('tasks', nextTasks);
      return;
    }
    // Surface the affected rows and hold the commit until the user confirms.
    setPendingRepair({ nextTasks, videos, files });
  }

  /**
   * Persist a saved task (append in add mode, replace at index in edit mode).
   * @param {object} taskData Saved task object.
   */
  function handleSaveTask(taskData) {
    const nextTasks =
      modalMode === 'edit' && editingIndex != null
        ? tasks.map((t, i) => (i === editingIndex ? taskData : t))
        : [...tasks, taskData];
    setModalOpen(false);
    setEditingIndex(null);
    commitTasks(nextTasks);
  }

  /**
   * Delete the task at `index` (after the confirmation in TasksTable, which already
   * surfaces affected videos). Cleans up orphaned references deterministically.
   * @param {number} index Task index.
   */
  function handleDeleteTask(index) {
    const nextTasks = tasks.filter((_, i) => i !== index);
    const valid = validEpochSet(nextTasks);
    // The delete is already confirmed (with the affected-video notice) in TasksTable,
    // so clean up and commit together — no second prompt for the delete path.
    onFieldUpdate('tasks', nextTasks);
    const repairedVideos = clearOrphans(day.associated_video_files, valid);
    const repairedFiles = clearOrphans(day.associated_files, valid);
    if (JSON.stringify(repairedVideos) !== JSON.stringify(day.associated_video_files || [])) {
      onFieldUpdate('associated_video_files', repairedVideos);
    }
    if (JSON.stringify(repairedFiles) !== JSON.stringify(day.associated_files || [])) {
      onFieldUpdate('associated_files', repairedFiles);
    }
  }

  /**
   * Apply the pending repair: commit the tasks and clear the orphaned references.
   */
  function confirmRepair() {
    if (!pendingRepair) return;
    const { nextTasks } = pendingRepair;
    const valid = validEpochSet(nextTasks);
    onFieldUpdate('tasks', nextTasks);
    const repairedVideos = clearOrphans(day.associated_video_files, valid);
    const repairedFiles = clearOrphans(day.associated_files, valid);
    if (JSON.stringify(repairedVideos) !== JSON.stringify(day.associated_video_files || [])) {
      onFieldUpdate('associated_video_files', repairedVideos);
    }
    if (JSON.stringify(repairedFiles) !== JSON.stringify(day.associated_files || [])) {
      onFieldUpdate('associated_files', repairedFiles);
    }
    setPendingRepair(null);
  }

  /**
   * Cancel the pending repair — the destructive task edit is abandoned.
   */
  function cancelRepair() {
    setPendingRepair(null);
  }

  /**
   * Affected videos for the pending delete (so TasksTable can name them in its
   * confirmation). Returns the orphans that deleting `index` would create.
   * @param {number} index Task index slated for deletion.
   * @returns {Array} The affected video entries.
   */
  function affectedVideosForDelete(index) {
    const nextTasks = tasks.filter((_, i) => i !== index);
    return findOrphanedReferences(day, nextTasks).videos;
  }

  /**
   * Close the modal without saving.
   */
  function handleCancel() {
    setModalOpen(false);
    setEditingIndex(null);
  }

  const repairNames = pendingRepair
    ? [...pendingRepair.videos, ...pendingRepair.files]
        .map((entry) => entry.name || '(unnamed)')
        .join(', ')
    : '';

  return (
    <div className="day-editor-section tasks-epochs-step">
      <h2>Tasks &amp; Epochs</h2>

      {showCameraBanner && (
        <div
          className="camera-info-banner"
          role="status"
          aria-live="polite"
          aria-label="Cameras recommended"
        >
          <span className="camera-info-icon" aria-hidden="true">📹</span>
          <div className="camera-info-text">
            This animal has no cameras configured. Cameras are optional, but they
            enable video linking and spatial tracking for your tasks.
          </div>
          <div className="camera-info-actions">
            <a href={`#/animal/${animal.id}/editor`} className="button-secondary">
              Add cameras
            </a>
            <button
              type="button"
              className="button-small"
              onClick={() => setBannerDismissed(true)}
              aria-label="Dismiss camera recommendation"
            >
              Skip for now
            </button>
          </div>
        </div>
      )}

      <TasksTable
        tasks={tasks}
        cameras={cameras}
        onAdd={handleAddTask}
        onEdit={handleEditTask}
        onDelete={handleDeleteTask}
        affectedVideosForDelete={affectedVideosForDelete}
      />

      <AssociatedVideosEditor
        videos={day.associated_video_files}
        cameras={cameras}
        tasks={tasks}
        onChange={(next) => onFieldUpdate('associated_video_files', next)}
      />

      <section className="behavioral-events-block">
        <BehavioralEventsDisplay
          inheritedEvents={animal.behavioral_events}
          dayEvents={day.behavioral_events}
          onDayEventsChange={(events) => onFieldUpdate('behavioral_events', events)}
        />
      </section>

      <TaskModal
        isOpen={modalOpen}
        mode={modalMode}
        task={editingTask}
        existingTasks={tasks}
        cameras={cameras}
        inheritedEvents={animal.behavioral_events}
        knownTaskDescriptions={dayKnownDescriptions}
        animalId={animal.id}
        onSave={handleSaveTask}
        onCancel={handleCancel}
      />

      <ConfirmDialog
        isOpen={pendingRepair != null}
        title="Repair affected videos?"
        message={
          pendingRepair
            ? `Saving this task removes a task epoch still referenced by: ${repairNames}. Confirm to save the task and clear the orphaned epoch reference(s) (their epoch will be unset) so no dangling reference is left. Cancel to discard this task change; the referenced file(s) stay unchanged.`
            : ''
        }
        confirmLabel="Clear references"
        cancelLabel="Cancel"
        destructive
        onConfirm={confirmRepair}
        onCancel={cancelRepair}
      />
    </div>
  );
}

TasksEpochsStep.propTypes = {
  animal: PropTypes.shape({
    id: PropTypes.string,
    cameras: PropTypes.array,
    behavioral_events: PropTypes.array,
  }).isRequired,
  day: PropTypes.shape({
    tasks: PropTypes.array,
    behavioral_events: PropTypes.array,
    associated_video_files: PropTypes.array,
    associated_files: PropTypes.array,
  }).isRequired,
  knownTaskDescriptions: PropTypes.object,
  mergedDay: PropTypes.object,
  onFieldUpdate: PropTypes.func.isRequired,
};

TasksEpochsStep.defaultProps = {
  knownTaskDescriptions: {},
  mergedDay: null,
};
