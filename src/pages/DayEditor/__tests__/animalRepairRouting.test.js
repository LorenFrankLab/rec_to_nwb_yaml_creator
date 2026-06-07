import { describe, it, expect } from 'vitest';
import { repairTargetForIssue, animalEditorStepForFieldPath } from '../../../domain/validation';

/**
 * HIGH/UX finding: an animal-surface repair must (a) keep a step-aware label naming the
 * Animal Editor step that fixes it, and (b) resolve the right step from the field path so
 * the route can deep-link there instead of always landing on step 0.
 */
describe('animalEditorStepForFieldPath', () => {
  it('maps electrode-group geometry paths to the Electrode Groups step (0)', () => {
    expect(animalEditorStepForFieldPath('electrode_groups[0].location')).toMatchObject({ index: 0, label: 'Electrodes & Ephys' });
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

  it('maps camera / data-acq / configuration-history paths to the Recording System step (3)', () => {
    // Phase 8.7 Task 2: step 3's user-facing label is "Recording System, Cameras & DIO".
    expect(animalEditorStepForFieldPath('cameras[0].lens')).toMatchObject({ index: 3, label: 'Recording System, Cameras & DIO' });
    expect(animalEditorStepForFieldPath('data_acq_device[0].name')).toMatchObject({ index: 3 });
    // The configurationHistory rebuild control lives in this step's banner, so its repair must
    // deep-link there (not default to Electrode Groups).
    expect(animalEditorStepForFieldPath('configurationHistory')).toMatchObject({ index: 3, label: 'Recording System, Cameras & DIO' });
  });

  it('maps animal-level optogenetics paths to the Optogenetics step (2)', () => {
    expect(animalEditorStepForFieldPath('opto_excitation_source[0].name')).toMatchObject({ index: 2, label: 'Optogenetics Setup' });
    expect(animalEditorStepForFieldPath('virus_injection[0].volume_in_ul')).toMatchObject({ index: 2 });
    expect(animalEditorStepForFieldPath('optical_fiber[0].location')).toMatchObject({ index: 2 });
  });

  it('defaults to the Electrode Groups step for an unknown/empty path', () => {
    expect(animalEditorStepForFieldPath('')).toMatchObject({ index: 0 });
    expect(animalEditorStepForFieldPath(undefined)).toMatchObject({ index: 0 });
  });

  it('normalizes AJV instancePath-style slashes', () => {
    expect(animalEditorStepForFieldPath('/cameras/0/lens')).toMatchObject({ index: 3 });
    expect(animalEditorStepForFieldPath('/ntrode_electrode_group_channel_map/0')).toMatchObject({ index: 1 });
  });
});

describe('repairTargetForIssue — step-aware Animal Editor labels', () => {
  it('labels a channel-map issue "Fix in Animal Setup → Channel Maps"', () => {
    const target = repairTargetForIssue({
      code: 'channel_value_out_of_range',
      path: 'ntrode_electrode_group_channel_map[3]',
      repairSurface: 'animal',
    });
    expect(target.surface).toBe('animal');
    expect(target.label).toBe('Fix in Animal Setup → Channel Maps');
  });

  it('labels an electrode-group issue "Fix in Animal Setup → Electrodes & Ephys"', () => {
    const target = repairTargetForIssue({
      code: 'empty_location',
      path: 'electrode_groups[0].location',
      repairSurface: 'animal',
    });
    expect(target.label).toBe('Fix in Animal Setup → Electrodes & Ephys');
  });

  it('labels a camera issue "Fix in Animal Setup → Recording System, Cameras & DIO"', () => {
    const target = repairTargetForIssue({
      code: 'duplicate_camera_id',
      path: 'cameras[1].id',
      repairSurface: 'animal',
    });
    expect(target.label).toBe('Fix in Animal Setup → Recording System, Cameras & DIO');
  });

  it('does NOT add a step suffix for day-surface or none-surface issues', () => {
    expect(repairTargetForIssue({ code: 'missing_camera', path: 'tasks[0]' }).label).toMatch(/^Fix in /);
    expect(repairTargetForIssue({ code: 'missing_camera', path: 'tasks[0]' }).label).not.toContain('→');
    expect(repairTargetForIssue({ code: 'subject_id_slash' }).surface).toBe('none');
  });
});
