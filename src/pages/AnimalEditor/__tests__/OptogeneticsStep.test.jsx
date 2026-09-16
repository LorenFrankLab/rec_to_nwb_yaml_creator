import React, { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OptogeneticsStep from '../OptogeneticsStep';
import { completeOptogenetics } from '../../../__tests__/fixtures/completeOptogenetics';

/**
 * Stateful harness mirroring the store round-trip: the step commits via `onUpdate`,
 * which updates the animal it reads from — exactly how `actions.updateAnimal` feeds the
 * re-render in the real Animal Editor.
 * @param root0
 * @param root0.initial
 */
function Harness({ initial = null }) {
  const [animal, setAnimal] = useState({ optogenetics: initial });
  return (
    <OptogeneticsStep
      animal={animal}
      onUpdate={(update) => setAnimal((previous) => ({ ...previous, ...update }))}
    />
  );
}

describe('OptogeneticsStep', () => {
  it('restores entered source and fiber after switching off and on', async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ opto_excitation_source: [{ name: 'Blue source', wavelength_in_nm: 470 }], optical_fiber: [{ name: 'Left CA1' }], virus_injection: [], optogenetic_stimulation_software: 'fsgui' }} />);
    await user.click(screen.getByRole('checkbox', { name: /has optogenetics/i }));
    expect(screen.getByText(/Saved setup retained/)).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: /has optogenetics/i }));
    expect(screen.getByLabelText(/setup name/i)).toHaveValue('Blue source');
    expect(screen.getByLabelText(/Wavelength/)).toHaveValue(470);
    expect(screen.getByLabelText(/fiber implant name/i)).toHaveValue('Left CA1');
  });

  it.each([['optical_fiber', 'optical fiber', 'fiber implant name'], ['virus_injection', 'virus injection', 'injection name']])('protects removal of a populated %s', async (key, label, inputLabel) => {
    const user = userEvent.setup();
    render(<Harness initial={{ [key]: [{ name: 'Keep my record' }] }} />);
    await user.click(screen.getByRole('button', { name: `Remove ${label} 1` }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Existing recording days keep their own setup');
    await user.click(screen.getByRole('button', { name: 'Keep record' }));
    expect(screen.getByLabelText(new RegExp(inputLabel, 'i'))).toHaveValue('Keep my record');
    await user.click(screen.getByRole('button', { name: `Remove ${label} 1` }));
    await user.click(screen.getByRole('button', { name: 'Remove record', exact: true }));
    expect(screen.queryByLabelText(new RegExp(inputLabel, 'i'))).not.toBeInTheDocument();
  });

  it('folds completed records on load, but leaves a record open when its last field is entered', async () => {
    const user = userEvent.setup();
    const opto = completeOptogenetics();
    opto.opto_excitation_source[0].description = '';
    render(<Harness initial={opto} />);
    const source = screen.getByLabelText(/setup name/i).closest('details');
    expect(source).toHaveAttribute('open');
    expect(screen.getByLabelText(/fiber implant name/i).closest('details')).not.toHaveAttribute('open');
    await user.type(screen.getAllByLabelText(/Description/)[0], 'Blue light');
    expect(source).toHaveAttribute('open');
    expect(screen.queryByText(/Complete before export/i)).not.toBeInTheDocument();
  });

  it('is OFF by default: no opto sections, explicit off explanation', () => {
    render(<Harness />);

    expect(screen.getByRole('checkbox', { name: /has optogenetics/i })).not.toBeChecked();
    expect(screen.getByText(/No stimulation setup/i)).toBeInTheDocument();
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

  it('uses a Watts-scale source-power placeholder that names the milliwatt equivalent', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('checkbox', { name: /has optogenetics/i }));

    expect(screen.getByLabelText(/source power/i)).toHaveAttribute(
      'placeholder',
      'e.g. 0.01 (= 10 mW)'
    );
  });

  it('stays incomplete when sections are only named (required fields still blank)', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('checkbox', { name: /has optogenetics/i }));
    expect(screen.getByText(/Complete before export/i)).toBeInTheDocument();

    // Naming the rows is NOT enough — the converter/schema-required fields are still blank,
    // so the checklist must NOT read complete (no false "done" signal).
    await user.type(screen.getByLabelText(/setup name/i), 'LED-470');
    await user.click(screen.getByRole('button', { name: /add optical fiber/i }));
    await user.type(screen.getByLabelText(/fiber implant name/i), 'Fiber 1');
    await user.click(screen.getByRole('button', { name: /add virus injection/i }));
    await user.type(screen.getByLabelText(/injection name/i), 'Injection 1');

    expect(screen.getByText(/Complete before export/i)).toBeInTheDocument();
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

    expect(screen.queryByText(/Complete before export/i)).not.toBeInTheDocument();
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

  it('disabling commits an explicit optogenetics:null and returns to the off state', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    render(
      <OptogeneticsStep
        animal={{
          optogenetics: {
            opto_excitation_source: [{ name: 'LED' }],
            optical_fiber: [{ name: 'F' }],
            virus_injection: [{ name: 'V' }],
            optogenetic_stimulation_software: 'fsgui',
          },
        }}
        onUpdate={onUpdate}
      />
    );

    expect(screen.getByRole('checkbox', { name: /has optogenetics/i })).toBeChecked();
    await user.click(screen.getByRole('checkbox', { name: /has optogenetics/i }));

    // Must commit explicit null so updateAnimal CLEARS the block (truthiness wouldn't).
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ optogenetics: null, optogeneticsDraft: expect.objectContaining({ optical_fiber: [{ name: 'F' }] }) }));
  });

  it('structurally allows exactly one excitation source (no add control, renders only the first)', () => {
    render(
      <OptogeneticsStep
        animal={{
          // Even given two imported sources, the editor renders only the first and
          // offers no way to add another — the converter rejects >1.
          optogenetics: {
            opto_excitation_source: [{ name: 'LED-1' }, { name: 'LED-2' }],
            optical_fiber: [],
            virus_injection: [],
            optogenetic_stimulation_software: 'fsgui',
          },
        }}
        onUpdate={vi.fn()}
      />
    );

    expect(screen.queryByRole('button', { name: /add excitation source/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/setup name/i)).toHaveValue('LED-1');
    // Only one "Setup name" field exists (the single source), not one per imported source.
    expect(screen.getAllByLabelText(/setup name/i)).toHaveLength(1);
  });

  it('renders device-name fields as datalist-backed inputs (catalog suggestions, free entry)', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('checkbox', { name: /has optogenetics/i }));

    const modelInput = screen.getByLabelText(/hardware model name/i);
    expect(modelInput).toHaveAttribute('list');
    // A bundled catalog suggestion is offered…
    const listId = modelInput.getAttribute('list');
    expect(document.getElementById(listId).querySelector('option[value="Omicron LuxX+ 488-100"]')).toBeInTheDocument();
    // …but free entry (a custom device file name) is still accepted.
    await user.type(modelInput, 'Custom Laser X');
    expect(modelInput).toHaveValue('Custom Laser X');
  });

  it('does not crash on a corrupt SCALAR optogenetics (reads as OFF, the safe default)', () => {
    // A corrupt persisted/imported `optogenetics: "x"` (not a record) must not throw on render
    // (which would trip the root ErrorBoundary and blank the app) — it reads as OFF.
    render(<Harness initial="corrupt" />);
    expect(screen.getByRole('checkbox', { name: /has optogenetics/i })).not.toBeChecked();
    expect(screen.queryByRole('group', { name: /excitation source/i })).not.toBeInTheDocument();
  });

  it('does not crash on a record opto with non-array nested lists (degrades to an editable form)', () => {
    // `optogenetics: { opto_excitation_source: "x" }` is a record → enabled, but its nested lists
    // are corrupt; coercing them to [] lets the editor render an empty-but-editable form instead of
    // throwing on `.map`/`.length`.
    render(
      <Harness initial={{ opto_excitation_source: 'x', optical_fiber: null, virus_injection: 7 }} />
    );
    expect(screen.getByRole('checkbox', { name: /has optogenetics/i })).toBeChecked();
    // All three sections render (the string-valued excitation source is the likeliest .map/.length
    // crash and must render too, degraded to empty).
    expect(screen.getByRole('group', { name: /excitation source/i })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /optical fibers/i })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /virus injections/i })).toBeInTheDocument();
  });

  it('preserves a lone object written without its array wrapper (one item, not silently dropped)', () => {
    // A hand-edited `opto_excitation_source: {…}` (a single item missing its array wrapper) is kept
    // as a one-item list rather than dropped, so real data survives the corruption-tolerant render.
    render(
      <Harness
        initial={{ opto_excitation_source: { name: 'preserved_laser' }, optical_fiber: [], virus_injection: [] }}
      />
    );
    expect(screen.getByRole('checkbox', { name: /has optogenetics/i })).toBeChecked();
    expect(screen.getByDisplayValue('preserved_laser')).toBeInTheDocument();
  });
});
