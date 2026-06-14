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

  it('applies a distinct class per variant and the small size (CSS-Module hashed)', () => {
    // Assert the wiring (each prop maps to its own scoped class) without coupling to
    // the hashed class names — restrained `dangerSubtle` must differ from filled `danger`,
    // and `small` must add a class on top of the variant.
    const { rerender } = render(<Button variant="danger">X</Button>);
    const danger = screen.getByRole('button').className;

    rerender(<Button variant="dangerSubtle">X</Button>);
    const dangerSubtle = screen.getByRole('button').className;
    expect(dangerSubtle).not.toBe(danger);

    rerender(<Button variant="neutral">X</Button>);
    const neutral = screen.getByRole('button').className;
    expect(neutral).not.toBe(danger);
    expect(neutral).not.toBe(dangerSubtle);

    rerender(<Button variant="dangerSubtle" size="small">X</Button>);
    const subtleSmall = screen.getByRole('button').className;
    expect(subtleSmall).not.toBe(dangerSubtle);
    expect(subtleSmall.split(' ').length).toBeGreaterThan(dangerSubtle.split(' ').length);
  });
});
