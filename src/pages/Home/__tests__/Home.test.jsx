/**
 * @jest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Home from '../index';
import { StoreProvider } from '../../../state/StoreContext';

describe('Home - Animal Creation Container', () => {
  beforeEach(() => {
    // Reset window.location.hash
    window.location.hash = '';
  });

  it('renders AnimalCreationForm component', () => {
    render(
      <StoreProvider>
        <Home />
      </StoreProvider>
    );

    // Form should be present
    expect(screen.getByRole('form')).toBeInTheDocument();
    expect(screen.getByLabelText(/subject id/i)).toBeInTheDocument();
  });

  it('passes default experimenters from workspace settings', () => {
    const initialState = {
      workspace: {
        animals: {},
        days: {},
        settings: {
          default_lab: 'Test Lab',
          default_institution: 'Test University',
          default_experimenters: ['Bob Smith'],
        },
      },
    };

    render(
      <StoreProvider initialState={initialState}>
        <Home />
      </StoreProvider>
    );

    // Should pre-fill from settings
    expect(screen.getByLabelText(/lab/i)).toHaveValue('Test Lab');
    expect(screen.getByLabelText(/institution/i)).toHaveValue('Test University');
    expect(screen.getByLabelText(/experimenter 1/i)).toHaveValue('Bob Smith');
  });

  it('falls back to last animal experimenters when settings empty', () => {
    const initialState = {
      workspace: {
        animals: {
          remy: {
            experimenters: {
              experimenter_name: ['Alice Jones'],
              lab: 'Previous Lab',
              institution: 'Previous Institution',
            },
          },
        },
        days: {},
        settings: {},
      },
    };

    render(
      <StoreProvider initialState={initialState}>
        <Home />
      </StoreProvider>
    );

    // Should pre-fill from last animal
    expect(screen.getByLabelText(/lab/i)).toHaveValue('Previous Lab');
    expect(screen.getByLabelText(/institution/i)).toHaveValue('Previous Institution');
    expect(screen.getByLabelText(/experimenter 1/i)).toHaveValue('Alice Jones');
  });

  it('navigates to AnimalWorkspace after successful creation', async () => {
    const user = userEvent.setup();

    render(
      <StoreProvider>
        <Home />
      </StoreProvider>
    );

    // Fill required fields
    await user.type(screen.getByLabelText(/subject id/i), 'newanimal');
    await user.type(screen.getByLabelText(/genotype/i), 'Wild-type');
    await user.type(screen.getByLabelText(/experimenter 1/i), 'Test User');
    await user.type(screen.getByLabelText(/lab/i), 'Test Lab');
    await user.type(screen.getByLabelText(/institution/i), 'Test Uni');

    const today = new Date().toISOString().split('T')[0];
    await user.type(screen.getByLabelText(/date of birth/i), today);

    const submitButton = screen.getByRole('button', { name: /create animal/i });
    await user.click(submitButton);

    // Check navigation happened
    await waitFor(
      () => {
        expect(window.location.hash).toBe('#/workspace?animal=newanimal');
      },
      { timeout: 100 }
    );
  });

  it('shows error message when creation fails', async () => {
    const user = userEvent.setup();

    // Create an animal first
    const initialState = {
      workspace: {
        animals: {
          bean: {
            experimenters: {
              experimenter_name: ['Existing User'],
              lab: 'Existing Lab',
              institution: 'Existing Inst',
            },
          },
        },
        days: {},
        settings: {},
      },
    };

    render(
      <StoreProvider initialState={initialState}>
        <Home />
      </StoreProvider>
    );

    // Try to create duplicate
    await user.type(screen.getByLabelText(/subject id/i), 'bean');
    await user.tab(); // Trigger blur

    // Error should be shown (may appear in multiple places)
    expect(screen.getAllByText(/already exists/i).length).toBeGreaterThan(0);
  });

  it('has proper WCAG landmarks and heading', () => {
    render(
      <StoreProvider>
        <Home />
      </StoreProvider>
    );

    // Main landmark
    const main = screen.getByRole('main');
    expect(main).toBeInTheDocument();
    expect(main).toHaveAttribute('id', 'main-content');

    // Heading
    expect(screen.getByRole('heading', { name: /create new animal/i })).toBeInTheDocument();
  });

  it('shows first-time user notice when no animals exist', () => {
    render(
      <StoreProvider>
        <Home />
      </StoreProvider>
    );

    expect(screen.getByText(/welcome/i)).toBeInTheDocument();
  });

  it('hides first-time user notice when animals exist', () => {
    const initialState = {
      workspace: {
        animals: {
          remy: {
            experimenters: {
              experimenter_name: ['Test'],
              lab: 'Test Lab',
              institution: 'Test Inst',
            },
          },
        },
        days: {},
        settings: {},
      },
    };

    render(
      <StoreProvider initialState={initialState}>
        <Home />
      </StoreProvider>
    );

    expect(screen.queryByText(/welcome/i)).not.toBeInTheDocument();
  });
});
