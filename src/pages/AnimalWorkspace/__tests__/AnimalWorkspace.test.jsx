/**
 * @file Tests for AnimalWorkspace component (M4)
 *
 * Tests the Animal Workspace MVP UI that manages animals and days.
 * Following TDD - these tests define the expected behavior before implementation.
 *
 * Test Structure:
 * - Initial State: Workspace renders with expected UI elements
 * - Empty States: Appropriate messages when no animals/days exist
 *
 * @see docs/ANIMAL_WORKSPACE_DESIGN.md for UI mockups
 * @see docs/animal_hierarchy.md for data model
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StoreProvider } from '../../../state/StoreContext';
import { AnimalWorkspace } from '../index';

describe('AnimalWorkspace Component (M4) - Initial State', () => {
  describe('Empty Workspace', () => {
    it('renders main heading', () => {
      render(
        <StoreProvider>
          <AnimalWorkspace />
        </StoreProvider>
      );

      // Verify heading
      expect(screen.getByRole('heading', { name: /animal workspace/i })).toBeInTheDocument();
    });

    it('shows empty state message when no animals exist', () => {
      render(
        <StoreProvider>
          <AnimalWorkspace />
        </StoreProvider>
      );

      // Verify empty state message
      expect(screen.getByText(/no animals/i)).toBeInTheDocument();
    });

    it('provides link to create first animal', () => {
      render(
        <StoreProvider>
          <AnimalWorkspace />
        </StoreProvider>
      );

      // Should have link to Home view for animal creation
      const createLink = screen.getByRole('link', { name: /create.*animal/i });
      expect(createLink).toBeInTheDocument();
      expect(createLink).toHaveAttribute('href', expect.stringMatching(/#\/?home/i));
    });

    it('renders with proper ARIA landmarks', () => {
      const { container } = render(
        <StoreProvider>
          <AnimalWorkspace />
        </StoreProvider>
      );

      // Verify main landmark with correct ID
      const main = container.querySelector('main#main-content');
      expect(main).toBeInTheDocument();
      expect(main).toHaveAttribute('role', 'main');
      expect(main).toHaveAttribute('tabIndex', '-1');
    });
  });
});
