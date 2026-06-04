/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { StoreProvider } from '../../state/StoreContext';
import { App } from '../../App';
import { overrideFlags, restoreFlags } from '../../featureFlags';
import { makeTestWorkspace } from '../helpers/test-fixtures';

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

  describe('Per-route landmarks (new workspace UI)', () => {
    const renderRoute = (hash) => {
      window.location.hash = hash;
      return render(
        <StoreProvider initialState={{ workspace: makeTestWorkspace() }}>
          <App />
        </StoreProvider>
      );
    };

    afterEach(() => {
      restoreFlags();
      window.location.hash = '';
    });

    // makeTestWorkspace seeds animal "remy" + day "remy_20230622".
    it('Home: one main + one #main-content, a navigation landmark, and a Workspace link', () => {
      overrideFlags({ animalWorkspace: true });
      const { container } = renderRoute('#/home');

      expect(container.querySelectorAll('[role="main"]')).toHaveLength(1);
      expect(container.querySelectorAll('#main-content')).toHaveLength(1);
      expect(container.querySelector('[role="navigation"]')).toBeTruthy();
      // Escape to the workspace exists via the primary nav.
      expect(screen.getByRole('link', { name: /^workspace$/i })).toBeInTheDocument();
    });

    it('Workspace: one main + one #main-content, a navigation landmark, escape to Home', () => {
      overrideFlags({ animalWorkspace: true });
      const { container } = renderRoute('#/workspace');

      expect(container.querySelectorAll('[role="main"]')).toHaveLength(1);
      expect(container.querySelectorAll('#main-content')).toHaveLength(1);
      expect(container.querySelector('[role="navigation"]')).toBeTruthy();
      expect(screen.getByRole('link', { name: /^home$/i })).toBeInTheDocument();
    });

    it('DayEditor: one main + one #main-content + one banner/contentinfo; back-to-workspace link', async () => {
      overrideFlags({ animalWorkspace: true, newDayEditor: true });
      const { container } = renderRoute('#/day/remy_20230622');

      // useDayIdFromUrl resolves the day id in an effect, so wait for the real stepper.
      const back = await screen.findByRole('link', { name: /back to workspace/i });
      expect(back).toBeInTheDocument();
      expect(container.querySelectorAll('[role="main"]')).toHaveLength(1);
      expect(container.querySelectorAll('#main-content')).toHaveLength(1);
      // The stepper header/footer are plain divs, so AppLayout owns the only banner
      // and contentinfo landmarks (no duplicates).
      expect(container.querySelectorAll('[role="banner"], header')).toHaveLength(1);
      expect(container.querySelectorAll('[role="contentinfo"], footer')).toHaveLength(1);

      // Exactly one step is marked current for assistive tech.
      const current = container.querySelectorAll('[aria-current="step"]');
      expect(current).toHaveLength(1);
    });

    it('AnimalEditor: exactly one main + one #main-content (duplicate removed); back-to-workspace link', async () => {
      overrideFlags({ animalWorkspace: true });
      const { container } = renderRoute('#/animal/remy/editor');

      // AnimalEditor is lazy-loaded behind Suspense.
      await waitFor(() => {
        expect(container.querySelectorAll('[role="main"]')).toHaveLength(1);
      });
      expect(container.querySelectorAll('#main-content')).toHaveLength(1);
      // Stepper header/footer are plain divs → AppLayout owns the only banner/contentinfo.
      expect(container.querySelectorAll('[role="banner"], header')).toHaveLength(1);
      expect(container.querySelectorAll('[role="contentinfo"], footer')).toHaveLength(1);
      expect(screen.getByRole('link', { name: /back to workspace/i })).toBeInTheDocument();
    });

    it('keeps the default route (#/) on the legacy form even with flags enabled', () => {
      overrideFlags({ animalWorkspace: true, newDayEditor: true });
      window.location.hash = '#/';
      // No seeded workspace here: the legacy form reads the flat formData model, so
      // seeding only { workspace } would leave formData without its fields.
      const { container } = render(
        <StoreProvider>
          <App />
        </StoreProvider>
      );

      // Default stays legacy this phase (cutover flips the default in a later phase).
      expect(container.querySelector('form')).toBeTruthy();
      // Legacy supplies a single main; the primary nav is not rendered on legacy.
      expect(container.querySelectorAll('[role="main"]')).toHaveLength(1);
      expect(screen.queryByRole('navigation', { name: /primary/i })).not.toBeInTheDocument();
    });
  });
});
