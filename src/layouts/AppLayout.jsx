/**
 * AppLayout Component - Main application layout with hash-based routing
 *
 * Provides consistent layout structure and routing for M2.
 * Renders different views based on window.location.hash.
 *
 * @module layouts/AppLayout
 */

import React, { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { useHashRouter } from '../hooks/useHashRouter';
import { isFeatureEnabled } from '../featureFlags';
import { useStoreContext } from '../state/StoreContext';
import { useUnsavedWorkGuard } from '../hooks/useUnsavedWorkGuard';
import useGlobalShortcuts from '../hooks/useGlobalShortcuts';
import { emitStepperShortcut } from '../hooks/stepperShortcuts';
import { ShortcutsHelp } from '../components/ShortcutsHelp';
import { Home } from '../pages/Home';
import { AnimalWorkspace } from '../pages/AnimalWorkspace';
import { DayEditor } from '../pages/DayEditor';
import { ValidationSummary } from '../pages/ValidationSummary';
import { LegacyFormView } from '../pages/LegacyFormView';
import logo from '../logo.png';
// Lazy load Animal Editor to avoid loading all its dependencies for tests that don't use it
const AnimalEditor = lazy(() => import('../pages/AnimalEditor'));

/**
 * Get view name for screen reader announcements
 * @param {string} view - Current view identifier
 * @returns {string} Human-readable view name
 */
function getViewName(view) {
  const viewNames = {
    legacy: 'Metadata Form',
    home: 'Home - Animal Selection',
    workspace: 'Animal Workspace',
    day: 'Day Editor',
    validation: 'Validation Summary',
    'animal-editor': 'Animal Editor',
  };
  return viewNames[view] || view;
}

/**
 * Announce route change to screen readers
 * @param {string} view - Current view identifier
 */
function announceRouteChange(view) {
  const liveRegion = document.getElementById('route-announcer');
  if (liveRegion) {
    liveRegion.textContent = `Navigated to ${getViewName(view)}`;
  }
}

/**
 * Handle skip link clicks
 * Ensures target exists before attempting to focus
 *
 * @param {Event} e - Click event
 * @param {string} targetId - ID of element to focus
 */
function handleSkipLinkClick(e, targetId) {
  e.preventDefault();

  // Wait for React to finish rendering
  requestAnimationFrame(() => {
    const target = document.getElementById(targetId);
    if (target) {
      target.setAttribute('tabindex', '-1'); // Ensure focusable
      target.focus();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      console.warn('Skip link target not found:', targetId);
    }
  });
}

/**
 * AppLayout Component
 *
 * Top-level layout wrapper that handles routing and provides
 * consistent ARIA landmark structure across all views.
 *
 * Routes:
 * - #/ or no hash -> LegacyFormView (default)
 * - #/home -> Home
 * - #/workspace -> AnimalWorkspace
 * - #/day/:id -> DayEditor
 * - #/animal/:id/editor -> AnimalEditor
 * - #/validation -> ValidationSummary
 *
 * @returns {React.Element} Rendered layout with current view
 */
export function AppLayout() {
  const currentRoute = useHashRouter();
  const previousRoute = useRef(currentRoute);

  // Warn before leaving the page while a workspace autosave is still in flight.
  const { persistence } = useStoreContext();
  useUnsavedWorkGuard(persistence.hasPendingWrite);

  // Global keyboard shortcuts (mounted once so they work on every route). Step
  // navigation / add are broadcast to whichever stepper is on screen; help opens a
  // dialog; Ctrl/Cmd+S flushes the workspace save.
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  useGlobalShortcuts({
    onSave: persistence.saveNow,
    onShowHelp: () => setShortcutsOpen(true),
    onNextStep: () => emitStepperShortcut('next'),
    onPrevStep: () => emitStepperShortcut('prev'),
    onAdd: () => emitStepperShortcut('add'),
  });

  // Focus management on route changes
  useEffect(() => {
    // Only on route change (not initial render)
    if (previousRoute.current.view !== currentRoute.view) {
      requestAnimationFrame(() => {
        // Move focus to main content
        const main = document.getElementById('main-content');
        if (main) {
          main.focus();

          // Announce to screen readers
          announceRouteChange(currentRoute.view);
        }
      });
    }

    previousRoute.current = currentRoute;
  }, [currentRoute]);

  /**
   * Render current view based on route.
   *
   * Routing contract (see shared-contracts "Feature flags & routing"): the default
   * route (`#/`) renders the legacy form, and the new workspace routes (`#/home`,
   * `#/workspace`, `#/day/:id`, `#/animal/:id/editor`, `#/validation`) render their
   * views and remain reachable for development regardless of the feature flags.
   * The cutover (a single switch in a later phase) flips `animalWorkspace` /
   * `newDayEditor` on and changes the *default* route to the workspace; nothing else
   * in this resolution changes. We intentionally do NOT gate the explicit new routes
   * behind the flags here, so they stay reachable while the default stays legacy.
   *
   * @returns {React.Element} Current view component
   */
  function renderView() {
    switch (currentRoute.view) {
      case 'home':
        return <Home />;

      case 'workspace':
        return <AnimalWorkspace />;

      case 'day':
        return <DayEditor dayId={currentRoute.params.id} />;

      case 'animal-editor':
        return (
          <Suspense fallback={<div>Loading Animal Editor...</div>}>
            <AnimalEditor />
          </Suspense>
        );

      case 'validation':
        return <ValidationSummary />;

      case 'legacy':
      default:
        return <LegacyFormView />;
    }
  }

  return (
    <>
      {/* Skip links for keyboard accessibility (WCAG 2.1 Level A - 2.4.1) */}
      <a
        href="#main-content"
        className="skip-link"
        onClick={(e) => handleSkipLinkClick(e, 'main-content')}
      >
        Skip to main content
      </a>
      <a
        href="#navigation"
        className="skip-link"
        onClick={(e) => handleSkipLinkClick(e, 'navigation')}
      >
        Skip to navigation
      </a>

      {/* Screen reader announcements for route changes */}
      <div
        id="route-announcer"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="visually-hidden"
      />

      {/* Header with logo */}
      <div className="home-region" role="banner">
        <a href="#/" aria-label="Return to metadata form">
          <img src={logo} alt="Loren Frank Lab logo" />
        </a>
        <button
          type="button"
          className="shortcuts-trigger"
          onClick={() => setShortcutsOpen(true)}
          aria-label="Keyboard shortcuts"
          aria-haspopup="dialog"
        >
          <span aria-hidden="true">⌨</span>
          <span className="visually-hidden">Keyboard shortcuts</span>
        </button>
      </div>

      <ShortcutsHelp isOpen={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      {/*
        Primary navigation makes the workspace discoverable. Rendered on the new
        (non-legacy) routes only: the legacy view supplies its own in-page
        "Form section navigation" landmark, so scoping this here keeps exactly one
        navigation landmark per route. The "Use Legacy Editor" toggle is hidden until
        the cutover enables `showLegacyToggle`.
      */}
      {currentRoute.view !== 'legacy' && (
        <nav className="primary-nav" role="navigation" aria-label="Primary">
          <a
            href="#/home"
            aria-current={currentRoute.view === 'home' ? 'page' : undefined}
          >
            Home
          </a>
          <a
            href="#/workspace"
            aria-current={currentRoute.view === 'workspace' ? 'page' : undefined}
          >
            Workspace
          </a>
          {isFeatureEnabled('showLegacyToggle') && (
            <a href="#/" className="legacy-toggle">
              Use Legacy Editor
            </a>
          )}
        </nav>
      )}

      {/* Notice when previously-saved workspace data could not be restored, so a
          discarded (corrupt / incompatible-version) workspace is never silent. */}
      {persistence.loadNotice && (
        <div className="load-notice" role="alert">
          <span>{persistence.loadNotice}</span>
          <button
            type="button"
            className="load-notice-dismiss"
            onClick={persistence.dismissLoadNotice}
            aria-label="Dismiss notice"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main content area - views provide their own <main> element */}
      {renderView()}

      {/* Footer */}
      <footer className="footer" role="contentinfo">
        Copyright © {new Date().getFullYear()}{' '}
        <a href="https://franklab.ucsf.edu/">Loren Frank Lab</a>
        <br />
        <a href="http://www.ucsf.edu">The University of California at San Francisco</a>
        <br />
      </footer>
    </>
  );
}

export default AppLayout;
