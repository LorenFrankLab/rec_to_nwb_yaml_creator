/**
 * @file Tests for AnimalWorkspace component (M4)
 *
 * Tests the Animal Workspace MVP UI that manages animals and days.
 * Following TDD - these tests define the expected behavior before implementation.
 *
 * Test Structure:
 * - Initial State: Workspace renders with expected UI elements
 * - Empty States: Appropriate messages when no animals/days exist
 * - URL Parameters: Auto-select animal from ?animal= parameter
 *
 * @see docs/ANIMAL_WORKSPACE_DESIGN.md for UI mockups
 * @see docs/animal_hierarchy.md for data model
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  describe('URL Parameter Handling', () => {
    let originalHash;

    beforeEach(() => {
      // Save original hash
      originalHash = window.location.hash;
    });

    afterEach(() => {
      // Restore original hash
      window.location.hash = originalHash;
    });

    it('auto-selects animal from ?animal= URL parameter', () => {
      // Set URL parameter
      window.location.hash = '#/workspace?animal=testanimal';

      // Create initial state with an animal
      const initialState = {
        workspace: {
          animals: {
            testanimal: {
              subject: {
                subject_id: 'testanimal',
                species: 'Rattus norvegicus',
                sex: 'M',
              },
              days: [],
            },
          },
          days: {},
          settings: {},
        },
      };

      render(
        <StoreProvider initialState={initialState}>
          <AnimalWorkspace />
        </StoreProvider>
      );

      // Verify animal is selected (button should have aria-pressed="true")
      const animalButton = screen.getByRole('button', { name: /testanimal/i });
      expect(animalButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('does not auto-select if animal does not exist', () => {
      // Set URL parameter for non-existent animal
      window.location.hash = '#/workspace?animal=nonexistent';

      // Create initial state with a different animal
      const initialState = {
        workspace: {
          animals: {
            otheranimal: {
              subject: {
                subject_id: 'otheranimal',
                species: 'Rattus norvegicus',
                sex: 'M',
              },
              days: [],
            },
          },
          days: {},
          settings: {},
        },
      };

      render(
        <StoreProvider initialState={initialState}>
          <AnimalWorkspace />
        </StoreProvider>
      );

      // Verify no animal is selected
      const animalButton = screen.getByRole('button', { name: /otheranimal/i });
      expect(animalButton).toHaveAttribute('aria-pressed', 'false');
    });
  });

  describe('Recording Day Creation with Calendar', () => {
    let originalHash;

    beforeEach(() => {
      originalHash = window.location.hash;
    });

    afterEach(() => {
      window.location.hash = originalHash;
    });

    it('shows button to open calendar for adding days', async () => {
      const user = userEvent.setup();

      const initialState = {
        workspace: {
          animals: {
            testanimal: {
              subject: { subject_id: 'testanimal' },
              days: [],
            },
          },
          days: {},
          settings: {},
        },
      };

      render(
        <StoreProvider initialState={initialState}>
          <AnimalWorkspace />
        </StoreProvider>
      );

      // Select animal
      const animalButton = screen.getByRole('button', { name: /testanimal/i });
      await user.click(animalButton);

      // Check for "Add Recording Days" button (aria-label is "Show calendar")
      const addButton = screen.getByRole('button', { name: /show calendar/i });
      expect(addButton).toBeInTheDocument();
      // Button text should be "Add Recording Days"
      expect(addButton).toHaveTextContent(/add recording days/i);
    });

    it('opens calendar when button is clicked', async () => {
      const user = userEvent.setup();

      const initialState = {
        workspace: {
          animals: {
            testanimal: {
              subject: { subject_id: 'testanimal' },
              days: [],
            },
          },
          days: {},
          settings: {},
        },
      };

      render(
        <StoreProvider initialState={initialState}>
          <AnimalWorkspace />
        </StoreProvider>
      );

      // Select animal
      const animalButton = screen.getByRole('button', { name: /testanimal/i });
      await user.click(animalButton);

      // Click "Add Recording Days" button
      const addButton = screen.getByRole('button', { name: /show calendar/i });
      await user.click(addButton);

      // Calendar should appear
      expect(screen.getByRole('dialog', { name: /recording days calendar/i })).toBeInTheDocument();
    });

    it('hides calendar when close button is clicked', async () => {
      const user = userEvent.setup();

      const initialState = {
        workspace: {
          animals: {
            testanimal: {
              subject: { subject_id: 'testanimal' },
              days: [],
            },
          },
          days: {},
          settings: {},
        },
      };

      render(
        <StoreProvider initialState={initialState}>
          <AnimalWorkspace />
        </StoreProvider>
      );

      // Select animal
      const animalButton = screen.getByRole('button', { name: /testanimal/i });
      await user.click(animalButton);

      // Open calendar
      const addButton = screen.getByRole('button', { name: /show calendar/i });
      await user.click(addButton);

      // Close calendar
      const closeButton = screen.getByRole('button', { name: /close calendar/i });
      await user.click(closeButton);

      // Calendar should be hidden
      expect(screen.queryByRole('dialog', { name: /recording days calendar/i })).not.toBeInTheDocument();
    });
  });

  describe('Create New Animal Button', () => {
    it('shows "New Animal" button in animal list sidebar', () => {
      const initialState = {
        workspace: {
          animals: {
            testanimal: {
              subject: { subject_id: 'testanimal' },
              days: [],
            },
          },
          days: {},
          settings: {},
        },
      };

      render(
        <StoreProvider initialState={initialState}>
          <AnimalWorkspace />
        </StoreProvider>
      );

      // Check for the "New Animal" button/link
      const createButton = screen.getByRole('link', { name: /create new animal/i });
      expect(createButton).toBeInTheDocument();
      expect(createButton).toHaveAttribute('href', '#/home');
    });
  });

  describe('Edit Devices Button', () => {
    it('shows "Edit Devices" button when animal is selected', async () => {
      const user = userEvent.setup();

      const initialState = {
        workspace: {
          animals: {
            testanimal: {
              subject: { subject_id: 'testanimal' },
              days: [],
            },
          },
          days: {},
          settings: {},
        },
      };

      render(
        <StoreProvider initialState={initialState}>
          <AnimalWorkspace />
        </StoreProvider>
      );

      // Select animal
      const animalButton = screen.getByRole('button', { name: /testanimal/i });
      await user.click(animalButton);

      // Check for "Edit Devices" button/link
      const editDevicesLink = screen.getByRole('link', { name: /edit devices|configure hardware/i });
      expect(editDevicesLink).toBeInTheDocument();
    });

    it('navigates to Animal Editor when "Edit Devices" button is clicked', async () => {
      const user = userEvent.setup();

      const initialState = {
        workspace: {
          animals: {
            testanimal: {
              subject: { subject_id: 'testanimal' },
              days: [],
            },
          },
          days: {},
          settings: {},
        },
      };

      render(
        <StoreProvider initialState={initialState}>
          <AnimalWorkspace />
        </StoreProvider>
      );

      // Select animal
      const animalButton = screen.getByRole('button', { name: /testanimal/i });
      await user.click(animalButton);

      // Check the href of the "Edit Devices" button
      const editDevicesLink = screen.getByRole('link', { name: /edit devices|configure hardware/i });
      expect(editDevicesLink).toHaveAttribute('href', '#/animal/testanimal/editor');
    });

    it('does not show "Edit Devices" button when no animal is selected', () => {
      const initialState = {
        workspace: {
          animals: {
            testanimal: {
              subject: { subject_id: 'testanimal' },
              days: [],
            },
          },
          days: {},
          settings: {},
        },
      };

      render(
        <StoreProvider initialState={initialState}>
          <AnimalWorkspace />
        </StoreProvider>
      );

      // No animal selected yet
      // Check that "Edit Devices" button/link is not present
      const editDevicesLink = screen.queryByRole('link', { name: /edit devices|configure hardware/i });
      expect(editDevicesLink).not.toBeInTheDocument();
    });
  });
});
