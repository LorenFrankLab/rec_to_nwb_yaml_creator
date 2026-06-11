import { describe, it, expect } from 'vitest';
import { repairTargetForIssue, animalSetupTabForFieldPath } from '../../../domain/validation';

/**
 * HIGH/UX finding: an animal-surface repair must (a) keep a TAB-aware label naming the
 * animal-setup tab that fixes it, and (b) resolve the right tab from the field path so the
 * route can deep-link there instead of always landing on the default electrode-groups tab.
 */
describe('animalSetupTabForFieldPath — field → animal-setup TAB (tabbed IA)', () => {
  it('maps channel-map (ntrode) paths to the electrode-groups tab (maps auto-generated from groups)', () => {
    expect(animalSetupTabForFieldPath('ntrode_electrode_group_channel_map[3]')).toEqual({ tab: 'electrode-groups', label: 'Electrode Groups' });
    expect(animalSetupTabForFieldPath('/ntrode_electrode_group_channel_map/0/map')).toMatchObject({ tab: 'electrode-groups' });
  });

  it('maps camera paths to the cameras tab (split out of the old combined step)', () => {
    expect(animalSetupTabForFieldPath('cameras[1].id')).toEqual({ tab: 'cameras', label: 'Cameras' });
    expect(animalSetupTabForFieldPath('cameras[0].lens')).toMatchObject({ tab: 'cameras' });
    expect(animalSetupTabForFieldPath('meters_per_pixel')).toMatchObject({ tab: 'cameras' });
  });

  it('maps data-acq paths to the recording-system tab (split out of the old combined step)', () => {
    expect(animalSetupTabForFieldPath('data_acq_device[0].name')).toEqual({ tab: 'recording-system', label: 'Recording System' });
  });

  it('maps optogenetics paths to the optogenetics tab', () => {
    expect(animalSetupTabForFieldPath('opto_excitation_source[0].name')).toEqual({ tab: 'optogenetics', label: 'Optogenetics' });
    expect(animalSetupTabForFieldPath('virus_injection[0].volume_in_ul')).toMatchObject({ tab: 'optogenetics' });
    expect(animalSetupTabForFieldPath('optical_fiber[0].location')).toMatchObject({ tab: 'optogenetics' });
  });

  it('maps electrode geometry, configurationHistory, and unknown paths to the electrode-groups tab', () => {
    expect(animalSetupTabForFieldPath('electrode_groups[0].location')).toEqual({ tab: 'electrode-groups', label: 'Electrode Groups' });
    expect(animalSetupTabForFieldPath('device_type')).toMatchObject({ tab: 'electrode-groups' });
    expect(animalSetupTabForFieldPath('targeted_location')).toMatchObject({ tab: 'electrode-groups' });
    expect(animalSetupTabForFieldPath('configurationHistory')).toMatchObject({ tab: 'electrode-groups' });
    expect(animalSetupTabForFieldPath('')).toMatchObject({ tab: 'electrode-groups' });
    expect(animalSetupTabForFieldPath(undefined)).toMatchObject({ tab: 'electrode-groups' });
  });
});

describe('repairTargetForIssue — tab-aware Animal Setup labels (tabbed IA)', () => {
  it('labels a channel-map (ntrode) issue "Fix in Animal Setup → Electrode Groups"', () => {
    const target = repairTargetForIssue({
      code: 'channel_value_out_of_range',
      path: 'ntrode_electrode_group_channel_map[3]',
      repairSurface: 'animal',
    });
    expect(target.surface).toBe('animal');
    expect(target.label).toBe('Fix in Animal Setup → Electrode Groups');
  });

  it('labels an electrode-group issue "Fix in Animal Setup → Electrode Groups"', () => {
    const target = repairTargetForIssue({
      code: 'empty_location',
      path: 'electrode_groups[0].location',
      repairSurface: 'animal',
    });
    expect(target.label).toBe('Fix in Animal Setup → Electrode Groups');
  });

  it('labels a camera issue "Fix in Animal Setup → Cameras" (no longer the combined step)', () => {
    const target = repairTargetForIssue({
      code: 'duplicate_camera_id',
      path: 'cameras[1].id',
      repairSurface: 'animal',
    });
    expect(target.label).toBe('Fix in Animal Setup → Cameras');
  });

  it('labels a data-acq issue "Fix in Animal Setup → Recording System"', () => {
    const target = repairTargetForIssue({
      code: 'divergent_data_acq_identity',
      path: 'data_acq_device[0].name',
      repairSurface: 'animal',
    });
    expect(target.label).toBe('Fix in Animal Setup → Recording System');
  });

  it('does NOT add a step suffix for day-surface or none-surface issues', () => {
    expect(repairTargetForIssue({ code: 'missing_camera', path: 'tasks[0]' }).label).toMatch(/^Fix in /);
    expect(repairTargetForIssue({ code: 'missing_camera', path: 'tasks[0]' }).label).not.toContain('→');
    expect(repairTargetForIssue({ code: 'subject_id_slash' }).surface).toBe('none');
  });
});
