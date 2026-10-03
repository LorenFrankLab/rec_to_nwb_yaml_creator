/**
 * Making another recording system the animal's default (W12 follow-up).
 *
 * A day that names no recording system exports the FIRST catalog entry, so reordering the catalog
 * alone would silently move every such day to another system's hardware. `makeDataAcqDeviceDefault`
 * first sets those days to name the current default, then moves the chosen system to the front:
 * every past day exports exactly what it did, and only days created afterwards get the new default.
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { encodeYaml, decodeYaml } from '../../io/yaml';
import { mergeDayMetadata } from '../workspaceUtils';
import { buildRealisticWorkspace } from '../../__tests__/fixtures/workspaceBuilders';
import { useStore } from '../store';
import { planImport } from '../yamlImportPlan';
import { applyImportPlan } from '../yamlImportApply';

const rigA = { name: 'SpikeGadgets', system: 'SpikeGadgets', amplifier: 'Intan', adc_circuit: 'Intan' };
const rigB = { name: 'Rig B', system: 'SpikeGadgets', amplifier: 'Intan RHD2164', adc_circuit: 'Intan RHD2164' };

/**
 * `remy` with one imported day (naming "SpikeGadgets"), Rig B added, and two days created in the
 * app — one left on "Default", one set to Rig B.
 *
 * @returns {object} The `renderHook(useStore)` result.
 */
function setup() {
  const { result } = renderHook(() => useStore());
  const { animal, day } = buildRealisticWorkspace();
  const flatModel = decodeYaml(encodeYaml(mergeDayMetadata(animal, day)));
  const plan = planImport([{ sourceName: '06222023_remy_metadata.yml', flatModel }], result.current.model.workspace);
  act(() => {
    applyImportPlan(plan, result.current.actions, { workspace: result.current.model.workspace });
  });
  act(() => {
    result.current.actions.updateAnimal('remy', { data_acq_device: [rigA, rigB] });
  });
  for (const date of ['2023-06-23', '2023-06-24']) {
    act(() => {
      result.current.actions.createDay('remy', date, {
        session_id: `remy_${date.replace(/-/g, '')}`,
        session_description: 'In-app day',
      });
    });
  }
  act(() => {
    result.current.actions.updateDay('remy-2023-06-24', { data_acq_device_name: 'Rig B' });
  });
  return result;
}

/**
 * Every day's encoded export, by day id.
 *
 * @param {object} result - The `renderHook(useStore)` result.
 * @returns {Record<string, string>} The YAML of each day.
 */
function exports(result) {
  const ws = result.current.model.workspace;
  return Object.fromEntries(
    ws.animals.remy.days.map((dayId) => [dayId, encodeYaml(mergeDayMetadata(ws.animals.remy, ws.days[dayId]))])
  );
}

describe('making another recording system the default (W12 follow-up)', () => {
  it('leaves every past day\'s export byte-identical, and new days get the new default', () => {
    const result = setup();
    const before = exports(result);
    expect(result.current.model.workspace.days['remy-2023-06-23'].data_acq_device_name).toBeUndefined();
    expect(before['remy-2023-06-23']).toMatch(/amplifier: Intan\n/);

    act(() => {
      result.current.actions.makeDataAcqDeviceDefault('remy', 'Rig B');
    });

    const ws = result.current.model.workspace;
    expect(ws.animals.remy.devices.data_acq_device).toEqual([rigB, rigA]);
    expect(exports(result)).toEqual(before);
    // The day that relied on the old default now names it.
    expect(ws.days['remy-2023-06-23'].data_acq_device_name).toBe('SpikeGadgets');

    act(() => {
      result.current.actions.createDay('remy', '2023-06-25', {
        session_id: 'remy_20230625',
        session_description: 'Next day',
      });
    });
    const next = result.current.model.workspace;
    expect(mergeDayMetadata(next.animals.remy, next.days['remy-2023-06-25']).data_acq_device).toEqual([rigB]);
  });

  it('changes nothing for the system that is already the default, or a name not in the catalog', () => {
    const result = setup();
    const workspace = result.current.model.workspace;
    for (const name of ['SpikeGadgets', 'Rig C']) {
      act(() => {
        result.current.actions.makeDataAcqDeviceDefault('remy', name);
      });
      expect(result.current.model.workspace).toBe(workspace);
    }
  });
});
