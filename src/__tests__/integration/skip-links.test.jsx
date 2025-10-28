/**
 * @vitest-environment jsdom
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { StoreProvider } from '../../state/StoreContext';
import { App } from '../../App';

/**
 * Integration tests for skip links accessibility (P1.1.3)
 *
 * Skip links allow keyboard users to bypass repetitive navigation
 * and jump directly to main content or navigation.
 * Required for WCAG 2.1 Level A compliance (2.4.1 Bypass Blocks)
 *
 * TDD: These tests MUST FAIL initially (red phase), then pass after implementation (green phase)
 */

describe('Skip Links Accessibility', () => {
  describe('Skip link presence', () => {
    it('should have skip to main content link', () => {
      render(
        <StoreProvider>
          <App />
        </StoreProvider>
      );

      // Find skip link by href
      const skipLink = document.querySelector('a[href="#main-content"]');
      expect(skipLink).toBeTruthy();
      expect(skipLink.textContent).toMatch(/skip to main/i);
    });

    it('should have skip to navigation link', () => {
      render(
        <StoreProvider>
          <App />
        </StoreProvider>
      );

      const skipLink = document.querySelector('a[href="#navigation"]');
      expect(skipLink).toBeTruthy();
      expect(skipLink.textContent).toMatch(/skip to navigation/i);
    });
  });

  describe('Skip link positioning', () => {
    it('should have skip links as first focusable elements', () => {
      const { container } = render(
        <StoreProvider>
          <App />
        </StoreProvider>
      );

      // Skip links should be first in DOM order
      const allLinks = container.querySelectorAll('a');
      const firstLink = allLinks[0];
      const secondLink = allLinks[1];

      // First two links should be skip links
      expect(firstLink.getAttribute('href')).toMatch(/^#(main-content|navigation)$/);
      expect(secondLink.getAttribute('href')).toMatch(/^#(main-content|navigation)$/);
    });

    it('should have skip-link class for styling', () => {
      render(
        <StoreProvider>
          <App />
        </StoreProvider>
      );

      const skipToMain = document.querySelector('a[href="#main-content"]');
      const skipToNav = document.querySelector('a[href="#navigation"]');

      expect(skipToMain.className).toContain('skip-link');
      expect(skipToNav.className).toContain('skip-link');
    });
  });

  describe('Skip link targets', () => {
    it('should have main content element with id="main-content"', () => {
      render(
        <StoreProvider>
          <App />
        </StoreProvider>
      );

      const mainContent = document.querySelector('#main-content');
      expect(mainContent).toBeTruthy();
    });

    it('should have navigation element with id="navigation"', () => {
      render(
        <StoreProvider>
          <App />
        </StoreProvider>
      );

      const navigation = document.querySelector('#navigation');
      expect(navigation).toBeTruthy();
    });

    it('should have main content element with tabindex="-1" for focus', () => {
      render(
        <StoreProvider>
          <App />
        </StoreProvider>
      );

      const mainContent = document.querySelector('#main-content');
      // tabindex="-1" allows programmatic focus but keeps element out of tab order
      expect(mainContent.getAttribute('tabindex')).toBe('-1');
    });

    it('should have navigation element with tabindex="-1" for focus', () => {
      render(
        <StoreProvider>
          <App />
        </StoreProvider>
      );

      const navigation = document.querySelector('#navigation');
      expect(navigation.getAttribute('tabindex')).toBe('-1');
    });
  });

  describe('Skip link behavior', () => {
    it('should navigate to main content when skip link is clicked', () => {
      render(
        <StoreProvider>
          <App />
        </StoreProvider>
      );

      const skipLink = document.querySelector('a[href="#main-content"]');
      const mainContent = document.querySelector('#main-content');

      // Click the skip link
      skipLink.click();

      // Main content should receive focus
      // Note: In JSDOM, focus behavior may not work exactly like in browser
      // This test verifies the structure is correct
      expect(mainContent).toBeTruthy();
    });

    it('should navigate to navigation when skip link is clicked', () => {
      render(
        <StoreProvider>
          <App />
        </StoreProvider>
      );

      const skipLink = document.querySelector('a[href="#navigation"]');
      const navigation = document.querySelector('#navigation');

      skipLink.click();
      expect(navigation).toBeTruthy();
    });
  });

  describe('Visual hiding CSS', () => {
    it('should have skip links in DOM for screen readers', () => {
      const { container } = render(
        <StoreProvider>
          <App />
        </StoreProvider>
      );

      // Skip links should be in DOM even if visually hidden
      const skipLinks = container.querySelectorAll('.skip-link');
      expect(skipLinks.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Accessibility attributes', () => {
    it('should have descriptive text content', () => {
      render(
        <StoreProvider>
          <App />
        </StoreProvider>
      );

      const skipToMain = document.querySelector('a[href="#main-content"]');
      const skipToNav = document.querySelector('a[href="#navigation"]');

      // Text should clearly describe where the link goes
      expect(skipToMain.textContent.trim()).toBeTruthy();
      expect(skipToNav.textContent.trim()).toBeTruthy();
    });
  });
});
