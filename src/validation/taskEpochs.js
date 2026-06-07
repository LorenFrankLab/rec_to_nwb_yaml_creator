/**
 * @fileoverview Shared task-epoch collision detection (Phase 8.7 Task 5c review fix).
 *
 * Each epoch belongs to exactly ONE task (Spyglass keys `TaskEpoch` by session+epoch). The
 * export-blocking `duplicate_task_epoch` rule and the inline task-table badge must agree on what
 * "the same epoch" means, so both use this one helper. Epochs are normalized to `Number`, because
 * a corrupt mixed-type import (epoch `1` in one task, `"1"` in another) is the SAME epoch
 * downstream — keying by the raw value would let the export gate miss that real collision.
 */

/**
 * The set of epoch numbers claimed by more than one task. Shape-tolerant (non-array tasks /
 * task_epochs, null/undefined epochs skipped); non-numeric epochs (invalid per schema, blocked
 * elsewhere) are ignored here.
 *
 * @param {Array<object>} tasks - The day's tasks.
 * @returns {Set<number>} Epoch numbers used by ≥2 tasks.
 */
export function duplicateTaskEpochs(tasks) {
  const counts = new Map();
  (Array.isArray(tasks) ? tasks : []).forEach((task) => {
    const epochs = Array.isArray(task?.task_epochs) ? task.task_epochs : [];
    epochs.forEach((epoch) => {
      if (epoch === undefined || epoch === null) return;
      const key = Number(epoch);
      if (Number.isNaN(key)) return;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
  });
  return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key));
}
