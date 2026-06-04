/**
 * Continuous-accessibility integration tests: render each workspace route with a
 * fully-configured workspace and assert zero Axe violations.
 *
 * Runs in the jsdom/Vitest lane (fast, same fixture renders every route). Color
 * contrast is NOT meaningfully computable in jsdom, so it is covered separately by
 * the unit-level contrast check; these tests cover structure/ARIA/labelling.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, waitFor, act, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { App } from '../../App';
import { StoreProvider } from '../../state/StoreContext';
import { makeConfiguredWorkspace } from '../helpers/test-fixtures';
import ChannelMapEditor from '../../pages/AnimalEditor/ChannelMapEditor';
import CopyFromAnimalDialog from '../../pages/AnimalEditor/CopyFromAnimalDialog';
import { CalendarDayCreator } from '../../components/CalendarDayCreator/CalendarDayCreator';

const workspace = makeConfiguredWorkspace();
const ANIMAL_ID = 'remy';
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
    <StoreProvider initialState={{ workspace }}>
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

  it('AnimalEditor has no violations', async () => {
    const { container } = await renderRoute(`#/animal/${ANIMAL_ID}/editor`);
    // Lazy-loaded; wait for the editor's main content.
    await waitFor(() => expect(screen.getByRole('main')).toBeInTheDocument());
    await expectNoViolations(container);
  });

  it('ValidationSummary has no violations', async () => {
    const { container } = await renderRoute('#/validation');
    await screen.findByRole('heading', { name: /validation summary/i });
    await expectNoViolations(container);
  });

  describe('DayEditor steps', () => {
    const steps = ['Overview', 'Devices', 'Epochs', 'Validation', 'Export'];

    it.each(steps)('step %s has no violations', async (stepLabel) => {
      const user = userEvent.setup();
      const { container } = await renderRoute(`#/day/${DAY_ID}`);
      await screen.findByRole('heading', { name: /day editor/i });

      // Navigate to the requested step via its StepNavigation button.
      const stepButton = screen.getByRole('button', { name: new RegExp(`^${stepLabel}`, 'i') });
      await user.click(stepButton);

      await expectNoViolations(container);
    });
  });

  // The overlay surfaces migrated onto the shared Modal primitive: rendered open so
  // Axe sees the live dialog (role, labelling, focusables), one case per dialog.
  describe('migrated dialogs (open) have no violations', () => {
    it('ChannelMapEditor', async () => {
      const { container } = render(
        <ChannelMapEditor
          electrodeGroup={{ id: 0, device_type: 'tetrode_12.5', location: 'CA1' }}
          channelMaps={[
            {
              electrode_group_id: 0,
              ntrode_id: 0,
              bad_channels: [],
              map: { 0: 0, 1: 1, 2: 2, 3: 3 },
            },
          ]}
          onSave={() => {}}
          onCancel={() => {}}
        />
      );
      await screen.findByRole('dialog', { name: /channel map editor/i });
      await expectNoViolations(container);
    });

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
      await screen.findByRole('dialog', { name: /copy electrode groups/i });
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
