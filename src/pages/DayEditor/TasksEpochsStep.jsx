import { useState, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import { ConfirmDialog } from '../../components/Modal';
import TasksTable from './TasksTable';
import TaskModal from './TaskModal';
import BehavioralEventsDisplay from './BehavioralEventsDisplay';
import AssociatedVideosEditor from './AssociatedVideosEditor';
import AssociatedFilesEditor from './AssociatedFilesEditor';
import FsGuiSection from './FsGuiSection';
import MalformedCollectionNotice from './MalformedCollectionNotice';
import { useStepperShortcut } from '../../hooks/stepperShortcuts';
import { RAW_DAY_ARRAY_FIELDS } from '../../validation/rawShape';
import {
  getAnimalBehavioralEvents,
  getAnimalCameras,
  getDayTasks,
  getDayAssociatedVideos,
  getDayAssociatedFiles,
  getDayBehavioralEvents,
  getDayFsGuiYamls,
} from '../../state/workspaceSelectors';
import './TasksEpochsStep.scss';

// The day-owned collections this step owns (raw-shape reset surface). Derived from the
// single source so the reset controls and the validator can't drift.
const EPOCHS_STEP_COLLECTIONS = RAW_DAY_ARRAY_FIELDS.filter((f) => f.repairStep === 'epochs');

/**
 * Collect the valid task-epoch numbers across a set of tasks.
 * @param {Array} tasks Tasks to scan.
 * @returns {Set<number>} The valid epoch numbers.
 */
function validEpochSet(tasks) {
  const set = new Set();
  // Guard corrupt persisted shapes (a non-array tasks / task_epochs from a bad import)
  // so the orphan helpers never throw before the raw-shape reset UI can render.
  (Array.isArray(tasks) ? tasks : []).forEach((task) => {
    (Array.isArray(task?.task_epochs) ? task.task_epochs : []).forEach((epoch) => {
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
  // Guard corrupt persisted shapes: a non-array associated_* (e.g. `{}`) must not throw
  // when a task Add/Edit/Delete runs before the user resets it via the raw-shape notice.
  return {
    videos: getDayAssociatedVideos(day).filter(isOrphan),
    files: getDayAssociatedFiles(day).filter(isOrphan),
  };
}

/**
 * Produce a copy of an associated array with orphaned `task_epochs` cleared to ''.
 * @param {Array} entries associated_video_files / associated_files.
 * @param {Set<number>} valid Valid epoch numbers.
 * @returns {Array} The repaired array.
 */
function clearOrphans(entries, valid) {
  return (Array.isArray(entries) ? entries : []).map((entry) =>
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
 * Repair-before-orphaning: a task delete or an epoch-removing
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
 * @param {string} [props.animalKey] - The resolved store owner key; used for Animal Editor links
 *   instead of the possibly-stale `animal.id` record field.
 * @returns {JSX.Element}
 */
export default function TasksEpochsStep({ animal, day, knownTaskDescriptions, onFieldUpdate, animalKey = undefined }) {
  // The store OWNER KEY (resolved by DayEditorStepper). Animal-editor links use it so a
  // stale/missing `animal.id` record field can't misroute a recovered animal; falls back to
  // `animal.id` for isolated renders that don't pass it.
  const ownerKey = animalKey ?? animal?.id;
  // Tolerate corrupt persisted state: a non-array `tasks` (e.g. `{}` from a bad import)
  // must not crash render (`.map`/`.forEach`); it is surfaced + reset via
  // MalformedCollectionNotice below. Guard ALL day-owned arrays this step iterates.
  const tasks = getDayTasks(day);
  const cameras = getAnimalCameras(animal);
  const associatedVideos = getDayAssociatedVideos(day);
  const associatedFiles = getDayAssociatedFiles(day);
  const inheritedBehavioralEvents = getAnimalBehavioralEvents(animal);
  const dayBehavioralEvents = getDayBehavioralEvents(day);

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
    const currentVideos = getDayAssociatedVideos(day);
    const currentFiles = getDayAssociatedFiles(day);
    const repairedVideos = clearOrphans(currentVideos, valid);
    const repairedFiles = clearOrphans(currentFiles, valid);
    if (JSON.stringify(repairedVideos) !== JSON.stringify(currentVideos)) {
      onFieldUpdate('associated_video_files', repairedVideos);
    }
    if (JSON.stringify(repairedFiles) !== JSON.stringify(currentFiles)) {
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
    const currentVideos = getDayAssociatedVideos(day);
    const currentFiles = getDayAssociatedFiles(day);
    const repairedVideos = clearOrphans(currentVideos, valid);
    const repairedFiles = clearOrphans(currentFiles, valid);
    if (JSON.stringify(repairedVideos) !== JSON.stringify(currentVideos)) {
      onFieldUpdate('associated_video_files', repairedVideos);
    }
    if (JSON.stringify(repairedFiles) !== JSON.stringify(currentFiles)) {
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
   * Affected associated_files for the pending delete (so TasksTable can name them
   * in its confirmation, alongside the affected videos). Returns the file orphans
   * that deleting `index` would create.
   * @param {number} index Task index slated for deletion.
   * @returns {Array} The affected associated_files entries.
   */
  function affectedFilesForDelete(index) {
    const nextTasks = tasks.filter((_, i) => i !== index);
    return findOrphanedReferences(day, nextTasks).files;
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

      <MalformedCollectionNotice
        day={day}
        fields={EPOCHS_STEP_COLLECTIONS}
        onReset={(key) => onFieldUpdate(key, [])}
      />

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
            <a href={`#/animal/${ownerKey}/editor`} className="button-secondary">
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
        affectedFilesForDelete={affectedFilesForDelete}
      />

      <AssociatedVideosEditor
        videos={associatedVideos}
        cameras={cameras}
        tasks={tasks}
        onChange={(next) => onFieldUpdate('associated_video_files', next)}
      />

      <AssociatedFilesEditor
        files={associatedFiles}
        tasks={tasks}
        onChange={(next) => onFieldUpdate('associated_files', next)}
      />

      <section className="behavioral-events-block">
        <BehavioralEventsDisplay
          inheritedEvents={inheritedBehavioralEvents}
          dayEvents={dayBehavioralEvents}
          onDayEventsChange={(events) => onFieldUpdate('behavioral_events', events)}
        />
      </section>

      {/* FsGUI optogenetics protocols are day-owned and only meaningful when the animal
          has optogenetics enabled. They reference this day's epochs + the animal's
          cameras as controlled choices. */}
      {animal?.optogenetics != null && (
        <FsGuiSection
          fsGuiYamls={getDayFsGuiYamls(day)}
          cameras={cameras}
          epochOptions={[...validEpochSet(tasks)].sort((a, b) => a - b)}
          // Only the DAY's behavioral events are exported (mergeDayMetadata reads
          // day.behavioral_events), and the dangling_dio_output rule validates against
          // those — so offer ONLY day events here. Inherited animal events are reference
          // only; to use one, add it to this day in the Behavioral Events section above.
          dioOptions={[
            ...new Set(
              dayBehavioralEvents
                .map((e) => e?.name)
                .filter((n) => typeof n === 'string' && n !== '')
            ),
          ]}
          onChange={(next) => onFieldUpdate('fs_gui_yamls', next)}
        />
      )}

      <TaskModal
        isOpen={modalOpen}
        mode={modalMode}
        task={editingTask}
        existingTasks={tasks}
        cameras={cameras}
        inheritedEvents={inheritedBehavioralEvents}
        knownTaskDescriptions={dayKnownDescriptions}
        animalId={ownerKey}
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
  animalKey: PropTypes.string,
};

TasksEpochsStep.defaultProps = {
  knownTaskDescriptions: {},
  mergedDay: null,
};
