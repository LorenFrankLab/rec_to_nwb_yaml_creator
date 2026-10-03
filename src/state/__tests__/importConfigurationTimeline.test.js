/**
 * How an import feeds the animal's configuration history, driven through the REAL store exactly as
 * Import & Repair commits files: `planImport` → `applyImportPlan` → `mergeDayMetadata`.
 *
 *  - W10: a clean imported day is not blocked on its own configuration choice. The first
 *    configuration is dated from the earliest file (a known effective date, not the import's entry
 *    date), and the import's pin — the file's own geometry — is conclusive.
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { encodeYaml, decodeYaml } from '../../io/yaml';
import { mergeDayMetadata } from '../workspaceUtils';
import { buildRealisticWorkspace } from '../../__tests__/fixtures/workspaceBuilders';
import { useStore } from '../store';
import { planImport } from '../yamlImportPlan';
import { applyImportPlan } from '../yamlImportApply';
import { validateDay } from '../../domain/dayValidationComposer';
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
