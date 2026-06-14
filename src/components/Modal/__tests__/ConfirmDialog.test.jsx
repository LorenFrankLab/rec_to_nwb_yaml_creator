import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConfirmDialog from '../ConfirmDialog';

const baseProps = {
  isOpen: true,
  title: 'Delete item?',
  message: 'This cannot be undone.',
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
};

describe('ConfirmDialog', () => {
  it('renders the title and message', () => {
    render(<ConfirmDialog {...baseProps} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText('Delete item?')).toBeInTheDocument();
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument();
  });

  it('calls onConfirm (not onCancel) when Confirm is clicked', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConfirmDialog {...baseProps} confirmLabel="Delete" onConfirm={onConfirm} onCancel={onCancel} />);

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('calls onCancel (not onConfirm) for Cancel, ESC, and overlay click', async () => {
    const user = userEvent.setup();

    // Cancel button
    let onConfirm = vi.fn();
    let onCancel = vi.fn();
    const { unmount } = render(
      <ConfirmDialog {...baseProps} onConfirm={onConfirm} onCancel={onCancel} />
    );
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();

    // ESC
    await user.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(2);

    // Overlay click
    await user.click(screen.getByTestId('modal-overlay'));
    expect(onCancel).toHaveBeenCalledTimes(3);
    expect(onConfirm).not.toHaveBeenCalled();
    unmount();
  });

  it('applies destructive styling to the confirm button when destructive', () => {
    render(<ConfirmDialog {...baseProps} destructive confirmLabel="Delete" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveClass('btn-danger');
  });

  it('uses a non-destructive confirm button by default', () => {
    render(<ConfirmDialog {...baseProps} confirmLabel="OK" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'OK' })).toHaveClass('btn-save');
  });

  it('exposes role="alertdialog" with the message described when destructive', () => {
    render(<ConfirmDialog {...baseProps} destructive onConfirm={vi.fn()} onCancel={vi.fn()} />);
    const dialog = screen.getByRole('alertdialog');
    const describedBy = dialog.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy)).toHaveTextContent('This cannot be undone.');
  });

  it('stays role="dialog" when not destructive', () => {
    render(<ConfirmDialog {...baseProps} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});
