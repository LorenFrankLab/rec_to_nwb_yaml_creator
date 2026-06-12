/**
 * Phase 8C — the task-catalog validation rules are LIVE in `validateDay`.
 *
 * 8B built the catalog validators pure and inert; 8C wires them into the day-validation pipeline with
 * correct ownership (definition problems → animal; epoch/order/reference problems → day) and confirms
 * they reconcile with — never duplicate — the existing `divergent_task_identity` rule (which runs on
 * the resolved `tasks[]`; the catalog dedups by name so that rule cannot fire for catalog data).
 */
import { describe, it, expect } from 'vitest';
import { validateDay } from '../validation';
import { mergeDayMetadata } from '../../state/workspaceUtils';
import { migrateTasksToCatalogV2ToV3 } from '../../state/taskCatalogMigration';
import { buildRealisticWorkspace } from '../../__tests__/fixtures/workspaceBuilders';

/**
 * Convert a single `{ animal, day }` (inline) into the catalog shape via the real migrator.
 * @param root0
 * @param root0.animal
 * @param root0.day
 */
function toCatalog({ animal, day }) {
  const ws = migrateTasksToCatalogV2ToV3({
    animals: { [animal.id]: { ...animal, days: [day.id] } },
    days: { [day.id]: { ...day, animalId: animal.id } },
  });
  return { animal: ws.animals[animal.id], day: ws.days[day.id] };
}

const codesOf = (issues) => issues.map((i) => i.code);
const validate = (animal, day) => validateDay(day, mergeDayMetadata(animal, day), animal);

describe('validateDay activates the task-catalog rules', () => {
  it('a clean catalog day surfaces NO catalog issues and NO divergent_task_identity', () => {
    const { animal, day } = toCatalog(buildRealisticWorkspace());
    const codes = codesOf(validate(animal, day));
    expect(codes).not.toContain('duplicate_task_type_name');
    expect(codes).not.toContain('dangling_task_type_ref');
    expect(codes).not.toContain('task_camera_not_used');
    expect(codes).not.toContain('task_definition_reconciled');
    // The realistic day repeats an identical 'sleep' → the catalog dedups it, so the resolved tasks
    // are consistent and the inline-shape divergent rule cannot fire (no double-flagging).
    expect(codes).not.toContain('divergent_task_identity');
  });

  it('a fully-inline (unmigrated) day produces no spurious catalog issues', () => {
    const { animal, day } = buildRealisticWorkspace(); // no taskTypes / taskInstances
    const codes = codesOf(validate(animal, day));
    expect(codes).not.toContain('duplicate_task_type_name');
    expect(codes).not.toContain('dangling_task_type_ref');
  });

  it('surfaces dangling_task_type_ref (day-owned, Epochs step) for an instance with no matching type', () => {
    const { animal, day } = toCatalog(buildRealisticWorkspace());
    day.taskInstances = [...day.taskInstances, { taskTypeId: 'ghost', task_epochs: [9] }];
    const issue = validate(animal, day).find((i) => i.code === 'dangling_task_type_ref');
    expect(issue).toBeTruthy();
    expect(issue.ownerSurface).toBe('day');
    expect(issue.step).toBe('epochs');
  });

  it('surfaces duplicate_task_type_name (animal-owned) when two types share a name', () => {
    const { animal, day } = toCatalog(buildRealisticWorkspace());
    animal.taskTypes = [
      ...animal.taskTypes,
      { id: 'tasktype-9', task_name: animal.taskTypes[0].task_name, task_description: 'a different description' },
    ];
    const issue = validate(animal, day).find((i) => i.code === 'duplicate_task_type_name');
    expect(issue).toBeTruthy();
    expect(issue.ownerSurface).toBe('animal');
  });

  it('surfaces task_camera_not_used (day-owned) when a task type uses a camera the day did not mark used', () => {
    const { animal, day } = toCatalog(buildRealisticWorkspace());
    day.cameras_used = [0]; // w_alternation references cameras [0, 1]; camera 1 is omitted
    const issue = validate(animal, day).find((i) => i.code === 'task_camera_not_used');
    expect(issue).toBeTruthy();
    expect(issue.ownerSurface).toBe('day');
  });

  it('SUPPRESSES a divergent_task_identity the inline form genuinely raises (real, not vacuous)', () => {
    // Two same-name tasks with DIFFERENT descriptions in one day: the inline shape genuinely
    // triggers divergent_task_identity (the catalog exists precisely to make this impossible).
    const inline = buildRealisticWorkspace();
    inline.day.tasks = [
      { task_name: 'sleep', task_description: 'Rest A', task_environment: 'home cage', camera_id: [0], task_epochs: [1] },
      { task_name: 'sleep', task_description: 'Rest B — different!', task_environment: 'home cage', camera_id: [0], task_epochs: [2] },
    ];
    expect(codesOf(validate(inline.animal, inline.day))).toContain('divergent_task_identity');

    // The catalog form dedups to ONE canonical type (+ a reconciliation), so the resolved tasks are
    // consistent: divergent CANNOT fire, and the conflict surfaces as task_definition_reconciled.
    const catalog = toCatalog({ animal: inline.animal, day: inline.day });
    const codes = codesOf(validate(catalog.animal, catalog.day));
    expect(codes).not.toContain('divergent_task_identity');
    expect(codes).toContain('task_definition_reconciled');
  });

  it('surfaces task_definition_reconciled (day-owned, warning) from a recorded reconciliation', () => {
    const { animal, day } = toCatalog(buildRealisticWorkspace());
    day.state = {
      ...day.state,
      taskDefinitionReconciliations: [
        { task_name: 'sleep', taskTypeId: 'tasktype-0', original: { task_environment: 'A' }, canonical: { task_environment: 'B' } },
      ],
    };
    const issue = validate(animal, day).find((i) => i.code === 'task_definition_reconciled');
    expect(issue).toBeTruthy();
    expect(issue.severity).toBe('warning');
    expect(issue.ownerSurface).toBe('day');
  });
});
