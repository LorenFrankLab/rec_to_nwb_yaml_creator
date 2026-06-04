import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import useGlobalShortcuts from '../useGlobalShortcuts';

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

/**
 * Mount the hook with spy handlers; returns the handlers.
 *
 * @param {object} [extra] - Handler overrides.
 * @returns {Record<string, import('vitest').Mock>} The spy handlers.
 */
function mount(extra = {}) {
  const handlers = {
    onSave: vi.fn(),
    onShowHelp: vi.fn(),
    onNextStep: vi.fn(),
    onPrevStep: vi.fn(),
    onAdd: vi.fn(),
    ...extra,
  };
  renderHook(() => useGlobalShortcuts(handlers));
  return handlers;
}

/**
 * Dispatch a keydown on `target` (default document.body) and return the event.
 *
 * @param {string} key - The KeyboardEvent key.
 * @param {object} [options] - Target + extra KeyboardEvent init (altKey, ctrlKey, …).
 * @param {EventTarget} [options.target] - The dispatch target.
 * @returns {KeyboardEvent} The dispatched event.
 */
function press(key, { target = document.body, ...opts } = {}) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...opts });
  target.dispatchEvent(event);
  return event;
}

describe('useGlobalShortcuts', () => {
  it('Ctrl/Cmd+S triggers save and prevents the browser default', () => {
    const handlers = mount();

    const ctrl = press('s', { ctrlKey: true });
    expect(handlers.onSave).toHaveBeenCalledTimes(1);
    expect(ctrl.defaultPrevented).toBe(true);

    const meta = press('s', { metaKey: true });
    expect(handlers.onSave).toHaveBeenCalledTimes(2);
    expect(meta.defaultPrevented).toBe(true);
  });

  it('? opens the shortcuts help', () => {
    const handlers = mount();
    press('?');
    expect(handlers.onShowHelp).toHaveBeenCalledTimes(1);
  });

  it('Alt+ArrowRight / Alt+ArrowLeft move the stepper', () => {
    const handlers = mount();
    press('ArrowRight', { altKey: true });
    press('ArrowLeft', { altKey: true });
    expect(handlers.onNextStep).toHaveBeenCalledTimes(1);
    expect(handlers.onPrevStep).toHaveBeenCalledTimes(1);
  });

  it('Alt+N triggers the context add', () => {
    const handlers = mount();
    press('n', { altKey: true });
    expect(handlers.onAdd).toHaveBeenCalledTimes(1);
  });

  it('ignores shortcuts while typing in an input/textarea', () => {
    const handlers = mount();
    const input = document.createElement('input');
    document.body.appendChild(input);

    press('?', { target: input });
    press('n', { altKey: true, target: input });
    press('ArrowRight', { altKey: true, target: input });

    expect(handlers.onShowHelp).not.toHaveBeenCalled();
    expect(handlers.onAdd).not.toHaveBeenCalled();
    expect(handlers.onNextStep).not.toHaveBeenCalled();
  });

  it('ignores shortcuts while a modal is open', () => {
    const handlers = mount();
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    document.body.appendChild(overlay);

    press('?');
    press('n', { altKey: true });

    expect(handlers.onShowHelp).not.toHaveBeenCalled();
    expect(handlers.onAdd).not.toHaveBeenCalled();
  });

  it('still suppresses the browser save dialog while typing but does not save', () => {
    const handlers = mount();
    const input = document.createElement('input');
    document.body.appendChild(input);

    const event = press('s', { ctrlKey: true, target: input });
    expect(event.defaultPrevented).toBe(true);
    expect(handlers.onSave).not.toHaveBeenCalled();
  });
});
