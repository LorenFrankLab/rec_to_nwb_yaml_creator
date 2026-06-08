/**
 * DayRecordingSystem — the per-day recording-system selector. The animal owns a catalog of
 * acquisition systems; each day uses ONE (a .rec session is recorded by one system). With a single
 * system there is no choice (read-only); with 2+, a dropdown lets the day pick, defaulting to the
 * first. The selection is `day.data_acq_device_name` (a reference by the system's name); clearing it
 * falls back to the animal default (first catalog entry).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DayRecordingSystem from '../DayRecordingSystem';

const sg = { name: 'SpikeGadgets_MCU', system: 'SpikeGadgets', amplifier: 'Intan', adc_circuit: 'Intan' };
const np = { name: 'Neuropixels_rig', system: 'Open Ephys', amplifier: 'IMEC', adc_circuit: 'IMEC' };

let user;
let onSelect;
beforeEach(() => {
  user = userEvent.setup();
  onSelect = vi.fn();
});

describe('DayRecordingSystem', () => {
  it('with one catalog system, shows it read-only (no dropdown to choose from)', () => {
    render(<DayRecordingSystem catalog={[sg]} selectedName={undefined} onSelect={onSelect} />);
    expect(screen.getByText('SpikeGadgets_MCU')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('with two systems, offers a dropdown defaulting to the first (the animal default)', () => {
    render(<DayRecordingSystem catalog={[sg, np]} selectedName={undefined} onSelect={onSelect} />);
    const select = screen.getByRole('combobox', { name: /recording system/i });
    // Unreferenced day → the default (empty value) is selected; the first system is named as default.
    expect(select).toHaveValue('');
    expect(screen.getByRole('option', { name: /default.*SpikeGadgets_MCU/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Neuropixels_rig' })).toBeInTheDocument();
  });

  it('selecting a system writes its name as the day reference', async () => {
    render(<DayRecordingSystem catalog={[sg, np]} selectedName={undefined} onSelect={onSelect} />);
    await user.selectOptions(screen.getByRole('combobox', { name: /recording system/i }), 'Neuropixels_rig');
    expect(onSelect).toHaveBeenCalledWith('Neuropixels_rig');
  });

  it('reflects the day\'s current selection', () => {
    render(<DayRecordingSystem catalog={[sg, np]} selectedName="Neuropixels_rig" onSelect={onSelect} />);
    expect(screen.getByRole('combobox', { name: /recording system/i })).toHaveValue('Neuropixels_rig');
  });

  it('choosing "Default" clears the reference (back to the animal default)', async () => {
    render(<DayRecordingSystem catalog={[sg, np]} selectedName="Neuropixels_rig" onSelect={onSelect} />);
    await user.selectOptions(screen.getByRole('combobox', { name: /recording system/i }), '');
    expect(onSelect).toHaveBeenCalledWith(undefined);
  });

  it('renders nothing actionable when the animal has no recording system yet', () => {
    render(<DayRecordingSystem catalog={[]} selectedName={undefined} onSelect={onSelect} />);
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByText(/no recording system/i)).toBeInTheDocument();
  });
});
