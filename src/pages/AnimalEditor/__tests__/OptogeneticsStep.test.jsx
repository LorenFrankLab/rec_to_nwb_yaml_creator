import React, { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OptogeneticsStep from '../OptogeneticsStep';

/**
 * Stateful harness mirroring the store round-trip: the step commits via `onUpdate`,
 * which updates the animal it reads from — exactly how `actions.updateAnimal` feeds the
 * re-render in the real Animal Editor.
 * @param root0
 * @param root0.initial
 */
function Harness({ initial = null }) {
  const [optogenetics, setOptogenetics] = useState(initial);
  return (
    <OptogeneticsStep
      animal={{ optogenetics }}
      onUpdate={({ optogenetics: next }) => setOptogenetics(next)}
    />
  );
}

describe('OptogeneticsStep', () => {
  it('is OFF by default: no opto sections, explicit off explanation', () => {
    render(<Harness />);

    expect(screen.getByRole('checkbox', { name: /has optogenetics/i })).not.toBeChecked();
    expect(screen.getByText(/no optogenetics metadata will be exported/i)).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /excitation source/i })).not.toBeInTheDocument();
  });

  it('enabling reveals the four required sections and seeds the software default', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('checkbox', { name: /has optogenetics/i }));

    expect(screen.getByRole('group', { name: /excitation source/i })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /optical fibers/i })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /virus injections/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/optogenetic stimulation software/i)).toHaveValue('fsgui');
  });

  it('stays incomplete when sections are only named (required fields still blank)', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('checkbox', { name: /has optogenetics/i }));
    expect(screen.getByText(/no optogenetics data/i)).toBeInTheDocument();

    // Naming the rows is NOT enough — the converter/schema-required fields are still blank,
    // so the checklist must NOT read complete (no false "done" signal).
    await user.type(screen.getByLabelText(/setup name/i), 'LED-470');
    await user.click(screen.getByRole('button', { name: /add optical fiber/i }));
    await user.type(screen.getByLabelText(/fiber implant name/i), 'Fiber 1');
    await user.click(screen.getByRole('button', { name: /add virus injection/i }));
    await user.type(screen.getByLabelText(/injection name/i), 'Injection 1');

    expect(screen.getByText(/no optogenetics data/i)).toBeInTheDocument();
  });

  it('clears the incomplete notice once every required field is filled', () => {
    const fullSource = {
      name: 'LED-470', model_name: 'M', description: 'd', wavelength_in_nm: 470,
      power_in_W: 0.01, intensity_in_W_per_m2: 100,
    };
    const fullFiber = {
      name: 'Fiber 1', hardware_name: 'H', implanted_fiber_description: 'd', hemisphere: 'left',
      location: 'CA1', ap_in_mm: 1, ml_in_mm: 1, dv_in_mm: 1, roll_in_deg: 0, pitch_in_deg: 0,
      yaw_in_deg: 0, reference: 'Bregma',
    };
    const fullVirus = {
      name: 'Inj 1', description: 'd', virus_name: 'AAV', volume_in_uL: 0.5, titer_in_vg_per_ml: 1e12,
      hemisphere: 'left', location: 'CA1', ap_in_mm: 1, ml_in_mm: 1, dv_in_mm: 1, roll_in_deg: 0,
      pitch_in_deg: 0, yaw_in_deg: 0, reference: 'Bregma',
    };
    render(
      <Harness
        initial={{
          opto_excitation_source: [fullSource],
          optical_fiber: [fullFiber],
          virus_injection: [fullVirus],
          optogenetic_stimulation_software: 'fsgui',
        }}
      />
    );

    expect(screen.queryByText(/no optogenetics data/i)).not.toBeInTheDocument();
  });

  it('commits edits to the excitation source and software through onUpdate', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    render(
      <OptogeneticsStep
        animal={{
          optogenetics: {
            opto_excitation_source: [{ name: '', model_name: '', description: '', wavelength_in_nm: '', power_in_W: '', intensity_in_W_per_m2: '' }],
            optical_fiber: [],
            virus_injection: [],
            optogenetic_stimulation_software: 'fsgui',
          },
        }}
        onUpdate={onUpdate}
      />
    );

    await user.type(screen.getByLabelText(/setup name/i), 'L');
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        optogenetics: expect.objectContaining({
          opto_excitation_source: [expect.objectContaining({ name: 'L' })],
        }),
      })
    );
  });

  it('disabling clears optogenetics (commits null), returning to the off state', async () => {
    const user = userEvent.setup();
    render(
      <Harness
        initial={{
          opto_excitation_source: [{ name: 'LED' }],
          optical_fiber: [{ name: 'F' }],
          virus_injection: [{ name: 'V' }],
          optogenetic_stimulation_software: 'fsgui',
        }}
      />
    );

    expect(screen.getByRole('checkbox', { name: /has optogenetics/i })).toBeChecked();
    await user.click(screen.getByRole('checkbox', { name: /has optogenetics/i }));

    expect(screen.getByRole('checkbox', { name: /has optogenetics/i })).not.toBeChecked();
    expect(screen.getByText(/no optogenetics metadata will be exported/i)).toBeInTheDocument();
  });
});
