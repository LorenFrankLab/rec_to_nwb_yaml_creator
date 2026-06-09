/**
 * `resolveDayConfig` reads ntrode `bad_channels` from the DAY OVERRIDE ONLY.
 *
 * After the load-time migration (`migrateBadChannelsToDays`, run by
 * `normalizeWorkspaceDevices`) has moved each config snapshot's base
 * `bad_channels` DOWN into the owning day's `deviceOverrides.bad_channels` and
 * emptied the snapshot bases, the merge resolves each ntrode's `bad_channels`
 * from the day override exclusively — never from the snapshot base. The new
 * per-ntrode rule is: a well-formed array override → use it; anything else
 * (absent key, non-array value, corrupt/absent container) → `[]`.
 *
 * BYTE-IDENTITY GATE (the reason this change is safe):
 * For the corpus of genuine merge outputs that carry base marks — the realistic
 * workspace plus a multi-config animal with per-version base marks — the bytes
 * that the OLD base-reading merge produced on the un-migrated workspace are
 * frozen as committed `.yml` baselines (`./__baselines__/badChannelGate.*.yml`,
 * captured from the pre-change code). This test runs the migration AND the new
 * day-only merge and asserts the export is byte-for-byte identical to those
 * frozen bytes, for every day. This proves the round trip migration→merge-change
 * is export-neutral for well-formed data (the only output that changes is a
 * corrupt-override day, which is export-gated / repair-surfaced elsewhere).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { resolveDayConfig, mergeDayMetadata } from '../workspaceUtils';
import { normalizeWorkspaceDevices } from '../../utils/deviceNormalization';
import { encodeYaml } from '../../io/yaml';
import { buildRealisticWorkspace } from '../../__tests__/fixtures/workspaceBuilders';

const HERE = dirname(fileURLToPath(import.meta.url));
const baseline = (name) =>
  readFileSync(join(HERE, '__baselines__', name), 'utf8');

const TS = '2023-06-22T12:00:00.000Z';

/**
 * A multi-config animal whose TWO snapshots each carry a DIFFERENT base
 * `bad_channels` on ntrode 1 (v1 → [1], v2 → [2]); two days each pinned to one
 * version. Proves both versions' bases are read by the OLD merge (and that the
 * migration materializes each onto its own day).
 *
 * @returns {{ animal: object, days: { d1: object, d2: object } }}
 */
function makeMultiConfig() {
  const mkDevices = (badForOne) => ({
    electrode_groups: [
      { id: 0, location: 'CA1', device_type: 'tetrode_12.5', description: 'g0', targeted_location: 'CA1' },
      { id: 1, location: 'CA1', device_type: 'tetrode_12.5', description: 'g1', targeted_location: 'CA1' },
    ],
    ntrode_electrode_group_channel_map: [
      { ntrode_id: 1, electrode_group_id: 0, bad_channels: badForOne, map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
      { ntrode_id: 2, electrode_group_id: 1, bad_channels: [], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
    ],
  });
  const animal = {
    id: 'a',
    subject: { subject_id: 'a', species: 'Rattus norvegicus', sex: 'M', genotype: 'WT', description: 'd', date_of_birth: '2023-01-01T00:00:00', weight: 400 },
    devices: { data_acq_device: [{ name: 'SpikeGadgets', system: 'SpikeGadgets', amplifier: 'Intan', adc_circuit: 'Intan' }], device: { name: ['Trodes'] }, electrode_groups: [], ntrode_electrode_group_channel_map: [] },
    experimenters: { experimenter_name: ['X, Y'], lab: 'Frank', institution: 'UCSF' },
    cameras: [],
    configurationHistory: [
      { version: 1, date: '2023-06-22', description: 'v1', devices: mkDevices([1]), appliedToDays: [] },
      { version: 2, date: '2023-06-23', description: 'v2', devices: mkDevices([2]), appliedToDays: [] },
    ],
  };
  const mkDay = (id, ver) => ({
    id, animalId: 'a', date: '2023-06-22', experimentDate: '06222023',
    session: { session_id: id, session_description: 'desc', experiment_description: 'exp' },
    tasks: [], behavioral_events: [], associated_files: [], associated_video_files: [],
    technical: { times_period_multiplier: 1.5, raw_data_to_volts: 0.195, default_header_file_path: '', units: undefined },
    state: { draft: true, validated: false, exported: false }, created: TS, lastModified: TS, configurationVersion: ver,
  });
  return { animal, days: { d1: mkDay('d1', 1), d2: mkDay('d2', 2) } };
}

describe('byte-identity gate: migration + day-only merge reproduces the old base-reading bytes', () => {
  it('realistic workspace (snapshot carries base bad_channels) is byte-identical to the frozen old-merge baseline', () => {
    const { animal, day } = buildRealisticWorkspace();

    // Sanity: the realistic snapshot genuinely carries base marks (else vacuous).
    const snap = animal.configurationHistory[0];
    expect(
      snap.devices.ntrode_electrode_group_channel_map.some(
        (n) => Array.isArray(n.bad_channels) && n.bad_channels.length > 0
      )
    ).toBe(true);

    const workspace = { animals: { [animal.id]: animal }, days: { [day.id]: day } };
    const migrated = normalizeWorkspaceDevices(workspace);
    const out = encodeYaml(
      mergeDayMetadata(migrated.animals[animal.id], migrated.days[day.id])
    );

    expect(out).toBe(baseline('badChannelGate.realistic.yml'));
  });

  it('multi-config animal with per-version base marks: every day byte-identical to its frozen old-merge baseline', () => {
    const { animal, days } = makeMultiConfig();

    // Sanity: each version carries a base mark on ntrode 1.
    expect(animal.configurationHistory[0].devices.ntrode_electrode_group_channel_map[0].bad_channels).toEqual([1]);
    expect(animal.configurationHistory[1].devices.ntrode_electrode_group_channel_map[0].bad_channels).toEqual([2]);

    const workspace = { animals: { a: animal }, days: { d1: days.d1, d2: days.d2 } };
    const migrated = normalizeWorkspaceDevices(workspace);

    expect(
      encodeYaml(mergeDayMetadata(migrated.animals.a, migrated.days.d1))
    ).toBe(baseline('badChannelGate.multiConfig.d1.yml'));
    expect(
      encodeYaml(mergeDayMetadata(migrated.animals.a, migrated.days.d2))
    ).toBe(baseline('badChannelGate.multiConfig.d2.yml'));
  });
});

describe('resolveDayConfig reads ntrode bad_channels from the day override ONLY', () => {
  const baseAnimal = () => ({
    id: 'remy',
    configurationHistory: [
      {
        version: 1, date: '2023-06-22', description: 'v1',
        devices: {
          electrode_groups: [{ id: 0, location: 'CA1', device_type: 'tetrode_12.5', description: 'g', targeted_location: 'CA1' }],
          ntrode_electrode_group_channel_map: [
            { ntrode_id: 1, electrode_group_id: 0, bad_channels: [], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
            { ntrode_id: 2, electrode_group_id: 0, bad_channels: [], map: { 0: 4, 1: 5, 2: 6, 3: 7 } },
          ],
        },
        appliedToDays: [],
      },
    ],
  });

  it('a well-formed array override is used for that ntrode; an ntrode with no override is []', () => {
    const day = { id: 'd', configurationVersion: 1, deviceOverrides: { bad_channels: { 1: [1, 2] } } };
    const { ntrode_electrode_group_channel_map: ntrodes } = resolveDayConfig(baseAnimal(), day);

    expect(ntrodes.find((n) => n.ntrode_id === 1).bad_channels).toEqual([1, 2]);
    expect(ntrodes.find((n) => n.ntrode_id === 2).bad_channels).toEqual([]);
  });

  it('IGNORES a non-empty snapshot base when the day has no override for that ntrode (proves base is not read)', () => {
    // Artificially re-add a base mark to the snapshot row that the migration would
    // normally empty — the day carries NO override for it, so the resolved value
    // must be [] (the snapshot base is NOT consulted).
    const animal = baseAnimal();
    animal.configurationHistory[0].devices.ntrode_electrode_group_channel_map[0].bad_channels = [3];
    const day = { id: 'd', configurationVersion: 1, deviceOverrides: { bad_channels: {} } };

    const { ntrode_electrode_group_channel_map: ntrodes } = resolveDayConfig(animal, day);
    expect(ntrodes.find((n) => n.ntrode_id === 1).bad_channels).toEqual([]);
  });

  it('a present NON-array override value resolves to [] (not the snapshot base, not the scalar)', () => {
    const animal = baseAnimal();
    animal.configurationHistory[0].devices.ntrode_electrode_group_channel_map[0].bad_channels = [9];
    const day = { id: 'd', configurationVersion: 1, deviceOverrides: { bad_channels: { 1: '23' } } };

    const { ntrode_electrode_group_channel_map: ntrodes } = resolveDayConfig(animal, day);
    const ntrode1 = ntrodes.find((n) => n.ntrode_id === 1);
    expect(ntrode1.bad_channels).toEqual([]);
    expect(ntrode1.bad_channels).not.toBe('23');
  });

  it('a corrupt non-record override container resolves every ntrode to [] (not the base)', () => {
    const animal = baseAnimal();
    animal.configurationHistory[0].devices.ntrode_electrode_group_channel_map[0].bad_channels = [5];
    const day = { id: 'd', configurationVersion: 1, deviceOverrides: { bad_channels: '2.9' } };

    const { ntrode_electrode_group_channel_map: ntrodes } = resolveDayConfig(animal, day);
    expect(ntrodes.find((n) => n.ntrode_id === 1).bad_channels).toEqual([]);
    expect(ntrodes.find((n) => n.ntrode_id === 2).bad_channels).toEqual([]);
  });

  it('an absent deviceOverrides resolves every ntrode to [] (not the base)', () => {
    const animal = baseAnimal();
    animal.configurationHistory[0].devices.ntrode_electrode_group_channel_map[0].bad_channels = [7];
    const day = { id: 'd', configurationVersion: 1 };

    const { ntrode_electrode_group_channel_map: ntrodes } = resolveDayConfig(animal, day);
    expect(ntrodes.find((n) => n.ntrode_id === 1).bad_channels).toEqual([]);
    expect(ntrodes.find((n) => n.ntrode_id === 2).bad_channels).toEqual([]);
  });

  it('does not mutate the snapshot it resolved from', () => {
    const animal = baseAnimal();
    animal.configurationHistory[0].devices.ntrode_electrode_group_channel_map[0].bad_channels = [4];
    const day = { id: 'd', configurationVersion: 1, deviceOverrides: { bad_channels: { 1: [2] } } };
    resolveDayConfig(animal, day);
    expect(animal.configurationHistory[0].devices.ntrode_electrode_group_channel_map[0].bad_channels).toEqual([4]);
  });
});

describe('resolveDayConfig whole-map override paths still resolve via the day override (unchanged)', () => {
  const animal = {
    id: 'remy',
    configurationHistory: [
      {
        version: 1, date: '2023-06-22', description: 'v1',
        devices: {
          electrode_groups: [{ id: 0, location: 'CA1', device_type: 'tetrode_12.5', description: 'snap g', targeted_location: 'CA1' }],
          ntrode_electrode_group_channel_map: [
            { ntrode_id: 1, electrode_group_id: 0, bad_channels: [], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
          ],
        },
        appliedToDays: [],
      },
    ],
  };

  it('resolves electrode_groups / ntrode_electrode_group_channel_map from the whole-map override when present', () => {
    const day = {
      id: 'd', configurationVersion: 1,
      deviceOverrides: {
        electrode_groups: [{ id: 9, location: 'PFC', device_type: 'tetrode_12.5', description: 'override g', targeted_location: 'PFC' }],
        ntrode_electrode_group_channel_map: [
          { ntrode_id: 5, electrode_group_id: 9, bad_channels: [], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
        ],
      },
    };
    const resolved = resolveDayConfig(animal, day);
    expect(resolved.electrode_groups.map((g) => g.id)).toEqual([9]);
    expect(resolved.ntrode_electrode_group_channel_map.map((n) => n.ntrode_id)).toEqual([5]);
  });
});

describe('resolveDayConfig fails closed (unchanged)', () => {
  it('throws when the animal has no configuration history', () => {
    expect(() => resolveDayConfig({ id: 'a' }, { id: 'd' })).toThrow(/configuration/i);
  });

  it('throws when the day pins a version with no matching snapshot', () => {
    const animal = {
      id: 'a',
      configurationHistory: [
        { version: 1, devices: { electrode_groups: [], ntrode_electrode_group_channel_map: [] } },
      ],
    };
    expect(() => resolveDayConfig(animal, { id: 'd', configurationVersion: 99 })).toThrow(/configuration/i);
  });
});
