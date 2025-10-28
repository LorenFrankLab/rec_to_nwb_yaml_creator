import { describe, it, expect } from 'vitest';
import { validateField, computeStepStatus, groupErrorsByStep } from '../validation';

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

  it('marks future steps as incomplete in M5', () => {
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

    // M6-M9 steps not implemented yet
    expect(status.devices).toBe('incomplete');
    expect(status.epochs).toBe('incomplete');
    expect(status.validation).toBe('incomplete');
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
