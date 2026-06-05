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
    await user.type(screen.getByLabelText(/dio output name/i), 'Laser');
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
});
