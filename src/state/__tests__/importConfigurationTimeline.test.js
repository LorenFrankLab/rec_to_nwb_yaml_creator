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
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { encodeYaml, decodeYaml } from '../../io/yaml';
import { mergeDayMetadata, getCurrentDate } from '../workspaceUtils';
import { buildRealisticWorkspace } from '../../__tests__/fixtures/workspaceBuilders';
import { useStore } from '../store';
import { planImport } from '../yamlImportPlan';
import { applyImportPlan } from '../yamlImportApply';
import { validateDay } from '../../domain/dayValidationComposer';
import { configurationChoiceStatus } from '../../domain/configurationSelection';
import { isBlockingIssue } from '../../validation/issueTypes';

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
 * The exported (merged) metadata of one day of `remy`.
 *
 * @param {object} result - The `renderHook(useStore)` result.
 * @param {string} date - The day's ISO date.
 * @returns {object} The flat export model.
 */
function exportDay(result, date) {
  const ws = result.current.model.workspace;
  return mergeDayMetadata(ws.animals.remy, ws.days[`remy-${date}`]);
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
