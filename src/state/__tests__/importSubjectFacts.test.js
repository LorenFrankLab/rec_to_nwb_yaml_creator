/**
 * Subject facts on import.
 *
 * The animal's subject facts (species, sex, genotype, description, date of birth) are shared by all
 * of its recording days, so adding a day to an existing animal keeps the animal's values. A file
 * that records different ones must say so before the day is added, never be overridden silently
 * (W5).
 *
 * Drives the real store: `planImport` → `applyImportPlan` → export.
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { encodeYaml, decodeYaml } from '../../io/yaml';
import { mergeDayMetadata } from '../workspaceUtils';
import { buildRealisticWorkspace } from '../../__tests__/fixtures/workspaceBuilders';
import { useStore } from '../store';
import { planImport } from '../yamlImportPlan';
import { applyImportPlan } from '../yamlImportApply';

/**
 * A genuine app export (flat YAML model) of `remy` on `date`, built from the realistic fixture.
 *
 * @param {string} date - ISO recording date.
 * @param {object} [subject] - Subject fields to override.
 * @returns {{ sourceName: string, flatModel: object }} The decoded file.
 */
function makeFile(date, subject = {}) {
  const { animal, day } = buildRealisticWorkspace();
  animal.subject = { ...animal.subject, ...subject };
  day.id = `remy-${date}`;
  day.date = date;
  day.session = { ...day.session, session_id: `remy_${date.replace(/-/g, '')}` };
  const [y, m, d] = date.split('-');
  return {
    sourceName: `${m}${d}${y}_remy_metadata.yml`,
    flatModel: decodeYaml(encodeYaml(mergeDayMetadata(animal, day))),
  };
}

/**
 * Plan and commit files in one batch (Add when the animal exists).
 *
 * @param {object} result - The `renderHook(useStore)` result.
 * @param {Array<{ sourceName: string, flatModel: object }>} files - The decoded files.
 * @returns {object} The committed plan.
 */
function commit(result, files) {
  const plan = planImport(files, result.current.model.workspace);
  const existing = plan.animals[0].conflict === 'exists';
  act(() => {
    applyImportPlan(plan, result.current.actions, {
      workspace: result.current.model.workspace,
      ...(existing
        ? { resolutions: { remy: 'add' }, catalogAdditions: { remy: plan.animals[0].catalogAdditions } }
        : {}),
    });
  });
  return plan;
}

/**
 * The export of `remy` on `date` from the live store.
 *
 * @param {object} result - The `renderHook(useStore)` result.
 * @param {string} date - ISO recording date.
 * @returns {object} The merged day metadata.
 */
function exportDay(result, date) {
  const ws = result.current.model.workspace;
  return mergeDayMetadata(ws.animals.remy, ws.days[`remy-${date}`]);
}

describe('adding to an existing animal lists the subject facts its file disagrees on (W5)', () => {
  it('names each differing fact with both values, and keeps the animal\'s', () => {
    const { result } = renderHook(() => useStore());
    commit(result, [makeFile('2023-06-22')]);
    const plan = commit(result, [
      makeFile('2023-06-23', { genotype: 'Pvalb-Cre', sex: 'F', date_of_birth: '2023-02-14T00:00:00' }),
    ]);

    const note = plan.animals[0].divergences.find((d) => d.field === 'subject');
    expect(note).toMatchObject({ scope: 'add' });
    expect(note.detail).toMatch(/sex \("M" on the animal; "F" in 06232023_remy_metadata\.yml\)/);
    expect(note.detail).toMatch(/genotype \("Wild Type" on the animal; "Pvalb-Cre" in 06232023_remy_metadata\.yml\)/);
    expect(note.detail).toMatch(/date_of_birth/);
    expect(note.detail).not.toMatch(/species|description/);

    // Subject facts are the animal's: both days export them, and the animal is unchanged.
    for (const date of ['2023-06-22', '2023-06-23']) {
      expect(exportDay(result, date).subject).toMatchObject({
        genotype: 'Wild Type',
        sex: 'M',
        date_of_birth: '2023-01-10T00:00:00',
      });
    }
  });

  it('lists nothing when the file agrees with the animal', () => {
    const { result } = renderHook(() => useStore());
    commit(result, [makeFile('2023-06-22')]);
    const plan = commit(result, [makeFile('2023-06-23')]);
    expect(plan.animals[0].divergences.filter((d) => d.field === 'subject')).toEqual([]);
  });

  it('does not list a fact the animal has not recorded yet', () => {
    // A draft animal without a date of birth disagrees with nothing; the export gate asks for it.
    const { result } = renderHook(() => useStore());
    commit(result, [makeFile('2023-06-22')]);
    const ws = result.current.model.workspace;
    const draft = { ...ws, animals: { remy: { ...ws.animals.remy, subject: { ...ws.animals.remy.subject } } } };
    delete draft.animals.remy.subject.date_of_birth;

    const plan = planImport([makeFile('2023-06-23', { date_of_birth: '2023-02-14T00:00:00' })], draft);
    expect(plan.animals[0].divergences.filter((d) => d.field === 'subject')).toEqual([]);
  });
});
