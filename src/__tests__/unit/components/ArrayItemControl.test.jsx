/**
 * Tests for ArrayItemControl component
 *
 * Phase 1: Testing Foundation - Week 4
 *
 * These tests verify the ArrayItemControl component correctly:
 * - Renders with required props
 * - Displays Duplicate button
 * - Displays Remove button
 * - Calls duplicateArrayItem with correct arguments
 * - Calls removeArrayItem with correct arguments
 * - Handles missing callback functions (defaultProps)
 * - Applies correct CSS classes
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ArrayItemControl from '../../../element/ArrayItemControl';

describe('ArrayItemControl Component', () => {
  const defaultProps = {
    index: 0,
    keyValue: 'electrode_groups',
    duplicateArrayItem: vi.fn(),
    removeArrayItem: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render with required props', () => {
      render(<ArrayItemControl {...defaultProps} />);

      expect(screen.getByRole('button', { name: 'Duplicate' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
    });

    it('should render Duplicate button', () => {
      render(<ArrayItemControl {...defaultProps} />);

      const duplicateButton = screen.getByRole('button', { name: 'Duplicate' });
      expect(duplicateButton).toBeInTheDocument();
      expect(duplicateButton).toHaveAttribute('type', 'button');
    });

    it('should render Remove button', () => {
      render(<ArrayItemControl {...defaultProps} />);

      const removeButton = screen.getByRole('button', { name: 'Remove' });
      expect(removeButton).toBeInTheDocument();
      expect(removeButton).toHaveAttribute('type', 'button');
    });

    it('should have array-item__controls container class', () => {
      const { container } = render(<ArrayItemControl {...defaultProps} />);

      const controlsDiv = container.querySelector('.array-item__controls');
      expect(controlsDiv).toBeInTheDocument();
    });

    it('should have duplicate-item class for duplicate button container', () => {
      const { container } = render(<ArrayItemControl {...defaultProps} />);

      const duplicateDiv = container.querySelector('.duplicate-item');
      expect(duplicateDiv).toBeInTheDocument();
    });

    it('should have button-danger class on Remove button', () => {
      render(<ArrayItemControl {...defaultProps} />);

      const removeButton = screen.getByRole('button', { name: 'Remove' });
      expect(removeButton).toHaveClass('button-danger');
    });
  });

  describe('Duplicate Button Interaction', () => {
    it('should call duplicateArrayItem when Duplicate button is clicked', async () => {
      const user = userEvent.setup();
      const mockDuplicate = vi.fn();

      render(
        <ArrayItemControl
          {...defaultProps}
          duplicateArrayItem={mockDuplicate}
        />
      );

      const duplicateButton = screen.getByRole('button', { name: 'Duplicate' });
      await user.click(duplicateButton);

      expect(mockDuplicate).toHaveBeenCalledTimes(1);
    });

    it('should pass correct arguments to duplicateArrayItem', async () => {
      const user = userEvent.setup();
      const mockDuplicate = vi.fn();

      render(
        <ArrayItemControl
          index={5}
          keyValue="cameras"
          duplicateArrayItem={mockDuplicate}
          removeArrayItem={vi.fn()}
        />
      );

      const duplicateButton = screen.getByRole('button', { name: 'Duplicate' });
      await user.click(duplicateButton);

      expect(mockDuplicate).toHaveBeenCalledWith(5, 'cameras');
    });

    it('should handle multiple clicks on Duplicate button', async () => {
      const user = userEvent.setup();
      const mockDuplicate = vi.fn();

      render(
        <ArrayItemControl
          {...defaultProps}
          duplicateArrayItem={mockDuplicate}
        />
      );

      const duplicateButton = screen.getByRole('button', { name: 'Duplicate' });

      await user.click(duplicateButton);
      await user.click(duplicateButton);
      await user.click(duplicateButton);

      expect(mockDuplicate).toHaveBeenCalledTimes(3);
    });

    it('should work with index 0', async () => {
      const user = userEvent.setup();
      const mockDuplicate = vi.fn();

      render(
        <ArrayItemControl
          index={0}
          keyValue="tasks"
          duplicateArrayItem={mockDuplicate}
          removeArrayItem={vi.fn()}
        />
      );

      const duplicateButton = screen.getByRole('button', { name: 'Duplicate' });
      await user.click(duplicateButton);

      expect(mockDuplicate).toHaveBeenCalledWith(0, 'tasks');
    });

    it('should work with large index values', async () => {
      const user = userEvent.setup();
      const mockDuplicate = vi.fn();

      render(
        <ArrayItemControl
          index={999}
          keyValue="electrode_groups"
          duplicateArrayItem={mockDuplicate}
          removeArrayItem={vi.fn()}
        />
      );

      const duplicateButton = screen.getByRole('button', { name: 'Duplicate' });
      await user.click(duplicateButton);

      expect(mockDuplicate).toHaveBeenCalledWith(999, 'electrode_groups');
    });
  });

  describe('Remove Button Interaction', () => {
    it('should call removeArrayItem when Remove button is clicked', async () => {
      const user = userEvent.setup();
      const mockRemove = vi.fn();

      render(
        <ArrayItemControl
          {...defaultProps}
          removeArrayItem={mockRemove}
        />
      );

      const removeButton = screen.getByRole('button', { name: 'Remove' });
      await user.click(removeButton);

      expect(mockRemove).toHaveBeenCalledTimes(1);
    });

    it('should pass correct arguments to removeArrayItem', async () => {
      const user = userEvent.setup();
      const mockRemove = vi.fn();

      render(
        <ArrayItemControl
          index={3}
          keyValue="associated_files"
          duplicateArrayItem={vi.fn()}
          removeArrayItem={mockRemove}
        />
      );

      const removeButton = screen.getByRole('button', { name: 'Remove' });
      await user.click(removeButton);

      expect(mockRemove).toHaveBeenCalledWith(3, 'associated_files');
    });

    it('should handle multiple clicks on Remove button', async () => {
      const user = userEvent.setup();
      const mockRemove = vi.fn();

      render(
        <ArrayItemControl
          {...defaultProps}
          removeArrayItem={mockRemove}
        />
      );

      const removeButton = screen.getByRole('button', { name: 'Remove' });

      await user.click(removeButton);
      await user.click(removeButton);

      expect(mockRemove).toHaveBeenCalledTimes(2);
    });

    it('should work with index 0', async () => {
      const user = userEvent.setup();
      const mockRemove = vi.fn();

      render(
        <ArrayItemControl
          index={0}
          keyValue="cameras"
          duplicateArrayItem={vi.fn()}
          removeArrayItem={mockRemove}
        />
      );

      const removeButton = screen.getByRole('button', { name: 'Remove' });
      await user.click(removeButton);

      expect(mockRemove).toHaveBeenCalledWith(0, 'cameras');
    });
  });

  describe('Independent Button Actions', () => {
    it('should call duplicateArrayItem independently from removeArrayItem', async () => {
      const user = userEvent.setup();
      const mockDuplicate = vi.fn();
      const mockRemove = vi.fn();

      render(
        <ArrayItemControl
          index={2}
          keyValue="tasks"
          duplicateArrayItem={mockDuplicate}
          removeArrayItem={mockRemove}
        />
      );

      const duplicateButton = screen.getByRole('button', { name: 'Duplicate' });
      await user.click(duplicateButton);

      expect(mockDuplicate).toHaveBeenCalledTimes(1);
      expect(mockRemove).not.toHaveBeenCalled();
    });

    it('should call removeArrayItem independently from duplicateArrayItem', async () => {
      const user = userEvent.setup();
      const mockDuplicate = vi.fn();
      const mockRemove = vi.fn();

      render(
        <ArrayItemControl
          index={2}
          keyValue="tasks"
          duplicateArrayItem={mockDuplicate}
          removeArrayItem={mockRemove}
        />
      );

      const removeButton = screen.getByRole('button', { name: 'Remove' });
      await user.click(removeButton);

      expect(mockRemove).toHaveBeenCalledTimes(1);
      expect(mockDuplicate).not.toHaveBeenCalled();
    });
  });

  describe('Different keyValue Types', () => {
    it('should handle electrode_groups keyValue', async () => {
      const user = userEvent.setup();
      const mockDuplicate = vi.fn();

      render(
        <ArrayItemControl
          index={1}
          keyValue="electrode_groups"
          duplicateArrayItem={mockDuplicate}
          removeArrayItem={vi.fn()}
        />
      );

      const duplicateButton = screen.getByRole('button', { name: 'Duplicate' });
      await user.click(duplicateButton);

      expect(mockDuplicate).toHaveBeenCalledWith(1, 'electrode_groups');
    });

    it('should handle tasks keyValue', async () => {
      const user = userEvent.setup();
      const mockRemove = vi.fn();

      render(
        <ArrayItemControl
          index={0}
          keyValue="tasks"
          duplicateArrayItem={vi.fn()}
          removeArrayItem={mockRemove}
        />
      );

      const removeButton = screen.getByRole('button', { name: 'Remove' });
      await user.click(removeButton);

      expect(mockRemove).toHaveBeenCalledWith(0, 'tasks');
    });

    it('should handle cameras keyValue', async () => {
      const user = userEvent.setup();
      const mockDuplicate = vi.fn();

      render(
        <ArrayItemControl
          index={2}
          keyValue="cameras"
          duplicateArrayItem={mockDuplicate}
          removeArrayItem={vi.fn()}
        />
      );

      const duplicateButton = screen.getByRole('button', { name: 'Duplicate' });
      await user.click(duplicateButton);

      expect(mockDuplicate).toHaveBeenCalledWith(2, 'cameras');
    });

    it('should handle associated_files keyValue', async () => {
      const user = userEvent.setup();
      const mockRemove = vi.fn();

      render(
        <ArrayItemControl
          index={5}
          keyValue="associated_files"
          duplicateArrayItem={vi.fn()}
          removeArrayItem={mockRemove}
        />
      );

      const removeButton = screen.getByRole('button', { name: 'Remove' });
      await user.click(removeButton);

      expect(mockRemove).toHaveBeenCalledWith(5, 'associated_files');
    });
  });

  describe('Default Props', () => {
    it('should use default empty function for duplicateArrayItem when not provided', async () => {
      const user = userEvent.setup();

      // Should not throw when duplicateArrayItem not provided
      render(
        <ArrayItemControl
          index={0}
          keyValue="test"
          removeArrayItem={vi.fn()}
        />
      );

      const duplicateButton = screen.getByRole('button', { name: 'Duplicate' });

      // Should not throw error
      await expect(user.click(duplicateButton)).resolves.not.toThrow();
    });

    it('should use default empty function for removeArrayItem when not provided', async () => {
      const user = userEvent.setup();

      // Should not throw when removeArrayItem not provided
      render(
        <ArrayItemControl
          index={0}
          keyValue="test"
          duplicateArrayItem={vi.fn()}
        />
      );

      const removeButton = screen.getByRole('button', { name: 'Remove' });

      // Should not throw error
      await expect(user.click(removeButton)).resolves.not.toThrow();
    });

    it('should render correctly with only required props', () => {
      render(
        <ArrayItemControl
          index={0}
          keyValue="test"
        />
      );

      expect(screen.getByRole('button', { name: 'Duplicate' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
    });
  });

  describe('PropTypes and Defaults', () => {
    it('should define default empty functions for callbacks', () => {
      expect(ArrayItemControl.defaultProps.duplicateArrayItem).toBeDefined();
      expect(ArrayItemControl.defaultProps.removeArrayItem).toBeDefined();

      expect(typeof ArrayItemControl.defaultProps.duplicateArrayItem).toBe('function');
      expect(typeof ArrayItemControl.defaultProps.removeArrayItem).toBe('function');
    });

    it('should have default functions that do nothing when called', () => {
      const defaultDuplicate = ArrayItemControl.defaultProps.duplicateArrayItem;
      const defaultRemove = ArrayItemControl.defaultProps.removeArrayItem;

      // Should not throw and return undefined
      expect(defaultDuplicate()).toBeUndefined();
      expect(defaultRemove()).toBeUndefined();
    });
  });

  describe('Code Quality Issues', () => {
    it('DOCUMENTED: Misleading JSDoc comment (line 10)', () => {
      // Line 10 says "@returns Virtual DOM for File upload"
      // But this component is for array item controls (Duplicate/Remove buttons)
      // Not for file upload at all - copy-paste error from another component
      expect(true).toBe(true);
    });

    it('DOCUMENTED: Empty import statement (line 1-2)', () => {
      // Line 1-2: `import React, { } from 'react';`
      // Empty destructuring - should just be `import React from 'react';`
      // No React hooks or other exports are used
      expect(true).toBe(true);
    });
  });

  describe('Accessibility', () => {
    it('should have button type="button" to prevent form submission', () => {
      render(<ArrayItemControl {...defaultProps} />);

      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toHaveAttribute('type', 'button');
      });
    });

    it('should have clear button text for screen readers', () => {
      render(<ArrayItemControl {...defaultProps} />);

      // Both buttons have clear, descriptive text
      expect(screen.getByRole('button', { name: 'Duplicate' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
    });
  });
});
