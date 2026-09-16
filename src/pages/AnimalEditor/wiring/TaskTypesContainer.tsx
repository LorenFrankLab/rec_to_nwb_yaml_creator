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
import { TASK_CONTEXT_FIELDS, deepEqual, hasOwn, pinTaskContextOnDays } from '../../../state/taskCatalog';
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
  /**
   * The task type being edited, as PERSISTED in the catalog. This is the immutable baseline for
   * change detection and for pinning — never the user's unsaved edits.
   */
  taskType: TaskType | null;
  /**
   * The user's unsaved edits, when the form is reopened after cancelling the scope dialog. Only the
   * modal's initial values come from here; it never becomes the comparison baseline.
   */
  draft: TaskType | null;
}

/** A default environment/cameras change awaiting the user's scope choice. */
interface PendingContextChange {
  /** The task type being edited. */
  taskType: TaskType;
  /** The edited definition to save once the scope is chosen (blank no-value keys dropped). */
  definition: TaskTypeDefinitionInput;
  /** The OLD values of the fields that can be pinned (what an earlier day would record). */
  oldValues: TaskContextOverrides;
  /** Which fields changed, for the dialog title. */
  changedLabel: string;
  /**
   * The changed fields whose old value CAN be recorded on an earlier day — the ones "keep earlier
   * days as recorded" actually preserves. Empty when none, which withholds that route entirely.
   */
  keepableLabel: string;
  /**
   * The changed fields whose old value CANNOT be recorded, because the type had no value there and
   * absence is not expressible as an override (absent ⇒ follow the default). Those days WILL change
   * for these fields whichever route is taken, and the dialog says so. Empty when none.
   */
  unkeepableLabel: string;
  /** The days that still follow the old default (they are what the choice is about). */
  affectedDays: Day[];
  /** Whether some of the animal's day records could not be loaded. */
  hasUnresolvableDays: boolean;
}

/** Human label for a set of context fields ("environment", "cameras", or both). */
function changedFieldsLabel(fields: readonly string[]): string {
  const names = fields.map((field) => (field === 'task_environment' ? 'environment' : 'cameras'));
  return names.join(' and ');
}

/**
 * Whether a context value says "no value at all". The catalog stores absence (a template mints
 * `{ task_name, task_description }` only; a derived type carries just the keys its inline task had),
 * while {@link TaskTypeModal} always emits a trimmed string and an array — so `undefined`, `''` and
 * `[]` are three spellings of the same thing and must compare EQUAL, or a description-only edit
 * would read as a context change and write blank keys into every referencing day's export.
 *
 * @param value - A `task_environment` / `camera_id` value.
 * @returns True when the value carries no information.
 */
function isNoContextValue(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/** Whether a context value differs in MEANING (the three "no value" spellings are one value). */
function contextValueChanged(edited: unknown, current: unknown): boolean {
  if (isNoContextValue(edited) && isNoContextValue(current)) return false;
  return !deepEqual(edited, current);
}

/**
 * Whether an earlier day could RECORD this old value as its own. An absent value cannot (absence
 * means "follow the default"), and neither can a blank environment — pinning `''` would write a
 * value the schema rejects onto days that are mid-repair. An empty `camera_id` IS recordable: "this
 * day used no cameras" is a real, exportable fact.
 *
 * @param value - The task type's OLD value for a context field.
 * @returns True when the value can be pinned onto an earlier day.
 */
function isRecordableContextValue(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  return true;
}

export default function TaskTypesContainer({ animal, onFieldUpdate, onPendingEditsChange }: TaskTypesContainerProps) {
  const { model, actions } = useStoreContext();
  const [modal, setModal] = useState<TaskTypeModalState>({
    open: false,
    mode: 'add',
    taskType: null,
    draft: null,
  });
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
    setModal({ open: true, mode: 'add', taskType: null, draft: null });
  };

  const openEdit = (id: string) => {
    const taskType = taskTypes.find((t) => t?.id === id);
    if (!taskType) return;
    setNameError(null);
    setModal({ open: true, mode: 'edit', taskType, draft: null });
  };

  const closeModal = () => {
    setNameError(null);
    setModal({ open: false, mode: 'add', taskType: null, draft: null });
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

    // The baseline is ALWAYS the task type as PERSISTED — the catalog entry, re-read at save time —
    // never the modal's draft. Cancelling the scope dialog reopens the form with the unsaved edits,
    // and if those became the baseline the next save would compare the draft against itself, find no
    // change, and silently rewrite every earlier day's exported context with no scope choice.
    const persisted = modal.mode === 'edit' && editingId != null
      ? taskTypes.find((t) => t?.id === editingId) ?? modal.taskType
      : null;

    if (modal.mode === 'edit' && editingId != null && persisted) {
      const cleaned = withoutAddedBlankContext(persisted, definition);
      const scoped = contextChangeFor(persisted, cleaned);
      if (scoped) {
        // Days already follow the old default: ask before their exports change. The edit form
        // closes first so the scope dialog is the only modal surface (one focus trap at a time);
        // cancelling reopens it with everything the user typed.
        setPendingContext(scoped);
        setModal({ open: false, mode: 'add', taskType: null, draft: null });
        return;
      }
      onFieldUpdate('taskTypes', updateTaskType(taskTypes, editingId, cleaned));
      closeModal();
      return;
    }

    onFieldUpdate('taskTypes', addTaskType(taskTypes, definition));
    closeModal();
  };

  /**
   * The edited definition with any context field DROPPED that the task type never had and the user
   * left blank. The modal always emits `task_environment: <string>` + `camera_id: <array>`, so
   * without this a description-only edit of a template-minted type would add `camera_id: []` (and,
   * were the modal ever to allow it, a schema-invalid `task_environment: ''`) to the type — silently
   * changing the exported bytes of every day that references it.
   *
   * A field the type ALREADY had is left exactly as the user left it: emptying a populated
   * `camera_id` to `[]` is a real edit, not a no-op.
   *
   * @param taskType - The task type being edited.
   * @param definition - The modal's definition.
   * @returns The definition to compare and save.
   */
  const withoutAddedBlankContext = (
    taskType: TaskType,
    definition: TaskTypeDefinitionInput
  ): TaskTypeDefinitionInput => {
    const current = taskType as unknown as Record<string, unknown>;
    const next = { ...definition } as Record<string, unknown>;
    for (const field of TASK_CONTEXT_FIELDS) {
      if (isNoContextValue(next[field]) && !hasOwn(current, field)) delete next[field];
    }
    return next as unknown as TaskTypeDefinitionInput;
  };

  /**
   * The scope decision an edit needs, or null when it needs none — because it changes neither the
   * environment nor the cameras, or because no loadable day still follows the old default (a day
   * that recorded its own values is unaffected either way).
   *
   * A changed field whose OLD value cannot be recorded (the type had none) still needs the
   * decision: those days cannot keep "no value", so their exports change — a correction to history,
   * which must be explicit and confirmed rather than silent. The keep/cannot-keep split is computed
   * PER FIELD, so a mixed edit still preserves the field that has an old value to preserve.
   *
   * @param taskType - The task type being edited.
   * @param definition - The edited definition (already stripped of added blank context).
   * @returns The pending scope decision, or null to save immediately.
   */
  const contextChangeFor = (
    taskType: TaskType,
    definition: TaskTypeDefinitionInput
  ): PendingContextChange | null => {
    const edited = definition as unknown as Record<string, unknown>;
    const current = taskType as unknown as Record<string, unknown>;
    const changed = TASK_CONTEXT_FIELDS.filter((field) =>
      contextValueChanged(edited[field], current[field])
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

    // Split the changed fields by whether their OLD value can be written onto an earlier day.
    const keepable = changed.filter((field) => isRecordableContextValue(current[field]));
    const unkeepable = changed.filter((field) => !isRecordableContextValue(current[field]));
    const oldValues: Record<string, unknown> = {};
    for (const field of keepable) oldValues[field] = current[field];
    return {
      taskType,
      definition,
      oldValues: oldValues as TaskContextOverrides,
      changedLabel: changedFieldsLabel(changed),
      keepableLabel: changedFieldsLabel(keepable),
      unkeepableLabel: changedFieldsLabel(unkeepable),
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
          taskType={modal.draft ?? modal.taskType}
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
        keepableLabel={pendingContext?.keepableLabel ?? ''}
        unkeepableLabel={pendingContext?.unkeepableLabel ?? ''}
        onKeepEarlierDays={() => resolveContextChange(true)}
        onCorrectEarlierDays={() => resolveContextChange(false)}
        onCancel={() => {
          // Back to the form the user was in, with their edits intact — never a silent discard. The
          // edits ride back as the DRAFT; the persisted task type stays the baseline, so saving
          // again asks the same question again.
          if (pendingContext) {
            setModal({
              open: true,
              mode: 'edit',
              taskType: pendingContext.taskType,
              draft: { ...pendingContext.taskType, ...pendingContext.definition },
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

