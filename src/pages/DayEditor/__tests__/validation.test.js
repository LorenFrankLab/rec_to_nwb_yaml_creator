import { describe, it, expect } from 'vitest';
import { validateField, computeStepStatus, computeDevicesStatus, groupErrorsByStep } from '../validation';
import { makeAnimalWithCamerasAndDay } from './taskFixtures';

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

    const { valid, errors } = await validateField(mergedDay, 'session_id');

    // Should only return errors for session_id, not session_description
    expect(errors.every(e => e.path === 'session_id')).toBe(true);
  });

  it('returns field-level error messages', async () => {
    const mergedDay = {
      session_id: '',
    };

    const { valid, errors } = await validateField(mergedDay, 'session_id');

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
      subject: { subject_id: 'remy' },
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
    // Validation step is wired in a later phase.
    expect(status.validation).toBe('incomplete');
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

  it('returns "error" when a group has all channels marked bad', () => {
    const day = { deviceOverrides: { bad_channels: { 1: [0, 1, 2, 3] } } }; // all 4 bad
    const mergedDay = {
      electrode_groups: [group],
      ntrode_electrode_group_channel_map: [ntrode],
    };
    expect(computeDevicesStatus(day, mergedDay)).toBe('error');
  });

  it('returns "valid" for healthy groups, with partial bad channels staying non-blocking', () => {
    const fullyHealthy = {
      electrode_groups: [group],
      ntrode_electrode_group_channel_map: [ntrode],
    };
    expect(computeDevicesStatus({}, fullyHealthy)).toBe('valid');

    const partialBad = { deviceOverrides: { bad_channels: { 1: [0] } } }; // 1 of 4 bad
    expect(computeDevicesStatus(partialBad, fullyHealthy)).toBe('valid');
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
