/**
 * Recording systems (`data_acq_device`) on import: each imported day exports the hardware its own
 * file recorded (W5).
 *
 * A day references its recording system by NAME, and the export resolves that name in the animal's
 * catalog. Two files (or a file and the existing animal) that give one name different hardware
 * describe two recording systems, so merging them by name made a later day export another day's
 * amplifier and ADC. Like a recalibrated camera, the later hardware is kept as its own catalog entry
 * named with the date it was first recorded, and its days reference that entry. The difference is
 * listed for review, never merged silently.
 *
 * Drives the real store: (Import & Repair) → `planImport` → `applyImportPlan` → export.
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { encodeYaml, decodeYaml } from '../../io/yaml';
import { mergeDayMetadata } from '../workspaceUtils';
import { buildRealisticWorkspace } from '../../__tests__/fixtures/workspaceBuilders';
import { useStore } from '../store';
import { planImport } from '../yamlImportPlan';
import { applyImportPlan } from '../yamlImportApply';
import { buildImportRepairPlan, applyImportRepairs } from '../importRepair';

/**
 * A genuine app export (flat YAML model) of `remy` on `date`, built from the realistic fixture
 * (recording system "SpikeGadgets": SpikeGadgets / Intan / Intan).
 *
 * @param {object} [options]
 * @param {string} [options.date] - ISO recording date.
 * @param {Function} [options.mutate] - Mutates the fixture animal/day before the export.
 * @returns {{ sourceName: string, flatModel: object }} The decoded file.
 */
function makeFile({ date = '2023-06-22', mutate } = {}) {
  const { animal, day } = buildRealisticWorkspace();
  day.id = `remy-${date}`;
  day.date = date;
  day.session = { ...day.session, session_id: `remy_${date.replace(/-/g, '')}` };
  if (mutate) mutate(animal, day);
  const [y, m, d] = date.split('-');
  return {
    sourceName: `${m}${d}${y}_remy_metadata.yml`,
    flatModel: decodeYaml(encodeYaml(mergeDayMetadata(animal, day))),
  };
}

/**
 * The same system name with a different amplifier and ADC.
 * @param {object} animal - The fixture animal (catalog rewritten).
 */
const otherAmplifier = (animal) => {
  animal.devices.data_acq_device = [
    { name: 'SpikeGadgets', system: 'SpikeGadgets', amplifier: 'Intan RHD2164', adc_circuit: 'Intan RHD2164' },
  ];
};

/**
 * Plan and commit files in one batch (Add when the animal exists).
 *
 * @param {object} result - The `renderHook(useStore)` result.
 * @param {Array<{ sourceName: string, flatModel: object }>} files - The decoded files.
 * @returns {object} The committed plan.
 */
function commit(result, files) {
  const plan = planImport(files, result.current.model.workspace);
  const existing = plan.animals[0].conflict === 'exists';
  act(() => {
    applyImportPlan(plan, result.current.actions, {
      workspace: result.current.model.workspace,
      ...(existing
        ? { resolutions: { remy: 'add' }, catalogAdditions: { remy: plan.animals[0].catalogAdditions } }
        : {}),
    });
  });
  return plan;
}

/**
 * The exported recording systems of `remy` on `date`.
 *
 * @param {object} result - The `renderHook(useStore)` result.
 * @param {string} date - ISO recording date.
 * @returns {object[]} The day's exported `data_acq_device`.
 */
function exportedSystems(result, date) {
  const ws = result.current.model.workspace;
  return mergeDayMetadata(ws.animals.remy, ws.days[`remy-${date}`]).data_acq_device;
}

describe('a recording system with the same name but other hardware is its own system (W5)', () => {
  it('batch: the 06-23 day exports its own file\'s amplifier, not the 06-22 file\'s', () => {
    const { result } = renderHook(() => useStore());
    const plan = commit(result, [makeFile({ date: '2023-06-22' }), makeFile({ date: '2023-06-23', mutate: otherAmplifier })]);

    expect(exportedSystems(result, '2023-06-22')).toEqual([
      { name: 'SpikeGadgets', system: 'SpikeGadgets', amplifier: 'Intan', adc_circuit: 'Intan' },
    ]);
    expect(exportedSystems(result, '2023-06-23')).toEqual([
      { name: 'SpikeGadgets_20230623', system: 'SpikeGadgets', amplifier: 'Intan RHD2164', adc_circuit: 'Intan RHD2164' },
    ]);
    expect(result.current.model.workspace.animals.remy.devices.data_acq_device.map((d) => d.name)).toEqual([
      'SpikeGadgets',
      'SpikeGadgets_20230623',
    ]);
    const note = plan.animals[0].divergences.find((d) => d.field === 'data_acq_device');
    expect(note.detail).toMatch(/"SpikeGadgets" differs across files in: amplifier, adc_circuit/);
    expect(note.detail).toMatch(/SpikeGadgets_20230623/);
  });

  it('add: a file whose system differs from the animal\'s keeps its own hardware, and says so', () => {
    const { result } = renderHook(() => useStore());
    commit(result, [makeFile({ date: '2023-06-22' })]);
    const plan = commit(result, [makeFile({ date: '2023-06-23', mutate: otherAmplifier })]);

    const note = plan.animals[0].divergences.find((d) => d.field === 'data_acq_device');
    expect(note).toMatchObject({ scope: 'add' });
    expect(note.detail).toMatch(/differs from the animal's/);
    expect(note.detail).toMatch(/amplifier, adc_circuit/);
    expect(exportedSystems(result, '2023-06-23')[0]).toMatchObject({ amplifier: 'Intan RHD2164', adc_circuit: 'Intan RHD2164' });
    // The animal's own system — and the day that used it — are untouched.
    expect(exportedSystems(result, '2023-06-22')[0]).toMatchObject({ name: 'SpikeGadgets', amplifier: 'Intan' });
  });

  it('add: a later file with hardware the animal already holds under a dated name reuses that entry', () => {
    const { result } = renderHook(() => useStore());
    commit(result, [makeFile({ date: '2023-06-22' }), makeFile({ date: '2023-06-23', mutate: otherAmplifier })]);
    const plan = commit(result, [makeFile({ date: '2023-06-24', mutate: otherAmplifier })]);

    expect(plan.animals[0].catalogAdditions.data_acq_device).toEqual([]);
    expect(plan.animals[0].divergences.filter((d) => d.field === 'data_acq_device')).toEqual([]);
    expect(exportedSystems(result, '2023-06-24')[0].name).toBe('SpikeGadgets_20230623');
    expect(result.current.model.workspace.animals.remy.devices.data_acq_device).toHaveLength(2);
  });

  it('add: a recording system the user mapped onto the animal\'s keeps the day on the animal\'s hardware', () => {
    const { result } = renderHook(() => useStore());
    commit(result, [makeFile({ date: '2023-06-22' })]);
    const file = makeFile({
      date: '2023-06-23',
      mutate: (animal) => {
        animal.devices.data_acq_device = [
          { name: 'Rig B', system: 'SpikeGadgets', amplifier: 'Intan RHD2164', adc_circuit: 'Intan RHD2164' },
        ];
      },
    });
    const ws = result.current.model.workspace;
    const repairPlan = buildImportRepairPlan(file.flatModel, file.sourceName, ws);
    const row = repairPlan.items.find((item) => item.code === 'existing_animal_missing_data_acq_device');
    const repaired = applyImportRepairs(file.flatModel, { [row.path]: 'SpikeGadgets' });
    commit(result, [{ sourceName: file.sourceName, flatModel: repaired }]);

    expect(exportedSystems(result, '2023-06-23')).toEqual([
      { name: 'SpikeGadgets', system: 'SpikeGadgets', amplifier: 'Intan', adc_circuit: 'Intan' },
    ]);
    expect(result.current.model.workspace.animals.remy.devices.data_acq_device).toHaveLength(1);
  });

  it('replace: files that agree among themselves keep their own system name and hardware', () => {
    const { result } = renderHook(() => useStore());
    commit(result, [makeFile({ date: '2023-06-22' })]);
    const files = [
      makeFile({ date: '2023-06-22', mutate: otherAmplifier }),
      makeFile({ date: '2023-06-23', mutate: otherAmplifier }),
    ];
    const plan = planImport(files, result.current.model.workspace);
    expect(plan.animals[0].devices.data_acq_device).toEqual([
      { name: 'SpikeGadgets', system: 'SpikeGadgets', amplifier: 'Intan RHD2164', adc_circuit: 'Intan RHD2164' },
    ]);
    act(() => {
      applyImportPlan(plan, result.current.actions, {
        workspace: result.current.model.workspace,
        resolutions: { remy: 'replace' },
      });
    });
    for (const date of ['2023-06-22', '2023-06-23']) {
      expect(exportedSystems(result, date)).toEqual(plan.animals[0].devices.data_acq_device);
    }
  });
});
