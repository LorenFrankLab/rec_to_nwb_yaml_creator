import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Button from '../Button';

describe('Button (canonical primitive)', () => {
  it('renders its children as a real button', () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('defaults to type="button" so it never accidentally submits a form', () => {
    render(<Button>Add</Button>);
    expect(screen.getByRole('button', { name: 'Add' })).toHaveAttribute('type', 'button');
  });

  it('honors an explicit type', () => {
    render(<Button type="submit">Go</Button>);
    expect(screen.getByRole('button', { name: 'Go' })).toHaveAttribute('type', 'submit');
  });

  it('forwards onClick and disabled to the underlying button', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(<Button onClick={onClick}>Click</Button>);

    await user.click(screen.getByRole('button', { name: 'Click' }));
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(
      <Button onClick={onClick} disabled>
        Click
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Click' });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(onClick).toHaveBeenCalledTimes(1); // still 1 — disabled swallows the click
  });

  it('forwards arbitrary attributes (aria-label, title)', () => {
    render(
      <Button aria-label="Save changes" title="Save">
        💾
      </Button>,
    );
    expect(screen.getByRole('button', { name: 'Save changes' })).toHaveAttribute('title', 'Save');
  });
});
