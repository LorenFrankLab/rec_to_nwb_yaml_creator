import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../__tests__/helpers/test-utils';
import TasksFields from '../TasksFields';

describe('TasksFields', () => {
  let initialState;

  beforeEach(() => {
    initialState = {
      tasks: [
        {
          task_name: '',
          task_description: '',
          task_environment: '',
          camera_id: [],
          task_epochs: [],
        },
      ],
      cameras: [
        { id: 1, meters_per_pixel: 0.5, manufacturer: '', model: '', lens: '', camera_name: '' },
        { id: 2, meters_per_pixel: 0.5, manufacturer: '', model: '', lens: '', camera_name: '' },
      ],
    };
  });

  it('renders tasks section', () => {
    renderWithProviders(<TasksFields />, { initialState });
    expect(screen.getByText('Tasks')).toBeInTheDocument();
  });

  it('renders all task fields', () => {
    renderWithProviders(<TasksFields />, { initialState });
    expect(screen.getAllByLabelText(/Task Name/i)[0]).toBeInTheDocument();
    expect(screen.getAllByLabelText(/Task Description/i)[0]).toBeInTheDocument();
    expect(screen.getAllByLabelText(/Task Environment/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Camera Id/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Task Epochs/i)[0]).toBeInTheDocument();
  });

  it('displays values from formData', () => {
    const state = {
      ...initialState,
      tasks: [
        {
          task_name: 'linear track',
          task_description: 'Running back and forth',
          task_environment: 'track box',
          camera_id: [1],
          task_epochs: [1, 2],
        },
      ],
    };
    renderWithProviders(<TasksFields />, { initialState: state });
    expect(screen.getByDisplayValue('linear track')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Running back and forth')).toBeInTheDocument();
    expect(screen.getByDisplayValue('track box')).toBeInTheDocument();
  });

  it('renders multiple task items', () => {
    const state = {
      ...initialState,
      tasks: [
        {
          task_name: 'task1',
          task_description: 'desc1',
          task_environment: 'env1',
          camera_id: [],
          task_epochs: [],
        },
        {
          task_name: 'task2',
          task_description: 'desc2',
          task_environment: 'env2',
          camera_id: [],
          task_epochs: [],
        },
      ],
    };
    renderWithProviders(<TasksFields />, { initialState: state });
    expect(screen.getByDisplayValue('task1')).toBeInTheDocument();
    expect(screen.getByDisplayValue('task2')).toBeInTheDocument();
  });

  it('passes cameraIdsDefined to CheckboxList', () => {
    const state = {
      ...initialState,
      cameras: [
        { id: 1, meters_per_pixel: 0.5, manufacturer: '', model: '', lens: '', camera_name: '' },
        { id: 2, meters_per_pixel: 0.5, manufacturer: '', model: '', lens: '', camera_name: '' },
        { id: 3, meters_per_pixel: 0.5, manufacturer: '', model: '', lens: '', camera_name: '' },
      ],
    };
    renderWithProviders(<TasksFields />, { initialState: state });
    // CheckboxList should render with dataItems prop (from getCameraIds selector)
    expect(screen.getAllByText(/Camera Id/i)[0]).toBeInTheDocument();
  });

  describe('CRUD Operations', () => {
    it('renders add button for adding tasks', () => {
      renderWithProviders(<TasksFields />, { initialState });

      const addButton = screen.getByRole('button', { name: '＋' });
      expect(addButton).toBeInTheDocument();
    });

    it('renders remove button for removing tasks', () => {
      renderWithProviders(<TasksFields />, { initialState });

      const removeButton = screen.getByRole('button', { name: /Remove/i });
      expect(removeButton).toBeInTheDocument();
    });

    it('renders duplicate button for duplicating tasks', () => {
      renderWithProviders(<TasksFields />, { initialState });

      const duplicateButton = screen.getByRole('button', { name: /Duplicate/i });
      expect(duplicateButton).toBeInTheDocument();
    });
  });
});
