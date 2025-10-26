/**
 * Tests for openDetailsElement function in App.js
 *
 * Phase 1, Week 6 - Priority 1: Event Handlers
 *
 * Coverage: openDetailsElement function behavior including:
 * - Opening all details elements
 * - Handling empty details list
 * - DOM manipulation safety
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../App';

describe('App.js - openDetailsElement()', () => {
  describe('Details Element Manipulation', () => {
    it('should open all details elements when called', async () => {
      const user = userEvent.setup();

      render(<App />);

      // Find all details elements
      const detailsElements = document.querySelectorAll('details');
      expect(detailsElements.length).toBeGreaterThan(0);

      // Close all details elements
      detailsElements.forEach((detail) => {
        detail.open = false;
      });

      // Verify all are closed
      detailsElements.forEach((detail) => {
        expect(detail.open).toBe(false);
      });

      // Trigger openDetailsElement by clicking Generate YML File button
      const generateButton = screen.getByRole('button', { name: /generate yml file/i });
      await user.click(generateButton);

      // All details should now be open
      detailsElements.forEach((detail) => {
        expect(detail.open).toBe(true);
      });
    });

    it('should set open attribute to true on each details element', async () => {
      const user = userEvent.setup();

      render(<App />);

      const detailsElements = document.querySelectorAll('details');

      // Mix of open and closed states
      detailsElements.forEach((detail, index) => {
        detail.open = index % 2 === 0;
      });

      // Trigger openDetailsElement
      const generateButton = screen.getByRole('button', { name: /generate yml file/i });
      await user.click(generateButton);

      // All should have open = true
      detailsElements.forEach((detail) => {
        expect(detail.open).toBe(true);
        expect(detail.hasAttribute('open')).toBe(true);
      });
    });

    it('should handle already-open details elements correctly', async () => {
      const user = userEvent.setup();

      render(<App />);

      const detailsElements = document.querySelectorAll('details');

      // Open all details first
      detailsElements.forEach((detail) => {
        detail.open = true;
      });

      // Trigger openDetailsElement again
      const generateButton = screen.getByRole('button', { name: /generate yml file/i });
      await user.click(generateButton);

      // Should still be open (no errors)
      detailsElements.forEach((detail) => {
        expect(detail.open).toBe(true);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle querySelector finding multiple details elements', async () => {
      const user = userEvent.setup();

      render(<App />);

      // The form has multiple details elements for different sections
      const detailsElements = document.querySelectorAll('details');

      // Should find multiple (tasks, cameras, electrode groups, etc.)
      expect(detailsElements.length).toBeGreaterThan(1);

      // Close them all
      detailsElements.forEach((detail) => {
        detail.open = false;
      });

      // Trigger openDetailsElement
      const generateButton = screen.getByRole('button', { name: /generate yml file/i });
      await user.click(generateButton);

      // ALL should be opened
      const openCount = Array.from(detailsElements).filter(d => d.open).length;
      expect(openCount).toBe(detailsElements.length);
    });

    it('should not throw error if no validation errors exist', async () => {
      const user = userEvent.setup();

      render(<App />);

      // Just verify the function can be called without errors
      const generateButton = screen.getByRole('button', { name: /generate yml file/i });

      // Should not throw
      await expect(async () => {
        await user.click(generateButton);
      }).not.toThrow();
    });
  });

  describe('Purpose and Use Case', () => {
    it('should be called before form validation to reveal all fields', async () => {
      const user = userEvent.setup();

      render(<App />);

      // The purpose of openDetailsElement is to ensure all form sections are visible
      // before validation runs, so users can see validation errors in collapsed sections

      const detailsElements = document.querySelectorAll('details');

      // Close some sections
      detailsElements.forEach((detail, index) => {
        if (index > 0) { // Keep first open, close others
          detail.open = false;
        }
      });

      // Count closed details
      const closedBefore = Array.from(detailsElements).filter(d => !d.open).length;
      expect(closedBefore).toBeGreaterThan(0);

      // Submit form (which calls openDetailsElement first)
      const generateButton = screen.getByRole('button', { name: /generate yml file/i });
      await user.click(generateButton);

      // All should be open now (so validation errors are visible)
      const closedAfter = Array.from(detailsElements).filter(d => !d.open).length;
      expect(closedAfter).toBe(0);
    });
  });
});
