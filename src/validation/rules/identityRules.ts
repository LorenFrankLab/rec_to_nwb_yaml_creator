/**
 * @fileoverview Workspace/dataset identity-divergence rules (extracted from rulesValidation.js).
 *
 * In Spyglass a reused identity NAME (camera_name / data_acq name / task_name) must carry identical
 * dependent metadata, else it raises a divergence error or silently reuses the wrong row. The
 * editing-time guard is the relevant editor; this catches imported/existing invalid state in the
 * exported file. Pure; moved verbatim.
 */

import type { ValidationIssue, ValidationModel } from '../issueTypes';

/**
 * Rule 16: workspace/dataset identity consistency (Spyglass) — cameras, data-acq devices, tasks.
 *
 * @param model - The form data to validate.
 * @returns Validation issues.
 */
export function identityDivergences(model: ValidationModel): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const checkDivergences = (
    items: unknown,
    nameKey: string,
    depKeys: string[],
    code: string,
    label: string,
    noun: string
  ): void => {
    if (!Array.isArray(items)) return; // schema owns wrong-type (e.g. object) cases
    const seen = new Map(); // name -> first item's dependent signature
    const reported = new Set();
    items.forEach((item) => {
      const name = item?.[nameKey];
      if (name === undefined || name === null || name === '') return;
      const sig = JSON.stringify(depKeys.map((k) => item?.[k] ?? null));
      if (!seen.has(name)) {
        seen.set(name, sig);
      } else if (seen.get(name) !== sig && !reported.has(name)) {
        reported.add(name);
        issues.push({
          path: noun,
          field: nameKey,
          step: noun === 'tasks' ? 'epochs' : 'devices',
          repairSurface: noun === 'tasks' ? 'day' : 'animal',
          actionLabel: label,
          code,
          severity: 'error',
          message:
            `${noun === 'tasks' ? 'Task' : noun === 'cameras' ? 'Camera' : 'Data-acquisition device'} ` +
            `"${name}" is reused with different ${depKeys.join('/')}. In Spyglass the name is an ` +
            `identity — reuse the same name only with identical metadata, or use a new name.`,
        });
      }
    });
  };
  checkDivergences(
    model.cameras, 'camera_name',
    ['id', 'meters_per_pixel', 'lens', 'model', 'manufacturer'],
    'divergent_camera_identity', 'Use a new camera name', 'cameras'
  );
  checkDivergences(
    model.data_acq_device, 'name',
    ['system', 'amplifier', 'adc_circuit'],
    'divergent_data_acq_identity', 'Use a new device name', 'data_acq_device'
  );
  checkDivergences(
    model.tasks, 'task_name',
    ['task_description'],
    'divergent_task_identity', 'Use a new task name', 'tasks'
  );

  return issues;
}
