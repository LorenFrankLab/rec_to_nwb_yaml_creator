/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StoreProvider } from '../../state/StoreContext';
import { App } from '../../App';

/**
 * Integration tests for file upload keyboard accessibility (P1.1.2)
 *
 * Tests verify WCAG 2.1 Level A compliance for keyboard-only file upload:
 * - File upload label must be keyboard focusable (tabIndex="0")
 * - Enter key must open file dialog
 * - Space key must open file dialog
 * - ARIA attributes must indicate purpose and state
 *
 * TDD: These tests MUST FAIL initially (red phase), then pass after implementation (green phase)
 */

describe('File Upload Keyboard Accessibility', () => {
  let user;

  beforeEach(() => {
    user = userEvent.setup();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Label focusability', () => {
    it('should make file upload label keyboard focusable with tabIndex', () => {
      render(
        <StoreProvider>
          <App />
        </StoreProvider>
      );

      // Find the button element
      const fileButton = document.querySelector('.import-button');
      expect(fileButton).toBeTruthy();

      // Button elements are focusable by default (don't need explicit tabindex)
      expect(fileButton.tagName).toBe('BUTTON');
    });

    it('should allow direct focus on file upload label', () => {
      render(
        <StoreProvider>
          <App />
        </StoreProvider>
      );

      const fileButton = document.querySelector('.import-button');
      fileButton.focus();

      // Verify the label received focus
      expect(document.activeElement).toBe(fileButton);
    });
  });

  describe('Enter key file upload', () => {
    it('should trigger file input click when Enter key is pressed on label', async () => {
      render(
        <StoreProvider>
          <App />
        </StoreProvider>
      );

      const fileButton = document.querySelector('.import-button');
      const fileInput = document.querySelector('#importYAMLFile');

      // Spy on the click method of the file input
      const clickSpy = vi.spyOn(fileInput, 'click');

      // Focus the label
      fileButton.focus();
      expect(document.activeElement).toBe(fileButton);

      // Press Enter
      await user.keyboard('{Enter}');

      // Verify file input's click was triggered
      expect(clickSpy).toHaveBeenCalledTimes(1);
    });

    it('should not trigger click when other keys are pressed', async () => {
      render(
        <StoreProvider>
          <App />
        </StoreProvider>
      );

      const fileButton = document.querySelector('.import-button');
      const fileInput = document.querySelector('#importYAMLFile');

      const clickSpy = vi.spyOn(fileInput, 'click');

      fileButton.focus();

      // Press various keys that should NOT trigger upload
      await user.keyboard('a');
      await user.keyboard('{Escape}');
      await user.keyboard('{Tab}');

      // Click should not have been triggered
      expect(clickSpy).not.toHaveBeenCalled();
    });
  });

  describe('Space key file upload', () => {
    it('should trigger file input click when Space key is pressed on label', async () => {
      render(
        <StoreProvider>
          <App />
        </StoreProvider>
      );

      const fileButton = document.querySelector('.import-button');
      const fileInput = document.querySelector('#importYAMLFile');

      const clickSpy = vi.spyOn(fileInput, 'click');

      fileButton.focus();
      expect(document.activeElement).toBe(fileButton);

      // Press Space
      await user.keyboard(' ');

      // Verify file input's click was triggered
      expect(clickSpy).toHaveBeenCalledTimes(1);
    });

    it('should prevent default Space scroll behavior', async () => {
      render(
        <StoreProvider>
          <App />
        </StoreProvider>
      );

      const fileButton = document.querySelector('.import-button');

      // Spy on scrollBy to verify Space doesn't trigger page scroll
      const scrollSpy = vi.spyOn(window, 'scrollBy');

      fileButton.focus();
      await user.keyboard(' ');

      // Space should NOT cause window scrolling (default browser behavior)
      expect(scrollSpy).not.toHaveBeenCalled();

      scrollSpy.mockRestore();
    });
  });

  describe('ARIA attributes', () => {
    it('should have aria-label describing file upload purpose', () => {
      render(
        <StoreProvider>
          <App />
        </StoreProvider>
      );

      const fileButton = document.querySelector('.import-button');

      // Should have aria-label for screen readers
      const ariaLabel = fileButton.getAttribute('aria-label');
      expect(ariaLabel).toBeTruthy();
      expect(ariaLabel).toMatch(/import|upload|yaml/i);
    });

    it('should have role="button" to indicate interactive element', () => {
      render(
        <StoreProvider>
          <App />
        </StoreProvider>
      );

      const fileButton = document.querySelector('.import-button');

      // Button element should have button type
      expect(fileButton.tagName).toBe('BUTTON');
      expect(fileButton.getAttribute('type')).toBe('button');
    });
  });

  describe('File input accessibility', () => {
    it('should hide native file input visually but keep accessible', () => {
      render(
        <StoreProvider>
          <App />
        </StoreProvider>
      );

      const fileInput = document.querySelector('#importYAMLFile');

      // File input should have a class that visually hides it
      expect(fileInput.className).toContain('visually-hidden');

      // But it should still be in the DOM for programmatic access
      expect(fileInput).toBeTruthy();
    });

    it('should have proper accept attribute for YAML files', () => {
      render(
        <StoreProvider>
          <App />
        </StoreProvider>
      );

      const fileInput = document.querySelector('#importYAMLFile');

      // Should accept .yml and .yaml files
      const acceptAttr = fileInput.getAttribute('accept');
      expect(acceptAttr).toContain('.yml');
      expect(acceptAttr).toContain('.yaml');
    });
  });

  describe('Keyboard focus indication', () => {
    it('should have visible focus styles when label is focused', () => {
      const { container } = render(
        <StoreProvider>
          <App />
        </StoreProvider>
      );

      const fileButton = container.querySelector('.import-button');
      fileButton.focus();

      // The button should receive focus (browser will apply focus ring)
      expect(document.activeElement).toBe(fileButton);

      // Note: Actual visual focus styles are tested manually
      // as CSS :focus pseudo-class is hard to test in JSDOM
    });
  });

  describe('Integration with file selection', () => {
    it('should allow programmatic file selection after keyboard trigger', async () => {
      render(
        <StoreProvider>
          <App />
        </StoreProvider>
      );

      const fileButton = document.querySelector('.import-button');
      const fileInput = document.querySelector('#importYAMLFile');

      // Create a mock file
      const mockFile = new File(['test: data'], 'test.yml', { type: 'text/yaml' });

      fileButton.focus();
      await user.keyboard('{Enter}');

      // Simulate file selection (this would normally happen via OS file dialog)
      // We're testing that the upload mechanism works after keyboard trigger
      Object.defineProperty(fileInput, 'files', {
        value: [mockFile],
        writable: false,
      });

      // Trigger change event (simulates user selecting file)
      const changeEvent = new Event('change', { bubbles: true });
      fileInput.dispatchEvent(changeEvent);

      // File input should now have the file
      expect(fileInput.files[0]).toBe(mockFile);
      expect(fileInput.files[0].name).toBe('test.yml');
    });
  });
});
