/**
 * @vitest-environment jsdom
 *
 * Accessibility contract for the overlay surfaces migrated onto the shared `<Modal>`
 * primitive: ChannelMapEditor, CopyFromAnimalDialog, and CalendarDayCreator. Each
 * must open as a real `role="dialog"` (aria-modal), trap Tab/Shift-Tab focus, return
 * focus to its opener on close, and close on Escape — the behaviors the primitive
 * owns. One parameterized case per dialog.
 */
import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChannelMapEditor from '../../pages/AnimalEditor/ChannelMapEditor';
import CopyFromAnimalDialog from '../../pages/AnimalEditor/CopyFromAnimalDialog';
import { CalendarDayCreator } from '../../components/CalendarDayCreator/CalendarDayCreator';

const DIALOGS = [
  {
    name: 'ChannelMapEditor',
    accessibleName: /channel map editor/i,
    render: (onClose) => (
      <ChannelMapEditor
        electrodeGroup={{ id: 'eg1', device_type: 'tetrode_12.5', location: 'CA1' }}
        channelMaps={[
          {
            electrode_group_id: 'eg1',
            ntrode_id: '0',
            electrode_id: 0,
            bad_channels: [],
            map: { 0: 0, 1: 1, 2: 2, 3: 3 },
          },
        ]}
        onSave={() => {}}
        onCancel={onClose}
      />
    ),
  },
  {
    name: 'CopyFromAnimalDialog',
    accessibleName: /copy electrode groups/i,
    render: (onClose) => (
      <CopyFromAnimalDialog
        open
        currentAnimalId="a1"
        animals={{
          a1: {
            subject: { subject_id: 'a1' },
            devices: { electrode_groups: [], ntrode_electrode_group_channel_map: [] },
          },
          a2: {
            subject: { subject_id: 'a2' },
            devices: {
              electrode_groups: [{ id: '1', device_type: 'tetrode_12.5', location: 'CA1' }],
              ntrode_electrode_group_channel_map: [],
            },
          },
        }}
        onCopy={() => {}}
        onCancel={onClose}
      />
    ),
  },
  {
    name: 'CalendarDayCreator',
    accessibleName: /recording days calendar/i,
    render: (onClose) => (
      <CalendarDayCreator
        animalId="a1"
        existingDays={[]}
        onCreateDays={() => {}}
        onClose={onClose}
      />
    ),
  },
];

/**
 * Harness with an opener button so focus-return has a real element to return to.
 * Starts closed; the test focuses + clicks the opener to open the dialog.
 * @param {object} props
 * @param {(onClose: Function) => JSX.Element} props.renderDialog - Renders the dialog.
 * @returns {JSX.Element}
 */
function Harness({ renderDialog }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" data-testid="opener" onClick={() => setOpen(true)}>
        opener
      </button>
      {open && renderDialog(() => setOpen(false))}
    </>
  );
}

describe.each(DIALOGS)('migrated dialog on <Modal>: $name', ({ accessibleName, render: renderDialog }) => {
  it('opens as an aria-modal dialog with the expected accessible name', async () => {
    const user = userEvent.setup();
    render(<Harness renderDialog={renderDialog} />);

    await user.click(screen.getByTestId('opener'));

    const dialog = screen.getByRole('dialog', { name: accessibleName });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('traps focus within the dialog when tabbing past the last element', async () => {
    const user = userEvent.setup();
    render(<Harness renderDialog={renderDialog} />);

    await user.click(screen.getByTestId('opener'));
    const dialog = screen.getByRole('dialog');

    const focusables = dialog.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    expect(focusables.length).toBeGreaterThan(0);

    focusables[focusables.length - 1].focus();
    await user.tab();
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
  });

  it('closes on Escape and returns focus to the opener', async () => {
    const user = userEvent.setup();
    render(<Harness renderDialog={renderDialog} />);

    const opener = screen.getByTestId('opener');
    opener.focus();
    await user.click(opener);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(opener).toHaveFocus());
  });
});

// Silence jsdom "not implemented" noise if any legacy path still reaches alert().
vi.stubGlobal('alert', vi.fn());
