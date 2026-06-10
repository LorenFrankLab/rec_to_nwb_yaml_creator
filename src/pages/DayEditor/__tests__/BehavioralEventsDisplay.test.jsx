import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BehavioralEventsDisplay from '../BehavioralEventsDisplay';

/**
 * The day owns its behavioral (DIO) events — there is no animal-level library. The events are
 * edited as a wiring table grouped into Inputs (Din) / Outputs (Dout) (and an Other group for an
 * imported non-standard channel). A duplicate `description` is a downstream hard crash and is
 * gated inline via the SAME helper the export rule uses.
 */

/**
 * Controlled harness: BehavioralEventsDisplay is controlled (the parent owns the day events via
 * onDayEventsChange). A bare vi.fn() never updates the `dayEvents` prop, so a row added/edited
 * would not re-render. This wrapper threads the update back into the prop (as TasksEpochsStep
 * does) and forwards to the spy.
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

describe('BehavioralEventsDisplay — duplicate-description gate', () => {
  it('flags a duplicate description among the day events (downstream hard crash)', () => {
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
      /description "nose poke".*more than one|unique description/i
    );
  });

  it('does NOT flag descriptions that differ only by trailing whitespace (matches the export gate)', () => {
    // The converter keys DIO by the raw description, so "nose poke" and "nose poke " are distinct.
    render(
      <BehavioralEventsDisplay
        dayEvents={[{ name: 'a', description: 'nose poke' }, { name: 'b', description: 'nose poke ' }]}
        onDayEventsChange={vi.fn()}
      />
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('BehavioralEventsDisplay — day wiring table (Inputs / Outputs)', () => {
  it('groups day events by direction (Din → Inputs, Dout → Outputs, analog/unrecognized → Other)', () => {
    render(
      <BehavioralEventsDisplay
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
    render(<BehavioralEventsDisplay dayEvents={[]} onDayEventsChange={vi.fn()} />);
    expect(screen.getByText(/din\b.*input|input.*\bdin\b/i)).toBeInTheDocument();
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
      <ControlledHarness initialDayEvents={[{ name: 'Poke1', description: 'Din1' }]} spy={spy} />
    );

    await user.click(screen.getByRole('button', { name: /delete .*Poke1|remove .*Poke1/i }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Poke1');
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    expect(spy).toHaveBeenLastCalledWith([]);
  });

  it('shows an empty state when the day has no behavioral events', () => {
    render(<BehavioralEventsDisplay dayEvents={[]} onDayEventsChange={vi.fn()} />);
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

    await user.click(screen.getAllByRole('button', { name: /^edit$/i })[0]);
    const eventField = screen.getByLabelText('Event');
    await user.clear(eventField);
    await user.type(eventField, 'Poke2');

    expect(screen.getByRole('alert')).toHaveTextContent(/unique within this day/i);
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled();
  });

  it('accepts a multi-word suggested name with spaces (the schema allows spaces)', async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(<ControlledHarness initialDayEvents={[{ name: '', description: 'Din1' }]} spy={spy} />);

    await user.click(screen.getByRole('button', { name: /^edit$/i }));
    // Pick a suggested name that contains spaces (the schema's own default name is
    // "Home box camera"); the editor must not reject a name the export accepts. Picking a known
    // label auto-numbers it (first instance → "1"), so the saved name is "Home box camera1" — still
    // a multi-word name with spaces, which must validate and save.
    await user.click(screen.getByLabelText('Event'));
    await user.click(screen.getByRole('option', { name: 'Home box camera' }));

    expect(screen.queryByText(/must contain only letters/i)).not.toBeInTheDocument();
    const save = screen.getByRole('button', { name: /^save$/i });
    expect(save).toBeEnabled();
    await user.click(save);
    expect(spy).toHaveBeenLastCalledWith([{ name: 'Home box camera1', description: 'Din1' }]);
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

describe('BehavioralEventsDisplay — per-label auto-numbering (onSelect)', () => {
  it('picking a known name into a pokeless set auto-numbers it to Poke1', async () => {
    const user = userEvent.setup();
    render(<ControlledHarness initialDayEvents={[]} spy={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /add input event/i }));
    await user.click(screen.getByLabelText('Event'));
    await user.click(screen.getByRole('option', { name: 'Poke' }));

    expect(screen.getByLabelText('Event')).toHaveValue('Poke1');
  });

  it('picking the same name again yields the next instance number (Poke2)', async () => {
    const user = userEvent.setup();
    render(
      <ControlledHarness initialDayEvents={[{ name: 'Poke1', description: 'Din2' }]} spy={vi.fn()} />
    );

    await user.click(screen.getByRole('button', { name: /add input event/i }));
    await user.click(screen.getByLabelText('Event'));
    await user.click(screen.getByRole('option', { name: 'Poke' }));

    expect(screen.getByLabelText('Event')).toHaveValue('Poke2');
  });

  it('numbers each label on an independent counter (Light into a Poke-only set is Light1)', async () => {
    const user = userEvent.setup();
    render(
      <ControlledHarness initialDayEvents={[{ name: 'Poke1', description: 'Din2' }]} spy={vi.fn()} />
    );

    await user.click(screen.getByRole('button', { name: /add input event/i }));
    await user.click(screen.getByLabelText('Event'));
    await user.click(screen.getByRole('option', { name: 'Light' }));

    expect(screen.getByLabelText('Event')).toHaveValue('Light1');
  });

  it('derives the number from the label, not the DIO channel (Pump on Dout7 → Pump1)', async () => {
    const user = userEvent.setup();
    render(
      <ControlledHarness initialDayEvents={[{ name: '', description: 'Dout7' }]} spy={vi.fn()} />
    );

    await user.click(screen.getByRole('button', { name: /^edit$/i }));
    await user.click(screen.getByLabelText('Event'));
    await user.click(screen.getByRole('option', { name: 'Pump' }));

    expect(screen.getByLabelText('Event')).toHaveValue('Pump1');
  });

  it('keeps a typed name verbatim — typing routes through onChange, never auto-numbering', async () => {
    const user = userEvent.setup();
    render(
      <ControlledHarness initialDayEvents={[{ name: '', description: 'Din1' }]} spy={vi.fn()} />
    );

    await user.click(screen.getByRole('button', { name: /^edit$/i }));
    const eventField = screen.getByLabelText('Event');
    await user.clear(eventField);
    await user.type(eventField, 'Poke');

    // A free-typed "Poke" stays "Poke" — it is NOT promoted to "Poke1" (that only happens on an
    // explicit pick from the suggestions).
    expect(eventField).toHaveValue('Poke');
  });
});

describe('BehavioralEventsDisplay — off-list nudge respects numbered variants', () => {
  it('does NOT nudge an auto-numbered name like "Poke1" as non-standard', async () => {
    const user = userEvent.setup();
    render(
      <ControlledHarness initialDayEvents={[{ name: 'Poke1', description: 'Din1' }]} spy={vi.fn()} />
    );

    await user.click(screen.getByRole('button', { name: /^edit$/i }));
    // "Poke1" is a numbered variant of the standard "Poke" — the app generates it, so it must not
    // be flagged "not a standard event name".
    expect(screen.queryByText(/not a standard event name/i)).not.toBeInTheDocument();
  });

  it('still nudges a free-typed off-list name like "beam_break"', async () => {
    const user = userEvent.setup();
    render(
      <ControlledHarness
        initialDayEvents={[{ name: 'beam_break', description: 'Din1' }]}
        spy={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /^edit$/i }));
    expect(screen.getByText(/not a standard event name/i)).toBeInTheDocument();
  });
});

describe('BehavioralEventsDisplay — standard-set templates', () => {
  it('applies the standard set into an empty day (inputs + outputs in one click)', async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(<ControlledHarness initialDayEvents={[]} spy={spy} />);

    await user.click(screen.getByRole('button', { name: /add a standard set/i }));
    await user.click(screen.getByRole('menuitem', { name: /standard w-track/i }));

    // The full 19-event lab set is added in one action.
    const merged = spy.mock.calls.at(-1)[0];
    expect(merged).toHaveLength(19);
    expect(merged).toContainEqual({ name: 'Poke1', description: 'Din1' });
    expect(merged).toContainEqual({ name: 'Run_Camera_Ticks', description: 'Din13' });
    expect(merged).toContainEqual({ name: 'Pump1', description: 'Dout7' });

    // Inputs render the pokes + camera ticks; outputs render the lights + pumps.
    const inputs = screen.getByRole('table', { name: /inputs \(din\)/i });
    expect(within(inputs).getByText('Poke1')).toBeInTheDocument();
    expect(within(inputs).getByText('Run_Camera_Ticks')).toBeInTheDocument();
    const outputs = screen.getByRole('table', { name: /outputs \(dout\)/i });
    expect(within(outputs).getByText('Light1')).toBeInTheDocument();
    expect(within(outputs).getByText('Pump1')).toBeInTheDocument();
  });

  it('re-applying the standard set is collision-safe: skips existing rows, never duplicates', async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(
      <ControlledHarness initialDayEvents={[{ name: 'Poke1', description: 'Din1' }]} spy={spy} />
    );

    await user.click(screen.getByRole('button', { name: /add a standard set/i }));
    await user.click(screen.getByRole('menuitem', { name: /standard w-track/i }));

    const merged = spy.mock.calls.at(-1)[0];
    // Poke1 appears exactly once (skipped, not duplicated); the full set is still present.
    expect(merged.filter((e) => e.name === 'Poke1')).toHaveLength(1);
    expect(merged).toHaveLength(19);
    // No duplicate name or description in the result (Rule 14 / Rule 17 safe).
    const names = merged.map((e) => e.name);
    expect(new Set(names).size).toBe(names.length);
    const descriptions = merged.map((e) => e.description);
    expect(new Set(descriptions).size).toBe(descriptions.length);
  });
});
