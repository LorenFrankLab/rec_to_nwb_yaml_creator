/**
 * Tests for the pre-export warning acknowledgement on the per-animal Validation & Export tab
 * (Phase 3-6 — close the warning-escape on export).
 *
 * The export gate keys on error severity only, so non-blocking WARNINGS can ride a valid-only /
 * batch export unnoticed. These prove the export flow now: surfaces each warning day → its message,
 * and BLOCKS the download behind an explicit "I've reviewed these warnings" acknowledgement — while
 * leaving the gate itself unchanged (a warning-only day is still exportable once acknowledged).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StoreProvider } from '../../../state/StoreContext';
import { buildRealisticWorkspace } from '../../../__tests__/fixtures/workspaceBuilders';
import { checkShadowExport } from '../../../domain/shadowExport';
import { downloadYamlFile } from '../../../io/yaml';
import { AnimalView } from '../index';

vi.mock('../../../domain/shadowExport', () => ({ checkShadowExport: vi.fn() }));
vi.mock('../../../io/yaml', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, downloadYamlFile: vi.fn() };
});

/**
 * A single-animal workspace whose valid day carries a non-blocking inconsistent_location_case
 * warning (two electrode groups share a location spelled with different case).
 * @returns {object} workspace ({ animals, days, settings })
 */
function buildWarningWorkspace() {
  const { animal, day } = buildRealisticWorkspace();
  // v1's first CA1 group → "ca1" so "CA1" and "ca1" coexist (the location-case warning); the day
  // stays valid (case mismatch warns, never blocks).
  animal.configurationHistory[0].devices.electrode_groups[0].location = 'ca1';
  return { animals: { [animal.id]: animal }, days: { [day.id]: day }, settings: {} };
}

/**
 * A clean single-animal workspace (its valid day has no outstanding warnings).
 * @returns {object} workspace ({ animals, days, settings })
 */
function buildCleanWorkspace() {
  const { animal, day } = buildRealisticWorkspace();
  return { animals: { [animal.id]: animal }, days: { [day.id]: day }, settings: {} };
}

/**
 * Render the AnimalView export tab and click "Export Valid Only" to open the preflight.
 * @param {object} workspace - The seeded workspace.
 * @returns {object} the userEvent instance
 */
async function openPreflight(workspace) {
  const user = userEvent.setup();
  render(
    <StoreProvider initialState={{ workspace }}>
      <AnimalView animalId="remy" tab="export" />
    </StoreProvider>
  );
  await user.click(screen.getByRole('button', { name: /export valid only/i }));
  return user;
}

describe('AnimalView export tab — warning acknowledgement (Phase 3-6)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkShadowExport.mockReturnValue({ ok: true, yaml: 'metadata: ok\n', diff: '' });
    delete window.location;
    window.location = { hash: '#/animal/remy/export' };
  });
  afterEach(() => {
    window.location = { hash: '' };
  });

  it('surfaces each warning day → its message in the export flow', async () => {
    await openPreflight(buildWarningWorkspace());
    const ack = screen.getByRole('group', { name: /outstanding warnings to review/i });
    expect(within(ack).getByText(/inconsistent capitalization of the same location/i)).toBeInTheDocument();
  });

  it('blocks the download until the acknowledgement is checked', async () => {
    const user = await openPreflight(buildWarningWorkspace());
    const confirm = screen.getByRole('button', { name: /confirm export/i });
    // Gated: clicking while unacknowledged downloads nothing.
    await user.click(confirm);
    expect(downloadYamlFile).not.toHaveBeenCalled();
    // Acknowledge, then the same confirm proceeds.
    await user.click(screen.getByRole('checkbox', { name: /reviewed these warnings/i }));
    await user.click(screen.getByRole('button', { name: /confirm export/i }));
    expect(downloadYamlFile).toHaveBeenCalledTimes(1); // warning day still exportable once acknowledged
  });

  it('cancel aborts without downloading', async () => {
    const user = await openPreflight(buildWarningWorkspace());
    await user.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(downloadYamlFile).not.toHaveBeenCalled();
    expect(screen.queryByRole('group', { name: /outstanding warnings to review/i })).not.toBeInTheDocument();
  });

  it('no outstanding warnings → no acknowledgement step, export proceeds', async () => {
    const user = await openPreflight(buildCleanWorkspace());
    expect(screen.queryByRole('group', { name: /outstanding warnings to review/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /confirm export/i }));
    expect(downloadYamlFile).toHaveBeenCalledTimes(1);
  });
});
