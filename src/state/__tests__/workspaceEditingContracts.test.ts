import { describe, expect, it } from 'vitest';
import { buildRealisticWorkspace } from '../../__tests__/fixtures/workspaceBuilders';
import { ACCEPTED_COMMIT } from '../commitResult';
import { createWorkspaceActions } from '../workspaceActions';
import { applyDayUpdates } from '../workspaceTransitions';
import type { Animal, Day, Workspace } from '../workspaceTypes';
import { mergeDayMetadata } from '../workspaceUtils';
import { encodeYaml } from '../../io/yaml';

describe('workspace editing contracts', () => {
  it('applies sibling field edits to the latest day in the same event', () => {
    const { animal, day } = buildRealisticWorkspace() as { animal: Animal; day: Day };
    let workspace = {
      animals: { [animal.id]: animal },
      days: { [day.id]: day },
      settings: {},
    } as unknown as Workspace;
    const workspaceRef = { current: workspace };
    const actions = createWorkspaceActions({
      workspaceRef,
      commitWorkspace: (updater) => {
        workspace = updater(workspaceRef.current);
        workspaceRef.current = workspace;
        return ACCEPTED_COMMIT;
      },
    });

    actions.updateDayField(day.id, 'session.session_description', 'description A');
    actions.updateDayField(day.id, 'session.experiment_description', 'description B');

    expect(workspace.days[day.id].session.session_description).toBe('description A');
    expect(workspace.days[day.id].session.experiment_description).toBe('description B');
  });

  it('applies a related field set as one workspace commit', () => {
    const { animal, day } = buildRealisticWorkspace() as { animal: Animal; day: Day };
    let workspace = {
      animals: { [animal.id]: animal },
      days: { [day.id]: day },
      settings: {},
    } as unknown as Workspace;
    const workspaceRef = { current: workspace };
    let commits = 0;
    const actions = createWorkspaceActions({
      workspaceRef,
      commitWorkspace: (updater) => {
        commits += 1;
        workspace = updater(workspaceRef.current);
        workspaceRef.current = workspace;
        return ACCEPTED_COMMIT;
      },
    });

    actions.updateDayFields(day.id, [
      ['session.session_description', 'description A'],
      ['session.experiment_description', 'description B'],
      ['state.deferredEpochs', [1, 2]],
    ]);

    expect(commits).toBe(1);
    expect(workspace.days[day.id].session).toMatchObject({
      session_description: 'description A',
      experiment_description: 'description B',
    });
    expect(workspace.days[day.id].state?.deferredEpochs).toEqual([1, 2]);
  });

  it('publishes a task catalog extension and its epoch assignment in one commit', () => {
    const { animal, day } = buildRealisticWorkspace() as { animal: Animal; day: Day };
    let workspace = {
      animals: { [animal.id]: animal },
      days: { [day.id]: day },
      settings: {},
    } as unknown as Workspace;
    const workspaceRef = { current: workspace };
    let commits = 0;
    const actions = createWorkspaceActions({
      workspaceRef,
      commitWorkspace: (updater) => {
        commits += 1;
        workspace = updater(workspaceRef.current);
        workspaceRef.current = workspace;
        return ACCEPTED_COMMIT;
      },
    });
    const taskTypes = [
      ...(animal.taskTypes ?? []),
      {
        id: 'new-task',
        task_name: 'New task',
        task_description: 'Defined during entry',
        task_environment: 'arena',
        camera_id: [],
      },
    ];

    actions.updateTaskCatalogAndDayFields(animal.id, day.id, taskTypes, [
      ['taskInstances', [{ taskTypeId: 'new-task', task_epochs: [9] }]],
      ['state.deferredEpochs', [9]],
    ]);

    expect(commits).toBe(1);
    const storedTaskTypes = workspace.animals[animal.id].taskTypes ?? [];
    expect(storedTaskTypes[storedTaskTypes.length - 1]?.id).toBe('new-task');
    expect(workspace.days[day.id].taskInstances).toEqual([
      { taskTypeId: 'new-task', task_epochs: [9] },
    ]);
    expect(workspace.days[day.id].state?.deferredEpochs).toEqual([9]);
  });

  it('adds stable file identity without changing exported YAML', () => {
    const { animal, day } = buildRealisticWorkspace() as { animal: Animal; day: Day };
    const withoutIdentity = {
      ...day,
      associated_files: [
        { name: 'statescript', description: 'statescript log', path: 'x', task_epochs: 1 },
      ],
      associated_video_files: [
        { name: 'video.mpg', camera_id: 0, task_epochs: 1 },
      ],
    };
    const before = encodeYaml(mergeDayMetadata(animal, withoutIdentity));
    const withIdentity = applyDayUpdates(withoutIdentity, {
      associated_files: withoutIdentity.associated_files,
      associated_video_files: withoutIdentity.associated_video_files,
    }, '2026-09-17T00:00:00.000Z');

    expect(withIdentity.associated_files?.[0]).toMatchObject({
      recordId: `${day.id}-file-1`,
      kind: 'statescript',
    });
    expect(withIdentity.associated_video_files?.[0].recordId).toBe(`${day.id}-video-1`);
    expect(encodeYaml(mergeDayMetadata(animal, withIdentity))).toBe(before);
  });
});
