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

  it('handles a missing or malformed model', () => {
    expect(legacyFormRules(null)).toEqual([]);
    expect(legacyFormRules({ tasks: 'none' })).toEqual([]);
  });
});
