/**
 * @vitest-environment jsdom
 *
 * CopyFromAnimalDialog renders through the shared Modal primitive, which owns the
 * open/closed gating. These tests pin the open vs closed contract directly (the
 * `open={false}` path used to be a local `if (!open) return null` guard).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CopyFromAnimalDialog from '../CopyFromAnimalDialog';

const animals = {
  remy: { subject: { subject_id: 'remy' }, devices: { electrode_groups: [], ntrode_electrode_group_channel_map: [] } },
  bean: {
    subject: { subject_id: 'bean' },
    devices: {
      electrode_groups: [{ id: '0', device_type: 'tetrode_12.5', location: 'CA1' }],
      ntrode_electrode_group_channel_map: [],
    },
  },
};

describe('CopyFromAnimalDialog', () => {
  it('renders nothing when closed', () => {
    render(
      <CopyFromAnimalDialog
        open={false}
        currentAnimalId="remy"
        animals={animals}
        onCopy={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders an aria-modal dialog listing copyable source animals when open', () => {
    render(
      <CopyFromAnimalDialog
        open
        currentAnimalId="remy"
        animals={animals}
        onCopy={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    // With all sections offerable by default, the dialog uses the generic title.
    const dialog = screen.getByRole('dialog', { name: /copy from animal/i });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    // The other animal (bean, which has groups) is offered as a source.
    expect(screen.getByRole('radio', { name: /bean/i })).toBeInTheDocument();
  });

  it('copies groups and channel maps with integer IDs (not strings)', async () => {
    const user = userEvent.setup();
    const onCopy = vi.fn();
    const sourceAnimals = {
      remy: {
        subject: { subject_id: 'remy' },
        devices: {
          // Current animal already has one group/ntrode; copied IDs must come after.
          electrode_groups: [{ id: 0, device_type: 'tetrode_12.5', location: 'CA1' }],
          ntrode_electrode_group_channel_map: [
            { ntrode_id: 0, electrode_group_id: 0, bad_channels: [], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
          ],
        },
      },
      bean: {
        subject: { subject_id: 'bean' },
        devices: {
          electrode_groups: [
            { id: 0, device_type: 'tetrode_12.5', location: 'CA3', description: 'CA3', targeted_location: 'CA3' },
            { id: 1, device_type: 'tetrode_12.5', location: 'PFC', description: 'PFC', targeted_location: 'PFC' },
          ],
          ntrode_electrode_group_channel_map: [
            { ntrode_id: 0, electrode_group_id: 0, bad_channels: [], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
            { ntrode_id: 1, electrode_group_id: 1, bad_channels: [], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
          ],
        },
      },
    };

    render(
      <CopyFromAnimalDialog
        open
        currentAnimalId="remy"
        animals={sourceAnimals}
        onCopy={onCopy}
        onCancel={vi.fn()}
      />
    );

    await user.click(screen.getByRole('radio', { name: /bean/i }));
    await user.click(screen.getByRole('button', { name: /^copy$/i }));

    expect(onCopy).toHaveBeenCalledTimes(1);
    const { electrode_groups, ntrode_electrode_group_channel_map } = onCopy.mock.calls[0][0];

    // New group IDs are integers, starting after the current max (0) → 1, 2.
    expect(electrode_groups.map((g) => g.id)).toEqual([1, 2]);
    electrode_groups.forEach((g) => expect(typeof g.id).toBe('number'));

    // New ntrode IDs are integers, after the current max (0) → 1, 2; references updated.
    expect(ntrode_electrode_group_channel_map.map((n) => n.ntrode_id)).toEqual([1, 2]);
    ntrode_electrode_group_channel_map.forEach((n) => {
      expect(typeof n.ntrode_id).toBe('number');
      expect(typeof n.electrode_group_id).toBe('number');
    });
    // electrode_group_id references point at the new integer group IDs.
    expect(ntrode_electrode_group_channel_map.map((n) => n.electrode_group_id)).toEqual([1, 2]);
  });

  it('normalizes mixed legacy source references and strips stray schema keys', async () => {
    const user = userEvent.setup();
    const onCopy = vi.fn();
    const sourceAnimals = {
      remy: {
        subject: { subject_id: 'remy' },
        devices: {
          electrode_groups: [{ id: 0, device_type: 'tetrode_12.5', location: 'CA1' }],
          ntrode_electrode_group_channel_map: [],
        },
      },
      bean: {
        subject: { subject_id: 'bean' },
        devices: {
          electrode_groups: [
            {
              id: '0',
              device_type: 'tetrode_12.5',
              location: 'CA3',
              targeted_x: '1',
              targeted_y: '2',
              targeted_z: '3',
              units: 'mm',
              bad_channels: '0,1',
            },
          ],
          ntrode_electrode_group_channel_map: [
            {
              ntrode_id: '0',
              electrode_group_id: 0,
              electrode_id: 99,
              bad_channels: ['1'],
              map: { 0: '0', 1: '1', 2: '2', 3: '3' },
            },
          ],
        },
      },
    };

    render(
      <CopyFromAnimalDialog
        open
        currentAnimalId="remy"
        animals={sourceAnimals}
        onCopy={onCopy}
        onCancel={vi.fn()}
      />
    );

    await user.click(screen.getByRole('radio', { name: /bean/i }));
    await user.click(screen.getByRole('button', { name: /^copy$/i }));

    const { electrode_groups, ntrode_electrode_group_channel_map } = onCopy.mock.calls[0][0];
    expect(electrode_groups).toEqual([
      {
        id: 1,
        location: 'CA3',
        device_type: 'tetrode_12.5',
        description: 'CA3',
        targeted_location: 'CA3',
        targeted_x: 1,
        targeted_y: 2,
        targeted_z: 3,
        units: 'mm',
      },
    ]);
    expect(electrode_groups[0]).not.toHaveProperty('bad_channels');
    expect(ntrode_electrode_group_channel_map).toEqual([
      {
        ntrode_id: 0,
        electrode_group_id: 1,
        bad_channels: [1],
        map: { 0: 0, 1: 1, 2: 2, 3: 3 },
      },
    ]);
    expect(ntrode_electrode_group_channel_map[0]).not.toHaveProperty('electrode_id');
  });
});

describe('CopyFromAnimalDialog — multi-section copy', () => {
  // A source animal with electrode groups, cameras, AND a recording system.
  const multiSource = {
    target: {
      subject: { subject_id: 'target' },
      devices: { electrode_groups: [], ntrode_electrode_group_channel_map: [], data_acq_device: [] },
      cameras: [],
    },
    source: {
      subject: { subject_id: 'source' },
      devices: {
        electrode_groups: [{ id: 0, device_type: 'tetrode_12.5', location: 'CA1' }],
        ntrode_electrode_group_channel_map: [
          { ntrode_id: 0, electrode_group_id: 0, bad_channels: [], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
        ],
        data_acq_device: [
          { name: 'acq1', system: 'SpikeGadgets', amplifier: 'Intan', adc_circuit: 'Intan' },
        ],
      },
      cameras: [
        { id: 0, camera_name: 'overhead', meters_per_pixel: 0.001, lens: '16mm', model: 'X', manufacturer: 'Y' },
      ],
    },
  };

  it('offers a section checklist (electrode groups, cameras, recording system) when source has all three', () => {
    render(
      <CopyFromAnimalDialog
        open
        currentAnimalId="target"
        animals={multiSource}
        onCopy={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByRole('dialog', { name: /copy from animal/i })).toBeInTheDocument();
    // Section checkboxes appear only after a source is selected.
    expect(screen.queryByRole('checkbox', { name: /cameras/i })).not.toBeInTheDocument();
  });

  it('copies cameras only when electrodes + recording system are unchecked', async () => {
    const user = userEvent.setup();
    const onCopy = vi.fn();
    render(
      <CopyFromAnimalDialog
        open
        currentAnimalId="target"
        animals={multiSource}
        onCopy={onCopy}
        onCancel={vi.fn()}
      />
    );

    await user.click(screen.getByRole('radio', { name: /source/i }));
    await user.click(screen.getByRole('checkbox', { name: /electrode groups/i }));
    await user.click(screen.getByRole('checkbox', { name: /recording system/i }));
    await user.click(screen.getByRole('button', { name: /^copy$/i }));

    expect(onCopy).toHaveBeenCalledTimes(1);
    const payload = onCopy.mock.calls[0][0];
    expect(payload.cameras).toHaveLength(1);
    expect(payload.cameras[0].camera_name).toBe('overhead');
    expect(payload).not.toHaveProperty('electrode_groups');
    expect(payload).not.toHaveProperty('ntrode_electrode_group_channel_map');
    expect(payload).not.toHaveProperty('data_acq_device');
  });

  it('copies the recording system catalog, deep-cloned from the source', async () => {
    const user = userEvent.setup();
    const onCopy = vi.fn();
    render(
      <CopyFromAnimalDialog
        open
        currentAnimalId="target"
        animals={multiSource}
        onCopy={onCopy}
        onCancel={vi.fn()}
      />
    );

    await user.click(screen.getByRole('radio', { name: /source/i }));
    await user.click(screen.getByRole('checkbox', { name: /electrode groups/i }));
    await user.click(screen.getByRole('checkbox', { name: /cameras/i }));
    await user.click(screen.getByRole('button', { name: /^copy$/i }));

    const payload = onCopy.mock.calls[0][0];
    expect(payload.data_acq_device).toHaveLength(1);
    expect(payload.data_acq_device[0].name).toBe('acq1');
    // Deep clone: not the same reference as the source catalog or its members.
    expect(payload.data_acq_device).not.toBe(multiSource.source.devices.data_acq_device);
    expect(payload.data_acq_device[0]).not.toBe(multiSource.source.devices.data_acq_device[0]);
  });

  it('blocks the whole copy and surfaces a camera-name divergence alert', async () => {
    const user = userEvent.setup();
    const onCopy = vi.fn();
    // A third animal reuses "overhead" with a DIFFERENT meters_per_pixel → divergence.
    const animalsWithConflict = {
      ...multiSource,
      other: {
        subject: { subject_id: 'other' },
        devices: { electrode_groups: [], ntrode_electrode_group_channel_map: [], data_acq_device: [] },
        cameras: [
          { id: 5, camera_name: 'overhead', meters_per_pixel: 0.002, lens: '16mm', model: 'X', manufacturer: 'Y' },
        ],
      },
    };
    render(
      <CopyFromAnimalDialog
        open
        currentAnimalId="target"
        animals={animalsWithConflict}
        onCopy={onCopy}
        onCancel={vi.fn()}
      />
    );

    await user.click(screen.getByRole('radio', { name: /source/i }));
    // Keep cameras checked; copy.
    await user.click(screen.getByRole('button', { name: /^copy$/i }));

    expect(onCopy).not.toHaveBeenCalled();
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/overhead/);
  });

  it('blocks the whole copy and surfaces a data-acq-name divergence alert', async () => {
    const user = userEvent.setup();
    const onCopy = vi.fn();
    // A third animal reuses "acq1" with a DIFFERENT amplifier → divergence.
    const animalsWithConflict = {
      ...multiSource,
      other: {
        subject: { subject_id: 'other' },
        devices: {
          electrode_groups: [],
          ntrode_electrode_group_channel_map: [],
          data_acq_device: [
            { name: 'acq1', system: 'SpikeGadgets', amplifier: 'OTHER', adc_circuit: 'Intan' },
          ],
        },
        cameras: [],
      },
    };
    render(
      <CopyFromAnimalDialog
        open
        currentAnimalId="target"
        animals={animalsWithConflict}
        onCopy={onCopy}
        onCancel={vi.fn()}
      />
    );

    await user.click(screen.getByRole('radio', { name: /source/i }));
    await user.click(screen.getByRole('button', { name: /^copy$/i }));

    expect(onCopy).not.toHaveBeenCalled();
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/acq1/);
  });

  it('clears the divergence alert when the section selection changes', async () => {
    const user = userEvent.setup();
    const onCopy = vi.fn();
    const animalsWithConflict = {
      ...multiSource,
      other: {
        subject: { subject_id: 'other' },
        devices: { electrode_groups: [], ntrode_electrode_group_channel_map: [], data_acq_device: [] },
        cameras: [
          { id: 5, camera_name: 'overhead', meters_per_pixel: 0.002, lens: '16mm', model: 'X', manufacturer: 'Y' },
        ],
      },
    };
    render(
      <CopyFromAnimalDialog
        open
        currentAnimalId="target"
        animals={animalsWithConflict}
        onCopy={onCopy}
        onCancel={vi.fn()}
      />
    );

    await user.click(screen.getByRole('radio', { name: /source/i }));
    await user.click(screen.getByRole('button', { name: /^copy$/i }));
    expect(screen.getByRole('alert')).toBeInTheDocument();

    // Unchecking cameras (the diverging section) clears the alert.
    await user.click(screen.getByRole('checkbox', { name: /cameras/i }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('does NOT offer the Cameras section when the target already has cameras', async () => {
    const user = userEvent.setup();
    // Target already has a camera catalog → copying cameras would append and risk an
    // intra-animal duplicate camera id, so the Cameras section must not be offered.
    const animalsTargetHasCameras = {
      ...multiSource,
      target: {
        subject: { subject_id: 'target' },
        devices: { electrode_groups: [], ntrode_electrode_group_channel_map: [], data_acq_device: [] },
        cameras: [
          { id: 9, camera_name: 'existing', meters_per_pixel: 0.003, lens: '8mm', model: 'Z', manufacturer: 'W' },
        ],
      },
    };
    render(
      <CopyFromAnimalDialog
        open
        currentAnimalId="target"
        animals={animalsTargetHasCameras}
        onCopy={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    await user.click(screen.getByRole('radio', { name: /source/i }));
    // Electrode groups + recording system still offered; Cameras suppressed.
    expect(screen.getByRole('checkbox', { name: /electrode groups/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /recording system/i })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /cameras/i })).not.toBeInTheDocument();
  });

  it('does NOT offer the Recording system section when the target already has a recording system', async () => {
    const user = userEvent.setup();
    // Target already has a data_acq_device catalog → copying would append and risk an
    // intra-animal duplicate device name, so the Recording system section must not be offered.
    const animalsTargetHasDataAcq = {
      ...multiSource,
      target: {
        subject: { subject_id: 'target' },
        devices: {
          electrode_groups: [],
          ntrode_electrode_group_channel_map: [],
          data_acq_device: [
            { name: 'existingAcq', system: 'SpikeGadgets', amplifier: 'Intan', adc_circuit: 'Intan' },
          ],
        },
        cameras: [],
      },
    };
    render(
      <CopyFromAnimalDialog
        open
        currentAnimalId="target"
        animals={animalsTargetHasDataAcq}
        onCopy={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    await user.click(screen.getByRole('radio', { name: /source/i }));
    // Electrode groups + cameras still offered; Recording system suppressed.
    expect(screen.getByRole('checkbox', { name: /electrode groups/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /cameras/i })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /recording system/i })).not.toBeInTheDocument();
  });

  it('pins to electrode-groups-only wording when availableSections restricts to electrodes', () => {
    render(
      <CopyFromAnimalDialog
        open
        currentAnimalId="target"
        animals={multiSource}
        availableSections={['electrode_groups']}
        onCopy={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    // Electrode-only host keeps its original title; no section checklist.
    expect(screen.getByRole('dialog', { name: /copy electrode groups/i })).toBeInTheDocument();
  });
});
