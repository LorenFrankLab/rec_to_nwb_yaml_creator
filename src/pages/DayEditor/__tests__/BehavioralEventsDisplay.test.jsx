import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BehavioralEventsDisplay from '../BehavioralEventsDisplay';

const inherited = [
  { name: 'reward_well', description: 'Reward delivered at well' },
  { name: 'stim_trigger', description: 'Stimulation trigger' },
];

describe('BehavioralEventsDisplay', () => {
  // Phase 8.7 Task 6: inherited events are a reusable LIBRARY; "Use on this day" copies one into
  // the exported day list (the only behavioral_events that export). Duplicate descriptions in the
  // exported list are a downstream hard crash — gate them inline.
  it('offers "Use on this day" for an inherited event and copies it into the exported day list', async () => {
    const user = userEvent.setup();
    const onDayEventsChange = vi.fn();
    render(
      <BehavioralEventsDisplay inheritedEvents={inherited} dayEvents={[]} onDayEventsChange={onDayEventsChange} />
    );
    const list = screen.getByRole('list', { name: /inherited behavioral events/i });
    const rewardRow = within(list).getByText('reward_well').closest('li');
    await user.click(within(rewardRow).getByRole('button', { name: /use reward_well on this day/i }));
    expect(onDayEventsChange).toHaveBeenCalledWith([
      { name: 'reward_well', description: 'Reward delivered at well' },
    ]);
  });

  it('hides "Use on this day" for an inherited event already used on the day', () => {
    render(
      <BehavioralEventsDisplay
        inheritedEvents={inherited}
        dayEvents={[{ name: 'reward_well', description: 'Reward delivered at well' }]}
        onDayEventsChange={vi.fn()}
      />
    );
    const list = screen.getByRole('list', { name: /inherited behavioral events/i });
    const rewardRow = within(list).getByText('reward_well').closest('li');
    expect(within(rewardRow).queryByRole('button', { name: /use reward_well on this day/i })).not.toBeInTheDocument();
  });

  it('flags a duplicate description among the exported day events (downstream hard crash)', () => {
    render(
      <BehavioralEventsDisplay
        inheritedEvents={[]}
        dayEvents={[
          { name: 'poke_a', description: 'nose poke' },
          { name: 'poke_b', description: 'nose poke' },
        ]}
        onDayEventsChange={vi.fn()}
      />
    );
    expect(screen.getByRole('alert')).toHaveTextContent(/description "nose poke".*more than one|unique description/i);
  });

  it('does NOT flag descriptions that differ only by trailing whitespace (matches the export gate)', () => {
    // The converter keys DIO by the raw description, so "nose poke" and "nose poke " are distinct.
    // The inline gate must use the same raw-string semantics as the validator (no trim) — flagging
    // these would tell the user to "fix" a non-problem the export gate doesn't see.
    render(
      <BehavioralEventsDisplay
        inheritedEvents={[]}
        dayEvents={[{ name: 'a', description: 'nose poke' }, { name: 'b', description: 'nose poke ' }]}
        onDayEventsChange={vi.fn()}
      />
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

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

    // Inherited rows are NOT editable here (no edit/delete) — only a "Use on this day" copy
    // action (Task 6). They keep the accessible "read-only" cue.
    expect(within(list).queryByRole('button', { name: /edit|delete|remove/i })).not.toBeInTheDocument();
    expect(within(list).getAllByText(/inherited, read-only/i)).toHaveLength(2);
  });

  it('does not render the day wiring table in read-only mode', () => {
    render(
      <BehavioralEventsDisplay
        inheritedEvents={inherited}
        dayEvents={[]}
        onDayEventsChange={vi.fn()}
        readOnly
      />
    );

    expect(screen.getByText('reward_well')).toBeInTheDocument();
    // No "+ add event" controls and no Inputs/Outputs wiring table in read-only mode.
    expect(screen.queryByRole('button', { name: /add (input|output) event/i })).not.toBeInTheDocument();
  });

  it('clarifies that inherited events are animal-level reference and are not exported with the day', () => {
    render(
      <BehavioralEventsDisplay
        inheritedEvents={inherited}
        dayEvents={[]}
        onDayEventsChange={vi.fn()}
      />
    );

    // The inherited list must not imply it is part of this day's export.
    expect(screen.getByText(/not written to this day's metadata/i)).toBeInTheDocument();
    expect(
      screen.getByText(/only the day-specific events below are exported/i)
    ).toBeInTheDocument();
  });

  it('describes a duplicate-named day event as the exported one (no "takes precedence")', () => {
    render(
      <BehavioralEventsDisplay
        inheritedEvents={inherited}
        dayEvents={[{ name: 'reward_well', description: 'overrides reward' }]}
        onDayEventsChange={vi.fn()}
      />
    );

    const warning = screen.getByRole('status');
    expect(warning).not.toHaveTextContent(/take(s)? precedence/i);
    expect(warning).toHaveTextContent(/exported with this day/i);
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

    // ...but it is still shown (non-blocking) — it appears both as an inherited row and as an
    // editable day row, so the name is present more than once.
    expect(screen.getAllByText('reward_well').length).toBeGreaterThanOrEqual(2);
  });
});

/**
 * Controlled harness: BehavioralEventsDisplay is controlled (the parent owns the day events via
 * onDayEventsChange). A bare vi.fn() never updates the `dayEvents` prop, so a row added/edited
 * would not re-render. This wrapper threads the update back into the prop (as TasksEpochsStep
 * does) and forwards to the spy.
 * @param {object} props
 * @param {Array} props.initialDayEvents - Starting day events.
 * @param {Array} [props.inheritedEvents] - Inherited (animal) events.
 * @param {Function} props.spy - Spy invoked with each next day-events array.
 * @returns {JSX.Element}
 */
function ControlledHarness({ initialDayEvents, inheritedEvents = [], spy }) {
  const [dayEvents, setDayEvents] = useState(initialDayEvents);
  return (
    <BehavioralEventsDisplay
      inheritedEvents={inheritedEvents}
      dayEvents={dayEvents}
      onDayEventsChange={(next) => {
        spy(next);
        setDayEvents(next);
      }}
    />
  );
}

describe('BehavioralEventsDisplay — day wiring table (Inputs / Outputs)', () => {
  it('groups day events by direction (Din → Inputs, Dout → Outputs, analog/unrecognized → Other)', () => {
    render(
      <BehavioralEventsDisplay
        inheritedEvents={[]}
        dayEvents={[
          { name: 'Poke1', description: 'Din1' },
          { name: 'Pump1', description: 'Dout7' },
          { name: 'imu', description: 'Accel5' },
        ]}
        onDayEventsChange={vi.fn()}
      />
    );
    const inputs = screen.getByRole('table', { name: /inputs \(din\)/i });
    const outputs = screen.getByRole('table', { name: /outputs \(dout\)/i });
    const other = screen.getByRole('table', { name: /other/i });
    expect(within(inputs).getByText('Poke1')).toBeInTheDocument();
    expect(within(outputs).getByText('Pump1')).toBeInTheDocument();
    expect(within(other).getByText('imu')).toBeInTheDocument();
  });

  it('shows a direction legend (Din = inputs, Dout = outputs), not emoji-only', () => {
    render(
      <BehavioralEventsDisplay inheritedEvents={[]} dayEvents={[]} onDayEventsChange={vi.fn()} />
    );
    const legend = screen.getByText(/din\b.*input|input.*\bdin\b/i);
    expect(legend).toBeInTheDocument();
    expect(screen.getByText(/dout\b.*output|output.*\bdout\b/i)).toBeInTheDocument();
  });

  it('edits a day row through the guided Type + line-index controls and writes back the joined description', async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(
      <ControlledHarness initialDayEvents={[{ name: 'Poke1', description: 'Din1' }]} spy={spy} />
    );

    await user.click(screen.getByRole('button', { name: /^edit$/i }));
    // Relabeled: the name field is the "Event" combobox; the guided controls keep their aria-labels.
    expect(screen.getByLabelText('Event')).toHaveValue('Poke1');
    expect(screen.getByLabelText(/DIO type/i)).toHaveValue('Din');
    expect(screen.getByLabelText(/DIO line index/i)).toHaveValue(1);

    await user.selectOptions(screen.getByLabelText(/DIO type/i), 'Dout');
    const indexInput = screen.getByLabelText(/DIO line index/i);
    await user.clear(indexInput);
    await user.type(indexInput, '3');
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    expect(spy).toHaveBeenLastCalledWith([{ name: 'Poke1', description: 'Dout3' }]);
  });

  it('adds an Input event seeded to Din1 and an Output event seeded to Dout1', async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(<ControlledHarness initialDayEvents={[]} spy={spy} />);

    await user.click(screen.getByRole('button', { name: /add input event/i }));
    expect(spy).toHaveBeenLastCalledWith([{ name: '', description: 'Din1' }]);
    // The new row opens in edit mode showing the seeded Din / 1.
    expect(screen.getByLabelText(/DIO type/i)).toHaveValue('Din');
    expect(screen.getByLabelText(/DIO line index/i)).toHaveValue(1);

    await user.click(screen.getByRole('button', { name: /add output event/i }));
    expect(spy).toHaveBeenLastCalledWith([
      { name: '', description: 'Din1' },
      { name: '', description: 'Dout1' },
    ]);
  });

  it('deletes a day row via the shared ConfirmDialog (no window.confirm)', async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(
      <ControlledHarness
        initialDayEvents={[{ name: 'Poke1', description: 'Din1' }]}
        spy={spy}
      />
    );

    await user.click(screen.getByRole('button', { name: /delete .*Poke1|remove .*Poke1/i }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Poke1');
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    expect(spy).toHaveBeenLastCalledWith([]);
  });

  it('shows an empty state when the day has no behavioral events', () => {
    render(
      <BehavioralEventsDisplay inheritedEvents={[]} dayEvents={[]} onDayEventsChange={vi.fn()} />
    );
    expect(screen.getByText(/no behavioral events (configured|on this day)/i)).toBeInTheDocument();
  });

  it('blocks Save with an inline error when an event name duplicates another day event (Rule 14)', async () => {
    const user = userEvent.setup();
    render(
      <ControlledHarness
        initialDayEvents={[
          { name: 'Poke1', description: 'Din1' },
          { name: 'Poke2', description: 'Din2' },
        ]}
        spy={vi.fn()}
      />
    );

    // Edit the first event and rename it to collide with the second's name (per-day uniqueness).
    await user.click(screen.getAllByRole('button', { name: /^edit$/i })[0]);
    const eventField = screen.getByLabelText('Event');
    await user.clear(eventField);
    await user.type(eventField, 'Poke2');

    expect(screen.getByRole('alert')).toHaveTextContent(/unique within this day/i);
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled();
  });

  it('warns that editing an Other-group event (analog/prose description) will rewrite it', async () => {
    const user = userEvent.setup();
    render(
      <ControlledHarness initialDayEvents={[{ name: 'imu', description: 'Accel5' }]} spy={vi.fn()} />
    );

    await user.click(screen.getByRole('button', { name: /^edit$/i }));
    // Target the per-row rewrite warning by its unique phrase (the "Other" group header also
    // mentions "isn't a standard Din/Dout line").
    const warning = screen.getByText(/editing the controls will rewrite it/i);
    expect(warning).toHaveTextContent('Accel5');
  });
});
