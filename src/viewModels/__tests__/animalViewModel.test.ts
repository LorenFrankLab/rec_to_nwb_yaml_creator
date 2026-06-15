/**
 * Parity tests for buildAnimalViewModel.
 *
 * The builder must reproduce what the tabbed AnimalView shell renders today (src/pages/AnimalView).
 * Each assertion recomputes the page's truth from the same domain functions the component calls
 * (`getAnimalBlockingSections` + `getAnimalSectionStatus` for the per-tab status ring with blocking
 * outranking todo, `getPresentDayCount` for the Recording Days count, `buildAnimalRows`
 * filtered to the valid chip for the "N ready" Validation & Export count, `getAnimalSubject` for the
 * header facts), then asserts the view-model reproduces it — so a divergence fails.
 */
import { describe, it, expect } from 'vitest';
import { buildAnimalViewModel } from '../animalViewModel';
import { getPresentDayCount } from '../../domain/dayRecovery';
import {
  getAnimalSectionStatus,
  getAnimalBlockingSections,
  SECTION_STATUS,
} from '../../domain/sectionStatus';
import { buildAnimalRows } from '../validationSummaryRows';
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

/** Deep-clone a JSON-safe fixture (the realistic fixture is plain data). */
function clone<T>(value: T): T {
  return structuredClone(value);
}

describe('buildAnimalViewModel — groups / order', () => {
  it('reproduces the grouped section-nav: labels, tab keys, and display order', () => {
    const { animal, day } = loadRealistic();
    const vm = buildAnimalViewModel(wrap(animal, day), animal.id, 'days');

    expect(vm.groups.map((g) => g.label)).toEqual(['Day work', 'Animal setup']);
    expect(vm.groups[0].sections.map((s) => s.key)).toEqual(['days', 'export']);
    expect(vm.groups[1].sections.map((s) => s.key)).toEqual([
      'electrode-groups',
      'recording-system',
      'cameras',
      'task-types',
      'optogenetics',
    ]);

    // Labels match the page's TAB_LABEL.
    const byKey = Object.fromEntries(
      vm.groups.flatMap((g) => g.sections).map((s) => [s.key, s])
    );
    expect(byKey.days.label).toBe('Recording Days');
    expect(byKey.export.label).toBe('Validation & Export');
    expect(byKey['electrode-groups'].label).toBe('Electrode Groups');
    expect(byKey['recording-system'].label).toBe('Recording System');
    expect(byKey.cameras.label).toBe('Cameras');
    expect(byKey['task-types'].label).toBe('Task Types');
    expect(byKey.optogenetics.label).toBe('Optogenetics');
  });

  it('every section links to its tab route', () => {
    const { animal, day } = loadRealistic();
    const vm = buildAnimalViewModel(wrap(animal, day), animal.id, 'days');
    for (const section of vm.groups.flatMap((g) => g.sections)) {
      expect(section.action?.href).toBe(`#/animal/${animal.id}/${section.key}`);
    }
  });
});

describe('buildAnimalViewModel — status rings', () => {
  /** Recompute the page ring (blocking outranks todo) independently from the domain functions. */
  function expectedStatus(
    animal: unknown,
    days: Record<string, unknown>,
    key: string
  ): 'error' | 'todo' | 'ready' {
    const blocking = getAnimalBlockingSections(animal as never, days as never);
    const isBlocking = blocking.has(key);
    const isTodo =
      !isBlocking && getAnimalSectionStatus(animal as never, key) === SECTION_STATUS.TODO;
    return isBlocking ? 'error' : isTodo ? 'todo' : 'ready';
  }

  it('a configured / under-configured animal yields the right status per tab', () => {
    const { animal, day } = loadRealistic();
    const ws = wrap(animal, day);
    const vm = buildAnimalViewModel(ws, animal.id, 'days');
    const sections = vm.groups.flatMap((g) => g.sections);

    for (const section of sections) {
      expect(section.status).toBe(expectedStatus(animal, ws.days, section.key));
    }

    // Concrete reads for this fixture: day-work sections are never todo (no setup status); the
    // recording system + cameras are configured on the animal record (ready); electrode groups live
    // in configurationHistory (not animal.devices) so they read under-configured (todo); opto is
    // never configured (todo).
    const byKey = Object.fromEntries(sections.map((s) => [s.key, s]));
    expect(byKey.days.status).toBe('ready');
    expect(byKey.export.status).toBe('ready');
    expect(byKey['electrode-groups'].status).toBe('todo');
    expect(byKey['recording-system'].status).toBe('ready');
    expect(byKey.cameras.status).toBe('ready');
    expect(byKey['task-types'].status).toBe('ready'); // task-types has no setup todo predicate
    expect(byKey.optogenetics.status).toBe('todo');
  });

  it('a blocking-section animal reads error and announces "blocks export" — blocking outranks todo', () => {
    const { animal, day } = loadRealistic();
    // An empty electrode-group location is an export-blocking error attributed to electrode-groups.
    const blockingAnimal = clone(animal);
    (blockingAnimal as Idable & {
      configurationHistory: Array<{ devices: { electrode_groups: Array<{ location: string }> } }>;
    }).configurationHistory[0].devices.electrode_groups[0].location = '';
    const ws = wrap(blockingAnimal, day);

    const vm = buildAnimalViewModel(ws, blockingAnimal.id, 'days');
    const byKey = Object.fromEntries(
      vm.groups.flatMap((g) => g.sections).map((s) => [s.key, s])
    );

    // electrode-groups would be `todo` (configurationHistory-only), but the blocking error outranks it.
    expect(getAnimalSectionStatus(blockingAnimal as never, 'electrode-groups')).toBe(
      SECTION_STATUS.TODO
    );
    expect(getAnimalBlockingSections(blockingAnimal as never, ws.days as never).has('electrode-groups')).toBe(
      true
    );
    expect(byKey['electrode-groups'].status).toBe('error');
    expect(byKey['electrode-groups'].summary).toBe('Electrode Groups — blocks export');
    // A blocking section keeps its count visible (the ● shows alongside the count).
    expect(byKey['electrode-groups'].showCount).toBe(true);

    // A clean sibling setup tab is not marked blocking.
    expect(byKey.cameras.status).toBe('ready');
    expect(byKey.cameras.summary).toBe('Cameras');
  });

  it('a never-configured (fresh) animal reads every setup tab as todo and hides their counts', () => {
    const ws: Workspace = {
      animals: { fresh: { id: 'fresh', days: [], subject: { subject_id: 'fresh' } } },
      days: {},
    };
    const vm = buildAnimalViewModel(ws, 'fresh', 'days');
    const byKey = Object.fromEntries(
      vm.groups.flatMap((g) => g.sections).map((s) => [s.key, s])
    );

    // The setup tabs that carry a configured-predicate read todo; task-types has none → ready.
    for (const key of ['electrode-groups', 'recording-system', 'cameras', 'optogenetics']) {
      expect(byKey[key].status).toBe('todo');
      expect(byKey[key].summary).toBe(`${byKey[key].label} — not set up`);
      // A todo section hides its count (the hollow-○ ring owns the slot).
      expect(byKey[key].showCount).toBe(false);
    }
  });
});

describe('buildAnimalViewModel — counts', () => {
  it('reproduces the Recording Days count and the "N ready" export count', () => {
    const { animal, day } = loadRealistic();
    const ws = wrap(animal, day);
    const vm = buildAnimalViewModel(ws, animal.id, 'days');
    const byKey = Object.fromEntries(
      vm.groups.flatMap((g) => g.sections).map((s) => [s.key, s])
    );

    const expectedDays = String(getPresentDayCount(animal.id, animal, ws.days));
    const expectedReady = `${buildAnimalRows(ws, animal.id).filter((r) => r.chip === 'valid').length} ready`;

    expect(byKey.days.countLabel).toBe(expectedDays);
    expect(byKey.days.issueCount).toBe(Number(expectedDays));
    expect(byKey.export.countLabel).toBe(expectedReady);

    // Concrete values for the realistic single-valid-day fixture.
    expect(byKey.days.countLabel).toBe('1');
    expect(byKey.export.countLabel).toBe('1 ready');
  });

  it('reproduces the setup-section item counts', () => {
    const { animal, day } = loadRealistic();
    const vm = buildAnimalViewModel(wrap(animal, day), animal.id, 'days');
    const byKey = Object.fromEntries(
      vm.groups.flatMap((g) => g.sections).map((s) => [s.key, s])
    );
    // recording-system has one data_acq_device; cameras has two; electrode groups are in history (0).
    expect(byKey['recording-system'].countLabel).toBe('1');
    expect(byKey.cameras.countLabel).toBe('2');
    expect(byKey['electrode-groups'].countLabel).toBe('0');
  });

  it('optogenetics: COMPLETE → "used" (shown); NONE → "incomplete" token but count hidden (todo)', () => {
    const { animal, day } = loadRealistic();

    // NONE: the realistic animal never configured opto → todo ring, count hidden.
    const vmNone = buildAnimalViewModel(wrap(animal, day), animal.id, 'days');
    const optoNone = vmNone.groups
      .flatMap((g) => g.sections)
      .find((s) => s.key === 'optogenetics')!;
    expect(optoNone.status).toBe('todo');
    expect(optoNone.showCount).toBe(false);
    expect(optoNone.countLabel).toBe('incomplete');

    // COMPLETE: all four export-gated opto fields present (the four-field presence gate) → "used"
    // token, count shown (not a todo). The status still follows the domain truth (a blocking opto
    // error, if any, outranks — verified independently below) rather than a hard-coded value.
    const completeAnimal = clone(animal) as Idable & { optogenetics: Record<string, unknown> };
    completeAnimal.optogenetics = {
      opto_excitation_source: [{ name: 'laser' }],
      optical_fiber: [{ name: 'fiber' }],
      virus_injection: [{ name: 'virus' }],
      optogenetic_stimulation_software: 'FsGUI',
    };
    const wsComplete = wrap(completeAnimal, day);
    const vmComplete = buildAnimalViewModel(wsComplete, completeAnimal.id, 'days');
    const optoComplete = vmComplete.groups
      .flatMap((g) => g.sections)
      .find((s) => s.key === 'optogenetics')!;
    // A COMPLETE opto is not a todo → its count token shows; the token reads "used".
    expect(optoComplete.showCount).toBe(true);
    expect(optoComplete.countLabel).toBe('used');
    // The status maps the domain ring (blocking outranks not-todo).
    const optoBlocking = getAnimalBlockingSections(
      completeAnimal as never,
      wsComplete.days as never
    ).has('optogenetics');
    expect(optoComplete.status).toBe(optoBlocking ? 'error' : 'ready');
  });

  it('optogenetics: PARTIAL → blocking error ring with the "incomplete" count shown', () => {
    // One-of-four opto fields present → PARTIAL, which the export gate blocks (the page's headline
    // opto-count regression: a partial config must read "● incomplete", never "used" or a hidden todo).
    const { animal, day } = loadRealistic();
    const partial = clone(animal) as Idable & { optogenetics: Record<string, unknown> };
    partial.optogenetics = {
      opto_excitation_source: [{ name: 'laser_473' }],
      optical_fiber: [],
      virus_injection: [],
    };
    const ws = wrap(partial, day);
    // Independent recompute: a partial opto is export-blocking.
    expect(getAnimalBlockingSections(partial as never, ws.days as never).has('optogenetics')).toBe(true);

    const opto = buildAnimalViewModel(ws, partial.id, 'days')
      .groups.flatMap((g) => g.sections)
      .find((s) => s.key === 'optogenetics')!;
    expect(opto.status).toBe('error');
    expect(opto.showCount).toBe(true);
    expect(opto.countLabel).toBe('incomplete');
  });
});

describe('buildAnimalViewModel — header', () => {
  it('exposes the animal id + species/sex facts from the subject', () => {
    const { animal, day } = loadRealistic();
    const vm = buildAnimalViewModel(wrap(animal, day), animal.id, 'days');
    expect(vm.header.id).toBe('remy');
    expect(vm.header.speciesLabel).toBe('Rattus norvegicus');
    expect(vm.header.sexLabel).toBe('M');
  });

  it('omits species/sex labels when the subject lacks them', () => {
    const ws: Workspace = {
      animals: { fresh: { id: 'fresh', days: [], subject: { subject_id: 'fresh' } } },
      days: {},
    };
    const vm = buildAnimalViewModel(ws, 'fresh', 'days');
    expect(vm.header.id).toBe('fresh');
    expect(vm.header.speciesLabel).toBeUndefined();
    expect(vm.header.sexLabel).toBeUndefined();
  });
});

describe('buildAnimalViewModel — active tab + panel', () => {
  it('sets activeTab + activePanel for a known tab, including the scope subhead', () => {
    const { animal, day } = loadRealistic();
    const vm = buildAnimalViewModel(wrap(animal, day), animal.id, 'cameras');
    expect(vm.activeTab).toBe('cameras');
    expect(vm.activePanel).toEqual({
      key: 'cameras',
      label: 'Cameras',
      scope: 'Catalog — referenced per day.',
    });
  });

  it('a tab with no scope sentence omits the scope', () => {
    const { animal, day } = loadRealistic();
    const vm = buildAnimalViewModel(wrap(animal, day), animal.id, 'days');
    expect(vm.activeTab).toBe('days');
    expect(vm.activePanel.key).toBe('days');
    expect(vm.activePanel.label).toBe('Recording Days');
    expect(vm.activePanel.scope).toBeUndefined();
  });

  it('an unknown tab falls back to days, as the route does', () => {
    const { animal, day } = loadRealistic();
    const vm = buildAnimalViewModel(wrap(animal, day), animal.id, 'banana');
    expect(vm.activeTab).toBe('days');
    expect(vm.activePanel.key).toBe('days');
    expect(vm.activePanel.label).toBe('Recording Days');
  });
});

describe('buildAnimalViewModel — missing animal', () => {
  it('returns an id-only header + empty groups, with the active tab still resolved', () => {
    const vm = buildAnimalViewModel({ animals: {}, days: {} }, 'ghost', 'cameras');
    expect(vm.header).toEqual({ id: 'ghost' });
    expect(vm.groups).toEqual([]);
    expect(vm.activeTab).toBe('cameras');
    expect(vm.activePanel.key).toBe('cameras');
  });

  it('resolves an unknown tab to days even when the animal is missing', () => {
    const vm = buildAnimalViewModel({ animals: {}, days: {} }, 'ghost', 'banana');
    expect(vm.activeTab).toBe('days');
  });
});
