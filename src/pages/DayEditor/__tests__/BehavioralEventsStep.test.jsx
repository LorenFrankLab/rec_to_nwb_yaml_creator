import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BehavioralEventsStep from '../BehavioralEventsStep';

/**
 * BehavioralEventsStep is the Day Editor's Behavioral Events tab — a thin host around the DIO
 * channel grid. It reads the day's events and writes changes back through onFieldUpdate. The full
 * grid behavior is covered at the BehavioralEventsDisplay component level.
 */
describe('BehavioralEventsStep', () => {
  it('renders the Behavioral Events heading and the channel grid', () => {
    render(<BehavioralEventsStep day={{ behavioral_events: [] }} onFieldUpdate={vi.fn()} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Behavioral Events' })).toBeInTheDocument();
    expect(screen.getByLabelText('Event for Din1')).toBeInTheDocument();
  });

  it('overlays the day\'s events and writes changes through onFieldUpdate', async () => {
    const user = userEvent.setup();
    const onFieldUpdate = vi.fn();
    render(
      <BehavioralEventsStep
        day={{ behavioral_events: [{ description: 'Dout7', name: 'Pump1' }] }}
        onFieldUpdate={onFieldUpdate}
      />
    );

    expect(screen.getByLabelText('Event for Dout7')).toHaveValue('Pump1');

    // Naming a channel writes the next events array back through onFieldUpdate('behavioral_events').
    await user.click(screen.getByLabelText('Event for Din1'));
    await user.click(screen.getByRole('option', { name: 'Poke' }));
    expect(onFieldUpdate).toHaveBeenLastCalledWith('behavioral_events', [
      { description: 'Dout7', name: 'Pump1' },
      { description: 'Din1', name: 'Poke1' },
    ]);
  });

  it('tolerates a corrupt (non-array) behavioral_events without crashing', () => {
    expect(() =>
      render(<BehavioralEventsStep day={{ behavioral_events: {} }} onFieldUpdate={vi.fn()} />)
    ).not.toThrow();
  });
});
