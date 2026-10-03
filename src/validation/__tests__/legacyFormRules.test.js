/**
 * Rules the single-file legacy form adds to the shared validation. The workspace enforces the same
 * things through its own day model, so these must not reach the shared `validate()`.
 */
import { describe, it, expect } from 'vitest';
import { legacyFormRules } from '../rules/legacyFormRules';
import { validate } from '../index';

describe('legacyFormRules()', () => {
  describe('at least one task', () => {
    // trodes_to_nwb always builds the position data from the tasks' epochs (pd.concat over the
    // tasks), which fails when there are no tasks.
    it('blocks an empty task list', () => {
      expect(legacyFormRules({ tasks: [] })).toEqual([
        expect.objectContaining({ path: 'tasks', code: 'no_tasks', severity: 'error' }),
      ]);
    });

    it('accepts a session with a task', () => {
      expect(legacyFormRules({ tasks: [{ task_name: 'Sleep', task_epochs: [1] }] })).toEqual([]);
    });

    it('is not part of the shared validation (the workspace marks a day without tasks incomplete)', () => {
      expect(validate({ tasks: [] }).some((issue) => issue.code === 'no_tasks')).toBe(false);
    });
  });

  describe('subject id the converter can group', () => {
    // trodes_to_nwb groups a session's files by splitting their names on "_", so a subject id with
    // anything but letters, digits and hyphens cannot be matched with its recordings.
    it.each(['rat_01', 'rat 01', 'rat.01'])('warns for the subject id %s', (subjectId) => {
      expect(legacyFormRules({ subject: { subject_id: subjectId } })).toEqual([
        expect.objectContaining({
          path: 'subject.subject_id',
          code: 'subject_id_not_recording_compatible',
          severity: 'warning',
          message: expect.stringContaining(`"${subjectId}"`),
        }),
      ]);
    });

    it('accepts letters, digits and hyphens, and leaves a blank id to the schema', () => {
      expect(legacyFormRules({ subject: { subject_id: 'Rat-01' } })).toEqual([]);
      expect(legacyFormRules({ subject: { subject_id: '' } })).toEqual([]);
    });

    it('stays out of the shared validation (the workspace blocks it instead)', () => {
      expect(
        validate({ subject: { subject_id: 'rat_01' } }).some(
          (issue) => issue.code === 'subject_id_not_recording_compatible'
        )
      ).toBe(false);
    });
  });

  it('handles a missing or malformed model', () => {
    expect(legacyFormRules(null)).toEqual([]);
    expect(legacyFormRules({ tasks: 'none' })).toEqual([]);
  });
});
