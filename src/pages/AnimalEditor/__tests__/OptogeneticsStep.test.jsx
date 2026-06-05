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

  it('shows incomplete until every converter-required section is present, then clears', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('checkbox', { name: /has optogenetics/i }));
    // Enabled but no fiber/virus yet → incomplete (mirrors the converter gate).
    expect(screen.getByText(/optogenetics is incomplete/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /add optical fiber/i }));
    await user.click(screen.getByRole('button', { name: /add virus injection/i }));

    // Source + fiber + virus + software all present → complete (the gate checks presence,
    // not per-field completeness, which the schema enforces separately).
    expect(screen.queryByText(/optogenetics is incomplete/i)).not.toBeInTheDocument();
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
