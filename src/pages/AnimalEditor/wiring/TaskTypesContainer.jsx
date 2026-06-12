/**
 * TaskTypesContainer — the animal task-type catalog section + its add/edit/delete wiring.
 *
 * Owns task-type create/edit/delete: opens {@link TaskTypeModal}, enforces the Spyglass `task_name`
 * identity (one task type per name — a clashing name is blocked in-modal, the structural guarantee
 * behind the `duplicate_task_type_name` rule), and persists via the `onFieldUpdate('taskTypes', …)`
 * contract. Mirrors {@link module:pages/AnimalEditor/wiring/CamerasContainer}; the catalog mutation
 * math lives in the pure, tested helpers in `state/taskCatalogActions`.
 *
 * Deleting a task type does NOT rewrite the days that reference it (mirrors deleting a referenced
 * camera): the confirm dialog warns that those days will need a re-pick, and the day-level
 * `dangling_task_type_ref` rule surfaces the gap — never a silent rewrite.
 */
import { useState, useMemo, useEffect } from 'react';
import PropTypes from 'prop-types';
import { getAnimalTaskTypes } from '../../../state/workspaceSelectors';
import { addTaskType, updateTaskType, deleteTaskType } from '../../../state/taskCatalogActions';
import { ConfirmDialog } from '../../../components/Modal';
import { rawArray } from '../../../components/rawPropTypes';
import TaskTypesSection from '../TaskTypesSection';
import TaskTypeModal from '../TaskTypeModal';

/**
 * @param {object} props
 * @param {object} props.animal - Animal record (its `taskTypes` catalog).
 * @param {Function} props.onFieldUpdate - Field-update callback (writes `taskTypes`).
 * @param {Function} [props.onPendingEditsChange] - Called `true` while the add/edit modal is open so
 *   the tabbed AnimalView can guard a section-nav switch; `false` otherwise / on unmount.
 * @returns {JSX.Element}
 */
export default function TaskTypesContainer({ animal, onFieldUpdate, onPendingEditsChange }) {
  const [modal, setModal] = useState({ open: false, mode: 'add', taskType: null });
  const [nameError, setNameError] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  // Report "has pending edits" (the modal being open) to a host that guards navigation.
  useEffect(() => {
    onPendingEditsChange?.(modal.open);
    return () => onPendingEditsChange?.(false);
  }, [modal.open, onPendingEditsChange]);

  // Tolerant read so a repair routed here can't crash on the corruption it exists to fix.
  const taskTypes = useMemo(() => getAnimalTaskTypes(animal), [animal]);

  const openAdd = () => {
    setNameError(null);
    setModal({ open: true, mode: 'add', taskType: null });
  };

  const openEdit = (id) => {
    const taskType = taskTypes.find((t) => t?.id === id);
    if (!taskType) return;
    setNameError(null);
    setModal({ open: true, mode: 'edit', taskType });
  };

  const closeModal = () => {
    setNameError(null);
    setModal({ open: false, mode: 'add', taskType: null });
  };

  /**
   * Persist a task-type definition unless its name collides with ANOTHER task type (one type per
   * name — the Spyglass identity). On a clash, surface the message and keep the modal open.
   *
   * @param {object} definition - Cleaned `{ task_name, task_description, task_environment, camera_id }`.
   */
  const handleSave = (definition) => {
    const editingId = modal.mode === 'edit' ? modal.taskType?.id : null;
    const clashes = taskTypes.some(
      (t) => t?.id !== editingId && t?.task_name === definition.task_name
    );
    if (clashes) {
      setNameError(
        `A task type named "${definition.task_name}" already exists. ` +
          'Each task type must have a unique name — edit the existing one or choose a different name.'
      );
      return;
    }

    const next =
      modal.mode === 'edit' && editingId != null
        ? updateTaskType(taskTypes, editingId, definition)
        : addTaskType(taskTypes, definition);
    onFieldUpdate('taskTypes', next);
    closeModal();
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    onFieldUpdate('taskTypes', deleteTaskType(taskTypes, pendingDelete.id));
    setPendingDelete(null);
  };

  return (
    <>
      <TaskTypesSection
        animal={animal}
        onFieldUpdate={onFieldUpdate}
        onAdd={openAdd}
        onEdit={openEdit}
        onDelete={(taskType) => setPendingDelete(taskType)}
      />

      {modal.open && (
        <TaskTypeModal
          isOpen={modal.open}
          mode={modal.mode}
          taskType={modal.taskType}
          animal={animal}
          nameError={nameError}
          onSave={handleSave}
          onCancel={closeModal}
        />
      )}

      <ConfirmDialog
        isOpen={pendingDelete != null}
        title="Delete task type?"
        message={
          pendingDelete
            ? `Delete task type "${pendingDelete.task_name || 'unnamed'}"? Any recording days that ran `
              + 'this task will need to re-pick a task type (their epochs are kept until then). This '
              + 'cannot be undone.'
            : ''
        }
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}

TaskTypesContainer.propTypes = {
  animal: PropTypes.shape({
    id: PropTypes.string.isRequired,
    taskTypes: rawArray(PropTypes.object),
  }).isRequired,
  onFieldUpdate: PropTypes.func.isRequired,
  onPendingEditsChange: PropTypes.func,
};

TaskTypesContainer.defaultProps = {
  onPendingEditsChange: undefined,
};
