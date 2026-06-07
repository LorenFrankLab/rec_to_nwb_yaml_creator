import { describe, it, expect } from 'vitest';
import { duplicateTaskEpochs } from '../taskEpochs';

describe('duplicateTaskEpochs', () => {
  it('finds epochs claimed by more than one task', () => {
    const tasks = [{ task_epochs: [1, 2] }, { task_epochs: [2, 3] }];
    expect([...duplicateTaskEpochs(tasks)]).toEqual([2]);
  });

  it('returns empty when every epoch belongs to exactly one task', () => {
    expect([...duplicateTaskEpochs([{ task_epochs: [1, 2] }, { task_epochs: [3] }])]).toEqual([]);
  });

  it('treats numeric and string epochs as the SAME epoch (Spyglass keys numerically)', () => {
    // The export gate must catch this real cross-type collision — 1 and "1" are one epoch downstream.
    expect([...duplicateTaskEpochs([{ task_epochs: [1] }, { task_epochs: ['1'] }])]).toEqual([1]);
  });

  it('catches a within-task repeated epoch', () => {
    expect([...duplicateTaskEpochs([{ task_epochs: [2, 2] }])]).toEqual([2]);
  });

  it('is shape-tolerant (non-array tasks / epochs, null ids, non-numeric)', () => {
    expect([...duplicateTaskEpochs(null)]).toEqual([]);
    expect([...duplicateTaskEpochs([{ task_epochs: 'nope' }, {}])]).toEqual([]);
    expect([...duplicateTaskEpochs([{ task_epochs: [null, undefined, 'abc'] }])]).toEqual([]);
  });
});
