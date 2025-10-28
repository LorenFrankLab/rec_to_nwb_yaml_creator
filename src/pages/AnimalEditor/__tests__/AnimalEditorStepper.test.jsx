import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StoreProvider } from '../../../state/StoreContext';
import AnimalEditorStepper from '../AnimalEditorStepper';

import { useAnimalIdFromUrl } from '../../../hooks/useAnimalIdFromUrl';

// Mock hooks
vi.mock('../../../hooks/useAnimalIdFromUrl', () => ({
  useAnimalIdFromUrl: vi.fn(),
}));

describe('AnimalEditorStepper', () => {
  const mockInitialState = {
    workspace: {
      animals: {
        remy: {
          id: 'remy',
          subject: { subject_id: 'remy' },
          devices: {
            electrode_groups: [],
            ntrode_electrode_group_channel_map: [],
          },
          days: [],
        },
      },
      days: {},
    },
  };

  /**
   *
   * @param component
   * @param initialState
   */
  function renderWithStore(component, initialState = mockInitialState) {
    return render(
      <StoreProvider initialState={initialState}>
        {component}
      </StoreProvider>
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    useAnimalIdFromUrl.mockReturnValue('remy');
  });

  describe('Animal validation', () => {
    it('renders stepper when animal exists', () => {
      renderWithStore(<AnimalEditorStepper />);
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Animal Editor: remy');
    });

    it('shows error when animal not found', () => {
      const emptyState = { workspace: { animals: {}, days: {} } };
      renderWithStore(<AnimalEditorStepper />, emptyState);
      expect(screen.getByText(/Animal.*not found/i)).toBeInTheDocument();
    });

    it('shows error when no animal ID in URL', () => {
      useAnimalIdFromUrl.mockReturnValue(null);
      renderWithStore(<AnimalEditorStepper />);
      expect(screen.getByText(/No animal specified/i)).toBeInTheDocument();
    });
  });

  describe('Step navigation', () => {
    it('starts at step 0 (Electrode Groups)', () => {
      renderWithStore(<AnimalEditorStepper />);
      // Check for step content
      expect(screen.getByText(/Electrode Groups \(Step 1\)/i)).toBeInTheDocument();
    });

    it('Next button advances to step 1 (Channel Maps)', async () => {
      const user = userEvent.setup();
      renderWithStore(<AnimalEditorStepper />);

      const nextButton = screen.getByRole('button', { name: /next step/i });
      await user.click(nextButton);

      expect(screen.getByText(/Channel Maps \(Step 2\)/i)).toBeInTheDocument();
    });

    it('Back button returns to step 0', async () => {
      const user = userEvent.setup();
      renderWithStore(<AnimalEditorStepper />);

      // Go to step 1
      const nextButton = screen.getByRole('button', { name: /next step/i });
      await user.click(nextButton);
      expect(screen.getByText(/Channel Maps \(Step 2\)/i)).toBeInTheDocument();

      // Go back to step 0
      const backButton = screen.getByRole('button', { name: /previous step/i });
      await user.click(backButton);
      expect(screen.getByText(/Electrode Groups \(Step 1\)/i)).toBeInTheDocument();
    });

    it('Back button disabled on step 0', () => {
      renderWithStore(<AnimalEditorStepper />);
      const backButton = screen.getByRole('button', { name: /previous step/i });
      expect(backButton).toBeDisabled();
    });

    it('Next button changes to Save on final step', async () => {
      const user = userEvent.setup();
      renderWithStore(<AnimalEditorStepper />);

      // Navigate to final step
      const nextButton = screen.getByRole('button', { name: /next step/i });
      await user.click(nextButton);

      // Check button label changed
      expect(screen.getByRole('button', { name: /save configuration/i })).toBeInTheDocument();
    });
  });

  describe('Step indicators', () => {
    it('shows 2 step indicators with correct labels', () => {
      renderWithStore(<AnimalEditorStepper />);
      expect(screen.getByText('Electrode Groups')).toBeInTheDocument();
      expect(screen.getByText('Channel Maps')).toBeInTheDocument();
    });

    it('marks active step visually', () => {
      renderWithStore(<AnimalEditorStepper />);
      const nav = screen.getByRole('navigation', { name: /configuration steps/i });
      const electrodeGroupsStep = nav.querySelector('.active');
      expect(electrodeGroupsStep).toHaveTextContent('Electrode Groups');
    });
  });

  describe('Accessibility', () => {
    it('has proper heading with animal ID', () => {
      renderWithStore(<AnimalEditorStepper />);
      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toHaveTextContent('Animal Editor: remy');
    });

    it('navigation has proper aria-label', () => {
      renderWithStore(<AnimalEditorStepper />);
      expect(screen.getByRole('navigation', { name: /configuration steps/i })).toBeInTheDocument();
    });

    it('buttons have aria-labels', () => {
      renderWithStore(<AnimalEditorStepper />);
      expect(screen.getByRole('button', { name: /previous step/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /next step/i })).toBeInTheDocument();
    });
  });
});
