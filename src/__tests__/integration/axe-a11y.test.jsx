/**
 * Continuous-accessibility integration tests: render each workspace route with a
 * fully-configured workspace and assert zero Axe violations.
 *
 * Runs in the jsdom/Vitest lane (fast, same fixture renders every route). Color
 * contrast is NOT meaningfully computable in jsdom, so it is covered separately by
 * the unit-level contrast check; these tests cover structure/ARIA/labelling.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { App } from '../../App';
import { StoreProvider } from '../../state/StoreContext';
import { makeConfiguredWorkspace } from '../helpers/test-fixtures';
import CopyFromAnimalDialog from '../../pages/AnimalEditor/CopyFromAnimalDialog';
import { CalendarDayCreator } from '../../components/CalendarDayCreator/CalendarDayCreator';

const workspace = makeConfiguredWorkspace();
const ANIMAL_ID = 'remy';
const DAY_ID = 'remy-2023-06-22';

/**
 * A workspace with one record of EACH non-ok recovery class, so the recovery-review screen renders
 * its needs-review list + repair affordances (not just the all-clear state) for the Axe scan.
 */
const recoveryWorkspace = {
  settings: {},
  animals: {
    bean: { id: 'bean', subject: { subject_id: 'bean' }, days: ['bean-shared'] },
    remy: { id: 'remy', subject: { subject_id: 'remy' }, days: ['remy-missing'] },
    wilbur: { id: 'wilbur', subject: { subject_id: 'wilbur' }, days: [] },
  },
  days: {
    'bean-shared': { id: 'bean-shared', animalId: 'cleo', date: '2023-06-24' },
    'wilbur-unlinked': { id: 'wilbur-unlinked', animalId: 'wilbur', date: '2023-06-25' },
    'ghost-day': { id: 'ghost-day', animalId: 'nobody', date: '2023-06-26' },
  },
};

/**
 * Render <App/> seeded with a workspace at the given hash route.
 *
 * @param {string} hash - The hash route (e.g. '#/home').
 * @param {object} [seed] - The workspace to seed (defaults to the configured workspace).
 * @returns {Promise<import('@testing-library/react').RenderResult>}
 */
async function renderRoute(hash, seed = workspace) {
  window.location.hash = hash;
  const view = render(
    <StoreProvider initialState={{ workspace: seed }}>
      <App />
    </StoreProvider>
  );
  // Let the hash router + any lazy route resolve.
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

/**
 * Run Axe on a rendered container and assert zero violations.
 *
 * @param {HTMLElement} container - The rendered DOM container.
 * @returns {Promise<void>}
 */
async function expectNoViolations(container) {
  const results = await axe(container);
  expect(results).toHaveNoViolations();
}

describe('axe-a11y (configured workspace, all routes)', () => {
  it('Home has no violations', async () => {
    const { container } = await renderRoute('#/home');
    await screen.findByRole('main');
    await expectNoViolations(container);
  });

  it('AnimalWorkspace has no violations', async () => {
    const { container } = await renderRoute('#/workspace');
    await screen.findByRole('main');
    await expectNoViolations(container);
  });

  it('AnimalView (tabbed animal workspace) has no violations', async () => {
    // Phase 5: the stepper/editor route is gone; the animal is configured via the tabbed Animal View.
    const { container } = await renderRoute(`#/animal/${ANIMAL_ID}/electrode-groups`);
    await screen.findByRole('main');
    await expectNoViolations(container);
  });

  it('ValidationSummary has no violations', async () => {
    const { container } = await renderRoute('#/validation');
    await screen.findByRole('heading', { name: /validation summary/i });
    await expectNoViolations(container);
  });

  it('Import & Repair has no violations', async () => {
    const { container } = await renderRoute('#/import');
    await screen.findByRole('heading', { name: /import/i });
    await expectNoViolations(container);
  });

  it('Copy from another animal has no violations', async () => {
    const { container } = await renderRoute('#/copy-from-animal');
    await screen.findByRole('main');
    await expectNoViolations(container);
  });

  it('Recovery review (all clear) has no violations', async () => {
    const { container } = await renderRoute('#/recovery');
    await screen.findByRole('heading', { name: /review recovered data/i });
    await expectNoViolations(container);
  });

  it('Recovery review (needs-review records) has no violations', async () => {
    const { container } = await renderRoute('#/recovery', recoveryWorkspace);
    await screen.findByRole('heading', { name: /review recovered data/i });
    // The needs-review list is present (not the all-clear state).
    await screen.findByText(/missing record/i);
    await expectNoViolations(container);
  });

  describe('DayEditor tabs', () => {
    // The redesigned frame's 4 tab labels plus the transitional Export panel (a header action).
    const tabs = ['Day', 'Epochs', 'Failed channels', 'DIO', 'Export'];

    it.each(tabs)('tab %s has no violations', async (tabLabel) => {
      const user = userEvent.setup();
      const { container } = await renderRoute(`#/day/${DAY_ID}`);
      await screen.findByRole('heading', { name: /day editor/i });

      // Navigate to the requested tab (or the Export panel) via its button. The tab accessible names
      // include their readiness status (e.g. "Day: Complete"); Export is a header action.
      const buttonName = tabLabel === 'Export'
        ? /^Export$/i
        : new RegExp(`^${tabLabel}(?::|$)`, 'i');
      await user.click(screen.getByRole('button', { name: buttonName }));

      await expectNoViolations(container);
    });
  });

  // The overlay surfaces migrated onto the shared Modal primitive: rendered open so
  // Axe sees the live dialog (role, labelling, focusables), one case per dialog.
  describe('migrated dialogs (open) have no violations', () => {
    it('CopyFromAnimalDialog', async () => {
      const { animals } = workspace;
      const { container } = render(
        <CopyFromAnimalDialog
          open
          currentAnimalId="not-this-one"
          animals={animals}
          onCopy={() => {}}
          onCancel={() => {}}
        />
      );
      await screen.findByRole('dialog', { name: /copy from animal/i });
      await expectNoViolations(container);
    });

    it('CalendarDayCreator', async () => {
      const { container } = render(
        <CalendarDayCreator
          animalId={ANIMAL_ID}
          existingDays={[]}
          onCreateDays={() => {}}
          onClose={() => {}}
        />
      );
      await screen.findByRole('dialog', { name: /recording days calendar/i });
      await expectNoViolations(container);
    });
  });
});
