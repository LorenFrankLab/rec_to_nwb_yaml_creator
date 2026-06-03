import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BehavioralEventsDisplay from '../BehavioralEventsDisplay';

const inherited = [
  { name: 'reward_well', description: 'Reward delivered at well' },
  { name: 'stim_trigger', description: 'Stimulation trigger' },
];

describe('BehavioralEventsDisplay', () => {
  it('renders inherited events with a lock cue and no edit/delete controls', () => {
    render(
      <BehavioralEventsDisplay
        inheritedEvents={inherited}
        dayEvents={[]}
        onDayEventsChange={vi.fn()}
      />
    );

    const list = screen.getByRole('list', { name: /inherited behavioral events/i });
    expect(within(list).getByText('reward_well')).toBeInTheDocument();
    expect(within(list).getByText('stim_trigger')).toBeInTheDocument();

    // Inherited rows expose an accessible "read-only" cue and carry no controls.
    expect(within(list).queryByRole('button')).not.toBeInTheDocument();
    expect(within(list).getAllByText(/inherited, read-only/i)).toHaveLength(2);
  });

  it('does not render a day-specific editing section in read-only mode', () => {
    render(
      <BehavioralEventsDisplay
        inheritedEvents={inherited}
        dayEvents={[]}
        onDayEventsChange={vi.fn()}
        readOnly
      />
    );

    expect(screen.getByText('reward_well')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /add day-specific event/i })
    ).not.toBeInTheDocument();
  });

  it('adds a day-specific event through onDayEventsChange', async () => {
    const user = userEvent.setup();
    const onDayEventsChange = vi.fn();
    render(
      <BehavioralEventsDisplay
        inheritedEvents={inherited}
        dayEvents={[]}
        onDayEventsChange={onDayEventsChange}
      />
    );

    await user.click(screen.getByRole('button', { name: /add day-specific event/i }));
    await user.type(screen.getByRole('textbox', { name: /event name/i }), 'extra_event');
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    expect(onDayEventsChange).toHaveBeenCalledWith([
      { name: 'extra_event', description: '' },
    ]);
  });

  it('flags a day-specific event that duplicates an inherited name (non-blocking)', () => {
    render(
      <BehavioralEventsDisplay
        inheritedEvents={inherited}
        dayEvents={[{ name: 'reward_well', description: 'overrides reward' }]}
        onDayEventsChange={vi.fn()}
      />
    );

    // The duplicate is flagged as a warning...
    const warning = screen.getByRole('status');
    expect(warning).toHaveTextContent(/reward_well/i);
    expect(warning).toHaveTextContent(/inherited/i);

    // ...but it is still shown (non-blocking — not removed or hidden).
    const dayList = screen.getByRole('list', { name: /day-specific behavioral events/i });
    expect(within(dayList).getByText('reward_well')).toBeInTheDocument();
  });
});
