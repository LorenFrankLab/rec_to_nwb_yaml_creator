/**
 * Task identity across recording days and import files.
 *
 * Spyglass keeps ONE description per `task_name`; a recording that reuses a name with another
 * description has its task epochs refused at ingestion. Within one day `divergent_task_identity`
 * catches that, and the task catalog makes it impossible for catalog days — but imported (inline)
 * days keep their own task rows, so two days of one animal could disagree with nothing flagged.
 */
import { describe, it, expect } from 'vitest';
import { crossDayTaskIdentityIssues, importTaskDescriptionDivergences } from '../taskIdentity';
import { validateDay, computeStepStatus } from '../validation';
import { mergeDayMetadata as mergeTyped } from '../../state/workspaceUtils';
import { migrateTasksToCatalogV2ToV3 } from '../../state/taskCatalogMigration';
import { buildRealisticWorkspace } from '../../__tests__/fixtures/workspaceBuilders';

type Rec = Record<string, any>;

const CODE = 'divergent_task_identity_across_days';

/**
 * The export merge over the loose fixture records.
 * @param animal - The animal.
 * @param day - The day.
 * @returns The merged (exported) model.
 */
function mergeDayMetadata(animal: Rec, day: Rec): Record<string, any> {
  return mergeTyped(
    animal as Parameters<typeof mergeTyped>[0],
    day as Parameters<typeof mergeTyped>[1]
  );
}

/**
 * A realistic animal with two inline recording days that run the same tasks.
 * @returns The animal and its 2023-06-22 / 2023-06-23 days.
 */
function twoDays(): { animal: Rec; dayA: Rec; dayB: Rec } {
  const { animal, day } = buildRealisticWorkspace() as { animal: Rec; day: Rec };
  const dayB: Rec = { ...structuredClone(day), id: 'remy-2023-06-23', date: '2023-06-23' };
  dayB.session = { ...dayB.session, session_id: 'remy_20230623' };
  animal.days = [day.id, dayB.id];
  return { animal, dayA: day, dayB };
}

/**
 * Change a task's fields on one day.
 * @param day - The inline day.
 * @param taskName - Which task.
 * @param fields - The fields to set.
 */
function editTask(day: Rec, taskName: string, fields: Rec): void {
  day.tasks = day.tasks.map((task: Rec) => (task.task_name === taskName ? { ...task, ...fields } : task));
}

describe('crossDayTaskIdentityIssues', () => {
  it('flags BOTH days when they describe the same task differently', () => {
    const { animal, dayA, dayB } = twoDays();
    editTask(dayB, 'sleep', { task_description: 'resting in the sleep box' });
    const days = [dayA, dayB];

    const onB = crossDayTaskIdentityIssues(dayB, animal, days);
    expect(onB).toHaveLength(1);
    expect(onB[0]).toMatchObject({
      code: CODE,
      severity: 'error',
      path: 'tasks',
      field: 'task_name',
      step: 'epochs',
      repairSurface: 'day',
    });
    expect(onB[0].message).toBe(
      'Task "sleep" has description "resting in the sleep box" on this day, but "Rest in home cage" ' +
        'on 2023-06-22. Spyglass keeps one description per task name and refuses the task epochs of ' +
        'a recording that reuses the name with another. Use the same description on every day, or ' +
        'rename the task where it differs.'
    );

    const onA = crossDayTaskIdentityIssues(dayA, animal, days);
    expect(onA).toHaveLength(1);
    expect(onA[0].message).toMatch(/"Rest in home cage" on this day, but "resting in the sleep box" on 2023-06-23\./);
  });

  it('is silent when the descriptions match, even where the room and cameras differ', () => {
    const { animal, dayA, dayB } = twoDays();
    // Room and cameras are the day's context (Spyglass TaskEpoch), not the task's identity.
    editTask(dayB, 'sleep', { task_environment: 'sleep box', camera_id: [1] });
    expect(crossDayTaskIdentityIssues(dayB, animal, [dayA, dayB])).toEqual([]);
    expect(crossDayTaskIdentityIssues(dayA, animal, [dayA, dayB])).toEqual([]);
  });

  it('treats a missing description like an empty one, as Spyglass does', () => {
    const { animal, dayA, dayB } = twoDays();
    editTask(dayA, 'sleep', { task_description: '' });
    editTask(dayB, 'sleep', { task_description: undefined });
    expect(crossDayTaskIdentityIssues(dayB, animal, [dayA, dayB])).toEqual([]);

    editTask(dayB, 'sleep', { task_description: 'rest' });
    expect(crossDayTaskIdentityIssues(dayB, animal, [dayA, dayB])[0].message).toMatch(
      /^Task "sleep" has description "rest" on this day, but \(none\) on 2023-06-22\./
    );
  });

  it('compares a catalog day (description from the task type) with an inline day', () => {
    const { animal, dayA, dayB } = twoDays();
    // Fold June 22 into the animal's task catalog; June 23 stays an imported inline day.
    const workspace = migrateTasksToCatalogV2ToV3({
      animals: { [animal.id]: { ...animal, days: [dayA.id] } },
      days: { [dayA.id]: { ...dayA, animalId: animal.id } },
    }) as Rec;
    const catalogAnimal: Rec = { ...workspace.animals[animal.id], days: [dayA.id, dayB.id] };
    const catalogDay: Rec = workspace.days[dayA.id];
    expect(Array.isArray(catalogDay.taskInstances)).toBe(true);
    editTask(dayB, 'sleep', { task_description: 'resting in the sleep box' });
    const days = [catalogDay, dayB];

    expect(crossDayTaskIdentityIssues(dayB, catalogAnimal, days).map((i) => i.code)).toEqual([CODE]);
    expect(crossDayTaskIdentityIssues(catalogDay, catalogAnimal, days).map((i) => i.code)).toEqual([CODE]);
  });

  it('has no opinion without the other days (single-day callers)', () => {
    const { animal, dayB } = twoDays();
    editTask(dayB, 'sleep', { task_description: 'resting in the sleep box' });
    expect(crossDayTaskIdentityIssues(dayB, animal)).toEqual([]);
    expect(crossDayTaskIdentityIssues(dayB, animal, [dayB])).toEqual([]);
  });

  it('leaves a disagreement inside one day to divergent_task_identity', () => {
    const { animal, dayA, dayB } = twoDays();
    // Both of June 23's sleep rows differ from each other, but one matches June 22.
    dayB.tasks = [
      { ...dayB.tasks[0], task_description: 'Rest in home cage' },
      dayB.tasks[1],
      { ...dayB.tasks[2], task_description: 'a second description' },
    ];
    const issues = crossDayTaskIdentityIssues(dayB, animal, [dayA, dayB]);
    // June 22's description is one June 23 also uses, so nothing ELSEWHERE differs from this day.
    expect(issues).toEqual([]);
    expect(
      validateDay(dayB, mergeDayMetadata(animal, dayB), animal, [dayA, dayB]).map((i) => i.code)
    ).toContain('divergent_task_identity');
  });

  it('names a long run of other days compactly', () => {
    const { animal, dayA } = twoDays();
    const days = [dayA];
    for (const dd of ['23', '24', '25', '26', '27']) {
      const day: Rec = { ...structuredClone(dayA), id: `remy-2023-06-${dd}`, date: `2023-06-${dd}` };
      editTask(day, 'sleep', { task_description: 'resting in the sleep box' });
      days.push(day);
    }
    const [issue] = crossDayTaskIdentityIssues(dayA, animal, days);
    expect(issue.message).toMatch(
      /but "resting in the sleep box" on 2023-06-23, 2023-06-24, 2023-06-25 and 2 more days\./
    );
  });
});

describe('validateDay — the cross-day task check gates export', () => {
  it('blocks export of both days until the descriptions match', () => {
    const { animal, dayA, dayB } = twoDays();
    editTask(dayB, 'sleep', { task_description: 'resting in the sleep box' });
    const days = [dayA, dayB];

    for (const day of days) {
      const merged = mergeDayMetadata(animal, day);
      const issue = validateDay(day, merged, animal, days).find((i) => i.code === CODE);
      expect(issue).toMatchObject({ severity: 'error', ownerSurface: 'day', step: 'epochs' });
      expect(computeStepStatus(day, merged, animal, days).export).toBe('error');
    }

    editTask(dayB, 'sleep', { task_description: 'Rest in home cage' });
    for (const day of days) {
      expect(computeStepStatus(day, mergeDayMetadata(animal, day), animal, days).export).toBe('valid');
    }
  });
});

describe('importTaskDescriptionDivergences', () => {
  const sleep = (description: string): Rec[] => [
    { task_name: 'sleep', task_description: description, task_environment: 'home cage', camera_id: [0], task_epochs: [1] },
  ];

  it('lists each description of a task name with the files that use it', () => {
    const divergences = importTaskDescriptionDivergences([
      { sourceName: '06222023_remy_metadata.yml', tasks: sleep('sleeping') },
      { sourceName: '06232023_remy_metadata.yml', tasks: sleep('resting in the sleep box') },
      { sourceName: '06242023_remy_metadata.yml', tasks: sleep('sleeping') },
    ]);
    expect(divergences).toEqual([
      {
        field: 'tasks',
        detail:
          'Task "sleep" has different descriptions across these recordings: "sleeping" ' +
          '(06222023_remy_metadata.yml and 06242023_remy_metadata.yml); "resting in the sleep box" ' +
          '(06232023_remy_metadata.yml). Spyglass keeps one description per task name, so these ' +
          'days cannot be exported until the descriptions match or the task is renamed.',
      },
    ]);
  });

  it('lists nothing when the files agree (rooms and cameras may differ)', () => {
    const tasks = sleep('sleeping');
    const elsewhere = [{ ...tasks[0], task_environment: 'sleep box', camera_id: [1] }];
    expect(
      importTaskDescriptionDivergences([
        { sourceName: 'a.yml', tasks },
        { sourceName: 'b.yml', tasks: elsewhere },
      ])
    ).toEqual([]);
  });

  it("compares against the existing animal's days", () => {
    const { animal, dayA } = twoDays();
    animal.days = [dayA.id];
    const workspace = { animals: { [animal.id]: animal }, days: { [dayA.id]: dayA } };
    const [divergence] = importTaskDescriptionDivergences(
      [{ sourceName: '06232023_remy_metadata.yml', tasks: sleep('resting in the sleep box') }],
      { workspace, animalId: animal.id }
    );
    expect(divergence.detail).toMatch(
      /"Rest in home cage" \(already on this animal: 2023-06-22\); "resting in the sleep box" \(06232023_remy_metadata\.yml\)/
    );
    // A disagreement among the existing days alone is not something this import brings.
    const { dayB } = twoDays();
    editTask(dayB, 'sleep', { task_description: 'resting in the sleep box' });
    animal.days = [dayA.id, dayB.id];
    const twoDayWorkspace = { animals: { [animal.id]: animal }, days: { [dayA.id]: dayA, [dayB.id]: dayB } };
    expect(
      importTaskDescriptionDivergences(
        [{ sourceName: 'c.yml', tasks: [{ task_name: 'run', task_description: 'Run' }] }],
        { workspace: twoDayWorkspace, animalId: animal.id }
      )
    ).toEqual([]);
    // A workspace without day records (a bare `{ animals }` slice) compares the files alone.
    expect(
      importTaskDescriptionDivergences(
        [{ sourceName: 'b.yml', tasks: sleep('x') }],
        { workspace: { animals: { [animal.id]: animal } }, animalId: animal.id }
      )
    ).toEqual([]);
  });
});
