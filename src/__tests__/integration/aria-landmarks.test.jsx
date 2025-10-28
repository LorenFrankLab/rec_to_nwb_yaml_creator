/**
 * @vitest-environment jsdom
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { StoreProvider } from '../../state/StoreContext';
import { App } from '../../App';

/**
 * Integration tests for ARIA landmarks (P1.1.4)
 *
 * ARIA landmarks provide semantic structure for screen readers
 * Required for WCAG 2.1 Level A compliance (1.3.1 Info and Relationships)
 */

describe('ARIA Landmarks', () => {
  describe('Navigation landmark', () => {
    it('should have navigation element with role="navigation"', () => {
      render(
        <StoreProvider>
          <App />
        </StoreProvider>
      );

      const nav = document.querySelector('[role="navigation"]');
      expect(nav).toBeTruthy();
    });

    it('should have navigation element with aria-label', () => {
      render(
        <StoreProvider>
          <App />
        </StoreProvider>
      );

      const nav = document.querySelector('[role="navigation"]');
      const ariaLabel = nav.getAttribute('aria-label');
      expect(ariaLabel).toBeTruthy();
      expect(ariaLabel).toMatch(/navigation|menu|nav/i);
    });
  });

  describe('Main content landmark', () => {
    it('should have main element with role="main"', () => {
      render(
        <StoreProvider>
          <App />
        </StoreProvider>
      );

      const main = document.querySelector('[role="main"]');
      expect(main).toBeTruthy();
    });

    it('should have main element with aria-label', () => {
      render(
        <StoreProvider>
          <App />
        </StoreProvider>
      );

      const main = document.querySelector('[role="main"]');
      const ariaLabel = main.getAttribute('aria-label');
      expect(ariaLabel).toBeTruthy();
      expect(ariaLabel).toMatch(/main|content|form/i);
    });
  });

  describe('Landmark uniqueness', () => {
    it('should have exactly one navigation landmark', () => {
      const { container } = render(
        <StoreProvider>
          <App />
        </StoreProvider>
      );

      const navs = container.querySelectorAll('[role="navigation"]');
      expect(navs.length).toBe(1);
    });

    it('should have exactly one main landmark', () => {
      const { container } = render(
        <StoreProvider>
          <App />
        </StoreProvider>
      );

      const mains = container.querySelectorAll('[role="main"]');
      expect(mains.length).toBe(1);
    });
  });

  describe('Landmark structure', () => {
    it('should have navigation landmark contain navigation links', () => {
      render(
        <StoreProvider>
          <App />
        </StoreProvider>
      );

      const nav = document.querySelector('[role="navigation"]');
      const navLinks = nav.querySelectorAll('a.nav-link');
      expect(navLinks.length).toBeGreaterThan(0);
    });

    it('should have main landmark contain form elements', () => {
      render(
        <StoreProvider>
          <App />
        </StoreProvider>
      );

      const main = document.querySelector('[role="main"]');
      const form = main.querySelector('form');
      expect(form).toBeTruthy();
    });
  });

  describe('Screen reader support', () => {
    it('should allow screen readers to navigate by landmarks', () => {
      const { container } = render(
        <StoreProvider>
          <App />
        </StoreProvider>
      );

      // Screen readers use role attributes to find landmarks
      const landmarks = container.querySelectorAll('[role="navigation"], [role="main"]');
      expect(landmarks.length).toBeGreaterThanOrEqual(2);
    });

    it('should have descriptive aria-labels for multiple landmarks of same type', () => {
      render(
        <StoreProvider>
          <App />
        </StoreProvider>
      );

      // If there were multiple nav elements, they should have distinct aria-labels
      const navs = document.querySelectorAll('[role="navigation"]');
      navs.forEach(nav => {
        expect(nav.getAttribute('aria-label')).toBeTruthy();
      });
    });
  });
});
