import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TaskEpochsEditor from '../TaskEpochsEditor';

describe('TaskEpochsEditor', () => {
  it('renders one row per initial epoch with the epoch number populated', () => {
    render(<TaskEpochsEditor initialEpochs={[1, 3]} onChange={vi.fn()} />);

    const numberInputs = screen.getAllByRole('spinbutton', { name: /epoch number/i });
    expect(numberInputs).toHaveLength(2);
    expect(numberInputs[0]).toHaveValue(1);
    expect(numberInputs[1]).toHaveValue(3);
  });

  it('appends a row and moves focus to its first input when "Add epoch" is clicked', async () => {
    const user = userEvent.setup();
    render(<TaskEpochsEditor initialEpochs={[1]} onChange={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /add epoch/i }));

    const numberInputs = screen.getAllByRole('spinbutton', { name: /epoch number/i });
    expect(numberInputs).toHaveLength(2);
    expect(numberInputs[1]).toHaveFocus();
  });

  it('flags a row whose end <= start as an error and reports hasError to the parent', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TaskEpochsEditor initialEpochs={[1]} onChange={onChange} />);

    await user.type(screen.getByRole('spinbutton', { name: /start time.*row 1/i }), '10');
    await user.type(screen.getByRole('spinbutton', { name: /end time.*row 1/i }), '5');

    expect(screen.getByRole('alert')).toHaveTextContent(/end time must be after start time/i);
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ hasError: true })
    );
  });

  it('clears the error and re-enables save once end > start', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TaskEpochsEditor initialEpochs={[1]} onChange={onChange} />);

    const start = screen.getByRole('spinbutton', { name: /start time.*row 1/i });
    const end = screen.getByRole('spinbutton', { name: /end time.*row 1/i });
    await user.type(start, '10');
    await user.type(end, '5');
    expect(screen.queryByRole('alert')).toBeInTheDocument();

    await user.clear(end);
    await user.type(end, '20');

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ hasError: false })
    );
  });

  it('warns about overlapping intervals without reporting an error (non-blocking)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TaskEpochsEditor initialEpochs={[1, 2]} onChange={onChange} />);

    await user.type(screen.getByRole('spinbutton', { name: /start time.*row 1/i }), '0');
    await user.type(screen.getByRole('spinbutton', { name: /end time.*row 1/i }), '100');
    await user.type(screen.getByRole('spinbutton', { name: /start time.*row 2/i }), '50');
    await user.type(screen.getByRole('spinbutton', { name: /end time.*row 2/i }), '150');

    expect(screen.getByRole('status')).toHaveTextContent(/overlap/i);
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ hasError: false })
    );
  });

  it('emits unique integer epoch numbers and no start/end times', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TaskEpochsEditor initialEpochs={[1]} onChange={onChange} />);

    // Set start/end on the existing row, which must NOT appear in the emitted payload.
    await user.type(screen.getByRole('spinbutton', { name: /start time.*row 1/i }), '0');

    const lastCall = onChange.mock.calls.at(-1)[0];
    expect(lastCall.epochs).toEqual([1]);
    expect(lastCall).not.toHaveProperty('start');
    expect(lastCall).not.toHaveProperty('end');
    expect(lastCall.epochs.every((n) => Number.isInteger(n))).toBe(true);
  });

  it('treats end == start as an error (boundary)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TaskEpochsEditor initialEpochs={[1]} onChange={onChange} />);

    await user.type(screen.getByRole('spinbutton', { name: /start time.*row 1/i }), '5');
    await user.type(screen.getByRole('spinbutton', { name: /end time.*row 1/i }), '5');

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ hasError: true }));
  });

  it('does not error or warn on a partially-specified interval (start only)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TaskEpochsEditor initialEpochs={[1]} onChange={onChange} />);

    await user.type(screen.getByRole('spinbutton', { name: /start time.*row 1/i }), '5');

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ hasError: false }));
  });

  it('excludes non-integer epoch numbers from the emitted list', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TaskEpochsEditor initialEpochs={[]} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /add epoch/i }));
    await user.type(screen.getByRole('spinbutton', { name: /epoch number, row 1/i }), '1.5');

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ epochs: [] }));
  });

  it('de-duplicates repeated epoch numbers (schema uniqueItems)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TaskEpochsEditor initialEpochs={[3]} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /add epoch/i }));
    await user.type(screen.getByRole('spinbutton', { name: /epoch number, row 2/i }), '3');

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ epochs: [3] }));
  });

  it('removes a row when its remove button is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TaskEpochsEditor initialEpochs={[1, 3]} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /remove epoch row 1/i }));

    const numberInputs = screen.getAllByRole('spinbutton', { name: /epoch number/i });
    expect(numberInputs).toHaveLength(1);
    expect(numberInputs[0]).toHaveValue(3);
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ epochs: [3] })
    );
  });
});
