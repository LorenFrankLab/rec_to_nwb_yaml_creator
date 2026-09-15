/**
 * Route bundles load lazily.
 *
 * AppLayout's route outlet is ONE <Suspense> over React.lazy() page components, so the browser
 * downloads only the screen being opened. What this suite pins down is the user-visible contract of
 * that split:
 *   1. while a route chunk is in flight the outlet shows an accessible "Loading…" status, and
 *   2. the shell chrome (banner, skip links, footer) is EAGER — it paints in the same synchronous
 *      render, before any route code has arrived.
 *
 * Each "still pending" assertion uses a DIFFERENT route, because React.lazy memoizes a resolved
 * chunk for the lifetime of the module registry — a second visit to an already-loaded route mounts
 * synchronously (which is the point of the cache, not a bug).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render as rtlRender, screen, waitFor } from '@testing-library/react';
import { StoreProvider } from '../../state/StoreContext';
import { AppLayout } from '../AppLayout';

vi.mock('../../pages/AnimalWorkspace', () => ({
  AnimalWorkspace: () => (
    <main id="main-content" tabIndex="-1" data-testid="workspace-view">
      Workspace
    </main>
  ),
}));

// Home's chunk is held OPEN until a test releases it, so the "route chunk is still downloading"
// window can be observed for more than the single frame a resolved mock would take.
const { homeChunk } = vi.hoisted(() => {
  let release;
  const arrived = new Promise((resolve) => {
    release = resolve;
  });
  return { homeChunk: { arrived, release: () => release() } };
});

vi.mock('../../pages/Home', async () => {
  await homeChunk.arrived;
  return {
    Home: () => (
      <main id="main-content" tabIndex="-1" data-testid="home-view">
        Home
      </main>
    ),
  };
});

vi.mock('../../pages/LegacyFormView', () => ({
  // Mirrors the real LegacyFormView: a programmatically focusable `#main-content` that is NOT a
  // <main> element. It has to be focusable for the "focus never lands on the hidden previous page"
  // assertion below to be able to fail.
  LegacyFormView: () => (
    <div id="main-content" tabIndex="-1" data-testid="legacy-view">
      Legacy
    </div>
  ),
}));

const render = (ui) =>
  rtlRender(ui, {
    wrapper: ({ children }) => <StoreProvider>{children}</StoreProvider>,
  });

/** The route fallback, distinguished from the always-present route announcer (also role=status). */
const loadingStatus = () =>
  screen.queryAllByRole('status').filter((node) => /loading/i.test(node.textContent));

describe('AppLayout — lazy route bundles', () => {
  let originalLocation;

  beforeEach(() => {
    originalLocation = window.location;
    delete window.location;
    window.location = { hash: '#/' };
  });

  afterEach(() => {
    window.location = originalLocation;
  });

  it('shows an accessible loading status while the route chunk is pending, then mounts the route', async () => {
    window.location.hash = '#/workspace';
    render(<AppLayout />);

    // The dynamic import settles on a later microtask, so the fallback is what commits first.
    expect(loadingStatus()).toHaveLength(1);
    expect(loadingStatus()[0]).toHaveTextContent('Loading…');
    expect(screen.queryByTestId('workspace-view')).not.toBeInTheDocument();

    expect(await screen.findByTestId('workspace-view')).toBeInTheDocument();
    expect(loadingStatus()).toHaveLength(0);
  });

  it('paints the shell chrome eagerly, before the route chunk has arrived', async () => {
    window.location.hash = '#/';
    render(<AppLayout />);

    // Same synchronous render as the assertions above: no route code has resolved yet.
    expect(loadingStatus()).toHaveLength(1);
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(screen.getByText('Skip to main content')).toBeInTheDocument();
    expect(screen.getByAltText('Loren Frank Lab logo')).toBeInTheDocument();

    await screen.findByTestId('legacy-view');
  });

  it('announces immediately and focuses the NEW page once its chunk lands, never the hidden previous one', async () => {
    window.location.hash = '#/';
    render(<AppLayout />);
    const legacy = await screen.findByTestId('legacy-view');

    window.location.hash = '#/home';
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    // React keeps the PREVIOUS children mounted-but-hidden while an already-visible boundary
    // re-suspends, so `#main-content` still resolves during this window — to the old page. Let a
    // whole animation frame elapse inside it, which is when any frame-timed focus attempt would run
    // and grab that stale node.
    await waitFor(() => expect(loadingStatus()).toHaveLength(1));
    await new Promise((resolve) => {
      requestAnimationFrame(() => resolve());
    });

    // The announcement belongs to the eager shell, so it does NOT wait for the chunk.
    expect(document.getElementById('route-announcer')).toHaveTextContent(/home/i);

    homeChunk.release();
    const home = await screen.findByTestId('home-view');
    await waitFor(() => expect(document.activeElement).toBe(home));
    expect(document.activeElement).not.toBe(legacy);
  });
});
