/**
 * ShortcutsHelp tests (epoch-editor Phase 8).
 *
 * Two guarantees:
 *   1. the help dialog lists every documented shortcut (keys + action);
 *   2. the documented list stays CONSISTENT with what `useGlobalShortcuts` actually fires — every
 *      firing binding is documented (no silent shortcut) and every documented firing binding really
 *      invokes its handler (the help doesn't advertise a shortcut that does nothing). `Esc` (close a
 *      dialog) is owned by the shared `<Modal>`, so it is documented but not fired through the hook.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, renderHook, cleanup } from '@testing-library/react';
import ShortcutsHelp, { SHORTCUTS } from '../ShortcutsHelp';
import useGlobalShortcuts from '../../../hooks/useGlobalShortcuts';

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

/**
 * The contract between the documented help and the global hook: each FIRING shortcut's keydown init
 * and the handler it must invoke. (Esc is Modal-owned — documented but not fired here.)
 */
const FIRING = [
  { action: 'Save your work', keydown: { key: 's', ctrlKey: true }, handler: 'onSave' },
  { action: 'Next step', keydown: { key: 'ArrowRight', altKey: true }, handler: 'onNextStep' },
  { action: 'Previous step', keydown: { key: 'ArrowLeft', altKey: true }, handler: 'onPrevStep' },
  {
    action: 'Add a row (e.g. an epoch on the Epochs step)',
    keydown: { key: 'n', altKey: true },
    handler: 'onAdd',
  },
  { action: 'Show this help', keydown: { key: '?' }, handler: 'onShowHelp' },
];

describe('ShortcutsHelp dialog', () => {
  it('lists every documented shortcut with its action', () => {
    render(<ShortcutsHelp isOpen onClose={() => {}} />);
    expect(screen.getByRole('dialog', { name: /keyboard shortcuts/i })).toBeInTheDocument();
    for (const { action } of SHORTCUTS) {
      expect(screen.getByText(action)).toBeInTheDocument();
    }
    // The save chord is rendered as discrete <kbd> keys, not a flat string.
    expect(screen.getByText('Ctrl/Cmd').tagName).toBe('KBD');
    expect(screen.getByText('Esc').tagName).toBe('KBD');
  });

  it('does not render when closed', () => {
    render(<ShortcutsHelp isOpen={false} onClose={() => {}} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('ShortcutsHelp ↔ useGlobalShortcuts consistency', () => {
  it('documents every firing binding plus the Modal-owned Esc (no drift)', () => {
    const documented = SHORTCUTS.map((s) => s.action);
    for (const { action } of FIRING) expect(documented).toContain(action);
    // Esc is owned by the Modal, but still belongs in the help.
    expect(documented).toContain('Close a dialog');
  });

  it('every documented firing shortcut actually invokes its handler', () => {
    const handlers = {
      onSave: vi.fn(),
      onNextStep: vi.fn(),
      onPrevStep: vi.fn(),
      onAdd: vi.fn(),
      onShowHelp: vi.fn(),
    };
    renderHook(() => useGlobalShortcuts(handlers));

    for (const { keydown, handler } of FIRING) {
      document.body.dispatchEvent(
        new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...keydown })
      );
      expect(handlers[handler], `${handler} should fire`).toHaveBeenCalledTimes(1);
    }
  });
});
