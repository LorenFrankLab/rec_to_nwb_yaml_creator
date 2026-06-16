/**
 * restoreDay — the Undo half of the undo-able delete (Phase 2 — epoch-editor).
 *
 * It must be TOTAL: a record it can't recreate (no animal id / date, or a date now taken by another
 * day created during the undo window) returns false rather than throwing — otherwise a throw would
 * strand the UndoToast and, in a bulk undo, abort restoring every record after it.
 */
import { describe, it, expect, vi } from 'vitest';
import { restoreDay } from '../restoreDay';

describe('restoreDay', () => {
  it('replays createDay + updateDay and returns true for a well-formed record', () => {
    const createDay = vi.fn();
    const updateDay = vi.fn();
    const ok = restoreDay(
      { animalId: 'remy', date: '2023-06-22', session: { session_id: 's' }, tasks: [{ task_name: 'W' }], state: { exported: true } },
      { createDay, updateDay }
    );
    expect(ok).toBe(true);
    expect(createDay).toHaveBeenCalledWith('remy', '2023-06-22', { session_id: 's' }, {});
    expect(updateDay).toHaveBeenCalledWith(
      'remy-2023-06-22',
      expect.objectContaining({ tasks: [{ task_name: 'W' }], state: { exported: true } })
    );
  });

  it('returns false (never throws) when the record is too malformed to recreate', () => {
    const actions = { createDay: vi.fn(), updateDay: vi.fn() };
    expect(restoreDay({ date: '2023-06-22' }, actions)).toBe(false); // no animalId
    expect(actions.createDay).not.toHaveBeenCalled();
  });

  it('returns false (never throws) when createDay throws — e.g. the date is now taken', () => {
    const createDay = vi.fn(() => {
      throw new Error('Day "remy-2023-06-22" already exists');
    });
    const updateDay = vi.fn();
    let result;
    expect(() => {
      result = restoreDay({ animalId: 'remy', date: '2023-06-22', session: {} }, { createDay, updateDay });
    }).not.toThrow();
    expect(result).toBe(false);
    // The shell failed to create, so no follow-up content write was attempted.
    expect(updateDay).not.toHaveBeenCalled();
  });
});
