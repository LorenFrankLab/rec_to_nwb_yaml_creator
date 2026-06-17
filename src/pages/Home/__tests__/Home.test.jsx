/**
 * @jest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import Home from '../index';
import { StoreProvider } from '../../../state/StoreContext';

/**
 * The Home route (`#/home`) is the create-animal screen. Since the epoch-editor Phase 6 it renders
 * the guided CreateAnimalWizard (the one-shot AnimalCreationForm was retired). The wizard's own
 * behaviour is covered in CreateAnimalWizard.test.jsx; here we only assert Home mounts it as the
 * single create entry, with the required landmark.
 */
describe('Home — create-animal screen', () => {
  beforeEach(() => {
    window.location.hash = '';
  });

  it('renders the guided create-animal wizard', () => {
    render(
      <StoreProvider>
        <Home />
      </StoreProvider>
    );
    expect(screen.getByRole('heading', { name: /new animal/i })).toBeInTheDocument();
    expect(screen.getByRole('tablist', { name: /setup steps/i })).toBeInTheDocument();
  });

  it('exposes the main landmark', () => {
    render(
      <StoreProvider>
        <Home />
      </StoreProvider>
    );
    const main = screen.getByRole('main');
    expect(main).toBeInTheDocument();
    expect(main).toHaveAttribute('id', 'main-content');
  });
});
