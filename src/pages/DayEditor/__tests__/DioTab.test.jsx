import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DioTab from '../DioTab';

/**
 * DioTab is the Day Editor's DIO subsection inside Devices & Failed Channels. It opens on a
 * read-only carry-forward SUMMARY of the named Din/Dout channels and reveals the full ECU channel
 * editor only when the user clicks
 * "Edit · rewired the rig". The grid editing itself is covered at the BehavioralEventsDisplay level;
 * here we cover the summary/edit toggle, the carry-forward provenance line, and the collision gate.
 */
describe('DioTab', () => {
  it('renders the Behavioral events heading', () => {
    render(<DioTab day={{ behavioral_events: [] }} onFieldUpdate={vi.fn()} />);
    expect(screen.getByRole('heading', { level: 2, name: /behavioral events/i })).toBeInTheDocument();
  });

  it('opens an empty day straight in the editor (so the first naming / bootstrap is immediate)', () => {
    render(<DioTab day={{ behavioral_events: [] }} onFieldUpdate={vi.fn()} />);
    // The editor grid is shown (the "Edit" reveal is skipped for an empty day).
    expect(screen.getByLabelText('Event for Din1')).toBeInTheDocument();
  });

  it('opens a day with named events on the read-only carry-forward summary by default', () => {
    render(
      <DioTab
        day={{ behavioral_events: [{ description: 'Dout7', name: 'Pump1' }] }}
        onFieldUpdate={vi.fn()}
        carriedFrom="2023-06-21"
      />
    );
    // The named channel + name show read-only; the editable combobox is NOT rendered yet.
    expect(screen.getByText('Dout7')).toBeInTheDocument();
    expect(screen.getByText('Pump1')).toBeInTheDocument();
    expect(screen.queryByLabelText('Event for Dout7')).not.toBeInTheDocument();
    // The carry-forward provenance line.
    expect(screen.getByText(/carried from 2023-06-21 · unchanged/i)).toBeInTheDocument();
    // The reveal affordance.
    expect(screen.getByRole('button', { name: /edit · rewired the rig/i })).toBeInTheDocument();
  });

  it('reveals the editor on "Edit · rewired the rig" and writes changes through onFieldUpdate', async () => {
    const user = userEvent.setup();
    const onFieldUpdate = vi.fn();
    render(
      <DioTab
        day={{ behavioral_events: [{ description: 'Dout7', name: 'Pump1' }] }}
        onFieldUpdate={onFieldUpdate}
      />
    );

    await user.click(screen.getByRole('button', { name: /edit · rewired the rig/i }));

    // Now the editable grid is visible (the existing channel pre-filled).
    expect(screen.getByLabelText('Event for Dout7')).toHaveValue('Pump1');

    // Naming a channel writes the next events array back through onFieldUpdate('behavioral_events').
    await user.click(screen.getByLabelText('Event for Din1'));
    await user.click(screen.getByRole('option', { name: 'Poke' }));
    expect(onFieldUpdate).toHaveBeenLastCalledWith('behavioral_events', [
      { description: 'Dout7', name: 'Pump1' },
      { description: 'Din1', name: 'Poke1' },
    ]);
  });

  it('surfaces a duplicate-name collision on the summary and inline in the editor (shared helpers)', async () => {
    const user = userEvent.setup();
    render(
      <DioTab
        day={{
          behavioral_events: [
            { description: 'Din1', name: 'Poke1' },
            { description: 'Din2', name: 'Poke1' },
          ],
        }}
        onFieldUpdate={vi.fn()}
      />
    );

    // The summary surfaces the collision (the same duplicateBehavioralEventNames helper the export uses).
    const summaryAlert = screen.getByRole('alert');
    expect(summaryAlert).toHaveTextContent(/each behavioral event must be unique/i);

    // Jumping to Edit shows the editor's own inline duplicate-name gate (one alert per colliding row).
    await user.click(within(summaryAlert).getByRole('button', { name: /edit to fix/i }));
    expect(screen.getAllByText(/used by more than one channel/i).length).toBeGreaterThan(0);
  });

  it('shows a named event whose channel is not a standard Din/Dout line in an "Other" group', () => {
    // The header counts every named event; an "Other" group surfaces non-Din/Dout channels so the
    // count can never disagree with the displayed rows.
    render(
      <DioTab
        day={{
          behavioral_events: [
            { description: 'Din1', name: 'Poke1' },
            { description: 'AnalogIn1', name: 'ImportedLine' },
          ],
        }}
        onFieldUpdate={vi.fn()}
      />
    );
    expect(screen.getByText('2 events')).toBeInTheDocument();
    const other = screen.getByRole('heading', { level: 3, name: 'Other' });
    expect(other).toBeInTheDocument();
    expect(screen.getByText('ImportedLine')).toBeInTheDocument();
  });

  it('tolerates a corrupt (non-array) behavioral_events without crashing', () => {
    expect(() =>
      render(<DioTab day={{ behavioral_events: {} }} onFieldUpdate={vi.fn()} />)
    ).not.toThrow();
  });

  it('renders an in-tab reset control for a corrupt (non-array) behavioral_events (badge is not a dead-end)', async () => {
    const user = userEvent.setup();
    const onFieldUpdate = vi.fn();
    render(<DioTab day={{ behavioral_events: {} }} onFieldUpdate={onFieldUpdate} />);
    const reset = screen.getByRole('button', { name: /reset corrupt behavioral events/i });
    await user.click(reset);
    expect(onFieldUpdate).toHaveBeenCalledWith('behavioral_events', []);
  });

  it('forwards copyableDioSources so an empty day offers the copy-from-animal bootstrap', () => {
    render(
      <DioTab
        day={{ behavioral_events: [] }}
        onFieldUpdate={vi.fn()}
        copyableDioSources={[
          { id: 'remy', name: 'remy', date: '2023-06-22', events: [{ description: 'Din1', name: 'Poke1' }] },
        ]}
      />
    );
    expect(screen.getByRole('button', { name: /copy from remy/i })).toBeInTheDocument();
  });
});
