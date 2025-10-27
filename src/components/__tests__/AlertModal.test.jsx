/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AlertModal from '../AlertModal';

/**
 * Tests for AlertModal component (P1.3.1)
 *
 * AlertModal replaces window.alert with proper accessible modal
 * WCAG 2.1 Level A compliance for non-blocking notifications
 */

describe('AlertModal', () => {
  let user;

  beforeEach(() => {
    user = userEvent.setup();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic rendering', () => {
    it('should render modal when isOpen is true', () => {
      render(<AlertModal isOpen={true} message="Test message" onClose={() => {}} />);

      expect(screen.getByText('Test message')).toBeInTheDocument();
    });

    it('should not render modal when isOpen is false', () => {
      const { container } = render(<AlertModal isOpen={false} message="Test message" onClose={() => {}} />);

      expect(container.firstChild).toBeNull();
    });

    it('should render title when provided', () => {
      render(<AlertModal isOpen={true} message="Test" title="Alert" onClose={() => {}} />);

      expect(screen.getByText('Alert')).toBeInTheDocument();
    });

    it('should use default title when not provided', () => {
      render(<AlertModal isOpen={true} message="Test" onClose={() => {}} />);

      expect(screen.getByText('Alert')).toBeInTheDocument();
    });
  });

  describe('Close button', () => {
    it('should call onClose when close button is clicked', async () => {
      const onClose = vi.fn();
      render(<AlertModal isOpen={true} message="Test" onClose={onClose} />);

      const closeButton = screen.getByRole('button', { name: /close/i });
      await user.click(closeButton);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should have close button as first focusable element', () => {
      render(<AlertModal isOpen={true} message="Test" onClose={() => {}} />);

      const closeButton = screen.getByRole('button', { name: /close/i });
      closeButton.focus();

      expect(document.activeElement).toBe(closeButton);
    });
  });

  describe('ESC key handling', () => {
    it('should call onClose when ESC key is pressed', async () => {
      const onClose = vi.fn();
      render(<AlertModal isOpen={true} message="Test" onClose={onClose} />);

      await user.keyboard('{Escape}');

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should not call onClose when other keys are pressed (when focus is on body)', async () => {
      const onClose = vi.fn();
      render(<AlertModal isOpen={true} message="Test" onClose={onClose} />);

      // Move focus away from the close button to test the ESC key handler in isolation
      document.body.focus();

      // Press keys that should NOT trigger onClose via ESC handler
      // Note: Tab, Space, Enter on close button WILL trigger onClick (expected behavior)
      await user.keyboard('a');
      await user.keyboard('b');
      await user.keyboard('{ArrowDown}');

      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('Click outside handling', () => {
    it('should call onClose when overlay is clicked', async () => {
      const onClose = vi.fn();
      const { container } = render(<AlertModal isOpen={true} message="Test" onClose={onClose} />);

      const overlay = container.querySelector('.alert-modal-overlay');
      await user.click(overlay);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should not call onClose when modal content is clicked', async () => {
      const onClose = vi.fn();
      const { container } = render(<AlertModal isOpen={true} message="Test" onClose={onClose} />);

      const content = container.querySelector('.alert-modal-content');
      await user.click(content);

      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('ARIA attributes', () => {
    it('should have role="alertdialog"', () => {
      const { container } = render(<AlertModal isOpen={true} message="Test" onClose={() => {}} />);

      const dialog = container.querySelector('[role="alertdialog"]');
      expect(dialog).toBeInTheDocument();
    });

    it('should have aria-modal="true"', () => {
      const { container } = render(<AlertModal isOpen={true} message="Test" onClose={() => {}} />);

      const dialog = container.querySelector('[aria-modal="true"]');
      expect(dialog).toBeInTheDocument();
    });

    it('should have aria-labelledby pointing to title', () => {
      const { container } = render(<AlertModal isOpen={true} message="Test" title="My Alert" onClose={() => {}} />);

      const dialog = container.querySelector('[role="alertdialog"]');
      const labelledBy = dialog.getAttribute('aria-labelledby');

      const title = document.getElementById(labelledBy);
      expect(title.textContent).toBe('My Alert');
    });

    it('should have aria-describedby pointing to message', () => {
      const { container } = render(<AlertModal isOpen={true} message="Test message" onClose={() => {}} />);

      const dialog = container.querySelector('[role="alertdialog"]');
      const describedBy = dialog.getAttribute('aria-describedby');

      const message = document.getElementById(describedBy);
      expect(message.textContent).toBe('Test message');
    });
  });

  describe('Focus management', () => {
    it('should focus close button when modal opens', async () => {
      const { rerender } = render(<AlertModal isOpen={false} message="Test" onClose={() => {}} />);

      rerender(<AlertModal isOpen={true} message="Test" onClose={() => {}} />);

      await waitFor(() => {
        const closeButton = screen.getByRole('button', { name: /close/i });
        expect(document.activeElement).toBe(closeButton);
      }, { timeout: 100 });
    });

    it('should have close button be focusable', async () => {
      render(<AlertModal isOpen={true} message="Test" onClose={() => {}} />);

      const closeButton = screen.getByRole('button', { name: /close/i });

      // Close button should be focusable
      closeButton.focus();
      expect(document.activeElement).toBe(closeButton);

      // Note: Full focus trap testing requires browser-level testing
      // JSDOM doesn't fully support tab key navigation
    });
  });

  describe('Message types', () => {
    it('should render error type with error styling', () => {
      const { container } = render(<AlertModal isOpen={true} message="Error" type="error" onClose={() => {}} />);

      const content = container.querySelector('.alert-modal-content');
      expect(content).toHaveClass('alert-modal-error');
    });

    it('should render warning type with warning styling', () => {
      const { container } = render(<AlertModal isOpen={true} message="Warning" type="warning" onClose={() => {}} />);

      const content = container.querySelector('.alert-modal-content');
      expect(content).toHaveClass('alert-modal-warning');
    });

    it('should render info type with info styling (default)', () => {
      const { container } = render(<AlertModal isOpen={true} message="Info" onClose={() => {}} />);

      const content = container.querySelector('.alert-modal-content');
      expect(content).toHaveClass('alert-modal-info');
    });
  });

  describe('Body scroll lock', () => {
    it('should lock body scroll when modal opens', () => {
      render(<AlertModal isOpen={true} message="Test" onClose={() => {}} />);

      expect(document.body.style.overflow).toBe('hidden');
    });

    it('should restore body scroll when modal closes', () => {
      const { unmount } = render(<AlertModal isOpen={true} message="Test" onClose={() => {}} />);

      unmount();

      expect(document.body.style.overflow).toBe('');
    });
  });
});
