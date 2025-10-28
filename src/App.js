/**
 * App Component - Entry point for M2+ (using AppLayout)
 *
 * As of M2, this component simply renders the AppLayout component which
 * handles routing between different views (Home, Workspace, Day Editor, etc.).
 *
 * All original form functionality has been extracted to LegacyFormView.jsx
 * and is rendered when the route is #/ or #/legacy.
 *
 * @module App
 */

import React from 'react';
import { AppLayout } from './layouts/AppLayout';

/**
 * Root App Component
 *
 * Renders the AppLayout which provides:
 * - Hash-based routing (#/home, #/workspace, #/day/:id, etc.)
 * - ARIA landmarks and accessibility structure
 * - Skip links for keyboard navigation
 * - Screen reader announcements for route changes
 *
 * @returns {JSX.Element} The AppLayout component
 */
export function App() {
  return <AppLayout />;
}

export default App;
