/**
 * Tests for OverflowMenu — the reusable, accessible per-object ⋮ overflow menu (Phase 4, Task 4.1).
 *
 * A menu widget must be REAL ARIA + keyboard, not a div-on-click (the phase doc calls this out as a
 * risk). The trigger is a `button[aria-haspopup="menu"]` whose `aria-expanded` tracks the open state
 * and whose `aria-controls` points at a `role="menu"` of `role="menuitem"` rows. Opening moves focus
 * into the menu; Arrow Up/Down (wrapping) + Home/End move between items; Esc / Tab close and Esc
 * returns focus to the trigger; click-outside closes; choosing an item fires its `onSelect` and
 * closes; a disabled item is `aria-disabled` and is skipped by arrow navigation.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OverflowMenu from '../OverflowMenu';

/**
 * Render an OverflowMenu with three items (the middle one optionally disabled).
 * @param {object} [opts]
 * @param {boolean} [opts.disableMiddle] - Mark the "Rename" item disabled.
 * @returns {{ onOpen: Function, onRename: Function, onDelete: Function, user: object }}
 */
function renderMenu({ disableMiddle = false } = {}) {
  const onOpen = vi.fn();
  const onRename = vi.fn();
  const onDelete = vi.fn();
  const user = userEvent.setup();
  render(
    <OverflowMenu
      label="Actions for remy"
      items={[
        { key: 'open', label: 'Open', onSelect: onOpen },
        { key: 'rename', label: 'Rename…', onSelect: onRename, disabled: disableMiddle },
        { key: 'delete', label: 'Delete animal…', onSelect: onDelete },
      ]}
    />
  );
  return { onOpen, onRename, onDelete, user };
}

describe('OverflowMenu — trigger semantics', () => {
  it('exposes a labelled menu button with aria-haspopup="menu" and collapsed aria-expanded', () => {
    renderMenu();
    const trigger = screen.getByRole('button', { name: /actions for remy/i });
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    // The menu is not rendered until opened.
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('opens on click, exposes role="menu" wired via aria-controls, and flips aria-expanded', async () => {
    const { user } = renderMenu();
    const trigger = screen.getByRole('button', { name: /actions for remy/i });
    await user.click(trigger);

    const menu = screen.getByRole('menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger).toHaveAttribute('aria-controls', menu.id);
    expect(within(menu).getAllByRole('menuitem')).toHaveLength(3);
  });

  it('renders the default ⋮ glyph when no triggerContent is given', () => {
    renderMenu();
    expect(screen.getByRole('button', { name: /actions for remy/i })).toHaveTextContent('⋮');
  });

  it('renders custom triggerContent (a labelled text trigger) instead of the ⋮ glyph', () => {
    render(
      <OverflowMenu
        label="Add a standard set"
        triggerContent={
          <>
            + add a standard set <span aria-hidden="true">▾</span>
          </>
        }
        items={[{ key: 'pokes', label: '6 pokes', onSelect: vi.fn() }]}
      />
    );
    const trigger = screen.getByRole('button', { name: /add a standard set/i });
    expect(trigger).toHaveTextContent('+ add a standard set');
    expect(trigger).not.toHaveTextContent('⋮');
  });
});

describe('OverflowMenu — keyboard & focus', () => {
  it('moves focus to the first item on open', async () => {
    const { user } = renderMenu();
    await user.click(screen.getByRole('button', { name: /actions for remy/i }));
    expect(screen.getByRole('menuitem', { name: 'Open' })).toHaveFocus();
  });

  it('ArrowDown/ArrowUp move between items and wrap', async () => {
    const { user } = renderMenu();
    await user.click(screen.getByRole('button', { name: /actions for remy/i }));

    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Rename…' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Delete animal…' })).toHaveFocus();
    // Wrap forward to the first.
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Open' })).toHaveFocus();
    // Wrap backward to the last.
    await user.keyboard('{ArrowUp}');
    expect(screen.getByRole('menuitem', { name: 'Delete animal…' })).toHaveFocus();
  });

  it('Home/End jump to the first/last item', async () => {
    const { user } = renderMenu();
    await user.click(screen.getByRole('button', { name: /actions for remy/i }));
    await user.keyboard('{End}');
    expect(screen.getByRole('menuitem', { name: 'Delete animal…' })).toHaveFocus();
    await user.keyboard('{Home}');
    expect(screen.getByRole('menuitem', { name: 'Open' })).toHaveFocus();
  });

  it('opens with ArrowDown from the trigger and focuses the first item', async () => {
    const { user } = renderMenu();
    const trigger = screen.getByRole('button', { name: /actions for remy/i });
    trigger.focus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Open' })).toHaveFocus();
  });

  it('Escape closes the menu and returns focus to the trigger', async () => {
    const { user } = renderMenu();
    const trigger = screen.getByRole('button', { name: /actions for remy/i });
    await user.click(trigger);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('Tab closes the menu', async () => {
    const { user } = renderMenu();
    await user.click(screen.getByRole('button', { name: /actions for remy/i }));
    await user.keyboard('{Tab}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});

describe('OverflowMenu — selection & dismissal', () => {
  it('invokes the item onSelect and closes when an item is chosen', async () => {
    const { onDelete, user } = renderMenu();
    await user.click(screen.getByRole('button', { name: /actions for remy/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete animal…' }));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes when clicking outside the menu', async () => {
    const { user } = renderMenu();
    await user.click(screen.getByRole('button', { name: /actions for remy/i }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await user.click(document.body);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes on route change (hashchange) so it cannot linger over the next view and intercept clicks', async () => {
    const { user } = renderMenu();
    await user.click(screen.getByRole('button', { name: /actions for remy/i }));
    expect(screen.getByRole('menu')).toBeInTheDocument();

    // Navigation that does NOT pass through an outside pointerdown (back/forward, a keyboard-activated
    // link, programmatic routing) must still dismiss the menu — otherwise the dropdown overlays the
    // new view and eats the next click (observed in the browser walkthrough).
    act(() => {
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});

describe('OverflowMenu — key propagation (nesting safety)', () => {
  it('does not bubble its handled keys (Esc / arrows) to an ancestor keydown handler', async () => {
    const parentKeyDown = vi.fn();
    const user = userEvent.setup();
    render(
      // The menu may be nested inside another keyboard widget (e.g. the animal switcher popup),
      // whose ancestor keydown must NOT also fire when the menu consumes Esc/arrows.
      <div onKeyDown={parentKeyDown}>
        <OverflowMenu
          label="Actions for remy"
          items={[
            { key: 'open', label: 'Open', onSelect: () => {} },
            { key: 'delete', label: 'Delete animal…', onSelect: () => {} },
          ]}
        />
      </div>
    );

    await user.click(screen.getByRole('button', { name: /actions for remy/i }));
    parentKeyDown.mockClear();

    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Escape}');
    expect(parentKeyDown).not.toHaveBeenCalled();
  });
});

describe('OverflowMenu — disabled items', () => {
  it('marks a disabled item aria-disabled, does not fire its onSelect, and skips it in arrow nav', async () => {
    const { onRename, user } = renderMenu({ disableMiddle: true });
    await user.click(screen.getByRole('button', { name: /actions for remy/i }));

    const rename = screen.getByRole('menuitem', { name: 'Rename…' });
    expect(rename).toHaveAttribute('aria-disabled', 'true');

    // Clicking it does nothing and the menu stays open.
    await user.click(rename);
    expect(onRename).not.toHaveBeenCalled();
    expect(screen.getByRole('menu')).toBeInTheDocument();

    // ArrowDown from the first item skips the disabled "Rename…" and lands on "Delete animal…".
    screen.getByRole('menuitem', { name: 'Open' }).focus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Delete animal…' })).toHaveFocus();
  });
});
