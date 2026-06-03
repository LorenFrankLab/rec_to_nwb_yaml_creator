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

  // The <main id="main-content"> landmark is owned by AnimalEditorStepper (and its
  // error screen), not by this entry wrapper — index.jsx no longer adds a second
  // <main>, so there is exactly one per route. The single-main landmark is asserted
  // in AnimalEditorStepper's tests and the per-route aria-landmarks integration test.
  it('renders the stepper as a pass-through (no wrapper main landmark)', () => {
    const { container } = renderWithStore(<AnimalEditor />);
    expect(screen.getByTestId('animal-editor-stepper')).toBeInTheDocument();
    // No extra <main> introduced by the entry wrapper (stepper is mocked here).
    expect(container.querySelectorAll('main')).toHaveLength(0);
  });
});
