/**
 * @file Unit tests for AnimalScopeChips — the read-only animal-static scope chips.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AnimalScopeChips from '../AnimalScopeChips';

describe('AnimalScopeChips', () => {
  it('renders identity, probe, config, and team chips; omits unset facts', () => {
    render(
      <AnimalScopeChips
        summary={{
          id: 'remy',
          genotype: 'PV-Cre',
          sex: 'M',
          species: 'Rattus norvegicus',
          dateOfBirth: '2025-12-03T00:00:00',
          isOpto: false,
          probeCount: 3,
          probeSummary: 'CA1, mPFC',
          configVersion: 2,
          team: 'Alice, Bob',
        }}
      />,
    );
    expect(screen.getByText('PV-Cre')).toBeInTheDocument();
    expect(screen.getByText('b. 2025-12-03')).toBeInTheDocument();
    expect(screen.getByText('3 probes — CA1, mPFC')).toBeInTheDocument();
    expect(screen.getByText('Config v2')).toBeInTheDocument();
    expect(screen.getByText('Team: Alice, Bob')).toBeInTheDocument();
    expect(screen.queryByText('Optogenetics')).not.toBeInTheDocument();
  });

  it('shows the optogenetics chip only for an opto animal', () => {
    render(
      <AnimalScopeChips
        summary={{ id: 'x', isOpto: true, probeCount: 0, probeSummary: '', configVersion: null, team: '' }}
      />,
    );
    expect(screen.getByText('Optogenetics')).toBeInTheDocument();
    // No probe / config / team chips when those are empty.
    expect(screen.queryByText(/probe/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Config v/)).not.toBeInTheDocument();
  });
});
