import { describe, it, expect } from 'vitest';
import { repairTargetForIssue, animalEditorStepForFieldPath } from '../validation';

/**
 * HIGH/UX finding: an animal-surface repair must (a) keep a step-aware label naming the
 * Animal Editor step that fixes it, and (b) resolve the right step from the field path so
 * the route can deep-link there instead of always landing on step 0.
 */
describe('animalEditorStepForFieldPath', () => {
  it('maps electrode-group geometry paths to the Electrode Groups step (0)', () => {
    expect(animalEditorStepForFieldPath('electrode_groups[0].location')).toMatchObject({ index: 0, label: 'Electrode Groups' });
    expect(animalEditorStepForFieldPath('electrode_groups[2].device_type')).toMatchObject({ index: 0 });
    expect(animalEditorStepForFieldPath('electrode_groups[1].targeted_x')).toMatchObject({ index: 0 });
    // bare property paths (AJV "required" artifacts) still route by keyword
    expect(animalEditorStepForFieldPath('device_type')).toMatchObject({ index: 0 });
    expect(animalEditorStepForFieldPath('location')).toMatchObject({ index: 0 });
    expect(animalEditorStepForFieldPath('targeted_location')).toMatchObject({ index: 0 });
  });

  it('maps channel-map paths to the Channel Maps step (1)', () => {
    expect(animalEditorStepForFieldPath('ntrode_electrode_group_channel_map[3]')).toMatchObject({ index: 1, label: 'Channel Maps' });
    expect(animalEditorStepForFieldPath('ntrode_electrode_group_channel_map[0].map')).toMatchObject({ index: 1 });
  });

  it('maps camera / data-acq paths to the Hardware Config step (2)', () => {
    expect(animalEditorStepForFieldPath('cameras[0].lens')).toMatchObject({ index: 2, label: 'Hardware Config' });
    expect(animalEditorStepForFieldPath('data_acq_device[0].name')).toMatchObject({ index: 2 });
  });

  it('defaults to the Electrode Groups step for an unknown/empty path', () => {
    expect(animalEditorStepForFieldPath('')).toMatchObject({ index: 0 });
    expect(animalEditorStepForFieldPath(undefined)).toMatchObject({ index: 0 });
  });

  it('normalizes AJV instancePath-style slashes', () => {
    expect(animalEditorStepForFieldPath('/cameras/0/lens')).toMatchObject({ index: 2 });
    expect(animalEditorStepForFieldPath('/ntrode_electrode_group_channel_map/0')).toMatchObject({ index: 1 });
  });
});

describe('repairTargetForIssue — step-aware Animal Editor labels', () => {
  it('labels a channel-map issue "Fix in Animal Editor → Channel Maps"', () => {
    const target = repairTargetForIssue({
      code: 'channel_value_out_of_range',
      path: 'ntrode_electrode_group_channel_map[3]',
      repairSurface: 'animal',
    });
    expect(target.surface).toBe('animal');
    expect(target.label).toBe('Fix in Animal Editor → Channel Maps');
  });

  it('labels an electrode-group issue "Fix in Animal Editor → Electrode Groups"', () => {
    const target = repairTargetForIssue({
      code: 'empty_location',
      path: 'electrode_groups[0].location',
      repairSurface: 'animal',
    });
    expect(target.label).toBe('Fix in Animal Editor → Electrode Groups');
  });

  it('labels a camera issue "Fix in Animal Editor → Hardware Config"', () => {
    const target = repairTargetForIssue({
      code: 'duplicate_camera_id',
      path: 'cameras[1].id',
      repairSurface: 'animal',
    });
    expect(target.label).toBe('Fix in Animal Editor → Hardware Config');
  });

  it('does NOT add a step suffix for day-surface or none-surface issues', () => {
    expect(repairTargetForIssue({ code: 'missing_camera', path: 'tasks[0]' }).label).toMatch(/^Fix in /);
    expect(repairTargetForIssue({ code: 'missing_camera', path: 'tasks[0]' }).label).not.toContain('→');
    expect(repairTargetForIssue({ code: 'subject_id_slash' }).surface).toBe('none');
  });
});
