/**
 * AppLayout Component - Main application layout with hash-based routing
 *
 * Provides consistent layout structure and routing for M2.
 * Renders different views based on window.location.hash.
 *
 * @module layouts/AppLayout
 */

import React, { useEffect, useRef } from 'react';
import { useHashRouter } from '../hooks/useHashRouter';
import { Home } from '../pages/Home';
import { AnimalWorkspace } from '../pages/AnimalWorkspace';
import { DayEditor } from '../pages/DayEditor';
import { ValidationSummary } from '../pages/ValidationSummary';
import { LegacyFormView } from '../pages/LegacyFormView';
import logo from '../logo.png';

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
 * - #/validation -> ValidationSummary
 *
 * @returns {React.Element} Rendered layout with current view
 */
export function AppLayout() {
  const currentRoute = useHashRouter();
  const previousRoute = useRef(currentRoute);

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
   * Render current view based on route
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
      </div>

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
