/**
 * @file Tests for AnimalWorkspace — the animal PICKER (Phase 1 — tabbed-workspace-ia).
 *
 * After the tab-shell conversion the Workspace is a pure picker: animal cards are LINKS to
 * `#/animal/:id/days` (no inline pane, no local selection). Pane-behavior (calendar, the
 * "Edit Animal Setup" header link) is verified against the extracted RecordingDaysTab, which
 * AnimalView hosts at the route.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StoreProvider } from '../../../state/StoreContext';
import { AnimalWorkspace } from '../index';
import { RecordingDaysTab } from '../RecordingDaysTab';

/**
 * Render the Workspace picker seeded with the given animals/days.
 * @param {object} [initialState] - StoreProvider initial state (omit for an empty workspace).
 * @returns {object} render result
 */
function renderWorkspace(initialState) {
  return render(
    <StoreProvider initialState={initialState}>
      <AnimalWorkspace />
    </StoreProvider>
  );
}

/**
 * Render the recording-days pane for one animal directly (its real host is AnimalView at the
 * route; pane behavior is the same component).
 * @param {string} animalId - The animal whose pane to render.
 * @param {object} animals - workspace.animals
 * @param {object} [days] - workspace.days
 * @returns {object} render result
 */
function renderPane(animalId, animals, days = {}) {
  return render(
    <StoreProvider initialState={{ workspace: { animals, days, settings: {} } }}>
      <RecordingDaysTab animalId={animalId} />
    </StoreProvider>
  );
}

describe('AnimalWorkspace picker — Initial State', () => {
  describe('Empty Workspace', () => {
    it('renders main heading', () => {
      renderWorkspace();
      expect(screen.getByRole('heading', { name: /animal workspace/i })).toBeInTheDocument();
    });

    it('shows empty state message when no animals exist', () => {
      renderWorkspace();
      expect(screen.getByText(/no animals/i)).toBeInTheDocument();
    });

    it('provides link to create first animal', () => {
      renderWorkspace();
      const createLink = screen.getByRole('link', { name: /create.*animal/i });
      expect(createLink).toBeInTheDocument();
      expect(createLink).toHaveAttribute('href', expect.stringMatching(/#\/?home/i));
    });

    it('renders with proper ARIA landmarks', () => {
      const { container } = renderWorkspace();
      const main = container.querySelector('main#main-content');
      expect(main).toBeInTheDocument();
      expect(main).toHaveAttribute('role', 'main');
      expect(main).toHaveAttribute('tabIndex', '-1');
    });
  });

  describe('Animal cards link to the tabbed view', () => {
    it('renders each animal as a link to #/animal/:id/days', () => {
      renderWorkspace({
        workspace: {
          animals: { remy: { subject: { subject_id: 'remy' }, days: [] } },
          days: {},
          settings: {},
        },
      });
      const card = screen.getByRole('link', { name: /remy/i });
      expect(card).toHaveAttribute('href', '#/animal/remy/days');
    });

    it('shows the sole animal as a card link to its days route (no auto-open)', () => {
      window.location.hash = '#/workspace';
      renderWorkspace({
        workspace: {
          animals: { onlyone: { subject: { subject_id: 'onlyone' }, days: [] } },
          days: {},
          settings: {},
        },
      });
      // The picker stays reachable (so "+ New Animal" is always available); the sole animal is a
      // link, not auto-opened into the tabbed view.
      expect(screen.getByRole('link', { name: /onlyone/i })).toHaveAttribute('href', '#/animal/onlyone/days');
      expect(screen.queryByRole('region', { name: /animal setup/i })).not.toBeInTheDocument();
    });
  });

  describe('?animal= handshake → route navigation', () => {
    let originalHash;
    beforeEach(() => {
      originalHash = window.location.hash;
    });
    afterEach(() => {
      window.location.hash = originalHash;
    });

    it('navigates to the animal days route when ?animal= names an existing animal', () => {
      window.location.hash = '#/workspace?animal=testanimal';
      renderWorkspace({
        workspace: {
          animals: { testanimal: { subject: { subject_id: 'testanimal' }, days: [] } },
          days: {},
          settings: {},
        },
      });
      expect(window.location.hash).toBe('#/animal/testanimal/days');
    });

    it('does not navigate when ?animal= names an unknown animal (shows the picker)', () => {
      window.location.hash = '#/workspace?animal=nonexistent';
      renderWorkspace({
        workspace: {
          animals: { otheranimal: { subject: { subject_id: 'otheranimal' }, days: [] } },
          days: {},
          settings: {},
        },
      });
      expect(window.location.hash).toBe('#/workspace?animal=nonexistent');
      expect(screen.getByRole('link', { name: /otheranimal/i })).toHaveAttribute('href', '#/animal/otheranimal/days');
    });
  });

  describe('Create New Animal', () => {
    it('shows "New Animal" link in the picker', () => {
      renderWorkspace({
        workspace: {
          animals: { testanimal: { subject: { subject_id: 'testanimal' }, days: [] } },
          days: {},
          settings: {},
        },
      });
      const createButton = screen.getByRole('link', { name: /create new animal/i });
      expect(createButton).toBeInTheDocument();
      expect(createButton).toHaveAttribute('href', '#/home');
    });

    it('does not render the per-animal "Edit Animal Setup" link (that lives in the animal view)', () => {
      renderWorkspace({
        workspace: {
          animals: {
            testanimal: { subject: { subject_id: 'testanimal' }, days: [] },
            otheranimal: { subject: { subject_id: 'otheranimal' }, days: [] },
          },
          days: {},
          settings: {},
        },
      });
      expect(screen.queryByRole('link', { name: /edit animal setup/i })).not.toBeInTheDocument();
    });
  });
});

describe('Recording-days pane (hosted by AnimalView at the route)', () => {
  const testanimal = { subject: { subject_id: 'testanimal' }, days: [] };

  describe('Calendar', () => {
    it('shows an "Add Recording Days" button that opens the calendar', async () => {
      const user = userEvent.setup();
      renderPane('testanimal', { testanimal });
      const addButton = screen.getByRole('button', { name: /show calendar/i });
      expect(addButton).toHaveTextContent(/add recording days/i);
      await user.click(addButton);
      expect(screen.getByRole('dialog', { name: /recording days calendar/i })).toBeInTheDocument();
    });

    it('hides the calendar when the close button is clicked', async () => {
      const user = userEvent.setup();
      renderPane('testanimal', { testanimal });
      await user.click(screen.getByRole('button', { name: /show calendar/i }));
      await user.click(screen.getByRole('button', { name: /close calendar/i }));
      expect(screen.queryByRole('dialog', { name: /recording days calendar/i })).not.toBeInTheDocument();
    });
  });

  describe('Edit Animal Setup link (Task 2.1 — removed)', () => {
    it('does not render an "Edit Animal Setup" link in the day-tab header (its destinations are the setup tabs now)', () => {
      renderPane('testanimal', { testanimal });
      expect(screen.queryByRole('link', { name: /edit animal setup/i })).not.toBeInTheDocument();
      // The primary "Add Recording Days" action stays.
      expect(screen.getByRole('button', { name: /show calendar/i })).toHaveTextContent(/add recording days/i);
    });
  });
});
