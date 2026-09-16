import { describe, it, expect } from 'vitest';
import { applyAnimalUpdates, createDayRecord } from '../workspaceTransitions';
import { mergeDayMetadata } from '../workspaceUtils';
import { serializeWorkspaceBackup, parseWorkspaceBackup } from '../persistence';
import { buildCatalogWorkspace } from '../../__tests__/fixtures/workspaceBuilders';
import { completeOptogenetics } from '../../__tests__/fixtures/completeOptogenetics';
import { recordingSystemSignature, recordingSystemReviewed, missingAnimalSetupFacts } from '../../domain/animalSetupProgress';
import { validateDay } from '../../domain/validation';
import { isIncompleteEntryIssue } from '../../domain/validationPresentation';
import { buildAnimalWorkspaceViewModel } from '../../viewModels/animalWorkspaceViewModel';

const NOW = '2026-09-16T12:00:00Z';

describe('design re-review: durable setup and honest progress', () => {
  it('treats blank birth dates as unfinished entry and malformed dates as errors, keeping both blocking', () => {
    const { animal, day } = buildCatalogWorkspace();
    for (const [value, incomplete] of [['', true], ['   ', true], ['2023-not-a-date', false]]) {
      animal.subject.date_of_birth = value;
      const issue = validateDay(day, mergeDayMetadata(animal, day), animal).find((entry) => entry.path === 'subject.date_of_birth');
      expect(issue.severity).toBe('error');
      expect(isIncompleteEntryIssue(issue)).toBe(incomplete);
      if (incomplete) expect(issue.message).toBe('Date of birth is required before export');
    }
  });

  it('retains disabled optogenetics through backup hydration without leaking it into new recordings', () => {
    const { animal, day } = buildCatalogWorkspace();
    const opto = completeOptogenetics();
    animal.optogenetics = opto;
    day.optogenetics = structuredClone(opto);
    const before = mergeDayMetadata(animal, day);
    const off = applyAnimalUpdates(animal, { optogenetics: null, optogeneticsDraft: opto }, NOW);
    const workspace = { version: '1.0.0', animals: { [animal.id]: off }, days: { [day.id]: day }, settings: {}, lastModified: NOW };
    const restored = parseWorkspaceBackup(serializeWorkspaceBackup(workspace, 'test')).workspace;
    const saved = restored.animals[animal.id];
    expect(saved.optogenetics).toBeNull();
    expect(saved.optogeneticsDraft).toEqual(opto);
    const nextDay = createDayRecord(saved, animal.id, 'next', '2023-06-23', {}, NOW);
    const merged = mergeDayMetadata(saved, nextDay);
    expect(merged.opto_excitation_source).toEqual([]);
    expect(merged).not.toHaveProperty('optogeneticsDraft');
    const oldRecording = mergeDayMetadata(saved, restored.days[day.id]);
    for (const key of ['opto_excitation_source', 'optical_fiber', 'virus_injection', 'optogenetic_stimulation_software']) expect(oldRecording[key]).toEqual(before[key]);
    const on = applyAnimalUpdates(saved, { optogenetics: saved.optogeneticsDraft, optogeneticsDraft: null }, NOW);
    expect(on.optogenetics).toEqual(opto);
  });

  it('retains recording-system review through backup and asks again after hardware changes', () => {
    const { animal } = buildCatalogWorkspace();
    expect(recordingSystemReviewed(animal)).toBe(false);
    const reviewed = applyAnimalUpdates(animal, { recordingSystemReviewed: recordingSystemSignature(animal) }, NOW);
    expect(recordingSystemReviewed(reviewed)).toBe(true);
    const workspace = { version: '1.0.0', animals: { [animal.id]: reviewed }, days: {}, settings: {}, lastModified: NOW };
    const restored = parseWorkspaceBackup(serializeWorkspaceBackup(workspace, 'test')).workspace.animals[animal.id];
    expect(recordingSystemReviewed(restored)).toBe(true);
    const changed = applyAnimalUpdates(restored, { data_acq_device: [{ ...restored.devices.data_acq_device[0], amplifier: 'Different hardware' }] }, NOW);
    expect(recordingSystemReviewed(changed)).toBe(false);
  });

  it('keeps missing birth date and team visible with direct setup-resume links', () => {
    const { animal } = buildCatalogWorkspace();
    animal.subject.date_of_birth = '';
    animal.experimenters.experimenter_name = [];
    animal.days = [];
    expect(missingAnimalSetupFacts(animal)).toMatchObject({ identity: ['date of birth'], team: ['experiment description', 'experimenters'] });
    const vm = buildAnimalWorkspaceViewModel({ animals: { [animal.id]: animal }, days: {} }, animal.id).selectedAnimal;
    expect(vm.showSetupCard).toBe(true);
    expect(vm.setupSections).toContainEqual(expect.objectContaining({ key: 'identity', status: 'todo', action: expect.objectContaining({ href: `#/home?animal=${animal.id}&step=identity` }) }));
    expect(vm.setupSections).toContainEqual(expect.objectContaining({ key: 'team', status: 'todo', action: expect.objectContaining({ href: `#/home?animal=${animal.id}&step=team` }) }));
  });
});
