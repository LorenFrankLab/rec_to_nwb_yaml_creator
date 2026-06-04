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
});
