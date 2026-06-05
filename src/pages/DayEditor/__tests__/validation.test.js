import { describe, it, expect } from 'vitest';
import { validateField, computeStepStatus, computeDevicesStatus, computeEpochsStatus, groupErrorsByStep, stepIdForIssue, repairTargetForIssue, validateDay, dayOverrideIssues } from '../validation';
import { makeAnimalWithCamerasAndDay } from './taskFixtures';

describe('stepIdForIssue', () => {
  it('routes session/subject issues to the overview step', () => {
    expect(stepIdForIssue({ path: 'session_description' })).toBe('overview');
    expect(stepIdForIssue({ path: 'subject.weight' })).toBe('overview');
  });

  it('routes electrode/camera/ntrode issues to the devices step', () => {
    expect(stepIdForIssue({ path: 'electrode_groups[0].targeted_x' })).toBe('devices');
    expect(stepIdForIssue({ path: 'cameras[1].lens' })).toBe('devices');
  });

  it('routes nested required device fields to the devices step', () => {
    expect(stepIdForIssue({ path: 'electrode_groups[0].targeted_location' })).toBe('devices');
    expect(stepIdForIssue({ path: 'cameras[0].lens' })).toBe('devices');
    expect(stepIdForIssue({ path: 'targeted_location' })).toBe('devices');
    expect(stepIdForIssue({ path: 'lens' })).toBe('devices');
  });

  it('routes task/behavioral issues to the epochs step', () => {
    expect(stepIdForIssue({ path: 'tasks[0].task_name' })).toBe('epochs');
  });

  it('routes anything unrecognized to the validation catch-all step', () => {
    expect(stepIdForIssue({ path: 'description' })).toBe('validation');
  });

  it('prefers an explicit issue.step over path routing (Task 9)', () => {
    // A camera-path issue would path-route to 'devices', but an explicit step wins.
    expect(stepIdForIssue({ path: 'cameras[0].camera_name', step: 'epochs' })).toBe('epochs');
    // A task-path issue with an explicit devices step routes to devices.
    expect(stepIdForIssue({ path: 'tasks[0].task_name', step: 'devices' })).toBe('devices');
  });

  it('ignores an invalid issue.step and falls back to path routing (Task 9)', () => {
    expect(stepIdForIssue({ path: 'tasks[0].task_name', step: 'not-a-step' })).toBe('epochs');
  });

  it('groupErrorsByStep honors explicit issue.step', () => {
    const issues = [{ path: 'cameras[0].camera_name', code: 'x', severity: 'error', step: 'epochs' }];
    const grouped = groupErrorsByStep(issues);
    expect(grouped.epochs).toContainEqual(issues[0]);
    expect(grouped.devices).toHaveLength(0);
  });

  it('agrees with groupErrorsByStep for the same issues', () => {
    const issues = [
      { path: 'session_description', code: 'pattern', severity: 'error' },
      { path: 'electrode_groups[0].targeted_x', code: 'type', severity: 'error' },
      { path: 'tasks[0].task_name', code: 'pattern', severity: 'error' },
      { path: 'description', code: 'required', severity: 'error' },
    ];
    const grouped = groupErrorsByStep(issues);
    for (const issue of issues) {
      expect(grouped[stepIdForIssue(issue)]).toContainEqual(issue);
    }
  });
});

describe('validateField', () => {
  it('validates required fields', async () => {
    const mergedDay = {
      session_id: '',
      session_description: 'Valid description',
    };

    const { valid, errors } = await validateField(mergedDay, 'session_id');

    expect(valid).toBe(false);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      path: 'session_id',
      severity: 'error',
    });
  });

  it('returns valid when field passes validation', async () => {
    const mergedDay = {
      session_id: 'remy_20230622',
      session_description: 'Valid description',
      subject: {
        subject_id: 'remy',
        species: 'Rat',
        sex: 'M',
        genotype: 'WT',
        date_of_birth: '2023-01-01',
      },
      experimenter_name: ['John Doe'],
      lab: 'Test Lab',
      institution: 'Test Institution',
    };

    const { valid, errors } = await validateField(mergedDay, 'session_id');

    expect(valid).toBe(true);
    expect(errors).toHaveLength(0);
  });

  it('filters errors to specific field', async () => {
    const mergedDay = {
      session_id: '',
      session_description: '', // Also invalid
      subject: {
        subject_id: 'test',
      },
    };

    const { errors } = await validateField(mergedDay, 'session_id');

    // Should only return errors for session_id, not session_description
    expect(errors.every(e => e.path === 'session_id')).toBe(true);
  });

  it('returns field-level error messages', async () => {
    const mergedDay = {
      session_id: '',
    };

    const { errors } = await validateField(mergedDay, 'session_id');

    expect(errors[0]).toHaveProperty('message');
    expect(errors[0].message).toBeTruthy();
  });
});

describe('computeStepStatus', () => {
  it('returns "valid" when overview step complete and no errors', () => {
    const day = {
      session: {
        session_id: 'remy_20230622',
        session_description: 'Day 1',
      },
    };

    const mergedDay = {
      ...day.session,
      subject: {
        description: 'Test subject',
        subject_id: 'remy',
        species: 'Rattus norvegicus',
        sex: 'M',
        genotype: 'Wild Type',
        weight: 400,
        date_of_birth: '2023-01-01T00:00:00',
      },
      experimenter_name: ['Test'],
      lab: 'Lab',
      institution: 'Inst',
    };

    const status = computeStepStatus(day, mergedDay);

    expect(status.overview).toBe('valid');
  });

  it('returns "incomplete" when required fields missing but no other data', () => {
    const day = {
      session: {
        session_id: undefined,
        session_description: undefined,
      },
    };

    const mergedDay = {
      // Minimal valid structure to avoid schema errors, but missing session data
      subject: {
        subject_id: 'test',
        species: 'Rat',
        sex: 'M',
        genotype: 'WT',
        date_of_birth: '2023-01-01',
      },
      experimenter_name: ['Test'],
      lab: 'Lab',
      institution: 'Inst',
      session_id: undefined,
      session_description: undefined,
    };

    const status = computeStepStatus(day, mergedDay);

    // When fields are undefined (not filled in), status should be incomplete
    expect(status.overview).toBe('incomplete');
  });

  it('returns "error" when validation fails', () => {
    const day = {
      session: {
        session_id: 'invalid id', // Contains space, may violate pattern
        session_description: 'Test',
      },
    };

    const mergedDay = {
      ...day.session,
      subject: {
        date_of_birth: 'not-a-valid-date', // Invalid date format
      },
    };

    const status = computeStepStatus(day, mergedDay);

    // Status should be error if schema validation finds issues
    expect(['error', 'incomplete']).toContain(status.overview);
  });

  it('marks devices incomplete with no electrode groups, epochs incomplete with no tasks', () => {
    const day = {
      session: {
        session_id: 'test',
        session_description: 'test',
      },
    };

    const mergedDay = {
      ...day.session,
    };

    const status = computeStepStatus(day, mergedDay);

    // No electrode groups → devices incomplete; no tasks → epochs incomplete.
    expect(status.devices).toBe('incomplete');
    expect(status.epochs).toBe('incomplete');
  });
});

describe('computeStepStatus validation status', () => {
  // A model that validates clean (mirrors minimal-valid.yml): empty catch-all bucket.
  const cleanMerged = {
    experimenter_name: ['Doe, John'],
    lab: 'Frank',
    institution: 'University of California, San Francisco',
    data_acq_device: [
      { name: 'SpikeGadgets', system: 'SpikeGadgets', amplifier: 'Intan', adc_circuit: 'Intan' },
    ],
    times_period_multiplier: 1.5,
    raw_data_to_volts: 0.195,
  };
  const day = { session: { session_id: 'remy_20230622', session_description: 'Day 1' } };

  it('returns "valid" when the catch-all validation bucket has no error', () => {
    expect(computeStepStatus(day, cleanMerged).validation).toBe('valid');
  });

  it('returns "error" when the catch-all validation bucket has an error-severity issue', () => {
    // keywords: [] fails the schema's minItems and routes to the catch-all bucket.
    const merged = { ...cleanMerged, keywords: [] };
    expect(computeStepStatus(day, merged).validation).toBe('error');
  });
});

describe('computeStepStatus epochs status', () => {
  it('returns "incomplete" when the day has no tasks', () => {
    const { day, mergedDay } = makeAnimalWithCamerasAndDay({ day: { tasks: [] } });
    expect(computeStepStatus(day, mergedDay).epochs).toBe('incomplete');
  });

  it('returns "valid" when the day has at least one task with valid required fields', () => {
    const { day, mergedDay } = makeAnimalWithCamerasAndDay();
    expect(computeStepStatus(day, mergedDay).epochs).toBe('valid');
  });

  it('returns "error" when a task has a blank schema-required field', () => {
    const { day, mergedDay } = makeAnimalWithCamerasAndDay({
      day: {
        tasks: [
          {
            task_name: 'sleep',
            task_description: '', // blank required field → schema error
            task_environment: 'HomeBox',
            camera_id: [1],
            task_epochs: [1],
          },
        ],
      },
    });
    expect(computeStepStatus(day, mergedDay).epochs).toBe('error');
  });
});

describe('computeDevicesStatus', () => {
  const group = { id: 0, location: 'CA1', device_type: 'tetrode_12.5' };
  const ntrode = { ntrode_id: 1, electrode_group_id: 0, map: { 0: 0, 1: 1, 2: 2, 3: 3 } };

  it('returns "incomplete" when there are no electrode groups', () => {
    expect(computeDevicesStatus({}, { electrode_groups: [], ntrode_electrode_group_channel_map: [] }))
      .toBe('incomplete');
  });

  it('returns "incomplete" when a group has no channel mapping', () => {
    const mergedDay = {
      electrode_groups: [group],
      ntrode_electrode_group_channel_map: [], // group 0 has no ntrode
    };
    expect(computeDevicesStatus({}, mergedDay)).toBe('incomplete');
  });

  it('returns "error" when merged ntrode bad_channels mark all channels bad', () => {
    const mergedDay = {
      electrode_groups: [group],
      ntrode_electrode_group_channel_map: [{ ...ntrode, bad_channels: [0, 1, 2, 3] }],
    };
    expect(computeDevicesStatus({}, mergedDay)).toBe('error');
  });

  it('matches integer group IDs to integer electrode_group_id values', () => {
    const mergedDay = {
      electrode_groups: [group],
      ntrode_electrode_group_channel_map: [
        { ...ntrode, electrode_group_id: 0, bad_channels: [0, 1, 2, 3] },
      ],
    };
    expect(computeDevicesStatus({}, mergedDay)).toBe('error');
  });

  it('returns "valid" for healthy groups, with partial bad channels staying non-blocking', () => {
    const fullyHealthy = {
      electrode_groups: [group],
      ntrode_electrode_group_channel_map: [{ ...ntrode, bad_channels: [] }],
    };
    expect(computeDevicesStatus({}, fullyHealthy)).toBe('valid');

    const partialBad = {
      electrode_groups: [group],
      ntrode_electrode_group_channel_map: [{ ...ntrode, bad_channels: [0] }],
    };
    expect(computeDevicesStatus({}, partialBad)).toBe('valid');
  });
});

describe('groupErrorsByStep', () => {
  it('assigns session errors to overview', () => {
    const errors = [
      { path: '/session_id', message: 'Required' },
      { instancePath: '/session_description', message: 'Required' },
    ];

    const grouped = groupErrorsByStep(errors);

    expect(grouped.overview).toHaveLength(2);
    expect(grouped.devices).toHaveLength(0);
  });

  it('assigns device errors to devices step', () => {
    const errors = [
      { path: '/electrode_groups/0/id', message: 'Required' },
      { instancePath: '/device/name', message: 'Required' },
      { path: '/cameras/0/id', message: 'Required' },
    ];

    const grouped = groupErrorsByStep(errors);

    expect(grouped.devices).toHaveLength(3);
    expect(grouped.overview).toHaveLength(0);
  });

  it('assigns task errors to epochs step', () => {
    const errors = [
      { path: '/tasks/0/task_name', message: 'Required' },
      { instancePath: '/behavioral_events/0/name', message: 'Required' },
    ];

    const grouped = groupErrorsByStep(errors);

    expect(grouped.epochs).toHaveLength(2);
    expect(grouped.overview).toHaveLength(0);
  });

  it('handles errors without clear step assignment', () => {
    const errors = [
      { path: '/unknown_field', message: 'Invalid' },
    ];

    const grouped = groupErrorsByStep(errors);

    // Should go to validation step as catch-all
    expect(grouped.validation).toHaveLength(1);
  });
});

describe('repairTargetForIssue (Repair Routing Contract)', () => {
  // The single source of truth for "where is this issue fixed". Every app error code
  // must resolve to a surface in {day, animal, none} with a non-empty label, and every
  // day-surface issue must resolve to a valid routable step.
  const ROUTABLE_STEPS = ['overview', 'devices', 'epochs', 'validation'];

  // EXACT surface mapping from the Repair Routing Contract. Each code is paired with a
  // representative issue (path + the metadata the rule actually sets) so the helper sees
  // what production sees.
  const ANIMAL_CODES = [
    { code: 'channel_value_out_of_range', issue: { code: 'channel_value_out_of_range', path: 'ntrode_electrode_group_channel_map[0]', field: 'map', step: 'devices', repairSurface: 'animal' } },
    { code: 'channel_key_out_of_range', issue: { code: 'channel_key_out_of_range', path: 'ntrode_electrode_group_channel_map[0]', field: 'map', step: 'devices', repairSurface: 'animal' } },
    { code: 'channel_partition_invalid', issue: { code: 'channel_partition_invalid', path: 'ntrode_electrode_group_channel_map', field: 'map', step: 'devices', repairSurface: 'animal' } },
    { code: 'channel_row_count_mismatch', issue: { code: 'channel_row_count_mismatch', path: 'ntrode_electrode_group_channel_map', field: 'map', step: 'devices', repairSurface: 'animal' } },
    { code: 'inconsistent_probe_catalog', issue: { code: 'inconsistent_probe_catalog', path: 'electrode_groups[0].device_type', field: 'device_type', step: 'devices', repairSurface: 'animal' } },
    { code: 'empty_location', issue: { code: 'empty_location', path: 'electrode_groups[0].location', field: 'location', step: 'devices', repairSurface: 'animal' } },
    { code: 'empty_targeted_location', issue: { code: 'empty_targeted_location', path: 'electrode_groups[0].targeted_location', field: 'targeted_location', step: 'devices', repairSurface: 'animal' } },
    { code: 'inconsistent_location_case', issue: { code: 'inconsistent_location_case', path: 'electrode_groups', field: 'location', step: 'devices', repairSurface: 'animal', severity: 'warning' } },
    { code: 'unknown_device_type', issue: { code: 'unknown_device_type', path: 'electrode_groups[0].device_type', field: 'device_type', step: 'devices', repairSurface: 'animal' } },
    { code: 'duplicate_electrode_group_id', issue: { code: 'duplicate_electrode_group_id', path: 'electrode_groups', repairSurface: 'animal' } },
    { code: 'duplicate_ntrode_id', issue: { code: 'duplicate_ntrode_id', path: 'ntrode_electrode_group_channel_map', repairSurface: 'animal' } },
    { code: 'dangling_electrode_group_ref', issue: { code: 'dangling_electrode_group_ref', path: 'ntrode_electrode_group_channel_map[0]', field: 'electrode_group_id', step: 'devices', repairSurface: 'animal' } },
    { code: 'duplicate_channels', issue: { code: 'duplicate_channels', path: 'ntrode_electrode_group_channel_map[0]', repairSurface: 'animal' } },
    { code: 'missing_channels', issue: { code: 'missing_channels', path: 'ntrode_electrode_group_channel_map[0]', repairSurface: 'animal' } },
    { code: 'duplicate_camera_id', issue: { code: 'duplicate_camera_id', path: 'cameras', field: 'id', step: 'devices', repairSurface: 'animal' } },
    { code: 'divergent_camera_identity', issue: { code: 'divergent_camera_identity', path: 'cameras', field: 'camera_name', step: 'devices', repairSurface: 'animal' } },
    { code: 'divergent_data_acq_identity', issue: { code: 'divergent_data_acq_identity', path: 'data_acq_device', field: 'name', step: 'devices', repairSurface: 'animal' } },
    { code: 'invalid_species', issue: { code: 'invalid_species', path: 'subject.species', repairSurface: 'animal' } },
  ];

  const DAY_CODES = [
    { code: 'dangling_camera_ref', step: 'epochs', issue: { code: 'dangling_camera_ref', path: 'tasks[0].camera_id', field: 'camera_id', step: 'epochs', repairSurface: 'day' } },
    { code: 'duplicate_behavioral_event_name', step: 'epochs', issue: { code: 'duplicate_behavioral_event_name', path: 'behavioral_events', field: 'name', step: 'epochs', repairSurface: 'day' } },
    { code: 'duplicate_behavioral_event_description', step: 'epochs', issue: { code: 'duplicate_behavioral_event_description', path: 'behavioral_events', field: 'description', step: 'epochs', repairSurface: 'day' } },
    { code: 'duplicate_task_epoch', step: 'epochs', issue: { code: 'duplicate_task_epoch', path: 'tasks', field: 'task_epochs', step: 'epochs', repairSurface: 'day' } },
    { code: 'orphaned_video', step: 'epochs', issue: { code: 'orphaned_video', path: 'associated_video_files[0].task_epochs', field: 'task_epochs', step: 'epochs', repairSurface: 'day' } },
    { code: 'orphaned_file', step: 'epochs', issue: { code: 'orphaned_file', path: 'associated_files[0].task_epochs', field: 'task_epochs', step: 'epochs', repairSurface: 'day' } },
    { code: 'divergent_task_identity', step: 'epochs', issue: { code: 'divergent_task_identity', path: 'tasks', field: 'task_name', step: 'epochs', repairSurface: 'day' } },
    { code: 'bad_channel_out_of_range', step: 'devices', issue: { code: 'bad_channel_out_of_range', path: 'ntrode_electrode_group_channel_map[0]', field: 'bad_channels', step: 'devices', repairSurface: 'day' } },
    { code: 'multishank_bad_channels_ignored', step: 'devices', issue: { code: 'multishank_bad_channels_ignored', path: 'ntrode_electrode_group_channel_map[1]', field: 'bad_channels', step: 'devices', repairSurface: 'day' } },
    { code: 'stale_bad_channel_override', step: 'devices', issue: { code: 'stale_bad_channel_override', path: 'deviceOverrides.bad_channels', field: 'bad_channels', step: 'devices', repairSurface: 'day' } },
    { code: 'missing_camera', step: 'epochs', issue: { code: 'missing_camera', path: 'tasks', repairSurface: 'day' } },
    { code: 'partial_configuration', step: 'validation', issue: { code: 'partial_configuration', path: 'optogenetics', repairSurface: 'day' } },
  ];

  const NONE_CODES = [
    { code: 'subject_id_slash', issue: { code: 'subject_id_slash', path: 'subject.subject_id' } },
    { code: 'session_id_slash', issue: { code: 'session_id_slash', path: 'session_id' } },
  ];

  it.each([...ANIMAL_CODES, ...DAY_CODES, ...NONE_CODES])(
    'returns a {day|animal|none} surface and a non-empty label for $code',
    ({ issue }) => {
      const target = repairTargetForIssue(issue);
      expect(['day', 'animal', 'none']).toContain(target.surface);
      expect(typeof target.label).toBe('string');
      expect(target.label.length).toBeGreaterThan(0);
    }
  );

  it.each(ANIMAL_CODES)('routes $code to the animal surface', ({ issue }) => {
    expect(repairTargetForIssue(issue).surface).toBe('animal');
  });

  it.each(DAY_CODES)('routes $code to the day surface on step $step', ({ issue, step }) => {
    const target = repairTargetForIssue(issue);
    expect(target.surface).toBe('day');
    expect(ROUTABLE_STEPS).toContain(target.step);
    expect(target.step).toBe(step);
  });

  it.each(NONE_CODES)('routes $code to the none surface (no button)', ({ issue }) => {
    expect(repairTargetForIssue(issue).surface).toBe('none');
  });

  it('falls back to deriving the animal surface from an AJV schema path with no metadata', () => {
    // A schema issue under electrode_groups/cameras carries no repairSurface — it
    // must still derive to the animal surface (where geometry is edited).
    expect(repairTargetForIssue({ code: 'type', path: 'electrode_groups[0].targeted_x' }).surface).toBe('animal');
    expect(repairTargetForIssue({ code: 'required', instancePath: '/cameras/0/lens' }).surface).toBe('animal');
  });

  it('routes a schema subject issue to the Day Editor Overview (where subject is repairable)', () => {
    // Inherited subject fields are edited in the Day Editor Overview, not the Animal
    // Editor (which has no subject step) — schema errors like subject.weight follow.
    expect(repairTargetForIssue({ code: 'required', path: 'subject.weight' }).surface).toBe('day');
    expect(repairTargetForIssue({ code: 'required', path: 'subject.weight' }).step).toBe('overview');
  });

  it('falls back to the day surface for a session/overview schema issue', () => {
    expect(repairTargetForIssue({ code: 'required', path: 'session_description' }).surface).toBe('day');
    expect(repairTargetForIssue({ code: 'required', path: 'session_description' }).step).toBe('overview');
  });

  it('keeps the slash-id schema fallback on the none surface', () => {
    expect(repairTargetForIssue({ code: 'subject_id_slash', path: 'subject.subject_id' }).surface).toBe('none');
  });

  it('prefers an explicit repairSurface over path/code derivation', () => {
    // A subject path would derive to animal, but an explicit day surface wins.
    expect(repairTargetForIssue({ code: 'x', path: 'subject.species', repairSurface: 'day' }).surface).toBe('day');
  });
});

describe('round-4 review fixes', () => {
  it('routes a read-only identity schema path (subject_id/session_id) to the none surface', () => {
    expect(repairTargetForIssue({ code: 'pattern', path: 'subject.subject_id' }).surface).toBe('none');
    expect(repairTargetForIssue({ code: 'pattern', path: 'session_id' }).surface).toBe('none');
  });

  it('validateDay surfaces a stale deviceOverrides.bad_channels key as a rendered issue', () => {
    const day = { deviceOverrides: { bad_channels: { 999: [0] } } };
    const merged = { ntrode_electrode_group_channel_map: [{ ntrode_id: 1, map: { 0: 0 } }] };
    const codes = validateDay(day, merged).map((i) => i.code);
    expect(codes).toContain('stale_bad_channel_override');
  });

  it('validateDay = computeStepStatus issue source (gate and rendered list cannot diverge)', () => {
    const day = { deviceOverrides: { bad_channels: { 999: [0] } } };
    const merged = { ntrode_electrode_group_channel_map: [{ ntrode_id: 1, map: { 0: 0 } }] };
    // The same issue that blocks export is in the rendered list.
    expect(validateDay(day, merged).some((i) => i.code === 'stale_bad_channel_override')).toBe(true);
    expect(computeStepStatus(day, merged).export).toBe('error');
  });
});

describe('round-6 review fixes — every malformed day override is surfaced + day-routed', () => {
  const merged = { ntrode_electrode_group_channel_map: [{ ntrode_id: 1, map: { 0: 0 } }] };

  it('surfaces a non-array electrode_groups override as a day-routed blocker (was silent fail-open)', () => {
    const day = { deviceOverrides: { electrode_groups: 'corrupt' } };
    const issue = validateDay(day, merged).find((i) => i.code === 'malformed_device_override');
    expect(issue).toBeTruthy();
    expect(issue.severity).toBe('error');
    expect(issue.path).toBe('deviceOverrides.electrode_groups');
    expect(repairTargetForIssue(issue).surface).toBe('day');
    expect(repairTargetForIssue(issue).step).toBe('devices');
    expect(computeStepStatus(day, merged).export).toBe('error');
  });

  it('surfaces a non-array ntrode_electrode_group_channel_map override as a day-routed blocker', () => {
    const day = { deviceOverrides: { ntrode_electrode_group_channel_map: 42 } };
    const issue = validateDay(day, merged).find((i) => i.code === 'malformed_device_override');
    expect(issue).toBeTruthy();
    expect(issue.path).toBe('deviceOverrides.ntrode_electrode_group_channel_map');
    expect(repairTargetForIssue(issue).surface).toBe('day');
  });

  it('does NOT surface a malformed_device_override for a well-formed (array) geometry override', () => {
    const day = { deviceOverrides: { electrode_groups: [], ntrode_electrode_group_channel_map: [] } };
    expect(validateDay(day, merged).some((i) => i.code === 'malformed_device_override')).toBe(false);
  });

  it('surfaces a scalar bad_channels CONTAINER ("2.9") as a day-routed blocker (was invisible)', () => {
    const day = { deviceOverrides: { bad_channels: '2.9' } };
    const issue = validateDay(day, merged).find((i) => i.code === 'malformed_bad_channel_override');
    expect(issue).toBeTruthy();
    expect(issue.path).toBe('deviceOverrides.bad_channels');
    expect(repairTargetForIssue(issue).surface).toBe('day');
    expect(repairTargetForIssue(issue).step).toBe('devices');
    expect(computeStepStatus(day, merged).export).toBe('error');
  });

  it('surfaces a non-array VALUE under a VALID ntrode key as a day-routed blocker (was Animal-routed)', () => {
    const day = { deviceOverrides: { bad_channels: { 1: '23' } } };
    const issue = validateDay(day, merged).find((i) => i.code === 'malformed_bad_channel_override');
    expect(issue).toBeTruthy();
    // Key-specific path so repair-focus lands on the clicked ntrode's removal control.
    expect(issue.path).toBe('deviceOverrides.bad_channels.1');
    expect(repairTargetForIssue(issue).surface).toBe('day');
    expect(computeStepStatus(day, merged).export).toBe('error');
  });

  it('does NOT surface malformed_bad_channel_override for a well-formed array value', () => {
    const day = { deviceOverrides: { bad_channels: { 1: [0] } } };
    expect(validateDay(day, merged).some((i) => i.code === 'malformed_bad_channel_override')).toBe(false);
  });

  it('a null/undefined override container is not a blocker', () => {
    expect(validateDay({ deviceOverrides: { bad_channels: null } }, merged).some((i) => i.code === 'malformed_bad_channel_override')).toBe(false);
    expect(validateDay({ deviceOverrides: {} }, merged).some((i) => i.code?.startsWith('malformed_')).valueOf()).toBe(false);
  });
});

describe('round-7 review fixes — top-level, shadowed-geometry, and key-specific overrides', () => {
  const merged = { ntrode_electrode_group_channel_map: [{ ntrode_id: 1, map: { 0: 0 } }] };

  it('surfaces a non-record top-level deviceOverrides (scalar) as a day-routed blocker (was fail-open)', () => {
    const day = { deviceOverrides: 'corrupt' };
    const issue = validateDay(day, merged).find((i) => i.code === 'malformed_device_override');
    expect(issue).toBeTruthy();
    expect(issue.path).toBe('deviceOverrides');
    expect(repairTargetForIssue(issue).surface).toBe('day');
    expect(repairTargetForIssue(issue).step).toBe('devices');
    expect(computeStepStatus(day, merged).export).toBe('error');
  });

  it('surfaces a non-record top-level deviceOverrides (array) too', () => {
    const issues = validateDay({ deviceOverrides: [1, 2] }, merged);
    expect(issues.some((i) => i.code === 'malformed_device_override' && i.path === 'deviceOverrides')).toBe(true);
  });

  it('surfaces a shadowed (valid-array) geometry override whose CONTENTS error as a day-routed escape', () => {
    // A merged with a content-invalid electrode group → schema errors on an electrode_groups
    // path. With a day-level array geometry override active, those errors mis-route to the
    // Animal Editor (which edits the snapshot, not the override) → dead-end. Surface a
    // day-routed removable escape.
    const erroringMerged = { electrode_groups: [{ id: 0 }], ntrode_electrode_group_channel_map: [] };
    const day = { deviceOverrides: { electrode_groups: [{ id: 0 }] } };
    const issue = validateDay(day, erroringMerged).find((i) => i.code === 'shadowed_geometry_override');
    expect(issue).toBeTruthy();
    expect(issue.path).toBe('deviceOverrides.electrode_groups');
    expect(repairTargetForIssue(issue).surface).toBe('day');
    expect(repairTargetForIssue(issue).step).toBe('devices');
  });

  it('does NOT surface shadowed_geometry_override for a CLEAN array geometry override (no base errors)', () => {
    expect(
      dayOverrideIssues({ deviceOverrides: { electrode_groups: [{ id: 0 }] } }, {}, []).some(
        (i) => i.code === 'shadowed_geometry_override'
      )
    ).toBe(false);
  });

  it('keys stale + corrupt-value bad_channel issues by ntrode id for precise repair focus', () => {
    const stale = validateDay({ deviceOverrides: { bad_channels: { 999: [0] } } }, merged).find(
      (i) => i.code === 'stale_bad_channel_override'
    );
    expect(stale.path).toBe('deviceOverrides.bad_channels.999');
    const corrupt = validateDay({ deviceOverrides: { bad_channels: { 1: '23' } } }, merged).find(
      (i) => i.code === 'malformed_bad_channel_override'
    );
    expect(corrupt.path).toBe('deviceOverrides.bad_channels.1');
  });
});

describe('Boundary 1 — raw-shape gate folded into validateDay / step status', () => {
  const merged = { ntrode_electrode_group_channel_map: [] };

  it('validateDay surfaces a malformed day-owned collection (was laundered to [] and invisible)', () => {
    const day = { tasks: {}, session: { session_id: 's', session_description: 'd' } };
    const issue = validateDay(day, merged).find((i) => i.code === 'malformed_day_collection');
    expect(issue).toBeTruthy();
    expect(issue.field).toBe('tasks');
    expect(repairTargetForIssue(issue).surface).toBe('day');
    expect(repairTargetForIssue(issue).step).toBe('epochs');
  });

  it('a malformed tasks shape blocks export via computeStepStatus (raw shape, not merged)', () => {
    const day = { tasks: {} };
    expect(computeStepStatus(day, merged).export).toBe('error');
    // And the Epochs step reflects it as an error, not a false "incomplete"/"valid".
    expect(computeStepStatus(day, merged).epochs).toBe('error');
  });

  it('computeEpochsStatus treats a non-array tasks as error, not valid/incomplete', () => {
    expect(computeEpochsStatus({ tasks: {} }, [])).toBe('error');
    expect(computeEpochsStatus({ tasks: [] }, [])).toBe('incomplete');
  });

  it('a clean day with array collections raises no malformed_day_collection', () => {
    const day = { tasks: [], associated_files: [], keywords: [] };
    expect(validateDay(day, merged).some((i) => i.code === 'malformed_day_collection')).toBe(false);
  });
});
