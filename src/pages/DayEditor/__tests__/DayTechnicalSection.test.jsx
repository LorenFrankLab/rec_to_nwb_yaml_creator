import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DayTechnicalSection from '../DayTechnicalSection';

describe('DayTechnicalSection', () => {
  it('seeds fields from day.technical', () => {
    render(
      <DayTechnicalSection
        technical={{ default_header_file_path: '/x/config.trodesconf', units: { analog: 'volts', behavioral_events: 'na' } }}
        onFieldUpdate={vi.fn()}
      />
    );
    expect(screen.getByDisplayValue('/x/config.trodesconf')).toBeInTheDocument();
    expect(screen.getByDisplayValue('volts')).toBeInTheDocument();
    expect(screen.getByDisplayValue('na')).toBeInTheDocument();
  });

  it('writes default_header_file_path to day.technical on blur', async () => {
    const user = userEvent.setup();
    const onFieldUpdate = vi.fn();
    render(<DayTechnicalSection technical={{}} onFieldUpdate={onFieldUpdate} />);

    await user.type(screen.getByLabelText(/default header file path/i), '/data/h.trodesconf');
    await user.tab();

    expect(onFieldUpdate).toHaveBeenCalledWith('technical.default_header_file_path', '/data/h.trodesconf');
  });

  it('writes units as a whole object when set', async () => {
    const user = userEvent.setup();
    const onFieldUpdate = vi.fn();
    render(<DayTechnicalSection technical={{}} onFieldUpdate={onFieldUpdate} />);

    await user.type(screen.getByLabelText(/analog units/i), 'volts');
    await user.type(screen.getByLabelText(/behavioral-event units/i), 'unspecified');
    await user.tab();

    expect(onFieldUpdate).toHaveBeenCalledWith('technical.units', { analog: 'volts', behavioral_events: 'unspecified' });
  });

  it('does not persist partial units', async () => {
    const user = userEvent.setup();
    const onFieldUpdate = vi.fn();
    render(<DayTechnicalSection technical={{}} onFieldUpdate={onFieldUpdate} />);

    await user.type(screen.getByLabelText(/analog units/i), 'volts');
    await user.tab();

    expect(screen.getByRole('alert')).toHaveTextContent(/enter both analog and behavioral-event units/i);
    expect(onFieldUpdate).not.toHaveBeenCalledWith('technical.units', expect.anything());
  });

  it('clears units to undefined when both fields are blank (so export omits it)', async () => {
    const user = userEvent.setup();
    const onFieldUpdate = vi.fn();
    render(
      <DayTechnicalSection technical={{ units: { analog: 'volts', behavioral_events: 'na' } }} onFieldUpdate={onFieldUpdate} />
    );

    await user.clear(screen.getByLabelText(/analog units/i));
    await user.clear(screen.getByLabelText(/behavioral-event units/i));
    await user.tab();

    expect(onFieldUpdate).toHaveBeenCalledWith('technical.units', undefined);
  });

  // Phase 8.7 Task 4: the rig constants (raw_data_to_volts / times_period_multiplier) are
  // recording-system defaults copied into the day — shown here as effective, READ-ONLY values
  // (not routine day edits), labelled against the CURRENT recording-system default.
  describe('rig constants (effective recording-system values)', () => {
    const DEFAULTS = { raw_data_to_volts: 0.195, times_period_multiplier: 1.5 };

    it('shows the effective values and reads "Using recording-system default" when they match', () => {
      render(
        <DayTechnicalSection
          technical={{ raw_data_to_volts: 0.195, times_period_multiplier: 1.5, default_header_file_path: '' }}
          recordingSystemDefaults={DEFAULTS}
          animalKey="remy"
          onFieldUpdate={vi.fn()}
        />
      );
      expect(screen.getByText('0.195')).toBeInTheDocument();
      expect(screen.getByText('1.5')).toBeInTheDocument();
      expect(screen.getAllByText(/using recording-system default/i).length).toBe(2);
      // Not editable here — there is no number input for the rig constants.
      expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    });

    it('labels a day value that no longer matches the current default (no silent retroactive)', () => {
      render(
        <DayTechnicalSection
          technical={{ raw_data_to_volts: 0.195, times_period_multiplier: 1.5 }}
          // The recording-system default was changed to 0.2 AFTER this day was created; the day
          // keeps its copied 0.195 and must say so, not silently read as "using default".
          recordingSystemDefaults={{ raw_data_to_volts: 0.2, times_period_multiplier: 1.5 }}
          animalKey="remy"
          onFieldUpdate={vi.fn()}
        />
      );
      expect(screen.getByText('0.195')).toBeInTheDocument();
      expect(
        screen.getByText(/different from current recording-system default \(current default: 0\.2\)/i)
      ).toBeInTheDocument();
      // The unchanged one still reads as using the default.
      expect(screen.getByText(/using recording-system default/i)).toBeInTheDocument();
    });

    it('routes editing of the rig constants to the Recording System step (not a day edit)', () => {
      render(
        <DayTechnicalSection technical={DEFAULTS} recordingSystemDefaults={DEFAULTS} animalKey="remy" onFieldUpdate={vi.fn()} />
      );
      const link = screen.getByRole('link', { name: /edit in recording system/i });
      // Pin the field target: ?field=data_acq_device deep-links to the Recording System step
      // (animalEditorStepForFieldPath: path.includes('data_acq') → step 3). A wrong keyword would
      // mis-route, so the component's field choice is load-bearing.
      expect(link.getAttribute('href')).toBe('#/animal/remy/recording-system?field=data_acq_device');
    });

    it('flags a rig constant that is not set on the day (defense-in-depth: would fail export)', () => {
      // createDayRecord always seeds these, so an absent value only arises from corrupt/migrated
      // state — the export reads day.technical[field] directly with no omit-guard, so undefined
      // fails the schema's required check. Surface that, don't falsely reassure "using default".
      render(
        <DayTechnicalSection
          technical={{ default_header_file_path: '' }}
          recordingSystemDefaults={DEFAULTS}
          animalKey="remy"
          onFieldUpdate={vi.fn()}
        />
      );
      expect(screen.getAllByText(/missing on this recording day — required for export/i)).toHaveLength(2);
      // It must NOT claim "using recording-system default" for an unset value, nor steer to the
      // animal default (which doesn't backfill an existing day).
      expect(screen.queryByText(/using recording-system default/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/set the recording-system default/i)).not.toBeInTheDocument();
    });

    it('keeps default_header_file_path a day-only, editable fact', async () => {
      const user = userEvent.setup();
      const onFieldUpdate = vi.fn();
      render(
        <DayTechnicalSection technical={DEFAULTS} recordingSystemDefaults={DEFAULTS} animalKey="remy" onFieldUpdate={onFieldUpdate} />
      );
      expect(screen.getByText(/this day only/i)).toBeInTheDocument();
      const input = screen.getByLabelText(/default header file path/i);
      await user.type(input, '/d/h.trodesconf');
      await user.tab();
      expect(onFieldUpdate).toHaveBeenCalledWith('technical.default_header_file_path', '/d/h.trodesconf');
    });
  });
});
