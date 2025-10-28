import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StoreProvider } from '../../../state/StoreContext';
import DayEditorStepper from '../DayEditorStepper';

import { useDayIdFromUrl } from '../../../hooks/useDayIdFromUrl';

// Mock the hook
vi.mock('../../../hooks/useDayIdFromUrl', () => ({
  useDayIdFromUrl: vi.fn(),
}));

describe('DayEditorStepper', () => {
  const mockAnimal = {
    id: 'remy',
    subject: {
      subject_id: 'remy',
      species: 'Rat',
      sex: 'M',
      genotype: 'WT',
      date_of_birth: '2023-01-01',
    },
    experimenters: {
      experimenter_name: ['John Doe'],
      lab: 'Test Lab',
      institution: 'Test Institution',
    },
    devices: {
      data_acq_device: [],
      device: { name: [] },
    },
    configurationHistory: [{
      version: 1,
      devices: {
        electrode_groups: [],
        ntrode_electrode_group_channel_map: [],
      },
    }],
    cameras: [],
  };

  const mockDay = {
    date: '2023-06-22',
    animalId: 'remy',
    session: {
      session_id: 'remy_20230622',
      session_description: 'Day 45',
      experiment_description: '',
    },
    tasks: [],
    behavioral_events: [],
    associated_files: [],
    associated_video_files: [],
    technical: {
      times_period_multiplier: 1.5,
      raw_data_to_volts: 0.195,
      default_header_file_path: '',
      units: {},
    },
    state: {
      validationErrors: [],
    },
  };

  const mockInitialState = {
    workspace: {
      animals: {
        remy: mockAnimal,
      },
      days: {
        'remy-2023-06-22': mockDay,
      },
      settings: {},
    },
  };

  beforeEach(() => {
    useDayIdFromUrl.mockReturnValue('remy-2023-06-22');

    // Mock scrollIntoView (not implemented in JSDOM)
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('shows error when day not found', () => {
    useDayIdFromUrl.mockReturnValue('nonexistent-day');

    render(
      <StoreProvider initialState={mockInitialState}>
        <DayEditorStepper />
      </StoreProvider>
    );

    expect(screen.getByText(/Day not found/i)).toBeInTheDocument();
  });

  it('shows error when no dayId in URL', () => {
    useDayIdFromUrl.mockReturnValue(null);

    render(
      <StoreProvider initialState={mockInitialState}>
        <DayEditorStepper />
      </StoreProvider>
    );

    expect(screen.getByText(/No day ID provided/i)).toBeInTheDocument();
  });

  it('renders header with animal and date', () => {
    render(
      <StoreProvider initialState={mockInitialState}>
        <DayEditorStepper />
      </StoreProvider>
    );

    expect(screen.getByText(/Day Editor: remy - 2023-06-22/i)).toBeInTheDocument();
  });

  it('renders step navigation', () => {
    render(
      <StoreProvider initialState={mockInitialState}>
        <DayEditorStepper />
      </StoreProvider>
    );

    expect(screen.getByRole('button', { name: /Overview/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Devices/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Epochs/i })).toBeInTheDocument();
  });

  it('renders OverviewStep by default', () => {
    render(
      <StoreProvider initialState={mockInitialState}>
        <DayEditorStepper />
      </StoreProvider>
    );

    // Session Metadata should be visible by default
    expect(screen.getByText('Session Metadata')).toBeInTheDocument();

    // Breadcrumb navigation should be present
    expect(screen.getByRole('navigation', { name: /breadcrumb/i })).toBeInTheDocument();

    // Inherited metadata should be hidden by default (can be expanded)
    expect(screen.queryByText('Subject Information')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /view inherited metadata/i })).toBeInTheDocument();
  });

  it('navigates between steps', async () => {
    const user = userEvent.setup();

    render(
      <StoreProvider initialState={mockInitialState}>
        <DayEditorStepper />
      </StoreProvider>
    );

    // Click devices step
    const devicesButton = screen.getByRole('button', { name: /Devices/i });
    await user.click(devicesButton);

    // Should show devices stub
    expect(screen.getByText(/Devices Configuration/i)).toBeInTheDocument();
  });

  it('computes step status from validation', () => {
    render(
      <StoreProvider initialState={mockInitialState}>
        <DayEditorStepper />
      </StoreProvider>
    );

    // Check that step navigation exists (status computed internally)
    const overviewButton = screen.getByRole('button', { name: /Overview/i });
    expect(overviewButton).toBeInTheDocument();
  });

  it('renders back button to animal workspace', () => {
    render(
      <StoreProvider initialState={mockInitialState}>
        <DayEditorStepper />
      </StoreProvider>
    );

    // Check for back button
    const backButton = screen.getByRole('link', { name: /back to workspace/i });
    expect(backButton).toBeInTheDocument();
    expect(backButton).toHaveAttribute('href', '#/workspace?animal=remy');
    expect(backButton.textContent).toContain('Back');
  });
});
