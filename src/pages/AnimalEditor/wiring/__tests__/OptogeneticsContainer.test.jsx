/**
 * OptogeneticsContainer — the animal-level setup is only a DEFAULT for new days; existing days keep
 * the setup they recorded (what they export). The container therefore offers the explicit
 * correction: apply the current default to the days whose saved setup differs, after a confirm.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
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
 * @param root0.extraDivergent
 */
function seed({ dayOpto, extraDivergent = false }) {
  const dayIds = ['remy-2023-06-22', 'remy-2023-06-23', ...(extraDivergent ? ['remy-2023-06-21'] : [])];
  const animal = { id: 'remy', subject: { subject_id: 'remy' }, optogenetics: SETUP, days: dayIds, devices: {}, cameras: [], behavioral_events: [] };
  const days = {
    'remy-2023-06-22': { id: 'remy-2023-06-22', animalId: 'remy', date: '2023-06-22', optogenetics: dayOpto, state: {} },
    'remy-2023-06-23': { id: 'remy-2023-06-23', animalId: 'remy', date: '2023-06-23', optogenetics: SETUP, state: {} },
    ...(extraDivergent
      ? {
          'remy-2023-06-21': {
            id: 'remy-2023-06-21',
            animalId: 'remy',
            date: '2023-06-21',
            optogenetics: null,
            state: { exported: true },
            exportReceipt: { filename: 'f', exportedAt: '2023-06-21T20:00:00.000Z', contentHash: 'h', appVersion: 'a', schemaVersion: 4, yamlStored: false },
          },
        }
      : {}),
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

  it('lets the scientist pick WHICH divergent days to correct, showing each day’s current setup and download status', async () => {
    const user = userEvent.setup();
    render(
      <StoreProvider initialState={{ workspace: seed({ dayOpto: null, extraDivergent: true }) }}>
        <Probe />
        <OptogeneticsContainer animalId="remy" />
      </StoreProvider>
    );
    await waitFor(() => expect(probe.persistence.writer.role).toBe('writer'));
    await user.click(screen.getByRole('button', { name: /apply this setup to 2 recording days/i }));
    const dialog = screen.getByRole('dialog');
    const june21 = within(dialog).getByRole('checkbox', { name: /2023-06-21/ });
    const june22 = within(dialog).getByRole('checkbox', { name: /2023-06-22/ });
    expect(june21).toBeChecked();
    expect(june22).toBeChecked();
    expect(within(dialog).getByText(/2023-06-21/).closest('label')).toHaveTextContent(/no optogenetics/i);
    expect(within(dialog).getByText(/2023-06-21/).closest('label')).toHaveTextContent(/downloaded/i);
    // Keep the historical non-opto day as it was; correct only June 22.
    await user.click(june21);
    await user.click(within(dialog).getByRole('button', { name: /^apply to 1 day$/i }));
    await waitFor(() => expect(probe.model.workspace.days['remy-2023-06-22'].optogenetics).toEqual(SETUP));
    expect(probe.model.workspace.days['remy-2023-06-21'].optogenetics).toBeNull();
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
