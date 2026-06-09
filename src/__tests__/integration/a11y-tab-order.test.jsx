/**
 * Tab order through the DayEditor stepper must follow the logical step order, and
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

describe('tab order through the DayEditor stepper', () => {
  it('step controls appear in DOM order matching the step sequence', async () => {
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

    const labels = [...container.querySelectorAll('.section-nav-item .section-nav-item-name')].map(
      (el) => el.textContent.trim()
    );
    // Tabbed section-nav: 5 sections in sequence (richer display labels, DOM order preserved).
    expect(labels).toEqual([
      'Overview',
      'Devices & Failed Channels',
      'Tasks & Epochs',
      'Validation',
      'Export',
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
