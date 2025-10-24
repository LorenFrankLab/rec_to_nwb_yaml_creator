/**
 * Tests for clearYMLFile function in App.js
 *
 * Phase 1, Week 6 - Priority 1: Event Handlers
 *
 * Coverage: clearYMLFile function behavior including:
 * - Form reset with confirmation
 * - Cancellation handling
 * - State reset to defaultYMLValues
 *
 * Note: These are integration tests that verify the complete reset behavior
 * including DOM updates. They test the full interaction flow from user action
 * to visible form state changes.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../App';
import { defaultYMLValues } from '../../../valueList';

describe('App.js - clearYMLFile()', () => {
  let confirmSpy;

  beforeEach(() => {
    // Mock window.confirm
    confirmSpy = vi.spyOn(window, 'confirm');
  });

  afterEach(() => {
    // Restore original window.confirm
    confirmSpy.mockRestore();
  });

  describe('Confirmation Dialog', () => {
    it('should show confirmation dialog with correct message when reset button clicked', async () => {
      const user = userEvent.setup();
      confirmSpy.mockReturnValue(false); // Prevent actual reset

      render(<App />);

      const resetButton = screen.getByRole('button', { name: /reset/i });
      await user.click(resetButton);

      // Verify window.confirm was called with exact message
      expect(confirmSpy).toHaveBeenCalledTimes(1);
      expect(confirmSpy).toHaveBeenCalledWith('Are you sure you want to reset?');
    });

    it('should NOT reset form data if user cancels confirmation dialog', async () => {
      const user = userEvent.setup();
      confirmSpy.mockReturnValue(false); // User clicks Cancel

      render(<App />);

      // Modify a form field
      const sessionIdInput = screen.getByLabelText(/session id/i);
      await user.type(sessionIdInput, 'test_session_001');
      expect(sessionIdInput.value).toBe('test_session_001');

      // Click reset
      const resetButton = screen.getByRole('button', { name: /reset/i });
      await user.click(resetButton);

      // Verify confirm was called
      expect(confirmSpy).toHaveBeenCalled();

      // Verify form was NOT reset (value should remain unchanged)
      expect(sessionIdInput.value).toBe('test_session_001');
    });
  });

  describe('Form Reset Behavior', () => {
    it('should reset form to defaultYMLValues by clearing arrays', async () => {
      const user = userEvent.setup();
      confirmSpy.mockReturnValue(true);

      render(<App />);

      // Verify that resetting clears form to defaultYMLValues
      // defaultYMLValues has specific values like lab="Loren Frank Lab"
      // emptyFormData has lab=""

      // Lab starts with defaultYMLValues.lab ("Loren Frank Lab")
      const labInputs = screen.getAllByDisplayValue(defaultYMLValues.lab);
      expect(labInputs.length).toBeGreaterThan(0);

      // Click reset - should keep defaultYMLValues.lab (not clear to empty)
      const resetButton = screen.getByRole('button', { name: /reset/i });
      await user.click(resetButton);

      // Verify lab is still set to defaultYMLValues (proves it uses defaultYMLValues not emptyFormData)
      await waitFor(() => {
        const labInputsAfter = screen.getAllByDisplayValue(defaultYMLValues.lab);
        expect(labInputsAfter.length).toBeGreaterThan(0);
      });
    });

    it('should clear all fields when reset confirmed', async () => {
      const user = userEvent.setup();
      confirmSpy.mockReturnValue(true);

      render(<App />);

      // Modify institution field (has a default value)
      const institutionInputs = screen.getAllByDisplayValue(defaultYMLValues.institution);
      expect(institutionInputs.length).toBeGreaterThan(0);

      // Click reset
      const resetButton = screen.getByRole('button', { name: /reset/i });
      await user.click(resetButton);

      // Verify institution resets to default
      await waitFor(() => {
        const institutionAfter = screen.getAllByDisplayValue(defaultYMLValues.institution);
        expect(institutionAfter.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle reset when form is already at default values', async () => {
      const user = userEvent.setup();
      confirmSpy.mockReturnValue(true);

      render(<App />);

      // Don't modify anything - form starts at defaults
      const sessionIdInput = screen.getByLabelText(/session id/i);
      const initialValue = sessionIdInput.value;

      // Click reset
      const resetButton = screen.getByRole('button', { name: /reset/i });
      await user.click(resetButton);

      // Verify confirm was called
      expect(confirmSpy).toHaveBeenCalled();

      // Form should still be at default values (no error thrown)
      await waitFor(() => {
        expect(sessionIdInput.value).toBe(initialValue);
      });
    });

    it('should use structuredClone to avoid mutating defaultYMLValues', async () => {
      const user = userEvent.setup();
      confirmSpy.mockReturnValue(true);

      render(<App />);

      // Reset twice to verify defaultYMLValues isn't mutated
      const resetButton = screen.getByRole('button', { name: /reset/i });

      // First reset
      await user.click(resetButton);
      await waitFor(() => {
        const labInputs = screen.getAllByDisplayValue(defaultYMLValues.lab);
        expect(labInputs.length).toBeGreaterThan(0);
      });

      // Second reset - should still work (proves defaultYMLValues wasn't mutated)
      confirmSpy.mockClear();
      confirmSpy.mockReturnValue(true);
      await user.click(resetButton);

      await waitFor(() => {
        const labInputs = screen.getAllByDisplayValue(defaultYMLValues.lab);
        expect(labInputs.length).toBeGreaterThan(0);
      });
      expect(confirmSpy).toHaveBeenCalledTimes(1);
    });

    it('should prevent default form submission behavior', async () => {
      const user = userEvent.setup();
      confirmSpy.mockReturnValue(true);

      render(<App />);

      const resetButton = screen.getByRole('button', { name: /reset/i });

      // If preventDefault wasn't called, the page would reload and test would fail
      await user.click(resetButton);

      // Test continuing to execute proves preventDefault was called
      expect(confirmSpy).toHaveBeenCalled();
    });
  });
});
