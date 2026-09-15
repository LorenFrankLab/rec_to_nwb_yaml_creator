/**
 * Fix-plan ownership contract: editing the animal DEFAULTS (team, experiment description,
 * optogenetics setup, adding catalog entries for rigs / cameras / task types) leaves an existing
 * day's export byte-identical. Only the explicit `applyAnimalDefaultsToDays` correction reaches
 * named days.
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStore } from '../store';
import { encodeYaml } from '../../io/yaml';
import { mergeDayMetadata } from '../workspaceUtils';
import { buildCatalogWorkspace } from '../../__tests__/fixtures/workspaceBuilders';

/**
 * A catalog-shaped one-day workspace with day-owned team/opto copies.
 *
 * @returns {{workspace: object, animalId: string, dayId: string}}
 */
function seed() {
  const { animal, day } = buildCatalogWorkspace();
  const workspace = {
    version: '1.0.0',
    lastModified: 'x',
    animals: { [animal.id]: { ...animal, days: [day.id] } },
    days: { [day.id]: { ...day, experimenters: structuredClone(animal.experimenters), optogenetics: null } },
    settings: { defaultLab: '', defaultInstitution: '', defaultExperimenters: [], autoSaveInterval: 30000, shadowExportEnabled: true },
  };
  return { workspace, animalId: animal.id, dayId: day.id };
}

/**
 * The current export bytes of a day.
 *
 * @param {object} result - Rendered store hook.
 * @param {string} animalId
 * @param {string} dayId
 * @returns {string}
 */
function exportOf(result, animalId, dayId) {
  const ws = result.current.model.workspace;
  return encodeYaml(mergeDayMetadata(ws.animals[animalId], ws.days[dayId]));
}

describe('editing animal defaults leaves existing days unchanged', () => {
  it('team, experiment description, opto setup, and new rig / camera / task-type entries', () => {
    const { workspace, animalId, dayId } = seed();
    const { result } = renderHook(() => useStore({ workspace }));
    const before = exportOf(result, animalId, dayId);

    act(() => {
      result.current.actions.updateAnimal(animalId, {
        experimenters: { experimenter_name: ['Newperson, Alex'], lab: 'Other Lab', institution: 'Elsewhere' },
        experiment_description: 'A completely different experiment',
        optogenetics: { opto_excitation_source: [], optical_fiber: [], virus_injection: [], optogenetic_stimulation_software: 'fsgui' },
        cameras: [
          ...result.current.model.workspace.animals[animalId].cameras,
          { id: 9, meters_per_pixel: 0.002, manufacturer: 'New', model: 'Cam', lens: 'L', camera_name: 'extra_camera' },
        ],
        taskTypes: [
          ...result.current.model.workspace.animals[animalId].taskTypes,
          { id: 'tasktype-99', task_name: 'novel_task', task_description: 'New task', task_environment: 'box', camera_id: [9] },
        ],
        data_acq_device: [
          ...result.current.model.workspace.animals[animalId].devices.data_acq_device,
          { name: 'Second rig', system: 'SpikeGadgets', amplifier: 'Intan', adc_circuit: 'Intan' },
        ],
      });
    });

    expect(exportOf(result, animalId, dayId)).toBe(before);
  });

  it('the explicit correction applies the defaults to the NAMED days only', () => {
    const { workspace, animalId, dayId } = seed();
    // A second day that must NOT be touched.
    const otherId = 'remy-2023-06-23';
    workspace.days[otherId] = { ...workspace.days[dayId], id: otherId, date: '2023-06-23' };
    workspace.animals[animalId].days = [dayId, otherId];
    const { result } = renderHook(() => useStore({ workspace }));
    const otherBefore = exportOf(result, animalId, otherId);

    act(() => {
      result.current.actions.updateAnimal(animalId, {
        experimenters: { experimenter_name: ['Newperson, Alex'], lab: 'Frank', institution: 'UCSF' },
      });
      result.current.actions.applyAnimalDefaultsToDays(animalId, [dayId], ['experimenters']);
    });
    const ws = result.current.model.workspace;
    expect(mergeDayMetadata(ws.animals[animalId], ws.days[dayId]).experimenter_name).toEqual(['Newperson, Alex']);
    expect(ws.days[dayId].provenance.fields.experimenters).toBe('animal-default');
    expect(exportOf(result, animalId, otherId)).toBe(otherBefore);
  });
});
