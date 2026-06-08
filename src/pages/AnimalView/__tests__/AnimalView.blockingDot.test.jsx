/**
 * Tests for the section-nav blocking-red dot (Phase 3a.5 / Phase 1 Task 1.1c carry-over).
 *
 * Once the field→tab attribution exists (3a.2), the section-nav can show WHICH setup tab holds an
 * export-blocking error — a red "— blocks export" dot, distinct from the neutral hollow-○ "not set
 * up" ring. Reuses the SAME attribution as repair routing (animalSetupTabForFieldPath), no second
 * mapping.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StoreProvider } from '../../../state/StoreContext';
import { buildRealisticWorkspace } from '../../../__tests__/fixtures/workspaceBuilders';
import { AnimalView } from '../index';

/**
 * Render AnimalView for an animal/tab against a seeded store.
 * @param {object} workspace - The workspace slice.
 * @param {string} [tab] - The active tab.
 * @returns {object} render result
 */
function renderView(workspace, tab = 'days') {
  return render(
    <StoreProvider initialState={{ workspace }}>
      <AnimalView animalId="remy" tab={tab} />
    </StoreProvider>
  );
}

describe('AnimalView — section-nav blocking dot (Phase 3a.5)', () => {
  beforeEach(() => {
    delete window.location;
    window.location = { hash: '#/animal/remy/days' };
  });
  afterEach(() => {
    window.location = { hash: '' };
  });

  it('marks the electrode-groups tab "blocks export" when a day has an export-blocking electrode error', () => {
    const { animal, day } = buildRealisticWorkspace();
    // An empty electrode-group location is a severity-error that attributes to electrode-groups.
    animal.configurationHistory[0].devices.electrode_groups[0].location = '';
    const workspace = { animals: { remy: animal }, days: { [day.id]: day }, settings: {} };
    renderView(workspace);
    expect(screen.getByRole('link', { name: /electrode groups — blocks export/i })).toBeInTheDocument();
    // A clean sibling setup tab is NOT marked blocking.
    expect(screen.queryByRole('link', { name: /cameras — blocks export/i })).not.toBeInTheDocument();
  });

  it('shows no blocking dot for a clean animal', () => {
    const { animal, day } = buildRealisticWorkspace();
    const workspace = { animals: { remy: animal }, days: { [day.id]: day }, settings: {} };
    renderView(workspace);
    expect(screen.queryByRole('link', { name: /blocks export/i })).not.toBeInTheDocument();
  });
});
