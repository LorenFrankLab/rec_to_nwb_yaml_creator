import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FailedChannelsTab from '../FailedChannelsTab';

describe('FailedChannelsTab', () => {
  const ELECTRODE_GROUPS = [
    {
      id: 0,
      location: 'CA1',
      device_type: 'tetrode_12.5',
      description: 'Dorsal CA1 tetrode',
      targeted_location: 'CA1',
      targeted_x: 2.6,
      targeted_y: -3.8,
      targeted_z: 1.5,
      units: 'mm',
    },
    {
      id: 1,
      location: 'PFC',
      device_type: 'tetrode_12.5',
      description: 'Prefrontal cortex tetrode',
      targeted_location: 'PFC',
      targeted_x: 1.0,
      targeted_y: 2.0,
      targeted_z: 2.5,
      units: 'mm',
    },
  ];

  const NTRODE_MAP = [
    { ntrode_id: 0, electrode_group_id: 0, bad_channels: [], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
    { ntrode_id: 1, electrode_group_id: 1, bad_channels: [], map: { 0: 4, 1: 5, 2: 6, 3: 7 } },
  ];

  /**
   * Wrap a devices object into a single-version configuration history, the shape
   * `resolveDayConfig` (which FailedChannelsTab now reads) requires.
   *
   * @param {object} devices - `{ electrode_groups, ntrode_electrode_group_channel_map }`.
   * @returns {object[]} A one-entry configurationHistory.
   */
  const historyFor = (devices) => [
    { version: 1, date: '2023-06-22', description: 'Initial configuration', devices, appliedToDays: [] },
  ];

  const mockAnimal = {
    id: 'test-animal',
    devices: {
      electrode_groups: ELECTRODE_GROUPS,
      ntrode_electrode_group_channel_map: NTRODE_MAP,
    },
    configurationHistory: historyFor({
      electrode_groups: ELECTRODE_GROUPS,
      ntrode_electrode_group_channel_map: NTRODE_MAP,
    }),
  };

  const mockDay = {
    id: 'test-animal-2023-06-22',
    animalId: 'test-animal',
    date: '2023-06-22',
    configurationVersion: 1,
    deviceOverrides: {
      bad_channels: {
        '0': [],
        '1': [1, 3],
      },
    },
  };

  const mockMergedDay = {
    ...mockDay,
    ...mockAnimal,
  };

  let mockOnFieldUpdate;

  beforeEach(() => {
    mockOnFieldUpdate = vi.fn();
  });

  it('per-day recording-system selector writes day.data_acq_device_name (2+ systems)', async () => {
    const user = userEvent.setup();
    const twoSystemAnimal = {
      ...mockAnimal,
      devices: {
        ...mockAnimal.devices,
        data_acq_device: [
          { name: 'SpikeGadgets_MCU', system: 'SpikeGadgets', amplifier: 'Intan', adc_circuit: 'Intan' },
          { name: 'Neuropixels_rig', system: 'Open Ephys', amplifier: 'IMEC', adc_circuit: 'IMEC' },
        ],
      },
    };
    render(
      <FailedChannelsTab
        animal={twoSystemAnimal}
        day={mockDay}
        mergedDay={mockMergedDay}
        onFieldUpdate={mockOnFieldUpdate}
      />
    );

    await user.selectOptions(
      screen.getByRole('combobox', { name: /recording system used this day/i }),
      'Neuropixels_rig'
    );
    expect(mockOnFieldUpdate).toHaveBeenCalledWith('data_acq_device_name', 'Neuropixels_rig');
  });

  describe('cameras-used checklist', () => {
    const CAMERAS = [
      { id: 0, camera_name: 'box', manufacturer: 'M', model: 'G', lens: '16mm', meters_per_pixel: 0.001 },
      { id: 1, camera_name: 'track', manufacturer: 'M', model: 'G', lens: '25mm', meters_per_pixel: 0.002 },
      { id: 2, camera_name: 'overhead', manufacturer: 'M', model: 'G', lens: '50mm', meters_per_pixel: 0.003 },
    ];
    const animalWithCameras = { ...mockAnimal, cameras: CAMERAS };

    it('renders the animal full camera catalog as a checklist', () => {
      render(
        <FailedChannelsTab
          animal={animalWithCameras}
          day={mockDay}
          mergedDay={mockMergedDay}
          onFieldUpdate={mockOnFieldUpdate}
        />
      );
      expect(screen.getByRole('checkbox', { name: /box/i })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: /track/i })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: /overhead/i })).toBeInTheDocument();
    });

    it('shows a task-referenced camera as checked and disabled', () => {
      const dayWithTaskCamera = { ...mockDay, tasks: [{ camera_id: [1] }] };
      render(
        <FailedChannelsTab
          animal={animalWithCameras}
          day={dayWithTaskCamera}
          mergedDay={mockMergedDay}
          onFieldUpdate={mockOnFieldUpdate}
        />
      );
      const referenced = screen.getByRole('checkbox', { name: /track/i });
      expect(referenced).toBeChecked();
      expect(referenced).toBeDisabled();
    });

    it('shows a CATALOG task-type camera (resolved via mergedDay) as checked and disabled', () => {
      // A migrated catalog day has taskInstances and NO inline tasks; the task camera ref lives on the
      // animal task type and surfaces in mergedDay.tasks. The checklist must infer from the resolved
      // tasks, else the camera looks optional and could be written into cameras_used inconsistently.
      const catalogDay = { ...mockDay, taskInstances: [{ taskTypeId: 'tasktype-0', task_epochs: [1] }] };
      const catalogMerged = { ...mockMergedDay, tasks: [{ task_name: 'sleep', camera_id: [1] }] };
      render(
        <FailedChannelsTab
          animal={animalWithCameras}
          day={catalogDay}
          mergedDay={catalogMerged}
          onFieldUpdate={mockOnFieldUpdate}
        />
      );
      const referenced = screen.getByRole('checkbox', { name: /track/i });
      expect(referenced).toBeChecked();
      expect(referenced).toBeDisabled();
    });

    it('checking a non-referenced camera writes cameras_used with that id', async () => {
      const user = userEvent.setup();
      render(
        <FailedChannelsTab
          animal={animalWithCameras}
          day={mockDay}
          mergedDay={mockMergedDay}
          onFieldUpdate={mockOnFieldUpdate}
        />
      );
      await user.click(screen.getByRole('checkbox', { name: /overhead/i }));
      expect(mockOnFieldUpdate).toHaveBeenCalledWith('cameras_used', [2]);
    });

    it('shows a pre-existing explicit (non-referenced) camera as checked AND enabled, no task/video hint', () => {
      const dayWithExplicit = { ...mockDay, cameras_used: [2] };
      render(
        <FailedChannelsTab
          animal={animalWithCameras}
          day={dayWithExplicit}
          mergedDay={mockMergedDay}
          onFieldUpdate={mockOnFieldUpdate}
        />
      );
      const explicit = screen.getByRole('checkbox', { name: /overhead/i });
      expect(explicit).toBeChecked();
      // It is NOT task-referenced, so it must remain uncheckable (enabled) and unlabeled.
      expect(explicit).toBeEnabled();
      expect(screen.queryByText(/used by a task\/video/i)).not.toBeInTheDocument();
    });

    it('unchecking a pre-existing explicit camera writes cameras_used as []', async () => {
      const user = userEvent.setup();
      const dayWithExplicit = { ...mockDay, cameras_used: [2] };
      render(
        <FailedChannelsTab
          animal={animalWithCameras}
          day={dayWithExplicit}
          mergedDay={mockMergedDay}
          onFieldUpdate={mockOnFieldUpdate}
        />
      );
      await user.click(screen.getByRole('checkbox', { name: /overhead/i }));
      expect(mockOnFieldUpdate).toHaveBeenCalledWith('cameras_used', []);
    });

    it('excludes a task-referenced camera id from the explicit cameras_used write', async () => {
      const user = userEvent.setup();
      // Camera A (id 0, "box") is task-referenced (checked+disabled); camera B (id 2, "overhead")
      // is free. Toggling B on must write only [2] — A's id is covered by the union, not stored.
      const dayWithTaskA = { ...mockDay, tasks: [{ camera_id: [0] }] };
      render(
        <FailedChannelsTab
          animal={animalWithCameras}
          day={dayWithTaskA}
          mergedDay={mockMergedDay}
          onFieldUpdate={mockOnFieldUpdate}
        />
      );
      const referencedA = screen.getByRole('checkbox', { name: /box/i });
      expect(referencedA).toBeChecked();
      expect(referencedA).toBeDisabled();
      await user.click(screen.getByRole('checkbox', { name: /overhead/i }));
      expect(mockOnFieldUpdate).toHaveBeenCalledWith('cameras_used', [2]);
    });
  });

  it('renders section heading', () => {
    render(
      <FailedChannelsTab
        animal={mockAnimal}
        day={mockDay}
        mergedDay={mockMergedDay}
        onFieldUpdate={mockOnFieldUpdate}
      />
    );

    expect(screen.getByRole('heading', { name: /devices & failed channels/i })).toBeInTheDocument();
  });

  it('renders with integer IDs without PropType warnings', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <FailedChannelsTab
        animal={mockAnimal}
        day={mockDay}
        mergedDay={mockMergedDay}
        onFieldUpdate={mockOnFieldUpdate}
      />
    );
    const propTypeWarnings = errorSpy.mock.calls.filter(
      (args) => typeof args[0] === 'string' && args[0].includes('Failed prop type')
    );
    expect(propTypeWarnings).toEqual([]);
    errorSpy.mockRestore();
  });

  it('displays the configuration-version notice with a link to shared animal electrode setup', () => {
    render(
      <FailedChannelsTab
        animal={mockAnimal}
        day={mockDay}
        mergedDay={mockMergedDay}
        onFieldUpdate={mockOnFieldUpdate}
      />
    );

    expect(
      screen.getByText(/this day uses animal electrode configuration v1/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /edit shared animal electrode setup/i })
    ).toHaveAttribute('href', '#/animal/test-animal/electrode-groups?field=electrode_groups');
  });

  it('renders all electrode groups as collapsed details elements', () => {
    render(
      <FailedChannelsTab
        animal={mockAnimal}
        day={mockDay}
        mergedDay={mockMergedDay}
        onFieldUpdate={mockOnFieldUpdate}
      />
    );

    // Use getAllByText since "Electrode Group X: Y" appears in both summary and content
    const group0Texts = screen.getAllByText(/electrode group 0: CA1/i);
    const group1Texts = screen.getAllByText(/electrode group 1: PFC/i);

    expect(group0Texts[0]).toBeInTheDocument();
    expect(group1Texts[0]).toBeInTheDocument();

    // Should be collapsed by default - details element exists but open attribute is false
    const detailsElements = screen.getAllByRole('group');
    detailsElements.forEach(details => {
      if (details.tagName === 'DETAILS') {
        expect(details).not.toHaveAttribute('open');
      }
    });
  });

  it('shows status badge "All channels OK" when no bad channels', () => {
    const dayWithNoFailures = {
      ...mockDay,
      deviceOverrides: {
        bad_channels: {
          '0': [],
          '1': [],
        },
      },
    };

    render(
      <FailedChannelsTab
        animal={mockAnimal}
        day={dayWithNoFailures}
        mergedDay={mockMergedDay}
        onFieldUpdate={mockOnFieldUpdate}
      />
    );

    const statusBadges = screen.getAllByText(/all channels ok/i);
    expect(statusBadges.length).toBeGreaterThan(0);
  });

  it('shows status badge with failed channel count', () => {
    render(
      <FailedChannelsTab
        animal={mockAnimal}
        day={mockDay}
        mergedDay={mockMergedDay}
        onFieldUpdate={mockOnFieldUpdate}
      />
    );

    expect(screen.getByText(/2 failed channels/i)).toBeInTheDocument();
  });

  it('expands electrode group when clicked', async () => {
    const user = userEvent.setup();

    render(
      <FailedChannelsTab
        animal={mockAnimal}
        day={mockDay}
        mergedDay={mockMergedDay}
        onFieldUpdate={mockOnFieldUpdate}
      />
    );

    // Get the first occurrence (summary element)
    const group0Summaries = screen.getAllByText(/electrode group 0: CA1/i);
    await user.click(group0Summaries[0]);

    // Content should now be visible - check for text that should appear
    const shankTexts = screen.getAllByText(/this tetrode_12\.5 has 1 shank/i);
    expect(shankTexts[0]).toBeVisible();
    const failedChannelsLabels = screen.getAllByText(/failed channels/i);
    expect(failedChannelsLabels[0]).toBeVisible();
  });

  it('shows read-only device info when expanded', async () => {
    const user = userEvent.setup();

    render(
      <FailedChannelsTab
        animal={mockAnimal}
        day={mockDay}
        mergedDay={mockMergedDay}
        onFieldUpdate={mockOnFieldUpdate}
      />
    );

    const group0Summaries = screen.getAllByText(/electrode group 0: CA1/i);
    await user.click(group0Summaries[0]);

    // Device config is inside a nested collapsible section, need to expand it too
    const viewConfigButtons = screen.getAllByText(/view device configuration/i);
    await user.click(viewConfigButtons[0]); // Click the first one (for group 0)

    const deviceTypes = screen.getAllByText('tetrode_12.5');
    expect(deviceTypes[0]).toBeVisible();
    expect(screen.getByText(/\(2\.6, -3\.8, 1\.5\) mm/)).toBeVisible();
  });

  it('calls onFieldUpdate when bad channels are changed', async () => {
    const user = userEvent.setup();

    render(
      <FailedChannelsTab
        animal={mockAnimal}
        day={mockDay}
        mergedDay={mockMergedDay}
        onFieldUpdate={mockOnFieldUpdate}
      />
    );

    // Expand group 0
    const group0Summaries = screen.getAllByText(/electrode group 0: CA1/i);
    await user.click(group0Summaries[0]);

    // Check channel 1 as failed (use getAllByLabelText since multiple groups may be open)
    const channel1Checkboxes = screen.getAllByLabelText(/channel 1/i);
    await user.click(channel1Checkboxes[0]); // Click the first one (group 0, ntrode 0)

    expect(mockOnFieldUpdate).toHaveBeenCalledWith('deviceOverrides.bad_channels.0', [1]);
  });

  it('renders inherited (migrated-down) bad channels and preserves them when editing', async () => {
    const user = userEvent.setup();
    // `resolveDayConfig` now reads bad_channels from the DAY OVERRIDE ONLY (the
    // load-time migration moves a snapshot base mark DOWN into the day override), so
    // the inherited mark on ntrode 0 reaches the user through
    // `deviceOverrides.bad_channels[0]`, not via the snapshot base.
    const animalWithInheritedBadChannels = {
      ...mockAnimal,
      devices: {
        ...mockAnimal.devices,
        ntrode_electrode_group_channel_map: NTRODE_MAP,
      },
      configurationHistory: historyFor({
        electrode_groups: ELECTRODE_GROUPS,
        ntrode_electrode_group_channel_map: NTRODE_MAP,
      }),
    };
    const dayWithoutOverride = {
      ...mockDay,
      deviceOverrides: { bad_channels: { 0: [1] } },
    };

    render(
      <FailedChannelsTab
        animal={animalWithInheritedBadChannels}
        day={dayWithoutOverride}
        mergedDay={mockMergedDay}
        onFieldUpdate={mockOnFieldUpdate}
      />
    );

    expect(screen.getByText(/1 failed channel/i)).toBeInTheDocument();

    const group0Summaries = screen.getAllByText(/electrode group 0: CA1/i);
    await user.click(group0Summaries[0]);

    expect(screen.getAllByLabelText(/channel 1/i)[0]).toBeChecked();
    await user.click(screen.getAllByLabelText(/channel 2/i)[0]);

    expect(mockOnFieldUpdate).toHaveBeenCalledWith('deviceOverrides.bad_channels.0', [1, 2]);
  });

  it('reads the bad-channel un-mark monotonicity gate from the view-model marks (Phase 3-g)', async () => {
    const user = userEvent.setup();
    // No animalDays → the inline fallback computes NO prior-bad channels. The view-model marks say
    // ntrode 1 channel 1 was bad on an earlier same-config day (unacknowledged), so un-marking it must
    // trigger the monotonicity confirm — proving the gate reads the marks, not the fallback.
    const badChannelMarks = [
      { ntrodeId: '1', channel: 1, marked: true, priorBad: true, requiresAck: false, acked: false },
      { ntrodeId: '1', channel: 3, marked: true, priorBad: false, requiresAck: false, acked: false },
    ];
    const { container } = render(
      <FailedChannelsTab
        animal={mockAnimal}
        day={mockDay}
        mergedDay={mockMergedDay}
        onFieldUpdate={mockOnFieldUpdate}
        badChannelMarks={badChannelMarks}
      />
    );

    // Expand electrode group 1 (PFC, ntrode 1) to reveal its failed-channel checkboxes, then target
    // ntrode 1's channel 1 by id (group 0 is expanded too, so the "Channel 1" label is ambiguous).
    await user.click(screen.getAllByText(/electrode group 1: PFC/i)[0]);
    const channel1 = container.querySelector('#channel-1-1');
    expect(channel1).toBeChecked();

    // Un-check the prior-bad channel → the monotonicity confirm appears (driven by the marks).
    await user.click(channel1);
    expect(screen.getByText(/un-mark a previously failed channel/i)).toBeInTheDocument();
    // The un-mark write is deferred until confirmed (no immediate field write).
    expect(mockOnFieldUpdate).not.toHaveBeenCalledWith('deviceOverrides.bad_channels.1', expect.anything());
  });

  it('handles empty state when no electrode groups', () => {
    const noGroups = { electrode_groups: [], ntrode_electrode_group_channel_map: [] };
    const animalWithNoGroups = {
      ...mockAnimal,
      devices: noGroups,
      configurationHistory: historyFor(noGroups),
    };

    render(
      <FailedChannelsTab
        animal={animalWithNoGroups}
        day={mockDay}
        mergedDay={mockMergedDay}
        onFieldUpdate={mockOnFieldUpdate}
      />
    );

    expect(screen.getByText(/no electrodes are set up/i)).toBeInTheDocument();
    // Animal-static setup is explained and routed to AnimalView, not edited from the day.
    expect(screen.getByText(/failed-channel editing appears here after the animal has electrode groups/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /edit animal setup/i })).toHaveAttribute(
      'href',
      '#/animal/test-animal/electrode-groups?field=electrode_groups'
    );
  });

  it('displays warning when all channels in a group are marked as failed', () => {
    const dayWithAllFailed = {
      ...mockDay,
      deviceOverrides: {
        bad_channels: {
          '0': [0, 1, 2, 3], // All 4 channels failed
          '1': [],
        },
      },
    };

    render(
      <FailedChannelsTab
        animal={mockAnimal}
        day={dayWithAllFailed}
        mergedDay={mockMergedDay}
        onFieldUpdate={mockOnFieldUpdate}
      />
    );

    expect(screen.getByText(/all channels failed - group inactive/i)).toBeInTheDocument();
  });

  it('validates invalid channels against a string-keyed bad-channel override', async () => {
    const user = userEvent.setup();
    // ntrode ids are integers (schema contract); the deviceOverrides.bad_channels
    // map is keyed by ntrode_id as a JS object key (a string) — the lookup bridges
    // the integer ntrode_id to that string key.
    const ntrodeMap = [
      { ntrode_id: 0, electrode_group_id: 0, bad_channels: [], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
    ];
    const animalWithNtrode = {
      ...mockAnimal,
      devices: {
        electrode_groups: [ELECTRODE_GROUPS[0]],
        ntrode_electrode_group_channel_map: ntrodeMap,
      },
      configurationHistory: historyFor({
        electrode_groups: [ELECTRODE_GROUPS[0]],
        ntrode_electrode_group_channel_map: ntrodeMap,
      }),
    };
    const dayWithInvalidOverride = {
      ...mockDay,
      deviceOverrides: { bad_channels: { '0': [9] } },
    };

    render(
      <FailedChannelsTab
        animal={animalWithNtrode}
        day={dayWithInvalidOverride}
        mergedDay={mockMergedDay}
        onFieldUpdate={mockOnFieldUpdate}
      />
    );

    const group0Summaries = screen.getAllByText(/electrode group 0: CA1/i);
    await user.click(group0Summaries[0]);

    expect(screen.getByText(/invalid channels: 9/i)).toBeInTheDocument();
  });

  it('handles missing deviceOverrides gracefully', () => {
    const dayWithoutOverrides = {
      ...mockDay,
      deviceOverrides: undefined,
    };

    render(
      <FailedChannelsTab
        animal={mockAnimal}
        day={dayWithoutOverrides}
        mergedDay={mockMergedDay}
        onFieldUpdate={mockOnFieldUpdate}
      />
    );

    // Should render without errors
    expect(screen.getByRole('heading', { name: /devices & failed channels/i })).toBeInTheDocument();
  });

  it('allows multiple groups to be expanded simultaneously', async () => {
    const user = userEvent.setup();

    render(
      <FailedChannelsTab
        animal={mockAnimal}
        day={mockDay}
        mergedDay={mockMergedDay}
        onFieldUpdate={mockOnFieldUpdate}
      />
    );

    // Expand both groups
    const group0Summaries = screen.getAllByText(/electrode group 0: CA1/i);
    const group1Summaries = screen.getAllByText(/electrode group 1: PFC/i);

    await user.click(group0Summaries[0]);
    await user.click(group1Summaries[0]);

    // Both should be visible - check for text in each group's expanded content
    const shankTexts = screen.getAllByText(/this tetrode_12\.5 has 1 shank/i);
    expect(shankTexts[0]).toBeVisible();
    expect(shankTexts[1]).toBeVisible();
  });

  it('renders explanatory header when electrode group is expanded', async () => {
    const user = userEvent.setup();

    render(
      <FailedChannelsTab
        animal={mockAnimal}
        day={mockDay}
        mergedDay={mockMergedDay}
        onFieldUpdate={mockOnFieldUpdate}
      />
    );

    const group0Summaries = screen.getAllByText(/electrode group 0: CA1/i);
    await user.click(group0Summaries[0]);

    const shankTexts = screen.getAllByText(/this tetrode_12\.5 has 1 shank/i);
    expect(shankTexts[0]).toBeVisible();
    const markChannelsTexts = screen.getAllByText(/mark individual channels that have failed/i);
    expect(markChannelsTexts[0]).toBeVisible();
  });

  it('handles data corruption (missing ntrode maps)', () => {
    const missingMaps = {
      electrode_groups: mockAnimal.devices.electrode_groups,
      ntrode_electrode_group_channel_map: [], // Missing maps
    };
    const animalWithMissingMaps = {
      ...mockAnimal,
      devices: missingMaps,
      configurationHistory: historyFor(missingMaps),
    };

    render(
      <FailedChannelsTab
        animal={animalWithMissingMaps}
        day={mockDay}
        mergedDay={mockMergedDay}
        onFieldUpdate={mockOnFieldUpdate}
      />
    );

    // Should still render without crashing
    expect(screen.getByRole('heading', { name: /devices & failed channels/i })).toBeInTheDocument();
    // Check that error message is present (multiple groups show this error)
    const errorMessages = screen.getAllByText(/no channel mapping found/i);
    expect(errorMessages.length).toBeGreaterThan(0);
    expect(errorMessages[0]).toBeInTheDocument();
    // The fix link deep-links to the Electrode Groups tab (the owner of the auto-generated map),
    // not the bare Animal Editor (there are multiple links, one per group).
    const fixLinks = screen.getAllByRole('link', { name: /fix in animal setup/i });
    expect(fixLinks[0]).toHaveAttribute(
      'href',
      '#/animal/test-animal/electrode-groups?field=electrode_groups'
    );
  });

  it('uses aria-label on status badges for accessibility', () => {
    render(
      <FailedChannelsTab
        animal={mockAnimal}
        day={mockDay}
        mergedDay={mockMergedDay}
        onFieldUpdate={mockOnFieldUpdate}
      />
    );

    const statusBadge = screen.getByLabelText(/status: all channels ok/i);
    expect(statusBadge).toBeInTheDocument();
  });

  describe('effective (pinned) configuration', () => {
    // v1 has one CA1 group; v2 adds a CA3 group. animal.devices mirrors the LATEST (v2).
    const V2_GROUPS = [
      ELECTRODE_GROUPS[0],
      { id: 2, location: 'CA3', device_type: 'tetrode_12.5', description: 'CA3 tetrode', targeted_location: 'CA3', targeted_x: 3.5, targeted_y: 3, targeted_z: 2.2, units: 'mm' },
    ];
    const V2_NTRODES = [
      { ntrode_id: 0, electrode_group_id: 0, bad_channels: [], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
      { ntrode_id: 2, electrode_group_id: 2, bad_channels: [], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
    ];
    const twoVersionAnimal = {
      id: 'test-animal',
      devices: { electrode_groups: V2_GROUPS, ntrode_electrode_group_channel_map: V2_NTRODES },
      configurationHistory: [
        { version: 1, date: '2023-06-20', description: 'Initial', devices: { electrode_groups: [ELECTRODE_GROUPS[0]], ntrode_electrode_group_channel_map: [NTRODE_MAP[0]] }, appliedToDays: [] },
        { version: 2, date: '2023-06-22', description: 'Added CA3', devices: { electrode_groups: V2_GROUPS, ntrode_electrode_group_channel_map: V2_NTRODES }, appliedToDays: [] },
      ],
    };
    const historicalDay = { ...mockDay, configurationVersion: 1, deviceOverrides: { bad_channels: {} } };
    const wiring = {
      animalDays: [historicalDay],
      actions: { createConfigurationSnapshotAndApplyForward: vi.fn() },
    };

    it('renders the pinned snapshot ntrode list on a historical day, not live animal.devices', () => {
      render(
        <FailedChannelsTab
          animal={twoVersionAnimal}
          day={historicalDay}
          mergedDay={mockMergedDay}
          onFieldUpdate={mockOnFieldUpdate}
          {...wiring}
        />
      );

      // v1's CA1 group is shown; the v2-only CA3 group (in live animal.devices) is NOT.
      expect(screen.getAllByText(/electrode group 0: CA1/i).length).toBeGreaterThan(0);
      expect(screen.queryAllByText(/electrode group 2: CA3/i)).toHaveLength(0);
    });

    it('shows the pinned configuration version and marks it historical', () => {
      render(
        <FailedChannelsTab
          animal={twoVersionAnimal}
          day={historicalDay}
          mergedDay={mockMergedDay}
          onFieldUpdate={mockOnFieldUpdate}
          {...wiring}
        />
      );

      expect(screen.getByText(/configuration version 1/i)).toBeInTheDocument();
      expect(screen.getByText(/^historical$/i)).toBeInTheDocument();
    });

    it('marks the latest configuration as latest', () => {
      const latestDay = { ...mockDay, configurationVersion: 2, deviceOverrides: { bad_channels: {} } };
      render(
        <FailedChannelsTab
          animal={twoVersionAnimal}
          day={latestDay}
          mergedDay={mockMergedDay}
          onFieldUpdate={mockOnFieldUpdate}
          animalDays={[latestDay]}
          actions={wiring.actions}
        />
      );

      expect(screen.getByText(/configuration version 2/i)).toBeInTheDocument();
      expect(screen.getByText(/^latest$/i)).toBeInTheDocument();
    });
  });
});
