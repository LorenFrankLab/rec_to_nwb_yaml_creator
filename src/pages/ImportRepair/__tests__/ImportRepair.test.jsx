/**
 * Import & Repair screen (validation slice).
 *
 * Drives the USER-FACING flow against a LIVE store and the REAL pure spine (no mocks): pick a
 * non-conforming file, see each field flagged with a suggested fix from the shared validator, watch
 * required-missing block the import, accept/fill, then commit through the existing import path and
 * land on a success state that links to the created animal / added day. Existing-day routing is
 * proven by importing onto a workspace that already has the subject.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import fs from 'fs';
import path from 'path';
import { StoreProvider, useStoreContext } from '../../../state/StoreContext';
import ImportRepair from '../index';

const originalHash = window.location.hash;
afterEach(() => {
  window.location.hash = originalHash;
});

const nonconformingYaml = fs.readFileSync(
  path.join(__dirname, '../../../__tests__/fixtures/import/nonconforming-remy.yml'),
  'utf8'
);

/** The live workspace, captured for assertions. */
let captured;

/**
 * Render-only probe capturing the live workspace.
 * @returns {null} Renders nothing.
 */
function StoreProbe() {
  captured = useStoreContext().model.workspace;
  return null;
}

/**
 * A File-like object whose `.text()` resolves to the given content (jsdom's File does not always
 * expose `.text()`; the parse helper only calls that).
 * @param {string} name - File name.
 * @param {string} text - File contents.
 * @returns {{ name: string, text: () => Promise<string> }} The file-like object.
 */
function makeFile(name, text) {
  return { name, text: () => Promise.resolve(text) };
}

/**
 * Render the screen against an initial workspace.
 * @param {object} [animals] - Initial workspace.animals.
 * @returns {object} The render result.
 */
function renderScreen(animals = {}) {
  captured = null;
  return render(
    <StoreProvider initialState={{ workspace: { animals, days: {}, settings: {} } }}>
      <ImportRepair />
      <StoreProbe />
    </StoreProvider>
  );
}

/**
 * Upload the non-conforming fixture and wait for the repair view.
 * @param {object} user - userEvent session.
 */
async function uploadNonconforming(user) {
  const input = screen.getByLabelText(/choose a metadata yaml file/i);
  await user.upload(input, makeFile('nonconforming-remy.yml', nonconformingYaml));
  await screen.findByRole('heading', { name: /needs attention/i });
}

describe('ImportRepair — flagging + suggested fixes', () => {
  it('flags each non-conforming field with the suggested fix from the shared validator', async () => {
    const user = userEvent.setup();
    renderScreen();
    await uploadNonconforming(user);

    const attention = screen.getByRole('region', { name: /needs attention/i });
    expect(within(attention).getByText('Rattus norvegicus')).toBeInTheDocument();
    expect(within(attention).getByText('M')).toBeInTheDocument();
    expect(within(attention).getByText('485')).toBeInTheDocument();
    // The scalar experimenter name is preserved verbatim (it appears as both the original and the
    // list-wrapped suggestion — identical text, so there are two).
    expect(within(attention).getAllByText(/Guidera, Jennifer/).length).toBeGreaterThanOrEqual(1);
    // The empty location is a user-input row (no laundered value).
    expect(within(attention).getByLabelText(/Electrode group location/i)).toBeInTheDocument();
  });

  it('blocks import until the required-but-missing date_of_birth is supplied', async () => {
    const user = userEvent.setup();
    renderScreen();
    await uploadNonconforming(user);

    const required = screen.getByRole('region', { name: /required, but missing/i });
    expect(within(required).getByLabelText(/Date of birth/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /import as new animal/i })).toBeDisabled();
  });
});

describe('ImportRepair — commit', () => {
  it('creates a new animal and shows a success link once every fix is accepted', async () => {
    const user = userEvent.setup();
    renderScreen();
    await uploadNonconforming(user);

    // Accept every suggested fix.
    for (const btn of screen.getAllByRole('button', { name: /^accept /i })) {
      await user.click(btn);
    }
    // Supply the user-input fields.
    await user.type(screen.getByLabelText(/Electrode group location/i), 'CA1');
    // jsdom date inputs don't reliably accept segmented userEvent typing — set the value directly.
    fireEvent.change(screen.getByLabelText(/Date of birth/i), { target: { value: '2023-01-10' } });

    const importBtn = screen.getByRole('button', { name: /import as new animal/i });
    expect(importBtn).toBeEnabled();
    await user.click(importBtn);

    // The animal landed in the store…
    expect(Object.keys(captured.animals)).toContain('remy');
    // …and the success state links to it.
    const success = await screen.findByRole('region', { name: /import (complete|result)/i });
    const link = within(success).getByRole('link', { name: /remy/i });
    expect(link).toHaveAttribute('href', '#/animal/remy/days');
  });

  it('adds a recording day to an existing animal (existing-day routing)', async () => {
    const user = userEvent.setup();
    renderScreen({
      remy: {
        id: 'remy',
        subject: { subject_id: 'remy' },
        days: [],
        configurationHistory: [{ version: 1, devices: { electrode_groups: [], ntrode_electrode_group_channel_map: [] }, appliedToDays: [] }],
      },
    });
    await uploadNonconforming(user);

    // The decision routes to the existing animal.
    expect(screen.getByText(/already exists/i)).toBeInTheDocument();

    for (const btn of screen.getAllByRole('button', { name: /^accept /i })) {
      await user.click(btn);
    }
    await user.type(screen.getByLabelText(/Electrode group location/i), 'CA1');
    // jsdom date inputs don't reliably accept segmented userEvent typing — set the value directly.
    fireEvent.change(screen.getByLabelText(/Date of birth/i), { target: { value: '2023-01-10' } });

    await user.click(screen.getByRole('button', { name: /add recording day/i }));

    // A day was added to the existing animal (no new animal created).
    expect(Object.keys(captured.animals)).toEqual(['remy']);
    expect(Object.keys(captured.days).length).toBe(1);
  });
});
