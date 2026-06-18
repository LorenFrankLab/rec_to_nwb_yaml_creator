/**
 * Tab order through the DayEditor frame must follow the logical section order, and
 * no control may use a positive tabindex (which would scramble the natural order).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import { App } from '../../App';
import { StoreProvider } from '../../state/StoreContext';
import { makeConfiguredWorkspace } from '../helpers/test-fixtures';

const DAY_ID = 'remy-2023-06-22';

afterEach(() => {
  cleanup();
  window.location.hash = '';
});

describe('tab order through the DayEditor frame', () => {
  it('section controls appear in DOM order matching the section sequence', async () => {
    window.location.hash = `#/day/${DAY_ID}`;
    render(
      <StoreProvider initialState={{ workspace: makeConfiguredWorkspace() }}>
        <App />
      </StoreProvider>
    );
    await act(async () => {
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      await Promise.resolve();
    });
    await screen.findByRole('heading', { name: /day editor/i });

    const tabBar = screen.getByRole('navigation', { name: /day editor sections/i });
    const labels = [...tabBar.querySelectorAll('button')].map((el) =>
      (el.getAttribute('aria-label') || el.textContent).replace(/\s+[—-].+$/, '').trim()
    );
    expect(labels).toEqual([
      'Daily Setup',
      'Tasks & Files',
      'Recording Setup',
      'Failed Channels',
      'DIO Wiring',
      'Fix & Export',
    ]);
  });

  it('no interactive control uses a positive tabindex', async () => {
    window.location.hash = `#/day/${DAY_ID}`;
    const { container } = render(
      <StoreProvider initialState={{ workspace: makeConfiguredWorkspace() }}>
        <App />
      </StoreProvider>
    );
    await act(async () => {
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      await Promise.resolve();
    });
    await screen.findByRole('heading', { name: /day editor/i });

    const positive = [...container.querySelectorAll('[tabindex]')].filter(
      (el) => Number(el.getAttribute('tabindex')) > 0
    );
    expect(positive).toEqual([]);
  });
});
