/**
 * Tests for the section-nav optogenetics COUNT slot honesty (QA fix).
 *
 * The opto count is decorative (aria-hidden); the blocking signal lives on the link's accessible
 * name (the red ● "— blocks export"). Previously the count hardcoded "used" whenever opto was
 * configured, so a PARTIAL/incomplete opto config showed "● used" — the count dishonestly implied a
 * complete, usable setup right next to a blocker. The count must AGREE with reality:
 *   - COMPLETE opto (all four export-gated fields) → "used"
 *   - PARTIAL opto (some-but-not-all) → "incomplete" (NOT "used")
 *   - NEVER configured → the hollow-○ "not set up" todo path owns the slot (no count shown)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { StoreProvider } from '../../../state/StoreContext';
import { buildRealisticWorkspace } from '../../../__tests__/fixtures/workspaceBuilders';
import { AnimalView } from '../index';

/** All four export-gated opto fields present — a COMPLETE setup. */
const COMPLETE_OPTO = {
  opto_excitation_source: [{ name: 'laser_473' }],
  optical_fiber: [{ name: 'fiber_A' }],
  virus_injection: [{ name: 'AAV5' }],
  optogenetic_stimulation_software: 'fsgui',
};

/** Only one of the four fields present — a PARTIAL setup (export-blocking). */
const PARTIAL_OPTO = {
  opto_excitation_source: [{ name: 'laser_473' }],
  optical_fiber: [],
  virus_injection: [],
  optogenetic_stimulation_software: '',
};

/**
 * Render AnimalView against a seeded store, optionally overriding the animal's optogenetics.
 * @param {object|undefined} optogenetics - The animal-level optogenetics object (or undefined).
 * @returns {object} render result
 */
function renderWithOpto(optogenetics) {
  const { animal, day } = buildRealisticWorkspace();
  animal.optogenetics = optogenetics;
  const workspace = { animals: { remy: animal }, days: { [day.id]: day }, settings: {} };
  return render(
    <StoreProvider initialState={{ workspace }}>
      <AnimalView animalId="remy" tab="days" />
    </StoreProvider>
  );
}

/**
 * The optogenetics section-nav link.
 * @returns {HTMLElement} The optogenetics anchor.
 */
function optoLink() {
  // Configured (complete/partial) opto has no aria-label, so it falls back to its visible name.
  return screen.getByRole('link', { name: /^optogenetics/i });
}

describe('AnimalView — section-nav optogenetics count honesty', () => {
  beforeEach(() => {
    delete window.location;
    window.location = { hash: '#/animal/remy/days' };
  });
  afterEach(() => {
    window.location = { hash: '' };
  });

  // Written FIRST (TDD): this FAILED against the hardcoded "used" — a partial opto showed "● used".
  it('shows "incomplete" (NOT "used") in the count AND a blocking ● for a PARTIAL opto config', () => {
    renderWithOpto(PARTIAL_OPTO);
    // The partial opto rule blocks export — the link's accessible name carries the ● meaning.
    expect(
      screen.getByRole('link', { name: /optogenetics — blocks export/i })
    ).toBeInTheDocument();
    // The decorative count must AGREE with the blocker, not contradict it.
    const link = screen.getByRole('link', { name: /optogenetics — blocks export/i });
    const count = within(link).getByText('incomplete');
    expect(count).toBeInTheDocument();
    expect(within(link).queryByText('used')).not.toBeInTheDocument();
  });

  it('shows "used" in the count for a COMPLETE opto config (all four export-gated fields present)', () => {
    renderWithOpto(COMPLETE_OPTO);
    const link = optoLink();
    // The count reflects the four-field completeness ONLY (the same definition as the export rule's
    // partial_configuration gate) — all four present → "used", never "incomplete".
    expect(within(link).getByText('used')).toBeInTheDocument();
    expect(within(link).queryByText('incomplete')).not.toBeInTheDocument();
  });

  it('shows the hollow-○ "not set up" (no count) for a never-configured opto row', () => {
    renderWithOpto(undefined);
    const link = screen.getByRole('link', { name: /optogenetics — not set up/i });
    expect(link).toBeInTheDocument();
    // The TODO row shows the ○ ring instead of a count word.
    expect(within(link).queryByText('used')).not.toBeInTheDocument();
    expect(within(link).queryByText('incomplete')).not.toBeInTheDocument();
  });
});
