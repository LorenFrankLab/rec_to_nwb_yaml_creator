import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StoreProvider } from '../../../state/StoreContext';

import AnimalEditor from '../index';

// Mock the stepper component (we'll implement it in next task)
vi.mock('../AnimalEditorStepper', () => ({
  default: () => <div data-testid="animal-editor-stepper">Stepper</div>
}));

describe('AnimalEditor', () => {
  const mockInitialState = {
    workspace: {
      animals: {
        remy: {
          id: 'remy',
          subject: { subject_id: 'remy' },
          devices: { electrode_groups: [], ntrode_electrode_group_channel_map: [] },
          days: []
        }
      },
      days: {}
    }
  };

  /**
   *
   * @param component
   */
  function renderWithStore(component) {
    return render(
      <StoreProvider initialState={mockInitialState}>
        {component}
      </StoreProvider>
    );
  }

  it('renders main landmark with proper aria-label', () => {
    renderWithStore(<AnimalEditor />);
    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('aria-labelledby', 'animal-editor-heading');
  });

  it('renders stepper component', () => {
    renderWithStore(<AnimalEditor />);
    expect(screen.getByTestId('animal-editor-stepper')).toBeInTheDocument();
  });
});
