/**
 * Status must never be conveyed by color alone (WCAG 1.4.1): every color-coded
 * status control also exposes a non-color cue (text and/or an aria-hidden icon
 * paired with screen-reader text).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import { App } from '../../App';
import { StoreProvider } from '../../state/StoreContext';
import { makeConfiguredWorkspace } from '../helpers/test-fixtures';

const DAY_ID = 'remy-2023-06-22';

/**
 * Render <App/> seeded with the configured workspace at the given hash route.
 *
 * @param {string} hash - The hash route (e.g. '#/home').
 * @returns {Promise<import('@testing-library/react').RenderResult>}
 */
async function renderRoute(hash) {
  window.location.hash = hash;
  const view = render(
    <StoreProvider initialState={{ workspace: makeConfiguredWorkspace() }}>
      <App />
    </StoreProvider>
  );
  await act(async () => {
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    await Promise.resolve();
  });
  return view;
}

afterEach(() => {
  cleanup();
  window.location.hash = '';
});

describe('status conveyed without relying on color', () => {
  it('each DayEditor step button pairs its status icon with screen-reader text', async () => {
    const { container } = await renderRoute(`#/day/${DAY_ID}`);
    await screen.findByRole('heading', { name: /day editor/i });

    const stepButtons = container.querySelectorAll('.step-button');
    expect(stepButtons.length).toBeGreaterThan(0);

    stepButtons.forEach((button) => {
      // The decorative status emoji is hidden from AT...
      const icon = button.querySelector('.step-status-icon');
      expect(icon).not.toBeNull();
      expect(icon).toHaveAttribute('aria-hidden', 'true');
      // ...and a screen-reader-only text label conveys the same status.
      const srText = button.querySelector('.sr-only');
      expect(srText).not.toBeNull();
      expect(srText.textContent.trim().length).toBeGreaterThan(0);
    });
  });

  it('the Devices step health badges expose a non-color status label', async () => {
    const { container } = await renderRoute(`#/day/${DAY_ID}`);
    await screen.findByRole('heading', { name: /day editor/i });

    // Navigate to Devices via the global Alt+ArrowRight shortcut.
    const { fireEvent } = await import('@testing-library/react');
    fireEvent.keyDown(document.body, { key: 'ArrowRight', altKey: true });
    await screen.findByRole('heading', { name: /devices configuration/i });

    const badges = container.querySelectorAll('.status-badge');
    expect(badges.length).toBeGreaterThan(0);
    badges.forEach((badge) => {
      // role="status" with an aria-label, so the meaning is not color-only.
      expect(badge).toHaveAttribute('aria-label');
      expect(badge.getAttribute('aria-label').trim().length).toBeGreaterThan(0);
    });
  });
});
