/**
 * Unit tests for buildAnimalRows — the animal-scoped slice of buildRows (Phase 3-5).
 *
 * The per-animal Validation & Export tab must show ONLY one animal's days, with the SAME readiness
 * chips the workspace-global Validation Summary computes — a FILTER over buildRows, never a parallel
 * validation path. These pin that: buildAnimalRows(ws, key) === buildRows(ws) restricted to `key`.
 */

import { describe, it, expect } from 'vitest';
import { buildRows, buildAnimalRows } from '../index';

/**
 * A two-animal workspace, each with one recording day.
 * @returns {object} A workspace ({ animals, days }).
 */
function buildWorkspace() {
  const mkAnimal = (id) => ({
    id,
    subject: { subject_id: id, species: 'Rattus norvegicus', sex: 'M' },
    devices: { electrode_groups: [], ntrode_electrode_group_channel_map: [], data_acq_device: [] },
    cameras: [],
    configurationHistory: [{ version: 1, date: '2023-06-22', description: 'i', devices: { electrode_groups: [], ntrode_electrode_group_channel_map: [] }, appliedToDays: [] }],
    days: [`${id}-2023-06-22`],
  });
  const mkDay = (id) => ({
    id: `${id}-2023-06-22`,
    animalId: id,
    date: '2023-06-22',
    experimentDate: '06222023',
    session: { session_id: `${id}_20230622` },
    state: { draft: true },
  });
  return {
    animals: { remy: mkAnimal('remy'), bond: mkAnimal('bond') },
    days: { 'remy-2023-06-22': mkDay('remy'), 'bond-2023-06-22': mkDay('bond') },
  };
}

describe('buildAnimalRows', () => {
  it('returns ONLY the named animal\'s rows', () => {
    const ws = buildWorkspace();
    const rows = buildAnimalRows(ws, 'remy');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.animalKey === 'remy')).toBe(true);
    expect(rows.some((r) => r.animalKey === 'bond')).toBe(false);
  });

  it('matches the unscoped buildRows chips for the same days (no re-derivation drift)', () => {
    const ws = buildWorkspace();
    const all = buildRows(ws);
    const scoped = buildAnimalRows(ws, 'remy');
    const expected = all.filter((r) => r.animalKey === 'remy');
    expect(scoped.map((r) => r.day.id)).toEqual(expected.map((r) => r.day.id));
    expect(scoped.map((r) => r.chip)).toEqual(expected.map((r) => r.chip));
  });

  it('returns an empty array for an animal with no days (no index entries and no owned records)', () => {
    const ws = buildWorkspace();
    ws.animals.remy.days = [];
    delete ws.days['remy-2023-06-22']; // also drop the record, else it surfaces as recovered-unlinked
    expect(buildAnimalRows(ws, 'remy')).toEqual([]);
  });
});
