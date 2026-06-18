import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AnimalScopeCard from '../AnimalScopeCard';

const summary = {
  identity: 'Laurent · Rattus norvegicus · M',
  probes: '2× tetrode_12.5',
  config: 'v1 · current · since 2023-06-22',
  team: 'Alice, Bob',
};

describe('AnimalScopeCard (read-only animal-static scope)', () => {
  it('renders compact context first and expands animal-static summary lines', async () => {
    const user = userEvent.setup();
    render(<AnimalScopeCard summary={summary} editHref="#/animal/laurent/electrode-groups" />);

    expect(screen.getByText(/animal context/i)).toBeInTheDocument();
    expect(screen.getAllByText(summary.identity).length).toBeGreaterThan(0);
    expect(screen.getByText(`Config ${summary.config}`)).toBeInTheDocument();

    await user.click(screen.getByText(/animal context/i).closest('summary'));

    expect(screen.getByText(summary.probes)).toBeInTheDocument();
    expect(screen.getByText(summary.config)).toBeInTheDocument();
    expect(screen.getByText(summary.team)).toBeInTheDocument();
  });

  it('links to the animal setup with a quiet edit affordance', async () => {
    const user = userEvent.setup();
    render(<AnimalScopeCard summary={summary} editHref="#/animal/laurent/electrode-groups" />);
    await user.click(screen.getByText(/animal context/i).closest('summary'));
    const link = screen.getByRole('link', { name: /edit animal setup/i });
    expect(link).toHaveAttribute('href', '#/animal/laurent/electrode-groups');
  });
});
