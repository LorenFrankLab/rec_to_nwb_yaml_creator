import { useState } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Modal from '../Modal';

afterEach(() => {
  document.body.style.overflow = '';
});

/**
 * Modal with two focusable buttons for trap tests.
 * @param props
 */
function TwoButtonModal(props) {
  return (
    <Modal isOpen onClose={() => {}} title="Test" titleId="t" {...props}>
      <button type="button">first</button>
      <button type="button">last</button>
    </Modal>
  );
}

describe('Modal', () => {
  it('traps Tab from the last focusable element back to the first', async () => {
    const user = userEvent.setup();
    render(<TwoButtonModal />);

    const first = screen.getByRole('button', { name: 'first' });
    const last = screen.getByRole('button', { name: 'last' });

    last.focus();
    expect(last).toHaveFocus();
    await user.tab();
    await waitFor(() => expect(first).toHaveFocus());
  });

  it('traps Shift+Tab from the first focusable element to the last', async () => {
    const user = userEvent.setup();
    render(<TwoButtonModal />);

    const first = screen.getByRole('button', { name: 'first' });
    const last = screen.getByRole('button', { name: 'last' });

    first.focus();
    expect(first).toHaveFocus();
    await user.tab({ shift: true });
    await waitFor(() => expect(last).toHaveFocus());
  });

  it('calls onClose once when Escape is pressed', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<TwoButtonModal onClose={onClose} />);

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on overlay click but not on content click', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { container } = render(<TwoButtonModal onClose={onClose} />);

    await user.click(screen.getByText('first')); // inside content
    expect(onClose).not.toHaveBeenCalled();

    await user.click(container.querySelector('.modal-overlay'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close on overlay click when closeOnOverlayClick is false', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { container } = render(<TwoButtonModal onClose={onClose} closeOnOverlayClick={false} />);

    await user.click(container.querySelector('.modal-overlay'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('returns focus to the opener when closed', async () => {
    const user = userEvent.setup();

    /**
     *
     */
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            open
          </button>
          <Modal isOpen={open} onClose={() => setOpen(false)} title="T" titleId="t">
            <button type="button">inside</button>
          </Modal>
        </>
      );
    }

    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'open' });
    opener.focus();
    await user.click(opener);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it('locks body scroll while open and restores it on unmount', () => {
    const { unmount } = render(<TwoButtonModal />);
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('');
  });

  it('renders the documented ARIA contract', () => {
    const { rerender } = render(<TwoButtonModal />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 't');
    expect(document.getElementById('t')).toHaveTextContent('Test');

    rerender(<TwoButtonModal role="alertdialog" />);
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    const { container } = render(
      <Modal isOpen={false} onClose={() => {}} title="T" titleId="t">
        <button type="button">x</button>
      </Modal>
    );
    expect(container.firstChild).toBeNull();
  });
});
