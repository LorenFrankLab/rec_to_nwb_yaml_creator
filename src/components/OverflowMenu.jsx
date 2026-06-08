import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import './OverflowMenu.css';

/**
 * OverflowMenu — a reusable, accessible ⋮ overflow menu (Phase 4, Task 4.1).
 *
 * Implements the WAI-ARIA menu-button pattern (NOT a div-on-click): a
 * `button[aria-haspopup="menu"]` whose `aria-expanded` tracks the open state and `aria-controls`
 * points at a `role="menu"` of `role="menuitem"` rows. Opening moves focus into the menu and onto
 * the first enabled item; Arrow Up/Down wrap between enabled items; Home/End jump to the first/last
 * enabled item; Esc / Tab close (Esc returns focus to the trigger); an outside click closes; and
 * choosing an item fires its `onSelect` then closes. A disabled item renders `aria-disabled` and is
 * skipped by both keyboard navigation and activation.
 *
 * Shared by every per-object lifecycle affordance (the animal-picker cards and the AnimalView
 * header band) so the menu semantics can't drift between them.
 *
 * @param {object} props
 * @param {string} props.label - Accessible name for the trigger button (e.g. "Actions for remy").
 * @param {Array<{key: string, label: string, onSelect: Function, disabled?: boolean}>} props.items -
 *   The menu items, in display order.
 * @param {string} [props.buttonClassName] - Extra class on the trigger button.
 * @returns {JSX.Element}
 */
export default function OverflowMenu({ label, items, buttonClassName }) {
  const menuId = useId();
  const [open, setOpen] = useState(false);
  // Index of the item that owns focus while the menu is open (a roving focus target).
  const [activeIndex, setActiveIndex] = useState(0);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const itemRefs = useRef([]);

  const enabledIndexes = items
    .map((item, i) => (item.disabled ? -1 : i))
    .filter((i) => i !== -1);

  const firstEnabled = enabledIndexes[0] ?? 0;
  const lastEnabled = enabledIndexes[enabledIndexes.length - 1] ?? 0;

  /**
   * Open the menu, optionally aiming focus at the last item (e.g. ArrowUp on the trigger).
   * @param {('first'|'last')} [edge] - Which enabled item to focus on open.
   */
  const openMenu = useCallback(
    (edge = 'first') => {
      setActiveIndex(edge === 'last' ? lastEnabled : firstEnabled);
      setOpen(true);
    },
    [firstEnabled, lastEnabled]
  );

  /** Close the menu and (optionally) return focus to the trigger. */
  const closeMenu = useCallback((returnFocus = false) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  // Move DOM focus to the active item whenever the menu is open and the active index changes.
  useEffect(() => {
    if (open) itemRefs.current[activeIndex]?.focus();
  }, [open, activeIndex]);

  // Close on an outside click (pointerdown so it beats the item click). Scoped to the document
  // only while open. A click on the trigger is handled by its own onClick, so ignore it here.
  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      if (menuRef.current?.contains(e.target) || triggerRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  // Close on route change (this app is hash-routed). Navigation that does NOT pass through an
  // outside pointerdown — back/forward, a keyboard-activated link, or programmatic routing — must
  // still dismiss the menu; otherwise the absolutely-positioned dropdown lingers over the next
  // view and intercepts its first click (observed in the browser walkthrough).
  useEffect(() => {
    if (!open) return undefined;
    const onHashChange = () => setOpen(false);
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [open]);

  /**
   * Step the active item to the next/previous ENABLED item, wrapping at the ends.
   * @param {number} direction - +1 for next, -1 for previous.
   */
  const moveActive = (direction) => {
    if (enabledIndexes.length === 0) return;
    const pos = enabledIndexes.indexOf(activeIndex);
    // From an unknown/disabled current position, entering forward lands on the first enabled item
    // and backward on the last — so a fresh open + ArrowUp behaves predictably.
    const nextPos =
      pos === -1
        ? direction > 0
          ? 0
          : enabledIndexes.length - 1
        : (pos + direction + enabledIndexes.length) % enabledIndexes.length;
    setActiveIndex(enabledIndexes[nextPos]);
  };

  /**
   * Activate an item by index: fire its onSelect (if enabled) and close.
   * @param {number} index - The item's index in `items`.
   */
  const selectItem = (index) => {
    const item = items[index];
    if (!item || item.disabled) return;
    closeMenu(true);
    item.onSelect();
  };

  /**
   * Key handling on the trigger button: open + aim focus.
   * @param {React.KeyboardEvent} e - The keydown event.
   */
  const handleTriggerKeyDown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      // Don't let an ancestor keyboard widget (e.g. the animal-switcher popup) also act on the key.
      e.stopPropagation();
      openMenu('first');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      openMenu('last');
    }
  };

  /**
   * Key handling inside the open menu: roving focus + activation + dismissal.
   * @param {React.KeyboardEvent} e - The keydown event.
   */
  const handleMenuKeyDown = (e) => {
    // Every key the menu acts on is also stopped from bubbling, so an ancestor keyboard widget
    // (e.g. the animal-switcher popup) doesn't double-handle the menu's Esc / arrows / activation.
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        e.stopPropagation();
        moveActive(1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        e.stopPropagation();
        moveActive(-1);
        break;
      case 'Home':
        e.preventDefault();
        e.stopPropagation();
        setActiveIndex(firstEnabled);
        break;
      case 'End':
        e.preventDefault();
        e.stopPropagation();
        setActiveIndex(lastEnabled);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        e.stopPropagation();
        selectItem(activeIndex);
        break;
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        closeMenu(true);
        break;
      case 'Tab':
        // Let focus leave naturally, but dismiss the menu so it doesn't linger.
        closeMenu(false);
        break;
      default:
        break;
    }
  };

  return (
    <div className="overflow-menu">
      <button
        ref={triggerRef}
        type="button"
        className={`overflow-menu-trigger${buttonClassName ? ` ${buttonClassName}` : ''}`}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => (open ? closeMenu(false) : openMenu('first'))}
        onKeyDown={handleTriggerKeyDown}
      >
        <span aria-hidden="true">⋮</span>
      </button>

      {open && (
        <ul
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={label}
          className="overflow-menu-list"
          onKeyDown={handleMenuKeyDown}
        >
          {items.map((item, index) => (
            <li key={item.key} role="none">
              <button
                type="button"
                role="menuitem"
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                className="overflow-menu-item"
                // Roving tabindex: only the active item is in the tab order; the rest are -1.
                tabIndex={index === activeIndex ? 0 : -1}
                // APG: a disabled menuitem stays perceivable/focusable via aria-disabled (NOT the
                // native `disabled` attribute) — activation is guarded in selectItem instead.
                aria-disabled={item.disabled || undefined}
                onClick={() => selectItem(index)}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

OverflowMenu.propTypes = {
  label: PropTypes.string.isRequired,
  items: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      onSelect: PropTypes.func.isRequired,
      disabled: PropTypes.bool,
    })
  ).isRequired,
  buttonClassName: PropTypes.string,
};

OverflowMenu.defaultProps = {
  buttonClassName: undefined,
};
