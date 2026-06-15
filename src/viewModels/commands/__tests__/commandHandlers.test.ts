import { describe, it, expect, vi } from 'vitest';
import { commandHandlers, toRepairCommand } from '../commandHandlers';
import type { WorkflowCommand } from '../../types';

/**
 * A fake store-actions bag: spies for every action a descriptor command (or the repair executor)
 * can write through. The repair adapter reuses the REAL `applyRepairCommand`, so the repair tests
 * assert the executor's effect (the `updateDay` / `updateAnimal` call it makes), not a mock of it.
 */
const spyActions = () => ({
  deleteDay: vi.fn(),
  duplicateDay: vi.fn(),
  removeDayReference: vi.fn(),
  relinkDayReference: vi.fn(),
  unlinkDayReference: vi.fn(),
  createAnimal: vi.fn(),
  updateDay: vi.fn(),
  updateAnimal: vi.fn(),
  rebuildConfigurationHistory: vi.fn(),
});

describe('commandHandlers — store-write descriptor commands', () => {
  it('deleteDay routes the descriptor target to actions.deleteDay(dayId, ownerAnimalId)', () => {
    const actions = spyActions();
    const run = commandHandlers({ actions });
    const cmd: WorkflowCommand = {
      id: 'deleteDay',
      target: { animalId: 'remy', dayId: 'remy-2023-06-22' },
    };
    run[cmd.id](cmd);
    expect(actions.deleteDay).toHaveBeenCalledWith('remy-2023-06-22', 'remy');
  });

  it('duplicateDay routes the target dayId + the transient date to actions.duplicateDay', () => {
    const actions = spyActions();
    const run = commandHandlers({ actions });
    const cmd: WorkflowCommand = { id: 'duplicateDay', target: { animalId: 'remy', dayId: 'remy-2023-06-22' } };
    run[cmd.id](cmd, { date: '2023-06-23' });
    expect(actions.duplicateDay).toHaveBeenCalledWith('remy-2023-06-22', '2023-06-23');
  });

  it('removeDayReference routes (animalId, dayId) to actions.removeDayReference', () => {
    const actions = spyActions();
    const run = commandHandlers({ actions });
    const cmd: WorkflowCommand = { id: 'removeDayReference', target: { animalId: 'remy', dayId: 'd1' } };
    run[cmd.id](cmd);
    expect(actions.removeDayReference).toHaveBeenCalledWith('remy', 'd1');
  });

  it('relinkDayReference routes (animalId, dayId) to actions.relinkDayReference', () => {
    const actions = spyActions();
    const run = commandHandlers({ actions });
    const cmd: WorkflowCommand = { id: 'relinkDayReference', target: { animalId: 'remy', dayId: 'd1' } };
    run[cmd.id](cmd);
    expect(actions.relinkDayReference).toHaveBeenCalledWith('remy', 'd1');
  });

  it('unlinkDayReference routes (animalId, dayId) to actions.unlinkDayReference', () => {
    const actions = spyActions();
    const run = commandHandlers({ actions });
    const cmd: WorkflowCommand = { id: 'unlinkDayReference', target: { animalId: 'remy', dayId: 'd1' } };
    run[cmd.id](cmd);
    expect(actions.unlinkDayReference).toHaveBeenCalledWith('remy', 'd1');
  });

  it('createAnimal routes the transient form input to actions.createAnimal(animalId, subject, metadata)', () => {
    const actions = spyActions();
    const run = commandHandlers({ actions });
    const cmd: WorkflowCommand = { id: 'createAnimal' };
    const input = { animalId: 'bean', subject: { species: 'Rattus norvegicus' }, metadata: { cameras: [] } };
    run[cmd.id](cmd, input);
    expect(actions.createAnimal).toHaveBeenCalledWith('bean', { species: 'Rattus norvegicus' }, { cameras: [] });
  });
});

describe('commandHandlers — repair descriptor commands delegate to applyRepairCommand', () => {
  it('resetDayCollection clears the named day collection via updateDay', () => {
    const actions = spyActions();
    const run = commandHandlers({ actions, dayId: 'd1' });
    const cmd: WorkflowCommand = { id: 'resetDayCollection', target: { dayId: 'd1' }, payload: { field: 'tasks' } };
    run[cmd.id](cmd);
    expect(actions.updateDay).toHaveBeenCalledWith('d1', { tasks: [] });
  });

  it('rebuildConfigurationHistory routes to the animal-surface executor', () => {
    const actions = spyActions();
    const run = commandHandlers({ actions, animalId: 'remy' });
    const cmd: WorkflowCommand = { id: 'rebuildConfigurationHistory', target: { animalId: 'remy' } };
    run[cmd.id](cmd);
    expect(actions.rebuildConfigurationHistory).toHaveBeenCalledWith('remy');
  });

  it('acknowledgeBadChannelRemoval adapts to the acknowledgeBadChannelRemovals executor with its acks', () => {
    const actions = spyActions();
    const run = commandHandlers({ actions, dayId: 'd1', day: {} as never });
    const cmd: WorkflowCommand = {
      id: 'acknowledgeBadChannelRemoval',
      target: { dayId: 'd1' },
      payload: { acks: { '1': [0, 2] } },
    };
    run[cmd.id](cmd);
    expect(actions.updateDay).toHaveBeenCalledWith('d1', {
      state: { badChannelRemovalAcks: { '1': [0, 2] } },
    });
  });

  it('repairAnimalCollection (the no-op fallback id) writes nothing', () => {
    const actions = spyActions();
    const run = commandHandlers({ actions, animalId: 'remy' });
    const cmd: WorkflowCommand = { id: 'repairAnimalCollection', target: { animalId: 'remy' } };
    run[cmd.id](cmd);
    expect(actions.updateAnimal).not.toHaveBeenCalled();
    expect(actions.updateDay).not.toHaveBeenCalled();
    expect(actions.rebuildConfigurationHistory).not.toHaveBeenCalled();
  });
});

describe('toRepairCommand — descriptor → executor RepairCommand', () => {
  it('maps the singular acknowledge id onto the plural executor type and carries acks', () => {
    const cmd: WorkflowCommand = {
      id: 'acknowledgeBadChannelRemoval',
      payload: { acks: { '1': [0] } },
    };
    expect(toRepairCommand(cmd)).toEqual({ type: 'acknowledgeBadChannelRemovals', acks: { '1': [0] } });
  });

  it('passes key/field payload through for the override-removal executors', () => {
    const cmd: WorkflowCommand = {
      id: 'removeBadChannelOverrideKey',
      payload: { key: '3' },
    };
    expect(toRepairCommand(cmd)).toEqual({ type: 'removeBadChannelOverrideKey', key: '3' });
  });
});
