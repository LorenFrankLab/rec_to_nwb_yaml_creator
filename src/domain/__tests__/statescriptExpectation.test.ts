/**
 * Tests for the statescript expectation rule (pure).
 *
 * The settled policy: a missing statescript is NEVER an export blocker — it is an amber warning,
 * and only for epochs where a statescript is actually EXPECTED. Expectation is carry-forward:
 * a run/task epoch always expects one; a sleep epoch expects one only when the animal's prior
 * same-`configurationVersion` days actually linked a sleep statescript. A probe reconfiguration
 * (a different `configurationVersion`) resets the comparison, exactly as bad-channel monotonicity does.
 */
import { describe, it, expect } from 'vitest';
import {
  isSleepTaskName,
  buildStatescriptExpectation,
  isStatescriptExpected,
  statescriptStateFor,
} from '../statescriptExpectation';

/** An animal with a Sleep + Run task catalog. */
const animal = {
  id: 'r',
  subject: { subject_id: 'r' },
  taskTypes: [
    { id: 'tasktype-0', task_name: 'Sleep', task_description: 'sleep' },
    { id: 'tasktype-1', task_name: 'Run', task_description: 'run' },
  ],
};

/**
 * A catalog day: Sleep owns epoch 1, Run owns epoch 2.
 *
 * @param date - The day's ISO date.
 * @param files - The day's `associated_files`.
 * @param configurationVersion - The day's probe-configuration version.
 * @returns The day record.
 */
function makeDay(date: string, files: Array<Record<string, unknown>> = [], configurationVersion = 1) {
  return {
    id: `r-${date}`,
    animalId: 'r',
    date,
    configurationVersion,
    taskInstances: [
      { taskTypeId: 'tasktype-0', task_epochs: [1] },
      { taskTypeId: 'tasktype-1', task_epochs: [2] },
    ],
    associated_files: files,
    associated_video_files: [],
    fs_gui_yamls: [],
    state: {},
  };
}

/**
 * A statescript `associated_files` row for an epoch.
 *
 * @param epoch - The epoch the file belongs to.
 * @returns The stored row.
 */
function statescriptFile(epoch: number) {
  return {
    name: `statescript_${epoch}`,
    description: 'Statescript Log',
    path: `/data/r/2023062${epoch}_r_0${epoch}.stateScriptLog`,
    task_epochs: epoch,
  };
}

describe('isSleepTaskName', () => {
  it('matches the sleep task word, case-insensitively, and nothing else', () => {
    expect(isSleepTaskName('Sleep')).toBe(true);
    expect(isSleepTaskName('sleep box')).toBe(true);
    expect(isSleepTaskName('Run')).toBe(false);
    expect(isSleepTaskName('sleepy wtrack')).toBe(false);
    expect(isSleepTaskName(undefined)).toBe(false);
  });
});

describe('buildStatescriptExpectation — sleep carry-forward', () => {
  it('does not expect sleep statescripts when the animal has no prior days', () => {
    const today = makeDay('2023-06-22');
    expect(buildStatescriptExpectation(animal, today, [today]).sleepExpected).toBe(false);
  });

  it('expects sleep statescripts once an EARLIER same-config day linked one for a sleep epoch', () => {
    const prior = makeDay('2023-06-21', [statescriptFile(1)]);
    const today = makeDay('2023-06-22');
    expect(buildStatescriptExpectation(animal, today, [prior, today]).sleepExpected).toBe(true);
  });

  it('does not treat a prior RUN statescript as a sleep precedent', () => {
    const prior = makeDay('2023-06-21', [statescriptFile(2)]);
    const today = makeDay('2023-06-22');
    expect(buildStatescriptExpectation(animal, today, [prior, today]).sleepExpected).toBe(false);
  });

  it('never compares across a probe reconfiguration (a different configurationVersion)', () => {
    const prior = makeDay('2023-06-21', [statescriptFile(1)], 1);
    const today = makeDay('2023-06-22', [], 2);
    expect(buildStatescriptExpectation(animal, today, [prior, today]).sleepExpected).toBe(false);
  });

  it('ignores LATER days — expectation carries forward, never backward', () => {
    const later = makeDay('2023-06-23', [statescriptFile(1)]);
    const today = makeDay('2023-06-22');
    expect(buildStatescriptExpectation(animal, today, [today, later]).sleepExpected).toBe(false);
  });

  it('reads a legacy inline-tasks prior day the same as a catalog one', () => {
    const prior = {
      ...makeDay('2023-06-21', [statescriptFile(1)]),
      taskInstances: undefined,
      tasks: [{ task_name: 'Sleep', task_description: 'sleep', task_epochs: [1] }],
    };
    const today = makeDay('2023-06-22');
    expect(buildStatescriptExpectation(animal, today, [prior, today]).sleepExpected).toBe(true);
  });

  it('degrades to no expectation on corrupt input rather than throwing', () => {
    expect(buildStatescriptExpectation(null, null, null as unknown as unknown[]).sleepExpected).toBe(false);
  });
});

describe('isStatescriptExpected / statescriptStateFor', () => {
  it('always expects a statescript for a run (non-sleep) epoch', () => {
    expect(isStatescriptExpected({ taskName: 'Run' }, { sleepExpected: false })).toBe(true);
    expect(isStatescriptExpected({ taskName: '' }, { sleepExpected: false })).toBe(true);
  });

  it('expects a sleep epoch statescript only when the animal has logged one before', () => {
    expect(isStatescriptExpected({ taskName: 'Sleep' }, { sleepExpected: false })).toBe(false);
    expect(isStatescriptExpected({ taskName: 'Sleep' }, { sleepExpected: true })).toBe(true);
  });

  it('reports linked whenever a file is bound, whatever the expectation', () => {
    expect(statescriptStateFor({ taskName: 'Sleep', statescript: {} }, { sleepExpected: false })).toBe('linked');
    expect(statescriptStateFor({ taskName: 'Run', statescript: null }, { sleepExpected: false })).toBe('expected');
    expect(statescriptStateFor({ taskName: 'Sleep', statescript: null }, { sleepExpected: false })).toBe('not_expected');
  });
});
