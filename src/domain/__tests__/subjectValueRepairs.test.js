/**
 * Subject values an earlier import stored on an animal (an unknown field such as `notes`, a
 * non-text strain, a bad age__reference) block every day's export. They must have an in-app fix:
 * a one-click repair that removes the value from the animal, routed like other animal-profile
 * repairs, with a message that does not send the user back to a file they no longer import.
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { buildRealisticWorkspace } from '../../__tests__/fixtures/workspaceBuilders';
import { mergeDayMetadata } from '../../state/workspaceUtils';
import { useStore } from '../../state/store';
import { applyRepairCommand } from '../../state/repairCommands';
import { validateDay } from '../dayValidationComposer';
import { repairTargetForIssue } from '../repairRouting';

const blocking = (animal, day) =>
  validateDay(day, mergeDayMetadata(animal, day), animal, [day]).filter((i) => i.severity === 'error');

describe('subject values stored by an earlier import', () => {
  it.each([
    ['an unknown field', { notes: 'implanted left' }, 'notes', 'unknown_subject_field'],
    ['a non-text strain', { strain: 5 }, 'strain', 'subject_value_type'],
    ['an age__reference pynwb rejects', { age__reference: 'Birth' }, 'age__reference', 'subject_value_type'],
  ])('offers a one-click removal of %s from the animal', (_label, extra, field, code) => {
    const { animal, day } = buildRealisticWorkspace();
    animal.subject = { ...animal.subject, ...extra };
    const issue = blocking(animal, day).find((i) => i.code === code);

    expect(issue).toMatchObject({
      ownerSurface: 'animal',
      repairCommand: { type: 'removeSubjectField', field },
    });
    expect(repairTargetForIssue(issue).surface).toBe('animal');
    expect(issue.actionLabel).toMatch(new RegExp(`Remove.*${field}`));
    // The animal is already in the workspace: re-importing a file is not the remedy.
    expect(issue.message).not.toMatch(/importing the file again/);
  });

  it.each([
    ['a non-ISO age (DANDI advisory)', 'P164', 'subject_age_format'],
    ['a non-text age', 164, 'subject_value_type'],
  ])("routes %s to this day's age in the Daily log", (_label, age, code) => {
    const { animal, day } = buildRealisticWorkspace();
    animal.subject = { ...animal.subject, age };
    const issue = validateDay(day, mergeDayMetadata(animal, day), animal, [day]).find((i) => i.code === code);

    expect(issue).toMatchObject({ ownerSurface: 'day', step: 'overview', focusPath: 'session.age' });
    expect(issue.repairCommand).toBeUndefined();
    expect(repairTargetForIssue(issue).label).toBe('Fix in Daily log');
  });

  it('removing the field clears the export block on every day of the animal', () => {
    const { result } = renderHook(() => useStore());
    const { animal } = buildRealisticWorkspace();
    act(() => result.current.actions.createAnimal('remy', { ...animal.subject, notes: 'implanted left' }, {
      devices: animal.devices,
    }));
    act(() => result.current.actions.createDay('remy', '2023-06-22', { session_id: 'remy_20230622', session_description: 'x' }));
    act(() => result.current.actions.createDay('remy', '2023-06-23', { session_id: 'remy_20230623', session_description: 'y' }));
    const current = () => result.current.model.workspace;
    const codes = (dayId) =>
      blocking(current().animals.remy, current().days[dayId]).map((i) => i.code);
    expect(codes('remy-2023-06-22')).toContain('unknown_subject_field');

    const issue = blocking(current().animals.remy, current().days['remy-2023-06-22'])
      .find((i) => i.code === 'unknown_subject_field');
    act(() => applyRepairCommand(issue.repairCommand, {
      actions: result.current.actions,
      animalId: 'remy',
      dayId: 'remy-2023-06-22',
    }));

    expect(current().animals.remy.subject).not.toHaveProperty('notes');
    expect(current().animals.remy.subject.species).toBe(animal.subject.species);
    expect(codes('remy-2023-06-22')).not.toContain('unknown_subject_field');
    expect(codes('remy-2023-06-23')).not.toContain('unknown_subject_field');
  });
});
