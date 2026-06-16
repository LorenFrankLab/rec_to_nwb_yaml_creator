/**
 * @file Accessibility pass over the Animals home table (jest-axe).
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import { StoreProvider } from '../../../state/StoreContext';
import { AnimalWorkspace } from '../index';
import { buildRealisticWorkspace } from '../../../__tests__/fixtures/workspaceBuilders';

describe('Animals home — accessibility', () => {
  it('the populated table (incl. an opto row) has no axe violations', async () => {
    const { animal, day } = buildRealisticWorkspace();
    // Include an opto animal so axe also sees the opto tag.
    const laurent = {
      id: 'laurent',
      subject: { subject_id: 'laurent', genotype: 'PV-Cre', species: 'Rattus norvegicus' },
      days: [],
      optogenetics: { optical_fiber: [{ id: 0 }], opto_excitation_source: [], virus_injection: [] },
    };
    const { container } = render(
      <StoreProvider
        initialState={{
          workspace: { animals: { [animal.id]: animal, laurent }, days: { [day.id]: day }, settings: {} },
        }}
      >
        <AnimalWorkspace />
      </StoreProvider>
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
