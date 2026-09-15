/**
 * OptogeneticsContainer — the animal-level setup is only a DEFAULT for new days; existing days keep
 * the setup they recorded (what they export). The container therefore offers the explicit
 * correction: apply the current default to the days whose saved setup differs, after a confirm.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StoreProvider, useStoreContext } from '../../../../state/StoreContext';
import OptogeneticsContainer from '../OptogeneticsContainer';
import { resetWriterLockForTests } from '../../../../state/writerLock';

const SETUP = {
  opto_excitation_source: [{ name: 'laser', wavelength_in_nm: 450, power_in_W: 0.01, model_name: 'm', description: 'd', excitation_mode: 'one-photon', illumination_type: 'laser' }],
  optical_fiber: [],
  virus_injection: [],
  optogenetic_stimulation_software: 'FsGui',
};

let probe = null;
/**
 *
 */
function Probe() {
  probe = useStoreContext();
  return null;
}

/**
 *
 * @param root0
 * @param root0.dayOpto
 */
function seed({ dayOpto }) {
  const animal = { id: 'remy', subject: { subject_id: 'remy' }, optogenetics: SETUP, days: ['remy-2023-06-22', 'remy-2023-06-23'], devices: {}, cameras: [], behavioral_events: [] };
  const days = {
    'remy-2023-06-22': { id: 'remy-2023-06-22', animalId: 'remy', date: '2023-06-22', optogenetics: dayOpto, state: {} },
    'remy-2023-06-23': { id: 'remy-2023-06-23', animalId: 'remy', date: '2023-06-23', optogenetics: SETUP, state: {} },
  };
  return { animals: { remy: animal }, days, settings: {} };
}

beforeEach(() => {
  resetWriterLockForTests();
  window.localStorage.clear();
});
afterEach(() => resetWriterLockForTests());

describe('OptogeneticsContainer — apply the default to existing days', () => {
  it('names the days whose saved setup differs and applies the default to them only after confirmation', async () => {
    const user = userEvent.setup();
    render(
      <StoreProvider initialState={{ workspace: seed({ dayOpto: null }) }}>
        <Probe />
        <OptogeneticsContainer animalId="remy" />
      </StoreProvider>
    );
    await waitFor(() => expect(probe.persistence.writer.role).toBe('writer'));
    const button = screen.getByRole('button', { name: /apply this setup to 1 recording day/i });
    await user.click(button);
    await user.click(screen.getByRole('button', { name: /^apply to 1 day$/i }));
    await waitFor(() => expect(probe.model.workspace.days['remy-2023-06-22'].optogenetics).toEqual(SETUP));
    expect(probe.model.workspace.days['remy-2023-06-22'].provenance.fields.optogenetics).toBe('animal-default');
    expect(screen.queryByRole('button', { name: /apply this setup to/i })).not.toBeInTheDocument();
  });

  it('offers nothing when every day already matches the default', async () => {
    render(
      <StoreProvider initialState={{ workspace: seed({ dayOpto: SETUP }) }}>
        <Probe />
        <OptogeneticsContainer animalId="remy" />
      </StoreProvider>
    );
    await waitFor(() => expect(probe.persistence.writer.role).toBe('writer'));
    expect(screen.queryByRole('button', { name: /apply this setup to/i })).not.toBeInTheDocument();
  });
});
