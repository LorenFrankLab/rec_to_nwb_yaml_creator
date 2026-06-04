/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DataAcqSection from '../DataAcqSection';

describe('DataAcqSection', () => {
  let user;
  let onFieldUpdate;

  const animal = {
    id: 'remy',
    devices: {
      data_acq_device: [
        { name: 'SpikeGadgets_MCU', system: 'SpikeGadgets', amplifier: 'Intan RHD2000', adc_circuit: 'Intan' },
      ],
    },
    technicalDefaults: { raw_data_to_volts: 0.195, times_period_multiplier: 1.5 },
  };

  beforeEach(() => {
    user = userEvent.setup();
    onFieldUpdate = vi.fn();
  });

  it('populates the device fields (incl. name) from the data_acq_device array', () => {
    render(<DataAcqSection animal={animal} onFieldUpdate={onFieldUpdate} />);

    expect(screen.getByDisplayValue('SpikeGadgets_MCU')).toBeInTheDocument();
    expect(screen.getByDisplayValue('SpikeGadgets')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Intan RHD2000')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Intan')).toBeInTheDocument();
  });

  it('writes the data-acq device as a one-element array including name on blur', async () => {
    render(<DataAcqSection animal={animal} onFieldUpdate={onFieldUpdate} />);

    const amplifier = screen.getByLabelText(/Amplifier/i);
    await user.clear(amplifier);
    await user.type(amplifier, 'Intan RHD2132');
    await user.tab();

    await waitFor(() => expect(onFieldUpdate).toHaveBeenCalledWith('data_acq_device', [
      { name: 'SpikeGadgets_MCU', system: 'SpikeGadgets', amplifier: 'Intan RHD2132', adc_circuit: 'Intan' },
    ]));
  });

  it('edits technical defaults (raw_data_to_volts) via technicalDefaults, not technical', async () => {
    render(<DataAcqSection animal={animal} onFieldUpdate={onFieldUpdate} />);

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
    // The old animal-level key is gone.
    expect(screen.queryByLabelText(/Ephys to Volt/i)).not.toBeInTheDocument();
  });

  it('no longer edits the per-day default header file path at the animal level', () => {
    render(<DataAcqSection animal={animal} onFieldUpdate={onFieldUpdate} />);
    expect(screen.queryByLabelText(/Default Header File/i)).not.toBeInTheDocument();
  });

  it('blocks a divergent data-acq name reuse and offers a new-name action', async () => {
    const dataAcqRegistry = [
      { name: 'SHARED', label: 'jaq data-acq device', fields: { system: 'Open Ephys', amplifier: 'Intan', adc_circuit: 'Intan' } },
    ];
    render(<DataAcqSection animal={animal} onFieldUpdate={onFieldUpdate} dataAcqRegistry={dataAcqRegistry} />);

    const nameInput = screen.getByLabelText(/^Name/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'SHARED'); // same name, but this animal's system is SpikeGadgets ≠ Open Ephys
    await user.tab();

    // Divergence is surfaced and the write is blocked.
    expect(screen.getByRole('alert')).toHaveTextContent(/already used by jaq data-acq device/i);
    expect(onFieldUpdate).not.toHaveBeenCalledWith('data_acq_device', expect.anything());
    expect(screen.getByRole('button', { name: /use a new name/i })).toBeInTheDocument();
  });

  it('allows an identical data-acq name reuse (same dependent fields)', async () => {
    const dataAcqRegistry = [
      { name: 'SpikeGadgets_MCU', label: 'jaq data-acq device', fields: { system: 'SpikeGadgets', amplifier: 'Intan RHD2000', adc_circuit: 'Intan' } },
    ];
    render(<DataAcqSection animal={animal} onFieldUpdate={onFieldUpdate} dataAcqRegistry={dataAcqRegistry} />);

    const amplifier = screen.getByLabelText(/Amplifier/i);
    await user.click(amplifier);
    await user.tab();

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await waitFor(() => expect(onFieldUpdate).toHaveBeenCalledWith('data_acq_device', expect.any(Array)));
  });
});
