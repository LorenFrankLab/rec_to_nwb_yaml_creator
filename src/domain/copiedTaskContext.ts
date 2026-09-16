import type { TaskInstance, TaskType } from '../state/workspaceTypes';

/** Source occurrences whose recorded context would change when reset to catalog defaults. */
export function changedTaskContext(instances: TaskInstance[], types: TaskType[]): TaskInstance[] {
  return instances.filter((instance) => {
    const type = types.find((candidate) => candidate.id === instance.taskTypeId);
    return type && (
      (instance.task_environment !== undefined && instance.task_environment !== type.task_environment)
      || (instance.camera_id !== undefined && JSON.stringify(instance.camera_id) !== JSON.stringify(type.camera_id ?? []))
    );
  }).map((instance) => structuredClone(instance));
}

/** Restore only context for still-matching occurrences; never replace a newly edited sequence. */
export function restoreCopiedTaskContext(current: TaskInstance[], source: TaskInstance[]): TaskInstance[] {
  return current.flatMap((instance) => {
    const groups: TaskInstance[] = [];
    for (const epoch of instance.task_epochs) {
      const previous = source.find((candidate) => candidate.taskTypeId === instance.taskTypeId && candidate.task_epochs.includes(epoch));
      const next = {
        ...instance,
        task_epochs: [epoch],
        ...(previous?.task_environment !== undefined ? { task_environment: previous.task_environment } : {}),
        ...(previous?.camera_id !== undefined ? { camera_id: [...previous.camera_id] } : {}),
      };
      const sameContext = groups.find((group) => group.task_environment === next.task_environment && JSON.stringify(group.camera_id) === JSON.stringify(next.camera_id));
      if (sameContext) sameContext.task_epochs.push(epoch);
      else groups.push(next);
    }
    return groups;
  });
}
