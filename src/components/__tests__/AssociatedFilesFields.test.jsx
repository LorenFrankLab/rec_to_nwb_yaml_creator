import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../__tests__/helpers/test-utils';
import AssociatedFilesFields from '../AssociatedFilesFields';

describe('AssociatedFilesFields Component', () => {
  let initialState;

  beforeEach(() => {
    initialState = {
      associated_files: [
        {
          name: 'analysis_script.py',
          description: 'Python script for data analysis',
          path: '/path/to/analysis_script.py',
          task_epochs: [1, 2],
        },
      ],
      associated_video_files: [
        {
          name: 'video_01.mp4',
          camera_id: [0],
          task_epochs: [1],
        },
      ],
      // Dependencies for selectors
      tasks: [
        { task_name: 'task1', task_epochs: [1] },
        { task_name: 'task2', task_epochs: [2] },
        { task_name: 'task3', task_epochs: [3] },
      ],
      cameras: [
        { id: 0, name: 'camera0' },
        { id: 1, name: 'camera1' },
        { id: 2, name: 'camera2' },
      ],
    };
  });

  describe('Rendering', () => {
    it('should render both Associated Files and Associated Video Files sections', () => {
      renderWithProviders(<AssociatedFilesFields />, { initialState });

      expect(screen.getByText('Associated Files')).toBeInTheDocument();
      expect(screen.getByText('Associated Video Files')).toBeInTheDocument();
    });

    it('should render associated_files fields correctly', () => {
      renderWithProviders(<AssociatedFilesFields />, { initialState });

      expect(screen.getByPlaceholderText('File name')).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText('Description of the file')
      ).toBeInTheDocument();
      expect(screen.getByPlaceholderText('path')).toBeInTheDocument();
    });

    it('should render associated_video_files fields correctly', () => {
      renderWithProviders(<AssociatedFilesFields />, { initialState });

      expect(screen.getByPlaceholderText('name')).toBeInTheDocument();
    });
  });

  describe('Field Values', () => {
    it('should display associated_files values correctly', () => {
      renderWithProviders(<AssociatedFilesFields />, { initialState });

      const nameInput = screen.getByPlaceholderText('File name');
      const descInput = screen.getByPlaceholderText(
        'Description of the file'
      );
      const pathInput = screen.getByPlaceholderText('path');

      expect(nameInput).toHaveValue('analysis_script.py');
      expect(descInput).toHaveValue('Python script for data analysis');
      expect(pathInput).toHaveValue('/path/to/analysis_script.py');
    });

    it('should display associated_video_files values correctly', () => {
      renderWithProviders(<AssociatedFilesFields />, { initialState });

      const nameInput = screen.getByPlaceholderText('name');
      expect(nameInput).toHaveValue('video_01.mp4');
    });
  });

  describe('CRUD Operations - Associated Files', () => {
    it('has add button for associated_files', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AssociatedFilesFields />, { initialState });

      const addButton = screen.getByTitle('Add associated_files');
      expect(addButton).toBeInTheDocument();

      // Verify button can be clicked
      await user.click(addButton);
    });

    it('has remove button for associated_files', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AssociatedFilesFields />, { initialState });

      // Find the remove button (first one in associated_files section)
      const removeButtons = screen.getAllByText('Remove');
      expect(removeButtons[0]).toBeInTheDocument();

      // Verify button can be clicked
      await user.click(removeButtons[0]);
    });

    it('has duplicate button for associated_files', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AssociatedFilesFields />, { initialState });

      const duplicateButtons = screen.getAllByText('Duplicate');
      expect(duplicateButtons[0]).toBeInTheDocument();

      // Verify button can be clicked
      await user.click(duplicateButtons[0]);
    });
  });

  describe('CRUD Operations - Associated Video Files', () => {
    it('has add button for associated_video_files', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AssociatedFilesFields />, { initialState });

      const addButton = screen.getByTitle('Add associated_video_files');
      expect(addButton).toBeInTheDocument();

      // Verify button can be clicked
      await user.click(addButton);
    });

    it('has remove button for associated_video_files', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AssociatedFilesFields />, { initialState });

      // Find the remove button (second one, for video files)
      const removeButtons = screen.getAllByText('Remove');
      expect(removeButtons[1]).toBeInTheDocument();

      // Verify button can be clicked
      await user.click(removeButtons[1]);
    });
  });

  describe('Dependencies', () => {
    it('should render task epochs from selector', () => {
      renderWithProviders(<AssociatedFilesFields />, { initialState });

      // RadioList with taskEpochsDefined should be rendered (check for multiple labels)
      const taskEpochLabels = screen.getAllByText('Task Epochs');
      expect(taskEpochLabels.length).toBeGreaterThanOrEqual(1);
    });

    it('should render camera ids from selector', () => {
      renderWithProviders(<AssociatedFilesFields />, { initialState });

      expect(screen.getByText('Camera Id')).toBeInTheDocument();
    });

    it('should render task epochs for both sections', () => {
      renderWithProviders(<AssociatedFilesFields />, { initialState });

      // Check for both labels since there are two "Task Epochs" in the component
      const taskEpochLabels = screen.getAllByText('Task Epochs');
      expect(taskEpochLabels.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Multiple Items', () => {
    it('should render multiple associated_files items', () => {
      const state = {
        ...initialState,
        associated_files: [
          {
            name: 'script1.py',
            description: 'First script',
            path: '/path1',
            task_epochs: [1],
          },
          {
            name: 'script2.py',
            description: 'Second script',
            path: '/path2',
            task_epochs: [2],
          },
        ],
      };

      renderWithProviders(<AssociatedFilesFields />, { initialState: state });

      expect(screen.getByDisplayValue('script1.py')).toBeInTheDocument();
      expect(screen.getByDisplayValue('script2.py')).toBeInTheDocument();
    });

    it('should render multiple associated_video_files items', () => {
      const state = {
        ...initialState,
        associated_video_files: [
          { name: 'video1.mp4', camera_id: [0], task_epochs: [1] },
          { name: 'video2.mp4', camera_id: [1], task_epochs: [2] },
        ],
      };

      renderWithProviders(<AssociatedFilesFields />, { initialState: state });

      expect(screen.getByDisplayValue('video1.mp4')).toBeInTheDocument();
      expect(screen.getByDisplayValue('video2.mp4')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should render with empty associated_files array', () => {
      const state = {
        ...initialState,
        associated_files: [],
        associated_video_files: [],
      };

      renderWithProviders(<AssociatedFilesFields />, { initialState: state });

      expect(screen.getByText('Associated Files')).toBeInTheDocument();
      expect(screen.getByText('Associated Video Files')).toBeInTheDocument();
    });

    it('should render with empty dependency arrays', () => {
      const state = {
        ...initialState,
        tasks: [],
        cameras: [],
      };

      renderWithProviders(<AssociatedFilesFields />, { initialState: state });

      expect(screen.getByText('Associated Files')).toBeInTheDocument();
    });
  });
});
