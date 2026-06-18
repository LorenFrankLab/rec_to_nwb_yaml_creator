import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StoreProvider } from '../../../state/StoreContext';
import DayEditorFrame from '../DayEditorFrame';
import { useDayIdFromUrl } from '../../../hooks/useDayIdFromUrl';
import { buildRealisticWorkspace } from '../../../__tests__/fixtures/workspaceBuilders';

vi.mock('../../../hooks/useDayIdFromUrl', () => ({
  useDayIdFromUrl: vi.fn(),
}));

/**
 *
 * @param animal
 * @param day
 */
function seed(animal, day) {
  return {
    workspace: {
      animals: { [animal.id]: animal },
      days: { [day.id]: day },
      settings: {},
    },
  };
}

describe('Day editor repair-action navigation (integration)', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('routes a day-surface repair from the readiness bar to the owning tab and focuses the field', async () => {
    const user = userEvent.setup();
    const { animal, day } = buildRealisticWorkspace();
    // A blank session description is an export-blocking Daily Setup error whose field has a focusable
    // anchor. The readiness bar is quiet on Daily Setup, then appears on work sections.
    day.session.session_description = '';
    useDayIdFromUrl.mockReturnValue(day.id);

    render(
      <StoreProvider initialState={seed(animal, day)}>
        <DayEditorFrame />
      </StoreProvider>
    );

    await user.click(screen.getByRole('button', { name: /^Tasks & Files\b/i }));
    // The readiness bar lists the blocking issue with a "Fix" action.
    const bar = screen.getByRole('alert');
    await user.click(within(bar).getByRole('button'));

    // Navigated to the Daily Setup section…
    expect(screen.getByRole('heading', { name: /daily setup/i })).toBeInTheDocument();
    // …and focused the session-description control.
    const textarea = screen.getByRole('textbox', { name: /session description/i });
    await waitFor(() => expect(textarea).toHaveFocus());
  });

  it('routes an animal-surface repair (device geometry) from the readiness bar to the Animal Editor route', async () => {
    const user = userEvent.setup();
    const { animal, day } = buildRealisticWorkspace();
    // An empty electrode-group location is an export-blocking error editable only in the Animal
    // Editor (the day inherits read-only geometry), so its repair must hand off to the Animal Editor
    // route rather than dead-ending in the Day Editor.
    animal.configurationHistory[0].devices.electrode_groups[0].location = '';
    useDayIdFromUrl.mockReturnValue(day.id);
    window.location.hash = `#/day/${day.id}`;

    render(
      <StoreProvider initialState={seed(animal, day)}>
        <DayEditorFrame />
      </StoreProvider>
    );

    await user.click(screen.getByRole('button', { name: /^Tasks & Files\b/i }));
    // The empty-location error is one of potentially several animal-surface blockers in the
    // readiness bar; any of them hands off to the same Animal Editor route.
    const bar = screen.getByRole('alert');
    const [animalFix] = within(bar).getAllByRole('button');
    await user.click(animalFix);

    expect(window.location.hash).toMatch(new RegExp(`^#/animal/${animal.id}/electrode-groups\\?`));
    expect(window.location.hash).toContain('field=');
  });

  it('encodes the issue field path on the Animal Editor handoff route', async () => {
    const user = userEvent.setup();
    const { animal, day } = buildRealisticWorkspace();
    // Empty electrode-group location → animal-surface repair with a concrete field path. Isolate it
    // as the only blocker so the readiness bar's single Fix action carries that exact path.
    animal.configurationHistory[0].devices.electrode_groups[0].location = '';
    useDayIdFromUrl.mockReturnValue(day.id);
    window.location.hash = `#/day/${day.id}`;

    render(
      <StoreProvider initialState={seed(animal, day)}>
        <DayEditorFrame />
      </StoreProvider>
    );

    await user.click(screen.getByRole('button', { name: /^Tasks & Files\b/i }));
    const bar = screen.getByRole('alert');
    const [animalFix] = within(bar).getAllByRole('button');
    await user.click(animalFix);

    const query = window.location.hash.split('?')[1] || '';
    const params = new URLSearchParams(query);
    expect(params.get('field')).toBe('electrode_groups[0].location');
  });
});
