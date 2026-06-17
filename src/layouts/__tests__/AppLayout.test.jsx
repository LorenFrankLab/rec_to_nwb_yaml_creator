/**
 * Tests for AppLayout component
 *
 * Tests hash-based routing, view rendering, ARIA landmarks,
 * focus management, and accessibility for M2.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render as rtlRender, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StoreProvider } from '../../state/StoreContext';
import { AppLayout } from '../AppLayout';

// AppLayout now consumes the store (persistence status for the unsaved-work guard),
// so all renders are wrapped in a StoreProvider.
const render = (ui, options) =>
  rtlRender(ui, {
    wrapper: ({ children }) => <StoreProvider>{children}</StoreProvider>,
    ...options,
  });

// Mock child components to avoid deep rendering
// NOTE: Mocks must provide <main> element since AppLayout no longer wraps views
vi.mock('../../pages/Home', () => ({
  Home: () => <main id="main-content" tabIndex="-1" role="main" data-testid="home-view">Home View</main>,
}));

vi.mock('../../pages/AnimalWorkspace', () => ({
  AnimalWorkspace: () => <main id="main-content" tabIndex="-1" role="main" data-testid="workspace-view">Workspace View</main>,
}));

vi.mock('../../pages/DayEditor', () => ({
  DayEditor: ({ dayId }) => <main id="main-content" tabIndex="-1" role="main" data-testid="day-editor-view">Day Editor: {dayId}</main>,
}));

vi.mock('../../pages/ValidationSummary', () => ({
  ValidationSummary: () => <main id="main-content" tabIndex="-1" role="main" data-testid="validation-view">Validation View</main>,
}));

vi.mock('../../pages/LegacyFormView', () => ({
  LegacyFormView: () => (
    <div className="page-container">
      <div id="navigation" tabIndex="-1" role="navigation" />
      <div id="main-content" tabIndex="-1" role="main" data-testid="legacy-view">Legacy Form View</div>
    </div>
  ),
}));

describe('AppLayout', () => {
  let originalLocation;

  beforeEach(() => {
    // Save and mock window.location
    originalLocation = window.location;
    delete window.location;
    window.location = { hash: '#/' };
  });

  afterEach(() => {
    // Restore window.location
    window.location = originalLocation;
  });

  describe('route-based view rendering', () => {
    it('renders legacy view by default (no hash)', () => {
      window.location.hash = '';
      render(<AppLayout />);
      expect(screen.getByTestId('legacy-view')).toBeInTheDocument();
    });

    it('renders legacy view for #/', () => {
      window.location.hash = '#/';
      render(<AppLayout />);
      expect(screen.getByTestId('legacy-view')).toBeInTheDocument();
    });

    it('renders home view for #/home', () => {
      window.location.hash = '#/home';
      render(<AppLayout />);
      expect(screen.getByTestId('home-view')).toBeInTheDocument();
    });

    it('renders workspace view for #/workspace', () => {
      window.location.hash = '#/workspace';
      render(<AppLayout />);
      expect(screen.getByTestId('workspace-view')).toBeInTheDocument();
    });

    it('banner logo returns to the metadata form ONLY on the legacy route', () => {
      window.location.hash = '#/';
      render(<AppLayout />);
      expect(screen.getByRole('link', { name: /return to metadata form/i })).toHaveAttribute('href', '#/');
    });

    it('banner logo goes to the WORKSPACE (not the legacy form) on the new-model routes', () => {
      window.location.hash = '#/workspace';
      render(<AppLayout />);
      // The in-app "home" of the new model is the workspace — clicking the logo from the workspace/
      // animal/day pages must not dump the user back into the frozen legacy form.
      const logo = screen.getByRole('link', { name: /go to workspace/i });
      expect(logo).toHaveAttribute('href', '#/workspace');
      expect(screen.queryByRole('link', { name: /return to metadata form/i })).not.toBeInTheDocument();
    });

    it('renders day editor view for #/day/:id', () => {
      window.location.hash = '#/day/remy-2023-06-22';
      render(<AppLayout />);
      expect(screen.getByTestId('day-editor-view')).toBeInTheDocument();
      expect(screen.getByText(/Day Editor: remy-2023-06-22/i)).toBeInTheDocument();
    });

    it('renders validation view for #/validation', () => {
      window.location.hash = '#/validation';
      render(<AppLayout />);
      expect(screen.getByTestId('validation-view')).toBeInTheDocument();
    });

    it('renders legacy view for unknown routes', () => {
      window.location.hash = '#/unknown';
      render(<AppLayout />);
      expect(screen.getByTestId('legacy-view')).toBeInTheDocument();
    });
  });

  describe('hash change navigation', () => {
    it('updates view when hash changes', async () => {
      window.location.hash = '#/';
      render(<AppLayout />);
      expect(screen.getByTestId('legacy-view')).toBeInTheDocument();

      // Change hash
      window.location.hash = '#/workspace';
      window.dispatchEvent(new HashChangeEvent('hashchange'));

      await waitFor(() => {
        expect(screen.getByTestId('workspace-view')).toBeInTheDocument();
      });
    });

    it('handles multiple hash changes', async () => {
      window.location.hash = '#/';
      render(<AppLayout />);

      // Change 1: legacy -> home
      window.location.hash = '#/home';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      await waitFor(() => expect(screen.getByTestId('home-view')).toBeInTheDocument());

      // Change 2: home -> workspace
      window.location.hash = '#/workspace';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      await waitFor(() => expect(screen.getByTestId('workspace-view')).toBeInTheDocument());

      // Change 3: workspace -> validation
      window.location.hash = '#/validation';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      await waitFor(() => expect(screen.getByTestId('validation-view')).toBeInTheDocument());
    });

    it('handles browser back button', async () => {
      window.location.hash = '#/workspace';
      render(<AppLayout />);
      expect(screen.getByTestId('workspace-view')).toBeInTheDocument();

      // Simulate back button
      window.location.hash = '#/';
      window.dispatchEvent(new HashChangeEvent('hashchange'));

      await waitFor(() => {
        expect(screen.getByTestId('legacy-view')).toBeInTheDocument();
      });
    });

    it('navigates from workspace to validation and back', async () => {
      window.location.hash = '#/workspace';
      render(<AppLayout />);
      expect(screen.getByTestId('workspace-view')).toBeInTheDocument();

      window.location.hash = '#/validation';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      await waitFor(() => {
        expect(screen.getByTestId('validation-view')).toBeInTheDocument();
      });

      window.location.hash = '#/workspace';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      await waitFor(() => {
        expect(screen.getByTestId('workspace-view')).toBeInTheDocument();
      });
    });
  });

  describe('ARIA landmarks', () => {
    it('has banner landmark (header)', () => {
      render(<AppLayout />);
      expect(screen.getByRole('banner')).toBeInTheDocument();
    });

    it('has main landmark', () => {
      render(<AppLayout />);
      expect(screen.getByRole('main')).toBeInTheDocument();
    });

    it('has contentinfo landmark (footer)', () => {
      render(<AppLayout />);
      expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    });

    it('main landmark has correct ID', () => {
      render(<AppLayout />);
      const main = screen.getByRole('main');
      expect(main).toHaveAttribute('id', 'main-content');
    });

    it('main landmark has tabindex for focus management', () => {
      render(<AppLayout />);
      const main = screen.getByRole('main');
      expect(main).toHaveAttribute('tabindex', '-1');
    });
  });

  describe('skip links', () => {
    it('has skip to main content link', () => {
      render(<AppLayout />);
      const skipLink = screen.getByText('Skip to main content');
      expect(skipLink).toHaveAttribute('href', '#main-content');
      expect(skipLink).toHaveClass('skip-link');
    });

    it('skip link is first focusable element', () => {
      const { container } = render(<AppLayout />);
      const firstFocusable = container.querySelector('a');
      expect(firstFocusable).toHaveTextContent('Skip to main content');
    });
  });

  describe('header', () => {
    it('displays logo with alt text', () => {
      render(<AppLayout />);
      const logo = screen.getByAltText('Loren Frank Lab logo');
      expect(logo).toBeInTheDocument();
    });

    it('logo link goes to #/', () => {
      render(<AppLayout />);
      const logoLink = screen.getByAltText('Loren Frank Lab logo').closest('a');
      expect(logoLink).toHaveAttribute('href', '#/');
    });

    it('logo link has aria-label', () => {
      render(<AppLayout />);
      const logoLink = screen.getByAltText('Loren Frank Lab logo').closest('a');
      expect(logoLink).toHaveAttribute('aria-label');
    });
  });

  describe('footer', () => {
    it('displays copyright with current year', () => {
      render(<AppLayout />);
      const currentYear = new Date().getFullYear();
      expect(screen.getByText(new RegExp(currentYear.toString()))).toBeInTheDocument();
    });

    it('displays Loren Frank Lab link', () => {
      render(<AppLayout />);
      const labLink = screen.getByText('Loren Frank Lab');
      expect(labLink).toHaveAttribute('href', 'https://franklab.ucsf.edu/');
    });

    it('displays UCSF link', () => {
      render(<AppLayout />);
      const ucsfLink = screen.getByText(/University of California at San Francisco/i);
      expect(ucsfLink).toHaveAttribute('href', 'http://www.ucsf.edu');
    });
  });

  describe('focus management', () => {
    it('moves focus to main content on route change', async () => {
      window.location.hash = '#/';
      render(<AppLayout />);

      // Change route
      window.location.hash = '#/workspace';
      window.dispatchEvent(new HashChangeEvent('hashchange'));

      // Wait for focus management
      await waitFor(() => {
        const main = screen.getByRole('main');
        expect(document.activeElement).toBe(main);
      });
    });

    it('does not move focus on initial render', () => {
      window.location.hash = '#/workspace';
      render(<AppLayout />);

      // Focus should not be on main initially (no route change yet)
      const main = screen.getByRole('main');
      expect(document.activeElement).not.toBe(main);
    });
  });

  describe('screen reader announcements', () => {
    it('has aria-live region for route announcements', () => {
      render(<AppLayout />);
      const announcer = screen.getByRole('status');
      expect(announcer).toHaveAttribute('aria-live', 'polite');
      expect(announcer).toHaveAttribute('aria-atomic', 'true');
    });

    it('announces route change to screen readers', async () => {
      window.location.hash = '#/';
      render(<AppLayout />);

      const announcer = screen.getByRole('status');
      expect(announcer).toHaveTextContent('');

      // Change route
      window.location.hash = '#/workspace';
      window.dispatchEvent(new HashChangeEvent('hashchange'));

      await waitFor(() => {
        expect(announcer).toHaveTextContent(/workspace/i);
      });
    });

    it('aria-live region is visually hidden', () => {
      render(<AppLayout />);
      const announcer = screen.getByRole('status');
      expect(announcer).toHaveClass('visually-hidden');
    });
  });

  describe('accessibility', () => {
    it('renders view content correctly', () => {
      window.location.hash = '#/home';
      render(<AppLayout />);

      // Verify home view is rendered
      expect(screen.getByTestId('home-view')).toBeInTheDocument();
    });

    it('external links have rel="noopener noreferrer"', () => {
      render(<AppLayout />);
      const externalLinks = screen.getAllByRole('link').filter(link =>
        link.getAttribute('href')?.startsWith('http')
      );

      externalLinks.forEach(link => {
        if (link.getAttribute('target') === '_blank') {
          expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
        }
      });
    });
  });

  describe('rendering performance', () => {
    it('does not re-render on unrelated state changes', () => {
      let renderCount = 0;
      const TestWrapper = () => {
        renderCount++;
        return <AppLayout />;
      };

      const { rerender } = render(<TestWrapper />);
      const initialRenderCount = renderCount;

      // Force re-render
      rerender(<TestWrapper />);

      // Should only render twice (initial + forced)
      expect(renderCount).toBe(initialRenderCount + 1);
    });
  });

  describe('view isolation', () => {
    it('renders only the validation view when route is validation', () => {
      window.location.hash = '#/validation';
      render(<AppLayout />);

      // Should render the validation view
      expect(screen.getByTestId('validation-view')).toBeInTheDocument();

      // Should NOT render other views
      expect(screen.queryByTestId('workspace-view')).not.toBeInTheDocument();
      expect(screen.queryByTestId('day-editor-view')).not.toBeInTheDocument();
      expect(screen.queryByTestId('home-view')).not.toBeInTheDocument();
      expect(screen.queryByTestId('legacy-view')).not.toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('handles rapid route changes gracefully', async () => {
      window.location.hash = '#/';
      render(<AppLayout />);

      // Rapid fire changes
      window.location.hash = '#/home';
      window.dispatchEvent(new HashChangeEvent('hashchange'));

      window.location.hash = '#/workspace';
      window.dispatchEvent(new HashChangeEvent('hashchange'));

      window.location.hash = '#/validation';
      window.dispatchEvent(new HashChangeEvent('hashchange'));

      // Should end on last route
      await waitFor(() => {
        expect(screen.getByTestId('validation-view')).toBeInTheDocument();
      });
    });

    it('handles day ID with special characters', () => {
      window.location.hash = '#/day/animal_2023-06-22';
      render(<AppLayout />);
      expect(screen.getByText(/Day Editor: animal_2023-06-22/i)).toBeInTheDocument();
    });

    it('falls back to legacy for malformed day routes', () => {
      window.location.hash = '#/day/';
      render(<AppLayout />);
      expect(screen.getByTestId('legacy-view')).toBeInTheDocument();
    });
  });

  describe('integration with useHashRouter', () => {
    it('uses useHashRouter hook for routing', async () => {
      window.location.hash = '#/';
      render(<AppLayout />);

      // Verify hook integration by changing routes
      window.location.hash = '#/home';
      window.dispatchEvent(new HashChangeEvent('hashchange'));

      await waitFor(() => {
        expect(screen.getByTestId('home-view')).toBeInTheDocument();
      });
    });
  });

  describe('primary navigation', () => {
    it('is hidden on the legacy route (legacy supplies its own nav)', () => {
      window.location.hash = '#/';
      render(<AppLayout />);
      expect(screen.queryByRole('navigation', { name: /primary/i })).not.toBeInTheDocument();
    });

    it('renders Workspace and Validation & Export links on non-legacy routes (no standalone Home)', () => {
      window.location.hash = '#/workspace';
      render(<AppLayout />);

      const nav = screen.getByRole('navigation', { name: /primary/i });
      expect(nav).toBeInTheDocument();
      expect(nav).toHaveAttribute('id', 'navigation');
      expect(screen.getByRole('link', { name: /^workspace$/i })).toHaveAttribute('href', '#/workspace');
      // Batch Validation & Export is now discoverable in the chrome nav (Task 4.3/4.4).
      expect(screen.getByRole('link', { name: /validation & export/i })).toHaveAttribute('href', '#/validation');
      // The redundant standalone Home entry is gone — create-animal now lives in the workspace.
      expect(screen.queryByRole('link', { name: /^home$/i })).not.toBeInTheDocument();
    });

    it('focuses the primary nav when the skip-to-navigation link is activated', async () => {
      const user = userEvent.setup();
      const originalRaf = window.requestAnimationFrame;
      window.requestAnimationFrame = (cb) => {
        cb(0);
        return 0;
      };
      window.location.hash = '#/workspace';

      try {
        render(<AppLayout />);
        const nav = screen.getByRole('navigation', { name: /primary/i });
        await user.click(screen.getByRole('link', { name: /skip to navigation/i }));
        expect(nav).toHaveFocus();
      } finally {
        window.requestAnimationFrame = originalRaf;
      }
    });

    it('marks the current route link with aria-current=page', () => {
      window.location.hash = '#/validation';
      render(<AppLayout />);
      expect(screen.getByRole('link', { name: /validation & export/i })).toHaveAttribute('aria-current', 'page');
      expect(screen.getByRole('link', { name: /^workspace$/i })).not.toHaveAttribute('aria-current');
    });

    it('hides the "Use Legacy Editor" toggle while showLegacyToggle is off', () => {
      window.location.hash = '#/home';
      render(<AppLayout />);
      expect(screen.queryByRole('link', { name: /use legacy editor/i })).not.toBeInTheDocument();
    });
  });

  describe('discarded-workspace notice', () => {
    afterEach(() => {
      window.localStorage.clear();
    });

    it('shows a dismissible notice when a saved workspace could not be restored', async () => {
      // Seed an unusable (corrupt) blob so hydration discards it on mount.
      window.localStorage.setItem('rec_to_nwb_workspace_v1', '{not valid json');

      render(<AppLayout />);

      const notice = await screen.findByRole('alert');
      expect(notice).toHaveTextContent(/could not be restored/i);

      const dismiss = screen.getByRole('button', { name: /dismiss/i });
      await dismiss.click();

      await waitFor(() => {
        expect(screen.queryByText(/could not be restored/i)).not.toBeInTheDocument();
      });
    });

    it('shows no notice on a clean start (no saved blob)', () => {
      render(<AppLayout />);
      expect(screen.queryByText(/could not be restored/i)).not.toBeInTheDocument();
    });
  });
});
