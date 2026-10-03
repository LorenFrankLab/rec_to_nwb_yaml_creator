/**
 * The subject's age is a per-recording fact. An imported day keeps its own file's age; a day logged
 * or duplicated in the app must not export whatever age the file that created the animal stated
 * (the animal-level fallback). It gets the age computed from the date of birth, or none.
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { encodeYaml, decodeYaml } from '../../io/yaml';
import { mergeDayMetadata } from '../workspaceUtils';
import { buildRealisticWorkspace } from '../../__tests__/fixtures/workspaceBuilders';
import { useStore } from '../store';
import { planImport } from '../yamlImportPlan';
import { applyImportPlan } from '../yamlImportApply';
import { ageOnDate } from '../../domain/subjectAge';

/**
 * A file of the realistic session, dated `date`, with the subject's age `age`.
 *
 * @param {string} date - ISO recording date.
 * @param {string} age - The subject age the file states.
 * @returns {{ sourceName: string, flatModel: object }} The decoded file.
 */
function makeFile(date, age) {
  const { animal, day } = buildRealisticWorkspace();
  day.date = date;
  day.session = { ...day.session, session_id: `remy_${date.replace(/-/g, '')}` };
  animal.subject = { ...animal.subject, age };
  const [y, m, d] = date.split('-');
  return { sourceName: `${y}${m}${d}_remy_metadata.yml`, flatModel: decodeYaml(encodeYaml(mergeDayMetadata(animal, day))) };
}

const ws = (result) => result.current.model.workspace;
const exported = (result, date) => mergeDayMetadata(ws(result).animals.remy, ws(result).days[`remy-${date}`]);

describe('ageOnDate', () => {
  it('counts the days from the date of birth to the recording date', () => {
    expect(ageOnDate('2023-01-10T00:00:00', '2023-06-22')).toBe('P163D');
    expect(ageOnDate('2023-01-10T00:00:00.000Z', '2023-01-10')).toBe('P0D');
    expect(ageOnDate('2024-02-28T00:00:00Z', '2024-03-01')).toBe('P2D');
  });

  it('gives no age without a usable date of birth, or for a recording before birth', () => {
    expect(ageOnDate(undefined, '2023-06-22')).toBeNull();
    expect(ageOnDate('', '2023-06-22')).toBeNull();
    expect(ageOnDate('not a date', '2023-06-22')).toBeNull();
    expect(ageOnDate('2023-02-30T00:00:00', '2023-06-22')).toBeNull();
    expect(ageOnDate('2023-07-01T00:00:00', '2023-06-22')).toBeNull();
  });
});

describe('the age of a day created in the app', () => {
  it('a day logged after an import exports the age on its own date, not the file age', () => {
    const { result } = renderHook(() => useStore());
    const plan = planImport([makeFile('2023-06-22', 'P164D')], ws(result));
    act(() => { applyImportPlan(plan, result.current.actions, { workspace: ws(result) }); });
    act(() => result.current.actions.createDay('remy', '2023-07-20', { session_id: 'remy_20230720', session_description: 'x' }));

    expect(exported(result, '2023-06-22').subject.age).toBe('P164D');
    expect(ws(result).days['remy-2023-07-20'].session.age).toBe('P191D');
    expect(exported(result, '2023-07-20').subject.age).toBe('P191D');
    expect(ws(result).days['remy-2023-07-20'].provenance.fields['session.age']).toBe('derived');
  });

  it('a duplicated day gets the age on the new date', () => {
    const { result } = renderHook(() => useStore());
    const plan = planImport([makeFile('2023-06-22', 'P164D')], ws(result));
    act(() => { applyImportPlan(plan, result.current.actions, { workspace: ws(result) }); });
    act(() => result.current.actions.duplicateDay('remy-2023-06-22', '2023-06-29'));

    expect(exported(result, '2023-06-29').subject.age).toBe('P170D');
  });

  it('without a date of birth a new day exports no age rather than another day\'s', () => {
    const { result } = renderHook(() => useStore());
    const { animal } = buildRealisticWorkspace();
    const subject = { ...animal.subject, age: 'P164D' };
    delete subject.date_of_birth;
    act(() => result.current.actions.createAnimal('remy', subject, { devices: animal.devices }));
    act(() => result.current.actions.createDay('remy', '2023-07-20', { session_id: 'remy_20230720', session_description: 'x' }));

    expect(ws(result).days['remy-2023-07-20'].session.age).toBeNull();
    expect(exported(result, '2023-07-20').subject).not.toHaveProperty('age');
  });

  it("keeps a caller's explicit age (an imported day's own file age)", () => {
    const { result } = renderHook(() => useStore());
    const { animal } = buildRealisticWorkspace();
    act(() => result.current.actions.createAnimal('remy', animal.subject, { devices: animal.devices }));
    act(() => result.current.actions.createDay('remy', '2023-07-20', {
      session_id: 'remy_20230720', session_description: 'x', age: 'P6M',
    }));

    expect(exported(result, '2023-07-20').subject.age).toBe('P6M');
  });

  it('a day saved without an age key keeps the animal-level fallback (existing data and goldens)', () => {
    const { animal, day } = buildRealisticWorkspace();
    expect(day.session).not.toHaveProperty('age');
    expect(mergeDayMetadata(animal, day).subject.age).toBe('P164');
  });
});
