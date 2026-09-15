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
 *
 * Editing the environment / cameras does not rewrite them either: those are only the DEFAULT a new
 * day starts from, so when days already follow the old value the edit becomes a scoped choice
 * ({@link TaskContextScopeDialog}) — keep those days as recorded (the default: the old values are
 * pinned onto them) or correct them too.
 */
import { useState, useMemo, useEffect } from 'react';
import { useStoreContext } from '../../../state/StoreContext';
import { getAnimalDayIds, getAnimalTaskTypes } from '../../../state/workspaceSelectors';
import { addTaskType, updateTaskType, deleteTaskType } from '../../../state/taskCatalogActions';
import type { TaskTypeDefinitionInput } from '../../../state/taskCatalogActions';
import { TASK_CONTEXT_FIELDS, deepEqual, pinTaskContextOnDays } from '../../../state/taskCatalog';
import type { TaskContextOverrides } from '../../../state/taskCatalog';
import type { Animal, Day, TaskType } from '../../../state/workspaceTypes';
import { ConfirmDialog } from '../../../components/Modal';
import TaskTypesSection from '../TaskTypesSection';
import TaskTypeModal from '../TaskTypeModal';
import TaskContextScopeDialog from '../TaskContextScopeDialog';

interface TaskTypesContainerProps {
  /** Animal record (its `taskTypes` catalog). */
  animal: Animal;
  /** Field-update callback (writes `taskTypes`). */
  onFieldUpdate: (field: string, value: unknown) => void;
  /** Called `true` while the add/edit modal is open so the tabbed AnimalView can guard a section-nav switch. */
  onPendingEditsChange?: (hasPending: boolean) => void;
}

/** Local add/edit modal state. */
interface TaskTypeModalState {
  open: boolean;
  mode: 'add' | 'edit';
  taskType: TaskType | null;
}

/** A default environment/cameras change awaiting the user's scope choice. */
interface PendingContextChange {
  /** The task type being edited. */
  taskType: TaskType;
  /** The edited definition to save once the scope is chosen. */
  definition: TaskTypeDefinitionInput;
  /** The OLD values of the fields that changed (what an earlier day would be pinned with). */
  oldValues: TaskContextOverrides;
  /** Which fields changed, for the dialog copy. */
  changedLabel: string;
  /** The days that still follow the old default (they are what the choice is about). */
  affectedDays: Day[];
  /** Whether some of the animal's day records could not be loaded. */
  hasUnresolvableDays: boolean;
}

/** Human label for the changed context fields ("environment", "cameras", or both). */
function changedFieldsLabel(fields: readonly string[]): string {
  const names = fields.map((field) => (field === 'task_environment' ? 'environment' : 'cameras'));
  return names.join(' and ');
}

export default function TaskTypesContainer({ animal, onFieldUpdate, onPendingEditsChange }: TaskTypesContainerProps) {
  const { model, actions } = useStoreContext();
  const [modal, setModal] = useState<TaskTypeModalState>({ open: false, mode: 'add', taskType: null });
  const [nameError, setNameError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<TaskType | null>(null);
  const [pendingContext, setPendingContext] = useState<PendingContextChange | null>(null);

  // Report "has pending edits" (an open modal, or an edit waiting on its scope choice) to a host
  // that guards navigation.
  const hasPendingEdits = modal.open || pendingContext != null;
  useEffect(() => {
    onPendingEditsChange?.(hasPendingEdits);
    return () => onPendingEditsChange?.(false);
  }, [hasPendingEdits, onPendingEditsChange]);

  // Tolerant read so a repair routed here can't crash on the corruption it exists to fix.
  const taskTypes = useMemo(() => getAnimalTaskTypes(animal), [animal]);

  // This animal's recording-day records — the blast radius of a default change. `hasUnresolvableDays`
  // flags an index entry we could NOT load: we cannot read its task references, so we must not take
  // the silent "no day follows this default" fast path (mirrors the camera blast radius).
  const { animalDays, hasUnresolvableDays } = useMemo(() => {
    const ids = getAnimalDayIds(animal);
    const resolved = ids.map((id) => model.workspace?.days?.[id]).filter((d): d is Day => Boolean(d));
    return { animalDays: resolved, hasUnresolvableDays: resolved.length < ids.length };
  }, [animal, model.workspace]);

  const openAdd = () => {
    setNameError(null);
    setModal({ open: true, mode: 'add', taskType: null });
  };

  const openEdit = (id: string) => {
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
   */
  const handleSave = (definition: TaskTypeDefinitionInput) => {
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

    if (modal.mode === 'edit' && editingId != null && modal.taskType) {
      const scoped = contextChangeFor(modal.taskType, definition);
      if (scoped) {
        // Days already follow the old default: ask before their exports change. The edit form
        // closes first so the scope dialog is the only modal surface (one focus trap at a time);
        // cancelling reopens it with everything the user typed.
        setPendingContext(scoped);
        setModal({ open: false, mode: 'add', taskType: null });
        return;
      }
    }

    const next =
      modal.mode === 'edit' && editingId != null
        ? updateTaskType(taskTypes, editingId, definition)
        : addTaskType(taskTypes, definition);
    onFieldUpdate('taskTypes', next);
    closeModal();
  };

  /**
   * The scope decision an edit needs, or null when it needs none — because it changes neither the
   * environment nor the cameras, or because no loadable day still follows the old default (a day
   * that recorded its own values is unaffected either way).
   *
   * @param taskType - The task type being edited.
   * @param definition - The edited definition.
   * @returns The pending scope decision, or null to save immediately.
   */
  const contextChangeFor = (
    taskType: TaskType,
    definition: TaskTypeDefinitionInput
  ): PendingContextChange | null => {
    const edited = definition as unknown as Record<string, unknown>;
    const current = taskType as unknown as Record<string, unknown>;
    const changed = TASK_CONTEXT_FIELDS.filter(
      (field) => !deepEqual(edited[field], current[field]) && current[field] !== undefined
    );
    if (changed.length === 0) return null;

    // Only days FOLLOWING the old default are affected; one that recorded its own value is not.
    const affectedDays = animalDays.filter((day) =>
      (Array.isArray(day.taskInstances) ? day.taskInstances : []).some(
        (instance) =>
          instance?.taskTypeId === taskType.id &&
          changed.some((field) => !Object.prototype.hasOwnProperty.call(instance, field))
      )
    );
    if (affectedDays.length === 0 && !hasUnresolvableDays) return null;

    const oldValues: Record<string, unknown> = {};
    for (const field of changed) oldValues[field] = current[field];
    return {
      taskType,
      definition,
      oldValues: oldValues as TaskContextOverrides,
      changedLabel: changedFieldsLabel(changed),
      affectedDays,
      hasUnresolvableDays,
    };
  };

  /**
   * Resolve a pending scope choice: save the new default, first pinning the OLD values onto the
   * affected days when the user keeps them as recorded.
   *
   * @param pinEarlierDays - True to preserve the affected days' current exports.
   */
  const resolveContextChange = (pinEarlierDays: boolean) => {
    if (!pendingContext) return;
    const { taskType, definition, oldValues, affectedDays } = pendingContext;

    if (pinEarlierDays) {
      const pinned = pinTaskContextOnDays<Day>(affectedDays, taskType.id, oldValues);
      pinned.forEach((day, index) => {
        // Unchanged days come back by identity, so only real changes are written.
        if (day !== affectedDays[index] && typeof day.id === 'string') {
          actions.updateDay(day.id, { taskInstances: day.taskInstances });
        }
      });
    }

    onFieldUpdate('taskTypes', updateTaskType(taskTypes, taskType.id, definition));
    setPendingContext(null);
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

      <TaskContextScopeDialog
        isOpen={pendingContext != null}
        taskName={pendingContext?.taskType.task_name || 'this task'}
        changedLabel={pendingContext?.changedLabel ?? 'environment'}
        affectedDays={(pendingContext?.affectedDays ?? []).map((day) => ({
          id: String(day.id),
          date: day.date,
        }))}
        hasUnresolvableDays={pendingContext?.hasUnresolvableDays}
        onKeepEarlierDays={() => resolveContextChange(true)}
        onCorrectEarlierDays={() => resolveContextChange(false)}
        onCancel={() => {
          // Back to the form the user was in, with their edits intact — never a silent discard.
          if (pendingContext) {
            setModal({
              open: true,
              mode: 'edit',
              taskType: { ...pendingContext.taskType, ...pendingContext.definition },
            });
          }
          setPendingContext(null);
        }}
      />

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

