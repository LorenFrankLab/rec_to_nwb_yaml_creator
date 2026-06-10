import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BehavioralEventsDisplay from '../BehavioralEventsDisplay';

/**
 * The day owns its behavioral (DIO) events, presented as the ECU's hardware channel grid: every
 * digital channel (Din1–32 inputs, Dout1–32 outputs) is a row, and the user names the channels their
 * rig uses. A named channel is a real event; a blank channel is unused and is not exported. Names
 * must be unique. An imported non-standard channel is preserved in an "Other" group.
 */

/**
 * Controlled harness: BehavioralEventsDisplay is controlled (the parent owns the day events). This
 * threads each update back into the prop (as TasksEpochsStep does) and forwards to the spy.
 * @param {object} props
 * @param {Array} props.initialDayEvents - Starting day events.
 * @param {Function} props.spy - Spy invoked with each next day-events array.
 * @returns {JSX.Element}
 */
function ControlledHarness({ initialDayEvents, spy }) {
  const [dayEvents, setDayEvents] = useState(initialDayEvents);
  return (
    <BehavioralEventsDisplay
      dayEvents={dayEvents}
      onDayEventsChange={(next) => {
        spy(next);
        setDayEvents(next);
      }}
    />
  );
}

describe('BehavioralEventsDisplay — channel grid', () => {
  it('renders all 32 Din inputs and 32 Dout outputs as rows', () => {
    render(<BehavioralEventsDisplay dayEvents={[]} onDayEventsChange={vi.fn()} />);
    expect(screen.getByRole('table', { name: /inputs \(din\)/i })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: /outputs \(dout\)/i })).toBeInTheDocument();
    // First and last channel of each direction exist; 33 does not (the ECU has 32).
    expect(screen.getByLabelText('Event for Din1')).toBeInTheDocument();
    expect(screen.getByLabelText('Event for Din32')).toBeInTheDocument();
    expect(screen.getByLabelText('Event for Dout1')).toBeInTheDocument();
    expect(screen.getByLabelText('Event for Dout32')).toBeInTheDocument();
    expect(screen.queryByLabelText('Event for Din33')).not.toBeInTheDocument();
  });

  it('overlays existing events onto their channels (blank channels stay empty)', () => {
    render(
      <BehavioralEventsDisplay
        dayEvents={[
          { description: 'Din1', name: 'Poke1' },
          { description: 'Dout7', name: 'Pump1' },
        ]}
        onDayEventsChange={vi.fn()}
      />
    );
    expect(screen.getByLabelText('Event for Din1')).toHaveValue('Poke1');
    expect(screen.getByLabelText('Event for Dout7')).toHaveValue('Pump1');
    expect(screen.getByLabelText('Event for Din2')).toHaveValue(''); // unused channel
  });

  it('names a channel by typing, writing {description, name} through onDayEventsChange', async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(<ControlledHarness initialDayEvents={[]} spy={spy} />);

    await user.type(screen.getByLabelText('Event for Din3'), 'beam');
    expect(spy).toHaveBeenLastCalledWith([{ description: 'Din3', name: 'beam' }]);
  });

  it('removes a channel from the set when its name is blanked (unused → not exported)', async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(
      <ControlledHarness initialDayEvents={[{ description: 'Din1', name: 'Poke1' }]} spy={spy} />
    );

    await user.clear(screen.getByLabelText('Event for Din1'));
    expect(spy).toHaveBeenLastCalledWith([]);
    expect(screen.getByLabelText('Event for Din1')).toHaveValue('');
  });

  it('flags a duplicate name across two channels (Spyglass DIOEvents PK collision)', () => {
    render(
      <BehavioralEventsDisplay
        dayEvents={[
          { description: 'Din1', name: 'Poke1' },
          { description: 'Din2', name: 'Poke1' },
        ]}
        onDayEventsChange={vi.fn()}
      />
    );
    const alerts = screen.getAllByText(/used by more than one channel/i);
    expect(alerts).toHaveLength(2);
    expect(screen.getByLabelText('Event for Din1')).toHaveAttribute('aria-invalid', 'true');
  });

  it('flags a duplicate channel/description (downstream hard crash)', () => {
    render(
      <BehavioralEventsDisplay
        dayEvents={[
          { name: 'poke_a', description: 'nose poke' },
          { name: 'poke_b', description: 'nose poke' },
        ]}
        onDayEventsChange={vi.fn()}
      />
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      /channel "nose poke".*more than one|unique channel/i
    );
  });

  it('does NOT flag descriptions that differ only by trailing whitespace (matches the export gate)', () => {
    render(
      <BehavioralEventsDisplay
        dayEvents={[{ name: 'a', description: 'nose poke' }, { name: 'b', description: 'nose poke ' }]}
        onDayEventsChange={vi.fn()}
      />
    );
    expect(screen.queryByText(/more than one event/i)).not.toBeInTheDocument();
  });

  it('preserves an imported non-standard channel in an "Other" group', () => {
    render(
      <BehavioralEventsDisplay
        dayEvents={[{ description: 'Accel5', name: 'imu' }]}
        onDayEventsChange={vi.fn()}
      />
    );
    const other = screen.getByRole('table', { name: /other/i });
    expect(within(other).getByText('Accel5')).toBeInTheDocument();
    expect(screen.getByLabelText('Event for Accel5')).toHaveValue('imu');
  });

  it('shows a direction legend (Din = inputs, Dout = outputs), not emoji-only', () => {
    render(<BehavioralEventsDisplay dayEvents={[]} onDayEventsChange={vi.fn()} />);
    expect(screen.getByText(/din\b.*input|input.*\bdin\b/i)).toBeInTheDocument();
    expect(screen.getByText(/dout\b.*output|output.*\bdout\b/i)).toBeInTheDocument();
  });

  it('tolerates a non-array dayEvents without crashing', () => {
    expect(() =>
      render(<BehavioralEventsDisplay dayEvents={{}} onDayEventsChange={vi.fn()} />)
    ).not.toThrow();
  });
});

describe('BehavioralEventsDisplay — per-label auto-numbering (onSelect)', () => {
  it('picking a known name into a pokeless set auto-numbers it to Poke1', async () => {
    const user = userEvent.setup();
    render(<ControlledHarness initialDayEvents={[]} spy={vi.fn()} />);

    await user.click(screen.getByLabelText('Event for Din1'));
    await user.click(screen.getByRole('option', { name: 'Poke' }));
    expect(screen.getByLabelText('Event for Din1')).toHaveValue('Poke1');
  });

  it('picking the same name on another channel yields the next instance (Poke2)', async () => {
    const user = userEvent.setup();
    render(
      <ControlledHarness initialDayEvents={[{ description: 'Din1', name: 'Poke1' }]} spy={vi.fn()} />
    );

    await user.click(screen.getByLabelText('Event for Din2'));
    await user.click(screen.getByRole('option', { name: 'Poke' }));
    expect(screen.getByLabelText('Event for Din2')).toHaveValue('Poke2');
  });

  it('derives the number from the label, not the channel (Pump on Dout7 → Pump1)', async () => {
    const user = userEvent.setup();
    render(<ControlledHarness initialDayEvents={[]} spy={vi.fn()} />);

    await user.click(screen.getByLabelText('Event for Dout7'));
    await user.click(screen.getByRole('option', { name: 'Pump' }));
    expect(screen.getByLabelText('Event for Dout7')).toHaveValue('Pump1');
  });

  it('keeps a typed name verbatim — typing never auto-numbers', async () => {
    const user = userEvent.setup();
    render(<ControlledHarness initialDayEvents={[]} spy={vi.fn()} />);

    await user.type(screen.getByLabelText('Event for Din1'), 'Poke');
    // A free-typed "Poke" stays "Poke" — not promoted to "Poke1" (that only happens on a pick).
    expect(screen.getByLabelText('Event for Din1')).toHaveValue('Poke');
  });
});

describe('BehavioralEventsDisplay — off-list nudge respects numbered variants', () => {
  it('does NOT nudge an auto-numbered name like "Poke1" as non-standard', () => {
    render(
      <BehavioralEventsDisplay
        dayEvents={[{ description: 'Din1', name: 'Poke1' }]}
        onDayEventsChange={vi.fn()}
      />
    );
    expect(screen.queryByText(/not a standard event name/i)).not.toBeInTheDocument();
  });

  it('still nudges a free-typed off-list name like "beam_break"', () => {
    render(
      <BehavioralEventsDisplay
        dayEvents={[{ description: 'Din1', name: 'beam_break' }]}
        onDayEventsChange={vi.fn()}
      />
    );
    expect(screen.getByText(/not a standard event name/i)).toBeInTheDocument();
  });
});
