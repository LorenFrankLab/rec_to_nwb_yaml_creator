import { useState, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import { ConfirmDialog } from '../../components/Modal';
import TaskInstancesTable from './TaskInstancesTable';
import TaskInstanceModal from './TaskInstanceModal';
import TaskTypeModal from '../AnimalEditor/TaskTypeModal';
import AssociatedVideosEditor from './AssociatedVideosEditor';
import AssociatedFilesEditor from './AssociatedFilesEditor';
import FsGuiSection from './FsGuiSection';
import MalformedCollectionNotice from './MalformedCollectionNotice';
import { useStepperShortcut } from '../../hooks/stepperShortcuts';
import { RAW_DAY_ARRAY_FIELDS } from '../../validation/rawShape';
import {
  getAnimalCameras,
  getAnimalTaskTypes,
  getDayAssociatedVideos,
  getDayAssociatedFiles,
  getDayBehavioralEvents,
  getDayFsGuiYamls,
} from '../../state/workspaceSelectors';
import { resolveDayCatalogView } from '../../state/dayTaskCatalog';
import { resolveTaskInstances } from '../../state/taskCatalog';
import {
  addTaskInstance,
  removeTaskInstance,
  reorderTaskInstances,
  addTaskType,
  nextTaskTypeId,
} from '../../state/taskCatalogActions';
import { useDayEditorContext } from './DayEditorContext';
import './TasksEpochsStep.scss';

// The day-owned collections this step owns (raw-shape reset surface).
const EPOCHS_STEP_COLLECTIONS = RAW_DAY_ARRAY_FIELDS.filter((f) => f.repairStep === 'epochs');

/**
 * The valid epoch numbers across a day's task instances (the epochs a video/file may reference).
 * @param {Array} instances Task instances.
 * @returns {Set<number>} The valid epoch numbers.
 */
function validEpochSet(instances) {
  const set = new Set();
  (Array.isArray(instances) ? instances : []).forEach((instance) => {
    (Array.isArray(instance?.task_epochs) ? instance.task_epochs : []).forEach((epoch) => {
      const n = Number(epoch);
      if (Number.isInteger(n)) set.add(n);
    });
  });
  return set;
}

/**
 * Associated_video_files / associated_files entries whose `task_epochs` reference is no longer
 * present in `validEpochs`.
 * @param {object} day The day.
 * @param {Set<number>} validEpochs The epochs that WOULD remain after the edit.
 * @returns {{ videos: Array, files: Array }} Affected entries.
 */
function findOrphanedReferences(day, validEpochs) {
  const isOrphan = (entry) =>
    entry.task_epochs !== '' && entry.task_epochs != null && !validEpochs.has(Number(entry.task_epochs));
  return {
    videos: getDayAssociatedVideos(day).filter(isOrphan),
    files: getDayAssociatedFiles(day).filter(isOrphan),
  };
}

/**
 * A copy of an associated array with orphaned `task_epochs` cleared to ''.
 * @param {Array} entries associated_video_files / associated_files.
 * @param {Set<number>} validEpochs Valid epoch numbers.
 * @returns {Array} The repaired array.
 */
function clearOrphans(entries, validEpochs) {
  return (Array.isArray(entries) ? entries : []).map((entry) =>
    entry.task_epochs !== '' && entry.task_epochs != null && !validEpochs.has(Number(entry.task_epochs))
      ? { ...entry, task_epochs: '' }
      : entry
  );
}

/**
 * TasksEpochsStep — per-day tasks via the animal task-type CATALOG (define-once, pick-per-day).
 *
 * The day SELECTS task types the animal defines and assigns each one's epochs — it never retypes a
 * task. Edits write `day.taskInstances` (and, for an inline/new/imported day, commit the derived
 * `taskTypes` to the animal on first edit via {@link resolveDayCatalogView}); a "define a new task
 * type" affordance adds a missing type to the animal catalog inline. Repair-before-orphaning is
 * preserved: an edit that removes an epoch a video/file still references prompts a deterministic
 * cleanup before committing. All animal writes go through `actions.updateAnimal`; all day writes
 * through `onFieldUpdate('taskInstances', …)`.
 *
 * @param {object} props
 * @param {object} props.animal - Parent animal (taskTypes catalog + cameras).
 * @param {object} props.day - The day being edited (taskInstances or legacy inline tasks).
 * @param {Function} props.onFieldUpdate - `(fieldPath, value)` day updater.
 * @param {object} [props.actions] - Store actions (for `updateAnimal`; from context in the stepper).
 * @param {string} [props.animalKey] - The resolved store owner key.
 * @returns {JSX.Element}
 */
export default function TasksEpochsStep(props) {
  const { animal, day, onFieldUpdate, actions = undefined, animalKey = undefined } = useDayEditorContext(props);
  const ownerKey = animalKey ?? animal?.id;

  const cameras = getAnimalCameras(animal);
  const animalTaskTypes = getAnimalTaskTypes(animal);
  const associatedVideos = getDayAssociatedVideos(day);
  const associatedFiles = getDayAssociatedFiles(day);
  const dayBehavioralEvents = getDayBehavioralEvents(day);

  // The day's catalog working view: taskInstances if catalog-shaped, else derived from inline tasks
  // (the conversion is committed on the first edit). `taskTypes` may be richer than the animal's
  // when a derived day mints types for inline task names not yet in the catalog.
  const view = resolveDayCatalogView(animal, day);
  const instances = view.taskInstances;
  // Resolve to inline tasks for the epoch-linked sub-editors (videos / files / FsGUI).
  const resolvedTasks = resolveTaskInstances(view.taskTypes, instances);

  const [instanceModal, setInstanceModal] = useState({ open: false, mode: 'add', editingIndex: null, preselectTypeId: null });
  const [quickAdd, setQuickAdd] = useState({ open: false, reopenAdd: false, nameError: null });
  const [pendingRepair, setPendingRepair] = useState(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const showCameraBanner = cameras.length === 0 && !bannerDismissed;

  /**
   * Apply a committed edit: write the (possibly extended) animal catalog, the day's instances, and —
   * when `repair` — the orphaned associated references.
   * @param {Array} nextInstances The new instance array.
   * @param {Array} nextTaskTypes The catalog to persist (only written when it differs from the animal's).
   * @param {boolean} repair Whether to clear orphaned associated references.
   */
  function applyCommit(nextInstances, nextTaskTypes, repair) {
    if (nextTaskTypes !== animalTaskTypes && actions?.updateAnimal) {
      actions.updateAnimal(ownerKey, { taskTypes: nextTaskTypes });
    }
    onFieldUpdate('taskInstances', nextInstances);
    // Retire the stale inline `day.tasks` the first time an inline/imported day is edited into the
    // catalog (the export already prefers `taskInstances`; this keeps the persisted day from carrying
    // both shapes). A no-op for an already-catalog day (`view.derived` is false).
    if (view.derived && Array.isArray(day?.tasks) && day.tasks.length > 0) {
      onFieldUpdate('tasks', []);
    }
    if (repair) {
      const valid = validEpochSet(nextInstances);
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
  }

  /**
   * Commit a next instance array (with the current working catalog), prompting for orphan repair
   * first when the edit would leave a video/file pointing at a now-missing epoch.
   * @param {Array} nextInstances The new instance array.
   * @param {Array} [nextTaskTypes] The catalog to persist (defaults to the working view's).
   */
  function commit(nextInstances, nextTaskTypes = view.taskTypes) {
    const valid = validEpochSet(nextInstances);
    const { videos, files } = findOrphanedReferences(day, valid);
    if (videos.length === 0 && files.length === 0) {
      applyCommit(nextInstances, nextTaskTypes, false);
      return;
    }
    setPendingRepair({ nextInstances, nextTaskTypes, videos, files });
  }

  /**
   *
   */
  function handleAddTask() {
    setInstanceModal({ open: true, mode: 'add', editingIndex: null, preselectTypeId: null });
  }

  // Alt+N opens the add-task picker while this step is on screen.
  const addTaskRef = useRef(handleAddTask);
  addTaskRef.current = handleAddTask;
  useStepperShortcut(useCallback((action) => { if (action === 'add') addTaskRef.current(); }, []));

  /**
   *
   * @param index
   */
  function handleEditTask(index) {
    setInstanceModal({ open: true, mode: 'edit', editingIndex: index, preselectTypeId: null });
  }

  /**
   *
   * @param root0
   * @param root0.taskTypeId
   * @param root0.task_epochs
   */
  function handleSaveInstance({ taskTypeId, task_epochs }) {
    const next =
      instanceModal.mode === 'edit' && instanceModal.editingIndex != null
        ? instances.map((inst, i) => (i === instanceModal.editingIndex ? { taskTypeId, task_epochs } : inst))
        : addTaskInstance(instances, taskTypeId, task_epochs);
    setInstanceModal({ open: false, mode: 'add', editingIndex: null, preselectTypeId: null });
    commit(next);
  }

  /**
   *
   * @param index
   */
  function handleRemoveTask(index) {
    commit(removeTaskInstance(instances, index));
  }

  /**
   *
   * @param from
   * @param to
   */
  function handleReorder(from, to) {
    commit(reorderTaskInstances(instances, from, to));
  }

  /**
   * Open the inline "define a new task type" flow. Closes the instance picker first (never two
   * stacked dialogs); `reopenAdd` re-opens the add picker afterward with the new type pre-selected.
   * @param {boolean} reopenAdd Whether to reopen the add picker after the type is saved.
   */
  function openQuickAdd(reopenAdd) {
    setInstanceModal((prev) => ({ ...prev, open: false }));
    setQuickAdd({ open: true, reopenAdd, nameError: null });
  }

  /**
   *
   * @param definition
   */
  function handleSaveNewType(definition) {
    const clashes = view.taskTypes.some((t) => t?.task_name === definition.task_name);
    if (clashes) {
      setQuickAdd((prev) => ({
        ...prev,
        nameError: `A task type named "${definition.task_name}" already exists. Pick it instead, or use a different name.`,
      }));
      return;
    }
    // Mint against the ANIMAL catalog (not the possibly-richer derived `view.taskTypes`): the new
    // type is appended to the animal's real catalog, and `addTaskType` reuses this same id. For a
    // derived day, `view.taskTypes`' ids are throwaway-until-committed — the reopened picker's
    // `preselectTypeId` lands correctly because `resolveDayCatalogView` re-derives consistent ids
    // after the animal write re-renders. (Do not persist `view.taskInstances` alongside this write.)
    const newId = nextTaskTypeId(animalTaskTypes);
    if (actions?.updateAnimal) {
      actions.updateAnimal(ownerKey, { taskTypes: addTaskType(animalTaskTypes, definition) });
    }
    const reopenAdd = quickAdd.reopenAdd;
    setQuickAdd({ open: false, reopenAdd: false, nameError: null });
    if (reopenAdd) {
      setInstanceModal({ open: true, mode: 'add', editingIndex: null, preselectTypeId: newId });
    }
  }

  /**
   *
   */
  function confirmRepair() {
    if (!pendingRepair) return;
    applyCommit(pendingRepair.nextInstances, pendingRepair.nextTaskTypes, true);
    setPendingRepair(null);
  }

  const repairNames = pendingRepair
    ? [...pendingRepair.videos, ...pendingRepair.files].map((e) => e.name || '(unnamed)').join(', ')
    : '';
  const repairHasVideos = (pendingRepair?.videos?.length ?? 0) > 0;
  const repairHasFiles = (pendingRepair?.files?.length ?? 0) > 0;
  const repairTitle =
    repairHasVideos && repairHasFiles
      ? 'Repair affected videos and files?'
      : repairHasFiles
        ? 'Repair affected files?'
        : 'Repair affected videos?';

  const editingInstance =
    instanceModal.mode === 'edit' && instanceModal.editingIndex != null ? instances[instanceModal.editingIndex] : null;
  // The add picker can be opened with a freshly-defined type pre-selected (quick-add reopen).
  const modalInstance =
    instanceModal.mode === 'add' && instanceModal.preselectTypeId
      ? { taskTypeId: instanceModal.preselectTypeId, task_epochs: [] }
      : editingInstance;

  return (
    <div className="day-editor-section tasks-epochs-step">
      <h2>Tasks &amp; Epochs</h2>

      <p className="tasks-epochs-intro">
        Pick the <strong>task types</strong> this day ran from the animal&apos;s catalog and assign
        each one&apos;s <strong>epochs</strong> — numbered time blocks, each belonging to one task.
        Define a task once on the animal; here you just choose it and set its epochs.
      </p>

      <MalformedCollectionNotice
        day={day}
        fields={EPOCHS_STEP_COLLECTIONS}
        onReset={(key) => onFieldUpdate(key, [])}
      />

      {showCameraBanner && (
        <div className="camera-info-banner" role="status" aria-live="polite" aria-label="Cameras recommended">
          <div className="camera-info-text">
            This animal has no cameras configured. Cameras are shared animal-catalog entries that this
            day&apos;s task types, videos, and opto/FsGUI protocols select from — set them up once for
            the animal, then choose them here. They are optional, but enable video linking and spatial
            tracking.
          </div>
          <div className="camera-info-actions">
            <a href={`#/animal/${ownerKey}/cameras`} className="button-secondary">
              Set Up Cameras
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

      <TaskInstancesTable
        taskTypes={view.taskTypes}
        taskInstances={instances}
        cameras={cameras}
        onAdd={handleAddTask}
        onDefineNewType={() => openQuickAdd(false)}
        onEdit={handleEditTask}
        onRemove={handleRemoveTask}
        onReorder={handleReorder}
      />

      <div className="tasks-optional-sections">
        {instances.length > 0 && (
          <p className="tasks-coupling-note">
            Associated videos and files reference a task&apos;s epochs. Editing or removing a task they
            use prompts you to confirm before the link is cleared — that repair dialog is expected, not
            an error. (FsGUI protocols also reference epochs; a stale FsGUI epoch is surfaced on the
            Validation screen rather than cleared here.)
          </p>
        )}

        <details className="tasks-optional-section" open={associatedVideos.length > 0}>
          <summary>
            Associated video files{associatedVideos.length > 0 ? ` (${associatedVideos.length})` : ''}
          </summary>
          <AssociatedVideosEditor
            videos={associatedVideos}
            cameras={cameras}
            tasks={resolvedTasks}
            onChange={(next) => onFieldUpdate('associated_video_files', next)}
          />
        </details>

        <details className="tasks-optional-section" open={associatedFiles.length > 0}>
          <summary>
            Associated files{associatedFiles.length > 0 ? ` (${associatedFiles.length})` : ''}
          </summary>
          <AssociatedFilesEditor
            files={associatedFiles}
            tasks={resolvedTasks}
            onChange={(next) => onFieldUpdate('associated_files', next)}
          />
        </details>

        {animal?.optogenetics != null && (
          <details className="tasks-optional-section" open={getDayFsGuiYamls(day).length > 0}>
            <summary>
              Optogenetics protocols (FsGUI)
              {getDayFsGuiYamls(day).length > 0 ? ` (${getDayFsGuiYamls(day).length})` : ''}
            </summary>
            <FsGuiSection
              fsGuiYamls={getDayFsGuiYamls(day)}
              cameras={cameras}
              epochOptions={[...validEpochSet(instances)].sort((a, b) => a - b)}
              dioOptions={[
                ...new Set(
                  dayBehavioralEvents.map((e) => e?.name).filter((n) => typeof n === 'string' && n !== '')
                ),
              ]}
              onChange={(next) => onFieldUpdate('fs_gui_yamls', next)}
            />
          </details>
        )}
      </div>

      {instanceModal.open && (
        <TaskInstanceModal
          isOpen={instanceModal.open}
          mode={instanceModal.mode}
          instance={modalInstance}
          taskTypes={view.taskTypes}
          onSave={handleSaveInstance}
          onCancel={() => setInstanceModal({ open: false, mode: 'add', editingIndex: null, preselectTypeId: null })}
          onDefineNewType={() => openQuickAdd(instanceModal.mode === 'add')}
        />
      )}

      {quickAdd.open && (
        <TaskTypeModal
          isOpen={quickAdd.open}
          mode="add"
          animal={animal}
          nameError={quickAdd.nameError}
          onSave={handleSaveNewType}
          onCancel={() => setQuickAdd({ open: false, reopenAdd: false, nameError: null })}
        />
      )}

      <ConfirmDialog
        isOpen={pendingRepair != null}
        title={repairTitle}
        message={
          pendingRepair
            ? `This change removes a task epoch still referenced by: ${repairNames}. Confirm to save and clear the orphaned epoch reference(s) (their epoch will be unset) so no dangling reference is left. Cancel to discard this change; the referenced file(s) stay unchanged.`
            : ''
        }
        confirmLabel="Clear references"
        cancelLabel="Cancel"
        destructive
        onConfirm={confirmRepair}
        onCancel={() => setPendingRepair(null)}
      />
    </div>
  );
}

// animal/day/onFieldUpdate/actions/animalKey come from DayEditorContext in the Day Editor; these
// propTypes describe the isolated-render fallback, so they are not `.isRequired`.
TasksEpochsStep.propTypes = {
  animal: PropTypes.shape({
    id: PropTypes.string,
    cameras: PropTypes.array,
    taskTypes: PropTypes.array,
  }),
  day: PropTypes.shape({
    taskInstances: PropTypes.array,
    tasks: PropTypes.array,
    associated_video_files: PropTypes.array,
    associated_files: PropTypes.array,
  }),
  onFieldUpdate: PropTypes.func,
  actions: PropTypes.object,
  animalKey: PropTypes.string,
};

TasksEpochsStep.defaultProps = {
  actions: undefined,
};
