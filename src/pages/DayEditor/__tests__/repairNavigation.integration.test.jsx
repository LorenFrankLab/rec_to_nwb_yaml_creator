import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StoreProvider } from '../../../state/StoreContext';
import DayEditorStepper from '../DayEditorStepper';
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

  it('routes a Validation-step repair to the owning step and focuses the targeted field', async () => {
    const user = userEvent.setup();
    const { animal, day } = buildRealisticWorkspace();
    // A blank session description is an export-blocking Overview error whose field
    // has a focusable anchor in the Overview step.
    day.session.session_description = '';
    useDayIdFromUrl.mockReturnValue(day.id);

    render(
      <StoreProvider initialState={seed(animal, day)}>
        <DayEditorStepper />
      </StoreProvider>
    );

    await user.click(screen.getByRole('button', { name: /^Validation/ }));
    await user.click(screen.getByRole('button', { name: /fix in overview/i }));

    // Navigated to Overview…
    expect(screen.getByText('Session Metadata')).toBeInTheDocument();
    // …and focused the session-description control.
    const textarea = screen.getByRole('textbox', { name: /session description/i });
    await waitFor(() => expect(textarea).toHaveFocus());
  });

  it('routes an animal-surface repair (device geometry) to the Animal Editor route', async () => {
    const user = userEvent.setup();
    const { animal, day } = buildRealisticWorkspace();
    // An empty electrode-group location is an export-blocking error editable only in
    // the Animal Editor (the day inherits read-only geometry), so its repair must hand
    // off to the Animal Editor route rather than dead-ending in the Day Editor.
    animal.configurationHistory[0].devices.electrode_groups[0].location = '';
    useDayIdFromUrl.mockReturnValue(day.id);

    window.location.hash = `#/day/${day.id}`;

    render(
      <StoreProvider initialState={seed(animal, day)}>
        <DayEditorStepper />
      </StoreProvider>
    );

    await user.click(screen.getByRole('button', { name: /^Validation/ }));
    // The empty-location error is one of potentially several animal-surface repairs;
    // any of them hands off to the same Animal Editor route.
    const [animalFix] = screen.getAllByRole('button', { name: /fix in animal setup/i });
    await user.click(animalFix);

    // Handed off to the Animal Editor route for this animal (no dead-end in the Day Editor).
    // The field is encoded so the Animal Editor can deep-link to the owning step.
    expect(window.location.hash).toMatch(new RegExp(`^#/animal/${animal.id}/electrode-groups\\?`));
    expect(window.location.hash).toContain('field=');
  });

  it('encodes the issue field path on the Animal Editor handoff route', async () => {
    const user = userEvent.setup();
    const { animal, day } = buildRealisticWorkspace();
    // Empty electrode-group location → animal-surface repair with a concrete field path.
    animal.configurationHistory[0].devices.electrode_groups[0].location = '';
    useDayIdFromUrl.mockReturnValue(day.id);
    window.location.hash = `#/day/${day.id}`;

    render(
      <StoreProvider initialState={seed(animal, day)}>
        <DayEditorStepper />
      </StoreProvider>
    );

    await user.click(screen.getByRole('button', { name: /^Validation/ }));
    const [animalFix] = screen.getAllByRole('button', { name: /fix in animal setup/i });
    await user.click(animalFix);

    // The field query param carries the (URL-encoded) issue path.
    const query = window.location.hash.split('?')[1] || '';
    const params = new URLSearchParams(query);
    expect(params.get('field')).toBe('electrode_groups[0].location');
  });
});
