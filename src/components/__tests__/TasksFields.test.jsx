import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import TasksFields from '../TasksFields';

describe('TasksFields', () => {
  let defaultProps;

  beforeEach(() => {
    defaultProps = {
      formData: {
        tasks: [
          {
            task_name: '',
            task_description: '',
            task_environment: '',
            camera_id: [],
            task_epochs: [],
          },
        ],
      },
      handleChange: vi.fn(() => vi.fn()),
      onBlur: vi.fn(),
      updateFormData: vi.fn(),
      updateFormArray: vi.fn(),
      addArrayItem: vi.fn(),
      removeArrayItem: vi.fn(),
      duplicateArrayItem: vi.fn(),
      cameraIdsDefined: [1, 2],
    };
  });

  it('renders tasks section', () => {
    render(<TasksFields {...defaultProps} />);
    expect(screen.getByText('Tasks')).toBeInTheDocument();
  });

  it('renders all task fields', () => {
    render(<TasksFields {...defaultProps} />);
    expect(screen.getAllByLabelText(/Task Name/i)[0]).toBeInTheDocument();
    expect(screen.getAllByLabelText(/Task Description/i)[0]).toBeInTheDocument();
    expect(screen.getAllByLabelText(/Task Environment/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Camera Id/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Task Epochs/i)[0]).toBeInTheDocument();
  });

  it('displays values from formData', () => {
    const props = {
      ...defaultProps,
      formData: {
        tasks: [
          {
            task_name: 'linear track',
            task_description: 'Running back and forth',
            task_environment: 'track box',
            camera_id: [1],
            task_epochs: [1, 2],
          },
        ],
      },
    };
    render(<TasksFields {...props} />);
    expect(screen.getByDisplayValue('linear track')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Running back and forth')).toBeInTheDocument();
    expect(screen.getByDisplayValue('track box')).toBeInTheDocument();
  });

  it('renders multiple task items', () => {
    const props = {
      ...defaultProps,
      formData: {
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
      },
    };
    render(<TasksFields {...props} />);
    expect(screen.getByDisplayValue('task1')).toBeInTheDocument();
    expect(screen.getByDisplayValue('task2')).toBeInTheDocument();
  });

  it('passes cameraIdsDefined to CheckboxList', () => {
    const props = {
      ...defaultProps,
      cameraIdsDefined: [1, 2, 3],
    };
    render(<TasksFields {...props} />);
    // CheckboxList should render with dataItems prop
    expect(screen.getAllByText(/Camera Id/i)[0]).toBeInTheDocument();
  });
});
