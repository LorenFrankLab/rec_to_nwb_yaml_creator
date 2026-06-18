/**
 * @fileoverview Workspace/dataset identity-divergence rules (extracted from rulesValidation.js).
 *
 * In Spyglass a reused identity NAME (camera_name / data_acq name / task_name) must carry identical
 * dependent metadata, else it raises a divergence error or silently reuses the wrong row. The
 * editing-time guard is the relevant editor; this catches imported/existing invalid state in the
 * exported file. Pure; moved verbatim.
 */

import type { ValidationIssue, ValidationModel } from '../issueTypes';

const CAMERA_MPP_PLAUSIBLE_MIN = 0.0005;
const CAMERA_MPP_PLAUSIBLE_MAX = 0.2;
const PLACEHOLDER_CAMERA_NAMES = new Set(['camera', 'xxx']);

function finiteNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function isBlank(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

function cameraNameText(value: unknown): string {
  return String(value ?? '').trim();
}

function isPlaceholderCameraName(value: unknown): boolean {
  const name = cameraNameText(value);
  if (name === '') return true;
  return /^\d+$/.test(name) || PLACEHOLDER_CAMERA_NAMES.has(name.toLowerCase());
}

function cameraLabel(camera: Record<string, unknown>, index: number): string {
  const name = cameraNameText(camera.camera_name);
  return name === '' ? `Camera ${index + 1}` : `Camera "${name}"`;
}

function cameraNameDisplay(value: unknown): string {
  const name = cameraNameText(value);
  return name === '' ? 'a blank camera_name' : `placeholder camera_name "${name}"`;
}

function cameraCalibrationAndNameIssues(model: ValidationModel): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!Array.isArray(model.cameras)) return issues;

  model.cameras.forEach((camera, index) => {
    if (!camera || typeof camera !== 'object') return;
    const row = camera as Record<string, unknown>;
    const label = cameraLabel(row, index);

    if (isPlaceholderCameraName(row.camera_name)) {
      issues.push({
        path: `cameras[${index}].camera_name`,
        field: 'camera_name',
        step: 'devices',
        repairSurface: 'animal',
        actionLabel: 'Name this camera',
        code: 'placeholder_camera_name',
        severity: 'error',
        message:
          `${label} uses ${cameraNameDisplay(row.camera_name)}. Spyglass keys cameras by ` +
          'camera_name; use a stable physical camera/location name such as HomeBox_camera.',
      });
    }

    const rawMetersPerPixel = row.meters_per_pixel;
    const path = `cameras[${index}].meters_per_pixel`;
    if (isBlank(rawMetersPerPixel)) {
      issues.push({
        path,
        field: 'meters_per_pixel',
        step: 'devices',
        repairSurface: 'animal',
        actionLabel: 'Enter meters per pixel',
        code: 'camera_meters_per_pixel_missing',
        severity: 'error',
        message:
          `${label} is missing meters_per_pixel. Enter the positive meter-per-pixel ` +
          'tracking calibration for this physical camera.',
      });
      return;
    }

    const metersPerPixel = finiteNumber(rawMetersPerPixel);
    if (metersPerPixel === null) return;
    if (metersPerPixel <= 0) {
      issues.push({
        path,
        field: 'meters_per_pixel',
        step: 'devices',
        repairSurface: 'animal',
        actionLabel: 'Enter a positive calibration',
        code: 'camera_meters_per_pixel_nonpositive',
        severity: 'error',
        message:
          `${label} has meters_per_pixel ${String(rawMetersPerPixel)}. ` +
          'Camera calibration must be greater than 0 meters per pixel.',
      });
      return;
    }

    if (metersPerPixel < CAMERA_MPP_PLAUSIBLE_MIN || metersPerPixel > CAMERA_MPP_PLAUSIBLE_MAX) {
      issues.push({
        path,
        field: 'meters_per_pixel',
        step: 'devices',
        repairSurface: 'animal',
        actionLabel: 'Review camera calibration',
        code: 'camera_meters_per_pixel_implausible',
        severity: 'warning',
        message:
          `${label} has meters_per_pixel ${String(rawMetersPerPixel)}, outside the expected ` +
          `${CAMERA_MPP_PLAUSIBLE_MIN}-${CAMERA_MPP_PLAUSIBLE_MAX} m/px range. Confirm the ` +
          'tracking calibration before export.',
      });
    }
  });

  return issues;
}

/**
 * Rule 16: workspace/dataset identity consistency (Spyglass) — cameras, data-acq devices, tasks.
 *
 * @param model - The form data to validate.
 * @returns Validation issues.
 */
export function identityDivergences(model: ValidationModel): ValidationIssue[] {
  const issues: ValidationIssue[] = cameraCalibrationAndNameIssues(model);

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
