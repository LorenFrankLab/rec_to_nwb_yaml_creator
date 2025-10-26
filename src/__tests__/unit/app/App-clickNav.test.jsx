/**
 * Tests for clickNav function in App.js
 *
 * Phase 1, Week 6 - Priority 1: Event Handlers
 *
 * Coverage: clickNav function behavior including:
 * - Adding/removing active-nav-link class
 * - Adding/removing highlight-region class
 * - Timeout behavior for class removal
 * - Handling missing elements
 * - Multiple click interactions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../App';
import { getById } from '../../helpers/test-selectors';

describe('App.js - clickNav()', () => {
  describe('Navigation Click Behavior', () => {
    it('should add highlight-region class to target element when nav link clicked', async () => {
      const user = userEvent.setup();

      render(<App />);

      // Find a navigation link
      const subjectNavLink = screen.getByRole('link', { name: /^subject$/i });

      // Click the nav link
      await user.click(subjectNavLink);

      // Find the target element by its ID (data-id="subject-area")
      const subjectSection = getById('subject-area');
      expect(subjectSection).toBeTruthy();

      // Verify highlight-region class was added
      expect(subjectSection.classList.contains('highlight-region')).toBe(true);
    });

    it('should add active-nav-link class to parent node when clicked', async () => {
      const user = userEvent.setup();

      render(<App />);

      // Find a navigation link
      const subjectNavLink = screen.getByRole('link', { name: /^subject$/i });

      // Click the nav link
      await user.click(subjectNavLink);

      // Verify parent node has active-nav-link class
      const parentNode = subjectNavLink.parentNode;
      expect(parentNode.classList.contains('active-nav-link')).toBe(true);
    });

    it('should remove previous active-nav-link classes before adding new one', async () => {
      const user = userEvent.setup();

      render(<App />);

      // Click first nav link
      const subjectNavLink = screen.getByRole('link', { name: /^subject$/i });
      await user.click(subjectNavLink);

      const subjectParent = subjectNavLink.parentNode;
      expect(subjectParent.classList.contains('active-nav-link')).toBe(true);

      // Click second nav link
      const camerasNavLink = screen.getByRole('link', { name: /^cameras$/i });
      await user.click(camerasNavLink);

      const camerasParent = camerasNavLink.parentNode;

      // First link's parent should no longer have active-nav-link
      expect(subjectParent.classList.contains('active-nav-link')).toBe(false);
      // Second link's parent should now have active-nav-link
      expect(camerasParent.classList.contains('active-nav-link')).toBe(true);
    });

    it('should find and target correct element based on data-id attribute', async () => {
      const user = userEvent.setup();

      render(<App />);

      // Click nav link and verify it targets correct section
      const subjectNavLink = screen.getByRole('link', { name: /^subject$/i });

      // Verify data-id attribute
      expect(subjectNavLink.getAttribute('data-id')).toBe('subject-area');

      await user.click(subjectNavLink);

      // Verify the element with matching ID gets the highlight
      const targetElement = getById('subject-area');
      expect(targetElement).toBeTruthy();
      expect(targetElement.classList.contains('highlight-region')).toBe(true);
    });
  });

  describe('Timeout Behavior', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.restoreAllMocks();
      vi.useRealTimers();
    });

    it('should remove highlight-region and active-nav-link classes after 1000ms timeout', async () => {
      render(<App />);

      // Find and click a nav link
      const subjectNavLink = screen.getByRole('link', { name: /^subject$/i });

      // Use native click to avoid userEvent timer conflicts
      subjectNavLink.click();

      const subjectSection = getById('subject-area');
      const parentNode = subjectNavLink.parentNode;

      // Initially both classes should be present
      expect(subjectSection.classList.contains('highlight-region')).toBe(true);
      expect(parentNode.classList.contains('active-nav-link')).toBe(true);

      // Fast-forward time by 1000ms
      vi.advanceTimersByTime(1000);

      // Both classes should be removed
      expect(subjectSection.classList.contains('highlight-region')).toBe(false);
      expect(parentNode.classList.contains('active-nav-link')).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle clicking same nav item multiple times', async () => {
      const user = userEvent.setup();

      render(<App />);

      const subjectNavLink = screen.getByRole('link', { name: /^subject$/i });

      // Click first time
      await user.click(subjectNavLink);
      const parentNode = subjectNavLink.parentNode;
      expect(parentNode.classList.contains('active-nav-link')).toBe(true);

      // Wait for timeout (real timers)
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Classes should be removed
      expect(parentNode.classList.contains('active-nav-link')).toBe(false);

      // Click again
      await user.click(subjectNavLink);
      expect(parentNode.classList.contains('active-nav-link')).toBe(true);

      // Should work again
      const subjectSection = getById('subject-area');
      expect(subjectSection.classList.contains('highlight-region')).toBe(true);
    });

    it('should handle rapid multiple clicks on different nav items', async () => {
      const user = userEvent.setup();

      render(<App />);

      // Click multiple nav links rapidly
      const subjectNavLink = screen.getByRole('link', { name: /^subject$/i });
      const camerasNavLink = screen.getByRole('link', { name: /^cameras$/i });
      const tasksNavLink = screen.getByRole('link', { name: /^tasks$/i });

      await user.click(subjectNavLink);
      await user.click(camerasNavLink);
      await user.click(tasksNavLink);

      // Only the last clicked item should have active-nav-link
      expect(subjectNavLink.parentNode.classList.contains('active-nav-link')).toBe(false);
      expect(camerasNavLink.parentNode.classList.contains('active-nav-link')).toBe(false);
      expect(tasksNavLink.parentNode.classList.contains('active-nav-link')).toBe(true);

      // Only the last clicked section should have highlight-region
      const tasksSection = getById('tasks-area');
      expect(tasksSection.classList.contains('highlight-region')).toBe(true);
    });

    it('should handle missing target element gracefully', () => {
      render(<App />);

      // Create a mock event with invalid data-id
      const mockLink = document.createElement('a');
      mockLink.className = 'nav-link';
      mockLink.setAttribute('data-id', 'nonexistent-area');
      mockLink.textContent = 'Nonexistent';

      const mockNavItem = document.createElement('li');
      mockNavItem.className = 'nav-item';
      mockNavItem.appendChild(mockLink);

      // Add to DOM
      const navList = document.querySelector('.nav-item');
      if (navList && navList.parentElement) {
        navList.parentElement.appendChild(mockNavItem);
      }

      // Click the mock link (should not throw error)
      mockLink.click();

      // Function should handle gracefully - no active-nav-link added since element doesn't exist
      expect(mockNavItem.classList.contains('active-nav-link')).toBe(false);
    });
  });
});
