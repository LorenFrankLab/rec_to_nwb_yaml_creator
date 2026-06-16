/**
 * Tests for the pure epoch write-back transforms (Phase 4 — epoch grid).
 *
 * The grid is epoch-centric but storage is instance-centric (`day.taskInstances`, each owning a set of
 * `task_epochs`). These helpers map an epoch-level edit to the next instance array, immutably — they
 * are the write-back core the Epochs component dispatches, and the orphan detector backs the
 * confirm-before-orphan flow (the grid never auto-scrubs a bound file/video ref).
 */
import { describe, it, expect } from 'vitest';
import {
  nextEpochNumber,
  addEpochToTask,
  removeEpoch,
  duplicateEpoch,
  setEpochTask,
  swapEpochs,
  insertEpochAfter,
  epochsOrphanedBy,
} from '../epochOperations';

const inst = (taskTypeId, task_epochs) => ({ taskTypeId, task_epochs });

describe('nextEpochNumber', () => {
  it('is max(epoch) + 1, or 1 when empty', () => {
    expect(nextEpochNumber([inst('a', [1, 3, 5]), inst('b', [2, 4])])).toBe(6);
    expect(nextEpochNumber([])).toBe(1);
    expect(nextEpochNumber([inst('a', [])])).toBe(1);
  });
});

describe('addEpochToTask', () => {
  it('appends the next epoch to the matching instance', () => {
    const next = addEpochToTask([inst('a', [1, 3]), inst('b', [2])], 'a');
    expect(next).toEqual([inst('a', [1, 3, 4]), inst('b', [2])]);
  });
  it('creates a new instance when the task type is not yet present', () => {
    const next = addEpochToTask([inst('a', [1])], 'b');
    expect(next).toEqual([inst('a', [1]), inst('b', [2])]);
  });
});

describe('removeEpoch', () => {
  it('removes the epoch from its owner and drops a now-empty instance', () => {
    expect(removeEpoch([inst('a', [1, 3, 5]), inst('b', [2])], 2)).toEqual([inst('a', [1, 3, 5])]);
    expect(removeEpoch([inst('a', [1])], 1)).toEqual([]);
  });
  it('is tolerant of string epoch storage (Number-normalized match)', () => {
    expect(removeEpoch([inst('a', ['1', 2])], 1)).toEqual([inst('a', [2])]);
  });
});

describe('duplicateEpoch', () => {
  it('appends a fresh epoch to the SAME task as the duplicated epoch', () => {
    expect(duplicateEpoch([inst('a', [1, 3]), inst('b', [2])], 3)).toEqual([
      inst('a', [1, 3, 4]),
      inst('b', [2]),
    ]);
  });
});

describe('setEpochTask', () => {
  it('moves the epoch to a different existing task, preserving the epoch number', () => {
    expect(setEpochTask([inst('a', [1, 3]), inst('b', [2])], 3, 'b')).toEqual([
      inst('a', [1]),
      inst('b', [2, 3]),
    ]);
  });
  it('creates a new instance when reassigning to an absent task type', () => {
    expect(setEpochTask([inst('a', [1, 2])], 2, 'c')).toEqual([inst('a', [1]), inst('c', [2])]);
  });
  it('is a no-op when the epoch already belongs to that task', () => {
    expect(setEpochTask([inst('a', [1, 2])], 2, 'a')).toEqual([inst('a', [1, 2])]);
  });
});

describe('swapEpochs (move up/down)', () => {
  it('swaps which task owns each of the two epoch numbers', () => {
    // a owns 1,3,5; b owns 2,4. Swap 2↔3: a now owns 1,2,5; b owns 3,4.
    const next = swapEpochs([inst('a', [1, 3, 5]), inst('b', [2, 4])], 2, 3);
    expect(next).toEqual([inst('a', [1, 2, 5]), inst('b', [3, 4])]);
  });
});

describe('insertEpochAfter', () => {
  it('shifts later epochs up by one and inserts the new epoch into the reference task', () => {
    // a owns 1,3; b owns 2. Insert after 1 → epochs 2,3 shift to 3,4; new epoch 2 joins a.
    const next = insertEpochAfter([inst('a', [1, 3]), inst('b', [2])], 1);
    // a: 1 stays, 3→4, +2 = [1,4,2]; b: 2→3 = [3]
    expect(next).toEqual([inst('a', [1, 4, 2]), inst('b', [3])]);
  });
});

describe('epochsOrphanedBy — confirm-before-orphan detector', () => {
  const day = {
    associated_video_files: [{ name: 'v', camera_id: 0, task_epochs: 2 }],
    associated_files: [{ name: 'f', description: '', path: 'p', task_epochs: 5 }],
    fs_gui_yamls: [{ name: 'g', epochs: [3] }],
  };

  it('reports a bound ref left dangling by the next instance set', () => {
    // removing epoch 2 leaves the video (task_epochs 2) orphaned.
    const next = removeEpoch([inst('a', [1, 2, 3, 5])], 2);
    const orphans = epochsOrphanedBy(day, next);
    expect(orphans.videos).toHaveLength(1);
    expect(orphans.files).toHaveLength(0);
  });
  it('reports nothing when every bound ref still resolves', () => {
    const orphans = epochsOrphanedBy(day, [inst('a', [2, 3, 5])]);
    expect(orphans.videos).toHaveLength(0);
    expect(orphans.files).toHaveLength(0);
  });
});
