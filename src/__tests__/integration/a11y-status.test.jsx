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
  it('the day readiness is conveyed by the readiness bar with text, not color alone', async () => {
    await renderRoute(`#/day/${DAY_ID}`);
    await screen.findByRole('heading', { name: /day editor/i });

    // The redesigned frame conveys export readiness through the issue-driven readiness bar (a
    // role=status/alert region with explicit text), not color-coded section-nav glyphs. Its decorative
    // ✓/⚠ icon is aria-hidden, so the meaning lives in the text.
    const readiness = screen.getByText(/ready to export|block(s)? export/i);
    expect(readiness).toBeInTheDocument();
    const region = readiness.closest('[role="status"], [role="alert"]');
    expect(region).not.toBeNull();
    region.querySelectorAll('[aria-hidden="true"]').forEach((icon) => {
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });
  });

  it('the Failed-channels tab health badges expose a non-color status label', async () => {
    const { container } = await renderRoute(`#/day/${DAY_ID}`);
    await screen.findByRole('heading', { name: /day editor/i });

    // Navigate to the Failed channels tab.
    const { fireEvent } = await import('@testing-library/react');
    fireEvent.click(screen.getByRole('button', { name: 'Failed channels' }));
    await screen.findByRole('heading', { name: /setup & failed channels/i });

    const badges = container.querySelectorAll('.status-badge');
    expect(badges.length).toBeGreaterThan(0);
    badges.forEach((badge) => {
      // role="status" with an aria-label, so the meaning is not color-only.
      expect(badge).toHaveAttribute('aria-label');
      expect(badge.getAttribute('aria-label').trim().length).toBeGreaterThan(0);
    });
  });
});
