/**
 * Tests for ElectrodeGroupsContainer — the extracted electrode-group wiring (Phase 3-1).
 *
 * This container holds real, data-dangerous logic that — before this suite — was pinned ONLY by the
 * legacy AnimalEditorStepper test suite (which Phase 5 deletes). These tests re-pin that logic
 * directly against the REAL container + a live store (no mocks), so the behavior survives the
 * stepper's removal:
 *   1. bulk-add (the count loop + sequential ids + per-group channel-map generation + success toast),
 *   2. electrode-group delete → channel-map CASCADE (the group's ntrode maps are removed with it),
 *   3. next-electrode-group-id generation (max existing id + 1, gaps tolerated),
 *   4. copy-from-animal append + re-normalize + toast.
 *
 * The crown-jewel device_type→channel-map REGEN is already pinned via AnimalView.ephysTabs + the
 * channelMapUtils unit suite; this file covers the four behaviors those don't.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StoreProvider, useStoreContext } from '../../../../state/StoreContext';
import ElectrodeGroupsContainer from '../ElectrodeGroupsContainer';

/**
 * One configured tetrode group (id 0) + its ntrode map.
 * @param id
 * @param location
 */
function group(id, location = 'CA1') {
  return {
    id,
    device_type: 'tetrode_12.5',
    location,
    description: `${location} tetrode`,
    targeted_location: location,
    targeted_x: 1,
    targeted_y: 2,
    targeted_z: 3,
    units: 'mm',
  };
}
/**
 *
 * @param ntrodeId
 * @param groupId
 */
function ntrode(ntrodeId, groupId) {
  return { ntrode_id: ntrodeId, electrode_group_id: groupId, bad_channels: [], map: { 0: 0, 1: 1, 2: 2, 3: 3 } };
}

/**
 * Build an animal with the given electrode groups + matching 1:1 ntrode maps.
 * @param {Array} groups - Electrode groups.
 * @param {string} [id] - The animal id / subject_id.
 * @returns {object} An animal record.
 */
function buildAnimal(groups, id = 'remy') {
  return {
    id,
    subject: { subject_id: id, species: 'Rattus norvegicus', sex: 'M' },
    devices: {
      electrode_groups: groups,
      ntrode_electrode_group_channel_map: groups.map((g, i) => ntrode(i + 1, g.id)),
      data_acq_device: [],
    },
    cameras: [],
    configurationHistory: [
      { version: 1, date: '2023-06-22', description: 'Initial', devices: { electrode_groups: groups, ntrode_electrode_group_channel_map: [] }, appliedToDays: [] },
    ],
    days: [],
  };
}

/** Live-store probe: exposes remy's electrode groups + ntrode maps for assertions. */
function Probe() {
  const { model } = useStoreContext();
  const d = model.workspace.animals.remy?.devices || {};
  return (
    <>
      <pre data-testid="groups">{JSON.stringify(d.electrode_groups || [])}</pre>
      <pre data-testid="maps">{JSON.stringify(d.ntrode_electrode_group_channel_map || [])}</pre>
    </>
  );
}
const groups = () => JSON.parse(screen.getByTestId('groups').textContent);
const maps = () => JSON.parse(screen.getByTestId('maps').textContent);

/**
 * Render the real container for remy against a seeded store + probe.
 * @param {object} animals - workspace.animals.
 * @returns {object} render result
 */
function renderContainer(animals) {
  return render(
    <StoreProvider initialState={{ workspace: { animals, days: {}, settings: {} } }}>
      <ElectrodeGroupsContainer animalId="remy" />
      <Probe />
    </StoreProvider>
  );
}

/**
 * Fill the add-modal's required fields (device type, targeted location, coordinates) + optional count.
 * @param {object} user - userEvent session.
 * @param {number} [count] - Bulk count to set.
 */
async function fillAddModal(user, count) {
  await user.selectOptions(screen.getByLabelText(/device type/i), 'tetrode_12.5');
  await user.type(screen.getByLabelText(/targeted location/i), 'CA1');
  await user.type(screen.getByLabelText(/AP \(Anterior-Posterior\)/i), '1');
  await user.type(screen.getByLabelText(/ML \(Medial-Lateral\)/i), '2');
  await user.type(screen.getByLabelText(/DV \(Dorsal-Ventral\)/i), '3');
  if (count != null) {
    const countField = screen.getByLabelText(/number of electrode groups/i);
    await user.clear(countField);
    await user.type(countField, String(count));
  }
  await user.click(screen.getByRole('button', { name: /save electrode group configuration/i }));
}

let originalHash;
beforeEach(() => {
  originalHash = window.location.hash;
});
afterEach(() => {
  window.location.hash = originalHash;
});

describe('ElectrodeGroupsContainer — bulk add', () => {
  it('creates N sequential groups with per-group channel maps and a success toast', async () => {
    const user = userEvent.setup();
    renderContainer({ remy: buildAnimal([group(0)]) }); // start with one group (id 0) + 1 map

    await user.click(screen.getByRole('button', { name: /add electrode group/i }));
    await fillAddModal(user, 3);

    // 1 existing + 3 new = 4 groups, ids sequential after the existing max (0 → 1,2,3).
    const g = groups();
    expect(g).toHaveLength(4);
    expect(g.map((x) => x.id)).toEqual([0, 1, 2, 3]);
    // The existing group-0 map is retained and one tetrode map is generated per new group → 4 total.
    expect(maps()).toHaveLength(4);
    // The bulk-create success toast is shown.
    expect(screen.getByText(/successfully created 3 identical electrode groups/i)).toBeInTheDocument();
  });
});

describe('ElectrodeGroupsContainer — next-id generation', () => {
  it('assigns the next id as max(existing) + 1, tolerating gaps', async () => {
    const user = userEvent.setup();
    // Non-contiguous ids 0 and 2 → the next single add must be id 3 (max 2 + 1), not 1 or 0.
    renderContainer({ remy: buildAnimal([group(0), { ...group(2), id: 2 }]) });

    await user.click(screen.getByRole('button', { name: /add electrode group/i }));
    await fillAddModal(user); // single add (no count)

    const ids = groups().map((x) => x.id);
    expect(ids).toEqual([0, 2, 3]);
  });
});

describe('ElectrodeGroupsContainer — delete cascade', () => {
  it('removes a deleted group AND its channel maps, keeping the sibling group + maps', async () => {
    const user = userEvent.setup();
    renderContainer({ remy: buildAnimal([group(0), { ...group(1), id: 1 }]) });
    expect(groups()).toHaveLength(2);
    expect(maps()).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: /delete electrode group 0/i }));
    // Destructive confirm, then confirm.
    const dialog = screen.getByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: /^delete$/i }));

    // Group 0 and its map are gone; group 1 and its map remain.
    expect(groups().map((x) => x.id)).toEqual([1]);
    const m = maps();
    expect(m).toHaveLength(1);
    expect(String(m[0].electrode_group_id)).toBe('1');
  });
});

describe('ElectrodeGroupsContainer — copy from animal', () => {
  it('appends the source animal\'s groups (re-normalized) + maps and shows a toast', async () => {
    const user = userEvent.setup();
    const animals = {
      remy: buildAnimal([group(0)]),
      totoro: buildAnimal([group(0, 'CA3'), { ...group(1, 'CA3'), id: 1 }], 'totoro'),
    };
    renderContainer(animals);
    expect(groups()).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: /copy from (existing )?animal/i }));
    // Pick totoro (2 groups) as the source, then copy.
    await user.click(screen.getByRole('radio', { name: /totoro/i }));
    await user.click(screen.getByRole('button', { name: /^copy$/i }));

    // remy's 1 group + totoro's 2 = 3 groups, ids re-normalized to a contiguous 0..2.
    const g = groups();
    expect(g).toHaveLength(3);
    expect(g.map((x) => x.id)).toEqual([0, 1, 2]);
    expect(screen.getByText(/successfully copied 2 electrode groups from totoro/i)).toBeInTheDocument();
  });
});
