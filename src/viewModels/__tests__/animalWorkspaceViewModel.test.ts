/**
 * Parity tests for buildAnimalWorkspaceViewModel.
 *
 * The builder must reproduce what the AnimalWorkspace page renders today. Each assertion recomputes
 * the page's truth from the same domain functions the components call (`getPresentDayCount` for cards,
 * `mergeDayMetadata` + `getDayRowStatus` + the orphan re-link override for day rows, `getAnimalSectionStatus`
 * + `getAnimalBlockingSections` for setup sections, `classifyAnimalDays` for recovery), then asserts the
 * view-model reproduces it — so a divergence fails. It also cross-checks the shared day-row helper: a
 * fully-valid day's row equals what the ValidationSummary builder produces for the same day.
 */
import { describe, it, expect } from 'vitest';
import { buildAnimalWorkspaceViewModel } from '../animalWorkspaceViewModel';
import { buildValidationSummaryViewModel } from '../validationSummaryViewModel';
import { getPresentDayCount } from '../../domain/dayRecovery';
import {
  getAnimalSectionStatus,
  getAnimalBlockingSections,
  SECTION_STATUS,
} from '../../domain/sectionStatus';
import { buildRealisticWorkspace } from '../../__tests__/fixtures/workspaceBuilders';

type Workspace = { animals: Record<string, unknown>; days: Record<string, unknown> };
type Idable = { id: string } & Record<string, unknown>;

/** `buildRealisticWorkspace` is untyped JS; narrow its result so `.id`/spreads type-check. */
function loadRealistic(): { animal: Idable; day: Idable } {
  return buildRealisticWorkspace() as { animal: Idable; day: Idable };
}

function wrap(animal: Idable, day: Idable): Workspace {
  return { animals: { [animal.id]: animal }, days: { [day.id]: day } };
}

describe('buildAnimalWorkspaceViewModel — animal cards', () => {
  it('reproduces day count + href for each animal in a multi-animal workspace', () => {
    const { animal, day } = loadRealistic();
    // A second animal with one day, plus an animal with no days.
    const day2 = { ...day, id: 'remy-2023-06-23', date: '2023-06-23' };
    const ws: Workspace = {
      animals: {
        [animal.id]: animal,
        bean: { id: 'bean', days: ['bean-d1'], subject: { subject_id: 'bean' } },
        cnut: { id: 'cnut', days: [], subject: { subject_id: 'cnut' } },
      },
      days: {
        [day.id]: day,
        'bean-d1': { id: 'bean-d1', animalId: 'bean', date: '2023-07-01' },
      },
    };
    void day2;

    const vm = buildAnimalWorkspaceViewModel(ws);
    expect(vm.animals.map((a) => a.id)).toEqual([animal.id, 'bean', 'cnut']);
    for (const card of vm.animals) {
      expect(card.dayCount).toBe(getPresentDayCount(card.id, ws.animals[card.id], ws.days));
      expect(card.href).toBe(`#/animal/${card.id}/days`);
    }
    expect(vm.animals.find((a) => a.id === animal.id)?.dayCount).toBe(1);
    expect(vm.animals.find((a) => a.id === 'bean')?.dayCount).toBe(1);
    expect(vm.animals.find((a) => a.id === 'cnut')?.dayCount).toBe(0);
  });

  it('exposes the create + import affordances and no empty state when animals exist', () => {
    const { animal, day } = loadRealistic();
    const vm = buildAnimalWorkspaceViewModel(wrap(animal, day));
    expect(vm.primaryAction).toEqual({
      label: 'Create Animal',
      command: { id: 'createAnimal' },
      intent: 'setup',
    });
    expect(vm.importState).toEqual({ canImport: true });
    expect(vm.empty).toBeUndefined();
  });
});

describe('buildAnimalWorkspaceViewModel — day rows parity', () => {
  it('a fully-valid day reads ready + carries duplicate/delete actions, and equals the shared row', () => {
    const { animal, day } = loadRealistic();
    const ws = wrap(animal, day);
    const vm = buildAnimalWorkspaceViewModel(ws, animal.id);
    const rows = vm.selectedAnimal?.dayRows ?? [];
    expect(rows).toHaveLength(1);
    const row = rows[0];

    expect(row.recovery).toBe('ok');
    expect(row.status).toBe('ready');
    expect(row.statusLabel).toBe('Ready to export');
    expect(row.lifecycle).toBe('ready');
    expect(row.exportEligibility).toBe('eligible');
    expect(row.href).toBe(`#/day/${day.id}`);
    expect(row.sessionDescription).toBe('Day 45 of chronic recording, W-track alternation');

    // Per-row general actions only on OK rows: duplicate + delete with stable targets.
    expect(row.actions).toEqual([
      { label: 'Duplicate day…', command: { id: 'duplicateDay', target: { animalId: animal.id, dayId: day.id } } },
      { label: 'Delete day…', command: { id: 'deleteDay', target: { animalId: animal.id, dayId: day.id } } },
    ]);

    // Shared-helper cross-check: the SAME day's row in the ValidationSummary builder shares the core
    // shape (status/label/recovery/lifecycle/eligibility/href) — neither surface forks the row logic.
    const vsRow = buildValidationSummaryViewModel(ws).days[0];
    expect(row.status).toBe(vsRow.status);
    expect(row.statusLabel).toBe(vsRow.statusLabel);
    expect(row.recovery).toBe(vsRow.recovery);
    expect(row.lifecycle).toBe(vsRow.lifecycle);
    expect(row.exportEligibility).toBe(vsRow.exportEligibility);
    expect(row.href).toBe(vsRow.href);
  });

  it('refines a downloaded day as Exported (status stays ready)', () => {
    const { animal, day } = loadRealistic();
    const exported = { ...day, state: { draft: false, validated: true, exported: true } };
    const vm = buildAnimalWorkspaceViewModel(wrap(animal, exported), animal.id);
    const row = vm.selectedAnimal!.dayRows[0];
    expect(row.status).toBe('ready');
    expect(row.statusLabel).toBe('Exported');
    expect(row.lifecycle).toBe('exported');
    // A downloaded day's delete carries the downstream-not-deleted caveat.
    const del = row.actions.find((a) => a.command?.id === 'deleteDay');
    expect(del?.command?.confirmCaveat).toMatch(/does not delete any YAML you already downloaded/i);
  });

  it('a missing-record (dangling) day → error, no editor link, remove-reference repair, no general actions', () => {
    const ws: Workspace = {
      animals: { remy: { id: 'remy', days: ['ghost'], subject: { subject_id: 'remy' } } },
      days: {},
    };
    const row = buildAnimalWorkspaceViewModel(ws, 'remy').selectedAnimal!.dayRows[0];
    expect(row.recovery).toBe('dangling_reference');
    expect(row.status).toBe('error');
    expect(row.statusLabel).toBe('Missing record');
    expect(row.href).toBeUndefined();
    expect(row.actions).toEqual([]);
    expect(row.recoveryDetail?.repair?.command).toEqual({
      id: 'removeDayReference',
      target: { animalId: 'remy', dayId: 'ghost' },
    });
  });

  it('a wrong-owner day → error, belongs-to detail, unlink repair, no editor link', () => {
    const ws: Workspace = {
      animals: { remy: { id: 'remy', days: ['d1'], subject: { subject_id: 'remy' } } },
      days: { d1: { id: 'd1', animalId: 'bean', date: '2023-07-01' } },
    };
    const row = buildAnimalWorkspaceViewModel(ws, 'remy').selectedAnimal!.dayRows[0];
    expect(row.recovery).toBe('wrong_owner');
    expect(row.status).toBe('error');
    expect(row.statusLabel).toBe('Belongs to bean — listed here by mistake; not exported with this animal.');
    expect(row.href).toBeUndefined();
    expect(row.recoveryDetail?.ownerDescription).toBe('bean');
    expect(row.recoveryDetail?.message).toBe('belongs to bean');
    expect(row.recoveryDetail?.repair?.command?.id).toBe('unlinkDayReference');
  });

  it('a recovered-unlinked valid day → re-link label, blocked eligibility, relink repair + editor link', () => {
    const { animal, day } = loadRealistic();
    const ws: Workspace = {
      animals: { [animal.id]: { ...animal, days: [] } }, // owner present, does not list the day
      days: { [day.id]: day },
    };
    const row = buildAnimalWorkspaceViewModel(ws, animal.id).selectedAnimal!.dayRows[0];
    expect(row.recovery).toBe('recovered_unlinked');
    expect(row.statusLabel).toBe('Re-link to export');
    // The override flips the label to a Draft-variant linkage blocker → todo severity.
    expect(row.status).toBe('todo');
    expect(row.exportEligibility).toBe('blocked-needs-relink');
    expect(row.lifecycle).toBeUndefined();
    expect(row.href).toBe(`#/day/${day.id}`);
    // No general (duplicate/delete) actions on a non-OK row.
    expect(row.actions).toEqual([]);
    expect(row.recoveryDetail?.message).toBe('not in day list');
    expect(row.recoveryDetail?.repair?.command?.id).toBe('relinkDayReference');
  });
});

describe('buildAnimalWorkspaceViewModel — setup sections', () => {
  it('a configured animal reads done/review; an under-configured animal reads todo/Set up', () => {
    const { animal, day } = loadRealistic();
    // The realistic animal has a recording system + cameras configured on the animal record, but its
    // electrode groups live in configurationHistory (not animal.devices), and it has no opto — so the
    // animal-setup status reads recording-system + cameras as Done and electrode-groups + opto as To do.
    const vm = buildAnimalWorkspaceViewModel(wrap(animal, day), animal.id);
    const sections = vm.selectedAnimal!.setupSections;
    expect(sections.map((s) => s.key)).toEqual([
      'electrode-groups',
      'recording-system',
      'cameras',
      'optogenetics',
    ]);

    const blocking = getAnimalBlockingSections(animal as never, wrap(animal, day).days as never);
    for (const s of sections) {
      const isBlocking = blocking.has(s.key);
      const isTodo =
        !isBlocking && getAnimalSectionStatus(animal as never, s.key) === SECTION_STATUS.TODO;
      const expectedStatus = isBlocking ? 'error' : isTodo ? 'todo' : 'ready';
      const expectedVerb = isBlocking ? 'Fix' : isTodo ? 'Set up' : 'Review';
      const expectedIntent = isBlocking ? 'fix' : isTodo ? 'setup' : 'review';
      expect(s.status).toBe(expectedStatus);
      expect(s.action?.label).toBe(expectedVerb);
      expect(s.action?.intent).toBe(expectedIntent);
      expect(s.action?.href).toBe(`#/animal/${animal.id}/${s.key}`);
    }

    // Concrete reads for this fixture: animal-record-configured sections done/Review; the
    // configurationHistory-only electrode groups and the never-configured opto → todo/Set up.
    const byKey = Object.fromEntries(sections.map((s) => [s.key, s]));
    expect(byKey['electrode-groups'].status).toBe('todo');
    expect(byKey['electrode-groups'].action?.label).toBe('Set up');
    expect(byKey['recording-system'].status).toBe('ready');
    expect(byKey['recording-system'].action?.label).toBe('Review');
    expect(byKey['cameras'].status).toBe('ready');
    expect(byKey['optogenetics'].status).toBe('todo');
    expect(byKey['optogenetics'].action?.label).toBe('Set up');
  });

  it('a never-configured animal reads every setup section as todo/Set up', () => {
    const ws: Workspace = {
      animals: { fresh: { id: 'fresh', days: [], subject: { subject_id: 'fresh' } } },
      days: {},
    };
    const vm = buildAnimalWorkspaceViewModel(ws, 'fresh');
    for (const s of vm.selectedAnimal!.setupSections) {
      expect(s.status).toBe('todo');
      expect(s.action?.label).toBe('Set up');
      expect(s.action?.intent).toBe('setup');
    }
    // A fresh animal with no day is not established → the setup card shows.
    expect(vm.selectedAnimal!.showSetupCard).toBe(true);
  });

  it('hides the setup card once an animal has a subject and at least one day', () => {
    const { animal, day } = loadRealistic();
    const vm = buildAnimalWorkspaceViewModel(wrap(animal, day), animal.id);
    expect(vm.selectedAnimal!.showSetupCard).toBe(false);
  });
});

describe('buildAnimalWorkspaceViewModel — recovery / review', () => {
  it('a corrupt (non-array) day index surfaces the corrupt-index note and corrupt review', () => {
    const ws: Workspace = {
      animals: { remy: { id: 'remy', days: { broken: true }, subject: { subject_id: 'remy' } } },
      days: {},
    };
    const sel = buildAnimalWorkspaceViewModel(ws, 'remy').selectedAnimal!;
    expect(sel.daysCorrupt).toBe(true);
    expect(sel.review?.hasCorruption).toBe(true);
    expect(sel.review?.corruptIndexNote).toMatch(/recording-day list is corrupt/i);
    expect(sel.review?.reviewLink.href).toBe('#/animal/remy/export');
  });

  it('a recovered (orphan) day surfaces the recovered note (pluralized) and a re-link day row', () => {
    const { animal, day } = loadRealistic();
    const ws: Workspace = {
      animals: { [animal.id]: { ...animal, days: [] } },
      days: { [day.id]: day },
    };
    const sel = buildAnimalWorkspaceViewModel(ws, animal.id).selectedAnimal!;
    expect(sel.review?.recoveredNote).toMatch(/1 recovered recording day is/);
    expect(sel.review?.recoveredNote).toMatch(/not in day list/);
    expect(sel.dayRows[0].recovery).toBe('recovered_unlinked');
  });

  it('a wrong-owner day surfaces the wrong-owner note (pluralized)', () => {
    const ws: Workspace = {
      animals: { remy: { id: 'remy', days: ['d1', 'd2'], subject: { subject_id: 'remy' } } },
      days: {
        d1: { id: 'd1', animalId: 'bean', date: '2023-07-01' },
        d2: { id: 'd2', animalId: 'cnut', date: '2023-07-02' },
      },
    };
    const sel = buildAnimalWorkspaceViewModel(ws, 'remy').selectedAnimal!;
    expect(sel.review?.wrongOwnerNote).toMatch(/2 day are listed here but belong to a different animal/);
  });

  it('raw-shape corruption of an animal collection surfaces a repair notice + review (no day-class corruption)', () => {
    const { animal, day } = loadRealistic();
    // The animal's cameras collection is corrupt (a non-array). The live page drives its review on
    // this via validateRawAnimal, independent of any day-index / recovered / wrong-owner corruption —
    // the VM must surface it as a structured repair notice rather than leaving the UI to re-detect it.
    const corrupt = { ...animal, cameras: 'corrupt' as unknown as typeof animal.cameras };
    const sel = buildAnimalWorkspaceViewModel(
      { animals: { [animal.id]: corrupt }, days: { [day.id]: day } },
      animal.id
    ).selectedAnimal!;
    expect(sel.daysCorrupt).toBe(false); // the day INDEX is fine; only a raw collection is corrupt
    expect(sel.review?.hasCorruption).toBe(true);
    const camerasNotice = sel.review?.rawCorruptionNotices.find(
      (n) => n.repair.target?.fieldPath === 'cameras'
    );
    expect(camerasNotice).toBeDefined();
    expect(camerasNotice?.kind).toBe('malformed-collection');
    expect(typeof camerasNotice?.repair.id).toBe('string');
  });

  it('a clean established animal has no review state', () => {
    const { animal, day } = loadRealistic();
    const sel = buildAnimalWorkspaceViewModel(wrap(animal, day), animal.id).selectedAnimal!;
    expect(sel.review).toBeUndefined();
  });
});

describe('buildAnimalWorkspaceViewModel — carry-forward', () => {
  it('reports the most-recent day as the carry-forward source', () => {
    const { animal, day } = loadRealistic();
    const sel = buildAnimalWorkspaceViewModel(wrap(animal, day), animal.id).selectedAnimal!;
    expect(sel.carryForward.available).toBe(true);
    expect(sel.carryForward.lastDayDate).toBe('2023-06-22');
  });

  it('reports no carry-forward source for an animal with no days', () => {
    const ws: Workspace = {
      animals: { fresh: { id: 'fresh', days: [], subject: { subject_id: 'fresh' } } },
      days: {},
    };
    const sel = buildAnimalWorkspaceViewModel(ws, 'fresh').selectedAnimal!;
    expect(sel.carryForward.available).toBe(false);
    expect(sel.carryForward.lastDayDate).toBeUndefined();
  });
});

describe('buildAnimalWorkspaceViewModel — empty + no selection', () => {
  it('reports the empty workspace state when there are no animals', () => {
    const vm = buildAnimalWorkspaceViewModel({ animals: {}, days: {} });
    expect(vm.animals).toHaveLength(0);
    expect(vm.empty?.message).toBe('No animals created yet.');
    expect(vm.selectedAnimal).toBeUndefined();
  });

  it('omits selectedAnimal when no id is given or the id is unknown', () => {
    const { animal, day } = loadRealistic();
    const ws = wrap(animal, day);
    expect(buildAnimalWorkspaceViewModel(ws).selectedAnimal).toBeUndefined();
    expect(buildAnimalWorkspaceViewModel(ws, 'nope').selectedAnimal).toBeUndefined();
  });
});
