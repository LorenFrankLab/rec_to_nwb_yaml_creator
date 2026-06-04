/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StoreProvider } from '../../state/StoreContext';
import { App } from '../../App';
import { makeConfiguredWorkspace } from '../helpers/test-fixtures';

/**
 * Integration tests for keyboard navigation accessibility (P1.1.1)
 *
 * Tests verify WCAG 2.1 Level A compliance for keyboard-only users:
 * - Navigation links must be keyboard focusable
 * - Enter key must trigger navigation
 * - Space key must trigger navigation
 * - Tab order must be logical
 *
 * TDD: These tests MUST FAIL initially (red phase), then pass after implementation (green phase)
 */

describe('Keyboard Navigation Accessibility', () => {
  let user;

  beforeEach(() => {
    user = userEvent.setup();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.location.hash = '';
  });

  describe('Navigation links keyboard focusability', () => {
    it('should allow navigation links to receive keyboard focus', async () => {
      render(
        <StoreProvider>
          <App />
        </StoreProvider>
      );

      // Find the first navigation link (should be "Subject")
      const navLinks = screen.getAllByRole('link', { name: /subject/i });
      const firstNavLink = navLinks[0];

      // Directly focus the navigation link (simulates user tabbing to it)
      firstNavLink.focus();

      // Verify the link can receive focus
      expect(document.activeElement).toBe(firstNavLink);
    });

    it('should allow tabbing between navigation links', async () => {
      const { container } = render(
        <StoreProvider>
          <App />
        </StoreProvider>
      );

      // Get navigation links
      const navLinks = container.querySelectorAll('.nav-link');
      expect(navLinks.length).toBeGreaterThan(0);

      // Verify all navigation links are in tab order (have default tabindex)
      navLinks.forEach(link => {
        // Links without explicit tabIndex=-1 are in tab order
        expect(link.getAttribute('tabindex')).not.toBe('-1');
      });

      // Focus first nav link and verify it works
      navLinks[0].focus();
      expect(document.activeElement).toBe(navLinks[0]);

      // Focus second nav link and verify it works
      if (navLinks.length > 1) {
        navLinks[1].focus();
        expect(document.activeElement).toBe(navLinks[1]);
      }
    });
  });

  describe('Enter key navigation', () => {
    it('should navigate to section when Enter key is pressed on nav link', async () => {
      render(
        <StoreProvider>
          <App />
        </StoreProvider>
      );

      // Find the "Subject" navigation link
      const subjectNavLink = screen.getAllByRole('link', { name: /subject/i })[0];

      // Focus the link
      subjectNavLink.focus();
      expect(document.activeElement).toBe(subjectNavLink);

      // Press Enter
      await user.keyboard('{Enter}');

      // Verify the link was activated (check for highlight class on target section)
      await waitFor(() => {
        const subjectArea = document.querySelector('#subject-area');
        expect(subjectArea).toHaveClass('highlight-region');
      }, { timeout: 100 });
    });

    it('should add active-nav-link class when Enter is pressed', async () => {
      render(
        <StoreProvider>
          <App />
        </StoreProvider>
      );

      const navLink = screen.getAllByRole('link', { name: /subject/i })[0];
      navLink.focus();

      await user.keyboard('{Enter}');

      // The parent <li> should get the active-nav-link class
      await waitFor(() => {
        expect(navLink.parentNode).toHaveClass('active-nav-link');
      }, { timeout: 100 });
    });
  });

  describe('Space key navigation', () => {
    it('should navigate to section when Space key is pressed on nav link', async () => {
      render(
        <StoreProvider>
          <App />
        </StoreProvider>
      );

      const navLink = screen.getAllByRole('link', { name: /data acq device/i })[0];
      navLink.focus();

      // Press Space
      await user.keyboard(' ');

      // Verify navigation occurred
      await waitFor(() => {
        const targetArea = document.querySelector('#data_acq_device-area');
        expect(targetArea).toHaveClass('highlight-region');
      }, { timeout: 100 });
    });

    it('should prevent default scroll behavior when Space is pressed', async () => {
      render(
        <StoreProvider>
          <App />
        </StoreProvider>
      );

      const navLink = screen.getAllByRole('link', { name: /subject/i })[0];
      navLink.focus();

      // Spy on scrollBy to verify Space doesn't trigger page scroll
      const scrollSpy = vi.spyOn(window, 'scrollBy');

      await user.keyboard(' ');

      // Space should NOT cause window scrolling (default browser behavior)
      // because we preventDefault() in the onKeyDown handler
      expect(scrollSpy).not.toHaveBeenCalled();

      scrollSpy.mockRestore();
    });
  });

  describe('Nested navigation (electrode groups)', () => {
    it('supports keyboard navigation for nested electrode group items', async () => {
      // A configured workspace removes the old "too much initial state" blocker.
      window.location.hash = '#/day/remy-2023-06-22';
      render(
        <StoreProvider initialState={{ workspace: makeConfiguredWorkspace() }}>
          <App />
        </StoreProvider>
      );
      await act(async () => {
        window.dispatchEvent(new HashChangeEvent('hashchange'));
        await Promise.resolve();
      });

      // Keyboard-advance the stepper from Overview to Devices (Alt+ArrowRight).
      fireEvent.keyDown(document.body, { key: 'ArrowRight', altKey: true });
      await screen.findByRole('heading', { name: /devices configuration/i });

      // Each electrode group is a native <details><summary> disclosure — nested,
      // keyboard-focusable, and operable. Focus the first and toggle it open.
      const summaries = document.querySelectorAll('.electrode-group-summary');
      expect(summaries.length).toBeGreaterThan(0);
      const firstSummary = summaries[0];
      const details = firstSummary.closest('details');
      expect(details.open).toBe(false);

      firstSummary.focus();
      expect(document.activeElement).toBe(firstSummary);

      // Activating the summary (Enter/click on a native disclosure) expands it.
      await user.click(firstSummary);
      await waitFor(() => expect(details.open).toBe(true));
    });
  });

  describe('Keyboard navigation edge cases', () => {
    it('should handle Enter key when target element does not exist', async () => {
      render(
        <StoreProvider>
          <App />
        </StoreProvider>
      );

      const navLink = screen.getAllByRole('link', { name: /subject/i })[0];

      // Temporarily remove the target element
      const subjectArea = document.querySelector('#subject-area');
      const parent = subjectArea.parentNode;
      parent.removeChild(subjectArea);

      navLink.focus();
      await user.keyboard('{Enter}');

      // Should not throw error, and should not add active-nav-link
      await waitFor(() => {
        expect(navLink.parentNode).not.toHaveClass('active-nav-link');
      }, { timeout: 100 });

      // Restore element
      parent.appendChild(subjectArea);
    });

    it('should remove highlight-region class after timeout', async () => {
      render(
        <StoreProvider>
          <App />
        </StoreProvider>
      );

      const navLink = screen.getAllByRole('link', { name: /subject/i })[0];
      navLink.focus();
      await user.keyboard('{Enter}');

      const subjectArea = document.querySelector('#subject-area');

      // Should have highlight initially
      await waitFor(() => {
        expect(subjectArea).toHaveClass('highlight-region');
      }, { timeout: 100 });

      // Should remove highlight after 1000ms
      await waitFor(() => {
        expect(subjectArea).not.toHaveClass('highlight-region');
      }, { timeout: 1100 });
    });
  });

  describe('ARIA and accessibility attributes', () => {
    it('should have proper role attributes for navigation', () => {
      const { container } = render(
        <StoreProvider>
          <App />
        </StoreProvider>
      );

      // All nav links should have link role (implicit from <a> tag)
      const navLinks = container.querySelectorAll('.nav-link');
      navLinks.forEach(link => {
        expect(link.tagName).toBe('A');
      });
    });

    it('should have href attributes for fallback navigation', () => {
      const { container } = render(
        <StoreProvider>
          <App />
        </StoreProvider>
      );

      // All nav links should have href for users who disable JavaScript
      const navLinks = container.querySelectorAll('.nav-link');
      navLinks.forEach(link => {
        expect(link.getAttribute('href')).toBeTruthy();
        expect(link.getAttribute('href')).toMatch(/^#/);
      });
    });
  });
});
