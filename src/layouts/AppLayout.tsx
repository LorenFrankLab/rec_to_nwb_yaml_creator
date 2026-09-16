/**
 * AppLayout Component - Main application layout with hash-based routing
 *
 * Provides consistent layout structure and routing for M2.
 * Renders different views based on window.location.hash.
 *
 * @module layouts/AppLayout
 */

import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import { useHashRouter } from '../hooks/useHashRouter';
import type { RouteInfo } from '../hooks/useHashRouter';
import { isFeatureEnabled } from '../featureFlags';
import { useStoreContext } from '../state/StoreContext';
import { useUnsavedWorkGuard } from '../hooks/useUnsavedWorkGuard';
import useGlobalShortcuts from '../hooks/useGlobalShortcuts';
import { emitStepperShortcut } from '../hooks/stepperShortcuts';
import { ShortcutsHelp } from '../components/ShortcutsHelp';
import AnimalSwitcher from '../components/AnimalSwitcher';
import AnimalDeleteDialog from '../components/AnimalDeleteDialog';
import AnimalProfileDialog from '../components/AnimalProfileDialog';
import ReadOnlyTabBanner from '../components/ReadOnlyTabBanner';
import { getAnimalDayIds } from '../state/workspaceSelectors';
import { RouteLoading } from './RouteLoading';
import logo from '../logo.png';
// The shell's OWN global stylesheet (banner, skip links, footer, base globals). Imported
// here, eagerly, so a direct load of any route paints a styled shell — it used to ride in on
// `App.scss` via the legacy form, which is now a lazily-loaded route.
import './AppShell.scss';
import styles from './AppLayout.module.css';

// Route components are CODE-SPLIT: each page is its own chunk, fetched the first time its route is
// opened, so a visitor downloads only the screen they are on (the whole app used to ship as one
// ~1.3 MB script). Everything else in this file — the banner, primary nav, dialogs, footer and skip
// links — stays a static import so the shell paints while a route chunk is still in flight.
//
// The `.then(m => ({ default: m.X }))` form deliberately resolves each route to the page's NAMED
// export — the binding the eager imports used — so a route resolves to the same component in the app
// and under a `vi.mock` factory (those factories mock the named export). ImportRepair and
// CopyFromAnimal export ONLY a default, so they import plainly.
const Home = lazy(() => import('../pages/Home').then((m) => ({ default: m.Home })));
const AnimalWorkspace = lazy(() =>
  import('../pages/AnimalWorkspace').then((m) => ({ default: m.AnimalWorkspace }))
);
const ImportRepair = lazy(() => import('../pages/ImportRepair'));
const CopyFromAnimal = lazy(() => import('../pages/CopyFromAnimal'));
const RecoveryReview = lazy(() =>
  import('../pages/RecoveryReview').then((m) => ({ default: m.RecoveryReview }))
);
const DayEditor = lazy(() => import('../pages/DayEditor').then((m) => ({ default: m.DayEditor })));
const ValidationSummary = lazy(() =>
  import('../pages/ValidationSummary').then((m) => ({ default: m.ValidationSummary }))
);
const AnimalView = lazy(() => import('../pages/AnimalView').then((m) => ({ default: m.AnimalView })));
const LegacyFormView = lazy(() =>
  import('../pages/LegacyFormView').then((m) => ({ default: m.LegacyFormView }))
);

/**
 * Moves keyboard / screen-reader focus to the routed page's `#main-content` when that page is
 * actually on screen.
 *
 * This is rendered INSIDE the Suspense boundary on purpose. Focus cannot be driven from a timer in
 * AppLayout: when an already-visible boundary re-suspends, React keeps the PREVIOUS page mounted but
 * hidden and shows the fallback, so `#main-content` still resolves during the load — to the OLD
 * page. Focusing that node is a no-op in a browser (it is not rendered) and leaves focus stranded on
 * whatever the user clicked. Being inside the boundary means this component's effect is suspended
 * along with the page and runs when the page is revealed, which is exactly the moment focus should
 * move. (Same shape as DayEditorFrame's own focus effect.)
 *
 * `token` changes only on a focus-worthy route change (see AppLayout's route effect); it starts at 0,
 * which is the initial render — a fresh page load must not steal focus.
 *
 * @param root0 - Component props.
 * @param root0.token - Bumped by AppLayout for each route change that should move focus.
 * @param root0.children - The routed page.
 */
function RouteFocus({ token, children }: { token: number; children: ReactNode }) {
  useEffect(() => {
    if (token === 0) return;
    document.getElementById('main-content')?.focus();
  }, [token]);
  return <>{children}</>;
}

/**
 * Get view name for screen reader announcements.
 */
function getViewName(view: string): string {
  const viewNames: Record<string, string> = {
    legacy: 'Metadata Form',
    home: 'Home - Animal Selection',
    workspace: 'Animal Workspace',
    import: 'Import Metadata YAML',
    'copy-from-animal': 'Copy from Another Animal',
    recovery: 'Review Recovered Data',
    day: 'Day Editor',
    validation: 'Validation Summary',
    'animal-view': 'Animal',
  };
  return viewNames[view] || view;
}

/**
 * Announce a route change to screen readers via the polite #route-announcer live region.
 *
 * Includes the routed day id for the Day Editor so consecutive day→day navigations produce DISTINCT
 * text — a polite live region only re-announces when its content actually changes, so an identical
 * "Navigated to Day Editor" on every day switch would be silently swallowed.
 *
 * @param route - The current route.
 */
function announceRouteChange(route: RouteInfo) {
  const liveRegion = document.getElementById('route-announcer');
  if (!liveRegion) return;
  const detail = route.view === 'day' && route.params?.id ? `: ${route.params.id}` : '';
  liveRegion.textContent = `Navigated to ${getViewName(route.view)}${detail}`;
}

/**
 * Handle skip link clicks. Ensures target exists before attempting to focus.
 */
function handleSkipLinkClick(e: ReactMouseEvent<HTMLAnchorElement>, targetId: string) {
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
 * - #/animal/:id/:tab -> AnimalView (tabbed animal workspace)
 * - #/validation -> ValidationSummary
 *
 * @returns {React.Element} Rendered layout with current view
 */
export function AppLayout() {
  const currentRoute = useHashRouter();
  const previousRoute = useRef(currentRoute);

  // Warn before leaving the page while a workspace autosave is still in flight OR a
  // save has failed. A failed save means the latest edits never reached storage, so
  // the guard must stay armed even once the pending-write debounce has settled
  // (including the saveNow path, which sets saveError without re-arming hasPendingWrite).
  const { persistence, model, actions } = useStoreContext();
  useUnsavedWorkGuard(
    persistence.hasPendingWrite || !!persistence.saveError || persistence.hasPendingDrafts
  );

  // Top object-selector lifecycle (Task 4.5). The switcher (chrome) delegates delete UP to here so
  // ONE shared type-to-confirm dialog serves it (and "+ New animal…" routes to the workspace's
  // single inline create panel) — neither host is duplicated. `pendingDeleteAnimalId` is the animal
  // a switcher row asked to delete (null when closed).
  const { animals = {}, days = {} } = model?.workspace ?? {};
  const [pendingDeleteAnimalId, setPendingDeleteAnimalId] = useState<string | null>(null);
  const pendingDeleteAnimal = pendingDeleteAnimalId ? animals[pendingDeleteAnimalId] : null;
  // The animal whose "Edit profile…" dialog is open (from a switcher row ⋮). Hosted here so the
  // dropdown can edit any animal's shared subject facts without navigating to it.
  const [pendingProfileAnimalId, setPendingProfileAnimalId] = useState<string | null>(null);
  const pendingProfileAnimal = pendingProfileAnimalId ? animals[pendingProfileAnimalId] : null;
  const confirmDeleteAnimal = () => {
    const id = pendingDeleteAnimalId;
    setPendingDeleteAnimalId(null);
    if (!id) return;
    actions.deleteAnimal(id);
    // If the deleted animal is the one currently being viewed, its route now points at a gone
    // animal — go to the picker rather than land on AnimalView's "Animal not found" (which reads
    // like an error for a deliberate delete). Deleting a NON-current animal from the switcher
    // leaves the user where they are.
    if (currentRoute.view === 'animal-view' && currentRoute.params.animalId === id) {
      window.location.hash = '#/workspace';
    }
  };
  /** "+ New animal…" from the switcher → the guided create-animal wizard (epoch-editor Phase 6). */
  const requestCreateAnimal = () => {
    window.location.hash = '#/home';
  };

  // Global keyboard shortcuts (mounted once so they work on every route). Step
  // navigation / add are broadcast to whichever stepper is on screen; help opens a
  // dialog; Ctrl/Cmd+S flushes the workspace save.
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const shortcutsTriggerRef = useRef<HTMLButtonElement>(null);
  // Open help; focus the trigger first so that when `?` opens the dialog (no element
  // focused), the Modal captures a real opener and returns focus to it on close.
  const openShortcuts = () => {
    shortcutsTriggerRef.current?.focus();
    setShortcutsOpen(true);
  };
  useGlobalShortcuts({
    onSave: persistence.saveNow,
    onShowHelp: openShortcuts,
    onNextStep: () => emitStepperShortcut('next'),
    onPrevStep: () => emitStepperShortcut('prev'),
    onAdd: () => emitStepperShortcut('add'),
  });

  // Focus management on route changes. AppLayout decides WHETHER a route change should move focus;
  // RouteFocus (inside the Suspense boundary) decides WHEN, because the new page may still be
  // downloading. 0 means "nothing to focus yet" — the initial page load must not steal focus.
  const [routeFocusToken, setRouteFocusToken] = useState(0);
  useEffect(() => {
    const prev = previousRoute.current;
    previousRoute.current = currentRoute;
    // Fire on a VIEW change, AND on a same-view change to a different routed DAY. The day route
    // remounts a keyed editor (see renderView) but keeps view === 'day', so a plain view check would
    // miss #/day/A → #/day/B — leaving keyboard/SR focus + the SR announcement stranded on the prior
    // day (DayEditorFrame skips focus on its first render, so nothing else compensates). The
    // animal-view :tab / :animalId changes are focus-managed inside AnimalView, so they are
    // deliberately NOT handled here (doing so would fight AnimalView's panel-focus effect).
    const viewChanged = prev.view !== currentRoute.view;
    const dayChanged =
      currentRoute.view === 'day' &&
      prev.view === 'day' &&
      prev.params.id !== currentRoute.params.id;
    if (!(viewChanged || dayChanged)) return;

    // Announce straight away and unconditionally: the live region belongs to the eager shell, so the
    // announcement must not be gated on the routed page (a lazily-loaded chunk) having arrived.
    announceRouteChange(currentRoute);

    // Focus is NOT moved from here. The routed page may still be downloading, and while an
    // already-visible Suspense boundary re-suspends the previous page stays in the DOM (hidden) — so
    // anything that looked up `#main-content` now would find the OLD page. RouteFocus, which lives
    // inside the boundary, does the focusing when the new page is revealed.
    setRouteFocusToken((token) => token + 1);
  }, [currentRoute]);

  /**
   * Render current view based on route.
   *
   * Routing contract (see shared-contracts "Feature flags & routing"): the default
   * route (`#/`) renders the legacy form, and the new workspace routes (`#/home`,
   * `#/workspace`, `#/day/:id`, `#/animal/:id/:tab`, `#/validation`) render their
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

      case 'import':
        return <ImportRepair />;

      case 'copy-from-animal':
        return <CopyFromAnimal />;

      case 'recovery':
        return <RecoveryReview />;

      case 'day':
        // Key by the routed day id so a DIRECT day→day hash change (e.g. browser back/forward
        // between two day URLs, with no intervening view change) REMOUNTS the editor. Without it,
        // the subtree is reconciled in place and day-scoped local/uncontrolled state (the Overview
        // Session/Experiment Description textareas, DayTechnicalSection's local state, the active
        // step) would carry the prior day's values into the new day — and a later blur would write
        // them into the wrong day.
        return <DayEditor key={currentRoute.params.id} dayId={currentRoute.params.id} />;

      case 'animal-view':
        return (
          <AnimalView
            animalId={currentRoute.params.animalId}
            tab={currentRoute.params.tab}
          />
        );

      case 'validation':
        return <ValidationSummary />;

      case 'legacy':
      default:
        return <LegacyFormView />;
    }
  }

  const isLegacyRoute = currentRoute.view === 'legacy';
  const readOnly = persistence.enabled && persistence.writer.role === 'reader';

  // The lab logo doubles as the in-app "home": legacy returns to the form, the new routes
  // go to the workspace. Shared between the legacy banner and the workspace app-bar.
  const logoLink = isLegacyRoute ? (
    <a href="#/" aria-label="Return to metadata form">
      <img src={logo} alt="Loren Frank Lab logo" />
    </a>
  ) : (
    <a href="#/workspace" aria-label="Go to workspace">
      <img src={logo} alt="Loren Frank Lab logo" />
    </a>
  );

  // Keyboard-shortcuts trigger — a right-aligned utility in the workspace app-bar; grouped
  // with the logo in the legacy banner. Rendered once (here) so its ref/focus wiring is shared.
  const shortcutsButton = (
    <button
      ref={shortcutsTriggerRef}
      type="button"
      className="shortcuts-trigger"
      onClick={() => setShortcutsOpen(true)}
      aria-label="Keyboard shortcuts"
      aria-haspopup="dialog"
      title="Keyboard shortcuts (press ?)"
    >
      <span aria-hidden="true">⌨</span>
      <span className="visually-hidden">Keyboard shortcuts</span>
    </button>
  );

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

      {/* Header with logo. The logo is the in-app "home": on the frozen legacy form (`#/`) it returns
          to the form, but on the new-model routes (workspace / animal / day / validation) it goes to
          the WORKSPACE — clicking it must not dump the user back into the legacy form. This does NOT
          change the default `#/` landing (a fresh visit still renders legacy); only the in-app target. */}
      {isLegacyRoute ? (
        // Frozen legacy route: the banner keeps its original logo + shortcuts grouping
        // (there is no primary nav here).
        <div className="home-region" role="banner">
          {logoLink}
          {shortcutsButton}
        </div>
      ) : (
        // Workspace routes: a single app-bar row — logo (left), the primary nav, and the
        // keyboard-shortcuts trigger pushed to the right. The primary nav is the workspace's
        // single navigation landmark; the "Use Legacy Editor" toggle is hidden until the
        // cutover enables `showLegacyToggle`.
        <div className={styles.appBar}>
          <div className="home-region" role="banner">{logoLink}</div>
          {/* The literal `primary-nav` class is kept as the DOM hook the frozen App.scss
              `body:has(.primary-nav) .home-region` banner rule depends on; `styles.primaryNav`
              carries the styling moved out of index.css. */}
          <nav
            id="navigation"
            className={`primary-nav ${styles.primaryNav}`}
            role="navigation"
            aria-label="Primary"
          >
            <a
              href="#/workspace"
              aria-current={currentRoute.view === 'workspace' ? 'page' : undefined}
            >
              Workspace
            </a>
            {/* Task 4.5: on an animal route, the top object-selector switches the CURRENT animal
                (`Workspace ▸ <animal> ▾`). Its lifecycle delegates up to AppLayout's shared delete
                dialog + the workspace create handshake. Elsewhere there is no current animal, so the
                selector is omitted and the plain nav stands. */}
            {currentRoute.view === 'animal-view' && animals[currentRoute.params.animalId] && (
              <>
                <span className={styles.primaryNavSep} aria-hidden="true">▸</span>
                <AnimalSwitcher
                  currentAnimalId={currentRoute.params.animalId}
                  animals={animals}
                  days={days}
                  onRequestDelete={setPendingDeleteAnimalId}
                  onRequestCreate={requestCreateAnimal}
                  onRequestEditProfile={setPendingProfileAnimalId}
                />
              </>
            )}
            {/* Batch / cross-animal Validation & Export is the chrome-level home for the preflight
                (Task 4.3/4.4); the per-animal export tab links UP to it. The redundant standalone
                "Home" entry is dropped — create-animal now lives in the workspace picker. */}
            <a
              href="#/validation"
              aria-current={currentRoute.view === 'validation' ? 'page' : undefined}
            >
              Validation &amp; Export
            </a>
            {isFeatureEnabled('showLegacyToggle') && (
              <a href="#/" className={styles.legacyToggle}>
                Use Legacy Editor
              </a>
            )}
          </nav>
          {shortcutsButton}
        </div>
      )}

      <ShortcutsHelp isOpen={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      {/* Single-writer ownership: a second tab is read-only and says so (self-hides for the writer). */}
      {!isLegacyRoute && <ReadOnlyTabBanner />}

      {/* Notice when previously-saved workspace data was recovered or could not be restored, so a
          recovered/discarded workspace is never silent. The "Review recovered data" link routes to
          the recovery-review screen (epoch-editor Phase 8), which renders each needs-review record
          (dangling / recovered-unlinked / wrong-owner / orphan) with its concrete repair. */}
      {persistence.loadNotice && (
        <div className={styles.loadNotice} role="alert">
          <span>{persistence.loadNotice}</span>
          <a className={styles.loadNoticeReview} href="#/recovery">
            Review recovered data
          </a>
          <button
            type="button"
            className={styles.loadNoticeDismiss}
            onClick={persistence.dismissLoadNotice}
            aria-label="Dismiss notice"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main content area - views provide their own <main> element. On the workspace routes it is
          wrapped in a fieldset that is DISABLED while this tab is read-only (another tab holds the
          writer lease): every editing control inside is inert, so a reader cannot type observations
          that the writer's next save would replace. Links (navigation) are unaffected; the ownership
          banner above (take over, download a backup) sits outside the fieldset. */}
      {/* ONE Suspense boundary for the whole route outlet: every route component is lazy, so this is
          what shows while the opened screen's chunk downloads. It sits OUTSIDE the read-only
          fieldset so the boundary (and its fallback) is shared by both branches and does not remount
          when the legacy/workspace branch changes. */}
      <Suspense fallback={<RouteLoading />}>
        <RouteFocus token={routeFocusToken}>
          {isLegacyRoute ? (
            renderView()
          ) : (
            <fieldset className={styles.editScope} disabled={readOnly}>
              {renderView()}
            </fieldset>
          )}
        </RouteFocus>
      </Suspense>

      {/* Shared animal-delete dialog for the top object-selector (Task 4.5). Hosted once in chrome
          so a switcher row's Delete uses the SAME type-to-confirm + cascade copy as the picker/header
          ⋮ menus. Deleting the currently-viewed animal leaves the route on a now-missing id, which
          AnimalView's "Animal not found" guard handles. */}
      <AnimalDeleteDialog
        isOpen={pendingDeleteAnimalId != null}
        animalId={pendingDeleteAnimalId ?? undefined}
        animal={pendingDeleteAnimal ?? undefined}
        days={days}
        onConfirm={confirmDeleteAnimal}
        onCancel={() => setPendingDeleteAnimalId(null)}
      />

      {/* Shared animal-profile editor for the top object-selector's row ⋮ (edit any animal's subject
          facts from the dropdown). Same dialog the AnimalView header ⋮ uses. */}
      <AnimalProfileDialog
        isOpen={pendingProfileAnimalId != null}
        animal={pendingProfileAnimal}
        animalId={pendingProfileAnimalId}
        animals={animals}
        dayCount={pendingProfileAnimal ? getAnimalDayIds(pendingProfileAnimal).length : 0}
        onSave={(subject) => actions.updateAnimal(pendingProfileAnimalId, { subject })}
        onClose={() => setPendingProfileAnimalId(null)}
      />

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
