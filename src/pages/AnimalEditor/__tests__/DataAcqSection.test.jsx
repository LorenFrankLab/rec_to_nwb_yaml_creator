/**
 * @vitest-environment jsdom
 */

/**
 * DataAcqSection — the animal's Recording System CATALOG (a list of acquisition systems, like the
 * Cameras catalog). An animal recorded on different rigs over its life accumulates several systems
 * here; each recording day references the one it used (Day Editor). The first is the default days
 * inherit when unreferenced. `name` is the Spyglass `DataAcquisitionDevice` identity — unique within
 * the catalog, and a same-name-different-hardware reuse (here or elsewhere in the dataset) is blocked.
 * The technical defaults (raw_data_to_volts / times_period_multiplier) are animal-level and seed each
 * new day's `technical`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DataAcqSection from '../DataAcqSection';

const sg = { name: 'SpikeGadgets_MCU', system: 'SpikeGadgets', amplifier: 'Intan RHD2000', adc_circuit: 'Intan' };
const np = { name: 'Neuropixels_rig', system: 'Open Ephys', amplifier: 'IMEC', adc_circuit: 'IMEC' };

/**
 * Build an animal with the given recording-system catalog.
 * @param {Array} catalog - data_acq_device entries.
 * @returns {object} animal
 */
function animalWith(catalog) {
  return {
    id: 'remy',
    devices: { data_acq_device: catalog },
    technicalDefaults: { raw_data_to_volts: 0.195, times_period_multiplier: 1.5 },
  };
}

let user;
let onFieldUpdate;
beforeEach(() => {
  user = userEvent.setup();
  onFieldUpdate = vi.fn();
});

describe('DataAcqSection — catalog list', () => {
  it('lists every recording system in the catalog and marks the first as the default', () => {
    render(<DataAcqSection animal={animalWith([sg, np])} onFieldUpdate={onFieldUpdate} />);
    expect(screen.getByText('SpikeGadgets_MCU')).toBeInTheDocument();
    expect(screen.getByText('Neuropixels_rig')).toBeInTheDocument();
    // The first catalog entry is the default days inherit when unreferenced.
    const firstRow = screen.getByText('SpikeGadgets_MCU').closest('.recording-system-row');
    expect(within(firstRow).getByText(/default/i)).toBeInTheDocument();
  });

  it('adds a recording system to the catalog (appended), via the Add editor', async () => {
    render(<DataAcqSection animal={animalWith([sg])} onFieldUpdate={onFieldUpdate} />);
    await user.click(screen.getByRole('button', { name: /add recording system/i }));
    await user.type(screen.getByLabelText(/^Name/i), 'Neuropixels_rig');
    await user.selectOptions(screen.getByRole('combobox', { name: /system/i }), 'Open Ephys');
    await user.type(screen.getByLabelText(/Amplifier/i), 'IMEC');
    await user.type(screen.getByLabelText(/ADC Circuit/i), 'IMEC');
    await user.click(screen.getByRole('button', { name: /save recording system/i }));

    await waitFor(() => expect(onFieldUpdate).toHaveBeenCalledWith('data_acq_device', [sg, np]));
  });

  it('edits an existing system in place', async () => {
    render(<DataAcqSection animal={animalWith([sg, np])} onFieldUpdate={onFieldUpdate} />);
    await user.click(screen.getByRole('button', { name: /edit recording system Neuropixels_rig/i }));
    const amp = screen.getByLabelText(/Amplifier/i);
    await user.clear(amp);
    await user.type(amp, 'IMEC v2');
    await user.click(screen.getByRole('button', { name: /save recording system/i }));

    await waitFor(() =>
      expect(onFieldUpdate).toHaveBeenCalledWith('data_acq_device', [sg, { ...np, amplifier: 'IMEC v2' }])
    );
  });

  it('deletes a system from the catalog (when more than one remains)', async () => {
    render(<DataAcqSection animal={animalWith([sg, np])} onFieldUpdate={onFieldUpdate} />);
    await user.click(screen.getByRole('button', { name: /delete recording system Neuropixels_rig/i }));
    expect(onFieldUpdate).toHaveBeenCalledWith('data_acq_device', [sg]);
  });

  it('does not allow deleting the last system (schema requires at least one)', () => {
    render(<DataAcqSection animal={animalWith([sg])} onFieldUpdate={onFieldUpdate} />);
    // With one system there is no delete control (or it is disabled) — the catalog must keep ≥ 1.
    expect(screen.queryByRole('button', { name: /delete recording system/i })).not.toBeInTheDocument();
  });

  it('blocks adding a second system with a name already in the catalog', async () => {
    render(<DataAcqSection animal={animalWith([sg])} onFieldUpdate={onFieldUpdate} />);
    await user.click(screen.getByRole('button', { name: /add recording system/i }));
    await user.type(screen.getByLabelText(/^Name/i), 'SpikeGadgets_MCU'); // duplicate
    await user.selectOptions(screen.getByRole('combobox', { name: /system/i }), 'Open Ephys');
    await user.type(screen.getByLabelText(/Amplifier/i), 'IMEC');
    await user.type(screen.getByLabelText(/ADC Circuit/i), 'IMEC');
    await user.click(screen.getByRole('button', { name: /save recording system/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(/already (used|in the catalog)/i);
    expect(onFieldUpdate).not.toHaveBeenCalledWith('data_acq_device', expect.anything());
  });

  it('blocks a divergent name reuse against another animal (Spyglass identity)', async () => {
    const registry = [
      { name: 'SHARED', label: 'jaq data-acq device', fields: { system: 'Open Ephys', amplifier: 'Intan', adc_circuit: 'Intan' } },
    ];
    render(<DataAcqSection animal={animalWith([sg])} onFieldUpdate={onFieldUpdate} dataAcqRegistry={registry} />);
    await user.click(screen.getByRole('button', { name: /add recording system/i }));
    await user.type(screen.getByLabelText(/^Name/i), 'SHARED');
    await user.selectOptions(screen.getByRole('combobox', { name: /system/i }), 'SpikeGadgets'); // differs from registry's Open Ephys
    await user.type(screen.getByLabelText(/Amplifier/i), 'Intan');
    await user.type(screen.getByLabelText(/ADC Circuit/i), 'Intan');
    await user.click(screen.getByRole('button', { name: /save recording system/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(/different hardware|saved identity|already used by/i);
    expect(onFieldUpdate).not.toHaveBeenCalledWith('data_acq_device', expect.anything());
  });

  it('does not write an incomplete system', async () => {
    render(<DataAcqSection animal={animalWith([sg])} onFieldUpdate={onFieldUpdate} />);
    await user.click(screen.getByRole('button', { name: /add recording system/i }));
    await user.type(screen.getByLabelText(/^Name/i), 'Partial');
    await user.click(screen.getByRole('button', { name: /save recording system/i }));
    expect(onFieldUpdate).not.toHaveBeenCalledWith('data_acq_device', expect.anything());
  });
});

describe('DataAcqSection — technical defaults (animal-level)', () => {
  it('edits raw_data_to_volts via technicalDefaults (not technical)', async () => {
    render(<DataAcqSection animal={animalWith([sg])} onFieldUpdate={onFieldUpdate} />);
    await user.click(screen.getByText(/Advanced Settings/i));
    const rawData = screen.getByLabelText(/Raw Data to Volts/i);
    await user.clear(rawData);
    await user.type(rawData, '0.25');
    await user.tab();

    await waitFor(() => {
      const call = onFieldUpdate.mock.calls.find((c) => c[0] === 'technicalDefaults');
      expect(call).toBeTruthy();
      expect(call[1].raw_data_to_volts).toBe(0.25);
    });
  });

  it('frames the catalog as the animal default a day can override (per-day recording system)', () => {
    render(<DataAcqSection animal={animalWith([sg])} onFieldUpdate={onFieldUpdate} />);
    expect(screen.getByText(/recording systems this animal was recorded on/i)).toBeInTheDocument();
    expect(screen.getByText(/each recording day uses one/i)).toBeInTheDocument();
    // The old "future capability / no per-day version" framing is gone.
    expect(screen.queryByText(/future capability/i)).not.toBeInTheDocument();
  });
});
