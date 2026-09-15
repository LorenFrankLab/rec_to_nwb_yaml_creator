/**
 * Render the whole app on its DEFAULT route — the legacy metadata form — and wait for that route
 * to be on screen.
 *
 * AppLayout code-splits every route behind `React.lazy`, so `render(<App />)` commits the shell plus
 * the "Loading…" placeholder first and the routed page arrives on a later tick. The legacy-form
 * suites render `<App />` only as a HOST for the form, so they await this helper once instead of
 * repeating the wait at every call site.
 *
 * @module __tests__/helpers/render-legacy-app
 */

import { render, screen } from '@testing-library/react';
import { App } from '../../App';
import { StoreProvider } from '../../state/StoreContext';

/**
 * Render `<App />` inside a StoreProvider and resolve once the legacy form's main landmark exists.
 *
 * @returns {Promise<import('@testing-library/react').RenderResult>} The render result, so callers
 *   can still destructure `container` / `rerender` / `unmount` exactly as before.
 */
export async function renderLegacyApp() {
  const result = render(
    <StoreProvider>
      <App />
    </StoreProvider>
  );
  // The legacy form owns the page's `main` landmark; its presence means the route chunk mounted.
  await screen.findByRole('main');
  return result;
}

export default renderLegacyApp;
