/**
 * restoreDay — the Undo half of the undo-able delete (Phase 2 — epoch-editor).
 *
 * It hands the WHOLE captured record back to the store (`restoreDeletedDay`), never a re-derived
 * subset. It must be TOTAL: a day the store refuses (a date now taken by another day created during
 * the undo window, or an owner that is gone) returns false rather than throwing — otherwise a throw
 * would strand the UndoToast and, in a bulk undo, abort restoring every record after it.
 */
import { describe, it, expect, vi } from 'vitest';
import { restoreDay } from '../restoreDay';
import type { Day } from '../../../state/workspaceTypes';

const record = {
  id: 'remy-2023-06-22',
  animalId: 'remy',
  date: '2023-06-22',
  session: { session_id: 's' },
  experimenters: { experimenter_name: ['Doe, Jane'] },
} as unknown as Day;

describe('restoreDay', () => {
  it('hands the captured record, its store key and owner to restoreDeletedDay', () => {
    const restoreDeletedDay = vi.fn();
    const ok = restoreDay({ dayId: 'remy-2023-06-22', ownerAnimalId: 'remy', record }, { restoreDeletedDay });
    expect(ok).toBe(true);
    expect(restoreDeletedDay).toHaveBeenCalledWith('remy-2023-06-22', record, 'remy');
  });

  it('returns false (never throws) when the store refuses — e.g. the date is now taken', () => {
    const restoreDeletedDay = vi.fn(() => {
      throw new Error('Day "remy-2023-06-22" already exists');
    });
    let result: boolean | undefined;
    expect(() => {
      result = restoreDay({ dayId: 'remy-2023-06-22', ownerAnimalId: 'remy', record }, { restoreDeletedDay });
    }).not.toThrow();
    expect(result).toBe(false);
  });
});
