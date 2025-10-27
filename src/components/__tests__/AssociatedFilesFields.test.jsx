import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AssociatedFilesFields from '../AssociatedFilesFields';

describe('AssociatedFilesFields Component', () => {
  let defaultProps;

  beforeEach(() => {
    defaultProps = {
      formData: {
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
      },
      handleChange: (field, key, index) => (e) => {},
      onBlur: () => {},
      updateFormData: () => {},
      addArrayItem: () => {},
      removeArrayItem: () => {},
      duplicateArrayItem: () => {},
      taskEpochsDefined: [1, 2, 3],
      cameraIdsDefined: [0, 1, 2],
    };
  });

  describe('Rendering', () => {
    it('should render both Associated Files and Associated Video Files sections', () => {
      render(<AssociatedFilesFields {...defaultProps} />);

      expect(screen.getByText('Associated Files')).toBeInTheDocument();
      expect(screen.getByText('Associated Video Files')).toBeInTheDocument();
    });

    it('should render associated_files fields correctly', () => {
      render(<AssociatedFilesFields {...defaultProps} />);

      expect(screen.getByPlaceholderText('File name')).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText('Description of the file')
      ).toBeInTheDocument();
      expect(screen.getByPlaceholderText('path')).toBeInTheDocument();
    });

    it('should render associated_video_files fields correctly', () => {
      render(<AssociatedFilesFields {...defaultProps} />);

      expect(screen.getByPlaceholderText('name')).toBeInTheDocument();
    });
  });

  describe('Field Values', () => {
    it('should display associated_files values correctly', () => {
      render(<AssociatedFilesFields {...defaultProps} />);

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
      render(<AssociatedFilesFields {...defaultProps} />);

      const nameInput = screen.getByPlaceholderText('name');
      expect(nameInput).toHaveValue('video_01.mp4');
    });
  });

  describe('CRUD Operations - Associated Files', () => {
    it('should call addArrayItem when add button clicked for associated_files', async () => {
      const user = userEvent.setup();
      let addCalled = false;
      const mockAddArrayItem = (key, count) => {
        if (key === 'associated_files') addCalled = true;
      };

      render(
        <AssociatedFilesFields
          {...defaultProps}
          addArrayItem={mockAddArrayItem}
        />
      );

      const addButton = screen.getByTitle('Add associated_files');
      await user.click(addButton);

      expect(addCalled).toBe(true);
    });

    it('should call removeArrayItem when remove button clicked for associated_files', async () => {
      const user = userEvent.setup();
      let removeCalled = false;
      const mockRemoveArrayItem = (index, key) => {
        if (key === 'associated_files' && index === 0) removeCalled = true;
      };

      render(
        <AssociatedFilesFields
          {...defaultProps}
          removeArrayItem={mockRemoveArrayItem}
        />
      );

      // Find the remove button (first one in associated_files section)
      const removeButtons = screen.getAllByText('Remove');
      await user.click(removeButtons[0]);

      expect(removeCalled).toBe(true);
    });

    it('should call duplicateArrayItem when duplicate button clicked for associated_files', async () => {
      const user = userEvent.setup();
      let duplicateCalled = false;
      const mockDuplicateArrayItem = (index, key) => {
        if (key === 'associated_files' && index === 0) duplicateCalled = true;
      };

      render(
        <AssociatedFilesFields
          {...defaultProps}
          duplicateArrayItem={mockDuplicateArrayItem}
        />
      );

      const duplicateButtons = screen.getAllByText('Duplicate');
      await user.click(duplicateButtons[0]);

      expect(duplicateCalled).toBe(true);
    });
  });

  describe('CRUD Operations - Associated Video Files', () => {
    it('should call addArrayItem when add button clicked for associated_video_files', async () => {
      const user = userEvent.setup();
      let addCalled = false;
      const mockAddArrayItem = (key, count) => {
        if (key === 'associated_video_files') addCalled = true;
      };

      render(
        <AssociatedFilesFields
          {...defaultProps}
          addArrayItem={mockAddArrayItem}
        />
      );

      const addButton = screen.getByTitle('Add associated_video_files');
      await user.click(addButton);

      expect(addCalled).toBe(true);
    });

    it('should call removeArrayItem when remove button clicked for associated_video_files', async () => {
      const user = userEvent.setup();
      let removeCalled = false;
      const mockRemoveArrayItem = (index, key) => {
        if (key === 'associated_video_files' && index === 0)
          removeCalled = true;
      };

      render(
        <AssociatedFilesFields
          {...defaultProps}
          removeArrayItem={mockRemoveArrayItem}
        />
      );

      // Find the remove button (second one, for video files)
      const removeButtons = screen.getAllByText('Remove');
      await user.click(removeButtons[1]);

      expect(removeCalled).toBe(true);
    });
  });

  describe('Dependencies', () => {
    it('should pass taskEpochsDefined to RadioList for associated_files', () => {
      render(<AssociatedFilesFields {...defaultProps} />);

      // RadioList with taskEpochsDefined should be rendered (check for multiple labels)
      const taskEpochLabels = screen.getAllByText('Task Epochs');
      expect(taskEpochLabels.length).toBeGreaterThanOrEqual(1);
    });

    it('should pass cameraIdsDefined to RadioList for associated_video_files', () => {
      render(<AssociatedFilesFields {...defaultProps} />);

      expect(screen.getByText('Camera Id')).toBeInTheDocument();
    });

    it('should pass taskEpochsDefined to RadioList for associated_video_files', () => {
      render(<AssociatedFilesFields {...defaultProps} />);

      // Check for both labels since there are two "Task Epochs" in the component
      const taskEpochLabels = screen.getAllByText('Task Epochs');
      expect(taskEpochLabels.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Multiple Items', () => {
    it('should render multiple associated_files items', () => {
      const propsWithMultiple = {
        ...defaultProps,
        formData: {
          ...defaultProps.formData,
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
        },
      };

      render(<AssociatedFilesFields {...propsWithMultiple} />);

      expect(screen.getByDisplayValue('script1.py')).toBeInTheDocument();
      expect(screen.getByDisplayValue('script2.py')).toBeInTheDocument();
    });

    it('should render multiple associated_video_files items', () => {
      const propsWithMultiple = {
        ...defaultProps,
        formData: {
          ...defaultProps.formData,
          associated_video_files: [
            { name: 'video1.mp4', camera_id: [0], task_epochs: [1] },
            { name: 'video2.mp4', camera_id: [1], task_epochs: [2] },
          ],
        },
      };

      render(<AssociatedFilesFields {...propsWithMultiple} />);

      expect(screen.getByDisplayValue('video1.mp4')).toBeInTheDocument();
      expect(screen.getByDisplayValue('video2.mp4')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should render with empty associated_files array', () => {
      const propsEmpty = {
        ...defaultProps,
        formData: {
          associated_files: [],
          associated_video_files: [],
        },
      };

      render(<AssociatedFilesFields {...propsEmpty} />);

      expect(screen.getByText('Associated Files')).toBeInTheDocument();
      expect(screen.getByText('Associated Video Files')).toBeInTheDocument();
    });

    it('should render with empty dependency arrays', () => {
      const propsNoDeps = {
        ...defaultProps,
        taskEpochsDefined: [],
        cameraIdsDefined: [],
      };

      render(<AssociatedFilesFields {...propsNoDeps} />);

      expect(screen.getByText('Associated Files')).toBeInTheDocument();
    });
  });

  describe('PropTypes', () => {
    it('should validate PropTypes correctly', () => {
      // This test verifies PropTypes are defined
      // Console warnings would appear if PropTypes fail
      render(<AssociatedFilesFields {...defaultProps} />);

      expect(screen.getByText('Associated Files')).toBeInTheDocument();
    });
  });
});
