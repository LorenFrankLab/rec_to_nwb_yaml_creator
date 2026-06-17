import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StoreProvider } from '../../state/StoreContext';
import { AnimalWorkspace } from '../AnimalWorkspace';
import { Home } from '../Home';

/**
 * Belt-and-braces: even if a workspace reaches a consumer without its required
 * top-level sections (e.g. a store seeded from a structurally-incomplete source that
 * bypassed the persistence-layer shape repair), the read sites must not crash on
 * `Object.keys(undefined)`. An empty `{}` workspace exercises the missing
 * `animals`/`days`/`settings` paths directly.
 */
const seedEmptyWorkspace = { workspace: {} };

describe('rendering on a structurally-empty workspace', () => {
  it('AnimalWorkspace renders its empty state without crashing', () => {
    render(
      <StoreProvider initialState={seedEmptyWorkspace}>
        <AnimalWorkspace />
      </StoreProvider>
    );

    expect(screen.getByRole('heading', { name: /animal workspace/i })).toBeInTheDocument();
    expect(screen.getByText(/no animals/i)).toBeInTheDocument();
  });

  it('Home renders the create-animal wizard (incl. the default-experimenter path) without crashing', () => {
    render(
      <StoreProvider initialState={seedEmptyWorkspace}>
        <Home />
      </StoreProvider>
    );

    expect(screen.getByRole('main')).toBeInTheDocument();
  });
});
