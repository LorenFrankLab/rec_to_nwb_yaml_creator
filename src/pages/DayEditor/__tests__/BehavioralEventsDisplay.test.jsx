import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BehavioralEventsDisplay from '../BehavioralEventsDisplay';

/**
 * Controlled harness: BehavioralEventsDisplay is controlled (the parent owns the day events). This
 * threads each update back into the prop (as the Day Editor does) and forwards to the spy.
 *
 * @param {object} root0 - Harness props.
 * @param {Array} root0.initialDayEvents - Starting day behavioral events.
 * @param {Function} root0.spy - Spy invoked with each updated behavioral-events array.
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

/**
 * Opens the advanced full ECU grid.
 *
 * @param {ReturnType<typeof userEvent.setup>} user - Testing Library user-event instance.
 * @returns {Promise<void>}
 */
async function openAdvancedGrid(user) {
  await user.click(screen.getByText(/advanced: show all ECU lines/i));
}

/**
 * Fills the compact "Add DIO line" controls.
 *
 * @param {ReturnType<typeof userEvent.setup>} user - Testing Library user-event instance.
 * @param {object} options - New-line values.
 * @param {string} [options.type='Din'] - DIO line type.
 * @param {number} [options.index=1] - DIO line index.
 * @param {string} [options.typedName] - Free-typed event name.
 * @param {string} [options.option] - Suggested event name to pick.
 * @returns {Promise<void>}
 */
async function setNewLine(user, { type = 'Din', index = 1, typedName, option }) {
  await user.selectOptions(screen.getByLabelText('Type'), type);
  const indexField = screen.getByLabelText('Index');
  await user.clear(indexField);
  await user.type(indexField, String(index));

  const nameField = screen.getByLabelText('New DIO event name');
  await user.clear(nameField);
  if (option) {
    await user.click(nameField);
    await user.click(screen.getByRole('option', { name: option }));
  } else {
    await user.type(nameField, typedName);
  }
}

describe('BehavioralEventsDisplay - focused named-lines editor', () => {
  it('starts on named DIO lines and keeps the full ECU grid behind Advanced', async () => {
    const user = userEvent.setup();
    render(<BehavioralEventsDisplay dayEvents={[]} onDayEventsChange={vi.fn()} />);

    expect(screen.getByRole('heading', { level: 4, name: /named dio lines/i })).toBeInTheDocument();
    expect(screen.getByLabelText('New DIO event name')).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: /inputs \(din\)/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Advanced event for Din1')).not.toBeInTheDocument();

    await openAdvancedGrid(user);

    expect(screen.getByRole('table', { name: /inputs \(din\)/i })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: /outputs \(dout\)/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Advanced event for Din1')).toBeInTheDocument();
    expect(screen.getByLabelText('Advanced event for Din32')).toBeInTheDocument();
    expect(screen.getByLabelText('Advanced event for Dout1')).toBeInTheDocument();
    expect(screen.getByLabelText('Advanced event for Dout32')).toBeInTheDocument();
    expect(screen.queryByLabelText('Advanced event for Din33')).not.toBeInTheDocument();
  });

  it('overlays existing events onto named rows and the advanced grid', async () => {
    const user = userEvent.setup();
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
    expect(screen.queryByLabelText('Event for Din2')).not.toBeInTheDocument();

    await openAdvancedGrid(user);

    expect(screen.getByLabelText('Advanced event for Din2')).toHaveValue('');
    expect(screen.getByLabelText('Advanced event for Dout7')).toHaveValue('Pump1');
  });

  it('adds a used line from the compact controls', async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(<ControlledHarness initialDayEvents={[]} spy={spy} />);

    await setNewLine(user, { index: 3, typedName: 'beam' });
    await user.click(screen.getByRole('button', { name: /add line/i }));

    expect(spy).toHaveBeenLastCalledWith([{ description: 'Din3', name: 'beam' }]);
    expect(screen.getByLabelText('Event for Din3')).toHaveValue('beam');
  });

  it('removes a named channel when its name is blanked', async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(
      <ControlledHarness initialDayEvents={[{ description: 'Din1', name: 'Poke1' }]} spy={spy} />
    );

    await user.clear(screen.getByLabelText('Event for Din1'));

    expect(spy).toHaveBeenLastCalledWith([]);
    expect(screen.queryByLabelText('Event for Din1')).not.toBeInTheDocument();
  });

  it('flags a duplicate name across two named channels', () => {
    render(
      <BehavioralEventsDisplay
        dayEvents={[
          { description: 'Din1', name: 'Poke1' },
          { description: 'Din2', name: 'Poke1' },
        ]}
        onDayEventsChange={vi.fn()}
      />
    );

    const namedTable = screen.getByRole('table', { name: /named dio lines/i });
    expect(within(namedTable).getAllByText(/used by more than one channel/i)).toHaveLength(2);
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

  it('does NOT flag a duplicate channel when the colliding partner is blank', () => {
    render(
      <BehavioralEventsDisplay
        dayEvents={[
          { description: 'Din1', name: 'Poke1' },
          { description: 'Din1', name: '' },
        ]}
        onDayEventsChange={vi.fn()}
      />
    );
    expect(screen.queryByText(/more than one event/i)).not.toBeInTheDocument();
  });

  it('does NOT flag descriptions that differ only by trailing whitespace', () => {
    render(
      <BehavioralEventsDisplay
        dayEvents={[{ name: 'a', description: 'nose poke' }, { name: 'b', description: 'nose poke ' }]}
        onDayEventsChange={vi.fn()}
      />
    );
    expect(screen.queryByText(/more than one event/i)).not.toBeInTheDocument();
  });

  it('preserves an imported non-standard channel in an Other group', () => {
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

  it('shows a direction legend (Din = inputs, Dout = outputs), not symbol-only', () => {
    render(<BehavioralEventsDisplay dayEvents={[]} onDayEventsChange={vi.fn()} />);
    const legend = document.querySelector('#dio-direction-legend');
    expect(legend).toHaveTextContent(/din\b.*input|input.*\bdin\b/i);
    expect(legend).toHaveTextContent(/dout\b.*output|output.*\bdout\b/i);
  });

  it('tolerates a non-array dayEvents without crashing', () => {
    expect(() =>
      render(<BehavioralEventsDisplay dayEvents={{}} onDayEventsChange={vi.fn()} />)
    ).not.toThrow();
  });

  it('tolerates corrupt non-string event names without crashing', async () => {
    const user = userEvent.setup();
    expect(() =>
      render(
        <BehavioralEventsDisplay
          dayEvents={[
            { description: 'Din1', name: 5 },
            { description: 'Accel9', name: 7 },
          ]}
          onDayEventsChange={vi.fn()}
        />
      )
    ).not.toThrow();

    expect(screen.queryByLabelText('Event for Din1')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Event for Accel9')).toHaveValue('');

    await openAdvancedGrid(user);
    expect(screen.getByLabelText('Advanced event for Din1')).toHaveValue('');
  });
});

describe('BehavioralEventsDisplay - per-label auto-numbering', () => {
  it('picking a known name into a pokeless set auto-numbers it to Poke1', async () => {
    const user = userEvent.setup();
    render(<ControlledHarness initialDayEvents={[]} spy={vi.fn()} />);

    await setNewLine(user, { option: 'Poke' });

    expect(screen.getByLabelText('New DIO event name')).toHaveValue('Poke1');
    await user.click(screen.getByRole('button', { name: /add line/i }));
    expect(screen.getByLabelText('Event for Din1')).toHaveValue('Poke1');
  });

  it('picking the same name on another channel yields the next instance (Poke2)', async () => {
    const user = userEvent.setup();
    render(
      <ControlledHarness initialDayEvents={[{ description: 'Din1', name: 'Poke1' }]} spy={vi.fn()} />
    );

    await setNewLine(user, { index: 2, option: 'Poke' });

    expect(screen.getByLabelText('New DIO event name')).toHaveValue('Poke2');
    await user.click(screen.getByRole('button', { name: /add line/i }));
    expect(screen.getByLabelText('Event for Din2')).toHaveValue('Poke2');
  });

  it('derives the number from the label, not the channel (Pump on Dout7 -> Pump1)', async () => {
    const user = userEvent.setup();
    render(<ControlledHarness initialDayEvents={[]} spy={vi.fn()} />);

    await setNewLine(user, { type: 'Dout', index: 7, option: 'Pump' });

    expect(screen.getByLabelText('New DIO event name')).toHaveValue('Pump1');
    await user.click(screen.getByRole('button', { name: /add line/i }));
    expect(screen.getByLabelText('Event for Dout7')).toHaveValue('Pump1');
  });

  it('suggests only input events for Din and only output events for Dout', async () => {
    const user = userEvent.setup();
    render(<ControlledHarness initialDayEvents={[]} spy={vi.fn()} />);

    const nameField = screen.getByLabelText('New DIO event name');
    await user.click(nameField);
    expect(screen.getByRole('option', { name: 'Poke' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Run_Camera_Ticks' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Light' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Pump' })).not.toBeInTheDocument();

    await user.keyboard('{Escape}');
    await user.selectOptions(screen.getByLabelText('Type'), 'Dout');
    await user.click(nameField);
    expect(screen.getByRole('option', { name: 'Light' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Pump' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Poke' })).not.toBeInTheDocument();
  });

  it('keeps a typed name verbatim; typing never auto-numbers', async () => {
    const user = userEvent.setup();
    render(<ControlledHarness initialDayEvents={[]} spy={vi.fn()} />);

    await user.type(screen.getByLabelText('New DIO event name'), 'Poke');
    expect(screen.getByLabelText('New DIO event name')).toHaveValue('Poke');
  });

  it('re-picking the same label on a named channel excludes itself', async () => {
    const user = userEvent.setup();
    render(
      <ControlledHarness initialDayEvents={[{ description: 'Din1', name: 'Poke1' }]} spy={vi.fn()} />
    );

    await user.click(screen.getByLabelText('Event for Din1'));
    await user.click(screen.getByRole('option', { name: 'Poke' }));
    expect(screen.getByLabelText('Event for Din1')).toHaveValue('Poke1');
  });
});

describe('BehavioralEventsDisplay - copy from another animal', () => {
  const sources = [
    {
      id: 'remy',
      name: 'remy',
      date: '2023-06-22',
      events: [
        { description: 'Din1', name: 'Poke1' },
        { description: 'Dout7', name: 'Pump1' },
      ],
    },
  ];

  it('offers a Copy from <animal> CTA when the day is empty and sources exist', () => {
    render(
      <BehavioralEventsDisplay dayEvents={[]} onDayEventsChange={vi.fn()} copyableSources={sources} />
    );
    expect(screen.getByRole('button', { name: /copy from remy/i })).toBeInTheDocument();
  });

  it('copying seeds the day with a deep clone of the source events', async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(
      <BehavioralEventsDisplay dayEvents={[]} onDayEventsChange={spy} copyableSources={sources} />
    );
    await user.click(screen.getByRole('button', { name: /copy from remy/i }));
    expect(spy).toHaveBeenCalledWith(sources[0].events);
    expect(spy.mock.calls[0][0]).not.toBe(sources[0].events);
    expect(spy.mock.calls[0][0][0]).not.toBe(sources[0].events[0]);
  });

  it('does NOT offer the copy CTA once the day already has events', () => {
    render(
      <BehavioralEventsDisplay
        dayEvents={[{ description: 'Din1', name: 'X' }]}
        onDayEventsChange={vi.fn()}
        copyableSources={sources}
      />
    );
    expect(screen.queryByRole('button', { name: /copy from remy/i })).not.toBeInTheDocument();
  });

  it('shows no copy CTA when there are no sources', () => {
    render(
      <BehavioralEventsDisplay dayEvents={[]} onDayEventsChange={vi.fn()} copyableSources={[]} />
    );
    expect(screen.queryByText(/copy from/i)).not.toBeInTheDocument();
  });
});

describe('BehavioralEventsDisplay - off-list nudge', () => {
  it('does NOT nudge an auto-numbered name like Poke1 as non-standard', () => {
    render(
      <BehavioralEventsDisplay
        dayEvents={[{ description: 'Din1', name: 'Poke1' }]}
        onDayEventsChange={vi.fn()}
      />
    );
    expect(screen.queryByText(/not a standard event name/i)).not.toBeInTheDocument();
  });

  it('still nudges a free-typed off-list name like beam_break', () => {
    render(
      <BehavioralEventsDisplay
        dayEvents={[{ description: 'Din1', name: 'beam_break' }]}
        onDayEventsChange={vi.fn()}
      />
    );
    expect(screen.getByText(/not a standard event name/i)).toBeInTheDocument();
  });
});
