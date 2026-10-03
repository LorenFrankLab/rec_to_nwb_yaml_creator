/**
 * How an import feeds the animal's configuration history, driven through the REAL store exactly as
 * Import & Repair commits files: `planImport` → `applyImportPlan` → `mergeDayMetadata`.
 *
 *  - W10: a clean imported day is not blocked on its own configuration choice. The first
 *    configuration is dated from the earliest file (a known effective date, not the import's entry
 *    date), and the import's pin — the file's own geometry — is conclusive.
 *  - W1: an import never takes over the effective-date timeline. Each imported day uses its own
 *    file's configuration; a back-filled (older) file changes no other day's configuration, and
 *    after A → B → A the next day gets A.
 *  - W2: after an import, Animal Setup edits the configuration new days get (the animal's editable
 *    `devices` mirror it), and an edit never rewrites another configuration's electrode groups.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { renderHook, act } from '@testing-library/react';
import { encodeYaml, decodeYaml } from '../../io/yaml';
import { mergeDayMetadata, getCurrentDate } from '../workspaceUtils';
import { buildRealisticWorkspace } from '../../__tests__/fixtures/workspaceBuilders';
import { useStore } from '../store';
import { planImport } from '../yamlImportPlan';
import { applyImportPlan } from '../yamlImportApply';
import { getAnimalDevices, getAnimalElectrodeGroups, getConfigHistory } from '../workspaceSelectors';
import { validateDay } from '../../domain/dayValidationComposer';
import { configurationChoiceStatus } from '../../domain/configurationSelection';
import { isBlockingIssue } from '../../validation/issueTypes';
import { normalizeElectrodeGroupWithDefaults, normalizeIdKey } from '../../utils/deviceNormalization';

const goldenDir = path.join(__dirname, '../../__tests__/fixtures/golden');

/**
 * A genuine app export (decoded flat YAML) of `remy` recorded on `date`, from the realistic fixture.
 *
 * @param {object} [options]
 * @param {string} [options.date] - ISO recording date.
 * @param {Function} [options.mutate] - Edits the fixture `(animal, day)` before it is exported.
 * @returns {{ sourceName: string, flatModel: object }} The decoded file.
 */
function makeFile({ date = '2023-06-22', mutate } = {}) {
  const { animal, day } = buildRealisticWorkspace();
  day.id = `remy-${date}`;
  day.date = date;
  day.session = { ...day.session, session_id: `remy_${date.replace(/-/g, '')}` };
  if (mutate) mutate(animal, day);
  const [year, month, dd] = date.split('-');
  return {
    sourceName: `${month}${dd}${year}_remy_metadata.yml`,
    flatModel: decodeYaml(encodeYaml(mergeDayMetadata(animal, day))),
  };
}

/**
 * Commit files as Import & Repair does: a new animal is created; an existing one gets the files'
 * days added (with the catalog rows the files bring).
 *
 * @param {object} result - The `renderHook(useStore)` result.
 * @param {Array<object>} files - Decoded files.
 * @returns {object} The apply summary.
 */
function importFiles(result, files) {
  const plan = planImport(files, result.current.model.workspace);
  const existing = plan.animals.filter((animal) => animal.conflict === 'exists');
  let summary;
  act(() => {
    summary = applyImportPlan(plan, result.current.actions, {
      workspace: result.current.model.workspace,
      resolutions: Object.fromEntries(existing.map((animal) => [animal.subjectId, 'add'])),
      catalogAdditions: Object.fromEntries(
        existing.map((animal) => [animal.existingAnimalId, animal.catalogAdditions])
      ),
    });
  });
  return summary;
}

/**
 * Keep the fixture configuration's first `count` tetrodes (and their channel maps).
 *
 * @param {number} count - Tetrodes to keep.
 * @returns {Function} A `makeFile` mutation.
 */
const keepTetrodes = (count) => (animal) => {
  const config = animal.configurationHistory[0].devices;
  config.electrode_groups = config.electrode_groups.slice(0, count);
  config.ntrode_electrode_group_channel_map = config.ntrode_electrode_group_channel_map.slice(0, count);
};

/**
 * Record one tetrode in a different brain region (a location-only configuration difference).
 *
 * @param {number} groupId - The electrode group to relabel.
 * @param {string} location - Its new location.
 * @returns {Function} A `makeFile` mutation.
 */
const relocate = (groupId, location) => (animal) => {
  const groups = animal.configurationHistory[0].devices.electrode_groups;
  groups[groupId] = { ...groups[groupId], location, targeted_location: location };
};

/**
 * Set `remy` up in the app (the creation-wizard path) with the fixture's first `groupCount`
 * tetrodes, optionally recording when that setup became effective.
 *
 * @param {object} result - The `renderHook(useStore)` result.
 * @param {number} groupCount - Tetrodes in the setup.
 * @param {object} [options]
 * @param {string} [options.effectiveDate] - The setup's known effective date.
 */
function createAnimalInApp(result, groupCount, { effectiveDate } = {}) {
  const { animal } = buildRealisticWorkspace();
  const config = animal.configurationHistory[0].devices;
  act(() => {
    result.current.actions.createAnimal('remy', animal.subject, {
      devices: {
        data_acq_device: animal.devices.data_acq_device,
        device: animal.devices.device,
        electrode_groups: config.electrode_groups.slice(0, groupCount),
        ntrode_electrode_group_channel_map: config.ntrode_electrode_group_channel_map.slice(0, groupCount),
      },
      cameras: animal.cameras,
      experimenters: animal.experimenters,
    });
  });
  if (effectiveDate) {
    act(() => {
      result.current.actions.setConfigurationEffectiveDate('remy', 1, effectiveDate);
    });
  }
}

/**
 * Log a new recording day for `remy` in the app ("Log today" / the calendar).
 *
 * @param {object} result - The `renderHook(useStore)` result.
 * @param {string} date - ISO date.
 */
function logDay(result, date) {
  act(() => {
    result.current.actions.createDay('remy', date, {
      session_id: `remy_${date.replace(/-/g, '')}`,
      session_description: 'logged in the app',
      weight: 480,
    });
  });
}

/**
 * The day after the app's "today" — after an in-app setup's entry date.
 *
 * @returns {string} ISO date.
 */
function dayAfterToday() {
  const [year, month, day] = getCurrentDate().split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

/**
 * The exported (merged) metadata of one recording day.
 *
 * @param {object} result - The `renderHook(useStore)` result.
 * @param {string} date - The day's ISO date.
 * @param {string} [animalId] - The animal (default `remy`).
 * @returns {object} The flat export model.
 */
function exportDay(result, date, animalId = 'remy') {
  const ws = result.current.model.workspace;
  return mergeDayMetadata(ws.animals[animalId], ws.days[`${animalId}-${date}`]);
}

/**
 * Edit one electrode group in Animal Setup exactly as `ElectrodeGroupsContainer.handleSaveGroup`
 * saves it: the edited row replaces its group in the editable setup, which is written back whole.
 *
 * @param {object} result - The `renderHook(useStore)` result.
 * @param {string} animalId - The animal.
 * @param {number} groupId - The electrode group being edited.
 * @param {object} changes - The edited fields.
 */
function editGroupInAnimalSetup(result, animalId, groupId, changes) {
  const devices = getAnimalDevices(result.current.model.workspace.animals[animalId]);
  const isEdited = (group) => normalizeIdKey(group.id) === normalizeIdKey(groupId);
  const edited = normalizeElectrodeGroupWithDefaults(
    { ...devices.electrode_groups.find(isEdited), ...changes, id: groupId },
    groupId
  );
  act(() => {
    result.current.actions.updateAnimal(animalId, {
      devices: {
        ...devices,
        electrode_groups: devices.electrode_groups.map((group) => (isEdited(group) ? edited : group)),
        ntrode_electrode_group_channel_map: devices.ntrode_electrode_group_channel_map,
      },
    });
  });
}

/**
 * A golden fixture as an import file recorded on the date `sourceName` names. The fixtures share
 * one placeholder path for their associated files, which import rejects, so each gets its own.
 *
 * @param {string} fixture - The golden fixture filename.
 * @param {string} sourceName - The import filename (`{mmddYYYY}_{subject}_metadata.yml`).
 * @returns {{ sourceName: string, flatModel: object }} The decoded file.
 */
function goldenFile(fixture, sourceName) {
  const flatModel = decodeYaml(fs.readFileSync(path.join(goldenDir, fixture), 'utf8'));
  flatModel.associated_files = flatModel.associated_files.map((file, index) => ({
    ...file,
    path: `${file.path}file_${index}.txt`,
  }));
  return { sourceName, flatModel };
}

/**
 * Whether one day's configuration choice is settled for export.
 *
 * @param {object} result - The `renderHook(useStore)` result.
 * @param {string} date - The day's ISO date.
 * @returns {string} `'confirmed'` / `'unconfirmed'` / `'unpinned'`.
 */
function choiceStatus(result, date) {
  const ws = result.current.model.workspace;
  return configurationChoiceStatus(ws.animals.remy, ws.days[`remy-${date}`]).status;
}

/**
 * The blocking issue codes of one day of `remy`.
 *
 * @param {object} result - The `renderHook(useStore)` result.
 * @param {string} date - The day's ISO date.
 * @returns {string[]} Blocking issue codes.
 */
function blockingCodes(result, date) {
  const ws = result.current.model.workspace;
  const remy = ws.animals.remy;
  const day = ws.days[`remy-${date}`];
  return validateDay(day, mergeDayMetadata(remy, day), remy, remy.days.map((id) => ws.days[id]))
    .filter(isBlockingIssue)
    .map((issue) => issue.code);
}

describe('W10: an imported day is not blocked on its own configuration choice', () => {
  it('a single clean file imported as a new animal exports without a setup-confirmation blocker', () => {
    const { result } = renderHook(() => useStore());
    importFiles(result, [makeFile({ date: '2023-06-22' })]);
    expect(blockingCodes(result, '2023-06-22')).not.toContain('configuration_effective_date_unconfirmed');
  });

  it('dates the first configuration from the earliest file as a KNOWN effective date, not the entry date', () => {
    const { result } = renderHook(() => useStore());
    importFiles(result, [makeFile({ date: '2023-06-23' }), makeFile({ date: '2023-06-20' })]);
    const [v1] = result.current.model.workspace.animals.remy.configurationHistory;
    expect(v1).toMatchObject({ version: 1, date: '2023-06-20' });
    expect(v1.effectiveDateKnown).not.toBe(false);
  });

  it('a later day logged in the app after the import is covered by that configuration (no per-day confirmation)', () => {
    const { result } = renderHook(() => useStore());
    importFiles(result, [makeFile({ date: '2023-06-22' })]);
    act(() => {
      result.current.actions.createDay('remy', '2023-06-23', {
        session_id: 'remy_20230623',
        session_description: 'next session',
        weight: 480,
      });
    });
    expect(result.current.model.workspace.days['remy-2023-06-23'].provenance.configuration).toEqual({
      source: 'effective-date',
      confirmed: true,
    });
  });
});

describe('W1: an import never takes over the effective-date timeline', () => {
  it('back-filling an OLDER 8-tetrode file onto an animal set up in the app with 7 leaves new days on the 7-tetrode setup', () => {
    const { result } = renderHook(() => useStore());
    createAnimalInApp(result, 7);
    expect(importFiles(result, [makeFile({ date: '2023-06-10' })]).createdDays).toEqual(['remy-2023-06-10']);
    // The imported day exports its own file's configuration, unblocked.
    expect(exportDay(result, '2023-06-10').electrode_groups).toHaveLength(8);
    expect(choiceStatus(result, '2023-06-10')).toBe('confirmed');

    const next = dayAfterToday();
    logDay(result, next);
    expect(exportDay(result, next).electrode_groups).toHaveLength(7);
    expect(choiceStatus(result, next)).toBe('confirmed');
  });

  it('with a known setup date, a back-filled file recorded elsewhere changes neither the existing later day nor new days', () => {
    const { result } = renderHook(() => useStore());
    createAnimalInApp(result, 8, { effectiveDate: '2023-01-01' });
    logDay(result, '2023-07-01');
    importFiles(result, [makeFile({ date: '2023-03-01', mutate: relocate(0, 'CA3') })]);

    expect(exportDay(result, '2023-03-01').electrode_groups[0].location).toBe('CA3');
    // The existing day is not superseded by the back-filled configuration (its export is not blocked).
    expect(choiceStatus(result, '2023-07-01')).toBe('confirmed');
    expect(exportDay(result, '2023-07-01').electrode_groups[0].location).toBe('CA1');
    // New days — after the existing day, or between it and the file — keep the in-app setup.
    logDay(result, '2023-07-02');
    logDay(result, '2023-03-02');
    for (const date of ['2023-07-02', '2023-03-02']) {
      expect(exportDay(result, date).electrode_groups[0].location).toBe('CA1');
      expect(choiceStatus(result, date)).toBe('confirmed');
    }
  });

  it('back-filling a file with the SAME hardware reuses the configuration and leaves the existing day confirmed', () => {
    const { result } = renderHook(() => useStore());
    createAnimalInApp(result, 8);
    const next = dayAfterToday();
    logDay(result, next);
    expect(choiceStatus(result, next)).toBe('confirmed');

    importFiles(result, [makeFile({ date: '2023-06-20' })]);
    const ws = result.current.model.workspace;
    expect(ws.animals.remy.configurationHistory.map((snapshot) => snapshot.version)).toEqual([1]);
    expect(ws.days['remy-2023-06-20'].configurationVersion).toBe(1);
    expect(choiceStatus(result, '2023-06-20')).toBe('confirmed');
    expect(choiceStatus(result, next)).toBe('confirmed');
  });

  it('batch A (06-20) → B (06-21) → A (06-22): each day keeps its own file and the next day (06-23) gets A', () => {
    const { result } = renderHook(() => useStore());
    importFiles(result, [
      makeFile({ date: '2023-06-20' }),
      makeFile({ date: '2023-06-21', mutate: relocate(4, 'DG') }),
      makeFile({ date: '2023-06-22' }),
    ]);
    expect(exportDay(result, '2023-06-21').electrode_groups[4].location).toBe('DG');
    expect(exportDay(result, '2023-06-22').electrode_groups[4].location).toBe('CA3');

    logDay(result, '2023-06-23');
    expect(exportDay(result, '2023-06-23').electrode_groups[4].location).toBe('CA3');
    expect(choiceStatus(result, '2023-06-23')).toBe('confirmed');
    for (const date of ['2023-06-20', '2023-06-21', '2023-06-22']) {
      expect(choiceStatus(result, date)).toBe('confirmed');
    }
  });

  it('adding a NEWER file with different hardware starts a new configuration for the days after it', () => {
    const { result } = renderHook(() => useStore());
    importFiles(result, [makeFile({ date: '2023-06-22' })]);
    importFiles(result, [makeFile({ date: '2023-06-25', mutate: keepTetrodes(7) })]);

    expect(exportDay(result, '2023-06-25').electrode_groups).toHaveLength(7);
    expect(choiceStatus(result, '2023-06-22')).toBe('confirmed');
    logDay(result, '2023-06-26');
    logDay(result, '2023-06-23');
    expect(exportDay(result, '2023-06-26').electrode_groups).toHaveLength(7);
    // Before the newer file, the earlier configuration was still in effect.
    expect(exportDay(result, '2023-06-23').electrode_groups).toHaveLength(8);
  });
});

describe('W2: after an import, Animal Setup edits the configuration days get from now on', () => {
  it('a batch whose setup changed (8 tetrodes 06-22, 7 on 06-23) leaves Animal Setup holding the latest 7-tetrode setup', () => {
    const { result } = renderHook(() => useStore());
    importFiles(result, [makeFile({ date: '2023-06-22' }), makeFile({ date: '2023-06-23', mutate: keepTetrodes(7) })]);
    const remy = result.current.model.workspace.animals.remy;
    expect(getAnimalElectrodeGroups(remy)).toHaveLength(7);
    expect(getAnimalElectrodeGroups(remy)).toEqual(getConfigHistory(remy).at(-1).devices.electrode_groups);
  });

  it('…and a location fix there reaches 06-23 without rewriting either day’s electrode groups', () => {
    const { result } = renderHook(() => useStore());
    importFiles(result, [makeFile({ date: '2023-06-22' }), makeFile({ date: '2023-06-23', mutate: keepTetrodes(7) })]);
    editGroupInAnimalSetup(result, 'remy', 0, { location: 'CA1 dorsal' });

    const june23 = exportDay(result, '2023-06-23');
    expect(june23.electrode_groups).toHaveLength(7);
    expect(june23.ntrode_electrode_group_channel_map).toHaveLength(7);
    expect(june23.electrode_groups[0].location).toBe('CA1 dorsal');
    const june22 = exportDay(result, '2023-06-22');
    expect(june22.electrode_groups).toHaveLength(8);
    expect(june22.electrode_groups[0].location).toBe('CA1');
  });

  it('a description fix after importing the 32-tetrode sample (06-01) and its 128c reconfiguration (06-02) changes only 06-02’s probe', () => {
    const { result } = renderHook(() => useStore());
    importFiles(result, [
      goldenFile('20230622_sample_metadata.yml', '06012023_54321_metadata.yml'),
      goldenFile('20230622_sample_metadataProbeReconfig.yml', '06022023_54321_metadata.yml'),
    ]);
    const before = exportDay(result, '2023-06-02', '54321');
    expect(before.electrode_groups.map((group) => group.device_type)).toEqual(['128c-4s6mm6cm-15um-26um-sl']);

    editGroupInAnimalSetup(result, '54321', 0, { description: 'probe device description' });
    const after = exportDay(result, '2023-06-02', '54321');
    expect(after.electrode_groups).toEqual([{ ...before.electrode_groups[0], description: 'probe device description' }]);
    expect(after.ntrode_electrode_group_channel_map).toEqual(before.ntrode_electrode_group_channel_map);
    const june1 = exportDay(result, '2023-06-01', '54321');
    expect(june1.electrode_groups).toHaveLength(32);
    expect(june1.electrode_groups[0].description).toBe('terode device description');
  });

  it('after ADDING an older 7-tetrode day, a location fix reaches the current day and leaves the older day’s own groups', () => {
    const { result } = renderHook(() => useStore());
    importFiles(result, [makeFile({ date: '2023-06-22' })]);
    importFiles(result, [makeFile({ date: '2023-06-10', mutate: keepTetrodes(7) })]);
    expect(getAnimalElectrodeGroups(result.current.model.workspace.animals.remy)).toHaveLength(8);

    editGroupInAnimalSetup(result, 'remy', 0, { location: 'CA1 dorsal' });
    expect(exportDay(result, '2023-06-22').electrode_groups[0].location).toBe('CA1 dorsal');
    const june10 = exportDay(result, '2023-06-10');
    expect(june10.electrode_groups).toHaveLength(7);
    expect(june10.electrode_groups[0].location).toBe('CA1');
  });

  it('after adding a NEWER file with different hardware, Animal Setup holds that newer setup', () => {
    const { result } = renderHook(() => useStore());
    importFiles(result, [makeFile({ date: '2023-06-22' })]);
    importFiles(result, [makeFile({ date: '2023-06-25', mutate: keepTetrodes(7) })]);
    expect(getAnimalElectrodeGroups(result.current.model.workspace.animals.remy)).toHaveLength(7);

    editGroupInAnimalSetup(result, 'remy', 0, { location: 'CA1 dorsal' });
    expect(exportDay(result, '2023-06-25').electrode_groups[0].location).toBe('CA1 dorsal');
    expect(exportDay(result, '2023-06-22').electrode_groups).toHaveLength(8);
    expect(exportDay(result, '2023-06-22').electrode_groups[0].location).toBe('CA1');
  });
});
