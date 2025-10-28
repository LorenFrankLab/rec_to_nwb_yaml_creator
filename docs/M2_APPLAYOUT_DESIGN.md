# M2 - AppLayout Design Decisions

**Status:** Approved for Implementation
**Created:** 2025-10-27
**Milestone:** M2 - UI Skeleton (Single-Page Compatible + A11y Baseline)

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Decisions](#architecture-decisions)
3. [Critical Issues Addressed](#critical-issues-addressed)
4. [Component Specifications](#component-specifications)
5. [Accessibility Requirements](#accessibility-requirements)
6. [Testing Strategy](#testing-strategy)
7. [Migration Plan](#migration-plan)
8. [Future Considerations](#future-considerations)

---

## Overview

### Purpose

Create hash-based routing infrastructure for future multi-view features while preserving 100% backward compatibility with the existing single-form application.

### Goals

- ✅ Add AppLayout wrapper with hash-based routing
- ✅ Create stub views for future functionality (Home, AnimalWorkspace, DayEditor, ValidationSummary)
- ✅ Preserve existing form functionality as default route
- ✅ Establish ARIA landmark structure across all views
- ✅ Ensure WCAG 2.1 Level AA accessibility compliance
- ✅ Prevent data loss during navigation
- ✅ Support keyboard navigation and screen readers

### Non-Goals for M2

- ❌ Implement actual workspace functionality (deferred to M3-M7)
- ❌ Add breadcrumb navigation (deferred to M3)
- ❌ Add localStorage autosave (deferred to M3)
- ❌ Add feature flags (already exists from M0)
- ❌ Modify YAML export logic (preserved in LegacyFormView)

---

## Architecture Decisions

### AD-01: Hash-Based Routing (No React Router)

**Decision:** Use custom hash-based routing with `useHashRouter` hook instead of React Router.

**Rationale:**

- GitHub Pages deployment (no server-side routing)
- Small bundle size (no external dependency)
- Simple use case (5 routes, no nested routing needed)
- Bookmark-friendly URLs
- Browser back/forward support built-in

**Trade-offs:**

- ✅ Zero external dependencies
- ✅ Lighter bundle size
- ✅ Full control over routing logic
- ❌ Manual route parsing required
- ❌ No advanced features (lazy loading, route guards, etc.)

**Alternatives Considered:**

- React Router Hash History: Rejected due to added complexity and bundle size
- React Router v6 with HashRouter: Overkill for 5 simple routes

---

### AD-02: Centralized Router Component (AppLayout)

**Decision:** Create `AppLayout.jsx` component that handles both layout and routing.

**Rationale:**

- Single responsibility: AppLayout owns all routing logic
- Layout (header, footer, landmarks) consistent across all views
- Easy to add new routes (one switch case, one hash pattern)
- Testable in isolation

**Structure:**

```
AppLayout (hash parsing + layout wrapper)
  ├─ Header (logo, visual location indicator)
  ├─ Main content (conditional view rendering)
  └─ Footer (copyright, version)
```

**Alternatives Considered:**

- **Separate AppRouter + AppLayout:** Rejected due to unnecessary component nesting
- **App.js as router:** Rejected to keep App.js minimal and preserve separation

---

### AD-03: Extract Current App.js to LegacyFormView

**Decision:** Move all current App.js form logic to `pages/LegacyFormView.jsx`.

**Rationale:**

- Preserves existing functionality exactly as-is
- LegacyFormView becomes default route (#/ or no hash)
- No changes to form logic, validation, or export
- Golden baseline tests continue passing
- Clear path for eventual deprecation (M12+)

**Migration Strategy:**

1. Create LegacyFormView.jsx
2. Copy all App.js form logic (import, export, validation, rendering)
3. Keep StoreContext usage identical
4. Update App.js to render AppLayout
5. Verify all tests pass

**Critical:** LegacyFormView must be byte-for-byte identical in behavior to current App.js.

---

### AD-04: Route Pattern Design

**Decision:** Use simple hash patterns with prefix to avoid conflicts.

**Route Patterns:**

```
#/              → LegacyFormView (default)
(no hash)       → LegacyFormView (normalized to #/)
#               → LegacyFormView (normalized to #/)
#/home          → Home
#/workspace     → AnimalWorkspace
#/day/:id       → DayEditor
#/validation    → ValidationSummary
```

**Route Parsing Logic:**

```javascript
function parseHashRoute(hash = window.location.hash) {
  const cleanHash = hash.slice(1) || ''; // Remove leading #

  // Normalize empty hash to legacy form
  if (!cleanHash || cleanHash === '/') {
    return { view: 'legacy', params: {} };
  }

  // Exact matches
  if (cleanHash === '/home') return { view: 'home', params: {} };
  if (cleanHash === '/workspace') return { view: 'workspace', params: {} };
  if (cleanHash === '/validation') return { view: 'validation', params: {} };

  // Pattern match for day/:id
  const dayMatch = cleanHash.match(/^\/day\/([^/]+)$/);
  if (dayMatch) {
    const id = dayMatch[1];
    if (!id || id.trim() === '') {
      console.warn('Invalid day ID in route:', cleanHash);
      return { view: 'legacy', params: {} };
    }
    return { view: 'day', params: { id } };
  }

  // Unknown route - graceful fallback
  console.warn('Unknown route:', cleanHash);
  return { view: 'legacy', params: {}, isUnknownRoute: true };
}
```

**Rationale for #/ Prefix:**

- Avoids conflict with existing in-page anchors (#subject-area, #electrode-area)
- Standard pattern for hash-based routing
- Compatible with future query params (#/workspace?animal=remy)

---

### AD-05: Stub Views for Future Functionality

**Decision:** Create minimal stub components with proper ARIA structure and helpful messaging.

**Stub Component Template:**

```jsx
// pages/AnimalWorkspace/index.jsx
export function AnimalWorkspace() {
  return (
    <main id="main-content" role="main" aria-labelledby="workspace-heading">
      <h1 id="workspace-heading">Animal Workspace</h1>

      <div className="feature-preview" role="region" aria-label="Feature status">
        <p><strong>Status:</strong> In Development (Milestone 4)</p>

        <p>This view will allow you to:</p>
        <ul>
          <li>Manage multiple recording days for one animal</li>
          <li>Batch create session metadata</li>
          <li>Validate and export multiple YAML files at once</li>
        </ul>

        <p>
          <strong>Current workflow:</strong> Use the{' '}
          <a href="#/">legacy form</a> to create individual YAML files.
        </p>

        <p className="help-text">
          Questions? See the{' '}
          <a
            href="https://github.com/LorenFrankLab/rec_to_nwb_yaml_creator/blob/main/docs/TASKS.md"
            target="_blank"
            rel="noopener noreferrer"
          >
            development roadmap
          </a>.
        </p>
      </div>
    </main>
  );
}
```

**Rationale:**

- Clear communication that feature is under development
- Explains what the view will do (sets expectations)
- Provides path back to working functionality
- Links to documentation for curious users
- Proper ARIA structure for screen readers

---

## Critical Issues Addressed

### CI-01: Data Loss Prevention

**Issue:** Users navigating away from legacy form lose unsaved changes.

**Solution:** Add unsaved changes warning before navigation.

**Implementation:**

```javascript
// hooks/useUnsavedChangesWarning.js
export function useUnsavedChangesWarning(hasUnsavedChanges) {
  useEffect(() => {
    // Browser navigation away (close tab, external link)
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
      }
    };

    // Hash navigation within app
    const handleHashChange = (e) => {
      if (hasUnsavedChanges) {
        const confirmLeave = window.confirm(
          'You have unsaved changes that will be lost. Continue?'
        );
        if (!confirmLeave) {
          e.preventDefault();
          // Restore previous hash
          window.location.hash = '#/';
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('hashchange', handleHashChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [hasUnsavedChanges]);
}
```

**Detection Logic:**

```javascript
// LegacyFormView.jsx
function LegacyFormView() {
  const { model: formData } = useStoreContext();
  const [initialFormData] = useState(() => structuredClone(formData));

  const hasUnsavedChanges = useMemo(() => {
    return !isEqual(formData, initialFormData);
  }, [formData, initialFormData]);

  useUnsavedChangesWarning(hasUnsavedChanges);

  // ... rest of component
}
```

**User Experience:**

- Warning only shows if user has actually changed form data
- Browser-standard confirmation dialog (familiar UX)
- Prevents accidental data loss from logo click, browser back, etc.

---

### CI-02: Focus Management on Route Changes

**Issue:** Keyboard/screen reader focus doesn't move to new content after route change.

**Solution:** Automatically focus first heading on route change.

**Implementation:**

```javascript
// AppLayout.jsx
function AppLayout() {
  const currentRoute = useHashRouter();
  const previousRoute = useRef(currentRoute);

  useEffect(() => {
    // Only on route change (not initial render)
    if (previousRoute.current.view !== currentRoute.view) {
      requestAnimationFrame(() => {
        // Find and focus first heading in new view
        const heading = document.querySelector('main h1, main h2');
        if (heading) {
          heading.setAttribute('tabindex', '-1'); // Make focusable
          heading.focus();

          // Announce to screen readers
          announceRouteChange(currentRoute.view);
        }
      });
    }

    previousRoute.current = currentRoute;
  }, [currentRoute]);

  // ... rest of component
}

// Screen reader announcement
function announceRouteChange(view) {
  const liveRegion = document.getElementById('route-announcer');
  if (liveRegion) {
    const viewNames = {
      legacy: 'Metadata Form',
      home: 'Home - Animal Selection',
      workspace: 'Animal Workspace',
      day: 'Day Editor',
      validation: 'Validation Summary'
    };
    liveRegion.textContent = `Navigated to ${viewNames[view] || view}`;
  }
}
```

**Add to AppLayout JSX:**

```jsx
{/* Screen reader announcements */}
<div
  id="route-announcer"
  role="status"
  aria-live="polite"
  aria-atomic="true"
  className="visually-hidden"
/>
```

**CSS for visually-hidden:**

```css
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

---

### CI-03: Route Parsing Stability

**Issue:** `parseHash` function redeclared on every render causes potential infinite re-render.

**Solution:** Move `parseHash` outside component or use `useCallback`.

**Implementation:**

```javascript
// hooks/useHashRouter.js

/**
 * Parse hash into route object (pure function - moved outside component)
 * @param {string} hash - window.location.hash value
 * @returns {{view: string, params: Object, isUnknownRoute?: boolean}}
 */
function parseHashRoute(hash = window.location.hash) {
  // Guard for SSR/testing environments
  if (typeof window === 'undefined') {
    return { view: 'legacy', params: {} };
  }

  const cleanHash = hash.slice(1) || '';

  // Normalize empty hash
  if (!cleanHash || cleanHash === '/') {
    return { view: 'legacy', params: {} };
  }

  // Exact matches
  if (cleanHash === '/home') return { view: 'home', params: {} };
  if (cleanHash === '/workspace') return { view: 'workspace', params: {} };
  if (cleanHash === '/validation') return { view: 'validation', params: {} };

  // Pattern match with validation
  const dayMatch = cleanHash.match(/^\/day\/([^/]+)$/);
  if (dayMatch) {
    const id = dayMatch[1];
    if (!id || id.trim() === '') {
      console.warn('Invalid day ID in route:', cleanHash);
      return { view: 'legacy', params: {} };
    }
    return { view: 'day', params: { id } };
  }

  // Unknown route - fallback
  console.warn('Unknown route:', cleanHash);
  return { view: 'legacy', params: {}, isUnknownRoute: true };
}

/**
 * Custom hook for hash-based routing
 * @returns {{view: string, params: Object, isUnknownRoute?: boolean}}
 */
export function useHashRouter() {
  const [route, setRoute] = useState(() => parseHashRoute());

  useEffect(() => {
    const handleHashChange = () => {
      setRoute(parseHashRoute());
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []); // Empty deps - parseHashRoute is pure and stable

  return route;
}

// Export for testing
export { parseHashRoute };
```

**Why This Works:**

- `parseHashRoute` is pure function outside component (stable reference)
- `useState` initial value uses function form (called only once)
- `useEffect` deps array is empty (parseHashRoute never changes)
- No risk of infinite re-renders

---

### CI-04: Skip Link Testing After Route Changes

**Issue:** Skip links may not work if target elements don't exist yet after route change.

**Solution:** Custom skip link handler that waits for DOM rendering.

**Implementation:**

```javascript
// AppLayout.jsx
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
```

**JSX:**

```jsx
<a
  href="#main-content"
  className="skip-link"
  onClick={(e) => handleSkipLinkClick(e, 'main-content')}
>
  Skip to main content
</a>
```

---

### CI-05: Logo Click Behavior

**Issue:** Logo click behavior undefined across different routes.

**Decision:** Logo always returns to `#/` (legacy form) for M2.

**Rationale:**

- Consistent with existing behavior
- Safe default (doesn't lose data if warning triggers)
- Simple to implement
- Can be changed in M3 when Home view has content

**Implementation:**

```jsx
// AppLayout.jsx
<div className="home-region" role="banner">
  <a
    href="#/"
    aria-label="Return to metadata form"
    onClick={(e) => {
      // Let useUnsavedChangesWarning handle confirmation if needed
      // Default link behavior will navigate
    }}
  >
    <img src={logo} alt="Loren Frank Lab logo" />
  </a>
</div>
```

**Future (M3+):** Logo goes to `#/home` (animal selection) from non-legacy routes.

---

## Component Specifications

### useHashRouter Hook

**File:** `src/hooks/useHashRouter.js`

**Purpose:** Manage hash-based routing state.

**API:**

```javascript
const route = useHashRouter();
// Returns: { view: string, params: Object, isUnknownRoute?: boolean }
```

**Type Definition (JSDoc):**

```javascript
/**
 * @typedef {Object} RouteInfo
 * @property {'home'|'workspace'|'day'|'validation'|'legacy'} view
 * @property {Object.<string, string>} params - Route parameters (e.g., {id: '123'})
 * @property {boolean} [isUnknownRoute] - True if route not recognized
 */

/**
 * Hook for hash-based routing
 * @returns {RouteInfo} Current route information
 */
export function useHashRouter() { /* ... */ }
```

**Testing:**

```javascript
// Can test parseHashRoute directly (exported)
import { parseHashRoute } from './useHashRouter';

expect(parseHashRoute('#/day/123')).toEqual({
  view: 'day',
  params: { id: '123' }
});
```

---

### AppLayout Component

**File:** `src/layouts/AppLayout.jsx`

**Purpose:** Top-level layout wrapper with routing.

**Props:** None (stateless from parent perspective)

**Structure:**

```jsx
export function AppLayout() {
  return (
    <>
      {/* Skip links */}
      <a href="#main-content" onClick={handleSkipLink}>Skip to main content</a>

      {/* Screen reader announcements */}
      <div id="route-announcer" role="status" aria-live="polite" className="visually-hidden" />

      {/* Header */}
      <div className="home-region" role="banner">
        <a href="#/"><img src={logo} alt="Loren Frank Lab logo" /></a>
      </div>

      {/* Main content */}
      <main id="main-content" tabIndex="-1" role="main" aria-label="Main content">
        {renderCurrentView()}
      </main>

      {/* Footer */}
      <footer className="footer" role="contentinfo">
        Copyright © {new Date().getFullYear()} Loren Frank Lab
      </footer>
    </>
  );
}
```

**ARIA Landmarks:**

- `role="banner"` - Header with logo
- `role="main"` - Main content area
- `role="contentinfo"` - Footer
- Each view provides its own internal structure

---

### LegacyFormView Component

**File:** `src/pages/LegacyFormView.jsx`

**Purpose:** Preserve existing form functionality exactly as-is.

**Migration Strategy:**

1. Copy all logic from current App.js
2. Keep StoreContext usage identical
3. Preserve all handlers (importFile, generateYMLFile, etc.)
4. Keep AlertModal state management
5. Preserve navigation sidebar
6. Add useUnsavedChangesWarning hook

**Critical:** Golden baseline tests must pass unchanged.

---

### Stub View Components

**Files:**

- `src/pages/Home/index.jsx`
- `src/pages/AnimalWorkspace/index.jsx`
- `src/pages/DayEditor/index.jsx`
- `src/pages/ValidationSummary/index.jsx`

**Template:**

```jsx
export function ViewName({ /* optional props */ }) {
  return (
    <main id="main-content" role="main" aria-labelledby="view-heading">
      <h1 id="view-heading">View Title</h1>

      <div className="feature-preview" role="region" aria-label="Feature status">
        <p><strong>Status:</strong> In Development (Milestone X)</p>
        <p>Description of what this view will do...</p>
        <p><a href="#/">Return to legacy form</a></p>
      </div>
    </main>
  );
}
```

---

## Accessibility Requirements

### WCAG 2.1 Level AA Compliance

**2.1.1 Keyboard (Level A):**

- ✅ All routes navigable via keyboard
- ✅ Skip links work via Enter key
- ✅ Focus visible on all interactive elements

**2.4.1 Bypass Blocks (Level A):**

- ✅ Skip links present
- ✅ Custom skip link handler ensures target exists

**2.4.3 Focus Order (Level A):**

- ✅ Focus moves to heading on route change
- ✅ Logical tab order preserved

**2.4.7 Focus Visible (Level AA):**

- ✅ CSS focus indicators on all interactive elements
- ✅ High contrast focus outlines

**4.1.2 Name, Role, Value (Level A):**

- ✅ All ARIA landmarks have unique labels
- ✅ Route changes announced to screen readers

**4.1.3 Status Messages (Level AA):**

- ✅ aria-live region for route announcements
- ✅ Polite announcements (don't interrupt)

---

### Testing Tools

**Automated:**

- jest-axe (integrated in CI)
- eslint-plugin-jsx-a11y

**Manual:**

- NVDA (screen reader testing)
- Keyboard-only navigation
- Browser dev tools accessibility inspector

---

## Testing Strategy

### Unit Tests

**useHashRouter.test.js:**

```javascript
describe('useHashRouter', () => {
  it('parses legacy route', () => {
    expect(parseHashRoute('#/')).toEqual({ view: 'legacy', params: {} });
    expect(parseHashRoute('#')).toEqual({ view: 'legacy', params: {} });
    expect(parseHashRoute('')).toEqual({ view: 'legacy', params: {} });
  });

  it('parses day route with ID', () => {
    expect(parseHashRoute('#/day/123')).toEqual({
      view: 'day',
      params: { id: '123' }
    });
  });

  it('validates day ID', () => {
    expect(parseHashRoute('#/day/')).toEqual({ view: 'legacy', params: {} });
    expect(parseHashRoute('#/day/  ')).toEqual({ view: 'legacy', params: {} });
  });

  it('handles unknown routes', () => {
    const result = parseHashRoute('#/unknown');
    expect(result.view).toBe('legacy');
    expect(result.isUnknownRoute).toBe(true);
  });
});
```

**AppLayout.test.jsx:**

```javascript
describe('AppLayout', () => {
  it('renders legacy view by default', () => {
    render(<AppLayout />);
    expect(screen.getByText(/Rec-to-NWB YAML Creator/i)).toBeInTheDocument();
  });

  it('renders workspace view at #/workspace', () => {
    window.location.hash = '#/workspace';
    render(<AppLayout />);
    expect(screen.getByRole('heading', { name: /Animal Workspace/i })).toBeInTheDocument();
  });

  it('handles browser back/forward', () => {
    window.location.hash = '#/home';
    render(<AppLayout />);
    expect(screen.getByRole('heading', { name: /Home/i })).toBeInTheDocument();

    // Simulate back button
    window.location.hash = '#/';
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    expect(screen.getByText(/Rec-to-NWB YAML Creator/i)).toBeInTheDocument();
  });
});
```

---

### Integration Tests

**aria-landmarks.test.jsx:**

```javascript
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { AppLayout } from '@/layouts/AppLayout';

expect.extend(toHaveNoViolations);

describe('ARIA Landmarks', () => {
  it('has no axe violations on legacy view', async () => {
    const { container } = render(<AppLayout />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has proper landmark structure', () => {
    const { getByRole } = render(<AppLayout />);

    expect(getByRole('banner')).toBeInTheDocument(); // Header
    expect(getByRole('main')).toBeInTheDocument();   // Main content
    expect(getByRole('contentinfo')).toBeInTheDocument(); // Footer
  });

  it('has skip link to main content', () => {
    const { getByText } = render(<AppLayout />);
    const skipLink = getByText('Skip to main content');

    expect(skipLink).toHaveAttribute('href', '#main-content');
  });

  it('focuses heading after route change', async () => {
    const { getByRole } = render(<AppLayout />);

    // Change route
    window.location.hash = '#/workspace';
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    // Wait for focus management
    await waitFor(() => {
      const heading = getByRole('heading', { name: /Animal Workspace/i });
      expect(heading).toHaveFocus();
    });
  });

  it('announces route change to screen readers', async () => {
    render(<AppLayout />);

    window.location.hash = '#/workspace';
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    const announcer = document.getElementById('route-announcer');
    expect(announcer).toHaveTextContent(/Navigated to Animal Workspace/i);
  });
});
```

---

### Baseline Tests

**Existing golden baseline tests must continue passing:**

- `golden-yaml.baseline.test.js` - Verify YAML export unchanged
- All 2149 existing tests must pass

---

## Migration Plan

### Phase 1: Create Infrastructure (No Behavior Change)

**Step 1.1: Create useHashRouter hook**

- File: `src/hooks/useHashRouter.js`
- Write tests first (TDD)
- Implement parseHashRoute + useHashRouter
- Export both for testing

**Step 1.2: Create stub view components**

- Files: `src/pages/{Home,AnimalWorkspace,DayEditor,ValidationSummary}/index.jsx`
- Minimal JSX with proper ARIA
- Helpful messaging with links back to legacy form

**Step 1.3: Create AppLayout component**

- File: `src/layouts/AppLayout.jsx`
- Wire up routing with useHashRouter
- Add ARIA landmarks
- Add focus management
- Add route announcer

**Verification:** All components render in isolation, tests pass.

---

### Phase 2: Extract LegacyFormView (High Risk)

**Step 2.1: Create LegacyFormView skeleton**

- File: `src/pages/LegacyFormView.jsx`
- Import all necessary components
- Set up StoreContext usage

**Step 2.2: Copy App.js logic incrementally**

- Copy state management (AlertModal, etc.)
- Copy handlers (importFile, generateYMLFile, etc.)
- Copy navigation sidebar logic
- Copy form rendering JSX

**Step 2.3: Add unsaved changes warning**

- Create `useUnsavedChangesWarning` hook
- Integrate into LegacyFormView

**Step 2.4: Verify LegacyFormView works standalone**

- Render LegacyFormView in test
- Verify all existing tests pass
- Verify golden baselines pass

---

### Phase 3: Wire Up AppLayout (Integration)

**Step 3.1: Update App.js**

- Remove form logic (moved to LegacyFormView)
- Render AppLayout instead
- Keep StoreContext provider

**Step 3.2: Update index.js (if needed)**

- Ensure AppLayout is wrapped in StoreContext

**Step 3.3: Integration testing**

- Test all routes render correctly
- Test browser back/forward
- Test skip links after route changes
- Test keyboard navigation

---

### Phase 4: Accessibility Verification

**Step 4.1: Automated tests**

- Run jest-axe on all views
- Verify no WCAG violations

**Step 4.2: Manual testing**

- Test with NVDA screen reader
- Test keyboard-only navigation
- Test focus management on route changes
- Test skip links work after navigation

**Step 4.3: Cross-browser testing**

- Chrome (desktop)
- Firefox (desktop)
- Safari (macOS)
- Edge (Windows)

---

### Phase 5: Documentation and Cleanup

**Step 5.1: Update documentation**

- Mark M2 tasks complete in TASKS.md
- Update SCRATCHPAD.md
- Update REFACTOR_CHANGELOG.md

**Step 5.2: Code review**

- Self-review all changes
- Run linter
- Verify JSDoc coverage

**Step 5.3: Final verification**

- Run full test suite
- Verify golden baselines
- Check bundle size impact
- Verify CI pipeline passes

---

## Future Considerations

### M3: localStorage Autosave

Once workspace state management is added, implement autosave:

```javascript
// hooks/useAutosave.js
export function useAutosave(data, key, intervalMs = 30000) {
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(data));
      } catch (e) {
        console.error('Failed to autosave:', e);
      }
    }, intervalMs);

    return () => clearTimeout(timer);
  }, [data, key, intervalMs]);
}
```

---

### M3: Breadcrumb Navigation

Add breadcrumbs for complex views:

```jsx
// components/Breadcrumbs.jsx
export function Breadcrumbs({ items }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="breadcrumbs">
        {items.map((item, index) => (
          <li key={index}>
            {index < items.length - 1 ? (
              <a href={item.href}>{item.label}</a>
            ) : (
              <span aria-current="page">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
```

---

### M4+: Query Parameters

Extend routing to support query params:

```javascript
// #/workspace?animal=remy
// #/day/123?section=cameras

function parseHashRoute(hash) {
  const [path, query] = hash.slice(1).split('?');
  const params = new URLSearchParams(query);

  return {
    view: /* parse path */,
    params: Object.fromEntries(params),
    path
  };
}
```

---

### M7+: Deep Linking

Support deep linking to specific form sections:

```javascript
// #/day/123?section=cameras&field=camera-0-id
// → Opens day editor, scrolls to cameras section, focuses camera 0 ID field
```

---

## Approval Checklist

- [x] Architecture reviewed by code-reviewer agent
- [x] UX reviewed by ux-reviewer agent
- [x] Critical issues addressed (data loss, focus management, parsing stability)
- [x] ARIA requirements documented
- [x] Testing strategy defined
- [x] Migration plan detailed
- [x] JSDoc type coverage planned
- [ ] Implementation ready to begin (Phase 4)

---

## Summary

This design establishes hash-based routing infrastructure for M2 while preserving 100% backward compatibility. All critical issues from reviews have been addressed:

1. **Data loss prevention:** Unsaved changes warning before navigation
2. **Focus management:** Automatic focus on headings after route changes
3. **Route parsing stability:** Pure function outside component
4. **Skip links:** Custom handler ensures targets exist
5. **Logo behavior:** Consistent return to legacy form

The architecture is simple, testable, and accessible. Stub views provide clear communication about future functionality while linking back to working features.

**Ready for implementation in Phase 4 (TDD approach).**
