import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AnimalScopeCard from '../AnimalScopeCard';

const summary = {
  identity: 'Laurent · Rattus norvegicus · M',
  probes: '2× tetrode_12.5',
  config: 'v1 · current · since 2023-06-22',
  team: 'Alice, Bob',
};

describe('AnimalScopeCard (read-only animal-static scope)', () => {
  it('renders the animal-static summary lines', () => {
    render(<AnimalScopeCard summary={summary} editHref="#/animal/laurent/electrode-groups" />);
    expect(screen.getByText(summary.identity)).toBeInTheDocument();
    expect(screen.getByText(summary.probes)).toBeInTheDocument();
    expect(screen.getByText(summary.config)).toBeInTheDocument();
    expect(screen.getByText(summary.team)).toBeInTheDocument();
  });

  it('links to the animal setup with a quiet edit affordance', () => {
    render(<AnimalScopeCard summary={summary} editHref="#/animal/laurent/electrode-groups" />);
    const link = screen.getByRole('link', { name: /edit animal setup/i });
    expect(link).toHaveAttribute('href', '#/animal/laurent/electrode-groups');
  });
});
