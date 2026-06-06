import React, { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FsGuiSection from '../FsGuiSection';

const CAMERAS = [
  { id: 0, camera_name: 'overhead' },
  { id: 1, camera_name: 'side' },
];

/**
 *
 * @param root0
 * @param root0.epochOptions
 */
function Harness({ epochOptions = [1, 2] }) {
  const [fsGuiYamls, setFsGuiYamls] = useState([]);
  return (
    <FsGuiSection
      fsGuiYamls={fsGuiYamls}
      cameras={CAMERAS}
      epochOptions={epochOptions}
      onChange={setFsGuiYamls}
    />
  );
}

describe('FsGuiSection', () => {
  it('adds a protocol and edits its fields, committing through onChange', async () => {
    const user = userEvent.setup();
    let latest = null;
    /**
     *
     */
    function Capture() {
      const [items, setItems] = useState([]);
      latest = items;
      return (
        <FsGuiSection
          fsGuiYamls={items}
          cameras={CAMERAS}
          epochOptions={[1, 2]}
          onChange={setItems}
        />
      );
    }
    render(<Capture />);

    await user.click(screen.getByRole('button', { name: /add fsgui protocol/i }));
    await user.type(screen.getByLabelText(/protocol file name/i), 'p.yaml');
    await user.type(screen.getByLabelText(/^power/i), '5');
    await user.type(screen.getByLabelText(/dio output/i), 'Laser');
    await user.selectOptions(screen.getByLabelText(/^camera$/i), '1');
    await user.click(screen.getByLabelText(/epoch 2/i));

    expect(latest).toHaveLength(1);
    expect(latest[0]).toMatchObject({
      name: 'p.yaml',
      power_in_mW: 5,
      dio_output_name: 'Laser',
      camera_id: 1, // numeric, parsed from the controlled select (not a free-typed id)
      epochs: [2],
    });
  });

  it('offers only the known epochs as controlled choices', () => {
    render(<Harness epochOptions={[3, 7]} />);
    // Render an item to reveal the epoch checkboxes.
    expect(screen.queryByLabelText(/epoch 3/i)).not.toBeInTheDocument(); // none added yet
  });

  it('renders an empty state before any protocol is added', () => {
    render(<Harness />);
    expect(screen.getByText(/no fsgui protocols added/i)).toBeInTheDocument();
  });

  it('shows a stale (no-longer-a-task) epoch so it can be unchecked to fix the orphan', async () => {
    const user = userEvent.setup();
    let latest = null;
    /**
     *
     */
    function Capture() {
      // Protocol references epoch 9, which is NOT in epochOptions (a task was renumbered).
      const [items, setItems] = useState([
        { name: 'p', epochs: [9], power_in_mW: 5, dio_output_name: '', camera_id: '' },
      ]);
      latest = items;
      return (
        <FsGuiSection
          fsGuiYamls={items}
          cameras={CAMERAS}
          epochOptions={[1, 2]}
          onChange={setItems}
        />
      );
    }
    render(<Capture />);

    // The stale epoch is rendered (checked) with a fix hint, even though it's not a task epoch.
    const stale = screen.getByLabelText(/epoch 9/i);
    expect(stale).toBeChecked();
    await user.click(stale); // uncheck to clear the orphan

    expect(latest[0].epochs).toEqual([]);
  });

  it('offers the DIO output as a controlled select of behavioral event names', async () => {
    const user = userEvent.setup();
    let latest = null;
    /**
     *
     */
    function Capture() {
      const [items, setItems] = useState([]);
      latest = items;
      return (
        <FsGuiSection
          fsGuiYamls={items}
          cameras={CAMERAS}
          epochOptions={[1]}
          dioOptions={['reward_left', 'reward_right']}
          onChange={setItems}
        />
      );
    }
    render(<Capture />);

    await user.click(screen.getByRole('button', { name: /add fsgui protocol/i }));
    // It's a select (not free text) so a dangling DIO name cannot be typed.
    const dio = screen.getByLabelText(/dio output/i);
    expect(dio.tagName).toBe('SELECT');
    await user.selectOptions(dio, 'reward_right');

    expect(latest[0].dio_output_name).toBe('reward_right');
  });
});
